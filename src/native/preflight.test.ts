/**
 * R5: native env preflight tests.
 *
 * Strategy: drive each branch via the `platformOverride` and
 * extractor/source paths the preflight accepts as parameters. The `swift`
 * and `xcrun` PATH probes are exercised by mutating `preflight._deps.hasCommand`
 * (ESM exports are immutable after binding, so we go through an indirect
 * dep table rather than `vi.spyOn` on the export).
 */

import { describe, it, expect, afterEach } from 'vitest';
import * as preflight from './preflight.js';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const originalHasCommand = preflight._deps.hasCommand;
function setHasCommand(fn: (name: string) => Promise<boolean>) {
  preflight._deps.hasCommand = fn;
}

// ---------------------------------------------------------------------------
// Helpers — sandbox dirs for extractor / source path probes
// ---------------------------------------------------------------------------

function makeSandbox(opts: { withExtractor?: boolean; withSwiftSource?: boolean }) {
  const root = mkdtempSync(join(tmpdir(), 'ibr-preflight-'));
  const extractorDir = join(root, '.ibr', 'bin');
  const swiftDir = join(root, 'src', 'native', 'swift', 'ibr-ax-extract');

  if (opts.withExtractor) {
    mkdirSync(extractorDir, { recursive: true });
    writeFileSync(join(extractorDir, 'ibr-ax-extract'), '');
  }
  if (opts.withSwiftSource) {
    mkdirSync(swiftDir, { recursive: true });
    writeFileSync(join(swiftDir, 'Package.swift'), '// fixture');
  }

  return {
    root,
    extractorBinaryPath: join(extractorDir, 'ibr-ax-extract'),
    swiftSourceDir: swiftDir,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

afterEach(() => {
  preflight._deps.hasCommand = originalHasCommand;
});

// ---------------------------------------------------------------------------
// macOSNativePreflight
// ---------------------------------------------------------------------------

describe('R5: macOSNativePreflight', () => {
  it('returns not-macos on linux', async () => {
    const r = await preflight.macOSNativePreflight({ platformOverride: 'linux' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('not-macos');
      expect(r.message).toMatch(/macOS/);
    }
  });

  it('returns no-swift when `swift` is not on PATH', async () => {
    setHasCommand(async () => false);
    const r = await preflight.macOSNativePreflight({ platformOverride: 'darwin' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('no-swift');
      expect(r.message).toMatch(/xcode-select --install/);
    }
  });

  it('returns extractor-build-failed when neither binary nor source exists', async () => {
    setHasCommand(async () => true);
    const sb = makeSandbox({});
    try {
      const r = await preflight.macOSNativePreflight({
        platformOverride: 'darwin',
        extractorBinaryPath: sb.extractorBinaryPath,
        swiftSourceDir: sb.swiftSourceDir,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.reason).toBe('extractor-build-failed');
        expect(r.message).toMatch(/swift build -c release/);
      }
    } finally {
      sb.cleanup();
    }
  });

  it('passes when binary exists', async () => {
    setHasCommand(async () => true);
    const sb = makeSandbox({ withExtractor: true });
    try {
      const r = await preflight.macOSNativePreflight({
        platformOverride: 'darwin',
        extractorBinaryPath: sb.extractorBinaryPath,
        swiftSourceDir: sb.swiftSourceDir,
      });
      expect(r.ok).toBe(true);
    } finally {
      sb.cleanup();
    }
  });

  it('passes when only Swift source exists (will build on first use)', async () => {
    setHasCommand(async () => true);
    const sb = makeSandbox({ withSwiftSource: true });
    try {
      const r = await preflight.macOSNativePreflight({
        platformOverride: 'darwin',
        extractorBinaryPath: sb.extractorBinaryPath,
        swiftSourceDir: sb.swiftSourceDir,
      });
      expect(r.ok).toBe(true);
    } finally {
      sb.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// simulatorNativePreflight — same branches + xcrun
// ---------------------------------------------------------------------------

describe('R5: simulatorNativePreflight', () => {
  it('returns no-simctl when xcrun is missing but swift exists', async () => {
    setHasCommand(async (name: string) => {
      if (name === 'swift') return true;
      if (name === 'xcrun') return false;
      return false;
    });
    const sb = makeSandbox({ withExtractor: true });
    try {
      const r = await preflight.simulatorNativePreflight({
        platformOverride: 'darwin',
        extractorBinaryPath: sb.extractorBinaryPath,
        swiftSourceDir: sb.swiftSourceDir,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.reason).toBe('no-simctl');
        expect(r.message).toMatch(/xcode-select -s/);
      }
    } finally {
      sb.cleanup();
    }
  });

  it('returns not-macos on linux without probing PATH', async () => {
    const r = await preflight.simulatorNativePreflight({ platformOverride: 'linux' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not-macos');
  });
});

// ---------------------------------------------------------------------------
// classifyExtractorError — AX permission detection
// ---------------------------------------------------------------------------

describe('R5: classifyExtractorError', () => {
  it('classifies AX-permission errors', () => {
    const out = preflight.classifyExtractorError(
      new Error('Accessibility permission required. Grant Terminal/IDE access...'),
    );
    expect(out).not.toBeNull();
    expect(out!.reason).toBe('ax-permission');
    expect(out!.message).toMatch(/System Settings/);
  });

  it('classifies AXIsProcessTrusted errors', () => {
    const out = preflight.classifyExtractorError(new Error('AXIsProcessTrustedWithOptions returned false'));
    expect(out).not.toBeNull();
    expect(out!.reason).toBe('ax-permission');
  });

  it('returns null for unrelated errors', () => {
    expect(preflight.classifyExtractorError(new Error('Network timeout'))).toBeNull();
    expect(preflight.classifyExtractorError('plain string error')).toBeNull();
  });
});
