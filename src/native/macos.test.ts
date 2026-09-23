import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execFile } from 'child_process';

vi.mock('child_process', () => ({
  execFile: vi.fn(),
  exec: vi.fn(),
}));

vi.mock('./extract.js', () => ({
  ensureExtractor: vi.fn().mockResolvedValue('/mock/path/ibr-ax-extract'),
}));

import { extractMacOSElements, mapMacOSToEnhancedElements } from './macos.js';
import { buildNativeInteractivity } from './interactivity.js';
import type { MacOSAXElement } from './types.js';

const execFileMock = vi.mocked(execFile);

function mockExecFileSuccess(stdout: string) {
  execFileMock.mockImplementation((_cmd, _args, _opts, callback: unknown) => {
    const cb = callback as (err: null, result: { stdout: string; stderr: string }) => void;
    cb(null, { stdout, stderr: '' });
    return {} as ReturnType<typeof execFile>;
  });
}

function mockExecFileSequence(
  handlers: Array<(cmd: string, args: string[]) => { stdout?: string; stderr?: string; error?: Error }>
) {
  execFileMock.mockImplementation((cmd, args, _opts, callback: unknown) => {
    const handler = handlers.shift();
    if (!handler) throw new Error('unexpected execFile call');
    const result = handler(String(cmd), args as string[]);
    const cb = callback as (
      err: (Error & { stdout?: string; stderr?: string }) | null,
      result: { stdout: string; stderr: string } | null
    ) => void;
    if (result.error) {
      cb(Object.assign(result.error, {
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
      }), null);
    } else {
      cb(null, { stdout: result.stdout ?? '', stderr: result.stderr ?? '' });
    }
    return {} as ReturnType<typeof execFile>;
  });
}

describe('extractMacOSElements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses window metadata and element JSON', async () => {
    mockExecFileSuccess([
      'WINDOW:42:800x600:Demo',
      JSON.stringify([{ role: 'AXButton', title: 'Save', children: [], path: [0] }]),
    ].join('\n'));

    const result = await extractMacOSElements({ pid: 1234 });

    expect(result.window).toEqual({ windowId: 42, width: 800, height: 600, title: 'Demo' });
    expect(result.elements[0]).toMatchObject({ role: 'AXButton', title: 'Save', path: [0] });
  });

  it('foregrounds the process and retries once after a No windows found failure', async () => {
    mockExecFileSequence([
      (cmd, args) => {
        expect(cmd).toBe('/mock/path/ibr-ax-extract');
        expect(args).toEqual(['--pid', '1234']);
        return { error: new Error('Error: No windows found for pid 1234') };
      },
      (cmd, args) => {
        expect(cmd).toBe('osascript');
        expect(args[1]).toContain('unix id is 1234');
        return { stdout: '' };
      },
      (cmd, args) => {
        expect(cmd).toBe('/mock/path/ibr-ax-extract');
        expect(args).toEqual(['--pid', '1234']);
        return {
          stdout: [
            'WINDOW:99:1024x768:Recovered',
            JSON.stringify([{ role: 'AXButton', title: 'Recovered Button', children: [], path: [0] }]),
          ].join('\n'),
        };
      },
    ]);

    const result = await extractMacOSElements({ pid: 1234 });

    expect(result.window.title).toBe('Recovered');
    expect(result.elements[0].title).toBe('Recovered Button');
    expect(execFileMock).toHaveBeenCalledTimes(3);
  });
});

describe('mapMacOSToEnhancedElements', () => {
  function button(
    subrole: string | null,
    title: string | null,
    overrides: Partial<MacOSAXElement> = {}
  ): MacOSAXElement {
    return {
      role: 'AXButton',
      subrole,
      title,
      description: null,
      identifier: null,
      value: null,
      enabled: true,
      focused: false,
      actions: ['AXPress'],
      position: { x: 10, y: 10 },
      size: { width: 16, height: 16 },
      children: [],
      path: [0],
      ...overrides,
    };
  }

  function group(overrides: Partial<MacOSAXElement> = {}): MacOSAXElement {
    return {
      role: 'AXGroup',
      subrole: null,
      title: null,
      description: null,
      identifier: null,
      value: null,
      enabled: true,
      focused: false,
      actions: [],
      position: { x: 0, y: 0 },
      size: { width: 100, height: 100 },
      children: [],
      path: [0],
      ...overrides,
    };
  }

  it('excludes system-owned traffic-light controls from app audits', () => {
    const mapped = mapMacOSToEnhancedElements([
      button('AXCloseButton', null),
      button('AXMinimizeButton', null),
      button('AXFullScreenButton', null),
      button(null, 'Save'),
    ]);

    expect(mapped).toHaveLength(1);
    expect(mapped[0].text).toBe('Save');
  });

  it('excludes the AXZoomButton traffic light (the standard-button subrole the exclusion list previously missed)', () => {
    const mapped = mapMacOSToEnhancedElements([
      button('AXZoomButton', null),
      button(null, 'Save'),
    ]);

    expect(mapped).toHaveLength(1);
    expect(mapped[0].text).toBe('Save');
  });

  it('excludes an entire AXScrollBar subtree (NSScroller page-increment buttons), even nested', () => {
    const mapped = mapMacOSToEnhancedElements([
      group({
        role: 'AXScrollArea',
        children: [
          group({
            role: 'AXScrollBar',
            size: { width: 15, height: 631.5 },
            children: [
              button(null, null, { size: { width: 6, height: 631.5 } }),
              button(null, null, { size: { width: 6, height: 631.5 } }),
            ],
          }),
        ],
      }),
      button(null, 'Save'),
    ]);

    // Only the AXScrollArea container (which has substance via its bounds)
    // and the app's own "Save" button survive — the scroll bar and its two
    // unlabeled page-increment buttons are gone entirely.
    const roles = mapped.map((m) => m.selector);
    expect(mapped.some((m) => m.text === 'Save')).toBe(true);
    expect(roles.some((r) => r.includes('AXScrollBar'))).toBe(false);
    expect(mapped.filter((m) => m.tagName === 'button' && !m.text)).toHaveLength(0);
  });

  it('does NOT exclude an app-authored unlabeled button outside any scroll bar or window-control subrole', () => {
    // Regression guard: the chrome exclusions must not become a general
    // "unlabeled button" suppressor. A real accessibility bug in app content
    // has to keep showing up.
    const mapped = mapMacOSToEnhancedElements([
      button(null, null), // app content, no title, no subrole — a real bug
    ]);

    expect(mapped).toHaveLength(1);
    expect(mapped[0].text).toBeUndefined();
  });

  describe('end-to-end into the a11y-label rule (buildNativeInteractivity)', () => {
    it('reports no MISSING_LABEL for the traffic lights or the scroll bar buttons', () => {
      const mapped = mapMacOSToEnhancedElements([
        button('AXCloseButton', null),
        button('AXZoomButton', null),
        group({
          role: 'AXScrollArea',
          children: [
            group({
              role: 'AXScrollBar',
              children: [button(null, null, { size: { width: 6, height: 631.5 } })],
            }),
          ],
        }),
      ]);
      const { issues } = buildNativeInteractivity(mapped);
      expect(issues.filter((i) => i.type === 'MISSING_LABEL')).toEqual([]);
    });

    it('still reports MISSING_LABEL for an unlabeled button in app content', () => {
      const mapped = mapMacOSToEnhancedElements([button(null, null)]);
      const { issues } = buildNativeInteractivity(mapped);
      expect(issues.filter((i) => i.type === 'MISSING_LABEL')).toHaveLength(1);
    });
  });
});
