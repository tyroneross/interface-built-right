/**
 * Integration tests for the Playwright compatibility adapter.
 * Verifies that CompatPage provides the same API surface IBR modules expect.
 */

import { describe, it, expect, afterAll } from 'vitest'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { EngineDriver } from './driver.js'
import {
  CompatPage,
  buildEvaluateExpression,
  buildFunctionDeclaration,
  needsEvaluateNameHelper,
} from './compat.js'

const driver = new EngineDriver()
let page: CompatPage
let launched = false

async function ensureLaunched(): Promise<void> {
  if (!launched) {
    await driver.launch({ headless: true, userDataDir: '/tmp/ibr-compat-test-profile' })
    page = new CompatPage(driver)
    launched = true
  }
}

afterAll(async () => {
  if (launched) await driver.close()
})

describe('CompatPage', () => {
  it('wraps esbuild __name helpers in page evaluate expressions', () => {
    const fnStr = '() => { const local = __name(() => 42, "local"); return local(); }'

    expect(needsEvaluateNameHelper(fnStr)).toBe(true)
    expect(buildEvaluateExpression(fnStr)).toContain('const __name = (target) => target;')
    expect(buildEvaluateExpression(fnStr)).toContain(`return (${fnStr})();`)
  })

  it('wraps esbuild __name helpers in callFunctionOn declarations', () => {
    const fnStr = '(a, b) => { const add = __name((x, y) => x + y, "add"); return add(a, b); }'

    expect(buildFunctionDeclaration(fnStr)).toContain('function(...__ibrArgs)')
    expect(buildFunctionDeclaration(fnStr)).toContain('const __name = (target) => target;')
    expect(buildFunctionDeclaration(fnStr)).toContain(`return (${fnStr})(...__ibrArgs);`)
  })

  it('navigates with goto', async () => {
    await ensureLaunched()
    await page.goto('data:text/html,<h1>Compat Test</h1><button id="btn">Click</button><input id="inp" value="hello">')
    const title = await page.content()
    expect(title).toContain('Compat Test')
  }, 15000)

  it('evaluates string expressions', async () => {
    const result = await page.evaluate<number>('1 + 1')
    expect(result).toBe(2)
  })

  it('evaluates functions with args', async () => {
    const result = await page.evaluate(
      (a: unknown, b: unknown) => (a as number) + (b as number),
      3, 4,
    )
    expect(result).toBe(7)
  })

  it('queries elements with $()', async () => {
    const el = await page.$('h1')
    expect(el).not.toBeNull()
    const text = await el!.textContent()
    expect(text).toBe('Compat Test')
  })

  it('queries multiple elements with $$()', async () => {
    await page.goto('data:text/html,<ul><li>A</li><li>B</li><li>C</li></ul>')
    const elements = await page.$$('li')
    expect(elements.length).toBe(3)
  })

  it('takes screenshots', async () => {
    const buf = await page.screenshot()
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf[0]).toBe(0x89) // PNG magic
  })

  it('takes full-page screenshots', async () => {
    const buf = await page.screenshot({ fullPage: true })
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(100)
  })

  it('injects CSS via addStyleTag', async () => {
    await page.goto('data:text/html,<div id="test" style="color:red">Text</div>')
    await page.addStyleTag({ content: '#test { color: blue !important; }' })
    const color = await page.evaluate<string>(
      'getComputedStyle(document.getElementById("test")).color',
    )
    expect(color).toBe('rgb(0, 0, 255)')
  })

  it('waits for selector', async () => {
    await page.goto('data:text/html,<div id="exists">Here</div>')
    const el = await page.waitForSelector('#exists', { timeout: 5000 })
    expect(el).not.toBeNull()
  })

  it('gets text content', async () => {
    await page.goto('data:text/html,<p id="p1">Hello World</p>')
    const text = await page.textContent('#p1')
    expect(text).toBe('Hello World')
  })

  it('gets attributes', async () => {
    await page.goto('data:text/html,<a href="/test" class="link">Link</a>')
    const href = await page.getAttribute('a', 'href')
    expect(href).toBe('/test')
  })

  it('clicks elements', async () => {
    await page.goto('data:text/html,<button onclick="document.title=\'clicked\'">Go</button>')
    await page.click('button')
    const title = await page.title()
    expect(title).toBe('clicked')
  })

  it('fills inputs', async () => {
    await page.goto('data:text/html,<input id="inp" value="">')
    await page.fill('#inp', 'test value')
    const value = await page.evaluate<string>(
      'document.getElementById("inp").value',
    )
    expect(value).toBe('test value')
  })

  it('checks and unchecks', async () => {
    await page.goto('data:text/html,<input type="checkbox" id="cb">')
    await page.check('#cb')
    let checked = await page.evaluate<boolean>('document.getElementById("cb").checked')
    expect(checked).toBe(true)

    await page.uncheck('#cb')
    checked = await page.evaluate<boolean>('document.getElementById("cb").checked')
    expect(checked).toBe(false)
  })

  it('provides locator API', async () => {
    await page.goto('data:text/html,<button id="loc-btn" onclick="document.title=\'located\'">Locate Me</button>')
    const locator = page.locator('#loc-btn').filter({ visible: true }).first()
    await locator.click({ timeout: 5000 })
    const title = await page.title()
    expect(title).toBe('located')
  })

  it('exposes url()', async () => {
    expect(page.url()).toContain('data:')
  })

  it('handles keyboard.press without error', async () => {
    await page.goto('data:text/html,<input id="ki">')
    await page.click('#ki')
    // Verify press doesn't throw
    await page.keyboard.press('Enter')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Escape')
  })

  it('listens for console messages', async () => {
    const messages: string[] = []
    page.on('console', (msg) => {
      messages.push(msg.text())
    })
    await page.goto('data:text/html,<script>console.log("compat-console-test")</script>')
    await page.waitForTimeout(300)
    expect(messages.some(m => m.includes('compat-console-test'))).toBe(true)
  })
})

// ─── Actionability (live Chrome, E3-A / T-06) ──────────────────────────
//
// Exercises EngineDriver.click/type/fill directly (not through CompatPage,
// which has its own selector-based verbs — also covered below) against a
// real fixture page whose elements start non-actionable (hidden / disabled
// / moving / covered / not-yet-rendered / about-to-be-replaced) and only
// become actionable after a short timer. Proves the auto-wait folded into
// the verbs (src/engine/actionability.ts) actually waited — not just that
// the final state happens to be correct — by asserting the click/fill
// timestamp is >= the element's own "became actionable" timestamp, both
// recorded by the fixture page itself.
//
// Reuses this file's already-launched `driver` (via ensureLaunched()) so
// this chunk's live-Chrome coverage doesn't pay for a second Chrome process.

describe('EngineDriver actionability (live Chrome fixture)', () => {
  const fixtureUrl = pathToFileURL(join(__dirname, 'fixtures', 'actionability.html')).href

  async function events(): Promise<Array<{ name: string; t: number }>> {
    return (await driver.evaluate('window.__ibrEvents')) as Array<{ name: string; t: number }>
  }

  async function eventTime(name: string): Promise<number | undefined> {
    return (await events()).find((e) => e.name === name)?.t
  }

  it('click waits for a hidden (opacity:0) element to become visible before acting', async () => {
    await ensureLaunched()
    await driver.navigate(fixtureUrl, { waitFor: 'none' })
    const el = await driver.find('Hidden Button', { role: 'button' })
    expect(el).not.toBeNull()
    await driver.click(el!.id)
    const revealedAt = await eventTime('hidden-revealed')
    const clickedAt = await eventTime('hidden-clicked')
    expect(revealedAt).toBeDefined()
    expect(clickedAt).toBeDefined()
    expect(clickedAt!).toBeGreaterThanOrEqual(revealedAt!)
  }, 15000)

  it('click waits for a disabled element to become enabled before acting', async () => {
    await ensureLaunched()
    await driver.navigate(fixtureUrl, { waitFor: 'none' })
    const el = await driver.find('Disabled Button', { role: 'button' })
    expect(el).not.toBeNull()
    await driver.click(el!.id)
    const enabledAt = await eventTime('disabled-enabled')
    const clickedAt = await eventTime('disabled-clicked')
    expect(enabledAt).toBeDefined()
    expect(clickedAt!).toBeGreaterThanOrEqual(enabledAt!)
  }, 15000)

  it('click waits for a moving element to settle before acting', async () => {
    await ensureLaunched()
    await driver.navigate(fixtureUrl, { waitFor: 'none' })
    const el = await driver.find('Moving Button', { role: 'button' })
    expect(el).not.toBeNull()
    await driver.click(el!.id)
    const settledAt = await eventTime('moving-settled')
    const clickedAt = await eventTime('moving-clicked')
    expect(settledAt).toBeDefined()
    expect(clickedAt!).toBeGreaterThanOrEqual(settledAt!)
  }, 15000)

  it('click waits for a covered element to be uncovered before acting', async () => {
    await ensureLaunched()
    await driver.navigate(fixtureUrl, { waitFor: 'none' })
    const el = await driver.find('Covered Button', { role: 'button' })
    expect(el).not.toBeNull()
    await driver.click(el!.id)
    const uncoveredAt = await eventTime('covered-uncovered')
    const clickedAt = await eventTime('covered-clicked')
    expect(uncoveredAt).toBeDefined()
    expect(clickedAt!).toBeGreaterThanOrEqual(uncoveredAt!)
  }, 15000)

  it('waitForElement + click handle a delayed-render element that also fades in', async () => {
    await ensureLaunched()
    await driver.navigate(fixtureUrl, { waitFor: 'none' })
    const el = await driver.waitForElement('Delayed Button', { role: 'button', timeout: 5000 })
    await driver.click(el.id)
    const revealedAt = await eventTime('delayed-revealed')
    const clickedAt = await eventTime('delayed-clicked')
    expect(revealedAt).toBeDefined()
    expect(clickedAt!).toBeGreaterThanOrEqual(revealedAt!)
  }, 15000)

  it('click re-resolves a stale elementId after the target re-renders — never throws, never acts on the dead node', async () => {
    await ensureLaunched()
    await driver.navigate(fixtureUrl, { waitFor: 'none' })
    const el = await driver.find('Rerender Button', { role: 'button' })
    expect(el).not.toBeNull()
    // The original elementId's backendNodeId goes stale ~120ms into the
    // wait (the fixture replaces the DOM node). click() must re-resolve by
    // name+role and act on the replacement instead of throwing.
    await driver.click(el!.id)
    const swappedAt = await eventTime('rerender-swapped')
    const all = await events()
    const clickedOriginal = all.find((e) => e.name === 'rerender-clicked-original')
    const clickedFresh = all.find((e) => e.name === 'rerender-clicked-fresh')
    expect(swappedAt).toBeDefined()
    expect(clickedOriginal).toBeUndefined() // never landed on the dead node
    expect(clickedFresh).toBeDefined()
    expect(clickedFresh!.t).toBeGreaterThanOrEqual(swappedAt!)
  }, 15000)

  it('fill waits for a disabled input to become enabled before acting', async () => {
    await ensureLaunched()
    await driver.navigate(fixtureUrl, { waitFor: 'none' })
    const el = await driver.find('Fill Input', { role: 'textfield' })
    expect(el).not.toBeNull()
    await driver.fill(el!.id, 'hello')
    const enabledAt = await eventTime('fill-input-enabled')
    expect(enabledAt).toBeDefined()
    const value = await driver.evaluate('document.getElementById("fill-input").value')
    expect(value).toBe('hello')
  }, 15000)

  it('type waits for a hidden input to become visible before acting', async () => {
    await ensureLaunched()
    await driver.navigate(fixtureUrl, { waitFor: 'none' })
    const el = await driver.find('Type Input', { role: 'textfield' })
    expect(el).not.toBeNull()
    await driver.type(el!.id, 'hi')
    const revealedAt = await eventTime('type-input-revealed')
    expect(revealedAt).toBeDefined()
    const value = await driver.evaluate('document.getElementById("type-input").value')
    expect(value).toBe('hi')
  }, 15000)
})
