import type { Rule } from '../../rules/engine.js';
import type { EnhancedElement, Violation } from '../../schemas.js';

export const contentChromeRules: Rule[] = [
  {
    id: 'calm-precision/content-chrome-ratio',
    name: 'Content >= Chrome',
    description: 'Content area should be at least 70% of the viewport',
    defaultSeverity: 'warn',
    check: (element: EnhancedElement, context): Violation | null => {
      // Page-level check — only run once (first element)
      if (context.allElements[0]?.selector !== element.selector) return null;

      const viewportArea = context.viewportWidth * context.viewportHeight;
      if (viewportArea === 0) return null;

      // Estimate chrome area: nav, header, footer, sidebar elements
      const chromeSelectors = /\b(nav|header|footer|sidebar|toolbar|menu|breadcrumb|tabs)\b/i;
      let chromeArea = 0;

      for (const el of context.allElements) {
        const isChrome = chromeSelectors.test(el.tagName) ||
          chromeSelectors.test(el.selector || '') ||
          chromeSelectors.test(el.a11y?.role || '');

        if (isChrome && el.bounds) {
          chromeArea += el.bounds.width * el.bounds.height;
        }
      }

      const chromePercent = (chromeArea / viewportArea) * 100;

      if (chromePercent > 30) {
        return {
          ruleId: 'calm-precision/content-chrome-ratio',
          ruleName: 'Content >= Chrome',
          severity: 'warn',
          message: `Chrome elements occupy ~${Math.round(chromePercent)}% of viewport. Content should be >= 70%.`,
          fix: 'Reduce navigation/toolbar/sidebar chrome. Consider collapsible panels or minimized navigation.',
        };
      }
      return null;
    },
  },
];
