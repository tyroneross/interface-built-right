import { describe, expect, it } from 'vitest';
import { resolvePageBackground } from './consistency.js';

const base = { bodyColor: 'rgba(0, 0, 0, 0)', htmlColor: 'rgba(0, 0, 0, 0)', bodyImage: 'none', htmlImage: 'none', canvas: 'rgb(255, 255, 255)' };

describe('resolvePageBackground', () => {
  it('treats a fully transparent page as the canvas, not black', () => {
    expect(resolvePageBackground(base).luminance).toBeGreaterThan(0.9);
  });

  it('measures a light gradient background from its color stops', () => {
    const image = 'radial-gradient(circle at 10% 8%, rgba(239, 169, 54, 0.18), rgba(0, 0, 0, 0) 24rem), linear-gradient(rgb(251, 247, 239) 0%, rgb(247, 241, 231) 48%, rgb(244, 236, 223) 100%)';
    expect(resolvePageBackground({ ...base, bodyImage: image }).luminance).toBeGreaterThan(0.7);
  });

  it('still reports a genuinely dark solid background as dark', () => {
    expect(resolvePageBackground({ ...base, bodyColor: 'rgb(12, 14, 18)' }).luminance).toBeLessThan(0.2);
  });

  it('measures a dark gradient as dark', () => {
    const image = 'linear-gradient(rgb(10, 10, 20), rgb(30, 30, 40))';
    expect(resolvePageBackground({ ...base, bodyImage: image }).luminance).toBeLessThan(0.2);
  });

  it('returns unknown for a url() image so no mismatch is inferred', () => {
    expect(resolvePageBackground({ ...base, bodyImage: 'url("hero.jpg")' }).luminance).toBeNull();
  });

  it('uses a dark canvas when the page opts into a dark color scheme', () => {
    expect(resolvePageBackground({ ...base, canvas: 'rgb(18, 18, 18)' }).luminance).toBeLessThan(0.2);
  });

  it('prefers an opaque body color over the html background', () => {
    expect(resolvePageBackground({ ...base, bodyColor: 'rgb(255, 255, 255)', htmlColor: 'rgb(0, 0, 0)' }).luminance).toBeGreaterThan(0.9);
  });
});
