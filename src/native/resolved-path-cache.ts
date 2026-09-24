/**
 * ResolvedPathCache — caches resolved AX index-paths per (sessionId, target),
 * invalidated the moment the target surface's `nativeStateSignature` changes.
 *
 * The expensive step in a native flow is walking the AX tree to resolve a target
 * string ("Submit") to an index-path ([0,2,1]). Re-resolving on every action of a
 * stable UI is waste. This cache returns a previously-resolved path ONLY when the
 * current tree signature matches the signature captured at resolution time; a
 * signature mismatch (any UI mutation) drops the entry and forces re-resolution.
 *
 * SAFETY (T-12): index-paths are positional — after a UI mutation the same path
 * may address a DIFFERENT element. A cache that returned a stale path would fire
 * an action against the wrong element. `get()` therefore never returns a path
 * whose signature has drifted; the stale entry is evicted instead. This invariant
 * is verified by resolved-path-cache.test.ts and is backend-agnostic.
 *
 * STATUS — wired into record/replay (`src/native/replay.ts`, `ibr native:replay`).
 * Replay seeds each recorded step's path with the signature captured at record
 * time; a hit means the UI is unchanged and the step acts without resolution.
 * NativeSessionController still resolves per action (it stays the frozen
 * MCP/CLI contract); replay is the consumer.
 */

export interface ResolvedPathEntry {
  /** The `nativeStateSignature` at the time this path was resolved. */
  signature: string;
  /** The resolved AX index-path. */
  path: number[];
}

const SEP = '\x00';

export class ResolvedPathCache {
  private readonly entries = new Map<string, ResolvedPathEntry>();

  private static keyOf(sessionId: string, target: string): string {
    return `${sessionId}${SEP}${target}`;
  }

  /**
   * Return the cached path for (sessionId, target) IFF the current signature
   * matches the one captured at resolution. On mismatch the entry is evicted and
   * `null` is returned — the caller must re-resolve. Never returns a stale path.
   */
  get(sessionId: string, target: string, currentSignature: string): number[] | null {
    const key = ResolvedPathCache.keyOf(sessionId, target);
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.signature !== currentSignature) {
      // UI mutated since resolution — the positional path may now point at a
      // different element. Evict and force re-resolution.
      this.entries.delete(key);
      return null;
    }
    // Return a copy so callers cannot mutate the cached array in place.
    return entry.path.slice();
  }

  /** Cache a freshly-resolved path together with the signature it was resolved against. */
  set(sessionId: string, target: string, path: number[], signature: string): void {
    this.entries.set(ResolvedPathCache.keyOf(sessionId, target), {
      signature,
      path: path.slice(),
    });
  }

  /** Drop a single (sessionId, target) entry. */
  delete(sessionId: string, target: string): void {
    this.entries.delete(ResolvedPathCache.keyOf(sessionId, target));
  }

  /** Drop every entry for a session (e.g. on session close). */
  invalidateSession(sessionId: string): void {
    const prefix = `${sessionId}${SEP}`;
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) this.entries.delete(key);
    }
  }

  /** Drop everything. */
  clear(): void {
    this.entries.clear();
  }

  /** Number of live entries (test/introspection aid). */
  get size(): number {
    return this.entries.size;
  }
}

/** Process-wide shared cache instance. */
export const resolvedPathCache = new ResolvedPathCache();
