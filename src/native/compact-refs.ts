/**
 * Compact, token-lean view of a native AX read for any model.
 *
 * - Each unique element gets a short ref (`e1`, `e2`, ...). Refs persist in
 *   `<dir>/<sessionId>.refs.json` so `native:session:action --ref e12` can
 *   resolve them without the model re-sending labels.
 * - Identical nodes (same role/label/identifier/frame) are collapsed.
 * - The full payload is written to a file and only its path is returned.
 * - `diffRefs` reports only what changed between two reads, so a post-action
 *   check costs a few lines instead of a full re-snapshot.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface RawElement {
  role?: string | null;
  label?: string | null;
  identifier?: string | null;
  value?: unknown;
  enabled?: boolean;
  frame?: { x: number; y: number; width: number; height: number } | null;
}

export interface RefEntry {
  ref: string;
  role: string;
  label: string | null;
  identifier: string | null;
  frame: [number, number, number, number] | null;
}

function keyOf(e: RefEntry): string {
  return `${e.role}|${e.label ?? ''}|${e.identifier ?? ''}|${e.frame?.join(',') ?? ''}`;
}

/** Collapse duplicates and assign sequential refs in document order. */
export function assignRefs(elements: RawElement[]): RefEntry[] {
  const seen = new Set<string>();
  const out: RefEntry[] = [];
  for (const el of elements) {
    const f = el.frame;
    const entry: RefEntry = {
      ref: '',
      role: el.role ?? 'unknown',
      label: el.label ?? null,
      identifier: el.identifier ?? null,
      frame: f ? [Math.round(f.x), Math.round(f.y), Math.round(f.width), Math.round(f.height)] : null,
    };
    const k = keyOf(entry);
    if (seen.has(k)) continue;
    seen.add(k);
    entry.ref = `e${out.length + 1}`;
    out.push(entry);
  }
  return out;
}

/** One line per element: `e3 Button "Save" #saveBtn @10,20 80x24`. */
export function formatRefLine(e: RefEntry): string {
  const role = e.role.replace(/^AX/, '');
  const parts = [e.ref, role];
  if (e.label) parts.push(JSON.stringify(e.label.length > 60 ? `${e.label.slice(0, 57)}...` : e.label));
  if (e.identifier) parts.push(`#${e.identifier}`);
  if (e.frame) parts.push(`@${e.frame[0]},${e.frame[1]} ${e.frame[2]}x${e.frame[3]}`);
  return parts.join(' ');
}

export interface RefDiff {
  added: RefEntry[];
  removed: RefEntry[];
  unchanged: number;
}

/** Identity ignores the ref number, so a re-read that shifts numbering is not a change. */
export function diffRefs(before: RefEntry[], after: RefEntry[]): RefDiff {
  const b = new Set(before.map(keyOf));
  const a = new Set(after.map(keyOf));
  return {
    added: after.filter((e) => !b.has(keyOf(e))),
    removed: before.filter((e) => !a.has(keyOf(e))),
    unchanged: after.filter((e) => b.has(keyOf(e))).length,
  };
}

export function formatDiff(d: RefDiff): string {
  if (d.added.length === 0 && d.removed.length === 0) return `no AX change (${d.unchanged} unchanged)`;
  return [
    ...d.added.map((e) => `+ ${formatRefLine(e)}`),
    ...d.removed.map((e) => `- ${formatRefLine(e)}`),
    `(${d.unchanged} unchanged)`,
  ].join('\n');
}

export function refsPath(dir: string, sessionId: string): string {
  return join(dir, `${sessionId}.refs.json`);
}

export function saveRefs(dir: string, sessionId: string, refs: RefEntry[]): string {
  mkdirSync(dir, { recursive: true });
  const p = refsPath(dir, sessionId);
  writeFileSync(p, JSON.stringify(refs));
  return p;
}

export function loadRefs(dir: string, sessionId: string): RefEntry[] | null {
  const p = refsPath(dir, sessionId);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as RefEntry[];
  } catch {
    return null;
  }
}

/** Write the full payload to disk and return its path (file-out, not context). */
export function writeFullPayload(dir: string, sessionId: string, what: string, payload: unknown): string {
  mkdirSync(dir, { recursive: true });
  const p = join(dir, `${sessionId}.${what}.json`);
  writeFileSync(p, JSON.stringify(payload));
  return p;
}
