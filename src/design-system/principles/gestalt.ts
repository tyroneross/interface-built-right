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

/*
 * WHAT COUNTS AS A LIST ITEM, AND WHAT COUNTS AS BOXING IT.
 *
 * The first version of the item test was `selector.includes('item')` — a
 * substring of the FULL ancestor path. A filled `<button>` inside a
 * `div.run-item` therefore qualified as a "list item", and so did every
 * control anywhere under a `.menu-items` wrapper. The border test was "any
 * nonzero width on any side", so a one-sided divider — `border-bottom: 1px`
 * between rows of a single bordered group, which is exactly the pattern
 * Calm Precision prescribes — fired as an error. Pages that FOLLOWED the rule
 * failed it, which teaches an agent to ignore the rule.
 *
 * Now:
 *   - Item-ness is a property of the element itself: `<li>`,
 *     `role="listitem"`, or one of its OWN class tokens being `item`,
 *     `list-item`, or `<something>-item`. Never a substring of an ancestor.
 *   - Controls (button, input, select, textarea, summary, role=button) are not
 *     list items, whatever their class says. A link styled as a row (`a.list-item`)
 *     still is: a clickable row is a list item.
 *   - Boxing means three or more painted sides. One side is a divider; two
 *     sides (typically top + bottom) are still dividers, just drawn by the
 *     item instead of its neighbour. Three or four sides draw a box around
 *     each item, which is the defect.
 */

const ITEM_CLASS_TOKEN = /^(item|list-item|[a-z0-9_-]+(-|__)item)$/i;
const CONTROL_TAGS: ReadonlySet<string> = new Set(['button', 'input', 'select', 'textarea', 'summary', 'option']);
const CONTROL_ROLES: ReadonlySet<string> = new Set(['button', 'checkbox', 'radio', 'switch', 'tab', 'menuitem', 'slider', 'textbox', 'combobox']);

/** Is THIS element an item in a list — judged on the element, not its ancestors? */
export function isListItemElement(element: EnhancedElement): boolean {
  const tag = (element.tagName || '').toLowerCase();
  const role = (element.a11y?.role || '').toLowerCase();
  if (CONTROL_TAGS.has(tag) || CONTROL_ROLES.has(role)) return false;
  if (tag === 'li' || role === 'listitem') return true;
  const tokens = (element.className || '').split(/\s+/).filter(Boolean);
  return tokens.some((t) => ITEM_CLASS_TOKEN.test(t));
}

/** Minimum painted sides that turn a border into a box around the item. */
export const BOXED_MIN_SIDES = 3;

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
      // Not-applicable, genuinely: a paragraph is not a list item, and no
      // border reading would change that. Checked BEFORE the style read so a
      // page of ordinary prose does not emit a measurement warning per element.
      if (!isListItemElement(element)) return null;

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

      // One or two painted sides are dividers — the prescribed pattern.
      const paintedSides = border.widths.filter((w) => w > 0).length;
      if (paintedSides < BOXED_MIN_SIDES) return null;

      return {
        ruleId: 'calm-precision/gestalt-grouping',
        ruleName: 'Gestalt: Border Grouping',
        severity: 'error',
        message: `List item "${(element.text || '').slice(0, 40)}" is individually boxed (${paintedSides}-sided border: ${border.widths.map((w) => `${w}px`).join(' ')}). Group related items with a single container border.`,
        element: element.selector,
        bounds: element.bounds,
        fix: 'Put one border around the group container and separate items with one-sided dividers (e.g. border-top), not a box per item.',
      };
    },
  },
];
