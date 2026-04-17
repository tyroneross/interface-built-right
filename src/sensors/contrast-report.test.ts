import { describe, it, expect } from 'vitest';
import { collectContrastReport } from './contrast-report.js';
import { makeElement, makeCtx } from './test-fixtures.js';
import type { EnhancedElement } from '../schemas.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTextEl(
  text: string,
  color: string,
  backgroundColor: string,
  fontSize = '16',
  fontWeight = '400',
  overrides: Partial<EnhancedElement> = {}
): EnhancedElement {
  return makeElement({
    text,
    computedStyles: {
      color,
      backgroundColor,
      fontSize,
      fontWeight,
      borderRadius: '0',
      padding: '0',
      cursor: 'default',
      borderWidth: '0',
      borderColor: 'transparent',
    },
    ...overrides,
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('collectContrastReport', () => {
  it('returns zeroed report for empty elements', () => {
    const result = collectContrastReport(makeCtx([]));
    expect(result.totalChecked).toBe(0);
    expect(result.pass).toBe(0);
    expect(result.fail).toBe(0);
    expect(result.passAAA).toBe(0);
    expect(result.failing).toHaveLength(0);
    expect(result.minRatio).toBeUndefined();
  });

  it('skips elements with no text', () => {
    const el = makeTextEl('', 'rgb(150,150,150)', 'rgb(200,200,200)');
    const result = collectContrastReport(makeCtx([el]));
    expect(result.totalChecked).toBe(0);
  });

  it('skips elements with no computedStyles', () => {
    const el = makeElement({ text: 'Hello', computedStyles: undefined });
    const result = collectContrastReport(makeCtx([el]));
    expect(result.totalChecked).toBe(0);
  });

  it('skips elements with transparent color', () => {
    const el = makeTextEl('Hello', 'transparent', 'rgb(255,255,255)');
    const result = collectContrastReport(makeCtx([el]));
    expect(result.totalChecked).toBe(0);
  });

  it('counts pass correctly for high-contrast black-on-white (21:1)', () => {
    const el = makeTextEl('Hello', 'rgb(0, 0, 0)', 'rgb(255, 255, 255)');
    const result = collectContrastReport(makeCtx([el]));
    expect(result.pass).toBe(1);
    expect(result.fail).toBe(0);
    expect(result.totalChecked).toBe(1);
  });

  it('counts fail correctly for low-contrast text', () => {
    // rgb(150,150,150) on rgb(200,200,200) — ratio ≈ 1.55 — fails AA
    const el = makeTextEl('Bad contrast', 'rgb(150, 150, 150)', 'rgb(200, 200, 200)');
    const result = collectContrastReport(makeCtx([el]));
    expect(result.fail).toBe(1);
    expect(result.pass).toBe(0);
  });

  it('passAAA counts elements meeting 7:1 threshold', () => {
    const el = makeTextEl('Black', 'rgb(0, 0, 0)', 'rgb(255, 255, 255)');
    const result = collectContrastReport(makeCtx([el]));
    expect(result.passAAA).toBe(1);
  });

  it('passAAA does not count elements between 4.5 and 7', () => {
    // rgb(100,100,100) on white ≈ 5.92 — passes AA but not AAA
    const el = makeTextEl('Medium', 'rgb(100, 100, 100)', 'rgb(255, 255, 255)');
    const result = collectContrastReport(makeCtx([el]));
    expect(result.pass).toBe(1);
    expect(result.passAAA).toBe(0);
  });

  it('failing list contains only FAIL entries', () => {
    const good = makeTextEl('Good', 'rgb(0,0,0)', 'rgb(255,255,255)', '16', '400', { selector: 'good' });
    const bad = makeTextEl('Bad', 'rgb(150,150,150)', 'rgb(200,200,200)', '16', '400', { selector: 'bad' });
    const result = collectContrastReport(makeCtx([good, bad]));
    expect(result.failing).toHaveLength(1);
    expect(result.failing[0].selector).toBe('bad');
    expect(result.failing[0].pass).toBe('FAIL');
  });

  it('minRatio is the element with worst contrast', () => {
    const good = makeTextEl('Good', 'rgb(0,0,0)', 'rgb(255,255,255)', '16', '400', { selector: 'good' });
    const bad = makeTextEl('Bad', 'rgb(150,150,150)', 'rgb(200,200,200)', '16', '400', { selector: 'bad' });
    const terrible = makeTextEl('Terrible', 'rgb(200,200,200)', 'rgb(210,210,210)', '16', '400', { selector: 'terrible' });
    const result = collectContrastReport(makeCtx([good, bad, terrible]));
    expect(result.minRatio).toBeDefined();
    // terrible has lowest ratio (nearly identical colors)
    expect(result.minRatio!.selector).toBe('terrible');
  });

  it('ContrastReportEntry shape is correct', () => {
    const el = makeTextEl('Test text', 'rgb(0,0,0)', 'rgb(255,255,255)');
    const result = collectContrastReport(makeCtx([el]));
    const entry = result.minRatio!;
    expect(typeof entry.selector).toBe('string');
    expect(typeof entry.text).toBe('string');
    expect(typeof entry.ratio).toBe('number');
    expect(['AA', 'AAA', 'FAIL']).toContain(entry.pass);
    expect(typeof entry.fontSize).toBe('number');
    expect(typeof entry.largeText).toBe('boolean');
  });

  it('byTone classifies dark-on-light correctly', () => {
    // black text on white bg: fg avg (0) < bg avg (255) → darkOnLight
    const el = makeTextEl('Dark on light', 'rgb(0,0,0)', 'rgb(255,255,255)');
    const result = collectContrastReport(makeCtx([el]));
    expect(result.byTone?.darkOnLight).toBe(1);
    expect(result.byTone?.lightOnDark).toBe(0);
  });

  it('byTone classifies light-on-dark correctly', () => {
    // white text on black bg: fg avg (255) > bg avg (0) → lightOnDark
    const el = makeTextEl('Light on dark', 'rgb(255,255,255)', 'rgb(0,0,0)');
    const result = collectContrastReport(makeCtx([el]));
    expect(result.byTone?.lightOnDark).toBe(1);
    expect(result.byTone?.darkOnLight).toBe(0);
  });

  it('correctly classifies multiple pass levels across a set', () => {
    // AAA pass: black on white (21:1)
    // AA pass only: rgb(100,100,100) on white (≈5.92 — passes AA, fails AAA)
    // FAIL: rgb(150,150,150) on rgb(200,200,200) (≈1.55)
    const els = [
      makeTextEl('AAA', 'rgb(0,0,0)', 'rgb(255,255,255)', '16', '400', { selector: 'aaa' }),
      makeTextEl('AA', 'rgb(100,100,100)', 'rgb(255,255,255)', '16', '400', { selector: 'aa' }),
      makeTextEl('Fail', 'rgb(150,150,150)', 'rgb(200,200,200)', '16', '400', { selector: 'fail' }),
    ];
    const result = collectContrastReport(makeCtx(els));
    expect(result.totalChecked).toBe(3);
    expect(result.pass).toBe(2);
    expect(result.fail).toBe(1);
    expect(result.passAAA).toBe(1);
  });
});
