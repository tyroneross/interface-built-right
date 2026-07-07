/**
 * AXDaemon — Node-side manager for the long-lived Swift AX daemon (`--daemon`).
 *
 * Spawns the extractor in daemon mode and speaks its JSON-lines protocol: one
 * request object per stdin line, one response object per stdout line, correlated
 * by an integer `id`. Holds the AX connection open across many extract / action /
 * resolve calls, eliminating the per-call binary respawn.
 *
 * Lifetime & safety:
 * - The daemon reads stdin and exits on EOF, so when THIS process dies (normal
 *   exit or SIGKILL) the pipe closes and the daemon reaps itself — no orphan.
 *   (Verified live in the E2-A spike: SIGKILL of the parent → daemon exits.)
 * - On the daemon's `ready` line we check `trusted`. If AX is not trusted, start()
 *   rejects so the caller (DaemonBackend) can fall back to RespawnBackend rather
 *   than hang.
 * - On child exit / spawn error, every in-flight and future request rejects; the
 *   backend flips to the respawn fallback (kill-9 auto-fallback).
 *
 * `spawnFn` is injectable so the protocol framing can be unit-tested without a
 * real Swift binary.
 */

import { spawn as nodeSpawn } from 'child_process';
import type { ChildProcessWithoutNullStreams } from 'child_process';
import { ensureExtractor } from './extract.js';

export type DaemonTarget =
  | { kind: 'macos'; pid: number }
  | { kind: 'simulator'; pid?: number; deviceName?: string };

export interface DaemonExtractRequest {
  op: 'extract';
  target: DaemonTarget;
}
export interface DaemonActionRequest {
  op: 'action';
  target: DaemonTarget;
  action: string;
  elementPath: number[];
  value?: string;
}
export interface DaemonResolveRequest {
  op: 'resolve';
  target: DaemonTarget;
}
export interface DaemonPingRequest {
  op: 'ping';
}
/** Deliver a keyboard chord to the target pid (E2-B). See `Keyboard.swift`. */
export interface DaemonKeystrokeRequest {
  op: 'keystroke';
  target: DaemonTarget;
  chord: string;
  /** false (default): CGEventPostToPid (background). true: activate + global HID tap. */
  foreground?: boolean;
}
/** Walk a menu-bar or open-context-menu path and AXPress the final item (E2-D). See `Menu.swift`. */
export interface DaemonMenuRequest {
  op: 'menu';
  target: DaemonTarget;
  menuPath: string[];
}

export type DaemonRequest =
  | DaemonExtractRequest
  | DaemonActionRequest
  | DaemonResolveRequest
  | DaemonPingRequest
  | DaemonKeystrokeRequest
  | DaemonMenuRequest;

export interface DaemonResponse {
  id?: number;
  ok: boolean;
  result?: unknown;
  error?: string;
}

interface ReadyLine {
  type: 'ready';
  trusted: boolean;
  pid: number;
}

type SpawnFn = (command: string, args: string[]) => ChildProcessWithoutNullStreams;

export interface AXDaemonOptions {
  /** Override the binary path (default: resolved via ensureExtractor). */
  binaryPath?: string;
  /** Injectable spawn for tests. */
  spawnFn?: SpawnFn;
  /** Startup timeout waiting for the `ready` line (ms). */
  startTimeoutMs?: number;
  /** Per-request timeout (ms). */
  requestTimeoutMs?: number;
}

const DEFAULT_START_TIMEOUT = 10_000;
const DEFAULT_REQUEST_TIMEOUT = 30_000;

export class DaemonError extends Error {}

interface Pending {
  resolve: (r: DaemonResponse) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class AXDaemon {
  private child: ChildProcessWithoutNullStreams | null = null;
  private buffer = '';
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private starting: Promise<ReadyLine> | null = null;
  private dead = false;
  private deadReason = '';
  private readyInfo: ReadyLine | null = null;

  private readonly binaryPath?: string;
  private readonly spawnFn: SpawnFn;
  private readonly startTimeoutMs: number;
  private readonly requestTimeoutMs: number;

  constructor(opts: AXDaemonOptions = {}) {
    this.binaryPath = opts.binaryPath;
    this.spawnFn = opts.spawnFn ?? (nodeSpawn as unknown as SpawnFn);
    this.startTimeoutMs = opts.startTimeoutMs ?? DEFAULT_START_TIMEOUT;
    this.requestTimeoutMs = opts.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT;
  }

  /** True once the daemon has died or failed startup — the backend uses this to
   *  route straight to the respawn fallback without retrying. */
  get isDead(): boolean {
    return this.dead;
  }

  /**
   * Ensure the daemon is running and AX-trusted. Idempotent — concurrent callers
   * share one startup. Rejects (marking the daemon dead) if spawn fails, the
   * ready line does not arrive in time, or AX is not trusted.
   */
  async start(): Promise<ReadyLine> {
    if (this.readyInfo) return this.readyInfo;
    if (this.dead) throw new DaemonError(this.deadReason || 'daemon is dead');
    if (this.starting) return this.starting;

    this.starting = (async () => {
      const bin = this.binaryPath ?? (await ensureExtractor());
      const child = this.spawnFn(bin, ['--daemon']);
      this.child = child;

      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => this.onStdout(chunk));
      // Drain stderr so a chatty daemon never blocks on a full pipe.
      child.stderr?.setEncoding?.('utf8');
      child.stderr?.on('data', () => {});
      child.on('error', (err) => this.onExit(`daemon spawn error: ${err.message}`));
      child.on('exit', (code, signal) =>
        this.onExit(`daemon exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`),
      );

      const ready = await this.waitForReady();
      if (!ready.trusted) {
        this.kill('daemon reported AX not trusted');
        throw new DaemonError('daemon not AX-trusted');
      }
      this.readyInfo = ready;
      return ready;
    })();

    try {
      return await this.starting;
    } catch (err) {
      this.starting = null;
      throw err;
    }
  }

  private waitForReady(): Promise<ReadyLine> {
    return new Promise<ReadyLine>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.kill('daemon startup timed out');
        reject(new DaemonError('daemon startup timed out'));
      }, this.startTimeoutMs);
      this.readyResolver = { resolve, reject, timer };
    });
  }

  private readyResolver: { resolve: (r: ReadyLine) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> } | null =
    null;

  private onStdout(chunk: string): void {
    this.buffer += chunk;
    let idx: number;
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      this.onLine(line);
    }
  }

  private onLine(line: string): void {
    let obj: DaemonResponse | ReadyLine;
    try {
      obj = JSON.parse(line);
    } catch {
      return; // ignore non-JSON noise
    }

    if ((obj as ReadyLine).type === 'ready') {
      const ready = obj as ReadyLine;
      if (this.readyResolver) {
        clearTimeout(this.readyResolver.timer);
        this.readyResolver.resolve(ready);
        this.readyResolver = null;
      }
      return;
    }

    const resp = obj as DaemonResponse;
    if (typeof resp.id === 'number') {
      const p = this.pending.get(resp.id);
      if (p) {
        clearTimeout(p.timer);
        this.pending.delete(resp.id);
        p.resolve(resp);
      }
    }
  }

  private onExit(reason: string): void {
    if (this.dead) return;
    this.dead = true;
    this.deadReason = reason;
    this.readyInfo = null;
    if (this.readyResolver) {
      clearTimeout(this.readyResolver.timer);
      this.readyResolver.reject(new DaemonError(reason));
      this.readyResolver = null;
    }
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new DaemonError(reason));
    }
    this.pending.clear();
  }

  /** Send a request and await its correlated response. Rejects on timeout or death. */
  request(req: DaemonRequest): Promise<DaemonResponse> {
    if (this.dead) return Promise.reject(new DaemonError(this.deadReason || 'daemon is dead'));
    const child = this.child;
    if (!child) return Promise.reject(new DaemonError('daemon not started'));

    const id = this.nextId++;
    return new Promise<DaemonResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        // A hung request is treated as a fatal daemon fault so the backend falls
        // back rather than wedging.
        this.kill(`daemon request ${id} timed out`);
        reject(new DaemonError(`daemon request timed out (op=${req.op})`));
      }, this.requestTimeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      try {
        child.stdin.write(JSON.stringify({ id, ...req }) + '\n');
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(new DaemonError(`daemon write failed: ${err instanceof Error ? err.message : String(err)}`));
      }
    });
  }

  /** Terminate the daemon and reject anything in flight. */
  kill(reason = 'daemon stopped'): void {
    const child = this.child;
    this.onExit(reason);
    if (child) {
      child.stdin.end();
      child.kill('SIGTERM');
    }
    this.child = null;
  }
}
