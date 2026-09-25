import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The 0/1/2 exit-code contract (T-01), exercised through `ibr scan` — the
 * command the motivating bug report was about ("observed rc 0,0,1,0,1,1
 * with no way to know which were crashes").
 *
 * *.integration.test.ts on purpose: every case here launches a real headless
 * Chrome (`scan` always does, even on the fast-failing invalid-URL case,
 * because the CDP navigation error only surfaces AFTER `driver.launch()`
 * succeeds). Keep this file separate from help-epilog.test.ts, which
 * deliberately stays Chrome-free and fast.
 *
 * Spawns `src/bin/ibr.ts` via the repo's own tsx binary, not
 * `dist/bin/ibr.js` — see help-epilog.test.ts's file comment for why dist is
 * the wrong target for behavior that only exists in source pending the next
 * `npm run build`.
 *
 * Unreachable URLs: Chrome does not reject a refused connection; it swaps in
 * its own `chrome-error://` page. `scan()` now detects that landing and throws,
 * so an unreachable URL exits 2 instead of grading Chrome's error page PASS.
 * A malformed URL (`not-a-valid-url`) throws synchronously from CDP.
 */

const REPO_ROOT = join(__dirname, '..', '..');
const TSX = join(REPO_ROOT, 'node_modules', '.bin', 'tsx');
const CLI = join(REPO_ROOT, 'src', 'bin', 'ibr.ts');
const CLEAN_FIXTURE = `file://${join(__dirname, 'fixtures', 'clean-pass.html')}`;

interface RunResult {
  status: number;
  output: string;
}

function runCli(args: string[], timeoutMs = 30_000): RunResult {
  const result = spawnSync(TSX, [CLI, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: timeoutMs,
  });
  return {
    status: result.status ?? 1,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? result.error.message : ''}`,
  };
}

describe('ibr scan exit codes', () => {
  beforeAll(() => {
    expect(existsSync(TSX), `${TSX} must exist — run \`npm install\` first`).toBe(true);
    expect(existsSync(join(__dirname, 'fixtures', 'clean-pass.html'))).toBe(true);
  });

  it(
    'a malformed URL exits 2 (EXIT_TOOL_ERROR) — CDP rejects it before any page is scanned',
    () => {
      const result = runCli(['scan', 'not-a-valid-url', '--json'], 30_000);
      expect(result.status, result.output).toBe(2);
      expect(result.output).toMatch(/invalid URL/i);
    },
    45_000,
  );

  it(
    'an unreachable URL exits 2 (EXIT_TOOL_ERROR) instead of grading Chrome\'s error page',
    () => {
      const result = runCli(['scan', 'http://127.0.0.1:9/', '--json'], 45_000);
      expect(result.status, result.output).toBe(2);
      expect(result.output).toMatch(/could not be loaded/i);
    },
    60_000,
  );

  it(
    'a page with a FAIL verdict exits 1 (EXIT_ISSUES), not 2',
    () => {
      const failFixture = `file://${join(__dirname, '..', 'design-system', 'principles', 'fixtures', 'status-pill.html')}`;
      const result = runCli(['scan', failFixture, '--json'], 60_000);
      expect(result.output).toMatch(/"verdict":\s*"FAIL"/);
      expect(result.status, result.output).toBe(1);
    },
    75_000,
  );

  it(
    'a clean fixture (no interactive elements, no low-contrast text) exits 0 (EXIT_PASS)',
    () => {
      const result = runCli(['scan', CLEAN_FIXTURE, '--json'], 60_000);
      expect(result.status, result.output).toBe(0);
      expect(result.output).toMatch(/"verdict":\s*"PASS"/);
    },
    75_000,
  );
});
