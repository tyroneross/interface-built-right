import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';
import { AXDaemon, DaemonError } from './daemon.js';
import type { ChildProcessWithoutNullStreams } from 'child_process';

/**
 * Hermetic AXDaemon protocol tests. The Swift binary is replaced by a fake
 * child process (`spawnFn` injection) so framing, id-correlation, ready/trust
 * handling and crash-fallback are exercised without any real process.
 */

class FakeStdout extends EventEmitter {
  setEncoding(): void {}
}
class FakeStderr extends EventEmitter {
  setEncoding(): void {}
}

class FakeChild extends EventEmitter {
  stdout = new FakeStdout();
  stderr = new FakeStderr();
  written: string[] = [];
  stdin = {
    write: (s: string) => {
      this.written.push(s);
      return true;
    },
    end: () => {},
  };
  kill = vi.fn();

  /** Emit one protocol line (adds the newline framing). */
  emitLine(obj: unknown): void {
    this.stdout.emit('data', JSON.stringify(obj) + '\n');
  }
  /** Emit raw text (for partial-line / noise tests). */
  emitRaw(text: string): void {
    this.stdout.emit('data', text);
  }
  crash(code: number | null = 1, signal: string | null = null): void {
    this.emit('exit', code, signal);
  }
  lastRequest(): { id: number; op: string; [k: string]: unknown } {
    return JSON.parse(this.written[this.written.length - 1]);
  }
}

function makeDaemon(): { daemon: AXDaemon; child: FakeChild } {
  const child = new FakeChild();
  const daemon = new AXDaemon({
    binaryPath: '/fake/ibr-ax-extract',
    spawnFn: () => child as unknown as ChildProcessWithoutNullStreams,
    startTimeoutMs: 200,
    requestTimeoutMs: 200,
  });
  return { daemon, child };
}

describe('AXDaemon protocol', () => {
  it('resolves start() on a trusted ready line', async () => {
    const { daemon, child } = makeDaemon();
    const p = daemon.start();
    child.emitLine({ type: 'ready', trusted: true, pid: 4242 });
    const ready = await p;
    expect(ready).toMatchObject({ trusted: true, pid: 4242 });
    expect(daemon.isDead).toBe(false);
  });

  it('rejects and dies when the daemon reports AX not trusted', async () => {
    const { daemon, child } = makeDaemon();
    const p = daemon.start();
    child.emitLine({ type: 'ready', trusted: false, pid: 5 });
    await expect(p).rejects.toBeInstanceOf(DaemonError);
    expect(daemon.isDead).toBe(true);
  });

  it('correlates a response to its request by id', async () => {
    const { daemon, child } = makeDaemon();
    const sp = daemon.start();
    child.emitLine({ type: 'ready', trusted: true, pid: 1 });
    await sp;

    const rp = daemon.request({ op: 'extract', target: { kind: 'macos', pid: 99 } });
    const sent = child.lastRequest();
    expect(sent.op).toBe('extract');
    child.emitLine({ id: sent.id, ok: true, result: { kind: 'macos', elements: [], window: {} } });
    const resp = await rp;
    expect(resp.ok).toBe(true);
  });

  it('matches out-of-order responses to the right pending request', async () => {
    const { daemon, child } = makeDaemon();
    const sp = daemon.start();
    child.emitLine({ type: 'ready', trusted: true, pid: 1 });
    await sp;

    const r1 = daemon.request({ op: 'ping' });
    const id1 = child.lastRequest().id;
    const r2 = daemon.request({ op: 'ping' });
    const id2 = child.lastRequest().id;
    expect(id2).not.toBe(id1);

    // Respond to the SECOND first, then the first.
    child.emitLine({ id: id2, ok: true, result: { second: true } });
    child.emitLine({ id: id1, ok: true, result: { first: true } });
    expect((await r1).result).toEqual({ first: true });
    expect((await r2).result).toEqual({ second: true });
  });

  it('reassembles a response split across two data chunks', async () => {
    const { daemon, child } = makeDaemon();
    const sp = daemon.start();
    child.emitLine({ type: 'ready', trusted: true, pid: 1 });
    await sp;
    const rp = daemon.request({ op: 'ping' });
    const id = child.lastRequest().id;
    const line = JSON.stringify({ id, ok: true, result: { pong: true } });
    child.emitRaw(line.slice(0, 10));
    child.emitRaw(line.slice(10) + '\n');
    expect((await rp).ok).toBe(true);
  });

  it('ignores non-JSON noise on stdout', async () => {
    const { daemon, child } = makeDaemon();
    const sp = daemon.start();
    child.emitRaw('some swift log line without json\n');
    child.emitLine({ type: 'ready', trusted: true, pid: 1 });
    await expect(sp).resolves.toMatchObject({ trusted: true });
  });

  it('kill-9 fallback: a crash rejects in-flight requests and marks the daemon dead', async () => {
    const { daemon, child } = makeDaemon();
    const sp = daemon.start();
    child.emitLine({ type: 'ready', trusted: true, pid: 1 });
    await sp;

    const rp = daemon.request({ op: 'extract', target: { kind: 'macos', pid: 7 } });
    child.crash(null, 'SIGKILL');
    await expect(rp).rejects.toBeInstanceOf(DaemonError);
    expect(daemon.isDead).toBe(true);
    // Subsequent requests reject immediately without a live child.
    await expect(daemon.request({ op: 'ping' })).rejects.toBeInstanceOf(DaemonError);
  });

  it('rejects start() (dies) when the ready line never arrives', async () => {
    const { daemon } = makeDaemon();
    await expect(daemon.start()).rejects.toBeInstanceOf(DaemonError);
    expect(daemon.isDead).toBe(true);
  });

  it('times out a hung request and marks the daemon dead', async () => {
    const { daemon, child } = makeDaemon();
    const sp = daemon.start();
    child.emitLine({ type: 'ready', trusted: true, pid: 1 });
    await sp;
    const rp = daemon.request({ op: 'ping' }); // no response ever
    await expect(rp).rejects.toBeInstanceOf(DaemonError);
    expect(daemon.isDead).toBe(true);
  });
});
