import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { isExtractorAvailable, resolveSwiftSourceDir } from './extract.js';

const sandboxes: string[] = [];

afterEach(() => {
  for (const sandbox of sandboxes.splice(0)) {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

function makePackagedCLI(): { runtimeDir: string; swiftDir: string } {
  const root = mkdtempSync(join(tmpdir(), 'ibr-packaged-cli-'));
  sandboxes.push(root);
  const runtimeDir = join(root, 'dist', 'bin');
  const swiftDir = join(root, 'src', 'native', 'swift', 'ibr-ax-extract');
  mkdirSync(runtimeDir, { recursive: true });
  mkdirSync(swiftDir, { recursive: true });
  writeFileSync(join(swiftDir, 'Package.swift'), '// fixture');
  return { runtimeDir, swiftDir };
}

describe('resolveSwiftSourceDir', () => {
  it('locates the bundled Swift package from the source module', () => {
    expect(isExtractorAvailable()).toBe(true);
  });

  it('finds the bundled Swift package from dist/bin', () => {
    const fixture = makePackagedCLI();
    expect(resolveSwiftSourceDir(fixture.runtimeDir)).toBe(fixture.swiftDir);
  });
});
