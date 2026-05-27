import { describe, it, expect } from 'vitest';
import { collectHierarchy } from './hierarchy.js';
import { makeElement, makeCtx } from './test-fixtures.js';

describe('collectHierarchy', () => {
  it('1 h1, 4 h2, 8 h3, 0 h4-h6 → correct per-level counts + first_text + all_texts', () => {
    const els = [
      makeElement({ tagName: 'h1', text: 'Title' }),
      ...Array.from({ length: 4 }, (_, i) => makeElement({ tagName: 'h2', text: `Section ${i + 1}` })),
      ...Array.from({ length: 8 }, (_, i) => makeElement({ tagName: 'h3', text: `Sub ${i + 1}` })),
    ];
    const result = collectHierarchy(makeCtx(els));
    expect(result.h1.count).toBe(1);
    expect(result.h1.first_text).toBe('Title');
    expect(result.h1.all_texts).toEqual(['Title']);
    expect(result.h2.count).toBe(4);
    expect(result.h2.all_texts).toEqual(['Section 1', 'Section 2', 'Section 3', 'Section 4']);
    expect(result.h3.count).toBe(8);
    expect(result.h4.count).toBe(0);
    expect(result.h5.count).toBe(0);
    expect(result.h6.count).toBe(0);
  });

  it('page with 0 h1 → h1.finding = "no_h1_on_page"', () => {
    const els = [
      makeElement({ tagName: 'h2', text: 'Only h2' }),
      makeElement({ tagName: 'h3', text: 'Then h3' }),
    ];
    const result = collectHierarchy(makeCtx(els));
    expect(result.h1.count).toBe(0);
    expect(result.h1.finding).toBe('no_h1_on_page');
  });

  it('page with 3 h1s → h1.finding = "multiple_h1s_on_page"', () => {
    const els = [
      makeElement({ tagName: 'h1', text: 'A' }),
      makeElement({ tagName: 'h1', text: 'B' }),
      makeElement({ tagName: 'h1', text: 'C' }),
    ];
    const result = collectHierarchy(makeCtx(els));
    expect(result.h1.count).toBe(3);
    expect(result.h1.finding).toBe('multiple_h1s_on_page');
  });

  it('h1 → h3 with no h2 in between → level_skips entry', () => {
    const els = [
      makeElement({ tagName: 'h1', text: 'Title' }),
      makeElement({ tagName: 'h3', text: 'Skipped h2' }),
    ];
    const result = collectHierarchy(makeCtx(els));
    expect(result.level_skips).toHaveLength(1);
    expect(result.level_skips[0]).toMatchObject({ from: 'h1', to: 'h3' });
  });

  it('ARIA landmarks (nav, main, aside, header, footer) counted', () => {
    const els = [
      makeElement({ tagName: 'nav', text: '' }),
      makeElement({ tagName: 'main', text: '' }),
      makeElement({ tagName: 'header', text: '' }),
      makeElement({ tagName: 'footer', text: '' }),
      // aside intentionally absent
    ];
    const result = collectHierarchy(makeCtx(els));
    expect(result.landmarks).toMatchObject({ nav: 1, main: 1, aside: 0, header: 1, footer: 1 });
  });

  it('role="heading" aria-level="2" counted under aria_headings (separate from native h2)', () => {
    const els = [
      makeElement({ tagName: 'h1', text: 'Real h1' }),
      makeElement({
        tagName: 'div',
        text: 'Pseudo-heading',
        a11y: { role: 'heading', ariaLabel: null, ariaDescribedBy: null, ariaLevel: 2 } as unknown as never,
      }),
    ];
    const result = collectHierarchy(makeCtx(els));
    expect(result.h2.count).toBe(0); // native h2 not present
    expect(result.aria_headings).toHaveLength(1);
    expect(result.aria_headings[0]).toMatchObject({ level: 2, text: 'Pseudo-heading' });
  });
});
