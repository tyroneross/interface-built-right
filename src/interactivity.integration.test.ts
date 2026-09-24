/**
 * Integration regression test for the NO_HANDLER false-positive class.
 *
 * Reported live on a real app (Style Calibrator, 2026-08-24): 22 of 29
 * elements IBR counts as buttons were reported "has no click handler" while
 * every one of them worked. The app builds its nav as
 * `<li role="button">` and wires each with `li.onclick = go`.
 *
 * hasEventHandler() read `el.getAttribute('onclick')`. Assigning the PROPERTY
 * creates no attribute, so the check returned false. Its semantic-element
 * escape hatch keys on `tagName === 'button'`, which an `<li role="button">`
 * never satisfies, so nothing rescued it.
 *
 * A measurement against the live page reproduced the count exactly -- 22 of 29
 * flagged by the old predicate, 0 by the fixed one -- which is what this test
 * pins in a fixture.
 *
 * Counterexamples are asserted alongside: a genuinely inert `<div role="button">`
 * must still be reported, because a predicate that passes everything is a worse
 * defect than the one being fixed.
 *
 * Second defect: `hasEventHandler`'s escape hatch went the OTHER way too --
 * it assumed every `<button>`, submit/button
 * `<input>`, and `<a>` with a resolved `.href` was wired, so a genuinely dead
 * `<button>` (`#real-button` below) reported `hasHandler: true` while
 * `extract.ts`'s NO_HANDLER audit and `handler-integrity/fake-interactive`
 * (both driven by a real DevTools `getEventListeners` probe) correctly
 * reported it dead -- one scan, two contradictory verdicts for the same
 * button. `<a href="#">` had the same problem from the other direction:
 * `.href` resolves `#` to a truthy absolute URL, so PLACEHOLDER_LINK could
 * never fire for a placeholder link at all. Fixed by deleting both
 * assumptions and running the same shared listener probe
 * (`probeActivationListeners`, src/handler-listeners.ts) extract.ts already
 * used, so all three lanes now agree on what "wired" means.
 *
 * Round 3, item 1 (blocking) — the shared listener probe credits React/Vue
 * props only on ANCESTORS (a real delegation pattern) and stops at the
 * framework root; it structurally cannot see a framework handler prop set
 * directly on the element ITSELF, since React/Vue never attach a native DOM
 * listener for onClick/onSubmit at all. `hasEventHandler` used to have no
 * check for this either, so `<button onClick>` / `<a href="#" onClick>` in
 * a React app read as NO_HANDLER / PLACEHOLDER_LINK here -- passing pre-fix
 * only because of the removed "assume every button/href is wired"
 * assumption. `#react-props-btn` / `#react-props-link` pin the fix (ported
 * from extract.ts's detectHandlers() for parity); `#react-props-no-onclick-btn`
 * pins that an unrelated props object alone is not enough.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { BrowserPool } from './engine/browser-pool.js'
import { CompatPage } from './engine/compat.js'
import { testInteractivity } from './interactivity.js'
import { extractInteractiveElements } from './extract.js'
import type { InteractivityResult } from './interactivity.js'
import type { EnhancedElement } from './schemas.js'

const TEST_PAGE = `<!doctype html><html><head><style>
  li[role=button], div[role=button] { cursor: pointer; }
</style></head><body>
  <ul id="nav">
    <!-- The live pattern: role=button on a non-button tag, wired by property. -->
    <li role="button" id="wired-prop">Baseline writing</li>
    <!-- Same, wired by attribute. Already worked; must keep working. -->
    <li role="button" id="wired-attr" onclick="void 0">Sentence rewrites</li>
    <!-- Genuinely inert. MUST still be reported. -->
    <div role="button" id="inert">Save</div>
  </ul>
  <!-- A genuinely dead <button>: no handler property/attribute, no
       addEventListener, no framework marker. Pre-fix, the tagName escape
       hatch assumed it was wired; post-fix it MUST be flagged, agreeing with
       extract.ts / handler-integrity's fake-interactive verdict for the same
       element. -->
  <button id="real-button">Submit</button>
  <!-- Wired entirely via addEventListener -- invisible to static detection,
       only recoverable via the shared getEventListeners probe. -->
  <button id="listener-btn" type="button">Has listener</button>
  <!-- Delegated from a non-root ancestor's click listener. -->
  <div class="toolbar"><button id="delegated-btn" type="button">Delegated</button></div>
  <!-- Dead, but sits on a page with a real document-level click listener --
       that root-level listener must NOT rescue it (see probe doc comment). -->
  <button id="dead-btn" type="button">Dead with doc listener</button>
  <!-- Submit button in a form with a real action: native credit (no JS
       needed at all) -- deliberately NOT something extract.ts credits; see
       the cross-lane exclusion below (documented, known divergence). -->
  <form id="real-form" action="/x"><button id="form-submit-btn" type="submit">Save</button></form>
  <!-- Placeholder link, genuinely dead. -->
  <a href="#" id="dead-link">Dead link</a>
  <!-- Placeholder link wired via addEventListener -- href alone must not
       rescue it (that was the second root-cause site: .href resolves "#" to
       a truthy absolute URL). -->
  <a href="#" id="wired-link">Wired link</a>
  <!-- Round 3, item 1: own-element React props marker WITH a function
       onClick -- no addEventListener anywhere. hasEventHandler must credit
       this directly; the shared probe cannot (it only checks ancestors). -->
  <button id="react-props-btn" type="button">React props button</button>
  <a href="#" id="react-props-link">React props link</a>
  <!-- Own-element React props marker with NO onClick -- must still be
       flagged; a props object alone isn't a handler. -->
  <button id="react-props-no-onclick-btn" type="button">React props no onClick</button>
  <details><summary id="disclosure">How it works</summary><p>body</p></details>
<script>
  document.getElementById('wired-prop').onclick = function () { void 0 }
  document.getElementById('listener-btn').addEventListener('click', function () {})
  document.querySelector('.toolbar').addEventListener('click', function () {})
  // Root-level listener. Must NOT rescue #dead-btn.
  document.addEventListener('click', function () {})
  document.getElementById('wired-link').addEventListener('click', function () {})
  document.getElementById('react-props-btn')['__reactProps$x'] = { onClick: function () {} }
  document.getElementById('react-props-link')['__reactProps$x'] = { onClick: function () {} }
  document.getElementById('react-props-no-onclick-btn')['__reactProps$y'] = { className: 'x' }
</script>
</body></html>`

const TEST_URL = 'data:text/html,' + encodeURIComponent(TEST_PAGE)
const pool = new BrowserPool({ launchOptions: { headless: true } })

let interactivity: InteractivityResult
let noHandler: string[]
let placeholderLinks: string[]
let extractElements: EnhancedElement[]

beforeAll(async () => {
  const driver = await pool.acquire()
  try {
    await driver.navigate(TEST_URL)
    // scan.ts wraps the driver the same way (src/scan.ts:420).
    const page = new CompatPage(driver)
    interactivity = await testInteractivity(page)
    noHandler = interactivity.issues
      .filter(i => i.type === 'NO_HANDLER')
      .map(i => i.element)
    placeholderLinks = interactivity.issues
      .filter(i => i.type === 'PLACEHOLDER_LINK')
      .map(i => i.element)
    extractElements = await extractInteractiveElements(page)
  } finally {
    pool.release()
  }
}, 60_000)

afterAll(async () => { await pool.close() })

describe('interactivity NO_HANDLER', () => {
  it('does not flag a role=button wired via the onclick PROPERTY', () => {
    expect(noHandler.join(' ')).not.toContain('wired-prop')
  })

  it('does not flag a role=button wired via the onclick ATTRIBUTE', () => {
    expect(noHandler.join(' ')).not.toContain('wired-attr')
  })

  it('does not flag a <summary>, which the browser wires itself', () => {
    expect(noHandler.join(' ')).not.toContain('disclosure')
  })

  it('still flags a genuinely inert div styled as a button', () => {
    expect(noHandler.join(' ')).toContain('inert')
  })
})

describe('interactivity NO_HANDLER — real listener probe', () => {
  it('flags a genuinely dead <button> that the old tagName assumption used to pass', () => {
    expect(noHandler.join(' ')).toContain('real-button')
    const btn = interactivity.buttons.find(b => b.selector === '#real-button')
    expect(btn?.hasHandler).toBe(false)
  })

  it('does not flag a button wired entirely via addEventListener', () => {
    expect(noHandler.join(' ')).not.toContain('listener-btn')
    const btn = interactivity.buttons.find(b => b.selector === '#listener-btn')
    expect(btn?.hasHandler).toBe(true)
  })

  it('does not flag a button whose listener is delegated from a non-root ancestor', () => {
    expect(noHandler.join(' ')).not.toContain('delegated-btn')
    const btn = interactivity.buttons.find(b => b.selector === '#delegated-btn')
    expect(btn?.hasHandler).toBe(true)
  })

  it('still flags a dead button even with a root document click listener present', () => {
    expect(noHandler.join(' ')).toContain('dead-btn')
    const btn = interactivity.buttons.find(b => b.selector === '#dead-btn')
    expect(btn?.hasHandler).toBe(false)
  })

  it('does not flag a submit button in a form with a real action (native credit, no JS needed)', () => {
    expect(noHandler.join(' ')).not.toContain('form-submit-btn')
    const btn = interactivity.buttons.find(b => b.selector === '#form-submit-btn')
    expect(btn?.hasHandler).toBe(true)
  })

  it('raises PLACEHOLDER_LINK for a genuinely dead href="#" link', () => {
    expect(placeholderLinks.join(' ')).toContain('dead-link')
  })

  it('does not raise PLACEHOLDER_LINK for an href="#" link wired via addEventListener', () => {
    expect(placeholderLinks.join(' ')).not.toContain('wired-link')
  })

  it('does not flag a button whose own React props marker carries a function onClick', () => {
    expect(noHandler.join(' ')).not.toContain('React props button')
    const btn = interactivity.buttons.find(b => b.selector === '#react-props-btn')
    expect(btn?.hasHandler).toBe(true)
  })

  it('does not raise PLACEHOLDER_LINK for a placeholder link whose own React props marker carries a function onClick', () => {
    expect(placeholderLinks.join(' ')).not.toContain('react-props-link')
    const link = interactivity.links.find(l => l.selector === '#react-props-link')
    expect(link?.hasHandler).toBe(true)
  })

  it('still flags a button whose own React props marker carries no onClick function', () => {
    expect(noHandler.join(' ')).toContain('React props no onClick')
    const btn = interactivity.buttons.find(b => b.selector === '#react-props-no-onclick-btn')
    expect(btn?.hasHandler).toBe(false)
  })
})

describe('interactivity vs extract cross-lane agreement', () => {
  // Native form-submit credit (`#form-submit-btn`) is a DELIBERATE, documented
  // divergence -- interactivity credits a submit button in a form with a real
  // `action` even with no JS anywhere; extract.ts/handler-integrity do not.
  // Excluded here on purpose.
  const buttonIds = ['wired-prop', 'wired-attr', 'inert', 'real-button', 'listener-btn', 'delegated-btn', 'dead-btn', 'react-props-btn', 'react-props-no-onclick-btn']

  it.each(buttonIds)('interactivity.buttons[%s].hasHandler agrees with extract\'s hasOnClick||hasHref verdict', (id) => {
    const interactivityBtn = interactivity.buttons.find(b => b.selector === `#${id}`)
    const extractEl = extractElements.find(e => e.id === id)
    expect(interactivityBtn, `interactivity has no entry for #${id}`).toBeDefined()
    expect(extractEl, `extract has no entry for #${id}`).toBeDefined()
    const extractVerdict = !!(extractEl!.interactive.hasOnClick || extractEl!.interactive.hasHref)
    expect(interactivityBtn!.hasHandler).toBe(extractVerdict)
  })
})
