import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import type { ChildProcessWithoutNullStreams } from 'child_process';
import {
  RespawnBackend,
  DaemonBackend,
  getNativeBackend,
  __setNativeBackend,
} from './backend.js';
import { AXDaemon } from './daemon.js';
import type { NativeExtraction, NativePerformInput, NativeSessionTarget } from './backend.js';
import type { NativeActionResult } from './actions.js';
import type { ActionOutcome } from '../action-outcome.js';

/**
 * Backend selection + DaemonBackend auto-fallback.
 *
 * Selection: default = respawn; IBR_NATIVE_BACKEND=daemon opts into the daemon.
 * Fallback: a daemon that fails to start (or crashes) must transparently delegate
 * to the respawn backend — the kill-9 auto-fallback the plan requires — so a
 * flaky daemon degrades to today's behavior rather than failing the call.
 */

afterEach(() => {
  __setNativeBackend(null);
  delete process.env.IBR_NATIVE_BACKEND;
});

describe('getNativeBackend selection', () => {
  it('defaults to RespawnBackend when the env flag is unset', () => {
    __setNativeBackend(null);
    delete process.env.IBR_NATIVE_BACKEND;
    expect(getNativeBackend()).toBeInstanceOf(RespawnBackend);
  });

  it('forces RespawnBackend with IBR_NATIVE_BACKEND=respawn', () => {
    __setNativeBackend(null);
    process.env.IBR_NATIVE_BACKEND = 'respawn';
    expect(getNativeBackend()).toBeInstanceOf(RespawnBackend);
  });

  it('selects DaemonBackend with IBR_NATIVE_BACKEND=daemon', () => {
    __setNativeBackend(null);
    process.env.IBR_NATIVE_BACKEND = 'daemon';
    expect(getNativeBackend()).toBeInstanceOf(DaemonBackend);
  });
});

// A fake child that never emits `ready`, forcing AXDaemon.start() to time out
// and reject with DaemonError — the trigger for auto-fallback.
class SilentChild extends EventEmitter {
  stdout = Object.assign(new EventEmitter(), { setEncoding() {} });
  stderr = Object.assign(new EventEmitter(), { setEncoding() {} });
  stdin = { write: () => true, end: () => {} };
  kill = vi.fn();
}

const notImplementedStub: ActionOutcome = {
  success: false,
  validator: { expected: 'x', observed: 'not implemented (stub)', passed: false },
  provenance: {},
};

function fallbackStub(): RespawnBackend {
  const extraction: NativeExtraction = {
    kind: 'macos',
    elements: [],
    window: { windowId: 1, width: 10, height: 10, title: 'stub' },
  };
  const action: NativeActionResult = { success: true, action: 'press' };
  return {
    extract: vi.fn(async () => extraction),
    performAction: vi.fn(async () => action),
    captureScreenshot: vi.fn(async () => ({ kind: 'error', error: 'stub' })),
    keystroke: vi.fn(async () => notImplementedStub),
    lifecycle: vi.fn(async () => notImplementedStub),
    menu: vi.fn(async () => notImplementedStub),
  } as unknown as RespawnBackend;
}

/** Minimal scriptable daemon stand-in — not a real AXDaemon, so keystroke
 *  tests exercise DaemonBackend's wiring without spawning any process. */
function fakeDaemon(opts: {
  extractResults: unknown[];
  keystrokeResult: unknown;
}): AXDaemon {
  let extractCall = 0;
  const request = vi.fn(async (req: { op: string }) => {
    if (req.op === 'extract') {
      const result = opts.extractResults[Math.min(extractCall, opts.extractResults.length - 1)];
      extractCall += 1;
      return result;
    }
    if (req.op === 'keystroke') return opts.keystrokeResult;
    return { ok: false, error: `fakeDaemon: unexpected op ${req.op}` };
  });
  return {
    start: vi.fn().mockResolvedValue({ type: 'ready', trusted: true, pid: 999 }),
    request,
    kill: vi.fn(),
  } as unknown as AXDaemon;
}

describe('DaemonBackend auto-fallback (kill-9 / unavailable daemon)', () => {
  it('delegates extract to the respawn fallback when the daemon cannot start', async () => {
    const daemon = new AXDaemon({
      binaryPath: '/fake',
      spawnFn: () => new SilentChild() as unknown as ChildProcessWithoutNullStreams,
      startTimeoutMs: 50,
    });
    const fallback = fallbackStub();
    const backend = new DaemonBackend({ daemon, fallback });
    const target: NativeSessionTarget = { kind: 'macos', pid: 123 };

    const result = await backend.extract(target);
    expect(result.kind).toBe('macos');
    expect(fallback.extract).toHaveBeenCalledWith(target);
    expect(backend.fellBack).toBe(true);
  });

  it('routes every subsequent call straight to respawn once fallen back', async () => {
    const daemon = new AXDaemon({
      binaryPath: '/fake',
      spawnFn: () => new SilentChild() as unknown as ChildProcessWithoutNullStreams,
      startTimeoutMs: 50,
    });
    const fallback = fallbackStub();
    const backend = new DaemonBackend({ daemon, fallback });
    const target: NativeSessionTarget = { kind: 'macos', pid: 5 };
    const input: NativePerformInput = { elementPath: [0], action: 'press' };

    await backend.extract(target); // trips the fallback
    const r = await backend.performAction(target, input);
    expect(r.success).toBe(true);
    expect(fallback.performAction).toHaveBeenCalledWith(target, input);
  });

  it('lifecycle (E2-C) delegates straight to the respawn fallback — no AX-daemon benefit for OS-level process control', async () => {
    const fallback = fallbackStub();
    const stubOutcome: ActionOutcome = {
      success: true,
      validator: { expected: 'x', observed: 'switch-confirmed', passed: true },
      provenance: { waitResult: 'switch-confirmed' },
    };
    (fallback.lifecycle as ReturnType<typeof vi.fn>).mockResolvedValue(stubOutcome);
    const backend = new DaemonBackend({ fallback });
    const target: NativeSessionTarget = { kind: 'macos', pid: 1 };

    const outcome = await backend.lifecycle(target, { op: 'switch' });

    expect(outcome).toBe(stubOutcome);
    expect(fallback.lifecycle).toHaveBeenCalledWith(target, { op: 'switch' });
  });

  it('menu still returns structured not-implemented (E2-D lands later)', async () => {
    const backend = new DaemonBackend({ fallback: fallbackStub() });
    const target: NativeSessionTarget = { kind: 'macos', pid: 1 };
    const menu = await backend.menu(target, { menuPath: ['File'] });
    expect(menu.success).toBe(false);
    expect(menu.validator.passed).toBe(false);
  });
});

describe('DaemonBackend.keystroke (E2-B)', () => {
  it('delegates the whole capability to RespawnBackend.keystroke when the daemon cannot start', async () => {
    const daemon = new AXDaemon({
      binaryPath: '/fake',
      spawnFn: () => new SilentChild() as unknown as ChildProcessWithoutNullStreams,
      startTimeoutMs: 50,
    });
    const stubOutcome: ActionOutcome = {
      success: true,
      validator: { expected: 'x', observed: 'delivered via fallback', passed: true },
      provenance: {},
    };
    const fallback = fallbackStub();
    (fallback.keystroke as ReturnType<typeof vi.fn>).mockResolvedValue(stubOutcome);
    const backend = new DaemonBackend({ daemon, fallback });
    const target: NativeSessionTarget = { kind: 'macos', pid: 7 };

    const outcome = await backend.keystroke(target, { chord: 'Tab' });

    expect(outcome).toBe(stubOutcome);
    expect(fallback.keystroke).toHaveBeenCalledWith(target, { chord: 'Tab' });
    expect(backend.fellBack).toBe(true);
  });

  it('once fallen back, a later keystroke call also routes straight to respawn', async () => {
    const daemon = new AXDaemon({
      binaryPath: '/fake',
      spawnFn: () => new SilentChild() as unknown as ChildProcessWithoutNullStreams,
      startTimeoutMs: 50,
    });
    const fallback = fallbackStub();
    const backend = new DaemonBackend({ daemon, fallback });
    const target: NativeSessionTarget = { kind: 'macos', pid: 5 };

    await backend.extract(target); // trips the fallback via a different capability
    await backend.keystroke(target, { chord: 'Escape' });
    expect(fallback.keystroke).toHaveBeenCalledWith(target, { chord: 'Escape' });
  });

  it('delivers via the daemon keystroke op and returns a passing outcome when the AX signature changes', async () => {
    const daemon = fakeDaemon({
      extractResults: [
        { ok: true, result: { kind: 'macos', window: { windowId: 1, width: 800, height: 600, title: 'Untitled' }, elements: [] } },
        { ok: true, result: { kind: 'macos', window: { windowId: 2, width: 800, height: 600, title: 'Untitled 2' }, elements: [] } },
      ],
      keystrokeResult: { ok: true, result: { success: true } },
    });
    const backend = new DaemonBackend({ daemon, fallback: fallbackStub() });
    const target: NativeSessionTarget = { kind: 'macos', pid: 42 };

    const outcome = await backend.keystroke(target, { chord: 'Meta+n' });

    expect(outcome.success).toBe(true);
    expect(outcome.validator.passed).toBe(true);
    const calls = (daemon.request as ReturnType<typeof vi.fn>).mock.calls as Array<[Record<string, unknown>]>;
    const keystrokeCall = calls.find(([req]) => req.op === 'keystroke');
    expect(keystrokeCall?.[0]).toMatchObject({
      op: 'keystroke',
      target: { kind: 'macos', pid: 42 },
      chord: 'Meta+n',
      foreground: false,
    });
  });

  it('returns a failing outcome with before/after evidence when nothing observably changes', async () => {
    const unchanged = {
      ok: true,
      result: { kind: 'macos', window: { windowId: 1, width: 800, height: 600, title: 'Untitled' }, elements: [] },
    };
    const daemon = fakeDaemon({
      extractResults: [unchanged, unchanged, unchanged],
      keystrokeResult: { ok: true, result: { success: true } },
    });
    const backend = new DaemonBackend({ daemon, fallback: fallbackStub() });
    const target: NativeSessionTarget = { kind: 'macos', pid: 42 };

    const outcome = await backend.keystroke(target, { chord: 'Escape' });

    expect(outcome.success).toBe(false);
    expect(outcome.validator.passed).toBe(false);
    expect(outcome.evidence?.beforeSignature).toBeDefined();
    expect(outcome.evidence?.afterSignature).toBeDefined();
    // Two attempts: background, then the foreground-activate retry.
    const calls = (daemon.request as ReturnType<typeof vi.fn>).mock.calls as Array<[Record<string, unknown>]>;
    const keystrokeCalls = calls.filter(([req]) => req.op === 'keystroke');
    expect(keystrokeCalls.length).toBe(2);
    expect(keystrokeCalls[0][0].foreground).toBe(false);
    expect(keystrokeCalls[1][0].foreground).toBe(true);
  });
});
