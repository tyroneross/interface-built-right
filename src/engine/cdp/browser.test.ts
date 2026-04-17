import { describe, expect, it } from 'vitest'

import { resolveBrowserConnectionOptions } from './browser.js'

describe('resolveBrowserConnectionOptions', () => {
  it('defaults to local mode when no connect hints are present', () => {
    const resolved = resolveBrowserConnectionOptions({}, {})

    expect(resolved).toEqual({
      mode: 'local',
      cdpUrl: undefined,
      wsEndpoint: undefined,
      chromePath: undefined,
    })
  })

  it('switches to connect mode when a CDP URL is provided', () => {
    const resolved = resolveBrowserConnectionOptions({
      cdpUrl: 'http://127.0.0.1:9222',
    }, {})

    expect(resolved.mode).toBe('connect')
    expect(resolved.cdpUrl).toBe('http://127.0.0.1:9222')
  })

  it('switches to connect mode when a WebSocket endpoint is provided', () => {
    const resolved = resolveBrowserConnectionOptions({
      wsEndpoint: 'ws://127.0.0.1:9222/devtools/browser/test',
    }, {})

    expect(resolved.mode).toBe('connect')
    expect(resolved.wsEndpoint).toBe('ws://127.0.0.1:9222/devtools/browser/test')
  })

  it('uses environment variables when CLI options are absent', () => {
    const resolved = resolveBrowserConnectionOptions({}, {
      IBR_BROWSER_MODE: 'connect',
      IBR_CDP_URL: 'http://127.0.0.1:9333',
      IBR_CHROME_PATH: '/custom/chrome',
    })

    expect(resolved).toEqual({
      mode: 'connect',
      cdpUrl: 'http://127.0.0.1:9333',
      wsEndpoint: undefined,
      chromePath: '/custom/chrome',
    })
  })

  it('prefers explicit options over environment variables', () => {
    const resolved = resolveBrowserConnectionOptions({
      mode: 'connect',
      cdpUrl: 'http://127.0.0.1:9444',
      chromePath: '/explicit/chrome',
    }, {
      IBR_BROWSER_MODE: 'local',
      IBR_CDP_URL: 'http://127.0.0.1:9222',
      IBR_CHROME_PATH: '/env/chrome',
    })

    expect(resolved).toEqual({
      mode: 'connect',
      cdpUrl: 'http://127.0.0.1:9444',
      wsEndpoint: undefined,
      chromePath: '/explicit/chrome',
    })
  })

  it('keeps explicit local mode even when connect endpoints exist in the environment', () => {
    const resolved = resolveBrowserConnectionOptions({
      mode: 'local',
    }, {
      IBR_CDP_URL: 'http://127.0.0.1:9222',
      IBR_WS_ENDPOINT: 'ws://127.0.0.1:9222/devtools/browser/test',
    })

    expect(resolved.mode).toBe('local')
    expect(resolved.cdpUrl).toBe('http://127.0.0.1:9222')
    expect(resolved.wsEndpoint).toBe('ws://127.0.0.1:9222/devtools/browser/test')
  })
})
