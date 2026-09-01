import type { Rule } from '../../rules/types.js';
import type { EnhancedElement, Violation } from '../../schemas.js';
import { resolveBorderPresence, unmeasuredStyleViolation } from '../../rules/style-read.js';

/*
 * THIS RULE GRADED NOTHING FOR AS LONG AS IT SHIPPED.
 *
 * It read `style.border` and `style['border-width']`. The extractors captured
 * neither — `src/extract.ts` populated exactly eight properties, and none of
 * them was a border — so `hasBorder` and `hasBorderWidth` were `undefined` on
 * every element of every page. The guard was permanently falsy, the rule
 * returned null every time, and `calm-precision/gestalt-grouping` reported a
 * clean result while measuring nothing. It is a CORE principle defaulting to
 * `error`, which is the worst place for a silent no-op to hide.
 *
 * Proven by planted defect: a page with `<li style="border:2px solid red">`
 * produced no finding from this rule through the installed binary.
 *
 * Two bugs sat behind the first one, and both would have bitten the moment
 * anyone "fixed" the capture list alone:
 *
 *   1. `border-width` is kebab-case. Every captured key is camelCase, so even
 *      with a border captured, that read would still have missed.
 *   2. `style.border !== 'none' && style.border !== '0px'` is inverted in
 *      practice. `getComputedStyle(el).border` on an element with NO border
 *      returns `"0px none rgb(0, 0, 0)"`, which is neither `'none'` nor
 *      `'0px'` — so the test would have been TRUE for every element on the
 *      page, turning a rule that found nothing into one that flagged
 *      everything. Border presence is now decided from the four width
 *      longhands plus `border-style`, in `resolveBorderPresence`.
 *
 * SILENCE IS THE FAILURE MODE: when the border cannot be read, this rule now
 * says so rather than returning null and reading as a pass.
 */

export const gestaltRules: Rule[] = [
  {
    id: 'calm-precision/gestalt-grouping',
    name: 'Gestalt: Border Grouping',
    description: 'Related items should be grouped with a single border, not individually bordered',
    defaultSeverity: 'error',
    // List items are page CONTENT, not controls. Left on the default
    // `interactive` surface this rule only ever saw buttons and links — an
    // `<li>` never reached it even once the styles existed.
    appliesTo: 'any',
    check: (element: EnhancedElement, _context): Violation | null => {
      const isListItem = element.tagName === 'li' ||
        (element.selector?.includes('item') && !element.selector?.includes('item-'));

      // Not-applicable, genuinely: a paragraph is not a list item, and no
      // border reading would change that. Checked BEFORE the style read so a
      // page of ordinary prose does not emit a measurement warning per element.
      if (!isListItem) return null;

      const border = resolveBorderPresence(element);
      if (border.status === 'unmeasured') {
        return unmeasuredStyleViolation(
          element,
          'calm-precision/gestalt-grouping',
          'Gestalt: Border Grouping',
          border.unmeasured,
        );
      }

      if (!border.hasBorder) return null;

      return {
        ruleId: 'calm-precision/gestalt-grouping',
        ruleName: 'Gestalt: Border Grouping',
        severity: 'error',
        message: `List item "${(element.text || '').slice(0, 40)}" has individual border (${border.widths.map((w) => `${w}px`).join(' ')}). Group related items with a single container border.`,
        element: element.selector,
        bounds: element.bounds,
        fix: 'Use single border around the group container with dividers between items, not individual item borders.',
      };
    },
  },
];
