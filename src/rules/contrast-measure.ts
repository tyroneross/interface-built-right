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
 * Classify text as "large" per WCAG 2.1:
 * - >= 18px normal weight
 * - >= 14px bold (fontWeight >= 700)
 */
function isLargeText(styles: Record<string, string>): boolean {
  const fontSizeStr = styles.fontSize ?? '';
  const fontWeightStr = styles.fontWeight ?? '';

  const fontSize = parseFloat(fontSizeStr);
  if (isNaN(fontSize)) return false;

  const isBold = fontWeightStr === 'bold' || parseInt(fontWeightStr, 10) >= 700;
  return fontSize >= 24 || (isBold && fontSize >= 18.66);
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

  const fg = parseColor(style.color ?? '');
  if (fg.kind === 'unsupported') {
    return { status: 'unmeasurable', raw: fg.raw, text };
  }
  if (fg.kind === 'none') {
    // `color: transparent` / alpha 0 — the text is not painted. Grading it
    // against anything would invent a number.
    return { status: 'invisible', reason: fg.reason };
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

  const fgRgb = flatten(fg, bg.rgb);
  if (!fgRgb) return { status: 'invisible', reason: 'foreground did not composite' };

  return {
    status: 'measured',
    ratio: contrastRatio(fgRgb, bg.rgb),
    large: isLargeText(style),
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
  return notes.length > 0 ? ` [${notes.join('; ')}]` : '';
}
