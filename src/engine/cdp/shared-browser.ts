/**
 * One shared headless Chrome per user.
 *
 * Every IBR command used to launch its own Chrome. On a busy machine that is
 * many Chrome starts, a code-signing copy per start on macOS, and a pile of
 * CPU. Instead, headless commands lease the shared Chrome, each in its own
 * browser context (separate cookies and storage), and a detached watchdog
 * stops Chrome politely (SIGTERM, which lets it clean up) after it sits idle.
 *
 * Layout under the shared directory (default ~/.ibr/shared-chrome):
 *   state.json    { pid, port, wsEndpoint, profileDir, startedAt }
 *   lock/         mkdir-based mutex for start-up and lease admission
 *   leases/<pid>-<id>   one file per command currently using Chrome
 *   profile/      Chrome user-data dir (contexts keep commands apart)
 */

import { spawn } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { findChrome, keychainArgs } from './browser.js'

export interface SharedChromeState {
  pid: number
  port: number
  wsEndpoint: string
  profileDir: string
  startedAt: number
  /** The idle watchdog's pid, so a dead watchdog can be replaced. */
  watchdogPid?: number
}

export interface SharedChromeLease {
  wsEndpoint: string
  /** Remove this command's lease. Idempotent. */
  release(): void
}

export interface SharedChromeOptions {
  dir?: string
  chromePath?: string
  /** Most commands that may use the shared Chrome at once. */
  maxLeases?: number
  /** How long to wait for a free lease before proceeding anyway. */
  leaseWaitMs?: number
  /** Idle time after which the watchdog stops Chrome. */
  idleMs?: number
  onProgress?: (step: string) => void
}

export const SHARED_CHROME_DEFAULT_MAX_LEASES = 6
export const SHARED_CHROME_DEFAULT_IDLE_MS = 10 * 60 * 1000
const LOCK_STALE_MS = 60_000
const LOCK_WAIT_MS = 30_000
const DEBUGGER_WAIT_MS = 20_000

export function sharedChromeDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.IBR_SHARED_CHROME_DIR || join(homedir(), '.ibr', 'shared-chrome')
}

function envInt(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? '', 10)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function pidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function withLock<T>(dir: string, fn: () => Promise<T>): Promise<T> {
  const lockDir = join(dir, 'lock')
  const deadline = Date.now() + LOCK_WAIT_MS
  for (;;) {
    try {
      mkdirSync(lockDir)
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      try {
        if (Date.now() - statSync(lockDir).mtimeMs > LOCK_STALE_MS) {
          rmSync(lockDir, { recursive: true, force: true })
          continue
        }
      } catch { /* lock vanished; retry */ }
      if (Date.now() > deadline) throw new Error(`shared Chrome lock busy: ${lockDir}`)
      await sleep(100)
    }
  }
  try {
    return await fn()
  } finally {
    rmSync(lockDir, { recursive: true, force: true })
  }
}

/** Lease files whose owning process is alive. Dead owners' files are removed. */
export function liveLeases(dir: string): string[] {
  const leasesDir = join(dir, 'leases')
  let names: string[]
  try {
    names = readdirSync(leasesDir)
  } catch {
    return []
  }
  const live: string[] = []
  for (const name of names) {
    const pid = Number.parseInt(name.split('-')[0] ?? '', 10)
    if (pidAlive(pid)) live.push(name)
    else rmSync(join(leasesDir, name), { force: true })
  }
  return live
}

export function readSharedChromeState(dir: string): SharedChromeState | null {
  try {
    const state = JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8')) as SharedChromeState
    return typeof state.pid === 'number' && typeof state.wsEndpoint === 'string' ? state : null
  } catch {
    return null
  }
}

async function debuggerEndpoint(port: number, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: controller.signal })
    if (!res.ok) return null
    const data = await res.json() as { webSocketDebuggerUrl?: string }
    return data.webSocketDebuggerUrl ?? null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as { port: number }).port
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

/**
 * The watchdog runs as its own detached node process so it outlives the
 * command that started Chrome. It stops Chrome with SIGTERM once no live lease
 * has existed for `idleMs`, and exits when Chrome does.
 */
const WATCHDOG_SOURCE = `
const fs = require('node:fs'), path = require('node:path');
const [dir, chromePidArg, idleArg, profileDir] = process.argv.slice(1);
const chromePid = Number(chromePidArg), idleMs = Number(idleArg);
const alive = (p) => { try { process.kill(p, 0); return true } catch (e) { return e.code === 'EPERM' } };
const clearState = () => { try {
  const s = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'));
  if (s.pid === chromePid) fs.rmSync(path.join(dir, 'state.json'), { force: true });
} catch {} };
let lastBusy = Date.now(), stopping = 0;
setInterval(() => {
  if (!alive(chromePid)) {
    clearState();
    if (profileDir) { try { fs.rmSync(profileDir, { recursive: true, force: true }) } catch {} }
    process.exit(0);
  }
  if (stopping) {
    if (Date.now() - stopping > 20000) { try { process.kill(chromePid, 'SIGKILL') } catch {} }
    return;
  }
  const busy = () => {
    let any = false;
    try {
      for (const name of fs.readdirSync(path.join(dir, 'leases'))) {
        if (alive(Number(name.split('-')[0]))) any = true;
        else fs.rmSync(path.join(dir, 'leases', name), { force: true });
      }
    } catch {}
    return any;
  };
  if (busy()) { lastBusy = Date.now(); return }
  if (Date.now() - lastBusy < idleMs) return;
  // Take the same lock commands use to grant leases, so no lease can be
  // granted between this last check and retiring the state file.
  const lockDir = path.join(dir, 'lock');
  try { fs.mkdirSync(lockDir) } catch {
    try { if (Date.now() - fs.statSync(lockDir).mtimeMs > 60000) fs.rmSync(lockDir, { recursive: true, force: true }) } catch {}
    return; // a command holds the lock; look again next tick
  }
  try {
    if (busy()) { lastBusy = Date.now(); return }
    clearState();
  } finally {
    try { fs.rmSync(lockDir, { recursive: true, force: true }) } catch {}
  }
  stopping = Date.now();
  try { process.kill(chromePid, 'SIGTERM') } catch {}
}, 5000);
`

async function startSharedChrome(dir: string, options: SharedChromeOptions): Promise<SharedChromeState> {
  const progress = options.onProgress ?? (() => {})
  const chromePath = options.chromePath ?? process.env.IBR_CHROME_PATH ?? findChrome()
  if (!chromePath) throw new Error('Chrome not found for the shared browser')
  const port = await freePort()
  // A fresh profile per start: a Chrome still shutting down keeps its own
  // profile lock, so a new Chrome never collides with it.
  pruneOldProfiles(dir)
  const profileDir = join(dir, `profile-${Date.now().toString(36)}`)
  mkdirSync(profileDir, { recursive: true })
  progress(`starting shared Chrome on port ${port}`)
  const child = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-sync',
    ...keychainArgs(),
    '--headless=new',
  ], { detached: true, stdio: 'ignore' })
  child.unref()
  const pid = child.pid
  if (!pid) throw new Error('shared Chrome did not start')

  const deadline = Date.now() + DEBUGGER_WAIT_MS
  let wsEndpoint: string | null = null
  while (Date.now() < deadline && pidAlive(pid)) {
    wsEndpoint = await debuggerEndpoint(port, 1000)
    if (wsEndpoint) break
    await sleep(200)
  }
  if (!wsEndpoint) {
    try { process.kill(pid, 'SIGTERM') } catch { /* already gone */ }
    throw new Error(`shared Chrome did not open its debugger on port ${port}`)
  }

  const state: SharedChromeState = { pid, port, wsEndpoint, profileDir, startedAt: Date.now() }
  state.watchdogPid = spawnWatchdog(dir, state, options)
  writeFileSync(join(dir, 'state.json'), JSON.stringify(state, null, 2))
  progress(`shared Chrome pid ${pid} ready`)
  return state
}

function spawnWatchdog(dir: string, state: SharedChromeState, options: SharedChromeOptions): number | undefined {
  const idleMs = options.idleMs ?? envInt('IBR_SHARED_CHROME_IDLE_MS', SHARED_CHROME_DEFAULT_IDLE_MS)
  const child = spawn(process.execPath, ['-e', WATCHDOG_SOURCE, dir, String(state.pid), String(idleMs), state.profileDir], {
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
  return child.pid
}

/** Remove profiles no live shared Chrome uses (older than 10 minutes, not the current one). */
function pruneOldProfiles(dir: string): void {
  const current = readSharedChromeState(dir)?.profileDir
  let names: string[] = []
  try { names = readdirSync(dir) } catch { return }
  for (const name of names) {
    if (!name.startsWith('profile')) continue
    const path = join(dir, name)
    if (path === current) continue
    try {
      if (Date.now() - statSync(path).mtimeMs > 10 * 60 * 1000) rmSync(path, { recursive: true, force: true })
    } catch { /* in use or gone */ }
  }
}

/**
 * Lease the shared Chrome, starting it if needed. Waits for a free lease when
 * `maxLeases` commands already hold one, then proceeds anyway after
 * `leaseWaitMs` so a stuck holder never blocks work.
 */
export async function acquireSharedChrome(options: SharedChromeOptions = {}): Promise<SharedChromeLease> {
  const dir = options.dir ?? sharedChromeDir()
  const progress = options.onProgress ?? (() => {})
  mkdirSync(join(dir, 'leases'), { recursive: true })
  const maxLeases = options.maxLeases ?? envInt('IBR_SHARED_CHROME_MAX_PAGES', SHARED_CHROME_DEFAULT_MAX_LEASES)
  const waitUntil = Date.now() + (options.leaseWaitMs ?? 120_000)
  let warned = false

  for (;;) {
    const granted = await withLock(dir, async () => {
      if (liveLeases(dir).length >= maxLeases && Date.now() < waitUntil) return null
      let state = readSharedChromeState(dir)
      // Reuse only the exact Chrome recorded: same pid alive and the same
      // debugger endpoint (a reboot can hand the pid and port to another process).
      if (state && !(pidAlive(state.pid) && await debuggerEndpoint(state.port, 2000) === state.wsEndpoint)) {
        rmSync(join(dir, 'state.json'), { force: true })
        state = null
      }
      if (!state) state = await startSharedChrome(dir, options)
      else if (!state.watchdogPid || !pidAlive(state.watchdogPid)) {
        // Without a watchdog the shared Chrome would never stop.
        state.watchdogPid = spawnWatchdog(dir, state, options)
        writeFileSync(join(dir, 'state.json'), JSON.stringify(state, null, 2))
      }
      const leasePath = join(dir, 'leases', `${process.pid}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`)
      writeFileSync(leasePath, '')
      return { state, leasePath }
    })
    if (granted) {
      let released = false
      return {
        wsEndpoint: granted.state.wsEndpoint,
        release() {
          if (released) return
          released = true
          rmSync(granted.leasePath, { force: true })
        },
      }
    }
    if (!warned) {
      progress(`waiting: ${maxLeases} commands already use the shared Chrome`)
      warned = true
    }
    await sleep(250)
  }
}

/**
 * Whether a launch should use the shared Chrome. Anything that needs its own
 * process (a visible window, a fixed profile or port, rendering flags, an
 * explicit endpoint or mode) keeps the old per-command launch.
 * IBR_BROWSER_MODE=local turns sharing off; =shared forces it.
 */
export function shouldUseSharedChrome(
  options: {
    mode?: string
    cdpUrl?: string
    wsEndpoint?: string
    headless?: boolean
    userDataDir?: string
    port?: number
    normalize?: boolean
    chromePath?: string
    /** false keeps a private Chrome (the in-process BrowserPool sets this). */
    shareChrome?: boolean
  },
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (options.shareChrome === false) return false
  const envMode = env.IBR_BROWSER_MODE
  if (envMode === 'shared') return options.headless !== false
  if (envMode) return false
  if (options.mode || options.cdpUrl || options.wsEndpoint || env.IBR_CDP_URL || env.IBR_WS_ENDPOINT) return false
  if (options.headless === false || options.userDataDir || options.port || options.normalize) return false
  // A chosen binary must be the one that runs; the shared Chrome may be another.
  if (options.chromePath || env.IBR_CHROME_PATH) return false
  return true
}
