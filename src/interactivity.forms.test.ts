/**
 * Integration regression test for the FORM_NO_SUBMIT false-positive class.
 *
 * Reported live on the LLM Wiki Builder (2026-10-05): its only form is wired with
 * `form.addEventListener("submit", ...)`, which sets no attribute and no
 * `onsubmit` property, so the in-page check reported "Form has no submit handler
 * or action" for a form that works. Counterexample: a form with no listener,
 * action or submit button must still be reported.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { BrowserPool } from './engine/browser-pool.js'
import { CompatPage } from './engine/compat.js'
import { testInteractivity } from './interactivity.js'

const TEST_PAGE = `<!doctype html><html><body>
  <form id="listener-form"><input name="a" aria-label="a"></form>
  <form id="prop-form"><input name="b" aria-label="b"></form>
  <div id="delegate"><form id="delegated-form"><input name="c" aria-label="c"></form></div>
  <form id="inert-form"><input name="d" aria-label="d"></form>
<script>
  document.getElementById('listener-form').addEventListener('submit', function (e) { e.preventDefault() })
  document.getElementById('prop-form').onsubmit = function () { return false }
  document.getElementById('delegate').addEventListener('submit', function (e) { e.preventDefault() })
</script>
</body></html>`

const TEST_URL = 'data:text/html,' + encodeURIComponent(TEST_PAGE)
const pool = new BrowserPool({ launchOptions: { headless: true } })

let flagged: string[]

beforeAll(async () => {
  const driver = await pool.acquire()
  try {
    await driver.navigate(TEST_URL)
    const result = await testInteractivity(new CompatPage(driver))
    flagged = result.issues.filter(i => i.type === 'FORM_NO_SUBMIT').map(i => i.element)
  } finally {
    pool.release()
  }
}, 60_000)

afterAll(async () => {
  await pool.close()
})

describe('FORM_NO_SUBMIT detection', () => {
  it('sees a submit listener added with addEventListener', () => {
    expect(flagged).not.toContain('#listener-form')
  })
  it('sees an onsubmit property', () => {
    expect(flagged).not.toContain('#prop-form')
  })
  it('sees a delegated submit listener on an ancestor', () => {
    expect(flagged).not.toContain('#delegated-form')
  })
  it('still reports a form with no listener, action or submit button', () => {
    expect(flagged).toContain('#inert-form')
  })
})
