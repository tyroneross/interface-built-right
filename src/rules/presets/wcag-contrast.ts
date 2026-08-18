import type { Rule, RuleContext, RulePreset } from '../types.js';
import type { EnhancedElement, Violation } from '../../schemas.js';
import { parseColor, flatten } from '../color-parse.js';

/*
 * parseColor now lives in ../color-parse.ts. This file used to carry its own
 * rgb/hex-only copy, and THAT copy is what the engine actually loaded: the
 * registered preset (engine.ts) resolves here, not to rules/wcag-contrast.ts.
 * So an oklch fix applied only to the other file was never reachable by a scan.
 * Import the shared parser; do not reintroduce a local one.
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
// Rules
// ============================================

const wcagAAContrastRule: Rule = {
  id: 'wcag-aa-contrast',
  name: 'WCAG 2.1 AA Contrast',
  description: 'Text must meet WCAG 2.1 AA contrast ratio: 4.5:1 normal text, 3:1 large text',
  defaultSeverity: 'error',
  check(element: EnhancedElement, _context: RuleContext): Violation | null {
    const style = element.computedStyles;
    if (!style) return null;

    const hasText = element.text && element.text.trim().length > 0;
    if (!hasText) return null;

    const fg = parseColor(style.color ?? '');
    const bg = parseColor(style.backgroundColor ?? '');

    // An undecodable color is NOT the same as no color. Returning null for both
    // is what let a scan report zero findings on a page it never measured.
    if (fg.kind === 'unsupported' || bg.kind === 'unsupported') {
      const raw = fg.kind === 'unsupported' ? fg.raw : (bg as { raw: string }).raw;
      return {
        ruleId: 'wcag-aa-contrast-unmeasurable',
        ruleName: 'WCAG 2.1 AA Contrast (not measurable)',
        severity: 'warn',
        message: `Could not decode color "${raw}", so contrast for "${(element.text ?? '').slice(0, 40)}" was NOT checked`,
        element: element.selector,
        bounds: element.bounds,
        fix: 'Add support for this color format in rules/color-parse.ts.',
      };
    }
    if (fg.kind !== 'rgb' || bg.kind !== 'rgb') return null;

    const fgRgb = flatten(fg, bg.rgb);
    if (!fgRgb) return null;
    const ratio = contrastRatio(fgRgb, bg.rgb);
    const large = isLargeText(style);
    const required = large ? 3.0 : 4.5;

    if (ratio < required) {
      const ratioStr = ratio.toFixed(2);
      const textSnippet = (element.text ?? '').slice(0, 40);
      return {
        ruleId: 'wcag-aa-contrast',
        ruleName: 'WCAG 2.1 AA Contrast',
        severity: 'error',
        message: `"${textSnippet}" contrast ratio ${ratioStr}:1 fails WCAG 2.1 AA (requires ${required}:1 for ${large ? 'large' : 'normal'} text)`,
        element: element.selector,
        bounds: element.bounds,
        fix: `Increase contrast between foreground ${style.color ?? ''} and background ${style.backgroundColor ?? ''}`,
      };
    }

    return null;
  },
};

const wcagAAAContrastRule: Rule = {
  id: 'wcag-aaa-contrast',
  name: 'WCAG 2.1 AAA Contrast',
  description: 'Text should meet WCAG 2.1 AAA contrast ratio: 7:1 normal text, 4.5:1 large text',
  defaultSeverity: 'warn',
  check(element: EnhancedElement, _context: RuleContext): Violation | null {
    const style = element.computedStyles;
    if (!style) return null;

    const hasText = element.text && element.text.trim().length > 0;
    if (!hasText) return null;

    const fg = parseColor(style.color ?? '');
    const bg = parseColor(style.backgroundColor ?? '');

    // An undecodable color is NOT the same as no color. Returning null for both
    // is what let a scan report zero findings on a page it never measured.
    if (fg.kind === 'unsupported' || bg.kind === 'unsupported') {
      const raw = fg.kind === 'unsupported' ? fg.raw : (bg as { raw: string }).raw;
      return {
        ruleId: 'wcag-aaa-contrast-unmeasurable',
        ruleName: 'WCAG 2.1 AAA Contrast (not measurable)',
        severity: 'warn',
        message: `Could not decode color "${raw}", so contrast for "${(element.text ?? '').slice(0, 40)}" was NOT checked`,
        element: element.selector,
        bounds: element.bounds,
        fix: 'Add support for this color format in rules/color-parse.ts.',
      };
    }
    if (fg.kind !== 'rgb' || bg.kind !== 'rgb') return null;

    const fgRgb = flatten(fg, bg.rgb);
    if (!fgRgb) return null;
    const ratio = contrastRatio(fgRgb, bg.rgb);
    const large = isLargeText(style);
    const required = large ? 4.5 : 7.0;

    if (ratio < required) {
      const ratioStr = ratio.toFixed(2);
      const textSnippet = (element.text ?? '').slice(0, 40);
      return {
        ruleId: 'wcag-aaa-contrast',
        ruleName: 'WCAG 2.1 AAA Contrast',
        severity: 'warn',
        message: `"${textSnippet}" contrast ratio ${ratioStr}:1 below WCAG 2.1 AAA (${required}:1 for ${large ? 'large' : 'normal'} text)`,
        element: element.selector,
        bounds: element.bounds,
        fix: `Increase contrast between foreground ${style.color ?? ''} and background ${style.backgroundColor ?? ''} to ${required}:1`,
      };
    }

    return null;
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
