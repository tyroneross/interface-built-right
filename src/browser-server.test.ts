import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, rm, utimes, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const driverState = vi.hoisted(() => ({
  connectExisting: vi.fn(),
  disconnect: vi.fn(),
  goto: vi.fn(),
  currentUrl: 'https://example.com/login',
}));

vi.mock('./engine/driver.js', () => ({
  EngineDriver: class {
    pageTargetId = 'unused-new-target';
    emulationDomain = {
      applyDeviceProfile: vi.fn(async () => {}),
      setReducedMotion: vi.fn(async () => {}),
    };
    connectExisting = driverState.connectExisting;
    disconnect = driverState.disconnect;
  },
}));

vi.mock('./engine/compat.js', () => ({
  CompatPage: class {
    goto = driverState.goto;
    url = () => driverState.currentUrl;
    evaluate = vi.fn(async () => ({
      requestedUrl: '',
      currentUrl: driverState.currentUrl,
      title: 'Sign in',
      bodyText: 'Sign in with email',
      hasPasswordInput: true,
      hasEmailInput: true,
      hasOneTimeCodeInput: false,
      hasCaptcha: false,
    }));
  },
}));

import { browserServerLastActivityAt, PersistentSession } from './browser-server.js';

describe('PersistentSession safe reattachment', () => {
  let outputDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    outputDir = await mkdtemp(join(tmpdir(), 'ibr-session-reattach-'));
    await mkdir(join(outputDir, 'sessions', 'live_test'), { recursive: true });
    await writeFile(join(outputDir, 'browser-server.json'), JSON.stringify({
      wsEndpoint: 'ws://127.0.0.1/browser',
      cdpUrl: 'http://127.0.0.1:9222',
      pid: process.pid,
      startedAt: new Date().toISOString(),
      headless: false,
      mode: 'local',
      ownsBrowser: true,
      isolatedProfile: '',
    }));
    await writeFile(join(outputDir, 'sessions', 'live_test', 'live-session.json'), JSON.stringify({
      id: 'live_test',
      url: 'https://example.com/private',
      currentUrl: 'https://example.com/login',
      targetId: 'target-existing',
      strategyKey: 'chrome:local',
      name: 'private',
      viewport: { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
      createdAt: new Date().toISOString(),
      pageIndex: 0,
      actions: [],
    }));

    // `ok`/`status` are required, not decoration: the manifest is only trusted
    // when the CDP endpoint answers with a real 200. A stub without them reads
    // — correctly — as a browser server that is not there.
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ webSocketDebuggerUrl: 'ws://127.0.0.1/browser' }),
    })));
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await rm(outputDir, { recursive: true, force: true });
  });

  it('reattaches to the original target without navigating the URL again', async () => {
    const session = await PersistentSession.get(outputDir, 'live_test');

    expect(session).not.toBeNull();
    expect(driverState.connectExisting).toHaveBeenCalledWith(
      'ws://127.0.0.1/browser',
      'target-existing',
    );
    expect(driverState.goto).not.toHaveBeenCalled();
    expect(session?.hardWall?.kind).toBe('authentication');
  });

  it('refreshes the browser-server activity heartbeat after reconnecting', async () => {
    const manifest = join(outputDir, 'browser-server.json');
    const old = new Date('2020-01-01T00:00:00Z');
    await utimes(manifest, old, old);

    await PersistentSession.get(outputDir, 'live_test');

    expect(await browserServerLastActivityAt(outputDir)).toBeGreaterThan(old.getTime());
  });

  it('blocks an identical URL and strategy before connecting or navigating again', async () => {
    await writeFile(join(outputDir, 'sessions', 'live_test', 'live-session.json'), JSON.stringify({
      id: 'live_test',
      url: 'https://example.com/private',
      currentUrl: 'https://example.com/login',
      targetId: 'target-existing',
      strategyKey: 'chrome:local',
      hardWall: {
        kind: 'authentication',
        requestedUrl: 'https://example.com/private',
        currentUrl: 'https://example.com/login',
        strategyKey: 'chrome:local',
        attemptKey: 'chrome:local::https://example.com/private',
        detectedAt: new Date().toISOString(),
        prompt: 'Enter sign-in information manually.',
      },
      name: 'private',
      viewport: { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
      createdAt: new Date().toISOString(),
      pageIndex: 0,
      actions: [],
    }));

    await expect(PersistentSession.create(outputDir, {
      url: 'https://example.com/private',
      strategyKey: 'chrome:local',
    })).rejects.toThrow(/USER_ACTION_REQUIRED/);

    expect(driverState.connectExisting).not.toHaveBeenCalled();
    expect(driverState.goto).not.toHaveBeenCalled();
  });
});

/**
 * `isServerRunning` is a READ-ONLY liveness check called by ordinary commands
 * (`session:list` among them). It used to SIGKILL `state.chromePid` and delete
 * the state file whenever the CDP `/json/version` fetch THREW — and it throws
 * on `AbortSignal.timeout(2000)`, which a busy-but-alive Chrome hits routinely.
 * Checking whether the browser was running could therefore destroy it, and a
 * poll loop became repeated kill attempts.
 *
 * Both tests drive the timeout path by pointing `cdpUrl` at a port nothing
 * listens on, so the fetch genuinely fails rather than being mocked into
 * failing — the kill was in the catch, so a mocked catch would not prove the
 * kill is gone.
 */
describe('isServerRunning — a failed check must not kill the thing it checked', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ibr-liveness-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  // `getPaths` does `join(outputDir, SERVER_STATE_FILE)` — outputDir IS the
  // .ibr directory, not its parent. The first version of this helper wrote to
  // `<dir>/.ibr/browser-server.json`, so `isServerRunning` hit the
  // `!existsSync(stateFile)` early return and never reached the code under
  // test. Both assertions still "ran"; neither exercised anything.
  async function writeState(chromePid: number) {
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, 'browser-server.json'),
      JSON.stringify({
        pid: process.pid,
        chromePid,
        // Nothing listens here, so the fetch fails for real.
        cdpUrl: 'http://127.0.0.1:9',
        startedAt: new Date().toISOString(),
      }),
    );
  }

  it('leaves a LIVE process alone when the CDP fetch fails', async () => {
    const { isServerRunning } = await import('./browser-server.js');
    const { spawn } = await import('child_process');

    // A real child process standing in for a busy Chrome. Using this test's own
    // pid also works — and proves the point rather too well, since the mutant
    // then SIGKILLs the vitest worker mid-run and garbles the result. A child
    // gives the same signal with a readable failure.
    const child = spawn('sleep', ['30'], { stdio: 'ignore' });
    await new Promise((r) => setTimeout(r, 100));

    try {
      await writeState(child.pid!);

      const running = await isServerRunning(dir);

      // Alive but unreachable is "running", not "reap it".
      expect(running).toBe(true);

      // The load-bearing assertion: the process must SURVIVE the check.
      let stillAlive = true;
      try { process.kill(child.pid!, 0); } catch { stillAlive = false; }
      expect(stillAlive, 'isServerRunning killed the process it was only checking').toBe(true);

      // And the state file must survive, or the next call has nothing to reason over.
      const { existsSync } = await import('fs');
      expect(existsSync(join(dir, 'browser-server.json'))).toBe(true);
    } finally {
      try { child.kill('SIGKILL'); } catch { /* already gone */ }
    }
  });

  it('still reaps state when the process is genuinely gone', async () => {
    const { isServerRunning } = await import('./browser-server.js');
    // A pid that cannot exist: the guard must not become "never clean up".
    await writeState(0x7ffffffe);

    const running = await isServerRunning(dir);

    expect(running).toBe(false);
    const { existsSync } = await import('fs');
    expect(existsSync(join(dir, 'browser-server.json'))).toBe(false);
  });
});
