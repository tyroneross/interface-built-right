/**
 * CDP WebSocket transport layer.
 * Forked from Spectra — adapted for IBR engine.
 * Uses Node.js 22+ built-in WebSocket (no ws package).
 */

import { ConnectTimeoutError, WS_CONNECT_TIMEOUT_MS } from '../net-timeout.js'

type EventHandler = (params: unknown) => void

const DEFAULT_TIMEOUT_MS = 30_000

export class CdpConnection {
  private ws: WebSocket | null = null
  private nextId = 0
  private pending = new Map<number, {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
    timer: ReturnType<typeof setTimeout>
  }>()
  private eventHandlers = new Map<string, Set<EventHandler>>()
  private timeoutMs: number

  constructor(options?: { timeoutMs?: number }) {
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  /**
   * Open the CDP WebSocket, bounded by `timeoutMs`.
   *
   * `new WebSocket()` fires 'open' or 'error' — and NEITHER when the peer
   * completes the TCP handshake then goes silent, which is exactly what a
   * recycled ephemeral port looks like. Without the timer below this call
   * never settles: measured still pending at 25s on 2026-09-01. On timeout we
   * also close the half-open socket, or the process keeps a live handle and
   * cannot exit.
   */
  async connect(wsUrl: string, options?: { timeoutMs?: number }): Promise<void> {
    const timeoutMs = options?.timeoutMs ?? WS_CONNECT_TIMEOUT_MS
    const started = Date.now()
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(wsUrl)
      let settled = false
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        try { ws.close() } catch { /* half-open; best effort */ }
        reject(new ConnectTimeoutError(
          `CDP WebSocket open ${wsUrl}`,
          timeoutMs,
          Date.now() - started,
        ))
      }, timeoutMs)

      const onOpen = () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        this.ws = ws
        // Register persistent handlers after successful connect
        ws.addEventListener('message', (event) => this.handleMessage(event))
        ws.addEventListener('close', () => this.handleClose())
        ws.addEventListener('error', () => this.handleClose())
        resolve()
      }

      const onError = () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(new Error(`WebSocket connection failed: ${wsUrl}`))
      }

      ws.addEventListener('open', onOpen)
      ws.addEventListener('error', onError)
    })
  }

  async send<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
    sessionId?: string,
  ): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected')
    }
    const id = ++this.nextId
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          const secs = (this.timeoutMs / 1000).toFixed(0)
          reject(new Error(
            `CDP request '${method}' timed out after ${secs}s. `
            + 'The browser may be unresponsive or the operation is taking too long.'
          ))
        }
      }, this.timeoutMs)
      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      })
      const msg: Record<string, unknown> = { id, method }
      if (params) msg.params = params
      if (sessionId) msg.sessionId = sessionId
      this.ws!.send(JSON.stringify(msg))
    })
  }

  on(method: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(method)) {
      this.eventHandlers.set(method, new Set())
    }
    this.eventHandlers.get(method)!.add(handler)
  }

  off(method: string, handler: EventHandler): void {
    this.eventHandlers.get(method)?.delete(handler)
  }

  private handleMessage(event: MessageEvent): void {
    let data: Record<string, unknown>
    try {
      data = JSON.parse(String(event.data))
    } catch {
      // Malformed frame — skip instead of crashing
      return
    }

    if ('id' in data && this.pending.has(data.id as number)) {
      const id = data.id as number
      const { resolve, reject, timer } = this.pending.get(id)!
      clearTimeout(timer)
      this.pending.delete(id)
      if (data.error) {
        const err = data.error as { code: number; message: string }
        reject(new Error(`CDP error ${err.code}: ${err.message}`))
      } else {
        resolve(data.result)
      }
    } else if ('method' in data) {
      const handlers = this.eventHandlers.get(data.method as string)
      if (handlers) {
        for (const handler of handlers) handler(data.params)
      }
    }
  }

  private handleClose(): void {
    for (const [, { reject, timer }] of this.pending) {
      clearTimeout(timer)
      reject(new Error('WebSocket closed'))
    }
    this.pending.clear()
    this.ws = null
  }

  async close(): Promise<void> {
    for (const [, { timer }] of this.pending) {
      clearTimeout(timer)
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.pending.clear()
  }

  get connected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}
