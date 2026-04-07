import type { Rule } from '../../rules/engine.js';
import type { EnhancedElement, Violation } from '../../schemas.js';

export const fittsRules: Rule[] = [
  {
    id: 'calm-precision/fitts-button-sizing',
    name: "Fitts' Law: Button Sizing",
    description: 'Primary action buttons should be prominently sized',
    defaultSeverity: 'warn',
    check: (element: EnhancedElement, _context): Violation | null => {
      if (element.tagName !== 'button' && element.a11y?.role !== 'button') return null;

      const text = (element.text || '').toLowerCase();
      const isPrimary = /\b(submit|save|confirm|checkout|buy|sign.?up|log.?in|register|continue|create|publish|send)\b/i.test(text);

      if (!isPrimary) return null;

      const width = element.bounds?.width || 0;
      if (width > 0 && width < 120) {
        return {
          ruleId: 'calm-precision/fitts-button-sizing',
          ruleName: "Fitts' Law: Button Sizing",
          severity: 'warn',
          message: `Primary action "${text.slice(0, 30)}" is ${width}px wide. Primary actions should be more prominent.`,
          element: element.selector,
          bounds: element.bounds,
          fix: 'Increase button width. Primary actions should be the most prominent interactive element.',
        };
      }
      return null;
    },
  },
];
