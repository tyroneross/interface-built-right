import type { EnhancedElement, ElementIssue, Viewport } from '../schemas.js';

/**
 * Run native-specific audit rules on extracted elements
 *
 * These rules supplement the standard web audit with platform-specific checks:
 * - watchOS: max 7 interactive elements per screen
 * - watchOS: no horizontal overflow beyond viewport width
 * - iOS/watchOS: 44pt minimum touch targets (always enforced, not just mobile)
 */
export function auditNativeElements(
  elements: EnhancedElement[],
  platform: 'ios' | 'watchos',
  viewport: Viewport
): ElementIssue[] {
  const issues: ElementIssue[] = [];

  // Get interactive elements
  const interactive = elements.filter(
    e => e.interactive.hasOnClick && !e.interactive.isDisabled
  );

  // --- watchOS: max 7 interactive elements per screen ---
  if (platform === 'watchos' && interactive.length > 7) {
    issues.push({
      type: 'TOUCH_TARGET_SMALL', // Reuse closest existing type
      severity: 'warning',
      message: `watchOS screen has ${interactive.length} interactive elements (recommended max: 7). Reduce choices to avoid cognitive overload on small displays.`,
    });
  }

  // --- iOS/watchOS: 44pt touch targets always enforced ---
  for (const el of interactive) {
    const minDimension = Math.min(el.bounds.width, el.bounds.height);
    if (minDimension < 44) {
      issues.push({
        type: 'TOUCH_TARGET_SMALL',
        severity: 'error',
        message: `Touch target too small: "${el.text || el.selector}" is ${el.bounds.width}x${el.bounds.height}pt (minimum: 44x44pt)`,
      });
    }
  }

  // --- watchOS: no horizontal overflow ---
  if (platform === 'watchos') {
    for (const el of elements) {
      const rightEdge = el.bounds.x + el.bounds.width;
      if (rightEdge > viewport.width) {
        issues.push({
          type: 'TOUCH_TARGET_SMALL', // Closest existing type
          severity: 'warning',
          message: `Element "${el.text || el.selector}" overflows watchOS viewport (right edge: ${rightEdge}pt, viewport width: ${viewport.width}pt)`,
        });
      }
    }
  }

  // --- Missing accessibility labels on interactive elements ---
  for (const el of interactive) {
    if (!el.text && !el.a11y.ariaLabel) {
      issues.push({
        type: 'MISSING_ARIA_LABEL',
        severity: 'error',
        message: `Interactive element "${el.selector}" has no accessibility label`,
      });
    }
  }

  return issues;
}
