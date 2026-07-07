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
import type { MacOSAXElement, MacOSWindowInfo } from './types.js';
import type { NativeActionResult } from './actions.js';
import {
  NativeSessionController,
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
    value: null, enabled: true, focused: false, actions: ['AXPress'],
    position: { x: 0, y: 0 }, size: { width: 100, height: 40 }, children: [], ...overrides,
  };
}

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
