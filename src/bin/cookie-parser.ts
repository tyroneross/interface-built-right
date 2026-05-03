/**
 * Cookie input parsing for `audit`, `start`, `scan`, `session start`, `check`.
 *
 * Two input shapes are supported:
 *
 * 1. **Pair string** — a single `--cookie` value following the wire format used
 *    by HTTP `Cookie` request headers: `name=value` pairs separated by `;`.
 *    Example: `--cookie "session=abc; csrf=xyz"`. Whitespace around `;` is
 *    tolerated. Empty entries are ignored.
 *
 * 2. **Cookie jar file** — `--cookie-jar <path>` pointing at a JSON file
 *    containing an array of objects matching {@link SetCookieParams}. The JSON
 *    shape is preferred over Netscape's tab-delimited format because (a) it
 *    maps 1:1 onto Chrome DevTools Protocol's `Network.setCookie` parameters
 *    and (b) is trivially producible with `jq` from a curl session.
 *
 * For pair strings, the audited URL is recorded on each cookie via the `url`
 * field so CDP can derive `domain`, `path`, and `secure` automatically. This
 * matches the behaviour a real user gets when the server sets the cookie via
 * `Set-Cookie` on a navigation response.
 */
import { readFileSync } from 'node:fs'
import type { SetCookieParams } from '../engine/cdp/network.js'

/**
 * Parse a `name=value;name2=value2` string into `SetCookieParams[]`.
 *
 * Each cookie is associated with `defaultUrl` so CDP can infer domain/path.
 * Pass an audit-target URL (post-redirect-resolution) for best fidelity.
 *
 * @throws If any entry is malformed (no `=` separator).
 */
export function parseCookiePairs(pairs: string, defaultUrl: string): SetCookieParams[] {
  if (!pairs || !pairs.trim()) return []
  const out: SetCookieParams[] = []
  for (const raw of pairs.split(';')) {
    const piece = raw.trim()
    if (!piece) continue
    const eq = piece.indexOf('=')
    if (eq <= 0) {
      throw new Error(
        `Cookie pair "${piece}" is missing a name=value separator. Expected format: name=value;name2=value2`,
      )
    }
    const name = piece.slice(0, eq).trim()
    const value = piece.slice(eq + 1).trim()
    if (!name) {
      throw new Error(`Cookie entry "${piece}" has an empty name`)
    }
    out.push({ name, value, url: defaultUrl })
  }
  return out
}

/**
 * Parse a JSON cookie-jar file into `SetCookieParams[]`.
 *
 * Each entry must include `name` and `value`. Optional fields
 * (`url`, `domain`, `path`, `secure`, `httpOnly`, `sameSite`, `expires`)
 * pass through to CDP. If neither `url` nor `domain` is set on an entry, the
 * audited URL is filled in so CDP can infer domain/path.
 *
 * @throws If the file does not parse as JSON or any entry is malformed.
 */
export function parseCookieJar(path: string, defaultUrl: string): SetCookieParams[] {
  const raw = readFileSync(path, 'utf8')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(`Cookie jar at ${path} is not valid JSON: ${reason}`)
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`Cookie jar at ${path} must be a JSON array of cookie objects`)
  }
  const out: SetCookieParams[] = []
  for (let i = 0; i < parsed.length; i++) {
    const entry = parsed[i]
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Cookie jar entry at index ${i} is not an object`)
    }
    const obj = entry as Record<string, unknown>
    const name = obj.name
    const value = obj.value
    if (typeof name !== 'string' || !name) {
      throw new Error(`Cookie jar entry at index ${i} is missing a non-empty "name"`)
    }
    if (typeof value !== 'string') {
      throw new Error(`Cookie jar entry at index ${i} is missing a string "value"`)
    }
    const cookie: SetCookieParams = { name, value }
    if (typeof obj.url === 'string') cookie.url = obj.url
    if (typeof obj.domain === 'string') cookie.domain = obj.domain
    if (typeof obj.path === 'string') cookie.path = obj.path
    if (typeof obj.secure === 'boolean') cookie.secure = obj.secure
    if (typeof obj.httpOnly === 'boolean') cookie.httpOnly = obj.httpOnly
    if (
      obj.sameSite === 'Strict' ||
      obj.sameSite === 'Lax' ||
      obj.sameSite === 'None'
    ) {
      cookie.sameSite = obj.sameSite
    }
    if (typeof obj.expires === 'number') cookie.expires = obj.expires
    if (!cookie.url && !cookie.domain) cookie.url = defaultUrl
    out.push(cookie)
  }
  return out
}

/**
 * Resolve cookies from CLI options. Combines `--cookie` and `--cookie-jar`
 * inputs (jar entries first, pairs appended; later same-named pairs win at
 * the CDP layer because each `setCookie` call overwrites by name+domain).
 */
export function resolveCookies(
  options: { cookie?: string; cookieJar?: string },
  defaultUrl: string,
): SetCookieParams[] {
  const out: SetCookieParams[] = []
  if (options.cookieJar) out.push(...parseCookieJar(options.cookieJar, defaultUrl))
  if (options.cookie) out.push(...parseCookiePairs(options.cookie, defaultUrl))
  return out
}
