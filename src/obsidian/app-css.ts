/**
 * Resolve Obsidian's REAL base stylesheet (`app.css`) out of the user's own
 * local Obsidian install.
 *
 * Why this exists
 * ---------------
 * The harness used to inline only the plugin's `styles.css` plus an eight-line
 * block its own comment called an "Obsidian-ish baseline". Two consequences,
 * both measured rather than theorised:
 *
 *   1. Every `var(--text-normal, #fallback)` in plugin CSS resolved to its
 *      FALLBACK, because nothing defined Obsidian's custom properties. The
 *      harness rendered a different palette than the app it claims to model.
 *
 *   2. Obsidian's `app.css` carries a bare element rule —
 *      `button { display: inline-flex; align-items: center; ...;
 *      height: var(--input-height); }` with `body { --input-height: 30px }` —
 *      so a plugin that uses `<button>` as a multi-line layout container gets
 *      its content pinned to 30px and spilling into the row below. Without
 *      app.css the button auto-sizes and the harness renders it perfectly.
 *
 * A harness that cannot see (2) grades the defect PASS. Three consecutive
 * verified-green iterations shipped that bug on a real plugin.
 *
 * Licensing
 * ---------
 * Obsidian's `app.css` is PROPRIETARY and is deliberately NOT vendored into
 * this repository. It is extracted at runtime from the user's own installed
 * copy, cached under the user's cache directory, and never written into a
 * plugin directory or a vault.
 *
 * asar format
 * -----------
 * `obsidian.asar` is an Electron archive: a Chromium "pickle" preamble, then a
 * JSON header describing the file tree, then a flat data region.
 *
 *     [u32 = 4]            pickle payload size of the next field
 *     [u32 headerSize]     bytes from here to the start of the data region
 *     [u32 payloadSize]    pickle payload size of the header JSON field
 *     [u32 jsonLen]        byte length of the header JSON
 *     [jsonLen bytes]      header JSON
 *     ...padding...
 *     [data region]        begins at 8 + headerSize
 *
 * Each entry in `header.files` carries `size` (number) and `offset` (STRING,
 * relative to the start of the data region — not to the start of the file).
 * Verified against the real archive: headerSize 93992 → data region at 94000,
 * `/app.css` offset "0", size 540610 bytes.
 */

import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ResolveAppCssOptions {
  /**
   * Explicit path. A `.css` file is read directly; a `.asar` archive is
   * unpacked. Wins over the environment and over the search path.
   */
  path?: string;
  /** Override the cache directory. Default: the platform user cache dir. */
  cacheDir?: string;
  /** Skip the cache entirely (read straight from the archive). Default false. */
  noCache?: boolean;
  /** Platform to resolve search paths for. Default `process.platform`. */
  platform?: NodeJS.Platform;
  /** Environment to read overrides from. Default `process.env`. */
  env?: NodeJS.ProcessEnv;
}

export interface ResolvedAppCss {
  /** The stylesheet text. */
  css: string;
  /** Where it came from — an `.asar` path, or a `.css` path when overridden. */
  source: string;
  /** Byte length of the stylesheet. */
  bytes: number;
  /** True when this call was served from the on-disk cache. */
  cached: boolean;
}

/** Entry path inside the archive. Obsidian keeps the stylesheet at the root. */
export const APP_CSS_ENTRY = 'app.css';

/** Explicit path to an already-extracted `app.css`, or to an `.asar` archive. */
export const APP_CSS_ENV_VAR = 'IBR_OBSIDIAN_APP_CSS';

// ---------------------------------------------------------------------------
// asar reader
// ---------------------------------------------------------------------------

interface AsarEntry {
  size: number;
  offset: string;
  unpacked?: boolean;
}

interface AsarDirectory {
  files: Record<string, AsarEntry | AsarDirectory>;
}

export interface AsarHeader {
  /** Parsed header JSON — the archive's file tree. */
  header: AsarDirectory;
  /** Absolute byte offset in the archive where the data region begins. */
  dataOffset: number;
  /** Value of the headerSize field, exposed for assertions in tests. */
  headerSize: number;
}

const ASAR_PREAMBLE_BYTES = 16;

function isDirectory(node: AsarEntry | AsarDirectory): node is AsarDirectory {
  return typeof (node as AsarDirectory).files === 'object';
}

/**
 * Read and parse an asar archive's header without loading the archive body.
 *
 * Throws on a malformed archive; callers that must not fail (i.e. all of the
 * public API here) catch.
 */
export function readAsarHeader(asarPath: string): AsarHeader {
  const fd = openSync(asarPath, 'r');
  try {
    const preamble = Buffer.alloc(ASAR_PREAMBLE_BYTES);
    const preambleRead = readSync(fd, preamble, 0, ASAR_PREAMBLE_BYTES, 0);
    if (preambleRead < ASAR_PREAMBLE_BYTES) {
      throw new Error(`archive is shorter than an asar preamble (${preambleRead} bytes)`);
    }

    const headerSize = preamble.readUInt32LE(4);
    const jsonLen = preamble.readUInt32LE(12);

    // Sanity-bound the header before allocating for it: a corrupt or
    // non-asar file would otherwise ask for an arbitrary allocation.
    const archiveBytes = statSync(asarPath).size;
    if (jsonLen === 0 || jsonLen > headerSize || ASAR_PREAMBLE_BYTES + jsonLen > archiveBytes) {
      throw new Error(`implausible asar header (headerSize=${headerSize}, jsonLen=${jsonLen})`);
    }

    const json = Buffer.alloc(jsonLen);
    readSync(fd, json, 0, jsonLen, ASAR_PREAMBLE_BYTES);
    const header = JSON.parse(json.toString('utf8')) as AsarDirectory;

    // `8 + headerSize` — identical arithmetic to the reference reader's
    // `4 + headerSize + 4`, written as one term because both 4s are the pickle
    // payload-size fields that bracket headerSize.
    return { header, dataOffset: 8 + headerSize, headerSize };
  } finally {
    closeSync(fd);
  }
}

/**
 * Read one file out of an asar archive by its path inside the archive.
 * Returns null when the entry is absent, is a directory, or is stored
 * "unpacked" (Electron writes those to a sibling `.asar.unpacked` directory).
 */
export function readAsarEntry(asarPath: string, entryPath: string): Buffer | null {
  const { header, dataOffset } = readAsarHeader(asarPath);

  let node: AsarEntry | AsarDirectory = header;
  for (const segment of entryPath.split('/').filter(Boolean)) {
    if (!isDirectory(node)) return null;
    const next: AsarEntry | AsarDirectory | undefined = node.files[segment];
    if (!next) return null;
    node = next;
  }
  if (isDirectory(node)) return null;
  if (node.unpacked) return null;

  const size = Number(node.size);
  const offset = Number(node.offset);
  if (!Number.isFinite(size) || !Number.isFinite(offset) || size < 0) return null;

  const fd = openSync(asarPath, 'r');
  try {
    const buf = Buffer.alloc(size);
    const read = readSync(fd, buf, 0, size, dataOffset + offset);
    if (read !== size) {
      throw new Error(`short read on ${entryPath}: wanted ${size} bytes, got ${read}`);
    }
    return buf;
  } finally {
    closeSync(fd);
  }
}

// ---------------------------------------------------------------------------
// Install discovery
// ---------------------------------------------------------------------------

/**
 * Candidate `obsidian.asar` locations, most-likely first.
 *
 * Pure and parameterised so the search order is testable on any host — the
 * whole list is exercised in `app-css.test.ts` without a real install.
 */
export function obsidianAsarCandidates(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir(),
): string[] {
  if (platform === 'darwin') {
    return [
      '/Applications/Obsidian.app/Contents/Resources/obsidian.asar',
      join(home, 'Applications/Obsidian.app/Contents/Resources/obsidian.asar'),
    ];
  }
  if (platform === 'win32') {
    const localAppData = env.LOCALAPPDATA ?? join(home, 'AppData/Local');
    const programFiles = env.ProgramFiles ?? 'C:\\Program Files';
    return [
      join(localAppData, 'Obsidian/resources/obsidian.asar'),
      join(programFiles, 'Obsidian/resources/obsidian.asar'),
    ];
  }
  // Linux + anything else that behaves like it. The AppImage cases cover both
  // an extracted `squashfs-root` next to the image and the flatpak layout.
  return [
    '/opt/Obsidian/resources/obsidian.asar',
    '/usr/lib/obsidian/resources/obsidian.asar',
    '/usr/share/obsidian/resources/obsidian.asar',
    '/var/lib/flatpak/app/md.obsidian.Obsidian/current/active/files/obsidian/resources/obsidian.asar',
    join(home, '.local/share/flatpak/app/md.obsidian.Obsidian/current/active/files/obsidian/resources/obsidian.asar'),
    join(home, 'Applications/squashfs-root/resources/obsidian.asar'),
    join(home, '.local/share/obsidian/resources/obsidian.asar'),
    join(home, 'squashfs-root/resources/obsidian.asar'),
  ];
}

/** First candidate that exists on disk, or null. */
export function findObsidianAsar(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir(),
): string | null {
  for (const candidate of obsidianAsarCandidates(platform, env, home)) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

/**
 * Platform user cache directory for IBR's extracted Obsidian assets.
 * Never the plugin directory and never a vault — the subject under test is an
 * INPUT, and writing build artifacts back into it is a side effect nobody
 * asked for (same rule `scanObsidian` applies to the harness HTML).
 */
export function appCssCacheDir(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir(),
): string {
  if (platform === 'darwin') return join(home, 'Library/Caches/ibr/obsidian');
  if (platform === 'win32') {
    return join(env.LOCALAPPDATA ?? join(home, 'AppData/Local'), 'ibr/Cache/obsidian');
  }
  return join(env.XDG_CACHE_HOME ?? join(home, '.cache'), 'ibr/obsidian');
}

/**
 * Cache key: archive size + mtime. An Obsidian update rewrites the archive, so
 * both change and the stale entry is simply never looked up again. Content
 * hashing would cost a 25MB read to answer a question the stat already answers.
 */
export function appCssCacheKey(asarPath: string): string {
  const st = statSync(asarPath);
  return `app-css-${st.size}-${Math.round(st.mtimeMs)}.css`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve Obsidian's real `app.css`.
 *
 * Resolution order:
 *   1. `options.path` — a `.css` file (read directly) or an `.asar` (unpacked).
 *   2. `IBR_OBSIDIAN_APP_CSS` — same two shapes.
 *   3. The platform search path for an installed `obsidian.asar`.
 *
 * NEVER THROWS. Returns null when Obsidian cannot be found or the archive
 * cannot be read, because the caller's correct response is to degrade loudly
 * (a warning in the scan result) rather than to fail the scan.
 */
export function resolveObsidianAppCss(options: ResolveAppCssOptions = {}): ResolvedAppCss | null {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;

  try {
    const explicit = options.path ?? env[APP_CSS_ENV_VAR];
    if (explicit) {
      if (!existsSync(explicit)) return null;
      if (explicit.endsWith('.asar')) return fromAsar(explicit, options, platform, env);
      const css = readFileSync(explicit, 'utf8');
      return { css, source: explicit, bytes: Buffer.byteLength(css), cached: false };
    }

    const asarPath = findObsidianAsar(platform, env);
    if (!asarPath) return null;
    return fromAsar(asarPath, options, platform, env);
  } catch {
    // Corrupt archive, permission denied, unreadable cache — all degrade to
    // "base CSS unavailable", which the harness reports as a WARNING.
    return null;
  }
}

function fromAsar(
  asarPath: string,
  options: ResolveAppCssOptions,
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
): ResolvedAppCss | null {
  const cacheDir = options.cacheDir ?? appCssCacheDir(platform, env);
  const useCache = options.noCache !== true;

  let cachePath: string | undefined;
  if (useCache) {
    try {
      cachePath = join(cacheDir, appCssCacheKey(asarPath));
      if (existsSync(cachePath)) {
        const css = readFileSync(cachePath, 'utf8');
        // A truncated cache write (disk full, interrupted process) must not
        // silently downgrade fidelity — fall through to a fresh extract.
        if (css.length > 0) {
          return { css, source: asarPath, bytes: Buffer.byteLength(css), cached: true };
        }
      }
    } catch {
      cachePath = undefined; // unreadable cache is not fatal
    }
  }

  const buf = readAsarEntry(asarPath, APP_CSS_ENTRY);
  if (!buf || buf.length === 0) return null;
  const css = buf.toString('utf8');

  if (cachePath) {
    try {
      mkdirSync(dirname(cachePath), { recursive: true });
      writeFileSync(cachePath, css, 'utf8');
    } catch {
      // Cache is an optimisation. Failing to write it changes nothing.
    }
  }

  return { css, source: asarPath, bytes: buf.length, cached: false };
}
