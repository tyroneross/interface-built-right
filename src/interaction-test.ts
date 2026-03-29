/**
 * Interaction Assertions Pipeline — act→verify→screenshot.
 * Answers: "I clicked X — did Y happen?"
 */

import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { EngineDriver, type LaunchOptions } from './engine/driver.js'
import type { Viewport } from './schemas.js'

export interface InteractionStep {
  action: {
    type: 'click' | 'type' | 'fill' | 'hover' | 'press' | 'scroll' | 'select' | 'check' | 'doubleClick' | 'rightClick'
    target?: string  // Accessible name or CSS selector (not required for press/scroll)
    value?: string   // For type/fill/select/press/scroll
  }
  expect?: {
    visible?: string       // Element with this text/label should appear
    hidden?: string        // Element should disappear
    text?: string          // Page should contain text (search AX tree labels/values)
    count?: number         // Number of elements matching visible target
    screenshot?: string    // Name for screenshot file
  }
}

export interface InteractionResult {
  url: string
  step: InteractionStep
  action: { success: boolean; duration: number; error?: string }
  assertions: Array<{ check: string; passed: boolean; detail: string }>
  before: { screenshot: Buffer; elementCount: number }
  after: { screenshot: Buffer; elementCount: number }
  diff: { addedElements: string[]; removedElements: string[]; pixelDiff: number }
}

export interface InteractionTestOptions {
  url: string
  steps: InteractionStep[]
  viewport?: Viewport
  outputDir?: string
  headless?: boolean
}

/**
 * Run an interaction test: navigate to URL, execute each step with assertions.
 */
export async function runInteractionTest(
  options: InteractionTestOptions,
): Promise<InteractionResult[]> {
  const { url, steps, viewport, outputDir = '.ibr/interactions', headless = true } = options

  const driver = new EngineDriver()
  const launchOpts: LaunchOptions = {
    headless,
    viewport: viewport ? { width: viewport.width, height: viewport.height } : undefined,
  }

  try {
    await driver.launch(launchOpts)
    await driver.navigate(url)

    const results: InteractionResult[] = []

    for (const step of steps) {
      const result = await executeStep(driver, step, url, outputDir)
      results.push(result)
    }

    return results
  } finally {
    await driver.close()
  }
}

async function executeStep(
  driver: EngineDriver,
  step: InteractionStep,
  url: string,
  outputDir: string,
): Promise<InteractionResult> {
  const { action, expect: expectation } = step

  const actionStart = Date.now()
  let actionSuccess = true
  let actionError: string | undefined

  // Resolve target element
  async function resolveTarget(): Promise<string | null> {
    if (!action.target) return null
    const el = await driver.find(action.target)
    return el?.id ?? null
  }

  let captureResult: Awaited<ReturnType<typeof driver['actAndCapture']>> | null = null

  try {
    captureResult = await driver.actAndCapture(async () => {
      const elementId = await resolveTarget()

      if (!elementId) {
        // Element not found by accessible name — for scroll/press we don't need one
        if (action.type === 'press') {
          await driver.pressKey(action.value ?? 'Enter')
          return
        }
        if (action.type === 'scroll') {
          const delta = action.value ? parseInt(action.value, 10) : 300
          await driver.scroll(delta)
          return
        }
        throw new Error(`Element not found: "${action.target}"`)
      }

      switch (action.type) {
        case 'click':
          await driver.click(elementId)
          break
        case 'type':
          await driver.type(elementId, action.value ?? '')
          break
        case 'fill':
          await driver.fill(elementId, action.value ?? '')
          break
        case 'hover':
          await driver.hover(elementId)
          break
        case 'press':
          await driver.pressKey(action.value ?? 'Enter')
          break
        case 'scroll': {
          const delta = action.value ? parseInt(action.value, 10) : 300
          await driver.scroll(delta)
          break
        }
        case 'select':
          await driver.select(elementId, action.value ?? '')
          break
        case 'check':
          await driver.check(elementId)
          break
        case 'doubleClick':
          await driver.doubleClick(elementId)
          break
        case 'rightClick':
          await driver.rightClick(elementId)
          break
        default:
          throw new Error(`Unknown action type: ${(action as { type: string }).type}`)
      }
    })
  } catch (err) {
    actionSuccess = false
    actionError = err instanceof Error ? err.message : String(err)
    // Build a stub captureResult so assertions can still run on an empty after state
    const emptyScreenshot = Buffer.alloc(0)
    captureResult = {
      before: { elements: [], screenshot: emptyScreenshot },
      after: { elements: [], screenshot: emptyScreenshot },
      diff: { addedElements: [], removedElements: [], pixelDiff: 0 },
    }
  }

  const actionDuration = Date.now() - actionStart

  // Run assertions
  const assertions: InteractionResult['assertions'] = []

  if (expectation) {
    const afterElements = captureResult.after.elements

    // visible — element should appear in after state
    if (expectation.visible !== undefined) {
      const name = expectation.visible
      const found = afterElements.some(
        (e) =>
          e.label?.toLowerCase().includes(name.toLowerCase()) ||
          e.value?.toString().toLowerCase().includes(name.toLowerCase()),
      )
      assertions.push({
        check: `visible: "${name}"`,
        passed: found,
        detail: found
          ? `Element "${name}" found in after state`
          : `Element "${name}" not found in after state (${afterElements.length} elements)`,
      })
    }

    // hidden — element should NOT appear in after state
    if (expectation.hidden !== undefined) {
      const name = expectation.hidden
      const found = afterElements.some(
        (e) =>
          e.label?.toLowerCase().includes(name.toLowerCase()) ||
          e.value?.toString().toLowerCase().includes(name.toLowerCase()),
      )
      assertions.push({
        check: `hidden: "${name}"`,
        passed: !found,
        detail: found
          ? `Element "${name}" still present in after state (expected hidden)`
          : `Element "${name}" correctly absent in after state`,
      })
    }

    // text — any element's label or value contains the text
    if (expectation.text !== undefined) {
      const text = expectation.text.toLowerCase()
      const found = afterElements.some(
        (e) =>
          e.label?.toLowerCase().includes(text) ||
          e.value?.toString().toLowerCase().includes(text),
      )
      assertions.push({
        check: `text: "${expectation.text}"`,
        passed: found,
        detail: found
          ? `Text "${expectation.text}" found in after state`
          : `Text "${expectation.text}" not found in any element`,
      })
    }

    // count — number of elements matching (uses visible target, or all interactive elements if no visible)
    if (expectation.count !== undefined) {
      if (expectation.visible !== undefined) {
        const name = expectation.visible.toLowerCase()
        const matching = afterElements.filter(
          (e) =>
            e.label?.toLowerCase().includes(name) ||
            e.value?.toString().toLowerCase().includes(name),
        )
        const passed = matching.length === expectation.count
        assertions.push({
          check: `count: ${expectation.count} of "${expectation.visible}"`,
          passed,
          detail: `Found ${matching.length} elements matching "${expectation.visible}" (expected ${expectation.count})`,
        })
      } else {
        // count without visible — count all interactive elements
        const interactive = afterElements.filter((e) => e.actions && e.actions.length > 0)
        const passed = interactive.length === expectation.count
        assertions.push({
          check: `count: ${expectation.count} interactive elements`,
          passed,
          detail: `Found ${interactive.length} interactive elements (expected ${expectation.count})`,
        })
      }
    }

    // screenshot — save the after screenshot with a given name
    if (expectation.screenshot !== undefined) {
      try {
        await mkdir(outputDir, { recursive: true })
        const screenshotPath = join(outputDir, `${expectation.screenshot}.png`)
        await writeFile(screenshotPath, captureResult.after.screenshot)
        assertions.push({
          check: `screenshot: "${expectation.screenshot}"`,
          passed: true,
          detail: `Screenshot saved to ${screenshotPath}`,
        })
      } catch (err) {
        assertions.push({
          check: `screenshot: "${expectation.screenshot}"`,
          passed: false,
          detail: `Failed to save screenshot: ${err instanceof Error ? err.message : String(err)}`,
        })
      }
    }
  }

  return {
    url,
    step,
    action: { success: actionSuccess, duration: actionDuration, error: actionError },
    assertions,
    before: {
      screenshot: captureResult.before.screenshot,
      elementCount: captureResult.before.elements.length,
    },
    after: {
      screenshot: captureResult.after.screenshot,
      elementCount: captureResult.after.elements.length,
    },
    diff: {
      addedElements: captureResult.diff.addedElements.map((e) => e.label || e.id),
      removedElements: captureResult.diff.removedElements.map((e) => e.label || e.id),
      pixelDiff: captureResult.diff.pixelDiff,
    },
  }
}

// ─── Argument Parsers ──────────────────────────────────────

/**
 * Parse CLI action arg into an InteractionStep action.
 *
 * Format: `action[:role]:target[:value]`
 * Examples:
 *   "click:button:FlowDoro"     → { type: 'click', target: 'FlowDoro' }
 *   "type:textbox:Search:debug" → { type: 'type', target: 'Search', value: 'debug' }
 *   "press:Enter"               → { type: 'press', value: 'Enter' }
 *   "scroll:300"                → { type: 'scroll', value: '300' }
 */
export function parseActionArg(arg: string): InteractionStep['action'] {
  const ACTION_TYPES = new Set([
    'click', 'type', 'fill', 'hover', 'press', 'scroll',
    'select', 'check', 'doubleClick', 'rightClick',
  ])

  const parts = arg.split(':')
  if (parts.length < 1) throw new Error(`Invalid action arg: "${arg}"`)

  const type = parts[0] as InteractionStep['action']['type']
  if (!ACTION_TYPES.has(type)) throw new Error(`Unknown action type: "${type}"`)

  // press and scroll only need a value, no target element
  if (type === 'press') {
    return { type, value: parts[1] ?? 'Enter' }
  }
  if (type === 'scroll') {
    return { type, value: parts[1] ?? '300' }
  }

  // Remaining parts: optional role hint, then target, then optional value
  // Format: action[:role]:target[:value]
  // We detect if parts[1] looks like a role (common ARIA roles)
  const KNOWN_ROLES = new Set([
    'button', 'link', 'textbox', 'checkbox', 'combobox', 'heading',
    'listitem', 'menuitem', 'radio', 'tab', 'img', 'input', 'select',
  ])

  let target: string
  let value: string | undefined

  if (parts.length === 2) {
    // action:target
    target = parts[1]
  } else if (parts.length === 3) {
    // action:role:target OR action:target:value
    if (KNOWN_ROLES.has(parts[1].toLowerCase())) {
      // action:role:target
      target = parts[2]
    } else {
      // action:target:value
      target = parts[1]
      value = parts[2]
    }
  } else if (parts.length >= 4) {
    // action:role:target:value
    if (KNOWN_ROLES.has(parts[1].toLowerCase())) {
      target = parts[2]
      value = parts.slice(3).join(':')
    } else {
      target = parts[1]
      value = parts.slice(2).join(':')
    }
  } else {
    throw new Error(`Cannot parse action arg: "${arg}"`)
  }

  return { type, target, value }
}

/**
 * Parse CLI expect arg into an InteractionStep expect object.
 *
 * Format: `type[:role]:value`
 * Examples:
 *   "heading:FlowDoro"   → { visible: 'FlowDoro' }
 *   "hidden:ModalOverlay"→ { hidden: 'ModalOverlay' }
 *   "text:Success"       → { text: 'Success' }
 *   "count:3"            → { count: 3 }
 */
export function parseExpectArg(arg: string): InteractionStep['expect'] {
  const parts = arg.split(':')
  if (parts.length < 2) throw new Error(`Invalid expect arg: "${arg}"`)

  const keyword = parts[0].toLowerCase()

  switch (keyword) {
    case 'hidden':
      return { hidden: parts.slice(1).join(':') }
    case 'text':
      return { text: parts.slice(1).join(':') }
    case 'count':
      return { count: parseInt(parts[1], 10) }
    default:
      // Treat as visible (keyword is a role hint, or "visible" keyword itself)
      // "heading:FlowDoro" → visible: 'FlowDoro'
      // "visible:FlowDoro" → visible: 'FlowDoro'
      // "FlowDoro"         → visible: 'FlowDoro' (whole arg)
      if (keyword === 'visible') {
        return { visible: parts.slice(1).join(':') }
      }
      // keyword is a role hint — extract the target name
      return { visible: parts.slice(1).join(':') }
  }
}

// ─── Formatter ────────────────────────────────────────────

/**
 * Human-readable output for a single InteractionResult.
 */
export function formatInteractionResult(result: InteractionResult): string {
  const lines: string[] = []
  const { step, action, assertions, before, after, diff } = result

  const statusIcon = action.success ? 'PASS' : 'FAIL'
  lines.push(`[${statusIcon}] ${step.action.type} "${step.action.target ?? step.action.value}" (${action.duration}ms)`)

  if (action.error) {
    lines.push(`  Error: ${action.error}`)
  }

  lines.push(`  Before: ${before.elementCount} elements`)
  lines.push(`  After:  ${after.elementCount} elements`)

  if (diff.addedElements.length > 0) {
    lines.push(`  Added:   ${diff.addedElements.slice(0, 5).join(', ')}${diff.addedElements.length > 5 ? ` (+${diff.addedElements.length - 5} more)` : ''}`)
  }
  if (diff.removedElements.length > 0) {
    lines.push(`  Removed: ${diff.removedElements.slice(0, 5).join(', ')}${diff.removedElements.length > 5 ? ` (+${diff.removedElements.length - 5} more)` : ''}`)
  }
  if (diff.pixelDiff > 0) {
    lines.push(`  Visual:  ${diff.pixelDiff} pixels changed`)
  }

  if (assertions.length > 0) {
    lines.push('  Assertions:')
    for (const a of assertions) {
      const icon = a.passed ? 'PASS' : 'FAIL'
      lines.push(`    [${icon}] ${a.check}`)
      if (!a.passed) {
        lines.push(`         ${a.detail}`)
      }
    }
  }

  return lines.join('\n')
}
