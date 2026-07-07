/**
 * File-backed cross-process session store for the native CLI (chunk E4-C).
 *
 * `native-session-cli.ts` commands run as separate OS processes — each
 * `ibr native:session:*` invocation is a fresh `node` process — so the
 * in-memory MCP `sessions` Map (`src/mcp/sessions.ts`) cannot carry state
 * between a `start` and a later `action`/`read`/`close`. This module persists
 * the minimal JSON-serializable subset of `SessionEntry` that native sessions
 * ever populate (they never carry a `driver`) to
 * `.ibr/native-sessions/<sessionId>.json`.
 *
 * Concurrency (PRD risk mitigation, "CLI session persistence becomes
 * confusing"): each write is atomic — write to a per-process temp file, then
 * `rename()` over the target. POSIX rename is atomic on the same filesystem,
 * so a reader never observes a partially written file. Concurrent CLI
 * invocations against the SAME session id are last-writer-wins and
 * documented UNSUPPORTED — this store does not lock or merge concurrent
 * writes to one session file.
 */

import { mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

/** Default on-disk location, relative to `process.cwd()` (matches `.ibr/` convention). */
export const DEFAULT_SESSION_STORE_DIR = join('.ibr', 'native-sessions');

/**
 * The persisted shape — a JSON-serializable subset of `SessionEntry`
 * (`src/mcp/sessions.ts`). Native (macos/simulator) sessions always carry
 * `driver: null`, so that field is reconstructed by the CLI on read rather
 * than stored.
 */
export interface StoredNativeSession {
  type: 'macos' | 'simulator';
  app?: string;
  pid?: number;
  device?: { udid: string; name: string };
  createdAt: number;
}

/**
 * Reject path traversal / separator characters instead of silently
 * sanitizing them into a possible filename collision. Session IDs are
 * `crypto.randomUUID()` by default, but this store must not trust arbitrary
 * caller-supplied IDs (CLI `--session-id` override) with filesystem meaning.
 */
function safeSessionFilePart(sessionId: string): string {
  if (!sessionId || !/^[a-zA-Z0-9._-]+$/.test(sessionId) || sessionId === '.' || sessionId === '..') {
    throw new Error(`Invalid sessionId for file store: ${JSON.stringify(sessionId)}`);
  }
  return sessionId;
}

function sessionFilePath(sessionId: string, baseDir: string): string {
  return join(baseDir, `${safeSessionFilePart(sessionId)}.json`);
}

/**
 * Persist a session entry. Atomic: write to a temp file in the same
 * directory, then rename over the target — a reader either sees the old
 * complete file or the new complete file, never a partial write.
 */
export function writeSession(
  sessionId: string,
  entry: StoredNativeSession,
  baseDir: string = DEFAULT_SESSION_STORE_DIR,
): void {
  mkdirSync(baseDir, { recursive: true });
  const target = sessionFilePath(sessionId, baseDir);
  const tmp = join(
    baseDir,
    `.${safeSessionFilePart(sessionId)}.${process.pid}-${randomBytes(4).toString('hex')}.tmp`,
  );
  writeFileSync(tmp, JSON.stringify(entry, null, 2), 'utf8');
  renameSync(tmp, target);
}

/**
 * Read a persisted session entry. Returns `null` when the file is missing or
 * unparsable/malformed — callers treat both as "session not found" rather
 * than throwing, so a corrupt file degrades to a clean CLI error instead of
 * an uncaught exception.
 */
export function readSession(
  sessionId: string,
  baseDir: string = DEFAULT_SESSION_STORE_DIR,
): StoredNativeSession | null {
  const target = sessionFilePath(sessionId, baseDir);
  if (!existsSync(target)) return null;
  try {
    const parsed = JSON.parse(readFileSync(target, 'utf8')) as Partial<StoredNativeSession> | null;
    if (!parsed || (parsed.type !== 'macos' && parsed.type !== 'simulator')) return null;
    if (typeof parsed.createdAt !== 'number') return null;
    return parsed as StoredNativeSession;
  } catch {
    return null;
  }
}

/** Delete a persisted session entry. No-op if already absent — close is idempotent from the store's perspective. */
export function deleteSession(sessionId: string, baseDir: string = DEFAULT_SESSION_STORE_DIR): void {
  const target = sessionFilePath(sessionId, baseDir);
  try {
    unlinkSync(target);
  } catch {
    // Already gone.
  }
}
