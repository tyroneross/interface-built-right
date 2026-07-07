/**
 * NativeSessionController — typed session controller for native (macOS AX /
 * iOS-watchOS simulator) driving.
 *
 * Owns session lifecycle (start/read/action/close), element resolution and
 * post-action settling. Performs NO low-level AX I/O directly — every extract /
 * action / screenshot goes through a `NativeBackend` (respawn today, daemon in
 * Epic 2). Returns typed `NativeToolResult`s; the MCP layer (`native-tools.ts`)
 * maps them to the wire.
 *
 * FROZEN at Wave 0 (chunk C0). The full v1 action surface — element verbs plus
 * the Epic-2 capability kinds `keystroke` / `app` / `menuPath` — is declared up
 * front. Action dispatch is a generic pass-through to the backend, so Epic 2
 * adds capabilities without editing this file. `target` requiredness is frozen
 * here: optional for `keystroke`/`app`, required for element-targeting kinds
 * (see `NativeActionRequest`). The Wave-0 MCP wire is unchanged — schema enum
 * extension is E4-B's job.
 *
 * 3e9375a reliability behavior is preserved verbatim: preflight, foreground/
 * settle polling (`waitFor`, `waitTimeoutMs`), post-action evidence, and the
 * screenshot read mode.
 */

import { join } from 'path';
import { sessions as defaultStore, type SessionEntry } from '../mcp/sessions.js';
import {
  getNativeBackend,
  type NativeBackend,
  type NativeSessionTarget,
  type AppLifecycleOp,
} from './backend.js';
import {
  flattenMacOSElements,
  flattenSimulatorElements,
  resolveMacOSElement,
  resolveSimulatorElement,
  type NativeAction,
  type NativeElementCandidate,
} from './actions.js';
import {
  macOSNativePreflight,
  simulatorNativePreflight,
  classifyExtractorError,
  detectSimulatorChromeOnly,
} from './preflight.js';
// Session-start discovery goes through the native barrel (not concrete modules)
// so existing test mocks on '../native/index.js' continue to intercept — the
// module boundary the pre-C0 start handlers used. `index.js` does not import
// this file, so there is no cycle.
import { findProcess, findDevice, bootDevice, getDeviceViewport } from './index.js';
import type { ActionOutcome } from '../action-outcome.js';

const DEFAULT_OUTPUT_DIR = '.ibr';

// ─── Result carrier (mapped to McpResponse by native-tools.ts) ───────────────

/**
 * A native operation's result, independent of the MCP wire wrapper. `text`
 * becomes a text McpResponse (with `isError` when set); `image` becomes an
 * image+metadata McpResponse.
 */
export type NativeToolResult =
  | { kind: 'text'; text: string; isError?: boolean }
  | { kind: 'image'; base64: string; metadata: string };

function textResult(text: string): NativeToolResult {
  return { kind: 'text', text };
}
function errorResult(text: string): NativeToolResult {
  return { kind: 'text', text, isError: true };
}
function imageResult(base64: string, metadata: string): NativeToolResult {
  return { kind: 'image', base64, metadata };
}

// ─── Frozen v1 action surface ────────────────────────────────────────────────

/** Element-targeting action kinds — `target` is REQUIRED. */
export type ElementActionKind =
  | 'click'
  | 'press'
  | 'fill'
  | 'type'
  | 'focus'
  | 'showMenu'
  | 'increment'
  | 'decrement'
  | 'confirm'
  | 'cancel'
  | 'scroll'
  | 'scrollToVisible'
  | 'check'
  | 'select';

/** The full v1 native action kind union (element verbs + Epic-2 capabilities). */
export type NativeActionKind = ElementActionKind | 'keystroke' | 'app' | 'menuPath';

/** Element action — `target` required. */
export interface ElementActionRequest {
  action: ElementActionKind;
  target: string;
  value?: string;
  role?: string;
  waitFor?: string;
  waitTimeoutMs?: number;
}

/** Keyboard chord (Epic 2) — `target` optional (chord may hit the focused element). */
export interface KeystrokeActionRequest {
  action: 'keystroke';
  chord: string;
  target?: string;
  waitFor?: string;
  waitTimeoutMs?: number;
}

/** App lifecycle (Epic 2) — `target` optional (op targets the app itself). */
export interface AppLifecycleActionRequest {
  action: 'app';
  op: AppLifecycleOp;
  app?: string;
  target?: string;
  waitFor?: string;
  waitTimeoutMs?: number;
}

/** Menu traversal (Epic 2) — `target` optional. */
export interface MenuActionRequest {
  action: 'menuPath';
  menuPath: string[];
  target?: string;
  waitFor?: string;
  waitTimeoutMs?: number;
}

/**
 * FROZEN v1 typed action request. `target` requiredness is enforced per-kind by
 * this union: required for element kinds, optional for `keystroke`/`app`/menu.
 * The Wave-0 MCP wire does not yet expose the capability kinds (E4-B extends the
 * enum against this union).
 */
export type NativeActionRequest =
  | ElementActionRequest
  | KeystrokeActionRequest
  | AppLifecycleActionRequest
  | MenuActionRequest;

/**
 * Loose runtime carrier for an action request, as built by the MCP handlers
 * (web `session_action` and `native_session_action`). Frozen delegation
 * signature — `runMacOSSessionAction`/`runSimulatorSessionAction` in
 * `native-tools.ts` accept this. Superset of the strict union's fields so the
 * generic backend dispatch can read capability params without controller edits.
 */
export interface NativeSessionActionRequest {
  action: string;
  target?: string;
  value?: string;
  role?: string;
  waitFor?: string;
  waitTimeoutMs?: number;
  // Capability params (Epic 2) — present only once the enum is extended (E4-B).
  chord?: string;
  op?: AppLifecycleOp;
  app?: string;
  menuPath?: string[];
}

// ─── Post-action settling types ──────────────────────────────────────────────

type NativePostActionState = {
  settled: boolean;
  reason: 'waitFor-found' | 'tree-stable' | 'timeout';
  attempts: number;
  elapsedMs: number;
  waitFor?: string;
  waitForFound?: boolean;
  window?: unknown;
  totalElements: number;
  interactiveElements: number;
  elements: Array<Record<string, unknown>>;
};

// ─── Controller ──────────────────────────────────────────────────────────────

export class NativeSessionController {
  private readonly store: Map<string, SessionEntry>;
  private readonly injectedBackend?: NativeBackend;

  constructor(opts?: { store?: Map<string, SessionEntry>; backend?: NativeBackend }) {
    this.store = opts?.store ?? defaultStore;
    this.injectedBackend = opts?.backend;
  }

  private get backend(): NativeBackend {
    return this.injectedBackend ?? getNativeBackend();
  }

  // ── start ──────────────────────────────────────────────────────────────────

  startMacOSPid(sessionId: string, pid: number): NativeToolResult {
    if (!Number.isInteger(pid) || pid <= 0) {
      return errorResult("native_session_start (macos) failed: 'pid' must be a positive integer.");
    }
    this.store.set(sessionId, { driver: null, type: 'macos', app: `pid-${pid}`, pid, createdAt: Date.now() });
    return textResult(JSON.stringify({
      sessionId,
      type: 'macos',
      backend: 'macos-ax',
      app: `pid-${pid}`,
      pid,
      hostCursorAffected: false,
      timestamp: new Date().toISOString(),
    }, null, 2));
  }

  async startMacOS(sessionId: string, app: string, errorPrefix: string): Promise<NativeToolResult> {
    try {
      const pid = await findProcess(app);
      this.store.set(sessionId, { driver: null, type: 'macos', app, pid, createdAt: Date.now() });
      return textResult(JSON.stringify({
        sessionId,
        type: 'macos',
        backend: 'macos-ax',
        app,
        pid,
        hostCursorAffected: false,
        timestamp: new Date().toISOString(),
      }, null, 2));
    } catch (err) {
      return errorResult(`${errorPrefix} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async startSimulator(sessionId: string, simulator: string, errorPrefix: string): Promise<NativeToolResult> {
    try {
      let device = await findDevice(simulator);
      if (!device) throw new Error(`Simulator not found: ${simulator}`);
      if (device.state !== 'Booted') {
        await bootDevice(device.udid);
        device = await findDevice(device.udid) ?? device;
      }
      this.store.set(sessionId, {
        driver: null,
        type: 'simulator',
        device: { udid: device.udid, name: device.name },
        createdAt: Date.now(),
      });
      return textResult(JSON.stringify({
        sessionId,
        type: 'simulator',
        backend: 'simulator-ax',
        device: { udid: device.udid, name: device.name },
        hostCursorAffected: false,
        timestamp: new Date().toISOString(),
      }, null, 2));
    } catch (err) {
      return errorResult(`${errorPrefix} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── close ────────────────────────────────────────────────────────────────

  closeNative(sessionId: string): NativeToolResult {
    const entry = this.store.get(sessionId);
    if (!entry) return errorResult('Session not found.');
    if (entry.type !== 'macos' && entry.type !== 'simulator') {
      return errorResult(`Session ${sessionId} is a ${entry.type} web session. Use session_close for web sessions.`);
    }
    this.store.delete(sessionId);
    return textResult(`Native session ${sessionId} closed.`);
  }

  // ── read ───────────────────────────────────────────────────────────────────

  async readMacOS(entry: SessionEntry, what: string, limit: number): Promise<NativeToolResult> {
    try {
      if (what === 'screenshot') {
        const screenshotPath = join(
          DEFAULT_OUTPUT_DIR,
          'native',
          'macos-sessions',
          `${safeFilePart(entry.app || `pid-${entry.pid}`)}-${Date.now()}.png`,
        );
        const capture = await this.backend.captureScreenshot({ kind: 'macos', pid: entry.pid!, app: entry.app }, screenshotPath);
        if (capture.kind === 'error') return errorResult(capture.error);
        if (capture.kind !== 'macos') return errorResult('macOS screenshot capture failed: unexpected capture kind.');
        return imageResult(capture.base64, JSON.stringify({
          type: 'macos',
          backend: 'macos-ax',
          app: entry.app,
          pid: entry.pid,
          window: capture.window,
          screenshotPath: capture.screenshotPath,
          hostCursorAffected: false,
        }, null, 2));
      }

      const extraction = await this.backend.extract({ kind: 'macos', pid: entry.pid!, app: entry.app });
      if (extraction.kind === 'not-found') return errorResult(extraction.message);
      if (extraction.kind !== 'macos') return errorResult('native session read (macos) failed: unexpected extraction kind.');
      const { elements, window } = extraction;
      const candidates = flattenMacOSElements(elements);
      const interactive = candidates.filter(candidate => candidate.actions.length > 0);

      if (what === 'state') {
        return textResult(JSON.stringify({
          type: 'macos',
          backend: 'macos-ax',
          app: entry.app,
          pid: entry.pid,
          window,
          totalElements: candidates.length,
          interactiveElements: interactive.length,
          hostCursorAffected: false,
        }, null, 2));
      }

      if (what !== 'observe' && what !== 'extract') {
        return errorResult(`Unknown read mode: ${what}. Use: observe, extract, screenshot, state`);
      }

      const source = what === 'observe' ? interactive : candidates;
      return textResult(JSON.stringify({
        type: 'macos',
        backend: 'macos-ax',
        app: entry.app,
        pid: entry.pid,
        window,
        totalElements: candidates.length,
        interactiveElements: interactive.length,
        returned: Math.min(source.length, limit),
        hostCursorAffected: false,
        elements: source.slice(0, limit).map(formatNativeCandidate),
      }, null, 2));
    } catch (err) {
      return errorResult(`native session read (macos) failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async readSimulator(entry: SessionEntry, what: string, limit: number): Promise<NativeToolResult> {
    try {
      if (what === 'screenshot') {
        const screenshotPath = join(
          DEFAULT_OUTPUT_DIR,
          'native',
          'simulator-sessions',
          `${safeFilePart(entry.device!.name)}-${Date.now()}.png`,
        );
        const capture = await this.backend.captureScreenshot({ kind: 'simulator', device: entry.device! }, screenshotPath);
        if (capture.kind === 'error') return errorResult(capture.error);
        if (capture.kind !== 'simulator') return errorResult('Simulator screenshot capture failed: unexpected capture kind.');
        return imageResult(capture.base64, JSON.stringify({
          type: 'simulator',
          backend: 'simulator-ax',
          device: entry.device,
          screenshotPath: capture.screenshotPath,
          viewport: getDeviceViewport(capture.device),
          hostCursorAffected: false,
        }, null, 2));
      }

      const extraction = await this.backend.extract({ kind: 'simulator', device: entry.device! });
      if (extraction.kind === 'not-found') return errorResult(extraction.message);
      if (extraction.kind !== 'simulator') return errorResult('native session read (simulator) failed: unexpected extraction kind.');
      const candidates = flattenSimulatorElements(extraction.elements);
      const interactive = candidates.filter(candidate => candidate.actions.length > 0);

      // f4: same chrome-only check runSimulatorSessionAction uses.
      const chromeCheck = detectSimulatorChromeOnly(
        candidates.slice(0, 10).map((c) => c.label ?? ''),
      );
      if (chromeCheck) {
        return errorResult(chromeCheck.hint);
      }

      if (what === 'state') {
        return textResult(JSON.stringify({
          type: 'simulator',
          backend: 'simulator-ax',
          device: entry.device,
          totalElements: candidates.length,
          interactiveElements: interactive.length,
          hostCursorAffected: false,
        }, null, 2));
      }

      if (what !== 'observe' && what !== 'extract') {
        return errorResult(`Unknown read mode: ${what}. Use: observe, extract, screenshot, state`);
      }

      const source = what === 'observe' ? interactive : candidates;
      return textResult(JSON.stringify({
        type: 'simulator',
        backend: 'simulator-ax',
        device: entry.device,
        totalElements: candidates.length,
        interactiveElements: interactive.length,
        returned: Math.min(source.length, limit),
        hostCursorAffected: false,
        elements: source.slice(0, limit).map(formatNativeCandidate),
      }, null, 2));
    } catch (err) {
      return errorResult(`native session read (simulator) failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── action ───────────────────────────────────────────────────────────────

  async actionMacOS(entry: SessionEntry, request: NativeSessionActionRequest): Promise<NativeToolResult> {
    // Generic capability pass-through (Epic 2 fills these; dormant in Wave 0).
    const capability = await this.dispatchCapability({ kind: 'macos', pid: entry.pid!, app: entry.app }, request);
    if (capability) return capability;

    // R5: preflight before touching the extractor.
    const pre = await macOSNativePreflight();
    if (!pre.ok) return errorResult(pre.message);

    try {
      const extraction = await this.backend.extract({ kind: 'macos', pid: entry.pid!, app: entry.app });
      if (extraction.kind === 'not-found') return errorResult(extraction.message);
      if (extraction.kind !== 'macos') return errorResult('native session action (macos) failed: unexpected extraction kind.');
      const { elements } = extraction;
      const resolution = resolveMacOSElement(elements, request.target ?? '', request.role ? { role: request.role } : {});
      if (!resolution) {
        return nativeTargetNotFound(request.target ?? '', flattenMacOSElements(elements));
      }
      if (!resolution.element.path) {
        return errorResult(`Element "${request.target}" was found but has no AX path. Rebuild the native extractor and try again.`);
      }

      const mapped = mapSessionActionToNative(request.action, request.value);
      if ('error' in mapped) return errorResult(mapped.error);

      const actionResult = await this.backend.performAction(
        { kind: 'macos', pid: entry.pid!, app: entry.app },
        { elementPath: resolution.element.path, action: mapped.action, value: mapped.value },
      );

      const postAction = actionResult.success
        ? await this.waitForMacOSPostAction(entry, request)
        : undefined;

      return nativeActionResponse(actionResult.success, {
        backend: 'macos-ax',
        app: entry.app,
        pid: entry.pid,
        requestedAction: request.action,
        axAction: mapped.action,
        target: request.target,
        resolved: formatNativeCandidate(resolution.element),
        confidence: resolution.confidence,
        tier: resolution.tier,
        alternatives: resolution.alternatives,
        postAction,
        hostCursorAffected: false,
        error: actionResult.error,
      });
    } catch (err) {
      const classified = classifyExtractorError(err);
      if (classified) return errorResult(classified.message);
      return errorResult(`native session action (macos) failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async actionSimulator(entry: SessionEntry, request: NativeSessionActionRequest): Promise<NativeToolResult> {
    const capability = await this.dispatchCapability({ kind: 'simulator', device: entry.device! }, request);
    if (capability) return capability;

    // R5: preflight — surface env errors (no Xcode, no simctl) as one-liners.
    const pre = await simulatorNativePreflight();
    if (!pre.ok) return errorResult(pre.message);

    try {
      const extraction = await this.backend.extract({ kind: 'simulator', device: entry.device! });
      if (extraction.kind === 'not-found') return errorResult(extraction.message);
      if (extraction.kind !== 'simulator') return errorResult('native session action (simulator) failed: unexpected extraction kind.');
      const { elements, device } = extraction;

      // R4: pure-chrome tree → one-line "foreground the app" hint.
      const flattened = flattenSimulatorElements(elements);
      const chromeCheck = detectSimulatorChromeOnly(
        flattened.slice(0, 10).map((c) => c.label ?? ''),
      );
      if (chromeCheck) return errorResult(chromeCheck.hint);

      const resolution = resolveSimulatorElement(elements, request.target ?? '', request.role ? { role: request.role } : {});
      if (!resolution) {
        return nativeTargetNotFound(request.target ?? '', flattened);
      }
      if (!resolution.element.path) {
        return errorResult(`Element "${request.target}" was found but has no AX path. Rebuild the native extractor and try again.`);
      }

      const mapped = mapSessionActionToNative(request.action, request.value);
      if ('error' in mapped) return errorResult(mapped.error);

      const actionResult = await this.backend.performAction(
        { kind: 'simulator', device: { udid: device.udid, name: device.name } },
        { elementPath: resolution.element.path, action: mapped.action, value: mapped.value },
      );

      const postAction = actionResult.success
        ? await this.waitForSimulatorPostAction(entry, request)
        : undefined;

      return nativeActionResponse(actionResult.success, {
        backend: 'simulator-ax',
        device: entry.device,
        requestedAction: request.action,
        axAction: mapped.action,
        target: request.target,
        resolved: formatNativeCandidate(resolution.element),
        confidence: resolution.confidence,
        tier: resolution.tier,
        alternatives: resolution.alternatives,
        postAction,
        hostCursorAffected: false,
        error: actionResult.error,
      });
    } catch (err) {
      const classified = classifyExtractorError(err);
      if (classified) return errorResult(classified.message);
      return errorResult(`native session action (simulator) failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Generic capability pass-through. Returns a result for the Epic-2 capability
   * kinds (keystroke/app/menuPath) and `null` for element kinds (which follow
   * the resolve→performAction→settle path). Dormant in Wave 0 — the MCP schema
   * does not yet expose these kinds; present so Epic 2 adds them with zero
   * controller edits.
   */
  private async dispatchCapability(
    target: NativeSessionTarget,
    request: NativeSessionActionRequest,
  ): Promise<NativeToolResult | null> {
    let outcome: ActionOutcome;
    switch (request.action) {
      case 'keystroke':
        outcome = await this.backend.keystroke(target, { chord: request.chord ?? request.value ?? '' });
        break;
      case 'app':
        outcome = await this.backend.lifecycle(target, { op: request.op ?? 'switch', app: request.app });
        break;
      case 'menuPath':
        outcome = await this.backend.menu(target, { menuPath: request.menuPath ?? [] });
        break;
      default:
        return null;
    }
    return capabilityOutcomeResult(request.action, outcome);
  }

  // ── post-action settle loops (3e9375a) ────────────────────────────────────

  private async waitForMacOSPostAction(
    entry: SessionEntry,
    request: NativeSessionActionRequest,
  ): Promise<NativePostActionState> {
    const started = Date.now();
    const timeoutMs = normalizeNativeWaitTimeout(request.waitTimeoutMs, request.waitFor ? 2000 : 700);
    let previousSignature: string | null = null;
    let latest = emptyPostActionState(started, request.waitFor);
    let attempts = 0;

    do {
      if (attempts === 0 && timeoutMs > 0) {
        await sleep(Math.min(120, timeoutMs));
      }

      const extraction = await this.backend.extract({ kind: 'macos', pid: entry.pid!, app: entry.app });
      if (extraction.kind !== 'macos') break;
      const { elements, window } = extraction;
      const candidates = flattenMacOSElements(elements);
      const interactive = candidates.filter(candidate => candidate.actions.length > 0);
      const resolution = request.waitFor
        ? resolveMacOSElement(elements, request.waitFor)
        : null;
      const signature = nativeStateSignature(window, candidates);

      attempts += 1;
      latest = {
        settled: false,
        reason: 'timeout',
        attempts,
        elapsedMs: Date.now() - started,
        waitFor: request.waitFor,
        waitForFound: Boolean(resolution),
        window,
        totalElements: candidates.length,
        interactiveElements: interactive.length,
        elements: interactive.slice(0, 10).map(formatNativeCandidate),
      };

      if (resolution) {
        return {
          ...latest,
          settled: true,
          reason: 'waitFor-found',
          elements: [formatNativeCandidate(resolution.element), ...latest.elements].slice(0, 10),
        };
      }

      if (!request.waitFor && previousSignature === signature) {
        return { ...latest, settled: true, reason: 'tree-stable' };
      }
      previousSignature = signature;
    } while (Date.now() - started < timeoutMs);

    return latest;
  }

  private async waitForSimulatorPostAction(
    entry: SessionEntry,
    request: NativeSessionActionRequest,
  ): Promise<NativePostActionState> {
    const started = Date.now();
    const timeoutMs = normalizeNativeWaitTimeout(request.waitTimeoutMs, request.waitFor ? 2000 : 700);
    let previousSignature: string | null = null;
    let latest = emptyPostActionState(started, request.waitFor);
    let attempts = 0;

    do {
      if (attempts === 0 && timeoutMs > 0) {
        await sleep(Math.min(120, timeoutMs));
      }

      const extraction = await this.backend.extract({ kind: 'simulator', device: entry.device! });
      if (extraction.kind === 'not-found') {
        return {
          ...latest,
          reason: 'timeout',
          attempts,
          elapsedMs: Date.now() - started,
        };
      }
      if (extraction.kind !== 'simulator') break;
      const candidates = flattenSimulatorElements(extraction.elements);
      const interactive = candidates.filter(candidate => candidate.actions.length > 0);
      const resolution = request.waitFor
        ? resolveSimulatorElement(extraction.elements, request.waitFor)
        : null;
      const signature = nativeStateSignature(entry.device, candidates);

      attempts += 1;
      latest = {
        settled: false,
        reason: 'timeout',
        attempts,
        elapsedMs: Date.now() - started,
        waitFor: request.waitFor,
        waitForFound: Boolean(resolution),
        totalElements: candidates.length,
        interactiveElements: interactive.length,
        elements: interactive.slice(0, 10).map(formatNativeCandidate),
      };

      if (resolution) {
        return {
          ...latest,
          settled: true,
          reason: 'waitFor-found',
          elements: [formatNativeCandidate(resolution.element), ...latest.elements].slice(0, 10),
        };
      }

      if (!request.waitFor && previousSignature === signature) {
        return { ...latest, settled: true, reason: 'tree-stable' };
      }
      previousSignature = signature;
    } while (Date.now() - started < timeoutMs);

    return latest;
  }
}

/** Process-wide controller instance (shared session store + default backend). */
export const nativeSessionController = new NativeSessionController();

// ─── Pure helpers (moved verbatim from tools.ts) ─────────────────────────────

/** Signature used for post-action tree-stability detection. E2-A cache invalidation reads this shape. */
export function nativeStateSignature(window: unknown, candidates: NativeElementCandidate[]): string {
  return JSON.stringify({
    window,
    candidates: candidates.slice(0, 200).map(candidate => [
      candidate.role,
      candidate.label,
      candidate.identifier,
      candidate.value,
      candidate.enabled,
      candidate.actions.join(','),
      candidate.frame,
    ]),
  });
}

export function mapSessionActionToNative(
  action: string,
  value?: string,
): { action: NativeAction; value?: string } | { error: string } {
  switch (action) {
    case 'click':
    case 'press':
    case 'check':
    case 'select':
      return { action: 'press' };
    case 'fill':
    case 'type':
      if (value === undefined) return { error: `${action} requires 'value'.` };
      return { action: 'setValue', value };
    case 'focus':
      return { action: 'focus' };
    case 'showMenu':
      return { action: 'showMenu' };
    case 'increment':
      return { action: 'increment' };
    case 'decrement':
      return { action: 'decrement' };
    case 'confirm':
      return { action: 'confirm' };
    case 'cancel':
      return { action: 'cancel' };
    case 'scroll':
    case 'scrollToVisible':
      return { action: 'scrollToVisible' };
    case 'hover':
    case 'doubleClick':
    case 'rightClick':
      return { error: `${action} would require pointer-style event injection. Use AX actions for cursor-free native sessions.` };
    default:
      return { error: `Unknown native action: ${action}` };
  }
}

function nativeTargetNotFound(target: string, candidates: NativeElementCandidate[]): NativeToolResult {
  const alternatives = candidates
    .filter(candidate => candidate.label || candidate.identifier)
    .slice(0, 10)
    .map(formatNativeCandidate);

  return errorResult(JSON.stringify({
    success: false,
    error: `Element "${target}" not found`,
    alternatives,
    hint: 'Use native_session_read with what="observe" to inspect actionable AX elements.',
  }, null, 2));
}

function nativeActionResponse(success: boolean, payload: Record<string, unknown>): NativeToolResult {
  const text = JSON.stringify({ success, ...payload }, null, 2);
  return success ? textResult(text) : errorResult(text);
}

/** Render an Epic-2 capability outcome. Dormant in Wave 0 (kinds not on the wire). */
function capabilityOutcomeResult(action: string, outcome: ActionOutcome): NativeToolResult {
  const text = JSON.stringify({ action, ...outcome }, null, 2);
  return outcome.success ? textResult(text) : errorResult(text);
}

function emptyPostActionState(started: number, waitFor?: string): NativePostActionState {
  return {
    settled: false,
    reason: 'timeout',
    attempts: 0,
    elapsedMs: Date.now() - started,
    waitFor,
    waitForFound: false,
    totalElements: 0,
    interactiveElements: 0,
    elements: [],
  };
}

function normalizeNativeWaitTimeout(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(5000, Math.round(n)));
}

export function safeFilePart(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'native-session';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function formatNativeCandidate(candidate: NativeElementCandidate): Record<string, unknown> {
  return {
    role: candidate.role,
    label: candidate.label || null,
    identifier: candidate.identifier || null,
    enabled: candidate.enabled,
    actions: candidate.actions,
    path: candidate.path,
    frame: candidate.frame,
  };
}
