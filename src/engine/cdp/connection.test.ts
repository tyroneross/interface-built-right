import { describe, it, expect, afterEach, vi } from 'vitest';

describe('loadWebSocketCtor', () => {
  const original = (globalThis as { WebSocket?: unknown }).WebSocket;

  afterEach(() => {
    (globalThis as { WebSocket?: unknown }).WebSocket = original;
    vi.resetModules();
  });

  it('returns the ws package WebSocket when the global is undefined', async () => {
    delete (globalThis as { WebSocket?: unknown }).WebSocket;
    vi.resetModules();
    const { loadWebSocketCtor } = await import('./connection.js');
    const ws = await import('ws');
    expect(await loadWebSocketCtor()).toBe(ws.WebSocket);
  });

  it('returns the global WebSocket when present', async () => {
    class FakeWebSocket {}
    (globalThis as { WebSocket?: unknown }).WebSocket = FakeWebSocket;
    vi.resetModules();
    const { loadWebSocketCtor } = await import('./connection.js');
    expect(await loadWebSocketCtor()).toBe(FakeWebSocket);
  });
});
