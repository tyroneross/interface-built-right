/**
 * Tests for AX tree compression (token-efficient LLM context).
 */

import { describe, it, expect } from 'vitest'
import { compressSnapshot, formatCompressed } from './compress.js'

// ─── Helpers ────────────────────────────────────────────────

function makeElements(
  counts: Array<{ role: string; n: number; actions?: string[] }>
) {
  const out: Array<{ id: string; role: string; label: string; actions: string[] }> = []
  let idx = 0
  for (const { role, n, actions = [] } of counts) {
    for (let i = 0; i < n; i++) {
      out.push({ id: `el-${idx++}`, role, label: `${role} ${i}`, actions })
    }
  }
  return out
}

// ─── Below threshold ────────────────────────────────────────

describe('compressSnapshot — below threshold', () => {
  it('returns compressed=false with all elements in interactive', () => {
    const elements = makeElements([{ role: 'button', n: 30, actions: ['click'] }, { role: 'text', n: 20 }])
    expect(elements).toHaveLength(50)

    const result = compressSnapshot(elements)

    expect(result.compressed).toBe(false)
    expect(result.interactive).toHaveLength(50)
    expect(result.totalElements).toBe(50)
    expect(result.interactiveCount).toBe(50)
    expect(result.collapsed).toEqual({})
  })
})

// ─── Above threshold ────────────────────────────────────────

describe('compressSnapshot — above threshold', () => {
  it('compresses 120 elements (30 buttons + 90 text)', () => {
    const elements = makeElements([
      { role: 'button', n: 30, actions: ['click'] },
      { role: 'text', n: 90 },
    ])
    expect(elements).toHaveLength(120)

    const result = compressSnapshot(elements)

    expect(result.compressed).toBe(true)
    expect(result.totalElements).toBe(120)
    expect(result.interactiveCount).toBe(30)
    expect(result.interactive).toHaveLength(30)
    expect(result.collapsed).toEqual({ text: 90 })
  })
})

// ─── Interactive role detection ──────────────────────────────

describe('compressSnapshot — interactive role detection', () => {
  const interactiveRoles = ['button', 'link', 'textbox', 'checkbox', 'tab', 'menuitem', 'select', 'slider', 'switch']

  it.each(interactiveRoles)('keeps role="%s" as interactive', role => {
    // 81 elements: 1 of the interactive role + 80 filler text (to exceed threshold)
    const elements = [
      { id: 'el-0', role, label: 'Target', actions: [] },
      ...makeElements([{ role: 'text', n: 80 }]),
    ]
    expect(elements).toHaveLength(81)

    const result = compressSnapshot(elements)

    expect(result.compressed).toBe(true)
    const kept = result.interactive.find(e => e.id === 'el-0')
    expect(kept).toBeDefined()
    expect(kept!.role).toBe(role)
  })
})

// ─── Non-interactive roles collapsed ────────────────────────

describe('compressSnapshot — non-interactive roles collapsed', () => {
  it('collapses group, text, separator, image, region', () => {
    const nonInteractive = ['group', 'text', 'separator', 'image', 'region']
    const elements = nonInteractive.map((role, i) => ({
      id: `el-${i}`,
      role,
      label: `${role} item`,
      actions: [],
    }))
    // Pad to exceed threshold of 80
    const padded = [...elements, ...makeElements([{ role: 'button', n: 76, actions: ['click'] }])]
    expect(padded.length).toBeGreaterThan(80)

    const result = compressSnapshot(padded)

    expect(result.compressed).toBe(true)
    for (const role of nonInteractive) {
      expect(result.collapsed[role]).toBe(1)
    }
  })
})

// ─── Format uncompressed ────────────────────────────────────

describe('formatCompressed — uncompressed', () => {
  it('formats each element on its own line', () => {
    const elements = [
      { id: 'a1', role: 'button', label: 'Submit', actions: ['click'] },
      { id: 'a2', role: 'link', label: 'Home', actions: ['click'] },
      { id: 'a3', role: 'text', label: 'Hello', actions: [] },
    ]
    const snapshot = compressSnapshot(elements, 80) // 3 < 80, no compression
    expect(snapshot.compressed).toBe(false)

    const formatted = formatCompressed(snapshot)
    const lines = formatted.split('\n')

    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe('[a1] button "Submit" actions:[click]')
    expect(lines[1]).toBe('[a2] link "Home" actions:[click]')
    expect(lines[2]).toBe('[a3] text "Hello"')
  })
})

// ─── Format compressed ──────────────────────────────────────

describe('formatCompressed — compressed', () => {
  it('includes header with counts, interactive elements, collapsed summary', () => {
    const elements = makeElements([
      { role: 'button', n: 5, actions: ['click'] },
      { role: 'text', n: 76 },
    ])
    const snapshot = compressSnapshot(elements)
    expect(snapshot.compressed).toBe(true)

    const formatted = formatCompressed(snapshot)

    expect(formatted).toContain('[5 interactive elements of 81 total]')
    expect(formatted).toContain('[collapsed: 76 text]')
    // Interactive elements should be listed between header and collapsed
    const lines = formatted.split('\n')
    const headerIdx = lines.findIndex(l => l.includes('interactive elements of'))
    const collapsedIdx = lines.findIndex(l => l.startsWith('[collapsed:'))
    expect(headerIdx).toBe(0)
    expect(collapsedIdx).toBeGreaterThan(headerIdx)
  })

  it('sorts collapsed by count descending', () => {
    const elements = [
      ...makeElements([{ role: 'text', n: 50 }]),
      ...makeElements([{ role: 'image', n: 20 }]),
      ...makeElements([{ role: 'group', n: 5 }]),
      ...makeElements([{ role: 'button', n: 10, actions: ['click'] }]),
    ]
    expect(elements.length).toBeGreaterThan(80)

    const snapshot = compressSnapshot(elements)
    const formatted = formatCompressed(snapshot)

    const collapsedLine = formatted.split('\n').find(l => l.startsWith('[collapsed:'))!
    expect(collapsedLine).toBeDefined()
    const textIdx = collapsedLine.indexOf('50 text')
    const imageIdx = collapsedLine.indexOf('20 image')
    const groupIdx = collapsedLine.indexOf('5 group')
    expect(textIdx).toBeLessThan(imageIdx)
    expect(imageIdx).toBeLessThan(groupIdx)
  })
})

// ─── Empty input ─────────────────────────────────────────────

describe('compressSnapshot — empty input', () => {
  it('returns compressed=false with empty interactive', () => {
    const result = compressSnapshot([])

    expect(result.compressed).toBe(false)
    expect(result.interactive).toHaveLength(0)
    expect(result.totalElements).toBe(0)
    expect(result.interactiveCount).toBe(0)
    expect(result.collapsed).toEqual({})
  })
})

// ─── Custom threshold ────────────────────────────────────────

describe('compressSnapshot — custom threshold', () => {
  it('compresses at 11 elements with threshold=10', () => {
    const elements = [
      ...makeElements([{ role: 'button', n: 2, actions: ['click'] }]),
      ...makeElements([{ role: 'text', n: 9 }]),
    ]
    expect(elements).toHaveLength(11)

    const result = compressSnapshot(elements, 10)

    expect(result.compressed).toBe(true)
    expect(result.interactive).toHaveLength(2)
    expect(result.collapsed).toEqual({ text: 9 })
  })

  it('does not compress at exactly threshold elements', () => {
    const elements = makeElements([{ role: 'text', n: 10 }])
    expect(elements).toHaveLength(10)

    const result = compressSnapshot(elements, 10)

    expect(result.compressed).toBe(false)
    expect(result.interactive).toHaveLength(10)
  })
})
