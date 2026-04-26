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

  /**
   * Acquire the warm driver. Launches on first call. Awaits if another
   * caller currently holds the driver.
   *
   * Ticket-lock pattern: when a waiter wakes, the lock is *theirs* — no
   * re-check loop. release() hands ownership directly so the queue is
   * strictly FIFO and a fresh caller cannot jump in between release() and
   * the woken waiter's continuation.
   */
  async acquire(): Promise<EngineDriver> {
    if (this.closed) throw new Error('BrowserPool is closed')
    if (this.inUse) {
      await new Promise<void>((resolve) => this.waiters.push(resolve))
      // Re-check closed after wake — close() may have just resolved us.
      if (this.closed) throw new Error('BrowserPool is closed')
      // We were promised the lock by release(); inUse stays true.
    } else {
      this.inUse = true
    }
    if (!this.driver) {
      this.driver = new EngineDriver()
      try {
        await this.driver.launch(this.launchOptions)
      } catch (err) {
        // Reset state on launch failure so the next acquire can retry.
        // Hand off to the next waiter (or release the lock entirely if none).
        this.driver = null
        const next = this.waiters.shift()
        if (next) {
          next() // waiter is now owner; inUse stays true
        } else {
          this.inUse = false
        }
        throw err
      }
    }
    return this.driver
  }

  /**
   * Release the driver back to the pool. Hands off ownership to the next
   * waiter directly (without resetting inUse) so the queue stays FIFO.
   */
  release(): void {
    const next = this.waiters.shift()
    if (next) {
      next() // waiter is now owner; inUse stays true
    } else {
      this.inUse = false
    }
  }

  /**
   * Close the underlying browser. Future acquire() calls throw. Already-
   * waiting callers wake and observe `closed`, so no one hangs.
   *
   * Note: a current holder is *not* forcibly evicted. Their next release()
   * is still valid (it just falls through the no-waiters branch).
   */
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
    // Wake any pending waiters so they observe the closed state and throw.
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
