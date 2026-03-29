/**
 * SafariDriver — BrowserDriver backed by safaridriver (W3C WebDriver) +
 * macOS Accessibility API (Swift extractor) for element discovery.
 *
 * Safari does NOT support headless mode. It always runs visibly.
 *
 * Discovery pattern:
 *   - WebDriver handles navigation + screenshots + JS evaluation
 *   - macOS AX API (ibr-ax-extract) provides the element tree
 *   - WebDriver's executeScript handles interactions (avoids AX↔DOM ID mapping)
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import type { BrowserDriver } from '../types.js'
import type { Element } from '../types.js'
import { WebDriverClient } from './webdriver.js'
import { SafariSession } from './session.js'
import { ensureExtractor } from '../../native/extract.js'
import { serializeSnapshot } from '../serialize.js'
import type { Snapshot } from '../types.js'

const execFileAsync = promisify(execFile)

export class SafariDriver implements BrowserDriver {
  private client: WebDriverClient | null = null
  private session: SafariSession | null = null
  private _currentUrl: string = ''
  private _axElements: Element[] = []

  // ─── Lifecycle ──────────────────────────────────────────

  async launch(options: {
    headless?: boolean
    viewport?: { width: number; height: number }
    normalize?: boolean
  } = {}): Promise<void> {
    // Safari has no headless mode — warn but continue
    if (options.headless) {
      console.warn('[SafariDriver] Safari does not support headless mode. Running visible.')
    }

    this.session = new SafariSession()
    const port = await this.session.start()

    this.client = new WebDriverClient(port)
    await this.client.createSession()

    // Set viewport size if requested
    if (options.viewport) {
      await this.client.setWindowRect(options.viewport)
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.deleteSession().catch(() => {})
      this.client = null
    }
    if (this.session) {
      await this.session.stop()
      this.session = null
    }
    this._currentUrl = ''
    this._axElements = []
  }

  // ─── Navigation ─────────────────────────────────────────

  async navigate(url: string, options: {
    waitFor?: 'stable' | 'load' | 'none'
    timeout?: number
  } = {}): Promise<void> {
    if (!this.client) throw new Error('SafariDriver not launched')

    await this.client.navigateTo(url)

    const strategy = options.waitFor ?? 'load'
    const timeout = options.timeout ?? 10000

    if (strategy !== 'none') {
      // Poll for document.readyState === 'complete'
      const deadline = Date.now() + timeout
      while (Date.now() < deadline) {
        try {
          const state = await this.client.executeScript<string>(
            'return document.readyState',
          )
          if (state === 'complete') break
        } catch {
          // Page may still be loading
        }
        await new Promise((r) => setTimeout(r, 200))
      }

      // For 'stable', add extra wait for any post-load JS to settle
      if (strategy === 'stable') {
        await new Promise((r) => setTimeout(r, 500))
      }
    }

    this._currentUrl = await this.client.getCurrentUrl().catch(() => url)
    // Refresh AX tree after navigation
    this._axElements = await this._fetchAXElements().catch(() => [])
  }

  get currentUrl(): string {
    return this._currentUrl
  }

  // ─── Screenshots ─────────────────────────────────────────

  async screenshot(options?: {
    clip?: { x: number; y: number; width: number; height: number }
  }): Promise<Buffer> {
    if (!this.client) throw new Error('SafariDriver not launched')

    // Take full screenshot — clip is best-effort via JS canvas crop
    const buf = await this.client.takeScreenshot()

    if (options?.clip) {
      // If clip requested, use sharp/pngjs to crop (best-effort — skip if unavailable)
      return this._cropScreenshot(buf, options.clip)
    }

    return buf
  }

  // ─── Element discovery ───────────────────────────────────

  /**
   * Discover elements via macOS AX API.
   * Falls back to WebDriver JS query if AX extraction unavailable.
   */
  async discover(options: {
    filter?: 'interactive' | 'leaf' | 'all'
    serialize?: boolean
  } = {}): Promise<Element[] | string> {
    const filter = options.filter ?? 'interactive'

    // Refresh AX tree
    this._axElements = await this._fetchAXElements()

    let filtered: Element[]
    switch (filter) {
      case 'interactive':
        filtered = this._axElements.filter((e) => e.actions.length > 0)
        break
      case 'leaf':
        filtered = this._axElements.filter((e) => e.label && e.role !== 'group')
        break
      case 'all':
      default:
        filtered = this._axElements
    }

    if (options.serialize) {
      const snap: Snapshot = {
        url: this._currentUrl,
        platform: 'web',
        elements: filtered,
        timestamp: Date.now(),
      }
      return serializeSnapshot(snap)
    }

    return filtered
  }

  /**
   * Find an element by name + optional role in the AX tree.
   */
  async find(name: string, options: { role?: string } = {}): Promise<Element | null> {
    if (this._axElements.length === 0) {
      this._axElements = await this._fetchAXElements().catch(() => [])
    }

    const nameLower = name.toLowerCase()
    const match = this._axElements.find((e) => {
      const nameMatch = e.label?.toLowerCase().includes(nameLower) ||
        e.value?.toString().toLowerCase().includes(nameLower)
      const roleMatch = !options.role || e.role === options.role
      return nameMatch && roleMatch
    })

    return match ?? null
  }

  // ─── Interactions ────────────────────────────────────────

  /**
   * Click an element. The elementId is either:
   * - An AX element ID (from discover/find) — resolved via JS querySelector by label
   * - A CSS selector passed directly
   */
  async click(elementId: string): Promise<void> {
    if (!this.client) throw new Error('SafariDriver not launched')
    await this._executeElementAction(elementId, 'click')
  }

  async type(elementId: string, text: string): Promise<void> {
    if (!this.client) throw new Error('SafariDriver not launched')
    // Focus the element then send keys
    await this._executeElementAction(elementId, 'focus')
    await this.client.executeScript(
      `(function(text) {
        const el = document.activeElement;
        if (el) {
          el.value = (el.value || '') + text;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })(arguments[0])`,
      [text],
    )
  }

  async fill(elementId: string, value: string): Promise<void> {
    if (!this.client) throw new Error('SafariDriver not launched')
    // Clear then type
    await this._executeElementAction(elementId, 'focus')
    await this.client.executeScript(
      `(function(value) {
        const el = document.activeElement;
        if (el) {
          el.value = value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })(arguments[0])`,
      [value],
    )
  }

  async hover(elementId: string): Promise<void> {
    if (!this.client) throw new Error('SafariDriver not launched')
    await this._executeElementAction(elementId, 'mouseover')
  }

  async pressKey(key: string): Promise<void> {
    if (!this.client) throw new Error('SafariDriver not launched')
    // Use WebDriver active element sendKeys
    try {
      const activeElId = await this.client.executeScript<string>(
        `return document.activeElement ? document.activeElement.tagName : ''`,
      )
      if (activeElId) {
        // Dispatch keyboard event on active element
        await this.client.executeScript(
          `(function(key) {
            document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: key, bubbles: true }));
            document.activeElement.dispatchEvent(new KeyboardEvent('keyup', { key: key, bubbles: true }));
          })(arguments[0])`,
          [key],
        )
      }
    } catch {
      // Best-effort key press
    }
  }

  async scroll(deltaY: number, _x = 0, _y = 0): Promise<void> {
    if (!this.client) throw new Error('SafariDriver not launched')
    // Safari WebDriver: scrollBy(deltaX, deltaY). Position params (_x, _y) not used
    // since WebDriver doesn't support scroll-at-position.
    await this.client.executeScript(
      `window.scrollBy(0, arguments[0])`,
      [deltaY],
    )
  }

  // ─── Evaluation ─────────────────────────────────────────

  async evaluate<T>(expression: string): Promise<T> {
    if (!this.client) throw new Error('SafariDriver not launched')
    return this.client.executeScript<T>(`return (${expression})`)
  }

  // ─── Internals ───────────────────────────────────────────

  /**
   * Fetch the AX element tree for the running Safari window.
   * Uses the Swift ibr-ax-extract binary with Safari's PID.
   */
  private async _fetchAXElements(): Promise<Element[]> {
    try {
      const extractorPath = await ensureExtractor()
      const { stdout } = await execFileAsync(
        extractorPath,
        ['--app', 'Safari'],
        { timeout: 15000 },
      )

      // Parse: first line is WINDOW header, rest is JSON
      const lines = stdout.split('\n')
      const jsonStr = lines.slice(1).join('\n').trim()
      if (!jsonStr) return []

      const raw = JSON.parse(jsonStr)
      return this._mapAXToElements(raw)
    } catch {
      // AX extraction is best-effort — return empty if unavailable
      // (accessibility permission may not be granted, or extractor not compiled)
      return []
    }
  }

  /**
   * Map raw macOS AX JSON output to IBR Element format.
   */
  private _mapAXToElements(rawElements: any[], parentId: string | null = null): Element[] {
    const elements: Element[] = []
    let idx = 0

    for (const raw of rawElements) {
      const id = `safari-ax-${parentId ? parentId + '-' : ''}${idx++}`
      const role = this._mapAXRole(raw.role ?? 'AXUnknown')
      const label = raw.title ?? raw.description ?? raw.value ?? ''
      const actions = (raw.actions ?? []).map((a: string) =>
        a.replace(/^AX/, '').toLowerCase(),
      )

      elements.push({
        id,
        role,
        label,
        value: raw.value ?? null,
        enabled: raw.enabled ?? true,
        focused: raw.focused ?? false,
        actions,
        bounds: [
          raw.position?.x ?? 0,
          raw.position?.y ?? 0,
          raw.size?.width ?? 0,
          raw.size?.height ?? 0,
        ],
        parent: parentId,
      })

      if (raw.children && raw.children.length > 0) {
        const children = this._mapAXToElements(raw.children, id)
        elements.push(...children)
      }
    }

    return elements
  }

  /** Map macOS AX role names to ARIA-style roles */
  private _mapAXRole(axRole: string): string {
    const map: Record<string, string> = {
      AXButton: 'button',
      AXLink: 'link',
      AXTextField: 'textbox',
      AXTextArea: 'textbox',
      AXCheckBox: 'checkbox',
      AXRadioButton: 'radio',
      AXComboBox: 'combobox',
      AXPopUpButton: 'combobox',
      AXSlider: 'slider',
      AXImage: 'img',
      AXStaticText: 'text',
      AXHeading: 'heading',
      AXList: 'list',
      AXListItem: 'listitem',
      AXTable: 'table',
      AXRow: 'row',
      AXCell: 'cell',
      AXGroup: 'group',
      AXScrollArea: 'scrollbar',
      AXWebArea: 'main',
      AXWindow: 'dialog',
      AXMenuBar: 'menubar',
      AXMenu: 'menu',
      AXMenuItem: 'menuitem',
      AXToolbar: 'toolbar',
    }
    return map[axRole] ?? axRole.replace(/^AX/, '').toLowerCase()
  }

  /**
   * Execute a DOM action on an element.
   * Resolution order:
   *   1. CSS selector (if elementId looks like one: starts with . # [ or is a tag)
   *   2. ARIA label match via querySelector [aria-label="..."]
   *   3. Text content match via TreeWalker
   */
  private async _executeElementAction(elementId: string, action: string): Promise<void> {
    const script = `
      (function(eid, action) {
        let el = null;

        // Strategy 1: treat as CSS selector
        const looksLikeCss = /^[.#\\[a-zA-Z]/.test(eid);
        if (looksLikeCss) {
          try { el = document.querySelector(eid); } catch(e) {}
        }

        // Strategy 2: aria-label match
        if (!el) {
          el = document.querySelector('[aria-label="' + eid + '"]');
        }

        // Strategy 3: button/link text content
        if (!el) {
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_ELEMENT,
            null
          );
          let node;
          while ((node = walker.nextNode())) {
            if (node.textContent && node.textContent.trim() === eid) {
              if (['BUTTON','A','INPUT','SELECT','TEXTAREA'].includes(node.tagName)) {
                el = node;
                break;
              }
            }
          }
        }

        if (!el) return false;

        if (action === 'click') {
          el.click();
        } else if (action === 'focus') {
          el.focus();
        } else if (action === 'mouseover') {
          el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        }

        return true;
      })(arguments[0], arguments[1])
    `
    const found = await this.client!.executeScript<boolean>(script, [elementId, action])
    if (!found) {
      throw new Error(`SafariDriver: element not found for action "${action}": ${elementId}`)
    }
  }

  /**
   * Crop a PNG buffer to a clip region using pngjs.
   * Gracefully returns the full buffer if pngjs unavailable or clip fails.
   */
  private async _cropScreenshot(
    buf: Buffer,
    clip: { x: number; y: number; width: number; height: number },
  ): Promise<Buffer> {
    try {
      const { PNG } = await import('pngjs')
      const src = PNG.sync.read(buf)
      const dst = new PNG({ width: clip.width, height: clip.height })

      for (let y = 0; y < clip.height; y++) {
        for (let x = 0; x < clip.width; x++) {
          const srcIdx = ((clip.y + y) * src.width + (clip.x + x)) * 4
          const dstIdx = (y * clip.width + x) * 4
          dst.data[dstIdx] = src.data[srcIdx]
          dst.data[dstIdx + 1] = src.data[srcIdx + 1]
          dst.data[dstIdx + 2] = src.data[srcIdx + 2]
          dst.data[dstIdx + 3] = src.data[srcIdx + 3]
        }
      }

      return PNG.sync.write(dst)
    } catch {
      return buf
    }
  }
}
