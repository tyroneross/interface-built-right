import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { MacOSScanResult } from './native/types.js';

/** Evidence is append-only and private; compact output must never replace it. */
export async function saveNativeReport(payload: unknown, directory: string): Promise<string> {
  const path = resolve(directory, `native-${randomUUID()}.json`);
  await mkdir(resolve(directory), { recursive: true });
  await writeFile(path, JSON.stringify(payload), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  return path;
}

export function compactNativeScanReport(result: MacOSScanResult, fullReport: string) {
  if (!fullReport) throw new Error('Compact output requires saved full evidence');
  return {
    schema: 'ibr.native.scan.compact/v1', fullReport,
    url: result.url, timestamp: result.timestamp, viewport: result.viewport,
    verdict: result.verdict, summary: result.summary,
    issues: result.issues, console: result.console,
    semantic: result.semantic ? { verdict: result.semantic.verdict, issues: result.semantic.issues, state: result.semantic.state, pageIntent: result.semantic.pageIntent } : undefined,
    visualCoverage: result.visualCoverage, designSystem: result.designSystem,
    layoutFill: result.layoutFill,
    measured: { elements: result.elements.all.length },
  };
}

type NativeElement = {
  role?: string; label?: string; identifier?: string; enabled?: boolean; value?: unknown; selected?: boolean | null;
  frame?: { x: number; y: number; width: number; height: number };
  actions?: string[];
};
const CONTROL_ROLES = new Set([
  'AXButton', 'AXLink', 'AXTextField', 'AXTextArea', 'AXSecureTextField',
  'AXCheckBox', 'AXRadioButton', 'AXSlider', 'AXSwitch', 'AXPopUpButton',
  'AXComboBox', 'AXTab', 'AXMenuItem', 'AXDisclosureTriangle', 'AXHeading',
]);

/** Filter structural AX scroll/show-menu nodes BEFORE applying the requested limit. */
export function compactNativeRead(payload: Record<string, unknown>, fullReport: string, limit: number) {
  if (!fullReport) throw new Error('Compact output requires saved full evidence');
  const source = Array.isArray(payload.elements) ? payload.elements as NativeElement[] : [];
  const selected = source.filter(e => (e.selected !== undefined && e.selected !== null) || CONTROL_ROLES.has(e.role ?? '')
    || e.actions?.some(a => a !== 'AXScrollToVisible' && a !== 'AXShowMenu'));
  const controls = selected.slice(0, limit).map(e => ({
    role: e.role, name: e.label, identifier: e.identifier ?? undefined,
    value: typeof e.value === 'string' && e.value.length > 256 ? e.value.slice(0, 256) : e.value,
    valueTruncated: typeof e.value === 'string' && e.value.length > 256 ? true : undefined,
    valueLength: typeof e.value === 'string' && e.value.length > 256 ? e.value.length : undefined,
    selected: e.selected,
    enabled: e.enabled, bounds: e.frame ? [e.frame.x, e.frame.y, e.frame.width, e.frame.height] : undefined,
  }));
  return {
    schema: 'ibr.native.read.compact/v1', fullReport,
    type: payload.type, backend: payload.backend, window: payload.window, observedAt: payload.observedAt,
    totalElements: payload.totalElements, controlsAvailable: selected.length,
    returned: controls.length, omittedStructural: source.length - selected.length,
    truncated: controls.length < selected.length, controls,
    hostCursorAffected: payload.hostCursorAffected,
  };
}
