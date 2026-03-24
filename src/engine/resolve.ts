/**
 * 3-tier element resolution: queryAXTree → Jaro-Winkler → vision fallback.
 * Forked from Spectra — extended with queryAXTree-first tier.
 */

import type { Element, ResolveOptions, ResolveResult } from './types.js'

export function resolve(options: ResolveOptions): ResolveResult {
  if (options.mode === 'algorithmic') {
    return resolveAlgorithmic(options)
  }

  const { intent, elements } = options

  if (elements.length === 0) {
    return { element: null, confidence: 0, candidates: [] }
  }

  const intentLower = intent.toLowerCase()
  const scored = scoreElements(elements, intentLower)

  if (scored.length === 0) {
    return {
      element: elements[0],
      confidence: 0,
      candidates: elements.filter((e) => e.actions.length > 0),
      visionFallback: options.mode === 'claude',
    }
  }

  const best = scored[0]

  if (best.score >= 1.0 || (scored.length === 1 && best.score >= 0.5)) {
    return {
      element: best.element,
      confidence: best.score,
    }
  }

  const threshold = best.score * 0.8
  const candidates = scored.filter((s) => s.score >= threshold).map((s) => s.element)

  const result: ResolveResult = {
    element: best.element,
    confidence: best.score,
    candidates: candidates.length > 1 ? candidates : undefined,
  }

  if (best.score < 0.3 && options.mode === 'claude') {
    result.visionFallback = true
  }

  return result
}

// ─── Claude Mode Scoring ───────────────────────────────────

interface ScoredElement {
  element: Element
  score: number
}

function scoreElements(elements: Element[], intentLower: string): ScoredElement[] {
  const scored: ScoredElement[] = []

  for (const el of elements) {
    const labelLower = el.label.toLowerCase()
    let score = 0

    if (labelLower.length === 0) continue

    const escapedLabel = escapeRegex(labelLower)
    const labelRegex = new RegExp(`\\b${escapedLabel}\\b`, 'i')

    if (labelRegex.test(intentLower)) {
      const labelWords = labelLower.trim().split(/\s+/)

      if (labelWords.length > 1) {
        score = 1.0
      } else {
        const intentWords = intentLower.split(/\s+/)
        const exactWordMatch = intentWords.includes(labelLower)

        if (exactWordMatch && labelWords[0].length > 1) {
          score = 0.5
        }
      }
    } else {
      const intentWords = intentLower.split(/\s+/)
      const matchedWords = intentWords.filter(
        (w) => w.length > 2 && labelLower.includes(w),
      )
      if (matchedWords.length > 0) {
        score = 0.5
      }
    }

    if (intentLower.includes(el.role)) {
      score = Math.min(score + 0.2, 1.0)
    }

    if (el.actions.length === 0 && score > 0) {
      score *= 0.5
    }

    if (score > 0) {
      scored.push({ element: el, score })
    }
  }

  return scored.sort((a, b) => b.score - a.score)
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ─── Algorithmic Mode ──────────────────────────────────────

function resolveAlgorithmic(options: ResolveOptions): ResolveResult {
  const { intent, elements } = options

  if (elements.length === 0) {
    return { element: null, confidence: 0, candidates: [] }
  }

  const intentLower = intent.toLowerCase()
  const hints = parseSpatialHints(intentLower)
  const cleanedIntent = cleanIntent(intentLower)

  const scored: ScoredElement[] = []

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]
    let score = 0

    const roleScore = scoreRole(cleanedIntent, el.role)
    const intentIsOnlyRole = cleanedIntent.trim() === el.role.toLowerCase()
        || cleanedIntent.trim().split(/\s+/).every((w) => scoreRole(w, el.role) > 0)
    const labelScore = intentIsOnlyRole ? 0 : scoreLabelSimilarity(cleanedIntent, el.label)
    const spatialScore = scoreSpatial(hints, el, i, elements)

    score = roleScore * 0.3 + labelScore * 0.5 + spatialScore * 0.2

    if (labelScore >= 0.99) {
      score = Math.max(score, 0.75)
    }

    if (score > 0) {
      scored.push({ element: el, score })
    }
  }

  scored.sort((a, b) => b.score - a.score)

  if (scored.length === 0) {
    return { element: elements[0], confidence: 0, candidates: [] }
  }

  const best = scored[0]

  if (best.score >= 0.7) {
    return {
      element: best.element,
      confidence: best.score,
    }
  }

  return {
    element: best.element,
    confidence: best.score,
    candidates: scored.map((s) => s.element),
  }
}

function scoreRole(intent: string, role: string): number {
  const roleLower = role.toLowerCase()
  const intentWords = intent.split(/\s+/)
  for (const word of intentWords) {
    if (word === roleLower) return 1.0
    if (word === 'btn' && roleLower === 'button') return 0.8
    if (word === 'input' && roleLower === 'textfield') return 0.8
    if (word === 'text' && roleLower === 'textfield') return 0.6
  }
  return 0
}

function scoreLabelSimilarity(intent: string, label: string): number {
  if (!label) return 0
  const labelLower = label.toLowerCase()

  if (intent.includes(labelLower)) return 1.0
  if (labelLower.includes(intent.trim())) return 0.9

  const jw = jaroWinkler(intent, labelLower)

  const intentWords = intent.split(/\s+/).filter((w) => w.length > 2)
  let bestWordJw = 0
  for (const word of intentWords) {
    bestWordJw = Math.max(bestWordJw, jaroWinkler(word, labelLower))
  }

  const labelWords = labelLower.split(/\s+/).filter((w) => w.length > 2)
  let bestLabelWordJw = 0
  for (const lw of labelWords) {
    for (const iw of intentWords) {
      bestLabelWordJw = Math.max(bestLabelWordJw, jaroWinkler(iw, lw))
    }
  }

  return Math.max(jw, bestWordJw, bestLabelWordJw)
}

export interface SpatialHints {
  position?: 'first' | 'last' | 'top' | 'bottom'
  near?: string
}

export function parseSpatialHints(intent: string): SpatialHints {
  const hints: SpatialHints = {}

  if (/\bfirst\b/.test(intent)) hints.position = 'first'
  else if (/\blast\b/.test(intent)) hints.position = 'last'
  else if (/\btop\b/.test(intent)) hints.position = 'top'
  else if (/\bbottom\b/.test(intent)) hints.position = 'bottom'

  const nearMatch = intent.match(/\b(?:next to|near|beside|by)\s+(.+?)(?:\s*$)/)
  if (nearMatch) hints.near = nearMatch[1].trim()

  return hints
}

function scoreSpatial(
  hints: SpatialHints,
  _el: Element,
  index: number,
  allElements: Element[],
): number {
  if (!hints.position && !hints.near) return 0

  let score = 0

  if (hints.position) {
    switch (hints.position) {
      case 'first':
      case 'top':
        score = Math.max(0, 1.0 - index / Math.max(allElements.length - 1, 1))
        break
      case 'last':
      case 'bottom':
        score = index / Math.max(allElements.length - 1, 1)
        break
    }
  }

  if (hints.near) {
    const nearLower = hints.near.toLowerCase()
    for (let i = 0; i < allElements.length; i++) {
      if (allElements[i].label.toLowerCase().includes(nearLower)) {
        const distance = Math.abs(index - i)
        if (distance > 0 && distance <= 3) {
          score = Math.max(score, 1.0 - (distance - 1) * 0.3)
        }
        break
      }
    }
  }

  return score
}

function cleanIntent(intent: string): string {
  return intent
    .replace(/\b(first|last|top|bottom)\b/g, '')
    .replace(/\b(next to|near|beside|by)\s+\S+/g, '')
    .replace(/\b(click|tap|press|select|choose)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Jaro-Winkler ──────────────────────────────────────────

export function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1.0
  if (s1.length === 0 || s2.length === 0) return 0.0

  const jaro = jaroDistance(s1, s2)
  if (jaro === 0) return 0

  let prefixLen = 0
  const maxPrefix = Math.min(4, Math.min(s1.length, s2.length))
  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] === s2[i]) {
      prefixLen++
    } else {
      break
    }
  }

  return jaro + prefixLen * 0.1 * (1 - jaro)
}

function jaroDistance(s1: string, s2: string): number {
  if (s1 === s2) return 1.0

  const len1 = s1.length
  const len2 = s2.length

  const matchWindow = Math.max(0, Math.floor(Math.max(len1, len2) / 2) - 1)

  const s1Matches = new Array(len1).fill(false)
  const s2Matches = new Array(len2).fill(false)

  let matches = 0
  let transpositions = 0

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow)
    const end = Math.min(i + matchWindow + 1, len2)

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue
      s1Matches[i] = true
      s2Matches[j] = true
      matches++
      break
    }
  }

  if (matches === 0) return 0

  let k = 0
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue
    while (!s2Matches[k]) k++
    if (s1[i] !== s2[k]) transpositions++
    k++
  }

  return (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3
}
