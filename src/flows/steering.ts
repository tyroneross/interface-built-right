import { setTimeout as delay } from 'node:timers/promises'
import { z } from 'zod'
import type { EngineDriver, SteeringElement, SteeringPoint } from '../engine/driver.js'
import type { Element } from '../engine/types.js'

const targetSchema = z.strictObject({
  name: z.string().trim().min(1).max(250),
  role: z.string().trim().min(1).max(50),
})
const conditionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('visible'), target: targetSchema }),
  z.strictObject({ type: z.literal('absent'), target: targetSchema }),
  z.strictObject({ type: z.literal('valueEquals'), target: targetSchema, value: z.string().max(2000) }),
  z.strictObject({ type: z.literal('pathEquals'), path: z.string().startsWith('/').max(2000) }),
])
export const steeringScriptSchema = z.strictObject({
  version: z.literal(1),
  viewport: z.strictObject({
    width: z.number().int().min(240).max(2560),
    height: z.number().int().min(240).max(2560),
  }),
  steps: z.array(z.strictObject({
    id: z.string().trim().min(1).max(80),
    anchor: targetSchema,
    vector: z.strictObject({ dx: z.number().min(-1).max(1), dy: z.number().min(-1).max(1) }),
    target: targetSchema,
    action: z.discriminatedUnion('type', [
      z.strictObject({ type: z.literal('click') }),
      z.strictObject({ type: z.literal('type'), text: z.string().min(1).max(2000) }),
    ]),
    when: conditionSchema.optional(),
    expect: conditionSchema,
    readyTimeoutMs: z.number().int().min(0).max(10000).default(2000),
    timeoutMs: z.number().int().min(200).max(60000).default(2000),
  })).min(1).max(30),
}).refine(({ steps }) => new Set(steps.map(({ id }) => id)).size === steps.length, {
  path: ['steps'],
  message: 'Step IDs must be unique',
})

type Target = z.infer<typeof targetSchema>
type Condition = z.infer<typeof conditionSchema>
type SteeringScript = z.infer<typeof steeringScriptSchema>
type SteeringStep = SteeringScript['steps'][number]
type Driver = Pick<EngineDriver, 'accessibility' | 'evaluate' | 'getPendingDialog'
  | 'inspectSteeringElement' | 'steerPointer'>

interface Observation {
  matched: boolean
  actual: string | null
}

interface StepReceipt {
  id: string
  status: 'passed' | 'failed' | 'skipped'
  action: 'click' | 'type'
  anchor: Target
  target: Target
  vector: { dx: number; dy: number }
  expect: Condition
  guard?: { when: Condition; observed: Observation }
  aim?: { from: SteeringPoint; to: SteeringPoint; viewport: SteeringElement['viewport'] }
  before?: Observation
  after?: Observation
  reason?: string
}

export interface SteeringReceipt {
  version: 1
  success: boolean
  steps: StepReceipt[]
  remainingSteps: number
  failure?: string
}

function exactElement(elements: Element[], target: Target): Element | undefined {
  const matches = elements.filter(element => element.label === target.name && element.role === target.role)
  if (matches.length > 1) throw new Error(`Ambiguous target "${target.name}" (${target.role})`)
  return matches[0]
}

async function resolveStepElements(driver: Driver, step: SteeringStep, elements: Element[]) {
  const deadline = performance.now() + step.readyTimeoutMs
  let firstSample = true
  for (;;) {
    if (driver.getPendingDialog()) throw new Error('A browser dialog interrupted the step')
    const anchor = exactElement(elements, step.anchor)
    const target = exactElement(elements, step.target)
    const remaining = deadline - performance.now()
    if (anchor && target && (firstSample || remaining > 0)) return { anchor, target }
    if (remaining <= 0) {
      if (anchor && target) throw new Error('Anchor and target were found after the readiness deadline')
      const missing = anchor ? step.target : step.anchor
      throw new Error(`${anchor ? 'Target' : 'Anchor'} "${missing.name}" (${missing.role}) is absent`)
    }
    await delay(Math.min(100, remaining))
    elements = await driver.accessibility.getSnapshot()
    firstSample = false
  }
}

async function pagePath(driver: Driver, expectedOrigin: string): Promise<string> {
  if (driver.getPendingDialog()) throw new Error('A browser dialog interrupted the step')
  const page = await driver.evaluate('({ origin: location.origin, path: location.pathname })') as {
    origin: string
    path: string
  }
  if (page.origin !== expectedOrigin) throw new Error('The page left the requested origin')
  return page.path
}

async function observe(
  driver: Driver, condition: Condition, origin: string, path: string, elements?: Element[],
): Promise<Observation> {
  if (condition.type === 'pathEquals') {
    return { matched: condition.path === path, actual: path }
  }
  const element = exactElement(elements ?? await driver.accessibility.getSnapshot(), condition.target)
  if (!element) return { matched: condition.type === 'absent', actual: 'absent' }
  const { visible } = await driver.inspectSteeringElement(element.id, undefined, origin)
  if (!visible) return { matched: false, actual: 'hidden' }
  if (condition.type === 'valueEquals') return { matched: condition.value === element.value, actual: element.value }
  return { matched: condition.type === 'visible', actual: 'visible' }
}

function aimAt(element: SteeringElement, vector: StepReceipt['vector']): NonNullable<StepReceipt['aim']> {
  const { bounds, viewport } = element
  if (!element.visible) throw new Error('Anchor is hidden')
  const from = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  const to = { x: from.x + vector.dx * bounds.width, y: from.y + vector.dy * bounds.height }
  return { from, to, viewport }
}

function insideViewport(point: SteeringPoint, viewport: SteeringElement['viewport']): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < viewport.width && point.y < viewport.height
}

export async function runSteering(
  driver: Driver, script: SteeringScript, origin: string,
): Promise<SteeringReceipt> {
  const receipts: StepReceipt[] = []
  const finish = (failure?: string): SteeringReceipt => ({
    version: 1,
    success: failure === undefined,
    steps: receipts,
    remainingSteps: script.steps.length - receipts.length,
    ...(failure === undefined ? {} : { failure }),
  })

  for (const step of script.steps) {
    const { id, anchor, vector, target, expect, when, action, timeoutMs } = step
    const receipt: StepReceipt = { id, anchor, vector, target, expect, action: action.type, status: 'failed' }
    receipts.push(receipt)
    try {
      const path = await pagePath(driver, origin)
      const elements = await driver.accessibility.getSnapshot()
      if (when) {
        const observed = await observe(driver, when, origin, path, elements)
        receipt.guard = { when, observed }
        if (!observed.matched) {
          receipt.status = 'skipped'
          continue
        }
      }
      const start = await resolveStepElements(driver, step, elements)

      const geometry = await driver.inspectSteeringElement(start.anchor.id, undefined, origin)
      const aim = aimAt(geometry, vector)
      receipt.aim = aim
      if (![aim.from, aim.to].every(point => insideViewport(point, aim.viewport))) {
        throw new Error('Anchor or planned point is outside the viewport')
      }

      const verifyBefore = async (event: 'move' | 'click' | 'type') => {
        const currentPath = await pagePath(driver, origin)
        const snapshot = await driver.accessibility.getSnapshot()
        if (exactElement(snapshot, anchor)?.id !== start.anchor.id) {
          throw new Error('The anchor no longer identifies the original element')
        }
        if (exactElement(snapshot, target)?.id !== start.target.id) {
          throw new Error('The target no longer identifies the original element')
        }
        if (when) {
          const observed = await observe(driver, when, origin, currentPath, snapshot)
          if (!observed.matched) {
            receipt.guard = { when, observed }
            throw new Error('The step guard changed before input')
          }
        }
        receipt.before = await observe(driver, expect, origin, currentPath, snapshot)
        if (receipt.before.matched) {
          const actionPhase = event === 'type' ? 'text insertion' : 'the click'
          throw new Error(`Expected state already held before ${actionPhase}`)
        }
      }
      await verifyBefore('move')
      await driver.steerPointer(aim.from, start.anchor.id, aim.to, start.target.id, origin, action, verifyBefore)

      const deadline = performance.now() + timeoutMs
      let previousMatched = false
      let settled = false
      let retryMs = 60
      do {
        const currentPath = await pagePath(driver, origin)
        receipt.after = await observe(driver, expect, origin, currentPath)
        if (receipt.after.matched && previousMatched && performance.now() < deadline) {
          settled = true
          break
        }
        previousMatched = receipt.after.matched
        const remaining = deadline - performance.now()
        if (remaining <= 0) break
        await delay(Math.min(previousMatched ? 60 : retryMs, remaining))
        retryMs = Math.min(retryMs * 2, 250)
      } while (performance.now() < deadline)
      if (!settled) {
        throw new Error(`Expected state did not settle within ${timeoutMs} ms`)
      }
      receipt.status = 'passed'
    } catch (error) {
      receipt.reason = error instanceof Error ? error.message : String(error)
      return finish(receipt.reason)
    }
  }
  return finish(receipts.some(receipt => receipt.status === 'passed') ? undefined : 'All steps were skipped')
}
