import type { Rule, RuleContext } from './types.js';
import type { EnhancedElement, Violation } from '../schemas.js';
import { readStyle, parsePx, type StyleRead } from './style-read.js';

/*
 * THIS RULE GRADED NOTHING FOR AS LONG AS IT SHIPPED.
 *
 * It walked paddingTop/paddingRight/.../marginLeft/gap and bailed on each with
 * `if (!raw) continue`. The extractors captured NONE of those properties —
 * `src/extract.ts` populated eight keys, none of them spacing — so every
 * property was skipped, `offGridValues` was always empty, and the rule
 * returned null for every element on every page. Zero findings, zero
 * measurements, and nothing in the output could tell them apart.
 *
 * Proven by planted defect: a control with `padding: 7px 13px; margin: 5px`
 * produced no finding, and its captured `computedStyles` contained no padding
 * or margin key at all.
 *
 * The `continue` was the defect — the same shape as the contrast rule's
 * `if (bg.kind !== 'rgb') return null`, a could-not-measure filed as a clean
 * result. Reads now go through `readStyle`, which separates `not-captured`
 * (nobody captures this, so the rule cannot run) from `absent` (the page
 * genuinely sets no value). Only the second is silence.
 *
 * WHY THIS REPORTS PER PAGE, NOT PER ELEMENT. Switching the rule on measured
 * 18 findings on a 15-element fixture, and 15 of them (83%) were the identical
 * value: `padding: 1px 6px`, Chrome's UA default for `<button>`. That is ONE
 * decision reported fifteen times. A check that buries its one real finding
 * under fourteen copies of a browser default is a check a human learns to
 * ignore, so grid rhythm — a page-level property — is now reported page-level:
 * one finding per distinct off-grid value set, with the count and example
 * elements attached. The same fixture drops from 18 findings to 4, and the
 * planted 7px/13px/5px defect is legible instead of buried.
 */

/**
 * Spacing properties checked against the 8pt grid (4pt half-grid tolerance).
 *
 * LONGHANDS ONLY. The old list also carried the `padding`/`margin` shorthands
 * and parsed them by splitting on whitespace, which double-counted every
 * element whose shorthand and longhands both resolved. Every longhand here is
 * in CAPTURED_STYLE_KEYS, so each is answerable on every element.
 */
const SPACING_PROPERTIES = [
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'rowGap',
  'columnGap',
] as const;

/** On the 4px half-grid. Zero is always valid. */
function isOnGrid(px: number): boolean {
  if (px === 0) return true;
  return Math.round(px) % 4 === 0;
}

/** Off-grid spacing on one element, or the reason it could not be read. */
function offGridFor(element: EnhancedElement): { offGrid: string[]; unmeasured: StyleRead[] } {
  const offGrid: string[] = [];
  const unmeasured: StyleRead[] = [];

  for (const prop of SPACING_PROPERTIES) {
    const read = readStyle(element, prop);

    if (read.status === 'not-captured' || read.status === 'no-styles') {
      unmeasured.push(read);
      continue;
    }
    // `absent` is a real answer: the page sets no value for this side.
    if (read.status === 'absent') continue;

    const px = parsePx(read.value);
    // A non-px computed value (`auto` margin, a percentage) is not a grid
    // question — the grid is defined in pixels. Genuinely not-applicable.
    if (px === null) continue;

    // An 8pt grid is expressed in WHOLE pixels. A fractional computed value is
    // em-derived — Chrome's UA `<h2>` margin is 0.83em, which resolves to
    // 19.92px — and no author picked it off a spacing scale. Grading those
    // made every page with a heading permanently off-grid, which is a check a
    // reader learns to discard rather than a defect anyone can act on.
    if (!Number.isInteger(px)) continue;

    if (!isOnGrid(px)) offGrid.push(`${prop}: ${read.value}`);
  }

  return { offGrid, unmeasured };
}

export const spacingGridRules: Rule[] = [
  {
    id: 'spacing-grid/off-grid',
    name: 'Spacing Grid: Off 8pt Grid',
    description: 'Padding and margin values should be multiples of 4px (half 8pt grid)',
    defaultSeverity: 'warn',
    // Spacing belongs to any box, not just a control. Body copy and headings
    // carry the margins that set a page's rhythm, and on the default
    // `interactive` surface this rule never saw one.
    appliesTo: 'any',
    check: (element: EnhancedElement, context: RuleContext): Violation | null => {
      // Page-level: evaluate once per scan over the whole population. Same
      // once-per-scan pattern as calm-precision/content-chrome-ratio.
      if (context.allElements[0]?.selector !== element.selector) return null;

      const byValue = new Map<string, string[]>();
      let measured = 0;
      let unmeasurable = 0;

      for (const el of context.allElements) {
        const { offGrid, unmeasured } = offGridFor(el);
        // Could not read a single spacing property on this element.
        if (unmeasured.length === SPACING_PROPERTIES.length) {
          unmeasurable++;
          continue;
        }
        measured++;
        if (offGrid.length === 0) continue;
        const key = offGrid.join(', ');
        const seen = byValue.get(key) ?? [];
        if (seen.length < 3) seen.push(el.selector);
        byValue.set(key, seen);
      }

      // Nothing on the page could be measured. That is a coverage hole, not a
      // page on a tidy grid — and it is precisely what this rule silently
      // reported for its entire shipped life.
      if (measured === 0 && unmeasurable > 0) {
        return {
          ruleId: 'spacing-grid/off-grid-unmeasurable',
          ruleName: 'Spacing Grid: Off 8pt Grid (not measurable)',
          severity: 'warn',
          message: `Spacing was NOT checked on any of ${unmeasurable} elements: no computed spacing properties were captured.`,
          fix: 'Confirm paddingTop/marginTop/rowGap and friends are in CAPTURED_STYLE_KEYS (src/rules/style-read.ts).',
        };
      }

      if (byValue.size === 0) return null;

      // Most-used value sets first: the widest-spread deviation is the one
      // worth a design-system decision.
      const groups = [...byValue.entries()].sort((a, b) => b[1].length - a[1].length);
      const detail = groups
        .slice(0, 5)
        .map(([value, selectors]) => `${value} (e.g. ${selectors.join(', ')})`)
        .join(' | ');

      return {
        ruleId: 'spacing-grid/off-grid',
        ruleName: 'Spacing Grid: Off 8pt Grid',
        severity: 'warn',
        message: `${groups.length} distinct off-grid spacing value set(s) across ${measured} measured elements: ${detail}`,
        fix: 'Use spacing values that are multiples of 4px (e.g., 4, 8, 12, 16, 20, 24, 32px)',
      };
    },
  },
];
