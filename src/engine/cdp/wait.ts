/**
 * Wait strategies — event-driven + polling hybrid.
 * Forked from Spectra — extended with event-driven waits and MutationObserver.
 */

import type { Element } from '../types.js'
import type { CdpConnection } from './connection.js'

type EvaluateFn = (expression: string) => Promise<unknown>

export interface WaitOptions {
  interval?: number     // Polling interval in ms (default: 100)
  stableTime?: number   // How long fingerprint must stay unchanged (default: 300)
  timeout?: number      // Max wait time in ms (default: 10000)
}

type SnapshotFn = () => Promise<Element[]>

export function buildFingerprint(elements: Element[]): string {
  return elements
    .filter((e) => e.actions.length > 0)
    .map((e) => `${e.role}:${e.label}:${e.enabled}`)
    .sort()
    .join('|')
}

/**
 * Poll-based stability detection (from Spectra).
 * Waits until AX tree fingerprint stops changing.
 */
export async function waitForStableTree(
  getSnapshot: SnapshotFn,
  options?: WaitOptions,
): Promise<{ elements: Element[]; timedOut: boolean }> {
  const interval = options?.interval ?? 100
  const stableTime = options?.stableTime ?? 300
  const timeout = options?.timeout ?? 10000

  let lastFingerprint = ''
  let stableSince = Date.now()
  const deadline = Date.now() + timeout

  while (Date.now() < deadline) {
    const elements = await getSnapshot()
    const fingerprint = buildFingerprint(elements)

    if (fingerprint === lastFingerprint) {
      if (Date.now() - stableSince >= stableTime) {
        return { elements, timedOut: false }
      }
    } else {
      lastFingerprint = fingerprint
      stableSince = Date.now()
    }

    await new Promise((r) => setTimeout(r, interval))
  }

  const elements = await getSnapshot()
  return { elements, timedOut: true }
}

/**
 * Event-driven wait — listens to CDP events and resolves when condition is met.
 * Combines event notification (coarse: something changed) with
 * fingerprint stability check (fine: it stopped changing).
 */
export async function waitForEvent(
  conn: CdpConnection,
  eventName: string,
  options?: { timeout?: number },
): Promise<void> {
  const timeout = options?.timeout ?? 10000

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      conn.off(eventName, handler)
      reject(new Error(`Timed out waiting for ${eventName} after ${timeout}ms`))
    }, timeout)

    const handler = () => {
      clearTimeout(timer)
      conn.off(eventName, handler)
      resolve()
    }

    conn.on(eventName, handler)
  })
}

/**
 * Wait for React/SPA hydration to complete.
 *
 * Strategy: after networkidle, poll the AX tree until the interactive element
 * fingerprint stays stable for a minimum duration. This catches SPAs that
 * mount, hydrate, and then render interactive elements after DOMContentLoaded.
 *
 * Also detects hydration markers when available:
 *  - window.__NEXT_DATA__ presence (Next.js)
 *  - React DevTools hook (__REACT_DEVTOOLS_GLOBAL_HOOK__)
 *  - document.readyState === 'complete'
 *
 * Use after waitForLoadState('networkidle'), before extracting elements.
 *
 * The conn parameter is accepted for interface consistency but is not used
 * in the polling path — callers that cannot provide a CdpConnection may pass
 * null and the function will fall back to pure AX-tree polling.
 */
export async function waitForHydration(
  _conn: CdpConnection | null,
  getSnapshot: SnapshotFn,
  evaluate: EvaluateFn,
  options?: WaitOptions & {
    /** Minimum interactive elements required before considering the page hydrated (default: 1) */
    minElements?: number;
    /** Extra wait after detected stability to absorb async handlers (default: 200ms) */
    settleTime?: number;
  },
): Promise<{ elements: Element[]; timedOut: boolean; hydrationDetected: boolean; reason: string }> {
  const timeout = options?.timeout ?? 10000
  const stableTime = options?.stableTime ?? 500
  const minElements = options?.minElements ?? 1
  const settleTime = options?.settleTime ?? 200
  const deadline = Date.now() + timeout

  // Fast path: detect hydration markers via evaluate
  let hydrationDetected = false
  let reason = 'timeout'
  try {
    const marker = await evaluate(`(function(){
      if (document.readyState !== 'complete') return null;
      if (typeof window === 'undefined') return null;
      var hasNext = typeof window.__NEXT_DATA__ !== 'undefined';
      var hasReact = typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined';
      var rootHydrated = false;
      try {
        var root = document.querySelector('#__next, #root, [data-reactroot]');
        rootHydrated = !!root && root.children.length > 0;
      } catch(e) {}
      return { hasNext: hasNext, hasReact: hasReact, rootHydrated: rootHydrated };
    })()`)
    if (marker && typeof marker === 'object') {
      const m = marker as { hasNext?: boolean; hasReact?: boolean; rootHydrated?: boolean }
      if (m.rootHydrated) {
        hydrationDetected = true
        reason = m.hasNext ? 'nextjs-marker' : m.hasReact ? 'react-marker' : 'root-populated'
      }
    }
  } catch {
    // Evaluate failed — fall through to polling
  }

  // Poll for AX tree stability + minElement threshold
  let lastFingerprint = ''
  let stableSince = Date.now()
  let lastElements: Element[] = []

  while (Date.now() < deadline) {
    const elements = await getSnapshot()
    lastElements = elements
    const fingerprint = buildFingerprint(elements)
    const hasEnough = elements.filter((e) => e.actions.length > 0).length >= minElements

    if (fingerprint === lastFingerprint && hasEnough) {
      if (Date.now() - stableSince >= stableTime) {
        if (settleTime > 0) {
          await new Promise((r) => setTimeout(r, settleTime))
        }
        const finalElements = await getSnapshot()
        return {
          elements: finalElements,
          timedOut: false,
          hydrationDetected: true,
          reason: hydrationDetected ? reason : 'ax-tree-stable',
        }
      }
    } else {
      lastFingerprint = fingerprint
      stableSince = Date.now()
    }

    await new Promise((r) => setTimeout(r, 100))
  }

  return {
    elements: lastElements,
    timedOut: true,
    hydrationDetected: false,
    reason: 'timeout',
  }
}

/**
 * Hybrid wait — subscribe to AX events, then confirm with stability check.
 * Best of both: events for notification, polling for confirmation.
 */
export async function waitForStable(
  conn: CdpConnection,
  getSnapshot: SnapshotFn,
  options?: WaitOptions & { eventName?: string },
): Promise<{ elements: Element[]; timedOut: boolean }> {
  const eventName = options?.eventName ?? 'Accessibility.nodesUpdated'
  const timeout = options?.timeout ?? 10000
  const stableTime = options?.stableTime ?? 300
  const deadline = Date.now() + timeout

  // Register event listener BEFORE first snapshot to avoid missing events
  let changed = false
  const handler = () => { changed = true }
  conn.on(eventName, handler)

  // Take initial snapshot (events during this await are captured by handler)
  let elements = await getSnapshot()
  let lastFingerprint = buildFingerprint(elements)
  let stableSince = Date.now()

  try {
    while (Date.now() < deadline) {
      if (changed) {
        changed = false
        elements = await getSnapshot()
        const fingerprint = buildFingerprint(elements)
        if (fingerprint !== lastFingerprint) {
          lastFingerprint = fingerprint
          stableSince = Date.now()
        }
      }

      if (Date.now() - stableSince >= stableTime) {
        return { elements, timedOut: false }
      }

      await new Promise((r) => setTimeout(r, 50))
    }

    elements = await getSnapshot()
    return { elements, timedOut: true }
  } finally {
    conn.off(eventName, handler)
  }
}
