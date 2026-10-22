import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

import { findChrome } from './browser.js'
import {
  acquireSharedChrome,
  liveLeases,
  readSharedChromeState,
  shouldUseSharedChrome,
} from './shared-browser.js'
import { EngineDriver } from '../driver.js'

const dirs: string[] = []
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ibr-shared-'))
  dirs.push(dir)
  return dir
}

function alive(pid: number): boolean {
  try { process.kill(pid, 0); return true } catch { return false }
}

afterEach(async () => {
  for (const dir of dirs.splice(0)) {
    const state = readSharedChromeState(dir)
    if (state && alive(state.pid)) {
      try { process.kill(state.pid, 'SIGTERM') } catch { /* gone */ }
      const deadline = Date.now() + 10_000
      while (alive(state.pid) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100))
    }
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
}, 20_000)

describe('shouldUseSharedChrome', () => {
  it('shares plain headless launches by default', () => {
    expect(shouldUseSharedChrome({}, {})).toBe(true)
    expect(shouldUseSharedChrome({ headless: true }, {})).toBe(true)
  })

  it('keeps a private Chrome for anything that needs its own process', () => {
    for (const options of [
      { headless: false },
      { userDataDir: '/tmp/p' },
      { port: 9222 },
      { normalize: true },
      { mode: 'local' },
      { mode: 'connect' },
      { cdpUrl: 'http://127.0.0.1:9222' },
      { wsEndpoint: 'ws://x' },
      { chromePath: '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary' },
      { shareChrome: false },
    ]) {
      expect(shouldUseSharedChrome(options, {}), JSON.stringify(options)).toBe(false)
    }
    expect(shouldUseSharedChrome({}, { IBR_CDP_URL: 'http://127.0.0.1:9222' })).toBe(false)
    expect(shouldUseSharedChrome({}, { IBR_CHROME_PATH: '/opt/chrome' })).toBe(false)
  })

  it('follows IBR_BROWSER_MODE', () => {
    expect(shouldUseSharedChrome({}, { IBR_BROWSER_MODE: 'local' })).toBe(false)
    expect(shouldUseSharedChrome({}, { IBR_BROWSER_MODE: 'shared' })).toBe(true)
    expect(shouldUseSharedChrome({ headless: false }, { IBR_BROWSER_MODE: 'shared' })).toBe(false)
  })
})

describe('liveLeases', () => {
  it('counts leases of live processes and removes dead ones', () => {
    const dir = tempDir()
    mkdirSync(join(dir, 'leases'))
    writeFileSync(join(dir, 'leases', `${process.pid}-a`), '')
    writeFileSync(join(dir, 'leases', '999999-b'), '')
    expect(liveLeases(dir)).toEqual([`${process.pid}-a`])
    expect(readdirSync(join(dir, 'leases'))).toEqual([`${process.pid}-a`])
  })
})

const chrome = findChrome()

describe.skipIf(!chrome)('shared Chrome (real browser)', () => {
  it('serves two leases from one Chrome and stops it after idle', async () => {
    const dir = tempDir()
    const a = await acquireSharedChrome({ dir, idleMs: 1000 })
    const b = await acquireSharedChrome({ dir, idleMs: 1000 })
    expect(b.wsEndpoint).toBe(a.wsEndpoint)
    const state = readSharedChromeState(dir)!
    expect(alive(state.pid)).toBe(true)
    expect(liveLeases(dir)).toHaveLength(2)

    a.release()
    b.release()
    // The watchdog polls every 5 s and stops Chrome once idle.
    const deadline = Date.now() + 25_000
    while (alive(state.pid) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 250))
    expect(alive(state.pid)).toBe(false)
    expect(readSharedChromeState(dir)).toBeNull()
  }, 40_000)

  it('replaces a dead watchdog when the shared Chrome is reused', async () => {
    const dir = tempDir()
    const first = await acquireSharedChrome({ dir })
    const before = readSharedChromeState(dir)!
    expect(before.watchdogPid && alive(before.watchdogPid)).toBe(true)
    process.kill(before.watchdogPid!, 'SIGKILL')
    await new Promise((r) => setTimeout(r, 300))
    const second = await acquireSharedChrome({ dir })
    const after = readSharedChromeState(dir)!
    expect(after.pid).toBe(before.pid)
    expect(after.watchdogPid).not.toBe(before.watchdogPid)
    expect(alive(after.watchdogPid!)).toBe(true)
    first.release()
    second.release()
    process.kill(after.watchdogPid!, 'SIGTERM')
  }, 30_000)

  it('waits for a free lease when the cap is reached', async () => {
    const dir = tempDir()
    const first = await acquireSharedChrome({ dir, maxLeases: 1 })
    let secondGranted = false
    const second = acquireSharedChrome({ dir, maxLeases: 1, leaseWaitMs: 10_000 }).then((lease) => {
      secondGranted = true
      return lease
    })
    await new Promise((r) => setTimeout(r, 750))
    expect(secondGranted).toBe(false)
    first.release()
    const lease = await second
    expect(secondGranted).toBe(true)
    lease.release()
  }, 30_000)

  it('gives each driver its own cookies inside the shared Chrome', async () => {
    const dir = tempDir()
    const server = createServer((_, res) => { res.setHeader('content-type', 'text/html'); res.end('<p>ok</p>') })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`
    process.env.IBR_SHARED_CHROME_DIR = dir
    const one = new EngineDriver()
    const two = new EngineDriver()
    try {
      await one.launch({ headless: true })
      await two.launch({ headless: true })
      expect(one.usesSharedChrome).toBe(true)
      expect(two.usesSharedChrome).toBe(true)
      expect(liveLeases(dir)).toHaveLength(2)
      await one.navigate(url, { waitFor: 'load' })
      await two.navigate(url, { waitFor: 'load' })
      await one.evaluate("document.cookie = 'who=one; path=/'")
      expect(await one.evaluate('document.cookie')).toBe('who=one')
      // Same origin, same Chrome, different context: the cookie must not leak.
      expect(await two.evaluate('document.cookie')).toBe('')
    } finally {
      await one.close()
      await two.close()
      delete process.env.IBR_SHARED_CHROME_DIR
      server.close()
    }
    expect(liveLeases(dir)).toHaveLength(0)
  }, 40_000)
})
