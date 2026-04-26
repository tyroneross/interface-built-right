/**
 * Unit tests for BrowserPool.
 *
 * Tests use a stubbed EngineDriver to avoid spinning up an actual Chrome
 * across the test suite — focuses on the pool's mutex and lifecycle logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrowserPool } from './browser-pool.js'

// Stub the driver. The pool only calls launch() and close() on it.
// `vi.hoisted` so the spies are available before the mock factory runs.
const { launchSpy, closeSpy } = vi.hoisted(() => ({
  launchSpy: vi.fn(),
  closeSpy: vi.fn(),
}))
let launchCount = 0
let closeCount = 0

vi.mock('./driver.js', () => {
  class FakeDriver {
    launch = launchSpy
    close = closeSpy
  }
  return { EngineDriver: FakeDriver }
})

beforeEach(() => {
  launchCount = 0
  closeCount = 0
  launchSpy.mockClear()
  closeSpy.mockClear()
  // Restore default success behaviour after any per-test override.
  launchSpy.mockImplementation(async () => {
    launchCount++
  })
  closeSpy.mockImplementation(async () => {
    closeCount++
  })
})

describe('BrowserPool', () => {
  it('launches the browser exactly once across multiple acquires', async () => {
    const pool = new BrowserPool()
    const d1 = await pool.acquire()
    pool.release()
    const d2 = await pool.acquire()
    pool.release()
    const d3 = await pool.acquire()
    pool.release()
    expect(launchCount).toBe(1)
    expect(d1).toBe(d2)
    expect(d2).toBe(d3)
    await pool.close()
  })

  it('serialises concurrent acquires (mutex)', async () => {
    const pool = new BrowserPool()
    const order: string[] = []

    const job = async (label: string, holdMs: number) => {
      await pool.acquire()
      order.push(`${label}:start`)
      await new Promise((r) => setTimeout(r, holdMs))
      order.push(`${label}:end`)
      pool.release()
    }

    await Promise.all([job('A', 30), job('B', 10)])
    // A held the mutex first; B waits until A releases before it acquires.
    expect(order).toEqual(['A:start', 'A:end', 'B:start', 'B:end'])
    await pool.close()
  })

  it('hasWarmDriver reflects state', async () => {
    const pool = new BrowserPool()
    expect(pool.hasWarmDriver()).toBe(false)
    await pool.acquire()
    pool.release()
    expect(pool.hasWarmDriver()).toBe(true)
    await pool.close()
    expect(pool.hasWarmDriver()).toBe(false)
  })

  it('close() shuts the underlying driver and rejects future acquires', async () => {
    const pool = new BrowserPool()
    await pool.acquire()
    pool.release()
    await pool.close()
    expect(closeCount).toBe(1)
    await expect(pool.acquire()).rejects.toThrow(/closed/)
  })

  // Regression: close() called while a holder is still active used to hang
  // any pending waiter forever (waiter woke, re-entered while-loop, saw
  // inUse still true, queued another never-resolving waiter). Ticket-lock
  // refactor fixes this: woken waiters check `closed` and throw, never loop.
  it('close() while a holder is active wakes pending waiters with closed error (no hang)', async () => {
    const pool = new BrowserPool()
    await pool.acquire() // holder A — never releases in this test
    const acquireB = pool.acquire() // queues a waiter
    // Race: close while B is still queued.
    const closed = pool.close()
    await expect(acquireB).rejects.toThrow(/closed/)
    await closed
  })

  it('release() hands off ownership FIFO — fresh acquire cannot jump the queue', async () => {
    const pool = new BrowserPool()
    const order: string[] = []

    await pool.acquire() // hold

    // B queues first.
    const b = (async () => {
      await pool.acquire()
      order.push('B')
      pool.release()
    })()

    // Microtask checkpoint to ensure B is queued before C tries.
    await Promise.resolve()

    // Now release the holder. B should be next, not any C that races to acquire.
    pool.release()
    // C tries to acquire AFTER release — it must wait until B finishes.
    const c = (async () => {
      await pool.acquire()
      order.push('C')
      pool.release()
    })()

    await Promise.all([b, c])
    expect(order).toEqual(['B', 'C'])
    await pool.close()
  })

  it('failed launch resets state so the next acquire retries', async () => {
    launchSpy.mockImplementationOnce(async () => {
      throw new Error('cdp connect failed')
    })
    const pool = new BrowserPool()
    await expect(pool.acquire()).rejects.toThrow(/cdp connect failed/)
    expect(pool.hasWarmDriver()).toBe(false)
    // Second attempt succeeds.
    await pool.acquire()
    pool.release()
    expect(pool.hasWarmDriver()).toBe(true)
    await pool.close()
  })
})
