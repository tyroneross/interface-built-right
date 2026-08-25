import { describe, it, expect } from 'vitest';
import { buildZoomTrackFromScan, isInteractiveElement, toSpectraClicks } from './zoom-track.js';

const scan = (all: unknown[], w = 1920, h = 1080) => ({
  viewport: { width: w, height: h },
  elements: { all },
});

const btn = (x: number, y: number, text = 'Go') => ({
  tagName: 'button', text, bounds: { x, y, width: 100, height: 40 },
  interactive: { hasOnClick: false, hasHref: false, isDisabled: false, tabIndex: 0, cursor: 'pointer' },
});

describe('isInteractiveElement — signals, not a boolean', () => {
  it('accepts each signal on its own', () => {
    expect(isInteractiveElement({ tagName: 'button' })).toBe(true);
    expect(isInteractiveElement({ tagName: 'div', interactive: { hasOnClick: true } })).toBe(true);
    expect(isInteractiveElement({ tagName: 'div', interactive: { hasHref: true } })).toBe(true);
    expect(isInteractiveElement({ tagName: 'div', interactive: { cursor: 'pointer' } })).toBe(true);
    expect(isInteractiveElement({ tagName: 'div', interactive: { tabIndex: 0 } })).toBe(true);
  });

  it('rejects a plain wrapper and anything disabled', () => {
    expect(isInteractiveElement({ tagName: 'div' })).toBe(false);
    expect(isInteractiveElement({ tagName: 'button', interactive: { isDisabled: true } })).toBe(false);
  });

  it('ignores an isInteractive field — the name that does not exist', () => {
    // The spike guessed this field, got undefined, and silently produced zero
    // targets. A div is still not interactive just because it claims to be.
    expect(isInteractiveElement({ tagName: 'div', interactive: { isInteractive: true } as any })).toBe(false);
  });
});

describe('buildZoomTrackFromScan', () => {
  it('puts cx/cy at the element centre as a viewport fraction', () => {
    // top-right button: x 1717..1856 of 1920, y 48..94 of 1080
    const r = buildZoomTrackFromScan(scan([{
      ...btn(1717, 48, 'Submit Order'),
      bounds: { x: 1717, y: 48, width: 139, height: 46 },
    }]));
    expect(r.clicks).toHaveLength(1);
    expect(r.clicks[0].cx).toBeCloseTo((1717 + 139 / 2) / 1920, 3);
    expect(r.clicks[0].cy).toBeCloseTo((48 + 46 / 2) / 1080, 3);
    expect(r.clicks[0].label).toBe('Submit Order');
  });

  it('spaces targets by perMs and preserves order', () => {
    const r = buildZoomTrackFromScan(scan([btn(0, 0, 'A'), btn(500, 500, 'B')]), { perMs: 1500 });
    expect(r.clicks.map((c) => c.tMs)).toEqual([0, 1500]);
  });

  it('separates "no elements" from "none interactive"', () => {
    expect(buildZoomTrackFromScan(scan([])).elementsConsidered).toBe(0);
    const onlyDivs = buildZoomTrackFromScan(scan([{ tagName: 'div', bounds: { x: 0, y: 0, width: 9, height: 9 } }]));
    expect(onlyDivs.elementsConsidered).toBe(1);
    expect(onlyDivs.clicks).toHaveLength(0);
  });

  it('skips zero-area and malformed bounds instead of emitting NaN', () => {
    const r = buildZoomTrackFromScan(scan([
      { ...btn(0, 0), bounds: { x: 0, y: 0, width: 0, height: 40 } },
      { ...btn(0, 0), bounds: { x: NaN, y: 0, width: 10, height: 10 } as any },
    ]));
    expect(r.clicks).toHaveLength(0);
  });

  it('dedupes identical position+label', () => {
    const r = buildZoomTrackFromScan(scan([btn(10, 10, 'Same'), btn(10, 10, 'Same')]));
    expect(r.clicks).toHaveLength(1);
  });

  it('falls back to 1920x1080 when the scan carries no viewport', () => {
    const r = buildZoomTrackFromScan({ elements: { all: [btn(960, 540)] } });
    expect(r.viewport).toEqual({ width: 1920, height: 1080 });
  });

  it('emits exactly Spectra ZoomClick keys — no label leaks through', () => {
    const r = buildZoomTrackFromScan(scan([btn(10, 10)]));
    expect(Object.keys(toSpectraClicks(r.clicks)[0]).sort()).toEqual(['cx', 'cy', 'tMs']);
  });
});

describe('scroll offsets — the whole page is reachable from one scan', () => {
  it('emits a scrollY that brings a below-the-fold element into view', () => {
    const r = buildZoomTrackFromScan(scan([
      { tagName: 'button', text: 'top',   bounds: { x: 100, y: 100,  width: 80, height: 40 } },
      { tagName: 'button', text: 'below', bounds: { x: 100, y: 2200, width: 80, height: 40 } },
    ]));
    expect(r.clicks.map((c) => c.label)).toEqual(['top', 'below']);
    for (const c of r.clicks) {
      expect(c.cy).toBeGreaterThanOrEqual(0);
      expect(c.cy).toBeLessThanOrEqual(1);
    }
    expect(r.clicks[0].scrollY).toBe(0);            // already visible
    expect(r.clicks[1].scrollY).toBeGreaterThan(0); // needs scrolling
  });

  it('centres the target when the document allows it', () => {
    // element far from both edges of a tall document -> centred, cy ~ 0.5
    const r = buildZoomTrackFromScan(scan([
      { tagName: 'button', text: 'mid', bounds: { x: 100, y: 5000, width: 80, height: 40 } },
      { tagName: 'div', bounds: { x: 0, y: 12000, width: 10, height: 10 } },
    ]));
    expect(r.clicks[0].cy).toBeCloseTo(0.5, 2);
  });

  it('cannot scroll above the document top — cy reflects the real position', () => {
    const r = buildZoomTrackFromScan(scan([
      { tagName: 'button', text: 'top', bounds: { x: 100, y: 100, width: 80, height: 40 } },
    ]));
    expect(r.clicks[0].scrollY).toBe(0);
    expect(r.clicks[0].cy).toBeCloseTo(120 / 1080, 3);
  });

  it('still drops horizontally unreachable targets, since there is no h-scroll', () => {
    const r = buildZoomTrackFromScan(scan([
      { tagName: 'button', text: 'right', bounds: { x: 4000, y: 100, width: 80, height: 40 } },
    ]));
    expect(r.clicks).toHaveLength(0);
    expect(r.offscreenSkipped).toBe(1);
  });
});

describe('timing', () => {
  it('uses real event timestamps when supplied, and orders by them', () => {
    const r = buildZoomTrackFromScan(
      scan([btn(10, 10, 'Second'), btn(200, 200, 'First')]),
      { events: [{ tMs: 4000, label: 'Second' }, { tMs: 1000, label: 'First' }] },
    );
    expect(r.clicks.map((c) => [c.label, c.tMs])).toEqual([['First', 1000], ['Second', 4000]]);
    expect(r.unmatchedEvents).toEqual([]);
  });

  it('falls back to even spacing for elements with no event', () => {
    const r = buildZoomTrackFromScan(scan([btn(10, 10, 'A'), btn(200, 200, 'B')]), { perMs: 1500 });
    expect(r.clicks.map((c) => c.tMs)).toEqual([0, 1500]);
  });

  it('reports events that matched nothing instead of silently ignoring them', () => {
    const r = buildZoomTrackFromScan(scan([btn(10, 10, 'A')]),
      { events: [{ tMs: 500, label: 'A' }, { tMs: 900, label: 'Ghost' }] });
    expect(r.unmatchedEvents).toEqual(['Ghost']);
  });
});

describe('rich targets — text, colours, importance', () => {
  const styled = (tag: string, text: string, css: Record<string, string>, y = 100) => ({
    tagName: tag, text, bounds: { x: 100, y, width: 120, height: 40 }, computedStyles: css,
  });

  it('carries the element text verbatim, not the truncated label', () => {
    const long = 'A heading long enough that the 40-char label truncates it';
    const r = buildZoomTrackFromScan(scan([styled('button', long, {})]));
    expect(r.clicks[0].text).toBe(long);
    expect(r.clicks[0].label.length).toBeLessThanOrEqual(40);
  });

  it('resolves oklch to hex — the format a Tailwind v4 page emits', () => {
    const r = buildZoomTrackFromScan(scan([
      styled('button', 'Go', { backgroundColor: 'oklch(0.606 0.25 292.717)', color: 'rgb(255,255,255)' }),
    ]));
    expect(r.clicks[0].backgroundColorHex).toBe('#8e51ff');
    expect(r.clicks[0].colorHex).toBe('#ffffff');
  });

  it('leaves an undecodable or transparent colour UNDEFINED, never defaulted', () => {
    const r = buildZoomTrackFromScan(scan([
      styled('button', 'Go', { backgroundColor: 'rgba(0, 0, 0, 0)', color: 'weird-nonsense' }),
    ]));
    expect(r.clicks[0].backgroundColorHex).toBeUndefined();
    expect(r.clicks[0].colorHex).toBeUndefined();
    expect(r.clicks[0].backgroundColor).toBe('rgba(0, 0, 0, 0)'); // raw still reported
  });

  it('ranks a button above a link', () => {
    const r = buildZoomTrackFromScan(scan([styled('a', 'link', {}), styled('button', 'btn', {}, 300)]));
    const btn = r.clicks.find((c) => c.role === 'button')!;
    const link = r.clicks.find((c) => c.role === 'a')!;
    expect(btn.weight).toBeGreaterThan(link.weight);
  });

  it('--max keeps the most important and restores time order', () => {
    const r = buildZoomTrackFromScan(
      scan([styled('a', 'first', {}, 100), styled('button', 'second', {}, 300)]),
      { max: 1 },
    );
    expect(r.clicks).toHaveLength(1);
    expect(r.clicks[0].role).toBe('button'); // kept by weight, not by scan order
    expect(r.trimmed).toBe(1);
  });

  it('reports trimmed=0 when under the cap', () => {
    const r = buildZoomTrackFromScan(scan([styled('button', 'only', {})]), { max: 5 });
    expect(r.trimmed).toBe(0);
  });
});

describe('headings — content elements as zoom targets', () => {
  // Mirrors src/extract.ts's ContentElement shape closely enough for the
  // duck-typed fields buildZoomTrackFromScan actually reads.
  const heading = (
    level: 1 | 2 | 3 | 4 | 5 | 6,
    text: string,
    x: number,
    y: number,
    width = 800,
    height = 60,
  ) => ({
    tagName: `h${level}`,
    contentKind: 'heading' as const,
    headingLevel: level,
    text,
    selector: `h${level}`,
    bounds: { x, y, width, height },
    computedStyles: {},
  });

  const scanWithContent = (all: unknown[], content: unknown[], w = 1920, h = 1080) => ({
    viewport: { width: w, height: h },
    elements: { all },
    content: { elements: content },
  });

  it('an h1 becomes a target with role h1 and the top weight', () => {
    const r = buildZoomTrackFromScan(scanWithContent([], [heading(1, 'Welcome', 100, 50)]));
    expect(r.clicks).toHaveLength(1);
    expect(r.clicks[0].role).toBe('h1');
    expect(r.clicks[0].weight).toBeCloseTo(0.95, 1);
    expect(r.clicks[0].text).toBe('Welcome');
  });

  it('heading weight follows the level table exactly, h1 highest down to h6', () => {
    // A near-zero-area heading isolates the base ROLE_WEIGHT value from the
    // areaFrac bonus (a full-width heading would otherwise nudge these up).
    const levels = [1, 2, 3, 4, 5, 6] as const;
    const weights = levels.map((lvl) => {
      const r = buildZoomTrackFromScan(scanWithContent([], [heading(lvl, `H${lvl}`, 100, 100, 4, 4)]));
      return r.clicks[0].weight;
    });
    expect(weights).toEqual([0.95, 0.75, 0.65, 0.5, 0.4, 0.3]);
  });

  it('ranks by weight, not by which candidate was appended first', () => {
    // An earlier revision pinned button at 1.0 — the ceiling — so `min(1, …)`
    // collapsed h1 and button onto the same value and ordering fell to a
    // stable-sort tie. That is invisible and breaks the moment anyone changes
    // the sort. Every role now has a distinct base, so these assertions are
    // about the numbers rather than about insertion order.
    const tinyH1 = { tagName: 'h1', text: 'Title', contentKind: 'heading', headingLevel: 1,
                     bounds: { x: 0, y: 0, width: 40, height: 20 } };
    const hugeButton = { tagName: 'button', text: 'Buy', bounds: { x: 0, y: 0, width: 1920, height: 1080 } };

    // h1 outranks the primary action even when the button fills the viewport:
    // a viewer needs to know what they are looking at before what they can do.
    const r = buildZoomTrackFromScan(scanWithContent([hugeButton], [tinyH1]), { max: 1 });
    expect(r.clicks[0].role).toBe('h1');

    // …but a subsection heading does NOT outrank the primary action, even at
    // full viewport. The area bonus nudges rank; it never inverts adjacent roles.
    const hugeH2 = { tagName: 'h2', text: 'Section', contentKind: 'heading', headingLevel: 2,
                     bounds: { x: 0, y: 0, width: 1920, height: 1080 } };
    const tinyButton = { tagName: 'button', text: 'Buy', bounds: { x: 0, y: 0, width: 40, height: 20 } };
    const r2 = buildZoomTrackFromScan(scanWithContent([tinyButton], [hugeH2]), { max: 1 });
    expect(r2.clicks[0].role).toBe('button');
  });

  it('paragraphs and images are not zoom targets even though they have geometry', () => {
    const para = {
      tagName: 'p', contentKind: 'paragraph', text: 'Some body copy',
      bounds: { x: 100, y: 100, width: 400, height: 60 },
    };
    const img = {
      tagName: 'img', contentKind: 'image', alt: 'hero',
      bounds: { x: 100, y: 200, width: 400, height: 300 },
    };
    const r = buildZoomTrackFromScan(scanWithContent([], [para, img]));
    expect(r.clicks).toHaveLength(0);
    // Still counted as considered — distinguishes "page has content but none
    // of it is a heading" from "the scan returned nothing at all".
    expect(r.elementsConsidered).toBe(2);
  });

  it('a heading below the fold still gets a correct scrollY', () => {
    const r = buildZoomTrackFromScan(scanWithContent([], [heading(2, 'Deep section', 100, 3000)]));
    expect(r.clicks).toHaveLength(1);
    expect(r.clicks[0].scrollY).toBeGreaterThan(0);
    expect(r.clicks[0].cy).toBeGreaterThanOrEqual(0);
    expect(r.clicks[0].cy).toBeLessThanOrEqual(1);
  });

  it('headings and interactive elements coexist in one track, ordered by time', () => {
    const button = {
      tagName: 'button', text: 'Buy',
      bounds: { x: 1700, y: 700, width: 100, height: 40 },
      interactive: { hasOnClick: true },
    };
    const r = buildZoomTrackFromScan(
      scanWithContent([button], [heading(3, 'Details', 100, 50)]),
      { events: [{ tMs: 5000, label: 'Buy' }, { tMs: 1000, label: 'Details' }] },
    );
    expect(r.clicks.map((c) => c.role)).toEqual(['h3', 'button']);
    expect(r.clicks.map((c) => c.tMs)).toEqual([1000, 5000]);
  });
});
