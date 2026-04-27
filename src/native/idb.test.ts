/**
 * Unit tests for src/native/idb.ts
 *
 * All execFileAsync calls are mocked — tests run without IDB or xcrun installed.
 *
 * Driver chain under test:
 *   tap   : native-window → idb → fail
 *   swipe : native-window → idb → fail
 *   type  : native-window → idb → fail
 *   button: idb → simctl (HOME only) → fail
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  isIdbAvailable,
  isIdbCliAvailable,
  idbTap,
  idbType,
  idbSwipe,
  idbButton,
  idbOpenUrl,
  simulatorAction,
  getSimulatorInteractionDriverStatus,
  SIMULATOR_DRIVER_ENV,
} from './idb.js'
import { elementCenter } from './actions.js'
import * as simDriver from './sim-driver.js'

const mocks = vi.hoisted(() => ({
  execFile: vi.fn(),
}))

const mockExecFile = mocks.execFile

vi.mock('child_process', () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}))

vi.mock('util', () => ({
  promisify: (fn: unknown) => fn,
}))

// Stub the native-window driver — we don't want tests compiling the Swift binary.
vi.mock('./sim-driver.js', () => ({
  isSimDriverAvailable: vi.fn().mockReturnValue(false),
  simDriverTap: vi.fn(),
  simDriverSwipe: vi.fn(),
  simDriverType: vi.fn(),
}))

const UDID = 'DEADBEEF-1234-5678-ABCD-000000000001'

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env[SIMULATOR_DRIVER_ENV]
  // Default: native-window is unavailable so all tests fall through to IDB.
  vi.mocked(simDriver.isSimDriverAvailable).mockReturnValue(false)
})

// ── isIdbAvailable / isIdbCliAvailable ────────────────────────────────────────

describe('isIdbAvailable', () => {
  it('returns true when idb_companion is on PATH', async () => {
    mockExecFile.mockResolvedValueOnce({ stdout: '/usr/local/bin/idb_companion', stderr: '' })
    expect(await isIdbAvailable()).toBe(true)
    expect(mockExecFile.mock.calls[0][0]).toBe('which')
    expect(mockExecFile.mock.calls[0][1]).toEqual(['idb_companion'])
  })

  it('returns false when idb_companion is not found', async () => {
    mockExecFile.mockRejectedValueOnce(new Error('not found'))
    expect(await isIdbAvailable()).toBe(false)
  })
})

describe('isIdbCliAvailable', () => {
  it('returns true when idb CLI is on PATH', async () => {
    mockExecFile.mockResolvedValueOnce({ stdout: '/usr/local/bin/idb', stderr: '' })
    expect(await isIdbCliAvailable()).toBe(true)
  })

  it('returns false when idb CLI is not found', async () => {
    mockExecFile.mockRejectedValueOnce(new Error('command not found'))
    expect(await isIdbCliAvailable()).toBe(false)
  })
})

// ── idbTap ────────────────────────────────────────────────────────────────────

describe('idbTap', () => {
  it('uses IDB when native-window unavailable but IDB is on PATH', async () => {
    mockExecFile
      .mockResolvedValueOnce({ stdout: '/usr/local/bin/idb', stderr: '' }) // which idb
      .mockResolvedValueOnce({ stdout: '', stderr: '' })                    // idb ui tap

    const result = await idbTap(UDID, 100, 200)

    expect(result.success).toBe(true)
    expect(result.action).toBe('tap')
    expect(result.driver).toBe('idb')
    expect(mockExecFile).toHaveBeenLastCalledWith(
      'idb',
      ['ui', 'tap', '100', '200', '--udid', UDID],
      { timeout: 10000 },
    )
  })

  it('prefers native-window when available', async () => {
    vi.mocked(simDriver.isSimDriverAvailable).mockReturnValue(true)
    vi.mocked(simDriver.simDriverTap).mockResolvedValue({
      success: true,
      action: 'tap',
    })

    const result = await idbTap(UDID, 10, 20)

    expect(result.success).toBe(true)
    expect(result.driver).toBe('native-window')
    expect(simDriver.simDriverTap).toHaveBeenCalledWith(UDID, 10, 20)
    // IDB should not have been queried.
    expect(mockExecFile).not.toHaveBeenCalled()
  })

  it('can force IDB even when native-window is available', async () => {
    process.env[SIMULATOR_DRIVER_ENV] = 'idb'
    vi.mocked(simDriver.isSimDriverAvailable).mockReturnValue(true)
    mockExecFile
      .mockResolvedValueOnce({ stdout: '/usr/local/bin/idb', stderr: '' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' })

    const result = await idbTap(UDID, 10, 20)

    expect(result.success).toBe(true)
    expect(result.driver).toBe('idb')
    expect(simDriver.simDriverTap).not.toHaveBeenCalled()
  })

  it('fails clearly when native-hid is forced before it is implemented', async () => {
    process.env[SIMULATOR_DRIVER_ENV] = 'native-hid'

    const result = await idbTap(UDID, 10, 20)

    expect(result.success).toBe(false)
    expect(result.driver).toBe('native-hid')
    expect(result.error).toMatch(/not implemented in this build/)
  })

  it('returns clear install hint when neither native-window nor IDB is available', async () => {
    mockExecFile.mockRejectedValueOnce(new Error('not found')) // which idb

    const result = await idbTap(UDID, 50, 75)

    expect(result.success).toBe(false)
    expect(result.action).toBe('tap')
    expect(result.error).toMatch(/idb-companion/)
    // Confirms we are NOT trying the broken `xcrun simctl io tap` anymore.
    expect(mockExecFile.mock.calls.find((c) => c[0] === 'xcrun')).toBeUndefined()
  })

  it('reports IDB error when IDB call itself fails', async () => {
    mockExecFile
      .mockResolvedValueOnce({ stdout: '/usr/local/bin/idb', stderr: '' }) // which idb
      .mockRejectedValueOnce(new Error('idb crashed'))                      // idb ui tap

    const result = await idbTap(UDID, 10, 20)

    expect(result.success).toBe(false)
    expect(result.driver).toBe('idb')
    expect(result.error).toMatch(/idb crashed/)
  })
})

// ── idbType ───────────────────────────────────────────────────────────────────

describe('idbType', () => {
  it('prefers native-window when available', async () => {
    vi.mocked(simDriver.isSimDriverAvailable).mockReturnValue(true)
    vi.mocked(simDriver.simDriverType).mockResolvedValue({
      success: true,
      action: 'type',
    })

    const result = await idbType(UDID, 'hello')

    expect(result.success).toBe(true)
    expect(result.driver).toBe('native-window')
    expect(simDriver.simDriverType).toHaveBeenCalledWith(UDID, 'hello')
    expect(mockExecFile).not.toHaveBeenCalled()
  })

  it('uses IDB when available', async () => {
    mockExecFile
      .mockResolvedValueOnce({ stdout: '/usr/local/bin/idb', stderr: '' }) // which idb
      .mockResolvedValueOnce({ stdout: '', stderr: '' })                    // idb ui text

    const result = await idbType(UDID, 'hello world')

    expect(result.success).toBe(true)
    expect(result.driver).toBe('idb')
    expect(mockExecFile).toHaveBeenLastCalledWith(
      'idb',
      ['ui', 'text', 'hello world', '--udid', UDID],
      { timeout: 10000 },
    )
  })

  it('returns install hint when neither native-window nor IDB is available', async () => {
    mockExecFile.mockRejectedValueOnce(new Error('not found')) // which idb

    const result = await idbType(UDID, 'some text')

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/idb-companion/)
    expect(mockExecFile.mock.calls.find((c) => c[0] === 'osascript')).toBeUndefined()
  })
})

// ── idbSwipe ──────────────────────────────────────────────────────────────────

describe('idbSwipe', () => {
  it('prefers native-window when available', async () => {
    vi.mocked(simDriver.isSimDriverAvailable).mockReturnValue(true)
    vi.mocked(simDriver.simDriverSwipe).mockResolvedValue({
      success: true,
      action: 'swipe',
    })

    const result = await idbSwipe(UDID, 0, 0, 100, 100, 0.3)

    expect(result.success).toBe(true)
    expect(result.driver).toBe('native-window')
    expect(simDriver.simDriverSwipe).toHaveBeenCalledWith(UDID, 0, 0, 100, 100, 0.3)
    expect(mockExecFile).not.toHaveBeenCalled()
  })

  it('includes duration arg when provided', async () => {
    mockExecFile
      .mockResolvedValueOnce({ stdout: '/usr/local/bin/idb', stderr: '' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' })

    await idbSwipe(UDID, 0, 300, 0, 600, 1.5)

    const args = mockExecFile.mock.calls[1][1] as string[]
    expect(args).toContain('--duration')
    expect(args).toContain('1.5')
  })

  it('omits duration arg when not provided', async () => {
    mockExecFile
      .mockResolvedValueOnce({ stdout: '/usr/local/bin/idb', stderr: '' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' })

    await idbSwipe(UDID, 0, 300, 0, 600)

    const args = mockExecFile.mock.calls[1][1] as string[]
    expect(args).not.toContain('--duration')
  })

  it('returns clear error when neither native-window nor IDB is available', async () => {
    mockExecFile.mockRejectedValueOnce(new Error('not found')) // which idb

    const result = await idbSwipe(UDID, 0, 0, 100, 100)

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/idb-companion/)
    expect(mockExecFile.mock.calls.find((c) => c[0] === 'xcrun')).toBeUndefined()
  })
})

// ── driver status ─────────────────────────────────────────────────────────────

describe('getSimulatorInteractionDriverStatus', () => {
  it('reports native HID target separately from the native-window fallback', async () => {
    vi.mocked(simDriver.isSimDriverAvailable).mockReturnValue(true)
    mockExecFile
      .mockResolvedValueOnce({ stdout: '/usr/local/bin/idb', stderr: '' }) // which idb
      .mockResolvedValueOnce({ stdout: '/usr/bin/xcrun', stderr: '' })     // which xcrun

    const status = await getSimulatorInteractionDriverStatus()

    const nativeHid = status.find(s => s.driver === 'native-hid')
    const nativeWindow = status.find(s => s.driver === 'native-window')
    const idb = status.find(s => s.driver === 'idb')
    const simctl = status.find(s => s.driver === 'simctl')

    expect(nativeHid?.available).toBe(false)
    expect(nativeHid?.headless).toBe(true)
    expect(nativeHid?.reason).toMatch(/pending/)
    expect(nativeWindow?.available).toBe(true)
    expect(nativeWindow?.headless).toBe(false)
    expect(nativeWindow?.constraints.join(' ')).toMatch(/visible Simulator/)
    expect(idb?.available).toBe(true)
    expect(simctl?.actions).toContain('openUrl')
  })
})

// ── idbButton ─────────────────────────────────────────────────────────────────

describe('idbButton', () => {
  it('uses idb for HOME when available', async () => {
    mockExecFile
      .mockResolvedValueOnce({ stdout: '/usr/local/bin/idb', stderr: '' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' })

    const result = await idbButton(UDID, 'HOME')

    expect(result.success).toBe(true)
    expect(result.action).toBe('button:HOME')
    expect(mockExecFile.mock.calls[1][1]).toEqual(['ui', 'button', 'HOME', '--udid', UDID])
  })

  it('falls back to simctl SpringBoard restart for HOME when IDB unavailable', async () => {
    mockExecFile
      .mockRejectedValueOnce(new Error('not found'))     // which idb
      .mockResolvedValueOnce({ stdout: '', stderr: '' }) // xcrun simctl spawn

    const result = await idbButton(UDID, 'HOME')

    expect(result.success).toBe(true)
    expect(result.driver).toBe('simctl')
    expect(mockExecFile.mock.calls[1][0]).toBe('xcrun')
  })

  it('returns failure for non-HOME buttons when IDB unavailable', async () => {
    mockExecFile.mockRejectedValueOnce(new Error('not found'))

    const result = await idbButton(UDID, 'LOCK')

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/idb-companion/)
  })
})

// ── idbOpenUrl ────────────────────────────────────────────────────────────────

describe('idbOpenUrl', () => {
  it('always uses xcrun simctl openurl', async () => {
    mockExecFile.mockResolvedValueOnce({ stdout: '', stderr: '' })

    const result = await idbOpenUrl(UDID, 'myapp://home')

    expect(result.success).toBe(true)
    expect(mockExecFile).toHaveBeenCalledWith(
      'xcrun',
      ['simctl', 'openurl', UDID, 'myapp://home'],
      { timeout: 10000 },
    )
  })

  it('returns failure when simctl errors', async () => {
    mockExecFile.mockRejectedValueOnce(new Error('device not booted'))

    const result = await idbOpenUrl(UDID, 'myapp://crash')

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/device not booted/)
  })
})

// ── simulatorAction dispatch ──────────────────────────────────────────────────

describe('simulatorAction', () => {
  it('dispatches tap to idbTap', async () => {
    mockExecFile
      .mockResolvedValueOnce({ stdout: '/usr/local/bin/idb', stderr: '' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' })

    const result = await simulatorAction({ udid: UDID, action: 'tap', x: 100, y: 200 })

    expect(result.success).toBe(true)
    expect(result.action).toBe('tap')
  })

  it('returns error for tap without coordinates', async () => {
    const result = await simulatorAction({ udid: UDID, action: 'tap' })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/x and y coordinates required/)
  })

  it('dispatches type to idbType', async () => {
    mockExecFile
      .mockResolvedValueOnce({ stdout: '/usr/local/bin/idb', stderr: '' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' })

    const result = await simulatorAction({ udid: UDID, action: 'type', text: 'abc' })

    expect(result.success).toBe(true)
    expect(result.action).toBe('type')
  })

  it('returns error for type without text', async () => {
    const result = await simulatorAction({ udid: UDID, action: 'type' })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/text required/)
  })

  it('scroll up produces y2 > y1 (finger moves up)', async () => {
    mockExecFile
      .mockResolvedValueOnce({ stdout: '/usr/local/bin/idb', stderr: '' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' })

    await simulatorAction({ udid: UDID, action: 'scroll', direction: 'up' })

    const swipeArgs = mockExecFile.mock.calls[1][1] as string[]
    const y1 = parseFloat(swipeArgs[3])
    const y2 = parseFloat(swipeArgs[5])
    expect(y2).toBeGreaterThan(y1)
  })

  it('scroll down produces y2 < y1', async () => {
    mockExecFile
      .mockResolvedValueOnce({ stdout: '/usr/local/bin/idb', stderr: '' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' })

    await simulatorAction({ udid: UDID, action: 'scroll', direction: 'down' })

    const swipeArgs = mockExecFile.mock.calls[1][1] as string[]
    const y1 = parseFloat(swipeArgs[3])
    const y2 = parseFloat(swipeArgs[5])
    expect(y2).toBeLessThan(y1)
  })

  it('returns error for unknown action', async () => {
    // @ts-expect-error intentional bad action for test
    const result = await simulatorAction({ udid: UDID, action: 'unknown' })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Unknown action/)
  })
})

// ── elementCenter (from actions.ts) ──────────────────────────────────────────

describe('elementCenter', () => {
  it('returns null when frame is absent', () => {
    expect(elementCenter({})).toBeNull()
  })

  it('computes center correctly for even dimensions', () => {
    const result = elementCenter({ frame: { x: 100, y: 200, width: 80, height: 40 } })
    expect(result).toEqual({ x: 140, y: 220 })
  })

  it('rounds to nearest integer for odd dimensions', () => {
    const result = elementCenter({ frame: { x: 0, y: 0, width: 101, height: 51 } })
    expect(result).toEqual({ x: 51, y: 26 })
  })

  it('handles zero-size elements', () => {
    const result = elementCenter({ frame: { x: 50, y: 75, width: 0, height: 0 } })
    expect(result).toEqual({ x: 50, y: 75 })
  })
})
