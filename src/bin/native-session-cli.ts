import { captureNativeStream } from '../native/stream-capture.js';
import { join } from 'node:path';
import { writeCliOutput } from './cli-output.js';
import { compactNativeRead, saveNativeReport } from '../native-output.js';
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
 * `console.log`/`console.error` and sets the process exit status.
 */

import type { Command } from 'commander';
import { assignRefs, diffRefs, formatDiff, formatRefLine, loadRefs, saveRefs, writeFullPayload, type RawElement, type RefEntry } from '../native/compact-refs.js';
import { DEFAULT_SESSION_STORE_DIR } from '../native/session-store.js';
import { executeOnSimulator, normalizeAction, readSimulatorElements, type CanonicalAction } from '../native/computer-use.js';
import { randomUUID } from 'crypto';
import { idbTap } from '../native/idb.js';
import { getNativeBackend } from '../native/backend.js';
import {
  appendReplayStep,
  elementAtPoint,
  fingerprintOf,
  formatReplayReport,
  loadReplayFile,
  replay,
  treeSignature,
  type ReplayDeps,
} from '../native/replay.js';
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
  /** Directory for refs + file-out payloads; defaults to the session store dir. */
  refsDir?: string;
  /** Test seams for the simulator computer-use path. */
  readSimulatorElements?: (udid: string) => Promise<RawElement[]>;
  executeOnSimulator?: typeof executeOnSimulator;
  settleIntervalMs?: number;
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

/** Compact failures retain the original status and the complete local evidence. */
async function compactActionFailure(result: CliResult, directory: string): Promise<CliResult> {
  try {
    const fullReport = await saveNativeReport(result.json, directory);
    const source = result.json;
    const post = postActionOf(source);
    const bounded = (value: unknown) => typeof value === 'string' ? value.slice(0, 800) : value;
    const summary: Record<string, unknown> = {};
    for (const key of ['settled', 'reason', 'attempts', 'elapsedMs', 'waitFor', 'waitForFound', 'totalElements', 'interactiveElements']) {
      if (post?.[key] !== undefined) summary[key] = bounded(post[key]);
    }
    return {
      exitCode: result.exitCode,
      json: { ok: false, exitCode: result.exitCode, sessionId: source.sessionId,
        error: bounded(source.error), errorTruncated: typeof source.error === 'string' && source.error.length > 800,
        success: source.success, actionDelivered: source.success === true,
        verificationPassed: false, requestedAction: bounded(source.requestedAction),
        target: bounded(source.target), backend: source.backend, pid: source.pid,
        postAction: post ? summary : undefined, fullReport, evidenceSaved: true,
        snapshotAvailable: Boolean(post?.observation), hostCursorAffected: source.hostCursorAffected },
      text: `✗ ${bounded(source.error)}\nComplete failure evidence: ${fullReport}`,
    };
  } catch (error) {
    // If storage fails, preserve the full diagnostic inline rather than lose
    // evidence or imply that a delivered action is safe to repeat.
    return { ...result, json: { ...result.json, evidenceSaved: false,
      compactFallback: 'inline-evidence', evidenceError: String(error).slice(0, 800) } };
  }
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

function postActionOf(payload: Record<string, unknown>): { settled?: boolean; reason?: string } & Record<string, unknown> | undefined {
  const postAction = payload.postAction;
  return postAction && typeof postAction === 'object' ? (postAction as { settled?: boolean; reason?: string } & Record<string, unknown>) : undefined;
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
  format?: 'full' | 'compact';
}

export async function handleRead(opts: ReadOptions, deps: CliDeps = defaultCliDeps()): Promise<CliResult> {
  const stored = deps.readSession(opts.sessionId);
  if (!stored) return sessionNotFound(opts.sessionId);

  const entry = toSessionEntry(stored);
  const store = new Map<string, SessionEntry>([[opts.sessionId, entry]]);
  const controller = deps.makeController(store);
  if (opts.format && !['full', 'compact'].includes(opts.format)) return invalidTarget('Use --format full or compact.');
  if (opts.limit !== undefined && (!Number.isInteger(opts.limit) || opts.limit < 0)) return invalidTarget('Read limit must be a non-negative integer.');
  const requested = opts.what ?? 'observe';
  const compact = requested === 'refs';
  const what = compact || (opts.format === 'compact' && ['observe', 'extract'].includes(requested)) ? 'extract' : requested;
  // refs reads must cover the same element window as the 200-element post-action
  // re-read, or the first diff reports every element past the limit as added.
  const limit = opts.format === 'compact' && requested !== 'refs' && ['observe', 'extract'].includes(what)
    ? Number.MAX_SAFE_INTEGER
    : opts.what === 'refs' ? Number.MAX_SAFE_INTEGER : (opts.limit ?? 50);

  // Simulator guest AX is only reachable through idb; the host AX walk sees Simulator.app chrome.
  if (compact && entry.type !== 'macos' && stored.device) {
    const readEls = deps.readSimulatorElements ?? readSimulatorElements;
    try {
      const elements = await readEls(stored.device.udid);
      return compactRead(opts.sessionId, { elements }, deps.refsDir ?? DEFAULT_SESSION_STORE_DIR, JSON.stringify(stored));
    } catch (err) {
      return actionFailed(`idb describe-all failed: ${err instanceof Error ? err.message : String(err)}`, { sessionId: opts.sessionId });
    }
  }

  const result = entry.type === 'macos'
    ? await controller.readMacOS(entry, what, limit)
    : await controller.readSimulator(entry, what, limit);

  if (compact && result.kind === 'text' && !result.isError) {
    return compactRead(opts.sessionId, parsePayload(result.text), deps.refsDir ?? DEFAULT_SESSION_STORE_DIR, JSON.stringify(stored));
  }

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
  if (opts.format === 'compact' && ['observe', 'extract'].includes(what)) {
    try {
      const fullReport = await saveNativeReport(payload, deps.refsDir ?? DEFAULT_SESSION_STORE_DIR);
      const compact = compactNativeRead(payload, fullReport, opts.limit ?? Number.MAX_SAFE_INTEGER);
      return { exitCode: EXIT_OK, json: { ok: true, exitCode: EXIT_OK, sessionId: opts.sessionId, ...compact }, text: JSON.stringify(compact) };
    } catch (error) {
      return actionFailed(`Could not save native evidence: ${error instanceof Error ? error.message : String(error)}`, { sessionId: opts.sessionId });
    }
  }
  return {
    exitCode: EXIT_OK,
    json: { ok: true, exitCode: EXIT_OK, sessionId: opts.sessionId, ...payload },
    text: `Read (${what}) on ${opts.sessionId}: ${payload.returned ?? payload.totalElements ?? 0} element(s)`,
  };
}

function elementsOf(payload: Record<string, unknown>): RawElement[] {
  const windowId = (payload.window as { windowId?: number } | undefined)?.windowId;
  return Array.isArray(payload.elements) ? (payload.elements as RawElement[]).map(e => ({ ...e, windowId })) : [];
}

/** `--what refs`: numbered refs inline, full payload file-out, refs persisted for `--ref`. */
function compactRead(sessionId: string, payload: Record<string, unknown>, dir: string, scope?: string): CliResult {
  if (!Array.isArray(payload.elements) || (typeof payload.totalElements === 'number' && payload.elements.length < payload.totalElements)) {
    return actionFailed('Incomplete observation cannot reconcile refs.');
  }
  const refs = assignRefs(elementsOf(payload), loadRefs(dir, sessionId, scope));
  const full = writeFullPayload(dir, sessionId, 'observe', payload);
  saveRefs(dir, sessionId, refs, scope);
  const lines = refs.map(formatRefLine);
  return {
    exitCode: EXIT_OK,
    json: { ok: true, exitCode: EXIT_OK, sessionId, count: refs.length, refs: lines, full },
    text: [...lines, `full: ${full}`].join('\n'),
  };
}

// ─── action ────────────────────────────────────────────────────────────────

export interface ActionOptions {
  sessionId: string;
  action: string;
  observe?: boolean;
  format?: 'full' | 'compact';
  target?: string;
  value?: string;
  role?: string;
  waitFor?: string;
  waitTimeoutMs?: number;
  chord?: string;
  delivery?: 'background' | 'foreground';
  width?: number;
  height?: number;
  windowTitle?: string;
  op?: AppLifecycleOp;
  app?: string;
  menuPath?: string[];
  /** Short ref from a prior `--what refs` read, e.g. `e12`. Resolves target + role. */
  ref?: string;
  /** Append the resolved step to this replay file (macOS element actions). */
  record?: string;
}

const ELEMENT_ACTIONS = new Set(['click', 'press', 'fill', 'type', 'focus', 'showMenu', 'increment', 'decrement', 'confirm', 'cancel', 'scroll', 'scrollToVisible', 'check', 'select']);

export async function handleAction(opts: ActionOptions, deps: CliDeps = defaultCliDeps()): Promise<CliResult> {
  const stored = deps.readSession(opts.sessionId);
  if (!stored) return sessionNotFound(opts.sessionId);

  if (opts.format && !['full', 'compact'].includes(opts.format)) return invalidTarget('Use --format full or compact.');
  if (opts.observe && (stored.type !== 'macos' || !ELEMENT_ACTIONS.has(opts.action) || opts.ref)) {
    return invalidTarget('--observe requires a macOS element action without --ref.');
  }
  if (opts.format === 'compact' && !opts.observe) return invalidTarget('Action --format compact requires --observe.');
  const entry = toSessionEntry(stored);
  const store = new Map<string, SessionEntry>([[opts.sessionId, entry]]);
  const controller = deps.makeController(store);
  const refsDir = deps.refsDir ?? DEFAULT_SESSION_STORE_DIR;

  let refEntry: RefEntry | undefined;
  let beforeRefs: RefEntry[] | null = null;
  let expectedRef: NativeSessionActionRequest['expectedRef'];
  if (opts.ref) {
    beforeRefs = loadRefs(refsDir, opts.sessionId, JSON.stringify(stored));
    refEntry = beforeRefs?.find((r) => r.ref === opts.ref);
    if (!refEntry) {
      return invalidTarget(`Unknown ref "${opts.ref}". Run: ibr native:session:read ${opts.sessionId} --what refs`, { sessionId: opts.sessionId });
    }
    if (!refEntry.label && !refEntry.identifier) {
      return invalidTarget(`Ref ${opts.ref} (${refEntry.role}) has no accessible name or identifier to target.`, { sessionId: opts.sessionId });
    }
    // The controller resolves by name + role, so a ref whose name+role is shared by
    // another element could act on the wrong one. Refuse rather than guess.
    const name = refEntry.identifier || refEntry.label;
    const twins = beforeRefs!.filter((r) => r.role === refEntry!.role && (r.identifier || r.label) === name);
    if (twins.length > 1) {
      return invalidTarget(`Ref ${opts.ref} is ambiguous: ${twins.map((r) => r.ref).join(', ')} share role ${refEntry.role} and name ${JSON.stringify(name)}.`, { sessionId: opts.sessionId });
    }
  }

  if (refEntry) {
    // Revalidate the live target before dispatch; a stale name must not silently
    // resolve to a newly ambiguous control. The backend performs final resolution.
    const fresh = entry.type === 'macos'
      ? await controller.readMacOS(entry, 'extract', 100000)
      : await controller.readSimulator(entry, 'extract', 100000);
    if (fresh.kind !== 'text' || fresh.isError) return invalidTarget('Could not revalidate ref; read refs again.');
    const live = elementsOf(parsePayload(fresh.text)).filter(e => e.windowId === refEntry!.windowId && e.role === refEntry!.role &&
      (refEntry!.identifier ? e.identifier === refEntry!.identifier : e.label === refEntry!.label));
    if (live.length !== 1 || live[0].enabled === false) {
      return invalidTarget(`Ref ${opts.ref} is stale, ambiguous, or disabled; read refs again.`, { sessionId: opts.sessionId });
    }
    expectedRef = { role: refEntry.role, label: refEntry.label, identifier: refEntry.identifier, path: live[0].path, windowId: live[0].windowId };
  }

  const request: NativeSessionActionRequest = {
    action: opts.action,
    includeObservation: opts.observe || !!opts.ref,
    expectedRef,
    target: refEntry ? (refEntry.identifier || refEntry.label || undefined) : opts.target,
    value: opts.value,
    role: refEntry ? refEntry.role : opts.role,
    waitFor: opts.waitFor,
    waitTimeoutMs: opts.waitTimeoutMs,
    chord: opts.chord,
    delivery: opts.delivery,
    width: opts.width,
    height: opts.height,
    windowTitle: opts.windowTitle,
    op: opts.op,
    app: opts.app,
    menuPath: opts.menuPath,
  };

  // Recording needs the pre-action tree signature so replay can tell "same UI" from "changed UI".
  let recordSignature: string | undefined;
  if (opts.record) {
    if (entry.type !== 'macos' || !ELEMENT_ACTIONS.has(opts.action)) {
      return invalidTarget('--record captures macOS element actions; record simulator taps with native:cu --record.', { sessionId: opts.sessionId });
    }
    const pre = await controller.readMacOS(entry, 'extract', 100000);
    if (pre.kind === 'text' && !pre.isError) {
      const p = parsePayload(pre.text);
      recordSignature = treeSignature(elementsOf(p), p.window);
    }
  }

  const result = entry.type === 'macos'
    ? await controller.actionMacOS(entry, request)
    : await controller.actionSimulator(entry, request);

  if (result.kind !== 'text') {
    return actionFailed('native:session:action returned an unexpected image result.');
  }

  const payload = parsePayload(result.text);
  const postAction = postActionOf(payload);
  const failure = (failed: CliResult) => (opts.observe && opts.format === 'compact') || opts.ref
    ? compactActionFailure(failed, refsDir) : failed;

  if (result.isError) {
    if (opts.waitFor && postAction && postAction.settled === false) {
      return failure(waitFailed(`Wait for "${opts.waitFor}" timed out.`, { sessionId: opts.sessionId, ...payload }));
    }
    const code = looksLikeTargetProblem(payload, result.text) ? EXIT_INVALID_TARGET : EXIT_ACTION_FAILED;
    const message = typeof payload.error === 'string' ? payload.error : result.text;
    return failure({
      exitCode: code,
      json: { ok: false, exitCode: code, sessionId: opts.sessionId, ...payload, error: message },
      text: `✗ ${message}`,
    });
  }

  // The AX/capability call itself succeeded, but an explicit --wait-for may
  // still have timed out during post-action settling — that is a "failed
  // wait" outcome even though `success:true` on the wire (matches the
  // controller's wait-timeout unit-test shape: success:true, postAction
  // .settled:false, reason:'timeout').
  if (opts.waitFor && postAction && postAction.settled === false) {
    return failure(waitFailed(`Action delivered but wait for "${opts.waitFor}" timed out.`, {
      sessionId: opts.sessionId,
      ...payload,
    }));
  }

  if ((opts.observe || opts.ref) && postAction?.settled !== true) {
    return failure(waitFailed('Action delivered but no settled observation was established.', { sessionId: opts.sessionId, ...payload }));
  }

  let recorded: number | undefined;
  let recordError: string | undefined;
  if (opts.record && recordSignature) {
    const resolved = payload.resolved as { role?: string; label?: string | null; identifier?: string | null; path?: number[] } | undefined;
    if (resolved?.path) {
      try { recorded = appendReplayStep(opts.record, {
        platform: 'macos',
        action: opts.action,
        value: opts.value,
        fingerprint: fingerprintOf(resolved),
        path: resolved.path,
        signature: recordSignature,
      }); } catch (err) {
        recordError = err instanceof Error ? err.message : String(err);
      }
    }
  }
  const recNote = recorded ? `\nrecorded step ${recorded} -> ${opts.record}` : recordError ? `\nnot recorded: ${recordError}` : '';

  if (opts.observe) {
    const raw = postAction?.observation;
    if (!raw || typeof raw !== 'object') return failure(actionFailed('Post-action observation unavailable.', { sessionId: opts.sessionId, ...payload }));
    try {
      const fullReport = await saveNativeReport(payload, refsDir);
      const { observation: _snapshot, ...postSummary } = postAction!;
      const observation = opts.format === 'compact'
        ? compactNativeRead(raw as Record<string, unknown>, fullReport, Number.MAX_SAFE_INTEGER)
        : raw;
      const { elements: _controls, ...validation } = postSummary;
      const actionSummary = opts.format === 'compact'
        ? { action: opts.action, target: opts.target, success: payload.success, actionDelivered: payload.actionDelivered, verificationPassed: payload.verificationPassed, backend: payload.backend, hostCursorAffected: payload.hostCursorAffected }
        : payload;
      return { exitCode: EXIT_OK, json: { ok: true, exitCode: EXIT_OK, sessionId: opts.sessionId, ...actionSummary,
        postAction: opts.format === 'compact' ? validation : postSummary, observation, fullReport, recorded },
        text: `Action and validated observation saved: ${fullReport}` };
    } catch (error) {
      return failure(actionFailed(`Action delivered; evidence could not be saved: ${error instanceof Error ? error.message : String(error)}`,
        { sessionId: opts.sessionId, ...payload }));
    }
  }

  if (refEntry && beforeRefs) {
    const observation = postAction?.observation;
    if (!observation || typeof observation !== 'object') {
      return failure(actionFailed('Action delivered; settled observation unavailable for ref reconciliation.',
        { sessionId: opts.sessionId, ...payload, actionDelivered: true, refReconciliation: 'missing-settled-observation' }));
    }
    const after = observation as Record<string, unknown>;
    let fullReport: string;
    try { fullReport = await saveNativeReport({ action: payload, before: beforeRefs, after, observedAt: new Date().toISOString() }, refsDir); }
    catch (error) { return actionFailed(`Action delivered; evidence could not be saved: ${String(error)}`, { sessionId: opts.sessionId, ...payload }); }
    const afterRefs = assignRefs(elementsOf(after), beforeRefs);
    if (!Array.isArray(after.elements) || (typeof after.totalElements === 'number' && after.elements.length < after.totalElements)) {
      return actionFailed('Action delivered; incomplete observation cannot reconcile refs.', { sessionId: opts.sessionId, ...payload, actionDelivered: true, refReconciliation: 'rejected-partial', fullReport });
    }
    const d = diffRefs(beforeRefs, afterRefs);
    const diff = formatDiff(d);
    saveRefs(refsDir, opts.sessionId, afterRefs, JSON.stringify(stored));
    const { observation: _snapshot, elements: _elements, ...validation } = postAction ?? {};
    return {
      exitCode: EXIT_OK,
      json: { ok: true, exitCode: EXIT_OK, sessionId: opts.sessionId, action: opts.action, ref: opts.ref,
        axChanged: d.added.length + d.removed.length + d.updated.length > 0,
        postAction: validation, fullReport, diff: diff.split('\n'), recorded },
      text: `✓ ${opts.action} ${opts.ref}\n${diff}${recNote}`,
    };
  }

  return {
    exitCode: EXIT_OK,
    json: { ok: true, exitCode: EXIT_OK, sessionId: opts.sessionId, ...payload, recorded },
    text: `✓ ${opts.action}${opts.target ? ` on "${opts.target}"` : ''} succeeded${recNote}`,
  };
}

// ─── computer-use ──────────────────────────────────────────────────────────

const SETTLE_MAX_READS = 5;
const SETTLE_INTERVAL_MS = 250;

export interface ComputerUseOptions {
  sessionId: string;
  /** Anthropic (`{"action":"left_click","coordinate":[x,y]}`), OpenAI (`{"type":"click","x":..,"y":..}`) or IBR JSON. */
  actionJson: string;
  /** Append click steps (with the tapped element's fingerprint) to this replay file. */
  record?: string;
}

export async function handleComputerUse(opts: ComputerUseOptions, deps: CliDeps = defaultCliDeps()): Promise<CliResult> {
  const stored = deps.readSession(opts.sessionId);
  if (!stored) return sessionNotFound(opts.sessionId);
  if (stored.type !== 'simulator' || !stored.device) {
    return invalidTarget('native:cu drives simulator sessions. For macOS apps use --what refs + native:session:action --ref (cursor-free).', { sessionId: opts.sessionId });
  }
  let action: CanonicalAction;
  try {
    action = normalizeAction(JSON.parse(opts.actionJson) as Record<string, unknown>);
  } catch (err) {
    return invalidTarget(`Bad action: ${err instanceof Error ? err.message : String(err)}`, { sessionId: opts.sessionId });
  }
  const udid = stored.device.udid;
  const refsDir = deps.refsDir ?? DEFAULT_SESSION_STORE_DIR;
  const readEls = deps.readSimulatorElements ?? readSimulatorElements;
  const exec = deps.executeOnSimulator ?? executeOnSimulator;

  const before = action.kind === 'screenshot' || action.kind === 'wait'
    ? null
    : (loadRefs(refsDir, opts.sessionId) ?? assignRefs(await readEls(udid)));
  // Recording reads the live tree (not persisted refs) so the signature matches what replay will see.
  let recordStep: Parameters<typeof appendReplayStep>[1] | undefined;
  if (opts.record) {
    if (action.kind !== 'click') return invalidTarget('native:cu --record captures click actions only.', { sessionId: opts.sessionId });
    const els = await readEls(udid);
    const hit = elementAtPoint(els, action.x, action.y);
    if (!hit) return invalidTarget(`No AX element at ${action.x},${action.y} to record.`, { sessionId: opts.sessionId });
    recordStep = { platform: 'simulator', action: 'click', count: action.count, fingerprint: fingerprintOf(hit), point: [action.x, action.y], signature: treeSignature(els) };
  }
  const res = await exec(udid, action, refsDir);
  let recorded: number | undefined;
  let recordError: string | undefined;
  if (res.success && recordStep && opts.record) {
    try { recorded = appendReplayStep(opts.record, recordStep); } catch (err) { recordError = err instanceof Error ? err.message : String(err); }
  }
  const recNote = recorded ? `\nrecorded step ${recorded} -> ${opts.record}` : recordError ? `\nnot recorded: ${recordError}` : '';
  if (!res.success) return actionFailed(res.error ?? `${action.kind} failed`, { sessionId: opts.sessionId, action: action.kind });
  if (res.screenshot) {
    return { exitCode: EXIT_OK, json: { ok: true, exitCode: EXIT_OK, sessionId: opts.sessionId, action: 'screenshot', path: res.screenshot }, text: `screenshot: ${res.screenshot}` };
  }
  if (!before) {
    return { exitCode: EXIT_OK, json: { ok: true, exitCode: EXIT_OK, sessionId: opts.sessionId, action: action.kind }, text: `✓ ${action.kind}` };
  }
  // success:true is not actuation: re-read the AX tree and report the delta only.
  // Poll until two consecutive reads agree so a mid-animation tree is not reported.
  let after = assignRefs(await readEls(udid), before);
  for (let i = 0; i < SETTLE_MAX_READS; i++) {
    await new Promise((r) => setTimeout(r, deps.settleIntervalMs ?? SETTLE_INTERVAL_MS));
    const next = assignRefs(await readEls(udid), before);
    const same = diffRefs(after, next);
    after = next;
    if (same.added.length === 0 && same.removed.length === 0 && same.updated.length === 0) break;
  }
  saveRefs(refsDir, opts.sessionId, after);
  const d = diffRefs(before, after);
  const diff = formatDiff(d);
  return {
    exitCode: EXIT_OK,
    json: { ok: true, exitCode: EXIT_OK, sessionId: opts.sessionId, action: action.kind, axChanged: d.added.length + d.removed.length + d.updated.length > 0, diff: diff.split('\n'), recorded },
    text: `✓ ${action.kind}\n${diff}${recNote}`,
  };
}

// ─── replay ────────────────────────────────────────────────────────────────

export interface ReplayOptions {
  sessionId: string;
  file: string;
}

export async function handleReplay(opts: ReplayOptions, deps: CliDeps = defaultCliDeps(), replayDeps?: Partial<ReplayDeps>): Promise<CliResult> {
  const stored = deps.readSession(opts.sessionId);
  if (!stored) return sessionNotFound(opts.sessionId);
  let file;
  try {
    file = loadReplayFile(opts.file);
  } catch (err) {
    return invalidTarget(err instanceof Error ? err.message : String(err));
  }
  if (file.steps.length === 0) return invalidTarget(`${opts.file} has no recorded steps.`);
  const reports = await replay(file, {
    sessionId: opts.sessionId,
    kind: stored.type,
    pid: stored.pid,
    app: stored.app,
    udid: stored.device?.udid,
    deviceName: stored.device?.name,
  }, {
    backend: replayDeps?.backend ?? getNativeBackend(),
    readSimulatorElements: replayDeps?.readSimulatorElements ?? deps.readSimulatorElements ?? readSimulatorElements,
    tapSimulator: replayDeps?.tapSimulator ?? idbTap,
    settleMs: replayDeps?.settleMs,
  });
  const failed = reports.some((r) => r.status === 'failed');
  const code = failed ? EXIT_ACTION_FAILED : EXIT_OK;
  const healed = reports.filter((r) => r.status === 'healed').map((r) => ({ step: r.index, from: r.from, to: r.to }));
  return {
    exitCode: code,
    json: { ok: !failed, exitCode: code, sessionId: opts.sessionId, steps: file.steps.length, reports, healed, reResolves: healed.length },
    text: formatReplayReport(reports, file.steps.length),
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
    writeCliOutput(JSON.stringify(result.json), result.exitCode);
  } else if (result.exitCode === EXIT_OK) {
    console.log(result.text);
  } else {
    console.error(result.text);
  }
  process.exitCode = result.exitCode;
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
    .command('native:session:capture <sessionId>')
    .description('Record bounded native AX deltas and selected screenshots; does not infer task completion')
    .option('--duration-ms <n>', 'Recording duration, 100..60000ms', '5000')
    .option('--interval-ms <n>', 'Minimum sampling interval, 100..duration', '250')
    .option('--max-frames <n>', 'Screenshot budget, baseline and final reserved when possible, 0..20', '4')
    .option('--keyframe-on <text...>', 'Capture once when each literal text appears', [])
    .option('--output-dir <path>', 'New private evidence directory')
    .option('--json', 'Emit structured JSON')
    .action(async (sessionId: string, opts) => {
      const stored = readSession(sessionId);
      if (!stored) { emit(sessionNotFound(sessionId), opts.json); return; }
      if (stored.type !== 'macos') { emit(invalidTarget('Streaming capture currently supports macOS sessions.'), opts.json); return; }
      const entry = toSessionEntry(stored);
      const controller = defaultCliDeps().makeController(new Map([[sessionId, entry]]));
      try {
        const result = await captureNativeStream({ durationMs: Number(opts.durationMs), intervalMs: Number(opts.intervalMs),
          maxFrames: Number(opts.maxFrames), keyframeOn: opts.keyframeOn,
          outputDir: opts.outputDir ?? join(DEFAULT_SESSION_STORE_DIR, `capture-${randomUUID()}`) }, {
          read: async () => {
            const result = await controller.readMacOS(entry, 'extract', 100000);
            if (result.kind !== 'text' || result.isError) throw new Error('Native extraction failed');
            const payload = parsePayload(result.text);
            if (!Array.isArray(payload.elements)) throw new Error('Native extraction omitted elements');
            return { ...payload, elements: elementsOf(payload) };
          },
          screenshot: async () => {
            const result = await controller.readMacOS(entry, 'screenshot', 0);
            if (result.kind !== 'image') throw new Error('Native screenshot failed');
            return parsePayload(result.metadata);
          },
        });
        emit({ exitCode: result.complete ? EXIT_OK : EXIT_ACTION_FAILED,
          json: { ok: result.complete, ...result }, text: `Capture evidence: ${result.eventsPath}` }, opts.json);
      } catch (error) { emit(actionFailed(String(error)), opts.json); }
    });

  program
    .command('native:session:read <sessionId>')
    .description('Read a native session — observe/extract/state/screenshot (CLI parity for native_session_read)')
    .option('--what <mode>', 'refs (compact numbered refs, full payload written to a file) | observe | extract | screenshot | state', 'observe')
    .option('--limit <n>', 'Maximum elements: full defaults to 50; compact returns all controls unless limited')
    .option('--format <mode>', 'full or compact; compact saves full evidence and returns controls', 'full')
    .option('--json', 'Emit structured JSON to stdout')
    .action(async (sessionId: string, opts: { what: string; limit?: string; format: string; json?: boolean }) => {
      const result = await handleRead({ sessionId, what: opts.what, limit: opts.limit === undefined ? undefined : Number(opts.limit), format: opts.format as 'full' | 'compact' });
      emit(result, opts.json);
    });

  program
    .command('native:session:action <sessionId>')
    .description('Perform a native session action by accessible name (CLI parity for native_session_action)')
    .requiredOption('--action <kind>', 'click|press|fill|type|focus|showMenu|increment|decrement|confirm|cancel|scroll|scrollToVisible|check|select|drag|keystroke|app|menuPath|resizeWindow')
    .option('--target <name>', 'Accessible name / AX identifier / description / value to target')
    .option('--ref <eN>', 'Short ref from `native:session:read --what refs`; prints only the AX diff after acting')
    .option('--value <text>', 'Text for fill/type actions')
    .option('--role <role>', 'Optional role filter')
    .option('--wait-for <name>', 'Expected post-action target to poll for; failing to settle is a non-zero exit')
    .option('--wait-timeout-ms <n>', 'Post-action settle timeout in ms, clamped 0..5000')
    .option('--chord <chord>', "Keyboard chord for the 'keystroke' action, e.g. 'Meta+n'")
    .option('--delivery <mode>', 'Keyboard delivery: background (default) or explicit foreground; never retries')
    .option('--width <points>', 'Requested outer window width for resizeWindow, 1..16384 points')
    .option('--height <points>', 'Requested outer window height for resizeWindow, 1..16384 points')
    .option('--window-title <title>', 'Exact unique AXWindow title; omission requires exactly one window')
    .option('--op <op>', "App lifecycle op for the 'app' action: launch|switch|quit")
    .option('--app <name>', "App name/bundle id for the 'app' action's lifecycle op")
    .option('--menu-path <items>', "Comma-separated AXMenu titles for the 'menuPath' action, e.g. 'File,New Window'")
    .option('--record <file>', 'Append the resolved step to a replay file (macOS element actions); re-run with native:replay')
    .option('--observe', 'Return the exact validated post-action snapshot; saves complete evidence')
    .option('--format <mode>', 'full or compact (compact requires --observe)', 'full')
    .option('--json', 'Emit structured JSON to stdout')
    .action(async (sessionId: string, opts: {
      action: string;
      observe?: boolean;
      format?: 'full' | 'compact';
      target?: string;
      value?: string;
      role?: string;
      waitFor?: string;
      waitTimeoutMs?: string;
      chord?: string;
      delivery?: string;
      width?: string;
      height?: string;
      windowTitle?: string;
      op?: string;
      app?: string;
      menuPath?: string;
      ref?: string;
      record?: string;
      json?: boolean;
    }) => {
      const result = await handleAction({
        sessionId,
        action: opts.action,
        observe: opts.observe,
        format: opts.format,
        target: opts.target,
        value: opts.value,
        role: opts.role,
        waitFor: opts.waitFor,
        waitTimeoutMs: opts.waitTimeoutMs !== undefined ? parseInt(opts.waitTimeoutMs, 10) : undefined,
        chord: opts.chord,
        delivery: opts.delivery as 'background' | 'foreground' | undefined,
        width: opts.width !== undefined ? Number(opts.width) : undefined,
        height: opts.height !== undefined ? Number(opts.height) : undefined,
        windowTitle: opts.windowTitle,
        op: opts.op as AppLifecycleOp | undefined,
        app: opts.app,
        menuPath: opts.menuPath ? opts.menuPath.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        ref: opts.ref,
        record: opts.record,
      });
      emit(result, opts.json);
    });

  program
    .command('native:cu <sessionId> <actionJson>')
    .description('Computer-use action on a simulator session. Accepts Anthropic ({"action":"left_click","coordinate":[x,y]}) or OpenAI ({"type":"click","x":1,"y":2}) JSON; prints the AX diff, screenshots as a file path')
    .option('--record <file>', 'Append click steps to a replay file; re-run with native:replay')
    .option('--json', 'Emit structured JSON to stdout')
    .action(async (sessionId: string, actionJson: string, opts: { json?: boolean; record?: string }) => {
      emit(await handleComputerUse({ sessionId, actionJson, record: opts.record }), opts.json);
    });

  program
    .command('native:replay <file>')
    .description('Replay a recorded native flow without a model: acts on recorded paths/points, re-resolves only steps whose target moved, and reports which steps healed')
    .requiredOption('--session <id>', 'Native session to replay against (native:session:start)')
    .option('--json', 'Emit structured JSON to stdout')
    .action(async (file: string, opts: { session: string; json?: boolean }) => {
      emit(await handleReplay({ sessionId: opts.session, file }), opts.json);
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
