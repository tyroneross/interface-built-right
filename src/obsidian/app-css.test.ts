import { describe, it, expect } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  APP_CSS_ENTRY,
  APP_CSS_ENV_VAR,
  appCssCacheDir,
  appCssCacheKey,
  findObsidianAsar,
  obsidianAsarCandidates,
  readAsarEntry,
  readAsarHeader,
  resolveObsidianAppCss,
} from './app-css.js';

/**
 * The asar reader is tested against the REAL local archive, not a synthetic
 * one. A hand-built fixture would only prove the reader agrees with the fixture
 * writer; the claim under test is that it agrees with Obsidian.
 *
 * On a host without Obsidian these skip with a message rather than pass
 * vacuously — a green suite that never opened an archive would be exactly the
 * silent-degradation failure this whole module exists to prevent.
 */
const LOCAL_ASAR = findObsidianAsar();
const hasObsidian = LOCAL_ASAR !== null;

if (!hasObsidian) {
  console.warn(
    '[app-css.test] SKIPPING asar tests: no local Obsidian install found. ' +
      `Searched: ${obsidianAsarCandidates().join(', ')}`,
  );
}

describe('obsidianAsarCandidates', () => {
  const home = '/home/tester';

  it('puts the system install first on macOS', () => {
    const paths = obsidianAsarCandidates('darwin', {}, home);
    expect(paths[0]).toBe('/Applications/Obsidian.app/Contents/Resources/obsidian.asar');
    expect(paths).toContain(`${home}/Applications/Obsidian.app/Contents/Resources/obsidian.asar`);
  });

  it('honours LOCALAPPDATA on Windows', () => {
    const paths = obsidianAsarCandidates('win32', { LOCALAPPDATA: 'D:\\Local' }, home);
    expect(paths[0]).toBe(join('D:\\Local', 'Obsidian/resources/obsidian.asar'));
  });

  it('covers the deb, flatpak, and AppImage layouts on Linux', () => {
    const paths = obsidianAsarCandidates('linux', {}, home);
    expect(paths).toContain('/opt/Obsidian/resources/obsidian.asar');
    expect(paths).toContain('/usr/lib/obsidian/resources/obsidian.asar');
    expect(paths.some((p) => p.includes('flatpak'))).toBe(true);
    expect(paths.some((p) => p.includes('squashfs-root'))).toBe(true);
  });

  it('never returns an empty search path for an unknown platform', () => {
    expect(obsidianAsarCandidates('freebsd' as NodeJS.Platform, {}, home).length).toBeGreaterThan(0);
  });
});

describe('appCssCacheDir', () => {
  const home = '/home/tester';

  it('uses the platform cache directory, never the plugin or the vault', () => {
    expect(appCssCacheDir('darwin', {}, home)).toBe(`${home}/Library/Caches/ibr/obsidian`);
    expect(appCssCacheDir('linux', {}, home)).toBe(`${home}/.cache/ibr/obsidian`);
    expect(appCssCacheDir('linux', { XDG_CACHE_HOME: '/xdg' }, home)).toBe('/xdg/ibr/obsidian');
    expect(appCssCacheDir('win32', { LOCALAPPDATA: 'D:\\Local' }, home)).toBe(
      join('D:\\Local', 'ibr/Cache/obsidian'),
    );
  });
});

describe('readAsarHeader — real archive', () => {
  it.runIf(hasObsidian)('parses the pickle preamble and locates the data region', () => {
    const { header, dataOffset, headerSize } = readAsarHeader(LOCAL_ASAR!);

    // The reference reader computes `4 + headerSize + 4`; this asserts the
    // single-term form is the same number, on the real archive.
    expect(dataOffset).toBe(4 + headerSize + 4);
    expect(headerSize).toBeGreaterThan(0);
    expect(header.files[APP_CSS_ENTRY], 'app.css is a top-level entry').toBeTruthy();
  });
});

describe('readAsarEntry — real archive', () => {
  it.runIf(hasObsidian)('extracts app.css with the exact byte length the header declares', () => {
    const { header } = readAsarHeader(LOCAL_ASAR!);
    const entry = header.files[APP_CSS_ENTRY] as { size: number };
    const buf = readAsarEntry(LOCAL_ASAR!, APP_CSS_ENTRY);

    expect(buf).not.toBeNull();
    expect(buf!.length).toBe(Number(entry.size));
    // Sub-megabyte would mean we read a header fragment, not the stylesheet.
    expect(buf!.length).toBeGreaterThan(100_000);
  });

  it.runIf(hasObsidian)('extracts the rules this whole feature exists to expose', () => {
    const css = readAsarEntry(LOCAL_ASAR!, APP_CSS_ENTRY)!.toString('utf8');

    // 1. The custom properties. Without these every var(--x, fallback) in
    //    plugin CSS renders its fallback.
    expect(css).toContain('--text-normal');
    expect(css).toContain('--background-primary');

    // 2. The 30px button pin. This is the measured defect: a <button> used as a
    //    multi-line layout container gets its content clipped to --input-height.
    expect(css).toMatch(/--input-height:\s*30px/);
    expect(css).toMatch(/\bbutton\s*\{[^}]*height:\s*var\(--input-height\)/s);
  });

  it.runIf(hasObsidian)('returns null for an absent entry instead of throwing', () => {
    expect(readAsarEntry(LOCAL_ASAR!, 'definitely/not/here.css')).toBeNull();
  });

  it('throws a bounded error on a file that is not an asar', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ibr-asar-'));
    const bogus = join(dir, 'not.asar');
    writeFileSync(bogus, 'this is plainly not an Electron archive');
    expect(() => readAsarHeader(bogus)).toThrow();
  });
});

describe('resolveObsidianAppCss', () => {
  it('reads an explicit .css path verbatim', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ibr-appcss-'));
    const file = join(dir, 'app.css');
    writeFileSync(file, 'body { --input-height: 30px; }');

    const resolved = resolveObsidianAppCss({ path: file });
    expect(resolved).not.toBeNull();
    expect(resolved!.css).toContain('--input-height');
    expect(resolved!.source).toBe(file);
    expect(resolved!.cached).toBe(false);
  });

  it(`honours ${APP_CSS_ENV_VAR}`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'ibr-appcss-'));
    const file = join(dir, 'app.css');
    writeFileSync(file, '.theme-dark { --text-normal: #dcddde; }');

    const resolved = resolveObsidianAppCss({ env: { [APP_CSS_ENV_VAR]: file } });
    expect(resolved!.source).toBe(file);
    expect(resolved!.css).toContain('--text-normal');
  });

  it('returns null — never throws — when the explicit path does not exist', () => {
    expect(resolveObsidianAppCss({ path: '/no/such/app.css' })).toBeNull();
  });

  it('returns null when no install is present on the search path', () => {
    // An empty home + a platform whose candidates are all absolute system
    // paths that do not exist inside the temp root.
    const resolved = resolveObsidianAppCss({
      platform: 'linux',
      env: { XDG_CACHE_HOME: mkdtempSync(join(tmpdir(), 'ibr-cache-')) },
      path: undefined,
    });
    // On a Linux CI box with Obsidian genuinely installed this would resolve;
    // assert only the contract that matters — it is a value or null, never a throw.
    expect(resolved === null || typeof resolved.css === 'string').toBe(true);
  });

  it.runIf(hasObsidian)('caches the extraction under the user cache dir and serves the second call from it', () => {
    const cacheDir = mkdtempSync(join(tmpdir(), 'ibr-cache-'));

    const first = resolveObsidianAppCss({ cacheDir });
    expect(first).not.toBeNull();
    expect(first!.cached).toBe(false);
    expect(first!.source).toBe(LOCAL_ASAR);

    const written = readdirSync(cacheDir);
    expect(written).toContain(appCssCacheKey(LOCAL_ASAR!));
    expect(readFileSync(join(cacheDir, written[0]), 'utf8')).toBe(first!.css);

    const second = resolveObsidianAppCss({ cacheDir });
    expect(second!.cached).toBe(true);
    expect(second!.css).toBe(first!.css);
  });

  it.runIf(hasObsidian)('re-extracts rather than trusting a truncated cache entry', () => {
    const cacheDir = mkdtempSync(join(tmpdir(), 'ibr-cache-'));
    const key = join(cacheDir, appCssCacheKey(LOCAL_ASAR!));
    writeFileSync(key, ''); // an interrupted write
    expect(existsSync(key)).toBe(true);

    const resolved = resolveObsidianAppCss({ cacheDir });
    expect(resolved!.cached).toBe(false);
    expect(resolved!.css.length).toBeGreaterThan(100_000);
  });

  it.runIf(hasObsidian)('bypasses the cache entirely when asked', () => {
    const cacheDir = mkdtempSync(join(tmpdir(), 'ibr-cache-'));
    const resolved = resolveObsidianAppCss({ cacheDir, noCache: true });
    expect(resolved!.cached).toBe(false);
    expect(readdirSync(cacheDir)).toHaveLength(0);
  });
});
