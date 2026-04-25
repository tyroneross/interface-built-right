#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const packageDir = path.join(root, 'mobile-ui', 'sim-driver');
const outputDir = path.join(root, 'dist', 'bin');
const binaryName = 'ibr-sim-driver';
const builtBinary = path.join(packageDir, '.build', 'release', binaryName);
const outputBinary = path.join(outputDir, binaryName);

if (process.platform !== 'darwin') {
  console.log('Skipping ibr-sim-driver build: macOS required.');
  process.exit(0);
}

if (!fs.existsSync(path.join(packageDir, 'Package.swift'))) {
  console.log('Skipping ibr-sim-driver build: Swift package not found.');
  process.exit(0);
}

const swift = spawnSync('swift', ['build', '--package-path', packageDir, '-c', 'release'], {
  stdio: 'inherit',
});

if (swift.status !== 0) {
  process.exit(swift.status || 1);
}

if (!fs.existsSync(builtBinary)) {
  console.error(`Swift build succeeded, but ${builtBinary} was not created.`);
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });
fs.copyFileSync(builtBinary, outputBinary);
fs.chmodSync(outputBinary, 0o755);
console.log(`Copied ${binaryName} to ${path.relative(root, outputBinary)}`);
