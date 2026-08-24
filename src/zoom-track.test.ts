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
