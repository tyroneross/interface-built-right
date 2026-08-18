import { describe, it, expect } from 'vitest';
import { parseColor, flatten } from './color-parse.js';

const hex = (r: [number, number, number]) =>
  '#' + r.map((v) => v.toString(16).padStart(2, '0')).join('');

function rgbOf(css: string): string {
  const p = parseColor(css);
  if (p.kind !== 'rgb') throw new Error(`expected rgb for ${css}, got ${p.kind}`);
  return hex(p.rgb);
}

describe('parseColor — oklch', () => {
  // Ground truth: Tailwind v4 source oklch values on the left, the hex a real
  // browser computed for them on the right. These six were measured live on
  // rosslabs.ai during the audit that exposed the parser gap.
  const truth: [string, string, string][] = [
    ['oklch(0.585 0.233 277.117)', '#615fff', 'indigo-500'],
    ['oklch(0.511 0.262 276.966)', '#4f39f6', 'indigo-600'],
    ['oklch(0.673 0.182 276.935)', '#7c86ff', 'indigo-400'],
    ['oklch(0.606 0.25 292.717)', '#8e51ff', 'violet-500'],
    ['oklch(0.141 0.005 285.823)', '#09090b', 'zinc-950'],
    ['oklch(0.552 0.016 285.938)', '#71717b', 'zinc-500'],
  ];
  for (const [css, expected, label] of truth) {
    it(`${label}: ${css} -> ${expected}`, () => {
      expect(rgbOf(css)).toBe(expected);
    });
  }
});

describe('parseColor — other formats', () => {
  it('hex 3/4/6/8', () => {
    expect(rgbOf('#abc')).toBe('#aabbcc');
    expect(rgbOf('#615fff')).toBe('#615fff');
    const a8 = parseColor('#11223344');
    expect(a8.kind === 'rgb' && Math.round(a8.alpha * 255)).toBe(0x44);
  });

  it('rgb in both legacy and modern syntax', () => {
    expect(rgbOf('rgb(97, 95, 255)')).toBe('#615fff');
    expect(rgbOf('rgb(97 95 255)')).toBe('#615fff');
    expect(rgbOf('rgb(97 95 255 / 0.8)')).toBe('#615fff');
  });

  it('hsl, oklab, lab, color(), named', () => {
    expect(rgbOf('hsl(240 100% 50%)')).toBe('#0000ff');
    expect(parseColor('oklab(0.606 0.05 -0.23)').kind).toBe('rgb');
    expect(parseColor('lab(50% 40 -60)').kind).toBe('rgb');
    expect(rgbOf('color(srgb 1 1 1)')).toBe('#ffffff');
    expect(rgbOf('white')).toBe('#ffffff');
  });
});

describe('parseColor — the distinction that matters', () => {
  // The original bug: every unparseable color returned null, exactly like
  // `transparent` did. The rule skipped both, reported totalChecked: 0, and a
  // page nobody had measured came back clean. These must NOT be the same value.
  it('separates "nothing to measure" from "could not decode"', () => {
    expect(parseColor('transparent').kind).toBe('none');
    expect(parseColor('inherit').kind).toBe('none');
    expect(parseColor('rgba(0,0,0,0)').kind).toBe('none');

    expect(parseColor('light-dark(#fff, #000)').kind).toBe('unsupported');
    expect(parseColor('color-mix(in oklch, red, blue)').kind).toBe('unsupported');
    expect(parseColor('var(--brand)').kind).toBe('unsupported');
  });

  it('never silently returns a measurable value for garbage', () => {
    for (const junk of ['', '   ', 'not-a-color', '#12345', 'oklch()']) {
      const p = parseColor(junk);
      expect(p.kind === 'rgb').toBe(false);
    }
  });
});

describe('flatten', () => {
  it('composites translucent text over its background before measuring', () => {
    // Taking rgba at full strength overstates contrast; 50% indigo on white is
    // visibly lighter than indigo, and must measure as such.
    const fg = parseColor('rgba(97,95,255,0.5)');
    expect(flatten(fg, [255, 255, 255])).toEqual([176, 175, 255]);
  });

  it('returns the color unchanged at full alpha', () => {
    const fg = parseColor('#615fff');
    expect(flatten(fg, [255, 255, 255])).toEqual([97, 95, 255]);
  });
});
