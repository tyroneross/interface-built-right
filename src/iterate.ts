/**
 * Fix-and-Iterate Loop — convergence detection for test-fix cycles.
 *
 * The iterate function runs tests/scans, hashes the issue set, and detects
 * convergence conditions (stagnant, oscillating, regressing, budget_exceeded).
 *
 * Claude Code performs the actual code changes between CLI invocations.
 * Each call to `iterate()` runs one iteration and reports state.
 */

import { createHash } from 'crypto'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, resolve } from 'path'
import { runTests, type TestRunResult } from './test-runner.js'
import { scan, type ScanResult, type ScanIssue } from './scan.js'

// ─── Public Types ─────────────────────────────────────────

export interface IterationState {
  iteration: number
  /** SHA-256 of sorted issue fingerprints */
  scanHash: string
  issueCount: number
  /** issues_resolved - issues_introduced */
  netDelta: number
  /** What was tried */
  approachHint: string
  durationMs: number
  converged: boolean
  reason?: string
  /** Raw issues captured this iteration (for analysis) */
  issues?: ScanIssue[]
}

export interface IterateOptions {
  url: string
  /** .ibr-test.json path */
  testFile?: string
  /** Default 7 */
  maxIterations?: number
  outputDir?: string
  /** Default false — pause for user approval each iteration */
  autoApprove?: boolean
}

export type FinalState =
  | 'resolved'
  | 'false_positive'
  | 'stagnant'
  | 'oscillating'
  | 'regressing'
  | 'budget_exceeded'
  | 'in_progress'

// ─── Analysis Types ────────────────────────────────────────

export interface IterationAnalysis {
  repeatedCategories: string[]
  suggestedApproaches: string[]
  shouldEscalate: boolean
  escalationReason?: string
  affectedElements: Array<{ id?: string; issue: string }>
}

export interface IterateResult {
  iterations: IterationState[]
  finalState: FinalState
  summary: string
  /** true only if re-scan confirmed 0 issues (Anthropic harness pattern) */
  verificationPassed?: boolean
  /** Structured analysis for stagnant/oscillating/regressing states */
  analysis?: IterationAnalysis
}

// ─── Checkpoint iterations ────────────────────────────────

const CHECKPOINT_ITERATIONS = new Set([3, 7, 15, 20])

// ─── State Persistence ────────────────────────────────────

interface PersistedState {
  url: string
  iterations: IterationState[]
  createdAt: string
  updatedAt: string
}

async function loadState(statePath: string): Promise<PersistedState | null> {
  try {
    const raw = await readFile(statePath, 'utf-8')
    return JSON.parse(raw) as PersistedState
  } catch {
    return null
  }
}

async function saveState(statePath: string, state: PersistedState): Promise<void> {
  await mkdir(resolve(statePath, '..'), { recursive: true })
  await writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8')
}

// ─── Issue Hashing ────────────────────────────────────────

function hashIssues(issues: string[]): string {
  const sorted = [...issues].sort()
  return createHash('sha256').update(sorted.join('\n')).digest('hex').slice(0, 16)
}

function extractIssueFingerprints(scanResult: ScanResult): string[] {
  return scanResult.issues.map(i => `${i.category}:${i.severity}:${i.description.slice(0, 80)}`)
}

function testRunFingerprints(results: TestRunResult[]): string[] {
  const fps: string[] = []
  for (const run of results) {
    for (const test of run.tests) {
      if (!test.passed) {
        fps.push(`test:fail:${test.name}`)
        for (const step of test.steps) {
          if (!step.passed) fps.push(`step:fail:${step.step.slice(0, 60)}`)
        }
      }
    }
  }
  return fps
}

// ─── Convergence Detection ────────────────────────────────

function detectConvergence(states: IterationState[]): { converged: boolean; reason?: string } {
  const n = states.length
  if (n < 2) return { converged: false }

  const last = states[n - 1]
  const prev = states[n - 2]

  // Resolved: zero issues
  if (last.issueCount === 0) {
    return { converged: true, reason: 'resolved' }
  }

  // Stagnant: same hash 2 consecutive iterations
  if (last.scanHash === prev.scanHash) {
    return { converged: true, reason: 'stagnant' }
  }

  // Oscillating: hash matches 2 iterations ago (A→B→A)
  if (n >= 3) {
    const beforePrev = states[n - 3]
    if (last.scanHash === beforePrev.scanHash) {
      return { converged: true, reason: 'oscillating' }
    }
  }

  // Regressing: issue count increased 2 consecutive iterations
  if (n >= 3) {
    const beforePrev = states[n - 3]
    if (last.issueCount > prev.issueCount && prev.issueCount > beforePrev.issueCount) {
      return { converged: true, reason: 'regressing' }
    }
  }

  return { converged: false }
}

// ─── Issue Classification ─────────────────────────────────

/**
 * Classify an issue into a broad category based on description/message text.
 * Used when the issue doesn't have a mapped category or for cross-referencing.
 */
export function classifyIssue(issue: unknown): string {
  const text = (
    (issue as { description?: string })?.description ||
    (issue as { message?: string })?.message ||
    ''
  ).toLowerCase()
  if (/margin|padding|gap|spacing|indent/.test(text)) return 'spacing'
  if (/color|contrast|background|foreground|hue|saturation/.test(text)) return 'color'
  if (/font|text|typography|letter-spacing|line-height/.test(text)) return 'typography'
  if (/aria|label|role|accessible|screen.?reader|tab.?index/.test(text)) return 'accessibility'
  if (/click|handler|event|disabled|interactive|focus/.test(text)) return 'interactivity'
  if (/display.?none|visibility.?hidden/.test(text)) return 'visibility'
  // Check layout-specific patterns before broad "hidden" so "overflow hidden" stays layout
  if (/flex|grid|display|position|float|overflow|z-index/.test(text)) return 'layout'
  if (/hidden|visible|opacity/.test(text)) return 'visibility'
  if (/width|height|size|min|max|resize/.test(text)) return 'size'
  return 'other'
}

// ─── Approach Suggestions Map ─────────────────────────────

const APPROACH_MAP: Record<string, string> = {
  spacing: 'Check CSS layout properties (flex, grid, gap, margin, padding). Look for hardcoded values that should use design tokens.',
  color: 'Check design tokens or theme variables. Verify contrast ratios meet WCAG requirements.',
  typography: 'Check font-family, font-size, line-height, font-weight declarations. Look for CSS specificity conflicts.',
  accessibility: 'Add aria-label, role, tabindex attributes. Ensure interactive elements have accessible names.',
  interactivity: 'Check event handlers (onClick, onChange) and disabled state logic. Verify form submission handlers.',
  layout: 'Check CSS display, position, flex/grid properties. Look for overflow, z-index, and stacking context issues.',
  visibility: 'Check display:none, visibility:hidden, opacity:0, and conditional rendering logic.',
  size: 'Check width, height, min/max constraints. Verify responsive breakpoints.',
}

// ─── Analysis Generator ───────────────────────────────────

export function analyzeIssues(iterations: IterationState[]): IterationAnalysis {
  const latest = iterations[iterations.length - 1]
  if (!latest?.issues) {
    return { repeatedCategories: [], suggestedApproaches: [], shouldEscalate: false, affectedElements: [] }
  }

  // Group issues in the latest iteration by category
  const categories = new Map<string, number>()
  const elements: Array<{ id?: string; issue: string }> = []

  for (const issue of latest.issues) {
    // Always classify by description text — the ScanIssue.category field uses a different
    // taxonomy (interactivity/accessibility/semantic/console/structure) that doesn't map
    // to the visual fix categories we want to suggest approaches for.
    const cat = classifyIssue(issue)
    categories.set(cat, (categories.get(cat) ?? 0) + 1)
    elements.push({
      id: issue.element,
      issue: issue.description ?? String(issue),
    })
  }

  // Find categories that appeared in 2+ iterations
  const repeatedCategories: string[] = []
  for (const [cat] of categories) {
    const appearedIn = iterations.filter(it =>
      it.issues?.some(i => classifyIssue(i) === cat)
    ).length
    if (appearedIn >= 2) repeatedCategories.push(cat)
  }

  // Build approach suggestions from repeated categories
  const suggestedApproaches: string[] = []
  for (const cat of repeatedCategories) {
    if (APPROACH_MAP[cat]) {
      suggestedApproaches.push(APPROACH_MAP[cat])
    }
  }

  // Escalate when repeated categories persist across 3+ iterations
  const shouldEscalate = repeatedCategories.length > 0 && iterations.length >= 3
  const escalationReason = shouldEscalate
    ? `${repeatedCategories.join(', ')} issues persist after ${iterations.length} iterations. Consider a different approach or manual review.`
    : undefined

  return {
    repeatedCategories,
    suggestedApproaches,
    shouldEscalate,
    escalationReason,
    affectedElements: elements.slice(0, 20), // Cap at 20
  }
}

// ─── Single Iteration ─────────────────────────────────────

async function runOneIteration(
  url: string,
  testFile: string | undefined,
  outputDir: string,
  iterationNumber: number,
  prevIssueCount: number,
): Promise<IterationState> {
  const start = Date.now()
  let fingerprints: string[] = []
  let issueCount = 0
  let approachHint = ''
  let issues: ScanIssue[] | undefined

  if (testFile) {
    // Run declarative tests
    try {
      const results = await runTests({
        filePath: testFile,
        outputDir: join(outputDir, `iter-${iterationNumber}`),
      })
      fingerprints = testRunFingerprints(results)
      issueCount = fingerprints.length
      const total = results.reduce((s, r) => s + r.total, 0)
      const failed = results.reduce((s, r) => s + r.failed, 0)
      approachHint = `${total - failed}/${total} tests passing`
    } catch (err) {
      fingerprints = [`runner-error:${err instanceof Error ? err.message.slice(0, 60) : String(err)}`]
      issueCount = 1
      approachHint = 'test runner error'
    }
  } else {
    // Run IBR scan
    try {
      const result: ScanResult = await scan(url, { outputDir: join(outputDir, `iter-${iterationNumber}`) })
      fingerprints = extractIssueFingerprints(result)
      issueCount = result.issues.length
      issues = result.issues
      approachHint = `verdict=${result.verdict} issues=${issueCount}`
    } catch (err) {
      fingerprints = [`scan-error:${err instanceof Error ? err.message.slice(0, 60) : String(err)}`]
      issueCount = 1
      approachHint = 'scan error'
    }
  }

  const scanHash = hashIssues(fingerprints)
  const netDelta = prevIssueCount - issueCount  // positive = improvement

  return {
    iteration: iterationNumber,
    scanHash,
    issueCount,
    netDelta,
    approachHint,
    durationMs: Date.now() - start,
    converged: false,
    issues,
  }
}

// ─── Verification Pass ────────────────────────────────────

/**
 * Re-scan to verify a claimed zero-issue result.
 * Anthropic harness pattern: never claim success without a second confirmation.
 */
async function verifyResolved(
  url: string,
  outputDir: string,
  iterationNumber: number,
): Promise<{ confirmed: boolean; verifyIssueCount: number }> {
  try {
    const verifyResult: ScanResult = await scan(url, {
      outputDir: join(outputDir, `iter-${iterationNumber}-verify`),
    })
    return { confirmed: verifyResult.issues.length === 0, verifyIssueCount: verifyResult.issues.length }
  } catch {
    // If verification scan errors, treat as unconfirmed — don't falsely claim resolved
    return { confirmed: false, verifyIssueCount: -1 }
  }
}

// ─── Main Iterate Function ────────────────────────────────

export async function iterate(options: IterateOptions): Promise<IterateResult> {
  const {
    url,
    testFile,
    maxIterations = 7,
    outputDir = '.ibr/iterate',
    autoApprove = false,
  } = options

  const statePath = join(outputDir, 'iterate-state.json')
  await mkdir(outputDir, { recursive: true })

  // Load or init persisted state
  let persisted = await loadState(statePath)
  if (!persisted || persisted.url !== url) {
    persisted = {
      url,
      iterations: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  const allIterations = persisted.iterations

  // If we've already hit budget, report immediately
  if (allIterations.length >= maxIterations) {
    return buildResult(allIterations, 'budget_exceeded')
  }

  const iterationNumber = allIterations.length + 1
  const prevIssueCount = allIterations.length > 0
    ? allIterations[allIterations.length - 1].issueCount
    : Infinity

  console.log(`[iterate] iteration ${iterationNumber}/${maxIterations}...`)

  const state = await runOneIteration(url, testFile, outputDir, iterationNumber, prevIssueCount === Infinity ? 0 : prevIssueCount)
  allIterations.push(state)

  // Detect convergence
  const { converged, reason } = detectConvergence(allIterations)

  let finalState: FinalState | null = null
  let verificationPassed: boolean | undefined

  if (converged && reason) {
    state.converged = true
    state.reason = reason

    if (reason === 'resolved' && !testFile) {
      // Verification pass — re-scan to confirm (Anthropic harness pattern: never claim success without verification)
      console.log(`[iterate] issueCount=0 detected, running verification pass...`)
      const { confirmed, verifyIssueCount } = await verifyResolved(url, outputDir, iterationNumber)

      if (confirmed) {
        // Truly resolved
        finalState = 'resolved'
        verificationPassed = true
        console.log(`[iterate] verification passed — 0 issues confirmed`)
      } else {
        // False positive — scan missed issues on first pass
        finalState = 'false_positive'
        verificationPassed = false
        state.converged = false
        state.reason = undefined
        // Log the discrepancy
        console.log(`[iterate] false positive — verification found ${verifyIssueCount} issue(s). Continuing iteration.`)
      }
    } else {
      finalState = reason as FinalState
    }
  } else if (allIterations.length >= maxIterations) {
    finalState = 'budget_exceeded'
  } else if (!autoApprove && CHECKPOINT_ITERATIONS.has(iterationNumber)) {
    // Pause at checkpoint — return current state for user review
    // Caller (CLI) will present this to the user and they decide whether to continue
    finalState = null
  }

  // Persist state
  persisted.iterations = allIterations
  persisted.updatedAt = new Date().toISOString()
  await saveState(statePath, persisted)

  // Generate analysis for convergence states (not resolved/false_positive — those don't need approach suggestions)
  let analysis: IterationAnalysis | undefined
  const analysisStates: FinalState[] = ['stagnant', 'oscillating', 'regressing', 'budget_exceeded', 'false_positive', 'in_progress']
  const targetState = finalState ?? 'in_progress'
  if (analysisStates.includes(targetState) && !testFile) {
    analysis = analyzeIssues(allIterations)
    // Persist analysis to disk for agent consumption
    const analysisDir = join(outputDir)
    await mkdir(analysisDir, { recursive: true }).catch(() => {})
    await writeFile(
      join(analysisDir, 'analysis.json'),
      JSON.stringify(analysis, null, 2),
    ).catch(() => {})
  }

  if (finalState) {
    const result = buildResult(allIterations, finalState, verificationPassed, analysis)
    console.log(`[iterate] ${finalState}: ${result.summary}`)
    return result
  }

  // Not yet converged — return intermediate state for next iteration
  return buildResult(allIterations, 'in_progress', undefined, analysis)
}

// ─── Result Builder ───────────────────────────────────────

function buildResult(
  iterations: IterationState[],
  finalState: FinalState,
  verificationPassed?: boolean,
  analysis?: IterationAnalysis,
): IterateResult {
  const last = iterations[iterations.length - 1]
  const totalMs = iterations.reduce((s, i) => s + i.durationMs, 0)

  let summary: string
  switch (finalState) {
    case 'resolved':
      summary = `All issues resolved after ${iterations.length} iteration(s) (${totalMs}ms total)`
      break
    case 'false_positive':
      summary = `Scan reported 0 issues but verification found more — false positive detected after ${iterations.length} iteration(s). Continuing.`
      break
    case 'stagnant':
      summary = `No change detected after ${iterations.length} iteration(s) — same ${last?.issueCount ?? 0} issue(s). Try a different approach.`
      break
    case 'oscillating':
      summary = `Oscillating fix detected (A→B→A pattern) after ${iterations.length} iteration(s). Manual investigation needed.`
      break
    case 'regressing':
      summary = `Issue count increased 2 consecutive iterations (now ${last?.issueCount ?? 0}). Reverting last change recommended.`
      break
    case 'budget_exceeded':
      summary = `Reached ${iterations.length} iteration(s). ${last?.issueCount ?? 0} issue(s) remaining. Approach: ${last?.approachHint ?? 'unknown'}.`
      break
    case 'in_progress':
      summary = `Iteration ${iterations.length} complete. ${last?.issueCount ?? 0} issue(s) remaining. Ready for next iteration.`
      break
  }

  return { iterations, finalState, summary, verificationPassed, analysis }
}

// ─── State Reset ──────────────────────────────────────────

export async function resetIterateState(outputDir = '.ibr/iterate'): Promise<void> {
  const statePath = join(outputDir, 'iterate-state.json')
  await writeFile(statePath, JSON.stringify({ iterations: [] }, null, 2), 'utf-8').catch(() => {})
}
