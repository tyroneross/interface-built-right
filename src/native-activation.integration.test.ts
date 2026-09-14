/**
 * Integration regression test for the native-activation false-positive
 * class.
 *
 * A `<button type="submit">` whose form has an `action`, a `formaction`
 * attribute, a `method="dialog"`/`formmethod="dialog"` submit, a
 * `type="reset"` button owned by a form, and a Popover API /
 * Invoker Commands trigger (`popovertarget` / `commandfor`) all activate
 * purely via native browser semantics — no author-written click handler,
 * no `addEventListener`, no framework props. `detectHandlers()` in
 * src/extract.ts sees none of these (there is genuinely no JS to see), so
 * the `NO_HANDLER` audit in `analyzeElements` and
 * `handler-integrity/fake-interactive` both reported these as dead
 * controls even though `interactivity.buttons[].hasHandler`
 * (`src/interactivity.ts`) reported them wired — one scan contradicted
 * itself about the same working markup.
 *
 * Fix: `extractInteractiveElements`'s static in-page pass now computes
 * `hasNativeActivation` per element (submit/reset/formaction/popover/
 * command-invoker checks) and folds it into `hasOnClick`, the same pattern
 * already used for `hasEventListener`/`hasDelegatedListener` — every
 * existing consumer agrees without per-consumer changes.
 * `handler-integrity/fake-interactive`'s `hasAnyHandler()` also checks
 * `hasNativeActivation` explicitly, for the same redundancy-on-purpose
 * reason documented there.
 *
 * Counterexamples are asserted alongside: a submit button in a form with no
 * `action`/`method`, a `type="reset"` button with no form owner, and a
 * `popovertarget` on a plain `<div role="button">` (the attribute only
 * means anything on `<button>`/`<input>`) must all still be flagged —
 * a predicate that rescues everything is a worse defect than the one this
 * fixes.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BrowserPool } from './engine/browser-pool.js';
import { CompatPage } from './engine/compat.js';
import { extractInteractiveElements, analyzeElements } from './extract.js';
import { handlerIntegrityRules } from './rules/handler-integrity.js';
import type { EnhancedElement } from './schemas.js';
import type { RuleContext } from './rules/types.js';

const TEST_PAGE = `<!doctype html><html><head></head><body>
  <form action="/x"><button id="form-submit-btn" type="submit">Save Form</button></form>
  <dialog open><form method="dialog"><button id="dialog-submit-btn">Close Dialog</button></form></dialog>
  <form><button id="formaction-btn" formaction="/y">Go FormAction</button></form>
  <form id="f2"><input name="a"><button id="reset-btn" type="reset">Reset Inline</button></form>
  <button id="reset-form-attr-btn" type="reset" form="f2">Reset Outside</button>
  <form action="/z"><input id="input-submit" type="submit" value="Send Input"></form>
  <button id="popover-btn" popovertarget="pop">Open Popover</button><div id="pop" popover>hi</div>
  <button id="command-btn" commandfor="dlg" command="show-modal">Open Command</button><dialog id="dlg">x</dialog>

  <form><button id="no-action-submit" type="submit">Nope Submit</button></form>
  <button id="orphan-reset" type="reset">Reset Orphan</button>
  <div role="button" id="div-popover" popovertarget="pop2" style="cursor:pointer">Fake Div</div><div id="pop2" popover>hi2</div>
</body></html>`;

const TEST_URL = 'data:text/html,' + encodeURIComponent(TEST_PAGE);
const pool = new BrowserPool({ launchOptions: { headless: true } });
const fakeInteractiveRule = handlerIntegrityRules.find((r) => r.id === 'handler-integrity/fake-interactive')!;

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

let elements: EnhancedElement[];
let fakeInteractive: Set<string>;
let noHandlerMessage: string;

beforeAll(async () => {
  const driver = await pool.acquire();
  try {
    await driver.navigate(TEST_URL);
    const page = new CompatPage(driver);
    elements = await extractInteractiveElements(page);
    fakeInteractive = fakeInteractiveFlags(elements);
    noHandlerMessage = analyzeElements(elements).issues
      .filter((i) => i.type === 'NO_HANDLER')
      .map((i) => i.message)
      .join(' | ');
  } finally {
    pool.release();
  }
}, 60_000);

afterAll(async () => { await pool.close(); });

function byId(id: string): EnhancedElement {
  const el = elements.find((e) => e.selector === `#${id}`);
  if (!el) throw new Error(`fixture element #${id} not found in extraction`);
  return el;
}

// [id, visible text] for every fixture that must be credited with native
// activation.
const positives: [string, string][] = [
  ['form-submit-btn', 'Save Form'],
  ['dialog-submit-btn', 'Close Dialog'],
  ['formaction-btn', 'Go FormAction'],
  ['reset-btn', 'Reset Inline'],
  ['reset-form-attr-btn', 'Reset Outside'],
  ['input-submit', 'Send Input'],
  ['popover-btn', 'Open Popover'],
  ['command-btn', 'Open Command'],
];

describe('native activation — positive cases (browser-driven, zero author JS)', () => {
  it.each(positives)('%s: hasOnClick and hasNativeActivation are both true', (id) => {
    const el = byId(id);
    expect(el.interactive.hasOnClick).toBe(true);
    expect(el.interactive.hasNativeActivation).toBe(true);
  });

  it.each(positives)('%s: not flagged NO_HANDLER', (_id, text) => {
    expect(noHandlerMessage).not.toContain(text);
  });

  it.each(positives)('%s: not flagged handler-integrity/fake-interactive', (_id, text) => {
    expect(fakeInteractive.has(text)).toBe(false);
  });
});

describe('native activation — negative cases (must still be flagged as dead)', () => {
  it('no-action-submit: submit button with no action/method has no native activation', () => {
    const el = byId('no-action-submit');
    expect(el.interactive.hasOnClick).toBe(false);
    expect(el.interactive.hasNativeActivation).toBeFalsy();
  });

  it('no-action-submit: still raises NO_HANDLER and fake-interactive', () => {
    expect(noHandlerMessage).toContain('Nope Submit');
    expect(fakeInteractive.has('Nope Submit')).toBe(true);
  });

  it('orphan-reset: reset button with no form owner has no native activation', () => {
    const el = byId('orphan-reset');
    expect(el.interactive.hasOnClick).toBe(false);
    expect(el.interactive.hasNativeActivation).toBeFalsy();
  });

  it('orphan-reset: still raises NO_HANDLER and fake-interactive', () => {
    expect(noHandlerMessage).toContain('Reset Orphan');
    expect(fakeInteractive.has('Reset Orphan')).toBe(true);
  });

  it('div-popover: popovertarget on a non-button/input tag grants no native activation', () => {
    const el = byId('div-popover');
    expect(el.interactive.hasNativeActivation).toBeFalsy();
  });

  it('div-popover: still raises NO_HANDLER and fake-interactive', () => {
    expect(noHandlerMessage).toContain('Fake Div');
    expect(fakeInteractive.has('Fake Div')).toBe(true);
  });
});
