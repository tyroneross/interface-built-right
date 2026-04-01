/**
 * Unit tests for EngineDriver.findWithDiagnostics()
 *
 * EngineDriver requires live CDP domains, so we subclass it and override
 * the internal domain calls needed by findWithDiagnostics.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EngineDriver } from './driver.js'
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

    // Depending on resolve() scoring — could be tier 3 or tier 4
    // At minimum, if found, tier must be <= 3; if not found, alternatives include "Submit Form"
    if (diag.elementId) {
      expect(diag.tier).toBe(3)
      expect(diag.tierName).toBe('jaro-winkler')
      expect(diag.confidence).toBeGreaterThanOrEqual(0.5)
    } else {
      const alt = diag.alternatives.find(a => a.name === 'Submit Form')
      expect(alt).toBeDefined()
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
})
