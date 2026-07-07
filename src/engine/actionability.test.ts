/**
 * Unit tests for waitForActionable — pure logic, fake resolveAndProbe
 * closures, no browser/CDP required. Complements the live-Chrome fixture
 * coverage in engine.test.ts (which exercises the same contract through
 * EngineDriver.click/type/fill against real delayed/hidden/disabled/moving
 * DOM elements).
 */

import { describe, it, expect } from 'vitest'
import { waitForActionable, ActionabilityTimeoutError, type ActionabilityState } from './actionability.js'

function state(overrides: Partial<ActionabilityState> = {}): ActionabilityState {
  return {
    present: true,
    visible: true,
    enabled: true,
    rect: { x: 0, y: 0, width: 100, height: 20 },
    ...overrides,
  }
}

describe('waitForActionable', () => {
  it('resolves immediately-stable elements without waiting the full timeout', async () => {
    let calls = 0
    const target = await waitForActionable<string>(async () => {
      calls++
      return { target: 'el', state: state() }
    }, { timeout: 2000, pollInterval: 5, requiredStableChecks: 2 })

    expect(target).toBe('el')
    // Needs at least 2 samples to confirm stability, but must not spin
    // through anywhere near the full timeout.
    expect(calls).toBeGreaterThanOrEqual(2)
    expect(calls).toBeLessThan(20)
  })

  it('waits out a delayed-render element then succeeds', async () => {
    const appearsAt = Date.now() + 35
    const result = await waitForActionable<string>(async () => {
      if (Date.now() < appearsAt) return null // not resolvable yet
      return { target: 'delayed-el', state: state() }
    }, { timeout: 2000, pollInterval: 5 })

    expect(result).toBe('delayed-el')
  })

  it('waits out a hidden-then-visible element', async () => {
    const visibleAt = Date.now() + 35
    const result = await waitForActionable<string>(async () => {
      const visible = Date.now() >= visibleAt
      return { target: 'hidden-el', state: state({ visible }) }
    }, { timeout: 2000, pollInterval: 5 })

    expect(result).toBe('hidden-el')
  })

  it('waits out a disabled-then-enabled element', async () => {
    const enabledAt = Date.now() + 35
    const result = await waitForActionable<string>(async () => {
      const enabled = Date.now() >= enabledAt
      return { target: 'disabled-el', state: state({ enabled }) }
    }, { timeout: 2000, pollInterval: 5 })

    expect(result).toBe('disabled-el')
  })

  it('waits for a moving element to settle before returning', async () => {
    const settleAt = Date.now() + 35
    let tick = 0
    let lastX = -1
    const result = await waitForActionable<string>(async () => {
      // Strictly-increasing counter while "moving" — guarantees consecutive
      // samples never accidentally match (unlike a Date.now()-derived value,
      // which can land in the same bucket twice at a tight poll interval).
      const x = Date.now() < settleAt ? ++tick : 500
      lastX = x
      return { target: 'moving-el', state: state({ rect: { x, y: 0, width: 100, height: 20 } }) }
    }, { timeout: 2000, pollInterval: 5, requiredStableChecks: 2 })

    expect(result).toBe('moving-el')
    expect(lastX).toBe(500)
  })

  it('throws ActionabilityTimeoutError with reason "not present" when never resolvable', async () => {
    await expect(
      waitForActionable<string>(async () => null, { timeout: 45, pollInterval: 5 }),
    ).rejects.toMatchObject({
      name: 'ActionabilityTimeoutError',
      reason: 'not resolvable',
    })
  })

  it('throws with reason "not visible" when element stays hidden', async () => {
    await expect(
      waitForActionable<string>(
        async () => ({ target: 'x', state: state({ visible: false }) }),
        { timeout: 45, pollInterval: 5 },
      ),
    ).rejects.toMatchObject({ reason: 'not visible (hidden or covered)' })
  })

  it('throws with reason "disabled" when element stays disabled', async () => {
    await expect(
      waitForActionable<string>(
        async () => ({ target: 'x', state: state({ enabled: false }) }),
        { timeout: 45, pollInterval: 5 },
      ),
    ).rejects.toMatchObject({ reason: 'disabled' })
  })

  it('throws with reason "position not yet stable" when the element never settles', async () => {
    await expect(
      waitForActionable<string>(
        async () => ({ target: 'x', state: state({ rect: { x: Date.now() % 1000, y: 0, width: 10, height: 10 } }) }),
        { timeout: 45, pollInterval: 5 },
      ),
    ).rejects.toMatchObject({ reason: 'position not yet stable' })
  })

  it('is an instance of ActionabilityTimeoutError', async () => {
    try {
      await waitForActionable<string>(async () => null, { timeout: 20, pollInterval: 5 })
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ActionabilityTimeoutError)
    }
  })

  // ─── Stale-target re-resolution ─────────────────────────────
  //
  // Simulates the driver.ts scenario: an element's identity (e.g. a
  // backendNodeId keyed off the original elementId) goes stale mid-wait
  // because the underlying DOM node was replaced by a re-render. The
  // resolver is responsible for re-resolving by last-known name/role and
  // handing back a NEW target id — waitForActionable must accept that new
  // target transparently and continue polling it, never acting on the dead
  // reference.
  it('accepts a re-resolved target after the original goes stale mid-wait', async () => {
    type Target = { id: string; generation: number }
    const staleAt = Date.now() + 20 // original id becomes stale after 20ms
    const reResolvedAt = Date.now() + 45 // re-resolution "finds" the new node after 45ms
    let sawStaleGap = false

    const result = await waitForActionable<Target>(async () => {
      const now = Date.now()
      if (now < staleAt) {
        // Original node, present but its rect keeps changing every tick (it
        // never reaches requiredStableChecks) — proving the loop can't act
        // on the original node before it goes stale.
        return { target: { id: 'original', generation: 1 }, state: state({ rect: { x: now % 997, y: 1, width: 10, height: 10 } }) }
      }
      if (now < reResolvedAt) {
        // Original backendNodeId is gone; re-resolution hasn't found the
        // replacement yet (mirrors driver.ts's reResolveByLabelRole racing
        // the fixture's re-render). Resolver reports "not resolvable".
        sawStaleGap = true
        return null
      }
      // Re-resolved: a NEW target id for the replacement node.
      return { target: { id: 'reresolved', generation: 2 }, state: state({ rect: { x: 5, y: 5, width: 10, height: 10 } }) }
    }, { timeout: 2000, pollInterval: 5, requiredStableChecks: 2 })

    expect(sawStaleGap).toBe(true)
    expect(result.id).toBe('reresolved')
    expect(result.generation).toBe(2)
  })

  it('never returns a target from a resolve tick where present was false', async () => {
    // Regression guard: even if a later "present:false" tick reports a rect,
    // the loop must not accidentally treat it as actionable.
    let ticks = 0
    const result = await waitForActionable<string>(async () => {
      ticks++
      if (ticks < 3) return { target: 'ghost', state: state({ present: false, rect: { x: 9, y: 9, width: 9, height: 9 } }) }
      return { target: 'real', state: state() }
    }, { timeout: 2000, pollInterval: 5, requiredStableChecks: 2 })

    expect(result).toBe('real')
  })
})
