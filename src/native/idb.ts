import { execFile } from 'child_process'
import { promisify } from 'util'
import {
  isSimDriverAvailable,
  simDriverTap,
  simDriverSwipe,
  simDriverType,
} from './sim-driver.js'

const execFileAsync = promisify(execFile)

export const SIMULATOR_DRIVER_ENV = 'IBR_SIMULATOR_DRIVER'

const INSTALL_HINT =
  'Install IDB: brew tap facebook/fb && brew install idb-companion && pipx install fb-idb. ' +
  'IBR also ships a bundled native-window fallback (requires Accessibility permission and a visible Simulator window).'

export type SimulatorInteractionDriver = 'native-hid' | 'native-window' | 'idb' | 'simctl'
export type SimulatorDriverPreference = 'auto' | SimulatorInteractionDriver

export interface SimulatorInteractionDriverStatus {
  driver: SimulatorInteractionDriver
  label: string
  available: boolean
  headless: boolean
  bundled: boolean
  actions: Array<'tap' | 'type' | 'swipe' | 'button' | 'openUrl' | 'accessibility'>
  constraints: string[]
  reason?: string
  selected: boolean
}

const DRIVER_LABELS: Record<SimulatorInteractionDriver, string> = {
  'native-hid': 'IBR native HID',
  'native-window': 'IBR native-window',
  idb: 'Meta IDB',
  simctl: 'simctl',
}

function configuredDriverPreference(): SimulatorDriverPreference {
  const raw = process.env[SIMULATOR_DRIVER_ENV]?.trim()
  if (!raw) return 'auto'

  const allowed: SimulatorDriverPreference[] = ['auto', 'native-hid', 'native-window', 'idb', 'simctl']
  return allowed.includes(raw as SimulatorDriverPreference) ? raw as SimulatorDriverPreference : 'auto'
}

function shouldTryDriver(driver: SimulatorInteractionDriver, preference: SimulatorDriverPreference): boolean {
  return preference === 'auto' || preference === driver
}

function forcedDriverFailure(
  action: string,
  driver: SimulatorInteractionDriver,
  message: string,
): IdbActionResult {
  return {
    success: false,
    action,
    driver,
    error: `${SIMULATOR_DRIVER_ENV}=${driver}: ${message}`,
  }
}

function nativeHidUnavailable(action: string): IdbActionResult {
  return forcedDriverFailure(
    action,
    'native-hid',
    'headless CoreSimulator/SimulatorKit HID injection is the IDB-parity target, but it is not implemented in this build.',
  )
}

function simDriverSuffix(error?: string): string {
  return error ? ` native-window: ${error}` : ''
}

export function formatSimulatorDriver(driver?: SimulatorInteractionDriver): string {
  return driver ? DRIVER_LABELS[driver] : 'unknown driver'
}

// ── Capability checks ──────────────────────────────────────────────────────────

/**
 * Check if IDB companion is available
 */
export async function isIdbAvailable(): Promise<boolean> {
  try {
    await execFileAsync('which', ['idb_companion'])
    return true
  } catch {
    return false
  }
}

/**
 * Check if idb CLI is available (Python client)
 */
export async function isIdbCliAvailable(): Promise<boolean> {
  try {
    await execFileAsync('which', ['idb'])
    return true
  } catch {
    return false
  }
}

export interface IdbActionResult {
  success: boolean
  action: string
  error?: string
  driver?: SimulatorInteractionDriver
}

export async function isSimctlAvailable(): Promise<boolean> {
  try {
    await execFileAsync('which', ['xcrun'])
    return true
  } catch {
    return false
  }
}

export async function getSimulatorInteractionDriverStatus(): Promise<SimulatorInteractionDriverStatus[]> {
  const preference = configuredDriverPreference()
  const nativeWindowAvailable = isSimDriverAvailable()
  const idbAvailable = await isIdbCliAvailable()
  const simctlAvailable = await isSimctlAvailable()

  return [
    {
      driver: 'native-hid',
      label: DRIVER_LABELS['native-hid'],
      available: false,
      headless: true,
      bundled: true,
      actions: ['tap', 'type', 'swipe', 'button', 'accessibility'],
      constraints: [
        'Not implemented in this build.',
        'Target backend uses CoreSimulator/SimulatorKit HID injection, matching IDB-class headless input.',
      ],
      reason: 'pending private-framework HID backend',
      selected: preference === 'native-hid',
    },
    {
      driver: 'native-window',
      label: DRIVER_LABELS['native-window'],
      available: nativeWindowAvailable,
      headless: false,
      bundled: true,
      actions: ['tap', 'type', 'swipe'],
      constraints: [
        'Requires macOS Accessibility permission.',
        'Requires a visible Simulator.app window.',
        'Uses host CGEvent mouse/keyboard events; not IDB-equivalent HID injection.',
      ],
      reason: nativeWindowAvailable ? undefined : 'Swift driver binary/source unavailable on this platform',
      selected: preference === 'auto' || preference === 'native-window',
    },
    {
      driver: 'idb',
      label: DRIVER_LABELS.idb,
      available: idbAvailable,
      headless: true,
      bundled: false,
      actions: ['tap', 'type', 'swipe', 'button', 'accessibility'],
      constraints: [
        'Requires idb_companion and fb-idb to be installed outside IBR.',
      ],
      reason: idbAvailable ? undefined : 'idb CLI not found on PATH',
      selected: preference === 'auto' || preference === 'idb',
    },
    {
      driver: 'simctl',
      label: DRIVER_LABELS.simctl,
      available: simctlAvailable,
      headless: true,
      bundled: false,
      actions: ['openUrl', 'button'],
      constraints: [
        'Can open URLs and capture screenshots.',
        'HOME has a SpringBoard restart fallback.',
        'Does not support tap or swipe input through simctl io.',
      ],
      reason: simctlAvailable ? undefined : 'xcrun not found on PATH',
      selected: preference === 'simctl',
    },
  ]
}

// ── Tap ────────────────────────────────────────────────────────────────────────

/**
 * Tap at coordinates in the simulator
 *
 * Driver chain:
 *   1. native-window — bundled CGEvent fallback. Requires Accessibility
 *      permission for the host process and a visible Simulator window. Posts
 *      mouse events directly; coordinates are translated to the Simulator
 *      window's host-screen position.
 *   2. idb ui tap (requires `brew install idb-companion`)
 *   3. Fail with install hint
 *
 * Set IBR_SIMULATOR_DRIVER=idb to skip the visible-window fallback in CI.
 *
 * Note: previous versions tried `xcrun simctl io <udid> tap` as a fallback.
 * That subcommand has never existed and the call always failed silently.
 * Removed.
 */
export async function idbTap(udid: string, x: number, y: number): Promise<IdbActionResult> {
  const preference = configuredDriverPreference()
  let simDriverError: string | undefined

  if (preference === 'native-hid') {
    return nativeHidUnavailable('tap')
  }

  if (shouldTryDriver('native-window', preference)) {
    if (!isSimDriverAvailable()) {
      if (preference === 'native-window') {
        return forcedDriverFailure('tap', 'native-window', 'native-window driver is not available.')
      }
    } else {
      const r = await simDriverTap(udid, x, y)
      if (r.success) return { ...r, driver: 'native-window' }
      simDriverError = r.error
      if (preference === 'native-window') {
        return { success: false, action: 'tap', error: r.error, driver: 'native-window' }
      }
    }
  }

  if (shouldTryDriver('idb', preference)) {
    if (!(await isIdbCliAvailable())) {
      if (preference === 'idb') {
        return forcedDriverFailure('tap', 'idb', 'idb CLI not found on PATH.')
      }
    } else {
      try {
        await execFileAsync('idb', ['ui', 'tap', String(x), String(y), '--udid', udid], { timeout: 10000 })
        return { success: true, action: 'tap', driver: 'idb' }
      } catch (err: any) {
        return { success: false, action: 'tap', error: err.message, driver: 'idb' }
      }
    }
  }

  return {
    success: false,
    action: 'tap',
    error: `No simulator tap driver available. ${INSTALL_HINT}${simDriverSuffix(simDriverError)}`,
  }
}

// ── Type ───────────────────────────────────────────────────────────────────────

/**
 * Type text into the focused field
 *
 * Driver chain:
 *   1. native-window keyboard injection (pasteboard + CGEvent)
 *   2. idb ui text
 *   3. Fail with install hint
 */
export async function idbType(udid: string, text: string): Promise<IdbActionResult> {
  const preference = configuredDriverPreference()
  let simDriverError: string | undefined

  if (preference === 'native-hid') {
    return nativeHidUnavailable('type')
  }

  if (shouldTryDriver('native-window', preference)) {
    if (!isSimDriverAvailable()) {
      if (preference === 'native-window') {
        return forcedDriverFailure('type', 'native-window', 'native-window driver is not available.')
      }
    } else {
      const r = await simDriverType(udid, text)
      if (r.success) return { ...r, driver: 'native-window' }
      simDriverError = r.error
      if (preference === 'native-window') {
        return { success: false, action: 'type', error: r.error, driver: 'native-window' }
      }
    }
  }

  if (shouldTryDriver('idb', preference)) {
    if (!(await isIdbCliAvailable())) {
      if (preference === 'idb') {
        return forcedDriverFailure('type', 'idb', 'idb CLI not found on PATH.')
      }
    } else {
      try {
        await execFileAsync('idb', ['ui', 'text', text, '--udid', udid], { timeout: 10000 })
        return { success: true, action: 'type', driver: 'idb' }
      } catch (err: any) {
        return { success: false, action: 'type', error: err.message, driver: 'idb' }
      }
    }
  }

  return {
    success: false,
    action: 'type',
    error: `No simulator type driver available. ${INSTALL_HINT}${simDriverSuffix(simDriverError)}`,
  }
}

// ── Swipe ──────────────────────────────────────────────────────────────────────

/**
 * Swipe from one point to another (for scrolling)
 *
 * Driver chain:
 *   1. native-window (CGEvent drag sequence)
 *   2. idb ui swipe
 *   3. Fail with install hint
 *
 * Note: `xcrun simctl io <udid> swipe` is intentionally not used. `simctl io`
 * supports screenshots and video capture, not touch injection.
 */
export async function idbSwipe(
  udid: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  duration?: number,
): Promise<IdbActionResult> {
  const preference = configuredDriverPreference()
  let simDriverError: string | undefined

  if (preference === 'native-hid') {
    return nativeHidUnavailable('swipe')
  }

  if (shouldTryDriver('native-window', preference)) {
    if (!isSimDriverAvailable()) {
      if (preference === 'native-window') {
        return forcedDriverFailure('swipe', 'native-window', 'native-window driver is not available.')
      }
    } else {
      const r = await simDriverSwipe(udid, x1, y1, x2, y2, duration)
      if (r.success) return { ...r, driver: 'native-window' }
      simDriverError = r.error
      if (preference === 'native-window') {
        return { success: false, action: 'swipe', error: r.error, driver: 'native-window' }
      }
    }
  }

  if (shouldTryDriver('idb', preference)) {
    if (!(await isIdbCliAvailable())) {
      if (preference === 'idb') {
        return forcedDriverFailure('swipe', 'idb', 'idb CLI not found on PATH.')
      }
    } else {
      try {
        const args = ['ui', 'swipe', String(x1), String(y1), String(x2), String(y2), '--udid', udid]
        if (duration) args.push('--duration', String(duration))
        await execFileAsync('idb', args, { timeout: 10000 })
        return { success: true, action: 'swipe', driver: 'idb' }
      } catch (err: any) {
        return { success: false, action: 'swipe', error: err.message, driver: 'idb' }
      }
    }
  }

  return {
    success: false,
    action: 'swipe',
    error: `No simulator swipe driver available. ${INSTALL_HINT}${simDriverSuffix(simDriverError)}`,
  }
}

// ── Hardware buttons ───────────────────────────────────────────────────────────

/**
 * Press a hardware button
 *
 * native-window does not currently expose hardware buttons. HOME has a
 * simctl-based fallback (force-stop SpringBoard). Other buttons require IDB.
 */
export async function idbButton(
  udid: string,
  button: 'HOME' | 'LOCK' | 'SIRI' | 'APPLE_PAY',
): Promise<IdbActionResult> {
  const preference = configuredDriverPreference()
  const action = `button:${button}`

  if (preference === 'native-hid') {
    return nativeHidUnavailable(action)
  }

  if (preference === 'native-window') {
    return forcedDriverFailure(action, 'native-window', 'native-window does not support hardware buttons.')
  }

  if (shouldTryDriver('idb', preference)) {
    if (!(await isIdbCliAvailable())) {
      if (preference === 'idb') {
        return forcedDriverFailure(action, 'idb', 'idb CLI not found on PATH.')
      }
    } else {
      try {
        await execFileAsync('idb', ['ui', 'button', button, '--udid', udid], { timeout: 10000 })
        return { success: true, action, driver: 'idb' }
      } catch (err: any) {
        return { success: false, action, error: err.message, driver: 'idb' }
      }
    }
  }

  if (button === 'HOME' && shouldTryDriver('simctl', preference)) {
    try {
      await execFileAsync(
        'xcrun',
        ['simctl', 'spawn', udid, 'launchctl', 'stop', 'com.apple.SpringBoard'],
        { timeout: 10000 },
      )
      return { success: true, action, driver: 'simctl' }
    } catch (err: any) {
      return { success: false, action, error: err.message, driver: 'simctl' }
    }
  }

  if (preference === 'simctl') {
    return forcedDriverFailure(action, 'simctl', `simctl fallback supports HOME only, not ${button}.`)
  }

  return {
    success: false,
    action,
    error: `No driver available for ${button}. ${INSTALL_HINT}`,
  }
}

// ── IDB-only features ──────────────────────────────────────────────────────────

/**
 * Get accessibility info from the simulator (IDB-specific)
 * Returns the iOS app's accessibility tree — much richer than simctl
 */
export async function idbAccessibilityInfo(
  udid: string,
  point?: { x: number; y: number },
): Promise<{ elements?: any[]; error?: string }> {
  try {
    if (!(await isIdbCliAvailable())) {
      return { error: 'IDB not available' }
    }
    const args = ['accessibility', 'info', '--udid', udid]
    if (point) {
      args.push('--point', String(point.x), String(point.y))
    }
    const { stdout } = await execFileAsync('idb', args, { timeout: 15000 })
    return { elements: JSON.parse(stdout) }
  } catch {
    return { error: 'Accessibility info not available' }
  }
}

/**
 * Open a URL in the simulator (works with deep links)
 */
export async function idbOpenUrl(udid: string, url: string): Promise<IdbActionResult> {
  try {
    await execFileAsync('xcrun', ['simctl', 'openurl', udid, url], { timeout: 10000 })
    return { success: true, action: 'openUrl', driver: 'simctl' }
  } catch (err: any) {
    return { success: false, action: 'openUrl', error: err.message, driver: 'simctl' }
  }
}

// ── High-level dispatcher ──────────────────────────────────────────────────────

/**
 * Perform a high-level simulator action
 * Resolves element by label from the extracted AX tree, then taps at its center coordinates
 */
export async function simulatorAction(options: {
  udid: string
  action: 'tap' | 'type' | 'swipe' | 'scroll'
  x?: number
  y?: number
  text?: string
  direction?: 'up' | 'down' | 'left' | 'right'
}): Promise<IdbActionResult> {
  const { udid, action } = options

  switch (action) {
    case 'tap':
      if (options.x === undefined || options.y === undefined) {
        return { success: false, action: 'tap', error: 'x and y coordinates required for tap' }
      }
      return idbTap(udid, options.x, options.y)

    case 'type':
      if (!options.text) {
        return { success: false, action: 'type', error: 'text required for type action' }
      }
      return idbType(udid, options.text)

    case 'swipe':
    case 'scroll': {
      const cx = options.x ?? 187
      const cy = options.y ?? 400
      const distance = 300
      let x2 = cx, y2 = cy
      switch (options.direction ?? 'down') {
        case 'up': y2 = cy + distance; break
        case 'down': y2 = cy - distance; break
        case 'left': x2 = cx + distance; break
        case 'right': x2 = cx - distance; break
      }
      return idbSwipe(udid, cx, cy, x2, y2, 0.5)
    }

    default:
      return { success: false, action, error: `Unknown action: ${action}` }
  }
}
