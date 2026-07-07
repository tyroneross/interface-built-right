import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock setup ───────────────────────────────────────────
// Mock child_process, ./extract.js and ./index.js before importing menu.ts
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
  resolveMenuTargetPid,
  deliverMenuOneShot,
  runMenuCapability,
  type MenuDeliveryResult,
} from './menu.js';
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

describe('resolveMenuTargetPid', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the pid directly for a macos target (no I/O)', async () => {
    const target: NativeSessionTarget = { kind: 'macos', pid: 555 };
    await expect(resolveMenuTargetPid(target)).resolves.toBe(555);
    expect(findProcessMock).not.toHaveBeenCalled();
  });

  it('resolves the simulator process pid via findProcess for a simulator target', async () => {
    const target: NativeSessionTarget = { kind: 'simulator', device: { udid: 'abc', name: 'iPhone 16' } };
    await expect(resolveMenuTargetPid(target)).resolves.toBe(4242);
    expect(findProcessMock).toHaveBeenCalledWith('com.apple.iphonesimulator');
  });
});

describe('deliverMenuOneShot', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes --pid and --menu-path (JSON-encoded) to the binary', async () => {
    mockExecFileSuccess(JSON.stringify({ success: true, matchedVia: 'menu-bar' }));
    await deliverMenuOneShot(1234, ['File', 'New Window']);

    const args = execFileMock.mock.calls[0][1] as string[];
    expect(args).toEqual(['--pid', '1234', '--menu-path', JSON.stringify(['File', 'New Window'])]);
  });

  it('resolves with the parsed JSON on success', async () => {
    mockExecFileSuccess(JSON.stringify({ success: true, matchedVia: 'menu-bar' }));
    const result = await deliverMenuOneShot(1, ['File', 'New Window']);
    expect(result).toEqual({ success: true, matchedVia: 'menu-bar' });
  });

  it('parses structured failure JSON (including failedSegment) from stdout on a non-zero exit', async () => {
    mockExecFileError(
      'Command failed',
      JSON.stringify({ success: false, error: 'menu item not found: "Nonexistent"', failedSegment: 1 }),
    );
    const result = await deliverMenuOneShot(1, ['File', 'Nonexistent']);
    expect(result).toEqual({
      success: false,
      error: 'menu item not found: "Nonexistent"',
      failedSegment: 1,
    });
  });

  it('falls back to a generic error when stdout has no parseable JSON', async () => {
    mockExecFileError('spawn ENOENT');
    const result = await deliverMenuOneShot(1, ['File']);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/ENOENT/);
  });
});

describe('runMenuCapability', () => {
  it('fails immediately for an empty menuPath, with no delivery attempt', async () => {
    const extract = vi.fn();
    const deliver = vi.fn();

    const outcome = await runMenuCapability({
      target: { kind: 'macos', pid: 1 },
      spec: { menuPath: [] },
      resolvePid: async () => 1,
      extract,
      deliver,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.validator.observed).toMatch(/at least one segment/);
    expect(deliver).not.toHaveBeenCalled();
  });

  it('succeeds when the AX signature changes after a successful delivery', async () => {
    const before = macExtraction({ windowId: 1, title: 'Untitled' });
    const after = macExtraction({ windowId: 2, title: 'Untitled 2' });
    const extract = vi.fn()
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(after);
    const deliver = vi.fn(async (): Promise<MenuDeliveryResult> => ({ success: true, matchedVia: 'menu-bar' }));

    const outcome = await runMenuCapability({
      target: { kind: 'macos', pid: 1 },
      spec: { menuPath: ['File', 'New Window'] },
      resolvePid: async () => 1,
      extract,
      deliver,
    });

    expect(outcome.success).toBe(true);
    expect(outcome.validator.passed).toBe(true);
    expect(outcome.provenance.waitResult).toBe('menu-bar');
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver).toHaveBeenCalledWith(1, ['File', 'New Window']);
  }, 10_000);

  it('fails with before/after evidence when the item fires but nothing observably changes (selection unverified)', async () => {
    const unchanged = macExtraction({ windowId: 1, title: 'Untitled' });
    const extract = vi.fn().mockResolvedValue(unchanged);
    const deliver = vi.fn(async (): Promise<MenuDeliveryResult> => ({ success: true, matchedVia: 'menu-bar' }));

    const outcome = await runMenuCapability({
      target: { kind: 'macos', pid: 1 },
      spec: { menuPath: ['File', 'New Window'] },
      resolvePid: async () => 1,
      extract,
      deliver,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.validator.passed).toBe(false);
    expect(outcome.validator.observed).toMatch(/selection unverified/);
    expect(outcome.evidence?.beforeSignature).toBe(outcome.evidence?.afterSignature);
    expect(outcome.evidence?.alternatives).toEqual([]);
  }, 10_000);

  it('reports the failing segment when a path hop cannot be resolved', async () => {
    const extract = vi.fn().mockResolvedValue(macExtraction());
    const deliver = vi.fn(async (): Promise<MenuDeliveryResult> => ({
      success: false,
      error: 'menu item not found: "Nonexistent"',
      failedSegment: 1,
    }));

    const outcome = await runMenuCapability({
      target: { kind: 'macos', pid: 1 },
      spec: { menuPath: ['File', 'Nonexistent'] },
      resolvePid: async () => 1,
      extract,
      deliver,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.validator.observed).toMatch(/failed at segment 1: "Nonexistent"/);
    expect(outcome.validator.observed).toMatch(/menu item not found/);
  });

  it('never throws — a resolvePid rejection becomes a structured failure outcome', async () => {
    const deliver = vi.fn();
    const extract = vi.fn();

    const outcome = await runMenuCapability({
      target: { kind: 'macos', pid: 1 },
      spec: { menuPath: ['File'] },
      resolvePid: async () => { throw new Error('No running process found for pid 1'); },
      extract,
      deliver,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.validator.observed).toMatch(/menu capability failed/);
    expect(deliver).not.toHaveBeenCalled();
  });

  it('treats a persistently-failing extract as "no change" rather than crashing', async () => {
    const extract = vi.fn().mockRejectedValue(new Error('No windows found for pid 1'));
    const deliver = vi.fn(async (): Promise<MenuDeliveryResult> => ({ success: true }));

    const outcome = await runMenuCapability({
      target: { kind: 'macos', pid: 1 },
      spec: { menuPath: ['File', 'New Window'] },
      resolvePid: async () => 1,
      extract,
      deliver,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.evidence?.beforeSignature).toMatch(/^error:/);
  }, 10_000);

  it('reflects a context-menu match in provenance', async () => {
    const before = macExtraction({ windowId: 1, title: 'Untitled', elements: [macElement({ focused: false })] });
    const after = macExtraction({ windowId: 1, title: 'Untitled', elements: [macElement({ focused: true })] });
    const extract = vi.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(after);
    const deliver = vi.fn(async (): Promise<MenuDeliveryResult> => ({ success: true, matchedVia: 'context-menu' }));

    const outcome = await runMenuCapability({
      target: { kind: 'macos', pid: 1 },
      spec: { menuPath: ['Cut'] },
      resolvePid: async () => 1,
      extract,
      deliver,
    });

    expect(outcome.success).toBe(true);
    expect(outcome.provenance.waitResult).toBe('context-menu');
  });
});
