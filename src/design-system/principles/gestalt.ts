import type { Rule } from '../../rules/engine.js';
import type { EnhancedElement, Violation } from '../../schemas.js';

export const gestaltRules: Rule[] = [
  {
    id: 'calm-precision/gestalt-grouping',
    name: 'Gestalt: Border Grouping',
    description: 'Related items should be grouped with a single border, not individually bordered',
    defaultSeverity: 'error',
    check: (element: EnhancedElement, _context): Violation | null => {
      const style = element.computedStyles;
      if (!style) return null;

      const hasBorder = style.border && style.border !== 'none' && style.border !== '0px';
      const borderWidth = style['border-width'];
      const hasBorderWidth = borderWidth && borderWidth !== '0px';

      const isListItem = element.tagName === 'li' ||
        (element.selector?.includes('item') && !element.selector?.includes('item-'));

      if ((hasBorder || hasBorderWidth) && isListItem) {
        return {
          ruleId: 'calm-precision/gestalt-grouping',
          ruleName: 'Gestalt: Border Grouping',
          severity: 'error',
          message: `List item "${(element.text || '').slice(0, 40)}" has individual border. Group related items with a single container border.`,
          element: element.selector,
          bounds: element.bounds,
          fix: 'Use single border around the group container with dividers between items, not individual item borders.',
        };
      }
      return null;
    },
  },
];
