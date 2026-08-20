/**
 * Chrome browser process lifecycle management.
 * Forked from Spectra — adapted for IBR engine.
 */

import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { existsSync, lstatSync, mkdtempSync, readdirSync, readlinkSync, rmSync, statSync, unlinkSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { createServer } from 'node:net'
import { homedir, hostname, tmpdir } from 'node:os'
import { join } from 'node:path'

export const CHROME_PATHS = [
  // macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  // Linux
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  // Windows (WSL)
  '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
]

export function findChrome(): string | null {
  for (const p of CHROME_PATHS) {
    if (existsSync(p)) return p
  }
  return null
}

export type BrowserMode = 'local' | 'connect'

export interface BrowserConnectionOptions {
  mode?: BrowserMode
  cdpUrl?: string
  wsEndpoint?: string
  chromePath?: string
}

interface ResolvedBrowserConnectionOptions {
  mode: BrowserMode
  cdpUrl?: string
  wsEndpoint?: string
  chromePath?: string
}

export interface BrowserOptions extends BrowserConnectionOptions {
  headless?: boolean    // default: true
  port?: number         // default: random ephemeral port
  userDataDir?: string  // default: ~/.ibr/chromium-profile/
  /**
   * Rendering normalization for mockup comparison.
   * Adds --disable-lcd-text and --force-device-scale-factor=1.
   * These improve pixel-level consistency but reduce text rendering quality.
   * Default: false
   */
  normalize?: boolean
}

function randomPort(): number {
  return 49152 + Math.floor(Math.random() * (65535 - 49152))
}

async function findFreePort(maxAttempts = 10): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = randomPort()
    const isFree = await checkPortFree(port)
    if (isFree) return port
  }
  // Last resort: let OS assign
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.listen(0, () => {
      const port = (srv.address() as any).port
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

function checkPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = createServer()
    srv.once('error', () => resolve(false))
    srv.listen(port, () => srv.close(() => resolve(true)))
  })
}

async function resolveWsEndpoint(cdpUrl: string): Promise<string> {
  const res = await fetch(`${cdpUrl}/json/version`)
  if (!res.ok) {
    throw new Error(`CDP endpoint did not respond: ${cdpUrl}`)
  }
  const data = await res.json() as { webSocketDebuggerUrl?: string }
  if (!data.webSocketDebuggerUrl) {
    throw new Error(`CDP endpoint did not return a WebSocket URL: ${cdpUrl}`)
  }
  return data.webSocketDebuggerUrl
}

export function resolveBrowserConnectionOptions(
  options: BrowserConnectionOptions = {},
  env: NodeJS.ProcessEnv = process.env,
): ResolvedBrowserConnectionOptions {
  const wsEndpoint = options.wsEndpoint || env.IBR_WS_ENDPOINT
  const cdpUrl = options.cdpUrl || env.IBR_CDP_URL
  const requestedMode = options.mode || env.IBR_BROWSER_MODE
  const mode: BrowserMode = requestedMode === 'local'
    ? 'local'
    : requestedMode === 'connect' || wsEndpoint || cdpUrl
      ? 'connect'
      : 'local'

  return {
    mode,
    cdpUrl,
    wsEndpoint,
    chromePath: options.chromePath || env.IBR_CHROME_PATH,
  }
}

/** Age below which an unreferenced profile is left alone, in ms. */
const PROFILE_REAP_GRACE_MS = 60 * 60 * 1000

/**
 * Chrome writes `SingletonLock` as a symlink to `<hostname>-<pid>`. A crash
 * leaves the link with a pid that no longer exists.
 *
 * Returns true when the lock was a leftover and has been removed, meaning the
 * shared profile is safe to use. Returns false when the holder is alive, when
 * the link belongs to another host, or when anything is unreadable — every
 * uncertain case keeps the lock, because wrongly reclaiming a LIVE profile
 * makes two Chromes fight over it.
 */
function reclaimStaleSingletonLock(lockPath: string): boolean {
  let target: string
  try {
    target = readlinkSync(lockPath)
  } catch {
    return false // not a symlink, or unreadable — do not touch it
  }
  const sep = target.lastIndexOf('-')
  if (sep <= 0) return false
  const host = target.slice(0, sep)
  const pid = Number(target.slice(sep + 1))
  if (!Number.isInteger(pid) || pid <= 0) return false
  // A pid is only meaningful on the host that wrote it.
  if (host !== hostname()) return false
  try {
    process.kill(pid, 0)
    return false // holder is alive
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EPERM') return false // alive, other user
  }
  try {
    unlinkSync(lockPath)
    return true
  } catch {
    return false
  }
}

/**
 * Delete `ibr-chrome-*` profiles that no running Chrome references.
 *
 * Liveness first: the in-use set is read from the `--user-data-dir` arguments
 * of running processes, so a profile in active use is never removed no matter
 * how old. Age is only a secondary guard against deleting a profile in the
 * window between `mkdtemp` and Chrome opening it.
 */
function reapOrphanedProfiles(): void {
  let inUse: Set<string>
  try {
    const ps = execFileSync('ps', ['-eo', 'command'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
    inUse = new Set(
      [...ps.matchAll(/--user-data-dir=(\S*ibr-chrome-[A-Za-z0-9]+)/g)].map((m) => m[1]),
    )
  } catch {
    return // cannot establish liveness — delete nothing
  }
  const dir = tmpdir()
  let entries: string[]
  try {
    entries = readdirSync(dir).filter((n) => n.startsWith('ibr-chrome-'))
  } catch {
    return
  }
  const now = Date.now()
  for (const name of entries) {
    const full = join(dir, name)
    if (inUse.has(full)) continue
    try {
      if (now - statSync(full).mtimeMs < PROFILE_REAP_GRACE_MS) continue
      rmSync(full, { recursive: true, force: true })
    } catch { /* best effort; retried next launch */ }
  }
}

export class BrowserManager {
  private process: ChildProcess | null = null
  private _port = 0
  private _mode: BrowserMode = 'local'
  private _cdpUrl: string | null = null
  private _wsEndpoint: string | null = null
  /** Set only when this browser owns a throwaway profile it must delete on close. */
  private _ephemeralProfileDir: string | null = null

  async launch(options: BrowserOptions = {}): Promise<string> {
    const connection = resolveBrowserConnectionOptions(options)
    this._mode = connection.mode

    if (connection.mode === 'connect') {
      this.process = null
      this._port = 0
      this._cdpUrl = connection.cdpUrl ?? null
      if (connection.wsEndpoint) {
        this._wsEndpoint = connection.wsEndpoint
        return connection.wsEndpoint
      }
      if (connection.cdpUrl) {
        const wsUrl = await resolveWsEndpoint(connection.cdpUrl)
        this._wsEndpoint = wsUrl
        return wsUrl
      }
      throw new Error(
        'Connect mode requires a CDP endpoint.\n'
        + 'Provide --cdp-url http://127.0.0.1:9222 or --ws-endpoint ws://...\n'
        + 'You can also set IBR_CDP_URL or IBR_WS_ENDPOINT.'
      )
    }

    const headless = options.headless ?? true
    this._port = options.port ?? await findFreePort()
    let userDataDir = options.userDataDir ?? join(homedir(), '.ibr', 'chromium-profile')

    // Chrome creates `SingletonLock` as a SYMLINK whose target is `<hostname>-<pid>`.
    // After a crash, the symlink remains but its target host/pid is gone, so
    // `existsSync` (which follows symlinks) returns false even though the link
    // is present. Chrome itself sees the link, refuses to acquire the singleton,
    // and aborts immediately ("Failed to create a ProcessSingleton... Aborting").
    // We must detect the symlink itself via `lstat`, not `stat`.
    const lockPath = join(userDataDir, 'SingletonLock')
    const lockStat = lstatSync(lockPath, { throwIfNoEntry: false })
    if (lockStat) {
      // A lock can mean two very different things, and treating them alike is
      // what produced 965 abandoned profiles (~16GB) on one machine: a single
      // stale symlink dated 2026-05-16 sent EVERY launch for three months down
      // the temp-profile path, and nothing ever deleted them.
      //
      // So resolve which it is. The target is `<hostname>-<pid>`: if that pid
      // is gone on this host, the lock is a crash leftover and the shared
      // profile is free — reclaim it. Only a genuinely live holder (real
      // concurrency) justifies a throwaway profile.
      if (reclaimStaleSingletonLock(lockPath)) {
        // Shared profile reclaimed; keep using it.
      } else {
        userDataDir = mkdtempSync(join(tmpdir(), 'ibr-chrome-'))
        this._ephemeralProfileDir = userDataDir
      }
    }

    // Liveness-aware sweep of profiles abandoned by earlier runs. Age alone is
    // not evidence of abandonment — a long scan legitimately holds a profile
    // for hours — so a directory is removed only when no running Chrome still
    // names it AND it is past the grace window.
    reapOrphanedProfiles()

    const chromePath = connection.chromePath ?? findChrome()
    if (!chromePath) {
      throw new Error(
        'Chrome not found. Install Google Chrome or pass chromePath option.\n'
        + `Checked: ${CHROME_PATHS.join(', ')}`
      )
    }

    await mkdir(userDataDir, { recursive: true })

    const args = [
      `--remote-debugging-port=${this._port}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-sync',
    ]
    if (headless) {
      args.push('--headless=new')
    }
    if (options.normalize) {
      // Reduce rendering inconsistencies for mockup pixel comparison
      args.push('--disable-lcd-text')          // disable subpixel text rendering
      args.push('--force-device-scale-factor=1') // prevent HiDPI scaling differences
    }

    this.process = spawn(chromePath, args, { stdio: 'pipe' })

    this.process.on('error', (err) => {
      console.error(`Chrome process error: ${err.message}`)
    })

    const wsUrl = await this.waitForDebugger()
    this._cdpUrl = `http://127.0.0.1:${this._port}`
    this._wsEndpoint = wsUrl
    return wsUrl
  }

  private async waitForDebugger(): Promise<string> {
    const maxAttempts = 50 // 5 seconds at 100ms intervals
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${this._port}/json/version`)
        const data = (await res.json()) as { webSocketDebuggerUrl: string }
        return data.webSocketDebuggerUrl
      } catch {
        await new Promise((r) => setTimeout(r, 100))
      }
    }
    throw new Error(
      `Chrome debugger did not respond within 5s on port ${this._port}. `
      + 'Is another Chrome instance using this port?\n'
      + 'If you are running inside a sandbox, retry with connect mode:\n'
      + '  --browser-mode connect --cdp-url http://127.0.0.1:9222'
    )
  }

  async close(): Promise<void> {
    if (this._mode !== 'local' || !this.process) return

    const proc = this.process
    this.process = null

    // Wait for process to exit, with SIGKILL escalation
    await new Promise<void>((resolve) => {
      const killTimer = setTimeout(() => {
        // Escalate to SIGKILL after 3 seconds
        try { proc.kill('SIGKILL') } catch { /* already dead */ }
        resolve()
      }, 3000)

      proc.once('close', () => {
        clearTimeout(killTimer)
        resolve()
      })

      proc.kill('SIGTERM')
    })

    // The profile only existed for this browser; Chrome has exited, so nothing
    // else can be reading it. Without this the directory outlives every run.
    if (this._ephemeralProfileDir) {
      try { rmSync(this._ephemeralProfileDir, { recursive: true, force: true }) } catch { /* best effort */ }
      this._ephemeralProfileDir = null
    }
  }

  get running(): boolean {
    return this.process !== null && !this.process.killed
  }

  get port(): number {
    return this._port
  }

  get pid(): number | null {
    return this.process?.pid ?? null
  }

  get mode(): BrowserMode {
    return this._mode
  }

  get cdpUrl(): string | null {
    return this._cdpUrl
  }

  get wsEndpoint(): string | null {
    return this._wsEndpoint
  }
}
