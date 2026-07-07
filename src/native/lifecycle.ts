/**
 * App lifecycle capability (E2-C) — launch / switch / quit driven by OS-level
 * process control (`open -a`/`open -b`, `osascript` activate/quit), never the
 * AX event-synthesis path. Unlike keyboard.ts's chord delivery (which diffs
 * AX-tree signatures because a chord's effect is otherwise unknowable), a
 * lifecycle op has a concrete target end-state — running+frontmost for
 * launch/switch, exited for quit — so the validator here confirms that
 * absolute end-state via `findProcess`/`frontmostPid`/`isRunning`, not a
 * before/after diff. `runLifecycleCapability` never throws: any failure
 * (app not found, quit hung, activation failed) folds into a failing
 * `ActionOutcome` with before/after evidence, the same honesty contract E2-B
 * established.
 *
 * `LifecycleOps` is injected so the state machine (poll/verify sequencing) is
 * unit-testable without spawning `open`/`osascript` — mirrors
 * `runKeystrokeCapability`'s injected `resolvePid`/`extract`/`deliver`.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
// `findProcess` goes through the native barrel (matches backend.ts/keyboard.ts
// so existing test mocks on '../native/index.js' keep intercepting it).
// `activateMacOSProcess` is not on that barrel (E4-B's frozen native-tools.js
// mock enumerates the barrel's exports explicitly) — imported directly from
// its owning module instead.
import { findProcess } from './index.js';
import { activateMacOSProcess } from './macos.js';
import type { ActionOutcome } from '../action-outcome.js';
import type { AppLifecycleOp, LifecycleSpec, NativeSessionTarget } from './backend.js';

const execFileAsync = promisify(execFile);

/** How long `launch` waits for the process to appear + become frontmost. */
const LAUNCH_TIMEOUT_MS = 8000;
/** How long `quit` waits for the process to actually exit. */
const QUIT_TIMEOUT_MS = 6000;
const POLL_MS = 250;

/** Bundle-id-shaped string (e.g. `com.apple.TextEdit`) vs a plain app name. */
const BUNDLE_ID_RE = /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/;

export interface LifecycleOps {
  /** Resolve an app name/bundle id to a running pid; throws if not found. */
  findProcess: (appNameOrBundleId: string) => Promise<number>;
  /** Best-effort launch (`open -a`/`open -b`). Does not itself confirm the app is running. */
  launch: (app: string) => Promise<void>;
  /** Bring a running process to the foreground. Returns whether the call itself succeeded. */
  activate: (pid: number) => Promise<boolean>;
  /** Ask the app to quit gracefully, by whichever of pid/app-name is available. */
  quit: (target: { pid: number; app?: string }) => Promise<void>;
  /** pid of the current frontmost app, or null if it cannot be determined. */
  frontmostPid: () => Promise<number | null>;
  /** True iff a process with this pid is currently alive. */
  isRunning: (pid: number) => Promise<boolean>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollUntil(check: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const started = Date.now();
  if (await check()) return true;
  while (Date.now() - started < timeoutMs) {
    await sleep(POLL_MS);
    if (await check()) return true;
  }
  return false;
}

function lifecycleSuccess(expected: string, observed: string, waitResult: string): ActionOutcome {
  return {
    success: true,
    validator: { expected, observed, passed: true },
    provenance: { waitResult },
  };
}

function lifecycleFailure(expected: string, observed: string, before: string, after: string): ActionOutcome {
  return {
    success: false,
    validator: { expected, observed, passed: false },
    provenance: {},
    evidence: { beforeSignature: before, afterSignature: after, diff: observed, alternatives: [] },
  };
}

/** Human-readable label for a target with no explicit `spec.app` override. */
function describeTarget(target: NativeSessionTarget): string {
  if (target.kind === 'macos') return target.app ?? `pid-${target.pid}`;
  return `simulator ${target.device.name}`;
}

/** Resolve the pid `switch`/`quit` should act on: an explicit `spec.app` override wins. */
async function resolveTargetPid(
  target: NativeSessionTarget,
  spec: LifecycleSpec,
  ops: LifecycleOps,
): Promise<number> {
  if (spec.app) return ops.findProcess(spec.app);
  if (target.kind === 'macos') return target.pid;
  throw new Error('simulator sessions require an explicit app name for switch/quit');
}

async function runLaunch(spec: LifecycleSpec, ops: LifecycleOps): Promise<ActionOutcome> {
  const expected = spec.app ? `${spec.app} running and frontmost` : 'app running and frontmost';
  if (!spec.app) {
    return lifecycleFailure(expected, 'launch requires an app name or bundle id', 'n/a', 'n/a');
  }

  try {
    await ops.launch(spec.app);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return lifecycleFailure(expected, `launch command failed: ${message}`, 'not-running', 'not-running');
  }

  let pid: number | null = null;
  const appeared = await pollUntil(async () => {
    try {
      pid = await ops.findProcess(spec.app!);
      return true;
    } catch {
      return false;
    }
  }, LAUNCH_TIMEOUT_MS);

  if (!appeared || pid === null) {
    return lifecycleFailure(
      expected,
      `process did not appear within ${LAUNCH_TIMEOUT_MS}ms`,
      'not-running',
      'not-running',
    );
  }
  const resolvedPid: number = pid;

  let frontmost = (await ops.frontmostPid()) === resolvedPid;
  if (!frontmost) {
    // `open -a` normally activates the app itself; retry once for an app that
    // was already running in the background and needs an explicit nudge.
    await ops.activate(resolvedPid);
    await sleep(POLL_MS);
    frontmost = (await ops.frontmostPid()) === resolvedPid;
  }

  const after = `pid=${resolvedPid}|frontmost=${frontmost}`;
  if (!frontmost) {
    return lifecycleFailure(expected, `process running (pid=${resolvedPid}) but not frontmost`, 'not-running', after);
  }
  return lifecycleSuccess(expected, after, 'launch-confirmed');
}

async function runSwitch(
  target: NativeSessionTarget,
  spec: LifecycleSpec,
  ops: LifecycleOps,
): Promise<ActionOutcome> {
  const label = spec.app ?? describeTarget(target);
  const expected = `${label} frontmost`;

  let pid: number;
  try {
    pid = await resolveTargetPid(target, spec, ops);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return lifecycleFailure(expected, `could not resolve target process: ${message}`, 'unavailable', 'unavailable');
  }

  const before = `frontmost=${await ops.frontmostPid()}`;
  const activated = await ops.activate(pid);
  await sleep(POLL_MS);
  const frontmostAfter = await ops.frontmostPid();
  const after = `frontmost=${frontmostAfter}`;

  if (!activated || frontmostAfter !== pid) {
    return lifecycleFailure(
      expected,
      `activation ${activated ? 'ran' : 'failed'}; frontmost pid is ${frontmostAfter ?? 'unknown'}`,
      before,
      after,
    );
  }
  return lifecycleSuccess(expected, after, 'switch-confirmed');
}

async function runQuit(
  target: NativeSessionTarget,
  spec: LifecycleSpec,
  ops: LifecycleOps,
): Promise<ActionOutcome> {
  const label = spec.app ?? describeTarget(target);
  const expected = `${label} no longer running`;

  let pid: number;
  try {
    pid = await resolveTargetPid(target, spec, ops);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return lifecycleFailure(expected, `could not resolve target process: ${message}`, 'unavailable', 'unavailable');
  }

  const wasRunning = await ops.isRunning(pid);
  if (!wasRunning) {
    return lifecycleSuccess(expected, `already not running (pid=${pid})`, 'already-quit');
  }

  // Only pass a real app name through (session-by-pid entries carry the
  // synthetic `pid-<n>` placeholder, which `quit` cannot use as an AppleScript
  // application identifier).
  const explicitName = spec.app ?? (target.kind === 'macos' ? target.app : undefined);
  const appName = explicitName && !explicitName.startsWith('pid-') ? explicitName : undefined;

  try {
    await ops.quit({ pid, app: appName });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return lifecycleFailure(expected, `quit command failed: ${message}`, 'running=true', 'running=true');
  }

  const exited = await pollUntil(async () => !(await ops.isRunning(pid)), QUIT_TIMEOUT_MS);
  const after = `running=${!exited}`;
  if (!exited) {
    return lifecycleFailure(expected, `process ${pid} still running after ${QUIT_TIMEOUT_MS}ms`, 'running=true', after);
  }
  return lifecycleSuccess(expected, after, 'quit-confirmed');
}

/**
 * Run one lifecycle op against `target`/`spec`. Never throws — any unexpected
 * error from an injected op is folded into a structured failing outcome.
 */
export async function runLifecycleCapability(
  target: NativeSessionTarget,
  spec: LifecycleSpec,
  ops: LifecycleOps,
): Promise<ActionOutcome> {
  try {
    switch (spec.op) {
      case 'launch':
        return await runLaunch(spec, ops);
      case 'switch':
        return await runSwitch(target, spec, ops);
      case 'quit':
        return await runQuit(target, spec, ops);
      default: {
        const op: AppLifecycleOp = spec.op;
        return lifecycleFailure('a supported lifecycle op', `unknown op: ${op}`, 'n/a', 'n/a');
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return lifecycleFailure('lifecycle op to complete', `threw: ${message}`, 'unavailable', 'unavailable');
  }
}

// ─── Default (production) ops — `open`/`osascript`, no AX daemon involvement ─

async function defaultLaunch(app: string): Promise<void> {
  try {
    await execFileAsync('open', ['-a', app], { timeout: 8000 });
  } catch (err) {
    if (BUNDLE_ID_RE.test(app)) {
      await execFileAsync('open', ['-b', app], { timeout: 8000 });
      return;
    }
    throw err;
  }
}

async function defaultFrontmostPid(): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync(
      'osascript',
      ['-e', 'tell application "System Events" to get unix id of first application process whose frontmost is true'],
      { timeout: 3000 },
    );
    const pid = parseInt(stdout.trim(), 10);
    return Number.isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

async function defaultIsRunning(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function defaultQuit(target: { pid: number; app?: string }): Promise<void> {
  if (target.app) {
    const script = BUNDLE_ID_RE.test(target.app)
      ? `tell application id "${target.app}" to quit`
      : `tell application "${target.app}" to quit`;
    await execFileAsync('osascript', ['-e', script], { timeout: 5000 });
    return;
  }
  // No app name available — resolve it by pid via System Events, then quit by
  // name (AppleScript's `quit` verb targets an application by name/bundle id,
  // not a raw pid).
  const { stdout } = await execFileAsync(
    'osascript',
    ['-e', `tell application "System Events" to get name of first application process whose unix id is ${target.pid}`],
    { timeout: 3000 },
  );
  const name = stdout.trim();
  if (!name) throw new Error(`could not resolve an app name for pid ${target.pid}`);
  await execFileAsync('osascript', ['-e', `tell application "${name}" to quit`], { timeout: 5000 });
}

/** The production `LifecycleOps` — `open`/`osascript`/`process.kill(pid, 0)`. */
export const defaultLifecycleOps: LifecycleOps = {
  findProcess,
  launch: defaultLaunch,
  activate: activateMacOSProcess,
  quit: defaultQuit,
  frontmostPid: defaultFrontmostPid,
  isRunning: defaultIsRunning,
};
