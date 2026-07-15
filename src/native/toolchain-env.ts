/**
 * Repair PATH for GUI / MCP-spawned processes.
 *
 * When Claude Code (or any launchd / GUI parent) spawns this MCP server or the
 * CLI, the inherited `process.env.PATH` is often a minimal launchd default that
 * omits `/usr/bin` and the Xcode toolchain. Every bare-name subprocess the
 * native layer shells out to (`swift`, `xcrun`, `which`, `osascript`,
 * `screencapture`, `open`, `idb`) then fails with ENOENT even though the tools
 * exist on disk — the observed `scan_macos` "swift ENOENT" failure.
 *
 * `ensureToolchainPath()` appends the canonical macOS toolchain dirs to PATH
 * once at process entry, so every downstream `execFile` inherits a PATH that
 * resolves them. No-op off macOS.
 */
import { existsSync } from 'fs';

/**
 * Canonical dirs holding the toolchain binaries the native layer spawns.
 * `/usr/bin` covers the `swift` shim, `xcrun`, `which`, `osascript`, `open`,
 * `screencapture`, and `xcode-select`; the Homebrew dirs cover `idb`.
 */
const TOOLCHAIN_DIRS = [
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
  '/usr/local/bin',
  '/opt/homebrew/bin',
];

/**
 * Merge the toolchain dirs into an existing PATH string. Pure — no env or fs
 * mutation beyond the `existsSync` probe. Canonical dirs already present keep
 * their position; missing ones are *appended* (not prepended) so a user's own
 * toolchain choice on PATH still wins. Non-existent dirs are skipped.
 */
export function hardenPath(currentPath: string | undefined): string {
  const existing = (currentPath ?? '').split(':').filter(Boolean);
  const have = new Set(existing);
  const additions = TOOLCHAIN_DIRS.filter(
    (dir) => !have.has(dir) && existsSync(dir)
  );
  return [...existing, ...additions].join(':');
}

/**
 * Mutate `env.PATH` in place so downstream subprocess spawns resolve the
 * toolchain. macOS-only; a no-op elsewhere (Linux/CI PATH is already correct
 * and these dirs are macOS-specific). Idempotent — safe to call more than once.
 */
export function ensureToolchainPath(env: NodeJS.ProcessEnv = process.env): void {
  if (process.platform !== 'darwin') return;
  env.PATH = hardenPath(env.PATH);
}
