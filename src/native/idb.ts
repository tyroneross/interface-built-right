import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

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
    // Fall back to xcrun simctl for basic operations
    return false
  }
}

export interface IdbActionResult {
  success: boolean
  action: string
  error?: string
}

/**
 * Tap at coordinates in the simulator
 */
export async function idbTap(udid: string, x: number, y: number): Promise<IdbActionResult> {
  try {
    // Try IDB first
    if (await isIdbCliAvailable()) {
      await execFileAsync('idb', ['ui', 'tap', String(x), String(y), '--udid', udid], { timeout: 10000 })
      return { success: true, action: 'tap' }
    }
    // Fall back to simctl (works on recent Xcode)
    await execFileAsync('xcrun', ['simctl', 'io', udid, 'tap', String(x), String(y)], { timeout: 10000 })
    return { success: true, action: 'tap' }
  } catch (err: any) {
    return { success: false, action: 'tap', error: err.message }
  }
}

/**
 * Type text into the focused field
 */
export async function idbType(udid: string, text: string): Promise<IdbActionResult> {
  try {
    if (await isIdbCliAvailable()) {
      await execFileAsync('idb', ['ui', 'text', text, '--udid', udid], { timeout: 10000 })
      return { success: true, action: 'type' }
    }
    // No simctl fallback for typing — simctl doesn't support this
    return { success: false, action: 'type', error: 'IDB not available. Install with: brew install idb-companion && pip install fb-idb' }
  } catch (err: any) {
    return { success: false, action: 'type', error: err.message }
  }
}

/**
 * Swipe from one point to another (for scrolling)
 */
export async function idbSwipe(udid: string, x1: number, y1: number, x2: number, y2: number, duration?: number): Promise<IdbActionResult> {
  try {
    const args = ['ui', 'swipe', String(x1), String(y1), String(x2), String(y2), '--udid', udid]
    if (duration) args.push('--duration', String(duration))

    if (await isIdbCliAvailable()) {
      await execFileAsync('idb', args, { timeout: 10000 })
      return { success: true, action: 'swipe' }
    }
    return { success: false, action: 'swipe', error: 'IDB not available for swipe' }
  } catch (err: any) {
    return { success: false, action: 'swipe', error: err.message }
  }
}

/**
 * Press a hardware button
 */
export async function idbButton(udid: string, button: 'HOME' | 'LOCK' | 'SIRI' | 'APPLE_PAY'): Promise<IdbActionResult> {
  try {
    if (await isIdbCliAvailable()) {
      await execFileAsync('idb', ['ui', 'button', button, '--udid', udid], { timeout: 10000 })
      return { success: true, action: `button:${button}` }
    }
    // simctl fallback for home button
    if (button === 'HOME') {
      await execFileAsync('xcrun', ['simctl', 'spawn', udid, 'launchctl', 'stop', 'com.apple.SpringBoard'], { timeout: 10000 })
      return { success: true, action: 'button:HOME' }
    }
    return { success: false, action: `button:${button}`, error: 'IDB not available' }
  } catch (err: any) {
    return { success: false, action: `button:${button}`, error: err.message }
  }
}

/**
 * Get accessibility info from the simulator (IDB-specific)
 * Returns the iOS app's accessibility tree — much richer than simctl
 */
export async function idbAccessibilityInfo(udid: string, point?: { x: number; y: number }): Promise<{ elements?: any[]; error?: string }> {
  try {
    if (!(await isIdbCliAvailable())) {
      return { error: 'IDB not available' }
    }
    const args = ['accessibility', 'info', '--udid', udid]
    if (point) {
      args.push('--point', String(point.x), String(point.y))
    }
    const { stdout } = await execFileAsync('idb', args, { timeout: 15000 })
    // IDB returns accessibility info as text — parse it
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
    // simctl openurl works reliably without IDB
    await execFileAsync('xcrun', ['simctl', 'openurl', udid, url], { timeout: 10000 })
    return { success: true, action: 'openUrl' }
  } catch (err: any) {
    return { success: false, action: 'openUrl', error: err.message }
  }
}

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
      // Default swipe distances for scroll
      const cx = options.x ?? 187  // center of iPhone screen
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
