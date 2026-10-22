import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  CODE_SIGN_CLONE_GRACE_MS,
  chromeCodeSignCloneRoot,
  openCodeSignClones,
  runningChromeStartTimes,
  sweepStaleChromeCodeSignClones,
} from './browser.js'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

/** `ps -axo lstart=` style timestamp for a given epoch ms (local time). */
function lstart(ms: number): string {
  const d = new Date(ms)
  const day = d.toLocaleString('en-US', { weekday: 'short' })
  const mon = d.toLocaleString('en-US', { month: 'short' })
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${day} ${mon} ${String(d.getDate()).padStart(2, ' ')} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${d.getFullYear()}`
}

const dirs: string[] = []
function cloneRoot(names: string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'ibr-clone-root-'))
  dirs.push(root)
  for (const name of names) mkdirSync(join(root, name, 'Contents'), { recursive: true })
  return root
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('chromeCodeSignCloneRoot', () => {
  it('maps the per-user T temp dir to its sibling X folder', () => {
    expect(chromeCodeSignCloneRoot('/var/folders/rx/abc/T/'))
      .toBe('/var/folders/rx/abc/X/com.google.Chrome.code_sign_clone')
  })
})

describe('runningChromeStartTimes', () => {
  it('keeps browser processes and ignores helpers and other apps', () => {
    const t = Date.parse('2026-10-22T08:00:00')
    const ps = [
      `${lstart(t)} ${CHROME} --headless=new --remote-debugging-port=9222`,
      `${lstart(t)} ${CHROME} --type=renderer`,
      `${lstart(t)} /Applications/Safari.app/Contents/MacOS/Safari`,
    ].join('\n')
    expect(runningChromeStartTimes(ps)).toEqual([t])
  })
})

describe('sweepStaleChromeCodeSignClones', () => {
  it('removes every copy older than the grace window when no Chrome runs', () => {
    const root = cloneRoot(['code_sign_clone.aaa', 'code_sign_clone.bbb', 'unrelated'])
    const now = Date.now() + CODE_SIGN_CLONE_GRACE_MS + 60_000
    const result = sweepStaleChromeCodeSignClones({ root, psOutput: '', lsofOutput: '', now, platform: 'darwin' })
    expect(result.removed).toHaveLength(2)
    expect(existsSync(join(root, 'code_sign_clone.aaa'))).toBe(false)
    expect(existsSync(join(root, 'unrelated'))).toBe(true)
  })

  it('keeps a copy that a running process holds open', () => {
    const root = cloneRoot(['code_sign_clone.live', 'code_sign_clone.dead'])
    const now = Date.now() + CODE_SIGN_CLONE_GRACE_MS + 60_000
    const lsof = `p11685\ncGoogle Chrome\nn${root}/code_sign_clone.live/Contents/Frameworks/x.dylib\nn/usr/lib/dyld`
    const result = sweepStaleChromeCodeSignClones({ root, lsofOutput: lsof, now, platform: 'darwin' })
    expect(existsSync(join(root, 'code_sign_clone.live'))).toBe(true)
    expect(existsSync(join(root, 'code_sign_clone.dead'))).toBe(false)
    expect(result.removed).toHaveLength(1)
  })

  it('reads /private/var paths from lsof as the same folder', () => {
    const open = openCodeSignClones('/var/folders/a/X/c', 'n/private/var/folders/a/X/c/code_sign_clone.q/Contents/x')
    expect([...(open ?? [])]).toEqual(['code_sign_clone.q'])
  })

  it('without lsof, keeps copies a running Chrome could own', () => {
    const root = cloneRoot(['code_sign_clone.live'])
    const now = Date.now() + CODE_SIGN_CLONE_GRACE_MS + 60_000
    // This Chrome started before the copy was made, so the copy may be its own.
    const ps = `${lstart(Date.now() - 10 * 60_000)} ${CHROME} --headless=new`
    const result = sweepStaleChromeCodeSignClones({ root, psOutput: ps, lsofOutput: null, now, platform: 'darwin' })
    expect(result.removed).toEqual([])
    expect(existsSync(join(root, 'code_sign_clone.live'))).toBe(true)
  })

  it('without lsof, removes copies made before the earliest running Chrome started', () => {
    const root = cloneRoot(['code_sign_clone.old'])
    const now = Date.now() + 30 * 60_000
    // The only running Chrome started 20 minutes after the copy was made.
    const ps = `${lstart(Date.now() + 20 * 60_000)} ${CHROME}`
    const result = sweepStaleChromeCodeSignClones({ root, psOutput: ps, lsofOutput: null, now, platform: 'darwin' })
    expect(result.removed).toHaveLength(1)
  })

  it('keeps copies inside the grace window even with no Chrome running', () => {
    const root = cloneRoot(['code_sign_clone.new'])
    const result = sweepStaleChromeCodeSignClones({ root, psOutput: '', lsofOutput: '', now: Date.now(), platform: 'darwin' })
    expect(result.removed).toEqual([])
  })

  it('does nothing off macOS or when the folder is missing', () => {
    const root = cloneRoot(['code_sign_clone.x'])
    const now = Date.now() + CODE_SIGN_CLONE_GRACE_MS + 60_000
    expect(sweepStaleChromeCodeSignClones({ root, psOutput: '', now, lsofOutput: '', platform: 'linux' }).removed).toEqual([])
    expect(sweepStaleChromeCodeSignClones({ root: join(root, 'missing'), psOutput: '', lsofOutput: '', now, platform: 'darwin' }).removed).toEqual([])
  })
})
