#!/usr/bin/env node
// SPDX-FileCopyrightText: 2025-2026 Tyrone Ross, Jr <46267523+tyroneross@users.noreply.github.com>
// SPDX-License-Identifier: Apache-2.0
/**
 * Fail when the committed `dist/` does not match a build of the committed `src/`.
 *
 * Why this exists: `dist/` is tracked on purpose (.gitignore:4) because plugin
 * installs clone this repo and execute `dist/bin/ibr.js` directly — no npm
 * lifecycle runs, so there is no moment where a build could happen on the
 * installing machine. That makes the committed bundle the shipped artifact.
 *
 * Nothing enforced that the bundle matched its source. CI builds src into a
 * fresh workspace and tests THAT, so it proves "src compiles" and never
 * "committed dist == build(src)". Between 2025-12-30 and 2026-08-28, 27
 * dist-touching commits each arrived carrying 1-17 src-only commits of drift,
 * and one window shipped a stale bundle publicly for four days.
 *
 * `dist/bin/ibr-sim-driver` is excluded: scripts/build-sim-driver.js exits
 * early on non-darwin, so a Linux runner never reproduces it, and a Swift
 * release build is not byte-reproducible across machines anyway. Excluding it
 * keeps this gate precise — a gate that cries wolf gets ignored, which is worse
 * than no gate.
 */

import { spawnSync } from 'node:child_process';

const EXCLUDED = [':(exclude)dist/bin/ibr-sim-driver'];

function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: 'utf8' });
}

function fail(message) {
  console.error(`check-dist-freshness: ${message}`);
  process.exit(1);
}

const shouldBuild = process.argv.includes('--build');

if (shouldBuild) {
  const built = run('npm', ['run', 'build']);
  if (built.status !== 0) {
    console.error(built.stdout || '');
    console.error(built.stderr || '');
    fail('build failed, so dist freshness could not be determined');
  }
}

const diff = run('git', ['diff', '--name-only', '--', 'dist', ...EXCLUDED]);
if (diff.status !== 0) {
  console.error(diff.stderr || '');
  fail('could not read `git diff` for dist');
}

const changed = diff.stdout.split('\n').map((l) => l.trim()).filter(Boolean);

if (changed.length === 0) {
  console.log('check-dist-freshness: committed dist matches a build of committed src.');
  process.exit(0);
}

console.error('check-dist-freshness: committed dist does NOT match a build of committed src.');
console.error('');
console.error('Stale files:');
for (const file of changed) console.error(`  ${file}`);
console.error('');
console.error('Installs run the committed bundle directly, so these changes have not');
console.error('reached anyone. Rebuild and commit dist:');
console.error('');
console.error('    npm run build && git add dist && git commit -m "build(dist): rebuild the tracked bundle"');
console.error('');
console.error('If a working-tree change to src/ is responsible, commit or stash it first —');
console.error('otherwise the rebuild bakes unreviewed work into the shipped artifact.');
process.exit(1);
