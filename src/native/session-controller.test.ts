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
  nativeStateSignature,
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

    backend.performAction = async () => {
      backend.performCalls++;
      backend.extractResult = { kind: 'macos', elements: [macElement({ title: 'Save', value: 'Saved', path: [0] })], window: windowInfo };
      return backend.actionResult;
    };
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
    expect(p.success).toBe(false);
    expect(p.actionDelivered).toBe(true);
    expect(p.verificationPassed).toBe(false);
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

describe('validated post-action observations', () => {
  it('returns the snapshot from the successful settle read without another extraction', async () => {
    const backend=new FakeBackend();
    backend.extractResult={kind:'macos',window:windowInfo,elements:[macElement({title:'Edit text',path:[0]})]};
    backend.performAction=async()=>{
      backend.performCalls++;
      backend.extractResult={kind:'macos',window:windowInfo,elements:[macElement({title:'Save changes',path:[0]}),macElement({title:'Read',value:'0',path:[1]})]};
      return {success:true,action:'press'};
    };
    const result=await make(backend).actionMacOS(macEntry(),{action:'click',target:'Edit text',waitFor:'Save changes',includeObservation:true});
    const data=JSON.parse(result.kind==='text'?result.text:'{}');
    expect(data.postAction.settled).toBe(true);
    expect(data.postAction.observation.elements.map((e:{label:string})=>e.label)).toEqual(['Save changes','Read']);
    expect(data.postAction.observation.elements[1].value).toBe('0');
    expect(data.postAction.observation.observedAt).toEqual(expect.any(String));
    expect(backend.extractCalls).toBe(2);expect(backend.performCalls).toBe(1);
  });
  it('keeps the legacy result small when no observation was requested', async()=>{
    const backend=new FakeBackend();backend.extractResult={kind:'macos',window:windowInfo,elements:[macElement({title:'Save',path:[0]})]};
    const result=await make(backend).actionMacOS(macEntry(),{action:'click',target:'Save',waitFor:'Save',waitTimeoutMs:0});
    expect(JSON.parse(result.kind==='text'?result.text:'{}').postAction).not.toHaveProperty('observation');
  });
});

describe('macOS post-action poll pacing', () => {
  it('leaves idle time between fresh reads without repeating the action', async () => {
    vi.useFakeTimers();
    try {
      const backend = new FakeBackend();
      let delivered = false;
      let reads = 0;
      let lastEnd = 0;
      const gaps: number[] = [];
      backend.performAction = async () => { backend.performCalls++; delivered = true; return backend.actionResult; };
      backend.extract = async () => {
        backend.extractCalls++;
        if (!delivered) return { kind: 'macos', window: windowInfo, elements: [macElement({ title: 'Edit', path: [0] })] };
        const gap = Date.now() - lastEnd;
        if (reads++) gaps.push(gap);
        await new Promise(resolve => setTimeout(resolve, 5));
        lastEnd = Date.now();
        return { kind: 'macos', window: windowInfo, elements: [macElement({ title: reads > 1 && gap >= 32 ? 'Save' : 'Edit', path: [0] })] };
      };
      const controller = new NativeSessionController({ backend, store: new Map() });
      const result = controller.actionMacOS(macEntry(), { action: 'click', target: 'Edit', waitFor: 'Save', waitTimeoutMs: 250, includeObservation: true });
      await vi.advanceTimersByTimeAsync(300);
      const response = await result;
      if (response.kind !== 'text') throw new Error('Expected text response');
      const payload = JSON.parse(response.text);
      expect(payload.postAction).toMatchObject({ settled: true, reason: 'waitFor-found', attempts: 2 });
      expect(gaps).toEqual([32]);
      expect(backend.performCalls).toBe(1);
      expect(payload.postAction.elapsedMs).toBeLessThanOrEqual(250);
    } finally { vi.useRealTimers(); }
  });

  it('does not extend a caller deadline to fit another poll or pass a missing target', async () => {
    vi.useFakeTimers();
    try {
      const backend = new FakeBackend();
      backend.extractResult = { kind: 'macos', window: windowInfo, elements: [macElement({ title: 'Edit', path: [0] })] };
      const controller = new NativeSessionController({ backend, store: new Map() });
      const started = Date.now();
      const result = controller.actionMacOS(macEntry(), { action: 'click', target: 'Edit', waitFor: 'Missing', waitTimeoutMs: 135 });
      await vi.advanceTimersByTimeAsync(135);
      const response = await result;
      if (response.kind !== 'text') throw new Error('Expected text response');
      const payload = JSON.parse(response.text);
      expect(Date.now() - started).toBe(135);
      expect(payload.postAction).toMatchObject({ settled: false, waitForFound: false, attempts: 1 });
      expect(backend.extractCalls).toBe(2); // fresh target resolution + one post-action read
      expect(backend.performCalls).toBe(1);
    } finally { vi.useRealTimers(); }
  });
});


describe('ref dispatch and full state stability regressions', () => {
  it('rejects a ref whose path changes in the final action extraction', async () => {
    const backend = new FakeBackend();
    backend.extractResult = { kind: 'macos', window: windowInfo, elements: [macElement({ title: 'Save', identifier: 'save', path: [1] })] };
    const result = await make(backend).actionMacOS(macEntry(), { action: 'click', target: 'save', expectedRef: { role: 'AXButton', label: 'Save', identifier: 'save', path: [0], windowId: 7 } });
    expect(result.kind === 'text' && result.isError).toBe(true);
    expect(backend.performCalls).toBe(0);
  });
  it('rejects simulator refs when final semantic resolution differs', async () => {
    const backend = new FakeBackend();
    backend.extractResult = { kind: 'simulator', device: simDevice(), elements: [simElement({ role: 'AXButton', label: 'Save', identifier: 'save', path: [1] })] };
    const result = await make(backend).actionSimulator(simEntry(), { action: 'click', target: 'save', expectedRef: { role: 'AXButton', label: 'Save', identifier: 'save', path: [0] } });
    expect(result.kind === 'text' && result.isError).toBe(true);
    expect(backend.performCalls).toBe(0);
  });
  it('includes selection and controls past index 200 in stability checks', () => {
    const candidates = Array.from({ length: 201 }, (_, index) => ({ role: 'AXButton', label: `Control ${index}`, enabled: true, selected: false, actions: ['AXPress'] }));
    const before = nativeStateSignature(windowInfo, candidates);
    candidates[200].selected = true;
    expect(nativeStateSignature(windowInfo, candidates)).not.toBe(before);
  });
});

it('retains delivery evidence when the post-action extraction fails', async () => {
  const backend = new FakeBackend();
  backend.extract = async () => {
    if (backend.performCalls) throw new Error('AX disconnected');
    return { kind: 'macos', window: windowInfo, elements: [macElement({ title: 'Save', path: [0] })] };
  };
  const result = await make(backend).actionMacOS(macEntry(), { action: 'click', target: 'Save', waitTimeoutMs: 0 });
  if (result.kind !== 'text') throw new Error('Expected action evidence');
  expect(JSON.parse(result.text)).toMatchObject({ actionDelivered: true, verificationPassed: false,
    postAction: { settled: false, reason: 'observation-failed', observationError: expect.stringContaining('AX disconnected') } });
  expect(backend.performCalls).toBe(1);
});

it('bounds a stalled post-action read without retrying delivery', async () => {
  vi.useFakeTimers();
  try {
    const backend = new FakeBackend();
    backend.extract = async () => backend.performCalls ? new Promise(() => {})
      : { kind: 'macos', window: windowInfo, elements: [macElement({ title: 'Save', path: [0] })] };
    const pending = make(backend).actionMacOS(macEntry(), { action: 'click', target: 'Save', waitFor: 'Saved', waitTimeoutMs: 200 });
    await vi.advanceTimersByTimeAsync(200);
    const result = await pending;
    if (result.kind !== 'text') throw new Error('Expected action evidence');
    expect(JSON.parse(result.text)).toMatchObject({ actionDelivered: true, verificationPassed: false,
      postAction: { settled: false, observationError: expect.stringContaining('timed out') } });
    expect(backend.performCalls).toBe(1);
  } finally { vi.useRealTimers(); }
});


it('does not verify an unchanged simulator action merely because its waiter already exists', async () => {
  const backend = new FakeBackend();
  backend.extractResult = { kind: 'simulator', device: simDevice(), elements: [simElement({ role: 'AXButton', label: 'Save', path: [0] })] };
  const result = await make(backend).actionSimulator(simEntry(), { action: 'click', target: 'Save', waitFor: 'Save', waitTimeoutMs: 0 });
  expect(result.kind).toBe('text');
  if (result.kind !== 'text') throw new Error('Expected JSON');
  expect(JSON.parse(result.text)).toMatchObject({ success: false, actionDelivered: true, verificationPassed: false, postAction: { effectVerified: false, stateChanged: false } });
});
