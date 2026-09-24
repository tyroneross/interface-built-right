/**
 * Integration regression test for the addEventListener false-positive class.
 *
 * Reported live on a real scan: 28 elements (e.g. `#rail-designer`,
 * `#start-btn`) were flagged `handler-integrity/fake-interactive` and
 * `NO_HANDLER` despite being real, working `<button>`s wired entirely with
 * `addEventListener`. `detectHandlers()` in src/extract.ts (in-page,
 * no CDP flags) can see React/Vue/Angular props and the `onclick`
 * property/attribute, but page JS has no public API to enumerate
 * addEventListener-registered listeners on itself — that gap is what this
 * pins.
 *
 * The same scan's `interactivity.buttons[].hasHandler` (src/interactivity.ts)
 * was true for these buttons, but only because `hasEventHandler` there
 * assumes every `<button>` is wired. That flag is deliberately NOT consumed
 * here — doing so would silence genuinely dead buttons, which the
 * `dead-btn` / `dead-div` fixtures below assert against.
 *
 * Fix: `extractInteractiveElements` now runs a second, CDP-only pass
 * (`enrichWithEventListeners`) that calls DevTools' `getEventListeners` via
 * `Runtime.evaluate({ includeCommandLineAPI: true })` — verified live to
 * work in IBR's headless Chrome — for every element `detectHandlers()`
 * found no handler on. A root-level (`document`/`document.body`) listener
 * must NOT rescue an otherwise-dead control (menu-dismissal listeners would
 * otherwise silence every dead button on the page); the `dead-btn` fixture
 * pins that with a real `document.addEventListener('click', ...)` present.
 *
 * The ancestor (delegation) walk only credits a `click` listener, not the
 * full activation-event list used for the element's OWN listener check. A
 * container `keydown` listener (a dialog's Escape handler, a page's keyboard
 * shortcuts) or `pointerdown` listener (a drag surface) does not re-dispatch
 * activation to descendants the way a real delegated `click` listener does,
 * so crediting it would mark every dead button inside that container as
 * handled. The `dead-in-dialog` fixture pins that: `#dialog` has ONLY a
 * `keydown` listener, and `#dead-in-dialog` inside it must still be flagged.
 *
 * Blocking 1 — React 17+ attaches its ONE delegated click listener to the
 * framework ROOT container (`#root`/`#__next`), not to `document`/
 * `document.body`. The ancestor walk above stops at `document.body`, so it
 * never reaches `document`, but it DOES reach and credit `#root` — a real
 * scan hit exactly this: every dead React button under `#root` was rescued
 * by React's own root-level listener, which is not delegation for THIS
 * button, it is React's internal dispatch plumbing having nothing to do with
 * whether the button itself is wired.
 *  - `react-dead-root`: `#root` carries `__reactContainer$...` (React's own
 *    marker for the container it was told to render into) AND a real click
 *    listener. The walk must stop at (and exclude) `#root` as soon as it
 *    recognizes the framework-root marker — never credit its listener as
 *    delegation to a descendant.
 *
 * Follow-up fix — the ancestor walk used to be skipped ENTIRELY whenever the
 * CANDIDATE element itself carried a framework marker (`__reactProps$...`),
 * on the theory that `detectHandlers()`'s framework-props check was already
 * authoritative for it. That theory over-reached: the framework-ROOT stop
 * above already closes the real false negative (React's own root-level
 * dispatch listener), and skipping the walk for every framework-managed node
 * ALSO threw away real, author-written native delegation attached to a
 * plain (non-root) ancestor via a ref (`ancestorRef.current.addEventListener
 * ('click', ...)`) — a legitimate pattern this enrichment should credit.
 * `react-props-delegated` pins the corrected behavior: the button carries
 * `__reactProps$...` with no onClick (so `detectHandlers()` alone still
 * calls it dead) AND its plain `.wrap` ancestor has a real native click
 * listener — that ancestor listener now legitimately counts as delegation.
 *
 * Non-blocking 6 — React itself never attaches a native DOM listener for
 * `onClick`/`onSubmit`; it stores the handler function on the fiber's props
 * object (`__reactProps$*.onClick`), so `getEventListeners()` sees nothing
 * there even though the framework fully intends to dispatch on click/submit
 * via its root-level listener. Crediting only NATIVE ancestor listeners thus
 * missed exactly this pattern: `<form onSubmit>` around a plain `<button
 * type="submit">`, or `<div onClick>` around a plain child button — both
 * real, working React apps, both previously flagged fake-interactive. Fixed
 * by also checking, at each ancestor (and at the closest `form` for a submit
 * button), whether it carries an own `__reactProps$*` key whose value has a
 * function `onClick` (or `onSubmit` for the form case). `react-onclick-child`
 * and `react-submit-in-form` pin the two credited shapes; `dead-under-props-
 * ancestor` (an ancestor `__reactProps$*` with no `onClick`, e.g. just
 * `{ className: 'x' }`) pins that a props object alone is not enough — it
 * must actually carry a function handler.
 *
 * Non-blocking 5 — a native form control (`<input>`, `<select>`, etc.)
 * activates on its own and needs no author click handler; a click listener
 * on one is typically analytics, not the thing making it interactive.
 * Before the fix, every non-`hasOnClick` element (including native tags)
 * was an enrichment candidate, so `<input type="text">` with an incidental
 * click listener got `hasOnClick` newly flipped true. `#tracked-input` pins
 * the exclusion: it carries a real click listener, but must come out of
 * extraction exactly as `detectHandlers()` left it.
 *
 * Round 3, item 4 — a submit button's form owner is not always its closest
 * ancestor: the `form="id"` attribute associates a button with a `<form>`
 * ANYWHERE in the document, outside the button's own subtree entirely (a
 * real, spec-defined pattern for a button rendered in a modal footer while
 * its `<form>` lives elsewhere in the DOM). The submit-listener check used
 * to look up the owning form via `closest('form')` only, which finds
 * nothing for an externally-associated button -- reporting a real, working,
 * `addEventListener('submit', ...)`-wired form's button as fake-interactive.
 * `#external-submit-btn` pins the fix: `el.form` resolves the `form="id"`
 * association even though the button sits outside `#ext-form` entirely.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BrowserPool } from './engine/browser-pool.js';
import { CompatPage } from './engine/compat.js';
import { extractInteractiveElements, analyzeElements } from './extract.js';
import { handlerIntegrityRules } from './rules/handler-integrity.js';
import type { EnhancedElement } from './schemas.js';
import type { PageLike } from './engine/page-like.js';
import type { RuleContext } from './rules/types.js';

const TEST_PAGE = `<!doctype html><html><head><style>
  [role=button] { cursor: pointer; }
</style></head><body>
  <button id="listener-btn">Own listener button</button>
  <div class="toolbar"><button id="delegated-btn" type="button">Delegated button</button></div>
  <button id="dead-btn" type="button">Dead button</button>
  <div role="button" id="dead-div">Dead div</div>
  <div id="dialog"><button id="dead-in-dialog" type="button">Dead in dialog</button></div>
  <div id="root"><button id="react-dead-root" type="button">React dead root</button></div>
  <div class="wrap"><button id="react-props-delegated" type="button">React props delegated</button></div>
  <input id="tracked-input" type="text" />
  <div id="clicky"><button id="react-onclick-child" type="button">React onclick child</button></div>
  <div id="form-root"><form id="react-form"><button id="react-submit-in-form" type="submit">React submit in form</button></form></div>
  <div id="no-onclick-wrap"><button id="dead-under-props-ancestor" type="button">Dead under props ancestor</button></div>
  <!-- Round 3, item 4: form="id" associates this button with #ext-form even
       though it is NOT a descendant of that form. -->
  <form id="ext-form"></form>
  <button id="external-submit-btn" type="submit" form="ext-form">External submit</button>
<script>
  document.getElementById('listener-btn').addEventListener('click', function () {});
  document.querySelector('.toolbar').addEventListener('click', function () {});
  // Root-level listener. Must NOT rescue #dead-btn -- see file header.
  document.addEventListener('click', function () {});
  // Non-click activation listener on a non-root ancestor. Must NOT rescue
  // #dead-in-dialog -- see file header.
  document.getElementById('dialog').addEventListener('keydown', function () {});

  // Blocking 1: a real framework-root marker + a real click listener on
  // that root. Must NOT rescue #react-dead-root -- see file header.
  var root = document.getElementById('root');
  root['__reactContainer$abc'] = {};
  root.addEventListener('click', function () {});

  // Follow-up fix: the element itself carries a React props marker (React
  // manages this node) but the props hold no onClick, and its plain
  // (non-root) ancestor has a REAL NATIVE click listener. This now counts
  // as legitimate delegation -- see file header.
  document.getElementById('react-props-delegated')['__reactProps$x'] = {};
  document.querySelector('.wrap').addEventListener('click', function () {});

  // Non-blocking 5: a real click listener on a native form control. Must
  // not newly flip #tracked-input's hasOnClick -- see file header.
  document.getElementById('tracked-input').addEventListener('click', function () {});

  // Non-blocking 6, case A: a plain non-root ancestor carries a React props
  // marker WITH a function onClick -- no native listener anywhere. Must
  // rescue #react-onclick-child via the reactProps-onClick ancestor check.
  document.getElementById('clicky')['__reactProps$k'] = { onClick: function () {} };

  // Non-blocking 6, case B: the closest <form> carries a React props marker
  // WITH a function onSubmit -- no native submit listener anywhere, and the
  // form sits under a framework-root-marked container (proving the
  // closest('form') check is independent of the ancestor walk's root stop).
  var formRoot = document.getElementById('form-root');
  formRoot['__reactContainer$fr'] = {};
  document.getElementById('react-form')['__reactProps$k'] = { onSubmit: function () {} };

  // Non-blocking 6, case C: an ancestor carries a React props marker with NO
  // onClick function (just unrelated props) -- must NOT rescue. Proves a
  // props object alone isn't enough; it must carry a function handler.
  document.getElementById('no-onclick-wrap')['__reactProps$k'] = { className: 'x' };

  // Round 3, item 4: a real submit listener on the form="id"-associated
  // form, which is NOT an ancestor of the button -- closest('form') alone
  // cannot find it.
  document.getElementById('ext-form').addEventListener('submit', function () {});
</script>
</body></html>`;

const TEST_URL = 'data:text/html,' + encodeURIComponent(TEST_PAGE);
const pool = new BrowserPool({ launchOptions: { headless: true } });
const fakeInteractiveRule = handlerIntegrityRules[0];

function ruleContext(elements: EnhancedElement[]): RuleContext {
  return {
    isMobile: false,
    viewportWidth: 1440,
    viewportHeight: 900,
    url: TEST_URL,
    allElements: elements,
  };
}

function fakeInteractiveFlags(elements: EnhancedElement[]): Set<string> {
  const ctx = ruleContext(elements);
  const flagged = new Set<string>();
  for (const el of elements) {
    if (fakeInteractiveRule.check(el, ctx)) flagged.add(el.text ?? el.selector);
  }
  return flagged;
}

function noHandlerMessages(elements: EnhancedElement[]): string {
  return analyzeElements(elements).issues
    .filter((i) => i.type === 'NO_HANDLER')
    .map((i) => i.message)
    .join(' | ');
}

let elements: EnhancedElement[];
let fakeInteractiveWithEnrichment: Set<string>;
let noHandlerWithEnrichment: string;

// Pre-fix control: same page, same extraction, but with the CDP enrichment
// capability withheld -- reproduces the reported defect so the "fixed"
// assertions above are proven to depend on the fix, not on the fixture.
let elementsNoEnrichment: EnhancedElement[];
let fakeInteractiveNoEnrichment: Set<string>;
let noHandlerNoEnrichment: string;

beforeAll(async () => {
  const driver = await pool.acquire();
  try {
    await driver.navigate(TEST_URL);

    const page = new CompatPage(driver);
    elements = await extractInteractiveElements(page);
    fakeInteractiveWithEnrichment = fakeInteractiveFlags(elements);
    noHandlerWithEnrichment = noHandlerMessages(elements);

    // Same page, `evaluateWithCommandLineAPI` withheld -- the enrichment
    // feature-detects via `typeof page.evaluateWithCommandLineAPI ===
    // 'function'`, so a plain object exposing only `evaluate` reproduces the
    // pre-fix code path without needing a second navigation.
    const bare = new CompatPage(driver);
    const noEnrichmentPage: PageLike = {
      goto: bare.goto.bind(bare),
      evaluate: bare.evaluate.bind(bare),
    } as unknown as PageLike;
    elementsNoEnrichment = await extractInteractiveElements(noEnrichmentPage);
    fakeInteractiveNoEnrichment = fakeInteractiveFlags(elementsNoEnrichment);
    noHandlerNoEnrichment = noHandlerMessages(elementsNoEnrichment);
  } finally {
    pool.release();
  }
}, 60_000);

afterAll(async () => { await pool.close(); });

describe('handler-integrity + NO_HANDLER audit — real listener detection (fixed)', () => {
  it('does not flag an addEventListener-wired button as fake-interactive', () => {
    expect(fakeInteractiveWithEnrichment.has('Own listener button')).toBe(false);
  });

  it('does not raise NO_HANDLER for an addEventListener-wired button', () => {
    expect(noHandlerWithEnrichment).not.toContain('Own listener button');
  });

  it('does not flag a button whose listener is delegated from a non-root ancestor', () => {
    expect(fakeInteractiveWithEnrichment.has('Delegated button')).toBe(false);
  });

  it('does not raise NO_HANDLER for a delegated-listener button', () => {
    expect(noHandlerWithEnrichment).not.toContain('Delegated button');
  });

  it('still flags a genuinely dead button, even with a root document click listener present', () => {
    expect(fakeInteractiveWithEnrichment.has('Dead button')).toBe(true);
    expect(noHandlerWithEnrichment).toContain('Dead button');
  });

  it('still flags a genuinely dead role=button div', () => {
    expect(fakeInteractiveWithEnrichment.has('Dead div')).toBe(true);
    expect(noHandlerWithEnrichment).toContain('Dead div');
  });

  it('still flags a dead button inside a container whose only listener is keydown, not click', () => {
    expect(fakeInteractiveWithEnrichment.has('Dead in dialog')).toBe(true);
    expect(noHandlerWithEnrichment).toContain('Dead in dialog');
  });

  it('Blocking 1: still flags a dead button under a React root, even though the root itself has a real click listener', () => {
    expect(fakeInteractiveWithEnrichment.has('React dead root')).toBe(true);
    expect(noHandlerWithEnrichment).toContain('React dead root');
  });

  it('Follow-up fix: does not flag a React-managed button (own __reactProps$ marker, no onClick) whose plain ancestor has a real native click listener -- that is legitimate delegation, not React root plumbing', () => {
    expect(fakeInteractiveWithEnrichment.has('React props delegated')).toBe(false);
  });

  it('Follow-up fix: does not raise NO_HANDLER for the React-props-managed, ancestor-delegated button', () => {
    expect(noHandlerWithEnrichment).not.toContain('React props delegated');
  });

  it('Non-blocking 5: does not newly set hasOnClick on a native form control with an incidental click listener', () => {
    const input = elements.find((el) => el.selector === '#tracked-input');
    expect(input).toBeDefined();
    expect(input?.interactive.hasOnClick).toBe(false);
    expect(input?.interactive.hasEventListener).toBeFalsy();
  });

  it('Non-blocking 6: does not flag a plain button whose non-root ancestor carries a React props onClick function (no native listener anywhere)', () => {
    expect(fakeInteractiveWithEnrichment.has('React onclick child')).toBe(false);
    expect(noHandlerWithEnrichment).not.toContain('React onclick child');
  });

  it('Non-blocking 6: does not flag a submit button whose closest form carries a React props onSubmit function, even nested under a framework-root-marked container', () => {
    expect(fakeInteractiveWithEnrichment.has('React submit in form')).toBe(false);
    expect(noHandlerWithEnrichment).not.toContain('React submit in form');
  });

  it('Non-blocking 6: still flags a dead button under an ancestor whose React props object carries no onClick function', () => {
    expect(fakeInteractiveWithEnrichment.has('Dead under props ancestor')).toBe(true);
    expect(noHandlerWithEnrichment).toContain('Dead under props ancestor');
  });

  it('Round 3, item 4: does not flag a form="id"-associated submit button whose externally-associated form has a real submit listener', () => {
    expect(fakeInteractiveWithEnrichment.has('External submit')).toBe(false);
    expect(noHandlerWithEnrichment).not.toContain('External submit');
  });
});

describe('pre-fix control — enrichment withheld reproduces the reported defect', () => {
  it('WITHOUT enrichment, the addEventListener-wired button IS misflagged as fake-interactive', () => {
    expect(fakeInteractiveNoEnrichment.has('Own listener button')).toBe(true);
  });

  it('WITHOUT enrichment, the addEventListener-wired button DOES raise NO_HANDLER', () => {
    expect(noHandlerNoEnrichment).toContain('Own listener button');
  });
});
