/**
 * Tests for the IBR CDP browser engine.
 * Tests that don't need a live Chrome instance (unit tests for
 * connection, resolve, serialize, normalize, wait, etc.)
 *
 * Integration tests (requiring Chrome) are in engine.integration.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildFingerprint,
  normalizeRole,
  serializeElement,
  serializeSnapshot,
  resolve,
  jaroWinkler,
  parseSpatialHints,
} from './index.js'
import type { Element, Snapshot, ResolveOptions } from './types.js'

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
