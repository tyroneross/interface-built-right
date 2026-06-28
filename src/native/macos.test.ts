import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execFile } from 'child_process';

vi.mock('child_process', () => ({
  execFile: vi.fn(),
  exec: vi.fn(),
}));

vi.mock('./extract.js', () => ({
  ensureExtractor: vi.fn().mockResolvedValue('/mock/path/ibr-ax-extract'),
}));

import { extractMacOSElements } from './macos.js';

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
