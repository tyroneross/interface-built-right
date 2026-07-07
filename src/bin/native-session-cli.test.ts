/**
 * `native-session-cli.ts` handler unit tests (chunk E4-C, T-03).
 *
 * Exercises `handleStart`/`handleRead`/`handleAction`/`handleClose` directly
 * against an injected fake `NativeBackend` (no Swift, no real macOS app,
 * matching the pattern in `src/native/session-controller.test.ts`) — these
 * are the functions the commander `.action()` callbacks call before printing
 * JSON and calling `process.exit`, so testing them directly proves the exit
 * code + JSON envelope contract without needing to spawn a child process or
 * a running app.
 *
 * The cross-process session-store *logic* is unit-tested in
 * `src/native/session-store.test.ts` (atomic write, last-writer-wins,
 * corrupt-file handling). The last describe block here re-proves the full
 * start→action→close lifecycle through the REAL filesystem-backed store
 * (not an injected stub), with each step calling the handler fresh — the
 * same shape as three separate `ibr native:session:*` OS-process
 * invocations sharing only `.ibr/native-sessions/<id>.json`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { MacOSAXElement, MacOSWindowInfo } from '../native/types.js';
import type { NativeActionResult } from '../native/actions.js';
import type {
  NativeBackend,
  NativeExtraction,
  NativeScreenshotCapture,
  NativeSessionTarget,
} from '../native/backend.js';
import { type ActionOutcome, notImplementedOutcome } from '../action-outcome.js';
import { NativeSessionController } from '../native/session-controller.js';
import type { SessionEntry } from '../mcp/sessions.js';
import {
  handleStart,
  handleRead,
  handleAction,
  handleClose,
  defaultCliDeps,
  EXIT_OK,
  EXIT_ACTION_FAILED,
  EXIT_SESSION_NOT_FOUND,
  EXIT_WAIT_FAILED,
  EXIT_INVALID_TARGET,
  type CliDeps,
} from './native-session-cli.js';
import { writeSession, readSession, deleteSession, type StoredNativeSession } from '../native/session-store.js';

// Preflight is real; stub it green so action tests exercise CLI/controller
// logic instead of shelling out to check Xcode/AX permissions (matches
// session-controller.test.ts's mocking pattern).
vi.mock('../native/preflight.js', async () => {
  const actual = await vi.importActual<typeof import('../native/preflight.js')>('../native/preflight.js');
  return {
    ...actual,
    macOSNativePreflight: vi.fn().mockResolvedValue({ ok: true }),
    simulatorNativePreflight: vi.fn().mockResolvedValue({ ok: true }),
    classifyExtractorError: vi.fn().mockReturnValue(null),
  };
});

const windowInfo: MacOSWindowInfo = { windowId: 7, width: 400, height: 300, title: 'Fake' };

function macElement(overrides: Partial<MacOSAXElement> & { path: number[] }): MacOSAXElement {
  return {
    role: 'AXButton', subrole: null, title: null, description: null, identifier: null,
    value: null, enabled: true, focused: false, actions: ['AXPress'],
    position: { x: 0, y: 0 }, size: { width: 100, height: 40 }, children: [], ...overrides,
  };
}

/** Configurable fake backend — same shape as session-controller.test.ts's FakeBackend. */
class FakeBackend implements NativeBackend {
  extractResult: NativeExtraction = { kind: 'macos', elements: [], window: windowInfo };
  actionResult: NativeActionResult = { success: true, action: 'press' };
  screenshotResult: NativeScreenshotCapture = {
    kind: 'macos', base64: 'ZmFrZQ==', window: windowInfo, screenshotPath: '/tmp/x.png',
  };

  async extract(): Promise<NativeExtraction> { return this.extractResult; }
  async performAction(): Promise<NativeActionResult> { return this.actionResult; }
  async captureScreenshot(): Promise<NativeScreenshotCapture> { return this.screenshotResult; }
  async keystroke(_t: NativeSessionTarget): Promise<ActionOutcome> { return notImplementedOutcome('keystroke'); }
  async lifecycle(_t: NativeSessionTarget): Promise<ActionOutcome> { return notImplementedOutcome('app lifecycle'); }
  async menu(_t: NativeSessionTarget): Promise<ActionOutcome> { return notImplementedOutcome('menu'); }
}

/** Build a CliDeps whose controller is backed by a given fake backend, with an
 * in-memory (not file-backed) stub session store — for tests that only care
 * about handler/exit-code/JSON behavior, not filesystem persistence. */
function fakeDeps(backend: NativeBackend, seed?: Record<string, StoredNativeSession>): CliDeps & {
  written: Array<{ sessionId: string; entry: StoredNativeSession }>;
  deleted: string[];
} {
  const written: Array<{ sessionId: string; entry: StoredNativeSession }> = [];
  const deleted: string[] = [];
  const table: Record<string, StoredNativeSession> = { ...seed };
  return {
    makeController: (store: Map<string, SessionEntry>) => new NativeSessionController({ store, backend }),
    writeSession: (sessionId, entry) => { table[sessionId] = entry; written.push({ sessionId, entry }); },
    readSession: (sessionId) => table[sessionId] ?? null,
    deleteSession: (sessionId) => { delete table[sessionId]; deleted.push(sessionId); },
    written,
    deleted,
  };
}

describe('handleStart', () => {
  it('exits EXIT_INVALID_TARGET when zero of app/pid/simulator are given', async () => {
    const res = await handleStart({}, fakeDeps(new FakeBackend()));
    expect(res.exitCode).toBe(EXIT_INVALID_TARGET);
    expect(res.json.ok).toBe(false);
  });

  it('exits EXIT_INVALID_TARGET when more than one of app/pid/simulator are given', async () => {
    const res = await handleStart({ app: 'TextEdit', pid: 1 }, fakeDeps(new FakeBackend()));
    expect(res.exitCode).toBe(EXIT_INVALID_TARGET);
  });

  it('starts a macOS session by pid, persists it, and returns exit 0 + sessionId in JSON', async () => {
    const deps = fakeDeps(new FakeBackend());
    const res = await handleStart({ pid: 4242, sessionId: 'fixed-id' }, deps);
    expect(res.exitCode).toBe(EXIT_OK);
    expect(res.json.ok).toBe(true);
    expect(res.json.sessionId).toBe('fixed-id');
    expect(deps.written).toHaveLength(1);
    expect(deps.written[0]).toEqual({ sessionId: 'fixed-id', entry: { type: 'macos', app: 'pid-4242', pid: 4242, createdAt: expect.any(Number) } });
  });

  it('an invalid pid (<=0) is rejected by the controller and reported as EXIT_INVALID_TARGET, nothing persisted', async () => {
    const deps = fakeDeps(new FakeBackend());
    const res = await handleStart({ pid: -1, sessionId: 'bad-pid' }, deps);
    expect(res.exitCode).toBe(EXIT_INVALID_TARGET);
    expect(deps.written).toHaveLength(0);
  });
});

describe('handleRead', () => {
  it('exits EXIT_SESSION_NOT_FOUND when the sessionId has no stored entry', async () => {
    const res = await handleRead({ sessionId: 'ghost' }, fakeDeps(new FakeBackend()));
    expect(res.exitCode).toBe(EXIT_SESSION_NOT_FOUND);
    expect(res.json.error).toMatch(/Session not found/);
  });

  it('reads observe mode against a seeded macOS session and returns exit 0 with elements', async () => {
    const backend = new FakeBackend();
    backend.extractResult = { kind: 'macos', elements: [macElement({ title: 'Save', path: [0] })], window: windowInfo };
    const deps = fakeDeps(backend, { s1: { type: 'macos', app: 'TextEdit', pid: 4242, createdAt: 1 } });

    const res = await handleRead({ sessionId: 's1' }, deps);
    expect(res.exitCode).toBe(EXIT_OK);
    expect(res.json.totalElements).toBe(1);
  });

  it('an unknown read mode is reported as EXIT_INVALID_TARGET', async () => {
    const deps = fakeDeps(new FakeBackend(), { s1: { type: 'macos', app: 'TextEdit', pid: 4242, createdAt: 1 } });
    const res = await handleRead({ sessionId: 's1', what: 'bogus-mode' }, deps);
    expect(res.exitCode).toBe(EXIT_INVALID_TARGET);
  });
});

describe('handleAction', () => {
  it('exits EXIT_SESSION_NOT_FOUND when the sessionId has no stored entry', async () => {
    const res = await handleAction({ sessionId: 'ghost', action: 'press', target: 'Save' }, fakeDeps(new FakeBackend()));
    expect(res.exitCode).toBe(EXIT_SESSION_NOT_FOUND);
  });

  it('a successful press returns exit 0 with success:true + provenance', async () => {
    const backend = new FakeBackend();
    backend.extractResult = { kind: 'macos', elements: [macElement({ title: 'Save', path: [0] })], window: windowInfo };
    backend.actionResult = { success: true, action: 'press' };
    const deps = fakeDeps(backend, { s1: { type: 'macos', app: 'TextEdit', pid: 4242, createdAt: 1 } });

    const res = await handleAction({ sessionId: 's1', action: 'press', target: 'Save', waitTimeoutMs: 0 }, deps);
    expect(res.exitCode).toBe(EXIT_OK);
    expect(res.json.success).toBe(true);
    expect(res.json.tier).toBeDefined();
  });

  it('a target that cannot be resolved exits EXIT_INVALID_TARGET (falsifier: invalid target)', async () => {
    const backend = new FakeBackend();
    backend.extractResult = { kind: 'macos', elements: [macElement({ title: 'Save', path: [0] })], window: windowInfo };
    const deps = fakeDeps(backend, { s1: { type: 'macos', app: 'TextEdit', pid: 4242, createdAt: 1 } });

    const res = await handleAction({ sessionId: 's1', action: 'press', target: 'Ghost' }, deps);
    expect(res.exitCode).toBe(EXIT_INVALID_TARGET);
    expect(res.json.error).toBe('Element "Ghost" not found');
  });

  it('an explicit --wait-for that never resolves exits EXIT_WAIT_FAILED (falsifier: failed wait)', async () => {
    const backend = new FakeBackend();
    backend.extractResult = { kind: 'macos', elements: [macElement({ title: 'Save', path: [0] })], window: windowInfo };
    backend.actionResult = { success: true, action: 'press' };
    const deps = fakeDeps(backend, { s1: { type: 'macos', app: 'TextEdit', pid: 4242, createdAt: 1 } });

    const res = await handleAction({
      sessionId: 's1', action: 'press', target: 'Save', waitFor: 'NeverAppears', waitTimeoutMs: 20,
    }, deps);
    expect(res.exitCode).toBe(EXIT_WAIT_FAILED);
    expect(res.json.error).toMatch(/timed out/);
  });

  it('a resolved action whose underlying AX call fails exits EXIT_ACTION_FAILED (falsifier: failed action)', async () => {
    const backend = new FakeBackend();
    backend.extractResult = { kind: 'macos', elements: [macElement({ title: 'Save', path: [0] })], window: windowInfo };
    backend.actionResult = { success: false, action: 'press', error: 'AX action rejected' };
    const deps = fakeDeps(backend, { s1: { type: 'macos', app: 'TextEdit', pid: 4242, createdAt: 1 } });

    const res = await handleAction({ sessionId: 's1', action: 'press', target: 'Save', waitTimeoutMs: 0 }, deps);
    expect(res.exitCode).toBe(EXIT_ACTION_FAILED);
    expect(res.json.error).toBe('AX action rejected');
  });

  it('a dormant Epic-2 capability (keystroke, not-implemented) exits EXIT_ACTION_FAILED, not EXIT_INVALID_TARGET', async () => {
    const deps = fakeDeps(new FakeBackend(), { s1: { type: 'macos', app: 'TextEdit', pid: 4242, createdAt: 1 } });
    const res = await handleAction({ sessionId: 's1', action: 'keystroke', chord: 'Meta+n' }, deps);
    expect(res.exitCode).toBe(EXIT_ACTION_FAILED);
  });
});

describe('handleClose', () => {
  it('exits EXIT_SESSION_NOT_FOUND when the sessionId has no stored entry', async () => {
    const res = await handleClose({ sessionId: 'ghost' }, fakeDeps(new FakeBackend()));
    expect(res.exitCode).toBe(EXIT_SESSION_NOT_FOUND);
  });

  it('closes a seeded session, deletes it from the store, and exits 0', async () => {
    const deps = fakeDeps(new FakeBackend(), { s1: { type: 'macos', app: 'TextEdit', pid: 4242, createdAt: 1 } });
    const res = await handleClose({ sessionId: 's1' }, deps);
    expect(res.exitCode).toBe(EXIT_OK);
    expect(deps.deleted).toEqual(['s1']);
  });
});

describe('defaultCliDeps', () => {
  it('wires the real file-backed session-store functions', () => {
    const deps = defaultCliDeps();
    expect(deps.writeSession).toBe(writeSession);
    expect(deps.readSession).toBe(readSession);
    expect(deps.deleteSession).toBe(deleteSession);
  });
});

// ─── T-03: cross-process repro through the REAL filesystem store ─────────
//
// Each step below calls the handler fresh with a NEW CliDeps object built
// from the real (non-stubbed) session-store functions bound to a temp
// directory — nothing here shares in-memory state between steps except the
// directory on disk, which is exactly the boundary three separate
// `ibr native:session:*` OS-process invocations would share.

describe('T-03 cross-process repro: start -> action -> close via the real file store', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ibr-native-cli-e2e-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function realDepsWithBackend(backend: NativeBackend): CliDeps {
    return {
      makeController: (store) => new NativeSessionController({ store, backend }),
      writeSession: (sessionId, entry) => writeSession(sessionId, entry, dir),
      readSession: (sessionId) => readSession(sessionId, dir),
      deleteSession: (sessionId) => deleteSession(sessionId, dir),
    };
  }

  it('start (process 1) -> action (process 2) -> close (process 3), each a fresh handler call', async () => {
    const backend = new FakeBackend();
    backend.extractResult = { kind: 'macos', elements: [macElement({ title: 'Save', path: [0] })], window: windowInfo };
    backend.actionResult = { success: true, action: 'press' };

    // Process 1: start.
    const startRes = await handleStart({ pid: 555, sessionId: 'repro-1' }, realDepsWithBackend(backend));
    expect(startRes.exitCode).toBe(EXIT_OK);
    expect(readSession('repro-1', dir)).not.toBeNull();

    // Process 2: action — a brand-new CliDeps/controller, reading only the file.
    const actionRes = await handleAction(
      { sessionId: 'repro-1', action: 'press', target: 'Save', waitTimeoutMs: 0 },
      realDepsWithBackend(backend),
    );
    expect(actionRes.exitCode).toBe(EXIT_OK);
    expect(actionRes.json.success).toBe(true);

    // Process 3: close — again a brand-new CliDeps/controller.
    const closeRes = await handleClose({ sessionId: 'repro-1' }, realDepsWithBackend(backend));
    expect(closeRes.exitCode).toBe(EXIT_OK);
    expect(readSession('repro-1', dir)).toBeNull();

    // Process 4: a subsequent action against the now-closed session must
    // report missing-session, not silently re-run against stale state.
    const postCloseRes = await handleAction(
      { sessionId: 'repro-1', action: 'press', target: 'Save' },
      realDepsWithBackend(backend),
    );
    expect(postCloseRes.exitCode).toBe(EXIT_SESSION_NOT_FOUND);
  });
});
