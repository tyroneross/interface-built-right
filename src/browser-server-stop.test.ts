/**
 * `session:close all` must prove the browser stopped.
 *
 * It used to treat a resolved CDP close as proof, never signalled the
 * `session:start` process that owns the browser, and deleted the manifest that
 * owner's idle timer reads. Both processes then lived forever (44 trees and
 * 451 processes on 2026-11-09). These tests use stand-in processes: an "owner"
 * that launches a long-lived "chrome" child and reaps it on SIGTERM, the same
 * contract `session:start` has.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { lastBrowserServerStopReport, manifestOwnedBy, stopBrowserServer } from './browser-server.js';

const alive = (pid: number) => {
  try { process.kill(pid, 0); return true; } catch { return false; }
};

/** Start a stand-in owner; resolves with its pid and its chrome child's pid. */
function startOwner(opts: { ignoreTerm?: boolean } = {}): Promise<{ owner: ChildProcess; chromePid: number }> {
  const script = `
    const { spawn } = require('child_process');
    const chrome = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', '--', '--remote-debugging-port=0'], { stdio: 'ignore' });
    process.stdout.write(String(chrome.pid) + '\\n');
    process.on('SIGTERM', () => {
      if (${opts.ignoreTerm ? 'true' : 'false'}) return;
      chrome.kill('SIGTERM');
      chrome.on('exit', () => process.exit(0));
    });
    setInterval(() => {}, 1000);
  `;
  // The trailing args give ps the marks a real owner and Chrome carry.
  const owner = spawn(process.execPath, ['-e', script, 'session:start'], { stdio: ['ignore', 'pipe', 'ignore'] });
  return new Promise((resolve) => {
    owner.stdout!.once('data', (d) => resolve({ owner, chromePid: Number(String(d).trim()) }));
  });
}

async function plant(outputDir: string, state: Record<string, unknown>) {
  await writeFile(join(outputDir, 'browser-server.json'), JSON.stringify({
    wsEndpoint: 'ws://127.0.0.1:1/devtools/browser/x', startedAt: new Date().toISOString(),
    headless: true, mode: 'local', ownsBrowser: true, isolatedProfile: '', ...state,
  }));
}

describe('stopBrowserServer verifies by pid', () => {
  let outputDir: string;
  const spawned: number[] = [];

  beforeEach(async () => {
    outputDir = await mkdtemp(join(tmpdir(), 'ibr-stop-'));
  });

  afterEach(async () => {
    for (const pid of spawned.splice(0)) { try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ } }
    await rm(outputDir, { recursive: true, force: true });
  });

  it('signals the owning session:start and confirms owner and chrome are gone', async () => {
    const { owner, chromePid } = await startOwner();
    spawned.push(owner.pid!, chromePid);
    await plant(outputDir, { pid: owner.pid, chromePid });

    expect(await stopBrowserServer(outputDir)).toBe(true);
    expect(alive(owner.pid!)).toBe(false);
    expect(alive(chromePid)).toBe(false);
    expect(lastBrowserServerStopReport()!.gone.sort()).toEqual([owner.pid!, chromePid].sort());
    expect(existsSync(join(outputDir, 'browser-server.json'))).toBe(false);
  }, 20_000);

  it('escalates to SIGKILL when the owner ignores SIGTERM', async () => {
    const { owner, chromePid } = await startOwner({ ignoreTerm: true });
    spawned.push(owner.pid!, chromePid);
    await plant(outputDir, { pid: owner.pid, chromePid });

    expect(await stopBrowserServer(outputDir)).toBe(true);
    expect(alive(owner.pid!)).toBe(false);
    expect(alive(chromePid)).toBe(false);
    expect(lastBrowserServerStopReport()!.alive).toEqual([]);
  }, 20_000);

  it('stops an orphaned chrome whose owner is already dead', async () => {
    const chrome = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', '--', '--remote-debugging-port=0'], { stdio: 'ignore' });
    spawned.push(chrome.pid!);
    const dead = spawn(process.execPath, ['-e', '0']);
    await new Promise((r) => dead.once('exit', r));
    await plant(outputDir, { pid: dead.pid, chromePid: chrome.pid });

    expect(await stopBrowserServer(outputDir)).toBe(true);
    expect(alive(chrome.pid!)).toBe(false);
  }, 20_000);

  it('never signals a reused pid that is not the recorded Chrome', async () => {
    // A manifest days old can name a pid the OS has since given to something else.
    const stranger = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
    spawned.push(stranger.pid!);
    const dead = spawn(process.execPath, ['-e', '0']);
    await new Promise((r) => dead.once('exit', r));
    await plant(outputDir, { pid: dead.pid, chromePid: stranger.pid });

    await stopBrowserServer(outputDir);
    expect(alive(stranger.pid!)).toBe(true);
    expect(lastBrowserServerStopReport()!.signalled).toEqual([]);
  }, 20_000);
});

describe('manifestOwnedBy', () => {
  let outputDir: string;
  beforeEach(async () => { outputDir = await mkdtemp(join(tmpdir(), 'ibr-owner-')); });
  afterEach(async () => { await rm(outputDir, { recursive: true, force: true }); });

  it('is false when the manifest is missing or names another owner', async () => {
    expect(await manifestOwnedBy(outputDir, process.pid)).toBe(false);
    await plant(outputDir, { pid: process.pid + 1 });
    expect(await manifestOwnedBy(outputDir, process.pid)).toBe(false);
  });

  it('is true for its own manifest and null for an unreadable one', async () => {
    await plant(outputDir, { pid: process.pid });
    expect(await manifestOwnedBy(outputDir, process.pid)).toBe(true);
    await writeFile(join(outputDir, 'browser-server.json'), '{"pid":');
    expect(await manifestOwnedBy(outputDir, process.pid)).toBe(null);
  });
});
