/**
 * Model-agnostic computer-use surface for simulator sessions.
 *
 * Accepts Anthropic computer-use actions (`{action:"left_click",coordinate:[x,y]}`),
 * OpenAI computer-use actions (`{type:"click",x,y}`) or IBR's own canonical shape,
 * normalizes them, drives the simulator headlessly (idb HID / simctl), then
 * re-reads the AX tree and returns only the delta as compact refs.
 * Screenshots are written to disk; only the path is returned.
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { idbButton, idbSwipe, idbTap, idbType } from './idb.js';
import type { RawElement } from './compact-refs.js';

const execFileAsync = promisify(execFile);

export type CanonicalAction =
  | { kind: 'screenshot' }
  | { kind: 'click'; x: number; y: number; count: number }
  | { kind: 'type'; text: string }
  | { kind: 'key'; key: string }
  | { kind: 'scroll'; x: number; y: number; dx: number; dy: number }
  | { kind: 'drag'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'wait'; ms: number };

type Json = Record<string, unknown>;

const num = (v: unknown): number => {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`expected a number, got ${JSON.stringify(v)}`);
  return Math.round(n);
};
const pair = (v: unknown): [number, number] => {
  if (!Array.isArray(v) || v.length !== 2) throw new Error(`expected [x, y], got ${JSON.stringify(v)}`);
  return [num(v[0]), num(v[1])];
};

/** Pixels per scroll "click" when a schema gives an amount rather than pixels. */
export const SCROLL_STEP_PX = 100;

/** Normalize an Anthropic, OpenAI or canonical IBR action. Throws on unsupported input. */
export function normalizeAction(input: Json): CanonicalAction {
  // OpenAI computer-use: discriminated by `type`.
  if (typeof input.type === 'string' && input.action === undefined) {
    switch (input.type) {
      case 'screenshot': return { kind: 'screenshot' };
      case 'click': return { kind: 'click', x: num(input.x), y: num(input.y), count: 1 };
      case 'double_click': return { kind: 'click', x: num(input.x), y: num(input.y), count: 2 };
      case 'type': return { kind: 'type', text: String(input.text ?? '') };
      case 'keypress': {
        const keys = Array.isArray(input.keys) ? input.keys.map(String) : [];
        if (keys.length !== 1) throw new Error('keypress: exactly one key is supported on the simulator');
        return { kind: 'key', key: keys[0] };
      }
      case 'scroll':
        return { kind: 'scroll', x: num(input.x), y: num(input.y), dx: num(input.scroll_x ?? 0), dy: num(input.scroll_y ?? 0) };
      case 'drag': {
        const path = Array.isArray(input.path) ? input.path as Json[] : [];
        if (path.length < 2) throw new Error('drag: path needs at least 2 points');
        const a = path[0], b = path[path.length - 1];
        return { kind: 'drag', x1: num(a.x), y1: num(a.y), x2: num(b.x), y2: num(b.y) };
      }
      case 'wait': return { kind: 'wait', ms: 1000 };
      default: throw new Error(`unsupported OpenAI action type "${input.type}"`);
    }
  }
  // Anthropic computer-use: discriminated by `action`.
  switch (input.action) {
    case 'screenshot': return { kind: 'screenshot' };
    case 'left_click': { const [x, y] = pair(input.coordinate); return { kind: 'click', x, y, count: 1 }; }
    case 'double_click': { const [x, y] = pair(input.coordinate); return { kind: 'click', x, y, count: 2 }; }
    case 'triple_click': { const [x, y] = pair(input.coordinate); return { kind: 'click', x, y, count: 3 }; }
    case 'type': return { kind: 'type', text: String(input.text ?? '') };
    case 'key': return { kind: 'key', key: String(input.text ?? '') };
    case 'scroll': {
      const [x, y] = pair(input.coordinate);
      const amount = num(input.scroll_amount ?? 3) * SCROLL_STEP_PX;
      const dir = String(input.scroll_direction ?? 'down');
      const dx = dir === 'left' ? -amount : dir === 'right' ? amount : 0;
      const dy = dir === 'up' ? -amount : dir === 'down' ? amount : 0;
      return { kind: 'scroll', x, y, dx, dy };
    }
    case 'left_click_drag': {
      const [x1, y1] = pair(input.start_coordinate);
      const [x2, y2] = pair(input.coordinate);
      return { kind: 'drag', x1, y1, x2, y2 };
    }
    case 'wait': return { kind: 'wait', ms: Math.round(Number(input.duration ?? 1) * 1000) };
    default: throw new Error(`unsupported action "${String(input.action ?? input.type)}"`);
  }
}

export interface CuResult {
  success: boolean;
  error?: string;
  screenshot?: string;
}

const KEY_BUTTONS: Record<string, 'HOME' | 'LOCK' | 'SIRI'> = { home: 'HOME', lock: 'LOCK', siri: 'SIRI' };
const KEY_TEXT: Record<string, string> = { return: '\n', enter: '\n', tab: '\t' };

/** Execute a canonical action on a booted simulator. */
export async function executeOnSimulator(udid: string, a: CanonicalAction, outDir: string): Promise<CuResult> {
  switch (a.kind) {
    case 'screenshot': {
      mkdirSync(outDir, { recursive: true });
      const p = join(outDir, `cu-${Date.now()}.png`);
      await execFileAsync('xcrun', ['simctl', 'io', udid, 'screenshot', p], { timeout: 15000 });
      return { success: true, screenshot: p };
    }
    case 'click': {
      for (let i = 0; i < a.count; i++) {
        const r = await idbTap(udid, a.x, a.y);
        if (!r.success) return { success: false, error: r.error };
      }
      return { success: true };
    }
    case 'type': {
      const r = await idbType(udid, a.text);
      return { success: r.success, error: r.error };
    }
    case 'key': {
      const k = a.key.toLowerCase();
      if (KEY_BUTTONS[k]) {
        const r = await idbButton(udid, KEY_BUTTONS[k]);
        return { success: r.success, error: r.error };
      }
      if (KEY_TEXT[k] !== undefined) {
        const r = await idbType(udid, KEY_TEXT[k]);
        return { success: r.success, error: r.error };
      }
      return { success: false, error: `key "${a.key}" is not supported on the simulator (supported: Home, Lock, Siri, Return, Enter, Tab)` };
    }
    case 'scroll': {
      // Content scrolls opposite to the finger: scrolling down swipes up.
      const r = await idbSwipe(udid, a.x, a.y, a.x - a.dx, a.y - a.dy, 0.3);
      return { success: r.success, error: r.error };
    }
    case 'drag': {
      const r = await idbSwipe(udid, a.x1, a.y1, a.x2, a.y2, 0.5);
      return { success: r.success, error: r.error };
    }
    case 'wait':
      await new Promise((r) => setTimeout(r, Math.min(a.ms, 10000)));
      return { success: true };
  }
}

interface IdbNode {
  type?: string;
  role?: string;
  AXLabel?: string | null;
  AXUniqueId?: string | null;
  frame?: { x: number; y: number; width: number; height: number };
}

/** Read the simulator AX tree through idb as RawElements for compact refs. */
export async function readSimulatorElements(udid: string): Promise<RawElement[]> {
  const { stdout } = await execFileAsync('idb', ['ui', 'describe-all', '--udid', udid], { timeout: 15000, maxBuffer: 16 * 1024 * 1024 });
  const nodes = JSON.parse(stdout) as IdbNode[];
  return nodes.map((n) => ({
    role: n.role ?? n.type ?? 'unknown',
    label: n.AXLabel ?? null,
    identifier: n.AXUniqueId ?? null,
    frame: n.frame ?? null,
  }));
}
