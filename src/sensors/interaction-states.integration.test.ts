/**
 * Live-browser integration test for two interaction-states defects:
 *
 * D1 — `declarationsFromStyle` in css-extract.ts iterated `style.item(i)` and
 * kept `getPropertyValue(prop)` only when non-empty. For a shorthand written
 * with an unresolved `var()` (a "pending-substitution value"), Chrome
 * enumerates the LONGHANDS but returns "" for each of them, so the shorthand
 * vanished. Observed live: `.option:focus-visible` captured
 * `{outline-offset: '2px'}` and `.option:hover` captured `{}` — the
 * `outline` declaration itself was gone.
 *
 * D2 — `interactiveBaseSelectors` in interaction-states.ts put each
 * interactive element's OWN generated selector, tag, and classes into one
 * flat set, then reported every base string lacking an exact-string focus
 * rule. A universal `button:focus-visible {}` rule cleared the bare "button"
 * entry while a DIFFERENT entry in the same set — the element's own id
 * selector, or an id-less element's full structural DOM path — stayed
 * flagged. Real evidence: 27 findings including `#workspace-refresh`,
 * `button`, and a full structural path ending in `button.btn-primary`.
 *
 * D3 — `computeFocusMatches` in css-extract.ts resolved a focus rule's
 * matched elements from the BASE — everything left of the FIRST state
 * pseudo of any kind. For `.card:hover .card-btn:focus-visible`, the first
 * state pseudo encountered is `:hover` on `.card`, so the base is `.card`,
 * which matches the CARD, not `.card-btn` — the element the rule's outline
 * actually applies to. The button/link inside stayed falsely flagged as
 * missing a focus indicator. Fixed by stripping every state pseudo from the
 * selector part (`.card .card-btn`) instead of truncating at the first one.
 *
 * D4 (Blocking 2) — a declared `:focus`/`:focus-visible` rule was treated as
 * coverage regardless of what it actually declared, so a universal reset
 * like `*:focus { outline: none }` (real-world "kill the default outline"
 * CSS, decomposed live by Chrome to `{outline-color: initial,
 * outline-style: none, outline-width: initial}`) silenced every
 * missing-focus-indicator finding on the page, including on elements with
 * no OTHER focus rule at all. Fixed by `isFocusRemovalOnly` in
 * interaction-states.ts: a rule counts as coverage only if at least one
 * declaration is not a recognized outline/box-shadow removal value.
 *
 * Non-blocking 3 — `computeFocusMatches` (css-extract.ts) split
 * `selectorText` on EVERY comma, including one inside a functional pseudo's
 * argument list. `:where(a, button):focus-visible` shredded into
 * `:where(a` and `button):focus-visible` — neither parseable — so the rule
 * matched nothing and `#where-btn`/`#where-link` fell back to the (also
 * broken) base-only resolution. Separately, stripping state pseudos from
 * `.guarded:not(:disabled):focus-visible` left `.guarded:not()`, which
 * `querySelectorAll` rejects, so that rule ALSO matched nothing. Fixed by
 * `splitTopLevelCommas` (paren-depth-aware) and `EMPTY_FUNCTIONAL_PSEUDO_RE`
 * (strips the emptied-out `:not()`/`:is()`/`:where()`/`:has()` shell).
 *
 * Non-blocking 4 — `declarationsFromStyle`'s shorthand-recovery walk only
 * tried contiguous left-anchored prefixes of a longhand name
 * (`border-top-color` -> `border-top` -> `border`), never the "drop the
 * middle segment" shorthand `border-color` — which is the one that actually
 * exists as a settable property. `.recover-btn:focus-visible
 * {border-color: var(--accent)}` (unresolved var(), longhands read "") lost
 * the declaration entirely. Fixed by trying `${first}-${last}` before the
 * contiguous-prefix walk.
 *
 * This test runs the REAL extraction pipeline (extractInteractiveElements +
 * extractCssRulesAndMeta) against a real Chrome tab via CDP — not a fixture —
 * because both defects are properties of what the BROWSER reports for
 * `getPropertyValue` and `querySelectorAll`, which a hand-built
 * ExtractedCSSRule fixture cannot reproduce.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BrowserPool } from '../engine/browser-pool.js';
import { CompatPage } from '../engine/compat.js';
import { extractInteractiveElements } from '../extract.js';
import { extractCssRulesAndMeta } from './css-extract.js';
import { collectInteractionStates } from './interaction-states.js';
import type { SensorContext } from './types.js';
import type { InteractionStatesReport } from './interaction-states.js';

/**
 * D5 (truncation-collision false negative) — `buildStructuralSelector`
 * (css-extract.ts) and `generateSelector` (extract.ts) build a root-first
 * ancestor path and `.slice(0, 200)` it. Truncation drops the TAIL — the
 * element's own segment — so two sibling id-less controls under one long
 * ancestor chain (>200 chars of ancestor path alone) collide onto the exact
 * same selector string. `focusCoveredSelectors` (a plain string Set) cannot
 * tell them apart: crediting the real match for the covered sibling also
 * silently clears the UNCOVERED one, which never gets its own finding.
 * `nestDeep` below builds two such chains, each >200 chars of ancestor path
 * before either sibling's own segment is even reached, guaranteeing the
 * collision this fix targets.
 */
function nestDeep(prefix: string, depth: number, innerHtml: string): string {
  let html = innerHtml;
  for (let i = depth; i >= 1; i--) {
    html = `<div class="${prefix}-${i}">${html}</div>`;
  }
  return html;
}

// "mix": one sibling covered by a compound focus rule, the other with no
// focus rule at all — proves the false negative (uncovered sibling must
// still get its own finding). Uses <a href> rather than <button> so the
// page's PRE-EXISTING universal `button:focus-visible` rule (which covers
// every <button> regardless of class, real coverage, unrelated to this
// defect) can't accidentally cover these too.
const DEEP_MIX = nestDeep(
  'chain-mix',
  15,
  '<a href="#mix-covered" class="btn-mix-covered">MixCovered</a><a href="#mix-uncovered" class="btn-mix-uncovered">MixUncovered</a>',
);
// "both": both siblings covered by their own compound focus rules — proves
// no false positive is introduced by the group-coverage check.
const DEEP_BOTH = nestDeep(
  'chain-both',
  15,
  '<a href="#both-a" class="btn-both-a">BothA</a><a href="#both-b" class="btn-both-b">BothB</a>',
);
// "input-mix": a focus-covered <button> collides on the truncated key with
// an uncovered <input> — an <input> is a candidate in the wider
// `INTERACTIVE_SELECTORS` list but is NEVER a finding candidate per
// `isInteractiveElement` (no onclick/href, not button/a/role tag). The
// candidate set used to build `focusSelectorGroups` must mirror
// `isInteractiveElement`, not the wider list, or this uncoverable <input>
// drags a genuinely-covered <button> into the group and produces a false
// positive on the button.
// Uses <a href> rather than <button> for the covered sibling — a bare
// `button:focus-visible` rule already covers EVERY <button> via the legacy
// tag-name check (`hasFocus.get(tag)`), independent of the group logic this
// test targets. <a> has no such page-wide rule, so its only path to
// coverage is the class-scoped rule below plus (before the fix) the buggy
// group check.
const DEEP_INPUT_MIX = nestDeep(
  'chain-input',
  15,
  '<a href="#input-covered" class="btn-input-covered">InputCovered</a><input type="text" class="input-uncovered" />',
);
// "svg-icon": a real, focus-covered <a class="nav-link"> wraps an SVG icon
// using `<use href="#i">`. `<use>` (and `<link>`) also carry an `href`
// attribute, so a candidate selector including `[href]` matches it too —
// and since `<use>` is nested INSIDE the link, its full path is a superset
// of the link's, so both truncate to the byte-identical key once the link
// itself is already >200 chars deep. `<use>` has no focus rule and never
// will (SVG icons aren't focusable), so it must never be treated as a
// coverage-group candidate at all.
const DEEP_SVG_ICON = nestDeep(
  'chain-svg',
  15,
  '<a href="#svg-link" class="nav-link"><svg viewBox="0 0 24 24"><use href="#i"></use></svg></a>',
);

const TEST_PAGE = `<!doctype html><html><head><style>
  :root { --accent: #06c; }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .btn-primary:hover { filter: brightness(1.05); }
  a:hover { color: red; }
  .card:hover .card-btn:focus-visible { outline: 2px solid var(--accent); }
  /* D4: universal removal-only reset — must NOT count as coverage. */
  *:focus { outline: none; }
  /* Non-blocking 3: comma inside a functional pseudo's argument list.
     Scoped to two dedicated classes so it can't accidentally cover
     unrelated elements (e.g. #plain-link) used by other assertions. */
  :where(.where-target-a, .where-target-b):focus-visible { color: blue; }
  /* Non-blocking 3: state pseudo stripped from inside :not() leaves an
     empty shell that must be cleaned up, not left to throw. */
  .guarded:not(:disabled):focus-visible { outline: 2px solid var(--accent); }
  /* Non-blocking 4: "drop the middle segment" shorthand recovery. */
  .recover-btn:focus-visible { border-color: var(--accent); }
  /* D5: only ONE sibling of the deep "mix" chain gets a real focus rule. */
  .chain-mix-1 .btn-mix-covered:focus-visible { outline: 2px solid var(--accent); }
  /* D5: BOTH siblings of the deep "both" chain get real focus rules. */
  .chain-both-1 .btn-both-a:focus-visible { outline: 2px solid var(--accent); }
  .chain-both-1 .btn-both-b:focus-visible { outline: 2px solid var(--accent); }
  /* D6: the button is covered; the colliding <input> sibling has no rule. */
  .chain-input-1 .btn-input-covered:focus-visible { outline: 2px solid var(--accent); }
  /* f1: the link is covered; the <use> icon inside it never can be. */
  .chain-svg-1 .nav-link:focus-visible { outline: 2px solid var(--accent); }
</style></head><body>
  <button id="start-btn" class="btn-primary">Start</button>
  <div class="actions"><button class="btn-primary">Go</button></div>
  <a href="/x" id="plain-link">Plain link</a>
  <div class="card"><a href="#x" class="card-btn" id="card-btn">Card link</a></div>
  <div role="button" tabindex="0" id="plain-role-btn">Role button</div>
  <button id="where-btn" class="where-target-a">Where button</button>
  <a href="/where" id="where-link" class="where-target-b">Where link</a>
  <div role="button" tabindex="0" id="guarded-btn" class="guarded">Guarded</div>
  <button id="recover-btn" class="recover-btn">Recover</button>
  ${DEEP_MIX}
  ${DEEP_BOTH}
  ${DEEP_INPUT_MIX}
  ${DEEP_SVG_ICON}
</body></html>`;

const TEST_URL = 'data:text/html,' + encodeURIComponent(TEST_PAGE);
const pool = new BrowserPool({ launchOptions: { headless: true } });

let result: InteractionStatesReport;

beforeAll(async () => {
  const driver = await pool.acquire();
  try {
    await driver.navigate(TEST_URL);
    const page = new CompatPage(driver);
    // Same pairing scan.ts uses (src/scan.ts around the `extractCssRulesAndMeta`
    // call): interactive elements + structural elements both feed the sensor
    // context, cssRules/documentMeta ride along from the same extraction.
    const [elements, cssExtract] = await Promise.all([
      extractInteractiveElements(page),
      extractCssRulesAndMeta(page),
    ]);
    const ctx: SensorContext = {
      elements: [...elements, ...cssExtract.structuralElements],
      cssRules: cssExtract.cssRules,
      documentMeta: cssExtract.documentMeta,
      url: TEST_URL,
      viewport: { width: 1280, height: 800 },
    };
    result = collectInteractionStates(ctx);
  } finally {
    pool.release();
  }
}, 60_000);

afterAll(async () => {
  await pool.close();
});

describe('interaction-states integration — real browser', () => {
  it('D1: recovers the `outline` shorthand carrying the unresolved var() even though every longhand read ""', () => {
    const focusVisible = result.states.find(
      (s) => s.state === 'focus-visible' && s.selector === 'button',
    );
    expect(focusVisible).toBeDefined();
    expect(focusVisible?.properties.outline).toBeDefined();
    expect(focusVisible?.properties.outline).toContain('var(--accent)');
  });

  it('D2: does not flag #start-btn — a universal button:focus-visible rule covers it', () => {
    expect(result.findings.some((f) => f.selector === '#start-btn')).toBe(false);
  });

  it('D2: does not flag the id-less nested button under its structural path', () => {
    expect(
      result.findings.some((f) => f.selector.includes('btn-primary')),
    ).toBe(false);
  });

  it('counterexample: #plain-link IS flagged — it has a :hover rule and no declared focus rule at all', () => {
    expect(result.findings).toContainEqual({ selector: '#plain-link', missing: 'focus_indicator' });
  });

  it('D3: does not flag #card-btn — `.card:hover .card-btn:focus-visible` covers it even though the base-only resolution would resolve to `.card`', () => {
    expect(result.findings.some((f) => f.selector === '#card-btn')).toBe(false);
  });

  it('D4: *:focus{outline:none} is removal-only and does not clear #plain-role-btn, which has no other focus rule', () => {
    expect(result.findings).toContainEqual({ selector: '#plain-role-btn', missing: 'focus_indicator' });
  });

  it('Non-blocking 3: :where(.where-target-a, .where-target-b):focus-visible covers both #where-btn and #where-link — the top-level comma is not a selector-list break inside :where()', () => {
    expect(result.findings.some((f) => f.selector === '#where-btn')).toBe(false);
    expect(result.findings.some((f) => f.selector === '#where-link')).toBe(false);
  });

  it('Non-blocking 3: .guarded:not(:disabled):focus-visible covers #guarded-btn — the emptied :not() shell is cleaned up rather than left to throw', () => {
    expect(result.findings.some((f) => f.selector === '#guarded-btn')).toBe(false);
  });

  it('Non-blocking 4: recovers `border-color` from the unresolved var() even though every longhand read ""', () => {
    const focusVisible = result.states.find(
      (s) => s.state === 'focus-visible' && s.selector === '.recover-btn',
    );
    expect(focusVisible).toBeDefined();
    expect(focusVisible?.properties['border-color']).toBeDefined();
    expect(focusVisible?.properties['border-color']).toContain('var(--accent)');
    expect(result.findings.some((f) => f.selector === '#recover-btn')).toBe(false);
  });

  // D5 — the two siblings collide onto the same >200-char truncated
  // selector (a plain ancestor `div` path with no "btn-mix"/"btn-both"
  // reference at all, since truncation drops the buttons' own segment
  // entirely). Before the fix, `focusCoveredSelectors` credited the covered
  // sibling's real match to that shared string and BOTH siblings were
  // silently cleared — no finding for either, which is the false negative.
  it('D5: an uncovered sibling deep in an id-less DOM still gets its own finding, even though its truncated selector is identical to a covered sibling\'s', () => {
    expect(result.findings.some((f) => f.selector.startsWith('div.chain-mix-1'))).toBe(true);
  });

  it('D5: no false positive — when BOTH colliding siblings are genuinely covered, neither is reported', () => {
    expect(result.findings.some((f) => f.selector.startsWith('div.chain-both-1'))).toBe(false);
  });

  // D6 — the candidate set for `focusSelectorGroups` must mirror
  // `isInteractiveElement` (button/a/role-button/role-link/onclick/href),
  // not the wider `INTERACTIVE_SELECTORS` list that also covers
  // input/select/textarea/[tabindex]. An <input> is never a findings
  // candidate, so it must not be able to drag a genuinely-covered <button>
  // it collides with into an unsatisfiable coverage group.
  it('D6: an uncovered <input> colliding with a covered <button> does not produce a false positive on the button', () => {
    expect(result.findings.some((f) => f.selector.startsWith('div.chain-input-1'))).toBe(false);
  });

  // `[href]` also matches SVG `<use href>`/`<link href>`, and since the
  // <use> icon is nested INSIDE the covered <a>, both truncate to the SAME
  // key once the link is already >200 chars deep. The candidate set must
  // exclude non-XHTML-namespace elements (and drop bare `[href]`) so the
  // <use> can never join the coverage group and drag the real link down
  // with it.
  it('f1: an SVG <use href> icon nested inside a covered deep <a> does not produce a false positive on the link', () => {
    expect(result.findings.some((f) => f.selector.startsWith('div.chain-svg-1'))).toBe(false);
  });
});
