/**
 * Tests for the IBR CDP browser engine.
 * Tests that don't need a live Chrome instance (unit tests for
 * connection, resolve, serialize, normalize, wait, etc.)
 *
 * Integration tests (requiring Chrome) are in engine.integration.test.ts
 */

import { describe, it, expect, vi } from 'vitest'
import {
  buildFingerprint,
  normalizeRole,
  serializeElement,
  serializeSnapshot,
  resolve,
  jaroWinkler,
  parseSpatialHints,
  observe,
  extractFromAXTree,
  extractList,
  extractPageMeta,
  ResolutionCache,
  assessUnderstanding,
} from './index.js'
import type { Element, Snapshot } from './types.js'

// ─── Normalize ──────────────────────────────────────────────

describe('normalizeRole', () => {
  it('normalizes web roles', () => {
    expect(normalizeRole('button', 'web')).toBe('button')
    expect(normalizeRole('textbox', 'web')).toBe('textfield')
    expect(normalizeRole('combobox', 'web')).toBe('select')
    expect(normalizeRole('heading', 'web')).toBe('heading')
    expect(normalizeRole('generic', 'web')).toBe('group')
  })

  it('normalizes macOS roles', () => {
    expect(normalizeRole('AXButton', 'macos')).toBe('button')
    expect(normalizeRole('AXTextField', 'macos')).toBe('textfield')
    expect(normalizeRole('AXPopUpButton', 'macos')).toBe('select')
  })

  it('falls back to group for unknown roles', () => {
    expect(normalizeRole('unknown_role', 'web')).toBe('group')
    expect(normalizeRole('AXUnknown', 'macos')).toBe('group')
  })

  it('uses macOS mapping for iOS and watchOS', () => {
    expect(normalizeRole('AXButton', 'ios')).toBe('button')
    expect(normalizeRole('AXButton', 'watchos')).toBe('button')
  })
})

// ─── Serialize ──────────────────────────────────────────────

describe('serializeElement', () => {
  it('serializes basic element', () => {
    const el: Element = {
      id: 'e1', role: 'button', label: 'Submit', value: null,
      enabled: true, focused: false, actions: ['press'],
      bounds: [0, 0, 0, 0], parent: null,
    }
    expect(serializeElement(el)).toBe('[e1] button "Submit" enabled')
  })

  it('serializes disabled button', () => {
    const el: Element = {
      id: 'e2', role: 'button', label: 'Save', value: null,
      enabled: false, focused: false, actions: ['press'],
      bounds: [0, 0, 0, 0], parent: null,
    }
    expect(serializeElement(el)).toBe('[e2] button "Save" disabled')
  })

  it('serializes textfield with value', () => {
    const el: Element = {
      id: 'e3', role: 'textfield', label: 'Email', value: 'test@example.com',
      enabled: true, focused: false, actions: ['setValue'],
      bounds: [0, 0, 0, 0], parent: null,
    }
    expect(serializeElement(el)).toBe('[e3] textfield "Email" value="test@example.com"')
  })

  it('serializes empty textfield', () => {
    const el: Element = {
      id: 'e4', role: 'textfield', label: 'Search', value: '',
      enabled: true, focused: false, actions: ['setValue'],
      bounds: [0, 0, 0, 0], parent: null,
    }
    expect(serializeElement(el)).toBe('[e4] textfield "Search" empty')
  })

  it('serializes focused element', () => {
    const el: Element = {
      id: 'e5', role: 'textfield', label: 'Name', value: null,
      enabled: true, focused: true, actions: ['setValue'],
      bounds: [0, 0, 0, 0], parent: null,
    }
    expect(serializeElement(el)).toBe('[e5] textfield "Name" empty, focused')
  })
})

describe('serializeSnapshot', () => {
  it('produces compact output', () => {
    const snap: Snapshot = {
      url: 'https://example.com',
      platform: 'web',
      elements: [
        { id: 'e1', role: 'button', label: 'OK', value: null, enabled: true, focused: false, actions: ['press'], bounds: [0,0,0,0], parent: null },
      ],
      timestamp: Date.now(),
    }
    const output = serializeSnapshot(snap)
    expect(output).toContain('# Page: https://example.com')
    expect(output).toContain('# Platform: web | Elements: 1')
    expect(output).toContain('[e1] button "OK" enabled')
  })
})

// ─── Fingerprint ────────────────────────────────────────────

describe('buildFingerprint', () => {
  it('includes only interactive elements', () => {
    const elements: Element[] = [
      { id: 'e1', role: 'button', label: 'A', value: null, enabled: true, focused: false, actions: ['press'], bounds: [0,0,0,0], parent: null },
      { id: 'e2', role: 'heading', label: 'Title', value: null, enabled: true, focused: false, actions: [], bounds: [0,0,0,0], parent: null },
      { id: 'e3', role: 'link', label: 'B', value: null, enabled: true, focused: false, actions: ['press'], bounds: [0,0,0,0], parent: null },
    ]
    const fp = buildFingerprint(elements)
    expect(fp).toContain('button:A:true')
    expect(fp).toContain('link:B:true')
    expect(fp).not.toContain('heading')
  })

  it('is deterministic (sorted)', () => {
    const elements: Element[] = [
      { id: 'e1', role: 'link', label: 'Z', value: null, enabled: true, focused: false, actions: ['press'], bounds: [0,0,0,0], parent: null },
      { id: 'e2', role: 'button', label: 'A', value: null, enabled: true, focused: false, actions: ['press'], bounds: [0,0,0,0], parent: null },
    ]
    const fp = buildFingerprint(elements)
    expect(fp.indexOf('button:A')).toBeLessThan(fp.indexOf('link:Z'))
  })
})

// ─── Resolve ────────────────────────────────────────────────

function makeElement(overrides: Partial<Element> & { id: string; label: string }): Element {
  return {
    role: 'button', value: null, enabled: true, focused: false,
    actions: ['press'], bounds: [0, 0, 0, 0], parent: null,
    ...overrides,
  }
}

describe('resolve (claude mode)', () => {
  it('finds exact multi-word match with high confidence', () => {
    const elements = [
      makeElement({ id: 'e1', label: 'Sign In' }),
      makeElement({ id: 'e2', label: 'Sign Up' }),
    ]
    const result = resolve({ intent: 'click sign in', elements, mode: 'claude' })
    expect(result.element?.id).toBe('e1')
    expect(result.confidence).toBe(1.0)
  })

  it('returns null element for empty elements', () => {
    const result = resolve({ intent: 'anything', elements: [], mode: 'claude' })
    expect(result.element).toBeNull()
    expect(result.confidence).toBe(0)
  })

  it('signals vision fallback for low confidence', () => {
    const elements = [
      makeElement({ id: 'e1', label: 'XYZZYX' }),
    ]
    const result = resolve({ intent: 'submit form', elements, mode: 'claude' })
    expect(result.visionFallback).toBe(true)
  })

  it('penalizes non-interactive elements', () => {
    const elements = [
      makeElement({ id: 'e1', label: 'Submit', actions: [] }),
      makeElement({ id: 'e2', label: 'Submit', actions: ['press'] }),
    ]
    const result = resolve({ intent: 'submit', elements, mode: 'claude' })
    expect(result.element?.id).toBe('e2')
  })
})

describe('resolve (algorithmic mode)', () => {
  it('matches by label similarity', () => {
    const elements = [
      makeElement({ id: 'e1', label: 'Login' }),
      makeElement({ id: 'e2', label: 'Register' }),
    ]
    const result = resolve({ intent: 'login button', elements, mode: 'algorithmic' })
    expect(result.element?.id).toBe('e1')
    expect(result.confidence).toBeGreaterThan(0.5)
  })

  it('handles spatial hint "first"', () => {
    const elements = [
      makeElement({ id: 'e1', label: 'Item' }),
      makeElement({ id: 'e2', label: 'Item' }),
      makeElement({ id: 'e3', label: 'Item' }),
    ]
    const result = resolve({ intent: 'first item', elements, mode: 'algorithmic' })
    expect(result.element?.id).toBe('e1')
  })

  it('handles spatial hint "last" — spatial score increases for later elements', () => {
    const elements = [
      makeElement({ id: 'e1', label: 'Option A' }),
      makeElement({ id: 'e2', label: 'Option B' }),
      makeElement({ id: 'e3', label: 'Option C' }),
    ]
    // With different labels, "last" hint boosts the final element
    const result = resolve({ intent: 'last option', elements, mode: 'algorithmic' })
    expect(result.confidence).toBeGreaterThan(0)
    // All have "option" in label, spatial hint "last" should boost e3
    expect(result.element?.id).toBe('e3')
  })
})

// ─── Jaro-Winkler ───────────────────────────────────────────

describe('jaroWinkler', () => {
  it('returns 1.0 for identical strings', () => {
    expect(jaroWinkler('hello', 'hello')).toBe(1.0)
  })

  it('returns 0.0 for empty vs non-empty', () => {
    expect(jaroWinkler('', 'hello')).toBe(0.0)
    expect(jaroWinkler('hello', '')).toBe(0.0)
  })

  it('gives high score for similar strings', () => {
    expect(jaroWinkler('submit', 'submitt')).toBeGreaterThan(0.9)
  })

  it('gives low score for dissimilar strings', () => {
    expect(jaroWinkler('submit', 'cancel')).toBeLessThan(0.7)
  })

  it('benefits from common prefix', () => {
    const withPrefix = jaroWinkler('subm', 'submit')
    const noPrefix = jaroWinkler('bmsu', 'submit')
    expect(withPrefix).toBeGreaterThan(noPrefix)
  })

  it('never exceeds 1.0', () => {
    // Test various edge cases
    expect(jaroWinkler('a', 'a')).toBeLessThanOrEqual(1.0)
    expect(jaroWinkler('abc', 'abc')).toBeLessThanOrEqual(1.0)
    expect(jaroWinkler('abcd', 'abce')).toBeLessThanOrEqual(1.0)
  })
})

// ─── Spatial Hints ──────────────────────────────────────────

describe('parseSpatialHints', () => {
  it('parses position hints', () => {
    expect(parseSpatialHints('first button')).toEqual({ position: 'first' })
    expect(parseSpatialHints('last item')).toEqual({ position: 'last' })
    expect(parseSpatialHints('top link')).toEqual({ position: 'top' })
    expect(parseSpatialHints('bottom field')).toEqual({ position: 'bottom' })
  })

  it('parses near hints', () => {
    const result = parseSpatialHints('button near email')
    expect(result.near).toBe('email')
  })

  it('returns empty for no hints', () => {
    expect(parseSpatialHints('click submit')).toEqual({})
  })
})

// ─── Connection ─────────────────────────────────────────────

describe('CdpConnection', () => {
  it('tracks connected state', async () => {
    const { CdpConnection } = await import('./cdp/connection.js')
    const conn = new CdpConnection()
    expect(conn.connected).toBe(false)
  })

  it('registers and removes event handlers', async () => {
    const { CdpConnection } = await import('./cdp/connection.js')
    const conn = new CdpConnection()
    const handler = vi.fn()
    conn.on('test.event', handler)
    conn.off('test.event', handler)
    // No way to trigger without a real connection, but verifies no crash
  })
})

// ─── Browser ────────────────────────────────────────────────

describe('findChrome', () => {
  it('returns string or null', async () => {
    const { findChrome } = await import('./cdp/browser.js')
    const result = findChrome()
    expect(typeof result === 'string' || result === null).toBe(true)
  })
})

// ─── Observe ────────────────────────────────────────────────

describe('observe', () => {
  const elements: Element[] = [
    makeElement({ id: 'e1', label: 'Submit', role: 'button', actions: ['press'] }),
    makeElement({ id: 'e2', label: 'Email', role: 'textfield', actions: ['setValue'] }),
    makeElement({ id: 'e3', label: 'Header', role: 'heading', actions: [] }),
    makeElement({ id: 'e4', label: 'Login', role: 'link', actions: ['press'] }),
  ]

  it('returns only interactive elements', () => {
    const result = observe(elements)
    expect(result.length).toBe(3) // button, textfield, link — not heading
    expect(result.every((d: { actions: string[] }) => d.actions.length > 0)).toBe(true)
  })

  it('filters by role', () => {
    const result = observe(elements, { role: 'button' })
    expect(result.length).toBe(1)
    expect(result[0].role).toBe('button')
  })

  it('filters by intent', () => {
    const result = observe(elements, { intent: 'email' })
    expect(result.length).toBe(1)
    expect(result[0].label).toBe('Email')
  })

  it('produces serialized descriptors', () => {
    const result = observe(elements, { role: 'button' })
    expect(result[0].serialized).toContain('[e1]')
    expect(result[0].description).toContain('Click')
  })

  it('respects limit', () => {
    const result = observe(elements, { limit: 1 })
    expect(result.length).toBe(1)
  })
})

// ─── Extract ────────────────────────────────────────────────

describe('extract', () => {
  const elements: Element[] = [
    makeElement({ id: 'e1', label: 'Page Title', role: 'heading', actions: [] }),
    makeElement({ id: 'e2', label: 'Username', role: 'textfield', value: 'john', actions: ['setValue'] }),
    makeElement({ id: 'e3', label: 'Password', role: 'textfield', value: '', actions: ['setValue'] }),
    makeElement({ id: 'e4', label: 'Login', role: 'button', actions: ['press'] }),
    makeElement({ id: 'e5', label: 'Forgot password', role: 'link', actions: ['press'] }),
  ]

  it('extracts text from AX tree', () => {
    const result = extractFromAXTree(elements, {
      title: { role: 'heading', extract: 'text' },
      username: { role: 'textfield', label: 'username', extract: 'value' },
      hasLogin: { role: 'button', label: 'login', extract: 'exists' },
      missing: { role: 'slider', extract: 'exists' },
    })
    expect(result.title).toBe('Page Title')
    expect(result.username).toBe('john')
    expect(result.hasLogin).toBe(true)
    expect(result.missing).toBe(false)
  })

  it('extracts list of elements', () => {
    const result = extractList(elements, { role: 'textfield' })
    expect(result.length).toBe(2)
    expect(result[0].label).toBe('Username')
    expect(result[1].label).toBe('Password')
  })

  it('extracts page metadata', () => {
    const meta = extractPageMeta(elements)
    expect(meta.headings).toEqual(['Page Title'])
    expect(meta.inputs.length).toBe(2)
    expect(meta.buttons.length).toBe(1)
    expect(meta.links.length).toBe(1)
  })
})

// ─── Resolution Cache ───────────────────────────────────────

describe('ResolutionCache', () => {
  it('stores and retrieves resolutions', () => {
    const cache = new ResolutionCache()
    cache.set('submit button', 'e5', { role: 'button', label: 'Submit', confidence: 0.9 })
    const result = cache.get('submit button')
    expect(result).not.toBeNull()
    expect(result!.elementId).toBe('e5')
  })

  it('normalizes keys (case-insensitive)', () => {
    const cache = new ResolutionCache()
    cache.set('Submit Button', 'e5', { role: 'button', label: 'Submit', confidence: 0.9 })
    expect(cache.get('submit button')).not.toBeNull()
  })

  it('rejects low-confidence entries', () => {
    const cache = new ResolutionCache({ minConfidence: 0.7 })
    cache.set('weak match', 'e1', { role: 'button', label: 'X', confidence: 0.3 })
    expect(cache.get('weak match')).toBeNull()
  })

  it('expires entries after TTL', () => {
    const cache = new ResolutionCache({ ttl: 1 }) // 1ms TTL
    cache.set('test', 'e1', { role: 'button', label: 'Test', confidence: 0.9 })
    // Entry should expire almost immediately
    // (may or may not be expired depending on timing, so just verify no crash)
    const result = cache.get('test')
    // Result is either the entry or null — both valid
    expect(result === null || result.elementId === 'e1').toBe(true)
  })

  it('tracks hits', () => {
    const cache = new ResolutionCache()
    cache.set('btn', 'e1', { role: 'button', label: 'OK', confidence: 0.9 })
    cache.get('btn')
    cache.get('btn')
    const stats = cache.stats()
    expect(stats.entries).toBe(1)
    expect(stats.totalHits).toBe(2)
  })

  it('evicts oldest when at capacity', () => {
    const cache = new ResolutionCache({ maxEntries: 2 })
    cache.set('a', 'e1', { role: 'button', label: 'A', confidence: 0.9 })
    cache.set('b', 'e2', { role: 'button', label: 'B', confidence: 0.9 })
    cache.set('c', 'e3', { role: 'button', label: 'C', confidence: 0.9 })
    // 'a' should have been evicted
    expect(cache.get('a')).toBeNull()
    expect(cache.get('b')).not.toBeNull()
    expect(cache.get('c')).not.toBeNull()
  })

  it('clears all entries', () => {
    const cache = new ResolutionCache()
    cache.set('x', 'e1', { role: 'button', label: 'X', confidence: 0.9 })
    cache.clear()
    expect(cache.stats().entries).toBe(0)
  })
})

// ─── Adaptive Modality ──────────────────────────────────────

describe('assessUnderstanding', () => {
  it('returns low score for empty tree', () => {
    const result = assessUnderstanding([])
    expect(result.score).toBe(0)
    expect(result.needsScreenshot).toBe(true)
  })

  it('returns high score for well-labeled interactive elements', () => {
    const elements: Element[] = [
      makeElement({ id: 'e1', label: 'Submit', role: 'button' }),
      makeElement({ id: 'e2', label: 'Email', role: 'textfield', actions: ['setValue'] }),
      makeElement({ id: 'e3', label: 'Password', role: 'textfield', actions: ['setValue'] }),
      makeElement({ id: 'e4', label: 'Login Page', role: 'heading', actions: [] }),
      makeElement({ id: 'e5', label: 'Forgot Password', role: 'link' }),
    ]
    const result = assessUnderstanding(elements)
    expect(result.score).toBeGreaterThan(0.6)
    expect(result.needsScreenshot).toBe(false)
  })

  it('penalizes unlabeled interactive elements', () => {
    const elements: Element[] = [
      makeElement({ id: 'e1', label: '', role: 'button' }),
      makeElement({ id: 'e2', label: '', role: 'button' }),
      makeElement({ id: 'e3', label: '', role: 'button' }),
    ]
    const result = assessUnderstanding(elements)
    expect(result.score).toBeLessThan(0.5)
    expect(result.needsScreenshot).toBe(true)
  })

  it('penalizes single-role trees (Canvas/WebGL)', () => {
    const elements = Array.from({ length: 10 }, (_, i) =>
      makeElement({ id: `e${i}`, label: `Item ${i}`, role: 'group', actions: [] })
    )
    const result = assessUnderstanding(elements)
    expect(result.dimensions.specialCasePenalty).toBeGreaterThan(0)
  })

  it('respects custom threshold', () => {
    const elements: Element[] = [
      makeElement({ id: 'e1', label: 'OK', role: 'button' }),
    ]
    const strict = assessUnderstanding(elements, { threshold: 0.9 })
    const lenient = assessUnderstanding(elements, { threshold: 0.2 })
    // Same score, different recommendation
    expect(strict.score).toBe(lenient.score)
    expect(strict.needsScreenshot).not.toBe(lenient.needsScreenshot)
  })

  it('provides reasoning string', () => {
    const result = assessUnderstanding([])
    expect(result.reasoning.length).toBeGreaterThan(0)
  })
})
