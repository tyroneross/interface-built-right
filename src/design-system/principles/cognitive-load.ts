import type { Rule } from '../../rules/engine.js';
import type { EnhancedElement, Violation } from '../../schemas.js';

export const cognitiveLoadRules: Rule[] = [
  {
    id: 'calm-precision/cognitive-load-elements',
    name: 'Cognitive Load: Element Count',
    description: 'Visual groups should have 5-7 items max to stay within working memory limits',
    defaultSeverity: 'warn',
    check: (element: EnhancedElement, context): Violation | null => {
      // Only check container-like elements (not interactive ones)
      if (element.interactive?.hasOnClick || element.interactive?.hasHref) return null;

      // Check if this element contains many interactive children (by bounds containment)
      if (!element.bounds) return null;
      const { x, y, width, height } = element.bounds;

      const children = context.allElements.filter(el => {
        if (el.selector === element.selector) return false;
        if (!el.interactive?.hasOnClick && !el.interactive?.hasHref) return false;
        if (!el.bounds) return false;
        return el.bounds.x >= x && el.bounds.y >= y &&
               el.bounds.x + el.bounds.width <= x + width &&
               el.bounds.y + el.bounds.height <= y + height;
      });

      if (children.length > 10) {
        return {
          ruleId: 'calm-precision/cognitive-load-elements',
          ruleName: 'Cognitive Load: Element Count',
          severity: 'warn',
          message: `Container has ${children.length} interactive elements. Consider grouping or progressive disclosure (5-7 max per group).`,
          element: element.selector,
          bounds: element.bounds,
          fix: 'Group related actions. Use sections, tabs, or "Show more" to reduce visible elements per group.',
        };
      }
      return null;
    },
  },
];
