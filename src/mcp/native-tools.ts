/**
 * IBR native MCP tools — thin adapters over `NativeSessionController`.
 *
 * Physically split out of `tools.ts` at Wave 0 (chunk C0, ADR-03). This module
 * owns the native session tool DEFINITIONS and their handlers, plus the six
 * web→native delegation functions (`startMacOSSession` / `startSimulatorSession`
 * / `runMacOSSessionAction` / `runSimulatorSessionAction` / `readMacOSSession` /
 * `readSimulatorSession`) whose signatures are FROZEN — `tools.ts`'s web session
 * handlers call them across the boundary for native-typed sessions.
 *
 * These handlers contain ZERO orchestration logic: no direct
 * `extractMacOSElements` / `performNativeAction` calls. All AX I/O, resolution,
 * and settling live in the controller (which routes through a `NativeBackend`).
 *
 * Import direction is ONE-WAY: this module imports from `./sessions.js` and
 * `../native/session-controller.js` — NEVER from `./tools`.
 */

import { sessions } from './sessions.js';
import {
  nativeSessionController,
  type NativeToolResult,
  type NativeSessionActionRequest,
  type NativeActionKind,
} from '../native/session-controller.js';
import type { AppLifecycleOp } from '../native/backend.js';

// ─── E4-B: wire enum ↔ frozen-type single source of truth ────────────────────

/**
 * The `native_session_action` wire enum, additive over C0's Wave-0 element
 * verbs with the Epic-2 capability kinds (`keystroke`/`app`/`menuPath`). This
 * array IS the schema's `enum` (spread below) — never hand-duplicated — so a
 * hand-edit of the schema literal without updating this array is caught by the
 * runtime equality test in native-tools.test.ts. Element ordering/content is
 * additive-only: every Wave-0 value is preserved verbatim.
 */
export const NATIVE_ACTION_KIND_VALUES = [
  'click', 'press', 'fill', 'type', 'focus', 'showMenu', 'increment',
  'decrement', 'confirm', 'cancel', 'scroll', 'scrollToVisible', 'check',
  'select', 'keystroke', 'app', 'menuPath',
] as const;

/**
 * Compile-time equality falsifier (checked by `npm run typecheck`, NOT by
 * `vitest run` — vitest transpiles without type-checking): `AssertTypeEqual`
 * fails to compile unless `NATIVE_ACTION_KIND_VALUES`'s literal union is
 * EXACTLY C0's frozen `NativeActionKind` union — no value present without a
 * frozen type, and no frozen kind absent from the array. This is the single
 * source of truth the plan requires; if C0's union ever changes, `tsc` fails
 * here rather than drifting silently.
 */
type AssertTypeEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _nativeActionKindEnumMatchesFrozenType: AssertTypeEqual<
  (typeof NATIVE_ACTION_KIND_VALUES)[number],
  NativeActionKind
> = true;
void _nativeActionKindEnumMatchesFrozenType;

// ─── MCP content/response shapes (structurally identical to tools.ts) ────────

type McpContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string };

type McpResponse = { content: McpContent[]; isError?: boolean };

function errorResponse(text: string): McpResponse {
  return { content: [{ type: 'text' as const, text }], isError: true as const };
}

function imageResponse(base64: string, metadata: string): McpResponse {
  return {
    content: [
      { type: 'image' as const, data: base64, mimeType: 'image/png' },
      { type: 'text' as const, text: metadata },
    ],
  };
}

/** Map a controller result to the MCP wire response. */
function toMcp(result: NativeToolResult): McpResponse {
  if (result.kind === 'image') return imageResponse(result.base64, result.metadata);
  return result.isError
    ? { content: [{ type: 'text' as const, text: result.text }], isError: true as const }
    : { content: [{ type: 'text' as const, text: result.text }] };
}

/**
 * R2: normalize the `what` arg for native_session_read (duplicated from
 * tools.ts to keep the one-way import boundary — same logic, same defaults).
 */
function normalizeReadMode(what: unknown): string {
  if (typeof what === 'string') {
    const trimmed = what.trim();
    return trimmed === '' ? 'observe' : trimmed.toLowerCase();
  }
  return 'observe';
}

// ─── Frozen web→native delegation functions (called by tools.ts) ─────────────

export async function startMacOSSession(
  sessionId: string,
  app: string,
  errorPrefix: string,
): Promise<McpResponse> {
  return toMcp(await nativeSessionController.startMacOS(sessionId, app, errorPrefix));
}

export async function startSimulatorSession(
  sessionId: string,
  simulator: string,
  errorPrefix: string,
): Promise<McpResponse> {
  return toMcp(await nativeSessionController.startSimulator(sessionId, simulator, errorPrefix));
}

export function startMacOSPidSession(sessionId: string, pid: number): McpResponse {
  return toMcp(nativeSessionController.startMacOSPid(sessionId, pid));
}

export async function readMacOSSession(
  entry: Parameters<typeof nativeSessionController.readMacOS>[0],
  what: string,
  limit: number,
): Promise<McpResponse> {
  return toMcp(await nativeSessionController.readMacOS(entry, what, limit));
}

export async function readSimulatorSession(
  entry: Parameters<typeof nativeSessionController.readSimulator>[0],
  what: string,
  limit: number,
): Promise<McpResponse> {
  return toMcp(await nativeSessionController.readSimulator(entry, what, limit));
}

export async function runMacOSSessionAction(
  entry: Parameters<typeof nativeSessionController.actionMacOS>[0],
  request: NativeSessionActionRequest,
): Promise<McpResponse> {
  return toMcp(await nativeSessionController.actionMacOS(entry, request));
}

export async function runSimulatorSessionAction(
  entry: Parameters<typeof nativeSessionController.actionSimulator>[0],
  request: NativeSessionActionRequest,
): Promise<McpResponse> {
  return toMcp(await nativeSessionController.actionSimulator(entry, request));
}

// ─── Native tool handlers (thin) ─────────────────────────────────────────────

async function handleNativeSessionStart(args: Record<string, unknown>): Promise<McpResponse> {
  const app = args.app as string | undefined;
  const pid = args.pid as number | undefined;
  const simulator = args.simulator as string | undefined;

  const providedTargets = [app !== undefined, pid !== undefined, simulator !== undefined].filter(Boolean).length;
  if (providedTargets > 1) {
    return errorResponse("Provide only one native target: 'app', 'pid', or 'simulator'.");
  }
  if (providedTargets === 0) {
    return errorResponse("native_session_start requires 'app' or 'pid' for macOS, or 'simulator' for iOS/watchOS.");
  }

  const sessionId = crypto.randomUUID();
  if (pid !== undefined) {
    return startMacOSPidSession(sessionId, pid);
  }
  if (app) {
    return await startMacOSSession(sessionId, app, 'native_session_start (macos)');
  }
  return await startSimulatorSession(sessionId, simulator!, 'native_session_start (simulator)');
}

async function handleNativeSessionRead(args: Record<string, unknown>): Promise<McpResponse> {
  const sessionId = args.sessionId as string;
  const what = normalizeReadMode(args.what);
  const limit = Number(args.limit) || 50;
  const entry = sessions.get(sessionId);

  if (!entry) return errorResponse('Session not found. Use native_session_start first.');
  if (entry.type === 'macos') return await readMacOSSession(entry, what, limit);
  if (entry.type === 'simulator') return await readSimulatorSession(entry, what, limit);
  return errorResponse(`Session ${sessionId} is a ${entry.type} web session. Use session_read for web sessions.`);
}

async function handleNativeSessionAction(args: Record<string, unknown>): Promise<McpResponse> {
  const {
    sessionId,
    action,
    target,
    value,
    role,
    waitFor,
    waitTimeoutMs,
    chord,
    op,
    app,
    menuPath,
  } = args as {
    sessionId: string;
    action: string;
    target?: string;
    value?: string;
    role?: string;
    waitFor?: string;
    waitTimeoutMs?: number;
    // Capability params (Epic 2, now LIVE) — additive; wired through to the
    // controller's generic capability dispatch (keystroke/app/menuPath).
    chord?: string;
    op?: AppLifecycleOp;
    app?: string;
    menuPath?: string[];
  };

  const entry = sessions.get(sessionId);
  if (!entry) return errorResponse('Session not found. Use native_session_start first.');
  const request = { action, target, value, role, waitFor, waitTimeoutMs, chord, op, app, menuPath };
  if (entry.type === 'macos') return await runMacOSSessionAction(entry, request);
  if (entry.type === 'simulator') return await runSimulatorSessionAction(entry, request);
  return errorResponse(`Session ${sessionId} is a ${entry.type} web session. Use session_action for web sessions.`);
}

async function handleNativeSessionClose(args: Record<string, unknown>): Promise<McpResponse> {
  const sessionId = args.sessionId as string;
  return toMcp(nativeSessionController.closeNative(sessionId));
}

/**
 * Dispatch a native tool call. `tools.ts` delegates the four `native_session_*`
 * cases here via a single aggregation import.
 */
export async function handleNativeToolCall(
  name: string,
  args: Record<string, unknown>,
): Promise<McpResponse> {
  switch (name) {
    case 'native_session_start':
      return await handleNativeSessionStart(args);
    case 'native_session_read':
      return await handleNativeSessionRead(args);
    case 'native_session_action':
      return await handleNativeSessionAction(args);
    case 'native_session_close':
      return await handleNativeSessionClose(args);
    default:
      return errorResponse(`Unknown native tool: ${name}`);
  }
}

// ─── Native tool definitions (moved verbatim from tools.ts) ──────────────────

export const NATIVE_SESSION_TOOLS = [
  {
    name: "native_session_start",
    description:
      "Start a cursor-free native UI session for a running macOS app or iOS/watchOS simulator. macOS uses AXUIElement actions; simulator uses the Simulator.app accessibility tree when available. Does not move the user's mouse cursor.",
    inputSchema: {
      type: "object" as const,
      properties: {
        app: {
          type: "string",
          description: "macOS app name, bundle ID, or process-name fragment (e.g. 'Finder', 'Calculator', 'com.apple.TextEdit').",
        },
        pid: {
          type: "number",
          description: "Direct macOS process ID. Use when the agent already knows the PID or app-name discovery is blocked.",
        },
        simulator: {
          type: "string",
          description: "Simulator device name or UDID for iOS/watchOS (e.g. 'iPhone 16 Pro').",
        },
      },
    },
    annotations: {
      title: "Start Native Session",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "native_session_read",
    description:
      "Read a cursor-free native session. Modes: observe (interactive elements — default), extract (AX element summary), state (session metadata), screenshot (when supported).",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: { type: "string", description: "Session ID returned by native_session_start" },
        what: {
          type: "string",
          enum: ["observe", "extract", "screenshot", "state"],
          default: "observe",
          description: "What to read from the native session. Defaults to 'observe' when omitted.",
        },
        limit: { type: "number", description: "Maximum elements to return for observe/extract (default: 50)" },
      },
      required: ["sessionId"],
    },
    annotations: {
      title: "Read Native Session",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "native_session_action",
    description:
      "Perform a cursor-free native action by accessible name: click/press, fill/type, focus, showMenu, increment, decrement, confirm, cancel, scrollToVisible, check, select — or an Epic-2 capability kind: keystroke (live chord synthesis to the focused element), app (live lifecycle op: launch/switch/quit), menuPath (live AXMenu traversal). Uses Accessibility APIs instead of moving the host cursor. Element verbs require `target`; keystroke/app/menuPath accept an optional `target`.",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: { type: "string", description: "Session ID returned by native_session_start" },
        action: {
          type: "string",
          enum: [...NATIVE_ACTION_KIND_VALUES],
          description: "Native action to perform. Element verbs (click/press/fill/type/focus/showMenu/increment/decrement/confirm/cancel/scroll/scrollToVisible/check/select) require `target`. Capability kinds keystroke/app/menuPath are live (Epic 2) and accept an optional `target`.",
        },
        target: { type: "string", description: "Accessible name, AX identifier, description, or visible value to target. Required for element verbs; optional for keystroke/app/menuPath." },
        value: { type: "string", description: "Text for fill/type/setValue actions" },
        role: { type: "string", description: "Optional role filter (button, textbox, checkbox, AXButton, etc.)" },
        chord: {
          type: "string",
          description: "Keyboard chord for the `keystroke` action, e.g. 'Meta+n', 'Tab', 'Escape'. Live — synthesized as CGEvents to the focused element (E2-B).",
        },
        op: {
          type: "string",
          enum: ["launch", "switch", "quit"],
          description: "App lifecycle operation for the `app` action. Live — launch/switch/quit via OS process control (E2-C).",
        },
        app: {
          type: "string",
          description: "App name or bundle id for the `app` action's lifecycle op (required for launch, optional for switch/quit). Live (Epic 2, E2-C).",
        },
        menuPath: {
          type: "array",
          items: { type: "string" },
          description: "Ordered AXMenu item titles to traverse for the `menuPath` action, e.g. [\"File\", \"New Window\"]. Live — walks the menu bar / open context menu and AXPresses the final item (E2-D).",
        },
        waitFor: {
          type: "string",
          description: "Optional accessible name, AX identifier, description, or visible value expected after the action. The tool polls until it appears or waitTimeoutMs expires.",
        },
        waitTimeoutMs: {
          type: "number",
          description: "Maximum post-action settle time in milliseconds. Defaults to 2000 when waitFor is provided, otherwise 700. Clamped to 0..5000.",
        },
      },
      required: ["sessionId", "action"],
    },
    annotations: {
      title: "Native Session Action",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "native_session_close",
    description: "Close a native session record. This does not quit the target app or simulator.",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: { type: "string", description: "Session ID returned by native_session_start" },
      },
      required: ["sessionId"],
    },
    annotations: {
      title: "Close Native Session",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
];
