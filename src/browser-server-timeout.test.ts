/**
 * Regression suite for the 2026-09-01 `ibr session:start` hang.
 *
 * Three defects sat behind one symptom, and each gets a test here:
 *   1. `browser-server.json` outlived the browser, so a manifest naming a dead
 *      pid and a dead port was still trusted.
 *   2. Every connect/spawn primitive was unbounded — `fetch()` and
 *      `new WebSocket()` have no default deadline, so a port that accepts TCP
 *      and never answers blocks forever with no output and no error.
 *   3. `waitForDebugger` claimed a 5s limit it did not enforce.
 *
 * Every test here asserts a BOUND, not just an outcome: an assertion that the
 * command eventually errors is worthless if the bug is that it never returns.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { createServer, type Server } from 'net';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('./engine/driver.js', () => ({
  EngineDriver: class {
    pageTargetId = 'unused-new-target';
    emulationDomain = {
      applyDeviceProfile: vi.fn(async () => {}),
      setReducedMotion: vi.fn(async () => {}),
    };
    // Mirrors the real driver against a silent peer: never settles on its own.
    connectExisting = vi.fn(() => new Promise<void>(() => {}));
    disconnect = vi.fn(async () => {});
    close = vi.fn(async () => {});
  },
}));

vi.mock('./engine/compat.js', () => ({
  CompatPage: class {
    goto = vi.fn(async () => {});
    url = () => 'https://example.com/';
    evaluate = vi.fn(async () => ({}));
  },
}));

import {
  inspectBrowserServer,
  isServerRunning,
  connectToBrowserServer,
  PersistentSession,
} from './browser-server.js';

/** A dead pid: claimed high, verified absent, so the test never depends on luck. */
function findDeadPid(): number {
  for (let pid = 60000; pid < 65000; pid++) {
    try {
      process.kill(pid, 0);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EPERM') return pid;
    }
  }
  throw new Error('could not find a dead pid to plant');
}

/** A socket that completes the TCP handshake and then says nothing, ever. */
async function startBlackhole(): Promise<{ port: number; stop: () => Promise<void> }> {
  const held: import('net').Socket[] = [];
  const srv: Server = createServer((sock) => { held.push(sock); });
  await new Promise<void>((resolve) => srv.listen(0, '127.0.0.1', resolve));
  const port = (srv.address() as { port: number }).port;
  return {
    port,
    stop: () => new Promise<void>((resolve) => {
      for (const s of held) s.destroy();
      srv.close(() => resolve());
    }),
  };
}

async function plantManifest(outputDir: string, state: Record<string, unknown>) {
  await writeFile(join(outputDir, 'browser-server.json'), JSON.stringify({
    wsEndpoint: 'ws://127.0.0.1:1/devtools/browser/x',
    cdpUrl: 'http://127.0.0.1:1',
    pid: findDeadPid(),
    chromePid: findDeadPid() + 1,
    startedAt: new Date().toISOString(),
    headless: true,
    mode: 'local',
    ownsBrowser: true,
    isolatedProfile: '',
    ...state,
  }, null, 2));
}

describe('stale browser-server manifest', () => {
  let outputDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    outputDir = await mkdtemp(join(tmpdir(), 'ibr-stale-manifest-'));
    await mkdir(join(outputDir, 'sessions'), { recursive: true });
  });

  afterEach(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  it('reports a dead owning pid as stale and removes the manifest, bounded', async () => {
    const deadPid = findDeadPid();
    await plantManifest(outputDir, { pid: deadPid, cdpUrl: 'http://127.0.0.1:64311' });

    const started = Date.now();
    const inspection = await inspectBrowserServer(outputDir);
    const elapsed = Date.now() - started;

    expect(inspection.status).toBe('stale');
    // The failure must NAME the stale pid — a bare "not running" sent the
    // 2026-09-01 debugging session looking in the wrong place.
    expect(inspection.reason).toContain(String(deadPid));
    expect(existsSync(join(outputDir, 'browser-server.json'))).toBe(false);
    expect(elapsed).toBeLessThan(2000);
  });

  it('does not hang when the manifest names a port that accepts and never answers', async () => {
    // The exact evidence shape: manifest present, endpoint reachable at the TCP
    // layer, no HTTP response. Before the fix this blocked indefinitely inside
    // an unbounded fetch(); it was still pending at 25s when measured.
    const blackhole = await startBlackhole();
    try {
      await plantManifest(outputDir, {
        pid: process.pid, // alive, so the pid check passes and the probe runs
        cdpUrl: `http://127.0.0.1:${blackhole.port}`,
      });

      const started = Date.now();
      const inspection = await inspectBrowserServer(outputDir);
      const elapsed = Date.now() - started;

      expect(['stale', 'unreachable']).toContain(inspection.status);
      expect(inspection.reason).toMatch(/did not answer|Timed out/);
      expect(elapsed).toBeLessThan(15000);
    } finally {
      await blackhole.stop();
    }
  }, 30000);

  it('refuses to attach to a stale manifest instead of connecting into a hang', async () => {
    await plantManifest(outputDir, { pid: findDeadPid() });

    const started = Date.now();
    const driver = await connectToBrowserServer(outputDir);
    const elapsed = Date.now() - started;

    // The mocked connectExisting never settles. Returning null proves the
    // validate-before-connect gate ran and the attach was never attempted.
    expect(driver).toBeNull();
    expect(elapsed).toBeLessThan(5000);
  });

  it('errors with a named cause rather than hanging when a session starts on a stale manifest', async () => {
    await plantManifest(outputDir, { pid: findDeadPid() });

    const started = Date.now();
    await expect(
      PersistentSession.create(outputDir, { url: 'https://example.com/' }),
    ).rejects.toThrow(/No browser server running/);
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it('treats a busy-but-alive browser as running rather than reaping it', async () => {
    const blackhole = await startBlackhole();
    try {
      await plantManifest(outputDir, {
        pid: process.pid,
        chromePid: process.pid, // alive: unreachable is not the same as gone
        cdpUrl: `http://127.0.0.1:${blackhole.port}`,
      });

      const inspection = await inspectBrowserServer(outputDir);
      expect(inspection.status).toBe('unreachable');
      // Manifest survives: killing a live browser because it missed a deadline
      // is the regression this guards.
      expect(existsSync(join(outputDir, 'browser-server.json'))).toBe(true);
      expect(await isServerRunning(outputDir)).toBe(true);
    } finally {
      await blackhole.stop();
    }
  }, 30000);

  it('removes a malformed manifest rather than parsing it on every command', async () => {
    await writeFile(join(outputDir, 'browser-server.json'), '{not json');
    const inspection = await inspectBrowserServer(outputDir);
    expect(inspection.status).toBe('stale');
    expect(existsSync(join(outputDir, 'browser-server.json'))).toBe(false);
  });

  it('reports no-manifest without inventing a failure', async () => {
    const inspection = await inspectBrowserServer(outputDir);
    expect(inspection.status).toBe('no-manifest');
    expect(await isServerRunning(outputDir)).toBe(false);
  });

  it('leaves session records alone when it reaps the manifest', async () => {
    // session:list ids outlive the browser by design; reaping the manifest must
    // not delete the user's session history as a side effect.
    const sessionDir = join(outputDir, 'sessions', 'live_keepme');
    await mkdir(sessionDir, { recursive: true });
    await writeFile(join(sessionDir, 'live-session.json'), JSON.stringify({ id: 'live_keepme' }));
    await plantManifest(outputDir, { pid: findDeadPid() });

    await inspectBrowserServer(outputDir);

    expect(existsSync(join(sessionDir, 'live-session.json'))).toBe(true);
    expect(JSON.parse(await readFile(join(sessionDir, 'live-session.json'), 'utf-8')).id)
      .toBe('live_keepme');
  });
});

describe('a live-but-unresponsive browser is not a dead one', () => {
  let outputDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    outputDir = await mkdtemp(join(tmpdir(), 'ibr-busy-browser-'));
    await mkdir(join(outputDir, 'sessions', 'live_test'), { recursive: true });
  });

  afterEach(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  it('keeps the manifest when an attach times out against a running browser', async () => {
    // Deleting the manifest here would strand a live Chrome with nothing on
    // disk pointing at it, so `session:close all` could never reclaim it.
    const blackhole = await startBlackhole();
    try {
      await plantManifest(outputDir, {
        pid: process.pid,
        chromePid: process.pid,
        cdpUrl: `http://127.0.0.1:${blackhole.port}`,
      });

      const driver = await connectToBrowserServer(outputDir);
      expect(driver).toBeNull();
      expect(existsSync(join(outputDir, 'browser-server.json'))).toBe(true);
    } finally {
      await blackhole.stop();
    }
  }, 30000);

  it('says the browser could not be attached, not that the session is missing', async () => {
    const blackhole = await startBlackhole();
    try {
      await writeFile(
        join(outputDir, 'sessions', 'live_test', 'live-session.json'),
        JSON.stringify({
          id: 'live_test',
          url: 'https://example.com/',
          targetId: 'target-existing',
          strategyKey: 'chrome:local',
          name: '/',
          viewport: { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
          createdAt: new Date().toISOString(),
          pageIndex: 0,
          actions: [],
        }),
      );
      await plantManifest(outputDir, {
        pid: process.pid,
        chromePid: process.pid,
        cdpUrl: `http://127.0.0.1:${blackhole.port}`,
      });

      const started = Date.now();
      await expect(PersistentSession.get(outputDir, 'live_test'))
        .rejects.toThrow(/exists on disk but its browser could not be attached/);
      expect(Date.now() - started).toBeLessThan(20000);
    } finally {
      await blackhole.stop();
    }
  }, 40000);

  it('still returns null for a session id that genuinely has no record', async () => {
    await plantManifest(outputDir, { pid: process.pid });
    expect(await PersistentSession.get(outputDir, 'live_nope')).toBeNull();
  });
});
