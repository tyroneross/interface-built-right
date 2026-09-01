import type { Rule, RuleContext } from './types.js';
import type { EnhancedElement, Violation } from '../schemas.js';
import { measureElementContrast, confidenceNote } from './contrast-measure.js';

/*
 * This is the ALWAYS-ON contrast rule: `runAllRules` (rules/index.ts) runs it on
 * every scan regardless of which presets are enabled, and its findings surface
 * under `ScanResult.ruleEngine`. The `wcag-contrast` PRESET pair
 * (rules/presets/wcag-contrast.ts) is the other lane, surfacing under
 * `ScanResult.issues`.
 *
 * Both lanes used to carry their own copy of the luminance math and their own
 * `if (bg.kind !== 'rgb') return null` bail, which meant text on a transparent
 * background — nearly all text on a real page — was measured by NEITHER, and
 * fixing one lane left the other silently reporting a clean page. Both now call
 * the single `measureElementContrast` in ./contrast-measure.ts, which resolves
 * the effective background by compositing through ancestors and assumes white
 * (saying so) when no opaque layer exists.
 */

export const wcagContrastRules: Rule[] = [
  {
    id: 'wcag/contrast',
    name: 'WCAG 2.1: Color Contrast',
    description: 'Text must meet WCAG 2.1 minimum contrast: 4.5:1 normal, 3:1 large text',
    defaultSeverity: 'error',
    check: (element: EnhancedElement, _context: RuleContext): Violation | null => {
      const m = measureElementContrast(element);

      // A color we cannot decode is NOT the same as no color. Report it, so a
      // page that was never measured can never be mistaken for a page that passed.
      if (m.status === 'unmeasurable') {
        return {
          ruleId: 'wcag/contrast-unmeasurable',
          ruleName: 'WCAG 2.1: Color Contrast (not measurable)',
          severity: 'warn',
          message: `Could not decode color "${m.raw}", so contrast for "${m.text.slice(0, 40)}" was NOT checked`,
          element: element.selector,
          bounds: element.bounds,
          fix: `Add support for this color format to rules/color-parse.ts, or serve a format the parser understands.`,
        };
      }

      if (m.status !== 'measured') return null;

      // WCAG's large-text thresholds are in POINTS (18pt normal, 14pt bold). At
      // the CSS reference of 1pt = 1.333px that is 24px and 18.66px — see
      // isLargeText in ./contrast-measure.ts. Using the point numbers as pixel
      // numbers handed the lenient 3:1 threshold to every 18px heading.
      const threshold = m.large ? 3.0 : 4.5;
      if (m.ratio >= threshold) return null;

      return {
        ruleId: 'wcag/contrast',
        ruleName: 'WCAG 2.1: Color Contrast',
        severity: 'error',
        message: `"${m.text.slice(0, 40)}" has contrast ratio ${m.ratio.toFixed(2)}:1 (required ${threshold}:1 for ${m.large ? 'large' : 'normal'} text)${confidenceNote(m)}`,
        element: element.selector,
        bounds: element.bounds,
        fix: `Increase contrast between foreground ${m.fgRaw} and effective background ${m.bgRaw}`,
      };
    },
  },
];
