import type { EnhancedElement } from './schemas.js';
import type { PageLike } from './engine/page-like.js';

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

      // 6. Skip the same node and parent/child relationships (selector prefix
      // check). This is only a heuristic: a selector path stops at the first
      // ancestor with an id, so `#copy-sum` does not start with its own
      // `details.copy` ancestor's path. `excludeDomRelatedCollisions` settles
      // containment from the live DOM afterwards.
      if (a.selector === b.selector) continue;
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

/**
 * Drop collisions whose two elements are the same DOM node or where one
 * CONTAINS the other in the DOM.
 *
 * A `<summary>` always sits inside its `<details>`, and a label inside its
 * button; their boxes overlap by construction, not by layout failure. The
 * selector-prefix heuristic above misses them whenever the inner element has
 * an id — `#copy-sum` versus `main > section:nth-of-type(5) > details.copy`
 * was reported as a 100% self-collision. Identical bounds are NOT the test:
 * two genuinely stacked siblings can share a box, and that is a real defect.
 *
 * Each selector is resolved with `querySelectorAll`; containment is decided
 * with `Node.contains`. A selector that does not resolve to exactly one node
 * leaves the pair undecided, and an undecided pair is KEPT — dropping a
 * collision we could not disprove would hide a real one.
 *
 * Best-effort: if the page cannot be evaluated, the input is returned as is.
 */
export async function excludeDomRelatedCollisions(
  page: PageLike,
  result: LayoutCollisionResult,
): Promise<LayoutCollisionResult> {
  if (result.collisions.length === 0) return result;
  const pairs = result.collisions.map((c) => [c.element1.selector, c.element2.selector]);
  let related: boolean[];
  try {
    related = await page.evaluate((input: string[][]) => {
      const resolve = (sel: string): Element | null => {
        try {
          const found = document.querySelectorAll(sel);
          return found.length === 1 ? found[0]! : null;
        } catch {
          return null;
        }
      };
      return input.map(([s1, s2]) => {
        const n1 = resolve(s1!);
        const n2 = resolve(s2!);
        if (!n1 || !n2) return false;
        return n1 === n2 || n1.contains(n2) || n2.contains(n1);
      });
    }, pairs) as boolean[];
  } catch {
    return result;
  }
  if (!Array.isArray(related) || related.length !== result.collisions.length) return result;
  const collisions = result.collisions.filter((_, i) => !related[i]);
  return { collisions, hasCollisions: collisions.length > 0 };
}
