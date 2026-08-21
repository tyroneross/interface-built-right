import { describe, it, expect, beforeEach } from 'vitest'
import { sessions, closeAllSessions, __test_setSession } from './src/mcp/sessions.js'

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
