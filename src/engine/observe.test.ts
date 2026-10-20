import { afterEach, describe, expect, it, vi } from 'vitest'
import { observe, type ActionDescriptor, type ObserveOptions } from './observe.js'
import * as serialization from './serialize.js'
import type { Element } from './types.js'

const elements: Element[] = Array.from({ length: 1000 }, (_, i) => ({
  id: `e${i}`,
  role: i % 3 === 0 ? 'heading' : i % 3 === 1 ? 'button' : 'textfield',
  label: i % 2 === 0 ? `Email ${i}` : `Submit ${i}`,
  value: i % 3 === 2 ? `value ${i}` : null,
  enabled: i % 5 !== 0,
  focused: i === 2,
  actions: i % 3 === 0 ? [] : i % 3 === 1 ? ['press'] : ['setValue'],
  bounds: [0, i * 40, 100, 40],
  parent: null,
}))

// Preserve the previous implementation as an output-equivalence oracle.
function legacyObserve(input: Element[], options: ObserveOptions): ActionDescriptor[] {
  let filtered = input.filter(e => e.actions.length > 0)
  if (options.role) filtered = filtered.filter(e => e.role === options.role!.toLowerCase())
  if (options.intent) {
    const words = options.intent.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    if (words.length > 0) {
      filtered = filtered.filter(e => words.some(w => e.label.toLowerCase().includes(w)))
    }
  }
  const descriptors = filtered.map(el => {
    const verb = el.actions[0] === 'press' ? 'Click' : el.actions[0] === 'setValue'
      ? 'Type into' : el.actions[0] === 'showMenu' ? 'Open' : 'Interact with'
    return {
      elementId: el.id,
      description: `${verb} ${el.role} "${el.label}"${el.enabled ? '' : ' (disabled)'}`,
      actions: el.actions,
      role: el.role,
      label: el.label,
      serialized: serialization.serializeElement(el),
    }
  })
  return options.limit && descriptors.length > options.limit
    ? descriptors.slice(0, options.limit) : descriptors
}

afterEach(() => vi.restoreAllMocks())

describe('observe limited descriptor work', () => {
  const limits = [undefined, 0, 1, 30, 1000, -1, -1000, 1.5, 0.5, Infinity, -Infinity, NaN]
  const filters: ObserveOptions[] = [
    {}, { role: 'BUTTON' }, { intent: 'email submit' },
    { role: 'textfield', intent: 'EMAIL' }, { intent: 'a to' }, { intent: 'missing' },
  ]

  for (const filter of filters) {
    it.each(limits)(`preserves previous output for ${JSON.stringify(filter)}, limit=%s`, limit => {
      const options = { ...filter, limit }
      expect(observe(elements, options)).toEqual(legacyObserve(elements, options))
    })
  }

  it('serializes only returned elements after filtering and limiting', () => {
    const serialize = vi.spyOn(serialization, 'serializeElement')
    const result = observe(elements, { role: 'button', intent: 'submit', limit: 30 })
    expect(result).toHaveLength(30)
    expect(serialize).toHaveBeenCalledTimes(30)
    expect(serialize.mock.calls.map(([el]) => el.id)).toEqual(result.map(el => el.elementId))
    expect(result.every(el => el.role === 'button' && el.label.startsWith('Submit'))).toBe(true)
  })

  it('still serializes the full matching set when unlimited', () => {
    const serialize = vi.spyOn(serialization, 'serializeElement')
    const result = observe(elements)
    expect(result).toHaveLength(666)
    expect(serialize).toHaveBeenCalledTimes(666)
  })

  it('does not mutate the input array or elements', () => {
    const before = structuredClone(elements)
    observe(elements, { limit: 30 })
    expect(elements).toEqual(before)
  })
})
