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

/**
 * `var()` in transition timing. Neither `parseTransitionEntry`'s time regex
 * nor its property-token fallback recognized `var(--dur)` — a shorthand or
 * longhand whose duration/delay is tokenized through a custom property was
 * indistinguishable from no transition at all (duration_ms stayed 0, the
 * zero-duration filter dropped it). See `resolveVars` / `buildCustomPropertyIndex`
 * in motion.ts.
 */
describe('collectMotion — var() in transition timing', () => {
  it('shorthand duration resolves from a :root-declared custom property', () => {
    const rules = [
      makeStyleRule(':root', { '--dur': '200ms' }),
      makeStyleRule('.btn', { transition: 'opacity var(--dur) ease' }),
    ];
    const result = collectMotion(makeCtx([], 1920, 1080, { cssRules: rules }));
    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0]).toMatchObject({
      selector: '.btn',
      property: 'opacity',
      duration_ms: 200,
      easing: 'ease',
    });
    expect(result.transitions[0].unresolved).toBeUndefined();
  });

  it('Tailwind v4 shape: longhand duration with nested var()+fallback resolves via the root-declared fallback target', () => {
    const rules = [
      // Real Tailwind v4 emits this inside `@layer theme` on `:root, :host`;
      // css-extract flattens @layer before this sensor ever sees the tree,
      // so the fixture is a plain style rule with that selector.
      makeStyleRule(':root, :host', { '--default-transition-duration': '150ms' }),
      makeStyleRule('.tw-btn', {
        'transition-property': 'color',
        'transition-duration': 'var(--tw-duration, var(--default-transition-duration))',
        'transition-timing-function': 'linear',
        'transition-delay': '0s',
      }),
    ];
    const result = collectMotion(makeCtx([], 1920, 1080, { cssRules: rules }));
    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0]).toMatchObject({
      selector: '.tw-btn',
      property: 'color',
      duration_ms: 150,
      easing: 'linear',
    });
    expect(result.transitions[0].unresolved).toBeUndefined();
  });

  it('an unresolvable var() (no declaration anywhere, no fallback) is kept, not filtered, with the raw token in `unresolved`', () => {
    const rules = [
      makeStyleRule('.mystery', { transition: 'opacity var(--never-declared) ease' }),
    ];
    const result = collectMotion(makeCtx([], 1920, 1080, { cssRules: rules }));
    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0].property).toBe('opacity');
    expect(result.transitions[0].duration_ms).toBe(0);
    expect(result.transitions[0].unresolved).toEqual(['var(--never-declared)']);
  });

  it('a var() with a fallback prefers the fallback target over a same-named non-root single-value declaration elsewhere on the page', () => {
    const rules = [
      // `.duration-300` only applies to elements that selector matches — for
      // `.transition` (an unrelated rule) this value says nothing about
      // intent, so the author's own fallback is the better answer even
      // though it happens to be the ONLY value declared for --tw-duration.
      makeStyleRule('.duration-300', { '--tw-duration': '300ms' }),
      makeStyleRule(':root', { '--default-transition-duration': '150ms' }),
      makeStyleRule('.transition', {
        transition: 'opacity var(--tw-duration, var(--default-transition-duration))',
      }),
    ];
    const result = collectMotion(makeCtx([], 1920, 1080, { cssRules: rules }));
    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0].duration_ms).toBe(150);
    expect(result.transitions[0].unresolved).toBeUndefined();
  });

  it('a var() with NO fallback still resolves via the single-declared-value-anywhere rule', () => {
    const rules = [
      makeStyleRule('.only-decl', { '--tw-duration': '300ms' }),
      makeStyleRule('.transition2', { transition: 'opacity var(--tw-duration)' }),
    ];
    const result = collectMotion(makeCtx([], 1920, 1080, { cssRules: rules }));
    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0].duration_ms).toBe(300);
    expect(result.transitions[0].unresolved).toBeUndefined();
  });

  it('an ambiguous custom property — two different non-root declared values — is left unresolved rather than guessed', () => {
    const rules = [
      makeStyleRule('.a', { '--x': '100ms' }),
      makeStyleRule('.b', { '--x': '200ms' }),
      makeStyleRule('.c', { transition: 'opacity var(--x)' }),
    ];
    const result = collectMotion(makeCtx([], 1920, 1080, { cssRules: rules }));
    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0].duration_ms).toBe(0);
    expect(result.transitions[0].unresolved).toEqual(['var(--x)']);
  });

  it('a declared custom-property cycle does not hang and terminates as unresolved', () => {
    const rules = [
      makeStyleRule(':root', { '--a': 'var(--b)', '--b': 'var(--a)' }),
      makeStyleRule('.cyclic', { transition: 'opacity var(--a) ease' }),
    ];
    const start = Date.now();
    const result = collectMotion(makeCtx([], 1920, 1080, { cssRules: rules }));
    expect(Date.now() - start).toBeLessThan(1000);
    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0].duration_ms).toBe(0);
    expect(result.transitions[0].unresolved?.length).toBeGreaterThan(0);
  });
});

/**
 * Review follow-up: `parseTransitionEntry`'s single left-to-right pass
 * misattributed a literal time when a var() token preceded it — e.g.
 * `var(--prop) 200ms ease` counted the var as filling the duration slot
 * (0ms) so the literal 200ms was misread as delay. Fixed rule: when the
 * entry contains a literal time, an unresolved var strictly between the
 * identifier property and that first literal time IS the duration
 * placeholder — every other var is a silent placeholder and
 * never fills a time slot. Only when the entry has NO literal time at all
 * does a var become "the duration" placeholder by the position rules below.
 */
describe('collectMotion — var() token misattribution (parseTransitionEntry)', () => {
  it('(1) a leading var() placeholder does not steal the duration slot from a literal time that follows it', () => {
    const rules = [makeStyleRule('.x', { transition: 'var(--prop) 200ms ease' })];
    const result = collectMotion(makeCtx([], 1920, 1080, { cssRules: rules }));
    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0].duration_ms).toBe(200);
    expect(result.transitions[0].delay_ms).toBe(0);
    expect(result.transitions[0].unresolved).toBeUndefined();
  });

  it('(2) no literal time at all + identifier present: the sole var() becomes the duration placeholder', () => {
    const rules = [makeStyleRule('.x', { transition: 'opacity var(--d) ease' })];
    const result = collectMotion(makeCtx([], 1920, 1080, { cssRules: rules }));
    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0].duration_ms).toBe(0);
    expect(result.transitions[0].unresolved).toEqual(['var(--d)']);
  });

  it('(3) a var() AFTER a literal time never displaces it into delay — literal times are authoritative', () => {
    const rules = [makeStyleRule('.x', { transition: 'opacity 200ms var(--e)' })];
    const result = collectMotion(makeCtx([], 1920, 1080, { cssRules: rules }));
    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0].duration_ms).toBe(200);
    expect(result.transitions[0].delay_ms).toBe(0);
    expect(result.transitions[0].unresolved).toBeUndefined();
  });

  it('(4) a single var() token alone (no literal time, no identifier) is the duration placeholder; property stays "all"', () => {
    const rules = [makeStyleRule('.x', { transition: 'var(--d)' })];
    const result = collectMotion(makeCtx([], 1920, 1080, { cssRules: rules }));
    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0].property).toBe('all');
    expect(result.transitions[0].duration_ms).toBe(0);
    expect(result.transitions[0].unresolved).toEqual(['var(--d)']);
  });

  it('(5) two var() tokens, no identifier, no literal time: the first is the property placeholder, the second is the duration', () => {
    const rules = [makeStyleRule('.x', { transition: 'var(--p) var(--d)' })];
    const result = collectMotion(makeCtx([], 1920, 1080, { cssRules: rules }));
    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0].duration_ms).toBe(0);
    expect(result.transitions[0].unresolved).toEqual(['var(--d)']);
  });

  it('(6) an unresolved var() sandwiched between the identifier property and the first literal time occupies duration; the literal time becomes delay', () => {
    const rules = [makeStyleRule('.x', { transition: 'opacity var(--dur) 50ms' })];
    const result = collectMotion(makeCtx([], 1920, 1080, { cssRules: rules }));
    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0].duration_ms).toBe(0);
    expect(result.transitions[0].delay_ms).toBe(50);
    expect(result.transitions[0].unresolved).toEqual(['var(--dur)']);
  });
});
