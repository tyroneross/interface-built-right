import type { Rule } from '../../rules/types.js';
import type { EnhancedElement, Violation } from '../../schemas.js';

/*
 * THIS RULE MEASURED CHROME OVER A POPULATION THAT CONTAINED NO CHROME.
 *
 * It sums the area of nav/header/footer/sidebar elements found in
 * `context.allElements`. That array was `elements.all` — built from
 * INTERACTIVE_SELECTORS, which matches buttons, links, and inputs and matches
 * no landmark at all. `chromeArea` was therefore ~0 on every page,
 * `chromePercent` was ~0, and the `> 30` guard never fired.
 *
 * Proven by planted defect: an 800x360 `<nav>` in an 800x600 viewport — 60% of
 * the viewport, twice the threshold — produced no finding through the
 * installed binary.
 *
 * `src/scan.ts` now includes the sensor extractor's structural elements in
 * `allElements`, so the landmarks are present. Two further corrections were
 * needed for the number to mean anything:
 *
 *   1. NESTED CHROME WAS DOUBLE-COUNTED. A `<nav>` inside a `<header>` added
 *      both rectangles, so `chromePercent` could exceed 100 — a percentage
 *      that cannot be a percentage. Area is now computed over a union of the
 *      viewport cells the chrome rects cover, so overlap counts once.
 *   2. NO CHROME FOUND IS NOT THE SAME AS NO CHROME PRESENT. When the
 *      population holds no landmark element whatsoever, the rule now reports
 *      that it could not measure instead of reporting a comfortable 0%.
 */

/*
 * WHAT IS CHROME — DECIDED ON THE ELEMENT, NOT ON ITS SELECTOR PATH.
 *
 * `isChrome` used to regex-match /nav|header|footer|.../ against the element's
 * FULL selector path. Three false positives followed:
 *   - A `<header>` inside `<main>` (a page's hero: eyebrow, h1, summary) was
 *     chrome, and so was every `<p>` and `<span>` inside it, because their
 *     paths contain "header". HTML-AAM maps `<header>`/`<footer>` to the
 *     banner/contentinfo landmarks ONLY when they are not scoped to
 *     main/article/aside/nav/section; scoped, they are content headers.
 *   - `.card-header` matched, since `\b` treats the hyphen as a boundary.
 *   - The finding said "6 chrome element(s) measured" and named none, so a
 *     reader could not check a single one of them.
 *
 * Now an element is chrome when ITSELF is: tag `<nav>`; an unscoped
 * `<header>`/`<footer>`; role navigation/banner/contentinfo/toolbar/menu/
 * menubar; or one of its own class tokens is a chrome name (`sidebar`,
 * `navbar`, `site-header`...). One ancestor inheritance remains: a descendant
 * of a chrome-CLASSED wrapper (e.g. `div.sidebar > a`) counts, because the
 * structural extractor does not collect generic `<div>`s, so the wrapper
 * itself is never in the population and its area would otherwise vanish.
 *
 * ANSWER CONTROLS ARE CONTENT. The choice buttons of a form-like group —
 * inside a `<form>`/`<fieldset>`, or carrying role radio/option/checkbox/
 * menuitemradio — are what the page asks the reader to do. They are never
 * counted as chrome even under a chrome-classed wrapper. The role-only
 * `[role=radiogroup|group|listbox]` ancestors and "two or more sibling
 * option-like buttons" are not detectable from the selector path, which
 * carries tags/classes but not ancestor roles; with element-level
 * classification those buttons are no longer chrome unless they carry a
 * chrome class themselves, so the gap is narrow.
 */

const CHROME_TAGS: ReadonlySet<string> = new Set(['nav']);
/** Landmark only when NOT scoped inside sectioning content (HTML-AAM). */
const SCOPED_CHROME_TAGS: ReadonlySet<string> = new Set(['header', 'footer']);
const SECTIONING_SCOPES: ReadonlySet<string> = new Set(['main', 'article', 'aside', 'nav', 'section']);
const CHROME_ROLES: ReadonlySet<string> = new Set([
  'navigation', 'banner', 'contentinfo', 'toolbar', 'menu', 'menubar',
]);
const CHROME_CLASS_TOKEN = /^((site|app|page|global|main|top|primary)-)?(nav|navbar|navigation|header|footer|sidebar|toolbar|menu|menubar|breadcrumb|breadcrumbs|tabs|topbar|appbar)$/i;
const SCOPED_CLASS_TOKEN = /^((site|app|page|global|main|top|primary)-)?(header|footer)$/i;
const ANSWER_ROLES: ReadonlySet<string> = new Set([
  'radio', 'option', 'checkbox', 'menuitemradio', 'menuitemcheckbox', 'switch',
]);
const FORM_SCOPES: ReadonlySet<string> = new Set(['form', 'fieldset']);

/**
 * Tags that only ever appear in the INTERACTIVE extraction lane. If every
 * element the rule was handed is one of these, it was shown the control list
 * rather than the page, and any chrome measurement over it is meaningless.
 */
const CONTROL_TAGS: ReadonlySet<string> = new Set([
  'button', 'a', 'input', 'select', 'textarea', 'summary', 'details',
]);

interface PathSegment { tag: string; cls: string | null; isId: boolean }

/** Parse `main > section:nth-of-type(2) > div.card > a` into segments. */
function parsePath(selector: string): PathSegment[] {
  return selector.split('>').map((raw) => {
    const seg = raw.trim();
    if (seg.startsWith('#')) return { tag: '', cls: null, isId: true };
    const tag = (seg.match(/^[a-z][a-z0-9-]*/i)?.[0] ?? '').toLowerCase();
    const cls = seg.match(/\.([^.:#\s[]+)/)?.[1] ?? null;
    return { tag, cls, isId: false };
  });
}

function classTokens(el: EnhancedElement): string[] {
  return (el.className || '').split(/\s+/).filter(Boolean);
}

function isAnswerControl(el: EnhancedElement, ancestors: PathSegment[]): boolean {
  const tag = (el.tagName || '').toLowerCase();
  const role = (el.a11y?.role || '').toLowerCase();
  if (ANSWER_ROLES.has(role)) return true;
  const isControl = CONTROL_TAGS.has(tag) || role === 'button';
  return isControl && ancestors.some((a) => FORM_SCOPES.has(a.tag));
}

/**
 * Is `el` scoped inside sectioning content?
 *
 * The selector path answers directly when it is complete. It is NOT complete
 * when it starts at an `#id` — the path builder stops at the first ancestor
 * (or the element itself) with an id, so `<main><header id="top">` arrives as
 * plain `#top`. Only then does this fall back to geometry: the element's box
 * lying inside the box of a main/article/section/aside/nav in the population.
 */
function isScoped(el: EnhancedElement, ancestors: PathSegment[], rootedAtId: boolean, population: EnhancedElement[]): boolean {
  if (ancestors.some((a) => SECTIONING_SCOPES.has(a.tag))) return true;
  if (!rootedAtId || !el.bounds) return false;
  const b = el.bounds;
  return population.some((p) => {
    if (p === el || p.selector === el.selector) return false;
    if (!SECTIONING_SCOPES.has((p.tagName || '').toLowerCase()) || !p.bounds) return false;
    const q = p.bounds;
    if (q.width <= 0 || q.height <= 0) return false;
    return b.x >= q.x && b.y >= q.y && b.x + b.width <= q.x + q.width && b.y + b.height <= q.y + q.height;
  });
}

export function isChrome(el: EnhancedElement, population: EnhancedElement[] = []): boolean {
  const tag = (el.tagName || '').toLowerCase();
  const role = (el.a11y?.role || '').toLowerCase();
  const path = parsePath(el.selector || '');
  const ancestors = path.slice(0, -1);
  const rootedAtId = path[0]?.isId ?? false;
  const scoped = isScoped(el, ancestors, rootedAtId, population);

  if (isAnswerControl(el, ancestors)) return false;

  if (CHROME_ROLES.has(role)) return true;
  if (CHROME_TAGS.has(tag)) return true;
  if (SCOPED_CHROME_TAGS.has(tag) && !scoped) return true;

  for (const t of classTokens(el)) {
    if (!CHROME_CLASS_TOKEN.test(t)) continue;
    if (SCOPED_CLASS_TOKEN.test(t) && scoped) continue;
    return true;
  }

  // Descendant of a chrome-CLASSED wrapper the extractor never collects.
  return ancestors.some((a, i) => {
    if (!a.cls || !CHROME_CLASS_TOKEN.test(a.cls)) return false;
    if (!SCOPED_CLASS_TOKEN.test(a.cls)) return true;
    return !ancestors.slice(0, i).some((b) => SECTIONING_SCOPES.has(b.tag));
  });
}

/** One element counted as chrome, as reported in the finding. */
export interface ChromeElementReport {
  selector: string;
  tagName: string;
  bounds: { x: number; y: number; width: number; height: number };
}

export const MAX_NAMED_CHROME = 10;

/**
 * The chrome elements worth naming: outermost first, largest first. A `<nav>`
 * inside a `<header>` adds no area the header did not already cover, so
 * naming it would only lengthen the list.
 */
export function outermostChrome(chrome: EnhancedElement[]): EnhancedElement[] {
  const sorted = [...chrome].sort((a, b) =>
    b.bounds.width * b.bounds.height - a.bounds.width * a.bounds.height);
  const kept: EnhancedElement[] = [];
  for (const el of sorted) {
    const b = el.bounds;
    const inside = kept.some((k) =>
      b.x >= k.bounds.x && b.y >= k.bounds.y &&
      b.x + b.width <= k.bounds.x + k.bounds.width &&
      b.y + b.height <= k.bounds.y + k.bounds.height);
    if (!inside) kept.push(el);
  }
  return kept;
}

function fmtBox(b: ChromeElementReport['bounds']): string {
  return `(${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)})`;
}

/**
 * Union area of a set of rectangles, clipped to the viewport, computed on a
 * coarse grid.
 *
 * Summing `width * height` per rect is what let nested chrome exceed 100%. A
 * grid keeps the union cheap and exact enough for a 30% threshold: an 8px cell
 * over a 1920x1080 viewport is 240x135 = 32,400 cells, and the answer is only
 * ever compared against a percentage band.
 */
function unionAreaPx(
  rects: Array<{ x: number; y: number; width: number; height: number }>,
  viewportWidth: number,
  viewportHeight: number,
): number {
  const CELL = 8;
  const cols = Math.ceil(viewportWidth / CELL);
  const rows = Math.ceil(viewportHeight / CELL);
  const covered = new Uint8Array(cols * rows);

  for (const r of rects) {
    if (r.width <= 0 || r.height <= 0) continue;
    const x0 = Math.max(0, Math.floor(r.x / CELL));
    const y0 = Math.max(0, Math.floor(r.y / CELL));
    const x1 = Math.min(cols, Math.ceil((r.x + r.width) / CELL));
    const y1 = Math.min(rows, Math.ceil((r.y + r.height) / CELL));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) covered[y * cols + x] = 1;
    }
  }

  let cells = 0;
  for (let i = 0; i < covered.length; i++) cells += covered[i]!;
  return cells * CELL * CELL;
}

export const contentChromeRules: Rule[] = [
  {
    id: 'calm-precision/content-chrome-ratio',
    name: 'Content >= Chrome',
    description: 'Content area should be at least 70% of the viewport',
    defaultSeverity: 'warn',
    appliesTo: 'any',
    check: (element: EnhancedElement, context): Violation | null => {
      // Page-level check — evaluate once per scan, on the first element of the
      // population the rule reasons over.
      if (context.allElements[0]?.selector !== element.selector) return null;

      const viewportArea = context.viewportWidth * context.viewportHeight;
      if (viewportArea === 0) return null;

      const chromeElements = context.allElements.filter((el) => el.bounds && isChrome(el, context.allElements));

      // "No chrome found" means two different things, and only one is a defect.
      //
      // If the population contains non-control elements, we looked at the page
      // structure and it genuinely has no landmark — a legitimate
      // not-applicable, and the rule stays quiet.
      //
      // If it contains ONLY controls, the structural elements never arrived and
      // we could not look. That was the permanent state before this sweep, and
      // it was reported as a comfortable 0% chrome page.
      const sawNonControlElements = context.allElements.some(
        (el) => !CONTROL_TAGS.has(el.tagName),
      );

      if (chromeElements.length === 0 && !sawNonControlElements) {
        return {
          ruleId: 'calm-precision/content-chrome-ratio-unmeasurable',
          ruleName: 'Content >= Chrome (not measurable)',
          severity: 'warn',
          message: 'Chrome-to-content ratio was NOT checked: no nav, header, footer, sidebar, or toolbar element was found in the scanned population.',
          fix: 'If the page has landmarks, they were not extracted — re-run the scan. If it genuinely has none, this check does not apply.',
        };
      }

      // Structure was visible and holds no landmark: genuinely 0% chrome.
      if (chromeElements.length === 0) return null;

      // Only boxes that paint something INSIDE the viewport can cover it — and
      // only those are worth naming. A footer 3000px down covers nothing here.
      const vw = context.viewportWidth;
      const vh = context.viewportHeight;
      const painted = chromeElements.filter((el) => {
        const b = el.bounds!;
        return b.width > 0 && b.height > 0 &&
          b.x < vw && b.y < vh && b.x + b.width > 0 && b.y + b.height > 0;
      });
      const chromeArea = unionAreaPx(
        painted.map((el) => el.bounds!),
        context.viewportWidth,
        context.viewportHeight,
      );
      const chromePercent = (chromeArea / viewportArea) * 100;

      if (chromePercent > 30) {
        const named = outermostChrome(painted);
        const chromeReport: ChromeElementReport[] = named.map((el) => ({
          selector: el.selector,
          tagName: el.tagName,
          bounds: { x: el.bounds.x, y: el.bounds.y, width: el.bounds.width, height: el.bounds.height },
        }));
        const listed = chromeReport.slice(0, MAX_NAMED_CHROME)
          .map((c) => `${c.selector} ${fmtBox(c.bounds)}`);
        const more = chromeReport.length - listed.length;
        const violation: Violation & { chromeElements: ChromeElementReport[] } = {
          ruleId: 'calm-precision/content-chrome-ratio',
          ruleName: 'Content >= Chrome',
          severity: 'warn',
          message: `Chrome elements occupy ~${Math.round(chromePercent)}% of viewport (${painted.length} chrome element(s) measured). Counted as chrome: ${listed.join('; ')}${more > 0 ? `; +${more} more` : ''}. Content should be >= 70%.`,
          fix: 'Reduce navigation/toolbar/sidebar chrome. Consider collapsible panels or minimized navigation.',
          chromeElements: chromeReport,
        };
        return violation;
      }
      return null;
    },
  },
];
