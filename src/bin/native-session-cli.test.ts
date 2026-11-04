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
  handleComputerUse,
  handleReplay,
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
    value: null, placeholder: null, enabled: true, focused: false, actions: ['AXPress'],
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

/** Positive action fixtures must produce an observed effect, not just AX delivery. */
function observePress(backend: FakeBackend) {
  backend.performAction = async () => {
    if (backend.extractResult.kind === 'macos') {
      const elements = structuredClone(backend.extractResult.elements);
      elements[0].value = String(Number(elements[0].value ?? 0) + 1);
      backend.extractResult = { ...backend.extractResult, elements };
    }
    return backend.actionResult;
  };
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
    observePress(backend);
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
    observePress(backend);
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

  it('a live capability (keystroke) that fails delivery exits EXIT_ACTION_FAILED, not EXIT_INVALID_TARGET', async () => {
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
    observePress(backend);

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

describe('compact refs (--what refs / --ref)', () => {
  it('reads numbered refs, then acts by ref and returns only the AX diff', async () => {
    const { mkdtempSync } = await import('fs');
    const { tmpdir } = await import('os');
    const { join } = await import('path');
    const backend = new FakeBackend();
    backend.extractResult = { kind: 'macos', elements: [macElement({ title: 'Save', path: [0] })], window: windowInfo };
    const deps = { ...fakeDeps(backend, { s1: { type: 'macos', app: 'TextEdit', pid: 4242, createdAt: 1 } }), refsDir: mkdtempSync(join(tmpdir(), 'ibr-cli-refs-')) };

    const read = await handleRead({ sessionId: 's1', what: 'refs' }, deps);
    expect(read.exitCode).toBe(EXIT_OK);
    expect(read.text).toMatch(/^e1 Button "Save"/);
    expect(read.json.full).toMatch(/s1\.observe\.[a-f0-9-]+\.json$/);

    backend.extractResult = {
      kind: 'macos',
      elements: [macElement({ title: 'Save', path: [0] }), macElement({ role: 'AXStaticText', title: 'Saved', path: [1] })],
      window: windowInfo,
    };
    observePress(backend);
    const act = await handleAction({ sessionId: 's1', action: 'press', ref: 'e1', waitFor: 'Save', waitTimeoutMs: 0 }, deps);
    expect(act.exitCode).toBe(EXIT_OK);
    expect(act.json.axChanged).toBe(true);
    expect(act.text).toContain('+ e2 StaticText "Saved"');

    const bad = await handleAction({ sessionId: 's1', action: 'press', ref: 'e99' }, deps);
    expect(bad.exitCode).toBe(EXIT_INVALID_TARGET);
  });
});

describe('handleComputerUse', () => {
  it('maps an Anthropic click, drives the simulator and returns the AX diff', async () => {
    const { mkdtempSync } = await import('fs');
    const { tmpdir } = await import('os');
    const { join } = await import('path');
    let reads = 0;
    const executed: unknown[] = [];
    const deps = {
      ...fakeDeps(new FakeBackend(), { sim: { type: 'simulator', device: { udid: 'U1', name: 'iPhone' }, createdAt: 1 } }),
      refsDir: mkdtempSync(join(tmpdir(), 'ibr-cu-')),
      readSimulatorElements: async () => (reads++ === 0
        ? [{ role: 'AXButton', label: 'General' }]
        : [{ role: 'AXButton', label: 'General' }, { role: 'AXStaticText', label: 'About' }]),
      executeOnSimulator: async (_u: string, a: unknown) => { executed.push(a); return { success: true }; },
      settleIntervalMs: 0,
    };
    const res = await handleComputerUse({ sessionId: 'sim', actionJson: '{"action":"left_click","coordinate":[100,200]}' }, deps);
    expect(executed).toEqual([{ kind: 'click', x: 100, y: 200, count: 1 }]);
    expect(res.exitCode).toBe(EXIT_OK);
    expect(res.text).toContain('+ e2 StaticText "About"');
  });

  it('rejects macOS sessions and malformed actions with EXIT_INVALID_TARGET', async () => {
    const deps = fakeDeps(new FakeBackend(), {
      mac: { type: 'macos', app: 'TextEdit', pid: 1, createdAt: 1 },
      sim: { type: 'simulator', device: { udid: 'U1', name: 'iPhone' }, createdAt: 1 },
    });
    expect((await handleComputerUse({ sessionId: 'mac', actionJson: '{"type":"click","x":1,"y":1}' }, deps)).exitCode).toBe(EXIT_INVALID_TARGET);
    expect((await handleComputerUse({ sessionId: 'sim', actionJson: 'not json' }, deps)).exitCode).toBe(EXIT_INVALID_TARGET);
  });
});

describe('record -> replay round trip and ref safety', () => {
  const seed = { s1: { type: 'macos' as const, app: 'Calc', pid: 4242, createdAt: 1 } };
  const tree = [macElement({ path: [0], title: 'Seven', position: { x: 0, y: 0 } }), macElement({ path: [1], title: 'Add', position: { x: 0, y: 50 } })];

  it('records through handleAction and replays the same tree as a cache hit', async () => {
    const backend = new FakeBackend();
    backend.extractResult = { kind: 'macos', elements: tree, window: windowInfo };
    const dir = mkdtempSync(join(tmpdir(), 'ibr-rr-'));
    const file = join(dir, 'flow.json');
    const deps = { ...fakeDeps(backend, seed), refsDir: dir };
    observePress(backend);
    const rec = await handleAction({ sessionId: 's1', action: 'press', target: 'Seven', record: file, waitTimeoutMs: 0 }, deps);
    expect(rec.exitCode).toBe(EXIT_OK);
    expect(rec.json.recorded).toBe(1);
    backend.extractResult = { kind: 'macos', elements: tree, window: windowInfo };
    const rep = await handleReplay({ sessionId: 's1', file }, deps, { backend, settleMs: 0 });
    expect(rep.exitCode).toBe(EXIT_OK);
    expect((rep.json.reports as Array<{ status: string }>)[0].status).toBe('cached');
    rmSync(dir, { recursive: true, force: true });
  });

  it('refuses a ref whose role+name is shared by another element', async () => {
    const backend = new FakeBackend();
    backend.extractResult = { kind: 'macos', elements: [macElement({ path: [0], title: 'Delete' }), macElement({ path: [1], title: 'Delete', position: { x: 0, y: 90 } })], window: windowInfo };
    const dir = mkdtempSync(join(tmpdir(), 'ibr-amb-'));
    const deps = { ...fakeDeps(backend, seed), refsDir: dir };
    await handleRead({ sessionId: 's1', what: 'refs' }, deps);
    const res = await handleAction({ sessionId: 's1', action: 'press', ref: 'e2', waitTimeoutMs: 0 }, deps);
    expect(res.exitCode).toBe(EXIT_INVALID_TARGET);
    expect(String(res.json.error)).toContain('ambiguous');
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('native window/key CLI parity', () => {
  it('passes exact title and dimensions to the measured resize capability', async () => {
    const backend = new FakeBackend();
    const frame = { x: 100, y: 200, width: 900, height: 650 };
    backend.actionResult = { success: true, action: 'resizeWindow', resizeWindow: { pid: 4242, windowTitle: '', requested: { width: 900, height: 650 }, before: frame, actual: frame, tolerance: 0.5 } };
    const perform = vi.spyOn(backend, 'performAction');
    const deps = fakeDeps(backend, { s1: { type: 'macos', app: 'Editor', pid: 4242, createdAt: 1 } });
    const result = await handleAction({ sessionId: 's1', action: 'resizeWindow', width: 900, height: 650, windowTitle: '' }, deps);
    expect(result.exitCode).toBe(EXIT_OK);
    expect(result.json.resizeWindow).toMatchObject({ actual: frame });
    expect(perform).toHaveBeenCalledWith({ kind: 'macos', pid: 4242, app: 'Editor' }, { action: 'resizeWindow', elementPath: [], value: '{"width":900,"height":650,"windowTitle":""}' });
  });
  it('passes explicit foreground delivery and rejects a misleading target before keys', async () => {
    const backend = new FakeBackend();
    const keys = vi.spyOn(backend, 'keystroke');
    const deps = fakeDeps(backend, { s1: { type: 'macos', app: 'Editor', pid: 4242, createdAt: 1 } });
    await handleAction({ sessionId: 's1', action: 'keystroke', chord: 'Tab', delivery: 'foreground' }, deps);
    expect(keys).toHaveBeenCalledWith(expect.objectContaining({ pid: 4242 }), { chord: 'Tab', delivery: 'foreground' });
    keys.mockClear();
    const result = await handleAction({ sessionId: 's1', action: 'keystroke', chord: 'a', target: 'Editor' }, deps);
    expect(result.exitCode).not.toBe(EXIT_OK);
    expect(keys).not.toHaveBeenCalled();
  });
});

describe('compact native observation', () => {
  it('finds controls after hundreds of structural nodes and saves complete evidence', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ibr-compact-read-'));
    try {
      const backend = new FakeBackend();
      backend.extractResult = {kind:'macos',window:windowInfo,elements:[
        ...Array.from({length:300},(_,i)=>macElement({role:'AXGroup',actions:['AXScrollToVisible'],path:[i]})),
        macElement({title:'Save changes',path:[300]}),
        macElement({role:'AXLink',title:'obsidian://atlas-area?area=notes',path:[301]}),
      ]};
      const deps = fakeDeps(backend, {test:{type:'macos',app:'Fake',pid:123,createdAt:1}});
      deps.refsDir = dir;
      const result=await handleRead({sessionId:'test',format:'compact',limit:50},deps);
      expect(result.exitCode).toBe(EXIT_OK);
      expect((result.json.controls as Array<{name:string}>).map(e=>e.name)).toEqual(['Save changes','obsidian://atlas-area?area=notes']);
      expect(result.json.truncated).toBe(false);
      const {readFileSync}=await import('node:fs');
      const full=JSON.parse(readFileSync(result.json.fullReport as string,'utf8'));
      expect(full.elements).toHaveLength(302);
    } finally {rmSync(dir,{recursive:true,force:true});}
  });
  it('returns controls past the legacy 50-item default unless an explicit limit is supplied', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ibr-compact-all-'));
    try {
      const backend=new FakeBackend();
      backend.extractResult={kind:'macos',window:windowInfo,elements:[
        ...Array.from({length:60},(_,i)=>macElement({role:'AXGroup',title:`Sidebar ${i}`,path:[i]})),
        macElement({role:'AXLink',title:'obsidian://atlas-area?area=notes',path:[60]}),
      ]};
      const deps=fakeDeps(backend,{test:{type:'macos',app:'Fake',pid:123,createdAt:1}});deps.refsDir=dir;
      const result=await handleRead({sessionId:'test',format:'compact'},deps);
      expect(result.json.returned).toBe(61);expect(result.json.truncated).toBe(false);
      expect((result.json.controls as Array<{name:string}>)[60].name).toBe('obsidian://atlas-area?area=notes');
    } finally {rmSync(dir,{recursive:true,force:true});}
  });
  it('rejects unsupported format/limits without attempting extraction', async () => {
    const deps=fakeDeps(new FakeBackend(),{test:{type:'macos',app:'Fake',pid:123,createdAt:1}});
    expect((await handleRead({sessionId:'test',format:'tiny' as 'full'},deps)).exitCode).toBe(EXIT_INVALID_TARGET);
    expect((await handleRead({sessionId:'test',limit:NaN},deps)).exitCode).toBe(EXIT_INVALID_TARGET);
  });
});

describe('fused action observation',()=>{
  it('saves exact full evidence and returns compact controls from the settled read',async()=>{
    const dir=mkdtempSync(join(tmpdir(),'ibr-fused-'));
    try{
      const backend=new FakeBackend();backend.extractResult={kind:'macos',window:windowInfo,elements:[macElement({title:'Save',value:'1',path:[0]})]};
      backend.extractResult.elements[0].value='0';observePress(backend);
      const deps=fakeDeps(backend,{test:{type:'macos',pid:123,app:'Fake',createdAt:1}});deps.refsDir=dir;
      const result=await handleAction({sessionId:'test',action:'click',target:'Save',waitFor:'Save',waitTimeoutMs:0,observe:true,format:'compact'},deps);
      expect(result.exitCode).toBe(EXIT_OK);
      const observation=result.json.observation as {controls:Array<{name:string;value:string}>;observedAt:string};
      expect(observation.controls[0]).toMatchObject({name:'Save',value:'1'});
      expect(result.json.postAction).not.toHaveProperty('observation');
      const {readFileSync}=await import('node:fs');const full=JSON.parse(readFileSync(result.json.fullReport as string,'utf8'));
      expect(full.postAction.observation.elements[0].label).toBe('Save');
      expect(full.postAction.observation.observedAt).toBe(observation.observedAt);
    }finally{rmSync(dir,{recursive:true,force:true});}
  });
  it('refuses an unsettled observation rather than reporting it as verified',async()=>{
    const backend=new FakeBackend();backend.extractResult={kind:'macos',window:windowInfo,elements:[macElement({title:'Save',path:[0]})]};
    const deps=fakeDeps(backend,{test:{type:'macos',pid:123,app:'Fake',createdAt:1}});
    const result=await handleAction({sessionId:'test',action:'click',target:'Save',waitTimeoutMs:0,observe:true,format:'compact'},deps);
    expect(result.exitCode).toBe(EXIT_WAIT_FAILED);expect(result.json.ok).toBe(false);
  });
  it('rejects incompatible flags before delivering any action',async()=>{
    const deps=fakeDeps(new FakeBackend(),{test:{type:'macos',pid:123,app:'Fake',createdAt:1}});
    expect((await handleAction({sessionId:'test',action:'keystroke',observe:true},deps)).exitCode).toBe(EXIT_INVALID_TARGET);
    expect((await handleAction({sessionId:'test',action:'click',format:'compact'},deps)).exitCode).toBe(EXIT_INVALID_TARGET);
  });
});

describe('compact native failures retain complete evidence', () => {
  it('bounds a delivered-but-unverified timeout and retains the entire last snapshot', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ibr-compact-failure-'));
    try {
      const backend = new FakeBackend();
      const body = 'private diagnostic '.repeat(100000);
      backend.extractResult = { kind: 'macos', window: windowInfo, elements: [macElement({ title: 'Edit', path: [0] }), macElement({ role: 'AXTextArea', value: body, path: [1] })] };
      const deps = fakeDeps(backend, { test: { type: 'macos', pid: 123, app: 'Fake', createdAt: 1 } }); deps.refsDir = dir;
      const action = vi.spyOn(backend, 'performAction');
      const result = await handleAction({ sessionId: 'test', action: 'click', target: 'Edit', waitFor: 'Save', waitTimeoutMs: 0, observe: true, format: 'compact' }, deps);
      expect(result.exitCode).toBe(EXIT_WAIT_FAILED);
      expect(result.json).toMatchObject({ ok: false, actionDelivered: true, verificationPassed: false, evidenceSaved: true, snapshotAvailable: true, postAction: { settled: false, waitForFound: false } });
      expect(JSON.stringify(result.json).length).toBeLessThan(4000);
      expect(result.json.postAction).not.toHaveProperty('observation');
      const { readFileSync } = await import('node:fs');
      const full = JSON.parse(readFileSync(result.json.fullReport as string, 'utf8'));
      expect(full.exitCode).toBe(EXIT_WAIT_FAILED);
      expect(full.postAction.observation.elements[1].value).toBe(body);
      expect(action).toHaveBeenCalledTimes(1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('keeps inline evidence and the failure status if report storage is unavailable', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ibr-failure-storage-'));
    try {
      const { writeFileSync } = await import('node:fs');
      const blocked = join(dir, 'file-not-directory'); writeFileSync(blocked, 'occupied');
      const backend = new FakeBackend(); backend.extractResult = { kind: 'macos', window: windowInfo, elements: [macElement({ title: 'Edit', path: [0] })] };
      const deps = fakeDeps(backend, { test: { type: 'macos', pid: 123, app: 'Fake', createdAt: 1 } }); deps.refsDir = blocked;
      const result = await handleAction({ sessionId: 'test', action: 'click', target: 'Edit', waitFor: 'Missing', waitTimeoutMs: 0, observe: true, format: 'compact' }, deps);
      expect(result.exitCode).toBe(EXIT_WAIT_FAILED);
      expect(result.json).toMatchObject({ ok: false, evidenceSaved: false, compactFallback: 'inline-evidence' });
      expect(result.json.postAction).toHaveProperty('observation');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});


it('compact default reads retain disabled controls that expose no AX actions', async () => {
  const backend = new FakeBackend();
  backend.extractResult = { kind: 'macos', window: windowInfo, elements: [macElement({ role: 'AXTextField', title: 'Draft', value: 'Preserve me', enabled: false, actions: [], path: [0] })] };
  const deps = { ...fakeDeps(backend, { s1: { type: 'macos', app: 'Fake', pid: 123, createdAt: 1 } }), refsDir: mkdtempSync(join(tmpdir(), 'ibr-disabled-')) };
  const result = await handleRead({ sessionId: 's1', format: 'compact' }, deps);
  expect(result.json.controls).toEqual(expect.arrayContaining([expect.objectContaining({ value: 'Preserve me', enabled: false })]));
});

it('ref actions reject unsettled observations rather than silently falling back to a single read', async () => {
  const backend = new FakeBackend();
  backend.extractResult = { kind: 'macos', window: windowInfo, elements: [macElement({ title: 'Save', path: [0] })] };
  const deps = { ...fakeDeps(backend, { s1: { type: 'macos', app: 'Fake', pid: 123, createdAt: 1 } }), refsDir: mkdtempSync(join(tmpdir(), 'ibr-ref-unsettled-')) };
  await handleRead({ sessionId: 's1', what: 'refs' }, deps);
  const result = await handleAction({ sessionId: 's1', action: 'press', ref: 'e1', waitTimeoutMs: 0 }, deps);
  expect(result.exitCode).toBe(EXIT_WAIT_FAILED);
  expect(result.json.ok).toBe(false);
});

it('never substitutes an unvalidated reread for a missing settled ref snapshot', async () => {
  const backend = new FakeBackend();
  backend.extractResult = { kind: 'macos', window: windowInfo, elements: [macElement({ title: 'Save', path: [0] })] };
  const deps = { ...fakeDeps(backend, { s1: { type: 'macos', app: 'Fake', pid: 123, createdAt: 1 } }), refsDir: mkdtempSync(join(tmpdir(), 'ibr-ref-missing-')) };
  await handleRead({ sessionId: 's1', what: 'refs' }, deps);
  const { readFileSync } = await import('fs');
  const refsPath = join(deps.refsDir, 's1.refs.json');
  const before = readFileSync(refsPath, 'utf8');
  const original = deps.makeController;
  let reads = 0;
  deps.makeController = store => {
    const controller = original(store);
    const read = controller.readMacOS.bind(controller);
    controller.readMacOS = async (...args) => { reads++; return read(...args); };
    controller.actionMacOS = async () => ({ kind: 'text', text: JSON.stringify({ success: true, actionDelivered: true, postAction: { settled: true } }) });
    return controller;
  };
  const result = await handleAction({ sessionId: 's1', action: 'press', ref: 'e1' }, deps);
  expect(result.json.ok).toBe(false);
  expect(reads).toBe(1); // only pre-dispatch revalidation, never a replacement post-snapshot
  expect(readFileSync(refsPath, 'utf8')).toBe(before);
});

it('selects a named SwiftUI row by stable ref when AXSelected is settable despite AXEnabled=false', async () => {
  const backend = new FakeBackend();
  const row = macElement({ role: 'AXRow', title: null, enabled: false, selected: false,
    selectionSettable: true, actions: [], path: [0], children: [
      macElement({ role: 'AXStaticText', title: 'Plan', actions: [], path: [0, 0] }),
    ] });
  backend.extractResult = { kind: 'macos', window: windowInfo, elements: [row] };
  backend.performAction = vi.fn(async () => {
    backend.extractResult = { kind: 'macos', window: windowInfo, elements: [{ ...row, selected: true }] };
    return { success: true, action: 'select' };
  });
  const dir = mkdtempSync(join(tmpdir(), 'ibr-selectable-row-'));
  try {
    const deps = { ...fakeDeps(backend, { row: { type: 'macos', pid: 123, createdAt: 1 } }), refsDir: dir };
    const before = await handleRead({ sessionId: 'row', what: 'refs' }, deps);
    expect(before.text).toContain('Row "Plan" selected=false selectable');
    const result = await handleAction({ sessionId: 'row', action: 'click', ref: 'e1' }, deps);
    expect(result.json).toMatchObject({ ok: true, actionDelivered: true, verificationPassed: true });
    expect(backend.performAction).toHaveBeenCalledTimes(1);
    const again = await handleAction({ sessionId: 'row', action: 'click', ref: 'e1' }, deps);
    expect(again.json).toMatchObject({ ok: true, verificationPassed: true, axChanged: false });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
