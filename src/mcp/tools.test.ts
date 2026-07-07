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
