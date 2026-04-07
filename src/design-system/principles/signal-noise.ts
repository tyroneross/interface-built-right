import type { Rule } from '../../rules/engine.js';
import type { EnhancedElement, Violation } from '../../schemas.js';

export const signalNoiseRules: Rule[] = [
  {
    id: 'calm-precision/signal-noise-status',
    name: 'Signal-to-Noise: Status Indication',
    description: 'Status should use text color only, not background badges',
    defaultSeverity: 'error',
    check: (element: EnhancedElement, _context): Violation | null => {
      const style = element.computedStyles;
      if (!style) return null;

      const text = (element.text || '').toLowerCase();
      const isStatus = /\b(success|error|warning|pending|active|inactive|status|failed|completed|approved|rejected)\b/i.test(text);

      if (!isStatus) return null;

      const bg = style.backgroundColor || style['background-color'];
      if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') return null;

      // Allow very subtle backgrounds (opacity < 0.15)
      const subtleMatch = bg.match(/rgba?\([^)]*,\s*(0\.(?:0[0-9]|1[0-4]))\)/);
      if (subtleMatch) return null;

      return {
        ruleId: 'calm-precision/signal-noise-status',
        ruleName: 'Signal-to-Noise: Status Indication',
        severity: 'error',
        message: `Status element "${text.slice(0, 30)}" has heavy background (${bg}). Use text color only for status.`,
        element: element.selector,
        bounds: element.bounds,
        fix: 'Remove background color. Use text color (green for success, red for error, yellow for warning) instead of background badges.',
      };
    },
  },
];
