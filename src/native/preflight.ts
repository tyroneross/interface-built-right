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
 * R4/D1 helper: detect when the extracted AX tree does not represent the
 * embedded iOS/watchOS app under test. Two distinct failure shapes land here:
 *
 *   1. Simulator toolbar chrome ("Home" / "Save Screen" / "Rotate" /
 *      "Screenshot") — the app is not foregrounded (Springboard idle, app
 *      not launched). Detected by label, since these are UI labels with no
 *      distinguishing AX role.
 *   2. Host-process chrome (`AXApplication` "Simulator", `AXMenuBar`,
 *      `AXMenuBarItem`, `AXMenu`, `AXMenuItem`) — the guest accessibility
 *      tree is not bridged into the macOS host process at all (Xcode 12+).
 *      This is not "no app foregrounded"; it is "this process cannot see
 *      app content, full stop." Detected by AX role, when role information
 *      is available to the caller.
 *
 * Returns null when the tree looks like real app content; a hint + reason
 * when it looks like chrome of either kind.
 *
 * Accepts either the legacy `readonly string[]` of labels (role-blind, only
 * the label-based toolbar-chrome rule applies) or a
 * `readonly { role?: string | null; label?: string | null }[]` census of the
 * FULL candidate list (not just the first N — host-chrome menu items can sit
 * anywhere in a 50+ element tree), which additionally enables the
 * role-based host-chrome rule.
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

/**
 * macOS host-process AX roles. When every element in the extracted tree
 * carries one of these roles, the tree is Simulator.app's own application /
 * menu bar structure — not the guest app's accessibility tree. Mirrors
 * `HOST_CHROME_TAGS` in scan.ts (there expressed as mapped tag names).
 */
const HOST_CHROME_ROLES = new Set([
  'AXApplication',
  'AXMenuBar',
  'AXMenuBarItem',
  'AXMenu',
  'AXMenuItem',
]);

export interface SimulatorElementCensusEntry {
  role?: string | null;
  label?: string | null;
}

export function detectSimulatorChromeOnly(
  topLevelLabels: readonly string[],
): { hint: string; reason: 'empty' | 'host-chrome' | 'sim-toolbar' } | null;
export function detectSimulatorChromeOnly(
  candidates: readonly SimulatorElementCensusEntry[],
): { hint: string; reason: 'empty' | 'host-chrome' | 'sim-toolbar' } | null;
export function detectSimulatorChromeOnly(
  input: readonly string[] | readonly SimulatorElementCensusEntry[],
): { hint: string; reason: 'empty' | 'host-chrome' | 'sim-toolbar' } | null {
  if (input.length === 0) {
    return {
      reason: 'empty',
      hint:
        'Simulator returned no AX elements. Boot a device and foreground an app: ' +
        'xcrun simctl boot <udid> && xcrun simctl launch booted <bundle-id>',
    };
  }

  const isCensus = typeof input[0] !== 'string';

  if (isCensus) {
    const census = input as readonly SimulatorElementCensusEntry[];
    // 100%, not a percentage threshold: a real app tree can legitimately
    // include an AXApplication root among genuine app content, so anything
    // less than "every single element is host chrome" is not conclusive.
    // Mirrors the conservative rule scan.ts:114 already uses
    // (`allMapped.length > 0 && filtered.length === 0`).
    const allHostChrome = census.every(
      (c) => c.role != null && HOST_CHROME_ROLES.has(c.role),
    );
    if (allHostChrome) {
      return {
        reason: 'host-chrome',
        hint:
          'Guest accessibility tree is unreachable from this process — only ' +
          'Simulator.app host chrome (application / menu bar) was returned. ' +
          'No app accessibility data was captured, so this result is NOT ' +
          'evidence about the app under test (neither "empty" nor "clean"). ' +
          'Use a screenshot-driven workflow, or install IDB and route through ' +
          '`idb accessibility info`.',
      };
    }
  }

  const labels: readonly string[] = isCensus
    ? (input as readonly SimulatorElementCensusEntry[]).map((c) => c.label ?? '')
    : (input as readonly string[]);

  const normalized = labels
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l.length > 0);
  if (normalized.length === 0) return null;
  const chromeCount = normalized.filter((l) => SIMULATOR_CHROME_LABELS.has(l)).length;
  // If 80%+ of top-level labels are chrome, the iOS app is almost certainly
  // not foregrounded (Springboard idle, app not launched).
  if (chromeCount / normalized.length >= 0.8) {
    return {
      reason: 'sim-toolbar',
      hint:
        'Extracted AX tree appears to be Simulator chrome (Home / Save Screen / Rotate). ' +
        'Foreground the iOS app under test: xcrun simctl launch booted <bundle-id>',
    };
  }
  return null;
}

/**
 * Exit code the Swift extractor uses when Accessibility is not granted (EX_NOPERM).
 * Mirrors `accessibilityUntrustedExitCode` in swift/ibr-ax-extract/Sources/Permission.swift.
 */
export const ACCESSIBILITY_UNTRUSTED_EXIT_CODE = 77;

/** CLI command that opens the macOS Accessibility prompt and settings pane when access is missing. */
export const REQUEST_PERMISSION_COMMAND = 'ibr native:request-permission';

/**
 * Map a raw extractor / Swift error message back to a preflight verdict.
 * Used by callers that already attempted the AX extraction and want to
 * re-classify the failure as a one-liner.
 *
 * Passive by design: this never spawns the extractor and never retries. The
 * extractor itself only shows the macOS Accessibility prompt when invoked with
 * `--request-permission` (the explicit `ibr native:request-permission`), so
 * callers must surface this message rather than re-running the extraction.
 *
 * Currently handles: AX permission denied. Extend as new failure modes
 * surface in the transcript audit.
 */
export function classifyExtractorError(err: unknown): PreflightFail | null {
  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: unknown } | null)?.code;
  if (code === ACCESSIBILITY_UNTRUSTED_EXIT_CODE || /accessibility|AX(Is)?ProcessTrusted|permission/i.test(msg)) {
    // Prefer the extractor's own guidance: it knows whether the prompt was
    // already shown and names the exact re-request step.
    const swiftLine = msg
      .split('\n')
      .map((line) => line.trim())
      .find((line) => /^Error: Accessibility permission required\./.test(line) || /^Accessibility permission required\. IBR showed/.test(line));
    return {
      ok: false,
      reason: 'ax-permission',
      message: swiftLine
        ? swiftLine.replace(/^Error: /, '')
        : 'macOS accessibility permission denied. ' +
          'Grant access to your terminal or IDE in System Settings → Privacy & Security → Accessibility, ' +
          'then quit and reopen it and re-run the session_start call. ' +
          `IBR does not re-open the permission prompt automatically; to show it once, run: ${REQUEST_PERMISSION_COMMAND}`,
    };
  }
  return null;
}
