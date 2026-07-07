import { describe, it, expect, vi } from 'vitest';
import { runLifecycleCapability, type LifecycleOps } from './lifecycle.js';
import type { LifecycleSpec, NativeSessionTarget } from './backend.js';

/**
 * `runLifecycleCapability` unit tests — mirrors keyboard.test.ts's approach of
 * injecting every I/O primitive (`findProcess`/`launch`/`activate`/`quit`/
 * `frontmostPid`/`isRunning`) so the launch/switch/quit state machines are
 * exercised without spawning `open`/`osascript`. Live-drive coverage against a
 * real app is the T-... RUNNING-APP evidence transcript, not this file.
 */

function ops(overrides: Partial<LifecycleOps> = {}): LifecycleOps {
  return {
    findProcess: vi.fn(async () => {
      throw new Error('not found');
    }),
    launch: vi.fn(async () => {}),
    activate: vi.fn(async () => true),
    quit: vi.fn(async () => {}),
    frontmostPid: vi.fn(async () => null),
    isRunning: vi.fn(async () => false),
    ...overrides,
  };
}

const macTarget = (pid: number, app?: string): NativeSessionTarget => ({ kind: 'macos', pid, app });

describe('runLifecycleCapability — launch', () => {
  it('fails immediately when no app is given', async () => {
    const spec: LifecycleSpec = { op: 'launch' };
    const outcome = await runLifecycleCapability(macTarget(1), spec, ops());
    expect(outcome.success).toBe(false);
    expect(outcome.validator.observed).toMatch(/requires an app name/);
  });

  it('succeeds once the process appears and is frontmost', async () => {
    const o = ops({
      findProcess: vi.fn(async () => 555),
      frontmostPid: vi.fn(async () => 555),
    });
    const outcome = await runLifecycleCapability(macTarget(1), { op: 'launch', app: 'TextEdit' }, o);

    expect(outcome.success).toBe(true);
    expect(outcome.validator.passed).toBe(true);
    expect(outcome.provenance.waitResult).toBe('launch-confirmed');
    expect(o.launch).toHaveBeenCalledWith('TextEdit');
    expect(o.activate).not.toHaveBeenCalled();
  });

  it('retries activation once when launched but not yet frontmost, then succeeds', async () => {
    let frontmostCalls = 0;
    const o = ops({
      findProcess: vi.fn(async () => 555),
      frontmostPid: vi.fn(async () => {
        frontmostCalls += 1;
        return frontmostCalls === 1 ? 1 : 555; // not frontmost first, then frontmost after activate
      }),
    });
    const outcome = await runLifecycleCapability(macTarget(1), { op: 'launch', app: 'TextEdit' }, o);

    expect(outcome.success).toBe(true);
    expect(o.activate).toHaveBeenCalledWith(555);
  });

  it('fails with evidence when the process never appears', async () => {
    const o = ops({ findProcess: vi.fn(async () => { throw new Error('no such process'); }) });
    const outcome = await runLifecycleCapability(macTarget(1), { op: 'launch', app: 'Ghost' }, o);

    expect(outcome.success).toBe(false);
    expect(outcome.evidence?.beforeSignature).toBe('not-running');
    expect(outcome.validator.observed).toMatch(/did not appear/);
  }, 10_000);

  it('fails when the launch command itself throws', async () => {
    const o = ops({ launch: vi.fn(async () => { throw new Error('open: command not found'); }) });
    const outcome = await runLifecycleCapability(macTarget(1), { op: 'launch', app: 'Ghost' }, o);

    expect(outcome.success).toBe(false);
    expect(outcome.validator.observed).toMatch(/launch command failed/);
    expect(o.findProcess).not.toHaveBeenCalled();
  });

  it('fails when the process appears but never becomes frontmost', async () => {
    const o = ops({
      findProcess: vi.fn(async () => 555),
      frontmostPid: vi.fn(async () => 1), // never matches 555, even after activate retry
    });
    const outcome = await runLifecycleCapability(macTarget(1), { op: 'launch', app: 'TextEdit' }, o);

    expect(outcome.success).toBe(false);
    expect(outcome.validator.observed).toMatch(/not frontmost/);
  });
});

describe('runLifecycleCapability — switch', () => {
  it('defaults to the session target pid when no app override is given', async () => {
    let frontmostCalls = 0;
    const o = ops({
      frontmostPid: vi.fn(async () => {
        frontmostCalls += 1;
        return frontmostCalls === 1 ? 999 : 42; // before: someone else; after: our pid
      }),
    });
    const outcome = await runLifecycleCapability(macTarget(42, 'TextEdit'), { op: 'switch' }, o);

    expect(outcome.success).toBe(true);
    expect(o.activate).toHaveBeenCalledWith(42);
    expect(o.findProcess).not.toHaveBeenCalled();
  });

  it('resolves via findProcess when spec.app overrides the session target', async () => {
    const o = ops({
      findProcess: vi.fn(async () => 777),
      frontmostPid: vi.fn(async () => 777),
    });
    const outcome = await runLifecycleCapability(macTarget(42, 'TextEdit'), { op: 'switch', app: 'Finder' }, o);

    expect(outcome.success).toBe(true);
    expect(o.findProcess).toHaveBeenCalledWith('Finder');
    expect(o.activate).toHaveBeenCalledWith(777);
  });

  it('fails when activation runs but the target never becomes frontmost', async () => {
    const o = ops({ frontmostPid: vi.fn(async () => 1) });
    const outcome = await runLifecycleCapability(macTarget(42), { op: 'switch' }, o);

    expect(outcome.success).toBe(false);
    expect(outcome.validator.observed).toMatch(/frontmost pid is 1/);
  });

  it('fails with structured evidence when the target process cannot be resolved', async () => {
    const outcome = await runLifecycleCapability(
      { kind: 'simulator', device: { udid: 'abc', name: 'iPhone 16' } },
      { op: 'switch' },
      ops(),
    );

    expect(outcome.success).toBe(false);
    expect(outcome.validator.observed).toMatch(/could not resolve target process/);
  });
});

describe('runLifecycleCapability — quit', () => {
  it('succeeds without calling quit when the process is already not running', async () => {
    const o = ops({ isRunning: vi.fn(async () => false) });
    const outcome = await runLifecycleCapability(macTarget(42), { op: 'quit' }, o);

    expect(outcome.success).toBe(true);
    expect(outcome.provenance.waitResult).toBe('already-quit');
    expect(o.quit).not.toHaveBeenCalled();
  });

  it('quits by app name and confirms exit, omitting the synthetic pid-N placeholder', async () => {
    let running = true;
    const o = ops({
      isRunning: vi.fn(async () => running),
      quit: vi.fn(async () => { running = false; }),
    });
    const outcome = await runLifecycleCapability(macTarget(42, 'pid-42'), { op: 'quit' }, o);

    expect(outcome.success).toBe(true);
    expect(outcome.provenance.waitResult).toBe('quit-confirmed');
    expect(o.quit).toHaveBeenCalledWith({ pid: 42, app: undefined });
  });

  it('quits a real app by name when the session carries one', async () => {
    let running = true;
    const o = ops({
      isRunning: vi.fn(async () => running),
      quit: vi.fn(async () => { running = false; }),
    });
    const outcome = await runLifecycleCapability(macTarget(42, 'TextEdit'), { op: 'quit' }, o);

    expect(outcome.success).toBe(true);
    expect(o.quit).toHaveBeenCalledWith({ pid: 42, app: 'TextEdit' });
  });

  it('fails with evidence when the process never exits', async () => {
    const o = ops({ isRunning: vi.fn(async () => true) });
    const outcome = await runLifecycleCapability(macTarget(42, 'TextEdit'), { op: 'quit' }, o);

    expect(outcome.success).toBe(false);
    expect(outcome.validator.observed).toMatch(/still running after/);
    expect(outcome.evidence?.afterSignature).toBe('running=true');
  }, 10_000);

  it('fails when the quit command itself throws', async () => {
    const o = ops({
      isRunning: vi.fn(async () => true),
      quit: vi.fn(async () => { throw new Error('osascript: application not found'); }),
    });
    const outcome = await runLifecycleCapability(macTarget(42, 'TextEdit'), { op: 'quit' }, o);

    expect(outcome.success).toBe(false);
    expect(outcome.validator.observed).toMatch(/quit command failed/);
  });
});

describe('runLifecycleCapability — never throws', () => {
  it('folds an unexpected op-implementation throw into a structured failure', async () => {
    const o = ops({
      frontmostPid: vi.fn(async () => { throw new Error('osascript timed out'); }),
    });
    const outcome = await runLifecycleCapability(macTarget(1), { op: 'switch' }, o);

    expect(outcome.success).toBe(false);
    expect(outcome.validator.passed).toBe(false);
  });
});
