/**
 * Keyboard synthesis capability (E2-B) — chord delivery + the before/after AX
 * diff that turns a raw CGEvent post into a validated `ActionOutcome`.
 *
 * Delivery is a two-phase attempt, mirroring the 3e9375a foreground-retry
 * machinery already used for extraction (`macos.ts`'s `activateMacOSProcess` /
 * `retryMacOSExtractionAfterActivation`):
 *   1. Background — `CGEventPostToPid` (Swift `deliverKeystroke(foreground:
 *      false)`). Does not steal focus, but `CGEventPostToPid` has no return
 *      value — Apple's own developer forums document apps that ignore or
 *      misroute events posted this way, so "success" here only means the
 *      event was constructed and posted, not that anything reacted.
 *   2. Foreground — only attempted when (1) produced no observable change:
 *      activates the target app, then posts via the global HID tap (the same
 *      mechanism `mobile-ui/sim-driver` already uses, generalized from a
 *      hardcoded simulator bundle id to an arbitrary pid).
 *
 * The validator is a generic AX-state diff (window id/title + focused element
 * path + element count) taken before and after each attempt — no semantic
 * knowledge of what a given chord is "supposed" to do. `passed` is true the
 * first time the signature changes; if neither attempt produces an observable
 * change, the outcome is a structured failure with before/after evidence —
 * the same honesty contract as F-09's "click that changes nothing" case.
 *
 * `runKeystrokeCapability` never throws: any failure (bad chord, missing
 * target process, AX I/O error) is folded into a failing `ActionOutcome`, so
 * `NativeBackend.keystroke` implementations stay structured-never-a-throw.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { ensureExtractor } from './extract.js';
import { findProcess } from './index.js';
import type { ActionOutcome } from '../action-outcome.js';
import type { KeystrokeSpec, NativeExtraction, NativeSessionTarget } from './backend.js';

const execFileAsync = promisify(execFile);

/** Settle delay between delivering a chord and re-extracting to check its effect. */
const SETTLE_MS = 220;

export interface KeystrokeDeliveryResult {
  success: boolean;
  error?: string;
}

export type KeystrokeDeliverFn = (
  pid: number,
  chord: string,
  foreground: boolean,
) => Promise<KeystrokeDeliveryResult>;

/** Resolve the pid a keystroke chord should target, for either target kind. */
export async function resolveKeystrokeTargetPid(target: NativeSessionTarget): Promise<number> {
  if (target.kind === 'macos') return target.pid;
  return findProcess('com.apple.iphonesimulator');
}

/**
 * Deliver a chord via the one-shot Swift extractor binary — the path
 * `RespawnBackend` always uses, and `DaemonBackend`'s respawn fallback uses
 * when the daemon has died mid-request.
 */
export const deliverKeystrokeOneShot: KeystrokeDeliverFn = async (pid, chord, foreground) => {
  const extractorPath = await ensureExtractor();
  const args: string[] = ['--pid', String(pid), '--keystroke', chord];
  if (foreground) args.push('--foreground');

  try {
    const { stdout } = await execFileAsync(extractorPath, args, { timeout: 5000 });
    return JSON.parse(stdout) as KeystrokeDeliveryResult;
  } catch (err: unknown) {
    // The binary exits 1 on failure — try to parse stdout for structured error.
    if (err && typeof err === 'object' && 'stdout' in err) {
      const execErr = err as { stdout?: string };
      const raw = (execErr.stdout ?? '').trim();
      if (raw) {
        try {
          return JSON.parse(raw) as KeystrokeDeliveryResult;
        } catch {
          // Fall through to the generic error below.
        }
      }
    }
    const message = err instanceof Error ? err.message : 'keystroke delivery failed';
    return { success: false, error: message };
  }
};

function countElements<T extends { children: T[] }>(elements: T[]): number {
  let total = 0;
  for (const el of elements) {
    total += 1;
    total += countElements(el.children);
  }
  return total;
}

function findFocusedPathMacOS(
  elements: Array<{ focused: boolean; path: number[]; children: unknown[] }>,
): number[] | null {
  for (const el of elements) {
    if (el.focused) return el.path;
    if (el.children.length > 0) {
      const found = findFocusedPathMacOS(
        el.children as Array<{ focused: boolean; path: number[]; children: unknown[] }>,
      );
      if (found) return found;
    }
  }
  return null;
}

/**
 * A compact signature of observable AX state — window identity, focused
 * element, and element count. Two extractions with an identical signature
 * are treated as "no observable effect" by the capability's validator.
 */
function axSignature(extraction: NativeExtraction): string {
  if (extraction.kind === 'not-found') return `not-found:${extraction.message}`;
  if (extraction.kind === 'macos') {
    const focused = findFocusedPathMacOS(extraction.elements);
    return [
      `window=${extraction.window.windowId}`,
      `title=${extraction.window.title}`,
      `count=${countElements(extraction.elements)}`,
      `focused=${focused ? focused.join('.') : 'none'}`,
    ].join('|');
  }
  // Simulator's legacy element shape exposes no `focused` flag today, so
  // element count is the best-effort signal for this target kind.
  return `count=${countElements(extraction.elements)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function keystrokeSuccess(chord: string, method: string, before: string, after: string): ActionOutcome {
  return {
    success: true,
    validator: {
      expected: `AX state changes after delivering chord "${chord}"`,
      observed: `AX state changed (${method}): ${before} -> ${after}`,
      passed: true,
    },
    provenance: { waitResult: method },
  };
}

function keystrokeFailure(chord: string, before: string, after: string, diff: string): ActionOutcome {
  return {
    success: false,
    validator: {
      expected: `AX state changes after delivering chord "${chord}"`,
      observed: diff,
      passed: false,
    },
    provenance: {},
    evidence: {
      beforeSignature: before,
      afterSignature: after,
      diff,
      alternatives: [],
    },
  };
}

/**
 * Run the full keystroke capability: resolve the target pid, capture a
 * before-signature, attempt background delivery, diff, and — only when the
 * background attempt delivered successfully but produced no observable
 * change — retry once via the foreground-activate path before declaring
 * failure. A hard delivery failure (unparseable chord, no such process) is
 * not retried in the other mode since the fault is not delivery-mode-specific.
 */
export async function runKeystrokeCapability(opts: {
  target: NativeSessionTarget;
  spec: KeystrokeSpec;
  resolvePid: () => Promise<number>;
  extract: () => Promise<NativeExtraction>;
  deliver: KeystrokeDeliverFn;
}): Promise<ActionOutcome> {
  const { spec, resolvePid, extract, deliver } = opts;
  const chord = spec.chord;

  const safeSignature = async (): Promise<string> => {
    try {
      return axSignature(await extract());
    } catch (err) {
      return `error:${err instanceof Error ? err.message : String(err)}`;
    }
  };

  try {
    const pid = await resolvePid();
    const before = await safeSignature();

    const backgroundDelivery = await deliver(pid, chord, false);
    if (!backgroundDelivery.success) {
      return keystrokeFailure(
        chord, before, before,
        `background delivery failed: ${backgroundDelivery.error ?? 'unknown error'}`,
      );
    }
    await sleep(SETTLE_MS);
    const afterBackground = await safeSignature();
    if (afterBackground !== before) {
      return keystrokeSuccess(chord, 'cgevent-pid-background', before, afterBackground);
    }

    // Background delivery posted but produced no observable change — retry
    // via foreground-activate before declaring the chord a no-op.
    const foregroundDelivery = await deliver(pid, chord, true);
    if (!foregroundDelivery.success) {
      return keystrokeFailure(
        chord, before, afterBackground,
        `background delivery produced no observable change; foreground-activate retry failed: ${foregroundDelivery.error ?? 'unknown error'}`,
      );
    }
    await sleep(SETTLE_MS);
    const afterForeground = await safeSignature();
    if (afterForeground !== before) {
      return keystrokeSuccess(chord, 'cgevent-foreground-fallback', before, afterForeground);
    }

    return keystrokeFailure(
      chord, before, afterForeground,
      'no observable AX state change after background and foreground-activate delivery',
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return keystrokeFailure(chord, 'unavailable', 'unavailable', `keystroke capability failed: ${message}`);
  }
}
