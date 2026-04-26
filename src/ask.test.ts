/**
 * Unit tests for src/ask.ts — the v3 verdict-engine surface.
 *
 * Tests use synthetic EnhancedElement fixtures via `preScannedElements` so
 * they run without spinning up a CDP browser.
 */

import { describe, it, expect } from 'vitest'
import { ask, askStream, _internal, type AskResponse, type AskStreamEvent } from './ask.js'
import type { EnhancedElement } from './schemas.js'

const URL = 'http://test.local/'

function el(over: Partial<EnhancedElement> = {}): EnhancedElement {
  return {
    selector: 'button.cta',
    tagName: 'button',
    text: 'Click',
    bounds: { x: 0, y: 0, width: 100, height: 50 },
    interactive: {
      hasOnClick: true,
      hasHref: false,
      isDisabled: false,
      tabIndex: 0,
      cursor: 'pointer',
    },
    a11y: { role: 'button', ariaLabel: null, ariaDescribedBy: null },
    ...over,
  } as EnhancedElement
}

// ── Question routing ──────────────────────────────────────────────────────────

describe('matchQuestion', () => {
  it('matches canonical phrasing exactly', () => {
    const m = _internal.matchQuestion('is the touch-target compliant')
    expect(m?.canonical).toBe('is the touch-target compliant')
  })

  it('matches via alias regex', () => {
    expect(_internal.matchQuestion('check tap target sizes')?.canonical).toBe(
      'is the touch-target compliant',
    )
    expect(_internal.matchQuestion('do badges follow signal/noise')?.canonical).toBe(
      'do status indicators follow signal-to-noise',
    )
    expect(_internal.matchQuestion('check token compliance')?.canonical).toBe(
      'is design-system token compliance okay',
    )
  })

  it('returns null for unsupported questions', () => {
    expect(_internal.matchQuestion('how does the user feel')).toBeNull()
    expect(_internal.matchQuestion('what is the page intent')).toBeNull()
  })
})

// ── ask() verdict + finding behaviour ─────────────────────────────────────────

describe('ask: unsupported question', () => {
  it('returns UNCERTAIN with the supported list', async () => {
    const r = await ask(URL, 'what colour is the sky', { preScannedElements: [] })
    expect(r.verdict).toBe('UNCERTAIN')
    expect(r.findings).toHaveLength(1)
    expect(r.findings[0]?.rule).toBe('ask/unsupported-question')
    expect(r.meta.supportedQuestions).toEqual(_internal.SUPPORTED_QUESTIONS)
    expect(r.meta.rulesRun).toEqual([])
  })
})

describe('ask: touch-target', () => {
  it('PASS when no interactive elements are undersized', async () => {
    const r = await ask(URL, 'is the touch-target compliant', {
      preScannedElements: [el({ bounds: { x: 0, y: 0, width: 64, height: 64 } })],
      viewportMetrics: { width: 1280, height: 800 },
    })
    expect(r.verdict).toBe('PASS')
    expect(r.findings).toHaveLength(0)
    expect(r.meta.rulesRun.length).toBeGreaterThan(0)
  })

  it('WARN with finding when an interactive element is below mobile minimum', async () => {
    const r = await ask(URL, 'is the touch-target compliant', {
      preScannedElements: [
        el({ bounds: { x: 0, y: 0, width: 30, height: 30 }, text: 'Tiny' }),
      ],
      viewportMetrics: { width: 360, height: 800 }, // mobile
    })
    expect(r.verdict).toBe('WARN')
    expect(r.findings.length).toBeGreaterThan(0)
    const f = r.findings[0]!
    expect(f.rule).toBe('touch-targets/minimum-size')
    expect(f.summary).toMatch(/Tiny/)
    expect(f.evidence?.bounds).toEqual({ x: 0, y: 0, width: 30, height: 30 })
    expect(f.fix).toMatch(/Increase element size/)
  })

  // Regression test for A1: the rule's "on mobile/desktop" copy must reflect
  // the actual viewport classification (isMobile = width < 768).
  it('classifies as mobile and uses 44px minimum when viewportMetrics width < 768', async () => {
    const r = await ask(URL, 'is the touch-target compliant', {
      preScannedElements: [
        el({ bounds: { x: 0, y: 0, width: 30, height: 30 }, text: 'Tiny' }),
      ],
      viewportMetrics: { width: 360, height: 800 },
    })
    expect(r.findings[0]?.summary).toMatch(/on mobile/)
    expect(r.findings[0]?.summary).toMatch(/minimum 44x44px/)
  })

  it('classifies as desktop and uses 24px minimum when viewportMetrics width >= 768', async () => {
    const r = await ask(URL, 'is the touch-target compliant', {
      preScannedElements: [
        el({ bounds: { x: 0, y: 0, width: 20, height: 20 }, text: 'TinyDesk' }),
      ],
      viewportMetrics: { width: 1280, height: 800 },
    })
    expect(r.findings[0]?.summary).toMatch(/on desktop/)
    expect(r.findings[0]?.summary).toMatch(/minimum 24x24px/)
  })

  it('caps findings at maxFindings and sets truncated=true', async () => {
    const tiny = (i: number) =>
      el({
        selector: `.btn-${i}`,
        text: `Tiny ${i}`,
        bounds: { x: 0, y: 0, width: 20, height: 20 },
      })
    const r = await ask(URL, 'is the touch-target compliant', {
      preScannedElements: Array.from({ length: 5 }, (_, i) => tiny(i)),
      viewportMetrics: { width: 360, height: 800 },
      maxFindings: 2,
    })
    expect(r.findings).toHaveLength(2)
    expect(r.truncated).toBe(true)
  })
})

describe('ask: signal-noise', () => {
  it('FAIL when a status word has a heavy background', async () => {
    const status = el({
      selector: '.badge',
      text: 'Success',
      tagName: 'span',
      computedStyles: { backgroundColor: 'rgb(34, 197, 94)' },
      interactive: { hasOnClick: false, hasHref: false, isDisabled: false, tabIndex: -1, cursor: 'default' },
    })
    const r = await ask(URL, 'do status indicators follow signal-to-noise', {
      preScannedElements: [status],
    })
    expect(r.verdict).toBe('FAIL')
    expect(r.findings[0]?.rule).toBe('calm-precision/signal-noise-status')
    expect(r.findings[0]?.fix).toMatch(/Remove background color/)
  })

  it('PASS when status text uses no background', async () => {
    const status = el({
      selector: '.badge',
      text: 'Success',
      tagName: 'span',
      computedStyles: { backgroundColor: 'transparent' },
      interactive: { hasOnClick: false, hasHref: false, isDisabled: false, tabIndex: -1, cursor: 'default' },
    })
    const r = await ask(URL, 'do status indicators follow signal-to-noise', {
      preScannedElements: [status],
    })
    expect(r.verdict).toBe('PASS')
    expect(r.findings).toHaveLength(0)
  })
})

describe('ask: token-compliance without config', () => {
  it('returns UNCERTAIN with no-config finding', async () => {
    const r: AskResponse = await ask(URL, 'is design-system token compliance okay', {
      preScannedElements: [el()],
      // Use a directory with no design-system.json so loadDesignSystemConfig returns undefined.
      projectDir: '/tmp/ibr-no-design-system-' + Date.now(),
    })
    expect(r.verdict).toBe('UNCERTAIN')
    expect(r.findings[0]?.rule).toBe('tokens/no-config')
  })
})

describe('ask: response shape', () => {
  it('includes engineVersion and durationMs in meta', async () => {
    const r = await ask(URL, 'is the touch-target compliant', {
      preScannedElements: [el()],
      viewportMetrics: { width: 1280, height: 800 },
    })
    expect(r.meta.engineVersion).toMatch(/^0\.\d+\.\d+/)
    expect(typeof r.meta.durationMs).toBe('number')
    expect(r.meta.durationMs).toBeGreaterThanOrEqual(0)
  })
})

// ── B1: NDJSON streaming ──────────────────────────────────────────────────────

describe('askStream', () => {
  async function collect(gen: AsyncGenerator<AskStreamEvent, void, void>) {
    const events: AskStreamEvent[] = []
    for await (const e of gen) events.push(e)
    return events
  }

  it('emits start → finding* → end in order', async () => {
    const events = await collect(
      askStream(URL, 'is the touch-target compliant', {
        preScannedElements: [
          el({ bounds: { x: 0, y: 0, width: 20, height: 20 }, text: 'TooSmall' }),
        ],
        viewportMetrics: { width: 1280, height: 800 },
      }),
    )
    expect(events[0]?.type).toBe('start')
    expect(events.at(-1)?.type).toBe('end')
    expect(events.filter((e) => e.type === 'finding').length).toBeGreaterThan(0)
  })

  it('end event aggregates verdict and totals', async () => {
    const events = await collect(
      askStream(URL, 'is the touch-target compliant', {
        preScannedElements: [
          el({ bounds: { x: 0, y: 0, width: 20, height: 20 }, text: 'A' }),
          el({ bounds: { x: 0, y: 0, width: 20, height: 20 }, text: 'B' }),
        ],
        viewportMetrics: { width: 1280, height: 800 },
      }),
    )
    const end = events.at(-1)
    expect(end?.type).toBe('end')
    if (end?.type !== 'end') throw new Error('expected end')
    expect(end.verdict).toBe('WARN')
    expect(end.totalFindings).toBe(2)
    expect(end.elementsScanned).toBe(2)
    expect(end.truncated).toBe(false)
  })

  it('end.truncated reflects the cap', async () => {
    const tiny = (i: number) =>
      el({ selector: `.b-${i}`, text: `T${i}`, bounds: { x: 0, y: 0, width: 20, height: 20 } })
    const events = await collect(
      askStream(URL, 'is the touch-target compliant', {
        preScannedElements: Array.from({ length: 5 }, (_, i) => tiny(i)),
        viewportMetrics: { width: 360, height: 800 },
        maxFindings: 2,
      }),
    )
    const findings = events.filter((e) => e.type === 'finding')
    expect(findings).toHaveLength(2)
    const end = events.at(-1)
    if (end?.type !== 'end') throw new Error('expected end')
    expect(end.truncated).toBe(true)
  })

  it('first finding arrives in < 100ms on pre-scanned fixture', async () => {
    const tiny = (i: number) =>
      el({ selector: `.b-${i}`, text: `T${i}`, bounds: { x: 0, y: 0, width: 20, height: 20 } })
    const start = Date.now()
    const gen = askStream(URL, 'is the touch-target compliant', {
      preScannedElements: Array.from({ length: 100 }, (_, i) => tiny(i)),
      viewportMetrics: { width: 360, height: 800 },
    })
    let firstFindingAt: number | null = null
    for await (const e of gen) {
      if (e.type === 'finding' && firstFindingAt === null) {
        firstFindingAt = Date.now() - start
      }
      if (firstFindingAt !== null && e.type === 'finding') break
    }
    expect(firstFindingAt).not.toBeNull()
    // Pre-scanned (no CDP) — well under the 500ms budget the thesis specified.
    expect(firstFindingAt!).toBeLessThan(100)
  })

  it('unsupported question yields a single UNCERTAIN finding then end', async () => {
    const events = await collect(
      askStream(URL, 'what colour is the sky', { preScannedElements: [] }),
    )
    expect(events.map((e) => e.type)).toEqual(['start', 'finding', 'end'])
    const start = events[0]
    if (start?.type !== 'start') throw new Error('expected start')
    expect(start.supportedQuestions).toEqual(_internal.SUPPORTED_QUESTIONS)
  })
})
