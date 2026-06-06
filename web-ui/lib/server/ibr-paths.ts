// SPDX-FileCopyrightText: 2025-2026 Tyrone Ross, Jr <46267523+tyroneross@users.noreply.github.com>
// SPDX-License-Identifier: Apache-2.0

/**
 * Portable IBR data-path resolution.
 *
 * Resolution order (deterministic, machine-independent):
 *   1. process.env.IBR_DIR — absolute or relative path the operator set explicitly.
 *      Relative paths are resolved against the discovered repo root, NOT cwd.
 *   2. Walk up from this file until we find a package.json whose `bin.ibr` field
 *      exists. That directory is the IBR repo root; `.ibr/` sits beneath it.
 *   3. Fallback: walk up from process.cwd() the same way (covers the case where
 *      this file is bundled/inlined and __dirname is unusable).
 *
 * The result is the absolute path to the IBR data dir (typically `<repo>/.ibr`).
 * The CLI writes to <repo>/.ibr; this resolver guarantees the web-ui reads from
 * the same place, regardless of which subdirectory Next was launched from.
 *
 * Memoised — the lookup runs once per process.
 */

import { existsSync, readFileSync } from 'fs';
import { dirname, isAbsolute, join, resolve } from 'path';
import { fileURLToPath } from 'url';

let cachedIbrDir: string | undefined;
let cachedRepoRoot: string | undefined;

function isIbrRepoRoot(dir: string): boolean {
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
      bin?: string | Record<string, string>;
    };
    if (!pkg.bin) return false;
    if (typeof pkg.bin === 'string') return false; // string-bin means name == package name
    return typeof pkg.bin.ibr === 'string';
  } catch {
    return false;
  }
}

function walkUpForRepoRoot(startDir: string): string | undefined {
  let cur = startDir;
  // Bounded climb — 12 levels is more than any real layout
  for (let i = 0; i < 12; i++) {
    if (isIbrRepoRoot(cur)) return cur;
    const parent = dirname(cur);
    if (parent === cur) return undefined; // hit filesystem root
    cur = parent;
  }
  return undefined;
}

/**
 * Resolve the IBR repo root (the directory whose package.json declares `bin.ibr`).
 * Memoised. Throws on failure — there is no sensible fallback when the repo
 * cannot be located (the previous absolute-symlink behaviour was the bug).
 */
export function resolveIbrRepoRoot(): string {
  if (cachedRepoRoot) return cachedRepoRoot;

  // Try walking up from this source file first (most reliable in dev + build).
  let here: string;
  try {
    here = dirname(fileURLToPath(import.meta.url));
  } catch {
    here = process.cwd();
  }

  const fromHere = walkUpForRepoRoot(here);
  if (fromHere) {
    cachedRepoRoot = fromHere;
    return fromHere;
  }

  // Fallback: walk up from cwd (covers bundled/inlined cases).
  const fromCwd = walkUpForRepoRoot(process.cwd());
  if (fromCwd) {
    cachedRepoRoot = fromCwd;
    return fromCwd;
  }

  throw new Error(
    `[ibr-paths] Could not locate the IBR repo root. ` +
      `Looked up from ${here} and ${process.cwd()}. ` +
      `Set IBR_DIR to an absolute path to override.`
  );
}

/**
 * Resolve the absolute path to the IBR data directory (.ibr by default).
 * Honors IBR_DIR env when set; otherwise computes <repoRoot>/.ibr.
 */
export function resolveIbrDir(): string {
  if (cachedIbrDir) return cachedIbrDir;

  const envDir = process.env.IBR_DIR;
  if (envDir && envDir.trim().length > 0) {
    if (isAbsolute(envDir)) {
      cachedIbrDir = envDir;
      return envDir;
    }
    // Relative IBR_DIR is anchored to the repo root, not cwd — Next changes cwd.
    const root = resolveIbrRepoRoot();
    cachedIbrDir = resolve(root, envDir);
    return cachedIbrDir;
  }

  const root = resolveIbrRepoRoot();
  cachedIbrDir = join(root, '.ibr');
  return cachedIbrDir;
}

/** Convenience: <ibrDir>/sessions */
export function resolveSessionsDir(): string {
  return join(resolveIbrDir(), 'sessions');
}

/** Convenience: <ibrDir>/sessions/<id> */
export function resolveSessionDir(id: string): string {
  return join(resolveSessionsDir(), id);
}

/** Test-only: reset memoised cache. */
export function _resetIbrPathsCache(): void {
  cachedIbrDir = undefined;
  cachedRepoRoot = undefined;
}
