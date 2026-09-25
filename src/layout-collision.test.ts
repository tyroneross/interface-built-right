import { describe, it, expect } from 'vitest';
import { detectLayoutCollisions, excludeDomRelatedCollisions } from './layout-collision.js';
import type { EnhancedElement } from './schemas.js';
import type { PageLike } from './engine/page-like.js';

function el(selector: string, x: number, y: number, width: number, height: number, text = 'label'): EnhancedElement {
  return {
    selector,
    tagName: 'div',
    text,
    bounds: { x, y, width, height },
    interactive: { hasOnClick: false, hasHref: false, isDisabled: false, tabIndex: -1, cursor: 'default' },
    a11y: { role: null, ariaLabel: null, ariaDescribedBy: null },
  } as EnhancedElement;
}

/** A PageLike whose evaluate answers "related?" per pair from a fixed table. */
function pageAnswering(related: (a: string, b: string) => boolean | 'throw'): PageLike {
  return {
    evaluate: async (_fn: unknown, pairs: string[][]) => pairs.map(([a, b]) => {
      const r = related(a!, b!);
      if (r === 'throw') throw new Error('detached');
      return r;
    }),
  } as unknown as PageLike;
}

describe('layout collision detection', () => {
  it('never pairs an element with itself (same selector)', () => {
    const r = detectLayoutCollisions([el('#a', 0, 0, 100, 40), el('#a', 0, 0, 100, 40)]);
    expect(r.collisions).toEqual([]);
  });

  it('reports genuinely overlapping siblings', () => {
    const r = detectLayoutCollisions([el('#left', 0, 0, 160, 48), el('#right', 60, 0, 160, 48)]);
    expect(r.collisions).toHaveLength(1);
  });

  // The reported defect: `#copy-sum` vs `... > details.copy`, identical
  // bounds, 100% "overlap". The selector prefix cannot see the ancestry.
  it('drops a pair the DOM says is ancestor/descendant, keeps unrelated ones', async () => {
    const found = detectLayoutCollisions([
      el('main > section:nth-of-type(5) > details.copy', 0, 0, 800, 40),
      el('#copy-sum', 0, 0, 800, 40),
      el('#left', 0, 100, 160, 48),
      el('#right', 60, 100, 160, 48),
    ]);
    expect(found.collisions).toHaveLength(2);
    const page = pageAnswering((a, b) => [a, b].includes('#copy-sum'));
    const filtered = await excludeDomRelatedCollisions(page, found);
    expect(filtered.collisions.map((c) => [c.element1.selector, c.element2.selector].sort()))
      .toEqual([['#left', '#right']]);
    expect(filtered.hasCollisions).toBe(true);
  });

  it('keeps every collision when the page cannot be evaluated', async () => {
    const found = detectLayoutCollisions([el('#left', 0, 0, 160, 48), el('#right', 60, 0, 160, 48)]);
    const filtered = await excludeDomRelatedCollisions(pageAnswering(() => 'throw'), found);
    expect(filtered).toEqual(found);
  });
});
