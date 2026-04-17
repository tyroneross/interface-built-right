import { registerPreset, type Rule, type RuleContext } from '../engine.js';
import type { EnhancedElement, Violation, RuleSetting } from '../../schemas.js';

/**
 * Determine whether an element is likely interactive (tappable/clickable).
 * Checks ARIA role, tag name, and framework handler detection.
 */
function isInteractive(el: EnhancedElement): boolean {
  const role = el.a11y.role ?? '';
  const tag = (el.tagName ?? '').toLowerCase();

  const interactiveRoles = new Set([
    'button', 'link', 'menuitem', 'tab', 'checkbox',
    'radio', 'switch', 'textbox', 'combobox', 'slider',
  ]);
  if (interactiveRoles.has(role)) return true;

  if (['a', 'button', 'input', 'select', 'textarea'].includes(tag)) return true;

  if (
    el.interactive.hasOnClick ||
    el.interactive.hasHref ||
    el.interactive.hasReactHandler === true ||
    el.interactive.hasVueHandler === true ||
    el.interactive.hasAngularHandler === true
  ) {
    return true;
  }

  return false;
}

// ============================================
// Rules
// ============================================

const mobileTouchTargetRule: Rule = {
  id: 'touch-target-mobile',
  name: 'Mobile Touch Target Size',
  description: 'Interactive elements must be at least 44x44px on mobile viewports (WCAG 2.5.5 AAA / Apple HIG)',
  defaultSeverity: 'error',
  check(element: EnhancedElement, context: RuleContext): Violation | null {
    if (!context.isMobile) return null;
    if (!isInteractive(element)) return null;

    const { width, height } = element.bounds;
    if (width === 0 || height === 0) return null;

    const MIN = 44;
    if (width < MIN || height < MIN) {
      return {
        ruleId: 'touch-target-mobile',
        ruleName: 'Mobile Touch Target Size',
        severity: 'error',
        message: `"${element.text || element.selector}" touch target is ${width}x${height}px (minimum ${MIN}x${MIN}px)`,
        element: element.selector,
        bounds: element.bounds,
        fix: `Increase element size to at least ${MIN}x${MIN}px (WCAG 2.5.5 / Apple HIG)`,
      };
    }

    return null;
  },
};

const desktopPointerTargetRule: Rule = {
  id: 'touch-target-desktop',
  name: 'Desktop Pointer Target Size',
  description: 'Interactive elements should be at least 24x24px on desktop viewports (WCAG 2.5.8 AA)',
  defaultSeverity: 'warn',
  check(element: EnhancedElement, context: RuleContext): Violation | null {
    if (context.isMobile) return null;
    if (!isInteractive(element)) return null;

    const { width, height } = element.bounds;
    if (width === 0 || height === 0) return null;

    const MIN = 24;
    if (width < MIN || height < MIN) {
      return {
        ruleId: 'touch-target-desktop',
        ruleName: 'Desktop Pointer Target Size',
        severity: 'warn',
        message: `"${element.text || element.selector}" pointer target is ${width}x${height}px (minimum ${MIN}x${MIN}px per WCAG 2.5.8)`,
        element: element.selector,
        bounds: element.bounds,
        fix: `Increase element size to at least ${MIN}x${MIN}px (WCAG 2.5.8)`,
      };
    }

    return null;
  },
};

// ============================================
// Preset
// ============================================

export const touchTargetPresetRules: Rule[] = [mobileTouchTargetRule, desktopPointerTargetRule];

export function register(): void {
  const defaults: Record<string, RuleSetting> = {
    'touch-target-mobile': 'error',
    'touch-target-desktop': 'warn',
  };
  registerPreset({
    name: 'touch-targets',
    description: 'Minimum touch and pointer target sizes — WCAG 2.5.5 (mobile 44px) and WCAG 2.5.8 (desktop 24px)',
    rules: touchTargetPresetRules,
    defaults,
  });
}
