import type { ActionOutcome } from '../action-outcome.js';
import type { NativeBackend, NativeSessionTarget } from './backend.js';

export interface WindowResizeSpec { width?: number; height?: number; windowTitle?: string }
interface Frame { x: number; y: number; width: number; height: number }
export interface WindowResizeEvidence {
  pid: number; windowTitle: string; requested: { width: number; height: number };
  before: Frame; actual: Frame; tolerance: number;
}
function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
function frame(value: unknown): value is Frame {
  const v = object(value);
  return !!v && ['x', 'y', 'width', 'height'].every(k => typeof v[k] === 'number' && Number.isFinite(v[k])) && Number(v.width) > 0 && Number(v.height) > 0;
}
export async function runResizeWindowCapability(backend: NativeBackend, target: NativeSessionTarget, spec: WindowResizeSpec): Promise<ActionOutcome & { resizeWindow?: unknown }> {
  const expected = 'Exact session PID and unique AXWindow reach requested outer size within 0.5 points';
  const fail = (message: string, readback?: unknown): ActionOutcome & { resizeWindow?: unknown } => ({
    success: false, validator: { expected, observed: message, passed: false }, provenance: {},
    evidence: { beforeSignature: 'window-resize', afterSignature: JSON.stringify(readback ?? null), diff: message, alternatives: [] },
    ...(readback !== undefined ? { resizeWindow: readback } : {}),
  });
  if (target.kind !== 'macos') return fail('resizeWindow requires a macOS session; no action sent');
  if (![spec.width, spec.height].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 16384)
      || (spec.windowTitle !== undefined && typeof spec.windowTitle !== 'string')) return fail('width/height must be finite numbers in 1..16384; windowTitle must be a string; no action sent');
  try {
    const result = await backend.performAction(target, { action: 'resizeWindow', elementPath: [], value: JSON.stringify({ width: spec.width, height: spec.height, windowTitle: spec.windowTitle }) });
    const e = object(result.resizeWindow);
    const requested = object(e?.requested);
    const valid = e && e.pid === target.pid && typeof e.windowTitle === 'string'
      && (spec.windowTitle === undefined || e.windowTitle === spec.windowTitle)
      && requested?.width === spec.width && requested?.height === spec.height
      && e.tolerance === 0.5 && frame(e.before) && frame(e.actual);
    if (result.success !== true || result.action !== 'resizeWindow') return fail(result.error ?? 'Resize failed or returned an invalid result envelope', result.resizeWindow);
    if (!valid) return fail('Resize returned missing or mismatched measured evidence', result.resizeWindow);
    const actual = e.actual as Frame;
    if (Math.abs(actual.width - spec.width!) > 0.5 || Math.abs(actual.height - spec.height!) > 0.5) return fail('Measured size differs from requested size; app may have clamped it', e);
    return { success: true, validator: { expected, observed: JSON.stringify(e), passed: true }, provenance: { waitResult: 'same-AXWindow-readback' }, resizeWindow: e };
  } catch (error) { return fail(`Resize outcome uncertain; inspect before another action: ${String(error)}`); }
}
