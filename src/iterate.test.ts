/**
 * Tests for iterate.ts — Fix 3 (post-resolve verification) and Fix 5 (structured fix suggestions)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { analyzeIssues, classifyIssue, iterate } from './iterate.js'
import type { IterationState, IterateOptions } from './iterate.js'
import type { ScanIssue } from './scan.js'
import { mkdir, rm } from 'fs/promises'
import { join } from 'path'
import os from 'os'

// ─── classifyIssue ────────────────────────────────────────

describe('classifyIssue', () => {
  it('classifies spacing issues', () => {
    expect(classifyIssue({ description: 'margin is too large' })).toBe('spacing')
    expect(classifyIssue({ description: 'padding missing on container' })).toBe('spacing')
    expect(classifyIssue({ description: 'gap between items too small' })).toBe('spacing')
  })

  it('classifies color issues', () => {
    expect(classifyIssue({ description: 'color contrast ratio insufficient' })).toBe('color')
    expect(classifyIssue({ description: 'background is incorrect hue' })).toBe('color')
    expect(classifyIssue({ description: 'foreground text not visible' })).toBe('color')
  })

  it('classifies typography issues', () => {
    expect(classifyIssue({ description: 'font-size too small for readability' })).toBe('typography')
    expect(classifyIssue({ description: 'line-height is compressed' })).toBe('typography')
    expect(classifyIssue({ description: 'typography mismatch in heading' })).toBe('typography')
  })

  it('classifies accessibility issues', () => {
    expect(classifyIssue({ description: 'aria-label missing on button' })).toBe('accessibility')
    expect(classifyIssue({ description: 'role not set for interactive element' })).toBe('accessibility')
    expect(classifyIssue({ description: 'tab-index prevents keyboard focus' })).toBe('accessibility')
    expect(classifyIssue({ description: 'screen reader cannot parse this' })).toBe('accessibility')
  })

  it('classifies interactivity issues', () => {
    expect(classifyIssue({ description: 'click handler missing on button' })).toBe('interactivity')
    expect(classifyIssue({ description: 'event not firing on focus' })).toBe('interactivity')
    expect(classifyIssue({ description: 'disabled state not implemented' })).toBe('interactivity')
  })

  it('classifies layout issues', () => {
    expect(classifyIssue({ description: 'flex container broken' })).toBe('layout')
    expect(classifyIssue({ description: 'z-index stacking incorrect' })).toBe('layout')
    expect(classifyIssue({ description: 'overflow hidden clips content' })).toBe('layout')
  })

  it('classifies visibility issues', () => {
    expect(classifyIssue({ description: 'element is hidden when it should not be' })).toBe('visibility')
    expect(classifyIssue({ description: 'opacity:0 makes element invisible' })).toBe('visibility')
    expect(classifyIssue({ description: 'display:none applied incorrectly' })).toBe('visibility')
  })

  it('classifies size issues', () => {
    expect(classifyIssue({ description: 'width too narrow on mobile' })).toBe('size')
    expect(classifyIssue({ description: 'height must be constrained with max' })).toBe('size')
    expect(classifyIssue({ description: 'min-size not respected' })).toBe('size')
  })

  it('falls back to other for unrecognized text', () => {
    expect(classifyIssue({ description: 'some unknown rendering problem' })).toBe('other')
    expect(classifyIssue({ description: '' })).toBe('other')
    expect(classifyIssue({})).toBe('other')
  })

  it('uses message field as fallback when description is absent', () => {
    expect(classifyIssue({ message: 'padding is inconsistent' })).toBe('spacing')
  })
})

// ─── analyzeIssues ────────────────────────────────────────

function makeIssue(description: string, category?: ScanIssue['category']): ScanIssue {
  return {
    category: category ?? 'structure',
    severity: 'warning',
    description,
  }
}

function makeIteration(overrides: Partial<IterationState> & { issues?: ScanIssue[] }): IterationState {
  return {
    iteration: 1,
    scanHash: 'abc',
    issueCount: overrides.issues?.length ?? 0,
    netDelta: 0,
    approachHint: '',
    durationMs: 10,
    converged: false,
    ...overrides,
  }
}

describe('analyzeIssues', () => {
  it('returns empty analysis when no iterations', () => {
    const result = analyzeIssues([])
    expect(result.repeatedCategories).toEqual([])
    expect(result.suggestedApproaches).toEqual([])
    expect(result.shouldEscalate).toBe(false)
    expect(result.affectedElements).toEqual([])
  })

  it('returns empty analysis when latest iteration has no issues', () => {
    const iter = makeIteration({ issues: [] })
    const result = analyzeIssues([iter])
    expect(result.repeatedCategories).toEqual([])
  })

  it('groups issues by category from description text', () => {
    const iter = makeIteration({
      issues: [
        makeIssue('margin is too large'),
        makeIssue('padding missing'),
        makeIssue('color contrast failure'),
      ],
    })
    const result = analyzeIssues([iter])
    // spacing should appear (2 issues), color should appear (1 issue)
    // but repeatedCategories only includes those in 2+ iterations
    expect(result.affectedElements).toHaveLength(3)
  })

  it('identifies repeated categories across 2+ iterations', () => {
    const iter1 = makeIteration({
      iteration: 1,
      issues: [makeIssue('margin is off'), makeIssue('color contrast wrong')],
    })
    const iter2 = makeIteration({
      iteration: 2,
      issues: [makeIssue('padding is missing'), makeIssue('color not accessible')],
    })
    const result = analyzeIssues([iter1, iter2])
    expect(result.repeatedCategories).toContain('spacing')
    expect(result.repeatedCategories).toContain('color')
  })

  it('does not include categories that appeared only once', () => {
    const iter1 = makeIteration({
      iteration: 1,
      issues: [makeIssue('aria-label missing')],
    })
    const iter2 = makeIteration({
      iteration: 2,
      issues: [makeIssue('color contrast wrong')],  // different category
    })
    const result = analyzeIssues([iter1, iter2])
    expect(result.repeatedCategories).not.toContain('accessibility')
    expect(result.repeatedCategories).not.toContain('color')
  })

  it('includes approach suggestions for repeated categories', () => {
    const iter1 = makeIteration({
      iteration: 1,
      issues: [makeIssue('margin is off')],
    })
    const iter2 = makeIteration({
      iteration: 2,
      issues: [makeIssue('padding is missing')],
    })
    const result = analyzeIssues([iter1, iter2])
    expect(result.suggestedApproaches.length).toBeGreaterThan(0)
    // spacing approach mentions CSS
    expect(result.suggestedApproaches.some(s => s.includes('CSS'))).toBe(true)
  })

  it('sets shouldEscalate=false with repeated categories but fewer than 3 iterations', () => {
    const iter1 = makeIteration({ iteration: 1, issues: [makeIssue('margin off')] })
    const iter2 = makeIteration({ iteration: 2, issues: [makeIssue('padding off')] })
    const result = analyzeIssues([iter1, iter2])
    expect(result.repeatedCategories).toContain('spacing')
    expect(result.shouldEscalate).toBe(false)
  })

  it('sets shouldEscalate=true with repeated categories after 3+ iterations', () => {
    const iter1 = makeIteration({ iteration: 1, issues: [makeIssue('margin off')] })
    const iter2 = makeIteration({ iteration: 2, issues: [makeIssue('padding off')] })
    const iter3 = makeIteration({ iteration: 3, issues: [makeIssue('gap off')] })
    const result = analyzeIssues([iter1, iter2, iter3])
    expect(result.shouldEscalate).toBe(true)
    expect(result.escalationReason).toMatch(/spacing/)
    expect(result.escalationReason).toMatch(/3 iterations/)
  })

  it('caps affectedElements at 20 even with more issues', () => {
    const manyIssues = Array.from({ length: 50 }, (_, i) => makeIssue(`issue ${i}`))
    const iter = makeIteration({ issues: manyIssues })
    const result = analyzeIssues([iter])
    expect(result.affectedElements).toHaveLength(20)
  })

  it('includes element id when issue has element field', () => {
    const iter = makeIteration({
      issues: [{
        category: 'accessibility',
        severity: 'error',
        description: 'aria-label missing',
        element: '#submit-button',
      }],
    })
    const result = analyzeIssues([iter])
    expect(result.affectedElements[0].id).toBe('#submit-button')
    expect(result.affectedElements[0].issue).toBe('aria-label missing')
  })
})

// ─── iterate() — Fix 3: Post-Resolve Verification ────────

describe('iterate() — post-resolve verification', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = join(os.tmpdir(), `ibr-iterate-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await mkdir(tmpDir, { recursive: true })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns false_positive when first scan returns 0 but verification finds issues', async () => {
    let callCount = 0
    vi.doMock('./scan.js', () => ({
      scan: vi.fn(async () => {
        callCount++
        if (callCount === 1) {
          // First scan in the primary iteration — non-zero to set up prior state
          return makeScanResult(2)
        }
        if (callCount === 2) {
          // Second scan (next iteration primary) — claims 0
          return makeScanResult(0)
        }
        // Third scan (verification pass) — finds issues
        return makeScanResult(3)
      }),
    }))

    const { iterate: iterateFn } = await import('./iterate.js?v=fp-' + Date.now())
    const options: IterateOptions = { url: 'http://localhost:3000', outputDir: tmpDir, autoApprove: true }

    // Run iteration 1 to establish prior state
    await iterateFn(options)
    // Run iteration 2 — scan returns 0, verification returns 3
    const result = await iterateFn(options)

    expect(result.finalState).toBe('false_positive')
    expect(result.verificationPassed).toBe(false)
    vi.doUnmock('./scan.js')
  })

  it('returns resolved with verificationPassed=true when both scans return 0', async () => {
    let callCount = 0
    vi.doMock('./scan.js', () => ({
      scan: vi.fn(async () => {
        callCount++
        if (callCount === 1) {
          return makeScanResult(2)
        }
        // All subsequent (primary + verify) return 0
        return makeScanResult(0)
      }),
    }))

    const { iterate: iterateFn } = await import('./iterate.js?v=vp-' + Date.now())
    const options: IterateOptions = { url: 'http://localhost:3001', outputDir: tmpDir, autoApprove: true }

    await iterateFn(options)
    const result = await iterateFn(options)

    expect(result.finalState).toBe('resolved')
    expect(result.verificationPassed).toBe(true)
    vi.doUnmock('./scan.js')
  })
})

// ─── Helpers ──────────────────────────────────────────────

function makeScanResult(issueCount: number) {
  const issues: ScanIssue[] = Array.from({ length: issueCount }, (_, i) => ({
    category: 'structure' as const,
    severity: 'warning' as const,
    description: `Issue ${i + 1}`,
  }))
  return {
    url: 'http://localhost:3000',
    route: '/',
    timestamp: new Date().toISOString(),
    viewport: { width: 1280, height: 720, name: 'desktop' },
    elements: { all: [], audit: { total: 0, passed: 0, failed: 0, warnings: 0 } },
    interactivity: { buttons: [], links: [], forms: [], issues: [] },
    semantic: { intent: 'unknown', states: [], landmarks: [] },
    console: { errors: [], warnings: [] },
    verdict: (issueCount === 0 ? 'PASS' : 'ISSUES') as 'PASS' | 'ISSUES' | 'FAIL',
    issues,
    summary: `${issueCount} issues`,
  }
}
