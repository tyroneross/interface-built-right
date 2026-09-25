import type { Rule } from '../../rules/types.js';
import type { EnhancedElement, Violation } from '../../schemas.js';
import { isVisibleInteractive } from './visibility.js';

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

/*
 * COUNT CONTROLS PER GROUP, NOT PER BOUNDING BOX.
 *
 * The container pass used to count every visible control inside a
 * container's rectangle. `<main>` therefore absorbed the controls of every
 * `<section>` inside it — "Container has 25 interactive elements" on a page
 * whose sections each held five. Splitting controls into sections is the
 * remedy this rule recommends, so a page that had already done it still
 * failed.
 *
 * A control now belongs to the NEAREST grouping container that holds it. A
 * container is graded on the controls it owns directly: those not inside any
 * grouping container nested within it. Non-grouping wrappers (`<main>`, a
 * generic `<div>`) are graded the same way, so they only count controls no
 * nested group claimed.
 *
 * `src/scan.ts` computes that ownership from the live DOM and attaches it as
 * `controlGroup` (see `ControlGroupFacts`). Without it — unit callers, the
 * design-system checker — the rule falls back to bounds containment, removing
 * controls that sit inside a nested grouping element found in `allElements`.
 */

/** Tags that form a visual/semantic group of controls. `main` is deliberately absent. */
export const GROUPING_TAGS: readonly string[] = [
  'section', 'article', 'aside', 'header', 'footer', 'nav', 'form', 'fieldset',
  'ul', 'ol', 'menu', 'dialog', 'details', 'table', 'tr',
];

/** ARIA roles that form a group of controls. */
export const GROUPING_ROLES: readonly string[] = [
  'group', 'radiogroup', 'toolbar', 'menu', 'menubar', 'listbox', 'tablist',
  'list', 'grid', 'row', 'dialog', 'alertdialog', 'navigation', 'region', 'form',
  'banner', 'contentinfo', 'complementary',
];

const GROUPING_TAG_SET: ReadonlySet<string> = new Set(GROUPING_TAGS);
const GROUPING_ROLE_SET: ReadonlySet<string> = new Set(GROUPING_ROLES);

/** Live-DOM ownership facts attached by the scan's container pass. */
export interface ControlGroupFacts {
  /** Visible controls whose nearest grouping container (within this one) is this one. */
  ownedControls: number;
  /** Selectors of those controls, capped for output size. */
  controlSelectors: string[];
}

export type ControlGroupElement = EnhancedElement & { controlGroup?: ControlGroupFacts };

export const MAX_CONTROLS_PER_GROUP = 10;

export function isGroupingElement(el: EnhancedElement): boolean {
  const role = (el.a11y?.role || '').toLowerCase();
  if (role && GROUPING_ROLE_SET.has(role)) return true;
  return GROUPING_TAG_SET.has((el.tagName || '').toLowerCase());
}

function within(inner: EnhancedElement['bounds'], outer: EnhancedElement['bounds']): boolean {
  return inner.x >= outer.x && inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height;
}

/** Bounds-only approximation of ownership, used when no DOM facts are attached. */
function ownedByBounds(element: EnhancedElement, all: EnhancedElement[]): string[] {
  const box = element.bounds;
  const nestedGroups = all.filter((g) =>
    g !== element &&
    g.selector !== element.selector &&
    isGroupingElement(g) &&
    g.bounds && g.bounds.width > 0 && g.bounds.height > 0 &&
    // Inclusive: a group with the container's exact box is its only child
    // region, and it claims its controls just the same.
    within(g.bounds, box),
  );
  return all
    .filter((el) => {
      if (el.selector === element.selector) return false;
      if (!isVisibleInteractive(el)) return false;
      if (!within(el.bounds, box)) return false;
      return !nestedGroups.some((g) => g.selector !== el.selector && within(el.bounds, g.bounds));
    })
    .map((el) => el.selector);
}

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
      const { width, height } = element.bounds;
      // A collapsed box contains nothing a reader can see. Not a measurement
      // failure — there is no group here to grade.
      if (width <= 0 || height <= 0) return null;

      const facts = (element as ControlGroupElement).controlGroup;
      const owned = facts
        ? { count: facts.ownedControls, selectors: facts.controlSelectors }
        : (() => {
            const sel = ownedByBounds(element, context.allElements);
            return { count: sel.length, selectors: sel };
          })();

      if (owned.count > MAX_CONTROLS_PER_GROUP) {
        const shown = owned.selectors.slice(0, 5);
        const more = owned.count - shown.length;
        return {
          ruleId: 'calm-precision/cognitive-load-elements',
          ruleName: 'Cognitive Load: Element Count',
          severity: 'warn',
          message: `Group <${element.tagName}> holds ${owned.count} visible controls directly (controls inside nested sections, lists, fieldsets or groups not counted): ${shown.join(', ')}${more > 0 ? ` +${more} more` : ''}. Consider grouping or progressive disclosure (5-7 max per group).`,
          element: element.selector,
          bounds: element.bounds,
          fix: 'Split these controls into labelled sub-groups (fieldset, list, role="group"), or move secondary ones behind "Show more".',
        };
      }
      return null;
    },
  },
];
