import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
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

import { PersistentSession } from './browser-server.js';

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

    vi.stubGlobal('fetch', vi.fn(async () => ({
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
