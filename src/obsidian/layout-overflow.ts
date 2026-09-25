/**
 * Layout-overflow detector — re-export shim.
 *
 * Moved to `src/layout-overflow.ts` so `ibr scan` (web) can run the same
 * detector `scan_obsidian` has used since its 30px-button regression (see
 * that file's header for the full history). Kept here, unchanged in shape,
 * so `src/obsidian/scan.ts` and `src/obsidian/index.ts` keep compiling
 * without touching their imports.
 */
export * from '../layout-overflow.js';
