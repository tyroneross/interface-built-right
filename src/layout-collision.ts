import type { EnhancedElement } from './schemas.js';

export interface LayoutCollision {
  element1: { selector: string; text: string; bounds: { x: number; y: number; width: number; height: number } };
  element2: { selector: string; text: string; bounds: { x: number; y: number; width: number; height: number } };
  overlapArea: number;      // pixels squared
  overlapPercent: number;   // relative to smaller element
}

export interface LayoutCollisionResult {
  collisions: LayoutCollision[];
  hasCollisions: boolean;
}

/**
 * Detect overlapping text elements that indicate layout collisions.
 *
 * Filters to visible text elements, checks bounding box intersections,
 * and skips trivial overlaps and intentional parent/child layering.
 */
export function detectLayoutCollisions(elements: EnhancedElement[]): LayoutCollisionResult {
  // 1. Filter to visible text elements
  const textElements = elements.filter(
    el => el.text && el.text.trim().length > 0 && el.bounds.width > 0 && el.bounds.height > 0
  );

  // 2. Sort by vertical position (y), then horizontal (x)
  textElements.sort((a, b) => a.bounds.y !== b.bounds.y ? a.bounds.y - b.bounds.y : a.bounds.x - b.bounds.x);

  const collisions: LayoutCollision[] = [];

  for (let i = 0; i < textElements.length; i++) {
    const a = textElements[i];
    const aBottom = a.bounds.y + a.bounds.height;

    for (let j = i + 1; j < textElements.length; j++) {
      const b = textElements[j];

      // Early exit: b is too far below a to overlap (sorted by y, so all later elements are even lower)
      if (b.bounds.y > aBottom + 2) break;

      // 6. Skip parent/child relationships (selector prefix check)
      if (b.selector.startsWith(a.selector) || a.selector.startsWith(b.selector)) continue;

      // 3. Calculate bounding box intersection
      const ix = Math.max(a.bounds.x, b.bounds.x);
      const iy = Math.max(a.bounds.y, b.bounds.y);
      const ix2 = Math.min(a.bounds.x + a.bounds.width, b.bounds.x + b.bounds.width);
      const iy2 = Math.min(a.bounds.y + a.bounds.height, b.bounds.y + b.bounds.height);

      const overlapW = ix2 - ix;
      const overlapH = iy2 - iy;

      if (overlapW <= 0 || overlapH <= 0) continue;

      const overlapArea = overlapW * overlapH;

      // 5. Filter trivial overlaps: skip if < 4px in either dimension
      if (overlapW < 4 || overlapH < 4) continue;

      // 4. Calculate overlapPercent relative to smaller element
      const areaA = a.bounds.width * a.bounds.height;
      const areaB = b.bounds.width * b.bounds.height;
      const smallerArea = Math.min(areaA, areaB);
      const overlapPercent = smallerArea > 0 ? (overlapArea / smallerArea) * 100 : 0;

      // 5. Filter trivial overlaps: skip if < 5%
      if (overlapPercent < 5) continue;

      collisions.push({
        element1: {
          selector: a.selector,
          text: a.text!,
          bounds: { x: a.bounds.x, y: a.bounds.y, width: a.bounds.width, height: a.bounds.height },
        },
        element2: {
          selector: b.selector,
          text: b.text!,
          bounds: { x: b.bounds.x, y: b.bounds.y, width: b.bounds.width, height: b.bounds.height },
        },
        overlapArea,
        overlapPercent,
      });
    }
  }

  return {
    collisions,
    hasCollisions: collisions.length > 0,
  };
}
