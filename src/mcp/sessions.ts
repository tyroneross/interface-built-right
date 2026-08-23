/**
 * Shared MCP session registry.
 *
 * The in-memory session store is the one piece of state shared between the web
 * MCP handlers (`tools.ts`) and the native MCP handlers (`native-tools.ts`).
 * It was extracted here (from `tools.ts`) at Wave 0 (chunk C0) and is FROZEN
 * afterward — its shape ripples into both the web (Epic 3) and native (Epic 4)
 * threads.
 *
 * Import direction is ONE-WAY and explicit: `tools.ts` and `native-tools.ts`
 * (and the native session controller) import FROM here; this module imports
 * from NEITHER. `sessions.ts` must never `import … from './tools'`.
 */

/** Kind of surface a session drives. */
export type SessionType = 'chrome' | 'safari' | 'macos' | 'simulator';

/**
 * One live session. Web sessions carry a driver; native (macos/simulator)
 * sessions carry no driver and are addressed by pid / device instead.
 */
export type SessionEntry = {

  driver: any; // EngineDriver | SafariDriver | null (null for native/simulator sessions)
  type: SessionType;
  url?: string;
  app?: string;
  device?: { udid: string; name: string };
  pid?: number;
  createdAt: number;
};

/** Session store — persistent instances (Chrome, Safari, macOS native, iOS/watchOS simulator). */
export const sessions = new Map<string, SessionEntry>();

/**
 * Test-only seam (f2-A closure test): seed/clear the in-memory session map so
 * unit tests can exercise session→cookies / native-session branches without
 * standing up a real browser or app.
 *
 * NOT part of the public API — intentionally name-prefixed with `__test_`.
 * Re-exported from `tools.ts` for backward-compatible test access.
 */
/* @internal */
export function __test_setSession(id: string, entry: SessionEntry | null): void {
  if (entry === null) {
    sessions.delete(id);
  } else {
    sessions.set(id, entry);
  }
}

/**
 * Close every live session and empty the store.
 *
 * WHY THIS EXISTS. Sessions are the one browser-owning resource whose release
 * depended entirely on a caller remembering to call `session_close`. Over 30
 * days of real use that was 92 `session_start` against 72 `session_close` — a
 * 22% miss rate, each miss stranding a live Chrome process and its profile
 * directory. `closeMcpBrowserPool()` covered the POOL and stopped at the pool,
 * so even a clean L1-L4 shutdown orphaned every open session.
 *
 * Cleanup is now structural: the host's exit paths call this, so releasing a
 * session no longer depends on anyone remembering to. Explicit `session_close`
 * still works and is still the right thing to do — it just is not load-bearing
 * any more.
 *
 * Best-effort by construction: one driver that refuses to close must not
 * prevent the rest from closing, and a shutdown path must never throw.
 * Returns the number of sessions it attempted to close, so a caller can log it.
 */
export async function closeAllSessions(): Promise<number> {
  const entries = [...sessions.entries()];
  sessions.clear();
  lastTouched.clear();
  await Promise.all(entries.map(async ([, entry]) => {
    try {
      await entry.driver?.close?.();
    } catch {
      // A driver that cannot close is already lost; the process is exiting and
      // the OS reaps what is left. Swallowing keeps one bad driver from
      // blocking the others.
    }
  }));
  return entries.length;
}

// ─── Idle sweep (L4 analogue for sessions) ──────────────────────────────────
//
// SHAPE NOTE: last-touch lives in a SIDE TABLE, not on SessionEntry. That type
// is documented frozen at the top of this file because its shape ripples into
// both the web and native threads; a side table adds the capability without
// touching it.
const lastTouched = new Map<string, number>();

/** Record activity on a session. Safe to call for ids that no longer exist. */
export function touchSession(id: string): void {
  if (sessions.has(id)) lastTouched.set(id, Date.now());
}

/**
 * Close sessions with no activity for `maxIdleMs`.
 *
 * DEFAULT-OFF, deliberately, matching `mcp-lifecycle/SPEC.md` L4 and its
 * reasoning: from inside the server a leaked session and a live-but-quiet one
 * are indistinguishable. A user can legitimately hold a session open for an
 * hour while working elsewhere, and closing it out from under them is worse
 * than leaking it. So the mechanism is always implemented and never fires
 * unless `IBR_SESSION_IDLE_MS` is set to a positive value.
 *
 * This complements, and does not replace, `closeAllSessions()`: that one runs
 * at shutdown and is the guarantee; this one bounds accumulation DURING a
 * long-lived server, which is where the measured 22% start/close gap actually
 * builds up.
 *
 * A session with no recorded touch is dated from `createdAt`, so one that is
 * started and never used is still eligible rather than immortal.
 *
 * Returns the ids it closed.
 */
export async function sweepIdleSessions(maxIdleMs: number): Promise<string[]> {
  if (!Number.isFinite(maxIdleMs) || maxIdleMs <= 0) return [];
  const now = Date.now();
  const expired: Array<[string, SessionEntry]> = [];
  for (const [id, entry] of sessions) {
    const last = lastTouched.get(id) ?? entry.createdAt;
    if (now - last >= maxIdleMs) expired.push([id, entry]);
  }
  for (const [id] of expired) {
    sessions.delete(id);
    lastTouched.delete(id);
  }
  await Promise.all(expired.map(async ([, entry]) => {
    try {
      await entry.driver?.close?.();
    } catch {
      // Best effort, same contract as closeAllSessions().
    }
  }));
  return expired.map(([id]) => id);
}

/** Configured idle threshold in ms. 0 (the default) disables the sweep. */
export function configuredSessionIdleMs(): number {
  const raw = Number(process.env.IBR_SESSION_IDLE_MS ?? 0);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}
