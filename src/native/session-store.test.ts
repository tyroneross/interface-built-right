/**
 * `session-store.ts` unit tests — file-backed cross-process session
 * persistence (chunk E4-C, T-03).
 *
 * These tests genuinely exercise the cross-process contract: `writeSession`
 * and `readSession`/`deleteSession` are called from fully independent
 * function invocations against a shared on-disk directory (no in-memory Map
 * passed between them), which is exactly the boundary the real CLI crosses
 * between an `ibr native:session:start` process and a later
 * `ibr native:session:action` process.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeSession, readSession, deleteSession, type StoredNativeSession } from './session-store.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ibr-native-session-store-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('session-store cross-process persistence', () => {
  it('readSession returns null for a session that was never written', () => {
    expect(readSession('never-written', dir)).toBeNull();
  });

  it('a session written by one call is read back correctly by a wholly separate call (cross-process shape)', () => {
    const entry: StoredNativeSession = { type: 'macos', app: 'TextEdit', pid: 4242, createdAt: 1000 };
    writeSession('sess-1', entry, dir);

    // Simulate a second process: no shared JS state, just the directory.
    const readBack = readSession('sess-1', dir);
    expect(readBack).toEqual(entry);
  });

  it('persists simulator sessions (device shape) round-trip', () => {
    const entry: StoredNativeSession = {
      type: 'simulator',
      device: { udid: 'ABCD-1234', name: 'iPhone 16 Pro' },
      createdAt: 2000,
    };
    writeSession('sess-sim', entry, dir);
    expect(readSession('sess-sim', dir)).toEqual(entry);
  });

  it('last-writer-wins: a second write to the same sessionId replaces the first (documented unsupported for concurrent writers, but sequential overwrite is well-defined)', () => {
    writeSession('sess-2', { type: 'macos', app: 'First', pid: 1, createdAt: 1 }, dir);
    writeSession('sess-2', { type: 'macos', app: 'Second', pid: 2, createdAt: 2 }, dir);
    expect(readSession('sess-2', dir)).toEqual({ type: 'macos', app: 'Second', pid: 2, createdAt: 2 });
  });

  it('write is atomic: no leftover temp file remains after a successful write', () => {
    writeSession('sess-3', { type: 'macos', app: 'X', pid: 9, createdAt: 3 }, dir);
    const files = readdirSync(dir);
    expect(files).toEqual(['sess-3.json']);
    expect(files.some((f) => f.includes('.tmp'))).toBe(false);
  });

  it('deleteSession removes the file; a subsequent read returns null', () => {
    writeSession('sess-4', { type: 'macos', app: 'Y', pid: 3, createdAt: 4 }, dir);
    expect(readSession('sess-4', dir)).not.toBeNull();
    deleteSession('sess-4', dir);
    expect(readSession('sess-4', dir)).toBeNull();
  });

  it('deleteSession on an already-absent session is a no-op (idempotent close)', () => {
    expect(() => deleteSession('never-existed', dir)).not.toThrow();
  });

  it('readSession returns null for a malformed JSON file instead of throwing', () => {
    writeFileSync(join(dir, 'corrupt.json'), '{ not valid json', 'utf8');
    expect(readSession('corrupt', dir)).toBeNull();
  });

  it('readSession returns null when the stored type is not macos/simulator (defensive shape guard)', () => {
    writeFileSync(join(dir, 'bad-type.json'), JSON.stringify({ type: 'chrome', createdAt: 1 }), 'utf8');
    expect(readSession('bad-type', dir)).toBeNull();
  });

  it('rejects sessionIds that look like path traversal instead of writing outside baseDir', () => {
    expect(() => writeSession('../escape', { type: 'macos', pid: 1, createdAt: 1 }, dir)).toThrow();
    expect(() => readSession('../escape', dir)).toThrow();
  });

  it('creates the base directory on first write if it does not exist yet', () => {
    const nested = join(dir, 'nested', 'native-sessions');
    writeSession('sess-5', { type: 'macos', app: 'Z', pid: 5, createdAt: 5 }, nested);
    expect(readSession('sess-5', nested)).toEqual({ type: 'macos', app: 'Z', pid: 5, createdAt: 5 });
  });

  it('genuinely round-trips across two independent module-level calls with no shared closure state (the actual cross-process shape)', () => {
    // Two separate "sessions" of use, each only touching the filesystem —
    // nothing here shares an in-memory reference between the write and the
    // read, mirroring two separate `ibr native:session:*` OS processes.
    function processA(): void {
      writeSession('cross-proc', { type: 'macos', app: 'Notes', pid: 777, createdAt: 42 }, dir);
    }
    function processB(): StoredNativeSession | null {
      return readSession('cross-proc', dir);
    }
    processA();
    expect(processB()).toEqual({ type: 'macos', app: 'Notes', pid: 777, createdAt: 42 });
  });
});
