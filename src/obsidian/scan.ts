import { writeFileSync, readFileSync, existsSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scan, determineVerdict, type ScanResult, type ScanIssue, type ScanOptions } from '../scan.js';
import { VIEWPORTS } from '../schemas.js';
import type { Viewport } from '../types.js';
import { generateHarness, resolvePluginPaths, type HarnessInput } from './harness.js';
import { serveHarness } from './server.js';
import { resolveObsidianAppCss } from './app-css.js';
import {
  analyzeLayoutOverflow,
  buildLayoutOverflowProbe,
  type LayoutOverflowFinding,
  type LayoutOverflowNode,
  type LayoutOverflowOptions,
} from './layout-overflow.js';

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
  /**
   * Load Obsidian's REAL base stylesheet from the local install. DEFAULT TRUE —
   * fidelity is the point of this tool.
   *
   * `false` opts out (and the scan says so, loudly). A string is an explicit
   * path to either an extracted `app.css` or an `obsidian.asar`.
   *
   * Without it, every `var(--text-normal, #fallback)` resolves to its fallback
   * and Obsidian's own element rules are absent — which makes a whole defect
   * class structurally invisible. See `app-css.ts`.
   */
  obsidianCss?: boolean | string;
  /**
   * Layout-overflow detection. Default on. `false` disables; an object
   * overrides the pixel thresholds. See `layout-overflow.ts`.
   */
  layoutOverflow?: false | LayoutOverflowOptions;
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
    /**
     * Base-CSS fidelity. `loaded: false` means the render used an
     * APPROXIMATION and a documented class of layout defect could not be
     * detected — read it before trusting a PASS.
     */
    appCss: {
      loaded: boolean;
      /** The `.asar` or `.css` the stylesheet came from, when loaded. */
      source?: string;
      bytes?: number;
      /** Why it is not loaded: `disabled` (caller) or `not-found` (no install). */
      reason?: 'disabled' | 'not-found';
    };
  };
  /**
   * Content that escaped its box. Also surfaced into `issues[]` — errors for
   * cross-element overlap, warnings for self-overflow. Absent when disabled.
   */
  layoutOverflow?: LayoutOverflowFinding[];
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

/** Key under which the layout-overflow measurement lands in `ScanResult.probes`. */
const LAYOUT_OVERFLOW_PROBE = 'obsidianLayoutOverflow';

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

/**
 * Resolve the base stylesheet for a scan and describe the outcome.
 *
 * Split out and exported so the degrade path is unit-testable without an
 * Obsidian install — the one path that must never fail silently.
 */
export function resolveHarnessAppCss(
  obsidianCss: ObsidianScanOptions['obsidianCss'],
  resolver: typeof resolveObsidianAppCss = resolveObsidianAppCss,
): { css?: string; meta: ObsidianScanResult['harness']['appCss'] } {
  if (obsidianCss === false) {
    return { meta: { loaded: false, reason: 'disabled' } };
  }
  const resolved = resolver(typeof obsidianCss === 'string' ? { path: obsidianCss } : {});
  if (!resolved) {
    return { meta: { loaded: false, reason: 'not-found' } };
  }
  return {
    css: resolved.css,
    meta: { loaded: true, source: resolved.source, bytes: resolved.bytes },
  };
}

/**
 * The warning that stops a low-fidelity scan from passing itself off as a
 * high-fidelity one.
 *
 * A harness without Obsidian's base CSS renders a DIFFERENT PAGE than the app:
 * `var(--x, fallback)` resolves to the fallback, and Obsidian's own element
 * rules — including the `button { height: var(--input-height) }` rule that pins
 * a multi-line button's content to 30px — are simply not there. A scan in that
 * state cannot see that defect class, and saying so is the whole point.
 */
export function deriveAppCssIssues(meta: ObsidianScanResult['harness']['appCss']): ScanIssue[] {
  if (meta.loaded) return [];
  const why =
    meta.reason === 'disabled'
      ? 'Base-CSS fidelity is OFF because the caller passed obsidian_css=false.'
      : "Base-CSS fidelity is OFF: no local Obsidian install was found, so Obsidian's app.css could not be loaded.";
  return [
    {
      category: 'structure',
      severity: 'warning',
      description:
        `${why} This render used an APPROXIMATION — every var(--x, fallback) in the plugin ` +
        `stylesheet resolved to its FALLBACK, and Obsidian's own element rules are absent. ` +
        `Layout defects that depend on those rules (notably button { height: var(--input-height) }, ` +
        `which pins a multi-line <button>'s content to 30px and spills it into the row below) ` +
        `are UNDETECTABLE in this scan.`,
      fix:
        meta.reason === 'disabled'
          ? 'Drop obsidian_css=false to restore full fidelity.'
          : `Install Obsidian, or point IBR at a copy: set ${'IBR_OBSIDIAN_APP_CSS'} to an extracted app.css or an obsidian.asar, or pass obsidian_css="<path>".`,
    },
  ];
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
  const appCss = resolveHarnessAppCss(options.obsidianCss);

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
    appCss: appCss.css,
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
      probes:
        options.layoutOverflow === false
          ? undefined
          : { [LAYOUT_OVERFLOW_PROBE]: buildLayoutOverflowProbe({ rootSelector: '#ibr-container' }) },
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

    // --- Layout overflow ---
    // The probe measured the SETTLED page; the analysis is pure and runs here.
    if (options.layoutOverflow !== false) {
      const measured = result.probes?.[LAYOUT_OVERFLOW_PROBE] as LayoutOverflowNode[] | undefined;
      // The raw measurement is an implementation detail — up to 4000 nodes of
      // ~20 fields each. Findings are the output; shipping the input inside
      // every --json result would bury them.
      if (result.probes) {
        delete result.probes[LAYOUT_OVERFLOW_PROBE];
        if (Object.keys(result.probes).length === 0) delete result.probes;
      }
      if (Array.isArray(measured)) {
        const overflowOptions = typeof options.layoutOverflow === 'object' ? options.layoutOverflow : {};
        result.layoutOverflow = analyzeLayoutOverflow(measured, overflowOptions);
        for (const finding of result.layoutOverflow) {
          result.issues.push({
            category: 'structure',
            severity: finding.severity,
            element: finding.selector,
            description: finding.detail,
            fix: finding.fix,
          });
        }
      }
    }

    // --- Base-CSS fidelity ---
    // Ordered LAST so the warning leads the issue list, and so the verdict
    // adjustment below sees every finding.
    result.issues = [...deriveAppCssIssues(appCss.meta), ...result.issues];

    // A scan that could not load Obsidian's base CSS measured a DIFFERENT PAGE
    // than the app renders, and one warning would not move determineVerdict()
    // off PASS (it needs five). PARTIAL is the existing, exact word for
    // "structurally incomplete", and scan()'s own PARTIAL contract already
    // means every reader must treat the result as provisional.
    //
    // An explicit obsidian_css=false is NOT downgraded: the caller said so, and
    // the warning above records it. FAIL is never downgraded — it is worse.
    if (!appCss.meta.loaded && appCss.meta.reason === 'not-found' && result.verdict !== 'FAIL') {
      result.verdict = 'PARTIAL';
      result.partialReason =
        `Obsidian's base CSS could not be loaded, so this render is an approximation ` +
        `and a documented class of layout defect is undetectable. ` +
        `Install Obsidian, set IBR_OBSIDIAN_APP_CSS, or pass obsidian_css=false to accept the degraded scan.`;
    } else if (result.verdict !== 'PARTIAL' && result.verdict !== 'FAIL') {
      // Issues changed since scan() graded them — re-derive so an overlap ERROR
      // can move a PASS. FAIL and PARTIAL are never downgraded.
      result.verdict = determineVerdict(result.issues);
    }

    result.harness = {
      path: harnessPath,
      url: server.url,
      bundlePath,
      stylesPath,
      viewClass: options.viewClass,
      mobile,
      theme,
      appCss: appCss.meta,
    };
    return result;
  } finally {
    await server.close();
  }
}

/** Human-readable summary, mirroring formatScanResult's register. */
export function formatObsidianScanResult(result: ObsidianScanResult): string {
  const appCss = result.harness.appCss;
  const baseCssLine = appCss?.loaded
    ? `Base CSS: Obsidian app.css loaded (${appCss.bytes ?? 0} bytes) from ${appCss.source}`
    : `Base CSS: NOT LOADED (${appCss?.reason ?? 'unknown'}) — this render is an approximation; ` +
      `var() fallbacks are what you see, and button-height overflow defects are undetectable`;

  const lines = [
    `Obsidian View Scan: ${result.harness.viewClass}`,
    `Bundle: ${result.harness.bundlePath}`,
    `Viewport: ${result.viewport.name} (${result.viewport.width}x${result.viewport.height}) · Platform.isMobile=${result.harness.mobile}`,
    `Harness: ${result.harness.path}`,
    baseCssLine,
    `Verdict: ${result.verdict}`,
    ...(result.partialReason ? [`Partial: ${result.partialReason}`] : []),
    result.summary,
  ];

  if (result.layoutOverflow && result.layoutOverflow.length > 0) {
    lines.push('', `Layout overflow: ${result.layoutOverflow.length} finding(s)`);
    for (const f of result.layoutOverflow.slice(0, 10)) {
      lines.push(`- [${f.severity}] ${f.kind} · ${f.spillPx}px · ${f.detail}`);
      if (f.fix) lines.push(`    fix: ${f.fix}`);
    }
    if (result.layoutOverflow.length > 10) {
      lines.push(`  ... and ${result.layoutOverflow.length - 10} more`);
    }
  }

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
