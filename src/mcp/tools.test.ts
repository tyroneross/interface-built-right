/**
 * MCP tools surface tests.
 *
 * Scope: schema-shape + helper-function contracts. We don't stand up a full
 * MCP server here — the goal is to catch regressions in the input contracts
 * the host LLM relies on.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { TOOLS } from './tools.js';

// f2-A: top-level mocks for the dynamic imports handleAsk performs.
// `vi.hoisted` lets us share the spy between the mock factory (which vitest
// hoists above all imports) and the assertion code further down. The
// `import('vitest')` inside `vi.hoisted` is required because the outer `vi`
// import is itself hoisted-out-of-order by Vitest; calling `vi.fn` inside the
// factory directly would race the import resolution.
type F2aAskArgs = [string, string, Record<string, unknown>];
const f2aHoist = vi.hoisted(async () => {
  const { vi: viInner } = await import('vitest');
  const askSpy = viInner.fn<(...args: F2aAskArgs) => Promise<unknown>>(
    async () => ({
      verdict: 'PASS',
      findings: [],
      evidence: {},
      meta: {},
    }),
  );
  return { askSpy };
});

vi.mock('../ask.js', () => ({
  ask: async (url: string, question: string, opts: Record<string, unknown>) => {
    const h = await f2aHoist;
    return h.askSpy(url, question, opts);
  },
}));

vi.mock('../engine/browser-pool.js', () => ({
  BrowserPool: class StubBrowserPool {
    constructor(_opts: unknown) {}
  },
}));

function findTool(name: string) {
  const t = TOOLS.find((tool) => tool.name === name);
  if (!t) throw new Error(`Tool not found: ${name}`);
  return t;
}

describe('R2: session_read schema defaults', () => {
  it('session_read does NOT require `what` (defaults to observe)', () => {
    const tool = findTool('session_read');
    const required = (tool.inputSchema as { required?: string[] }).required ?? [];
    expect(required).toContain('sessionId');
    expect(required).not.toContain('what');
  });

  it('session_read `what` schema advertises default=observe', () => {
    const tool = findTool('session_read');
    const props = (tool.inputSchema as unknown as { properties: Record<string, { default?: string }> }).properties;
    expect(props.what.default).toBe('observe');
  });

  // native_session_read schema-default tests relocated to
  // src/mcp/native-tools.test.ts (C0).
});

// native_session_action post-action settling schema test relocated to
// src/mcp/native-tools.test.ts (C0).

describe('R2: session_read description mentions the default', () => {
  it('session_read description names observe as the default', () => {
    const tool = findTool('session_read');
    expect(tool.description).toMatch(/default/i);
    expect(tool.description).toMatch(/observe/);
  });

  // native_session_read description test relocated to
  // src/mcp/native-tools.test.ts (C0).
});

// ─── f5: normalizeReadMode must lowercase its input ──────────────────────────

describe('f5: normalizeReadMode lowercases input', () => {
  let normalizeReadMode: (what: unknown) => string;

  beforeAll(async () => {
    const mod = await import('./tools.js');
    normalizeReadMode = (mod as unknown as { normalizeReadMode: (what: unknown) => string }).normalizeReadMode;
  });

  it('normalizeReadMode("Observe") returns "observe"', () => {
    expect(normalizeReadMode('Observe')).toBe('observe');
  });

  it('normalizeReadMode("EXTRACT") returns "extract"', () => {
    expect(normalizeReadMode('EXTRACT')).toBe('extract');
  });

  it('normalizeReadMode("state") stays "state" (already lowercase)', () => {
    expect(normalizeReadMode('state')).toBe('state');
  });

  it('normalizeReadMode("") returns "observe" (empty string default)', () => {
    expect(normalizeReadMode('')).toBe('observe');
  });

  it('normalizeReadMode(undefined) returns "observe"', () => {
    expect(normalizeReadMode(undefined)).toBe('observe');
  });
});

// ─── f2-A: handleAsk must not forward `cookies: []` when session has no cookies ──
//
// Parity gate with the CLI guard (src/bin/ibr.ts ~1095) and with handleAsk's
// own intent (src/mcp/tools.ts ~2599-2623): when the resolved session-cookie
// list is empty, the AskOptions passed to ask() MUST NOT include a `cookies`
// key. Today the engine's `cookies && cookies.length > 0` guard in askStream
// absorbs the empty array — but byte-consistency with the CLI path requires
// askCookies stays undefined so the spread `...(askCookies ? { cookies } : {})`
// never injects the key.
//
// This test exercises the handleAsk path via handleToolCall (the exported
// entry) and a test-seam that seeds the in-memory session map.

describe('f2-A: handleAsk omits cookies key when session has none', () => {
  it('does NOT pass a `cookies` key to ask() when getCookies() returns []', async () => {
    const { askSpy } = await f2aHoist;
    askSpy.mockClear();

    const mod = await import('./tools.js');
    const handleToolCall = (mod as unknown as {
      handleToolCall: (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<unknown>;
    }).handleToolCall;
    const setSession = (mod as unknown as {
      __test_setSession: (id: string, entry: unknown) => void;
    }).__test_setSession;

    const sessionId = 'f2a-test-empty-cookies';

    // Seed a session whose driver returns ZERO cookies — the exact case the
    // guard must protect.
    setSession(sessionId, {
      driver: {
        getCookies: async () => [] as unknown[],
      },
      type: 'chrome',
      url: 'https://example.com',
      createdAt: Date.now(),
    });

    try {
      await handleToolCall('ask', {
        url: 'https://example.com',
        question: 'touch-target',
        sessionId,
      });
    } finally {
      setSession(sessionId, null);
    }

    // ask() was reached
    expect(askSpy).toHaveBeenCalledTimes(1);

    // Third arg is the AskOptions object — `cookies` must NOT be a key.
    const opts = askSpy.mock.calls[0][2] as Record<string, unknown>;
    expect(opts).toBeDefined();
    expect('cookies' in opts).toBe(false);
  });
});

// ─── E3-C2: flow_form/flow_login must honor an advertised sessionId ─────────
//
// Both tools' schemas advertise `sessionId` (tools.ts:791/812) but the
// handlers ignored it — they always `new EngineDriver()` + `.launch()`ed a
// fresh browser and `.close()`d it in `finally`, even when a valid session
// was supplied. This blocks multi-step authed flows (e.g. log in via
// session_start, then flow_form against the same session).
//
// These tests seed a fake session driver via the `__test_setSession` seam and
// spy on `EngineDriver.prototype.{launch,close,navigate,querySelector,
// evaluate}` so no real browser is ever spawned, regardless of whether the
// handler under test launches a fresh driver (the bug) or reuses the session
// driver (the fix). The differentiators: the *class-level* launch/close spies
// must see zero calls (no fresh driver instantiated), and the *session's own*
// driver stub must see its `navigate` called (proof of reuse) and its `close`
// never called (a borrowed driver must outlive the tool call).

describe('E3-C2: flow_form/flow_login honor sessionId (no relaunch, no borrowed-session close)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function stubSessionDriver() {
    return {
      navigate: vi.fn(async () => {}),
      querySelector: vi.fn(async () => null),
      evaluate: vi.fn(async () => null),
      close: vi.fn(async () => {}),
      get currentUrl() {
        return 'https://example.com/after';
      },
    };
  }

  async function spyOnFreshDriverLifecycle() {
    const { EngineDriver } = await import('../engine/driver.js');
    const launchSpy = vi.spyOn(EngineDriver.prototype, 'launch').mockResolvedValue(undefined);
    const closeSpy = vi.spyOn(EngineDriver.prototype, 'close').mockResolvedValue(undefined);
    vi.spyOn(EngineDriver.prototype, 'navigate').mockResolvedValue(undefined);
    vi.spyOn(EngineDriver.prototype, 'querySelector').mockResolvedValue(null);
    vi.spyOn(EngineDriver.prototype, 'evaluate').mockResolvedValue(null);
    return { launchSpy, closeSpy };
  }

  it('flow_form reuses the session driver: no relaunch, no borrowed-session close', async () => {
    const { launchSpy, closeSpy } = await spyOnFreshDriverLifecycle();

    const mod = await import('./tools.js');
    const handleToolCall = (mod as unknown as {
      handleToolCall: (name: string, args: Record<string, unknown>) => Promise<unknown>;
    }).handleToolCall;
    const setSession = (mod as unknown as {
      __test_setSession: (id: string, entry: unknown) => void;
    }).__test_setSession;

    const sessionId = 'e3c2-flow-form-session';
    const stub = stubSessionDriver();
    setSession(sessionId, { driver: stub, type: 'chrome', url: 'https://example.com', createdAt: Date.now() });

    try {
      await handleToolCall('flow_form', {
        url: 'https://example.com/form',
        fields: { Email: 'person@example.com' },
        sessionId,
      });
    } finally {
      setSession(sessionId, null);
    }

    expect(launchSpy).not.toHaveBeenCalled();
    expect(closeSpy).not.toHaveBeenCalled();
    expect(stub.close).not.toHaveBeenCalled();
    expect(stub.navigate).toHaveBeenCalledWith('https://example.com/form');
  });

  it('flow_login reuses the session driver: no relaunch, no borrowed-session close', async () => {
    const { launchSpy, closeSpy } = await spyOnFreshDriverLifecycle();

    const mod = await import('./tools.js');
    const handleToolCall = (mod as unknown as {
      handleToolCall: (name: string, args: Record<string, unknown>) => Promise<unknown>;
    }).handleToolCall;
    const setSession = (mod as unknown as {
      __test_setSession: (id: string, entry: unknown) => void;
    }).__test_setSession;

    const sessionId = 'e3c2-flow-login-session';
    const stub = stubSessionDriver();
    setSession(sessionId, { driver: stub, type: 'chrome', url: 'https://example.com', createdAt: Date.now() });

    try {
      await handleToolCall('flow_login', {
        url: 'https://example.com/login',
        username: 'person@example.com',
        password: 'secret',
        sessionId,
      });
    } finally {
      setSession(sessionId, null);
    }

    expect(launchSpy).not.toHaveBeenCalled();
    expect(closeSpy).not.toHaveBeenCalled();
    expect(stub.close).not.toHaveBeenCalled();
    expect(stub.navigate).toHaveBeenCalledWith('https://example.com/login');
  });
});

// ─── E3-E: web verify-then-proceed (T-09) ────────────────────────────────
//
// `session_action`/`interact` used to return `success: true` unconditionally
// — the underlying CDP call not throwing was treated as "success" even when
// a click was a no-op. These tests exercise the fix via the `__test_setSession`
// seam: a fully-stubbed driver lets us control before/after state precisely
// (no real browser), which is exactly what's needed to prove a NO-OP is
// detected (identical before/after) vs a REAL change (elements/value differ).

type StubElement = {
  id: string;
  role: string;
  label: string;
  value: string | null;
  enabled: boolean;
  focused: boolean;
  actions: string[];
  bounds: [number, number, number, number];
  parent: string | null;
};

function makeStubElement(overrides: Partial<StubElement> & { id: string }): StubElement {
  return {
    role: 'button',
    label: 'Submit',
    value: null,
    enabled: true,
    focused: false,
    actions: ['click'],
    bounds: [0, 0, 10, 10],
    parent: null,
    ...overrides,
  };
}

type CapturedActionStub = {
  before: { elements: StubElement[]; screenshot: Buffer };
  after: { elements: StubElement[]; screenshot: Buffer };
  diff: { addedElements: StubElement[]; removedElements: StubElement[]; pixelDiff: number };
};

function makeActAndCaptureStub(result: CapturedActionStub) {
  return vi.fn(async (fn: () => Promise<void>) => {
    await fn();
    return result;
  });
}

async function getHandleToolCall() {
  const mod = await import('./tools.js');
  return (mod as unknown as {
    handleToolCall: (name: string, args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text?: string; data?: string }>; isError?: boolean }>;
  }).handleToolCall;
}

async function getSetSession() {
  const mod = await import('./tools.js');
  return (mod as unknown as {
    __test_setSession: (id: string, entry: unknown) => void;
  }).__test_setSession;
}

function jsonOf(result: { content: Array<{ type: string; text?: string }> }): Record<string, unknown> {
  const textPart = result.content.find((c) => c.type === 'text');
  if (!textPart?.text) throw new Error('No text content in response');
  return JSON.parse(textPart.text);
}

describe('E3-E: session_action verify-then-proceed (T-09)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falsifier: a click that changes nothing returns success:false + evidence {before/after diff, ranked alternatives, screenshot}', async () => {
    const handleToolCall = await getHandleToolCall();
    const setSession = await getSetSession();

    const target = makeStubElement({ id: 'el-submit', label: 'Submit' });
    const other = makeStubElement({ id: 'el-cancel', label: 'Cancel', role: 'link' });
    const screenshot = Buffer.from('fake-png-bytes');

    const stub = {
      url: 'https://example.com/page',
      findWithDiagnostics: vi.fn(async () => ({
        elementId: 'el-submit',
        confidence: 0.95,
        tier: 2,
        tierName: 'queryAXTree',
        alternatives: [],
        totalInteractive: 2,
      })),
      getSnapshot: vi.fn(async () => [target, other]),
      // NO-OP: before and after are byte-identical — nothing added/removed,
      // zero pixel diff, same URL.
      actAndCapture: makeActAndCaptureStub({
        before: { elements: [target, other], screenshot },
        after: { elements: [target, other], screenshot },
        diff: { addedElements: [], removedElements: [], pixelDiff: 0 },
      }),
      click: vi.fn(async () => {}),
    };

    const sessionId = 'e3e-noop-click';
    setSession(sessionId, { driver: stub, type: 'chrome', url: stub.url, createdAt: Date.now() });

    let result;
    try {
      result = await handleToolCall('session_action', { sessionId, action: 'click', target: 'Submit' });
    } finally {
      setSession(sessionId, null);
    }

    const parsed = jsonOf(result);
    expect(parsed.success).toBe(false);
    expect((parsed.validator as { passed: boolean }).passed).toBe(false);

    const evidence = parsed.evidence as {
      beforeSignature: string; afterSignature: string; diff: string;
      alternatives: unknown[]; screenshotB64: string;
    };
    expect(evidence).toBeDefined();
    expect(typeof evidence.beforeSignature).toBe('string');
    expect(typeof evidence.afterSignature).toBe('string');
    expect(evidence.diff).toMatch(/0 element\(s\) added/);
    expect(evidence.diff).toMatch(/0 element\(s\) removed/);
    expect(Array.isArray(evidence.alternatives)).toBe(true);
    expect(evidence.screenshotB64).toBe(screenshot.toString('base64'));

    // Provenance preserved (tier/confidence), not stripped.
    const provenance = parsed.provenance as { tier: string; confidence: number };
    expect(provenance.tier).toBe('queryAXTree');
    expect(provenance.confidence).toBe(0.95);

    expect(stub.click).toHaveBeenCalledTimes(1);
  });

  it('a click that adds an element returns success:true with no evidence key', async () => {
    const handleToolCall = await getHandleToolCall();
    const setSession = await getSetSession();

    const target = makeStubElement({ id: 'el-submit', label: 'Submit' });
    const newModal = makeStubElement({ id: 'el-modal', label: 'Confirmation', role: 'dialog', actions: [] });
    const screenshot = Buffer.from('fake-png-bytes');

    const stub = {
      url: 'https://example.com/page',
      findWithDiagnostics: vi.fn(async () => ({
        elementId: 'el-submit',
        confidence: 1,
        tier: 2,
        tierName: 'queryAXTree',
        alternatives: [],
        totalInteractive: 1,
      })),
      getSnapshot: vi.fn(async () => [target]),
      actAndCapture: makeActAndCaptureStub({
        before: { elements: [target], screenshot },
        after: { elements: [target, newModal], screenshot },
        diff: { addedElements: [newModal], removedElements: [], pixelDiff: 12 },
      }),
      click: vi.fn(async () => {}),
    };

    const sessionId = 'e3e-real-click';
    setSession(sessionId, { driver: stub, type: 'chrome', url: stub.url, createdAt: Date.now() });

    let result;
    try {
      result = await handleToolCall('session_action', { sessionId, action: 'click', target: 'Submit' });
    } finally {
      setSession(sessionId, null);
    }

    const parsed = jsonOf(result);
    expect(parsed.success).toBe(true);
    expect((parsed.validator as { passed: boolean }).passed).toBe(true);
    expect(parsed.evidence).toBeUndefined();
  });

  it('preserves autoResolved provenance on the wire (never stripped)', async () => {
    const handleToolCall = await getHandleToolCall();
    const setSession = await getSetSession();

    const target = makeStubElement({ id: 'el-submit', label: 'Submit' });
    const screenshot = Buffer.from('fake-png-bytes');

    const stub = {
      url: 'https://example.com/page',
      findWithDiagnostics: vi.fn(async () => ({
        elementId: 'el-submit',
        confidence: 0.83,
        tier: 4,
        tierName: 'auto-resolve',
        alternatives: [{ name: 'Submit', role: 'button', score: 0.83 }],
        totalInteractive: 1,
        autoResolved: { label: 'Submit', role: 'button', score: 0.83, margin: 0.2 },
      })),
      getSnapshot: vi.fn(async () => [target]),
      actAndCapture: makeActAndCaptureStub({
        before: { elements: [target], screenshot },
        after: { elements: [{ ...target, focused: true }], screenshot },
        diff: { addedElements: [], removedElements: [], pixelDiff: 0 },
      }),
      click: vi.fn(async () => {}),
    };

    const sessionId = 'e3e-autoresolve';
    setSession(sessionId, { driver: stub, type: 'chrome', url: stub.url, createdAt: Date.now() });

    let result;
    try {
      result = await handleToolCall('session_action', { sessionId, action: 'click', target: 'Sbmit' });
    } finally {
      setSession(sessionId, null);
    }

    const parsed = jsonOf(result);
    expect(parsed.autoResolved).toBeDefined();
    expect((parsed.autoResolved as { chosen: string }).chosen).toBe('Submit');
  });

  it('a no-op click on an unresolved target still returns success:false + evidence (not-found leg)', async () => {
    const handleToolCall = await getHandleToolCall();
    const setSession = await getSetSession();

    const other = makeStubElement({ id: 'el-cancel', label: 'Cancel', role: 'link' });
    const screenshot64 = Buffer.from('fake-png-bytes').toString('base64');

    const stub = {
      url: 'https://example.com/page',
      findWithDiagnostics: vi.fn(async () => ({
        elementId: null,
        confidence: 0,
        tier: 4,
        tierName: 'vision',
        alternatives: [{ name: 'Cancel', role: 'link', score: 0.4 }],
        totalInteractive: 1,
        screenshot: screenshot64,
      })),
      getSnapshot: vi.fn(async () => [other]),
      actAndCapture: vi.fn(),
      click: vi.fn(async () => {}),
    };

    const sessionId = 'e3e-not-found';
    setSession(sessionId, { driver: stub, type: 'chrome', url: stub.url, createdAt: Date.now() });

    let result;
    try {
      result = await handleToolCall('session_action', { sessionId, action: 'click', target: 'Submit' });
    } finally {
      setSession(sessionId, null);
    }

    const parsed = jsonOf(result);
    expect(parsed.success).toBe(false);
    expect((parsed.validator as { passed: boolean }).passed).toBe(false);
    expect((parsed.evidence as { alternatives: unknown[] }).alternatives.length).toBe(1);
    expect(stub.actAndCapture).not.toHaveBeenCalled();
  });
});

// ─── E3-E: interact (ephemeral-driver) verify-then-proceed (T-09) ────────

describe('E3-E: interact verify-then-proceed (T-09)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('a click that changes nothing returns success:false + evidence via the `interact` tool', async () => {
    const { EngineDriver } = await import('../engine/driver.js');
    const handleToolCall = await getHandleToolCall();

    const target = makeStubElement({ id: 'el-submit', label: 'Submit' });
    const screenshot = Buffer.from('fake-png-bytes');

    vi.spyOn(EngineDriver.prototype, 'launch').mockResolvedValue(undefined);
    vi.spyOn(EngineDriver.prototype, 'navigate').mockResolvedValue(undefined);
    vi.spyOn(EngineDriver.prototype, 'close').mockResolvedValue(undefined);
    vi.spyOn(EngineDriver.prototype, 'url', 'get').mockReturnValue('https://example.com/page');
    vi.spyOn(EngineDriver.prototype, 'findWithDiagnostics').mockResolvedValue({
      elementId: 'el-submit',
      confidence: 0.95,
      tier: 2,
      tierName: 'queryAXTree',
      alternatives: [],
      totalInteractive: 1,
    } as unknown as Awaited<ReturnType<InstanceType<typeof EngineDriver>['findWithDiagnostics']>>);
    vi.spyOn(EngineDriver.prototype, 'getSnapshot').mockResolvedValue([target] as unknown as Awaited<ReturnType<InstanceType<typeof EngineDriver>['getSnapshot']>>);
    const clickSpy = vi.spyOn(EngineDriver.prototype, 'click').mockResolvedValue(undefined);
    vi.spyOn(EngineDriver.prototype, 'actAndCapture').mockImplementation(async (fn: () => Promise<void>) => {
      await fn();
      return {
        before: { elements: [target], screenshot },
        after: { elements: [target], screenshot },
        diff: { addedElements: [], removedElements: [], pixelDiff: 0 },
      };
    });

    const result = await handleToolCall('interact', {
      url: 'https://example.com/page',
      action: 'click',
      target: 'Submit',
    });

    const parsed = jsonOf(result as { content: Array<{ type: string; text?: string }> });
    expect(parsed.success).toBe(false);
    expect((parsed.validator as { passed: boolean }).passed).toBe(false);
    expect(parsed.evidence).toBeDefined();
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});

// ─── E3-E: fixed 500ms sleeps removed from the verified action paths ────

describe('E3-E: no fixed 500ms sleeps on the verified interact/session_action paths', () => {
  it('the element-targeted interact/session_action handlers no longer sleep a fixed 500ms', async () => {
    const fs = await import('fs');
    const src = fs.readFileSync('src/mcp/tools.ts', 'utf8');
    expect(src).not.toMatch(/setTimeout\(r,\s*500\)/);
  });
});
