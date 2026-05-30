/**
 * R5: native env preflight — turn raw tracebacks into one-line fixable errors.
 *
 * Pre-R5, native_session_start and sim_action would surface raw Swift / shell
 * tracebacks for predictable environment problems (Xcode missing, Swift
 * extractor unbuilt, simulator tools missing, AX permission denied). The
 * preflight detects each branch and returns a one-line fix instruction.
 *
 * Caller pattern:
 *
 *   const pre = await macOSNativePreflight();
 *   if (!pre.ok) return errorResponse(pre.message);
 *
 * All probes are wrapped in try/catch; preflight itself never throws.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';

const execFileAsync = promisify(execFile);

export interface PreflightOk {
  ok: true;
}

export interface PreflightFail {
  ok: false;
  /** One-line, actionable. Includes the exact command to run when possible. */
  message: string;
  /** Stable identifier for tests + telemetry. */
  reason:
    | 'not-macos'
    | 'no-swift'
    | 'no-simctl'
    | 'extractor-build-failed'
    | 'ax-permission';
}

export type PreflightResult = PreflightOk | PreflightFail;

/**
 * Whether to treat this platform as macOS. Exposed so tests can override.
 */
export function isMacOS(platformOverride?: NodeJS.Platform): boolean {
  return (platformOverride ?? process.platform) === 'darwin';
}

/**
 * Check that a CLI tool is on PATH.
 * Returns true if `which <name>` succeeds.
 *
 * Indirected through `_deps.hasCommand` so tests can override without
 * touching the host's PATH (ESM exports are immutable after binding).
 */
async function defaultHasCommand(name: string): Promise<boolean> {
  try {
    await execFileAsync('which', [name]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Mutable dependency table for tests. Production code does not touch this.
 */
export const _deps = {
  hasCommand: defaultHasCommand,
};

export async function hasCommand(name: string): Promise<boolean> {
  return _deps.hasCommand(name);
}

/**
 * Preflight for macOS-app native sessions (AXUIElement on a running app).
 *
 * Branches in evaluation order:
 *   1. Not on macOS → "Native sessions require macOS."
 *   2. `swift` not on PATH → "Xcode Command Line Tools missing. Install with: xcode-select --install"
 *   3. Extractor build is broken → exact rebuild command
 *
 * AX-permission failures are detected by the extractor itself (the Swift
 * binary writes the System Settings hint to stderr); we surface that as
 * 'ax-permission' when the caller hands the error back via
 * `classifyExtractorError()`.
 */
export async function macOSNativePreflight(options?: {
  platformOverride?: NodeJS.Platform;
  extractorBinaryPath?: string;
  swiftSourceDir?: string;
}): Promise<PreflightResult> {
  if (!isMacOS(options?.platformOverride)) {
    return {
      ok: false,
      reason: 'not-macos',
      message:
        'Native sessions require macOS — process.platform is ' +
        `'${options?.platformOverride ?? process.platform}'. ` +
        'Use a Mac to run macOS / iOS-simulator AX sessions.',
    };
  }

  if (!(await _deps.hasCommand('swift'))) {
    return {
      ok: false,
      reason: 'no-swift',
      message:
        'Xcode Command Line Tools missing — `swift` not on PATH. ' +
        'Install with: xcode-select --install',
    };
  }

  // Check the compiled extractor OR the Swift source dir we can build from.
  const extractorPath =
    options?.extractorBinaryPath ??
    join(process.cwd(), '.ibr', 'bin', 'ibr-ax-extract');
  const swiftSourceDir =
    options?.swiftSourceDir ??
    join(process.cwd(), 'src', 'native', 'swift', 'ibr-ax-extract');

  if (!existsSync(extractorPath) && !existsSync(join(swiftSourceDir, 'Package.swift'))) {
    return {
      ok: false,
      reason: 'extractor-build-failed',
      message:
        `Swift AX extractor unavailable. Expected binary at ${extractorPath} ` +
        `or source at ${swiftSourceDir}. ` +
        'Rebuild with: cd <ibr-package>/src/native/swift/ibr-ax-extract && swift build -c release',
    };
  }

  return { ok: true };
}

/**
 * Preflight for iOS / watchOS simulator sessions.
 *
 * Extends `macOSNativePreflight` with `xcrun simctl` availability — sim
 * actions also go through the simulator (Swift binary reads
 * Simulator.app's AX tree, but boot/listapps/openurl use `xcrun simctl`).
 */
export async function simulatorNativePreflight(options?: {
  platformOverride?: NodeJS.Platform;
  extractorBinaryPath?: string;
  swiftSourceDir?: string;
}): Promise<PreflightResult> {
  const base = await macOSNativePreflight(options);
  if (!base.ok) return base;

  if (!(await _deps.hasCommand('xcrun'))) {
    return {
      ok: false,
      reason: 'no-simctl',
      message:
        '`xcrun` not on PATH — Xcode (or the Command Line Tools select) is required. ' +
        'Install Xcode from the App Store, then run: ' +
        'sudo xcode-select -s /Applications/Xcode.app/Contents/Developer',
    };
  }

  return { ok: true };
}

/**
 * Map a raw extractor / Swift error message back to a preflight verdict.
 * Used by callers that already attempted the AX extraction and want to
 * re-classify the failure as a one-liner.
 *
 * Currently handles: AX permission denied. Extend as new failure modes
 * surface in the transcript audit.
 */
export function classifyExtractorError(err: unknown): PreflightFail | null {
  const msg = err instanceof Error ? err.message : String(err);
  if (/accessibility|AX(Is)?ProcessTrusted|permission/i.test(msg)) {
    return {
      ok: false,
      reason: 'ax-permission',
      message:
        'macOS accessibility permission denied. ' +
        'Grant access in System Settings → Privacy & Security → Accessibility, ' +
        'then re-run the session_start call.',
    };
  }
  return null;
}
