import type { Rule, RuleContext } from './types.js';
import type { EnhancedElement, Violation } from '../schemas.js';
import { parseColor, flatten } from './color-parse.js';

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
 * Determine if text qualifies as "large text" per WCAG 2.1.
 *
 * The spec is in POINTS: 18pt normal, or 14pt bold. At the CSS reference of
 * 1pt = 1.333px that is 24px and 18.66px. The previous implementation used the
 * point numbers as pixel numbers (18px / 14px), which handed the lenient 3:1
 * threshold to everything from 18px up. An 18px semibold heading owes 4.5:1 and
 * was being graded against 3:1.
 */
function isLargeText(styles: Record<string, string>): boolean {
  const fontSizeStr = styles.fontSize ?? '';
  const fontWeightStr = styles.fontWeight ?? '';

  const fontSize = parseFloat(fontSizeStr);
  if (isNaN(fontSize)) return false;

  const isBold = fontWeightStr === 'bold' || parseInt(fontWeightStr, 10) >= 700;

  return fontSize >= 24 || (isBold && fontSize >= 18.66);
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

      const fg = parseColor(style.color ?? '');
      const bg = parseColor(style.backgroundColor ?? '');

      // A color we cannot decode is NOT the same as no color. Report it, so a
      // page that was never measured can never be mistaken for a page that passed.
      const undecodable = [fg, bg].find((c) => c.kind === 'unsupported');
      if (undecodable && undecodable.kind === 'unsupported') {
        return {
          ruleId: 'wcag/contrast-unmeasurable',
          ruleName: 'WCAG 2.1: Color Contrast (not measurable)',
          severity: 'warn',
          message: `Could not decode color "${undecodable.raw}", so contrast for "${(element.text ?? '').slice(0, 40)}" was NOT checked`,
          element: element.selector,
          bounds: element.bounds,
          fix: `Add support for this color format to rules/color-parse.ts, or serve a format the parser understands.`,
        };
      }

      if (fg.kind !== 'rgb' || bg.kind !== 'rgb') return null;

      // Composite translucent text over its background before measuring; taking
      // rgba() at full strength overstates contrast.
      const fgColor = flatten(fg, bg.rgb);
      const bgColor = bg.rgb;
      if (!fgColor) return null;

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
