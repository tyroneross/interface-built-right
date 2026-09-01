/**
 * The ONE text-contrast measurement used by every contrast rule in this repo.
 *
 * WHY IT LIVES IN ITS OWN MODULE: two separate contrast rules ship in IBR and
 * both ran on every scan — `wcag/contrast` (src/rules/wcag-contrast.ts, always
 * on, reported under `ScanResult.ruleEngine`) and the `wcag-contrast` preset
 * pair (src/rules/presets/, reported under `ScanResult.issues`). They carried
 * byte-equivalent copies of the luminance and ratio math, and the same
 * `if (bg.kind !== 'rgb') return null` bail. Fixing one left the other quietly
 * measuring nothing, which is how a scan reported a contrast finding in one
 * field and silence in the other for the same element.
 *
 * Everything that grades text contrast imports from here. Adding a fourth copy
 * is the defect, not the fix.
 */

import { parseColor, flatten, resolveEffectiveBackground } from './color-parse.js';
import type { EnhancedElement } from '../schemas.js';

/**
 * Linearize an sRGB channel value (0–255) per WCAG 2.1.
 */
function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Calculate relative luminance per WCAG 2.1 formula.
 */
function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * Calculate WCAG contrast ratio between two RGB triplets.
 */
function contrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
  const l1 = relativeLuminance(...fg);
  const l2 = relativeLuminance(...bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Classify text as "large" per WCAG 2.1.
 *
 * The spec is in POINTS: 18pt normal, or 14pt bold. At the CSS reference of
 * 1pt = 1.333px that is 24px and 18.66px. This comment previously stated the
 * point numbers as pixel numbers (18px / 14px) — the exact confusion the code
 * below was corrected for — inside the file that is supposed to be the single
 * source of truth. The comment now matches the executable line.
 */
function classifyTextSize(styles: Record<string, string>): { large: boolean; assumed: boolean } {
  const fontSize = parseFloat(styles.fontSize ?? '');
  // An unreadable font size is an ASSUMPTION, not a measurement. Returning a
  // bare `false` is how the threshold silently defaulted to 4.5:1 for every
  // element for as long as extract.ts captured no font metrics at all.
  if (isNaN(fontSize)) return { large: false, assumed: true };

  const fontWeightStr = styles.fontWeight ?? '';
  const isBold = fontWeightStr === 'bold' || parseInt(fontWeightStr, 10) >= 700;
  return { large: fontSize >= 24 || (isBold && fontSize >= 18.66), assumed: false };
}

// ============================================
// Measurement — ONE implementation, two consumers
// ============================================

/**
 * The outcome of trying to grade one element's text contrast.
 *
 * This is deliberately a total function over the element: there is no "we
 * quietly did nothing" arm. `scan()` tallies these statuses so a report can
 * distinguish ZERO FINDINGS from ZERO MEASUREMENTS — the ambiguity that let a
 * no-op contrast rule look like a clean page for as long as it did.
 */
export type ContrastMeasurement =
  /** Element carries no rendered text, so there is no contrast to grade. */
  | { status: 'no-text' }
  /** No computed styles were captured for this element (extraction gap). */
  | { status: 'no-styles' }
  /** Text is not painted at all (`color: transparent`, alpha 0). Nothing to see, nothing to grade. */
  | { status: 'invisible'; reason: string }
  /** A real color somewhere in the stack could not be decoded. MUST be surfaced. */
  | { status: 'unmeasurable'; raw: string; text: string }
  /** Graded. `backgroundResolved: false` means the ratio is against ASSUMED white. */
  | {
      status: 'measured';
      ratio: number;
      large: boolean;
      /** true when font size could not be read, so the normal-text threshold was ASSUMED. */
      sizeAssumed: boolean;
      /** Foreground composited over the effective background — what the eye sees. */
      foreground: [number, number, number];
      /** The effective background the ratio was computed against. */
      background: [number, number, number];
      /** Element `opacity` < 1 was folded into the foreground alpha. */
      opacityApplied: boolean;
      /** false = no opaque background existed in the ancestor chain; white was assumed. */
      backgroundResolved: boolean;
      /** A gradient or image paints behind this text; only the color layers were sampled. */
      backgroundImageBehind: boolean;
      text: string;
      fgRaw: string;
      bgRaw: string;
    };

/**
 * Resolve what a reader actually sees behind this element's text and grade it.
 *
 * The background is the element's own `background-color` composited through its
 * ancestors (`element.backgroundChain`). When no opaque layer exists anywhere in
 * that chain the browser paints the white canvas, so white is assumed and
 * `backgroundResolved` is false — the same honesty contract `src/live/measure.ts`
 * carries as `effectiveBackgroundResolved`. Assuming white and SAYING SO beats
 * skipping the element, which is what the old
 * `if (bg.kind !== 'rgb') return null` did on essentially every real page.
 */
export function measureElementContrast(element: EnhancedElement): ContrastMeasurement {
  const style = element.computedStyles;
  if (!style) return { status: 'no-styles' };

  const text = (element.text ?? '').trim();
  if (text.length === 0) return { status: 'no-text' };

  // `opacity` and `visibility` were captured on both extraction paths and then
  // never consulted, in two opposite-but-both-wrong directions.
  //
  // FALSE CLAIM: opacity-0 and visibility-hidden text keeps its full layout
  // box (only `display:none` collapses the rect, which is all the extractors
  // reject), so it was graded and reported — while the `invisible` status right
  // above claims to cover exactly this case.
  //
  // FALSE NEGATIVE, and the costlier one: `opacity: 0.6` is a very common
  // muted-text pattern. Grading it at full strength reports a HIGHER ratio than
  // a reader sees, so genuine failures pass silently. That is the same
  // false-clean class this module exists to eliminate, with the datum already
  // in hand.
  const opacity = parseFloat(style.opacity ?? '1');
  const opacityKnown = !isNaN(opacity);
  if (style.visibility === 'hidden' || (opacityKnown && opacity <= 0)) {
    return { status: 'invisible', reason: style.visibility === 'hidden' ? 'visibility-hidden' : 'opacity-0' };
  }

  const fg = parseColor(style.color ?? '');
  if (fg.kind === 'unsupported') {
    return { status: 'unmeasurable', raw: fg.raw, text };
  }
  if (fg.kind === 'none') {
    // Split the reasons apart. `transparent` / `alpha-0` mean the text is
    // genuinely not painted, so there is nothing to grade. Every other reason
    // ('empty', 'inherit', 'unset', 'currentcolor') means WE COULD NOT READ THE
    // COLOR — a measurement gap. Filing a gap as a legitimate skip is the same
    // mistake as reporting a page clean because nothing was measured on it.
    // Chrome always resolves computed `color`, so this is only reachable via
    // the fallback callers below (hand-built fixtures, older cached scans) —
    // which is exactly where a silent gap would go unnoticed.
    const notPainted = fg.reason === 'transparent' || fg.reason === 'alpha-0';
    return notPainted
      ? { status: 'invisible', reason: fg.reason }
      : { status: 'unmeasurable', raw: style.color ?? `(${fg.reason})`, text };
  }

  // Prefer the captured ancestor chain. Fall back to the element's own
  // background-color so a caller that predates chain capture (a hand-built
  // fixture, an older cached scan) still measures rather than crashing.
  const chain = element.backgroundChain && element.backgroundChain.length > 0
    ? element.backgroundChain
    : [style.backgroundColor ?? ''];

  const bg = resolveEffectiveBackground(chain);
  if (bg.unsupported !== undefined) {
    return { status: 'unmeasurable', raw: bg.unsupported, text };
  }

  // Fold element opacity into the foreground alpha. This is exact in the common
  // case — a text element with a transparent background, faded over an opaque
  // ancestor. When the element paints its OWN opaque background, that
  // background fades with the text and this slightly understates the ratio;
  // `opacityApplied` marks the finding so the number is not read as exact.
  // ANCESTOR opacity is a known gap: a faded wrapper is not represented here.
  const effectiveFg = opacityKnown && opacity < 1
    ? { ...fg, alpha: fg.alpha * opacity }
    : fg;

  const fgRgb = flatten(effectiveFg, bg.rgb);
  if (!fgRgb) return { status: 'invisible', reason: 'foreground did not composite' };

  const size = classifyTextSize(style);

  return {
    status: 'measured',
    ratio: contrastRatio(fgRgb, bg.rgb),
    large: size.large,
    sizeAssumed: size.assumed,
    foreground: fgRgb,
    background: bg.rgb,
    opacityApplied: opacityKnown && opacity < 1,
    backgroundResolved: bg.resolved,
    backgroundImageBehind: element.backgroundImageBehind === true,
    text,
    fgRaw: style.color ?? '',
    bgRaw: `rgb(${bg.rgb.join(', ')})`,
  };
}

/** Appended to a finding so a reader knows how solid the number underneath it is. */
export function confidenceNote(m: Extract<ContrastMeasurement, { status: 'measured' }>): string {
  const notes: string[] = [];
  if (!m.backgroundResolved) {
    notes.push('measured against an assumed white page background — no opaque background found in the ancestor chain');
  }
  if (m.backgroundImageBehind) {
    notes.push('a background-image paints behind this text; only the color layers were sampled');
  }
  if (m.sizeAssumed) {
    notes.push('font size could not be read, so the normal-text threshold was assumed — a large-text element may be graded too strictly');
  }
  if (m.opacityApplied) {
    notes.push('element opacity was folded into the text color');
  }
  return notes.length > 0 ? ` [${notes.join('; ')}]` : '';
}
