import { describe, it, expect, vi } from 'vitest';
import { runResizeWindowCapability } from './window-resize.js';
import type { NativeBackend } from './backend.js';
const bounds = { x: 100, y: 200, width: 900, height: 650 };
function setup(overrides: Record<string, unknown> = {}) {
  const evidence = { pid: 42, windowTitle: '', requested: { width: 900, height: 650 }, before: bounds, actual: bounds, tolerance: 0.5, ...overrides };
  const performAction = vi.fn().mockResolvedValue({ success: true, action: 'resizeWindow', resizeWindow: evidence });
  return { backend: { performAction } as unknown as NativeBackend, performAction, evidence };
}
const target = { kind: 'macos', pid: 42 } as const;
const spec = { width: 900, height: 650, windowTitle: '' };
describe('measured exact-window resize', () => {
  it('preserves an explicit empty title and returns structured readback', async () => {
    const { backend, performAction, evidence } = setup();
    const result = await runResizeWindowCapability(backend, target, spec);
    expect(result.validator.passed).toBe(true);
    expect(result.resizeWindow).toEqual(evidence);
    expect(JSON.parse(performAction.mock.calls[0][1].value)).toEqual(spec);
  });
  it.each([NaN, Infinity, 0, -1, 16385, '900', null])('rejects invalid dimensions %s before mutation', async width => {
    const { backend, performAction } = setup();
    expect((await runResizeWindowCapability(backend, target, { ...spec, width: width as number })).success).toBe(false);
    expect(performAction).not.toHaveBeenCalled();
  });
  it('rejects simulator sessions before mutation', async () => {
    const { backend, performAction } = setup();
    const result = await runResizeWindowCapability(backend, { kind: 'simulator', device: { udid: 'x', name: 'x' } }, spec);
    expect(result.success).toBe(false); expect(performAction).not.toHaveBeenCalled();
  });
  it.each([{ pid: 7 }, { windowTitle: 'wrong' }, { requested: { width: 901, height: 650 } }, { before: null }, { actual: { ...bounds, width: NaN } }, { tolerance: 10 }])('rejects mismatched or malformed evidence %j', async evidence => {
    const { backend } = setup(evidence);
    expect((await runResizeWindowCapability(backend, target, spec)).validator.passed).toBe(false);
  });
  it('rejects clamping even when the backend reports success', async () => {
    const { backend } = setup({ actual: { ...bounds, width: 820 } });
    const result = await runResizeWindowCapability(backend, target, spec);
    expect(result.success).toBe(false); expect(result.validator.observed).toMatch(/clamped/);
    expect(result.resizeWindow).toBeDefined();
  });
  it.each([{ success: 'false' }, { action: 'other' }])('rejects a malformed result envelope %j', async malformed => {
    const { backend, performAction, evidence } = setup();
    performAction.mockResolvedValue({ success: true, action: 'resizeWindow', resizeWindow: evidence, ...malformed });
    expect((await runResizeWindowCapability(backend, target, spec)).validator.passed).toBe(false);
  });
  it('preserves failure readback', async () => {
    const { backend, performAction, evidence } = setup();
    performAction.mockResolvedValue({ success: false, error: 'clamped', resizeWindow: evidence });
    const result = await runResizeWindowCapability(backend, target, spec);
    expect(result.success).toBe(false); expect(result.resizeWindow).toEqual(evidence);
  });
});
