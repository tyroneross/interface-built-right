/**
 * Test Runner — execute .ibr-test.json declarative test files.
 * Runs each test's steps via EngineDriver and records pass/fail per step.
 */

import { readFile, mkdir, writeFile } from 'fs/promises'
import { join, resolve } from 'path'
import { EngineDriver } from './engine/driver.js'
import type { TestSuite, TestStep } from './test-generator.js'

// ─── Public Types ─────────────────────────────────────────

export interface StepResult {
  step: string
  passed: boolean
  duration: number
  error?: string
  screenshot?: string
}

export interface TestResult {
  name: string
  passed: boolean
  steps: StepResult[]
  duration: number
}

export interface TestRunResult {
  url: string
  total: number
  passed: number
  failed: number
  tests: TestResult[]
  duration: number
}

export interface RunTestsOptions {
  /** Path to .ibr-test.json (default: .ibr-test.json) */
  filePath?: string
  /** Where to store screenshots/results (default: .ibr/test-results) */
  outputDir?: string
  /** Browser choice (future: safari) */
  browser?: string
  headless?: boolean
  viewport?: { width: number; height: number }
}

// ─── Main Runner ──────────────────────────────────────────

export async function runTests(options: RunTestsOptions = {}): Promise<TestRunResult[]> {
  const {
    filePath = '.ibr-test.json',
    outputDir = '.ibr/test-results',
    headless = true,
    viewport,
  } = options

  const raw = await readFile(resolve(filePath), 'utf-8')
  const suite: TestSuite = JSON.parse(raw)
  await mkdir(outputDir, { recursive: true })

  const allResults: TestRunResult[] = []
  const runStart = Date.now()

  for (const [pageName, pageSuite] of Object.entries(suite)) {
    console.log(`[test-runner] page: ${pageName} (${pageSuite.url})`)

    const driver = new EngineDriver()
    try {
      await driver.launch({
        headless,
        viewport: viewport ?? { width: 1280, height: 720 },
      })
      await driver.navigate(pageSuite.url)

      const testResults: TestResult[] = []

      for (const testCase of pageSuite.tests) {
        console.log(`[test-runner]   test: ${testCase.name}`)
        const testStart = Date.now()
        const stepResults: StepResult[] = []

        for (const step of testCase.steps) {
          const stepResult = await executeStep(driver, step, outputDir)
          stepResults.push(stepResult)
          if (!stepResult.passed) {
            console.log(`[test-runner]     FAIL: ${stepResult.step} — ${stepResult.error}`)
          }
        }

        const allPassed = stepResults.every(s => s.passed)
        testResults.push({
          name: testCase.name,
          passed: allPassed,
          steps: stepResults,
          duration: Date.now() - testStart,
        })
      }

      const passed = testResults.filter(t => t.passed).length
      const failed = testResults.filter(t => !t.passed).length

      const runResult: TestRunResult = {
        url: pageSuite.url,
        total: testResults.length,
        passed,
        failed,
        tests: testResults,
        duration: Date.now() - runStart,
      }

      allResults.push(runResult)

      // Write per-page results
      const resultPath = join(outputDir, `${pageName}-results.json`)
      await writeFile(resultPath, JSON.stringify(runResult, null, 2), 'utf-8')
      console.log(`[test-runner]   results: ${resultPath}`)
    } finally {
      await driver.close()
    }
  }

  return allResults
}

// ─── Step Executor ────────────────────────────────────────

async function executeStep(
  driver: EngineDriver,
  step: TestStep,
  outputDir: string,
): Promise<StepResult> {
  const start = Date.now()

  // Determine human description
  const stepDesc = describeStep(step)

  try {
    if ('click' in step) {
      const el = await driver.find(step.click)
      if (!el) throw new Error(`Element not found: "${step.click}"`)
      await driver.click(el.id)
      // Brief stabilize wait
      await new Promise(r => setTimeout(r, 200))

    } else if ('fill' in step) {
      const el = await driver.find(step.fill.target)
      if (!el) throw new Error(`Element not found: "${step.fill.target}"`)
      await driver.fill(el.id, step.fill.value)

    } else if ('type' in step) {
      const el = await driver.find(step.type.target)
      if (!el) throw new Error(`Element not found: "${step.type.target}"`)
      await driver.type(el.id, step.type.value)

    } else if ('assert' in step) {
      await runAssert(driver, step.assert)

    } else if ('screenshot' in step) {
      await mkdir(outputDir, { recursive: true })
      const screenshotPath = join(outputDir, `${step.screenshot}.png`)
      const buf = await driver.screenshot()
      await writeFile(screenshotPath, buf)
      return {
        step: stepDesc,
        passed: true,
        duration: Date.now() - start,
        screenshot: screenshotPath,
      }

    } else if ('wait' in step) {
      const waitVal = step.wait
      if (typeof waitVal === 'number') {
        await new Promise(r => setTimeout(r, waitVal))
      } else {
        // Wait for element by name
        await driver.waitForElement(waitVal, { timeout: 10000 })
      }
    }

    return { step: stepDesc, passed: true, duration: Date.now() - start }
  } catch (err) {
    return {
      step: stepDesc,
      passed: false,
      duration: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ─── Assert Handler ───────────────────────────────────────

async function runAssert(
  driver: EngineDriver,
  assertion: { visible?: string; hidden?: string; text?: string; count?: number },
): Promise<void> {
  const elements = await driver.getSnapshot()

  if (assertion.visible !== undefined) {
    const name = assertion.visible.toLowerCase()
    const found = elements.some(e =>
      e.label?.toLowerCase().includes(name) ||
      e.value?.toString().toLowerCase().includes(name),
    )
    if (!found) {
      throw new Error(`assert.visible: "${assertion.visible}" not found in AX tree (${elements.length} elements)`)
    }
  }

  if (assertion.hidden !== undefined) {
    const name = assertion.hidden.toLowerCase()
    const found = elements.some(e =>
      e.label?.toLowerCase().includes(name) ||
      e.value?.toString().toLowerCase().includes(name),
    )
    if (found) {
      throw new Error(`assert.hidden: "${assertion.hidden}" still present in AX tree (expected absent)`)
    }
  }

  if (assertion.text !== undefined) {
    const text = assertion.text.toLowerCase()
    const found = elements.some(e =>
      e.label?.toLowerCase().includes(text) ||
      e.value?.toString().toLowerCase().includes(text),
    )
    if (!found) {
      throw new Error(`assert.text: "${assertion.text}" not found in any element`)
    }
  }

  if (assertion.count !== undefined) {
    const interactive = elements.filter(e => e.actions && e.actions.length > 0)
    if (interactive.length !== assertion.count) {
      throw new Error(
        `assert.count: expected ${assertion.count} interactive elements, got ${interactive.length}`,
      )
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────

function describeStep(step: TestStep): string {
  if ('click' in step) return `click "${step.click}"`
  if ('fill' in step) return `fill "${step.fill.target}" with "${step.fill.value}"`
  if ('type' in step) return `type "${step.type.value}" into "${step.type.target}"`
  if ('assert' in step) {
    const parts: string[] = []
    if (step.assert.visible) parts.push(`visible: "${step.assert.visible}"`)
    if (step.assert.hidden) parts.push(`hidden: "${step.assert.hidden}"`)
    if (step.assert.text) parts.push(`text: "${step.assert.text}"`)
    if (step.assert.count !== undefined) parts.push(`count: ${step.assert.count}`)
    return `assert { ${parts.join(', ')} }`
  }
  if ('screenshot' in step) return `screenshot "${step.screenshot}"`
  if ('wait' in step) {
    return typeof step.wait === 'number'
      ? `wait ${step.wait}ms`
      : `wait for "${step.wait}"`
  }
  return 'unknown step'
}

// ─── Formatter ────────────────────────────────────────────

export function formatRunResult(result: TestRunResult): string {
  const lines: string[] = []
  const verdict = result.failed === 0 ? 'PASS' : 'FAIL'
  lines.push(`[${verdict}] ${result.url}  (${result.total} tests, ${result.passed} passed, ${result.failed} failed, ${result.duration}ms)`)
  for (const test of result.tests) {
    const icon = test.passed ? 'PASS' : 'FAIL'
    lines.push(`  [${icon}] ${test.name} (${test.duration}ms)`)
    for (const step of test.steps) {
      if (!step.passed) {
        lines.push(`    [FAIL] ${step.step}`)
        if (step.error) lines.push(`           ${step.error}`)
      }
    }
  }
  return lines.join('\n')
}
