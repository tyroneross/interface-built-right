/**
 * Test Generator — generate .ibr-test.json test files from page observation.
 * Observes interactive elements on a page and builds a declarative test suite.
 */

import { writeFile, mkdir } from 'fs/promises'
import { dirname } from 'path'
import { EngineDriver } from './engine/driver.js'
import type { Element } from './engine/types.js'

// ─── Public Types ─────────────────────────────────────────

export type TestStep =
  | { click: string }
  | { fill: { target: string; value: string } }
  | { type: { target: string; value: string } }
  | { assert: { visible?: string; hidden?: string; text?: string; count?: number } }
  | { screenshot: string }
  | { wait: string | number }

export interface TestCase {
  name: string
  steps: TestStep[]
}

export interface PageSuite {
  url: string
  tests: TestCase[]
}

export interface TestSuite {
  [pageName: string]: PageSuite
}

export interface GenerateTestOptions {
  url: string
  /** Natural language scenario description */
  scenario?: string
  /** Where to write the test file (default: .ibr-test.json) */
  outputPath?: string
}

// ─── Keyword matching for scenario-targeted tests ─────────

const INPUT_SAMPLE_VALUES: Record<string, string> = {
  email: 'test@example.com',
  password: 'Test1234!',
  search: 'test query',
  query: 'test query',
  name: 'Test User',
  username: 'testuser',
  phone: '555-0100',
  message: 'Hello world',
  comment: 'This is a comment',
  title: 'Test Title',
  description: 'Test description',
}

function guessInputValue(label: string): string {
  const lower = label.toLowerCase()
  for (const [key, val] of Object.entries(INPUT_SAMPLE_VALUES)) {
    if (lower.includes(key)) return val
  }
  return 'test value'
}

function isInputLike(el: Element): boolean {
  return ['textbox', 'searchbox', 'combobox', 'spinbutton', 'slider'].includes(el.role)
}

function isClickable(el: Element): boolean {
  return ['button', 'link', 'menuitem', 'tab', 'checkbox', 'radio', 'switch', 'option'].includes(el.role)
    || el.actions.includes('click')
}

/**
 * Match scenario keywords against element labels to decide relevance.
 * Returns a score — higher means more relevant.
 */
function scenarioRelevance(el: Element, keywords: string[]): number {
  if (!el.label) return 0
  const label = el.label.toLowerCase()
  let score = 0
  for (const kw of keywords) {
    if (label.includes(kw)) score += 2
    else if (kw.includes(label) || label.startsWith(kw.slice(0, 3))) score += 1
  }
  return score
}

// ─── Core Generator ───────────────────────────────────────

/**
 * Generate a TestSuite from a page URL.
 *
 * Without scenario: builds a smoke test that touches every interactive element.
 * With scenario: builds a targeted test matching scenario keywords.
 */
export async function generateTest(options: GenerateTestOptions): Promise<TestSuite> {
  const { url, scenario, outputPath = '.ibr-test.json' } = options

  const driver = new EngineDriver()
  let elements: Element[] = []
  let pageTitle = 'page'

  try {
    await driver.launch({ headless: true })
    await driver.navigate(url)

    // Get page title for suite name
    try {
      const title = await driver.title()
      if (title) pageTitle = title
    } catch {
      // ignore
    }

    // Discover all interactive elements
    const discovered = await driver.discover({ filter: 'interactive' })
    elements = discovered as Element[]
  } finally {
    await driver.close()
  }

  // Derive page name from title or URL path
  let pageName: string
  try {
    const pathname = new URL(url).pathname
    pageName = pathname === '/' ? 'home' : pathname.replace(/\//g, '-').replace(/^-/, '')
  } catch {
    pageName = pageTitle.toLowerCase().replace(/\s+/g, '-').slice(0, 32) || 'page'
  }

  const tests: TestCase[] = []

  if (scenario) {
    tests.push(buildScenarioTest(scenario, elements))
  } else {
    tests.push(buildSmokeTest(elements, url))
  }

  const suite: TestSuite = {
    [pageName]: { url, tests },
  }

  // Write to disk
  const dir = dirname(outputPath)
  if (dir && dir !== '.') {
    await mkdir(dir, { recursive: true })
  }
  await writeFile(outputPath, JSON.stringify(suite, null, 2), 'utf-8')
  console.log(`[test-generator] wrote ${outputPath}`)

  return suite
}

// ─── Smoke Test Builder ───────────────────────────────────

function buildSmokeTest(elements: Element[], _url: string): TestCase {
  const steps: TestStep[] = []

  // Opening screenshot
  steps.push({ screenshot: 'initial-state' })

  // Walk each interactive element
  for (const el of elements) {
    if (!el.label) continue

    if (isInputLike(el)) {
      const value = guessInputValue(el.label)
      steps.push({ fill: { target: el.label, value } })
      steps.push({ assert: { visible: el.label } })
    } else if (isClickable(el)) {
      // Skip navigation-heavy elements that would leave the page
      const label = el.label.toLowerCase()
      const isNav = ['logout', 'sign out', 'delete', 'remove', 'close'].some(w => label.includes(w))
      if (!isNav) {
        steps.push({ click: el.label })
        // Brief wait for any async response
        steps.push({ wait: 500 })
        steps.push({ screenshot: `after-click-${el.label.toLowerCase().replace(/\s+/g, '-').slice(0, 20)}` })
      }
    }
  }

  // Tally assert
  steps.push({ assert: { count: elements.filter(e => e.actions.length > 0).length } })

  return {
    name: 'smoke test',
    steps,
  }
}

// ─── Scenario Test Builder ────────────────────────────────

function buildScenarioTest(scenario: string, elements: Element[]): TestCase {
  const keywords = scenario
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)

  // Score elements by relevance to scenario keywords
  const scored = elements
    .filter(el => el.label && (isInputLike(el) || isClickable(el)))
    .map(el => ({ el, score: scenarioRelevance(el, keywords) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)

  const steps: TestStep[] = []

  steps.push({ screenshot: 'scenario-start' })

  // Heuristic ordering: fill inputs first, then click actions
  const inputs = scored.filter(x => isInputLike(x.el))
  const clickables = scored.filter(x => isClickable(x.el))

  for (const { el } of inputs) {
    const value = guessInputValue(el.label!)
    steps.push({ fill: { target: el.label!, value } })
  }

  for (const { el } of clickables.slice(0, 3)) {
    steps.push({ click: el.label! })
    steps.push({ wait: 800 })
  }

  // Assert scenario keywords appear somewhere
  for (const kw of keywords.slice(0, 2)) {
    if (kw.length > 3) {
      steps.push({ assert: { text: kw } })
    }
  }

  steps.push({ screenshot: 'scenario-end' })

  return {
    name: scenario,
    steps,
  }
}
