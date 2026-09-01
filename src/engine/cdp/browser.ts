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
import {
  BROWSER_SPAWN_TIMEOUT_MS,
  CDP_PROBE_TIMEOUT_MS,
  ConnectTimeoutError,
  fetchWithTimeout,
} from '../net-timeout.js'

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
  /**
   * Called with each spawn step ('finding chrome', 'spawned pid 123', ...).
   * A spawn that fails silently is unusable; this makes every stage visible
   * without turning on a debugger.
   */
  onProgress?: (step: string) => void
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
  const res = await fetchWithTimeout(`${cdpUrl}/json/version`, {
    timeoutMs: CDP_PROBE_TIMEOUT_MS,
    waitingOn: `CDP version probe ${cdpUrl}/json/version`,
  })
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

export interface IbrChromeProcess {
  pid: number
  ppid: number
  profileDir: string
  command: string
}

export interface IbrChromeReapResult {
  reaped: number[]
  preserved: number[]
}

function processTable(): string {
  return execFileSync('ps', ['-axo', 'pid=,ppid=,command='], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  })
}

function userDataDirFromCommand(command: string): string | null {
  const match = command.match(/--user-data-dir=(?:"([^"]+)"|'([^']+)'|(\S+))/)
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null
}

function isIbrProfile(profileDir: string): boolean {
  return profileDir.startsWith(`${tmpdir()}/ibr-chrome-`)
    || profileDir === join(homedir(), '.ibr', 'chromium-profile')
    || profileDir === '.ibr/browser-profile'
    || profileDir.endsWith('/.ibr/browser-profile')
}

/**
 * Parse only IBR-owned Chrome MAIN processes from a `ps` table.
 *
 * Chrome helpers inherit `--user-data-dir`, but also carry `--type=...`; the
 * main process does not. Reaping only the main process lets Chrome shut down
 * its own helper tree and avoids counting one browser as a dozen sessions.
 */
export function parseIbrChromeProcesses(psOutput: string): IbrChromeProcess[] {
  const processes: IbrChromeProcess[] = []
  for (const line of psOutput.split('\n')) {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/)
    if (!match) continue
    const command = match[3]
    if (!command.includes('--remote-debugging-port=') || command.includes('--type=')) continue
    const profileDir = userDataDirFromCommand(command)
    if (!profileDir || !isIbrProfile(profileDir)) continue
    processes.push({
      pid: Number(match[1]),
      ppid: Number(match[2]),
      profileDir,
      command,
    })
  }
  return processes
}

/**
 * Terminate orphaned IBR Chrome processes and preserve everything else.
 *
 * A process is orphaned only after macOS/Linux reparents it to pid 1. Age or a
 * failed CDP probe is not enough: a live browser can be quiet or temporarily
 * busy. The ownership boundary is equally strict — the command must carry an
 * IBR profile and a CDP port, so the user's normal Chrome is never selected.
 */
export function reapOrphanedIbrChromeProcesses(options: {
  psOutput?: string
  kill?: (pid: number, signal: NodeJS.Signals) => void
} = {}): IbrChromeReapResult {
  let processes: IbrChromeProcess[]
  try {
    processes = parseIbrChromeProcesses(options.psOutput ?? processTable())
  } catch {
    return { reaped: [], preserved: [] }
  }

  const kill = options.kill ?? ((pid, signal) => process.kill(pid, signal))
  const result: IbrChromeReapResult = { reaped: [], preserved: [] }
  for (const entry of processes) {
    if (entry.ppid !== 1) {
      result.preserved.push(entry.pid)
      continue
    }
    try {
      kill(entry.pid, 'SIGTERM')
      result.reaped.push(entry.pid)
    } catch {
      // The process may have exited between `ps` and the signal.
    }
  }
  return result
}

export interface SingletonLockEvidence {
  targetHost: string
  targetPid: number
  currentHost: string
  lockAgeMs: number
  profileInUse: boolean
  targetPidAlive: boolean
}

/** Pure decision seam for stale-lock regression tests. */
export function shouldReclaimSingletonLock(evidence: SingletonLockEvidence): boolean {
  if (evidence.profileInUse) return false
  if (evidence.targetHost === evidence.currentHost) return !evidence.targetPidAlive
  // A hostname change makes the embedded pid meaningless. Require an old lock
  // plus direct evidence that no local Chrome uses the profile before removal.
  return evidence.lockAgeMs >= PROFILE_REAP_GRACE_MS
}

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
function reclaimStaleSingletonLock(lockPath: string, profileDir: string): boolean {
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
  let psOutput: string
  try {
    psOutput = processTable()
  } catch {
    return false
  }

  const profileInUse = psOutput.split('\n').some((line) => userDataDirFromCommand(line) === profileDir)
  let targetPidAlive = false
  if (host === hostname()) {
    try {
      process.kill(pid, 0)
      targetPidAlive = true
    } catch (err) {
      targetPidAlive = (err as NodeJS.ErrnoException).code === 'EPERM'
    }
  }
  let lockAgeMs: number
  try {
    lockAgeMs = Date.now() - lstatSync(lockPath).mtimeMs
  } catch {
    return false
  }
  if (!shouldReclaimSingletonLock({
    targetHost: host,
    targetPid: pid,
    currentHost: hostname(),
    lockAgeMs,
    profileInUse,
    targetPidAlive,
  })) return false

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
  /** Tail of Chrome's stderr, so a spawn failure can say why Chrome refused. */
  private _stderrTail = ''
  /** Set once the child exits, so waitForDebugger stops polling a dead process. */
  private _exit: { code: number | null; signal: NodeJS.Signals | null } | null = null

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

    const progress = options.onProgress ?? (() => {})
    const headless = options.headless ?? true
    progress('selecting debugging port')
    this._port = options.port ?? await findFreePort()
    progress(`debugging port ${this._port}`)
    // Reap first so an orphan cannot make its stale SingletonLock look live
    // and force this launch into another throwaway profile.
    progress('reaping orphaned browsers')
    reapOrphanedIbrChromeProcesses()
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
      if (reclaimStaleSingletonLock(lockPath, userDataDir)) {
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
    progress('reaping orphaned profiles')
    reapOrphanedProfiles()

    progress('locating chrome binary')
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

    progress(`spawning ${chromePath} (profile ${userDataDir})`)
    this._stderrTail = ''
    this._exit = null
    this.process = spawn(chromePath, args, { stdio: 'pipe' })

    this.process.on('error', (err) => {
      console.error(`Chrome process error: ${err.message}`)
    })
    // Chrome explains its own refusals on stderr ("Failed to create a
    // ProcessSingleton", a missing library, a bad flag). Without capturing it
    // a spawn failure could only report "did not respond", which names the
    // symptom and hides the cause.
    this.process.stderr?.on('data', (chunk: Buffer) => {
      this._stderrTail = (this._stderrTail + chunk.toString()).slice(-2000)
    })
    this.process.on('exit', (code, signal) => {
      this._exit = { code, signal }
    })
    progress(`spawned chrome pid ${this.process.pid ?? 'unknown'}`)

    try {
      const wsUrl = await this.waitForDebugger(progress)
      progress('debugger answered')
      this._cdpUrl = `http://127.0.0.1:${this._port}`
      this._wsEndpoint = wsUrl
      return wsUrl
    } catch (error) {
      // A failed launch still owns the child it spawned. Clean it here instead
      // of relying on every caller to remember `close()` after a rejected
      // promise; otherwise debugger timeouts strand live headless Chromes.
      await this.close()
      throw error
    }
  }

  /**
   * Poll the freshly spawned Chrome until its debugger answers.
   *
   * This used to be `for (i < 50) { await fetch(...) }` with a comment claiming
   * "5 seconds at 100ms intervals". It was not 5 seconds and it was not
   * bounded: `fetch()` has no default deadline, so ONE attempt against a port
   * that is listening but silent blocks the whole loop forever. That is the
   * shape of the reported hang — no output, no error, no timeout of its own.
   *
   * Now: a wall-clock deadline governs the loop, each probe carries its own
   * short timeout, and an exited child ends the wait immediately instead of
   * polling a process that is never coming back.
   */
  private async waitForDebugger(
    onProgress: (step: string) => void = () => {},
    timeoutMs = BROWSER_SPAWN_TIMEOUT_MS,
  ): Promise<string> {
    const url = `http://127.0.0.1:${this._port}/json/version`
    const started = Date.now()
    const deadline = started + timeoutMs
    let attempts = 0
    let lastError = 'no response yet'

    while (Date.now() < deadline) {
      // A child that already exited cannot start answering later.
      if (this._exit) {
        throw new Error(
          `Chrome exited before its debugger came up (code ${this._exit.code}, `
          + `signal ${this._exit.signal}) after ${Date.now() - started}ms on port `
          + `${this._port}.${this.stderrHint()}`,
        )
      }
      attempts++
      try {
        const remaining = deadline - Date.now()
        const res = await fetchWithTimeout(url, {
          timeoutMs: Math.max(250, Math.min(CDP_PROBE_TIMEOUT_MS, remaining)),
          waitingOn: `Chrome debugger ${url}`,
        })
        const data = (await res.json()) as { webSocketDebuggerUrl: string }
        if (data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl
        lastError = 'endpoint answered without a webSocketDebuggerUrl'
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
        if (attempts === 1 || attempts % 10 === 0) {
          onProgress(`waiting for debugger on port ${this._port} (attempt ${attempts}: ${lastError})`)
        }
      }
      await new Promise((r) => setTimeout(r, 100))
    }

    const elapsed = Date.now() - started
    throw new ConnectTimeoutError(
      `Chrome debugger ${url} — ${attempts} probes over ${elapsed}ms, last: ${lastError}.`
      + this.stderrHint()
      + '\nIs another process holding this port? If you are running inside a sandbox, '
      + 'retry with connect mode:\n  --browser-mode connect --cdp-url http://127.0.0.1:9222',
      timeoutMs,
      elapsed,
    )
  }

  private stderrHint(): string {
    const tail = this._stderrTail.trim()
    return tail ? `\nChrome stderr (tail):\n${tail}` : ''
  }

  async close(): Promise<void> {
    if (this._mode !== 'local' || !this.process) return

    const proc = this.process
    this.process = null

    if (!this._exit) {
      // Wait for process to exit, with SIGKILL escalation.
      await new Promise<void>((resolve) => {
        const killTimer = setTimeout(() => {
          try { proc.kill('SIGKILL') } catch { /* already dead */ }
          resolve()
        }, 3000)

        proc.once('close', () => {
          clearTimeout(killTimer)
          resolve()
        })

        proc.kill('SIGTERM')
      })
    }

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
