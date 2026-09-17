import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { isExtractorAvailable, requestAccessibilityPermission, resolveSwiftSourceDir } from './extract.js';

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

function makePackagedLibrary(): { runtimeDir: string; swiftDir: string } {
  const root = mkdtempSync(join(tmpdir(), 'ibr-packaged-library-'));
  sandboxes.push(root);
  const runtimeDir = join(root, 'dist');
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

  it('finds the bundled Swift package from the package-root dist entrypoint', () => {
    const fixture = makePackagedLibrary();
    expect(resolveSwiftSourceDir(fixture.runtimeDir)).toBe(fixture.swiftDir);
  });
});

describe('requestAccessibilityPermission', () => {
  it('runs the extractor exactly once with --request-permission and reports trusted', async () => {
    const calls: string[][] = [];
    const result = await requestAccessibilityPermission({
      ensure: async () => '/fake/ibr-ax-extract',
      run: async (_bin, args) => {
        calls.push(args);
        return { stdout: '{"trusted":true}', stderr: '' };
      },
    });
    expect(calls).toEqual([['--request-permission']]);
    expect(result.trusted).toBe(true);
  });

  it('surfaces the extractor stderr on exit 77 without retrying', async () => {
    let calls = 0;
    const stderr =
      'Error: Accessibility permission required. IBR already showed the macOS permission prompt ' +
      '(2026-09-17T00:00:00Z) and will not show it again.';
    const result = await requestAccessibilityPermission({
      ensure: async () => '/fake/ibr-ax-extract',
      run: async () => {
        calls += 1;
        throw Object.assign(new Error('Command failed'), { code: 77, stderr });
      },
    });
    expect(calls).toBe(1);
    expect(result).toEqual({ trusted: false, message: stderr });
  });
});

describe('Swift extractor never prompts outside the once-only gate', () => {
  it('passes kAXTrustedCheckOptionPrompt: true only in Permission.swift', () => {
    const sources = join(resolveSwiftSourceDir(), 'Sources');
    const offenders = readdirSync(sources)
      .filter((f) => f.endsWith('.swift') && f !== 'Permission.swift')
      .filter((f) => /kAXTrustedCheckOptionPrompt[^\n]*:\s*true/.test(readFileSync(join(sources, f), 'utf8')));
    expect(offenders).toEqual([]);
    const gate = readFileSync(join(sources, 'Permission.swift'), 'utf8');
    expect(gate.match(/kAXTrustedCheckOptionPrompt[^\n]*:\s*true/g)).toHaveLength(1);
  });
});
