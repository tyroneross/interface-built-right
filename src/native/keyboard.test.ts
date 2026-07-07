import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock setup ───────────────────────────────────────────
// Mock child_process, ./extract.js and ./index.js before importing keyboard.ts
// so no real Swift binary / process lookup is invoked.

vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('./extract.js', () => ({
  ensureExtractor: vi.fn().mockResolvedValue('/mock/path/ibr-ax-extract'),
}));

vi.mock('./index.js', () => ({
  findProcess: vi.fn().mockResolvedValue(4242),
}));

import {
  resolveKeystrokeTargetPid,
  deliverKeystrokeOneShot,
  runKeystrokeCapability,
  type KeystrokeDeliveryResult,
} from './keyboard.js';
import { execFile } from 'child_process';
import { findProcess } from './index.js';
import type { NativeExtraction, NativeSessionTarget } from './backend.js';
import type { MacOSAXElement } from './types.js';

const execFileMock = vi.mocked(execFile);
const findProcessMock = vi.mocked(findProcess);

function mockExecFileSuccess(stdout: string) {
  execFileMock.mockImplementation((_cmd, _args, _opts, callback: unknown) => {
    const cb = callback as (err: null, result: { stdout: string; stderr: string }) => void;
    cb(null, { stdout, stderr: '' });
    return {} as ReturnType<typeof execFile>;
  });
}

function mockExecFileError(message: string, stdout = '') {
  execFileMock.mockImplementation((_cmd, _args, _opts, callback: unknown) => {
    const cb = callback as (err: Error & { stdout?: string }, result: null) => void;
    const err = Object.assign(new Error(message), { stdout });
    cb(err, null);
    return {} as ReturnType<typeof execFile>;
  });
}

function macElement(overrides: Partial<MacOSAXElement> = {}): MacOSAXElement {
  return {
    role: 'AXButton',
    subrole: null,
    title: 'Save',
    description: null,
    identifier: null,
    value: null,
    enabled: true,
    focused: false,
    actions: ['AXPress'],
    position: { x: 0, y: 0 },
    size: { width: 10, height: 10 },
    children: [],
    path: [0],
    ...overrides,
  };
}

function macExtraction(overrides: {
  windowId?: number;
  title?: string;
  elements?: MacOSAXElement[];
} = {}): NativeExtraction {
  return {
    kind: 'macos',
    elements: overrides.elements ?? [],
    window: {
      windowId: overrides.windowId ?? 1,
      width: 800,
      height: 600,
      title: overrides.title ?? 'Untitled',
    },
  };
}

describe('resolveKeystrokeTargetPid', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the pid directly for a macos target (no I/O)', async () => {
    const target: NativeSessionTarget = { kind: 'macos', pid: 555 };
    await expect(resolveKeystrokeTargetPid(target)).resolves.toBe(555);
    expect(findProcessMock).not.toHaveBeenCalled();
  });

  it('resolves the simulator process pid via findProcess for a simulator target', async () => {
    const target: NativeSessionTarget = { kind: 'simulator', device: { udid: 'abc', name: 'iPhone 16' } };
    await expect(resolveKeystrokeTargetPid(target)).resolves.toBe(4242);
    expect(findProcessMock).toHaveBeenCalledWith('com.apple.iphonesimulator');
  });
});

describe('deliverKeystrokeOneShot', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes --pid and --keystroke to the binary, omitting --foreground by default', async () => {
    mockExecFileSuccess(JSON.stringify({ success: true }));
    await deliverKeystrokeOneShot(1234, 'Meta+n', false);

    const args = execFileMock.mock.calls[0][1] as string[];
    expect(args).toEqual(['--pid', '1234', '--keystroke', 'Meta+n']);
  });

  it('appends --foreground when requested', async () => {
    mockExecFileSuccess(JSON.stringify({ success: true }));
    await deliverKeystrokeOneShot(1234, 'Tab', true);

    const args = execFileMock.mock.calls[0][1] as string[];
    expect(args).toContain('--foreground');
  });

  it('resolves with the parsed JSON on success', async () => {
    mockExecFileSuccess(JSON.stringify({ success: true }));
    const result = await deliverKeystrokeOneShot(1, 'Escape', false);
    expect(result).toEqual({ success: true });
  });

  it('parses structured failure JSON from stdout on a non-zero exit', async () => {
    mockExecFileError('Command failed', JSON.stringify({ success: false, error: 'Unable to parse chord: bogus' }));
    const result = await deliverKeystrokeOneShot(1, 'bogus', false);
    expect(result).toEqual({ success: false, error: 'Unable to parse chord: bogus' });
  });

  it('falls back to a generic error when stdout has no parseable JSON', async () => {
    mockExecFileError('spawn ENOENT');
    const result = await deliverKeystrokeOneShot(1, 'Tab', false);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/ENOENT/);
  });
});

describe('runKeystrokeCapability', () => {
  it('succeeds via background delivery when the AX signature changes', async () => {
    const before = macExtraction({ windowId: 1, title: 'Untitled' });
    const after = macExtraction({ windowId: 2, title: 'Untitled 2' });
    const extract = vi.fn()
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(after);
    const deliver = vi.fn(async (): Promise<KeystrokeDeliveryResult> => ({ success: true }));

    const outcome = await runKeystrokeCapability({
      target: { kind: 'macos', pid: 1 },
      spec: { chord: 'Meta+n' },
      resolvePid: async () => 1,
      extract,
      deliver,
    });

    expect(outcome.success).toBe(true);
    expect(outcome.validator.passed).toBe(true);
    expect(outcome.provenance.waitResult).toBe('cgevent-pid-background');
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver).toHaveBeenCalledWith(1, 'Meta+n', false);
  }, 10_000);

  it('retries in foreground mode when background delivery produces no observable change, then succeeds', async () => {
    const unchanged = macExtraction({ windowId: 1, title: 'Untitled' });
    const changed = macExtraction({ windowId: 1, title: 'Untitled', elements: [macElement({ focused: true, path: [2] })] });
    const extract = vi.fn()
      .mockResolvedValueOnce(unchanged) // before
      .mockResolvedValueOnce(unchanged) // after background (no change)
      .mockResolvedValueOnce(changed);  // after foreground (changed)
    const deliver = vi.fn(async (): Promise<KeystrokeDeliveryResult> => ({ success: true }));

    const outcome = await runKeystrokeCapability({
      target: { kind: 'macos', pid: 1 },
      spec: { chord: 'Tab' },
      resolvePid: async () => 1,
      extract,
      deliver,
    });

    expect(outcome.success).toBe(true);
    expect(outcome.provenance.waitResult).toBe('cgevent-foreground-fallback');
    expect(deliver).toHaveBeenCalledTimes(2);
    expect(deliver).toHaveBeenNthCalledWith(1, 1, 'Tab', false);
    expect(deliver).toHaveBeenNthCalledWith(2, 1, 'Tab', true);
  }, 10_000);

  it('fails with before/after evidence when neither background nor foreground produces a change', async () => {
    const unchanged = macExtraction({ windowId: 1, title: 'Untitled' });
    const extract = vi.fn().mockResolvedValue(unchanged);
    const deliver = vi.fn(async (): Promise<KeystrokeDeliveryResult> => ({ success: true }));

    const outcome = await runKeystrokeCapability({
      target: { kind: 'macos', pid: 1 },
      spec: { chord: 'Escape' },
      resolvePid: async () => 1,
      extract,
      deliver,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.validator.passed).toBe(false);
    expect(outcome.evidence).toBeDefined();
    expect(outcome.evidence?.beforeSignature).toBe(outcome.evidence?.afterSignature);
    expect(outcome.evidence?.alternatives).toEqual([]);
    expect(deliver).toHaveBeenCalledTimes(2);
  }, 10_000);

  it('fails immediately (no foreground retry) when delivery itself cannot be constructed', async () => {
    const extract = vi.fn().mockResolvedValue(macExtraction());
    const deliver = vi.fn(async (): Promise<KeystrokeDeliveryResult> => ({
      success: false,
      error: 'Unable to parse chord: bogus',
    }));

    const outcome = await runKeystrokeCapability({
      target: { kind: 'macos', pid: 1 },
      spec: { chord: 'bogus' },
      resolvePid: async () => 1,
      extract,
      deliver,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.validator.observed).toMatch(/background delivery failed/);
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it('never throws — a resolvePid rejection becomes a structured failure outcome', async () => {
    const deliver = vi.fn();
    const extract = vi.fn();

    const outcome = await runKeystrokeCapability({
      target: { kind: 'macos', pid: 1 },
      spec: { chord: 'Meta+n' },
      resolvePid: async () => { throw new Error('No running process found for pid 1'); },
      extract,
      deliver,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.validator.observed).toMatch(/keystroke capability failed/);
    expect(deliver).not.toHaveBeenCalled();
  });

  it('treats a persistently-failing extract as "no change" rather than crashing', async () => {
    const extract = vi.fn().mockRejectedValue(new Error('No windows found for pid 1'));
    const deliver = vi.fn(async (): Promise<KeystrokeDeliveryResult> => ({ success: true }));

    const outcome = await runKeystrokeCapability({
      target: { kind: 'macos', pid: 1 },
      spec: { chord: 'Meta+n' },
      resolvePid: async () => 1,
      extract,
      deliver,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.evidence?.beforeSignature).toMatch(/^error:/);
  }, 10_000);
});
