/**
 * ibr-sim-driver - TypeScript wrapper around the bundled native-window driver.
 *
 * The native binary lives at `mobile-ui/sim-driver/` (Swift Package). It uses
 * Apple's public CGEvent API to post mouse and keyboard events at the
 * Simulator.app window's host-screen position. This is useful as a low-friction
 * fallback when IDB is not installed, but it is not headless HID injection and
 * should not be treated as IDB-equivalent.
 *
 * Constraints:
 *   - macOS only.
 *   - Requires Accessibility permission for the calling process (System
 *     Settings > Privacy & Security > Accessibility).
 *   - Requires a visible Simulator.app window for the target UDID. The driver
 *     activates Simulator.app and locates the window by device name.
 *
 * Build: compiled on first call via `swift build -c release`, cached at
 * `.ibr/bin/ibr-sim-driver`. The optional `scripts/build-sim-driver.js`
 * postinstall script can pre-build into `dist/bin/` for shipped npm installs.
 */

import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { chmod, copyFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { promisify } from 'util'
import type { IdbActionResult } from './idb.js'

const execFileAsync = promisify(execFile)

const DRIVER_NAME = 'ibr-sim-driver'
const CACHE_DIR = join(process.cwd(), '.ibr', 'bin')
const CACHE_PATH = join(CACHE_DIR, DRIVER_NAME)

let cachedPath: string | null | undefined
let buildError: string | null = null

function existingBinaryCandidates(): string[] {
  return [
    join(__dirname, '..', 'bin', DRIVER_NAME),
    join(__dirname, 'bin', DRIVER_NAME),
    join(__dirname, '..', '..', 'dist', 'bin', DRIVER_NAME),
    CACHE_PATH,
  ]
}

function sourceDirCandidates(): string[] {
  return [
    join(__dirname, '..', '..', 'mobile-ui', 'sim-driver'),
    join(__dirname, '..', 'mobile-ui', 'sim-driver'),
  ]
}

function findExistingBinary(): string | null {
  return existingBinaryCandidates().find((p) => existsSync(p)) ?? null
}

function findSourceDir(): string | null {
  return sourceDirCandidates().find((p) => existsSync(join(p, 'Package.swift'))) ?? null
}

function errorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { stderr?: string; stdout?: string; message?: string }
    const stderr = e.stderr?.trim()
    if (stderr) return stderr
    const stdout = e.stdout?.trim()
    if (stdout) return stdout
    if (e.message) return e.message
  }
  return String(err)
}

/**
 * Whether the native-window driver is reachable on this platform.
 *
 * Returns true if either the prebuilt binary is present or the Swift source
 * is available for on-demand compilation. The first failed build is cached so
 * we don't retry indefinitely.
 */
export function isSimDriverAvailable(): boolean {
  if (process.platform !== 'darwin') return false
  if (cachedPath) return true
  if (findExistingBinary()) return true
  if (buildError) return false
  return findSourceDir() !== null
}

export async function ensureSimDriver(): Promise<string> {
  if (cachedPath) return cachedPath

  const existing = findExistingBinary()
  if (existing) {
    cachedPath = existing
    return existing
  }

  if (process.platform !== 'darwin') {
    throw new Error('ibr-sim-driver is only available on macOS')
  }

  const sourceDir = findSourceDir()
  if (!sourceDir) {
    throw new Error('ibr-sim-driver Swift package not found')
  }

  if (buildError) throw new Error(buildError)

  try {
    await execFileAsync('swift', ['build', '--package-path', sourceDir, '-c', 'release'], {
      timeout: 120_000,
    })
    const builtPath = join(sourceDir, '.build', 'release', DRIVER_NAME)
    if (!existsSync(builtPath)) {
      throw new Error('Swift build succeeded but binary was not created')
    }
    await mkdir(CACHE_DIR, { recursive: true })
    await copyFile(builtPath, CACHE_PATH)
    await chmod(CACHE_PATH, 0o755)
    cachedPath = CACHE_PATH
    return CACHE_PATH
  } catch (err) {
    buildError = `Failed to build ibr-sim-driver: ${errorMessage(err)}`
    throw new Error(buildError)
  }
}

async function runSimDriver(args: string[], action: string): Promise<IdbActionResult> {
  try {
    const driverPath = await ensureSimDriver()
    await execFileAsync(driverPath, args, { timeout: 15_000 })
    return { success: true, action }
  } catch (err) {
    return { success: false, action, error: errorMessage(err) }
  }
}

export function simDriverTap(udid: string, x: number, y: number): Promise<IdbActionResult> {
  return runSimDriver(['tap', '--udid', udid, String(x), String(y)], 'tap')
}

export function simDriverType(udid: string, text: string): Promise<IdbActionResult> {
  return runSimDriver(['type', '--udid', udid, text], 'type')
}

export function simDriverSwipe(
  udid: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  duration?: number,
): Promise<IdbActionResult> {
  const args = ['swipe', '--udid', udid, String(x1), String(y1), String(x2), String(y2)]
  if (duration) args.push('--duration', String(duration))
  return runSimDriver(args, 'swipe')
}

// Test-only - reset the memoized state.
export function _resetSimDriverForTests(): void {
  cachedPath = undefined
  buildError = null
}
