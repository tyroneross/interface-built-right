import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MacOSAXElement } from './types.js';

// ─── Mock setup ───────────────────────────────────────────
// Mock child_process and the extract module before importing actions.ts
// so that no real Swift binary is invoked.

vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('./extract.js', () => ({
  ensureExtractor: vi.fn().mockResolvedValue('/mock/path/ibr-ax-extract'),
}));

// Import after mocks are registered
import {
  performNativeAction,
  findElementPath,
  resolveMacOSElement,
  resolveSimulatorElement,
} from './actions.js';
import { execFile } from 'child_process';

// Grab the mocked execFile
const execFileMock = vi.mocked(execFile);

// Helper: make execFile call its callback with success output
function mockExecFileSuccess(stdout: string) {
  execFileMock.mockImplementation((_cmd, _args, _opts, callback: unknown) => {
    const cb = callback as (err: null, result: { stdout: string; stderr: string }) => void;
    cb(null, { stdout, stderr: '' });
    return {} as ReturnType<typeof execFile>;
  });
}

// Helper: make execFile call its callback with an error (non-zero exit)
function mockExecFileError(message: string, stdout = '') {
  execFileMock.mockImplementation((_cmd, _args, _opts, callback: unknown) => {
    const cb = callback as (err: Error & { stdout?: string }, result: null) => void;
    const err = Object.assign(new Error(message), { stdout });
    cb(err, null);
    return {} as ReturnType<typeof execFile>;
  });
}

// ─── performNativeAction ──────────────────────────────────

describe('performNativeAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves with parsed JSON on success', async () => {
    mockExecFileSuccess(JSON.stringify({ success: true, action: 'press' }));

    const result = await performNativeAction({
      pid: 1234,
      elementPath: [0, 1, 2],
      action: 'press',
    });

    expect(result).toEqual({ success: true, action: 'press' });
  });

  it('passes --pid, --action, --element-path to the binary', async () => {
    mockExecFileSuccess(JSON.stringify({ success: true, action: 'press' }));

    await performNativeAction({
      pid: 9999,
      elementPath: [3, 0, 1],
      action: 'press',
    });

    // promisify wraps execFile — check the underlying mock was called correctly
    const calls = execFileMock.mock.calls;
    expect(calls.length).toBe(1);
    const callArgs = calls[0];
    // callArgs[0] = path, callArgs[1] = args array
    const passedArgs = callArgs[1] as string[];
    expect(passedArgs).toContain('--pid');
    expect(passedArgs).toContain('9999');
    expect(passedArgs).toContain('--action');
    expect(passedArgs).toContain('press');
    expect(passedArgs).toContain('--element-path');
    expect(passedArgs).toContain('3,0,1');
  });

  it('passes --device-name when provided for simulator window actions', async () => {
    mockExecFileSuccess(JSON.stringify({ success: true, action: 'press' }));

    await performNativeAction({
      pid: 9999,
      deviceName: 'iPhone 16 Pro',
      elementPath: [3, 0, 1],
      action: 'press',
    });

    const passedArgs = execFileMock.mock.calls[0][1] as string[];
    expect(passedArgs).toContain('--device-name');
    expect(passedArgs).toContain('iPhone 16 Pro');
  });

  it('includes --value when value is provided', async () => {
    mockExecFileSuccess(JSON.stringify({ success: true, action: 'setValue' }));

    await performNativeAction({
      pid: 1234,
      elementPath: [0],
      action: 'setValue',
      value: 'hello world',
    });

    const passedArgs = execFileMock.mock.calls[0][1] as string[];
    expect(passedArgs).toContain('--value');
    expect(passedArgs).toContain('hello world');
  });

  it('omits --value when value is not provided', async () => {
    mockExecFileSuccess(JSON.stringify({ success: true, action: 'focus' }));

    await performNativeAction({
      pid: 1234,
      elementPath: [0],
      action: 'focus',
    });

    const passedArgs = execFileMock.mock.calls[0][1] as string[];
    expect(passedArgs).not.toContain('--value');
  });

  it('returns failure result on binary error', async () => {
    mockExecFileError('Command failed: exit code 1');

    const result = await performNativeAction({
      pid: 1234,
      elementPath: [0],
      action: 'press',
    });

    expect(result.success).toBe(false);
    expect(result.action).toBe('press');
    expect(result.error).toBeDefined();
  });

  it('parses structured error from stdout on binary failure', async () => {
    mockExecFileError(
      'Command failed: exit code 1',
      JSON.stringify({ success: false, action: 'press', error: 'Element not found at path' })
    );

    const result = await performNativeAction({
      pid: 1234,
      elementPath: [99],
      action: 'press',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Element not found at path');
  });

  it('handles all supported action types without error', async () => {
    const actions = ['press', 'setValue', 'increment', 'decrement', 'showMenu', 'confirm', 'cancel', 'focus', 'scrollToVisible'] as const;

    for (const action of actions) {
      mockExecFileSuccess(JSON.stringify({ success: true, action }));
      const result = await performNativeAction({
        pid: 1234,
        elementPath: [0],
        action,
        ...(action === 'setValue' ? { value: 'test' } : {}),
      });
      expect(result.action).toBe(action);
    }
  });

  it('joins multi-segment element path with commas', async () => {
    mockExecFileSuccess(JSON.stringify({ success: true, action: 'press' }));

    await performNativeAction({
      pid: 1234,
      elementPath: [0, 5, 2, 11],
      action: 'press',
    });

    const passedArgs = execFileMock.mock.calls[0][1] as string[];
    const pathIndex = passedArgs.indexOf('--element-path');
    expect(passedArgs[pathIndex + 1]).toBe('0,5,2,11');
  });
});

// ─── findElementPath ──────────────────────────────────────

function makeElement(
  overrides: Partial<MacOSAXElement> & { path: number[] }
): MacOSAXElement {
  return {
    role: 'AXButton',
    subrole: null,
    title: null,
    description: null,
    identifier: null,
    value: null,
    enabled: true,
    focused: false,
    actions: ['AXPress'],
    position: { x: 0, y: 0 },
    size: { width: 100, height: 44 },
    children: [],
    ...overrides,
  };
}

describe('findElementPath', () => {
  it('returns null for an empty element list', () => {
    expect(findElementPath([], 'Submit')).toBeNull();
  });

  it('finds element by identifier', () => {
    const elements: MacOSAXElement[] = [
      makeElement({ identifier: 'submit-btn', path: [0, 1] }),
      makeElement({ identifier: 'cancel-btn', path: [0, 2] }),
    ];
    expect(findElementPath(elements, 'submit-btn')).toEqual([0, 1]);
  });

  it('finds element by title', () => {
    const elements: MacOSAXElement[] = [
      makeElement({ title: 'Save', path: [1, 0] }),
      makeElement({ title: 'Cancel', path: [1, 1] }),
    ];
    expect(findElementPath(elements, 'Save')).toEqual([1, 0]);
  });

  it('finds element by description', () => {
    const elements: MacOSAXElement[] = [
      makeElement({ description: 'Close window', path: [2, 3] }),
    ];
    expect(findElementPath(elements, 'Close window')).toEqual([2, 3]);
  });

  it('returns null when no element matches', () => {
    const elements: MacOSAXElement[] = [
      makeElement({ title: 'Open', path: [0] }),
    ];
    expect(findElementPath(elements, 'NonExistent')).toBeNull();
  });

  it('searches children recursively', () => {
    const child = makeElement({ identifier: 'inner-btn', path: [0, 1, 2] });
    const parent = makeElement({
      role: 'AXGroup',
      identifier: null,
      path: [0, 1],
      children: [child],
    });
    const elements: MacOSAXElement[] = [parent];

    expect(findElementPath(elements, 'inner-btn')).toEqual([0, 1, 2]);
  });

  it('returns first match in depth-first order', () => {
    // Both parent and child have the same identifier — parent wins
    const child = makeElement({ title: 'Duplicate', path: [0, 0, 0] });
    const parent = makeElement({
      role: 'AXGroup',
      title: 'Duplicate',
      path: [0, 0],
      children: [child],
    });
    const result = findElementPath([parent], 'Duplicate');
    // Parent is visited first in DFS
    expect(result).toEqual([0, 0]);
  });

  it('prefers identifier match over title when identifier is set', () => {
    const el = makeElement({
      identifier: 'my-id',
      title: 'my-id',  // Same value — should still match via identifier
      path: [3],
    });
    expect(findElementPath([el], 'my-id')).toEqual([3]);
  });

  it('returns an empty array path for root-level match', () => {
    const el = makeElement({ identifier: 'root-el', path: [] });
    expect(findElementPath([el], 'root-el')).toEqual([]);
  });

  it('handles deeply nested trees', () => {
    // Build a 5-level deep tree
    const target = makeElement({ title: 'DeepTarget', path: [0, 0, 0, 0, 0] });
    let wrapper = makeElement({ role: 'AXGroup', path: [0, 0, 0, 0], children: [target] });
    for (let depth = 3; depth >= 1; depth--) {
      wrapper = makeElement({ role: 'AXGroup', path: [0, ...Array(depth).fill(0)], children: [wrapper] });
    }
    const root = makeElement({ role: 'AXGroup', path: [0], children: [wrapper] });
    expect(findElementPath([root], 'DeepTarget')).toEqual([0, 0, 0, 0, 0]);
  });
});

// ─── Semantic target resolution ───────────────────────────

describe('resolveMacOSElement', () => {
  it('resolves by AX identifier with role aliases', () => {
    const elements: MacOSAXElement[] = [
      makeElement({ identifier: 'save-button', title: 'Save', path: [0] }),
    ];

    const result = resolveMacOSElement(elements, 'save-button', { role: 'button' });

    expect(result?.element.path).toEqual([0]);
    expect(result?.tier).toBe('identifier');
    expect(result?.confidence).toBe(1);
  });

  it('resolves by visible label using contains fallback', () => {
    const elements: MacOSAXElement[] = [
      makeElement({ title: 'Create new project', path: [2] }),
    ];

    const result = resolveMacOSElement(elements, 'new project');

    expect(result?.element.path).toEqual([2]);
    expect(result?.tier).toBe('contains');
  });

  it('returns null when the role filter excludes the candidate', () => {
    const elements: MacOSAXElement[] = [
      makeElement({ role: 'AXButton', title: 'Save', path: [0] }),
    ];

    expect(resolveMacOSElement(elements, 'Save', { role: 'textbox' })).toBeNull();
  });
});

describe('resolveSimulatorElement', () => {
  it('resolves simulator legacy elements by label and preserves path', () => {
    const elements = [
      {
        identifier: 'continue',
        label: 'Continue',
        role: 'AXButton',
        traits: ['button'],
        frame: { x: 0, y: 0, width: 100, height: 44 },
        isEnabled: true,
        value: null,
        path: [1, 2],
        children: [],
      },
    ];

    const result = resolveSimulatorElement(elements, 'Continue');

    expect(result?.element.path).toEqual([1, 2]);
    expect(result?.element.actions).toEqual(['AXPress']);
  });
});
