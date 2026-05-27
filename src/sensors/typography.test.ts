import { describe, it, expect } from 'vitest';
import { collectTypography } from './typography.js';
import { makeElement, makeCtx } from './test-fixtures.js';

describe('collectTypography', () => {
  it('h1 with font: 700 48px/1.2 Inter → one row with resolved triplet + count=1', () => {
    const el = makeElement({
      selector: 'h1',
      tagName: 'h1',
      text: 'Welcome',
      computedStyles: {
        fontFamily: 'Inter, sans-serif',
        fontSize: '48',
        fontWeight: '700',
        lineHeight: '1.2',
      },
    });
    const result = collectTypography(makeCtx([el]));
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.selector).toBe('h1');
    expect(row.family).toBe('Inter, sans-serif');
    expect(row.size_px).toBe(48);
    expect(row.weight).toBe(700);
    expect(row.line_height).toBe(1.2);
    expect(row.count).toBe(1);
  });

  it('50 identical <p> elements aggregate to ONE row with count=50 (fingerprint dedup)', () => {
    const els = Array.from({ length: 50 }, (_, i) =>
      makeElement({
        selector: `p:nth-of-type(${i + 1})`,
        tagName: 'p',
        text: `Para ${i}`,
        computedStyles: {
          fontFamily: 'Helvetica',
          fontSize: '16',
          fontWeight: '400',
          lineHeight: '1.5',
        },
      }),
    );
    const result = collectTypography(makeCtx(els));
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].count).toBe(50);
  });

  it('preserves the FULL font-family fallback chain as captured', () => {
    const el = makeElement({
      text: 'Hi',
      computedStyles: {
        fontFamily: '"Helvetica Neue", Arial, sans-serif',
        fontSize: '14',
      },
    });
    const result = collectTypography(makeCtx([el]));
    expect(result.rows[0].family).toBe('"Helvetica Neue", Arial, sans-serif');
  });

  it('font-weight keyword "bold" resolves to numeric 700', () => {
    const el = makeElement({
      text: 'Bold',
      computedStyles: { fontFamily: 'Arial', fontSize: '16', fontWeight: 'bold' },
    });
    const result = collectTypography(makeCtx([el]));
    expect(result.rows[0].weight).toBe(700);
  });

  it('line-height "normal" returns sentinel string "normal", not a guess', () => {
    const el = makeElement({
      text: 'Default lh',
      computedStyles: { fontFamily: 'Arial', fontSize: '16', lineHeight: 'normal' },
    });
    const result = collectTypography(makeCtx([el]));
    expect(result.rows[0].line_height).toBe('normal');
  });

  it('font-size 1.25rem with root 16px resolves to size_px=20 and exposes size_spec', () => {
    const el = makeElement({
      selector: '.lead',
      text: 'Lead text',
      computedStyles: { fontFamily: 'Arial', fontSize: '1.25rem' },
    });
    const ctx = makeCtx([el], 1920, 1080, {
      documentMeta: {
        rootFontSizePx: 16,
        rawSpecValues: { '.lead': { 'font-size': '1.25rem' } },
      },
    });
    const result = collectTypography(ctx);
    expect(result.rows[0].size_px).toBe(20);
    expect(result.rows[0].size_spec).toBe('1.25rem');
  });

  it('returns RESOLVED computed value, not "inherit", when fixture supplies resolved values', () => {
    // computedStyles in IBR's extract layer is always resolved (uses getComputedStyle),
    // so the sensor must accept "16" (resolved) and never store the spec literal "inherit".
    const el = makeElement({
      text: 'Inherited',
      computedStyles: { fontFamily: 'Georgia', fontSize: '16', fontWeight: '400' },
    });
    const result = collectTypography(makeCtx([el]));
    expect(result.rows[0].size_px).toBe(16);
    expect(result.rows[0].weight).toBe(400);
    expect(result.rows[0].family).toBe('Georgia');
  });

  it('flags font_loading_pending when documentMeta.fontsStatus is "loading"', () => {
    const el = makeElement({
      text: 'Pending font',
      computedStyles: { fontFamily: 'CustomFont', fontSize: '16' },
    });
    const ctx = makeCtx([el], 1920, 1080, {
      documentMeta: { fontsStatus: 'loading' },
    });
    const result = collectTypography(ctx);
    expect(result.font_loading_pending).toBe(true);
    expect(result.rows[0].font_loading_pending).toBe(true);
  });

  it('empty/no text-bearing elements → empty rows with data_unavailable:true', () => {
    const result = collectTypography(makeCtx([]));
    expect(result.rows).toEqual([]);
    expect(result.data_unavailable).toBe(true);
  });
});
