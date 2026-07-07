/**
 * Actionability — auto-wait check that an element is present, visible,
 * enabled, and positionally stable before a verb (click/type/fill/...) acts
 * on it.
 *
 * Mirrors the actionability model pioneered by other browser-automation
 * engines (present → visible → enabled → stable), reimplemented here on
 * IBR's CDP-direct primitives — no Playwright dependency.
 *
 * This module is transport-agnostic: it knows nothing about CDP, AX trees,
 * elementIds, or CSS selectors. Callers supply a `resolveAndProbe` closure
 * that, on every poll tick, (a) resolves the CURRENT live target — free to
 * re-resolve a stale reference however makes sense for that caller — and
 * (b) reports its present/visible/enabled/rect state. This lets
 * EngineDriver re-resolve a stale backendNodeId by the element's last-known
 * name+role, while CompatPage simply re-queries its CSS selector every
 * tick — both get the same present+visible+enabled+stable contract with
 * zero fixed sleeps on the success path.
 *
 * "No fixed sleeps" means no fire-and-forget `setTimeout` inserted before or
 * after an action on the assumption that "enough time probably passed" —
 * the bounded poll tick below IS the wait mechanism itself; it exits the
 * instant the condition holds instead of always waiting a fixed duration.
 */

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface ActionabilityState {
  /** The node still resolves to a live, connected DOM node. */
  present: boolean
  /** display/visibility/opacity/size all indicate the node is rendered,
   *  and it is not occluded by another element at its own center point. */
  visible: boolean
  /** Not disabled (native `disabled` property or `aria-disabled="true"`). */
  enabled: boolean
  /** Bounding rect, used for the stability comparison. Null when not present. */
  rect: Rect | null
}

export interface ProbeResult<T> {
  target: T
  state: ActionabilityState
}

/**
 * Resolves + probes the current target on every poll tick.
 * Return `null` to mean "could not resolve at all this tick" (e.g. a CSS
 * selector currently matches nothing, or a stale id has no re-resolution
 * candidate yet) — treated the same as `present: false`; polling continues
 * until timeout.
 */
export type ResolveAndProbe<T> = () => Promise<ProbeResult<T> | null>

export interface WaitForActionableOptions {
  /** Max total wait, ms. Default 5000. */
  timeout?: number
  /** Poll tick interval, ms. Default 30. */
  pollInterval?: number
  /** Consecutive matching-rect samples required to call the position "stable". Default 2. */
  requiredStableChecks?: number
}

const DEFAULT_TIMEOUT = 5000
const DEFAULT_POLL_INTERVAL = 30
const DEFAULT_REQUIRED_STABLE_CHECKS = 2

export class ActionabilityTimeoutError extends Error {
  constructor(
    public readonly reason: string,
    public readonly elapsedMs: number,
  ) {
    super(`Element was not actionable within ${elapsedMs}ms: ${reason}`)
    this.name = 'ActionabilityTimeoutError'
  }
}

function rectEqual(a: Rect | null, b: Rect | null): boolean {
  if (!a || !b) return false
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

/**
 * Poll `resolveAndProbe` until the resolved target is present + visible +
 * enabled, and its rect has stayed unchanged for `requiredStableChecks`
 * consecutive samples. Returns the target from the successful sample.
 *
 * Throws `ActionabilityTimeoutError` (never silently proceeds) when the
 * timeout elapses without ever reaching a stable actionable state — the
 * error carries the last-seen failure reason ("not present" / "not visible"
 * / "disabled" / "position not yet stable") for caller diagnostics.
 */
export async function waitForActionable<T>(
  resolveAndProbe: ResolveAndProbe<T>,
  options: WaitForActionableOptions = {},
): Promise<T> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT
  const pollInterval = options.pollInterval ?? DEFAULT_POLL_INTERVAL
  const requiredStable = Math.max(1, options.requiredStableChecks ?? DEFAULT_REQUIRED_STABLE_CHECKS)

  const start = Date.now()
  const deadline = start + timeout

  let lastRect: Rect | null = null
  let stableCount = 0
  let lastReason = 'not present'

  while (true) {
    const result = await resolveAndProbe()

    if (!result) {
      lastReason = 'not resolvable'
      stableCount = 0
      lastRect = null
    } else {
      const { target, state } = result
      if (!state.present) {
        lastReason = 'not present'
        stableCount = 0
        lastRect = null
      } else if (!state.visible) {
        lastReason = 'not visible (hidden or covered)'
        stableCount = 0
        lastRect = null
      } else if (!state.enabled) {
        lastReason = 'disabled'
        stableCount = 0
        lastRect = null
      } else {
        if (rectEqual(lastRect, state.rect)) {
          stableCount += 1
        } else {
          stableCount = 1
        }
        lastRect = state.rect
        lastReason = 'position not yet stable'

        if (stableCount >= requiredStable) {
          return target
        }
      }
    }

    if (Date.now() >= deadline) {
      throw new ActionabilityTimeoutError(lastReason, Date.now() - start)
    }
    await new Promise((r) => setTimeout(r, pollInterval))
  }
}
