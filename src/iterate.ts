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
import { scan, type ScanResult } from './scan.js'

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

export type FinalState = 'resolved' | 'stagnant' | 'oscillating' | 'regressing' | 'budget_exceeded'

export interface IterateResult {
  iterations: IterationState[]
  finalState: FinalState
  summary: string
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

  if (converged && reason) {
    state.converged = true
    state.reason = reason
    finalState = reason as FinalState
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

  if (finalState) {
    const result = buildResult(allIterations, finalState)
    console.log(`[iterate] ${finalState}: ${result.summary}`)
    return result
  }

  // Not yet converged — return intermediate state
  return buildResult(allIterations, 'budget_exceeded')  // caller checks iterations.length vs maxIterations
}

// ─── Result Builder ───────────────────────────────────────

function buildResult(iterations: IterationState[], finalState: FinalState): IterateResult {
  const last = iterations[iterations.length - 1]
  const totalMs = iterations.reduce((s, i) => s + i.durationMs, 0)

  let summary: string
  switch (finalState) {
    case 'resolved':
      summary = `All issues resolved after ${iterations.length} iteration(s) (${totalMs}ms total)`
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
  }

  return { iterations, finalState, summary }
}

// ─── State Reset ──────────────────────────────────────────

export async function resetIterateState(outputDir = '.ibr/iterate'): Promise<void> {
  const statePath = join(outputDir, 'iterate-state.json')
  await writeFile(statePath, JSON.stringify({ iterations: [] }, null, 2), 'utf-8').catch(() => {})
}
