import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `ibr --help` epilog (T-02) + the commander parse-error leg of the
 * exit-code contract (T-01).
 *
 * Spawns `src/bin/ibr.ts` directly through the repo's own tsx binary rather
 * than `dist/bin/ibr.js` (contrast `first-run.test.ts`, which spawns dist on
 * purpose). That file's own comment explains why dist is normally the right
 * target — it is the artifact plugin installs actually execute — but THIS
 * suite tests behavior (the exitOverride wiring, the addHelpText epilog)
 * that exists only in source until the next `npm run build` regenerates
 * dist/bin/ibr.js. Spawning dist here would silently test yesterday's CLI.
 * check-dist-freshness.test.ts is the separate, existing gate that catches
 * a stale committed bundle before release — not this suite's job.
 *
 * No Chrome launch on any path exercised here (--help / --version / an
 * unknown option all resolve inside commander's own parser, before any
 * command action runs), so this is a plain *.test.ts, not *.integration.test.ts.
 */

const REPO_ROOT = join(__dirname, '..', '..');
const TSX = join(REPO_ROOT, 'node_modules', '.bin', 'tsx');
const CLI = join(REPO_ROOT, 'src', 'bin', 'ibr.ts');

interface RunResult {
  status: number;
  output: string;
}

function runCli(args: string[]): RunResult {
  const result = spawnSync(TSX, [CLI, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 30_000,
  });
  return {
    status: result.status ?? 1,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? result.error.message : ''}`,
  };
}

describe('ibr --help', () => {
  beforeAll(() => {
    expect(existsSync(TSX), `${TSX} must exist — run \`npm install\` first`).toBe(true);
  });

  it('exits 0 (EXIT_PASS) — help is not an error', () => {
    const result = runCli(['--help']);
    expect(result.status, result.output).toBe(0);
  });

  it('documents all five copy-paste recipes', () => {
    const { output } = runCli(['--help']);
    // 1. scan at two viewports
    expect(output).toMatch(/ibr scan <url> -v mobile/);
    expect(output).toMatch(/ibr scan <url> -v desktop/);
    // 2. a threaded session lifecycle (start --detach -> click/type/screenshot -> close)
    expect(output).toMatch(/ibr session:start <url> --detach/);
    expect(output).toMatch(/ibr session:click <id> "<selector>"/);
    expect(output).toMatch(/ibr session:type <id> "<selector>" "<text>"/);
    expect(output).toMatch(/ibr session:screenshot <id>/);
    expect(output).toMatch(/ibr session:close <id>/);
    // 3. session:eval, with the async-IIFE note for awaited expressions
    expect(output).toMatch(/ibr session:eval <id> "document\.title"/);
    expect(output).toMatch(/async \(\) =>/);
    // 4. element screenshot via -s/--selector
    expect(output).toMatch(/ibr session:screenshot <id> -s '<selector>'/);
    // 5. a batch loop over URLs using --json and the exit code to sort results
    expect(output).toMatch(/for url in/);
    expect(output).toMatch(/ibr scan "\$url" --json/);
    expect(output).toMatch(/case \$\?/);
  });

  it('documents the 0/1/2 exit-code contract', () => {
    const { output } = runCli(['--help']);
    expect(output).toMatch(/Exit codes:/);
    expect(output).toMatch(/0 pass/);
    expect(output).toMatch(/1 issues found/);
    expect(output).toMatch(/2 tool\s+error/);
  });

  it('documents that global -v/-t/-o can shadow subcommand short flags', () => {
    const { output } = runCli(['--help']);
    expect(output).toMatch(/-v\/-t\/-o can shadow/);
    expect(output).toMatch(/--target/);
  });
});

describe('ibr scan --help', () => {
  it('documents the FAIL-only exit-code split for scan specifically', () => {
    const result = runCli(['scan', '--help']);
    expect(result.status, result.output).toBe(0);
    expect(result.output).toMatch(/Exit codes:[\s\S]*verdict FAIL\s+only/);
  });
});

describe('commander parse errors -> EXIT_TOOL_ERROR (2)', () => {
  it('an unknown global option exits 2, not 1', () => {
    const result = runCli(['--this-flag-does-not-exist']);
    expect(result.status, result.output).toBe(2);
    expect(result.output).toMatch(/unknown option/i);
  });

  it('a missing required subcommand option exits 2, not 1', () => {
    // `interact` requires -a/--action and -t/--target.
    const result = runCli(['interact', 'http://example.com']);
    expect(result.status, result.output).toBe(2);
    expect(result.output).toMatch(/required option/i);
  });

  it('--version still exits 0', () => {
    const result = runCli(['--version']);
    expect(result.status, result.output).toBe(0);
  });
});
