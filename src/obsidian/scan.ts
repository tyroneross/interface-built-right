import { writeFileSync, readFileSync, existsSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scan, type ScanResult, type ScanIssue, type ScanOptions } from '../scan.js';
import { VIEWPORTS } from '../schemas.js';
import type { Viewport } from '../types.js';
import { generateHarness, resolvePluginPaths, type HarnessInput } from './harness.js';
import { serveHarness } from './server.js';

/**
 * scanObsidian — mount an Obsidian plugin view in a real browser and run IBR's
 * standard scan against it.
 *
 * The point of this module is that the subject is REAL: `var()` resolves, the
 * cascade applies, grid and flex lay out, `::before` paints, and boxes have
 * measured geometry. Static parsing (`scan_static`) can answer none of those —
 * see `src/static/README.md`, which documents its own regex parser as unable to
 * compute values, layout, or pseudo-elements.
 */

export interface ObsidianScanOptions {
  /** Plugin directory (containing main.js/styles.css) or a direct main.js path. */
  pluginPath: string;
  /** Exported view class name, e.g. "DailyPlannerView". */
  viewClass: string;
  /** Override the auto-resolved bundle path. */
  bundlePath?: string;
  /** Override the auto-resolved stylesheet path. */
  stylesPath?: string;
  /** Viewport preset name, device slug, or explicit viewport. Default: iphone-14 (390px). */
  viewport?: string | Viewport;
  /**
   * `Platform.isMobile`. Default: inferred from viewport width (<= 480 → true).
   * Explicit values win — a plugin's mobile branch is a behavioral fork, not a
   * styling one, so guessing silently would be the wrong kind of convenient.
   */
  mobile?: boolean;
  /** Obsidian theme class on <body>. Default: dark. */
  theme?: 'dark' | 'light';
  /** Properties assigned onto the view before render (the fixture). */
  viewState?: Record<string, unknown>;
  /** JSON file supplying `viewState`. Merged under inline `viewState`. */
  viewStatePath?: string;
  /** Properties assigned onto the fake plugin passed to the view constructor. */
  pluginState?: Record<string, unknown>;
  /** JS evaluated after mount; `view` and `root` are in scope. */
  postMount?: string;
  /** Extra CSS appended after the plugin stylesheet. */
  extraCss?: string;
  /** Write the generated harness here. Default: a tmp dir (never the vault). */
  harnessOut?: string;
  /** Rule presets forwarded to scan(). Default: touch-targets + wcag-contrast. */
  rules?: string[];
  /** Screenshot path forwarded to scan(). */
  screenshot?: string;
  /** Page-load timeout in ms. */
  timeout?: number;
  /** How long to wait for the mount marker before calling the mount failed. Default 10000. */
  mountTimeout?: number;
}

export interface ObsidianScanResult extends ScanResult {
  /** Where the harness came from and what it mounted. */
  harness: {
    path: string;
    url: string;
    bundlePath: string;
    stylesPath?: string;
    viewClass: string;
    mobile: boolean;
    theme: 'dark' | 'light';
  };
}

const MOBILE_WIDTH_CEILING = 480;
const HARNESS_ERROR_PREFIXES = ['IBR obsidian-harness:', 'IBR obsidian-stub:'];

/**
 * The mount script sets `data-ibr-mount` on <body> whether it succeeds or fails,
 * so the attribute's ABSENCE means the mount script never ran at all — a
 * SyntaxError in an injected `postMount` snippet, say. That failure mode is
 * invisible to console capture (Chrome reports parse errors via
 * `Runtime.exceptionThrown`, and IBR's console domain subscribes only to
 * `Runtime.consoleAPICalled`), so the selector wait is the only thing that
 * catches it.
 */
const MOUNT_SELECTOR = '[data-ibr-mount]';

/**
 * `scan()` computes `waitForTimedOut` but only ACTS on it when `patience` is set
 * (`src/scan.ts:387` catches the timeout; `src/scan.ts:568` is the only reader,
 * and it is gated on `patience`). Without patience a missing mount marker is
 * silently ignored and the scan grades a blank page. Setting patience is what
 * turns the wait into a real gate.
 */
const DEFAULT_MOUNT_TIMEOUT_MS = 10000;

/** Resolve a viewport name/slug/object into a concrete Viewport. Default 390px. */
export function resolveObsidianViewport(viewport: ObsidianScanOptions['viewport']): Viewport {
  if (!viewport) return VIEWPORTS['iphone-14'] ?? VIEWPORTS.mobile;
  if (typeof viewport !== 'string') return viewport;
  const preset = (VIEWPORTS as Record<string, Viewport>)[viewport];
  if (!preset) {
    const names = Object.keys(VIEWPORTS).join(', ');
    throw new Error(`Unknown viewport "${viewport}". Known: ${names}`);
  }
  return preset;
}

/**
 * Turn harness/stub failures captured on the console into first-class scan
 * issues.
 *
 * This is the guard against the worst failure mode of this tool: if the view
 * throws during mount, the page is EMPTY, and an empty page has no collisions,
 * no contrast failures, and no undersized targets — it scans as a serene PASS.
 * A green verdict over a blank page is worse than no tool at all, so any harness
 * error is promoted to `severity: error` and the verdict is recomputed.
 */
export function deriveHarnessIssues(consoleErrors: string[]): ScanIssue[] {
  return consoleErrors
    .filter((line) => HARNESS_ERROR_PREFIXES.some((prefix) => line.includes(prefix)))
    .map((line) => ({
      category: 'structure' as const,
      severity: 'error' as const,
      description: line,
      fix: line.includes('unstubbed API')
        ? 'Add the named export to src/obsidian/stub.ts, or supply it via pluginState.'
        : 'The view failed to mount — every other finding in this scan is unreliable until it does.',
    }));
}

/**
 * True when `scan()` reported PARTIAL in a way that implicates the mount marker.
 *
 * `scan()` phrases a lone selector timeout as "selector not found" — but its
 * reason string is a ternary (`src/scan.ts:571`) that reports only "network
 * still active" when BOTH the network-idle and selector waits time out, which
 * would hide the mount signal behind the network one.
 *
 * That second phrasing counts here too, because this harness has no
 * subresources at all (see server.ts) — a network wait cannot legitimately time
 * out on a page that never requests anything, so either phrasing means the page
 * failed to reach a mounted state and nothing measured from it can be trusted.
 */
export function isMountMarkerMissing(result: Pick<ScanResult, 'verdict' | 'partialReason'>): boolean {
  if (result.verdict !== 'PARTIAL') return false;
  return /selector not found|network still active/i.test(result.partialReason ?? '');
}

/**
 * `scan()` already folds console errors into issues as `Console error: <line>`
 * (IssueCollector.addConsoleErrors). Our harness issues carry the same lines
 * with a better category and fix, and dedupe is by exact description, so both
 * copies would otherwise survive and each failure would be reported twice.
 */
function dropDuplicatedConsoleIssues(issues: ScanIssue[]): ScanIssue[] {
  return issues.filter(
    (issue) =>
      !(
        issue.category === 'console' &&
        HARNESS_ERROR_PREFIXES.some((prefix) => issue.description.includes(prefix))
      ),
  );
}

/** Infer Platform.isMobile from viewport width when the caller did not say. */
export function inferMobile(explicit: boolean | undefined, viewport: Viewport): boolean {
  if (explicit !== undefined) return explicit;
  return viewport.width <= MOBILE_WIDTH_CEILING;
}

function loadViewState(options: ObsidianScanOptions): Record<string, unknown> {
  const fromFile: Record<string, unknown> = {};
  if (options.viewStatePath) {
    if (!existsSync(options.viewStatePath)) {
      throw new Error(`view state file not found: ${options.viewStatePath}`);
    }
    Object.assign(fromFile, JSON.parse(readFileSync(options.viewStatePath, 'utf8')));
  }
  return { ...fromFile, ...(options.viewState ?? {}) };
}

/**
 * Generate the harness, serve it on loopback, and scan it.
 *
 * Note it deliberately does NOT take a warm BrowserPool. `ScanOptions.pool`
 * documents that "per-scan viewport is NOT re-applied on a pooled driver — the
 * pool's launch viewport is sticky for the process", and an exact viewport is
 * the whole premise of a mobile-layout audit. Correct pixels beat a warm start.
 */
export async function scanObsidian(options: ObsidianScanOptions): Promise<ObsidianScanResult> {
  const resolved = resolvePluginPaths(options.pluginPath);
  const bundlePath = options.bundlePath ?? resolved.bundlePath;
  const stylesPath = options.stylesPath ?? resolved.stylesPath;
  const viewport = resolveObsidianViewport(options.viewport);
  const mobile = inferMobile(options.mobile, viewport);
  const theme = options.theme ?? 'dark';

  const harnessInput: HarnessInput = {
    bundlePath,
    stylesPath,
    viewClass: options.viewClass,
    mobile,
    theme,
    viewState: loadViewState(options),
    pluginState: options.pluginState,
    postMount: options.postMount,
    extraCss: options.extraCss,
  };

  const html = generateHarness(harnessInput);

  // Default to a tmp dir: the plugin under test is an input, and writing build
  // artifacts back into someone's vault would be a side effect nobody asked for.
  const harnessPath =
    options.harnessOut ?? join(mkdtempSync(join(tmpdir(), 'ibr-obsidian-')), 'harness.html');
  writeFileSync(harnessPath, html, 'utf8');

  const server = await serveHarness(html);
  try {
    const mountTimeout = options.mountTimeout ?? DEFAULT_MOUNT_TIMEOUT_MS;
    const scanOptions: ScanOptions = {
      viewport,
      rules: options.rules ?? ['touch-targets', 'wcag-contrast'],
      // The harness is a plain script — no framework to hydrate. The wait would
      // only add latency.
      hydrationStrategy: 'none',
      waitFor: MOUNT_SELECTOR,
      // Not "be patient" — this is what makes the waitFor above a real gate
      // rather than an ignored return value. See DEFAULT_MOUNT_TIMEOUT_MS.
      patience: mountTimeout,
      timeout: options.timeout ?? 30000,
      screenshot: options.screenshot ? { path: options.screenshot } : undefined,
    };

    const result = (await scan(server.url, scanOptions)) as ObsidianScanResult;

    // A failed mount leaves an EMPTY page, and an empty page has no collisions,
    // no contrast failures, and no undersized targets — it grades as a serene
    // PASS. A green verdict over a blank page is worse than no tool at all, so
    // mount failure is FATAL BY CATEGORY, not by error count. (Counting would
    // score a mount failure at 2 errors — below determineVerdict's `>= 3` FAIL
    // threshold — and report "ISSUES" for a view that never rendered.)
    const harnessIssues = deriveHarnessIssues(result.console.errors);

    if (isMountMarkerMissing(result)) {
      result.issues = [
        {
          category: 'structure',
          severity: 'error',
          description: `Harness mount marker ${MOUNT_SELECTOR} never appeared after ${mountTimeout}ms — the mount script did not run to completion. Every other finding in this scan is unreliable.`,
          fix: 'Open the harness HTML (see harness.path) in a browser and read the console. A syntax error in post_mount is the usual cause.',
        },
        ...result.issues,
      ];
      result.verdict = 'FAIL';
    } else if (harnessIssues.length > 0) {
      result.issues = [...harnessIssues, ...dropDuplicatedConsoleIssues(result.issues)];
      result.verdict = 'FAIL';
    }
    // Otherwise scan()'s own verdict stands — including PARTIAL, which
    // determineVerdict() cannot express and would silently upgrade.

    result.harness = {
      path: harnessPath,
      url: server.url,
      bundlePath,
      stylesPath,
      viewClass: options.viewClass,
      mobile,
      theme,
    };
    return result;
  } finally {
    await server.close();
  }
}

/** Human-readable summary, mirroring formatScanResult's register. */
export function formatObsidianScanResult(result: ObsidianScanResult): string {
  const lines = [
    `Obsidian View Scan: ${result.harness.viewClass}`,
    `Bundle: ${result.harness.bundlePath}`,
    `Viewport: ${result.viewport.name} (${result.viewport.width}x${result.viewport.height}) · Platform.isMobile=${result.harness.mobile}`,
    `Harness: ${result.harness.path}`,
    `Verdict: ${result.verdict}`,
    result.summary,
  ];

  const errors = result.issues.filter((i) => i.severity === 'error');
  const warnings = result.issues.filter((i) => i.severity === 'warning');
  if (errors.length || warnings.length) {
    lines.push('', `Issues: ${errors.length} error, ${warnings.length} warning`);
    for (const issue of [...errors, ...warnings].slice(0, 15)) {
      lines.push(`- [${issue.severity}] ${issue.description}`);
    }
    if (errors.length + warnings.length > 15) {
      lines.push(`  ... and ${errors.length + warnings.length - 15} more`);
    }
  }
  return lines.join('\n');
}
