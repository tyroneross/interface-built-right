import { describe, expect, it } from 'vitest';
import { analyzeNativeContrast, analyzeSurface, measureRegion, type PixelImage } from './contrast.js';
import type { EnhancedElement } from '../schemas.js';

type RGB = [number, number, number];

function image(width: number, height: number, bg: RGB): PixelImage {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([...bg, 255], i * 4);
  return { width, height, data };
}

/** Paints stripes inside a rect so roughly a third of it is "glyph" pixels. */
function text(img: PixelImage, x: number, y: number, w: number, h: number, fg: RGB): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      if (xx % 3 === 0) img.data.set([...fg, 255], (yy * img.width + xx) * 4);
    }
  }
}

function el(label: string, bounds: { x: number; y: number; width: number; height: number }, opts: { role?: string; disabled?: boolean } = {}): EnhancedElement {
  return {
    selector: label,
    tagName: 'span',
    text: label,
    bounds,
    interactive: { hasOnClick: false, hasHref: false, isDisabled: opts.disabled ?? false, tabIndex: -1, cursor: 'default' },
    a11y: { role: opts.role ?? 'text', ariaLabel: label, ariaDescribedBy: null },
  } as EnhancedElement;
}

const DARK_SURFACE: RGB = [13, 26, 26];      // the team chat pop-out's surface
const LIGHT_MODE_LABEL: RGB = [38, 38, 38];  // labelColor resolved for light appearance
const DARK_MODE_LABEL: RGB = [229, 229, 229];

describe('measureRegion', () => {
  it('reads dark text on a dark surface as a failing ratio', () => {
    const img = image(60, 20, DARK_SURFACE);
    text(img, 0, 0, 60, 20, LIGHT_MODE_LABEL);
    const m = measureRegion(img, { x: 0, y: 0, width: 60, height: 20 });
    expect(m.status).toBe('measured');
    if (m.status === 'measured') expect(m.ratio).toBeLessThan(1.5);
  });

  it('reads light text on the same surface as passing', () => {
    const img = image(60, 20, DARK_SURFACE);
    text(img, 0, 0, 60, 20, DARK_MODE_LABEL);
    const m = measureRegion(img, { x: 0, y: 0, width: 60, height: 20 });
    expect(m.status === 'measured' && m.ratio).toBeGreaterThan(12);
  });

  it('reports a blank frame as unmeasurable, never as a pass', () => {
    const m = measureRegion(image(40, 20, DARK_SURFACE), { x: 0, y: 0, width: 40, height: 20 });
    expect(m.status).toBe('unmeasurable');
  });
});

describe('analyzeNativeContrast', () => {
  it('maps AX points onto a 2x screenshot offset by the window origin', () => {
    // Window at (100, 50) points, 100x40 points, captured at 2x.
    const img = image(200, 80, DARK_SURFACE);
    text(img, 20, 10, 60, 20, LIGHT_MODE_LABEL);  // "Send to" at points (110,55) 30x10
    text(img, 120, 40, 60, 20, DARK_MODE_LABEL); // "Message" at points (160,70) 30x10
    const report = analyzeNativeContrast(img, { width: 100, height: 40, originX: 100, originY: 50 }, [
      el('Send to', { x: 110, y: 55, width: 30, height: 10 }),
      el('Message', { x: 160, y: 70, width: 30, height: 10 }),
      el('Disabled', { x: 110, y: 55, width: 30, height: 10 }, { disabled: true }),
      el('Group', { x: 100, y: 50, width: 100, height: 40 }, { role: 'group' }),
    ]);
    expect(report.totalChecked).toBe(2);
    expect(report.fail).toBe(1);
    expect(report.failing[0].text).toBe('Send to');
    expect(report.failing[0].tone).toBe('light-on-dark');
  });
});

describe('analyzeSurface', () => {
  it('flags a dark surface under a light system', () => {
    const a = analyzeSurface(image(10, 10, DARK_SURFACE), 'light');
    expect(a.surface).toBe('dark');
    expect(a.differsFromSystem).toBe(true);
  });

  it('does not flag when the system setting is unknown', () => {
    expect(analyzeSurface(image(10, 10, [250, 250, 250]), 'unknown').differsFromSystem).toBe(false);
  });
});
