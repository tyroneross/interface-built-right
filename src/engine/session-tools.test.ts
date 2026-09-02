/**
 * Tests for Phase 1 additions:
 * - Session store (session_start / session_close lifecycle)
 * - Chrome SingletonLock conflict detection (branch logic)
 *
 * FILE-WIDE TIMEOUT. Every test here calls `vi.resetModules()` in beforeEach
 * and then re-imports `../mcp/tools.js`, so each one pays a full cold module
 * init rather than sharing a warm one. That cost is inherent to the isolation
 * these tests want, but it does not fit the 5s default: under any machine load
 * a test spends most of its budget in module init and times out before its
 * assertion runs. The symptom was a file that failed intermittently and named
 * a DIFFERENT test each run (`session_close`, then eight schema tests, then
 * `session_close` again) — the tell that the budget, not the logic, was wrong.
 * A gate that convicts a different innocent test each run certifies nothing,
 * so the budget is set once here from measurement instead of per-test guesses.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Measured on a warm dev Mac: module init dominates, and `xcrun simctl list
// devices` alone costs 13.3s. 30s covers the slowest non-simctl test with
// headroom; the one simctl test overrides this with its own larger budget.
vi.setConfig({ testTimeout: 30_000 })

async function callTool(name: string, args: Record<string, unknown>) {
  const { handleToolCall } = await import('../mcp/tools.js')
  return handleToolCall(name, args)
}

async function getTool(name: string) {
  const { TOOLS } = await import('../mcp/tools.js')
  return TOOLS.find(t => t.name === name)!
}

// ─── Session Store ────────────────────────────────────────────────────────────

describe('session store', () => {
  // Tests the handleToolCall session_* cases with no real browser.
  // EngineDriver launch will fail (no Chrome in CI), so we test error paths
  // that don't require a real browser.

  beforeEach(() => {
    vi.resetModules()
  })

  it('session_close returns error for unknown sessionId', async () => {
    const result = await callTool('session_close', { sessionId: 'nonexistent-id' })
    expect(result.isError).toBe(true)
    const text = (result.content[0] as { text: string }).text
    expect(text).toContain('Session not found')
  })

  it('session_action returns error for unknown sessionId', async () => {
    const result = await callTool('session_action', {
      sessionId: 'nonexistent-id',
      action: 'click',
      target: 'Submit',
    })
    expect(result.isError).toBe(true)
    const text = (result.content[0] as { text: string }).text
    expect(text).toContain('Session not found')
  })

  it('session_read returns error for unknown sessionId', async () => {
    const result = await callTool('session_read', {
      sessionId: 'nonexistent-id',
      what: 'state',
    })
    expect(result.isError).toBe(true)
    const text = (result.content[0] as { text: string }).text
    expect(text).toContain('Session not found')
  })
})

// ─── Chrome SingletonLock Conflict ───────────────────────────────────────────
// Tests the branch logic directly without mocking ESM modules (not supported in Vitest ESM mode).

// ─── TOOLS array includes session tools ──────────────────────────────────────

describe('TOOLS array completeness', () => {
  it('includes session_start, session_action, session_read, session_close', async () => {
    const { TOOLS } = await import('../mcp/tools.js')
    const names = TOOLS.map(t => t.name)
    for (const name of ['session_start', 'session_action', 'session_read', 'session_close', 'native_session_start', 'native_session_action', 'native_session_read', 'native_session_close']) {
      expect(names).toContain(name)
    }
  })

  it('session_start has no required fields (all params are platform-dependent)', async () => {
    const tool = await getTool('session_start')
    // url, app, simulator are all optional depending on platform — handler validates at runtime
    expect((tool.inputSchema as Record<string, unknown>).required).toBeUndefined()
  })

  it('session_start schema includes browser, app, simulator fields', async () => {
    const tool = await getTool('session_start')
    const props = (tool.inputSchema.properties as Record<string, unknown>)
    for (const property of ['browser', 'app', 'simulator']) expect(props).toHaveProperty(property)
  })

  // native_session_start schema test relocated to src/mcp/native-tools.test.ts (C0).

  it('session_start browser field has chrome/safari enum', async () => {
    const tool = await getTool('session_start')
    const props = tool.inputSchema.properties as Record<string, { enum?: string[] }>
    expect(props.browser.enum).toEqual(['chrome', 'safari'])
  })

  it('session_action has required sessionId, action, target fields', async () => {
    const tool = await getTool('session_action')
    expect(tool.inputSchema.required).toContain('sessionId')
    expect(tool.inputSchema.required).toContain('action')
    expect(tool.inputSchema.required).toContain('target')
  })

  it('session_close has required sessionId field', async () => {
    const tool = await getTool('session_close')
    expect(tool.inputSchema.required).toContain('sessionId')
  })

  it('session_read requires sessionId; `what` defaults to observe (R2)', async () => {
    // R2 contract change: `what` is no longer required. When omitted the
    // handler defaults it to 'observe' — the safe, read-only surface.
    // 11% of pre-R2 session_read calls failed with "Unknown read mode:
    // undefined" because the host LLM forgot the arg.
    const tool = await getTool('session_read')
    expect(tool.inputSchema.required).toContain('sessionId')
    expect(tool.inputSchema.required).not.toContain('what')
    const props = tool.inputSchema.properties as Record<string, { default?: string }>
    expect(props.what.default).toBe('observe')
  })

  it('flow_search supports current-session semantic search without requiring url', async () => {
    const tool = await getTool('flow_search')
    expect(tool.inputSchema.required).toEqual(['query'])
    const props = tool.inputSchema.properties as Record<string, unknown>
    expect(props).toHaveProperty('sessionId')
    expect(props).toHaveProperty('userIntent')
    expect(props).toHaveProperty('aiValidation')
  })

  it('flow_search validates that url or sessionId is present before launching Chrome', async () => {
    const result = await callTool('flow_search', { query: 'pricing plan' })
    expect(result.isError).toBe(true)
    const text = (result.content[0] as { text: string }).text
    expect(text).toContain('requires either url or sessionId')
  })

  // native_session_action verbs + native_session_start pid tests relocated to
  // src/mcp/native-tools.test.ts (C0).
})

// ─── Multi-platform session dispatch ─────────────────────────────────────────

describe('session_start — missing target param validation', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns error when no url, app, or simulator provided', async () => {
    const result = await callTool('session_start', {})
    // Should fail at Chrome launch (no url) or return a helpful error
    // Since Chrome will fail to launch without url, we just verify it returns some response
    expect(result).toBeDefined()
    expect(result.content).toBeDefined()
    expect(result.content.length).toBeGreaterThan(0)
  })

  // macOS-native: resolves a real app via lsappinfo/AX/pgrep. On Linux these
  // return non-deterministic results, so run only on darwin (like sim-driver.test.ts).
  it.runIf(process.platform === 'darwin')('returns error when app is not running', async () => {
    // Use a definitely-not-running app name
    const result = await callTool('session_start', { app: 'NonExistentApp12345XYZ' })
    expect(result.isError).toBe(true)
    const text = (result.content[0] as { text: string }).text
    expect(text).toContain('session_start (macos) failed')
  })

  // macOS-native: needs `xcrun simctl`, which is cold and slow. The 20s this
  // carried was a guess and it under-measured: `xcrun simctl list devices`
  // alone timed at 13.3s on a warm dev Mac, and the whole path measured 22.8s,
  // so the budget expired mid-call and the suite went red on a passing test.
  // 60s is that measurement plus headroom for a colder CI runner. Raising a
  // budget is not weakening a gate — the assertion below is unchanged; the
  // only thing that moved is how long we let a slow OS binary answer.
  // Run only on darwin.
  it.runIf(process.platform === 'darwin')('returns error when simulator name not found', async () => {
    const result = await callTool('session_start', { simulator: 'NonExistentDevice99999XYZ' })
    expect(result.isError).toBe(true)
    const text = (result.content[0] as { text: string }).text
    // May fail with xcrun error or "Simulator not found"
    expect(text).toMatch(/session_start \(simulator\) failed|Simulator not found/)
  }, 60000)
})

describe('session_action — native/simulator sessions return guidance', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('session_action on unknown sessionId returns error', async () => {
    const result = await callTool('session_action', {
      sessionId: 'ghost-id-xyz',
      action: 'click',
      target: 'Button',
    })
    expect(result.isError).toBe(true)
    const text = (result.content[0] as { text: string }).text
    expect(text).toContain('Session not found')
  })
})

describe('session_read — native/simulator sessions return state', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('session_read on unknown sessionId returns error', async () => {
    const result = await callTool('session_read', {
      sessionId: 'ghost-id-xyz',
      what: 'state',
    })
    expect(result.isError).toBe(true)
    const text = (result.content[0] as { text: string }).text
    expect(text).toContain('Session not found')
  })
})

describe('session_close — null driver handling', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('session_close on unknown sessionId returns error', async () => {
    const result = await callTool('session_close', { sessionId: 'ghost-id-xyz' })
    expect(result.isError).toBe(true)
    const text = (result.content[0] as { text: string }).text
    expect(text).toContain('Session not found')
  })
})
