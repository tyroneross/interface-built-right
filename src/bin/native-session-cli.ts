/**
 * `ibr native:session:{start,read,action,close}` — CLI parity for the four
 * native MCP tools (chunk E4-C).
 *
 * Delegates to the same `NativeSessionController` the MCP adapters
 * (`src/mcp/native-tools.ts`) call, so the lifecycle behaves identically
 * across API/MCP/CLI (PRD decision table). Each CLI invocation is a separate
 * OS process, so session state that MCP keeps in the in-memory
 * `src/mcp/sessions.ts` Map is instead persisted to the file-backed
 * `src/native/session-store.ts` between commands.
 *
 * Handler functions (`handleStart`/`handleRead`/`handleAction`/`handleClose`)
 * are pure of `process.exit` and console I/O — they return a `CliResult`
 * (exit code + JSON envelope + human text) so tests can assert exit codes and
 * JSON shapes directly, against an injected fake `NativeBackend`, without a
 * real macOS app or spawning a subprocess. `registerNativeSessionCommands`
 * wires those handlers into commander and is the only place that calls
 * `console.log`/`console.error`/`process.exit`.
 */

import type { Command } from 'commander';
import { randomUUID } from 'crypto';
import {
  NativeSessionController,
  type NativeToolResult,
  type NativeSessionActionRequest,
} from '../native/session-controller.js';
import type { AppLifecycleOp } from '../native/backend.js';
import type { SessionEntry } from '../mcp/sessions.js';
import {
  writeSession,
  readSession,
  deleteSession,
  type StoredNativeSession,
} from '../native/session-store.js';

// ─── Exit codes (T-03) ────────────────────────────────────────────────────

export const EXIT_OK = 0;
/** Action was attempted but failed for a reason other than a bad target or a timed-out wait (AX action failed, capability not implemented, extractor error, bad action/value pairing). */
export const EXIT_ACTION_FAILED = 1;
/** `sessionId` has no entry in the file-backed session store. */
export const EXIT_SESSION_NOT_FOUND = 2;
/** An explicit `--wait-for` was supplied and the post-action settle loop timed out without finding it. */
export const EXIT_WAIT_FAILED = 3;
/** The requested target/app/pid/simulator/read-mode could not be resolved. */
export const EXIT_INVALID_TARGET = 4;

// ─── Result shape ─────────────────────────────────────────────────────────

export interface CliResult {
  exitCode: number;
  /** Structured JSON envelope — emitted verbatim on `--json`. */
  json: Record<string, unknown>;
  /** Human-readable single/multi-line summary for non-`--json` mode. */
  text: string;
}

// ─── Dependency seam (tests inject a fake backend + in-memory store) ─────

export interface CliDeps {
  makeController: (store: Map<string, SessionEntry>) => NativeSessionController;
  writeSession: typeof writeSession;
  readSession: typeof readSession;
  deleteSession: typeof deleteSession;
}

export function defaultCliDeps(): CliDeps {
  return {
    makeController: (store) => new NativeSessionController({ store }),
    writeSession,
    readSession,
    deleteSession,
  };
}

// ─── Shared helpers ────────────────────────────────────────────────────────

function toSessionEntry(stored: StoredNativeSession): SessionEntry {
  return {
    driver: null,
    type: stored.type,
    app: stored.app,
    pid: stored.pid,
    device: stored.device,
    createdAt: stored.createdAt,
  };
}

function toStoredSession(entry: SessionEntry): StoredNativeSession {
  if (entry.type !== 'macos' && entry.type !== 'simulator') {
    throw new Error(`Cannot persist non-native session type to native-session-store: ${entry.type}`);
  }
  return { type: entry.type, app: entry.app, pid: entry.pid, device: entry.device, createdAt: entry.createdAt };
}

function parsePayload(text: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function invalidTarget(message: string, extra: Record<string, unknown> = {}): CliResult {
  return {
    exitCode: EXIT_INVALID_TARGET,
    json: { ok: false, exitCode: EXIT_INVALID_TARGET, error: message, ...extra },
    text: `✗ ${message}`,
  };
}

function sessionNotFound(sessionId: string): CliResult {
  const message = `Session not found: ${sessionId}. Use native:session:start first.`;
  return {
    exitCode: EXIT_SESSION_NOT_FOUND,
    json: { ok: false, exitCode: EXIT_SESSION_NOT_FOUND, sessionId, error: message },
    text: `✗ ${message}`,
  };
}

function actionFailed(message: string, extra: Record<string, unknown> = {}): CliResult {
  return {
    exitCode: EXIT_ACTION_FAILED,
    json: { ok: false, exitCode: EXIT_ACTION_FAILED, error: message, ...extra },
    text: `✗ ${message}`,
  };
}

function waitFailed(message: string, extra: Record<string, unknown> = {}): CliResult {
  return {
    exitCode: EXIT_WAIT_FAILED,
    json: { ok: false, exitCode: EXIT_WAIT_FAILED, error: message, ...extra },
    text: `✗ ${message}`,
  };
}

/**
 * A target-resolution problem, distinguished from a generic action failure.
 * `nativeTargetNotFound()`'s payload is the only failure shape carrying
 * `hint` (its `alternatives` field is NOT a reliable signal on its own — a
 * generic AX-call failure via `nativeActionResponse` also carries
 * `alternatives` as ordinary provenance from a *successful* resolution).
 * The "found but has no AX path" case returns plain (non-JSON) text, so it is
 * matched against the raw result text rather than the parsed payload.
 */
function looksLikeTargetProblem(payload: Record<string, unknown>, rawText: string): boolean {
  if (typeof payload.hint === 'string') return true;
  return rawText.includes('not found') || rawText.includes('no AX path');
}

function postActionOf(payload: Record<string, unknown>): { settled?: boolean; reason?: string } | undefined {
  const postAction = payload.postAction;
  return postAction && typeof postAction === 'object' ? (postAction as { settled?: boolean; reason?: string }) : undefined;
}

// ─── start ─────────────────────────────────────────────────────────────────

export interface StartOptions {
  app?: string;
  pid?: number;
  simulator?: string;
  sessionId?: string;
}

export async function handleStart(opts: StartOptions, deps: CliDeps = defaultCliDeps()): Promise<CliResult> {
  const provided = [opts.app !== undefined, opts.pid !== undefined, opts.simulator !== undefined].filter(Boolean).length;
  if (provided !== 1) {
    return invalidTarget('Provide exactly one of --app, --pid, or --simulator.');
  }

  const sessionId = opts.sessionId ?? randomUUID();
  const store = new Map<string, SessionEntry>();
  const controller = deps.makeController(store);

  let result: NativeToolResult;
  if (opts.pid !== undefined) {
    result = controller.startMacOSPid(sessionId, opts.pid);
  } else if (opts.app) {
    result = await controller.startMacOS(sessionId, opts.app, 'native:session:start (macos)');
  } else {
    result = await controller.startSimulator(sessionId, opts.simulator as string, 'native:session:start (simulator)');
  }

  if (result.kind !== 'text') {
    return actionFailed('native:session:start returned an unexpected image result.');
  }
  if (result.isError) {
    // start failures are always about the resolved target (app/pid/simulator not found, bad pid).
    return invalidTarget(result.text, { sessionId });
  }

  const entry = store.get(sessionId);
  if (!entry) {
    return actionFailed(`native:session:start succeeded but produced no session entry for ${sessionId}.`);
  }
  deps.writeSession(sessionId, toStoredSession(entry));

  const payload = parsePayload(result.text);
  return {
    exitCode: EXIT_OK,
    json: { ok: true, exitCode: EXIT_OK, sessionId, ...payload },
    text: `Started ${entry.type} session ${sessionId}${entry.app ? ` (${entry.app})` : ''}${entry.pid ? ` pid=${entry.pid}` : ''}`,
  };
}

// ─── read ──────────────────────────────────────────────────────────────────

export interface ReadOptions {
  sessionId: string;
  what?: string;
  limit?: number;
}

export async function handleRead(opts: ReadOptions, deps: CliDeps = defaultCliDeps()): Promise<CliResult> {
  const stored = deps.readSession(opts.sessionId);
  if (!stored) return sessionNotFound(opts.sessionId);

  const entry = toSessionEntry(stored);
  const store = new Map<string, SessionEntry>([[opts.sessionId, entry]]);
  const controller = deps.makeController(store);
  const what = opts.what ?? 'observe';
  const limit = opts.limit ?? 50;

  const result = entry.type === 'macos'
    ? await controller.readMacOS(entry, what, limit)
    : await controller.readSimulator(entry, what, limit);

  if (result.kind === 'image') {
    const metadata = parsePayload(result.metadata);
    return {
      exitCode: EXIT_OK,
      json: { ok: true, exitCode: EXIT_OK, sessionId: opts.sessionId, ...metadata, screenshotBase64Omitted: true },
      text: `Screenshot saved${typeof metadata.screenshotPath === 'string' ? `: ${metadata.screenshotPath}` : ''}`,
    };
  }

  if (result.isError) {
    const payload = parsePayload(result.text);
    const code = /^Unknown read mode/.test(result.text) ? EXIT_INVALID_TARGET : EXIT_ACTION_FAILED;
    return {
      exitCode: code,
      json: { ok: false, exitCode: code, sessionId: opts.sessionId, error: result.text, ...payload },
      text: `✗ ${result.text}`,
    };
  }

  const payload = parsePayload(result.text);
  return {
    exitCode: EXIT_OK,
    json: { ok: true, exitCode: EXIT_OK, sessionId: opts.sessionId, ...payload },
    text: `Read (${what}) on ${opts.sessionId}: ${payload.returned ?? payload.totalElements ?? 0} element(s)`,
  };
}

// ─── action ────────────────────────────────────────────────────────────────

export interface ActionOptions {
  sessionId: string;
  action: string;
  target?: string;
  value?: string;
  role?: string;
  waitFor?: string;
  waitTimeoutMs?: number;
  chord?: string;
  op?: AppLifecycleOp;
  app?: string;
  menuPath?: string[];
}

export async function handleAction(opts: ActionOptions, deps: CliDeps = defaultCliDeps()): Promise<CliResult> {
  const stored = deps.readSession(opts.sessionId);
  if (!stored) return sessionNotFound(opts.sessionId);

  const entry = toSessionEntry(stored);
  const store = new Map<string, SessionEntry>([[opts.sessionId, entry]]);
  const controller = deps.makeController(store);

  const request: NativeSessionActionRequest = {
    action: opts.action,
    target: opts.target,
    value: opts.value,
    role: opts.role,
    waitFor: opts.waitFor,
    waitTimeoutMs: opts.waitTimeoutMs,
    chord: opts.chord,
    op: opts.op,
    app: opts.app,
    menuPath: opts.menuPath,
  };

  const result = entry.type === 'macos'
    ? await controller.actionMacOS(entry, request)
    : await controller.actionSimulator(entry, request);

  if (result.kind !== 'text') {
    return actionFailed('native:session:action returned an unexpected image result.');
  }

  const payload = parsePayload(result.text);
  const postAction = postActionOf(payload);

  if (result.isError) {
    if (opts.waitFor && postAction && postAction.settled === false) {
      return waitFailed(`Wait for "${opts.waitFor}" timed out.`, { sessionId: opts.sessionId, ...payload });
    }
    const code = looksLikeTargetProblem(payload, result.text) ? EXIT_INVALID_TARGET : EXIT_ACTION_FAILED;
    const message = typeof payload.error === 'string' ? payload.error : result.text;
    return {
      exitCode: code,
      json: { ok: false, exitCode: code, sessionId: opts.sessionId, ...payload, error: message },
      text: `✗ ${message}`,
    };
  }

  // The AX/capability call itself succeeded, but an explicit --wait-for may
  // still have timed out during post-action settling — that is a "failed
  // wait" outcome even though `success:true` on the wire (matches the
  // controller's wait-timeout unit-test shape: success:true, postAction
  // .settled:false, reason:'timeout').
  if (opts.waitFor && postAction && postAction.settled === false) {
    return waitFailed(`Action succeeded but wait for "${opts.waitFor}" timed out.`, {
      sessionId: opts.sessionId,
      ...payload,
    });
  }

  return {
    exitCode: EXIT_OK,
    json: { ok: true, exitCode: EXIT_OK, sessionId: opts.sessionId, ...payload },
    text: `✓ ${opts.action}${opts.target ? ` on "${opts.target}"` : ''} succeeded`,
  };
}

// ─── close ─────────────────────────────────────────────────────────────────

export interface CloseOptions {
  sessionId: string;
}

export async function handleClose(opts: CloseOptions, deps: CliDeps = defaultCliDeps()): Promise<CliResult> {
  const stored = deps.readSession(opts.sessionId);
  if (!stored) return sessionNotFound(opts.sessionId);

  const entry = toSessionEntry(stored);
  const store = new Map<string, SessionEntry>([[opts.sessionId, entry]]);
  const controller = deps.makeController(store);

  const result = controller.closeNative(opts.sessionId);
  if (result.kind !== 'text') {
    return actionFailed('native:session:close returned an unexpected image result.');
  }
  if (result.isError) {
    return invalidTarget(result.text, { sessionId: opts.sessionId });
  }

  deps.deleteSession(opts.sessionId);
  return {
    exitCode: EXIT_OK,
    json: { ok: true, exitCode: EXIT_OK, sessionId: opts.sessionId, message: result.text },
    text: result.text,
  };
}

// ─── commander wiring ────────────────────────────────────────────────────

/**
 * Emit the result and terminate with its exit code. Calls `process.exit`
 * directly (rather than only setting `process.exitCode`) so a lingering
 * handle — e.g. a `DaemonBackend`'s persistent daemon connection — can never
 * keep the CLI process alive past its deterministic exit code.
 */
function emit(result: CliResult, json: boolean | undefined): void {
  if (json) {
    console.log(JSON.stringify(result.json, null, 2));
  } else if (result.exitCode === EXIT_OK) {
    console.log(result.text);
  } else {
    console.error(result.text);
  }
  process.exit(result.exitCode);
}

/**
 * Register `native:session:{start,read,action,close}` on the shared
 * commander `program`. No interactive prompts; stdout carries ONLY the JSON
 * envelope when `--json` is passed.
 */
export function registerNativeSessionCommands(program: Command): void {
  program
    .command('native:session:start')
    .description('Start a cursor-free native session for a running macOS app or iOS/watchOS simulator (CLI parity for native_session_start)')
    .option('--app <name>', 'macOS app name, bundle ID, or process-name fragment')
    .option('--pid <n>', 'Direct macOS process ID')
    .option('--simulator <name>', 'Simulator device name or UDID')
    .option('--session-id <id>', 'Use an explicit session ID instead of a generated UUID (for deterministic repros)')
    .option('--json', 'Emit structured JSON to stdout')
    .action(async (opts: { app?: string; pid?: string; simulator?: string; sessionId?: string; json?: boolean }) => {
      const result = await handleStart({
        app: opts.app,
        pid: opts.pid !== undefined ? parseInt(opts.pid, 10) : undefined,
        simulator: opts.simulator,
        sessionId: opts.sessionId,
      });
      emit(result, opts.json);
    });

  program
    .command('native:session:read <sessionId>')
    .description('Read a native session — observe/extract/state/screenshot (CLI parity for native_session_read)')
    .option('--what <mode>', 'observe | extract | screenshot | state', 'observe')
    .option('--limit <n>', 'Maximum elements to return', '50')
    .option('--json', 'Emit structured JSON to stdout')
    .action(async (sessionId: string, opts: { what: string; limit: string; json?: boolean }) => {
      const result = await handleRead({ sessionId, what: opts.what, limit: parseInt(opts.limit, 10) });
      emit(result, opts.json);
    });

  program
    .command('native:session:action <sessionId>')
    .description('Perform a native session action by accessible name (CLI parity for native_session_action)')
    .requiredOption('--action <kind>', 'click|press|fill|type|focus|showMenu|increment|decrement|confirm|cancel|scroll|scrollToVisible|check|select|keystroke|app|menuPath')
    .option('--target <name>', 'Accessible name / AX identifier / description / value to target')
    .option('--value <text>', 'Text for fill/type actions')
    .option('--role <role>', 'Optional role filter')
    .option('--wait-for <name>', 'Expected post-action target to poll for; failing to settle is a non-zero exit')
    .option('--wait-timeout-ms <n>', 'Post-action settle timeout in ms, clamped 0..5000')
    .option('--chord <chord>', "Keyboard chord for the 'keystroke' action, e.g. 'Meta+n'")
    .option('--op <op>', "App lifecycle op for the 'app' action: launch|switch|quit")
    .option('--app <name>', "App name/bundle id for the 'app' action's lifecycle op")
    .option('--menu-path <items>', "Comma-separated AXMenu titles for the 'menuPath' action, e.g. 'File,New Window'")
    .option('--json', 'Emit structured JSON to stdout')
    .action(async (sessionId: string, opts: {
      action: string;
      target?: string;
      value?: string;
      role?: string;
      waitFor?: string;
      waitTimeoutMs?: string;
      chord?: string;
      op?: string;
      app?: string;
      menuPath?: string;
      json?: boolean;
    }) => {
      const result = await handleAction({
        sessionId,
        action: opts.action,
        target: opts.target,
        value: opts.value,
        role: opts.role,
        waitFor: opts.waitFor,
        waitTimeoutMs: opts.waitTimeoutMs !== undefined ? parseInt(opts.waitTimeoutMs, 10) : undefined,
        chord: opts.chord,
        op: opts.op as AppLifecycleOp | undefined,
        app: opts.app,
        menuPath: opts.menuPath ? opts.menuPath.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      });
      emit(result, opts.json);
    });

  program
    .command('native:session:close <sessionId>')
    .description('Close a native session record (CLI parity for native_session_close)')
    .option('--json', 'Emit structured JSON to stdout')
    .action(async (sessionId: string, opts: { json?: boolean }) => {
      const result = await handleClose({ sessionId });
      emit(result, opts.json);
    });
}
