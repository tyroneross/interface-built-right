// SPDX-FileCopyrightText: 2025-2026 Tyrone Ross, Jr <46267523+tyroneross@users.noreply.github.com>
// SPDX-License-Identifier: Apache-2.0
/**
 * The dist-freshness gate guards a failure that is invisible to every other
 * check: a tracked bundle that no longer matches the source it was built from.
 * A gate nobody has seen fail is not evidence, so these tests plant the defect
 * and assert the gate convicts it.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = join(process.cwd(), 'scripts', 'check-dist-freshness.mjs');

let repo: string;

function git(...args: string[]) {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r;
}

function runGate() {
  return spawnSync('node', [SCRIPT], { cwd: repo, encoding: 'utf8' });
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'ibr-dist-gate-'));
  git('init', '-q');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  mkdirSync(join(repo, 'dist', 'bin'), { recursive: true });
  writeFileSync(join(repo, 'dist', 'index.js'), 'console.log(1);\n');
  writeFileSync(join(repo, 'dist', 'bin', 'ibr-sim-driver'), 'binary-placeholder\n');
  git('add', '.');
  git('commit', '-qm', 'seed');
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('check-dist-freshness', () => {
  it('passes when the tree matches the committed bundle', () => {
    const r = runGate();
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('matches');
  });

  it('fails and names the file when a bundled artifact drifts', () => {
    writeFileSync(join(repo, 'dist', 'index.js'), 'console.log(2);\n');
    const r = runGate();
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('does NOT match');
    expect(r.stderr).toContain('dist/index.js');
  });

  it('tells the reader how to repair it rather than only that it failed', () => {
    writeFileSync(join(repo, 'dist', 'index.js'), 'console.log(3);\n');
    expect(runGate().stderr).toContain('npm run build');
  });

  it('ignores the Swift sim-driver, which no Linux runner can reproduce', () => {
    writeFileSync(join(repo, 'dist', 'bin', 'ibr-sim-driver'), 'rebuilt-elsewhere\n');
    const r = runGate();
    expect(r.status).toBe(0);
  });

  it('still convicts a real drift that arrives alongside a sim-driver change', () => {
    writeFileSync(join(repo, 'dist', 'bin', 'ibr-sim-driver'), 'rebuilt-elsewhere\n');
    writeFileSync(join(repo, 'dist', 'index.js'), 'console.log(4);\n');
    const r = runGate();
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('dist/index.js');
    expect(r.stderr).not.toContain('ibr-sim-driver');
  });
});
