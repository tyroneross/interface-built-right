import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseCookiePairs, parseCookieJar, resolveCookies } from './cookie-parser.js'

const URL = 'http://localhost:3000'

describe('parseCookiePairs', () => {
  it('parses a single name=value pair', () => {
    const r = parseCookiePairs('session=abc', URL)
    expect(r).toEqual([{ name: 'session', value: 'abc', url: URL }])
  })

  it('parses multiple semicolon-separated pairs and trims whitespace', () => {
    const r = parseCookiePairs('  a=1 ;b=2;  c=3 ', URL)
    expect(r).toHaveLength(3)
    expect(r[0]).toMatchObject({ name: 'a', value: '1' })
    expect(r[1]).toMatchObject({ name: 'b', value: '2' })
    expect(r[2]).toMatchObject({ name: 'c', value: '3' })
  })

  it('preserves equals signs inside the value', () => {
    const r = parseCookiePairs('jwt=eyJhbGc=padded', URL)
    expect(r[0]).toMatchObject({ name: 'jwt', value: 'eyJhbGc=padded' })
  })

  it('returns empty array for empty or whitespace input', () => {
    expect(parseCookiePairs('', URL)).toEqual([])
    expect(parseCookiePairs('   ', URL)).toEqual([])
    expect(parseCookiePairs(';;', URL)).toEqual([])
  })

  it('attaches the audit URL so CDP can infer domain/path/secure', () => {
    const r = parseCookiePairs('s=v', 'https://example.test/foo')
    expect(r[0].url).toBe('https://example.test/foo')
  })

  it('rejects an entry without an = separator', () => {
    expect(() => parseCookiePairs('badcookie', URL)).toThrow(/missing a name=value separator/)
  })

  it('rejects an entry whose name is empty (=value)', () => {
    expect(() => parseCookiePairs('=v', URL)).toThrow(/missing a name=value separator/)
  })
})

describe('parseCookieJar', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'ibr-cookie-jar-'))

  it('parses a JSON array of cookie objects', () => {
    const path = join(tmp, 'jar-1.json')
    writeFileSync(
      path,
      JSON.stringify([
        { name: 'session', value: 'abc' },
        { name: 'csrf', value: 'xyz', sameSite: 'Lax' },
      ]),
    )
    const r = parseCookieJar(path, URL)
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ name: 'session', value: 'abc', url: URL })
    expect(r[1]).toMatchObject({ name: 'csrf', value: 'xyz', sameSite: 'Lax', url: URL })
  })

  it('passes through optional CDP fields without mutating', () => {
    const path = join(tmp, 'jar-2.json')
    writeFileSync(
      path,
      JSON.stringify([
        {
          name: 'a',
          value: '1',
          domain: 'example.test',
          path: '/api',
          secure: true,
          httpOnly: true,
          expires: 1234567890,
        },
      ]),
    )
    const r = parseCookieJar(path, URL)
    expect(r[0]).toEqual({
      name: 'a',
      value: '1',
      domain: 'example.test',
      path: '/api',
      secure: true,
      httpOnly: true,
      expires: 1234567890,
    })
    // url not added when domain is present.
    expect(r[0].url).toBeUndefined()
  })

  it('strips unsupported sameSite values silently', () => {
    const path = join(tmp, 'jar-3.json')
    writeFileSync(
      path,
      JSON.stringify([{ name: 'a', value: '1', sameSite: 'invalid' }]),
    )
    const r = parseCookieJar(path, URL)
    expect(r[0].sameSite).toBeUndefined()
  })

  it('throws when JSON is malformed', () => {
    const path = join(tmp, 'bad.json')
    writeFileSync(path, '{not json')
    expect(() => parseCookieJar(path, URL)).toThrow(/not valid JSON/)
  })

  it('throws when top-level is not an array', () => {
    const path = join(tmp, 'obj.json')
    writeFileSync(path, JSON.stringify({ name: 's', value: 'v' }))
    expect(() => parseCookieJar(path, URL)).toThrow(/must be a JSON array/)
  })

  it('throws when an entry is missing name', () => {
    const path = join(tmp, 'noname.json')
    writeFileSync(path, JSON.stringify([{ value: 'v' }]))
    expect(() => parseCookieJar(path, URL)).toThrow(/missing a non-empty "name"/)
  })

  it('throws when an entry has a non-string value', () => {
    const path = join(tmp, 'numval.json')
    writeFileSync(path, JSON.stringify([{ name: 's', value: 42 }]))
    expect(() => parseCookieJar(path, URL)).toThrow(/missing a string "value"/)
  })

  // teardown
  it('cleans up tmp dir', () => {
    rmSync(tmp, { recursive: true, force: true })
  })
})

describe('resolveCookies', () => {
  it('returns empty array when neither flag is set', () => {
    expect(resolveCookies({}, URL)).toEqual([])
  })

  it('combines jar and pair sources with jar first', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'ibr-cookie-combine-'))
    const jarPath = join(tmp, 'jar.json')
    writeFileSync(jarPath, JSON.stringify([{ name: 'jar1', value: 'a' }]))
    const r = resolveCookies({ cookieJar: jarPath, cookie: 'pair1=b' }, URL)
    expect(r).toHaveLength(2)
    expect(r[0].name).toBe('jar1')
    expect(r[1].name).toBe('pair1')
    rmSync(tmp, { recursive: true, force: true })
  })

  it('passes the audit URL through to pair entries', () => {
    const r = resolveCookies({ cookie: 's=v' }, 'https://example.test/path')
    expect(r[0].url).toBe('https://example.test/path')
  })
})
