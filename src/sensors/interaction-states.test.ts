import { describe, it, expect } from 'vitest';
import { collectInteractionStates } from './interaction-states.js';
import { makeCtx, makeStyleRule, makeMediaRule, makeButton, makeLink, makeElement } from './test-fixtures.js';

describe('collectInteractionStates', () => {
  it('.btn:hover { background:blue } → states entry with base ".btn", state "hover", properties', () => {
    const rules = [makeStyleRule('.btn:hover', { background: 'blue' })];
    const els = [makeButton('Save', { selector: '.btn' })];
    const result = collectInteractionStates(makeCtx(els, 1920, 1080, { cssRules: rules }));
    expect(result.states).toHaveLength(1);
    expect(result.states[0]).toMatchObject({
      selector: '.btn',
      state: 'hover',
      properties: { background: 'blue' },
    });
  });

  it('button with :hover but no :focus or :focus-visible → finding flags missing focus_indicator', () => {
    const rules = [makeStyleRule('.btn:hover', { background: 'blue' })];
    const els = [makeButton('Save', { selector: '.btn' })];
    const result = collectInteractionStates(makeCtx(els, 1920, 1080, { cssRules: rules }));
    expect(result.findings).toContainEqual({ selector: '.btn', missing: 'focus_indicator' });
  });

  it('all three states (:active, :disabled, :focus-visible) defined → all returned', () => {
    const rules = [
      makeStyleRule('.btn:active', { transform: 'scale(0.97)' }),
      makeStyleRule('.btn:disabled', { opacity: '0.5' }),
      makeStyleRule('.btn:focus-visible', { outline: '2px solid blue' }),
    ];
    const els = [makeButton('Save', { selector: '.btn' })];
    const result = collectInteractionStates(makeCtx(els, 1920, 1080, { cssRules: rules }));
    const observedStates = result.states.map((s) => s.state).sort();
    expect(observedStates).toEqual(['active', 'disabled', 'focus-visible']);
  });

  it('anchor with .link:hover but no .link:focus → finding flags missing focus_indicator', () => {
    const rules = [makeStyleRule('.link:hover', { color: 'red' })];
    const els = [makeLink('More', { selector: '.link' })];
    const result = collectInteractionStates(makeCtx(els, 1920, 1080, { cssRules: rules }));
    expect(result.findings).toContainEqual({ selector: '.link', missing: 'focus_indicator' });
  });

  it('page with no :hover styles anywhere → empty arrays (NOT an error)', () => {
    const rules = [
      makeStyleRule('.btn', { background: 'gray' }),
      makeStyleRule('p', { color: 'black' }),
    ];
    const result = collectInteractionStates(makeCtx([], 1920, 1080, { cssRules: rules }));
    expect(result.states).toEqual([]);
    expect(result.findings).toEqual([]);
  });

  it('@media (hover: hover) { .btn:hover { ... } } → state entry carries conditional_hover:true', () => {
    const rules = [
      makeMediaRule('(hover: hover)', [
        makeStyleRule('.btn:hover', { background: 'blue' }),
      ]),
    ];
    const els = [makeButton('Save', { selector: '.btn' })];
    const result = collectInteractionStates(makeCtx(els, 1920, 1080, { cssRules: rules }));
    expect(result.states).toHaveLength(1);
    expect(result.states[0].conditional_hover).toBe(true);
  });
});

/**
 * The class bridge was a regex asking for the class portion of a selector IF
 * that selector STARTS with a class. Both selector generators always
 * start with a tag name or `#id`, so that branch was unreachable in production
 * and `interactiveBases` held only DOM paths and bare tags.
 *
 * With no bridge from a CSS class to an element, the findings loop fell back to
 * a substring test on 'btn' / 'button' / 'link' — which failed in BOTH
 * directions on one fixture: a real `<button class="cta">` with `.cta:hover`
 * and no `:focus` produced no finding, while `.pill-btn:hover` produced one
 * with no such element anywhere on the page.
 *
 * Findings are now keyed to the ELEMENT's own selector (e.g. "button.cta"),
 * not to a base string pulled off a CSS rule (e.g. ".cta") — a rule's base is
 * only ever consulted internally to decide COVERAGE.
 */
describe('collectInteractionStates — findings must correspond to real elements', () => {
  const button = (selector: string, className: string) =>
    makeButton('Go', { selector, className });

  it('flags a hovered element whose class is not named "btn"', () => {
    const result = collectInteractionStates(makeCtx([button('button.cta', 'cta')], 1920, 1080, {
      cssRules: [makeStyleRule('.cta:hover', { background: '#ddd' })],
    }));
    expect(result.findings.some((f) => f.selector === 'button.cta')).toBe(true);
  });

  it('does NOT invent a finding for a selector with no element on the page', () => {
    const result = collectInteractionStates(makeCtx([button('button.cta', 'cta')], 1920, 1080, {
      cssRules: [
        makeStyleRule('.cta:hover', { background: '#ddd' }),
        makeStyleRule('.cta:focus', { outline: '2px solid' }),
        // A stylesheet rule for a component that is not rendered here.
        makeStyleRule('.pill-btn:hover', { background: '#ccc' }),
      ],
    }));
    expect(result.findings.some((f) => f.selector === '.pill-btn')).toBe(false);
    // (c) — reaffirmed: no element on the page carries that class at all, so
    // it cannot appear as a finding under any key.
    expect(result.findings.some((f) => f.selector.includes('pill-btn'))).toBe(false);
  });

  it('stays quiet when the element does declare a focus state', () => {
    const result = collectInteractionStates(makeCtx([button('button.cta', 'cta')], 1920, 1080, {
      cssRules: [
        makeStyleRule('.cta:hover', { background: '#ddd' }),
        makeStyleRule('.cta:focus-visible', { outline: '2px solid' }),
      ],
    }));
    expect(result.findings.some((f) => f.selector === 'button.cta')).toBe(false);
  });

  // (d) — legacy fallback (no focusMatches on the rule at all) still clears
  // an element via its class, proving the string-based path keeps working
  // for static/fixture SensorContexts that never ran a live DOM query.
  it('legacy fallback without focusMatches still clears .btn via class', () => {
    const result = collectInteractionStates(makeCtx([button('button.btn', 'btn')], 1920, 1080, {
      cssRules: [
        makeStyleRule('.btn:hover', { background: '#eee' }),
        makeStyleRule('.btn:focus', { outline: '2px solid blue' }),
      ],
    }));
    expect(result.findings).toEqual([]);
  });

  // (a) — a focus rule whose base ("[data-cta]") matches neither the
  // element's selector, tag, nor class (so the LEGACY string path cannot
  // cover it) still clears the element because its `focusMatches` (computed
  // in the browser via querySelectorAll against the live DOM) names it by
  // structural selector. Isolates the structural-match OR-branch.
  it('clears an id-keyed element named in the rule\'s focusMatches, with no legacy match available', () => {
    const result = collectInteractionStates(makeCtx(
      [makeButton('Start', { selector: '#start-btn', className: undefined })],
      1920,
      1080,
      {
        cssRules: [
          makeStyleRule(
            '[data-cta]:focus-visible',
            { outline: '2px solid var(--accent)' },
            undefined,
            ['#start-btn'],
          ),
        ],
      },
    ));
    expect(result.findings).toEqual([]);
  });

  // (b) — an element with NO matching focus rule at all (legacy or
  // structural) is still reported, keyed by its own real selector.
  it('reports an element with no matching focus rule by its own selector', () => {
    const result = collectInteractionStates(makeCtx(
      [makeButton('Other', { selector: '#other-btn', className: undefined })],
      1920,
      1080,
      { cssRules: [makeStyleRule('.unrelated:hover', { color: 'red' })] },
    ));
    expect(result.findings).toContainEqual({ selector: '#other-btn', missing: 'focus_indicator' });
  });
});

/**
 * Blocking 2 — `*:focus { outline: none }` and similar removal-only focus
 * rules were previously treated as coverage: any declared `:focus`/
 * `:focus-visible` rule cleared the element regardless of what it actually
 * declared. A universal reset rule that turns the outline OFF then silenced
 * every missing-focus-indicator finding on the page. A rule counts as
 * coverage only when at least one declaration is NOT a recognized
 * outline/box-shadow removal declaration.
 */
describe('collectInteractionStates — removal-only focus rules do not count as coverage', () => {
  it('*:focus{outline:none} with focusMatches covering the button does not clear the finding', () => {
    const result = collectInteractionStates(makeCtx(
      [makeButton('Go', { selector: 'button.cta', className: 'cta' })],
      1920,
      1080,
      {
        cssRules: [
          makeStyleRule('*:focus', { outline: 'none' }, undefined, ['button.cta']),
        ],
      },
    ));
    expect(result.findings).toContainEqual({ selector: 'button.cta', missing: 'focus_indicator' });
  });

  // Element is coverable ONLY via `focusMatches` — its selector ("div[role]")
  // matches neither the covering rule's base ("[data-widget]") nor the
  // removal-only rule's base (universal ":focus:not(:focus-visible)"), and
  // it carries no className, so the legacy tag/class string match cannot
  // clear it either way. Previously this test used `.btn` with a `.btn`
  // class, which the LEGACY string match alone already clears via its class
  // — the assertion passed whether or not `focusMatches`/`isFocusRemovalOnly`
  // did anything, so it never actually exercised the code path it claimed
  // to. Confirmed by temporarily reverting `computeFocusMatches`/
  // `focusMatches` handling: the `.btn` version still passed; this version
  // fails without it.
  it(':focus:not(:focus-visible){outline:none} does not cover an element coverable only via focusMatches, but a real focusMatches-backed :focus-visible rule does', () => {
    const result = collectInteractionStates(makeCtx(
      [makeElement({
        selector: 'div[role="button"]',
        tagName: 'div',
        className: undefined,
        a11y: { role: 'button', ariaLabel: null, ariaDescribedBy: null },
      })],
      1920,
      1080,
      {
        cssRules: [
          makeStyleRule(':focus:not(:focus-visible)', { outline: 'none' }, undefined, ['div[role="button"]']),
          makeStyleRule('[data-widget]:focus-visible', { outline: '2px solid var(--a)' }, undefined, ['div[role="button"]']),
        ],
      },
    ));
    expect(result.findings.some((f) => f.selector === 'div[role="button"]')).toBe(false);
  });

  it('.btn:focus{outline-offset:2px} alone is not coverage', () => {
    const result = collectInteractionStates(makeCtx(
      [makeButton('Save', { selector: '.btn', className: 'btn' })],
      1920,
      1080,
      {
        cssRules: [makeStyleRule('.btn:focus', { 'outline-offset': '2px' })],
      },
    ));
    expect(result.findings).toContainEqual({ selector: '.btn', missing: 'focus_indicator' });
  });

  it('a real outline value (recovered shorthand carrying var()) still counts as coverage', () => {
    const result = collectInteractionStates(makeCtx(
      [makeButton('Save', { selector: '.btn', className: 'btn' })],
      1920,
      1080,
      {
        cssRules: [
          makeStyleRule('.btn:focus-visible', { outline: '2px solid var(--accent)', 'outline-offset': '2px' }),
        ],
      },
    ));
    expect(result.findings.some((f) => f.selector === '.btn')).toBe(false);
  });

  it('the real evidence shape (outline-color/style/width all reset) is removal-only', () => {
    const result = collectInteractionStates(makeCtx(
      [makeButton('Save', { selector: '.field-input', className: 'field-input' })],
      1920,
      1080,
      {
        cssRules: [
          makeStyleRule('.field-input:focus', {
            'outline-color': 'initial',
            'outline-style': 'none',
            'outline-width': 'initial',
          }),
        ],
      },
    ));
    expect(result.findings).toContainEqual({ selector: '.field-input', missing: 'focus_indicator' });
  });

  it('a rule with no declarations at all is not coverage', () => {
    const result = collectInteractionStates(makeCtx(
      [makeButton('Save', { selector: '.btn', className: 'btn' })],
      1920,
      1080,
      { cssRules: [makeStyleRule('.btn:focus', {})] },
    ));
    expect(result.findings).toContainEqual({ selector: '.btn', missing: 'focus_indicator' });
  });
});

/**
 * Tailwind v3's `focus:outline-none` compiles to `outline: 2px solid
 * transparent; outline-offset: 2px` — verified live against headless Chrome
 * (see probe in the fix report): the shorthand decomposes to
 * `{outline-color: transparent, outline-style: solid, outline-width: 2px}`.
 * `outline-style: solid` and `outline-width: 2px` are not themselves removal
 * values, so without crediting a transparent `outline-color` the whole
 * declaration fell through to `default: return false` and was wrongly
 * treated as a real focus indicator, silencing the missing-focus finding.
 *
 * `outline: 0` was verified live too: it decomposes to `{outline-color:
 * initial, outline-style: initial, outline-width: 0px}` — every one of
 * those was already a recognized removal value before this fix; the test
 * below pins that it stays removal-only.
 */
describe('collectInteractionStates — transparent-outline and neutral-property removal', () => {
  it('outline: 2px solid transparent (decomposed longhands) is removal-only, even though outline-style is "solid" and outline-width is "2px"', () => {
    const result = collectInteractionStates(makeCtx(
      [makeButton('Save', { selector: '.tw-btn', className: 'tw-btn' })],
      1920,
      1080,
      {
        cssRules: [
          makeStyleRule('.tw-btn:focus', {
            'outline-color': 'transparent',
            'outline-style': 'solid',
            'outline-width': '2px',
          }),
        ],
      },
    ));
    expect(result.findings).toContainEqual({ selector: '.tw-btn', missing: 'focus_indicator' });
  });

  it('outline: 0 (decomposed to outline-color/-style: initial, outline-width: 0px) is removal-only', () => {
    const result = collectInteractionStates(makeCtx(
      [makeButton('Save', { selector: '.zero-btn', className: 'zero-btn' })],
      1920,
      1080,
      {
        cssRules: [
          makeStyleRule('.zero-btn:focus', {
            'outline-color': 'initial',
            'outline-style': 'initial',
            'outline-width': '0px',
          }),
        ],
      },
    ));
    expect(result.findings).toContainEqual({ selector: '.zero-btn', missing: 'focus_indicator' });
  });

  it('outline: none; cursor: pointer is still removal-only — cursor is neutral, not a blocker', () => {
    const result = collectInteractionStates(makeCtx(
      [makeButton('Save', { selector: '.cursor-btn', className: 'cursor-btn' })],
      1920,
      1080,
      {
        cssRules: [
          makeStyleRule('.cursor-btn:focus', { outline: 'none', cursor: 'pointer' }),
        ],
      },
    ));
    expect(result.findings).toContainEqual({ selector: '.cursor-btn', missing: 'focus_indicator' });
  });

  it('box-shadow: none; border-color: blue is NOT removal-only — border-color is a real, non-neutral indicator', () => {
    const result = collectInteractionStates(makeCtx(
      [makeButton('Save', { selector: '.border-btn', className: 'border-btn' })],
      1920,
      1080,
      {
        cssRules: [
          makeStyleRule('.border-btn:focus', { 'box-shadow': 'none', 'border-color': 'blue' }),
        ],
      },
    ));
    expect(result.findings.some((f) => f.selector === '.border-btn')).toBe(false);
  });

  it('a rule with ONLY neutral properties (cursor + transition longhands, no outline/box-shadow at all) is removal-only', () => {
    const result = collectInteractionStates(makeCtx(
      [makeButton('Save', { selector: '.neutral-only-btn', className: 'neutral-only-btn' })],
      1920,
      1080,
      {
        cssRules: [
          makeStyleRule('.neutral-only-btn:focus', {
            cursor: 'pointer',
            'transition-duration': '0.2s',
            'transition-property': 'outline-color',
          }),
        ],
      },
    ));
    expect(result.findings).toContainEqual({ selector: '.neutral-only-btn', missing: 'focus_indicator' });
  });
});

/**
 * `selectorText.split(',')` is a selector-list break at every comma,
 * including one inside a functional pseudo's argument list. For
 * `:where(a, .btn):focus-visible` that shreds into `:where(a` (no pseudo,
 * dropped) and ` .btn):focus-visible` (matches STATE_RE, but its "base" is
 * the malformed `.btn)` — an unbalanced paren, and the `a` alternative is
 * lost entirely). `splitTopLevelCommas` tracks paren depth so the comma
 * inside `:where(...)` is not treated as a selector-list separator, and the
 * whole thing survives as one part with base `:where(a, .btn)`.
 */
describe('collectInteractionStates — parseStateSelectors splits on top-level commas only', () => {
  it(':where(a, .btn):focus-visible yields exactly one state entry with the full :where(...) base intact', () => {
    const rules = [makeStyleRule(':where(a, .btn):focus-visible', { outline: '2px solid blue' })];
    const result = collectInteractionStates(makeCtx([], 1920, 1080, { cssRules: rules }));
    expect(result.states).toHaveLength(1);
    expect(result.states[0]).toMatchObject({ selector: ':where(a, .btn)', state: 'focus-visible' });
  });
});
