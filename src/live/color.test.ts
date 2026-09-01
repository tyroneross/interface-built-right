import { describe, it, expect } from 'vitest';
import {
  aaThreshold,
  compositeOver,
  contrastRatio,
  formatRgba,
  isLargeText,
  isOpaque,
  parseCssColor,
  parseFontWeight,
  parsePx,
  relativeLuminance,
  resolveEffectiveBackground,
} from './color.js';

describe('parseCssColor', () => {
  it('parses the legacy rgb()/rgba() forms Chrome computes', () => {
    expect(parseCssColor('rgb(255, 0, 0)')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseCssColor('rgba(0, 0, 0, 0)')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(parseCssColor('rgba(18, 20, 22, 0.5)')).toEqual({ r: 18, g: 20, b: 22, a: 0.5 });
  });

  it('parses the space/slash form', () => {
    expect(parseCssColor('rgb(10 20 30 / 0.25)')).toEqual({ r: 10, g: 20, b: 30, a: 0.25 });
    expect(parseCssColor('rgb(10 20 30)')).toEqual({ r: 10, g: 20, b: 30, a: 1 });
  });

  it('parses hex, including the 4- and 8-digit alpha forms', () => {
    // Canvas fillStyle normalization returns #rrggbb for opaque colors, so this
    // is the shape the in-page collector actually hands back.
    expect(parseCssColor('#ff0000')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseCssColor('#f00')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseCssColor('#00000080')).toEqual({ r: 0, g: 0, b: 0, a: 128 / 255 });
    expect(parseCssColor('#0008')).toEqual({ r: 0, g: 0, b: 0, a: 136 / 255 });
  });

  it('treats the transparent keyword as fully transparent black', () => {
    expect(parseCssColor('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it('returns null rather than guessing on unsupported syntax', () => {
    expect(parseCssColor('oklch(0.7 0.1 200)')).toBeNull();
    expect(parseCssColor('var(--text-normal)')).toBeNull();
    expect(parseCssColor('')).toBeNull();
    expect(parseCssColor(undefined)).toBeNull();
  });

  it('clamps out-of-range channels', () => {
    expect(parseCssColor('rgb(300, -20, 12)')).toEqual({ r: 255, g: 0, b: 12, a: 1 });
    expect(parseCssColor('rgba(0, 0, 0, 4)')?.a).toBe(1);
  });
});

describe('compositeOver', () => {
  it('returns the source untouched when it is opaque', () => {
    expect(compositeOver({ r: 1, g: 2, b: 3, a: 1 }, { r: 9, g: 9, b: 9, a: 1 }))
      .toEqual({ r: 1, g: 2, b: 3, a: 1 });
  });

  it('returns the destination untouched when the source is fully transparent', () => {
    expect(compositeOver({ r: 1, g: 2, b: 3, a: 0 }, { r: 9, g: 9, b: 9, a: 1 }))
      .toEqual({ r: 9, g: 9, b: 9, a: 1 });
  });

  it('mixes at 50% the way source-over does', () => {
    expect(compositeOver({ r: 0, g: 0, b: 0, a: 0.5 }, { r: 255, g: 255, b: 255, a: 1 }))
      .toEqual({ r: 128, g: 128, b: 128, a: 1 });
  });
});

describe('resolveEffectiveBackground', () => {
  it('walks past transparent ancestors to the first opaque one', () => {
    // This is the Obsidian case: the control itself paints nothing, and so does
    // its action row; the pane behind them is what the eye actually sees.
    const { color, resolved } = resolveEffectiveBackground([
      'rgba(0, 0, 0, 0)',
      'rgba(0, 0, 0, 0)',
      'rgb(30, 30, 30)',
    ]);
    expect(resolved).toBe(true);
    expect(color).toEqual({ r: 30, g: 30, b: 30, a: 1 });
  });

  it('alpha-composites a translucent element over its opaque ancestor', () => {
    const { color } = resolveEffectiveBackground([
      'rgba(255, 255, 255, 0.5)',
      'rgb(0, 0, 0)',
    ]);
    expect(color).toEqual({ r: 128, g: 128, b: 128, a: 1 });
  });

  it('composites multiple translucent layers in paint order', () => {
    const { color } = resolveEffectiveBackground([
      'rgba(255, 255, 255, 0.5)',
      'rgba(255, 255, 255, 0.5)',
      'rgb(0, 0, 0)',
    ]);
    // bottom→top: black, then 50% white → 128, then 50% white again → 191/192.
    expect(color.r).toBeGreaterThan(185);
    expect(color.r).toBeLessThan(196);
    expect(color.a).toBe(1);
  });

  it('falls back to white and says so when nothing opaque exists', () => {
    const { color, resolved } = resolveEffectiveBackground([
      'rgba(0, 0, 0, 0)',
      'rgba(0, 0, 0, 0)',
    ]);
    expect(resolved).toBe(false);
    expect(color).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  });

  // WAS: 'ignores entries it cannot parse instead of aborting the walk',
  // asserting `{ r: 10, g: 10, b: 10 }` — i.e. that an opaque oklch card is
  // SKIPPED and the layer behind it reported as the background. That is the
  // defect written down as a requirement. Skipping an opaque layer means
  // grading text against something the reader cannot see, and the old code
  // still returned `resolved: true`, so the one honesty flag the type carries
  // said the answer was measured.
  //
  // Delegating to src/rules/color-parse.ts fixes it twice over: that parser
  // DECODES oklch, so the card is not skipped — it is measured, and the walk
  // correctly stops at the first opaque layer.
  it('stops at an opaque oklch ancestor instead of walking past it', () => {
    const { color, resolved } = resolveEffectiveBackground([
      'oklch(0.2 0 0)',
      'rgb(10, 10, 10)',
    ]);
    expect(resolved).toBe(true);
    // oklch(0.2 0 0) is a near-black grey. The layer BEHIND it (10,10,10) must
    // not be the reported background — the reader cannot see through the card.
    expect(color.a).toBe(1);
    expect(color).not.toEqual({ r: 10, g: 10, b: 10, a: 1 });
    expect(color.r).toBeGreaterThan(15);
    expect(color.r).toBeLessThan(30);
  });

  // The arm that has to exist for the honesty contract to hold: a colour the
  // parser genuinely cannot decode must ABORT the chain, not be stepped over.
  // Everything beneath an unknown layer is unknown.
  it('aborts and reports when a layer cannot be decoded at all', () => {
    // `hwb()` is genuinely undecodable here; display-p3, oklch and lab are all
    // handled, which is exactly why delegating beats keeping a local parser.
    const { color, resolved, unsupported } = resolveEffectiveBackground([
      'hwb(0 0% 0%)',
      'rgb(255, 255, 255)',
    ]);
    expect(unsupported).toBeDefined();
    expect(resolved).toBe(false);
    // Falls back to the canvas default, flagged — never to the layer behind the
    // one it could not read.
    expect(color).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  });
});

describe('contrastRatio', () => {
  it('gives 21:1 for black on white and 1:1 for identical colors', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0, a: 1 }, { r: 255, g: 255, b: 255, a: 1 })).toBe(21);
    expect(contrastRatio({ r: 90, g: 90, b: 90, a: 1 }, { r: 90, g: 90, b: 90, a: 1 })).toBe(1);
  });

  it('is symmetric', () => {
    const a = { r: 20, g: 40, b: 60, a: 1 };
    const b = { r: 200, g: 210, b: 220, a: 1 };
    expect(contrastRatio(a, b)).toBe(contrastRatio(b, a));
  });

  it('matches the published ratio for #767676 on white', () => {
    // 4.54:1 — the canonical WCAG AA boundary example for normal text.
    expect(contrastRatio({ r: 118, g: 118, b: 118, a: 1 }, { r: 255, g: 255, b: 255, a: 1 }))
      .toBeCloseTo(4.54, 1);
  });
});

describe('relativeLuminance', () => {
  it('anchors at 0 for black and 1 for white', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0, a: 1 })).toBe(0);
    expect(relativeLuminance({ r: 255, g: 255, b: 255, a: 1 })).toBeCloseTo(1, 10);
  });
});

describe('isLargeText / aaThreshold', () => {
  it('needs 24px when not bold', () => {
    expect(isLargeText(23.9, 400)).toBe(false);
    expect(isLargeText(24, 400)).toBe(true);
  });

  it('drops to 18.66px once weight reaches 700', () => {
    expect(isLargeText(18.66, 700)).toBe(true);
    expect(isLargeText(18.65, 700)).toBe(false);
    expect(isLargeText(18.66, 600)).toBe(false);
  });

  it('maps large text to 3:1 and everything else to 4.5:1', () => {
    expect(aaThreshold(true)).toBe(3);
    expect(aaThreshold(false)).toBe(4.5);
  });

  it('is false for a non-finite size rather than throwing', () => {
    expect(isLargeText(Number.NaN, 700)).toBe(false);
  });
});

describe('small helpers', () => {
  it('parses px values and rejects junk', () => {
    expect(parsePx('14px')).toBe(14);
    expect(parsePx('13.6px')).toBe(13.6);
    expect(parsePx('normal')).toBeNull();
    expect(parsePx(null)).toBeNull();
  });

  it('normalizes font-weight keywords and numerics', () => {
    expect(parseFontWeight('700')).toBe(700);
    expect(parseFontWeight('bold')).toBe(700);
    expect(parseFontWeight('normal')).toBe(400);
    expect(parseFontWeight(undefined)).toBe(400);
  });

  it('formats rgb when opaque and rgba when not', () => {
    expect(formatRgba({ r: 1, g: 2, b: 3, a: 1 })).toBe('rgb(1, 2, 3)');
    expect(formatRgba({ r: 1, g: 2, b: 3, a: 0.5 })).toBe('rgba(1, 2, 3, 0.5)');
  });

  it('reports opacity', () => {
    expect(isOpaque({ r: 0, g: 0, b: 0, a: 1 })).toBe(true);
    expect(isOpaque({ r: 0, g: 0, b: 0, a: 0.99 })).toBe(false);
  });
});

describe('color(srgb ...) — the computed form of color-mix(in srgb, ...)', () => {
  it('parses the exact value Chrome computed for the plugin health gauge', () => {
    // Measured live in Obsidian 1.13.4: `.ws-health-value.is-under` computed to
    // this, and every earlier build graded it `contrastRatio: null`.
    expect(parseCssColor('color(srgb 0.56902 0.312353 0.06)')).toEqual({
      r: 145, g: 80, b: 15, a: 1,
    });
  });

  it('reads the slash alpha', () => {
    expect(parseCssColor('color(srgb 1 0 0 / 0.5)')).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
  });

  it('accepts percentage channels', () => {
    expect(parseCssColor('color(srgb 100% 0% 50%)')).toEqual({ r: 255, g: 0, b: 128, a: 1 });
  });

  it('clamps out-of-gamut channels rather than emitting an impossible rgb', () => {
    expect(parseCssColor('color(srgb 1.4 -0.2 0.5)')).toEqual({ r: 255, g: 0, b: 128, a: 1 });
  });

  it('still refuses a colour space it cannot convert exactly', () => {
    expect(parseCssColor('color(display-p3 0.5 0.2 0.1)')).toBeNull();
    expect(parseCssColor('oklch(0.8 0.1 250)')).toBeNull();
  });

  it('grades the gauge against the pane instead of returning null', () => {
    const fg = parseCssColor('color(srgb 0.56902 0.312353 0.06)');
    const bg = parseCssColor('rgb(246, 246, 246)');
    expect(fg).not.toBeNull();
    expect(contrastRatio(fg!, bg!)).toBeGreaterThan(4.5);
  });
});
