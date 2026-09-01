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

/**
 * PRODUCTION SHAPE. Every test above passes `{ transition: '...' }` — the
 * shorthand — and every one of them passed while `motion.transitions` was
 * empty on every real page ever scanned.
 *
 * `declarationsFromStyle` (src/sensors/css-extract.ts) enumerates a
 * CSSStyleDeclaration with `style.item(i)`, which yields LONGHANDS and never
 * the shorthand the author typed. So `decls.transition` was always undefined
 * and `collectTransitionsFromStyle` always returned []. The fixtures were
 * richer than production, which is exactly how the third contrast copy
 * survived two audit passes.
 */
describe('collectMotion — longhand declarations, as the extractor emits them', () => {
  it('reconstructs a transition from its longhands', () => {
    const rules = [makeStyleRule('.anim', {
      'transition-property': 'opacity',
      'transition-duration': '0.2s',
      'transition-timing-function': 'ease-out',
      'transition-delay': '0.05s',
    })];
    const result = collectMotion(makeCtx([], 1920, 1080, { cssRules: rules }));
    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0]).toMatchObject({
      selector: '.anim',
      property: 'opacity',
      duration_ms: 200,
      easing: 'ease-out',
      delay_ms: 50,
    });
  });

  it('cycles shorter longhand lists across multiple properties, per spec', () => {
    const rules = [makeStyleRule('.multi', {
      'transition-property': 'opacity, transform',
      'transition-duration': '0.2s',
      'transition-timing-function': 'linear',
      'transition-delay': '0s',
    })];
    const result = collectMotion(makeCtx([], 1920, 1080, { cssRules: rules }));
    expect(result.transitions).toHaveLength(2);
    expect(result.transitions.map((t) => t.property)).toEqual(['opacity', 'transform']);
    expect(result.transitions.every((t) => t.duration_ms === 200)).toBe(true);
  });

  // Chrome emits `transition-property: all; transition-duration: 0s` on
  // elements that declare no transition at all. Reporting those would bury the
  // real ones under one entry per rule on the page.
  it('does not report the browser default of a zero-duration transition', () => {
    const rules = [makeStyleRule('.plain', {
      'transition-property': 'all',
      'transition-duration': '0s',
      'transition-delay': '0s',
    })];
    const result = collectMotion(makeCtx([], 1920, 1080, { cssRules: rules }));
    expect(result.transitions).toHaveLength(0);
  });
});
