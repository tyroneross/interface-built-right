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
    keystroke: vi.fn(),
    lifecycle: vi.fn(),
    menu: vi.fn(),
  } as unknown as RespawnBackend;
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

  it('keystroke/lifecycle/menu return structured not-implemented in E2-A', async () => {
    const backend = new DaemonBackend({ fallback: fallbackStub() });
    const target: NativeSessionTarget = { kind: 'macos', pid: 1 };
    const k = await backend.keystroke(target, { chord: 'Meta+n' });
    expect(k.success).toBe(false);
    expect(k.validator.passed).toBe(false);
  });
});
