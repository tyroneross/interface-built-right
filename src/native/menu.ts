/**
 * Menu traversal capability (E2-D) — walk a macOS app's menu bar (or an
 * already-open context menu) by an ordered list of item titles and AXPress
 * the final item, then validate the result via a before/after AX-tree diff.
 *
 * Mirrors keyboard.ts's shape: `Menu.swift` (Swift) owns the raw traversal
 * primitive (menu-bar vs context-menu resolution, lazy-submenu population);
 * this file owns the retry-free delivery wrapper + the generic AX-state-diff
 * validator that turns "the walk+press succeeded" into a validated
 * `ActionOutcome` — a menu command can succeed at the AX level (AXPress
 * returned true) yet still be a no-op (e.g. a disabled/backgrounded item), so
 * `passed` requires an observable state change, never just a non-throwing
 * call. This is the same honesty contract E2-B (keyboard) and E2-C
 * (lifecycle) established: a fired action with no observable effect is a
 * failure, not a success.
 *
 * Unlike keyboard.ts's two-phase background/foreground retry (a chord's
 * effect is otherwise unknowable, so a no-op retry in a different mode is
 * worth attempting), a menu selection is deterministic — either the path
 * resolved and the item fired, or it did not — so there is a single delivery
 * attempt here, and `deliver`'s own `failedSegment`/`error` already pinpoint
 * why a resolution failure happened.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { ensureExtractor } from './extract.js';
import { findProcess } from './index.js';
import type { ActionOutcome } from '../action-outcome.js';
import type { MenuSpec, NativeExtraction, NativeSessionTarget } from './backend.js';

const execFileAsync = promisify(execFile);

/** Settle delay between delivering a menu selection and re-extracting to check its effect. */
const SETTLE_MS = 250;

export interface MenuDeliveryResult {
  success: boolean;
  error?: string;
  /** Index within the requested menuPath where resolution failed, if any. */
  failedSegment?: number;
  /** "menu-bar" | "context-menu" — which traversal mode matched. */
  matchedVia?: string;
}

export type MenuDeliverFn = (pid: number, menuPath: string[]) => Promise<MenuDeliveryResult>;

/** Resolve the pid a menu path should target, for either target kind. */
export async function resolveMenuTargetPid(target: NativeSessionTarget): Promise<number> {
  if (target.kind === 'macos') return target.pid;
  return findProcess('com.apple.iphonesimulator');
}

/**
 * Deliver a menu path via the one-shot Swift extractor binary — the path
 * `RespawnBackend` always uses, and `DaemonBackend`'s respawn fallback uses
 * when the daemon has died mid-request.
 */
export const deliverMenuOneShot: MenuDeliverFn = async (pid, menuPath) => {
  const extractorPath = await ensureExtractor();
  const args: string[] = ['--pid', String(pid), '--menu-path', JSON.stringify(menuPath)];

  try {
    const { stdout } = await execFileAsync(extractorPath, args, { timeout: 5000 });
    return JSON.parse(stdout) as MenuDeliveryResult;
  } catch (err: unknown) {
    // The binary exits 1 on failure — try to parse stdout for structured error.
    if (err && typeof err === 'object' && 'stdout' in err) {
      const execErr = err as { stdout?: string };
      const raw = (execErr.stdout ?? '').trim();
      if (raw) {
        try {
          return JSON.parse(raw) as MenuDeliveryResult;
        } catch {
          // Fall through to the generic error below.
        }
      }
    }
    const message = err instanceof Error ? err.message : 'menu delivery failed';
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
 * are treated as "no observable effect" by the capability's validator, the
 * same generic diff `keyboard.ts` uses for chord delivery.
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
  return `count=${countElements(extraction.elements)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function menuLabel(menuPath: string[]): string {
  return menuPath.join(' > ');
}

function menuSuccess(menuPath: string[], method: string, before: string, after: string): ActionOutcome {
  return {
    success: true,
    validator: {
      expected: `AX state changes after selecting menu path "${menuLabel(menuPath)}"`,
      observed: `AX state changed (${method}): ${before} -> ${after}`,
      passed: true,
    },
    provenance: { waitResult: method },
  };
}

function menuFailure(menuPath: string[], before: string, after: string, diff: string): ActionOutcome {
  return {
    success: false,
    validator: {
      expected: `AX state changes after selecting menu path "${menuLabel(menuPath)}"`,
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
 * Run the full menu capability: resolve the target pid, capture a
 * before-signature, deliver the traversal (menu-bar or context-menu walk +
 * final AXPress), and validate via an AX-state diff. A resolution failure
 * (unknown menu-bar item, item not found at some hop, AXPress failure) is
 * reported with the failing segment named; a delivery that reports success
 * but produces no observable AX change is still a failure — the falsifier
 * this capability exists to close ("menu fires but selection unverified").
 */
export async function runMenuCapability(opts: {
  target: NativeSessionTarget;
  spec: MenuSpec;
  resolvePid: () => Promise<number>;
  extract: () => Promise<NativeExtraction>;
  deliver: MenuDeliverFn;
}): Promise<ActionOutcome> {
  const { spec, resolvePid, extract, deliver } = opts;
  const menuPath = spec.menuPath ?? [];

  if (menuPath.length === 0) {
    return menuFailure(menuPath, 'n/a', 'n/a', 'menuPath must have at least one segment');
  }

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

    const delivery = await deliver(pid, menuPath);
    if (!delivery.success) {
      const segment =
        delivery.failedSegment !== undefined
          ? ` (failed at segment ${delivery.failedSegment}: "${menuPath[delivery.failedSegment]}")`
          : '';
      return menuFailure(
        menuPath, before, before,
        `menu traversal failed${segment}: ${delivery.error ?? 'unknown error'}`,
      );
    }

    await sleep(SETTLE_MS);
    const after = await safeSignature();
    if (after !== before) {
      return menuSuccess(menuPath, delivery.matchedVia ?? 'menu-select', before, after);
    }

    return menuFailure(
      menuPath, before, after,
      'menu item selected but no observable AX state change (selection unverified)',
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return menuFailure(menuPath, 'unavailable', 'unavailable', `menu capability failed: ${message}`);
  }
}
