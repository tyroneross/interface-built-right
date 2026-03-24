/**
 * EngineDriver — high-level browser automation for LLM-driven UI validation.
 * Orchestrates CDP domains into a purpose-built API.
 */

import { CdpConnection } from './cdp/connection.js'
import { BrowserManager, type BrowserOptions } from './cdp/browser.js'
import { TargetDomain } from './cdp/target.js'
import { PageDomain, type ScreenshotOptions } from './cdp/page.js'
import { AccessibilityDomain } from './cdp/accessibility.js'
import { DomDomain } from './cdp/dom.js'
import { InputDomain } from './cdp/input.js'
import { RuntimeDomain } from './cdp/runtime.js'
import { CssDomain } from './cdp/css.js'
import { SnapshotDomain, type CaptureSnapshotResult } from './cdp/snapshot.js'
import { EmulationDomain, type ViewportConfig } from './cdp/emulation.js'
import { NetworkDomain, type Cookie, type SetCookieParams } from './cdp/network.js'
import { ConsoleDomain, type ConsoleMessage } from './cdp/console.js'
import { waitForStableTree, waitForStable } from './cdp/wait.js'
import type { Element, Snapshot } from './types.js'
import { serializeSnapshot } from './serialize.js'
import { observe, type ActionDescriptor, type ObserveOptions } from './observe.js'
import { extractFromAXTree, extractList, extractPageMeta, type ExtractSchema, type ExtractResult } from './extract.js'
import { ResolutionCache, type CacheOptions } from './cache.js'
import { assessUnderstanding, type UnderstandingScore, type ModalityOptions } from './modality.js'

export interface LaunchOptions extends BrowserOptions {
  viewport?: ViewportConfig
}

export type WaitStrategy = 'stable' | 'load' | 'none'

export interface NavigateOptions {
  waitFor?: WaitStrategy     // default: 'stable'
  timeout?: number           // wait timeout in ms
}

export interface DiscoverOptions {
  /** Filter elements: 'interactive' (buttons, links, inputs), 'leaf' (user-facing), 'all' */
  filter?: 'interactive' | 'leaf' | 'all'
  /** Enable chunking for context window limits */
  chunk?: boolean
  /** Max tokens budget for chunked output (approximate) */
  maxTokens?: number
  /** Return compact serialized format instead of raw elements */
  serialize?: boolean
}

export interface FindOptions {
  role?: string
}

export interface CaptureStateOptions {
  computedStyles?: string[]
  includeAXTree?: boolean
  includeScreenshot?: boolean
}

export interface CapturedState {
  domSnapshot?: CaptureSnapshotResult
  axTree?: Element[]
  screenshot?: Buffer
  url: string
  timestamp: number
}

export class EngineDriver {
  private browser = new BrowserManager()
  private conn = new CdpConnection()
  // Resolution cache initialized in constructor or with defaults
  private target!: TargetDomain
  private _page!: PageDomain
  private ax!: AccessibilityDomain
  private dom!: DomDomain
  private input!: InputDomain
  private runtime!: RuntimeDomain
  private css!: CssDomain
  private snapshot!: SnapshotDomain
  private emulation!: EmulationDomain
  private network!: NetworkDomain
  private console!: ConsoleDomain

  private targetId: string | null = null
  private sessionId: string | null = null
  private currentUrl = ''
  private launched = false
  private resolutionCache = new ResolutionCache()

  // ─── Lifecycle ──────────────────────────────────────────

  async launch(options: LaunchOptions = {}): Promise<void> {
    const wsUrl = await this.browser.launch(options)
    await this.conn.connect(wsUrl)
    this.target = new TargetDomain(this.conn)
    this.launched = true

    // Create initial page
    this.targetId = await this.target.createPage('about:blank')
    this.sessionId = await this.target.attach(this.targetId)

    // Initialize domains with session
    this._page = new PageDomain(this.conn, this.sessionId)
    this.ax = new AccessibilityDomain(this.conn, this.sessionId)
    this.dom = new DomDomain(this.conn, this.sessionId)
    this.input = new InputDomain(this.conn, this.sessionId)
    this.runtime = new RuntimeDomain(this.conn, this.sessionId)
    this.css = new CssDomain(this.conn, this.sessionId)
    this.snapshot = new SnapshotDomain(this.conn, this.sessionId)
    this.emulation = new EmulationDomain(this.conn, this.sessionId)
    this.network = new NetworkDomain(this.conn, this.sessionId)
    this.console = new ConsoleDomain(this.conn, this.sessionId)

    // Enable required domains
    await this._page.enableLifecycleEvents()
    await this.ax.enable()
    await this.console.enable()

    // Set viewport if specified
    if (options.viewport) {
      await this.emulation.setDeviceMetrics(options.viewport)
    }
  }

  async close(): Promise<void> {
    if (this.targetId) {
      await this.target.close(this.targetId).catch(() => {})
      this.targetId = null
    }
    await this.conn.close()
    await this.browser.close()
    this.launched = false
  }

  get isLaunched(): boolean {
    return this.launched
  }

  // ─── Navigation ─────────────────────────────────────────

  async navigate(url: string, options: NavigateOptions = {}): Promise<void> {
    const waitFor = options.waitFor ?? 'stable'
    await this._page.navigate(url)

    if (waitFor === 'stable') {
      await waitForStable(
        this.conn,
        () => this.ax.getSnapshot(),
        { timeout: options.timeout ?? 10000, eventName: 'Accessibility.nodesUpdated' },
      )
    } else if (waitFor === 'load') {
      await waitForStableTree(
        () => this.ax.getSnapshot(),
        { timeout: options.timeout ?? 10000 },
      )
    }
    // 'none' — return immediately

    // Read actual URL after navigation (handles redirects)
    this.currentUrl = await this.runtime.evaluate('location.href') as string ?? url

    // Clear resolution cache on navigation (element IDs change)
    this.resolutionCache.clear()
  }

  get url(): string {
    return this.currentUrl
  }

  // ─── Element Discovery (LLM-native) ────────────────────

  /**
   * Discover elements on the page with filtering and chunking.
   * Designed for LLM context windows — returns only actionable elements.
   */
  async discover(options: DiscoverOptions = {}): Promise<Element[] | string> {
    const filter = options.filter ?? 'interactive'
    const elements = await this.ax.getSnapshot()

    let filtered: Element[]
    switch (filter) {
      case 'interactive':
        filtered = elements.filter((e) => e.actions.length > 0)
        break
      case 'leaf':
        // Leaf elements: have a label (user-facing) and are not groups
        filtered = elements.filter((e) => e.label && e.role !== 'group')
        break
      case 'all':
      default:
        filtered = elements
    }

    if (options.chunk && options.maxTokens) {
      filtered = chunkElements(filtered, options.maxTokens)
    }

    if (options.serialize) {
      const snap: Snapshot = {
        url: this.currentUrl,
        platform: 'web',
        elements: filtered,
        timestamp: Date.now(),
      }
      return serializeSnapshot(snap)
    }

    return filtered
  }

  /**
   * 3-tier element resolution with auto-caching:
   * Tier 0: Check cache → Tier 1: queryAXTree → Tier 2: Jaro-Winkler → Tier 3: vision fallback.
   */
  async find(name: string, options: FindOptions = {}): Promise<Element | null> {
    const cacheKey = options.role ? `${name}:${options.role}` : name

    // Tier 0: Check resolution cache
    const cached = this.resolutionCache.get(cacheKey)
    if (cached) {
      // Verify the cached element still exists
      const elements = await this.ax.getSnapshot()
      const match = elements.find((e) => e.id === cached.elementId)
      if (match) return match
      // Element gone — invalidate and re-resolve
      this.resolutionCache.invalidate(cacheKey)
    }

    // Tier 1: CDP-native queryAXTree (exact/prefix match)
    const queryResult = await this.ax.queryAXTree({
      accessibleName: name,
      role: options.role,
    })
    if (queryResult.length > 0) {
      const el = queryResult[0]
      this.resolutionCache.set(cacheKey, el.id, {
        role: el.role, label: el.label, confidence: 1.0,
      })
      return el
    }

    // Tier 2: Fuzzy matching on full AX tree (Jaro-Winkler)
    const { resolve } = await import('./resolve.js')
    const allElements = await this.ax.getSnapshot()
    const result = resolve({
      intent: options.role ? `${name} ${options.role}` : name,
      elements: allElements,
      mode: 'algorithmic',
    })

    if (result.confidence >= 0.5 && result.element) {
      this.resolutionCache.set(cacheKey, result.element.id, {
        role: result.element.role, label: result.element.label, confidence: result.confidence,
      })
      return result.element
    }

    // Tier 3: Signal vision fallback needed
    return null
  }

  // ─── Interactions ───────────────────────────────────────

  async click(elementId: string): Promise<void> {
    const backendNodeId = this.ax.getBackendNodeId(elementId)
    if (!backendNodeId) throw new Error(`Element ${elementId} not found in AX tree`)

    const { x, y } = await this.dom.getElementCenter(backendNodeId)
    await this.input.click(x, y)
  }

  async type(elementId: string, text: string): Promise<void> {
    const backendNodeId = this.ax.getBackendNodeId(elementId)
    if (!backendNodeId) throw new Error(`Element ${elementId} not found in AX tree`)

    const { x, y } = await this.dom.getElementCenter(backendNodeId)
    await this.input.click(x, y)
    await this.input.type(text)
  }

  async fill(elementId: string, value: string): Promise<void> {
    const backendNodeId = this.ax.getBackendNodeId(elementId)
    if (!backendNodeId) throw new Error(`Element ${elementId} not found in AX tree`)

    const { x, y } = await this.dom.getElementCenter(backendNodeId)
    await this.input.click(x, y)

    // Clear existing value
    await this.runtime.callFunctionOn(
      '() => { if (document.activeElement) { document.activeElement.value = ""; document.activeElement.dispatchEvent(new Event("input", { bubbles: true })); } }',
    )

    await this.input.type(value)
  }

  async hover(elementId: string): Promise<void> {
    const backendNodeId = this.ax.getBackendNodeId(elementId)
    if (!backendNodeId) throw new Error(`Element ${elementId} not found in AX tree`)

    const { x, y } = await this.dom.getElementCenter(backendNodeId)
    await this.input.hover(x, y)
  }

  async pressKey(key: string): Promise<void> {
    await this.input.pressKey(key)
  }

  async scroll(deltaY: number, x = 0, y = 0): Promise<void> {
    await this.input.scroll(x, y, 0, deltaY)
  }

  // ─── Screenshots ────────────────────────────────────────

  async screenshot(options: ScreenshotOptions = {}): Promise<Buffer> {
    return this._page.screenshot(options)
  }

  async screenshotElement(elementId: string): Promise<Buffer> {
    const backendNodeId = this.ax.getBackendNodeId(elementId)
    if (!backendNodeId) throw new Error(`Element ${elementId} not found in AX tree`)

    const model = await this.dom.getBoxModel(backendNodeId)
    const q = model.content
    const x = Math.min(q[0], q[2], q[4], q[6])
    const y = Math.min(q[1], q[3], q[5], q[7])

    return this._page.screenshot({
      clip: { x, y, width: model.width, height: model.height },
    })
  }

  // ─── Page State ─────────────────────────────────────────

  /**
   * One-call page state capture — combines DOMSnapshot, AX tree, and screenshot.
   */
  async captureState(options: CaptureStateOptions = {}): Promise<CapturedState> {
    const state: CapturedState = {
      url: this.currentUrl,
      timestamp: Date.now(),
    }

    const promises: Promise<void>[] = []

    if (options.computedStyles) {
      promises.push(
        this.snapshot.captureSnapshot({
          computedStyles: options.computedStyles,
        }).then((result) => { state.domSnapshot = result }),
      )
    }

    if (options.includeAXTree !== false) {
      promises.push(
        this.ax.getSnapshot().then((elements) => { state.axTree = elements }),
      )
    }

    if (options.includeScreenshot) {
      promises.push(
        this._page.screenshot().then((buf) => { state.screenshot = buf }),
      )
    }

    await Promise.all(promises)
    return state
  }

  /** Get AX tree snapshot. */
  async getSnapshot(): Promise<Element[]> {
    return this.ax.getSnapshot()
  }

  // ─── Evaluation ─────────────────────────────────────────

  /**
   * Evaluate a JavaScript expression in the page context.
   */
  async evaluate(expression: string): Promise<unknown>
  /**
   * Call a function with arguments in the page context.
   * Equivalent to Playwright's page.evaluate(fn, ...args).
   */
  async evaluate(fn: string, ...args: unknown[]): Promise<unknown>
  async evaluate(exprOrFn: string, ...args: unknown[]): Promise<unknown> {
    if (args.length > 0) {
      return this.runtime.callFunctionOn(exprOrFn, args)
    }
    return this.runtime.evaluate(exprOrFn)
  }

  // ─── DOM Queries ────────────────────────────────────────

  async querySelector(selector: string): Promise<number | null> {
    const doc = await this.dom.getDocument()
    return this.dom.querySelector(doc.root.nodeId, selector)
  }

  async querySelectorAll(selector: string): Promise<number[]> {
    const doc = await this.dom.getDocument()
    return this.dom.querySelectorAll(doc.root.nodeId, selector)
  }

  async getOuterHTML(nodeId: number): Promise<string> {
    return this.dom.getOuterHTML(nodeId)
  }

  async getAttributes(nodeId: number): Promise<Record<string, string>> {
    return this.dom.getAttributes(nodeId)
  }

  async getComputedStyle(nodeId: number, properties?: string[]): Promise<Record<string, string>> {
    if (properties) {
      return this.css.getComputedStyleFiltered(nodeId, properties)
    }
    return this.css.getComputedStyle(nodeId)
  }

  // ─── CSS Injection ──────────────────────────────────────

  async addStyleTag(css: string): Promise<void> {
    return this._page.addStyleTag(css)
  }

  // ─── Viewport ───────────────────────────────────────────

  async setViewport(config: ViewportConfig): Promise<void> {
    await this.emulation.setDeviceMetrics(config)
  }

  async clearViewport(): Promise<void> {
    await this.emulation.clearDeviceMetrics()
  }

  // ─── Cookies / Auth ─────────────────────────────────────

  async getCookies(urls?: string[]): Promise<Cookie[]> {
    return this.network.getCookies(urls)
  }

  async setCookies(cookies: SetCookieParams[]): Promise<void> {
    return this.network.setCookies(cookies)
  }

  async clearCookies(): Promise<void> {
    return this.network.clearCookies()
  }

  // ─── Console ────────────────────────────────────────────

  getConsoleMessages(): ConsoleMessage[] {
    return this.console.getMessages()
  }

  getConsoleErrors(): ConsoleMessage[] {
    return this.console.getErrors()
  }

  clearConsole(): void {
    this.console.clear()
  }

  // ─── Content ────────────────────────────────────────────

  async content(): Promise<string> {
    return this.runtime.evaluate('document.documentElement.outerHTML') as Promise<string>
  }

  async title(): Promise<string> {
    return this.runtime.evaluate('document.title') as Promise<string>
  }

  async textContent(selector: string): Promise<string | null> {
    return this.runtime.callFunctionOn(
      '(sel) => { const el = document.querySelector(sel); return el ? el.textContent : null; }',
      [selector],
    ) as Promise<string | null>
  }

  async getAttribute(selector: string, attribute: string): Promise<string | null> {
    return this.runtime.callFunctionOn(
      '(sel, attr) => { const el = document.querySelector(sel); return el ? el.getAttribute(attr) : null; }',
      [selector, attribute],
    ) as Promise<string | null>
  }

  // ─── LLM-Native: Observe ─────────────────────────────────

  /**
   * Preview what actions are possible without executing.
   * Returns serializable descriptors for act().
   */
  async observe(options?: ObserveOptions): Promise<ActionDescriptor[]> {
    const elements = await this.ax.getSnapshot()
    return observe(elements, options)
  }

  // ─── LLM-Native: Extract ───────────────────────────────

  /**
   * Extract structured data from AX tree using a schema.
   */
  async extract(schema: ExtractSchema): Promise<ExtractResult> {
    const elements = await this.ax.getSnapshot()
    return extractFromAXTree(elements, schema)
  }

  /**
   * Extract a list of repeated elements.
   */
  async extractItems(options: {
    role?: string
    labelPattern?: RegExp
    maxItems?: number
  }): Promise<Array<{ label: string; value: string | null; id: string }>> {
    const elements = await this.ax.getSnapshot()
    return extractList(elements, options)
  }

  /**
   * Extract page-level metadata (headings, links, inputs, buttons).
   */
  async extractMeta(): Promise<ReturnType<typeof extractPageMeta>> {
    const elements = await this.ax.getSnapshot()
    return extractPageMeta(elements)
  }

  // ─── LLM-Native: Adaptive Modality ─────────────────────

  /**
   * Assess how well the AX tree captures the page.
   * Returns a score and whether a screenshot is recommended.
   */
  async assessUnderstanding(options?: ModalityOptions): Promise<UnderstandingScore> {
    const elements = await this.ax.getSnapshot()
    return assessUnderstanding(elements, options)
  }

  // ─── LLM-Native: Cache ─────────────────────────────────

  /** Get resolution cache statistics. */
  get cacheStats(): ReturnType<ResolutionCache['stats']> {
    return this.resolutionCache.stats()
  }

  /** Configure the resolution cache. */
  configureCache(options: CacheOptions): void {
    this.resolutionCache = new ResolutionCache(options)
  }

  // ─── Direct domain access (for advanced use) ───────────

  get page(): PageDomain { return this._page }
  get accessibility(): AccessibilityDomain { return this.ax }
  get domDomain(): DomDomain { return this.dom }
  get runtimeDomain(): RuntimeDomain { return this.runtime }
  get cssDomain(): CssDomain { return this.css }
  get snapshotDomain(): SnapshotDomain { return this.snapshot }
  get emulationDomain(): EmulationDomain { return this.emulation }
  get networkDomain(): NetworkDomain { return this.network }
  get consoleDomain(): ConsoleDomain { return this.console }
  get connection(): CdpConnection { return this.conn }

  /** The CDP debug port Chrome is listening on. Only valid after launch(). */
  get debugPort(): number { return this.browser.port }

  /**
   * Connect to an already-running Chrome instance instead of launching a new one.
   * Used by browser-server reconnection to attach to a persistent Chrome process.
   */
  async connectExisting(wsUrl: string): Promise<void> {
    await this.conn.connect(wsUrl)
    this.target = new TargetDomain(this.conn)
    this.launched = true

    // Create a new page in the existing browser
    this.targetId = await this.target.createPage('about:blank')
    this.sessionId = await this.target.attach(this.targetId)

    // Initialize domains with session
    this._page = new PageDomain(this.conn, this.sessionId)
    this.ax = new AccessibilityDomain(this.conn, this.sessionId)
    this.dom = new DomDomain(this.conn, this.sessionId)
    this.input = new InputDomain(this.conn, this.sessionId)
    this.runtime = new RuntimeDomain(this.conn, this.sessionId)
    this.css = new CssDomain(this.conn, this.sessionId)
    this.snapshot = new SnapshotDomain(this.conn, this.sessionId)
    this.emulation = new EmulationDomain(this.conn, this.sessionId)
    this.network = new NetworkDomain(this.conn, this.sessionId)
    this.console = new ConsoleDomain(this.conn, this.sessionId)

    await this._page.enableLifecycleEvents()
    await this.ax.enable()
    await this.console.enable()
  }
}

// ─── Helpers ──────────────────────────────────────────────

/**
 * Chunk elements to fit within a token budget.
 * Approximate: ~4 chars per token, ~40 chars per serialized element.
 */
function chunkElements(elements: Element[], maxTokens: number): Element[] {
  const charsPerToken = 4
  const charsPerElement = 40
  const maxElements = Math.floor((maxTokens * charsPerToken) / charsPerElement)
  return elements.slice(0, maxElements)
}
