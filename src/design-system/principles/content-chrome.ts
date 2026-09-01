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

const CHROME_SELECTORS = /\b(nav|header|footer|sidebar|toolbar|menu|breadcrumb|tabs)\b/i;

/**
 * Tags that only ever appear in the INTERACTIVE extraction lane. If every
 * element the rule was handed is one of these, it was shown the control list
 * rather than the page, and any chrome measurement over it is meaningless.
 */
const CONTROL_TAGS: ReadonlySet<string> = new Set([
  'button', 'a', 'input', 'select', 'textarea', 'summary', 'details',
]);

function isChrome(el: EnhancedElement): boolean {
  return CHROME_SELECTORS.test(el.tagName) ||
    CHROME_SELECTORS.test(el.selector || '') ||
    CHROME_SELECTORS.test(el.a11y?.role || '');
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

      const chromeElements = context.allElements.filter((el) => isChrome(el) && el.bounds);

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

      const chromeArea = unionAreaPx(
        chromeElements.map((el) => el.bounds!),
        context.viewportWidth,
        context.viewportHeight,
      );
      const chromePercent = (chromeArea / viewportArea) * 100;

      if (chromePercent > 30) {
        return {
          ruleId: 'calm-precision/content-chrome-ratio',
          ruleName: 'Content >= Chrome',
          severity: 'warn',
          message: `Chrome elements occupy ~${Math.round(chromePercent)}% of viewport (${chromeElements.length} chrome element(s) measured). Content should be >= 70%.`,
          fix: 'Reduce navigation/toolbar/sidebar chrome. Consider collapsible panels or minimized navigation.',
        };
      }
      return null;
    },
  },
];
