/**
 * Unit tests for src/native/idb.ts
 *
 * All execFileAsync calls are mocked — tests run without IDB or xcrun installed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock child_process before importing the module under test ──────────────

const mockExecFile = vi.fn()

vi.mock('child_process', () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}))

vi.mock('util', () => ({
  promisify: (fn: unknown) => fn,
}))

// Import after mock setup so the module uses the mock
const {
  isIdbAvailable,
  isIdbCliAvailable,
  idbTap,
  idbType,
  idbSwipe,
  idbButton,
  idbOpenUrl,
  simulatorAction,
} = await import('./idb.js')

// elementCenter comes from actions.ts (no child_process calls, safe to import)
const { elementCenter } = await import('./actions.js')

// ── Constants ─────────────────────────────────────────────────────────────────

const UDID = 'DEADBEEF-1234-5678-ABCD-000000000001'

// ── isIdbAvailable ────────────────────────────────────────────────────────────

describe('isIdbAvailable', () => {
  beforeEach(() => vi.clearAllMocks())

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

// ── isIdbCliAvailable ─────────────────────────────────────────────────────────

describe('isIdbCliAvailable', () => {
  beforeEach(() => vi.clearAllMocks())

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
  beforeEach(() => vi.clearAllMocks())

  it('uses IDB when available — constructs correct args', async () => {
    // First call: which idb → found; second call: idb ui tap
    mockExecFile
      .mockResolvedValueOnce({ stdout: '/usr/local/bin/idb', stderr: '' }) // isIdbCliAvailable
      .mockResolvedValueOnce({ stdout: '', stderr: '' })                    // idb ui tap

    const result = await idbTap(UDID, 100, 200)

    expect(result.success).toBe(true)
    expect(result.action).toBe('tap')
    expect(mockExecFile).toHaveBeenCalledWith(
      'idb',
      ['ui', 'tap', '100', '200', '--udid', UDID],
      { timeout: 10000 }
    )
  })

  it('falls back to simctl when IDB not available', async () => {
    // isIdbCliAvailable → not found; simctl call succeeds
    mockExecFile
      .mockRejectedValueOnce(new Error('not found'))  // which idb
      .mockResolvedValueOnce({ stdout: '', stderr: '' }) // xcrun simctl

    const result = await idbTap(UDID, 50, 75)

    expect(result.success).toBe(true)
    expect(result.action).toBe('tap')
    expect(mockExecFile).toHaveBeenCalledWith(
      'xcrun',
      ['simctl', 'io', UDID, 'tap', '50', '75'],
      { timeout: 10000 }
    )
  })

  it('returns failure when both IDB and simctl fail', async () => {
    mockExecFile
      .mockRejectedValueOnce(new Error('not found'))              // which idb
      .mockRejectedValueOnce(new Error('simctl error: no device')) // xcrun simctl

    const result = await idbTap(UDID, 10, 20)

    expect(result.success).toBe(false)
    expect(result.action).toBe('tap')
    expect(result.error).toMatch(/simctl error/)
  })
})

// ── idbType ───────────────────────────────────────────────────────────────────

describe('idbType', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses IDB when available — constructs correct args', async () => {
    mockExecFile
      .mockResolvedValueOnce({ stdout: '/usr/local/bin/idb', stderr: '' }) // isIdbCliAvailable
      .mockResolvedValueOnce({ stdout: '', stderr: '' })                    // idb ui text

    const result = await idbType(UDID, 'hello world')

    expect(result.success).toBe(true)
    expect(result.action).toBe('type')
    expect(mockExecFile).toHaveBeenCalledWith(
      'idb',
      ['ui', 'text', 'hello world', '--udid', UDID],
      { timeout: 10000 }
    )
  })

  it('returns failure with install hint when IDB not available', async () => {
    mockExecFile.mockRejectedValueOnce(new Error('not found'))

    const result = await idbType(UDID, 'some text')

    expect(result.success).toBe(false)
    expect(result.action).toBe('type')
    expect(result.error).toContain('brew install idb-companion')
  })

  it('returns failure when idb command throws', async () => {
    mockExecFile
      .mockResolvedValueOnce({ stdout: '/usr/local/bin/idb', stderr: '' }) // isIdbCliAvailable
      .mockRejectedValueOnce(new Error('idb crashed'))                      // idb ui text

    const result = await idbType(UDID, 'crash test')

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/idb crashed/)
  })
})

// ── simulatorAction dispatch ──────────────────────────────────────────────────

describe('simulatorAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('dispatches tap to idbTap', async () => {
    mockExecFile
      .mockRejectedValueOnce(new Error('no idb'))    // isIdbCliAvailable (for tap)
      .mockResolvedValueOnce({ stdout: '', stderr: '' }) // xcrun simctl fallback

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
      .mockResolvedValueOnce({ stdout: '/usr/local/bin/idb', stderr: '' }) // isIdbCliAvailable
      .mockResolvedValueOnce({ stdout: '', stderr: '' })                    // idb ui text

    const result = await simulatorAction({ udid: UDID, action: 'type', text: 'abc' })

    expect(result.success).toBe(true)
    expect(result.action).toBe('type')
  })

  it('returns error for type without text', async () => {
    const result = await simulatorAction({ udid: UDID, action: 'type' })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/text required/)
  })

  it('dispatches scroll direction=up as swipe with correct y2 (greater than y1)', async () => {
    mockExecFile
      .mockResolvedValueOnce({ stdout: '/usr/local/bin/idb', stderr: '' }) // isIdbCliAvailable
      .mockResolvedValueOnce({ stdout: '', stderr: '' })                    // idb ui swipe

    const result = await simulatorAction({ udid: UDID, action: 'scroll', direction: 'up' })

    expect(result.success).toBe(true)
    expect(result.action).toBe('swipe')

    // Verify swipe args: up means y2 > y1 (swipe up = finger moves up = content moves down)
    const swipeCall = mockExecFile.mock.calls[1]
    expect(swipeCall[0]).toBe('idb')
    const swipeArgs = swipeCall[1] as string[]
    const y1 = parseFloat(swipeArgs[3])  // swipe args: [ui, swipe, x1, y1, x2, y2, --udid, ...]
    const y2 = parseFloat(swipeArgs[5])
    expect(y2).toBeGreaterThan(y1)
  })

  it('dispatches scroll direction=down as swipe with y2 < y1', async () => {
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

// ── idbSwipe ──────────────────────────────────────────────────────────────────

describe('idbSwipe', () => {
  beforeEach(() => vi.clearAllMocks())

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

  it('returns failure when IDB not available', async () => {
    mockExecFile.mockRejectedValueOnce(new Error('not found'))

    const result = await idbSwipe(UDID, 0, 0, 100, 100)

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/IDB not available/)
  })
})

// ── idbButton ─────────────────────────────────────────────────────────────────

describe('idbButton', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses idb for HOME when available', async () => {
    mockExecFile
      .mockResolvedValueOnce({ stdout: '/usr/local/bin/idb', stderr: '' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' })

    const result = await idbButton(UDID, 'HOME')

    expect(result.success).toBe(true)
    expect(result.action).toBe('button:HOME')
    expect(mockExecFile.mock.calls[1][1]).toEqual(['ui', 'button', 'HOME', '--udid', UDID])
  })

  it('falls back to simctl for HOME when IDB unavailable', async () => {
    mockExecFile
      .mockRejectedValueOnce(new Error('not found'))       // which idb
      .mockResolvedValueOnce({ stdout: '', stderr: '' })   // xcrun simctl spawn

    const result = await idbButton(UDID, 'HOME')

    expect(result.success).toBe(true)
    expect(result.action).toBe('button:HOME')
    expect(mockExecFile.mock.calls[1][0]).toBe('xcrun')
  })

  it('returns failure for non-HOME buttons when IDB unavailable', async () => {
    mockExecFile.mockRejectedValueOnce(new Error('not found'))

    const result = await idbButton(UDID, 'LOCK')

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/IDB not available/)
  })
})

// ── idbOpenUrl ────────────────────────────────────────────────────────────────

describe('idbOpenUrl', () => {
  beforeEach(() => vi.clearAllMocks())

  it('always uses xcrun simctl openurl', async () => {
    mockExecFile.mockResolvedValueOnce({ stdout: '', stderr: '' })

    const result = await idbOpenUrl(UDID, 'myapp://home')

    expect(result.success).toBe(true)
    expect(result.action).toBe('openUrl')
    expect(mockExecFile).toHaveBeenCalledWith(
      'xcrun',
      ['simctl', 'openurl', UDID, 'myapp://home'],
      { timeout: 10000 }
    )
  })

  it('returns failure when simctl errors', async () => {
    mockExecFile.mockRejectedValueOnce(new Error('device not booted'))

    const result = await idbOpenUrl(UDID, 'myapp://crash')

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/device not booted/)
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
    // 0 + round(101/2) = round(50.5) = 51 in JS (Math.round rounds 0.5 up)
    expect(result).toEqual({ x: 51, y: 26 })
  })

  it('handles zero-size elements', () => {
    const result = elementCenter({ frame: { x: 50, y: 75, width: 0, height: 0 } })
    expect(result).toEqual({ x: 50, y: 75 })
  })
})
