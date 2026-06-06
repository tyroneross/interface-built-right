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

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { resolveIbrRepoRoot } from './ibr-paths';

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_BUFFER = 32 * 1024 * 1024; // 32MB — scan JSON can be large

export interface RunIbrOptions {
  /** Wall-clock timeout in ms (default 120s). */
  timeoutMs?: number;
  /** Stdout buffer cap (default 32MB). */
  maxBuffer?: number;
  /**
   * When true (default), a non-zero exit code does NOT throw. The CLI's stdout
   * is the structured result and is often the entire deliverable — `scan` for
   * example exits 1 on verdict=FAIL but stdout still contains the full JSON.
   * Set false to make non-zero exits throw, e.g. when the caller cares about
   * the exit code as a control signal.
   */
  acceptNonZeroExit?: boolean;
}

export interface RunIbrResult {
  stdout: string;
  stderr: string;
  exitCode: number;
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

  const acceptNonZero = options.acceptNonZeroExit ?? true;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBuffer = options.maxBuffer ?? DEFAULT_MAX_BUFFER;

  // Use spawn rather than execFile: execFile truncates stdout to ~64KB when the
  // child exits non-zero (regardless of maxBuffer), which silently broke `scan`
  // output on FAIL verdicts. spawn streams everything; we cap with maxBuffer
  // ourselves.
  return await new Promise<RunIbrResult>((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: repoRoot,
      shell: false, // explicit: no shell, ever.
      env: {
        ...process.env,
        IBR_DIR: process.env.IBR_DIR ?? join(repoRoot, '.ibr'),
      },
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutLen = 0;
    let stderrLen = 0;
    let timedOut = false;
    let overflowed = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutLen += chunk.length;
      if (stdoutLen > maxBuffer) {
        overflowed = true;
        child.kill('SIGTERM');
        return;
      }
      stdoutChunks.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderrLen += chunk.length;
      if (stderrLen > maxBuffer) {
        overflowed = true;
        child.kill('SIGTERM');
        return;
      }
      stderrChunks.push(chunk);
    });

    child.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', code => {
      clearTimeout(timer);
      const stdout = Buffer.concat(stdoutChunks).toString('utf-8');
      const stderr = Buffer.concat(stderrChunks).toString('utf-8');
      if (timedOut) {
        const e = new Error(`[run-ibr] timed out after ${timeoutMs}ms`);
        (e as Error & { stdout?: string; stderr?: string }).stdout = stdout;
        (e as Error & { stdout?: string; stderr?: string }).stderr = stderr;
        return reject(e);
      }
      if (overflowed) {
        const e = new Error(`[run-ibr] output exceeded maxBuffer (${maxBuffer} bytes)`);
        return reject(e);
      }
      const exitCode = typeof code === 'number' ? code : -1;
      if (exitCode !== 0 && !acceptNonZero) {
        const e = new Error(`[run-ibr] CLI exited ${exitCode}`);
        (e as Error & { stdout?: string; stderr?: string; exitCode?: number }).stdout = stdout;
        (e as Error & { stdout?: string; stderr?: string; exitCode?: number }).stderr = stderr;
        (e as Error & { stdout?: string; stderr?: string; exitCode?: number }).exitCode = exitCode;
        return reject(e);
      }
      resolve({ stdout, stderr, exitCode });
    });
  });
}

/**
 * Parse the JSON object/array out of CLI stdout, tolerating a non-JSON prefix.
 *
 * `ibr scan --json` prints a brief status line (`Scanning <url>...\n`) before
 * the JSON document. JSON.parse on the raw stdout fails, so we locate the first
 * `{` or `[` and parse from there. Returns the parsed value on success, or
 * `null` when no JSON can be extracted.
 */
export function extractJson<T = unknown>(stdout: string): T | null {
  if (!stdout) return null;
  const firstBrace = stdout.indexOf('{');
  const firstBracket = stdout.indexOf('[');
  let start = -1;
  if (firstBrace === -1) start = firstBracket;
  else if (firstBracket === -1) start = firstBrace;
  else start = Math.min(firstBrace, firstBracket);
  if (start < 0) return null;
  const candidate = stdout.slice(start);
  try {
    return JSON.parse(candidate) as T;
  } catch {
    return null;
  }
}
