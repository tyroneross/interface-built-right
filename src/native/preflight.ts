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
 * R4 helper: detect when the extracted AX tree is dominated by Simulator.app
 * chrome (toolbar buttons "Home" / "Save Screen" / "Rotate" / "Screenshot")
 * rather than the embedded iOS app. The Swift R4 fix descends past chrome
 * server-side, but if the chrome heuristic misses (e.g. simulator window
 * shape changes in a future Xcode), this check surfaces a one-line
 * "no app foregrounded" hint so the agent can boot/launch the app.
 *
 * Returns null when the tree looks like an app; a hint message when it
 * looks like pure chrome.
 *
 * `topLevelLabels` is the array of root-level element labels (the array
 * returned by `flattenSimulatorElements(elements).slice(0, 10)` or
 * whatever surfaces first to the model).
 */
const SIMULATOR_CHROME_LABELS = new Set([
  'home',
  'save screen',
  'screenshot',
  'rotate',
  'rotate left',
  'rotate right',
  'lock',
  'siri',
  'shake',
  'side button',
  'volume up',
  'volume down',
]);

export function detectSimulatorChromeOnly(
  topLevelLabels: readonly string[],
): { hint: string } | null {
  if (topLevelLabels.length === 0) {
    return {
      hint:
        'Simulator returned no AX elements. Boot a device and foreground an app: ' +
        'xcrun simctl boot <udid> && xcrun simctl launch booted <bundle-id>',
    };
  }
  const normalized = topLevelLabels
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l.length > 0);
  if (normalized.length === 0) return null;
  const chromeCount = normalized.filter((l) => SIMULATOR_CHROME_LABELS.has(l)).length;
  // If 80%+ of top-level labels are chrome, the iOS app is almost certainly
  // not foregrounded (Springboard idle, app not launched).
  if (chromeCount / normalized.length >= 0.8) {
    return {
      hint:
        'Extracted AX tree appears to be Simulator chrome (Home / Save Screen / Rotate). ' +
        'Foreground the iOS app under test: xcrun simctl launch booted <bundle-id>',
    };
  }
  return null;
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
