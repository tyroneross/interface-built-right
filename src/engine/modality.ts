/**
 * Adaptive modality — Understanding Score calculator.
 * Inspired by V-GEMS (arxiv 2603.02626).
 *
 * Scores how well the AX tree captures the page's content.
 * High score → use AX tree only (fast, cheap).
 * Low score → include screenshot (accurate, expensive).
 *
 * Dimensions:
 * 1. Text Quality — do elements have meaningful labels?
 * 2. Semantic Relevance — are interactive elements well-labeled?
 * 3. Structural Clarity — is the AX tree well-organized?
 * 4. Special Case Penalties — known problematic patterns
 */

import type { Element } from './types.js'

export interface UnderstandingScore {
  /** Overall score 0-1. Below threshold → include screenshot. */
  score: number
  /** Whether a screenshot is recommended */
  needsScreenshot: boolean
  /** Breakdown of individual dimension scores */
  dimensions: {
    textQuality: number
    semanticRelevance: number
    structuralClarity: number
    specialCasePenalty: number
  }
  /** Human-readable reasoning */
  reasoning: string
}

export interface ModalityOptions {
  /** Score threshold below which screenshot is recommended (default: 0.6) */
  threshold?: number
}

/**
 * Assess how well the AX tree captures the page content.
 * Returns a score and recommendation for whether to include a screenshot.
 */
export function assessUnderstanding(
  elements: Element[],
  options: ModalityOptions = {},
): UnderstandingScore {
  const threshold = options.threshold ?? 0.6

  if (elements.length === 0) {
    return {
      score: 0,
      needsScreenshot: true,
      dimensions: { textQuality: 0, semanticRelevance: 0, structuralClarity: 0, specialCasePenalty: 0 },
      reasoning: 'Empty AX tree — screenshot required for any understanding',
    }
  }

  const textQuality = scoreTextQuality(elements)
  const semanticRelevance = scoreSemanticRelevance(elements)
  const structuralClarity = scoreStructuralClarity(elements)
  const specialCasePenalty = scoreSpecialCases(elements)

  // Weighted combination
  const raw = textQuality * 0.35 + semanticRelevance * 0.30 + structuralClarity * 0.20
  const score = Math.max(0, Math.min(1, raw - specialCasePenalty))

  const needsScreenshot = score < threshold
  const reasoning = buildReasoning(score, threshold, { textQuality, semanticRelevance, structuralClarity, specialCasePenalty })

  return {
    score,
    needsScreenshot,
    dimensions: { textQuality, semanticRelevance, structuralClarity, specialCasePenalty },
    reasoning,
  }
}

// ─── Dimension Scorers ──────────────────────────────────────

/**
 * Text Quality: What fraction of elements have meaningful labels?
 * Empty labels, single-character labels, and generic labels reduce quality.
 */
function scoreTextQuality(elements: Element[]): number {
  if (elements.length === 0) return 0

  let labeled = 0
  let meaningful = 0

  for (const el of elements) {
    if (el.label) {
      labeled++
      // Is the label meaningful? (not just punctuation, not too short)
      if (el.label.length > 1 && /[a-zA-Z]/.test(el.label)) {
        meaningful++
      }
    }
  }

  const labelRatio = labeled / elements.length
  const meaningfulRatio = elements.length > 0 ? meaningful / elements.length : 0

  return labelRatio * 0.4 + meaningfulRatio * 0.6
}

/**
 * Semantic Relevance: Are interactive elements well-labeled?
 * Interactive elements with good labels = high relevance.
 * Interactive elements without labels = dangerous for automation.
 */
function scoreSemanticRelevance(elements: Element[]): number {
  const interactive = elements.filter((e) => e.actions.length > 0)
  if (interactive.length === 0) return 0.5 // No interactable elements — neutral

  let wellLabeled = 0
  for (const el of interactive) {
    if (el.label && el.label.length > 1) {
      wellLabeled++
    }
  }

  return wellLabeled / interactive.length
}

/**
 * Structural Clarity: Is the AX tree well-organized?
 * Good structure: mix of roles, reasonable element count.
 * Bad structure: all same role, too few or too many elements.
 */
function scoreStructuralClarity(elements: Element[]): number {
  // Role diversity: more unique roles = better structure
  const roles = new Set(elements.map((e) => e.role))
  const roleDiversity = Math.min(1, roles.size / 5) // Expect at least 5 distinct roles

  // Element count: too few (< 3) or too many (> 500) are suspicious
  const count = elements.length
  let countScore: number
  if (count < 3) {
    countScore = count / 3
  } else if (count > 500) {
    countScore = Math.max(0.3, 1 - (count - 500) / 2000)
  } else {
    countScore = 1.0
  }

  return roleDiversity * 0.5 + countScore * 0.5
}

/**
 * Special Case Penalties: known patterns where AX tree is unreliable.
 * Returns a penalty value (0 = no penalty, higher = worse).
 */
function scoreSpecialCases(elements: Element[]): number {
  let penalty = 0

  // All elements have the same role (probably Canvas or custom rendering)
  const roles = new Set(elements.map((e) => e.role))
  if (roles.size === 1 && elements.length > 5) {
    penalty += 0.3
  }

  // Very few elements relative to page complexity (probably Canvas/WebGL)
  if (elements.length < 3) {
    penalty += 0.2
  }

  // Many unlabeled interactive elements (bad accessibility)
  const interactive = elements.filter((e) => e.actions.length > 0)
  const unlabeled = interactive.filter((e) => !e.label || e.label.length <= 1)
  if (interactive.length > 0 && unlabeled.length / interactive.length > 0.5) {
    penalty += 0.2
  }

  return Math.min(0.8, penalty) // Cap penalty at 0.8
}

// ─── Reasoning ──────────────────────────────────────────────

function buildReasoning(
  score: number,
  threshold: number,
  dims: { textQuality: number; semanticRelevance: number; structuralClarity: number; specialCasePenalty: number },
): string {
  const parts: string[] = []

  if (dims.textQuality < 0.4) parts.push('low text quality (many unlabeled elements)')
  if (dims.semanticRelevance < 0.5) parts.push('poor semantic relevance (interactive elements lack labels)')
  if (dims.structuralClarity < 0.4) parts.push('weak structure (low role diversity)')
  if (dims.specialCasePenalty > 0.1) parts.push('special case detected (possible Canvas/custom rendering)')

  if (parts.length === 0) {
    return score >= threshold
      ? 'AX tree provides sufficient understanding — screenshot not needed'
      : 'AX tree quality is borderline — screenshot recommended for accuracy'
  }

  const action = score >= threshold ? 'AX tree usable despite' : 'Screenshot recommended due to'
  return `${action}: ${parts.join(', ')}`
}
