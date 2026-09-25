import { EngineDriver } from './engine/driver.js';
import { CompatPage } from './engine/compat.js';
import type { PageLike } from './engine/page-like.js';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { Viewport, EnhancedElement, ElementIssue, AuditResult } from './schemas.js';
import { VIEWPORTS } from './schemas.js';
import { viewportToConfig } from './devices.js';
import { evaluateTargetSize } from './rules/target-sizing.js';
import { CAPTURED_STYLE_KEYS } from './rules/style-read.js';

/**
 * Lock file to prevent concurrent extractions
 */
const LOCK_FILE = '.extracting';
const LOCK_TIMEOUT_MS = 180000; // 3 minutes (longer than extraction to prevent stale locks)
const EXTRACTION_TIMEOUT_MS = 120000; // 2 minutes - allows complex pages to load

/**
 * Extracted element information
 */
export interface ExtractedElement {
  selector: string;
  tagName: string;
  id?: string;
  className?: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  computedStyles: Record<string, string>;
}

/**
 * CSS custom properties (variables)
 */
export interface CSSVariables {
  [key: string]: string;
}

/**
 * Full extraction result
 */
export interface ExtractionResult {
  url: string;
  timestamp: string;
  viewport: Viewport;
  html: string;
  elements: ExtractedElement[];
  cssVariables: CSSVariables;
  screenshotPath: string;
}

/**
 * Options for HTML extraction
 */
export interface ExtractOptions {
  url: string;
  outputDir: string;
  sessionId: string;
  viewport?: Viewport;
  timeout?: number;
  /** CSS selectors to extract (defaults to semantic elements) */
  selectors?: string[];
}

/**
 * Default semantic selectors to extract
 */
const DEFAULT_SELECTORS = [
  'header',
  'nav',
  'main',
  'section',
  'article',
  'aside',
  'footer',
  'h1',
  'h2',
  'h3',
  'button',
  'a[href]',
  'form',
  'input',
  'img',
];

/**
 * Key CSS properties to extract
 */
const CSS_PROPERTIES_TO_EXTRACT = [
  'display',
  'position',
  'width',
  'height',
  'padding',
  'margin',
  'backgroundColor',
  'color',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'lineHeight',
  'textAlign',
  'borderRadius',
  'border',
  'boxShadow',
  'gap',
  'flexDirection',
  'alignItems',
  'justifyContent',
  'gridTemplateColumns',
  'gridTemplateRows',
];

// Singleton driver instance
let driver: EngineDriver | null = null;

/**
 * Close the browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

/**
 * Check if extraction is already in progress
 */
async function checkLock(outputDir: string): Promise<boolean> {
  const lockPath = join(outputDir, LOCK_FILE);
  if (!existsSync(lockPath)) {
    return false;
  }

  try {
    const content = await readFile(lockPath, 'utf-8');
    const timestamp = parseInt(content, 10);
    const age = Date.now() - timestamp;

    // Lock is stale if older than timeout
    if (age > LOCK_TIMEOUT_MS) {
      await unlink(lockPath);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Create extraction lock
 */
async function createLock(outputDir: string): Promise<void> {
  const lockPath = join(outputDir, LOCK_FILE);
  await writeFile(lockPath, Date.now().toString());
}

/**
 * Release extraction lock
 */
async function releaseLock(outputDir: string): Promise<void> {
  const lockPath = join(outputDir, LOCK_FILE);
  try {
    await unlink(lockPath);
  } catch {
    // Ignore errors
  }
}

/**
 * Extract computed styles for an element
 */
async function extractElementStyles(
  page: PageLike,
  selector: string
): Promise<ExtractedElement[]> {
  return page.evaluate(
    ({ sel, props }: { sel: string; props: string[] }) => {
      const elements = document.querySelectorAll(sel);
      const results: ExtractedElement[] = [];

      elements.forEach((el, index) => {
        const htmlEl = el as HTMLElement;
        const rect = htmlEl.getBoundingClientRect();
        const computed = window.getComputedStyle(htmlEl);

        const styles: Record<string, string> = {};
        props.forEach((prop) => {
          const value = computed.getPropertyValue(
            prop.replace(/([A-Z])/g, '-$1').toLowerCase()
          );
          if (value && value !== 'none' && value !== 'normal' && value !== '0px') {
            styles[prop] = value;
          }
        });

        results.push({
          selector: `${sel}:nth-of-type(${index + 1})`,
          tagName: htmlEl.tagName.toLowerCase(),
          id: htmlEl.id || undefined,
          className: htmlEl.className || undefined,
          bounds: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          computedStyles: styles,
        });
      });

      return results;
    },
    { sel: selector, props: CSS_PROPERTIES_TO_EXTRACT }
  );
}

/**
 * Interactive element selectors for audit
 */
const INTERACTIVE_SELECTORS = [
  'button',
  'a[href]',
  'a:not([href])',  // Links without href (potential issues)
  'input[type="submit"]',
  'input[type="button"]',
  'input[type="text"]',
  'input[type="email"]',
  'input[type="password"]',
  // Same class of native form control as text/email/password above — these
  // were silently invisible to scan/audit even though observe/session_action
  // (the CDP AX-tree path in engine/cdp/accessibility.ts) already see them.
  'input[type="radio"]',
  'input[type="checkbox"]',
  'input[type="search"]',
  'input[type="tel"]',
  'input[type="url"]',
  'input[type="number"]',
  'input[type="date"]',
  'input[type="file"]',
  'input[type="range"]',
  'input[type="color"]',
  // <summary> genuinely toggles <details> open/closed; a bare
  // contenteditable region genuinely accepts typing. Neither needs a JS
  // handler to be interactive — see isContentEditable capture below and
  // summarize.ts's isLooksInteractive/buildInteractionMap for how the
  // audit avoids flagging them as "looks interactive, no handler".
  'details',
  'summary',
  // Exclude contenteditable="false", which explicitly opts OUT of editing.
  '[contenteditable]:not([contenteditable="false"])',
  'select',
  'textarea',
  '[role="button"]',
  '[role="link"]',
  // Current breadcrumb pages are sometimes plain text rather than links.
  // Include them so the breadcrumb contract can distinguish the APG-allowed
  // non-link current item from a linked item missing aria-current="page".
  '[aria-current]',
  '[onclick]',
  '[tabindex]:not([tabindex="-1"])',
];

/**
 * Activation event types checked by `enrichWithEventListeners` below. Chosen
 * to cover the ways a click-like activation actually fires in the wild
 * (mouse, pointer, touch, and keyboard-driven `role="button"` widgets) —
 * NOT a generic "any listener" check, which would rescue elements wired for
 * unrelated events (e.g. a `mouseenter` tooltip) that a user cannot actually
 * activate.
 */
const ACTIVATION_EVENT_TYPES = [
  'click', 'mousedown', 'mouseup',
  'pointerdown', 'pointerup',
  'touchstart', 'touchend',
  'keydown', 'keyup',
];

/**
 * Real listener detection via DevTools' `getEventListeners`, only reachable
 * through Runtime.evaluate's `includeCommandLineAPI` flag (see
 * RuntimeDomain.evaluateWithCommandLineAPI / CompatPage.evaluateWithCommandLineAPI).
 *
 * Why this exists: `detectHandlers()` above (in-page, no special CDP flags)
 * can see React/Vue/Angular props and the `onclick` property/attribute, but
 * page JS has no public API to enumerate addEventListener-registered
 * listeners on itself. A real scan reported 28 fake-interactive errors
 * (e.g. `#rail-designer`, `#start-btn`) for buttons wired entirely with
 * `addEventListener` — working buttons that `detectHandlers()` structurally
 * cannot see. This closes that gap for whichever PageLike actually supports
 * it (CompatPage today; Playwright/other PageLikes skip it and behavior is
 * unchanged, since the enrichment call is feature-detected below).
 *
 * Only re-checks elements `detectHandlers()` already called "no handler" —
 * elements that already have a detected handler don't need a second,
 * more expensive check.
 *
 * Root-level listeners (document.body, document.documentElement, document,
 * window) are deliberately EXCLUDED from the ancestor walk: a
 * document-level click listener (menu dismissal, outside-click handling,
 * analytics) would otherwise "rescue" every dead control on the page,
 * silencing the exact defect class this enrichment exists to catch. They
 * are credited only through a separate, EVIDENCE-based check: the root click
 * listener's handler source (`listener.toString()`) must name the candidate —
 * a selector literal the candidate (or a non-root ancestor) matches, e.g.
 * `e.target.closest('[data-action]')`; its id alongside an `.id` read; or a
 * `dataset.<key>` read the candidate carries — or jQuery's delegated-event
 * data must hold a matching selector. A pure dismissal listener names no
 * selector the dead control matches, so it still gets flagged. Known gap:
 * a negated check (`if (!e.target.closest('.menu')) close()`) credits
 * controls inside `.menu`. When the root handler source is not inspectable
 * (native/bound function), nothing is credited and the NO_HANDLER message
 * is hedged instead (see ROOT_DELEGATION_UNRESOLVED).
 *
 * The ancestor (delegation) walk only checks for `click` listeners, unlike
 * the element's OWN check above which uses the full ACTIVATION_EVENT_TYPES
 * list. A container that listens for `keydown` (a dialog's Escape handler,
 * a page's keyboard shortcuts) or `pointerdown` (a drag surface) is not
 * event delegation — it doesn't re-dispatch activation to descendants — so
 * treating it as one would mark every dead button inside that container as
 * handled. `click` bubbles and is the only event type real delegation
 * patterns (`container.addEventListener('click', e => ...)`) actually rely
 * on, so it's the only one safe to credit to an ancestor.
 *
 * React 17+ moved its one delegated listener from `document` down to the
 * framework ROOT container (`#root`, `#__next`) — below `document.body`, so
 * the walk reaches and, pre-fix, credited it. That listener is React's own
 * internal event-dispatch plumbing, not a real author delegation pattern for
 * whatever button happens to sit under it, so crediting it silenced
 * fake-interactive on every dead control in a React app. The walk stops at
 * (and does not credit) any ancestor carrying a framework-ROOT marker
 * (`__reactContainer$*`, `_reactRootContainer`, `__vue_app__`) — the mount
 * point the framework was told to render into, not an author-written
 * delegating container.
 *
 * An earlier version of this fix ALSO skipped the whole ancestor walk
 * whenever the CANDIDATE element itself carried a framework marker
 * (`__reactProps$*`, `__reactFiber$*`, `__vueParentComponent`, `__vnode`),
 * reasoning that `detectHandlers()`'s framework-props check was already
 * authoritative for such a node. That over-reached: the framework-ROOT stop
 * above already closes the real false negative (React's root-level dispatch
 * listener), and skipping the walk for every framework-managed node also
 * discarded real, author-written native delegation attached to a plain
 * (non-root) ancestor via a ref — a legitimate pattern the walk should still
 * credit. That skip has been removed; the ancestor walk now always runs for
 * every candidate, gated only by the framework-ROOT stop.
 *
 * React/Vue never attach a native DOM listener for `onClick`/`onSubmit` —
 * the handler function lives on the fiber's props object
 * (`__reactProps$*.onClick`), invisible to `getEventListeners()` even though
 * the framework fully intends to dispatch on click via its root listener.
 * The ancestor walk (and the closest-`form` submit check below) also credit
 * an ancestor whose own `__reactProps$*` key holds an object with a function
 * `onClick` (or `onSubmit` for the form case) — covering `<form onSubmit>`
 * around a plain `<button type="submit">` and `<div onClick>` around a
 * plain child button, both real working React patterns that have no native
 * listener anywhere in the tree.
 *
 * The element's OWN listener check (`hasActivationListener`) is unaffected
 * by any of the above — a framework-managed node with a genuine
 * addEventListener of its own is still detected.
 */
/**
 * Elements for which enrichment found no handler of their own or on a
 * non-root ancestor, but a root-level click listener exists whose source is
 * not inspectable (native/bound function, handleEvent object) — so whether it
 * delegates to this element cannot be decided. In-memory only (not part of
 * the schema); analyzeElements uses it to hedge its NO_HANDLER message instead
 * of asserting a flat "has no click handler". Lost on serialization, in which
 * case the message falls back to the flat form.
 */
const ROOT_DELEGATION_UNRESOLVED = new WeakSet<EnhancedElement>();

async function enrichWithEventListeners(page: PageLike, elements: EnhancedElement[]): Promise<void> {
  const evaluateWithCommandLineAPI = page.evaluateWithCommandLineAPI?.bind(page);
  if (!evaluateWithCommandLineAPI) return;

  // Native form/interactive tags activate without any author-written click
  // handler (a <select> opens on its own, a <label> forwards to its control),
  // and `hasHref` elements are already known-good via the href, not via a
  // handler this enrichment could ever find. Feeding them through
  // `getEventListeners` risks the OPPOSITE mistake this enrichment exists to
  // fix: a false `hasEventListener`/`hasDelegatedListener` would flip
  // `hasOnClick` to true on an element the rest of the pipeline correctly
  // never needed it on, newly (and wrongly) counting it as "interactive via
  // click" for any rule that branches on that flag.
  const NO_AUTHOR_HANDLER_TAGS = new Set([
    'input', 'select', 'textarea', 'summary', 'details', 'option', 'label',
  ]);
  const candidates = elements.filter((el) =>
    !el.interactive.hasOnClick &&
    !el.interactive.hasHref &&
    !NO_AUTHOR_HANDLER_TAGS.has(el.tagName),
  );
  if (candidates.length === 0) return;

  // Selectors come straight from generateSelector() above, which truncates
  // to 200 chars and is not guaranteed unique (e.g. two elements that fall
  // back to the same tag+class path under different unrelated ancestors).
  // querySelector() below resolves the FIRST match for a given string, so a
  // collision can enrich the wrong element; accepted as a best-effort
  // limitation, same as every other selector-keyed lookup in this file.
  const selectors = [...new Set(candidates.map((el) => el.selector))];

  const expression = `
    (function () {
      const selectors = ${JSON.stringify(selectors)};
      const activationTypes = ${JSON.stringify(ACTIVATION_EVENT_TYPES)};
      const hasActivationListener = (node) => {
        let listeners;
        try {
          listeners = getEventListeners(node);
        } catch (e) {
          return false;
        }
        if (!listeners) return false;
        return activationTypes.some((type) => Array.isArray(listeners[type]) && listeners[type].length > 0);
      };
      const hasClickListener = (node) => {
        let listeners;
        try {
          listeners = getEventListeners(node);
        } catch (e) {
          return false;
        }
        return !!(listeners && Array.isArray(listeners.click) && listeners.click.length > 0);
      };
      // Ancestor chains overlap heavily across candidates (siblings under the
      // same list/table share most of their parent chain), and
      // getEventListeners() is a real CDP round-trip cost, not a cheap
      // in-page read -- memoize per node for this one evaluate() call.
      const clickListenerCache = new Map();
      const hasClickListenerCached = (node) => {
        if (clickListenerCache.has(node)) return clickListenerCache.get(node);
        const result = hasClickListener(node);
        clickListenerCache.set(node, result);
        return result;
      };
      // React stores an element's fiber props on an own key prefixed
      // __reactProps$ (the suffix is a per-render random id). Returns that
      // props object, or undefined if the node carries no such key --used to
      // credit delegation from an ancestor whose props hold a function
      // onClick/onSubmit, since React itself never attaches a native DOM
      // listener for those (see file header comment above).
      const reactPropsOf = (node) => {
        const keys = Object.keys(node);
        const key = keys.find((k) => k.startsWith('__reactProps$'));
        return key ? node[key] : undefined;
      };
      const hasReactPropsOnClick = (node) => {
        const props = reactPropsOf(node);
        return !!(props && typeof props.onClick === 'function');
      };
      const hasReactPropsOnSubmit = (node) => {
        const props = reactPropsOf(node);
        return !!(props && typeof props.onSubmit === 'function');
      };
      // The framework MOUNT POINT (__reactContainer$* is React's own marker
      // for the container element it was told to render into;
      // _reactRootContainer is the same for older React;  __vue_app__ is
      // Vue's). React 17+ attaches its one delegated click listener here --
      // below document.body, so the ancestor walk reaches it -- and that
      // listener is React's internal dispatch plumbing, not an
      // author-written delegation pattern for whatever happens to render
      // under it. The walk must stop at (and never credit) this node.
      const isFrameworkRoot = (node) => {
        const keys = Object.keys(node);
        return keys.some((k) => k.startsWith('__reactContainer$')) ||
          Object.prototype.hasOwnProperty.call(node, '_reactRootContainer') ||
          Object.prototype.hasOwnProperty.call(node, '__vue_app__');
      };
      const hasSubmitListener = (node) => {
        let listeners;
        try {
          listeners = getEventListeners(node);
        } catch (e) {
          return false;
        }
        return !!(listeners && Array.isArray(listeners.submit) && listeners.submit.length > 0);
      };
      const isSubmitButton = (el) => {
        const tag = el.tagName;
        const type = (el.getAttribute('type') || '').toLowerCase();
        if (tag === 'BUTTON') return type === '' || type === 'submit';
        if (tag === 'INPUT') return type === 'submit' || type === 'image';
        return false;
      };

      // ---- Root-level (window/document/html/body) click delegation ----
      // Root listeners are NOT credited blindly (menu-dismissal listeners
      // would silence every dead control). A root click listener is credited
      // to a candidate only when its handler source names that candidate:
      // a string literal that is a CSS selector the candidate matches
      // (e.target.closest('[data-action]'), .matches('.js-copy')), a literal
      // equal to the candidate's id alongside an .id read, or a dataset.<key>
      // / getAttribute('data-<key>') read the candidate carries. jQuery
      // delegated handlers ($(document).on('click', sel, fn)) store their
      // selector in jQuery's private event data, read directly when present.
      const rootNodes = [window, document, document.documentElement, document.body].filter(Boolean);
      const literalRe = /'((?:[^'\\\\\\n]|\\\\.){1,200})'|"((?:[^"\\\\\\n]|\\\\.){1,200})"|\`([^\`$\\\\]{1,200})\`/g;
      const bareTagRe = /^[a-zA-Z][a-zA-Z0-9-]*$/;
      const rootInfo = { sources: [], opaque: false, jquerySelectors: [] };
      for (const node of rootNodes) {
        let listeners;
        try {
          listeners = getEventListeners(node);
        } catch (e) {
          continue;
        }
        const clicks = listeners && Array.isArray(listeners.click) ? listeners.click : [];
        for (const entry of clicks) {
          const fn = entry && entry.listener;
          let src = '';
          try {
            src = typeof fn === 'function' ? Function.prototype.toString.call(fn) : '';
          } catch (e) {
            src = '';
          }
          if (!src || /\\{\\s*\\[native code\\]\\s*\\}/.test(src)) {
            rootInfo.opaque = true;
            continue;
          }
          rootInfo.sources.push(src.length > 100000 ? src.slice(0, 100000) : src);
        }
        try {
          const jq = window.jQuery;
          const data = jq && typeof jq._data === 'function' ? jq._data(node, 'events') : null;
          const handlers = data && Array.isArray(data.click) ? data.click : [];
          for (const h of handlers) {
            if (h && typeof h.selector === 'string' && h.selector) rootInfo.jquerySelectors.push(h.selector);
          }
        } catch (e) { /* jQuery absent or private API changed */ }
      }
      const rootLiterals = [];
      const rootDatasetAttrs = [];
      let rootReadsId = false;
      for (const src of rootInfo.sources) {
        literalRe.lastIndex = 0;
        let m;
        let count = 0;
        while ((m = literalRe.exec(src)) !== null && count < 500) {
          count++;
          const lit = (m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]).trim();
          if (lit) rootLiterals.push(lit);
        }
        const dsRe = /\\.dataset\\.([A-Za-z_$][\\w$]*)|\\.dataset\\[\\s*['"]([^'"]+)['"]\\s*\\]/g;
        let d;
        while ((d = dsRe.exec(src)) !== null) {
          const key = d[1] || d[2];
          rootDatasetAttrs.push('data-' + key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()));
        }
        if (/\\.id\\b/.test(src)) rootReadsId = true;
      }
      for (const lit of rootLiterals) {
        if (/^data-[\\w-]+$/.test(lit)) rootDatasetAttrs.push(lit.toLowerCase());
      }
      const isRootEl = (n) => n === document.body || n === document.documentElement;
      // A literal "matches" a candidate when the candidate itself matches it,
      // or a non-root ancestor does (closest-style delegation). Bare tag
      // names ('div', 'span') only count on the candidate itself: incidental
      // createElement('div') literals would otherwise match nearly every
      // candidate through some ancestor. Literals that match <html>/<body>
      // ('*', 'body', ':root') are never selective and are skipped.
      // Split a selector list on top-level commas (not inside [] or ()).
      const splitSelectorList = (sel) => {
        const parts = []; let depth = 0; let cur = '';
        for (const ch of sel) {
          if (ch === '[' || ch === '(') depth++;
          else if ((ch === ']' || ch === ')') && depth > 0) depth--;
          if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; } else cur += ch;
        }
        if (cur.trim()) parts.push(cur.trim());
        return parts;
      };
      // A pure type selector ('button', 'a, button', 'button:not(.x)' still
      // leads with a type) names no particular control: analytics trackers
      // and outside-click closers use them (closest('a,button')). A source
      // literal is evidence of delegation to THIS control only through a
      // list part that carries a class, id or attribute component outside
      // any :not(...). jQuery-registered selectors are direct proof of a
      // bound delegated handler and skip this test (trusted = true).
      const isSelectivePart = (part) => /[[.#]/.test(part.replace(/:not\\([^)]*\\)/g, ''));
      const selectorMatches = (el, sel, trusted) => {
        try {
          if (document.documentElement.matches(sel) || (document.body && document.body.matches(sel))) return false;
          const parts = trusted ? [sel] : splitSelectorList(sel).filter(isSelectivePart);
          for (const part of parts) {
            if (el.matches(part)) return true;
            if (bareTagRe.test(part)) continue;
            const hit = el.closest(part);
            if (hit && !isRootEl(hit)) return true;
          }
          return false;
        } catch (e) {
          return false; // not a valid selector
        }
      };
      const rootDelegatesTo = (el) => {
        for (const sel of rootInfo.jquerySelectors) {
          if (selectorMatches(el, sel, true)) return true;
        }
        for (const lit of rootLiterals) {
          if (selectorMatches(el, lit)) return true;
          if (rootReadsId && el.id && lit === el.id) return true;
        }
        for (const attr of rootDatasetAttrs) {
          if (el.hasAttribute(attr)) return true;
        }
        return false;
      };

      const results = {};
      for (const selector of selectors) {
        let el;
        try {
          el = document.querySelector(selector);
        } catch (e) {
          continue;
        }
        if (!el) continue;

        const hasEventListener = hasActivationListener(el);

        let hasDelegatedListener = false;
        let ancestor = el.parentElement;
        while (ancestor && ancestor !== document.body && ancestor !== document.documentElement) {
          if (isFrameworkRoot(ancestor)) break;
          if (hasClickListenerCached(ancestor) || hasReactPropsOnClick(ancestor)) {
            hasDelegatedListener = true;
            break;
          }
          ancestor = ancestor.parentElement;
        }

        if (!hasDelegatedListener && isSubmitButton(el)) {
          const form = el.closest ? el.closest('form') : null;
          if (form && (hasSubmitListener(form) || hasReactPropsOnSubmit(form))) hasDelegatedListener = true;
        }

        let rootDelegationUnresolved = false;
        if (!hasEventListener && !hasDelegatedListener) {
          if (rootDelegatesTo(el)) hasDelegatedListener = true;
          else if (rootInfo.opaque) rootDelegationUnresolved = true;
        }

        results[selector] = { hasEventListener, hasDelegatedListener, rootDelegationUnresolved };
      }
      return results;
    })()
  `;

  let raw: unknown;
  try {
    raw = await evaluateWithCommandLineAPI(expression);
  } catch {
    // getEventListeners / includeCommandLineAPI unavailable or failed for
    // any other reason — leave elements exactly as detectHandlers() left
    // them, never regress the static detection this enrichment layers on.
    return;
  }

  if (!raw || typeof raw !== 'object') return;
  const results = raw as Record<string, {
    hasEventListener?: boolean;
    hasDelegatedListener?: boolean;
    rootDelegationUnresolved?: boolean;
  } | undefined>;

  for (const el of candidates) {
    const result = results[el.selector];
    if (!result) continue;
    if (result.rootDelegationUnresolved) ROOT_DELEGATION_UNRESOLVED.add(el);
    if (result.hasEventListener) el.interactive.hasEventListener = true;
    if (result.hasDelegatedListener) el.interactive.hasDelegatedListener = true;
    if (result.hasEventListener || result.hasDelegatedListener) el.interactive.hasOnClick = true;
  }
}

/**
 * Extract enhanced interactive elements with handler detection
 */
export async function extractInteractiveElements(page: PageLike, fullText = false): Promise<EnhancedElement[]> {
  const elements = await page.evaluate(({ selectors, styleKeys, fullText }: { selectors: string[]; styleKeys: string[]; fullText: boolean }) => {
    const seen = new Set<Element>();
    const elements: EnhancedElement[] = [];

    /**
     * Capture exactly the properties `CAPTURED_STYLE_KEYS` declares — no more,
     * and critically no LESS.
     *
     * This used to be a hand-written object literal of eight properties while
     * rules read fifteen. `spacing-grid/off-grid` read paddingTop, and
     * `calm-precision/gestalt-grouping` read border-width; neither was in the
     * literal, so both read `undefined`, both treated it as "nothing to
     * report", and both returned null for every element on every page they
     * ever ran against. Deriving the capture from the same list the readers
     * validate against is what makes that class of gap impossible rather than
     * merely fixed once.
     */
    const captureStyles = (computed: CSSStyleDeclaration): Record<string, string> => {
      const out: Record<string, string> = {};
      for (const key of styleKeys) {
        const value = (computed as unknown as Record<string, string>)[key];
        if (typeof value === 'string' && value !== '') out[key] = value;
      }
      return out;
    };

    // Helper: Generate unique selector (arrow function to avoid __name bundling issue)
    const generateSelector = (el: HTMLElement): string => {
      if (el.id) return `#${el.id}`;

      const path: string[] = [];
      let current: HTMLElement | null = el;

      while (current && current !== document.body) {
        let selector = current.tagName.toLowerCase();
        if (current.id) {
          selector = `#${current.id}`;
          path.unshift(selector);
          break;
        } else if (current.className && typeof current.className === 'string') {
          const classes = current.className.split(' ').filter(c => c.trim() && !c.includes(':'));
          if (classes.length > 0) {
            selector += `.${classes[0]}`;
          }
        }

        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(
            c => c.tagName === current!.tagName
          );
          if (siblings.length > 1) {
            const index = siblings.indexOf(current) + 1;
            selector += `:nth-of-type(${index})`;
          }
        }

        path.unshift(selector);
        current = current.parentElement;
      }

      return path.join(' > ').slice(0, 200);
    };

    // Helper: Detect click handlers (arrow function to avoid __name bundling issue)
    const detectHandlers = (el: HTMLElement) => {
      const keys = Object.keys(el);

      // React 17+ uses __reactProps$
      const reactPropsKey = keys.find(k => k.startsWith('__reactProps$'));
      let hasReactHandler = false;
      if (reactPropsKey) {
        const props = (el as any)[reactPropsKey];
        hasReactHandler = !!(props?.onClick || props?.onSubmit || props?.onMouseDown);
      }

      // Also check React fiber
      const fiberKey = keys.find(k => k.startsWith('__reactFiber$'));
      if (!hasReactHandler && fiberKey) {
        const fiber = (el as any)[fiberKey];
        hasReactHandler = !!(fiber?.pendingProps?.onClick || fiber?.memoizedProps?.onClick);
      }

      // Vue uses __vue__ or __vnode
      const hasVueHandler = !!(
        (el as any).__vue__?.$listeners?.click ||
        (el as any).__vnode?.props?.onClick
      );

      // Angular uses __ngContext__
      const hasAngularHandler = !!(el as any).__ngContext__ || el.hasAttribute('ng-click');

      // Vanilla DOM
      const hasVanillaHandler = typeof (el as any).onclick === 'function' ||
                                 el.hasAttribute('onclick');

      return {
        hasReactHandler,
        hasVueHandler,
        hasAngularHandler,
        hasVanillaHandler,
        hasAnyHandler: hasReactHandler || hasVueHandler || hasAngularHandler || hasVanillaHandler,
      };
    };

    // Helper: does the browser activate this control with no author JS at
    // all? A `<button type=submit>` (or `<input type=submit|image>`) whose
    // owning form has an action/formaction, or whose formmethod/method is
    // "dialog", submits/closes purely via native form semantics; a
    // `type=reset` button resets its form the same way; and the Popover API
    // / Invoker Commands attributes (`popovertarget`, `commandfor`) drive
    // native show/hide with zero script. None of these show up in
    // detectHandlers() (no onclick, no framework props, no addEventListener)
    // and would otherwise be reported dead by both the NO_HANDLER audit
    // below and handler-integrity/fake-interactive.
    const hasNativeActivation = (el: Element): boolean => {
      const tag = el.tagName.toLowerCase();
      if (tag !== 'button' && tag !== 'input') return false;
      const control = el as HTMLButtonElement | HTMLInputElement;
      const type = (control.type || '').toLowerCase();
      const form = control.form;
      if (form && (type === 'submit' || (tag === 'input' && type === 'image'))) {
        // formaction/formmethod on the control override the form's action/method (HTML spec).
        const formMethod = (control.getAttribute('formmethod') || '').toLowerCase();
        const method = (form.getAttribute('method') || '').toLowerCase();
        if (control.getAttribute('formaction') || formMethod === 'dialog' || form.getAttribute('action') || method === 'dialog') return true;
      }
      if (form && type === 'reset') return true;
      // Popover API / Invoker Commands — only meaningful on button/input.
      if (el.hasAttribute('popovertarget') || el.hasAttribute('commandfor')) return true;
      return false;
    };

    // Helper: bounds of the largest VISIBLE <label> that activates this
    // control. Clicking an associated label activates its control, so for a
    // visually-hidden input (`sr-only`, `clip-path: inset(50%)`, `opacity:0`)
    // the label is the thing a finger actually lands on — the input's own
    // 1x1 box never was the target. Read by src/rules/target-sizing.ts.
    const measureLabelTarget = (el: HTMLElement): {
      bounds?: { x: number; y: number; width: number; height: number };
      count: number;
    } => {
      const labelled = el as HTMLElement & { labels?: NodeListOf<HTMLLabelElement> | null };
      let labels: HTMLElement[] = labelled.labels ? Array.from(labelled.labels) : [];
      if (labels.length === 0) {
        // Non-labelable elements (e.g. a [role="checkbox"] div) can still sit
        // inside a <label> that forwards the click.
        const ancestor = el.closest?.('label');
        if (ancestor) labels = [ancestor as HTMLElement];
      }

      let best: { x: number; y: number; width: number; height: number } | undefined;
      let bestArea = 0;
      for (const label of labels) {
        const style = window.getComputedStyle(label);
        // A label that is itself hidden or click-through supplies no hit area.
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        if (style.opacity === '0' || style.pointerEvents === 'none') continue;
        const r = label.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        const labelArea = r.width * r.height;
        if (labelArea <= bestArea) continue;
        bestArea = labelArea;
        best = {
          x: Math.round(r.x),
          y: Math.round(r.y),
          width: Math.round(r.width),
          height: Math.round(r.height),
        };
      }
      // `count` is reported even when no label is VISIBLE: a control whose
      // only label is hidden at this viewport (a `sm:hidden` nav toggle above
      // the breakpoint) has no pointer target to grade at all.
      return { bounds: best, count: labels.length };
    };

    // Helper: how much NON-target text sits in this element's nearest
    // block-level ancestor. Feeds the WCAG 2.5.8 "Inline" exception — a link
    // in a sentence is surrounded by hundreds of characters of prose, while a
    // link in a `|`-separated inline nav is surrounded by one or two. The
    // threshold itself lives in src/rules/target-sizing.ts so it is tunable
    // and unit-testable without a browser.
    const TARGET_SELECTOR = 'a,button,input,select,textarea,[role="button"],[role="link"],[onclick]';
    const measureSurroundingText = (el: HTMLElement): number => {
      // Walk out of inline wrappers (<strong>, <em>, <span>) to the block
      // that establishes the line box — that is the "sentence" WCAG means.
      let block: HTMLElement | null = el.parentElement;
      while (block && window.getComputedStyle(block).display.startsWith('inline')) {
        block = block.parentElement;
      }
      if (!block) return 0;

      const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();
      const blockText = collapse(block.textContent || '');
      if (!blockText) return 0;

      let targetChars = 0;
      block.querySelectorAll(TARGET_SELECTOR).forEach((t) => {
        targetChars += collapse(t.textContent || '').length;
      });

      // Nested targets are counted twice and can drive this negative; clamp
      // to 0 so ambiguity errs toward grading the target, never toward
      // exempting it.
      return Math.max(0, blockText.length - targetChars);
    };

    // Detect a breadcrumb trail from its accessible name or conventional
    // component marker, then attach page-level facts to the first element in
    // that trail. WAI-ARIA APG requires a labelled navigation landmark and
    // aria-current="page" when the current item is a link.
    const measureBreadcrumb = (el: HTMLElement) => {
      const markerCandidates: HTMLElement[] = [];
      let ancestor: HTMLElement | null = el;
      while (ancestor && ancestor !== document.body) {
        const ariaLabel = ancestor.getAttribute('aria-label') || '';
        const marker = [
          ancestor.id,
          typeof ancestor.className === 'string' ? ancestor.className : '',
          ancestor.getAttribute('data-breadcrumb') || '',
          ancestor.getAttribute('data-component') || '',
          ancestor.getAttribute('data-testid') || '',
        ].join(' ');
        if (/\bbreadcrumbs?\b/i.test(ariaLabel) || /breadcrumb/i.test(marker)) {
          markerCandidates.push(ancestor);
        }
        ancestor = ancestor.parentElement;
      }
      if (markerCandidates.length === 0) return undefined;

      // Prefer the containing navigation landmark when one exists, even when
      // the marker is on an inner <ol> or list item. This lets the rule report
      // an unlabeled landmark rather than misclassifying the list as the root.
      const markerRoot = markerCandidates[markerCandidates.length - 1]!;
      const landmark = markerCandidates.find(candidate =>
        candidate.matches('nav,[role="navigation"]')
      ) ?? markerCandidates
        .map(candidate => candidate.closest<HTMLElement>('nav,[role="navigation"]'))
        .find((candidate): candidate is HTMLElement => !!candidate);
      const root = landmark ?? markerRoot;

      const labelledBy = (root.getAttribute('aria-labelledby') || '')
        .split(/\s+/)
        .filter(Boolean)
        .map(id => document.getElementById(id)?.textContent?.trim() || '')
        .filter(Boolean)
        .join(' ');
      const accessibleName = (root.getAttribute('aria-label') || labelledBy).trim() || null;

      const list = root.querySelector<HTMLElement>('ol, ul');
      const listItems = list
        ? Array.from(list.children).filter((item): item is HTMLElement => item instanceof HTMLElement && item.tagName.toLowerCase() === 'li')
        : [];
      const fallbackItems = Array.from(root.querySelectorAll<HTMLElement>('a[href], [aria-current]'));
      const items = listItems.length > 0 ? listItems : fallbackItems;
      const lastItem = items[items.length - 1];
      const currentElements = Array.from(root.querySelectorAll<HTMLElement>('[aria-current]'))
        .filter(item => {
          const value = (item.getAttribute('aria-current') || '').trim().toLowerCase();
          return value !== '' && value !== 'false';
        });
      const currentValues = currentElements.map(item =>
        (item.getAttribute('aria-current') || '').trim().toLowerCase()
      );
      const currentPageElements = currentElements.filter((_, index) => currentValues[index] === 'page');
      const representativeElements = Array.from(root.querySelectorAll<HTMLElement>('a[href], [aria-current]'));

      return {
        rootSelector: generateSelector(root),
        rootTag: root.tagName.toLowerCase(),
        rootRole: root.getAttribute('role'),
        accessibleName,
        listTag: list?.tagName.toLowerCase() ?? null,
        itemCount: items.length,
        linkCount: root.querySelectorAll('a[href]').length,
        currentValues,
        currentPageCount: currentPageElements.length,
        currentPageIsLast: !!lastItem && currentPageElements.some(current =>
          current === lastItem || lastItem.contains(current)
        ),
        lastItemIsLink: !!lastItem && (
          lastItem.matches('a[href]') || !!lastItem.querySelector('a[href]')
        ),
        representative: representativeElements[0] === el,
      };
    };


    // Walk the element's own background-color, then each ancestor's, stopping
    // at the first FULLY OPAQUE layer. This is what the contrast rule needs and
    // could never get: a text element on a real page almost always computes to
    // `rgba(0, 0, 0, 0)`, so its own backgroundColor measures nothing. Without
    // the chain the rule had no choice but to skip the element silently.
    //
    // Chrome always computes background-color to `rgb(...)` or `rgba(...)`, so
    // "opaque" is a cheap string test — no color parsing needed in-page.
    // Compositing and the white-canvas fallback happen in
    // src/rules/color-parse.ts (resolveEffectiveBackground), not here.
    const collectBackgroundChain = (
      start: HTMLElement,
    ): { chain: string[]; image: boolean; ancestorOpacity: number } => {
      const chain: string[] = [];
      let image = false;
      // Product of every ANCESTOR's opacity. `opacity` on a wrapper fades the
      // whole subtree, so text inside it renders lighter than its own computed
      // colour — and this was the last declared gap in the contrast lane: the
      // element's own opacity was folded in, an ancestor's was not, so a
      // 4.54:1 measurement was reported for text a reader sees at ~1.3:1.
      // The walk already visits every ancestor; it simply was not looking at
      // this property.
      let ancestorOpacity = 1;
      let bgResolved = false;
      let node: HTMLElement | null = start;
      let depth = 0;
      while (node && depth < 64) {
        const cs = window.getComputedStyle(node);
        // The element's OWN opacity is handled separately in
        // contrast-measure.ts; only ancestors accumulate here.
        //
        // Accumulated on EVERY ancestor, including those above the first opaque
        // background. The background walk stops at the first opaque layer
        // because nothing behind it is visible — but `opacity` does not work
        // that way: a faded wrapper fades its whole subtree no matter what
        // backgrounds sit inside it. Folding opacity into the background walk's
        // early exit is why the first version of this measured nothing on the
        // very fixture built for it: `<div style="opacity:.3"><p
        // style="background:#fff">` breaks the chain at depth 0, before the
        // wrapper is ever visited.
        if (node !== start) {
          const o = parseFloat(cs.opacity ?? '1');
          if (!isNaN(o) && o < 1) ancestorOpacity *= o;
        }
        const bg = bgResolved ? '' : (cs.backgroundColor || '');
        if (!bgResolved) chain.push(bg);
        const bgImage = cs.backgroundImage;
        if (!bgResolved && bgImage && bgImage !== 'none') image = true;
        // Opacity by ALPHA, not by function name. The previous test was
        // `/^rgb\(/` plus a trailing `, 1)`, on the premise that Chrome always
        // serializes background-color as rgb()/rgba(). That premise is false
        // for CSS Color 4 spaces: getComputedStyle returns `oklch(...)`,
        // `lab(...)`, `color(srgb ...)` verbatim, so an OPAQUE oklch card read
        // as transparent and the walk climbed past it to <html>. The composite
        // in resolveEffectiveBackground still stopped at the right layer, so
        // the ratio was unharmed — but every ancestor above the real background
        // kept contributing to `image`, which stamped a reliable measurement
        // with "a background-image paints behind this text". A caveat on a
        // sound number is still a wrong statement.
        const modernAlpha = bg.match(/\/\s*([0-9.]+%?)\s*\)$/);
        const legacyAlpha = bg.match(/^rgba\([^)]*,\s*([0-9.]+)\s*\)$/i);
        let alpha = 1;
        if (modernAlpha) {
          alpha = modernAlpha[1].endsWith('%')
            ? parseFloat(modernAlpha[1]) / 100
            : parseFloat(modernAlpha[1]);
        } else if (legacyAlpha) {
          alpha = parseFloat(legacyAlpha[1]);
        }
        const opaque = bg !== '' && bg !== 'transparent' && !isNaN(alpha) && alpha >= 1;
        // The BACKGROUND question is answered; the OPACITY question is not, so
        // the walk continues with background collection switched off.
        if (opaque) bgResolved = true;
        node = node.parentElement;
        depth++;
      }
      return { chain, image, ancestorOpacity };
    };

    // Process each selector
    for (const selector of selectors) {
      try {
        document.querySelectorAll(selector).forEach((el) => {
          if (seen.has(el)) return;
          seen.add(el);

          const htmlEl = el as HTMLElement;
          const rect = htmlEl.getBoundingClientRect();
          const computed = window.getComputedStyle(htmlEl);
          const handlers = detectHandlers(htmlEl);
          const nativeActivation = hasNativeActivation(htmlEl);

          // Check href for links
          const href = htmlEl.getAttribute('href');
          const hasValidHref = href !== null && href !== '#' && href !== '' &&
                               !href.startsWith('javascript:');

          elements.push({
            selector: generateSelector(htmlEl),
            tagName: htmlEl.tagName.toLowerCase(),
            id: htmlEl.id || undefined,
            className: typeof htmlEl.className === 'string' ? htmlEl.className : undefined,
            text: fullText ? ((htmlEl.textContent || '').trim() || undefined) : ((htmlEl.textContent || '').trim().slice(0, 100) || undefined),
            href,
            bounds: {
              x: fullText ? rect.x : Math.round(rect.x),
              y: fullText ? rect.y : Math.round(rect.y),
              width: fullText ? rect.width : Math.round(rect.width),
              height: fullText ? rect.height : Math.round(rect.height),
            },
            computedStyles: captureStyles(computed),
            ...(() => {
              const bgChain = collectBackgroundChain(htmlEl);
              return {
                backgroundChain: bgChain.chain,
                ...(bgChain.image ? { backgroundImageBehind: true } : {}),
                ...(bgChain.ancestorOpacity < 1 ? { ancestorOpacity: bgChain.ancestorOpacity } : {}),
              };
            })(),
            interactive: {
              hasOnClick: handlers.hasAnyHandler || nativeActivation,
              hasHref: hasValidHref,
              isDisabled: htmlEl.hasAttribute('disabled') ||
                          htmlEl.getAttribute('aria-disabled') === 'true' ||
                          computed.pointerEvents === 'none',
              tabIndex: parseInt(htmlEl.getAttribute('tabindex') || '0', 10),
              cursor: computed.cursor,
              hasReactHandler: handlers.hasReactHandler || undefined,
              hasVueHandler: handlers.hasVueHandler || undefined,
              hasAngularHandler: handlers.hasAngularHandler || undefined,
              // .isContentEditable resolves inherited contenteditable
              // correctly, unlike a raw getAttribute('contenteditable') check.
              isContentEditable: htmlEl.isContentEditable || undefined,
              hasNativeActivation: nativeActivation || undefined,
            },
            a11y: {
              role: htmlEl.getAttribute('role'),
              ariaLabel: htmlEl.getAttribute('aria-label'),
              ariaDescribedBy: htmlEl.getAttribute('aria-describedby'),
              ariaCurrent: htmlEl.getAttribute('aria-current'),
              // Own attribute OR any ancestor's — an element nested inside
              // an `aria-hidden="true"` container is just as unreachable to
              // assistive tech as one hidden directly, so rules that key off
              // this field (touch-targets, static/scan's aria-hidden check)
              // should treat both the same way. Mirrors the `inForm` closest()
              // pattern below.
              ariaHidden: !!htmlEl.closest?.('[aria-hidden="true"]') || undefined,
              ariaHaspopup: htmlEl.getAttribute('aria-haspopup'),
            },
            breadcrumb: measureBreadcrumb(htmlEl),
            // What the touch/pointer-target rules must measure instead of
            // this element's own layout box — see TargetContextSchema and
            // src/rules/target-sizing.ts.
            targetContext: (() => {
              const label = measureLabelTarget(htmlEl);
              return {
                surroundingTextChars: measureSurroundingText(htmlEl),
                labelTargetBounds: label.bounds,
                associatedLabels: label.count,
              };
            })(),
            sourceHint: {
              dataTestId: htmlEl.getAttribute('data-testid'),
            },
            inForm: htmlEl instanceof HTMLButtonElement
              ? htmlEl.form !== null
              : !!htmlEl.closest?.('form'),
            buttonType: htmlEl instanceof HTMLButtonElement
              ? (htmlEl.getAttribute('type') ?? 'submit')
              : null,
          });
        });
      } catch {
        // Skip invalid selectors
      }
    }

    return elements;
  }, { selectors: INTERACTIVE_SELECTORS, styleKeys: [...CAPTURED_STYLE_KEYS], fullText });

  // Enrichment is best-effort and additive only — on any failure (missing
  // capability, evaluate error, malformed result) `elements` is returned
  // exactly as the static in-page pass produced it. enrichWithEventListeners
  // already guards its only fallible step (the evaluateWithCommandLineAPI
  // call); a second outer try/catch here would be dead code. If a future
  // edit adds another fallible step inside that function, guard it there
  // rather than re-wrapping the call site.
  await enrichWithEventListeners(page, elements);

  return elements;
}

/**
 * Analyze elements and detect issues
 */
export function analyzeElements(elements: EnhancedElement[], isMobile = false): AuditResult {
  const issues: ElementIssue[] = [];
  let withHandlers = 0;
  let withoutHandlers = 0;

  const interactiveElements = elements.filter(el => {
    const isButton = el.tagName === 'button' || el.a11y.role === 'button';
    const isLink = el.tagName === 'a';
    const isInput = ['input', 'select', 'textarea'].includes(el.tagName);
    const looksClickable = el.interactive.cursor === 'pointer';
    // <summary> and contenteditable regions are natively interactive
    // (expand/collapse, accept typing) without a JS handler or role.
    const isNativelyEditableOrToggleable = el.tagName === 'summary' || !!el.interactive.isContentEditable;
    return isButton || isLink || isInput || looksClickable || isNativelyEditableOrToggleable;
  });

  for (const el of interactiveElements) {
    // A collapsed responsive/closed control has no hit area in the active
    // render. Keep it in the raw extraction for traceability, but do not grade
    // a 0×0 box as an operable touch target.
    if (el.bounds.width <= 0 || el.bounds.height <= 0) continue;

    const isButton = el.tagName === 'button' || el.a11y.role === 'button';
    const isLink = el.tagName === 'a';
    // Native interactivity (contenteditable / <summary>) needs no JS handler
    // to be legitimately wired — count it as handled rather than flagging
    // withoutHandlers for controls the browser drives natively.
    const hasHandler = el.interactive.hasOnClick || el.interactive.hasHref ||
      !!el.interactive.isContentEditable || el.tagName === 'summary';

    if (hasHandler) {
      withHandlers++;
    } else {
      withoutHandlers++;
    }

    // Check: Button without handler
    if (isButton && !el.interactive.hasOnClick && !el.interactive.isDisabled) {
      issues.push({
        type: 'NO_HANDLER',
        severity: 'error',
        message: ROOT_DELEGATION_UNRESOLVED.has(el)
          ? `Button "${el.text || el.selector}" has no click handler found; a document-level click listener exists whose source could not be inspected and may delegate to it`
          : `Button "${el.text || el.selector}" has no click handler`,
      });
    }

    // Check: Link with placeholder href
    if (isLink && !el.interactive.hasHref && !el.interactive.hasOnClick) {
      issues.push({
        type: 'PLACEHOLDER_LINK',
        severity: 'error',
        message: `Link "${el.text || el.selector}" has placeholder href and no handler`,
      });
    }

    // Check: Touch target too small (mobile)
    // Grades the real activation rect (an associated <label> when one
    // supplies the hit area) and skips targets WCAG 2.5.8 exempts as inline
    // text in a sentence — see src/rules/target-sizing.ts.
    const minSize = isMobile ? 44 : 24;
    const targetSize = evaluateTargetSize(el, minSize);
    if (targetSize.violates) {
      issues.push({
        type: 'TOUCH_TARGET_SMALL',
        severity: isMobile ? 'error' : 'warning',
        message: `"${el.text || el.selector}" touch target is ${targetSize.bounds.width}x${targetSize.bounds.height}px (min: ${minSize}px)`,
      });
    }

    // Check: Missing aria-label on interactive element without text
    if (hasHandler && !el.text && !el.a11y.ariaLabel) {
      issues.push({
        type: 'MISSING_ARIA_LABEL',
        severity: 'warning',
        message: `"${el.selector}" is interactive but has no text or aria-label`,
      });
    }
  }

  return {
    totalElements: elements.length,
    interactiveCount: interactiveElements.length,
    withHandlers,
    withoutHandlers,
    issues,
  };
}

/**
 * Content element selectors — headings, paragraphs, images, and their
 * surrounding text carriers. Deliberately a separate lane from
 * INTERACTIVE_SELECTORS: a heading is not a touch target, and folding it
 * into elements.all would corrupt the touch-target audit rules
 * (analyzeElements above / src/rules/target-sizing.ts) that consume that
 * array. Opt-in via ScanOptions.content — see scan.ts.
 */
/**
 * Which non-interactive elements count as page CONTENT.
 *
 * List items, table cells, and labels are ordinary body copy in essentially
 * every app UI, so a set limited to h1-h6/p/blockquote graded a plausible
 * non-zero number of elements while missing most of a real page's text. IBR is
 * an advisory instrument read by a human — a missed unreadable table cell costs
 * a user who cannot read it, a redundant finding costs a few seconds of triage.
 * Widen toward recall.
 *
 * `span`/`div` are deliberately absent: they wrap almost everything, so
 * including them would grade the same words many times over at many different
 * inherited colors. That is a real coverage gap for a light-gray <span> inside
 * a dark <p> — see `rulesApplied.gradedTags`, which reports the scope actually
 * graded rather than leaving the reader to assume it was everything.
 */
const CONTENT_SELECTORS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'img',
  'figcaption',
  'blockquote',
  'li',
  'td',
  'th',
  'dd',
  'dt',
  'label',
  'caption',
  'summary',
];

/**
 * Inline text carriers, graded ONLY when they paint their own color.
 *
 * These were excluded wholesale, and the exclusion was documented as a known
 * gap: "span/div are deliberately absent: they wrap almost everything, so
 * including them would grade the same words many times over at many different
 * inherited colors."
 *
 * The reasoning was right; the conclusion was too broad. A real page proved it:
 * `<a ...><span>Title</span><span class="text-zinc-400">↗</span></a>` renders
 * that arrow at rgb(161,161,170) on white — 2.56:1, a straight AA failure — and
 * the grader saw only the parent <a> at the parent's color and passed it. Six
 * such elements on one page, and `contrastCoverage` still reported 60 of 60
 * measured with nothing unmeasurable.
 *
 * The narrow rule keeps the anti-duplication property that motivated the
 * exclusion: an inline element is graded only when it carries its OWN direct
 * text AND its computed color DIFFERS from its parent's. A span that merely
 * inherits is already represented by its ancestor and is skipped, so no words
 * are graded twice at the same color. Only the case the gap described — a
 * differently-colored run of text inside a block — becomes visible.
 */
const INLINE_TEXT_SELECTORS = [
  'span', 'strong', 'b', 'em', 'i', 'small', 'code', 'abbr', 'time', 'mark',
  'sub', 'sup', 'cite', 'q', 'kbd', 'samp', 'var', 'ins', 'del', 's', 'u',
];

/** Exported so a scan can report the scope it actually graded, not just a count. */
export const CONTENT_ELEMENT_TAGS: readonly string[] = CONTENT_SELECTORS;

/** Exported alongside, so `gradedTags` can name the narrow inline rule too. */
export const INLINE_TEXT_TAGS: readonly string[] = INLINE_TEXT_SELECTORS;

/**
 * A content (non-interactive) element with real geometry and a subset of
 * computed styles — mirrors the identity/bounds/style shape of
 * EnhancedElement without forcing the `interactive`/`a11y` fields that only
 * make sense for controls.
 */
export interface ContentElement {
  selector: string;
  tagName: string;
  id?: string;
  className?: string;
  /** Trimmed textContent, capped like extractInteractiveElements' `text`. Absent for <img>. */
  text?: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  computedStyles: Record<string, string>;
  /**
   * This element's own background-color followed by each ancestor's, up to and
   * including the first fully-opaque one. Feeds
   * `resolveEffectiveBackground` (src/rules/color-parse.ts) so text on a
   * transparent background can actually be contrast-graded instead of skipped.
   */
  backgroundChain?: string[];
  /** Some layer in `backgroundChain` paints a background-image the color math cannot see. */
  backgroundImageBehind?: boolean;
  /** Real ARIA attributes read from the DOM — absent means absent, not unread. */
  role?: string | null;
  ariaLabel?: string | null;
  ariaDescribedBy?: string | null;
  ariaHidden?: boolean;
  /** Only set for h1-h6. */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  contentKind: 'heading' | 'paragraph' | 'image' | 'caption' | 'quote' | 'inline';
  /** Product of every ancestor's `opacity`. Absent when nothing above fades. */
  ancestorOpacity?: number;
  /** <img> only. */
  alt?: string;
  /** <img> only. */
  src?: string;
}

/** Named landmarks and regions available for design-spec container binding. */
export interface NamedRegion {
  name: string;
  bounds: { x: number; y: number; width: number; height: number };
  computedStyles: Record<string, string>;
  ariaHidden?: boolean;
  ancestorOpacity?: number;
}

export async function extractNamedRegions(page: PageLike): Promise<NamedRegion[]> {
  return page.evaluate((styleKeys: string[]) => {
    const result: NamedRegion[] = [];
    document.querySelectorAll<HTMLElement>('header, nav, main, aside, footer, section, [role="region"]').forEach(el => {
      const labelledBy = (el.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean)
        .map(id => document.getElementById(id)?.textContent?.trim() || '').filter(Boolean).join(' ');
      const name = (el.getAttribute('aria-label') || labelledBy).trim();
      if (!name) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const computed = getComputedStyle(el);
      let ancestorOpacity = 1;
      for (let ancestor = el.parentElement; ancestor; ancestor = ancestor.parentElement) {
        ancestorOpacity *= Number(getComputedStyle(ancestor).opacity || '1');
      }
      const styles: Record<string, string> = {};
      for (const key of styleKeys) {
        const value = (computed as unknown as Record<string, string>)[key];
        if (typeof value === 'string' && value !== '') styles[key] = value;
      }
      result.push({
        name,
        bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        computedStyles: styles,
        ariaHidden: !!el.closest('[aria-hidden="true"]') || undefined,
        ...(ancestorOpacity < 1 ? { ancestorOpacity } : {}),
      });
    });
    return result;
  }, [...CAPTURED_STYLE_KEYS]);
}

/**
 * Extract CONTENT elements (headings/paragraphs/images/captions/quotes)
 * with real bounds and computed styles — today's scan only sees interactive
 * elements, so a heading has text but no geometry. Mirrors
 * extractInteractiveElements' page.evaluate approach (bounds shape,
 * computedStyles subset, zero-area skip) but stays out of that function
 * entirely so the interactive lane feeding the touch-target rules is
 * untouched.
 */
export async function extractContentElements(page: PageLike, fullText = false): Promise<ContentElement[]> {
  return page.evaluate(({ selectors, inlineSelectors, styleKeys, fullText }: { selectors: string[]; inlineSelectors: string[]; styleKeys: string[]; fullText: boolean }) => {
    const seen = new Set<Element>();
    const results: ContentElement[] = [];

    // Same capture contract as the interactive lane. Both paths derive from
    // CAPTURED_STYLE_KEYS so a rule reading a property gets it on EITHER
    // surface, rather than working on buttons and silently no-opping on
    // paragraphs (or the reverse).
    const captureStyles = (computed: CSSStyleDeclaration): Record<string, string> => {
      const out: Record<string, string> = {};
      for (const key of styleKeys) {
        const value = (computed as unknown as Record<string, string>)[key];
        if (typeof value === 'string' && value !== '') out[key] = value;
      }
      return out;
    };

    // Local copy of extractInteractiveElements' generateSelector — each
    // page.evaluate() call ships its own closure across the CDP boundary,
    // so there is no runtime module to share it from.
    const generateSelector = (el: HTMLElement): string => {
      if (el.id) return `#${el.id}`;

      const path: string[] = [];
      let current: HTMLElement | null = el;

      while (current && current !== document.body) {
        let selector = current.tagName.toLowerCase();
        if (current.id) {
          selector = `#${current.id}`;
          path.unshift(selector);
          break;
        } else if (current.className && typeof current.className === 'string') {
          const classes = current.className.split(' ').filter(c => c.trim() && !c.includes(':'));
          if (classes.length > 0) {
            selector += `.${classes[0]}`;
          }
        }

        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(
            c => c.tagName === current!.tagName
          );
          if (siblings.length > 1) {
            const index = siblings.indexOf(current) + 1;
            selector += `:nth-of-type(${index})`;
          }
        }

        path.unshift(selector);
        current = current.parentElement;
      }

      return path.join(' > ').slice(0, 200);
    };

    // Same walk as the interactive path's collectBackgroundChain — each
    // page.evaluate() ships its own closure across CDP, so there is no runtime
    // module to share it from. Keep the two in sync.
    const collectBackgroundChain = (
      start: HTMLElement,
    ): { chain: string[]; image: boolean; ancestorOpacity: number } => {
      const chain: string[] = [];
      let image = false;
      // Product of every ANCESTOR's opacity. `opacity` on a wrapper fades the
      // whole subtree, so text inside it renders lighter than its own computed
      // colour — and this was the last declared gap in the contrast lane: the
      // element's own opacity was folded in, an ancestor's was not, so a
      // 4.54:1 measurement was reported for text a reader sees at ~1.3:1.
      // The walk already visits every ancestor; it simply was not looking at
      // this property.
      let ancestorOpacity = 1;
      let bgResolved = false;
      let node: HTMLElement | null = start;
      let depth = 0;
      while (node && depth < 64) {
        const cs = window.getComputedStyle(node);
        // The element's OWN opacity is handled separately in
        // contrast-measure.ts; only ancestors accumulate here.
        //
        // Accumulated on EVERY ancestor, including those above the first opaque
        // background. The background walk stops at the first opaque layer
        // because nothing behind it is visible — but `opacity` does not work
        // that way: a faded wrapper fades its whole subtree no matter what
        // backgrounds sit inside it. Folding opacity into the background walk's
        // early exit is why the first version of this measured nothing on the
        // very fixture built for it: `<div style="opacity:.3"><p
        // style="background:#fff">` breaks the chain at depth 0, before the
        // wrapper is ever visited.
        if (node !== start) {
          const o = parseFloat(cs.opacity ?? '1');
          if (!isNaN(o) && o < 1) ancestorOpacity *= o;
        }
        const bg = bgResolved ? '' : (cs.backgroundColor || '');
        if (!bgResolved) chain.push(bg);
        const bgImage = cs.backgroundImage;
        if (!bgResolved && bgImage && bgImage !== 'none') image = true;
        // Opacity by ALPHA, not by function name. The previous test was
        // `/^rgb\(/` plus a trailing `, 1)`, on the premise that Chrome always
        // serializes background-color as rgb()/rgba(). That premise is false
        // for CSS Color 4 spaces: getComputedStyle returns `oklch(...)`,
        // `lab(...)`, `color(srgb ...)` verbatim, so an OPAQUE oklch card read
        // as transparent and the walk climbed past it to <html>. The composite
        // in resolveEffectiveBackground still stopped at the right layer, so
        // the ratio was unharmed — but every ancestor above the real background
        // kept contributing to `image`, which stamped a reliable measurement
        // with "a background-image paints behind this text". A caveat on a
        // sound number is still a wrong statement.
        const modernAlpha = bg.match(/\/\s*([0-9.]+%?)\s*\)$/);
        const legacyAlpha = bg.match(/^rgba\([^)]*,\s*([0-9.]+)\s*\)$/i);
        let alpha = 1;
        if (modernAlpha) {
          alpha = modernAlpha[1].endsWith('%')
            ? parseFloat(modernAlpha[1]) / 100
            : parseFloat(modernAlpha[1]);
        } else if (legacyAlpha) {
          alpha = parseFloat(legacyAlpha[1]);
        }
        const opaque = bg !== '' && bg !== 'transparent' && !isNaN(alpha) && alpha >= 1;
        // The BACKGROUND question is answered; the OPACITY question is not, so
        // the walk continues with background collection switched off.
        if (opaque) bgResolved = true;
        node = node.parentElement;
        depth++;
      }
      return { chain, image, ancestorOpacity };
    };

    const kindFor = (tag: string): ContentElement['contentKind'] => {
      if (/^h[1-6]$/.test(tag)) return 'heading';
      if (tag === 'img') return 'image';
      if (tag === 'figcaption') return 'caption';
      if (tag === 'blockquote') return 'quote';
      return 'paragraph';
    };

    for (const selector of selectors) {
      try {
        document.querySelectorAll(selector).forEach((el) => {
          if (seen.has(el)) return;
          seen.add(el);

          const htmlEl = el as HTMLElement;
          const rect = htmlEl.getBoundingClientRect();
          // Collapsed/hidden content (display:none ancestor, closed
          // accordion) has no real geometry to report — same reasoning as
          // the interactive path's zero-area touch-target guard.
          if (rect.width <= 0 || rect.height <= 0) return;

          const computed = window.getComputedStyle(htmlEl);
          const tag = htmlEl.tagName.toLowerCase();
          const kind = kindFor(tag);

          const entry: ContentElement = {
            selector: generateSelector(htmlEl),
            tagName: tag,
            id: htmlEl.id || undefined,
            className: typeof htmlEl.className === 'string' ? htmlEl.className : undefined,
            text: fullText ? ((htmlEl.textContent || '').trim() || undefined) : ((htmlEl.textContent || '').trim().slice(0, 300) || undefined),
            bounds: {
              x: fullText ? rect.x : Math.round(rect.x),
              y: fullText ? rect.y : Math.round(rect.y),
              width: fullText ? rect.width : Math.round(rect.width),
              height: fullText ? rect.height : Math.round(rect.height),
            },
            computedStyles: captureStyles(computed),
            contentKind: kind,
            // Real attributes, not assumptions. The adapter used to synthesize
            // `role: null, ariaLabel: null` for every content element and call
            // that "the definition of a non-interactive element" — but
            // <h2 aria-label="..."> and <p role="note"> are ordinary, and a
            // future text-surface a11y rule would have silently concluded "no
            // accessible name" for an element that has one.
            role: htmlEl.getAttribute('role'),
            ariaLabel: htmlEl.getAttribute('aria-label'),
            ariaDescribedBy: htmlEl.getAttribute('aria-describedby'),
            ariaHidden: !!htmlEl.closest?.('[aria-hidden="true"]') || undefined,
          };

          const bgChain = collectBackgroundChain(htmlEl);
          entry.backgroundChain = bgChain.chain;
          if (bgChain.image) entry.backgroundImageBehind = true;
          if (bgChain.ancestorOpacity < 1) entry.ancestorOpacity = bgChain.ancestorOpacity;

          if (kind === 'heading') {
            entry.headingLevel = Number(tag[1]) as ContentElement['headingLevel'];
          }
          if (tag === 'img') {
            // <img> has no textContent of its own; alt/src are the signal.
            entry.text = undefined;
            entry.alt = htmlEl.getAttribute('alt') ?? undefined;
            entry.src = htmlEl.getAttribute('src') ?? undefined;
          }

          results.push(entry);
        });
      } catch {
        // Skip invalid selectors — matches extractInteractiveElements.
      }
    }

    // ---- inline pass: own text, own colour ----
    //
    // Runs after the block pass so `seen` already holds every block element and
    // an inline node cannot displace one.
    const ownText = (el: HTMLElement): string => {
      let out = '';
      el.childNodes.forEach((n) => {
        if (n.nodeType === 3) out += n.nodeValue ?? '';
      });
      return out.trim();
    };

    for (const selector of inlineSelectors) {
      try {
        document.querySelectorAll(selector).forEach((el) => {
          if (seen.has(el)) return;
          const htmlEl = el as HTMLElement;

          // Must carry its OWN text. A wrapper whose text all lives in
          // descendants is not a distinct run of colour.
          const text = ownText(htmlEl);
          if (text.length === 0) return;

          const parent = htmlEl.parentElement;
          if (!parent) return;

          const computed = window.getComputedStyle(htmlEl);
          const parentComputed = window.getComputedStyle(parent);
          // Same colour as the parent means the ancestor already represents
          // these words at this colour. Grading it again would be the
          // duplicate-reporting the wholesale exclusion was protecting against.
          if (computed.color === parentComputed.color) return;

          const rect = htmlEl.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return;

          seen.add(el);

          const entry: ContentElement = {
            selector: generateSelector(htmlEl),
            tagName: htmlEl.tagName.toLowerCase(),
            id: htmlEl.id || undefined,
            className: typeof htmlEl.className === 'string' ? htmlEl.className : undefined,
            text: fullText ? text : text.slice(0, 300),
            bounds: {
              x: fullText ? rect.x : Math.round(rect.x),
              y: fullText ? rect.y : Math.round(rect.y),
              width: fullText ? rect.width : Math.round(rect.width),
              height: fullText ? rect.height : Math.round(rect.height),
            },
            computedStyles: captureStyles(computed),
            contentKind: 'inline',
            role: htmlEl.getAttribute('role'),
            ariaLabel: htmlEl.getAttribute('aria-label'),
            ariaDescribedBy: htmlEl.getAttribute('aria-describedby'),
            ariaHidden: !!htmlEl.closest?.('[aria-hidden="true"]') || undefined,
          };

          const bgChain = collectBackgroundChain(htmlEl);
          entry.backgroundChain = bgChain.chain;
          if (bgChain.image) entry.backgroundImageBehind = true;
          if (bgChain.ancestorOpacity < 1) entry.ancestorOpacity = bgChain.ancestorOpacity;

          results.push(entry);
        });
      } catch {
        // Skip invalid selectors — matches the block pass.
      }
    }

    return results;
  }, {
    selectors: CONTENT_SELECTORS,
    inlineSelectors: INLINE_TEXT_SELECTORS,
    styleKeys: [...CAPTURED_STYLE_KEYS],
    fullText,
  });
}

/**
 * <head> metadata for SEO/social-share checks — today's scan captures none
 * of this. Every field is optional/empty-safe: a page with no metadata
 * returns empty containers, not a thrown error or an undefined explosion.
 */
export interface PageMetadata {
  title?: string;
  description?: string;
  canonical?: string;
  og: Record<string, string>;
  twitter: Record<string, string>;
  /** Parsed JSON-LD blocks. A block that fails JSON.parse is kept as its raw string rather than dropped. */
  jsonLd: unknown[];
}

/**
 * Extract page-level SEO/social metadata: <title>, meta description,
 * canonical link, all og: and twitter: meta tags, and JSON-LD script blocks.
 */
export async function extractPageMetadata(page: PageLike): Promise<PageMetadata> {
  return page.evaluate(() => {
    const og: Record<string, string> = {};
    document.querySelectorAll('meta[property^="og:"]').forEach((meta) => {
      const property = meta.getAttribute('property');
      const content = meta.getAttribute('content');
      // Strip the namespace: the object is already called `og`, so keying it
      // `og['og:title']` makes every consumer repeat the prefix. `og.title`.
      if (property && content !== null) og[property.slice(3)] = content;
    });

    const twitter: Record<string, string> = {};
    document.querySelectorAll('meta[name^="twitter:"]').forEach((meta) => {
      const name = meta.getAttribute('name');
      const content = meta.getAttribute('content');
      // Same reasoning as `og` above — `twitter.card`, not `twitter['twitter:card']`.
      if (name && content !== null) twitter[name.slice(8)] = content;
    });

    const jsonLd: unknown[] = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
      const raw = script.textContent || '';
      try {
        jsonLd.push(JSON.parse(raw));
      } catch {
        // A malformed JSON-LD block is itself a finding — keep the raw
        // string rather than silently dropping it.
        jsonLd.push(raw);
      }
    });

    const descriptionMeta = document.querySelector('meta[name="description"]');
    const canonicalLink = document.querySelector('link[rel="canonical"]');

    return {
      title: document.title || undefined,
      description: descriptionMeta?.getAttribute('content') ?? undefined,
      canonical: canonicalLink?.getAttribute('href') ?? undefined,
      og,
      twitter,
      jsonLd,
    };
  });
}

/**
 * Extract CSS custom properties (variables)
 */
async function extractCSSVariables(page: PageLike): Promise<CSSVariables> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const variables: CSSVariables = {};

    // Get all CSS rules from stylesheets
    const sheets = Array.from(document.styleSheets);
    sheets.forEach((sheet) => {
      try {
        const rules = Array.from(sheet.cssRules || []);
        rules.forEach((rule) => {
          if (rule instanceof CSSStyleRule && rule.selectorText === ':root') {
            const style = rule.style;
            for (let i = 0; i < style.length; i++) {
              const prop = style[i];
              if (prop.startsWith('--')) {
                variables[prop] = style.getPropertyValue(prop).trim();
              }
            }
          }
        });
      } catch {
        // Cross-origin stylesheets will throw
      }
    });

    // Also get computed custom properties from :root
    const rootStyles = getComputedStyle(root);
    // Check common variable prefixes
    ['--primary', '--secondary', '--accent', '--background', '--foreground', '--border', '--radius', '--spacing']
      .forEach(prefix => {
        for (let i = 0; i < 20; i++) {
          const variations = [
            prefix,
            `${prefix}-${i}`,
            `${prefix}-color`,
            `${prefix}-bg`,
          ];
          variations.forEach(varName => {
            const value = rootStyles.getPropertyValue(varName).trim();
            if (value && !variables[varName]) {
              variables[varName] = value;
            }
          });
        }
      });

    return variables;
  });
}

/**
 * Extract HTML, CSS, and screenshot from a live URL
 */
export async function extractFromURL(
  options: ExtractOptions
): Promise<ExtractionResult> {
  const {
    url,
    outputDir,
    sessionId,
    viewport = VIEWPORTS.desktop,
    timeout = EXTRACTION_TIMEOUT_MS,
    selectors = DEFAULT_SELECTORS,
  } = options;

  // Check for concurrent extraction
  if (await checkLock(outputDir)) {
    throw new Error('Another extraction is in progress. Please wait.');
  }

  // Create session directory
  const sessionDir = join(outputDir, 'sessions', sessionId);
  await mkdir(sessionDir, { recursive: true });

  // Create lock
  await createLock(outputDir);

  let timeoutHandle: NodeJS.Timeout | null = null;

  try {
    // Set up hard timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`Extraction timed out after ${timeout}ms`));
      }, timeout);
    });

    const extractionPromise = async () => {
      const driverInstance = new EngineDriver();
      await driverInstance.launch({
        headless: true,
        viewport: viewportToConfig(viewport),
      });
      const page = new CompatPage(driverInstance);

      try {
        // Navigate to URL
        await page.goto(url, {
          waitUntil: 'networkidle',
          timeout: timeout,
        });

        // Wait for animations to settle
        await page.waitForTimeout(500);

        // Disable animations for screenshot
        await page.addStyleTag({
          content: `
            *, *::before, *::after {
              animation-duration: 0s !important;
              animation-delay: 0s !important;
              transition-duration: 0s !important;
              transition-delay: 0s !important;
            }
          `,
        });

        // Extract HTML
        const html = await page.content();

        // Extract elements
        const elements: ExtractedElement[] = [];
        for (const selector of selectors) {
          const extracted = await extractElementStyles(page, selector);
          elements.push(...extracted);
        }

        // Extract CSS variables
        const cssVariables = await extractCSSVariables(page);

        // Take screenshot
        const screenshotPath = join(sessionDir, 'reference.png');
        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
          type: 'png',
        });

        const result: ExtractionResult = {
          url,
          timestamp: new Date().toISOString(),
          viewport,
          html,
          elements,
          cssVariables,
          screenshotPath,
        };

        // Save extraction data
        await writeFile(
          join(sessionDir, 'reference.json'),
          JSON.stringify(result, null, 2)
        );

        // Save HTML separately for easier access
        await writeFile(join(sessionDir, 'reference.html'), html);

        return result;
      } finally {
        await driverInstance.close();
      }
    };

    // Race between extraction and timeout
    const result = await Promise.race([extractionPromise(), timeoutPromise]);
    return result;
  } finally {
    // Clear timeout
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    // Release lock
    await releaseLock(outputDir);
  }
}

/**
 * Get paths for a reference session
 */
export function getReferenceSessionPaths(outputDir: string, sessionId: string) {
  const root = join(outputDir, 'sessions', sessionId);
  return {
    root,
    sessionJson: join(root, 'session.json'),
    reference: join(root, 'reference.png'),
    referenceHtml: join(root, 'reference.html'),
    referenceData: join(root, 'reference.json'),
    current: join(root, 'current.png'),
    diff: join(root, 'diff.png'),
  };
}

/**
 * An INDEPENDENT census of text on the page.
 *
 * WHY IT IS SEPARATE FROM THE GRADING LANE. `contrastCoverage` reported
 * `candidates: 60, measured: 60, unmeasurable: 0` on a real page carrying six
 * visible AA contrast failures — because `candidates` was
 * `gradedElements.length`. The lane counted the population it had already
 * chosen, so text it declined to consider never appeared as a candidate, a
 * skip, or a zero. "60 of 60 measured" read as complete coverage of the page
 * when it was complete coverage of a subset the reader could not see.
 *
 * That is the same defect the whole sweep is about, one level up: zero findings
 * used to look clean, and now full coverage looks complete. A coverage number
 * sourced from the thing it is measuring cannot show its own blind spot.
 *
 * This walks the DOM instead and counts text WHERE IT IS, so the difference
 * between what exists and what was graded becomes a number rather than an
 * assumption.
 */
export interface TextCensus {
  /** Every element carrying its own direct, non-whitespace text. */
  domTextElements: number;
  /** Not rendered in the page's REST state: [hidden], display:none, a closed <details>. */
  hiddenAtRest: number;
  /** Rendered but with a collapsed box. */
  zeroArea: number;
  /**
   * Inline element with its own text painted in the SAME colour as its parent.
   * Its ancestor already represents these words at this colour, so skipping it
   * is deliberate rather than a gap.
   */
  inlineSameColor: number;
  /** A few excluded elements, named, so a reader can spot-check the exclusion. */
  samples: Array<{ selector: string; reason: string; color: string; text: string }>;
}

/**
 * Count text-bearing elements in the DOM, and why each would not be graded.
 */
export async function extractTextCensus(page: PageLike): Promise<TextCensus> {
  return page.evaluate(() => {
    const census = {
      domTextElements: 0,
      hiddenAtRest: 0,
      zeroArea: 0,
      inlineSameColor: 0,
      samples: [] as Array<{ selector: string; reason: string; color: string; text: string }>,
    };

    const INLINE = new Set([
      'span', 'strong', 'b', 'em', 'i', 'small', 'code', 'abbr', 'time', 'mark',
      'sub', 'sup', 'cite', 'q', 'kbd', 'samp', 'var', 'ins', 'del', 's', 'u', 'a', 'label',
    ]);

    const shortSelector = (el: Element): string => {
      const parts: string[] = [];
      let cur: Element | null = el;
      let depth = 0;
      while (cur && cur !== document.body && depth < 4) {
        let s = cur.tagName.toLowerCase();
        if (cur.id) { parts.unshift(`#${cur.id}`); break; }
        const cls = typeof cur.className === 'string'
          ? cur.className.split(' ').filter((c) => c.trim() && !c.includes(':'))[0]
          : undefined;
        if (cls) s += `.${cls}`;
        parts.unshift(s);
        cur = cur.parentElement;
        depth++;
      }
      return parts.join(' > ').slice(0, 140);
    };

    const note = (el: Element, reason: string, color: string, text: string) => {
      if (census.samples.length < 20) {
        census.samples.push({ selector: shortSelector(el), reason, color, text: text.slice(0, 40) });
      }
    };

    document.querySelectorAll('*').forEach((el) => {
      const htmlEl = el as HTMLElement;
      const tag = htmlEl.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'template') return;
      // <head> content is metadata, not text a reader sees. Counting <title>
      // as "hidden at rest" would pad the denominator with something no
      // contrast rule should ever grade.
      if (htmlEl.closest('head')) return;

      let own = '';
      htmlEl.childNodes.forEach((n) => {
        if (n.nodeType === 3) own += n.nodeValue ?? '';
      });
      own = own.trim();
      if (own.length === 0) return;

      census.domTextElements++;

      const computed = window.getComputedStyle(htmlEl);
      const color = computed.color || '';

      // Rest-state visibility. A tab panel, a closed disclosure, or a
      // `hidden` attribute all mean the text is real and a reader can reach
      // it — a scan of the rest state simply never sees it.
      const inClosedDetails = !!htmlEl.closest('details:not([open])') && !htmlEl.closest('summary');
      if (
        computed.display === 'none' ||
        computed.visibility === 'hidden' ||
        htmlEl.closest('[hidden]') !== null ||
        inClosedDetails
      ) {
        census.hiddenAtRest++;
        note(htmlEl, 'hidden-at-rest', color, own);
        return;
      }

      const rect = htmlEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        census.zeroArea++;
        note(htmlEl, 'zero-area', color, own);
        return;
      }

      const parent = htmlEl.parentElement;
      if (INLINE.has(tag) && parent && window.getComputedStyle(parent).color === color) {
        census.inlineSameColor++;
        return;
      }
    });

    return census;
  });
}
