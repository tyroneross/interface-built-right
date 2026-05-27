import { describe, it, expect } from 'vitest';
import { collectBreakpoints } from './breakpoints.js';
import { makeCtx, makeStyleRule, makeMediaRule, makeContainerRule } from './test-fixtures.js';

describe('collectBreakpoints', () => {
  it('@media (min-width: 768px) with N inner rules → {type:"min-width", value_px:768, rule_count:N}', () => {
    const rule = makeMediaRule('(min-width: 768px)', [
      makeStyleRule('.a', { display: 'flex' }),
      makeStyleRule('.b', { padding: '8px' }),
      makeStyleRule('.c', { color: 'red' }),
    ]);
    const result = collectBreakpoints(makeCtx([], 1920, 1080, { cssRules: [rule] }));
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('min-width');
    expect(result[0].value_px).toBe(768);
    expect(result[0].rule_count).toBe(3);
  });

  it('@media (min-width: 768px) and (max-width: 1023px) → range with min+max', () => {
    const rule = makeMediaRule('(min-width: 768px) and (max-width: 1023px)', [
      makeStyleRule('.a', { display: 'block' }),
    ]);
    const result = collectBreakpoints(makeCtx([], 1920, 1080, { cssRules: [rule] }));
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('range');
    expect(result[0].min).toBe(768);
    expect(result[0].max).toBe(1023);
    expect(result[0].rule_count).toBe(1);
  });

  it('two stylesheets with identical (min-width: 1024px) dedupe to ONE entry with summed rule_count', () => {
    const r1 = makeMediaRule('(min-width: 1024px)', [
      makeStyleRule('.a', { display: 'flex' }),
      makeStyleRule('.b', { gap: '8px' }),
    ], 'https://example.com/site.css');
    const r2 = makeMediaRule('(min-width: 1024px)', [
      makeStyleRule('.c', { padding: '16px' }),
    ], 'https://example.com/theme.css');
    const result = collectBreakpoints(makeCtx([], 1920, 1080, { cssRules: [r1, r2] }));
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('min-width');
    expect(result[0].value_px).toBe(1024);
    expect(result[0].rule_count).toBe(3);
  });

  it('@container (min-width: 400px) → container-min-width with optional container_name', () => {
    const rule = makeContainerRule(
      '(min-width: 400px)',
      [makeStyleRule('.card', { display: 'grid' })],
      'sidebar',
    );
    const result = collectBreakpoints(makeCtx([], 1920, 1080, { cssRules: [rule] }));
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('container-min-width');
    expect(result[0].value_px).toBe(400);
    expect(result[0].container_name).toBe('sidebar');
    expect(result[0].rule_count).toBe(1);
  });

  it('page with no media queries → empty array (NOT an error)', () => {
    const result = collectBreakpoints(makeCtx([], 1920, 1080, { cssRules: [] }));
    expect(result).toEqual([]);
  });

  it('@media print is captured as type:"print" so callers can filter viewport vs non-viewport', () => {
    const rule = makeMediaRule('print', [
      makeStyleRule('.no-print', { display: 'none' }),
      makeStyleRule('body', { color: 'black' }),
    ]);
    const result = collectBreakpoints(makeCtx([], 1920, 1080, { cssRules: [rule] }));
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('print');
    expect(result[0].rule_count).toBe(2);
  });
});
