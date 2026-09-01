import { describe, expect, it } from 'vitest'
import { tmpdir } from 'node:os'

import {
  parseIbrChromeProcesses,
  reapOrphanedIbrChromeProcesses,
  resolveBrowserConnectionOptions,
  shouldReclaimSingletonLock,
} from './browser.js'

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

describe('IBR Chrome process ownership', () => {
  const tempProfile = `${tmpdir()}/ibr-chrome-Ab12Cd`
  const psOutput = [
    ` 101   1 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --remote-debugging-port=50001 --user-data-dir=${tempProfile} --headless=new`,
    ` 102 101 /Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Helper.app/Contents/MacOS/Google Chrome Helper --type=renderer --remote-debugging-port=50001 --user-data-dir=${tempProfile}`,
    ' 201 999 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --remote-debugging-port=50002 --user-data-dir="/Users/test/project/.ibr/browser-profile" --headless=new',
    ' 301   1 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --profile-directory=Default',
  ].join('\n')

  it('identifies IBR main processes without treating helpers or normal Chrome as sessions', () => {
    expect(parseIbrChromeProcesses(psOutput)).toEqual([
      expect.objectContaining({ pid: 101, ppid: 1, profileDir: tempProfile }),
      expect.objectContaining({ pid: 201, ppid: 999, profileDir: '/Users/test/project/.ibr/browser-profile' }),
    ])
  })

  it('reaps only orphaned IBR main processes', () => {
    const killed: Array<[number, NodeJS.Signals]> = []
    const result = reapOrphanedIbrChromeProcesses({
      psOutput,
      kill: (pid, signal) => killed.push([pid, signal]),
    })

    expect(result).toEqual({ reaped: [101], preserved: [201] })
    expect(killed).toEqual([[101, 'SIGTERM']])
  })
})

describe('Chrome SingletonLock reclamation', () => {
  const base = {
    targetHost: 'old-host.local',
    targetPid: 123,
    currentHost: 'new-host.local',
    lockAgeMs: 2 * 60 * 60 * 1000,
    profileInUse: false,
    targetPidAlive: false,
  }

  it('reclaims an old unused lock after the machine hostname changes', () => {
    expect(shouldReclaimSingletonLock(base)).toBe(true)
  })

  it('preserves a foreign-host lock during the grace period', () => {
    expect(shouldReclaimSingletonLock({ ...base, lockAgeMs: 30_000 })).toBe(false)
  })

  it('preserves any lock whose profile is in use', () => {
    expect(shouldReclaimSingletonLock({ ...base, profileInUse: true })).toBe(false)
  })

  it('preserves a same-host live owner and reclaims a dead one immediately', () => {
    const sameHost = { ...base, targetHost: base.currentHost, lockAgeMs: 0 }
    expect(shouldReclaimSingletonLock({ ...sameHost, targetPidAlive: true })).toBe(false)
    expect(shouldReclaimSingletonLock({ ...sameHost, targetPidAlive: false })).toBe(true)
  })
})
