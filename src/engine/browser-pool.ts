/**
 * BrowserPool — keeps a single warm EngineDriver alive across multiple scans
 * in the same process.
 *
 * Cold launch is the single largest contributor to scan() latency (~600-800ms
 * out of ~1.4s total measured against example.com). For long-running consumers
 * — most importantly the MCP server, where every tool call shares a process —
 * launching once and reusing for subsequent scans drops first-finding latency
 * to roughly the cost of `goto` + extraction (~400-600ms total).
 *
 * Concurrency: the pool serialises scans through a simple async mutex. Two
 * `scan()` calls against the same pool will not race on the shared page; the
 * second call waits for the first to release. Concurrent scans are out of
 * scope for this iteration; if we need them later, the pool can be extended
 * with a max-pages knob and on-demand target.createPage().
 *
 * Lifecycle: pool.close() must be called by the host (e.g. on SIGTERM in the
 * MCP server) to release the underlying browser process. The pool does not
 * register exit handlers automatically — explicit lifecycle keeps test
 * isolation clean.
 */

import { EngineDriver, type LaunchOptions } from './driver.js'

export interface BrowserPoolOptions {
  /** Launch options applied on the first acquire. Subsequent acquires reuse. */
  launchOptions?: LaunchOptions
}

export class BrowserPool {
  private driver: EngineDriver | null = null
  private launchOptions: LaunchOptions
  private inUse = false
  private waiters: Array<() => void> = []
  private closed = false

  constructor(options: BrowserPoolOptions = {}) {
    this.launchOptions = options.launchOptions ?? {}
  }

  /** Acquire the warm driver. Launches on first call. Awaits if another
   *  caller currently holds the driver. */
  async acquire(): Promise<EngineDriver> {
    if (this.closed) throw new Error('BrowserPool is closed')
    while (this.inUse) {
      await new Promise<void>((resolve) => this.waiters.push(resolve))
    }
    this.inUse = true
    if (!this.driver) {
      this.driver = new EngineDriver()
      try {
        await this.driver.launch(this.launchOptions)
      } catch (err) {
        // Reset state on launch failure so the next acquire can retry.
        this.driver = null
        this.inUse = false
        const next = this.waiters.shift()
        if (next) next()
        throw err
      }
    }
    return this.driver
  }

  /** Release the driver back to the pool. Wakes up the next waiter. */
  release(): void {
    this.inUse = false
    const next = this.waiters.shift()
    if (next) next()
  }

  /** Close the underlying browser. Future acquire() calls throw. */
  async close(): Promise<void> {
    this.closed = true
    if (this.driver) {
      const d = this.driver
      this.driver = null
      try {
        await d.close()
      } catch {
        // Best-effort close; never throw from cleanup.
      }
    }
    // Wake any pending waiters so they observe the closed state.
    while (this.waiters.length) {
      const w = this.waiters.shift()
      if (w) w()
    }
  }

  /** True if the pool has a live driver. Useful for diagnostics. */
  hasWarmDriver(): boolean {
    return this.driver !== null
  }
}
