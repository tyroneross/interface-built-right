/**
 * Compact, token-lean view of a native AX read for any model.
 *
 * - Each unique element gets a short ref (`e1`, `e2`, ...). Refs persist in
 *   `<dir>/<sessionId>.refs.json` so `native:session:action --ref e12` can
 *   resolve them without the model re-sending labels.
 * - Repeated observations of the same node are collapsed.
 * - The full payload is written to a file and only its path is returned.
 * - `diffRefs` reports only what changed between two reads, so a post-action
 *   check costs a few lines instead of a full re-snapshot.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'node:crypto';

export interface RawElement {
  role?: string | null;
  label?: string | null;
  identifier?: string | null;
  value?: unknown;
  enabled?: boolean;
  selected?: boolean | null;
  path?: number[];
  windowId?: number;
  frame?: { x: number; y: number; width: number; height: number } | null;
}

export interface RefEntry {
  ref: string;
  role: string;
  label: string | null;
  identifier: string | null;
  frame: [number, number, number, number] | null;
  value?: unknown;
  enabled?: boolean;
  selected?: boolean | null;
  path?: number[];
  windowId?: number;
}

/** Geometry and state are observations, never semantic identity. */
function keyOf(e: RefEntry): string {
  return JSON.stringify([e.windowId, e.role, e.identifier ? ['id', e.identifier] : ['label', e.label]]);
}
const highWater = Symbol('highWater');
type RefList = RefEntry[] & { [highWater]?: number };
function maxRef(refs: RefEntry[]): number {
  let high = (refs as RefList)[highWater] ?? 0;
  for (const entry of refs) high = Math.max(high, Number(entry.ref.slice(1)) || 0);
  return high;
}

/** Unique semantic matches survive movement; ambiguous matches get fresh refs. */
export function assignRefs(elements: RawElement[], prior?: RefEntry[] | null): RefEntry[] {
  const entries: RefEntry[] = [];
  const seen = new Set<string>();
  for (const el of elements) {
    const f = el.frame;
    const entry: RefEntry = {
      ref: '', role: el.role ?? 'unknown', label: el.label ?? null,
      identifier: el.identifier ?? null, value: el.value, enabled: el.enabled, selected: el.selected,
      path: el.path, windowId: el.windowId,
      frame: f ? [Math.round(f.x), Math.round(f.y), Math.round(f.width), Math.round(f.height)] : null,
    };
    // Only collapse repeated observations of the same node, not semantic twins.
    const duplicate = JSON.stringify(entry);
    if (!seen.has(duplicate)) { seen.add(duplicate); entries.push(entry); }
  }
  const counts = (rows: RefEntry[]) => {
    const map = new Map<string, RefEntry[]>();
    for (const row of rows) { const k = keyOf(row); map.set(k, [...(map.get(k) ?? []), row]); }
    return map;
  };
  const old = counts(prior ?? []), current = counts(entries);
  let next = maxRef(prior ?? []) + 1;
  for (const entry of entries) {
    const k = keyOf(entry), matches = old.get(k);
    entry.ref = matches?.length === 1 && current.get(k)?.length === 1
      ? matches[0].ref : `e${next++}`;
  }
  (entries as RefList)[highWater] = next - 1;
  return entries;
}

/** One line per element: `e3 Button "Save" #saveBtn @10,20 80x24`. */
export function formatRefLine(e: RefEntry): string {
  const role = e.role.replace(/^AX/, '');
  const parts = [e.ref, role];
  if (e.label) parts.push(JSON.stringify(e.label.length > 60 ? `${e.label.slice(0, 57)}...` : e.label));
  if (e.identifier) parts.push(`#${e.identifier}`);
  if (e.value !== undefined && e.value !== null) {
    const value = typeof e.value === 'string' && e.value.length > 256 ? e.value.slice(0, 256) : e.value;
    parts.push(`value=${JSON.stringify(value)}`);
    if (value !== e.value) parts.push(`[value-truncated length=${String(e.value).length}]`);
  }
  if (e.selected !== undefined && e.selected !== null) parts.push(`selected=${e.selected}`);
  if (e.enabled === false) parts.push('disabled');
  if (e.frame) parts.push(`@${e.frame[0]},${e.frame[1]} ${e.frame[2]}x${e.frame[3]}`);
  return parts.join(' ');
}

export interface RefDiff {
  added: RefEntry[];
  removed: RefEntry[];
  updated: RefEntry[];
  unchanged: number;
}

/** Identity ignores the ref number, so a re-read that shifts numbering is not a change. */
export function diffRefs(before: RefEntry[], after: RefEntry[]): RefDiff {
  const b = new Map(before.map(e => [keyOf(e), e]));
  const a = new Map(after.map(e => [keyOf(e), e]));
  const state = (e: RefEntry) => JSON.stringify([e.label, e.value, e.enabled, e.selected, e.frame, e.path]);
  // Ambiguous nodes are conservatively retired instead of paired by order.
  const matched = (e: RefEntry, rows: RefEntry[]) => rows.filter(r => keyOf(r) === keyOf(e)).length === 1;
  const same = (e: RefEntry) => b.has(keyOf(e)) && matched(e, before) && matched(e, after);
  return {
    added: after.filter(e => !same(e)),
    removed: before.filter(e => !a.has(keyOf(e)) || !matched(e, before) || !matched(e, after)),
    updated: after.filter(e => same(e) && state(e) !== state(b.get(keyOf(e))!)),
    unchanged: after.filter(e => same(e) && state(e) === state(b.get(keyOf(e))!)).length,
  };
}

export function formatDiff(d: RefDiff): string {
  if (!d.added.length && !d.removed.length && !d.updated.length) return `no AX change (${d.unchanged} unchanged)`;
  return [
    ...d.added.map(e => `+ ${formatRefLine(e)}`),
    ...d.removed.map(e => `- ${formatRefLine(e)}`),
    ...d.updated.map(e => `~ ${formatRefLine(e)}`),
    `(${d.unchanged} unchanged)`,
  ].join('\n');
}

export function refsPath(dir: string, sessionId: string): string {
  return join(dir, `${sessionId}.refs.json`);
}

export function saveRefs(dir: string, sessionId: string, refs: RefEntry[], scope?: string): string {
  mkdirSync(dir, { recursive: true });
  const p = refsPath(dir, sessionId);
  const tmp = `${p}.${randomUUID()}.tmp`;
  writeFileSync(tmp, JSON.stringify({ version: 2, scope, highWater: maxRef(refs), refs }), { mode: 0o600 });
  renameSync(tmp, p);
  return p;
}

export function loadRefs(dir: string, sessionId: string, scope?: string): RefEntry[] | null {
  const p = refsPath(dir, sessionId);
  if (!existsSync(p)) return null;
  try {
    const data = JSON.parse(readFileSync(p, 'utf8'));
    const refs = Array.isArray(data) ? data : data.refs;
    if (!Array.isArray(refs) || refs.some(e => !e || !/^e[0-9]+$/.test(e.ref) || typeof e.role !== 'string')) return null;
    const out: RefList = scope !== undefined && data.scope !== scope ? [] : refs;
    out[highWater] = Math.max(Number(data.highWater) || 0, maxRef(refs));
    return out;
  } catch {
    return null;
  }
}

/** Write the full payload to disk and return its path (file-out, not context). */
export function writeFullPayload(dir: string, sessionId: string, what: string, payload: unknown): string {
  mkdirSync(dir, { recursive: true });
  const p = join(dir, `${sessionId}.${what}.${randomUUID()}.json`);
  writeFileSync(p, JSON.stringify(payload), { mode: 0o600, flag: 'wx' });
  return p;
}
