/**
 * Accessibility stress run for a running macOS app.
 *
 * Reads the app's whole accessibility tree several times in each UI state and
 * reports whether the app survived. Built to reproduce crashes that only happen
 * when an outside client reads labels (for example a SwiftUI/AppKit label
 * override that keeps calling itself until the main thread's stack overflows).
 *
 * A step is "walk" (read only) or an AXIdentifier to press before reading.
 * This can crash the target on purpose, so it takes an explicit pid only.
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ensureExtractor } from './extract.js';

const execFileAsync = promisify(execFile);

export interface AxStressWalk {
  nodes: number;
  reads: number;
  failedReads: number;
  truncated: boolean;
}

export interface AxStressStep {
  index: number;
  step: string;
  pressed?: boolean;
  pressError?: string | number;
  walks: AxStressWalk[];
}

export interface AxStressReport {
  pid: number;
  survived: boolean;
  steps: AxStressStep[];
  crash?: { step?: string; index?: number; walk?: number; phase: string };
}

export interface AxStressOptions {
  pid: number;
  steps: string[];
  walksPerStep?: number;
  maxNodes?: number;
  settleSeconds?: number;
}

type Runner = (bin: string, args: string[], timeoutMs: number) => Promise<{ stdout: string }>;

const defaultRunner: Runner = (bin, args, timeoutMs) =>
  execFileAsync(bin, args, { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 });

/** Validates options and returns the extractor arguments. Throws on bad input. */
export function buildAxStressArgs(opts: AxStressOptions): string[] {
  const walks = opts.walksPerStep ?? 5;
  const maxNodes = opts.maxNodes ?? 50000;
  const settle = opts.settleSeconds ?? 1;
  if (!Number.isInteger(opts.pid) || opts.pid <= 0) throw new Error('pid must be a positive integer');
  if (opts.steps.length === 0 || opts.steps.some((s) => s.trim() === '')) throw new Error('steps must be non-empty');
  if (!Number.isInteger(walks) || walks < 1 || walks > 100) throw new Error('walks per step must be 1-100');
  if (!Number.isInteger(maxNodes) || maxNodes < 1 || maxNodes > 1_000_000) throw new Error('max nodes must be 1-1000000');
  if (!(settle >= 0 && settle <= 30)) throw new Error('settle seconds must be 0-30');
  return [
    '--pid', String(opts.pid),
    '--stress-steps', JSON.stringify(opts.steps),
    '--stress-walks', String(walks),
    '--stress-max-nodes', String(maxNodes),
    '--stress-settle', String(settle),
  ];
}

/**
 * Runs the stress pass. The extractor exits 3 when the target died; its JSON
 * report is still on stdout, so a non-zero exit with a report is a result,
 * not a tool failure.
 */
export async function runAxStress(
  opts: AxStressOptions,
  deps?: { ensure?: () => Promise<string>; run?: Runner },
): Promise<AxStressReport> {
  const args = buildAxStressArgs(opts);
  const binary = await (deps?.ensure ?? ensureExtractor)();
  const run = deps?.run ?? defaultRunner;
  // Generous ceiling: each read may wait up to 2 s on a hung target.
  const timeoutMs = Math.max(60_000, opts.steps.length * (opts.walksPerStep ?? 5) * 30_000);
  let stdout: string;
  try {
    ({ stdout } = await run(binary, args, timeoutMs));
  } catch (err) {
    const out = String((err as { stdout?: unknown }).stdout ?? '').trim();
    if (out.startsWith('{')) {
      stdout = out;
    } else {
      const stderr = String((err as { stderr?: unknown }).stderr ?? '').trim();
      throw new Error(stderr || (err instanceof Error ? err.message : String(err)));
    }
  }
  return JSON.parse(stdout) as AxStressReport;
}

/** One line per step plus a verdict, for terminal output. */
export function formatAxStressReport(report: AxStressReport): string {
  const lines = report.steps.map((s) => {
    const press = s.step === 'walk' ? '' : s.pressed ? ' (pressed)' : ` (press failed: ${s.pressError ?? 'unknown'})`;
    const nodes = s.walks.map((w) => w.nodes).join(',');
    const failed = s.walks.reduce((sum, w) => sum + w.failedReads, 0);
    const truncated = s.walks.some((w) => w.truncated) ? ' TRUNCATED' : '';
    return `${s.index}. ${s.step}${press}: ${s.walks.length} walks, nodes ${nodes}, failed reads ${failed}${truncated}`;
  });
  if (report.survived) {
    lines.push(`SURVIVED: pid ${report.pid} is still running`);
  } else {
    const c = report.crash;
    const where = c?.step ? ` during step ${c.index} (${c.step})${c.walk ? `, walk ${c.walk}` : ''}` : ` (${c?.phase ?? 'unknown'})`;
    lines.push(`CRASHED: pid ${report.pid} exited${where}`);
  }
  return lines.join('\n');
}
