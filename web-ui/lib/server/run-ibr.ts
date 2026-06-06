// SPDX-FileCopyrightText: 2025-2026 Tyrone Ross, Jr <46267523+tyroneross@users.noreply.github.com>
// SPDX-License-Identifier: Apache-2.0

/**
 * Safe IBR CLI invoker.
 *
 * Replaces the previous `exec(string)` pattern (which built shell command strings
 * with interpolated user input — command-injection on every shelling route).
 * This module uses `execFile` with an argument ARRAY and `shell: false`, so the
 * child process never goes through `/bin/sh -c`. Argument values are passed as
 * literal argv entries; shell metacharacters (`;`, `&`, `|`, `$()`, backticks,
 * redirections) have no syntactic effect.
 *
 * Strategy: run the built CLI binary directly (`<repoRoot>/dist/bin/ibr.js`)
 * via the current Node executable, NOT via `npm run` (which adds another shell
 * hop and slows cold-start).
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';
import { resolveIbrRepoRoot } from './ibr-paths';

const execFileAsync = promisify(execFile);

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_BUFFER = 32 * 1024 * 1024; // 32MB — scan JSON can be large

export interface RunIbrOptions {
  /** Wall-clock timeout in ms (default 120s). */
  timeoutMs?: number;
  /** Stdout buffer cap (default 32MB). */
  maxBuffer?: number;
}

export interface RunIbrResult {
  stdout: string;
  stderr: string;
}

/**
 * Invoke the IBR CLI with an argument array. NO shell interpolation.
 *
 * @param args — argv tail, e.g. ["scan", url, "--json"]. Each entry is passed
 *               as a single argv element regardless of its content; a URL like
 *               `http://x;id` is the literal first arg to `scan`, not a shell
 *               command separator.
 */
export async function runIbrCli(
  args: string[],
  options: RunIbrOptions = {}
): Promise<RunIbrResult> {
  if (!Array.isArray(args)) {
    throw new Error('[run-ibr] args must be an array');
  }
  // Belt-and-braces: reject non-string args. execFile would coerce, but explicit
  // rejection makes calling-site mistakes loud.
  for (const a of args) {
    if (typeof a !== 'string') {
      throw new Error(`[run-ibr] all args must be strings, got ${typeof a}`);
    }
  }

  const repoRoot = resolveIbrRepoRoot();
  const cliPath = join(repoRoot, 'dist', 'bin', 'ibr.js');
  if (!existsSync(cliPath)) {
    throw new Error(
      `[run-ibr] CLI binary not found at ${cliPath}. Run \`npm run build\` in ${repoRoot}.`
    );
  }

  const { stdout, stderr } = await execFileAsync(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxBuffer: options.maxBuffer ?? DEFAULT_MAX_BUFFER,
    // Explicit: no shell, ever.
    shell: false,
    env: {
      ...process.env,
      // Make sure the child resolves .ibr to the same dir we computed.
      IBR_DIR: process.env.IBR_DIR ?? join(repoRoot, '.ibr'),
    },
  });

  return {
    stdout: String(stdout ?? ''),
    stderr: String(stderr ?? ''),
  };
}
