import type { Rule, RuleContext } from './engine.js';
import type { EnhancedElement, Violation } from '../schemas.js';

/**
 * Spacing properties to check against the 8pt grid (4pt half-grid tolerance).
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
  // Shorthand forms that may appear in computedStyles
  'padding',
  'margin',
  'gap',
  'rowGap',
  'columnGap',
];

/**
 * Parse a single px value string.
 * Returns null for auto, percentages, em/rem, or unparseable values.
 */
function parsePxValue(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'auto' || trimmed === 'normal' || trimmed === 'initial' || trimmed === 'inherit') {
    return null;
  }
  if (trimmed.endsWith('%')) return null;
  if (trimmed.endsWith('em') || trimmed.endsWith('rem') || trimmed.endsWith('vw') || trimmed.endsWith('vh')) {
    return null;
  }
  if (!trimmed.endsWith('px')) return null;

  const n = parseFloat(trimmed);
  return isNaN(n) ? null : n;
}

/**
 * Check whether a px value is a multiple of 4 (half 8pt grid).
 * Zero is always valid.
 */
function isOnGrid(px: number): boolean {
  if (px === 0) return true;
  return Math.round(px) % 4 === 0;
}

/**
 * Extract shorthand spacing (e.g., "16px 8px 16px 8px") into individual values.
 * Returns array of px values found.
 */
function parseSpacingShorthand(value: string): number[] {
  const parts = value.trim().split(/\s+/);
  const results: number[] = [];
  for (const part of parts) {
    const px = parsePxValue(part);
    if (px !== null) results.push(px);
  }
  return results;
}

export const spacingGridRules: Rule[] = [
  {
    id: 'spacing-grid/off-grid',
    name: 'Spacing Grid: Off 8pt Grid',
    description: 'Padding and margin values should be multiples of 4px (half 8pt grid)',
    defaultSeverity: 'warn',
    check: (element: EnhancedElement, _context: RuleContext): Violation | null => {
      const style = element.computedStyles;
      if (!style) return null;

      const offGridValues: Array<{ property: string; value: string }> = [];

      for (const prop of SPACING_PROPERTIES) {
        const raw = style[prop];
        if (!raw) continue;

        // Shorthand may contain multiple values
        const isShorthand = prop === 'padding' || prop === 'margin';
        if (isShorthand) {
          const values = parseSpacingShorthand(raw);
          for (const v of values) {
            if (!isOnGrid(v)) {
              offGridValues.push({ property: prop, value: raw });
              break; // one violation per property is enough
            }
          }
        } else {
          const px = parsePxValue(raw);
          if (px !== null && !isOnGrid(px)) {
            offGridValues.push({ property: prop, value: raw });
          }
        }
      }

      if (offGridValues.length === 0) return null;

      const detail = offGridValues.map(v => `${v.property}: ${v.value}`).join(', ');
      const label = element.text?.slice(0, 30) || element.selector;

      return {
        ruleId: 'spacing-grid/off-grid',
        ruleName: 'Spacing Grid: Off 8pt Grid',
        severity: 'warn',
        message: `"${label}" has off-grid spacing: ${detail}`,
        element: element.selector,
        bounds: element.bounds,
        fix: 'Use spacing values that are multiples of 4px (e.g., 4, 8, 12, 16, 20, 24, 32px)',
      };
    },
  },
];
