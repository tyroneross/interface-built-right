/**
 * Unit tests for BrowserPool.
 *
 * Tests use a stubbed EngineDriver to avoid spinning up an actual Chrome
 * across the test suite — focuses on the pool's mutex and lifecycle logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrowserPool } from './browser-pool.js'
import { initScanCookies } from '../scan.js'
import type { SetCookieParams } from './cdp/network.js'

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

/**
 * Regression: cross-scan cookie/auth leak on the warm BrowserPool path.
 *
 * Before the fix, scan() called driver.setCookies() on a pooled (reused)
 * EngineDriver without first clearing the existing jar. Scan A would
 * authenticate; scan B (different URL, no cookies) would silently inherit
 * scan A's session — cross-caller auth leakage in a single MCP server
 * process. The `initScanCookies` helper closes that hole; these tests
 * exercise it directly so the contract is locked in regardless of the
 * surrounding scan() refactors.
 */
describe('scan() cookie initialization (cross-scan leak fix)', () => {
  type Op = { name: 'clearCookies' | 'setCookies'; args?: unknown }

  function makeDriver() {
    const ops: Op[] = []
    return {
      ops,
      clearCookies: vi.fn(async () => { ops.push({ name: 'clearCookies' }) }),
      setCookies: vi.fn(async (c: SetCookieParams[]) => {
        ops.push({ name: 'setCookies', args: c })
      }),
    }
  }

  const cookiesA: SetCookieParams[] = [
    { name: 'session', value: 'A-secret', domain: 'example.com', path: '/' },
  ]

  it('pool path: scan A applies cookies (clear then set)', async () => {
    const driver = makeDriver()
    await initScanCookies(driver, /* ownDriver */ false, cookiesA)
    expect(driver.clearCookies).toHaveBeenCalledTimes(1)
    expect(driver.setCookies).toHaveBeenCalledTimes(1)
    expect(driver.setCookies).toHaveBeenCalledWith(cookiesA)
    // Order matters: clear must precede set, otherwise stale residue is
    // not actually removed before the new jar is layered on.
    expect(driver.ops.map((o) => o.name)).toEqual(['clearCookies', 'setCookies'])
  })

  it('pool path: scan B with NO cookies still clears scan A residue (THE LEAK CASE)', async () => {
    const driver = makeDriver()
    // First, simulate scan A by establishing residue (the test runs against
    // the helper, but conceptually the pooled driver carries A's cookies).
    await initScanCookies(driver, /* ownDriver */ false, cookiesA)
    driver.clearCookies.mockClear()
    driver.setCookies.mockClear()
    driver.ops.length = 0

    // Scan B reuses the pooled driver and passes NO cookies. Without the
    // fix, setCookies is skipped AND clearCookies is never called → scan B
    // sees scan A's cookies. With the fix, clearCookies fires
    // unconditionally on the pool path.
    await initScanCookies(driver, /* ownDriver */ false, undefined)
    expect(driver.clearCookies).toHaveBeenCalledTimes(1)
    expect(driver.setCookies).not.toHaveBeenCalled()
    expect(driver.ops.map((o) => o.name)).toEqual(['clearCookies'])
  })

  it('pool path: scan B with empty cookies[] still clears residue', async () => {
    const driver = makeDriver()
    await initScanCookies(driver, /* ownDriver */ false, [])
    // Empty array is treated like "no cookies" for setCookies, but clear
    // still fires on the pool path.
    expect(driver.clearCookies).toHaveBeenCalledTimes(1)
    expect(driver.setCookies).not.toHaveBeenCalled()
  })

  it('fresh-driver path: skips clearCookies (jar is empty by construction)', async () => {
    const driver = makeDriver()
    await initScanCookies(driver, /* ownDriver */ true, cookiesA)
    // A freshly launched EngineDriver starts with an empty cookie jar; the
    // clear is a CDP round-trip we can skip. setCookies still applies when
    // the caller supplied cookies.
    expect(driver.clearCookies).not.toHaveBeenCalled()
    expect(driver.setCookies).toHaveBeenCalledWith(cookiesA)
  })

  it('fresh-driver path: no cookies → no-op (no clear, no set)', async () => {
    const driver = makeDriver()
    await initScanCookies(driver, /* ownDriver */ true, undefined)
    expect(driver.clearCookies).not.toHaveBeenCalled()
    expect(driver.setCookies).not.toHaveBeenCalled()
  })

  it('clearCookies failure is non-fatal — scan proceeds and setCookies still runs', async () => {
    const driver = makeDriver()
    driver.clearCookies.mockImplementationOnce(async () => {
      throw new Error('CDP disconnect during Network.clearBrowserCookies')
    })
    await expect(
      initScanCookies(driver, /* ownDriver */ false, cookiesA),
    ).resolves.toBeUndefined()
    expect(driver.setCookies).toHaveBeenCalledWith(cookiesA)
  })

  it('setCookies failure is non-fatal — scan proceeds (caller sees unauth state)', async () => {
    const driver = makeDriver()
    driver.setCookies.mockImplementationOnce(async () => {
      throw new Error('CDP refused: invalid cookie domain')
    })
    await expect(
      initScanCookies(driver, /* ownDriver */ false, cookiesA),
    ).resolves.toBeUndefined()
    // Clear still ran — the security boundary holds even when set fails.
    expect(driver.clearCookies).toHaveBeenCalledTimes(1)
  })
})
