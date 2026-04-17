import type { Rule, RuleContext } from './engine.js';
import type { EnhancedElement, Violation } from '../schemas.js';

/**
 * Roles and tags that signal "this should be interactive".
 */
const VISUALLY_INTERACTIVE_ROLES = new Set(['button', 'link', 'menuitem', 'tab', 'option']);
const VISUALLY_INTERACTIVE_TAGS = new Set(['button', 'a']);

function looksInteractive(element: EnhancedElement): boolean {
  const tag = element.tagName.toLowerCase();
  const role = element.a11y?.role ?? '';
  const cursor = element.interactive?.cursor ?? '';

  if (VISUALLY_INTERACTIVE_TAGS.has(tag)) return true;
  if (VISUALLY_INTERACTIVE_ROLES.has(role)) return true;
  if (cursor === 'pointer') return true;

  return false;
}

function hasAnyHandler(element: EnhancedElement): boolean {
  return !!(
    element.interactive.hasOnClick ||
    element.interactive.hasHref ||
    element.interactive.hasReactHandler ||
    element.interactive.hasVueHandler ||
    element.interactive.hasAngularHandler
  );
}

/**
 * Detect whether a disabled element has a visible disabled visual state.
 * Heuristic: opacity <= 0.7 OR a muted/gray-ish color.
 */
function hasDisabledVisual(element: EnhancedElement): boolean {
  const style = element.computedStyles;
  if (!style) return false;

  const opacity = parseFloat(style.opacity ?? '1');
  if (!isNaN(opacity) && opacity <= 0.7) return true;

  // Cursor: not-allowed is a common disabled signal
  if (element.interactive.cursor === 'not-allowed') return true;

  // Muted color: check for gray tones via background or text color
  const bg = style.backgroundColor ?? '';
  const color = style.color ?? '';

  const grayPattern = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/;
  for (const c of [bg, color]) {
    const m = c.match(grayPattern);
    if (m) {
      const r = parseInt(m[1], 10);
      const g = parseInt(m[2], 10);
      const b = parseInt(m[3], 10);
      // Gray: all channels close to each other and not pure black/white
      const range = Math.max(r, g, b) - Math.min(r, g, b);
      if (range < 30 && r > 100 && r < 220) return true;
    }
  }

  return false;
}

export const handlerIntegrityRules: Rule[] = [
  {
    id: 'handler-integrity/fake-interactive',
    name: 'Handler Integrity: Fake Interactive Element',
    description: 'Elements that look interactive must have actual handlers',
    defaultSeverity: 'error',
    check: (element: EnhancedElement, _context: RuleContext): Violation | null => {
      if (!looksInteractive(element)) return null;
      if (element.interactive.isDisabled) return null;
      if (hasAnyHandler(element)) return null;

      const label = element.text || element.a11y?.ariaLabel || element.selector;
      return {
        ruleId: 'handler-integrity/fake-interactive',
        ruleName: 'Handler Integrity: Fake Interactive Element',
        severity: 'error',
        message: `"${label.slice(0, 40)}" looks interactive (role/tag/cursor) but has no handler`,
        element: element.selector,
        bounds: element.bounds,
        fix: 'Add an onClick handler, href, or remove interactive appearance',
      };
    },
  },

  {
    id: 'handler-integrity/disabled-no-visual',
    name: 'Handler Integrity: Disabled Without Visual State',
    description: 'Disabled elements must have a visible disabled appearance',
    defaultSeverity: 'warn',
    check: (element: EnhancedElement, _context: RuleContext): Violation | null => {
      if (!element.interactive.isDisabled) return null;
      if (hasDisabledVisual(element)) return null;

      const label = element.text || element.a11y?.ariaLabel || element.selector;
      return {
        ruleId: 'handler-integrity/disabled-no-visual',
        ruleName: 'Handler Integrity: Disabled Without Visual State',
        severity: 'warn',
        message: `"${label.slice(0, 40)}" is disabled but shows no visual disabled state`,
        element: element.selector,
        bounds: element.bounds,
        fix: 'Apply opacity <= 0.7, cursor: not-allowed, or muted color to disabled elements',
      };
    },
  },
];
