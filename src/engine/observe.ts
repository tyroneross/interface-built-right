/**
 * Observe — preview what actions are possible without executing.
 * Inspired by Stagehand's observe() primitive.
 *
 * Returns serializable action descriptors that can be logged, cached,
 * or passed back to act() for execution.
 */

import type { Element } from './types.js'
import { serializeElement } from './serialize.js'

export interface ActionDescriptor {
  /** Element ID for act() */
  elementId: string
  /** Human-readable description */
  description: string
  /** Available actions */
  actions: string[]
  /** Element role */
  role: string
  /** Element label */
  label: string
  /** Compact serialized form */
  serialized: string
}

export interface ObserveOptions {
  /** Only include elements matching this intent */
  intent?: string
  /** Filter by role */
  role?: string
  /** Max results */
  limit?: number
}

/**
 * Observe the current page — return what actions are possible.
 * Does NOT execute anything. Returns descriptors for act().
 */
export function observe(
  elements: Element[],
  options: ObserveOptions = {},
): ActionDescriptor[] {
  let filtered = elements.filter((e) => e.actions.length > 0)

  // Filter by role if specified
  if (options.role) {
    const role = options.role.toLowerCase()
    filtered = filtered.filter((e) => e.role === role)
  }

  // Filter by intent if specified (simple word matching)
  if (options.intent) {
    const words = options.intent.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
    if (words.length > 0) {
      filtered = filtered.filter((e) => {
        const labelLower = e.label.toLowerCase()
        return words.some((w) => labelLower.includes(w))
      })
    }
  }

  // Map to action descriptors
  const descriptors = filtered.map((el): ActionDescriptor => ({
    elementId: el.id,
    description: describeAction(el),
    actions: el.actions,
    role: el.role,
    label: el.label,
    serialized: serializeElement(el),
  }))

  if (options.limit && descriptors.length > options.limit) {
    return descriptors.slice(0, options.limit)
  }

  return descriptors
}

function describeAction(el: Element): string {
  const actionVerb = el.actions[0] === 'press' ? 'Click' :
    el.actions[0] === 'setValue' ? 'Type into' :
    el.actions[0] === 'showMenu' ? 'Open' : 'Interact with'
  const state = el.enabled ? '' : ' (disabled)'
  return `${actionVerb} ${el.role} "${el.label}"${state}`
}
