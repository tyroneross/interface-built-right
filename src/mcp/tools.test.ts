/**
 * MCP tools surface tests.
 *
 * Scope: schema-shape + helper-function contracts. We don't stand up a full
 * MCP server here — the goal is to catch regressions in the input contracts
 * the host LLM relies on.
 */

import { describe, it, expect } from 'vitest';
import { TOOLS } from './tools.js';

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

  it('native_session_read does NOT require `what` (defaults to observe)', () => {
    const tool = findTool('native_session_read');
    const required = (tool.inputSchema as { required?: string[] }).required ?? [];
    expect(required).toContain('sessionId');
    expect(required).not.toContain('what');
  });

  it('native_session_read `what` schema advertises default=observe', () => {
    const tool = findTool('native_session_read');
    const props = (tool.inputSchema as unknown as { properties: Record<string, { default?: string }> }).properties;
    expect(props.what.default).toBe('observe');
  });
});

describe('R2: session_read description mentions the default', () => {
  it('session_read description names observe as the default', () => {
    const tool = findTool('session_read');
    expect(tool.description).toMatch(/default/i);
    expect(tool.description).toMatch(/observe/);
  });

  it('native_session_read description names observe as the default', () => {
    const tool = findTool('native_session_read');
    expect(tool.description).toMatch(/default/i);
    expect(tool.description).toMatch(/observe/);
  });
});
