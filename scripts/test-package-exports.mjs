import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const cjsEntrypoint = join(repositoryRoot, 'dist', 'index.js');
const esmEntrypoint = join(repositoryRoot, 'dist', 'index.mjs');
const engineCjsEntrypoint = join(repositoryRoot, 'dist', 'engine', 'index.js');
const engineEsmEntrypoint = join(repositoryRoot, 'dist', 'engine', 'index.mjs');
const swiftPackage = join(repositoryRoot, 'src', 'native', 'swift', 'ibr-ax-extract', 'Package.swift');

for (const entrypoint of [cjsEntrypoint, esmEntrypoint, engineCjsEntrypoint, engineEsmEntrypoint]) {
  if (!existsSync(entrypoint)) {
    throw new Error(`Missing built package entrypoint: ${entrypoint}. Run npm run build first.`);
  }
}
if (!existsSync(swiftPackage)) {
  throw new Error(`Missing bundled native extractor source: ${swiftPackage}`);
}

const checks = [
  {
    label: 'CommonJS export',
    args: ['--input-type=commonjs', '--eval', `const api=require(${JSON.stringify(cjsEntrypoint)}); if(typeof api.recordExternalActionEvidence!=="function"||typeof api.createExternalActionReceipt!=="function") process.exit(1);`],
  },
  {
    label: 'ES module export',
    args: ['--input-type=module', '--eval', `const api=await import(${JSON.stringify(pathToFileURL(esmEntrypoint).href)}); if(typeof api.recordExternalActionEvidence!=="function"||typeof api.createExternalActionReceipt!=="function") process.exit(1);`],
  },
  {
    label: 'Engine subpath — CommonJS export',
    args: ['--input-type=commonjs', '--eval', `const api=require(${JSON.stringify(engineCjsEntrypoint)}); if(typeof api.EngineDriver!=="function"||typeof api.CompatPage!=="function") process.exit(1);`],
  },
  {
    label: 'Engine subpath — ES module export',
    args: ['--input-type=module', '--eval', `const api=await import(${JSON.stringify(pathToFileURL(engineEsmEntrypoint).href)}); if(typeof api.EngineDriver!=="function"||typeof api.CompatPage!=="function") process.exit(1);`],
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

console.log('Package export smoke tests passed (CommonJS, ES module, engine subpath, evidence API, native source).');
