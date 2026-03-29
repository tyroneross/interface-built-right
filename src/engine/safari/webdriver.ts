/**
 * Lightweight W3C WebDriver HTTP client for safaridriver.
 * Uses Node.js built-in fetch (Node 18+).
 */

interface WdResponse<T = unknown> {
  value: T
}

export class WebDriverClient {
  private baseUrl: string
  private sessionId: string | null = null

  constructor(port: number) {
    this.baseUrl = `http://localhost:${port}`
  }

  // ─── Internal HTTP helpers ───────────────────────────────

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '(no body)')
      throw new Error(`WebDriver POST ${path} failed: HTTP ${res.status} — ${text}`)
    }
    const json = await res.json() as WdResponse<T>
    return json.value
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`)
    if (!res.ok) {
      const text = await res.text().catch(() => '(no body)')
      throw new Error(`WebDriver GET ${path} failed: HTTP ${res.status} — ${text}`)
    }
    const json = await res.json() as WdResponse<T>
    return json.value
  }

  private async delete<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, { method: 'DELETE' })
    if (!res.ok) {
      const text = await res.text().catch(() => '(no body)')
      throw new Error(`WebDriver DELETE ${path} failed: HTTP ${res.status} — ${text}`)
    }
    const json = await res.json() as WdResponse<T>
    return json.value
  }

  private session(path = ''): string {
    if (!this.sessionId) throw new Error('No active WebDriver session')
    return `/session/${this.sessionId}${path}`
  }

  // ─── Session management ──────────────────────────────────

  /**
   * Create a new WebDriver session.
   * Returns the session ID.
   */
  async createSession(capabilities: Record<string, unknown> = {}): Promise<string> {
    const body = {
      capabilities: {
        alwaysMatch: {
          browserName: 'safari',
          ...capabilities,
        },
      },
    }

    const value = await this.post<{ sessionId: string } | string>('/session', body)

    // safaridriver returns { sessionId, capabilities } in some versions,
    // others return the sessionId as the top-level value field
    if (typeof value === 'string') {
      this.sessionId = value
    } else if (value && typeof value === 'object' && 'sessionId' in value) {
      this.sessionId = (value as { sessionId: string }).sessionId
    } else {
      throw new Error(`Unexpected createSession response: ${JSON.stringify(value)}`)
    }

    return this.sessionId
  }

  /** Delete the current WebDriver session. */
  async deleteSession(): Promise<void> {
    if (!this.sessionId) return
    await this.delete(this.session()).catch(() => {})
    this.sessionId = null
  }

  get activeSessionId(): string | null {
    return this.sessionId
  }

  // ─── Navigation ──────────────────────────────────────────

  async navigateTo(url: string): Promise<void> {
    await this.post(this.session('/url'), { url })
  }

  async getCurrentUrl(): Promise<string> {
    return this.get<string>(this.session('/url'))
  }

  // ─── Screenshots ─────────────────────────────────────────

  /**
   * Take a full-page screenshot.
   * Returns a PNG buffer decoded from the base64 response.
   */
  async takeScreenshot(): Promise<Buffer> {
    const b64 = await this.get<string>(this.session('/screenshot'))
    return Buffer.from(b64, 'base64')
  }

  // ─── Element interaction ─────────────────────────────────

  /**
   * Find a single element using the given strategy and value.
   * Returns the WebDriver element ID string.
   */
  async findElement(
    strategy: 'css selector' | 'xpath' | 'link text',
    value: string,
  ): Promise<string> {
    const result = await this.post<Record<string, string>>(
      this.session('/element'),
      { using: strategy, value },
    )
    // W3C element reference: { 'element-6066-11e4-a52e-4f735466cecf': '<id>' }
    const W3C_KEY = 'element-6066-11e4-a52e-4f735466cecf'
    const elementId = result[W3C_KEY] ?? result['ELEMENT']
    if (!elementId) {
      throw new Error(`findElement: no element ID in response: ${JSON.stringify(result)}`)
    }
    return elementId
  }

  async clickElement(elementId: string): Promise<void> {
    await this.post(this.session(`/element/${elementId}/click`), {})
  }

  async sendKeys(elementId: string, text: string): Promise<void> {
    await this.post(this.session(`/element/${elementId}/value`), { text })
  }

  async clearElement(elementId: string): Promise<void> {
    await this.post(this.session(`/element/${elementId}/clear`), {})
  }

  async getElementRect(elementId: string): Promise<{
    x: number; y: number; width: number; height: number
  }> {
    return this.get(this.session(`/element/${elementId}/rect`))
  }

  async getElementText(elementId: string): Promise<string> {
    return this.get<string>(this.session(`/element/${elementId}/text`))
  }

  // ─── JavaScript execution ────────────────────────────────

  async executeScript<T>(script: string, args: unknown[] = []): Promise<T> {
    return this.post<T>(this.session('/execute/sync'), { script, args })
  }

  // ─── Window management ───────────────────────────────────

  async setWindowRect(rect: { width: number; height: number; x?: number; y?: number }): Promise<void> {
    await this.post(this.session('/window/rect'), rect)
  }

  // ─── Health check ────────────────────────────────────────

  async status(): Promise<boolean> {
    try {
      await this.get('/status')
      return true
    } catch {
      return false
    }
  }
}
