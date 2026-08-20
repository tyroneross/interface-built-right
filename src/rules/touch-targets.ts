import type { Rule, RuleContext } from './types.js';
import type { EnhancedElement, Violation } from '../schemas.js';
import { evaluateTargetSize, tallyTargetExemptions } from './target-sizing.js';
import type { TargetExemptionKind } from './target-sizing.js';

/**
 * ARIA roles that indicate an element is interactive.
 */
const INTERACTIVE_ROLES = new Set([
  'button',
  'link',
  'textbox',
  'checkbox',
  'radio',
  'combobox',
  'listbox',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'searchbox',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'treeitem',
]);

/**
 * HTML tags that are inherently interactive.
 */
const INTERACTIVE_TAGS = new Set(['button', 'a', 'input', 'select', 'textarea']);

export function isInteractiveElement(element: EnhancedElement): boolean {
  if (INTERACTIVE_TAGS.has(element.tagName.toLowerCase())) return true;
  const role = element.a11y?.role;
  if (role && INTERACTIVE_ROLES.has(role)) return true;
  return false;
}

/**
 * Returns true when the element should be excluded from the touch-target audit.
 * Matches the guard pattern used in src/responsive.ts:
 *   display:none, visibility:hidden, opacity:0, zero/negative area in either
 *   dimension, or aria-hidden (own attribute or an ancestor's — see
 *   `a11y.ariaHidden` in src/extract.ts, which now walks up via `closest()`).
 * An aria-hidden element is unreachable to assistive tech regardless of its
 * visual box, so grading its pixel size against the touch-target minimum is
 * meaningless — it can never be the thing an AT user "taps".
 */
function isNonVisibleOrZeroArea(element: EnhancedElement): boolean {
  if (element.computedStyles?.display === 'none') return true;
  if (element.computedStyles?.visibility === 'hidden') return true;
  if (element.computedStyles?.opacity === '0') return true;
  if (element.a11y?.ariaHidden) return true;
  if (element.bounds.width <= 0) return true;
  if (element.bounds.height <= 0) return true;
  return false;
}

/**
 * Minimum target size for this context, in CSS px. Mobile is decided by the
 * context flag OR a sub-768px viewport. Exported so callers that need to
 * reason about exemptions (src/ask.ts) derive the threshold the same way the
 * rule does, rather than re-deriving it and drifting.
 */
export function minTargetSize(context: RuleContext, options?: Record<string, unknown>): number {
  const isMobile = context.isMobile || context.viewportWidth < 768;
  return isMobile
    ? (options?.mobileMinSize as number) ?? 44
    : (options?.desktopMinSize as number) ?? 24;
}

/**
 * True when this element is one the size rule grades at all — interactive,
 * visible, and non-degenerate. Exported so exemption accounting counts the
 * same population the rule walks.
 */
export function isGradableTarget(element: EnhancedElement): boolean {
  return isInteractiveElement(element) && !isNonVisibleOrZeroArea(element);
}

/**
 * How many findings the WCAG-inline and label-hit-area policies suppressed
 * across `elements`. Callers surface these counts so the two exemptions stay
 * auditable — a gate that silently drops findings is the failure mode this
 * rule already hit once.
 */
export function tallyTouchTargetExemptions(
  elements: EnhancedElement[],
  context: RuleContext,
  options?: Record<string, unknown>,
): Partial<Record<TargetExemptionKind, number>> {
  return tallyTargetExemptions(elements.filter(isGradableTarget), minTargetSize(context, options));
}

export const touchTargetRules: Rule[] = [
  {
    id: 'touch-targets/minimum-size',
    name: 'Touch Target: Minimum Size',
    description: 'Interactive elements must meet minimum touch target size (44x44px mobile, 24x24px desktop)',
    defaultSeverity: 'warn',
    check: (element: EnhancedElement, context: RuleContext, options?: Record<string, unknown>): Violation | null => {
      if (!isInteractiveElement(element)) return null;

      const isMobile = context.isMobile || context.viewportWidth < 768;
      const minSize = minTargetSize(context, options);

      // Skip non-visible elements (display:none, visibility:hidden, opacity:0)
      // and elements with zero or negative area in either dimension.
      if (isNonVisibleOrZeroArea(element)) return null;

      // Grade the REAL activation rect, and skip targets WCAG exempts —
      // an inline link in a sentence, or a hidden control whose <label>
      // supplies the hit area. See src/rules/target-sizing.ts.
      const { bounds, violates } = evaluateTargetSize(element, minSize);
      if (!violates) return null;

      const label = element.text || element.a11y?.ariaLabel || element.selector;
      return {
        ruleId: 'touch-targets/minimum-size',
        ruleName: 'Touch Target: Minimum Size',
        severity: 'warn',
        message: `"${label.slice(0, 40)}" touch target is ${bounds.width}x${bounds.height}px (minimum ${minSize}x${minSize}px on ${isMobile ? 'mobile' : 'desktop'})`,
        element: element.selector,
        bounds,
        fix: `Increase element size to at least ${minSize}x${minSize}px`,
      };
    },
  },
];
