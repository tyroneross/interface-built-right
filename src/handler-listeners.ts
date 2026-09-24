import type { PageLike } from './engine/page-like.js';

/**
 * Result of probing one candidate element for real DOM event-listener wiring.
 * `null` at a given array index means the element could not be resolved (the
 * targets expression produced null/undefined at that position) — callers
 * must treat that the same as "no signal", never as "confirmed dead".
 */
export interface ListenerProbe {
  hasEventListener: boolean;
  hasDelegatedListener: boolean;
}

/**
 * Activation event types checked by `probeActivationListeners` below. Chosen
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
 * Why this exists: static in-page detection (reading `onclick`
 * properties/attributes, framework fiber/props, `[role]`/data attributes) can
 * see React/Vue/Angular props and the `onclick` property/attribute, but page
 * JS has no public API to enumerate addEventListener-registered listeners on
 * itself. A real scan reported 28 fake-interactive errors (e.g.
 * `#rail-designer`, `#start-btn`) for buttons wired entirely with
 * `addEventListener` — working buttons that static detection structurally
 * cannot see. This closes that gap for whichever PageLike actually supports
 * it (CompatPage today; Playwright/other PageLikes skip it and behavior is
 * unchanged, since every caller feature-detects before invoking this).
 *
 * Originally lived inside `src/extract.ts`'s `enrichWithEventListeners` only;
 * moved here so `src/interactivity.ts` can run the exact same check instead
 * of assuming every `<button>`/submit `<input>`/`<a href>` is wired — one
 * probe, one verdict, consumed by both lanes instead of two
 * independently-drifting ones.
 *
 * `targetsExpression` is JS SOURCE TEXT (not a function reference — this
 * whole thing runs as one `Runtime.evaluate` string, so a caller's helper
 * functions or module-scope variables are never in scope here) that must
 * evaluate, inside the page, to an array of `Element | null | undefined`.
 * The returned array is aligned 1:1 with that array's order: index `i` of
 * the result corresponds to index `i` of the targets, `null` where the
 * target itself was nullish. Callers build their own targetsExpression from
 * whatever selector/list shape they already have (e.g.
 * `document.querySelectorAll(...)`, or a `.map()` over an existing node
 * list) and re-associate results by index — this function has no opinion on
 * candidate selection, de-duplication, or which elements are worth probing.
 *
 * Root-level listeners (document.body, document.documentElement, document,
 * window) are deliberately EXCLUDED from the delegation walk: a
 * document-level click listener (menu dismissal, outside-click handling,
 * analytics) would otherwise "rescue" every dead control on the page,
 * silencing the exact defect class this probe exists to catch.
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
 * The ancestor walk always runs for every candidate, gated only by the
 * framework-ROOT stop — it is NOT skipped for candidates that themselves
 * carry a framework marker, since that also discards real, author-written
 * native delegation attached to a plain (non-root) ancestor via a ref, a
 * legitimate pattern this probe should still credit.
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
 *
 * Returns `null` when the PageLike doesn't expose
 * `evaluateWithCommandLineAPI`, the evaluate throws, or the result isn't an
 * array — callers must leave their elements exactly as static detection left
 * them in that case, never regress the static pass this probe layers on top
 * of.
 */
export async function probeActivationListeners(
  page: PageLike,
  targetsExpression: string,
): Promise<(ListenerProbe | null)[] | null> {
  // Explicit typeof guard rather than `?.bind(page)` -- a test double or a
  // future PageLike implementation could carry the KEY with a truthy
  // non-function value (a stub, a leftover property from a spread), which
  // `?.` alone would happily bind and then throw on invocation. Feature
  // detection for an optional capability must confirm it's actually
  // callable, not just present.
  if (typeof page.evaluateWithCommandLineAPI !== 'function') return null;
  const evaluateWithCommandLineAPI = page.evaluateWithCommandLineAPI.bind(page);

  const expression = `
    (function () {
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
      // props object, or undefined if the node carries no such key -- used to
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
      // _reactRootContainer is the same for older React; __vue_app__ is
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

      const targets = ${targetsExpression};
      if (!Array.isArray(targets)) return null;

      return targets.map((el) => {
        if (!el) return null;

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
          // A submit button's form owner is NOT always its closest ancestor
          // -- the form="id" attribute associates it with a form anywhere
          // in the document, outside the button's own subtree entirely (a
          // real, spec-defined pattern for a button rendered outside its
          // form, e.g. in a modal footer). el.form resolves that
          // association per the HTML spec for BOTH the nested and the
          // form="id" case; a real scan hit exactly the form="id" case and
          // reported a working, form-associated submit button as
          // fake-interactive because closest('form') alone found nothing.
          // closest('form') is kept only as a defensive fallback for a node
          // without a .form IDL property.
          const form = el.form || (el.closest ? el.closest('form') : null);
          if (form && (hasSubmitListener(form) || hasReactPropsOnSubmit(form))) hasDelegatedListener = true;
        }

        return { hasEventListener, hasDelegatedListener };
      });
    })()
  `;

  let raw: unknown;
  try {
    raw = await evaluateWithCommandLineAPI(expression);
  } catch {
    // getEventListeners / includeCommandLineAPI unavailable or failed for
    // any other reason -- leave elements exactly as static detection left
    // them, never regress the static pass this probe layers on top of.
    return null;
  }

  if (!Array.isArray(raw)) return null;
  return raw as (ListenerProbe | null)[];
}
