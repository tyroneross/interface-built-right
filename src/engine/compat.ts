/**
 * Playwright compatibility adapter.
 *
 * Provides a Page-like interface backed by EngineDriver's CDP.
 * This allows incremental migration — existing IBR modules can use
 * this adapter without being rewritten, while new code uses EngineDriver directly.
 *
 * NOT a full Playwright reimplementation. Only covers the subset IBR actually uses:
 * - page.evaluate(fn, args) / page.evaluate(expression)
 * - page.$(selector) / page.$$(selector)
 * - page.goto(url, options)
 * - page.screenshot(options)
 * - page.addStyleTag({ content })
 * - page.waitForSelector(selector, options)
 * - page.waitForTimeout(ms)
 * - page.content() / page.title() / page.textContent(selector)
 * - page.getAttribute(selector, attr)
 * - page.click(selector) / page.fill(selector, value)
 * - page.on('console', handler)
 * - page.keyboard.press(key)
 * - page.locator(selector)
 */

import { EngineDriver } from './driver.js'
import { writeFile, mkdir } from 'fs/promises'
import { dirname } from 'path'

/**
 * Element handle returned by $() and $$()
 */
export class CompatElementHandle {
  constructor(
    private driver: EngineDriver,
    private nodeId: number,
  ) {}

  async screenshot(options?: { path?: string; type?: string }): Promise<Buffer> {
    // Get box model for this nodeId, then clip screenshot
    const model = await this.driver.domDomain.getBoxModel(this.nodeId)
    const q = model.content
    const x = Math.min(q[0], q[2], q[4], q[6])
    const y = Math.min(q[1], q[3], q[5], q[7])

    const buf = await this.driver.page.screenshot({
      clip: { x, y, width: model.width, height: model.height },
    })

    if (options?.path) {
      await mkdir(dirname(options.path), { recursive: true })
      await writeFile(options.path, buf)
    }

    return buf
  }

  async textContent(): Promise<string | null> {
    const html = await this.driver.domDomain.getOuterHTML(this.nodeId)
    // Strip HTML tags for text content
    return html.replace(/<[^>]*>/g, '').trim() || null
  }

  async boundingBox(): Promise<{ x: number; y: number; width: number; height: number } | null> {
    try {
      const model = await this.driver.domDomain.getBoxModel(this.nodeId)
      const q = model.content
      return {
        x: Math.min(q[0], q[2], q[4], q[6]),
        y: Math.min(q[1], q[3], q[5], q[7]),
        width: model.width,
        height: model.height,
      }
    } catch {
      return null
    }
  }

  async getAttribute(name: string): Promise<string | null> {
    try {
      const attrs = await this.driver.domDomain.getAttributes(this.nodeId)
      return attrs[name] ?? null
    } catch {
      return null
    }
  }
}

/**
 * Minimal locator compatible with IBR's usage patterns.
 */
export class CompatLocator {
  // Visible filter stored for potential future use in resolveNode
  public visible = false

  constructor(
    private driver: EngineDriver,
    private selector: string,
  ) {}

  filter(options: { visible?: boolean }): CompatLocator {
    const loc = new CompatLocator(this.driver, this.selector)
    loc.visible = options.visible ?? false
    return loc
  }

  first(): CompatLocator {
    return this // querySelector already returns first match
  }

  async click(_options?: { timeout?: number; force?: boolean }): Promise<void> {
    const nodeId = await this.resolveNode(_options?.timeout)
    if (!nodeId) throw new Error(`Element not found: ${this.selector}`)
    // Use direct DOM click for reliability (matches Playwright behavior)
    await this.driver.runtimeDomain.callFunctionOn(
      '(sel) => { const el = document.querySelector(sel); if (el) el.click(); else throw new Error("Not found: " + sel); }',
      [this.selector],
    )
  }

  async fill(text: string, _options?: { timeout?: number }): Promise<void> {
    await this.driver.runtimeDomain.callFunctionOn(
      `(sel, val) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error('Not found: ' + sel);
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }`,
      [this.selector, text],
    )
  }

  async focus(_options?: { timeout?: number }): Promise<void> {
    await this.driver.runtimeDomain.callFunctionOn(
      '(sel) => { const el = document.querySelector(sel); if (el) el.focus(); }',
      [this.selector],
    )
  }

  async press(key: string, _options?: { timeout?: number }): Promise<void> {
    await this.focus()
    await this.driver.pressKey(key)
  }

  async pressSequentially(text: string, _options?: { delay?: number; timeout?: number }): Promise<void> {
    await this.focus()
    for (const char of text) {
      await this.driver.runtimeDomain.callFunctionOn(
        '(sel, ch) => { const el = document.querySelector(sel); if (el) { el.value += ch; el.dispatchEvent(new Event("input", { bubbles: true })); } }',
        [this.selector, char],
      )
    }
  }

  async waitFor(options?: { state?: string; timeout?: number }): Promise<void> {
    const timeout = options?.timeout ?? 30000
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
      const nodeId = await this.driver.querySelector(this.selector)
      if (nodeId) return
      await new Promise((r) => setTimeout(r, 100))
    }
    throw new Error(`Timed out waiting for ${this.selector}`)
  }

  private async resolveNode(timeout?: number): Promise<number | null> {
    const deadline = Date.now() + (timeout ?? 5000)
    while (Date.now() < deadline) {
      const nodeId = await this.driver.querySelector(this.selector)
      if (nodeId) return nodeId
      await new Promise((r) => setTimeout(r, 100))
    }
    return null
  }
}

type ConsoleHandler = (msg: { type: () => string; text: () => string }) => void

/**
 * Playwright-compatible Page interface backed by EngineDriver.
 */
export class CompatPage {
  private consoleHandlers: ConsoleHandler[] = []
  private consoleListening = false

  constructor(private driver: EngineDriver) {}

  async goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<void> {
    await this.driver.navigate(url, {
      waitFor: options?.waitUntil === 'networkidle' ? 'stable' : 'load',
      timeout: options?.timeout,
    })
  }

  async evaluate<T>(fnOrExpr: string | ((...args: unknown[]) => T), ...args: unknown[]): Promise<T> {
    if (typeof fnOrExpr === 'function') {
      // Serialize function to string
      const fnStr = fnOrExpr.toString()
      if (args.length > 0) {
        // If args is a single object (Playwright's common pattern), unwrap
        const actualArgs = args.length === 1 && typeof args[0] === 'object' && args[0] !== null
          ? Object.values(args[0] as Record<string, unknown>)
          : args
        return this.driver.evaluate(`(${fnStr})`, ...actualArgs) as Promise<T>
      }
      return this.driver.evaluate(`(${fnStr})()`) as Promise<T>
    }
    // String expression
    if (args.length > 0) {
      return this.driver.evaluate(fnOrExpr, ...args) as Promise<T>
    }
    return this.driver.evaluate(fnOrExpr) as Promise<T>
  }

  async $(selector: string): Promise<CompatElementHandle | null> {
    const nodeId = await this.driver.querySelector(selector)
    if (!nodeId) return null
    return new CompatElementHandle(this.driver, nodeId)
  }

  async $$(selector: string): Promise<CompatElementHandle[]> {
    const nodeIds = await this.driver.querySelectorAll(selector)
    return nodeIds.map((id) => new CompatElementHandle(this.driver, id))
  }

  async screenshot(options?: { path?: string; fullPage?: boolean; type?: string }): Promise<Buffer> {
    const buf = await this.driver.screenshot({
      fullPage: options?.fullPage,
    })
    if (options?.path) {
      await mkdir(dirname(options.path), { recursive: true })
      await writeFile(options.path, buf)
    }
    return buf
  }

  async addStyleTag(options: { content: string }): Promise<void> {
    await this.driver.addStyleTag(options.content)
  }

  async waitForSelector(selector: string, options?: { timeout?: number }): Promise<CompatElementHandle | null> {
    const timeout = options?.timeout ?? 30000
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
      const nodeId = await this.driver.querySelector(selector)
      if (nodeId) return new CompatElementHandle(this.driver, nodeId)
      await new Promise((r) => setTimeout(r, 100))
    }
    throw new Error(`Timed out waiting for selector: ${selector}`)
  }

  async waitForTimeout(ms: number): Promise<void> {
    await new Promise((r) => setTimeout(r, ms))
  }

  async waitForLoadState(_state?: string, _options?: { timeout?: number }): Promise<void> {
    // Best effort: wait for AX tree stability
    await this.driver.navigate(this.driver.url, { waitFor: 'stable', timeout: _options?.timeout ?? 10000 }).catch(() => {})
  }

  async waitForNavigation(): Promise<void> {
    // Wait a bit for navigation to settle
    await new Promise((r) => setTimeout(r, 500))
  }

  async content(): Promise<string> {
    return this.driver.content()
  }

  async title(): Promise<string> {
    return this.driver.title()
  }

  async textContent(selector: string): Promise<string | null> {
    return this.driver.textContent(selector)
  }

  async innerText(selector: string): Promise<string> {
    return this.driver.evaluate(
      '(sel) => { const el = document.querySelector(sel); return el ? el.innerText : ""; }',
      selector,
    ) as Promise<string>
  }

  async getAttribute(selector: string, name: string): Promise<string | null> {
    return this.driver.getAttribute(selector, name)
  }

  async click(selector: string, _options?: { timeout?: number }): Promise<void> {
    await this.driver.runtimeDomain.callFunctionOn(
      '(sel) => { const el = document.querySelector(sel); if (el) el.click(); else throw new Error("Not found: " + sel); }',
      [selector],
    )
  }

  async fill(selector: string, value: string): Promise<void> {
    await this.driver.runtimeDomain.callFunctionOn(
      `(sel, val) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error('Not found: ' + sel);
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }`,
      [selector, value],
    )
  }

  async type(selector: string, text: string, _options?: { delay?: number }): Promise<void> {
    // Focus the element first, then type
    await this.driver.runtimeDomain.callFunctionOn(
      '(sel) => { const el = document.querySelector(sel); if (el) el.focus(); }',
      [selector],
    )
    for (const char of text) {
      await this.driver.runtimeDomain.callFunctionOn(
        '(sel, ch) => { const el = document.querySelector(sel); if (el) { el.value += ch; el.dispatchEvent(new Event("input", { bubbles: true })); } }',
        [selector, char],
      )
    }
  }

  async check(selector: string): Promise<void> {
    await this.driver.runtimeDomain.callFunctionOn(
      '(sel) => { const el = document.querySelector(sel); if (el && !el.checked) el.click(); }',
      [selector],
    )
  }

  async uncheck(selector: string): Promise<void> {
    await this.driver.runtimeDomain.callFunctionOn(
      '(sel) => { const el = document.querySelector(sel); if (el && el.checked) el.click(); }',
      [selector],
    )
  }

  async selectOption(selector: string, value: string): Promise<void> {
    await this.driver.runtimeDomain.callFunctionOn(
      `(sel, val) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error('Not found: ' + sel);
        el.value = val;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }`,
      [selector, value],
    )
  }

  async hover(selector: string, _options?: { timeout?: number }): Promise<void> {
    const nodeId = await this.driver.querySelector(selector)
    if (!nodeId) throw new Error(`Element not found: ${selector}`)
    const center = await this.driver.domDomain.getElementCenter(nodeId)
    await this.driver.runtimeDomain.callFunctionOn(
      '(x, y) => { const el = document.elementFromPoint(x, y); if (el) el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true })); }',
      [center.x, center.y],
    )
  }

  locator(selector: string): CompatLocator {
    return new CompatLocator(this.driver, selector)
  }

  on(event: string, handler: ConsoleHandler): void {
    if (event === 'console') {
      this.consoleHandlers.push(handler)
      if (!this.consoleListening) {
        this.consoleListening = true
        this.driver.consoleDomain.onMessage((msg) => {
          const compatMsg = {
            type: () => msg.type,
            text: () => msg.text,
          }
          for (const h of this.consoleHandlers) h(compatMsg)
        })
      }
    }
  }

  url(): string {
    return this.driver.url
  }

  keyboard = {
    press: async (key: string): Promise<void> => {
      await this.driver.pressKey(key)
    },
  }
}
