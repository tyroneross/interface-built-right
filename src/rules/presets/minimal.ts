import { registerPreset, type Rule, type RuleContext, type RulePreset } from '../engine.js';
import type { EnhancedElement, Violation } from '../../schemas.js';

/**
 * An element is treated as "not present to the user" when its layout box has
 * collapsed to zero. This catches the most common false-positive class for the
 * minimal preset: responsive toggles (`.show-mobile` / `.hidden-mobile`) that
 * keep the element in the DOM but hide it via `display:none` in the off-active
 * viewport, which produces a {0,0,0,0} bounding box. Such elements are not
 * tappable, not visible, and shouldn't be graded against handler / touch-target
 * / a11y-label rules in the active viewport.
 *
 * `visibility:hidden` and `opacity:0` deliberately are NOT filtered here —
 * those preserve layout, the element is still in the tab order, and the rule
 * should fire (the author probably forgot to remove it).
 */
export function isLayoutCollapsed(element: EnhancedElement): boolean {
  return element.bounds.width === 0 && element.bounds.height === 0;
}

/**
 * `aria-haspopup` (any of `menu | listbox | tree | grid | dialog | true`)
 * indicates the element opens a popup. Headless component libraries
 * (Radix, Headless UI, Reach UI, Ariakit) wire the click via portal /
 * event delegation rather than a direct `onClick` prop, which the
 * `no-handler` heuristic doesn't see. Treating any element with a
 * non-null aria-haspopup as "wired by intent" stops the rule from
 * flagging library-managed popup triggers as orphans.
 *
 * Conservative: aria-haspopup="false" is treated as no popup (per spec)
 * and the rule still grades the element normally.
 */
export function hasPopupTrigger(element: EnhancedElement): boolean {
  const v = element.a11y.ariaHaspopup;
  if (!v) return false;
  return v !== 'false';
}

/**
 * A `<button>` inside a `<form>` defaults to `type="submit"` and submits the
 * form on click — the form's onSubmit handler is the wired path, not the
 * button's onClick. Treat such buttons as wired-by-form unless their type is
 * explicitly `"button"` (which opts out of the submit pipeline and so does
 * need its own onClick).
 *
 * Buttons OUTSIDE a form are still graded normally — there's no form pipeline
 * to wire them.
 */
export function isFormSubmitButton(element: EnhancedElement): boolean {
  if (element.tagName !== 'button') return false;
  if (!element.inForm) return false;
  // Default type for a <button> in a <form> is "submit".
  // Only opt-out when type is explicitly "button" (or "reset").
  const t = element.buttonType;
  return t == null || t === 'submit' || t === '';
}

/**
 * Rule: Buttons must have click handlers
 */
const noHandlerRule: Rule = {
  id: 'no-handler',
  name: 'No Click Handler',
  description: 'Interactive elements like buttons must have click handlers',
  defaultSeverity: 'error',
  check: (element: EnhancedElement, _context: RuleContext): Violation | null => {
    if (isLayoutCollapsed(element)) return null;
    if (hasPopupTrigger(element)) return null;
    if (isFormSubmitButton(element)) return null;
    const isButton = element.tagName === 'button' || element.a11y.role === 'button';
    const isDisabled = element.interactive.isDisabled;
    const hasHandler = element.interactive.hasOnClick;

    if (isButton && !isDisabled && !hasHandler) {
      return {
        ruleId: 'no-handler',
        ruleName: 'No Click Handler',
        severity: 'error',
        message: `Button "${element.text || element.selector}" has no click handler`,
        element: element.selector,
        bounds: element.bounds,
        fix: 'Add an onClick handler or make the button disabled',
      };
    }

    return null;
  },
};

/**
 * Rule: Links must have valid hrefs or handlers
 */
const placeholderLinkRule: Rule = {
  id: 'placeholder-link',
  name: 'Placeholder Link',
  description: 'Links must have valid hrefs or click handlers',
  defaultSeverity: 'error',
  check: (element: EnhancedElement, _context: RuleContext): Violation | null => {
    if (isLayoutCollapsed(element)) return null;
    const isLink = element.tagName === 'a';
    const hasValidHref = element.interactive.hasHref;
    const hasHandler = element.interactive.hasOnClick;

    if (isLink && !hasValidHref && !hasHandler) {
      return {
        ruleId: 'placeholder-link',
        ruleName: 'Placeholder Link',
        severity: 'error',
        message: `Link "${element.text || element.selector}" has placeholder href and no handler`,
        element: element.selector,
        bounds: element.bounds,
        fix: 'Add a valid href or onClick handler',
      };
    }

    return null;
  },
};

/**
 * Rule: Touch targets must be minimum size
 */
const touchTargetRule: Rule = {
  id: 'touch-target-small',
  name: 'Touch Target Too Small',
  description: 'Interactive elements must meet minimum touch target size',
  defaultSeverity: 'warn',
  check: (element: EnhancedElement, context: RuleContext, options?: Record<string, unknown>): Violation | null => {
    if (isLayoutCollapsed(element)) return null;
    const isInteractive = element.interactive.hasOnClick || element.interactive.hasHref;
    if (!isInteractive) return null;

    const minSize = context.isMobile
      ? (options?.mobileMinSize as number) ?? 44
      : (options?.desktopMinSize as number) ?? 24;

    const { width, height } = element.bounds;

    if (width < minSize || height < minSize) {
      return {
        ruleId: 'touch-target-small',
        ruleName: 'Touch Target Too Small',
        severity: 'warn',
        message: `"${element.text || element.selector}" touch target is ${width}x${height}px (min: ${minSize}px)`,
        element: element.selector,
        bounds: element.bounds,
        fix: `Increase element size to at least ${minSize}x${minSize}px`,
      };
    }

    return null;
  },
};

/**
 * Rule: Interactive elements need accessible labels
 */
const missingAriaLabelRule: Rule = {
  id: 'missing-aria-label',
  name: 'Missing Accessible Label',
  description: 'Interactive elements without text need aria-label',
  defaultSeverity: 'warn',
  check: (element: EnhancedElement, _context: RuleContext): Violation | null => {
    if (isLayoutCollapsed(element)) return null;
    const isInteractive = element.interactive.hasOnClick || element.interactive.hasHref;
    if (!isInteractive) return null;

    const hasText = element.text && element.text.trim().length > 0;
    const hasAriaLabel = element.a11y.ariaLabel && element.a11y.ariaLabel.trim().length > 0;

    if (!hasText && !hasAriaLabel) {
      return {
        ruleId: 'missing-aria-label',
        ruleName: 'Missing Accessible Label',
        severity: 'warn',
        message: `"${element.selector}" is interactive but has no text or aria-label`,
        element: element.selector,
        bounds: element.bounds,
        fix: 'Add visible text or aria-label attribute',
      };
    }

    return null;
  },
};

/**
 * Rule: Disabled elements should look disabled
 */
const disabledNoVisualRule: Rule = {
  id: 'disabled-no-visual',
  name: 'Disabled Without Visual',
  description: 'Disabled elements should have visual indication',
  defaultSeverity: 'warn',
  check: (element: EnhancedElement, _context: RuleContext): Violation | null => {
    if (!element.interactive.isDisabled) return null;

    const cursor = element.interactive.cursor;
    const hasDisabledCursor = cursor === 'not-allowed' || cursor === 'default';

    // Check for visual indication via computed styles
    const bgColor = element.computedStyles?.backgroundColor as string | undefined;
    const hasGrayedBg = bgColor?.includes('gray') || bgColor?.includes('rgb(200') || bgColor?.includes('rgb(220');

    if (!hasDisabledCursor && !hasGrayedBg) {
      return {
        ruleId: 'disabled-no-visual',
        ruleName: 'Disabled Without Visual',
        severity: 'warn',
        message: `"${element.text || element.selector}" is disabled but has no visual indication`,
        element: element.selector,
        bounds: element.bounds,
        fix: 'Add cursor: not-allowed and/or gray background to disabled state',
      };
    }

    return null;
  },
};

/**
 * Minimal preset - basic interactivity checks
 */
const minimalPreset: RulePreset = {
  name: 'minimal',
  description: 'Basic interactivity and accessibility checks',
  rules: [
    noHandlerRule,
    placeholderLinkRule,
    touchTargetRule,
    missingAriaLabelRule,
    disabledNoVisualRule,
  ],
  defaults: {
    'no-handler': 'error',
    'placeholder-link': 'error',
    'touch-target-small': 'warn',
    'missing-aria-label': 'warn',
    'disabled-no-visual': 'warn',
  },
};

/**
 * Register the minimal preset
 */
export function register(): void {
  registerPreset(minimalPreset);
}

// Export rules for testing
export const rules = {
  noHandlerRule,
  placeholderLinkRule,
  touchTargetRule,
  missingAriaLabelRule,
  disabledNoVisualRule,
};
