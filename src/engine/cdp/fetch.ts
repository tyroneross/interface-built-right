import type { CdpConnection } from './connection.js'

export interface MockResponse {
  status?: number
  body?: string | object
  headers?: Record<string, string>
}

interface MockRule {
  pattern: string | RegExp
  response: MockResponse
}

interface RequestPausedParams {
  requestId: string
  request: { url: string }
  responseStatusCode?: number
}

/** Convert a `*` glob into an anchored RegExp (`*` matches any run of characters). */
export function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`)
}

export function matchesPattern(pattern: string | RegExp, url: string): boolean {
  if (pattern instanceof RegExp) return pattern.test(url)
  return pattern.includes('*') ? globToRegExp(pattern).test(url) : url === pattern
}

/** Build the Fetch.fulfillRequest params for a mock response. */
export function fulfillParams(requestId: string, response: MockResponse) {
  const isObject = response.body !== undefined && typeof response.body !== 'string'
  const bodyText = response.body === undefined ? '' : isObject ? JSON.stringify(response.body) : response.body as string
  const headers: Record<string, string> = { ...(response.headers ?? {}) }
  const hasContentType = Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')
  if (!hasContentType) headers['Content-Type'] = isObject ? 'application/json' : 'text/plain'
  return {
    requestId,
    responseCode: response.status ?? 200,
    responseHeaders: Object.entries(headers).map(([name, value]) => ({ name, value })),
    body: Buffer.from(bodyText, 'utf8').toString('base64'),
  }
}

/**
 * Network mocking over the CDP Fetch domain. Requests are paused at the
 * request stage; the first matching rule (latest registered wins) is fulfilled,
 * everything else continues unmodified.
 */
export class FetchDomain {
  private rules: MockRule[] = []
  private enabled = false
  private listening = false

  constructor(private conn: CdpConnection, private sessionId: string) {}

  async mock(pattern: string | RegExp, response: MockResponse): Promise<void> {
    this.rules.unshift({ pattern, response })
    if (this.enabled) return
    this.enabled = true
    // Register once: clear() only disables Fetch, so re-adding the listener on each
    // mock() after a clear() would answer every paused request N times.
    if (!this.listening) {
      this.listening = true
      this.conn.on('Fetch.requestPaused', (params: unknown) => {
        if (this.enabled) void this.onPaused(params as RequestPausedParams)
      })
    }
    await this.conn.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] }, this.sessionId)
  }

  async clear(): Promise<void> {
    this.rules = []
    if (!this.enabled) return
    this.enabled = false
    await this.conn.send('Fetch.disable', {}, this.sessionId).catch(() => {})
  }

  private async onPaused(params: RequestPausedParams): Promise<void> {
    const rule = this.rules.find((r) => matchesPattern(r.pattern, params.request.url))
    try {
      if (rule) {
        await this.conn.send('Fetch.fulfillRequest', fulfillParams(params.requestId, rule.response), this.sessionId)
      } else {
        await this.conn.send('Fetch.continueRequest', { requestId: params.requestId }, this.sessionId)
      }
    } catch {
      // Request may already be gone (navigation/abort); nothing to recover.
    }
  }
}
