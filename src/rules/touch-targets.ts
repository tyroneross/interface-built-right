import type { Rule, RuleContext } from './engine.js';
import type { EnhancedElement, Violation } from '../schemas.js';

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

function isInteractiveElement(element: EnhancedElement): boolean {
  if (INTERACTIVE_TAGS.has(element.tagName.toLowerCase())) return true;
  const role = element.a11y?.role;
  if (role && INTERACTIVE_ROLES.has(role)) return true;
  return false;
}

export const touchTargetRules: Rule[] = [
  {
    id: 'touch-targets/minimum-size',
    name: 'Touch Target: Minimum Size',
    description: 'Interactive elements must meet minimum touch target size (44x44px mobile, 24x24px desktop)',
    defaultSeverity: 'warn',
    check: (element: EnhancedElement, context: RuleContext, options?: Record<string, unknown>): Violation | null => {
      if (!isInteractiveElement(element)) return null;

      // Use viewport width to determine mobile vs desktop (< 768px = mobile)
      const isMobile = context.isMobile || context.viewportWidth < 768;
      const minSize = isMobile
        ? (options?.mobileMinSize as number) ?? 44
        : (options?.desktopMinSize as number) ?? 24;

      const { width, height } = element.bounds;

      // Skip zero-size elements (hidden / not rendered)
      if (width === 0 && height === 0) return null;

      if (width < minSize || height < minSize) {
        const label = element.text || element.a11y?.ariaLabel || element.selector;
        return {
          ruleId: 'touch-targets/minimum-size',
          ruleName: 'Touch Target: Minimum Size',
          severity: 'warn',
          message: `"${label.slice(0, 40)}" touch target is ${width}x${height}px (minimum ${minSize}x${minSize}px on ${isMobile ? 'mobile' : 'desktop'})`,
          element: element.selector,
          bounds: element.bounds,
          fix: `Increase element size to at least ${minSize}x${minSize}px`,
        };
      }

      return null;
    },
  },
];
