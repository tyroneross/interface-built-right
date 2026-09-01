import type { Rule, RuleContext, RulePreset } from '../types.js';
import type { EnhancedElement, Violation } from '../../schemas.js';
import { parseColor, flatten, resolveEffectiveBackground } from '../color-parse.js';

/*
 * parseColor now lives in ../color-parse.ts. This file used to carry its own
 * rgb/hex-only copy, and THAT copy is what the engine actually loaded: the
 * registered preset (engine.ts) resolves here, not to rules/wcag-contrast.ts.
 * So an oklch fix applied only to the other file was never reachable by a scan.
 * Import the shared parser; do not reintroduce a local one.
 *
 * SILENCE IS THE FAILURE MODE. Every path below either produces a measurement
 * or produces a finding that says what was NOT measured. Returning null and
 * saying nothing is how this rule reported a clean page it had never looked at.
 */

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
function confidenceNote(m: Extract<ContrastMeasurement, { status: 'measured' }>): string {
  const notes: string[] = [];
  if (!m.backgroundResolved) {
    notes.push('measured against an assumed white page background — no opaque background found in the ancestor chain');
  }
  if (m.backgroundImageBehind) {
    notes.push('a background-image paints behind this text; only the color layers were sampled');
  }
  return notes.length > 0 ? ` [${notes.join('; ')}]` : '';
}

function unmeasurableViolation(
  element: EnhancedElement,
  m: Extract<ContrastMeasurement, { status: 'unmeasurable' }>,
  level: 'aa' | 'aaa',
): Violation {
  return {
    ruleId: `wcag-${level}-contrast-unmeasurable`,
    ruleName: `WCAG 2.1 ${level.toUpperCase()} Contrast (not measurable)`,
    severity: 'warn',
    message: `Could not decode color "${m.raw}", so contrast for "${m.text.slice(0, 40)}" was NOT checked`,
    element: element.selector,
    bounds: element.bounds,
    fix: 'Add support for this color format in rules/color-parse.ts.',
  };
}

// ============================================
// Rules
// ============================================

const wcagAAContrastRule: Rule = {
  id: 'wcag-aa-contrast',
  name: 'WCAG 2.1 AA Contrast',
  description: 'Text must meet WCAG 2.1 AA contrast ratio: 4.5:1 normal text, 3:1 large text',
  defaultSeverity: 'error',
  // Body copy and headings are exactly where readability failures hurt a
  // reader, so this rule grades TEXT anywhere — not just controls.
  appliesTo: 'any',
  check(element: EnhancedElement, _context: RuleContext): Violation | null {
    const m = measureElementContrast(element);

    // An undecodable color is NOT the same as no color. Returning null for both
    // is what let a scan report zero findings on a page it never measured.
    if (m.status === 'unmeasurable') return unmeasurableViolation(element, m, 'aa');
    if (m.status !== 'measured') return null;

    const required = m.large ? 3.0 : 4.5;
    if (m.ratio >= required) return null;

    return {
      ruleId: 'wcag-aa-contrast',
      ruleName: 'WCAG 2.1 AA Contrast',
      severity: 'error',
      message: `"${m.text.slice(0, 40)}" contrast ratio ${m.ratio.toFixed(2)}:1 fails WCAG 2.1 AA (requires ${required}:1 for ${m.large ? 'large' : 'normal'} text)${confidenceNote(m)}`,
      element: element.selector,
      bounds: element.bounds,
      fix: `Increase contrast between foreground ${m.fgRaw} and effective background ${m.bgRaw}`,
    };
  },
};

const wcagAAAContrastRule: Rule = {
  id: 'wcag-aaa-contrast',
  name: 'WCAG 2.1 AAA Contrast',
  description: 'Text should meet WCAG 2.1 AAA contrast ratio: 7:1 normal text, 4.5:1 large text',
  defaultSeverity: 'warn',
  appliesTo: 'any',
  check(element: EnhancedElement, _context: RuleContext): Violation | null {
    const m = measureElementContrast(element);

    if (m.status === 'unmeasurable') return unmeasurableViolation(element, m, 'aaa');
    if (m.status !== 'measured') return null;

    const required = m.large ? 4.5 : 7.0;
    if (m.ratio >= required) return null;

    return {
      ruleId: 'wcag-aaa-contrast',
      ruleName: 'WCAG 2.1 AAA Contrast',
      severity: 'warn',
      message: `"${m.text.slice(0, 40)}" contrast ratio ${m.ratio.toFixed(2)}:1 below WCAG 2.1 AAA (${required}:1 for ${m.large ? 'large' : 'normal'} text)${confidenceNote(m)}`,
      element: element.selector,
      bounds: element.bounds,
      fix: `Increase contrast between foreground ${m.fgRaw} and effective background ${m.bgRaw} to ${required}:1`,
    };
  },
};

// ============================================
// Preset
// ============================================

export const wcagContrastPresetRules: Rule[] = [wcagAAContrastRule, wcagAAAContrastRule];

export const wcagContrastPreset: RulePreset = {
  name: 'wcag-contrast',
  description: 'WCAG 2.1 contrast ratio checks — AA (4.5:1 / 3:1) and AAA (7:1 / 4.5:1)',
  rules: wcagContrastPresetRules,
  defaults: {
    'wcag-aa-contrast': 'error',
    'wcag-aaa-contrast': 'warn',
  },
};
