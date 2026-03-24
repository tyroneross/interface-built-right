/**
 * Integration tests for the Playwright compatibility adapter.
 * Verifies that CompatPage provides the same API surface IBR modules expect.
 */

import { describe, it, expect, afterAll } from 'vitest'
import { EngineDriver } from './driver.js'
import { CompatPage } from './compat.js'

const driver = new EngineDriver()
let page: CompatPage
let launched = false

async function ensureLaunched(): Promise<void> {
  if (!launched) {
    await driver.launch({ headless: true })
    page = new CompatPage(driver)
    launched = true
  }
}

afterAll(async () => {
  if (launched) await driver.close()
})

describe('CompatPage', () => {
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
