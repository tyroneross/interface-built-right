import { registerPreset, type Rule, type RuleContext, type RulePreset } from '../engine.js';
import type { EnhancedElement, Violation } from '../../schemas.js';

/**
 * Rule: Buttons must have click handlers
 */
const noHandlerRule: Rule = {
  id: 'no-handler',
  name: 'No Click Handler',
  description: 'Interactive elements like buttons must have click handlers',
  defaultSeverity: 'error',
  check: (element: EnhancedElement, _context: RuleContext): Violation | null => {
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
    const bgColor = element.computedStyles?.backgroundColor;
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
