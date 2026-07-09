import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const cjsEntrypoint = join(repositoryRoot, 'dist', 'index.js');
const esmEntrypoint = join(repositoryRoot, 'dist', 'index.mjs');

for (const entrypoint of [cjsEntrypoint, esmEntrypoint]) {
  if (!existsSync(entrypoint)) {
    throw new Error(`Missing built package entrypoint: ${entrypoint}. Run npm run build first.`);
  }
}

const checks = [
  {
    label: 'CommonJS export',
    args: ['--input-type=commonjs', '--eval', `require(${JSON.stringify(cjsEntrypoint)});`],
  },
  {
    label: 'ES module export',
    args: ['--input-type=module', '--eval', `await import(${JSON.stringify(pathToFileURL(esmEntrypoint).href)});`],
  },
];

for (const check of checks) {
  const result = spawnSync(process.execPath, check.args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr, result.error?.message].filter(Boolean).join('\n');
    throw new Error(`${check.label} failed:\n${detail}`);
  }
}

console.log('Package export smoke tests passed (CommonJS and ES module).');
