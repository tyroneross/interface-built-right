import type { EnhancedElement } from '../../schemas.js';

/**
 * Calm Precision grades choices a person can perceive, not every control that
 * exists in the DOM. Hidden tab panels remain in the interactive extraction
 * so other analyzers can inspect their wiring, but they must not inflate visual
 * choice counts.
 */
export function isVisibleInteractive(element: EnhancedElement): boolean {
  if (!element.interactive?.hasOnClick && !element.interactive?.hasHref) return false;

  const bounds = element.bounds;
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) return false;

  const display = element.computedStyles?.display?.trim().toLowerCase();
  const visibility = element.computedStyles?.visibility?.trim().toLowerCase();
  const opacity = Number.parseFloat(element.computedStyles?.opacity ?? '1');
  if (display === 'none') return false;
  if (visibility === 'hidden' || visibility === 'collapse') return false;
  if (Number.isFinite(opacity) && opacity <= 0) return false;
  if (element.ancestorOpacity !== undefined && element.ancestorOpacity <= 0) return false;

  return true;
}
