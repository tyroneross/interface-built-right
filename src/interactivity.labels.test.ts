/**
 * Integration regression test for the MISSING_LABEL false-positive class.
 *
 * Observed live on two unrelated pages (2026-08-31): the RossLabs Agent
 * Harness dashboard and a model-generated mockup both carried
 * `<textarea id="task" aria-label="Message the harness">`, and IBR reported
 * `Form field "#task" has no label` with the remediation "Add aria-label or
 * visible text content" -- advice to add the attribute that was already
 * there. The mockup also carried `<select id="qmodel" aria-label="...">` and
 * was flagged the same way.
 *
 * Cause: the form-field walk computed `label` from `label[for=id]` or a
 * wrapping `<label>` only, and never consulted the accessible name, even
 * though extract.ts already computes one correctly elsewhere.
 *
 * Counterexamples are asserted alongside: a field with NO labelling of any
 * kind must still be reported, because a check that passes everything is a
 * worse defect than the one being fixed.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { BrowserPool } from './engine/browser-pool.js'
import { CompatPage } from './engine/compat.js'
import { testInteractivity } from './interactivity.js'

const TEST_PAGE = `<!doctype html><html><body>
  <form id="composer">
    <!-- The live pattern: labelled by aria-label, no <label> element. -->
    <textarea id="task" aria-label="Message the harness"></textarea>
    <!-- Same, on a select. -->
    <select id="qmodel" aria-label="Model for this run"><option>a</option></select>
    <!-- Labelled by reference. -->
    <span id="pw-label">Passphrase</span>
    <input id="pw" type="text" aria-labelledby="pw-label">
    <!-- Classic label[for]. Already worked; must keep working. -->
    <label for="named">Session name</label>
    <input id="named" type="text">
    <!-- Wrapping label. Already worked; must keep working. -->
    <label>Notes <input id="wrapped" type="text"></label>
    <!-- Genuinely unlabelled. MUST still be reported. -->
    <input id="bare" type="text">
    <button type="submit">Run</button>
  </form>
</body></html>`

const TEST_URL = 'data:text/html,' + encodeURIComponent(TEST_PAGE)
const pool = new BrowserPool({ launchOptions: { headless: true } })

let missingLabel: string[]

beforeAll(async () => {
  const driver = await pool.acquire()
  try {
    await driver.navigate(TEST_URL)
    const result = await testInteractivity(new CompatPage(driver))
    missingLabel = result.issues
      .filter(i => i.type === 'MISSING_LABEL')
      .map(i => i.element)
  } finally {
    pool.release()
  }
}, 60_000)

afterAll(async () => { await pool.close() })

describe('interactivity MISSING_LABEL', () => {
  it('does not flag a textarea named by aria-label', () => {
    expect(missingLabel.join(' ')).not.toContain('task')
  })

  it('does not flag a select named by aria-label', () => {
    expect(missingLabel.join(' ')).not.toContain('qmodel')
  })

  it('does not flag an input named by aria-labelledby', () => {
    expect(missingLabel.join(' ')).not.toContain('pw')
  })

  it('still honours label[for] and a wrapping label', () => {
    expect(missingLabel.join(' ')).not.toContain('named')
    expect(missingLabel.join(' ')).not.toContain('wrapped')
  })

  it('still flags a field with no labelling of any kind', () => {
    expect(missingLabel.join(' ')).toContain('bare')
  })
})
