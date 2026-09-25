/**
 * Regression suite for the shared-profile launch race (Fix 1).
 *
 * Evidence: 3 concurrent `ibr scan https://rosslabs.ai/simulations/ --json`
 * runs against the DEFAULT shared profile — 2 of 3 exited "Chrome exited
 * before its debugger came up (code 21)" with stderr "Failed to create
 * .../.ibr/chromium-profile/SingletonLock: File exists". The bug was
 * check-then-act: two launchers both `lstat`'d the SingletonLock, both saw
 * it absent, and both spawned Chrome on the SAME shared profile.
 *
 * This launches 4 browsers CONCURRENTLY via `EngineDriver.launch()` with NO
 * `userDataDir` override — the exact code path every one-shot CLI command
 * uses (`withBrowserOptions()` in bin/ibr.ts never sets userDataDir).
 * `HOME` is pointed at an isolated tmp dir for the duration of the test so
 * this exercises `join(homedir(), '.ibr', 'chromium-profile')` for real
 * without colliding with any other IBR process using the developer's
 * actual `~/.ibr/chromium-profile` on this machine.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { EngineDriver } from '../driver.js'
import { BROWSER_SPAWN_TIMEOUT_MS } from '../net-timeout.js'

// 4 real Chrome spawns, some of them contending and falling back to
// mkdtemp profiles, comfortably fits inside 4x the single-launch budget.
const CONCURRENT_LAUNCH_TIMEOUT_MS = BROWSER_SPAWN_TIMEOUT_MS * 4 + 30_000

describe('BrowserManager.launch — concurrent launches on the shared default profile (Fix 1 regression)', () => {
  let fakeHome: string
  let realHome: string | undefined

  beforeAll(() => {
    fakeHome = mkdtempSync(join(tmpdir(), 'ibr-concurrent-home-'))
    realHome = process.env.HOME
    process.env.HOME = fakeHome
  })

  afterAll(() => {
    if (realHome !== undefined) process.env.HOME = realHome
    else delete process.env.HOME
    rmSync(fakeHome, { recursive: true, force: true })
  })

  it('brings up all 4 concurrent launches successfully, each independently usable, then releases the profile lock', async () => {
    const drivers = Array.from({ length: 4 }, () => new EngineDriver())

    const results = await Promise.allSettled(
      drivers.map((driver) => driver.launch({ headless: true })),
    )

    const failures = results
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.status === 'rejected')
    if (failures.length > 0) {
      const detail = failures
        .map(({ r, i }) => `driver[${i}]: ${(r as PromiseRejectedResult).reason}`)
        .join('\n')
      throw new Error(`${failures.length}/4 concurrent launches failed:\n${detail}`)
    }
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)

    try {
      // Not just "didn't throw" — every browser must actually be live and
      // independently addressable (this is what a symlink-based Chrome
      // SingletonLock collision breaks: the loser's Chrome process exits
      // immediately, so any evaluate() against it would hang or reject).
      const answers = await Promise.all(drivers.map((driver) => driver.evaluate('1 + 1')))
      expect(answers).toEqual([2, 2, 2, 2])
    } finally {
      await Promise.all(drivers.map((driver) => driver.close()))
    }

    // The IBR profile lock must not outlive every browser that held it —
    // otherwise the NEXT launch on this profile would wrongly see it as
    // contended and fall back to a throwaway profile forever.
    const lockPath = join(fakeHome, '.ibr', 'chromium-profile.ibr-lock')
    expect(existsSync(lockPath)).toBe(false)
  }, CONCURRENT_LAUNCH_TIMEOUT_MS)

  // The reported bug was between separate `ibr scan` PROCESSES. In-process
  // launches share a pid, so they cannot exercise cross-process lock
  // contention; this spawns 4 independent Node processes on the same HOME.
  it('4 concurrent launches from 4 separate processes all come up (cross-process race)', async () => {
    const here = __dirname
    const repoRoot = join(here, '..', '..', '..')
    const tsx = join(repoRoot, 'node_modules', '.bin', 'tsx')
    const driverPath = join(here, '..', 'driver.ts')
    const script = `
      const { EngineDriver } = await import(${JSON.stringify(driverPath)});
      const d = new EngineDriver();
      try {
        await d.launch({ headless: true });
        const v = await d.evaluate('1 + 1');
        process.stdout.write('RESULT=' + v + '\\n');
      } finally { await d.close(); }
    `
    const scriptPath = join(fakeHome, 'launch-one.mts')
    writeFileSync(scriptPath, script)
    const runOne = () => new Promise<{ code: number | null; out: string }>((resolve) => {
      const child = spawn(tsx, [scriptPath], { env: { ...process.env, HOME: fakeHome } })
      let out = ''
      child.stdout.on('data', (b) => { out += b })
      child.stderr.on('data', (b) => { out += b })
      child.on('close', (code) => resolve({ code, out }))
    })

    const runs = await Promise.all([runOne(), runOne(), runOne(), runOne()])
    for (const r of runs) {
      expect(r.code, r.out).toBe(0)
      expect(r.out).toMatch(/RESULT=2/)
    }
    expect(existsSync(join(fakeHome, '.ibr', 'chromium-profile.ibr-lock'))).toBe(false)
  }, CONCURRENT_LAUNCH_TIMEOUT_MS)
})
