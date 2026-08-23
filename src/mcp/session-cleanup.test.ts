import { describe, it, expect, beforeEach } from 'vitest'
import { sessions, closeAllSessions, sweepIdleSessions, touchSession, __test_setSession } from './sessions.js'

describe('closeAllSessions', () => {
  beforeEach(() => sessions.clear())

  it('closes every driver and empties the store', async () => {
    const closed: string[] = []
    for (const id of ['a', 'b', 'c']) {
      __test_setSession(id, {
        driver: { close: async () => { closed.push(id) } },
        type: 'chrome', url: 'http://x', createdAt: Date.now(),
      })
    }
    const n = await closeAllSessions()
    expect(n).toBe(3)
    expect(closed.sort()).toEqual(['a', 'b', 'c'])
    expect(sessions.size).toBe(0)
  })

  it('one failing driver does not block the others', async () => {
    const closed: string[] = []
    __test_setSession('bad', { driver: { close: async () => { throw new Error('nope') } }, type: 'chrome', createdAt: 0 })
    __test_setSession('good', { driver: { close: async () => { closed.push('good') } }, type: 'chrome', createdAt: 0 })
    await expect(closeAllSessions()).resolves.toBe(2)
    expect(closed).toEqual(['good'])
    expect(sessions.size).toBe(0)
  })

  it('tolerates native sessions that carry no driver', async () => {
    __test_setSession('native', { driver: null, type: 'macos', app: 'Finder', createdAt: 0 })
    await expect(closeAllSessions()).resolves.toBe(1)
    expect(sessions.size).toBe(0)
  })
})

describe('sweepIdleSessions', () => {
  beforeEach(() => sessions.clear())

  it('is disabled at 0 or negative — the documented default', async () => {
    __test_setSession('old', { driver: { close: async () => {} }, type: 'chrome', createdAt: 0 })
    await expect(sweepIdleSessions(0)).resolves.toEqual([])
    await expect(sweepIdleSessions(-1)).resolves.toEqual([])
    expect(sessions.size).toBe(1)
  })

  it('closes only sessions past the threshold', async () => {
    const closed: string[] = []
    __test_setSession('stale', { driver: { close: async () => { closed.push('stale') } }, type: 'chrome', createdAt: Date.now() - 60_000 })
    __test_setSession('fresh', { driver: { close: async () => { closed.push('fresh') } }, type: 'chrome', createdAt: Date.now() })
    const swept = await sweepIdleSessions(30_000)
    expect(swept).toEqual(['stale'])
    expect(closed).toEqual(['stale'])
    expect(sessions.has('fresh')).toBe(true)
  })

  it('a touched session is not swept even when created long ago', async () => {
    __test_setSession('busy', { driver: { close: async () => {} }, type: 'chrome', createdAt: Date.now() - 600_000 })
    touchSession('busy')
    await expect(sweepIdleSessions(30_000)).resolves.toEqual([])
    expect(sessions.has('busy')).toBe(true)
  })

  it('a never-touched session falls back to createdAt rather than being immortal', async () => {
    __test_setSession('never', { driver: { close: async () => {} }, type: 'chrome', createdAt: Date.now() - 600_000 })
    await expect(sweepIdleSessions(30_000)).resolves.toEqual(['never'])
  })
})
