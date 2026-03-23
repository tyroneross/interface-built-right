/**
 * CDP Network domain — cookie management for auth state.
 * NEW for IBR — replaces Playwright's storageState for auth persistence.
 */

import type { CdpConnection } from './connection.js'

export interface Cookie {
  name: string
  value: string
  domain: string
  path: string
  expires: number
  size: number
  httpOnly: boolean
  secure: boolean
  session: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

export interface SetCookieParams {
  name: string
  value: string
  url?: string
  domain?: string
  path?: string
  secure?: boolean
  httpOnly?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
  expires?: number
}

export class NetworkDomain {
  constructor(
    private conn: CdpConnection,
    private sessionId?: string,
  ) {}

  async enable(): Promise<void> {
    await this.conn.send('Network.enable', {}, this.sessionId)
  }

  /**
   * Get all cookies, optionally filtered by URLs.
   */
  async getCookies(urls?: string[]): Promise<Cookie[]> {
    const params: Record<string, unknown> = {}
    if (urls) params.urls = urls

    const result = await this.conn.send<{ cookies: Cookie[] }>(
      'Network.getCookies', params, this.sessionId,
    )
    return result.cookies
  }

  /**
   * Set a cookie.
   */
  async setCookie(cookie: SetCookieParams): Promise<boolean> {
    const result = await this.conn.send<{ success: boolean }>(
      'Network.setCookie', cookie as unknown as Record<string, unknown>, this.sessionId,
    )
    return result.success
  }

  /**
   * Set multiple cookies at once.
   */
  async setCookies(cookies: SetCookieParams[]): Promise<void> {
    await this.conn.send('Network.setCookies', {
      cookies: cookies as unknown as Record<string, unknown>[],
    }, this.sessionId)
  }

  /**
   * Clear all browser cookies.
   */
  async clearCookies(): Promise<void> {
    await this.conn.send('Network.clearBrowserCookies', {}, this.sessionId)
  }

  /**
   * Delete specific cookies by name and optional URL/domain.
   */
  async deleteCookies(params: {
    name: string
    url?: string
    domain?: string
    path?: string
  }): Promise<void> {
    await this.conn.send('Network.deleteCookies', params, this.sessionId)
  }
}
