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
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { BrowserPool } from './engine/browser-pool.js'
import { CompatPage } from './engine/compat.js'
import { testInteractivity } from './interactivity.js'

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
  <!-- A real <button> with no handler: the tagName escape hatch passes it. -->
  <button id="real-button">Submit</button>
  <details><summary id="disclosure">How it works</summary><p>body</p></details>
<script>
  document.getElementById('wired-prop').onclick = function () { void 0 }
</script>
</body></html>`

const TEST_URL = 'data:text/html,' + encodeURIComponent(TEST_PAGE)
const pool = new BrowserPool({ launchOptions: { headless: true } })

let noHandler: string[]

beforeAll(async () => {
  const driver = await pool.acquire()
  try {
    await driver.navigate(TEST_URL)
    // scan.ts wraps the driver the same way (src/scan.ts:420).
    const result = await testInteractivity(new CompatPage(driver))
    noHandler = result.issues
      .filter(i => i.type === 'NO_HANDLER')
      .map(i => i.element)
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
