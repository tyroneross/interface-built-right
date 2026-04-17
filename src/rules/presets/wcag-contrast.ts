import { registerPreset, type Rule, type RuleContext } from '../engine.js';
import type { EnhancedElement, Violation, RuleSetting } from '../../schemas.js';

/**
 * Parse a color string (hex, rgb, rgba) into [r, g, b] in 0–255 range.
 * Returns null if the string cannot be parsed, is transparent, or has zero alpha.
 */
function parseColor(color: string): [number, number, number] | null {
  if (!color || color === 'transparent' || color === 'initial' || color === 'inherit' || color === 'unset') {
    return null;
  }

  // rgba(r, g, b, a) — skip fully transparent
  const rgbaMatch = color.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([\d.]+))?\s*\)$/);
  if (rgbaMatch) {
    const alpha = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1;
    if (alpha === 0) return null;
    return [parseInt(rgbaMatch[1], 10), parseInt(rgbaMatch[2], 10), parseInt(rgbaMatch[3], 10)];
  }

  // #rrggbb
  const hex6Match = color.match(/^#([0-9a-fA-F]{6})$/);
  if (hex6Match) {
    const n = parseInt(hex6Match[1], 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  }

  // #rgb
  const hex3Match = color.match(/^#([0-9a-fA-F]{3})$/);
  if (hex3Match) {
    const r = parseInt(hex3Match[1][0], 16) * 17;
    const g = parseInt(hex3Match[1][1], 16) * 17;
    const b = parseInt(hex3Match[1][2], 16) * 17;
    return [r, g, b];
  }

  return null;
}

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
  return fontSize >= 18 || (isBold && fontSize >= 14);
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
    if (!fg || !bg) return null;

    const ratio = contrastRatio(fg, bg);
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
    if (!fg || !bg) return null;

    const ratio = contrastRatio(fg, bg);
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

export function register(): void {
  const defaults: Record<string, RuleSetting> = {
    'wcag-aa-contrast': 'error',
    'wcag-aaa-contrast': 'warn',
  };
  registerPreset({
    name: 'wcag-contrast',
    description: 'WCAG 2.1 contrast ratio checks — AA (4.5:1 / 3:1) and AAA (7:1 / 4.5:1)',
    rules: wcagContrastPresetRules,
    defaults,
  });
}
