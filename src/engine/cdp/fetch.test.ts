import { describe, it, expect, vi } from 'vitest'
import { FetchDomain, fulfillParams, matchesPattern } from './fetch.js'

describe('matchesPattern', () => {
  it('matches globs, exact URLs and RegExps', () => {
    expect(matchesPattern('*/api/*', 'http://x/api/users')).toBe(true)
    expect(matchesPattern('http://x/a.json', 'http://x/a.json')).toBe(true)
    expect(matchesPattern('http://x/a.json', 'http://x/aXjson')).toBe(false)
    expect(matchesPattern(/users$/, 'http://x/api/users')).toBe(true)
  })
})

describe('fulfillParams', () => {
  it('serializes object bodies as JSON with a JSON content type', () => {
    const p = fulfillParams('r1', { status: 201, body: { ok: 1 } })
    expect(p.responseCode).toBe(201)
    expect(Buffer.from(p.body, 'base64').toString()).toBe('{"ok":1}')
    expect(p.responseHeaders).toContainEqual({ name: 'Content-Type', value: 'application/json' })
  })
})

describe('FetchDomain', () => {
  it('fulfills matching requests and continues the rest', async () => {
    const handlers: Record<string, (p: unknown) => void> = {}
    const conn = {
      on: (m: string, h: (p: unknown) => void) => { handlers[m] = h },
      send: vi.fn().mockResolvedValue({}),
    }
    const fetch = new FetchDomain(conn as never, 's1')
    await fetch.mock('*/api/*', { body: 'hi' })
    expect(conn.send).toHaveBeenCalledWith('Fetch.enable', expect.anything(), 's1')
    handlers['Fetch.requestPaused']({ requestId: 'a', request: { url: 'http://x/api/1' } })
    handlers['Fetch.requestPaused']({ requestId: 'b', request: { url: 'http://x/other' } })
    await new Promise((r) => setTimeout(r, 0))
    const methods = conn.send.mock.calls.map((c) => c[0])
    expect(methods).toContain('Fetch.fulfillRequest')
    expect(methods).toContain('Fetch.continueRequest')
  })
})
