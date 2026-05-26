/**
 * Unit tests for EmulationDomain.applyDeviceProfile().
 *
 * The bug we're guarding against (pre-1.1.0): --viewport mobile parsed
 * cleanly but Chrome rendered the page at desktop because only
 * setDeviceMetricsOverride fired — not setUserAgentOverride, not
 * setTouchEmulationEnabled. These tests assert all three CDP calls
 * happen, in the right order, with the right params, for a mobile
 * profile.
 *
 * Note: we mock CdpConnection rather than launching Chrome. The
 * integration test that exercises a live driver lives in
 * src/engine/engine.integration.test.ts.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { EmulationDomain, type ViewportConfig } from './emulation.js'
import type { CdpConnection } from './connection.js'

interface RecordedCall {
  method: string
  params: unknown
  sessionId: string | undefined
}

/**
 * Minimal stand-in for CdpConnection — captures every send() the
 * domain makes so tests can assert on the exact CDP wire traffic.
 * Returns undefined for everything (Emulation domain methods don't
 * read responses).
 */
class RecordingConnection {
  calls: RecordedCall[] = []

  async send(
    method: string,
    params?: unknown,
    sessionId?: string,
  ): Promise<unknown> {
    this.calls.push({ method, params, sessionId })
    return undefined
  }
}

function makeDomain(): { domain: EmulationDomain; recorder: RecordingConnection } {
  const recorder = new RecordingConnection()
  const domain = new EmulationDomain(recorder as unknown as CdpConnection, 'session-1')
  return { domain, recorder }
}

const IPHONE_14_PROFILE: ViewportConfig = {
  width: 390,
  height: 844,
  deviceScaleFactor: 3,
  mobile: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  hasTouch: true,
}

const DESKTOP_PROFILE: ViewportConfig = {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
  hasTouch: false,
}

describe('EmulationDomain.applyDeviceProfile', () => {
  let domain: EmulationDomain
  let recorder: RecordingConnection

  beforeEach(() => {
    const built = makeDomain()
    domain = built.domain
    recorder = built.recorder
  })

  it('fires UA override THEN device metrics THEN touch — in that order — for a mobile profile', async () => {
    await domain.applyDeviceProfile(IPHONE_14_PROFILE)

    // Order matters: UA must be set before metrics so that the
    // initial document request (issued by the next page.navigate)
    // sees the mobile UA. Sites that branch on UA serve different
    // HTML based on what they see first.
    expect(recorder.calls.map(c => c.method)).toEqual([
      'Emulation.setUserAgentOverride',
      'Emulation.setDeviceMetricsOverride',
      'Emulation.setTouchEmulationEnabled',
    ])
  })

  it('sends mobile:true and DPR 3 in setDeviceMetricsOverride', async () => {
    await domain.applyDeviceProfile(IPHONE_14_PROFILE)

    const metricsCall = recorder.calls.find(
      c => c.method === 'Emulation.setDeviceMetricsOverride',
    )
    expect(metricsCall?.params).toEqual({
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    })
  })

  it('sends the mobile UA via setUserAgentOverride', async () => {
    await domain.applyDeviceProfile(IPHONE_14_PROFILE)

    const uaCall = recorder.calls.find(
      c => c.method === 'Emulation.setUserAgentOverride',
    )
    expect(uaCall?.params).toEqual({ userAgent: IPHONE_14_PROFILE.userAgent })
  })

  it('enables touch with maxTouchPoints:5 for mobile', async () => {
    await domain.applyDeviceProfile(IPHONE_14_PROFILE)

    const touchCall = recorder.calls.find(
      c => c.method === 'Emulation.setTouchEmulationEnabled',
    )
    expect(touchCall?.params).toEqual({ enabled: true, maxTouchPoints: 5 })
  })

  it('skips UA override and disables touch for a desktop profile', async () => {
    await domain.applyDeviceProfile(DESKTOP_PROFILE)

    // No UA call when profile has no userAgent (keep Chrome's default).
    expect(
      recorder.calls.find(c => c.method === 'Emulation.setUserAgentOverride'),
    ).toBeUndefined()

    // Metrics still fires with mobile:false.
    const metricsCall = recorder.calls.find(
      c => c.method === 'Emulation.setDeviceMetricsOverride',
    )
    expect(metricsCall?.params).toEqual({
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })

    // Touch explicitly disabled (maxTouchPoints:1 — CDP minimum).
    const touchCall = recorder.calls.find(
      c => c.method === 'Emulation.setTouchEmulationEnabled',
    )
    expect(touchCall?.params).toEqual({ enabled: false, maxTouchPoints: 1 })
  })

  it('derives touch from mobile when hasTouch is omitted', async () => {
    // Profile that only sets `mobile: true` without hasTouch — touch
    // should still come on. This is the same defensive default
    // EmulationDomain applies in production.
    await domain.applyDeviceProfile({
      width: 412,
      height: 915,
      mobile: true,
    })

    const touchCall = recorder.calls.find(
      c => c.method === 'Emulation.setTouchEmulationEnabled',
    )
    expect(touchCall?.params).toEqual({ enabled: true, maxTouchPoints: 5 })
  })

  it('routes every call through the supplied sessionId', async () => {
    await domain.applyDeviceProfile(IPHONE_14_PROFILE)
    for (const call of recorder.calls) {
      expect(call.sessionId, `${call.method} sessionId`).toBe('session-1')
    }
  })
})

describe('EmulationDomain individual setters', () => {
  it('setDeviceMetrics defaults deviceScaleFactor to 1 and mobile to false', async () => {
    const { domain, recorder } = makeDomain()
    await domain.setDeviceMetrics({ width: 800, height: 600 })

    expect(recorder.calls[0].method).toBe('Emulation.setDeviceMetricsOverride')
    expect(recorder.calls[0].params).toEqual({
      width: 800,
      height: 600,
      deviceScaleFactor: 1,
      mobile: false,
    })
  })

  it('setTouchEmulation collapses maxTouchPoints to 1 when disabled', async () => {
    const { domain, recorder } = makeDomain()
    await domain.setTouchEmulation(false)
    expect(recorder.calls[0].params).toEqual({ enabled: false, maxTouchPoints: 1 })
  })
})
