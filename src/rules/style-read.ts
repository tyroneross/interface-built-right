/**
 * The ONE list of computed-style properties the extractors capture, and the ONE
 * way a rule reads one.
 *
 * WHY IT EXISTS: `EnhancedElement.computedStyles` is a bare
 * `Record<string, string>`, so `style.paddingTop` on an element whose extractor
 * never captured `paddingTop` is `undefined` — the exact same value as a page
 * that genuinely declares no padding. Three rules were built on that ambiguity
 * and graded nothing at all for as long as they shipped:
 *
 *   - `spacing-grid/off-grid` read paddingTop/marginTop/gap/... and bailed with
 *     `if (!raw) continue`. The extractor captured NONE of them, so every
 *     property was skipped, `offGridValues` was always empty, and the rule
 *     returned null for every element on every page ever scanned.
 *   - `calm-precision/gestalt-grouping` read `style.border` and
 *     `style['border-width']`. Neither was captured, and the second was
 *     kebab-case besides, while every captured key is camelCase.
 *   - `visualPatterns`' style fingerprint read borderRadius/padding/
 *     borderWidth/borderColor. Four of its eight dimensions were permanently
 *     the empty string, so two buttons differing only in radius and padding
 *     were reported as ONE consistent pattern.
 *
 * None of the three reported a defect. None reported that it could not measure.
 * A reader could not tell them from a clean page — the same false-clean class
 * `contrast-measure.ts` was written to eliminate for color.
 *
 * THE STRUCTURAL FIX: this list is the single source of truth, and the
 * extractors BUILD their capture from it (see `src/extract.ts` and
 * `src/sensors/css-extract.ts`). A property in this list is captured by
 * construction. A property NOT in this list resolves to `{ status:
 * 'not-captured' }` rather than `undefined`, so a rule reading one has a status
 * it must handle instead of a falsy value it silently skips.
 */

import type { EnhancedElement, Violation } from '../schemas.js';

/**
 * Every computed-style property any rule or sensor in this repo reads.
 *
 * ADDING A READ MEANS ADDING A KEY HERE. That is the whole contract: the
 * extractors iterate this list, so a key present here is captured on every
 * extraction path, and a key absent here is reported as unmeasured rather than
 * silently read as undefined.
 *
 * camelCase throughout, because that is what `getComputedStyle` indexes and
 * what every existing consumer already assumes. `border-width` (kebab) was a
 * real read in `gestalt.ts` and matched nothing.
 */
export const CAPTURED_STYLE_KEYS = [
  // Paint — the contrast lane (src/rules/contrast-measure.ts).
  'color',
  'backgroundColor',
  // Presence — visibility guards across touch-targets and contrast.
  'display',
  'visibility',
  'opacity',
  'cursor',
  // Type — WCAG large-text classification + the typography sensor + the
  // design-system `lineHeights` validator, which read `line-height` and got
  // `undefined` on every element because nobody captured it.
  'fontSize',
  'fontWeight',
  'fontFamily',
  'lineHeight',
  // Border — gestalt grouping + the visual-pattern fingerprint.
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'borderColor',
  'borderRadius',
  // Spacing — the 8pt-grid rule + the visual-pattern fingerprint.
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

export type CapturedStyleKey = (typeof CAPTURED_STYLE_KEYS)[number];

const CAPTURED_SET: ReadonlySet<string> = new Set(CAPTURED_STYLE_KEYS);

/** True when `key` is one the extractors are contracted to capture. */
export function isCapturedStyleKey(key: string): key is CapturedStyleKey {
  return CAPTURED_SET.has(key);
}

/**
 * The outcome of reading one computed-style property off one element.
 *
 * Deliberately total, like `ContrastMeasurement`: there is no arm that means
 * "quietly nothing". `not-captured` is the arm that did not exist before, and
 * it is the one that turns a silent no-op into a reportable coverage gap.
 */
export type StyleRead =
  /** The element carries no computed styles at all (extraction gap). */
  | { status: 'no-styles'; key: string }
  /**
   * Nobody captures this property, so the rule asking for it cannot be
   * answered on ANY element. This is a defect in the rule or in
   * CAPTURED_STYLE_KEYS — never a property of the page.
   */
  | { status: 'not-captured'; key: string }
  /**
   * The property is captured, but this element has no value for it. Genuine
   * absence — the page really does not set it.
   */
  | { status: 'absent'; key: string }
  /** Read. */
  | { status: 'read'; key: string; value: string };

/**
 * Read one computed-style property, saying WHY when there is no value.
 *
 * Use this instead of `element.computedStyles?.[key]` anywhere a missing value
 * would otherwise be treated as "nothing to report". The three-way split
 * between `not-captured`, `no-styles`, and `absent` is the entire point: only
 * the last one means the page is clean.
 */
export function readStyle(element: EnhancedElement, key: string): StyleRead {
  if (!isCapturedStyleKey(key)) return { status: 'not-captured', key };

  const styles = element.computedStyles;
  if (!styles) return { status: 'no-styles', key };

  const value = styles[key];
  if (value === undefined || value === null || value === '') {
    return { status: 'absent', key };
  }
  return { status: 'read', key, value };
}

/**
 * Read several properties at once, splitting them into what was measured and
 * what could not be.
 *
 * Rules use this to answer both halves of their job in one pass: produce a
 * finding from the values they DID read, and produce a `could not measure`
 * finding naming the ones they did not.
 */
export function readStyles(
  element: EnhancedElement,
  keys: readonly string[],
): { values: Record<string, string>; unmeasured: StyleRead[] } {
  const values: Record<string, string> = {};
  const unmeasured: StyleRead[] = [];

  for (const key of keys) {
    const r = readStyle(element, key);
    if (r.status === 'read') values[key] = r.value;
    // `absent` is a real answer — the page does not set this property. Only
    // `not-captured` and `no-styles` are measurement failures worth surfacing.
    else if (r.status !== 'absent') unmeasured.push(r);
  }

  return { values, unmeasured };
}

/**
 * A finding that says a rule could not measure what it needed.
 *
 * This is the `unmeasurableViolation` shape from the contrast lane, generalized:
 * silence is the failure mode, so a rule that cannot do its job says so at
 * `warn` rather than returning null and reading as a pass.
 */
export function unmeasuredStyleViolation(
  element: EnhancedElement,
  ruleId: string,
  ruleName: string,
  unmeasured: readonly StyleRead[],
): Violation {
  const notCaptured = unmeasured.filter((u) => u.status === 'not-captured').map((u) => u.key);
  const reason = notCaptured.length > 0
    ? `no extractor captures ${notCaptured.join(', ')}`
    : 'no computed styles were captured for this element';

  return {
    ruleId: `${ruleId}-unmeasurable`,
    ruleName: `${ruleName} (not measurable)`,
    severity: 'warn',
    message: `"${(element.text || element.selector || '').slice(0, 40)}" was NOT checked by ${ruleId}: ${reason}`,
    element: element.selector,
    bounds: element.bounds,
    fix: notCaptured.length > 0
      ? `Add ${notCaptured.join(', ')} to CAPTURED_STYLE_KEYS in src/rules/style-read.ts so the extractors capture it.`
      : 'Re-run the scan. If it persists, the element was extracted without computed styles.',
  };
}

// ============================================
// Shared derivations over captured properties
// ============================================

/** Parse a `<number>px` computed value. Returns null when it is not px. */
export function parsePx(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed.endsWith('px')) return null;
  const n = parseFloat(trimmed);
  return isNaN(n) ? null : n;
}

/** The four border-width longhands, in the order CSS names them. */
export const BORDER_WIDTH_KEYS = [
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
] as const;

/**
 * Does this element paint a border a reader can see?
 *
 * Longhands, not the `border` shorthand. `getComputedStyle(el).border` returns
 * `"0px none rgb(0, 0, 0)"` for an element with NO border, so the old
 * `style.border !== 'none' && style.border !== '0px'` test would have been true
 * for every element on the page had `border` ever been captured — a
 * false-positive bomb sitting behind a rule that could not fire at all.
 */
export function resolveBorderPresence(
  element: EnhancedElement,
): { status: 'measured'; hasBorder: boolean; widths: number[] } | { status: 'unmeasured'; unmeasured: StyleRead[] } {
  const { values, unmeasured } = readStyles(element, [...BORDER_WIDTH_KEYS, 'borderStyle']);
  if (unmeasured.length > 0) return { status: 'unmeasured', unmeasured };

  const style = values.borderStyle ?? '';
  // `border-style: none` paints nothing regardless of declared width.
  const styleHidesBorder = style === 'none' || style === 'hidden';

  const widths = BORDER_WIDTH_KEYS
    .map((k) => (values[k] !== undefined ? parsePx(values[k]) : null))
    .filter((n): n is number => n !== null);

  const hasBorder = !styleHidesBorder && widths.some((w) => w > 0);
  return { status: 'measured', hasBorder, widths };
}
