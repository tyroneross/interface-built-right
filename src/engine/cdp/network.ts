/**
 * CDP Network domain — cookie management for auth state, plus real
 * request/response tracking for network-aware waits (E3-B).
 *
 * The in-flight tracking below replaces two historically FAKE waits:
 * - `networkidle` used to mean "AX tree stopped mutating" (compat.ts, pre
 *   E3-B) — it could report idle while a fetch/XHR was still in flight, or
 *   never report idle on a page whose AX tree legitimately never settles.
 * - `waitForNavigation`/`waitForLoadState` used to mean "sleep 500ms" or
 *   "re-navigate to the same URL and wait for AX stability" — neither
 *   reflects actual network activity.
 *
 * This tracker only reflects reality once `enable()` has been called AND
 * its event handlers are registered on the live CDP connection — see
 * `tracking` / `disableTracking()`, used by the falsifier tests in
 * engine.test.ts to prove `waitForNetworkIdle`/`waitForResponse` are driven
 * by real `Network.*` events, not a fixed sleep.
 */

import type { CdpConnection } from './connection.js'

interface RequestWillBeSentParams {
  requestId: string
  request: { url: string }
}

interface ResponseReceivedParams {
  requestId: string
  response: { url: string; status: number }
}

interface LoadingFinishedParams {
  requestId: string
}

interface LoadingFailedParams {
  requestId: string
}

export interface WaitForNetworkIdleOptions {
  /** How long the in-flight count must stay at/below `maxInflight` before
   *  considering the network idle. Default 500ms (matches the common
   *  Playwright/Puppeteer `networkidle`/`networkidle0` convention). */
  idleMs?: number
  /** Max concurrent in-flight requests still considered "idle" (Puppeteer's
   *  networkidle0 = 0, networkidle2 = 2). Default 0. */
  maxInflight?: number
  /** Max total wait, ms. Default 10000. */
  timeout?: number
}

export interface NetworkIdleResult {
  /** True if the timeout elapsed before the network reached idle. */
  timedOut: boolean
  /** In-flight request count at the time this result was produced. */
  inflightCount: number
}

export interface WaitForResponseOptions {
  /** Max total wait, ms. Default 30000. */
  timeout?: number
}

export interface MatchedResponse {
  url: string
  status: number
}

type ResponsePredicate = (url: string, status: number) => boolean

interface ResponseWaiter {
  predicate: ResponsePredicate
  resolve: (value: MatchedResponse) => void
}

export interface Cookie {
  name: string
  value: string
  domain: string
  path: string
  expires: number
  size: number
  httpOnly: boolean
  secure: boolean
  session: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

export interface SetCookieParams {
  name: string
  value: string
  url?: string
  domain?: string
  path?: string
  secure?: boolean
  httpOnly?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
  expires?: number
}

export class NetworkDomain {
  private inflight = new Set<string>()
  private lastActivityAt = Date.now()
  private handlersRegistered = false
  private responseWaiters = new Set<ResponseWaiter>()

  private readonly onRequestWillBeSent = (params: unknown): void => {
    const { requestId } = params as RequestWillBeSentParams
    this.inflight.add(requestId)
    this.lastActivityAt = Date.now()
  }

  private readonly onResponseReceived = (params: unknown): void => {
    const { response } = params as ResponseReceivedParams
    this.lastActivityAt = Date.now()
    for (const waiter of [...this.responseWaiters]) {
      if (waiter.predicate(response.url, response.status)) {
        this.responseWaiters.delete(waiter)
        waiter.resolve({ url: response.url, status: response.status })
      }
    }
  }

  private readonly onLoadingFinished = (params: unknown): void => {
    const { requestId } = params as LoadingFinishedParams
    this.inflight.delete(requestId)
    this.lastActivityAt = Date.now()
  }

  private readonly onLoadingFailed = (params: unknown): void => {
    const { requestId } = params as LoadingFailedParams
    this.inflight.delete(requestId)
    this.lastActivityAt = Date.now()
  }

  constructor(
    private conn: CdpConnection,
    private sessionId?: string,
  ) {}

  async enable(): Promise<void> {
    await this.conn.send('Network.enable', {}, this.sessionId)
    this.registerHandlers()
  }

  private registerHandlers(): void {
    if (this.handlersRegistered) return
    this.handlersRegistered = true
    this.conn.on('Network.requestWillBeSent', this.onRequestWillBeSent)
    this.conn.on('Network.responseReceived', this.onResponseReceived)
    this.conn.on('Network.loadingFinished', this.onLoadingFinished)
    this.conn.on('Network.loadingFailed', this.onLoadingFailed)
  }

  /**
   * Detach the Network-domain event listeners without disabling the CDP
   * domain itself. Used by tests to simulate "Network-domain events
   * disabled" — with tracking off, in-flight state is frozen at whatever
   * it was, so `waitForNetworkIdle` reports idle immediately even while a
   * real request is in flight, proving the wait would be FAKE without real
   * event wiring.
   */
  disableTracking(): void {
    if (!this.handlersRegistered) return
    this.handlersRegistered = false
    this.conn.off('Network.requestWillBeSent', this.onRequestWillBeSent)
    this.conn.off('Network.responseReceived', this.onResponseReceived)
    this.conn.off('Network.loadingFinished', this.onLoadingFinished)
    this.conn.off('Network.loadingFailed', this.onLoadingFailed)
  }

  /** True once `enable()` has registered real event handlers. */
  get tracking(): boolean {
    return this.handlersRegistered
  }

  /** Current in-flight request count (only meaningful while `tracking`). */
  get inflightCount(): number {
    return this.inflight.size
  }

  /**
   * Wait until the in-flight request count has been at or below
   * `maxInflight` for `idleMs` consecutive milliseconds — REAL CDP
   * Network-domain quiescence (requestWillBeSent / responseReceived /
   * loadingFinished / loadingFailed), not AX-tree stability and not a
   * fixed sleep. Never throws: resolves `{ timedOut: true, ... }` at the
   * deadline instead, so callers can treat it as best-effort.
   */
  async waitForNetworkIdle(options: WaitForNetworkIdleOptions = {}): Promise<NetworkIdleResult> {
    const idleMs = options.idleMs ?? 500
    const maxInflight = options.maxInflight ?? 0
    const timeout = options.timeout ?? 10000
    const deadline = Date.now() + timeout
    const pollInterval = Math.min(50, Math.max(10, idleMs))

    while (true) {
      const now = Date.now()
      if (this.inflight.size <= maxInflight && now - this.lastActivityAt >= idleMs) {
        return { timedOut: false, inflightCount: this.inflight.size }
      }
      if (now >= deadline) {
        return { timedOut: true, inflightCount: this.inflight.size }
      }
      await new Promise((r) => setTimeout(r, pollInterval))
    }
  }

  /**
   * Wait for a response whose (url, status) satisfies `predicate`. Resolves
   * the moment a matching `Network.responseReceived` event fires; rejects
   * on timeout. Driven entirely by real CDP events — with tracking
   * disabled this never resolves and always times out (no fake success).
   */
  async waitForResponse(
    predicate: ResponsePredicate,
    options: WaitForResponseOptions = {},
  ): Promise<MatchedResponse> {
    const timeout = options.timeout ?? 30000
    return new Promise<MatchedResponse>((resolve, reject) => {
      const waiter: ResponseWaiter = {
        predicate,
        resolve: (value) => {
          clearTimeout(timer)
          resolve(value)
        },
      }
      const timer = setTimeout(() => {
        this.responseWaiters.delete(waiter)
        reject(new Error(`waitForResponse timed out after ${timeout}ms waiting for a matching response`))
      }, timeout)
      this.responseWaiters.add(waiter)
    })
  }

  /**
   * Get all cookies, optionally filtered by URLs.
   */
  async getCookies(urls?: string[]): Promise<Cookie[]> {
    const params: Record<string, unknown> = {}
    if (urls) params.urls = urls

    const result = await this.conn.send<{ cookies: Cookie[] }>(
      'Network.getCookies', params, this.sessionId,
    )
    return result.cookies
  }

  /**
   * Set a cookie.
   */
  async setCookie(cookie: SetCookieParams): Promise<boolean> {
    const result = await this.conn.send<{ success: boolean }>(
      'Network.setCookie', cookie as unknown as Record<string, unknown>, this.sessionId,
    )
    return result.success
  }

  /**
   * Set multiple cookies at once.
   */
  async setCookies(cookies: SetCookieParams[]): Promise<void> {
    await this.conn.send('Network.setCookies', {
      cookies: cookies as unknown as Record<string, unknown>[],
    }, this.sessionId)
  }

  /**
   * Clear all browser cookies.
   */
  async clearCookies(): Promise<void> {
    await this.conn.send('Network.clearBrowserCookies', {}, this.sessionId)
  }

  /**
   * Delete specific cookies by name and optional URL/domain.
   */
  async deleteCookies(params: {
    name: string
    url?: string
    domain?: string
    path?: string
  }): Promise<void> {
    await this.conn.send('Network.deleteCookies', params, this.sessionId)
  }
}
