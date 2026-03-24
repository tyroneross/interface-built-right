/**
 * Integration tests for the IBR CDP browser engine.
 * Requires Chrome installed. Tests actual CDP communication.
 */

import { describe, it, expect, afterAll } from 'vitest'
import { EngineDriver } from './driver.js'

// Single driver instance shared across tests
const driver = new EngineDriver()
let launched = false

async function ensureLaunched(): Promise<void> {
  if (!launched) {
    await driver.launch({ headless: true, userDataDir: '/tmp/ibr-integration-test-profile' })
    launched = true
  }
}

afterAll(async () => {
  if (launched) {
    await driver.close()
  }
})

describe('EngineDriver integration', () => {
  it('launches Chrome and connects via CDP', async () => {
    await ensureLaunched()
    expect(driver.isLaunched).toBe(true)
  }, 15000)

  it('navigates to a data URL', async () => {
    await ensureLaunched()
    await driver.navigate('data:text/html,<h1>Hello IBR Engine</h1><button>Click Me</button>', { waitFor: 'load' })
    const title = await driver.title()
    expect(title).toBe('')  // data URLs have no title
  }, 15000)

  it('gets page content', async () => {
    const html = await driver.content()
    expect(html).toContain('Hello IBR Engine')
    expect(html).toContain('Click Me')
  })

  it('evaluates JavaScript expressions', async () => {
    const result = await driver.evaluate('1 + 2')
    expect(result).toBe(3)
  })

  it('evaluates functions with arguments', async () => {
    const result = await driver.evaluate(
      '(a, b) => a * b',
      6, 7,
    )
    expect(result).toBe(42)
  })

  it('takes viewport screenshots', async () => {
    const buf = await driver.screenshot()
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(100)
    // PNG magic bytes
    expect(buf[0]).toBe(0x89)
    expect(buf[1]).toBe(0x50) // P
    expect(buf[2]).toBe(0x4E) // N
    expect(buf[3]).toBe(0x47) // G
  })

  it('takes full-page screenshots', async () => {
    const buf = await driver.screenshot({ fullPage: true })
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(100)
  })

  it('gets AX tree snapshot', async () => {
    const elements = await driver.getSnapshot()
    expect(elements.length).toBeGreaterThan(0)
    // Should find the button
    const button = elements.find((e) => e.role === 'button')
    expect(button).toBeDefined()
    expect(button?.label).toBe('Click Me')
  })

  it('discovers interactive elements', async () => {
    const elements = await driver.discover({ filter: 'interactive' })
    expect(Array.isArray(elements)).toBe(true)
    const arr = elements as Array<{ role: string; label: string }>
    const button = arr.find((e) => e.role === 'button')
    expect(button).toBeDefined()
  })

  it('discovers and serializes elements', async () => {
    const output = await driver.discover({ filter: 'all', serialize: true })
    expect(typeof output).toBe('string')
    expect(output as string).toContain('button')
    expect(output as string).toContain('Click Me')
  })

  it('finds elements by name via queryAXTree', async () => {
    const el = await driver.find('Click Me', { role: 'button' })
    expect(el).not.toBeNull()
    expect(el?.role).toBe('button')
  })

  it('returns null for non-existent elements', async () => {
    const el = await driver.find('NonExistentElement12345')
    expect(el).toBeNull()
  })

  it('queries DOM via CSS selectors', async () => {
    const nodeId = await driver.querySelector('button')
    expect(nodeId).not.toBeNull()
    expect(typeof nodeId).toBe('number')
  })

  it('queries multiple DOM elements', async () => {
    await driver.navigate('data:text/html,<ul><li>A</li><li>B</li><li>C</li></ul>', { waitFor: 'load' })
    const nodeIds = await driver.querySelectorAll('li')
    expect(nodeIds.length).toBe(3)
  })

  it('gets text content via selector', async () => {
    const text = await driver.textContent('li:first-child')
    expect(text).toBe('A')
  })

  it('injects CSS', async () => {
    await driver.navigate('data:text/html,<div id="test" style="color:red">Text</div>', { waitFor: 'load' })
    await driver.addStyleTag('#test { color: blue !important; }')

    const color = await driver.evaluate(
      'getComputedStyle(document.getElementById("test")).color',
    )
    expect(color).toBe('rgb(0, 0, 255)')
  })

  it('handles CSS with special characters', async () => {
    // CSS with backticks, dollars, and newlines
    const css = `
      .test-class {
        content: "hello\`world";
        --var: 100px;
      }
    `
    // Should not throw
    await driver.addStyleTag(css)
  })

  it('captures console messages', async () => {
    driver.clearConsole()
    await driver.navigate('data:text/html,<script>console.log("hello from page"); console.error("test error");</script>', { waitFor: 'load' })

    // Small delay for console events
    await new Promise((r) => setTimeout(r, 200))

    const messages = driver.getConsoleMessages()
    const errors = driver.getConsoleErrors()

    expect(messages.length).toBeGreaterThan(0)
    expect(messages.some((m) => m.text.includes('hello from page'))).toBe(true)
    expect(errors.some((m) => m.text.includes('test error'))).toBe(true)
  })

  it('sets and clears viewport without error', async () => {
    await driver.navigate('data:text/html,<p>Viewport test</p>', { waitFor: 'load' })
    // Verify set/clear don't throw — actual viewport verification
    // requires a real HTTP page (data: URLs have quirks in headless)
    await driver.setViewport({ width: 375, height: 667, mobile: true })
    await driver.clearViewport()
    // Verify we can still interact after viewport changes
    const text = await driver.textContent('p')
    expect(text).toBe('Viewport test')
  })

  it('manages cookies', async () => {
    await driver.navigate('data:text/html,<p>Cookie test</p>', { waitFor: 'none' })
    await driver.clearCookies()

    const empty = await driver.getCookies()
    expect(empty.length).toBe(0)
  })

  it('reads actual URL after redirect', async () => {
    await driver.navigate('data:text/html,<p>URL test</p>', { waitFor: 'load' })
    expect(driver.url).toContain('data:')
  })

  // ─── LLM-Native: Observe ────────────────────────────────

  it('observes available actions', async () => {
    await driver.navigate('data:text/html,<button>Save</button><a href="#">Help</a><input type="text" aria-label="Search">', { waitFor: 'load' })
    const actions = await driver.observe()
    expect(actions.length).toBeGreaterThan(0)
    expect(actions.every(a => a.actions.length > 0)).toBe(true)
    expect(actions.every(a => a.serialized.length > 0)).toBe(true)
  })

  it('observes with intent filter', async () => {
    const actions = await driver.observe({ intent: 'save' })
    const saveAction = actions.find(a => a.label.toLowerCase().includes('save'))
    expect(saveAction).toBeDefined()
  })

  // ─── LLM-Native: Extract ───────────────────────────────

  it('extracts structured data from AX tree', async () => {
    await driver.navigate('data:text/html,<h1>Welcome</h1><input type="text" aria-label="Name" value="Alice"><button>Go</button>', { waitFor: 'load' })
    const result = await driver.extract({
      heading: { role: 'heading', extract: 'text' },
      nameValue: { role: 'textfield', label: 'name', extract: 'value' },
      hasButton: { role: 'button', extract: 'exists' },
    })
    expect(result.heading).toBe('Welcome')
    expect(result.nameValue).toBe('Alice')
    expect(result.hasButton).toBe(true)
  })

  it('extracts page metadata', async () => {
    const meta = await driver.extractMeta()
    expect(meta.headings).toContain('Welcome')
    expect(meta.buttons.length).toBeGreaterThan(0)
  })

  // ─── LLM-Native: Adaptive Modality ─────────────────────

  it('assesses understanding of well-structured page', async () => {
    await driver.navigate('data:text/html,<h1>Login</h1><label>Email<input type="email"></label><label>Password<input type="password"></label><button>Sign In</button>', { waitFor: 'load' })
    const score = await driver.assessUnderstanding()
    expect(score.score).toBeGreaterThan(0)
    expect(typeof score.needsScreenshot).toBe('boolean')
    expect(score.reasoning.length).toBeGreaterThan(0)
  })

  // ─── LLM-Native: Cache ─────────────────────────────────

  it('caches resolutions for repeated finds', async () => {
    await driver.navigate('data:text/html,<button>OK</button><button>Cancel</button>', { waitFor: 'load' })

    // First find — populates cache
    const first = await driver.find('OK', { role: 'button' })
    expect(first).not.toBeNull()

    // Second find — should hit cache
    const second = await driver.find('OK', { role: 'button' })
    expect(second).not.toBeNull()
    expect(second?.id).toBe(first?.id)

    // Verify cache has entries
    expect(driver.cacheStats.entries).toBeGreaterThan(0)
  })

  it('clears cache on navigation', async () => {
    await driver.navigate('data:text/html,<button>Test</button>', { waitFor: 'load' })
    await driver.find('Test')
    expect(driver.cacheStats.entries).toBeGreaterThan(0)

    await driver.navigate('data:text/html,<button>Other</button>', { waitFor: 'load' })
    expect(driver.cacheStats.entries).toBe(0)
  })
})
