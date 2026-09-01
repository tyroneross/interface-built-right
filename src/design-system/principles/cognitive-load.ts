import type { Rule } from '../../rules/types.js';
import type { EnhancedElement, Violation } from '../../schemas.js';

/*
 * THIS RULE RETURNED NULL ON EVERY ELEMENT OF EVERY SCAN.
 *
 * Its first line skips anything interactive, because it grades CONTAINERS.
 * But it carried no `appliesTo`, which defaults to `'interactive'`, so the
 * only elements ever passed to it were interactive ones — every call hit the
 * skip on line one. A rule that grades containers was shown nothing but
 * controls.
 *
 * Proven by planted defect: a `<div>` holding twelve buttons produced no
 * finding through the installed binary, because the `<div>` was never in the
 * population and the twelve buttons each returned null immediately.
 *
 * Two changes make it able to fire: `appliesTo: 'any'` puts it on the content
 * surface, and `src/scan.ts` now runs a container pass over the landmark and
 * wrapper elements the sensor extractor was already collecting.
 */

export const cognitiveLoadRules: Rule[] = [
  {
    id: 'calm-precision/cognitive-load-elements',
    name: 'Cognitive Load: Element Count',
    description: 'Visual groups should have 5-7 items max to stay within working memory limits',
    defaultSeverity: 'warn',
    appliesTo: 'any',
    check: (element: EnhancedElement, context): Violation | null => {
      // Genuinely not-applicable: a control is not a container of controls.
      if (element.interactive?.hasOnClick || element.interactive?.hasHref) return null;

      if (!element.bounds) return null;
      const { x, y, width, height } = element.bounds;
      // A collapsed box contains nothing a reader can see. Not a measurement
      // failure — there is no group here to grade.
      if (width <= 0 || height <= 0) return null;

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
