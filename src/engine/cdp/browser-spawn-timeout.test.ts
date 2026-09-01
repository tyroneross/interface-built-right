/**
 * Regression suite for the unbounded spawn path.
 *
 * `waitForDebugger` used to be `for (i < 50) { await fetch(...) }` under a
 * comment claiming "5 seconds at 100ms intervals". Neither half held: `fetch()`
 * carries no default deadline, so a single probe against a port that is
 * listening but silent blocked the loop forever — no output, no error, no
 * timeout of its own. Measured 2026-09-01: still pending at 25s.
 *
 * These tests spawn a REAL child process standing in for Chrome, because the
 * defect lives in the interaction between the child and the poll loop. A mocked
 * fetch would prove nothing about it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Read at module load by net-timeout.ts, so it must be set before the import
// below. vi.hoisted runs above imports; a plain assignment would be too late.
vi.hoisted(() => {
  process.env.IBR_BROWSER_SPAWN_TIMEOUT_MS = '3000';
  process.env.IBR_CDP_PROBE_TIMEOUT_MS = '500';
});

import { BrowserManager } from './browser.js';

let workDir: string;

/** Write an executable node script that stands in for the Chrome binary. */
async function fakeChrome(name: string, body: string): Promise<string> {
  const path = join(workDir, `${name}.mjs`);
  await writeFile(path, body, { mode: 0o755 });
  // Spawn it through the current node so the test does not depend on a shebang
  // resolving to a node on PATH.
  const shim = join(workDir, name);
  await writeFile(shim, `#!/bin/sh\nexec ${process.execPath} ${path} "$@"\n`, { mode: 0o755 });
  return shim;
}

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'ibr-spawn-timeout-'));
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe('BrowserManager.launch spawn bounds', () => {
  it('fails within the spawn budget when the browser binds the port and never answers', async () => {
    // The pathological case: the port IS listening, so connection-refused never
    // rescues the loop. This is what an unbounded fetch cannot survive.
    const chrome = await fakeChrome('stalling-chrome', `
      import { createServer } from 'node:net';
      const portArg = process.argv.find((a) => a.startsWith('--remote-debugging-port='));
      const port = Number(portArg.split('=')[1]);
      const held = [];
      createServer((s) => held.push(s)).listen(port, '127.0.0.1');
      setTimeout(() => process.exit(0), 60000);
    `);

    const manager = new BrowserManager();
    const steps: string[] = [];
    const started = Date.now();

    await expect(
      manager.launch({
        chromePath: chrome,
        userDataDir: join(workDir, 'profile'),
        onProgress: (s) => steps.push(s),
      }),
    ).rejects.toThrow(/Chrome debugger/);

    const elapsed = Date.now() - started;
    // The whole point: it returns. Budget is 3s; allow generous slack for a
    // loaded CI machine while still failing loudly on "never".
    expect(elapsed).toBeLessThan(20000);
    expect(elapsed).toBeGreaterThanOrEqual(2500);
    expect(manager.running).toBe(false);

    await manager.close();
  }, 40000);

  it('names the port, the probe count and the elapsed time in the timeout message', async () => {
    const chrome = await fakeChrome('stalling-chrome-2', `
      import { createServer } from 'node:net';
      const portArg = process.argv.find((a) => a.startsWith('--remote-debugging-port='));
      const port = Number(portArg.split('=')[1]);
      const held = [];
      createServer((s) => held.push(s)).listen(port, '127.0.0.1');
      setTimeout(() => process.exit(0), 60000);
    `);

    const manager = new BrowserManager();
    let message = '';
    try {
      await manager.launch({ chromePath: chrome, userDataDir: join(workDir, 'p2') });
    } catch (err) {
      message = (err as Error).message;
    }

    // A timeout that does not say what it waited on just relocates the mystery.
    expect(message).toContain(String(manager.port));
    expect(message).toMatch(/probes over \d+ms/);
    expect(message).toContain('/json/version');
    expect(manager.running).toBe(false);

    await manager.close();
  }, 40000);

  it('stops waiting the moment the browser process exits, and reports its stderr', async () => {
    // A Chrome that refuses to start (bad flag, profile lock, missing library)
    // used to be indistinguishable from a slow one: the loop kept polling a
    // process that was never coming back.
    const chrome = await fakeChrome('exiting-chrome', `
      process.stderr.write('Failed to create a ProcessSingleton for your profile directory.');
      process.exit(3);
    `);

    const manager = new BrowserManager();
    const started = Date.now();
    let message = '';
    try {
      await manager.launch({ chromePath: chrome, userDataDir: join(workDir, 'p3') });
    } catch (err) {
      message = (err as Error).message;
    }

    expect(message).toMatch(/exited before its debugger came up/);
    expect(message).toContain('code 3');
    expect(message).toContain('ProcessSingleton');
    // Must not burn the full spawn budget waiting on a dead child.
    expect(Date.now() - started).toBeLessThan(2500);
    expect(manager.running).toBe(false);

    await manager.close();
  }, 30000);

  it('reports each spawn step so a slow start is visible instead of silent', async () => {
    const chrome = await fakeChrome('exiting-chrome-2', `process.exit(1);`);
    const manager = new BrowserManager();
    const steps: string[] = [];

    await expect(
      manager.launch({
        chromePath: chrome,
        userDataDir: join(workDir, 'p4'),
        onProgress: (s) => steps.push(s),
      }),
    ).rejects.toThrow();

    expect(steps.some((s) => s.startsWith('debugging port '))).toBe(true);
    expect(steps.some((s) => s.startsWith('locating chrome binary'))).toBe(true);
    expect(steps.some((s) => s.startsWith('spawned chrome pid '))).toBe(true);

    await manager.close();
  }, 30000);

  it('bounds connect mode against a CDP URL that never answers', async () => {
    const { createServer } = await import('node:net');
    const held: import('node:net').Socket[] = [];
    const srv = createServer((s) => held.push(s));
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
    const port = (srv.address() as { port: number }).port;

    try {
      const manager = new BrowserManager();
      const started = Date.now();
      await expect(
        manager.launch({ mode: 'connect', cdpUrl: `http://127.0.0.1:${port}` }),
      ).rejects.toThrow(/Timed out|CDP/);
      expect(Date.now() - started).toBeLessThan(10000);
    } finally {
      for (const s of held) s.destroy();
      await new Promise<void>((r) => srv.close(() => r()));
    }
  }, 30000);
});
