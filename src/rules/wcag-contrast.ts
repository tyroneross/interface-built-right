import type { Rule, RuleContext } from './engine.js';
import type { EnhancedElement, Violation } from '../schemas.js';

/**
 * Parse a color string (hex, rgb, rgba) into [r, g, b] in 0–255 range.
 * Returns null if the string cannot be parsed or is transparent/unset.
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

  // #rrggbb or #rgb
  const hex6Match = color.match(/^#([0-9a-fA-F]{6})$/);
  if (hex6Match) {
    const n = parseInt(hex6Match[1], 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  }

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
 * Calculate WCAG contrast ratio between two luminance values.
 */
function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Determine if text qualifies as "large text" per WCAG 2.1:
 * >= 18px normal weight, or >= 14px bold.
 */
function isLargeText(styles: Record<string, string>): boolean {
  const fontSizeStr = styles.fontSize ?? '';
  const fontWeightStr = styles.fontWeight ?? '';

  const fontSize = parseFloat(fontSizeStr);
  if (isNaN(fontSize)) return false;

  const isBold = fontWeightStr === 'bold' || parseInt(fontWeightStr, 10) >= 700;

  return fontSize >= 18 || (isBold && fontSize >= 14);
}

export const wcagContrastRules: Rule[] = [
  {
    id: 'wcag/contrast',
    name: 'WCAG 2.1: Color Contrast',
    description: 'Text must meet WCAG 2.1 minimum contrast: 4.5:1 normal, 3:1 large text',
    defaultSeverity: 'error',
    check: (element: EnhancedElement, _context: RuleContext): Violation | null => {
      const style = element.computedStyles;
      if (!style) return null;

      // Only check elements that render text
      const hasText = element.text && element.text.trim().length > 0;
      if (!hasText) return null;

      const fgColor = parseColor(style.color ?? '');
      const bgColor = parseColor(style.backgroundColor ?? '');

      // Skip if either color is unresolvable (transparent bg = inherits, can't compute)
      if (!fgColor || !bgColor) return null;

      const fgL = relativeLuminance(...fgColor);
      const bgL = relativeLuminance(...bgColor);
      const ratio = contrastRatio(fgL, bgL);

      const largeText = isLargeText(style);
      const threshold = largeText ? 3.0 : 4.5;

      if (ratio < threshold) {
        const ratioStr = ratio.toFixed(2);
        const textSnippet = (element.text ?? '').slice(0, 40);
        return {
          ruleId: 'wcag/contrast',
          ruleName: 'WCAG 2.1: Color Contrast',
          severity: 'error',
          message: `"${textSnippet}" has contrast ratio ${ratioStr}:1 (required ${threshold}:1 for ${largeText ? 'large' : 'normal'} text)`,
          element: element.selector,
          bounds: element.bounds,
          fix: `Increase contrast between foreground ${style.color ?? ''} and background ${style.backgroundColor ?? ''}`,
        };
      }

      return null;
    },
  },
];
