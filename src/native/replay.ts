/**
 * Record-and-replay for native sessions.
 *
 * A model-driven native flow pays for AX reads + target resolution on every
 * step. Once a flow has worked, `record` stores each resolved step (the AX
 * path / tap point plus a role+label+identifier fingerprint and the tree
 * signature it was resolved against). `replay` re-executes the steps with no
 * model in the loop:
 *
 *   - signature unchanged  -> ResolvedPathCache hit, act on the recorded path
 *   - signature changed but the element at the recorded path/point still has the
 *     recorded fingerprint -> `verified`, act on it (no re-resolution)
 *   - otherwise            -> re-resolve by fingerprint (`healed`), report old/new
 *
 * WHY a wrapper and not NativeSessionController: the controller is the frozen
 * contract shared by the MCP tools and the CLI; replay needs a "use this
 * pre-resolved path" fast path that the controller's resolve-then-act surface
 * does not expose. Replay therefore talks to the same NativeBackend and the same
 * exported resolution helpers, leaving the MCP wire untouched.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { createHash } from 'crypto';
import { flattenMacOSElements, resolveMacOSElement, type NativeElementCandidate } from './actions.js';
import { mapSessionActionToNative } from './session-controller.js';
import { ResolvedPathCache } from './resolved-path-cache.js';
import type { NativeBackend } from './backend.js';
import type { RawElement } from './compact-refs.js';

export interface Fingerprint {
  role: string;
  label: string | null;
  identifier: string | null;
}

export interface MacOSStep {
  platform: 'macos';
  action: string;
  value?: string;
  fingerprint: Fingerprint;
  path: number[];
  signature: string;
}

export interface SimulatorStep {
  platform: 'simulator';
  action: 'click';
  count: number;
  fingerprint: Fingerprint;
  point: [number, number];
  signature: string;
}

export type ReplayStep = MacOSStep | SimulatorStep;

export interface ReplayFile {
  version: 1;
  steps: ReplayStep[];
}

export type StepStatus = 'cached' | 'verified' | 'healed' | 'failed';

export interface StepReport {
  index: number;
  status: StepStatus;
  fingerprint: Fingerprint;
  from?: string;
  to?: string;
  error?: string;
}

// ─── signatures + fingerprints ──────────────────────────────────────────────

type SigItem = { role?: string | null; label?: string | null; identifier?: string | null; frame?: unknown };

/** Short, stable hash of a tree: role/label/identifier/frame per node plus the window. */
export function treeSignature(items: SigItem[], window?: unknown): string {
  const body = JSON.stringify({
    window: window ?? null,
    items: items.map((c) => [c.role ?? '', c.label || null, c.identifier || null, c.frame ?? null]),
  });
  return createHash('sha256').update(body).digest('hex').slice(0, 16);
}

export function fingerprintOf(c: SigItem): Fingerprint {
  return { role: c.role ?? 'unknown', label: c.label || null, identifier: c.identifier || null };
}

function sameFingerprint(a: Fingerprint, c: SigItem): boolean {
  const b = fingerprintOf(c);
  return a.role === b.role && a.label === b.label && a.identifier === b.identifier;
}

function fpText(f: Fingerprint): string {
  return `${f.role.replace(/^AX/, '')} ${JSON.stringify(f.label ?? f.identifier ?? '')}`;
}

// ─── file I/O ───────────────────────────────────────────────────────────────

export function loadReplayFile(path: string): ReplayFile {
  if (!existsSync(path)) return { version: 1, steps: [] };
  const parsed = JSON.parse(readFileSync(path, 'utf-8')) as ReplayFile;
  if (parsed.version !== 1 || !Array.isArray(parsed.steps)) throw new Error(`${path} is not an IBR replay file (version 1).`);
  return parsed;
}

export function appendReplayStep(path: string, step: ReplayStep): number {
  const file = loadReplayFile(path);
  file.steps.push(step);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(file, null, 2));
  return file.steps.length;
}

/** Smallest element whose frame contains the point: what a tap at (x,y) hit. */
export function elementAtPoint(elements: RawElement[], x: number, y: number): RawElement | null {
  let best: RawElement | null = null;
  let bestArea = Infinity;
  for (const e of elements) {
    const f = e.frame;
    if (!f || f.width <= 0 || f.height <= 0) continue;
    if (x < f.x || y < f.y || x > f.x + f.width || y > f.y + f.height) continue;
    const area = f.width * f.height;
    if (area < bestArea) { best = e; bestArea = area; }
  }
  return best;
}

function samePath(a: number[] | undefined, b: number[]): boolean {
  return !!a && a.length === b.length && a.every((v, i) => v === b[i]);
}

function findByFingerprint<T extends SigItem>(items: T[], f: Fingerprint): T | undefined {
  return items.find((c) => sameFingerprint(f, c));
}

// ─── replay ─────────────────────────────────────────────────────────────────

export interface ReplayDeps {
  backend: NativeBackend;
  /** Simulator seams (idb). */
  readSimulatorElements?: (udid: string) => Promise<RawElement[]>;
  tapSimulator?: (udid: string, x: number, y: number) => Promise<{ success: boolean; error?: string }>;
  settleMs?: number;
}

export interface ReplayTarget {
  sessionId: string;
  kind: 'macos' | 'simulator';
  pid?: number;
  app?: string;
  udid?: string;
  deviceName?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Poll until two consecutive signatures agree (bounded), returning the final read. */
async function settled<T>(read: () => Promise<T>, sig: (t: T) => string, ms: number): Promise<T> {
  let prev = await read();
  for (let i = 0; i < 6; i++) {
    await sleep(ms);
    const next = await read();
    if (sig(next) === sig(prev)) return next;
    prev = next;
  }
  return prev;
}

export async function replay(file: ReplayFile, target: ReplayTarget, deps: ReplayDeps): Promise<StepReport[]> {
  const cache = new ResolvedPathCache();
  const settleMs = deps.settleMs ?? 150;
  const reports: StepReport[] = [];

  for (let i = 0; i < file.steps.length; i++) {
    const step = file.steps[i];
    if (step.platform !== target.kind) {
      reports.push({ index: i + 1, status: 'failed', fingerprint: step.fingerprint, error: `step recorded on ${step.platform}, session is ${target.kind}` });
      break;
    }
    const key = `${i}\x00${JSON.stringify(step.fingerprint)}`;
    const report = step.platform === 'macos'
      ? await replayMacOS(step, target, deps, cache, key, settleMs)
      : await replaySimulator(step, target, deps, cache, key, settleMs);
    reports.push({ index: i + 1, ...report });
    if (report.status === 'failed') break;
  }
  return reports;
}

async function replayMacOS(
  step: MacOSStep, target: ReplayTarget, deps: ReplayDeps, cache: ResolvedPathCache, key: string, settleMs: number,
): Promise<Omit<StepReport, 'index'>> {
  const t = { kind: 'macos' as const, pid: target.pid!, app: target.app };
  cache.set(target.sessionId, key, step.path, step.signature);
  const read = async () => {
    const ex = await deps.backend.extract(t);
    if (ex.kind !== 'macos') throw new Error(ex.kind === 'not-found' ? ex.message : 'unexpected extraction kind');
    const candidates = flattenMacOSElements(ex.elements);
    return { ex, candidates, sig: treeSignature(candidates, ex.window) };
  };
  const cur = await settled(read, (r) => r.sig, settleMs);

  let status: StepStatus;
  let path = cache.get(target.sessionId, key, cur.sig);
  let from: string | undefined;
  let to: string | undefined;
  if (path) {
    status = 'cached';
  } else if (cur.candidates.some((c) => samePath(c.path, step.path) && sameFingerprint(step.fingerprint, c))) {
    status = 'verified';
    path = step.path;
  } else {
    const name = step.fingerprint.identifier ?? step.fingerprint.label ?? '';
    const exact = findByFingerprint(cur.candidates, step.fingerprint) as NativeElementCandidate | undefined;
    const resolved = exact?.path
      ? exact
      : name ? resolveMacOSElement(cur.ex.elements, name, { role: step.fingerprint.role })?.element : undefined;
    if (!resolved?.path) {
      return { status: 'failed', fingerprint: step.fingerprint, error: `${fpText(step.fingerprint)} not found` };
    }
    status = 'healed';
    path = resolved.path;
    from = step.path.join('.');
    to = path.join('.');
    cache.set(target.sessionId, key, path, cur.sig);
  }

  const mapped = mapSessionActionToNative(step.action, step.value);
  if ('error' in mapped) return { status: 'failed', fingerprint: step.fingerprint, error: mapped.error };
  const res = await deps.backend.performAction(t, { elementPath: path, action: mapped.action, value: mapped.value });
  if (!res.success) return { status: 'failed', fingerprint: step.fingerprint, error: res.error ?? 'action failed' };
  return { status, fingerprint: step.fingerprint, from, to };
}

async function replaySimulator(
  step: SimulatorStep, target: ReplayTarget, deps: ReplayDeps, cache: ResolvedPathCache, key: string, settleMs: number,
): Promise<Omit<StepReport, 'index'>> {
  const readEls = deps.readSimulatorElements;
  const tap = deps.tapSimulator;
  if (!readEls || !tap || !target.udid) return { status: 'failed', fingerprint: step.fingerprint, error: 'simulator replay needs idb' };
  cache.set(target.sessionId, key, step.point, step.signature);
  const cur = await settled(async () => {
    const els = await readEls(target.udid!);
    return { els, sig: treeSignature(els) };
  }, (r) => r.sig, settleMs);

  let status: StepStatus;
  let point = cache.get(target.sessionId, key, cur.sig) as [number, number] | null;
  let from: string | undefined;
  let to: string | undefined;
  if (point) {
    status = 'cached';
  } else {
    const hit = elementAtPoint(cur.els, step.point[0], step.point[1]);
    if (hit && sameFingerprint(step.fingerprint, hit)) {
      status = 'verified';
      point = step.point;
    } else {
      const found = findByFingerprint(cur.els, step.fingerprint);
      if (!found?.frame) return { status: 'failed', fingerprint: step.fingerprint, error: `${fpText(step.fingerprint)} not found` };
      const f = found.frame;
      point = [Math.round(f.x + f.width / 2), Math.round(f.y + f.height / 2)];
      status = 'healed';
      from = step.point.join(',');
      to = point.join(',');
      cache.set(target.sessionId, key, point, cur.sig);
    }
  }
  for (let n = 0; n < Math.max(1, step.count); n++) {
    const r = await tap(target.udid, point[0], point[1]);
    if (!r.success) return { status: 'failed', fingerprint: step.fingerprint, error: r.error ?? 'tap failed' };
  }
  return { status, fingerprint: step.fingerprint, from, to };
}

/** Compact report: one summary line plus one line per healed/failed step only. */
export function formatReplayReport(reports: StepReport[], total: number): string {
  const count = (s: StepStatus) => reports.filter((r) => r.status === s).length;
  const lines = [
    `replay ${reports.length}/${total} steps: ${count('cached')} cached, ${count('verified')} verified, ${count('healed')} healed, ${count('failed')} failed`,
  ];
  for (const r of reports) {
    if (r.status === 'healed') lines.push(`  healed #${r.index} ${fpText(r.fingerprint)} ${r.from} -> ${r.to}`);
    if (r.status === 'failed') lines.push(`  failed #${r.index} ${fpText(r.fingerprint)}: ${r.error}`);
  }
  return lines.join('\n');
}
