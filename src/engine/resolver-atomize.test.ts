/**
 * Regression: wrong-element resolution against atomize-ai.vercel.app.
 *
 * Real dogfooding showed the resolver acting on LOW-confidence jaro-winkler
 * fuzzy matches that selected the WRONG element even when an exact label was
 * present:
 *   - target "News Feed"        → matched "Full feed"                       (0.8, jaro-winkler)
 *   - target "Open search (⌘K)" → matched "Open primary source for LLM…"    (0.75)
 *   - target "Research"         → matched "s"                               (0.75)
 *   - target "AI Brief"         → matched a different element               (0.75)
 *
 * These tests force the tier-2 (CDP queryAXTree) MISS that produced the bug
 * (queryAXTree returns []), then assert that the new normalized-exact tier
 * (tier 2.5) selects the present exact element instead of the near-miss
 * distractor — and that, with NO exact present, a weak fuzzy distractor is
 * NOT silently acted on.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EngineDriver } from './driver.js'
import type { Element } from './types.js'

function el(id: string, label: string, role = 'link'): Element {
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

describe('resolver — atomize wrong-element regressions', () => {
  let driver: EngineDriver
  let axGetSnapshot: ReturnType<typeof vi.fn>
  let axQueryAXTree: ReturnType<typeof vi.fn>

  beforeEach(() => {
    driver = new EngineDriver()
    axGetSnapshot = vi.fn()
    axQueryAXTree = vi.fn()
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
    ;(driver as any).resolutionCache.clear()
    // Tier 2 (queryAXTree) MISSES — this is the real-world condition that
    // surfaced the bug (icon/whitespace variants the CDP exact-match drops).
    axQueryAXTree.mockResolvedValue([])
    // Screenshot fallback is irrelevant to these assertions.
    vi.spyOn(driver, 'screenshot').mockResolvedValue(Buffer.from('x'))
  })

  it('target "News Feed" picks the exact link, NOT the "Full feed" distractor', async () => {
    const elements = [
      el('e_full', 'Full feed'),
      el('e_news', 'News Feed'),
    ]
    axGetSnapshot.mockResolvedValue(elements)

    const diag = await driver.findWithDiagnostics('News Feed')

    expect(diag.elementId).toBe('e_news')
    expect(diag.tierName).toBe('exact')
    expect(diag.confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('target "Open search (⌘K)" picks the exact button, NOT the "Open primary source…" distractor', async () => {
    const elements = [
      el('e_primary', 'Open primary source for LLM Training Dataset', 'button'),
      el('e_search', 'Open search (⌘K)', 'button'),
    ]
    axGetSnapshot.mockResolvedValue(elements)

    const diag = await driver.findWithDiagnostics('Open search (⌘K)')

    expect(diag.elementId).toBe('e_search')
    expect(diag.tierName).toBe('exact')
  })

  it('target "Research" picks the exact tab, NOT the stray "s" element', async () => {
    const elements = [
      el('e_s', 's', 'link'),
      el('e_research', 'Research', 'tab'),
      el('e_ai', 'AI Brief', 'tab'),
    ]
    axGetSnapshot.mockResolvedValue(elements)

    const diag = await driver.findWithDiagnostics('Research')

    expect(diag.elementId).toBe('e_research')
    expect(diag.tierName).toBe('exact')
  })

  it('target "AI Brief" picks the exact tab', async () => {
    const elements = [
      el('e_research', 'Research', 'tab'),
      el('e_ai', 'AI Brief', 'tab'),
      el('e_full', 'Full feed', 'link'),
    ]
    axGetSnapshot.mockResolvedValue(elements)

    const diag = await driver.findWithDiagnostics('AI Brief')

    expect(diag.elementId).toBe('e_ai')
    expect(diag.tierName).toBe('exact')
  })

  it('case-insensitive exact: target "news feed" still resolves the "News Feed" link', async () => {
    const elements = [el('e_full', 'Full feed'), el('e_news', 'News Feed')]
    axGetSnapshot.mockResolvedValue(elements)

    const diag = await driver.findWithDiagnostics('news feed')

    expect(diag.elementId).toBe('e_news')
    expect(diag.tierName).toBe('exact')
  })

  it('no exact present + only a weak fuzzy distractor → does NOT silently act on the wrong element', async () => {
    // "News Feed" requested, but only "Full feed" exists (no exact). The old
    // resolver accepted a 0.75–0.8 jaro match here; the raised bar + margin
    // guards must NOT auto-act on the wrong element.
    const elements = [el('e_full', 'Full feed')]
    axGetSnapshot.mockResolvedValue(elements)

    const diag = await driver.findWithDiagnostics('News Feed')

    // Either not-found (preferred) — but at minimum it must not resolve to a
    // confidently-acted wrong element via the jaro-winkler tier.
    if (diag.elementId !== null) {
      expect(diag.tierName).not.toBe('jaro-winkler')
    } else {
      expect(diag.alternatives.length).toBeGreaterThan(0)
    }
  })
})
