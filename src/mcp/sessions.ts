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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
