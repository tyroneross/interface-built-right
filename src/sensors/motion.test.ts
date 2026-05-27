import { describe, it, expect } from 'vitest';
import { collectMotion } from './motion.js';
import { makeCtx, makeStyleRule, makeMediaRule, makeKeyframesRule } from './test-fixtures.js';

describe('collectMotion', () => {
  it('single-property transition extracts duration/easing/delay (delay=0)', () => {
    const rules = [makeStyleRule('.btn', { transition: 'opacity 200ms ease-out' })];
    const result = collectMotion(makeCtx([], 1920, 1080, { cssRules: rules }));
    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0]).toMatchObject({
      selector: '.btn',
      property: 'opacity',
      duration_ms: 200,
      easing: 'ease-out',
      delay_ms: 0,
    });
  });

  it('multi-property transition value produces TWO transition entries (comma-split)', () => {
    const rules = [makeStyleRule('.btn', { transition: 'opacity 200ms, transform 150ms' })];
    const result = collectMotion(makeCtx([], 1920, 1080, { cssRules: rules }));
    expect(result.transitions).toHaveLength(2);
    expect(result.transitions[0].property).toBe('opacity');
    expect(result.transitions[0].duration_ms).toBe(200);
    expect(result.transitions[1].property).toBe('transform');
    expect(result.transitions[1].duration_ms).toBe(150);
  });

  it('@keyframes pulse reports name + step_count + used_by_selectors', () => {
    const rules = [
      makeKeyframesRule('pulse', [
        { keyText: '0%', declarations: { opacity: '1' } },
        { keyText: '50%', declarations: { opacity: '0.5' } },
        { keyText: '100%', declarations: { opacity: '1' } },
      ]),
      makeStyleRule('.indicator', { animation: 'pulse 1s infinite' }),
    ];
    const result = collectMotion(makeCtx([], 1920, 1080, { cssRules: rules }));
    expect(result.keyframes).toHaveLength(1);
    expect(result.keyframes[0]).toMatchObject({
      name: 'pulse',
      step_count: 3,
      used_by_selectors: ['.indicator'],
    });
  });

  it('@media (prefers-reduced-motion: reduce) overrides land in reduced_motion_overrides, NOT transitions', () => {
    const rules = [
      makeStyleRule('.btn', { transition: 'opacity 200ms ease-out' }),
      makeMediaRule('(prefers-reduced-motion: reduce)', [
        makeStyleRule('*', { transition: 'none' }),
      ]),
    ];
    const result = collectMotion(makeCtx([], 1920, 1080, { cssRules: rules }));
    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0].selector).toBe('.btn');
    expect(result.reduced_motion_overrides).toHaveLength(1);
    expect(result.reduced_motion_overrides[0]).toMatchObject({
      selector: '*',
      overrides: ['transition: none'],
    });
  });

  it('page with no declared motion → all three fields empty arrays, not an error', () => {
    const result = collectMotion(makeCtx([], 1920, 1080, { cssRules: [] }));
    expect(result.transitions).toEqual([]);
    expect(result.keyframes).toEqual([]);
    expect(result.reduced_motion_overrides).toEqual([]);
  });

  it('inline style transition: extract layer passes selector="<inline>" — sensor preserves it for traceability', () => {
    const rules = [
      makeStyleRule('<inline>', { transition: 'transform 100ms linear' }, '<inline id="hero-cta">'),
    ];
    const result = collectMotion(makeCtx([], 1920, 1080, { cssRules: rules }));
    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0].selector).toBe('<inline>');
    expect(result.transitions[0].property).toBe('transform');
  });
});
