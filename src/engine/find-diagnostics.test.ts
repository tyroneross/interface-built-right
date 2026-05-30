/**
 * Unit tests for EngineDriver.findWithDiagnostics()
 *
 * EngineDriver requires live CDP domains, so we subclass it and override
 * the internal domain calls needed by findWithDiagnostics.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EngineDriver, AUTO_RESOLVE_MIN_SCORE, AUTO_RESOLVE_DESTRUCTIVE_MIN_SCORE } from './driver.js'
import { observe } from './observe.js'
import { jaroWinkler } from './resolve.js'
import type { Element } from './types.js'

// ─── Helpers ────────────────────────────────────────────────

function makeElement(id: string, label: string, role = 'button'): Element {
  return {
    id,
    role,
    label,
    value: null,
    enabled: true,
    focused: false,
    actions: ['press'],
    bounds: [0, 0, 100, 40],
    parent: null,
  }
}

function makeTextfield(id: string, label: string): Element {
  return { ...makeElement(id, label, 'textfield'), actions: ['setValue'] }
}

// ─── Tests ───────────────────────────────────────────────────

describe('findWithDiagnostics', () => {
  let driver: EngineDriver
  let axGetSnapshot: ReturnType<typeof vi.fn>
  let axQueryAXTree: ReturnType<typeof vi.fn>

  beforeEach(() => {
    driver = new EngineDriver()

    // Spy on private ax domain via type cast — driver.accessibility is the public getter
    axGetSnapshot = vi.fn()
    axQueryAXTree = vi.fn()

    // Patch internal ax domain via accessor
    Object.defineProperty((driver as any), 'ax', {
      value: {
        getSnapshot: axGetSnapshot,
        queryAXTree: axQueryAXTree,
        getBackendNodeId: () => null,
        enable: vi.fn(),
      },
      writable: true,
      configurable: true,
    })

    // Reset cache
    ;(driver as any).resolutionCache.clear()
  })

  // ── Test 1: element found → returns elementId + confidence > 0 ──

  it('returns elementId and confidence > 0 when element found via queryAXTree', async () => {
    const el = makeElement('e1', 'Submit')
    axQueryAXTree.mockResolvedValue([el])
    axGetSnapshot.mockResolvedValue([el])

    const diag = await driver.findWithDiagnostics('Submit')

    expect(diag.elementId).toBe('e1')
    expect(diag.confidence).toBeGreaterThan(0)
    expect(diag.tier).toBe(2)
    expect(diag.tierName).toBe('queryAXTree')
    expect(diag.totalInteractive).toBe(1)
    expect(diag.alternatives).toHaveLength(0)
  })

  // ── Test 2: element not found → returns null + alternatives ──

  it('returns null elementId with alternatives when element not found', async () => {
    const elements = [
      makeElement('e1', 'Submit'),
      makeElement('e2', 'Cancel'),
      makeElement('e3', 'Back'),
    ]
    axQueryAXTree.mockResolvedValue([])
    axGetSnapshot.mockResolvedValue(elements)

    // Use a target that won't fuzzy-match any element label above 0.5
    const diag = await driver.findWithDiagnostics('ZxqvWrong')

    expect(diag.elementId).toBeNull()
    expect(diag.confidence).toBe(0)
    expect(diag.tier).toBe(4)
    expect(diag.tierName).toBe('vision')
    expect(diag.alternatives.length).toBeGreaterThan(0)
    expect(diag.totalInteractive).toBe(3)
  })

  // ── Test 3: fuzzy match — "Sbmit" matches "Submit" with score > 0.8 ──

  it('fuzzy matches "Sbmit" to "Submit" with score > 0.8 in alternatives', async () => {
    const elements = [
      makeElement('e1', 'Submit'),
      makeElement('e2', 'Cancel'),
    ]
    // queryAXTree returns nothing (no exact match for misspelled name)
    axQueryAXTree.mockResolvedValue([])
    // Jaro-Winkler via resolve will give a low confidence (<0.5) for "sbmit" vs all elements
    // since resolve uses algorithmic mode. So we'll end up in tier 4.
    // But we want alternatives to show "Submit" with high score.
    axGetSnapshot.mockResolvedValue(elements)

    const diag = await driver.findWithDiagnostics('Sbmit')

    // Verify jaroWinkler gives > 0.8 for "sbmit" vs "submit"
    const score = jaroWinkler('sbmit', 'submit')
    expect(score).toBeGreaterThan(0.8)

    // In alternatives, Submit should be the top match
    const submitAlt = diag.alternatives.find(a => a.name === 'Submit')
    expect(submitAlt).toBeDefined()
    expect(submitAlt!.score).toBeGreaterThan(0.8)
  })

  // ── Test 4: alternatives sorted by score descending ──

  it('returns alternatives sorted by score descending', async () => {
    const elements = [
      makeElement('e1', 'Zebra'),
      makeElement('e2', 'Submit'),
      makeElement('e3', 'Submerge'),
      makeElement('e4', 'Alpha'),
    ]
    axQueryAXTree.mockResolvedValue([])
    axGetSnapshot.mockResolvedValue(elements)

    const diag = await driver.findWithDiagnostics('Submit')

    // All alternatives should be sorted descending
    for (let i = 0; i < diag.alternatives.length - 1; i++) {
      expect(diag.alternatives[i].score).toBeGreaterThanOrEqual(diag.alternatives[i + 1].score)
    }
  })

  // ── Test 5: totalInteractive matches observe() count ──

  it('totalInteractive matches observe() count of interactive elements', async () => {
    const elements = [
      makeElement('e1', 'Submit'),
      makeElement('e2', 'Cancel'),
      makeTextfield('e3', 'Email'),
      // Non-interactive element (no actions)
      { ...makeElement('e4', 'Heading', 'heading'), actions: [] },
    ]
    axQueryAXTree.mockResolvedValue([])
    axGetSnapshot.mockResolvedValue(elements)

    const diag = await driver.findWithDiagnostics('Nonexistent')

    // observe() filters to elements with actions.length > 0
    const interactiveCount = observe(elements).length
    expect(diag.totalInteractive).toBe(interactiveCount)
    expect(diag.totalInteractive).toBe(3) // e1, e2, e3 — not e4
  })

  // ── Test 6: cache hit — tier 1 ──

  it('returns tier 1 (cache) when cache has a valid entry', async () => {
    const el = makeElement('e1', 'Submit')
    axGetSnapshot.mockResolvedValue([el])
    axQueryAXTree.mockResolvedValue([]) // should not be called on cache hit

    // Pre-populate the cache
    ;(driver as any).resolutionCache.set('Submit', 'e1', {
      role: 'button', label: 'Submit', confidence: 0.95,
    })

    const diag = await driver.findWithDiagnostics('Submit')

    expect(diag.elementId).toBe('e1')
    expect(diag.tier).toBe(1)
    expect(diag.tierName).toBe('cache')
    expect(diag.confidence).toBe(0.95)
    // queryAXTree should not have been called
    expect(axQueryAXTree).not.toHaveBeenCalled()
  })

  // ── Test 7: cache miss when element no longer in AX tree ──

  it('falls through cache when cached element is gone from AX tree', async () => {
    const el = makeElement('e2', 'Submit')
    // AX tree has e2, not e1
    axGetSnapshot.mockResolvedValue([el])
    axQueryAXTree.mockResolvedValue([el])

    // Cache points to e1 which doesn't exist
    ;(driver as any).resolutionCache.set('Submit', 'e1', {
      role: 'button', label: 'Submit', confidence: 0.95,
    })

    const diag = await driver.findWithDiagnostics('Submit')

    // Should have fallen through to queryAXTree and found e2
    expect(diag.elementId).toBe('e2')
    expect(diag.tier).toBe(2)
    expect(diag.tierName).toBe('queryAXTree')
  })

  // ── Test 8: jaro-winkler tier when queryAXTree misses but fuzzy hits ──

  it('returns tier 3 (jaro-winkler) when queryAXTree misses but fuzzy match is confident', async () => {
    const el = makeElement('e1', 'Submit Form')
    axQueryAXTree.mockResolvedValue([]) // exact match fails
    axGetSnapshot.mockResolvedValue([el])

    // "submit" should fuzzy-match "Submit Form" with sufficient confidence
    const diag = await driver.findWithDiagnostics('submit')

    // Depending on resolve() scoring — could be tier 3 (jaro-winkler) or
    // tier 4 (auto-resolve, after R1). Either way: must be FOUND. The
    // pre-R1 fallback ("alternatives include Submit Form") would be a
    // regression — auto-resolve was added precisely to stop returning null
    // when a single high-score candidate exists.
    expect(diag.elementId).not.toBeNull()
    if (diag.tier === 3) {
      expect(diag.tierName).toBe('jaro-winkler')
      expect(diag.confidence).toBeGreaterThanOrEqual(0.5)
    } else {
      expect(diag.tier).toBe(4)
      expect(diag.tierName).toBe('auto-resolve')
      expect(diag.autoResolved).toBeDefined()
      expect(diag.autoResolved!.label).toBe('Submit Form')
    }
  })

  // ── Test 9: alternatives capped at top 5 ──

  it('returns at most 5 alternatives', async () => {
    const elements = Array.from({ length: 20 }, (_, i) =>
      makeElement(`e${i}`, `Button ${i}`)
    )
    axQueryAXTree.mockResolvedValue([])
    axGetSnapshot.mockResolvedValue(elements)

    const diag = await driver.findWithDiagnostics('Nonexistent XYZ')

    expect(diag.alternatives.length).toBeLessThanOrEqual(5)
  })

  // ── Test 10: screenshot populated on tier 4 (element not found) ──

  it('populates screenshot as base64 string when element not found (tier 4)', async () => {
    const elements = [makeElement('e1', 'Submit')]
    axQueryAXTree.mockResolvedValue([])
    axGetSnapshot.mockResolvedValue(elements)

    // Mock screenshot() on the driver instance
    const fakeScreenshotBuf = Buffer.from('fake-png-data')
    vi.spyOn(driver, 'screenshot').mockResolvedValue(fakeScreenshotBuf)

    const diag = await driver.findWithDiagnostics('ZxqvWrong')

    expect(diag.tier).toBe(4)
    expect(diag.elementId).toBeNull()
    expect(diag.screenshot).toBe(fakeScreenshotBuf.toString('base64'))
  })

  // ── Test 11: no screenshot when element IS found (tier 1–3) ──

  it('does not include screenshot when element is found', async () => {
    const el = makeElement('e1', 'Submit')
    axQueryAXTree.mockResolvedValue([el])
    axGetSnapshot.mockResolvedValue([el])

    const screenshotSpy = vi.spyOn(driver, 'screenshot').mockResolvedValue(Buffer.from('fake'))

    const diag = await driver.findWithDiagnostics('Submit')

    expect(diag.elementId).toBe('e1')
    expect(diag.screenshot).toBeUndefined()
    // screenshot() should not have been called for a successful resolution
    expect(screenshotSpy).not.toHaveBeenCalled()
  })

  // ── Test 12: screenshot failure is non-fatal ──

  it('returns diagnostics without screenshot when screenshot() throws', async () => {
    const elements = [makeElement('e1', 'Submit')]
    axQueryAXTree.mockResolvedValue([])
    axGetSnapshot.mockResolvedValue(elements)

    // Mock screenshot() to throw
    vi.spyOn(driver, 'screenshot').mockRejectedValue(new Error('Page not loaded'))

    const diag = await driver.findWithDiagnostics('ZxqvWrong')

    expect(diag.tier).toBe(4)
    expect(diag.elementId).toBeNull()
    expect(diag.screenshot).toBeUndefined()
    // Should still return alternatives and totalInteractive
    expect(diag.totalInteractive).toBeGreaterThan(0)
  })

  // ── R1: tier-4 auto-resolve when top alternative is unambiguous ──

  it('auto-resolves to the top alternative when score >= 0.8 and margin >= 0.15', async () => {
    // "Sbmit" misspells "Submit"; "Cancel" is unrelated → wide margin.
    // Tier 2 (queryAXTree) mocked empty, Tier 3 (resolve) returns < 0.5 for
    // an unrelated mode, so we reach Tier 4 with high top score and wide margin.
    const elements = [
      makeElement('e1', 'Submit'),
      makeElement('e2', 'Cancel'),
    ]
    axQueryAXTree.mockResolvedValue([])
    axGetSnapshot.mockResolvedValue(elements)

    const diag = await driver.findWithDiagnostics('Sbmit')

    // If Tier 3 finds it, auto-resolve never runs — accept either outcome but
    // require we don't return "not found".
    expect(diag.elementId).not.toBeNull()
    if (diag.tier === 4) {
      expect(diag.tierName).toBe('auto-resolve')
      expect(diag.autoResolved).toBeDefined()
      expect(diag.autoResolved!.label).toBe('Submit')
      expect(diag.autoResolved!.score).toBeGreaterThanOrEqual(0.8)
      expect(diag.autoResolved!.margin).toBeGreaterThanOrEqual(0.15)
      // The auto-resolved id must point at the real "Submit" element
      expect(diag.elementId).toBe('e1')
    }
  })

  it('does NOT auto-resolve when two alternatives are close (margin < 0.15)', async () => {
    // "Submit" and "Submerge" both score very high vs "Submxt" — narrow margin.
    const elements = [
      makeElement('e1', 'Submit'),
      makeElement('e2', 'Submerge'),
    ]
    axQueryAXTree.mockResolvedValue([])
    axGetSnapshot.mockResolvedValue(elements)

    const diag = await driver.findWithDiagnostics('Submxt')

    // Verify the margin really is narrow at the data level
    const s1 = jaroWinkler('submxt', 'submit')
    const s2 = jaroWinkler('submxt', 'submerge')
    const margin = Math.abs(s1 - s2)
    expect(margin).toBeLessThan(0.15)

    // Auto-resolve must NOT have fired
    if (diag.tier === 4) {
      expect(diag.tierName).toBe('vision')
      expect(diag.autoResolved).toBeUndefined()
      expect(diag.elementId).toBeNull()
    }
  })

  it('does NOT auto-resolve when top score is below 0.8', async () => {
    // Targets that share almost nothing with available labels.
    const elements = [
      makeElement('e1', 'Zebra'),
      makeElement('e2', 'Quokka'),
    ]
    axQueryAXTree.mockResolvedValue([])
    axGetSnapshot.mockResolvedValue(elements)

    const diag = await driver.findWithDiagnostics('XYZW')

    // Top score must be below threshold for this to be a meaningful test
    const topScore = Math.max(
      jaroWinkler('xyzw', 'zebra'),
      jaroWinkler('xyzw', 'quokka'),
    )
    expect(topScore).toBeLessThan(0.8)

    expect(diag.tier).toBe(4)
    expect(diag.tierName).toBe('vision')
    expect(diag.autoResolved).toBeUndefined()
    expect(diag.elementId).toBeNull()
  })

  // ── f1: role hint must be honoured in auto-resolve ──

  it('f1: auto-resolve with { role:"button" } must not pick a link even when the link label scores higher', async () => {
    // Bug scenario: query="Sbmit", role="button".
    // Page has button(e1, "ZZZ") — totally unrelated label — and link(e2, "Submit").
    //
    // Tier 3 misses: intent "Sbmit button" scores "ZZZ"(button) too low (<0.5)
    // and "Submit"(link) also below 0.5 (no role boost for link). Falls to tier 4.
    //
    // Tier 4 WITHOUT role filter: top=Submit(link, score≈0.95), margin=0.95
    //   → auto-resolves to e2 (bug: wrong role returned).
    // Tier 4 WITH role filter (fix): pool filtered to buttons only → only ZZZ(button,score≈0)
    //   → score < 0.8 → no auto-resolve → elementId null.
    //
    // This test goes RED before the fix and GREEN after.
    const elements = [
      makeElement('e1', 'ZZZ', 'button'),
      { ...makeElement('e2', 'Submit', 'link'), actions: ['click'] },
    ]
    axQueryAXTree.mockResolvedValue([])
    axGetSnapshot.mockResolvedValue(elements)

    const diag = await driver.findWithDiagnostics('Sbmit', { role: 'button' })

    // Must never return the link when role:"button" is explicitly requested
    expect(diag.elementId).not.toBe('e2')
    if (diag.autoResolved) {
      expect(diag.autoResolved.role).toBe('button')
    }
  })

  // ── f2: single-candidate auto-resolve — destructive-label guard supersedes ──
  //
  // ORIGINAL FINDING (pre-guard): "margin === top.score when only one candidate
  // exists, so a confirm-delete modal auto-resolves on a typo". The proposed
  // margin=0 fix was rejected because it would break the non-destructive single-
  // candidate case (R1's core win).
  //
  // RESOLUTION (destructive-label guard): Instead of zeroing the margin for all
  // single-candidate cases, the guard raises the confidence bar ONLY for
  // destructive labels (DESTRUCTIVE_LABEL_PATTERN). "delt acct" scores ≈ 0.917
  // against "Delete Account" — above the normal 0.8 bar but below the
  // destructive bar (0.95) — so it is now correctly blocked.
  //
  // Non-destructive single-candidate behavior is unchanged (see Test C above).
  it('f2: single destructive candidate at score ~0.91 is blocked by the destructive-label guard', async () => {
    const elements = [
      makeElement('e1', 'Delete Account'),
    ]
    axQueryAXTree.mockResolvedValue([])
    axGetSnapshot.mockResolvedValue(elements)

    // "delt acct" scores ≈ 0.917 — above normal bar, below destructive bar.
    const topScore = jaroWinkler('delt acct', 'delete account')
    expect(topScore).toBeGreaterThanOrEqual(AUTO_RESOLVE_MIN_SCORE)
    expect(topScore).toBeLessThan(AUTO_RESOLVE_DESTRUCTIVE_MIN_SCORE)

    const diag = await driver.findWithDiagnostics('delt acct')

    // The destructive guard must block this — elementId null, no auto-resolve.
    expect(diag.elementId).toBeNull()
    expect(diag.autoResolved).toBeUndefined()
  })

  // ── f3: 'Sbmit' test must assert auto-resolve fields, not just alternatives ──

  it('f3: "Sbmit" test asserts elementId and autoResolved.label when tier 4 auto-resolves', async () => {
    const elements = [
      makeElement('e1', 'Submit'),
      makeElement('e2', 'Cancel'),
    ]
    axQueryAXTree.mockResolvedValue([])
    axGetSnapshot.mockResolvedValue(elements)

    const diag = await driver.findWithDiagnostics('Sbmit')

    // Must not return "not found"
    expect(diag.elementId).not.toBeNull()

    // Alternatives must include Submit
    const submitAlt = diag.alternatives.find(a => a.name === 'Submit')
    expect(submitAlt).toBeDefined()
    expect(submitAlt!.score).toBeGreaterThan(0.8)

    // If auto-resolved (tier 4), check resolution fields
    if (diag.tier === 4) {
      expect(diag.elementId).toBe('e1')
      expect(diag.autoResolved?.label).toBe('Submit')
    }
  })

  // ── Destructive-label guard tests ────────────────────────────────────────────
  //
  // Rationale: a typo'd query can score ~0.91 against a destructive label like
  // "Delete Account". That's above the normal 0.8 threshold, so the old code
  // would auto-click a delete button the user didn't intend to confirm.
  // The guard raises the bar to AUTO_RESOLVE_DESTRUCTIVE_MIN_SCORE (0.95) for
  // any label matching DESTRUCTIVE_LABEL_PATTERN, regardless of candidate count.

  it('destructive-guard A: single destructive candidate at ~0.91 is blocked — elementId null, alternatives populated', async () => {
    // "delt acct" vs "Delete Account" = jw ≈ 0.917 — above 0.8, below 0.95
    const topScore = jaroWinkler('delt acct', 'delete account')
    expect(topScore).toBeGreaterThanOrEqual(AUTO_RESOLVE_MIN_SCORE)   // above normal bar
    expect(topScore).toBeLessThan(AUTO_RESOLVE_DESTRUCTIVE_MIN_SCORE) // below destructive bar

    const elements = [makeElement('e1', 'Delete Account')]
    axQueryAXTree.mockResolvedValue([])
    axGetSnapshot.mockResolvedValue(elements)

    const diag = await driver.findWithDiagnostics('delt acct')

    // The dangerous case must be blocked
    expect(diag.elementId).toBeNull()
    expect(diag.autoResolved).toBeUndefined()
    // Alternatives must include the destructive candidate so the caller can surface it
    const alt = diag.alternatives.find(a => a.name === 'Delete Account')
    expect(alt).toBeDefined()
  })

  it('destructive-guard B: single destructive candidate at score >= 0.95 auto-resolves', async () => {
    // "delet account" vs "Delete Account" = jw ≈ 0.986 — above destructive bar
    const topScore = jaroWinkler('delet account', 'delete account')
    expect(topScore).toBeGreaterThanOrEqual(AUTO_RESOLVE_DESTRUCTIVE_MIN_SCORE)

    const elements = [makeElement('e1', 'Delete Account')]
    axQueryAXTree.mockResolvedValue([])
    axGetSnapshot.mockResolvedValue(elements)

    const diag = await driver.findWithDiagnostics('delet account')

    // Near-exact intent on a destructive label should still resolve
    expect(diag.elementId).not.toBeNull()
  })

  it('destructive-guard C: non-destructive single candidate at score ~0.97 still auto-resolves', async () => {
    // "sbmit form" vs "Submit Form" = jw ≈ 0.973 — well above 0.8, non-destructive
    const topScore = jaroWinkler('sbmit form', 'submit form')
    expect(topScore).toBeGreaterThanOrEqual(AUTO_RESOLVE_MIN_SCORE)

    const elements = [makeElement('e1', 'Submit Form')]
    axQueryAXTree.mockResolvedValue([])
    axGetSnapshot.mockResolvedValue(elements)

    const diag = await driver.findWithDiagnostics('sbmit form')

    // R1's win: non-destructive single-candidate auto-resolve must still work
    expect(diag.elementId).not.toBeNull()
  })

  it('destructive-guard D: destructive label among multiple candidates with wide margin is blocked', async () => {
    // "delete" vs "Delete Account" = jw ≈ 0.886, vs "Cancel" = jw ≈ 0.444 → margin ≈ 0.44
    // Normal guard: score 0.886 >= 0.8 AND margin 0.44 >= 0.15 → would auto-resolve
    // Destructive guard: 0.886 < 0.95 → must NOT auto-resolve
    const topScore = jaroWinkler('delete', 'delete account')
    const secondScore = jaroWinkler('delete', 'cancel')
    expect(topScore).toBeGreaterThanOrEqual(AUTO_RESOLVE_MIN_SCORE)
    expect(topScore - secondScore).toBeGreaterThanOrEqual(0.15) // confirm wide margin
    expect(topScore).toBeLessThan(AUTO_RESOLVE_DESTRUCTIVE_MIN_SCORE) // confirm below destructive bar

    const elements = [
      makeElement('e1', 'Delete Account'),
      makeElement('e2', 'Cancel'),
    ]
    axQueryAXTree.mockResolvedValue([])
    axGetSnapshot.mockResolvedValue(elements)

    const diag = await driver.findWithDiagnostics('delete')

    // Destructive bar applies regardless of candidate count
    expect(diag.elementId).toBeNull()
    expect(diag.autoResolved).toBeUndefined()
  })
})
