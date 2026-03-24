/**
 * Extract — pull structured data from the page using schemas.
 * Inspired by Stagehand's extract() with Zod-like output typing.
 *
 * Unlike Stagehand (which uses an LLM to extract), this uses
 * CDP DOM queries + AX tree to extract data deterministically.
 * Claude interprets the result — we just provide structured data.
 */

import type { Element } from './types.js'

// ─── Extraction Types ───────────────────────────────────────

export interface ExtractField {
  /** CSS selector to find the element */
  selector?: string
  /** AX role to match */
  role?: string
  /** AX label pattern (substring match) */
  label?: string
  /** What to extract: 'text' | 'value' | 'attribute' | 'html' */
  extract: 'text' | 'value' | 'attribute' | 'html' | 'exists'
  /** Attribute name (when extract === 'attribute') */
  attribute?: string
}

export interface ExtractSchema {
  [fieldName: string]: ExtractField
}

export interface ExtractResult {
  [fieldName: string]: string | boolean | null
}

// ─── AX-based extraction ────────────────────────────────────

/**
 * Extract data from the AX tree based on a schema.
 * No DOM queries needed — works entirely from the accessibility tree.
 */
export function extractFromAXTree(
  elements: Element[],
  schema: ExtractSchema,
): ExtractResult {
  const result: ExtractResult = {}

  for (const [fieldName, field] of Object.entries(schema)) {
    const match = findMatchingElement(elements, field)

    if (!match) {
      result[fieldName] = field.extract === 'exists' ? false : null
      continue
    }

    switch (field.extract) {
      case 'text':
        result[fieldName] = match.label || match.value || null
        break
      case 'value':
        result[fieldName] = match.value || null
        break
      case 'exists':
        result[fieldName] = true
        break
      default:
        // 'attribute' and 'html' require DOM queries — return null from AX
        result[fieldName] = null
    }
  }

  return result
}

/**
 * Extract a list of items from repeated AX tree patterns.
 * Useful for tables, lists, cards — any repeated structure.
 */
export function extractList(
  elements: Element[],
  options: {
    role?: string
    labelPattern?: RegExp
    maxItems?: number
  },
): Array<{ label: string; value: string | null; id: string }> {
  let filtered = elements

  if (options.role) {
    filtered = filtered.filter((e) => e.role === options.role)
  }

  if (options.labelPattern) {
    filtered = filtered.filter((e) => options.labelPattern!.test(e.label))
  }

  const items = filtered.map((e) => ({
    label: e.label,
    value: e.value,
    id: e.id,
  }))

  if (options.maxItems) {
    return items.slice(0, options.maxItems)
  }

  return items
}

/**
 * Extract page-level metadata from the AX tree.
 */
export function extractPageMeta(elements: Element[]): {
  headings: string[]
  links: Array<{ label: string; id: string }>
  inputs: Array<{ label: string; value: string | null; id: string }>
  buttons: Array<{ label: string; enabled: boolean; id: string }>
} {
  return {
    headings: elements
      .filter((e) => e.role === 'heading')
      .map((e) => e.label),
    links: elements
      .filter((e) => e.role === 'link')
      .map((e) => ({ label: e.label, id: e.id })),
    inputs: elements
      .filter((e) => e.role === 'textfield')
      .map((e) => ({ label: e.label, value: e.value, id: e.id })),
    buttons: elements
      .filter((e) => e.role === 'button')
      .map((e) => ({ label: e.label, enabled: e.enabled, id: e.id })),
  }
}

// ─── Helpers ────────────────────────────────────────────────

function findMatchingElement(elements: Element[], field: ExtractField): Element | null {
  for (const el of elements) {
    if (field.role && el.role !== field.role) continue
    if (field.label) {
      if (!el.label.toLowerCase().includes(field.label.toLowerCase())) continue
    }
    return el
  }
  return null
}
