import type { Rule } from '../../rules/engine.js';
import type { EnhancedElement, Violation } from '../../schemas.js';

export const hickRules: Rule[] = [
  {
    id: 'calm-precision/hick-choice-count',
    name: "Hick's Law: Choice Count",
    description: 'Limit visible choices to reduce decision time',
    defaultSeverity: 'warn',
    check: (element: EnhancedElement, context): Violation | null => {
      // Only check interactive elements
      if (!element.interactive?.hasOnClick && !element.interactive?.hasHref) return null;

      // Find interactive siblings at similar vertical position (within 20px band)
      const y = element.bounds?.y || 0;
      const siblings = context.allElements.filter(el => {
        if (!el.interactive?.hasOnClick && !el.interactive?.hasHref) return false;
        const elY = el.bounds?.y || 0;
        return Math.abs(elY - y) < 20;
      });

      // Only flag if this is the first element in the group (avoid duplicate reports)
      if (siblings.length > 7 && siblings[0]?.selector === element.selector) {
        return {
          ruleId: 'calm-precision/hick-choice-count',
          ruleName: "Hick's Law: Choice Count",
          severity: 'warn',
          message: `${siblings.length} interactive elements in one visual row. Consider progressive disclosure (max 5-7 visible).`,
          element: element.selector,
          bounds: element.bounds,
          fix: 'Group less-used options behind a "More" menu or overflow. Show max 5-7 choices at once.',
        };
      }
      return null;
    },
  },
];
