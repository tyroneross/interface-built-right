import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { normalizeFileConfig, mergeCliConfig } from './cli-config.js';
import { ConfigSchema } from '../schemas.js';

/**
 * First-run guards: `ibr init` then a plain command, with NO flags.
 *
 * The defect these exist for: `.ibrrc.json` documents `"viewport": "desktop"`
 * — a preset NAME, and the literal value `ibr init` writes — while
 * `ConfigSchema.viewport` is a Viewport OBJECT. Nothing bridged the two, so
 * every command routed through `createIBR` died on the config the tool had
 * just written itself:
 *
 *   Error: [{ "expected": "object", "path": ["viewport"],
 *             "message": "Invalid input: expected object, received string" }]
 *
 * Passing `-v desktop` HID the bug — the CLI merge replaced the string with
 * the object — so the failing case is precisely the one with no flag, which is
 * what a new user types. Every test below therefore passes NO viewport flag.
 *
 * Second defect, same path: `baseUrl` was required by the schema, so `ibr
 * list` / `ibr status` / `ibr scan-check` also died with a Zod dump in any
 * directory without a config file, despite never using a URL.
 *
 * These spawn `dist/bin/ibr.js` rather than importing: `src/bin/ibr.ts` calls
 * `program.parse()` at module top level and cannot be imported. dist is the
 * right target anyway — plugin installs execute `dist/bin/ibr.js` directly
 * with no npm lifecycle, so the committed bundle IS the shipped artifact, and
 * CI proves it matches src (check-dist-freshness) before this suite runs.
 */

const REPO_ROOT = join(__dirname, '..', '..');
const CLI = join(REPO_ROOT, 'dist', 'bin', 'ibr.js');

/** Commands that reach `createIBR` — the broken path — without a browser. */
const BROWSERLESS_CREATE_IBR_COMMANDS = [['list'], ['status'], ['scan-check'], ['clean', '--dry-run']];

interface RunResult {
  status: number;
  output: string;
}

function runCli(args: string[], cwd: string): RunResult {
  // spawnSync, not execFileSync: execFileSync returns stdout ONLY on success,
  // so a warning written to stderr by a run that still exits 0 would vanish —
  // and "the config file was ignored" is exactly such a warning.
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 60_000,
    // A stray IBR_* var in the developer's shell must not decide the verdict.
    env: { ...process.env, IBR_OBSIDIAN_APP_CSS: '' },
  });
  return {
    status: result.status ?? 1,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? result.error.message : ''}`,
  };
}

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'ibr-first-run-'));
}

describe('first run — `ibr init` then a command with no flags', () => {
  beforeAll(() => {
    // A missing bundle would silently pass every assertion below.
    expect(existsSync(CLI), `${CLI} must exist — run \`npm run build\` first`).toBe(true);
  });

  it('`ibr init` writes a config the CLI can then actually read', () => {
    const dir = tempDir();
    try {
      const init = runCli(['init', '--url', 'http://localhost:3000', '--skip-plugin'], dir);
      expect(init.status, init.output).toBe(0);

      const configPath = join(dir, '.ibrrc.json');
      expect(existsSync(configPath)).toBe(true);

      // The shape `init` chose is the shape the loader must accept. Asserting
      // against the file init WROTE (not a hand-copied literal) is what makes
      // this catch a future divergence in either direction.
      const written = JSON.parse(readFileSync(configPath, 'utf8'));
      expect(typeof written.viewport).toBe('string');
      expect(() => ConfigSchema.parse(mergeCliConfig(normalizeFileConfig(written), {}))).not.toThrow();

      // No -v. This is the invocation that failed.
      const list = runCli(['list'], dir);
      expect(list.status, list.output).toBe(0);
      expect(list.output).not.toMatch(/expected object, received string/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.each(BROWSERLESS_CREATE_IBR_COMMANDS)(
    '`ibr %s` succeeds against an init-written config with no viewport flag',
    (...args: string[]) => {
      const dir = tempDir();
      try {
        expect(runCli(['init', '--url', 'http://localhost:3000', '--skip-plugin'], dir).status).toBe(0);
        const result = runCli(args, dir);
        expect(result.status, result.output).toBe(0);
        expect(result.output).not.toMatch(/expected object, received string/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );

  it.each(BROWSERLESS_CREATE_IBR_COMMANDS)(
    '`ibr %s` succeeds with no config file at all (baseUrl is not needed to list sessions)',
    (...args: string[]) => {
      const dir = tempDir();
      try {
        const result = runCli(args, dir);
        expect(result.status, result.output).toBe(0);
        expect(result.output).not.toMatch(/expected string, received undefined/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );

  it('a viewport typo in the config file names the valid presets instead of dumping Zod', () => {
    const dir = tempDir();
    try {
      writeFileSync(
        join(dir, '.ibrrc.json'),
        JSON.stringify({ baseUrl: 'http://localhost:3000', viewport: 'desktopp' }),
      );
      const result = runCli(['list'], dir);
      expect(result.output).toMatch(/Unknown viewport "desktopp"/);
      expect(result.output).toMatch(/desktop, desktop-lg/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a malformed config file says so by name instead of failing somewhere unrelated', () => {
    const dir = tempDir();
    try {
      writeFileSync(join(dir, '.ibrrc.json'), '{ "baseUrl": "http://x", }');
      const result = runCli(['list'], dir);
      expect(result.status, result.output).toBe(0);
      expect(result.output).toMatch(/\.ibrrc\.json/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('the documented config shape is the shape the code accepts', () => {
  it("README's `.ibrrc.json` example parses (docs are a shipped surface)", () => {
    const readme = readFileSync(join(REPO_ROOT, 'README.md'), 'utf8');
    const anchor = readme.indexOf('create `.ibrrc.json`');
    expect(anchor, 'README must document .ibrrc.json').toBeGreaterThan(0);

    const block = /```json\n([\s\S]*?)```/.exec(readme.slice(anchor));
    expect(block, 'the documented config must be a json code block').not.toBeNull();

    const documented = JSON.parse(block![1]);
    expect(() => ConfigSchema.parse(mergeCliConfig(normalizeFileConfig(documented), {}))).not.toThrow();
  });

  it('every createIBR call site shares the one tested config path', () => {
    // The defect was in the shared path, so the guard is that the path stays
    // shared: a handler that hand-rolled its own merge would reintroduce it
    // for that command alone, and the tests above would still pass.
    const src = readFileSync(join(__dirname, 'ibr.ts'), 'utf8');
    const callSites = [...src.matchAll(/createIBR\(/g)]
      // Skip the declaration itself: `async function createIBR(options...`.
      .filter((m) => !/function createIBR\($/.test(src.slice(0, m.index! + 'createIBR('.length)))
      .map((m) => src.slice(m.index!, m.index! + 'createIBR(program.opts())'.length));
    expect(callSites.length).toBeGreaterThan(5);
    for (const call of callSites) {
      expect(call).toBe('createIBR(program.opts())');
    }
    // And that path normalizes the config file before the schema sees it.
    expect(src).toMatch(/normalizeFileConfig\(JSON\.parse\(content\)\)/);
  });
});
