import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MacOSAXElement, MacOSWindowInfo } from '../native/types.js';

const nativeIndexHoist = vi.hoisted(() => ({
  extractMacOSElements: vi.fn(),
}));

const nativeActionsHoist = vi.hoisted(() => ({
  performNativeAction: vi.fn(),
}));

vi.mock('../native/index.js', () => ({
  scanNative: vi.fn(),
  scanMacOS: vi.fn(),
  listDevices: vi.fn(),
  findDevice: vi.fn(),
  bootDevice: vi.fn(),
  captureNativeScreenshot: vi.fn(),
  captureMacOSScreenshot: vi.fn(),
  getDeviceViewport: vi.fn(),
  formatDevice: vi.fn(),
  findProcess: vi.fn(),
  extractMacOSElements: nativeIndexHoist.extractMacOSElements,
  extractNativeElements: vi.fn(),
}));

vi.mock('../native/actions.js', async () => {
  const actual = await vi.importActual<typeof import('../native/actions.js')>('../native/actions.js');
  return {
    ...actual,
    performNativeAction: nativeActionsHoist.performNativeAction,
  };
});

vi.mock('../native/preflight.js', () => ({
  macOSNativePreflight: vi.fn().mockResolvedValue({ ok: true }),
  simulatorNativePreflight: vi.fn().mockResolvedValue({ ok: true }),
  classifyExtractorError: vi.fn(),
  detectSimulatorChromeOnly: vi.fn(),
}));

const windowInfo: MacOSWindowInfo = {
  windowId: 100,
  width: 800,
  height: 600,
  title: 'TruePace',
};

function macElement(overrides: Partial<MacOSAXElement> & { path: number[] }): MacOSAXElement {
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
    size: { width: 120, height: 44 },
    children: [],
    ...overrides,
  };
}

describe('native_session_action post-action settling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nativeActionsHoist.performNativeAction.mockResolvedValue({ success: true, action: 'press' });
  });

  afterEach(async () => {
    const mod = await import('./tools.js');
    mod.__test_setSession('native-settle-test', null);
  });

  it('polls after a successful macOS action until waitFor resolves', async () => {
    nativeIndexHoist.extractMacOSElements
      .mockResolvedValueOnce({
        window: windowInfo,
        elements: [macElement({ title: 'Show me around', path: [0] })],
      })
      .mockResolvedValueOnce({
        window: windowInfo,
        elements: [macElement({ title: 'Loading', path: [0], actions: [] })],
      })
      .mockResolvedValueOnce({
        window: windowInfo,
        elements: [macElement({ title: 'Settings', identifier: 'settings', path: [1] })],
      });

    const mod = await import('./tools.js');
    mod.__test_setSession('native-settle-test', {
      driver: null,
      type: 'macos',
      app: 'TruePace',
      pid: 1234,
      createdAt: Date.now(),
    });

    const response = await mod.handleToolCall('native_session_action', {
      sessionId: 'native-settle-test',
      action: 'press',
      target: 'Show me around',
      waitFor: 'Settings',
      waitTimeoutMs: 500,
    });

    expect(response.isError).not.toBe(true);
    const payload = JSON.parse(response.content[0].type === 'text' ? response.content[0].text : '{}') as {
      success: boolean;
      postAction: { settled: boolean; reason: string; attempts: number; waitForFound: boolean };
    };

    expect(payload.success).toBe(true);
    expect(payload.postAction).toMatchObject({
      settled: true,
      reason: 'waitFor-found',
      waitForFound: true,
    });
    expect(payload.postAction.attempts).toBe(2);
    expect(nativeIndexHoist.extractMacOSElements).toHaveBeenCalledTimes(3);
    expect(nativeActionsHoist.performNativeAction).toHaveBeenCalledTimes(1);
  });
});
