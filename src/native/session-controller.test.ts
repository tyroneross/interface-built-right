/**
 * NativeSessionController unit tests (T-02).
 *
 * Exercises the controller in isolation against an injected fake `NativeBackend`
 * (no Swift, no AX): successful action, missing target, wait timeout, screenshot
 * read mode, plus a type-level guard that `target` is optional for
 * `keystroke`/`app` kinds and required for element-targeting kinds.
 *
 * 3e9375a reliability behavior is covered: the settle loop (waitFor/timeout) and
 * the screenshot read path both run here.
 */

import { describe, it, expect, vi } from 'vitest';
import type { MacOSAXElement, MacOSWindowInfo, NativeElement, SimulatorDevice } from './types.js';
import type { NativeActionResult } from './actions.js';
import {
  NativeSessionController,
  mapSessionActionToNative,
  type ElementActionRequest,
  type KeystrokeActionRequest,
  type AppLifecycleActionRequest,
} from './session-controller.js';
import type {
  NativeBackend,
  NativeExtraction,
  NativeScreenshotCapture,
  NativeSessionTarget,
} from './backend.js';
import { type ActionOutcome, notImplementedOutcome } from '../action-outcome.js';
import type { SessionEntry } from '../mcp/sessions.js';

// Preflight is real; stub it green so action tests exercise controller logic.
vi.mock('./preflight.js', async () => {
  const actual = await vi.importActual<typeof import('./preflight.js')>('./preflight.js');
  return {
    ...actual,
    macOSNativePreflight: vi.fn().mockResolvedValue({ ok: true }),
    simulatorNativePreflight: vi.fn().mockResolvedValue({ ok: true }),
    classifyExtractorError: vi.fn().mockReturnValue(null),
  };
});

const windowInfo: MacOSWindowInfo = { windowId: 7, width: 400, height: 300, title: 'Fake' };

function macElement(overrides: Partial<MacOSAXElement> & { path: number[] }): MacOSAXElement {
  return {
    role: 'AXButton', subrole: null, title: null, description: null, identifier: null,
    value: null, placeholder: null, enabled: true, focused: false, actions: ['AXPress'],
    position: { x: 0, y: 0 }, size: { width: 100, height: 40 }, children: [], ...overrides,
  };
}

describe('mapSessionActionToNative — verb dispatch', () => {
  it('maps select to the dedicated select verb (AXSelected), NOT press', () => {
    // Regression guard: select used to collapse into press, which is a no-op on
    // SwiftUI List/table rows (they select via the AXSelected attribute, not
    // AXPress). See AXCore.swift `case "select"`.
    expect(mapSessionActionToNative('select')).toEqual({ action: 'select' });
  });

  it('still maps click/press/check to press', () => {
    expect(mapSessionActionToNative('click')).toEqual({ action: 'press' });
    expect(mapSessionActionToNative('press')).toEqual({ action: 'press' });
    expect(mapSessionActionToNative('check')).toEqual({ action: 'press' });
  });

  it('refuses drag by default (cursor-free stance), with an opt-in hint', () => {
    delete process.env.IBR_ALLOW_POINTER_INJECTION;
    const r = mapSessionActionToNative('drag', '-150,0');
    expect('error' in r && /IBR_ALLOW_POINTER_INJECTION/.test(r.error)).toBe(true);
  });

  it('maps drag to the drag verb when pointer injection is opted in', () => {
    process.env.IBR_ALLOW_POINTER_INJECTION = '1';
    try {
      expect(mapSessionActionToNative('drag', '-150,0')).toEqual({ action: 'drag', value: '-150,0' });
      // value is required even when enabled
      expect('error' in mapSessionActionToNative('drag')).toBe(true);
    } finally {
      delete process.env.IBR_ALLOW_POINTER_INJECTION;
    }
  });
});

/** Configurable fake backend. */
class FakeBackend implements NativeBackend {
  extractResult: NativeExtraction = { kind: 'macos', elements: [], window: windowInfo };
  actionResult: NativeActionResult = { success: true, action: 'press' };
  screenshotResult: NativeScreenshotCapture = {
    kind: 'macos', base64: 'ZmFrZQ==', window: windowInfo, screenshotPath: '/tmp/x.png',
  };
  extractCalls = 0;
  performCalls = 0;

  async extract(): Promise<NativeExtraction> { this.extractCalls += 1; return this.extractResult; }
  async performAction(): Promise<NativeActionResult> { this.performCalls += 1; return this.actionResult; }
  async captureScreenshot(): Promise<NativeScreenshotCapture> { return this.screenshotResult; }
  async keystroke(_t: NativeSessionTarget): Promise<ActionOutcome> { return notImplementedOutcome('keystroke'); }
  async lifecycle(_t: NativeSessionTarget): Promise<ActionOutcome> { return notImplementedOutcome('app lifecycle'); }
  async menu(_t: NativeSessionTarget): Promise<ActionOutcome> { return notImplementedOutcome('menu'); }
}

function macEntry(): SessionEntry {
  return { driver: null, type: 'macos', app: 'Fake', pid: 4242, createdAt: Date.now() };
}

function simEntry(): SessionEntry {
  return {
    driver: null, type: 'simulator', device: { udid: 'ABCD-1234', name: 'Apple Watch Series 10 (46mm)' },
    createdAt: Date.now(),
  };
}

function simDevice(overrides: Partial<SimulatorDevice> = {}): SimulatorDevice {
  return {
    udid: 'ABCD-1234', name: 'Apple Watch Series 10 (46mm)', state: 'Booted',
    runtime: 'com.apple.CoreSimulator.SimRuntime.watchOS-26-2', platform: 'watchos',
    isAvailable: true, ...overrides,
  };
}

function simElement(overrides: Partial<NativeElement> & { path?: number[] } = {}): NativeElement {
  return {
    identifier: '', label: 'Simulator', role: 'AXApplication', traits: [],
    frame: { x: 0, y: 0, width: 0, height: 0 }, isEnabled: true, value: null,
    children: [], ...overrides,
  };
}

function make(backend: NativeBackend) {
  return new NativeSessionController({ store: new Map(), backend });
}

describe('NativeSessionController.actionMacOS', () => {
  it('successful action returns a non-error text result with success:true + provenance', async () => {
    const backend = new FakeBackend();
    backend.extractResult = { kind: 'macos', elements: [macElement({ title: 'Save', path: [0] })], window: windowInfo };
    backend.actionResult = { success: true, action: 'press' };

    const res = await make(backend).actionMacOS(macEntry(), { action: 'press', target: 'Save', waitTimeoutMs: 0 });
    expect(res.kind).toBe('text');
    expect(res.kind === 'text' && res.isError).not.toBe(true);
    const p = JSON.parse(res.kind === 'text' ? res.text : '{}');
    expect(p.success).toBe(true);
    expect(p.requestedAction).toBe('press');
    expect(p.axAction).toBe('press');
    expect(p.tier).toBeDefined();
    expect(p.confidence).toBeDefined();
    expect(backend.performCalls).toBe(1);
  });

  it('missing target → nativeTargetNotFound error result, no action performed', async () => {
    const backend = new FakeBackend();
    backend.extractResult = { kind: 'macos', elements: [macElement({ title: 'Save', path: [0] })], window: windowInfo };

    const res = await make(backend).actionMacOS(macEntry(), { action: 'press', target: 'Ghost' });
    expect(res.kind === 'text' && res.isError).toBe(true);
    const p = JSON.parse(res.kind === 'text' ? res.text : '{}');
    expect(p.success).toBe(false);
    expect(p.error).toBe('Element "Ghost" not found');
    expect(backend.performCalls).toBe(0);
  });

  it('wait timeout → postAction.settled false, reason "timeout" when waitFor never resolves', async () => {
    const backend = new FakeBackend();
    backend.extractResult = { kind: 'macos', elements: [macElement({ title: 'Save', path: [0] })], window: windowInfo };
    backend.actionResult = { success: true, action: 'press' };

    const res = await make(backend).actionMacOS(macEntry(), {
      action: 'press', target: 'Save', waitFor: 'NeverAppears', waitTimeoutMs: 20,
    });
    const p = JSON.parse(res.kind === 'text' ? res.text : '{}');
    expect(p.success).toBe(true);
    expect(p.postAction.settled).toBe(false);
    expect(p.postAction.reason).toBe('timeout');
    expect(p.postAction.waitForFound).toBe(false);
  });
});

describe('NativeSessionController.readMacOS', () => {
  it('screenshot read mode returns an image result with metadata', async () => {
    const backend = new FakeBackend();
    backend.screenshotResult = {
      kind: 'macos', base64: 'aW1n', window: windowInfo, screenshotPath: '/tmp/shot.png',
    };
    const res = await make(backend).readMacOS(macEntry(), 'screenshot', 50);
    expect(res.kind).toBe('image');
    if (res.kind !== 'image') throw new Error('expected image');
    expect(res.base64).toBe('aW1n');
    const meta = JSON.parse(res.metadata);
    expect(meta.type).toBe('macos');
    expect(meta.backend).toBe('macos-ax');
    expect(meta.screenshotPath).toBe('/tmp/shot.png');
    expect(meta.hostCursorAffected).toBe(false);
  });

  it('observe read mode returns totals + formatted elements', async () => {
    const backend = new FakeBackend();
    backend.extractResult = { kind: 'macos', elements: [macElement({ title: 'Save', path: [0] })], window: windowInfo };
    const res = await make(backend).readMacOS(macEntry(), 'observe', 50);
    expect(res.kind).toBe('text');
    const p = JSON.parse(res.kind === 'text' ? res.text : '{}');
    expect(p.totalElements).toBe(1);
    expect(p.interactiveElements).toBe(1);
    expect(p.elements[0].label).toBe('Save');
  });
});

describe('NativeSessionController.readSimulator — D1/D2 host-chrome census', () => {
  it('a pure host-chrome extraction (AXApplication/AXMenuBar/AXMenuBarItem) returns isError, not a clean 0-element observe', async () => {
    const backend = new FakeBackend();
    // The exact observed shape: 20x AXApplication "Simulator", 21x AXMenuBar
    // "_NS:1311", 9x AXMenuBarItem menu names — 50 elements, zero app content.
    const hostChromeElements: NativeElement[] = [
      ...Array.from({ length: 3 }, () => simElement({ role: 'AXApplication', label: 'Simulator' })),
      ...Array.from({ length: 3 }, () => simElement({ role: 'AXMenuBar', label: '_NS:1311' })),
      ...['Apple', 'File', 'Edit', 'Device'].map((name) => simElement({ role: 'AXMenuBarItem', label: name })),
    ];
    backend.extractResult = { kind: 'simulator', elements: hostChromeElements, device: simDevice() };

    const res = await make(backend).readSimulator(simEntry(), 'observe', 50);
    expect(res.kind).toBe('text');
    expect(res.kind === 'text' && res.isError).toBe(true);
    const text = res.kind === 'text' ? res.text : '';
    expect(text).toMatch(/guest accessibility tree is unreachable/i);
  });

  it('real app content (AXButton/AXStaticText) alongside an AXApplication root reads clean', async () => {
    const backend = new FakeBackend();
    const appElements: NativeElement[] = [
      simElement({ role: 'AXApplication', label: 'Pomodoro' }),
      simElement({ role: 'AXButton', label: 'Start', traits: ['button'] }),
      simElement({ role: 'AXStaticText', label: 'Pomodoro' }),
    ];
    backend.extractResult = { kind: 'simulator', elements: appElements, device: simDevice() };

    const res = await make(backend).readSimulator(simEntry(), 'observe', 50);
    expect(res.kind).toBe('text');
    expect(res.kind === 'text' && res.isError).not.toBe(true);
    const p = JSON.parse(res.kind === 'text' ? res.text : '{}');
    expect(p.totalElements).toBe(3);
    expect(p.interactiveElements).toBe(1);
  });
});

describe('frozen action surface — target optionality (type-level)', () => {
  it('keystroke/app omit target; element kinds require it', () => {
    const keystroke: KeystrokeActionRequest = { action: 'keystroke', chord: 'Meta+n' };
    const app: AppLifecycleActionRequest = { action: 'app', op: 'launch' };
    // @ts-expect-error element-targeting kinds require `target`
    const missingTarget: ElementActionRequest = { action: 'click' };

    expect(keystroke.action).toBe('keystroke');
    expect(app.action).toBe('app');
    expect(missingTarget.action).toBe('click');
  });
});
