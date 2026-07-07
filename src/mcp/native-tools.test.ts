/**
 * Native MCP tools — golden-shape wire suite (T-01g) + relocated native
 * describe blocks (moved here from session-tools.test.ts / tools.test.ts at
 * chunk C0 so Epic 4 owns them without co-owning the web test files).
 *
 * T-01g pins the BYTE shape of the native MCP wire so the Wave-0 extraction is
 * provably behavior-preserving and later waves (E4-B enum extension, E2-B
 * validator/evidence) cannot silently drift it. Volatile fields (sessionId,
 * timestamp, screenshotPath) are normalized; everything else is asserted exact.
 *
 * All native session tools route through `handleToolCall` in ./tools.js, which
 * aggregates ./native-tools.js. These tests therefore exercise the real wire.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MacOSAXElement, MacOSWindowInfo } from '../native/types.js';

// ─── Hoisted spies for the native module barrel + actions ───────────────────

const idx = vi.hoisted(() => ({
  extractMacOSElements: vi.fn(),
  extractNativeElements: vi.fn(),
  findProcess: vi.fn(),
  findDevice: vi.fn(),
  bootDevice: vi.fn(),
  captureMacOSScreenshot: vi.fn(),
  captureNativeScreenshot: vi.fn(),
  getDeviceViewport: vi.fn(),
}));

const act = vi.hoisted(() => ({
  performNativeAction: vi.fn(),
}));

vi.mock('../native/index.js', () => ({
  scanNative: vi.fn(),
  scanMacOS: vi.fn(),
  listDevices: vi.fn(),
  formatDevice: vi.fn(),
  findDevice: idx.findDevice,
  bootDevice: idx.bootDevice,
  captureNativeScreenshot: idx.captureNativeScreenshot,
  captureMacOSScreenshot: idx.captureMacOSScreenshot,
  getDeviceViewport: idx.getDeviceViewport,
  findProcess: idx.findProcess,
  extractMacOSElements: idx.extractMacOSElements,
  extractNativeElements: idx.extractNativeElements,
}));

vi.mock('../native/actions.js', async () => {
  const actual = await vi.importActual<typeof import('../native/actions.js')>('../native/actions.js');
  return { ...actual, performNativeAction: act.performNativeAction };
});

vi.mock('../native/preflight.js', async () => {
  const actual = await vi.importActual<typeof import('../native/preflight.js')>('../native/preflight.js');
  return {
    ...actual,
    macOSNativePreflight: vi.fn().mockResolvedValue({ ok: true }),
    simulatorNativePreflight: vi.fn().mockResolvedValue({ ok: true }),
    classifyExtractorError: vi.fn().mockReturnValue(null),
  };
});

// fs/promises.readFile backs the screenshot base64 read in RespawnBackend.
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return { ...actual, readFile: vi.fn().mockResolvedValue(Buffer.from('fake-png-bytes')) };
});

// ─── Fixtures ────────────────────────────────────────────────────────────────

const windowInfo: MacOSWindowInfo = { windowId: 42, width: 800, height: 600, title: 'DemoApp' };

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

function textOf(res: { content: Array<{ type: string; text?: string }> }): string {
  const t = res.content.find((c) => c.type === 'text');
  return t?.text ?? '';
}
function parse(res: { content: Array<{ type: string; text?: string }> }): Record<string, unknown> {
  return JSON.parse(textOf(res)) as Record<string, unknown>;
}
/** Strip nondeterministic fields so the rest can be asserted exact. */
function normalize(o: Record<string, unknown>): Record<string, unknown> {
  const { sessionId: _s, timestamp: _t, screenshotPath: _p, ...rest } = o;
  return rest;
}

async function call(name: string, args: Record<string, unknown>) {
  const { handleToolCall } = await import('./tools.js');
  return handleToolCall(name, args);
}
async function seed(id: string, entry: unknown) {
  const { __test_setSession } = await import('./sessions.js');
  __test_setSession(id, entry as never);
}

// ════════════════════════════════════════════════════════════════════════════
// T-01g — golden-shape wire suite
// ════════════════════════════════════════════════════════════════════════════

describe('T-01g: native_session_start wire shape', () => {
  beforeEach(() => vi.clearAllMocks());

  it('macOS app start — exact envelope', async () => {
    idx.findProcess.mockResolvedValue(9999);
    const res = await call('native_session_start', { app: 'DemoApp' });
    expect(res.isError).not.toBe(true);
    const p = parse(res);
    expect(typeof p.sessionId).toBe('string');
    expect(typeof p.timestamp).toBe('string');
    expect(normalize(p)).toEqual({
      type: 'macos',
      backend: 'macos-ax',
      app: 'DemoApp',
      pid: 9999,
      hostCursorAffected: false,
    });
  });

  it('macOS pid start — exact envelope', async () => {
    const res = await call('native_session_start', { pid: 12345 });
    const p = parse(res);
    expect(normalize(p)).toEqual({
      type: 'macos',
      backend: 'macos-ax',
      app: 'pid-12345',
      pid: 12345,
      hostCursorAffected: false,
    });
  });

  it('simulator start — exact envelope', async () => {
    idx.findDevice.mockResolvedValue({ udid: 'UDID-1', name: 'iPhone 16', state: 'Booted' });
    const res = await call('native_session_start', { simulator: 'iPhone 16' });
    const p = parse(res);
    expect(normalize(p)).toEqual({
      type: 'simulator',
      backend: 'simulator-ax',
      device: { udid: 'UDID-1', name: 'iPhone 16' },
      hostCursorAffected: false,
    });
  });

  it('rejects >1 target and 0 targets with the frozen messages', async () => {
    const two = await call('native_session_start', { app: 'A', pid: 1 });
    expect(two.isError).toBe(true);
    expect(textOf(two)).toBe("Provide only one native target: 'app', 'pid', or 'simulator'.");

    const zero = await call('native_session_start', {});
    expect(zero.isError).toBe(true);
    expect(textOf(zero)).toBe(
      "native_session_start requires 'app' or 'pid' for macOS, or 'simulator' for iOS/watchOS.",
    );
  });

  it('macOS pid start rejects a non-positive pid with the frozen message', async () => {
    const res = await call('native_session_start', { pid: 0 });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toBe("native_session_start (macos) failed: 'pid' must be a positive integer.");
  });
});

describe('T-01g: native_session_read wire shapes (4 modes)', () => {
  const SID = 'golden-read-macos';
  beforeEach(async () => {
    vi.clearAllMocks();
    await seed(SID, { driver: null, type: 'macos', app: 'DemoApp', pid: 9999, createdAt: Date.now() });
  });
  afterEach(async () => { await seed(SID, null); });

  it('observe — exact envelope + formatNativeCandidate element shape', async () => {
    idx.extractMacOSElements.mockResolvedValue({
      window: windowInfo,
      elements: [macElement({ title: 'Save', path: [0] })],
    });
    const p = parse(await call('native_session_read', { sessionId: SID, what: 'observe' }));
    const { elements, ...envelope } = p as { elements: Array<Record<string, unknown>> };
    expect(envelope).toEqual({
      type: 'macos',
      backend: 'macos-ax',
      app: 'DemoApp',
      pid: 9999,
      window: windowInfo,
      totalElements: 1,
      interactiveElements: 1,
      returned: 1,
      hostCursorAffected: false,
    });
    expect(Object.keys(elements[0]).sort()).toEqual(
      ['actions', 'enabled', 'frame', 'identifier', 'label', 'path', 'role'].sort(),
    );
    expect(elements[0].label).toBe('Save');
    expect(elements[0].path).toEqual([0]);
  });

  it('extract — envelope matches observe (source = all candidates)', async () => {
    idx.extractMacOSElements.mockResolvedValue({
      window: windowInfo,
      elements: [macElement({ title: 'Save', path: [0] })],
    });
    const p = parse(await call('native_session_read', { sessionId: SID, what: 'extract' }));
    expect(p.type).toBe('macos');
    expect(p.returned).toBe(1);
    expect(Array.isArray(p.elements)).toBe(true);
  });

  it('state — metadata envelope, no elements array', async () => {
    idx.extractMacOSElements.mockResolvedValue({
      window: windowInfo,
      elements: [macElement({ title: 'Save', path: [0] })],
    });
    const p = parse(await call('native_session_read', { sessionId: SID, what: 'state' }));
    expect(p).toEqual({
      type: 'macos',
      backend: 'macos-ax',
      app: 'DemoApp',
      pid: 9999,
      window: windowInfo,
      totalElements: 1,
      interactiveElements: 1,
      hostCursorAffected: false,
    });
  });

  it('screenshot — image content + exact metadata envelope', async () => {
    idx.extractMacOSElements.mockResolvedValue({ window: windowInfo, elements: [] });
    idx.captureMacOSScreenshot.mockResolvedValue(undefined);
    const res = await call('native_session_read', { sessionId: SID, what: 'screenshot' });
    const image = res.content.find((c) => c.type === 'image') as { data: string; mimeType: string };
    expect(image.mimeType).toBe('image/png');
    expect(image.data).toBe(Buffer.from('fake-png-bytes').toString('base64'));
    const meta = parse(res);
    expect(normalize(meta)).toEqual({
      type: 'macos',
      backend: 'macos-ax',
      app: 'DemoApp',
      pid: 9999,
      window: windowInfo,
      hostCursorAffected: false,
    });
  });
});

describe('T-01g: native_session_action wire shapes', () => {
  const SID = 'golden-action-macos';
  beforeEach(async () => {
    vi.clearAllMocks();
    await seed(SID, { driver: null, type: 'macos', app: 'DemoApp', pid: 9999, createdAt: Date.now() });
  });
  afterEach(async () => { await seed(SID, null); });

  it('nativeTargetNotFound — exact error payload', async () => {
    idx.extractMacOSElements.mockResolvedValue({
      window: windowInfo,
      elements: [macElement({ title: 'Save', path: [0] })],
    });
    const res = await call('native_session_action', { sessionId: SID, action: 'press', target: 'DoesNotExist' });
    expect(res.isError).toBe(true);
    const p = parse(res);
    expect(p.success).toBe(false);
    expect(p.error).toBe('Element "DoesNotExist" not found');
    expect(p.hint).toBe('Use native_session_read with what="observe" to inspect actionable AX elements.');
    expect(Array.isArray(p.alternatives)).toBe(true);
  });

  it('successful action — exact success envelope (no error key, postAction present)', async () => {
    idx.extractMacOSElements.mockResolvedValue({
      window: windowInfo,
      elements: [macElement({ title: 'Save', path: [0] })],
    });
    act.performNativeAction.mockResolvedValue({ success: true, action: 'press' });
    const res = await call('native_session_action', {
      sessionId: SID, action: 'press', target: 'Save', waitTimeoutMs: 0,
    });
    expect(res.isError).not.toBe(true);
    const p = parse(res) as Record<string, unknown>;
    expect(p.success).toBe(true);
    expect(p.backend).toBe('macos-ax');
    expect(p.app).toBe('DemoApp');
    expect(p.pid).toBe(9999);
    expect(p.requestedAction).toBe('press');
    expect(p.axAction).toBe('press');
    expect(p.target).toBe('Save');
    expect(p.hostCursorAffected).toBe(false);
    expect('error' in p).toBe(false);
    expect(p.postAction).toBeDefined();
    expect(p).toHaveProperty('resolved');
    expect(p).toHaveProperty('confidence');
    expect(p).toHaveProperty('tier');
    expect(p).toHaveProperty('alternatives');
  });

  it('failed action — isError true, success:false, error surfaced', async () => {
    idx.extractMacOSElements.mockResolvedValue({
      window: windowInfo,
      elements: [macElement({ title: 'Save', path: [0] })],
    });
    act.performNativeAction.mockResolvedValue({ success: false, action: 'press', error: 'AX press failed' });
    const res = await call('native_session_action', { sessionId: SID, action: 'press', target: 'Save' });
    expect(res.isError).toBe(true);
    const p = parse(res);
    expect(p.success).toBe(false);
    expect(p.error).toBe('AX press failed');
    expect(p.postAction).toBeUndefined();
  });
});

describe('T-01g: cross-tool routes — web session_* on a native session', () => {
  const SID = 'golden-cross-macos';
  beforeEach(async () => {
    vi.clearAllMocks();
    await seed(SID, { driver: null, type: 'macos', app: 'DemoApp', pid: 9999, createdAt: Date.now() });
  });
  afterEach(async () => { await seed(SID, null); });

  it('web session_read routes to the native read path (identical envelope)', async () => {
    idx.extractMacOSElements.mockResolvedValue({
      window: windowInfo,
      elements: [macElement({ title: 'Save', path: [0] })],
    });
    const p = parse(await call('session_read', { sessionId: SID, what: 'state' }));
    expect(p).toEqual({
      type: 'macos',
      backend: 'macos-ax',
      app: 'DemoApp',
      pid: 9999,
      window: windowInfo,
      totalElements: 1,
      interactiveElements: 1,
      hostCursorAffected: false,
    });
  });

  it('web session_action routes to the native action path', async () => {
    idx.extractMacOSElements.mockResolvedValue({
      window: windowInfo,
      elements: [macElement({ title: 'Save', path: [0] })],
    });
    act.performNativeAction.mockResolvedValue({ success: true, action: 'press' });
    const p = parse(await call('session_action', { sessionId: SID, action: 'click', target: 'Save' }));
    expect(p.success).toBe(true);
    expect(p.backend).toBe('macos-ax');
    expect(p.requestedAction).toBe('click');
    expect(p.axAction).toBe('press');
  });

  it('web session_close on a native session returns the web close message', async () => {
    const res = await call('session_close', { sessionId: SID });
    expect(res.isError).not.toBe(true);
    expect(textOf(res)).toBe(`Session ${SID} closed.`);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Relocated native describe blocks (moved from session-tools.test.ts / tools.test.ts)
// Assertions UNWEAKENED — relocation only.
// ════════════════════════════════════════════════════════════════════════════

async function getTool(name: string) {
  const { TOOLS } = await import('./tools.js');
  return TOOLS.find((t) => t.name === name)!;
}

describe('native tool schemas (relocated from session-tools.test.ts)', () => {
  it('native_session_start schema includes app, pid, and simulator target fields', async () => {
    const tool = await getTool('native_session_start');
    const props = (tool.inputSchema.properties as Record<string, unknown>);
    for (const property of ['app', 'pid', 'simulator']) expect(props).toHaveProperty(property);
  });

  it('native_session_action supports cursor-free AX action verbs', async () => {
    const tool = await getTool('native_session_action');
    const props = tool.inputSchema.properties as Record<string, { enum?: string[] }>;
    expect(props.action.enum).toContain('showMenu');
    expect(props.action.enum).toContain('scrollToVisible');
    expect(tool.inputSchema.required).toEqual(['sessionId', 'action', 'target']);
  });

  it('native_session_start accepts a direct macOS pid and can close it', async () => {
    const start = await call('native_session_start', { pid: 12345 });
    expect(start.isError).not.toBe(true);
    const parsed = JSON.parse((start.content[0] as { text: string }).text) as {
      sessionId: string; pid: number; hostCursorAffected: boolean;
    };
    expect(parsed.pid).toBe(12345);
    expect(parsed.hostCursorAffected).toBe(false);

    const close = await call('native_session_close', { sessionId: parsed.sessionId });
    expect(close.isError).not.toBe(true);
  });
});

describe('R2: native_session_read schema defaults (relocated from tools.test.ts)', () => {
  it('native_session_read does NOT require `what` (defaults to observe)', async () => {
    const tool = await getTool('native_session_read');
    const required = (tool.inputSchema as { required?: string[] }).required ?? [];
    expect(required).toContain('sessionId');
    expect(required).not.toContain('what');
  });

  it('native_session_read `what` schema advertises default=observe', async () => {
    const tool = await getTool('native_session_read');
    const props = (tool.inputSchema as unknown as { properties: Record<string, { default?: string }> }).properties;
    expect(props.what.default).toBe('observe');
  });

  it('native_session_read description names observe as the default', async () => {
    const tool = await getTool('native_session_read');
    expect(tool.description).toMatch(/default/i);
    expect(tool.description).toMatch(/observe/);
  });
});

describe('native_session_action post-action settling schema (relocated from tools.test.ts)', () => {
  it('advertises waitFor and waitTimeoutMs without requiring them', async () => {
    const tool = await getTool('native_session_action');
    const required = (tool.inputSchema as { required?: string[] }).required ?? [];
    const props = (tool.inputSchema as unknown as { properties: Record<string, { type?: string }> }).properties;
    expect(props.waitFor.type).toBe('string');
    expect(props.waitTimeoutMs.type).toBe('number');
    expect(required).not.toContain('waitFor');
    expect(required).not.toContain('waitTimeoutMs');
  });
});
