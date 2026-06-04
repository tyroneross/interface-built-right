import type { PageLike } from './engine/page-like.js';
import { EngineDriver, type CoverageReport } from './engine/driver.js';
import type { SetCookieParams } from './engine/cdp/network.js';
import { CompatPage } from './engine/compat.js';
import type { EnhancedElement, AuditResult, Viewport } from './schemas.js';
import { VIEWPORTS } from './schemas.js';
import { extractInteractiveElements, analyzeElements } from './extract.js';
import { testInteractivity, type InteractivityResult } from './interactivity.js';
import { getSemanticOutput, type SemanticResult } from './semantic/index.js';
import { detectLayoutCollisions, type LayoutCollisionResult } from './layout-collision.js';
import { analyzeThemeConsistency, type ThemeAnalysis } from './consistency.js';
import { runDesignSystemCheck } from './design-system/index.js';
import type { DesignSystemResult } from './schemas.js';
import type { BrowserLaunchOptions } from './types.js'
import { waitForHydration } from './engine/cdp/wait.js';
import { runSensors, type SensorReport } from './sensors/index.js';
import { extractCssRulesAndMeta } from './sensors/css-extract.js';
import { runAllRules, type RuleEngineResult } from './rules/index.js';
import { summarizeScan, type ScanSummary } from './summarize.js';
import { runRules, type RuleContext as PresetRuleContext } from './rules/engine.js';
import type { RulesConfig } from './schemas.js';


/**
 * Comprehensive UI scan result combining all IBR analysis capabilities
 */
export interface ScanResult {
  url: string;
  route: string;
  timestamp: string;
  viewport: Viewport;

  /** Element extraction: all interactive elements with computed styles */
  elements: {
    all: EnhancedElement[];
    audit: AuditResult;
  };

  /** Interactivity analysis: buttons, links, forms with handler detection */
  interactivity: InteractivityResult;

  /** Semantic understanding: page intent, auth/loading/error states */
  semantic: SemanticResult;

  /** Console output captured during page load */
  console: {
    errors: string[];
    warnings: string[];
  };

  /** AX tree coverage report — gaps like canvas, iframes, shadow DOM */
  coverage?: CoverageReport;

  /** Layout collision detection — overlapping text elements */
  layoutCollisions?: LayoutCollisionResult;

  /** Theme consistency — detects light content on dark page (and vice versa) */
  themeAnalysis?: ThemeAnalysis;

  /** Design system check results — principle violations, token compliance */
  designSystem?: DesignSystemResult;

  /** Hydration wait result — present when SPA hydration detection ran */
  hydration?: {
    timedOut: boolean;
    reason: string;
  };

  /** Pre-processed sensor summaries — condensed patterns for model consumption */
  sensors?: SensorReport;

  /** Deterministic rule engine results — no LLM needed */
  ruleEngine?: RuleEngineResult[];

  /** Condensed summaries for model-assisted review */
  summaries?: ScanSummary;

  /** Overall scan verdict */
  verdict: 'PASS' | 'ISSUES' | 'FAIL' | 'PARTIAL';
  /** If verdict is PARTIAL, explains why the scan is incomplete */
  partialReason?: string;
  issues: ScanIssue[];
  summary: string;
}

/**
 * Individual issue found during scan
 */
export interface ScanIssue {
  category: 'interactivity' | 'accessibility' | 'semantic' | 'console' | 'structure' | 'design-system';
  severity: 'error' | 'warning' | 'info';
  element?: string;
  description: string;
  fix?: string;
}

/**
 * Collects and deduplicates scan issues from multiple analysis sources.
 * Use directly when composing issues incrementally (e.g. design system checks).
 * The legacy aggregateIssues() function wraps this for backward compatibility.
 */
export class IssueCollector {
  private issues: ScanIssue[] = [];

  add(issue: ScanIssue): void {
    this.issues.push(issue);
  }

  /**
   * Add issues from a source array with varying shapes.
   * Handles the different field names used across audit, interactivity, and semantic results.
   */
  addFrom(
    category: ScanIssue['category'],
    items: Array<{
      severity?: string;
      message?: string;
      description?: string;
      problem?: string;
      element?: string;
      type?: string;
      fix?: string;
    }>,
    overrideCategory?: (item: { type?: string }) => ScanIssue['category']
  ): void {
    for (const item of items) {
      const description = item.message ?? item.description ?? item.problem ?? '';
      const severity = (item.severity ?? 'info') as ScanIssue['severity'];
      const resolvedCategory = overrideCategory ? overrideCategory(item) : category;
      this.issues.push({
        category: resolvedCategory,
        severity,
        element: item.element,
        description,
        fix: item.fix,
      });
    }
  }

  /**
   * Add console errors, skipping favicon/manifest noise.
   */
  addConsoleErrors(errors: string[]): void {
    for (const error of errors) {
      if (error.includes('favicon') || error.includes('manifest')) continue;
      this.issues.push({
        category: 'console',
        severity: 'error',
        description: `Console error: ${error.slice(0, 200)}`,
      });
    }
  }

  /**
   * Add theme mismatch issue if present.
   */
  addThemeAnalysis(analysis?: ThemeAnalysis): void {
    if (analysis?.themeMismatch) {
      this.issues.push({
        category: 'semantic',
        severity: 'warning',
        description: analysis.mismatchDetails ?? 'Content card has different theme than page background',
        fix: 'Ensure content containers match the page theme (dark/light)',
      });
    }
  }

  /**
   * Remove issues with identical descriptions, preserving first occurrence.
   */
  deduplicate(): void {
    const seen = new Set<string>();
    this.issues = this.issues.filter(issue => {
      if (seen.has(issue.description)) return false;
      seen.add(issue.description);
      return true;
    });
  }

  getIssues(): ScanIssue[] {
    return [...this.issues];
  }
}

/**
 * Options for running a scan
 */
export interface ScanOptions extends BrowserLaunchOptions {
  /** Viewport to use (default: desktop) */
  viewport?: keyof typeof VIEWPORTS | Viewport;
  /** Timeout for page load in ms (default: 30000) */
  timeout?: number;
  /** Wait for this selector before scanning */
  waitFor?: string;
  /** Show a visible browser window instead of headless mode */
  headed?: boolean;
  /** IBR output directory for auth state */
  outputDir?: string;
  /** Whether to capture a screenshot */
  screenshot?: {
    path: string;
    fullPage?: boolean;
  };
  /** Network idle timeout in ms (default: 10000). Set higher for slow async pages */
  networkIdleTimeout?: number;
  /** Patience mode: extends all wait timeouts. Use for AI search / LLM result pages */
  patience?: number;
  /** How to handle SPA hydration. 'auto' detects framework, 'stable' always waits, 'none' skips. Default: 'auto' */
  hydrationStrategy?: 'auto' | 'stable' | 'none';
  /** Rule preset names to enable for this scan (e.g. ['wcag-contrast', 'touch-targets']) */
  rules?: string[];
  /**
   * R3: cookies to set BEFORE navigate. When the caller has an authenticated
   * session, threading the auth cookies into a fresh scan lets the scan see
   * gated routes (dashboard, settings) instead of bouncing to a login page.
   * Without this, plain `scan()` opens a clean browser and reports
   * "Auth: Not authenticated" for every protected route — the largest source
   * of false-FAIL verdicts in the transcript audit.
   */
  cookies?: SetCookieParams[];
  /**
   * Optional warm-browser pool. When supplied, scan() reuses the pool's
   * EngineDriver instead of launching a fresh browser. Drops first-finding
   * latency dramatically for the second-and-onwards call in the same process
   * (e.g. an MCP server fielding multiple `ask` calls). The pool's lifecycle
   * is the caller's responsibility — scan() does not close it.
   *
   * Caveat: per-scan viewport is NOT re-applied on a pooled driver — the
   * pool's launch viewport is sticky for the process. Callers that need a
   * different viewport mid-process should construct a dedicated pool or
   * omit `pool` so scan() launches with the full device profile.
   */
  pool?: import('./engine/browser-pool.js').BrowserPool;
}

/**
 * Initialize the cookie jar for a scan, closing the cross-scan leak that
 * arises when a warm BrowserPool reuses an EngineDriver.
 *
 * Contract:
 * - Pool path (`ownDriver === false`): UNCONDITIONALLY clear the jar before
 *   applying any new cookies. This is the security boundary — guarding the
 *   clear behind `cookies?.length > 0` would re-open the leak case ("scan B
 *   passes no cookies and inherits scan A's session").
 * - Fresh-driver path (`ownDriver === true`): the jar is empty by
 *   construction, so we skip `clearCookies()` to save a CDP round-trip.
 * - `setCookies` runs only when caller supplied cookies, on both paths.
 *
 * Failures from `clearCookies` and `setCookies` are non-fatal — the scan
 * continues; if residue persists or auth fails, the scan output will
 * reflect the resulting state and the caller can detect it.
 *
 * Exported for direct unit testing of the cookie-leak regression
 * (browser-pool.test.ts).
 */
export async function initScanCookies(
  driver: Pick<EngineDriver, 'clearCookies' | 'setCookies'>,
  ownDriver: boolean,
  cookies: SetCookieParams[] | undefined,
): Promise<void> {
  if (!ownDriver) {
    try {
      await driver.clearCookies();
    } catch {
      // Non-fatal: see contract above.
    }
  }
  if (cookies && cookies.length > 0) {
    try {
      await driver.setCookies(cookies);
    } catch {
      // Non-fatal: see contract above.
    }
  }
}

/**
 * Run a comprehensive UI scan on a URL.
 *
 * Combines all IBR analysis capabilities into a single scan:
 * 1. Element extraction (computed styles, bounds, handlers)
 * 2. Interactivity testing (buttons, links, forms)
 * 3. Semantic analysis (page intent, auth/loading/error states)
 * 4. Console error capture
 * 5. Issue aggregation with verdict
 */
export async function scan(url: string, options: ScanOptions = {}): Promise<ScanResult> {
  const {
    viewport: viewportOpt = 'desktop',
    timeout = 30000,
    waitFor,
    screenshot,
    networkIdleTimeout,
    patience,
    headed = false,
    browserMode,
    cdpUrl,
    wsEndpoint,
    chromePath,
    hydrationStrategy = 'auto',
    rules: rulePresets,
    cookies,
  } = options;

  const resolvedViewport: Viewport = typeof viewportOpt === 'string'
    ? VIEWPORTS[viewportOpt] || VIEWPORTS.desktop
    : viewportOpt;

  // Launch browser — or acquire one from the pool when supplied.
  //
  // Pool path: reuses the pool's EngineDriver. Per-scan viewport is NOT
  // re-applied (emulation is sticky on the pooled driver). Callers that
  // need a different viewport mid-process should construct a dedicated
  // pool or omit `pool` for viewport-sensitive scans.
  //
  // Fresh-launch path: passes the FULL resolved viewport (including
  // deviceScaleFactor, mobile, userAgent, hasTouch) so EngineDriver.launch
  // can apply the full device profile via CDP Emulation BEFORE navigate.
  // Passing only {width, height} was the source of the "--viewport mobile
  // is silently ignored" bug (pre-1.1.0); preserving it here is required.
  const ownDriver = !options.pool;
  let driver: EngineDriver;
  if (options.pool) {
    driver = await options.pool.acquire();
  } else {
    driver = new EngineDriver();
    await driver.launch({
      headless: !headed,
      viewport: {
        width: resolvedViewport.width,
        height: resolvedViewport.height,
        deviceScaleFactor: resolvedViewport.deviceScaleFactor,
        mobile: resolvedViewport.mobile,
        userAgent: resolvedViewport.userAgent,
        hasTouch: resolvedViewport.hasTouch,
      },
      mode: browserMode,
      cdpUrl,
      wsEndpoint,
      chromePath,
    });
  }
  const page: PageLike = new CompatPage(driver);

  // Capture console output
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  page.on?.('console', (msg: { type(): string; text(): string }) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    } else if (msg.type() === 'warning') {
      consoleWarnings.push(msg.text());
    }
  });

  try {
    // SECURITY: normalize the cookie jar BEFORE applying per-scan cookies.
    // The warm BrowserPool reuses the EngineDriver across scan() calls;
    // without an explicit clear on the pool path, scan A's auth cookies
    // would leak into scan B (whether or not scan B passes its own
    // cookies — the leak case is "B inherits A's by passing none"). The
    // helper enforces the contract; see `initScanCookies`.
    await initScanCookies(driver, ownDriver, cookies);

    // Navigate
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout,
    });

    // Wait for network idle
    let networkIdleTimedOut = false;
    await page.waitForLoadState?.('networkidle', { timeout: patience ?? networkIdleTimeout ?? 10000 }).catch(() => { networkIdleTimedOut = true; });

    // Wait for specific selector if provided
    let waitForTimedOut = false;
    if (waitFor) {
      await page.waitForSelector(waitFor, { timeout: patience ?? networkIdleTimeout ?? 10000 }).catch(() => { waitForTimedOut = true; });
    }

    // Wait for SPA hydration (React/Next.js/Vue). Prevents "0 elements" on unhydrated shells.
    // Uses marker detection + AX tree stability polling.
    let hydrationTimedOut = false;
    let hydrationReason = 'skipped';
    if (hydrationStrategy !== 'none') {
      const shouldWaitForHydration = hydrationStrategy === 'stable' || await detectSPAFramework(driver);
      if (shouldWaitForHydration) {
        const hydrationResult = await waitForHydration(
          driver.connection,
          () => driver.getSnapshot(),
          (expr: string) => driver.evaluate(expr),
          {
            timeout: patience ?? 8000,
            stableTime: 500,
            minElements: 1,
            settleTime: 200,
          },
        );
        hydrationTimedOut = hydrationResult.timedOut;
        hydrationReason = hydrationResult.reason;
      }
    }

    // Run all analyses in parallel where possible
    const [elements, interactivity, semantic, coverage, themeAnalysis] = await Promise.all([
      extractAndAudit(page, resolvedViewport),
      testInteractivity(page),
      getSemanticOutput(page),
      driver.getCoverage().catch(() => undefined),
      analyzeThemeConsistency(page).catch(() => undefined),
    ]);

    // Capture screenshot if requested
    if (screenshot) {
      await page.screenshot({
        path: screenshot.path,
        fullPage: screenshot.fullPage ?? true,
      });
    }

    // Extract route from URL
    let route: string;
    try {
      route = new URL(url).pathname;
    } catch {
      route = url;
    }

    // Detect layout collisions in extracted elements
    const layoutCollisions = detectLayoutCollisions(elements.all);

    // Aggregate issues
    const issues = aggregateIssues(elements.audit, interactivity, semantic, consoleErrors, themeAnalysis);

    // Run design system check and inject violations into issues
    const designSystem = await applyDesignSystemCheck(
      elements.all,
      issues,
      resolvedViewport,
      url,
      options.outputDir || process.cwd()
    );

    const verdict = determineVerdict(issues);
    const summary = generateSummary(elements, interactivity, semantic, issues, consoleErrors);

    // Extract live CSS rules + document meta for the typography, breakpoints,
    // motion, hierarchy, and interaction-states sensors. Best-effort — on
    // failure (e.g. browser detach), sensors degrade to empty results.
    let cssExtract: Awaited<ReturnType<typeof extractCssRulesAndMeta>> | undefined;
    try {
      cssExtract = await extractCssRulesAndMeta(page);
    } catch {
      cssExtract = undefined;
    }

    // Run sensor layer — condense raw elements into model-friendly summaries.
    // Merge structuralElements (headings/landmarks/text-bearing tags with
    // typography fields) into the sensor input WITHOUT touching elements.all
    // or scan.elements — those remain the existing interactive-only payload.
    const sensorElements = cssExtract
      ? [...elements.all, ...cssExtract.structuralElements]
      : elements.all;
    const sensors = runSensors({
      elements: sensorElements,
      interactivity,
      semantic,
      url,
      viewport: resolvedViewport,
      ...(cssExtract ? { cssRules: cssExtract.cssRules, documentMeta: cssExtract.documentMeta } : {}),
    });

    // Run deterministic rule engine
    const ruleContext = {
      isMobile: resolvedViewport.width < 768,
      viewportWidth: resolvedViewport.width,
      viewportHeight: resolvedViewport.height,
      url,
      allElements: elements.all,
    };
    const ruleEngine = runAllRules(elements.all, ruleContext);

    // Run preset rule engine if --rules flag was provided
    if (rulePresets && rulePresets.length > 0) {
      // Build in-memory config equivalent to .ibr/rules.json { extends: [...], rules: {} }
      const presetConfig: RulesConfig = { extends: rulePresets, rules: {} };
      const presetViolations = runRules(elements.all, ruleContext as PresetRuleContext, presetConfig);
      // Inject preset violations into issues so they appear in the standard output
      for (const v of presetViolations) {
        issues.push({
          category: 'interactivity' as const,
          severity: v.severity === 'error' ? 'error' : 'warning',
          element: v.element,
          description: `[${v.ruleId}] ${v.message}`,
          fix: v.fix,
        });
      }
    }

    // Generate condensed summaries
    const summaries = summarizeScan(elements.all, url);

    const baseResult = {
      url,
      route,
      timestamp: new Date().toISOString(),
      viewport: resolvedViewport,
      elements,
      interactivity,
      semantic,
      sensors,
      ruleEngine,
      summaries,
      console: {
        errors: consoleErrors,
        warnings: consoleWarnings,
      },
      coverage,
      layoutCollisions,
      themeAnalysis,
      designSystem,
      hydration: hydrationReason !== 'skipped'
        ? { timedOut: hydrationTimedOut, reason: hydrationReason }
        : undefined,
      verdict,
      issues,
      summary,
    };

    if (patience && (networkIdleTimedOut || waitForTimedOut)) {
      return {
        ...baseResult,
        verdict: 'PARTIAL' as const,
        partialReason: `Page still loading after ${patience}ms — ${networkIdleTimedOut ? 'network still active' : 'selector not found'}. Re-scan when content has loaded.`,
      };
    }

    return baseResult;
  } finally {
    if (ownDriver) {
      await driver.close();
    } else if (options.pool) {
      options.pool.release();
    }
  }
}

/**
 * Detect if the page is running a known SPA framework (React, Next.js, Vue, Nuxt).
 * Used by the 'auto' hydration strategy to skip the stability wait on static pages.
 * Returns false on evaluation error — non-SPA behavior preserved.
 */
async function detectSPAFramework(driver: EngineDriver): Promise<boolean> {
  try {
    const result = await driver.evaluate(`
      !!(window.__NEXT_DATA__ || window.__REACT_DEVTOOLS_GLOBAL_HOOK__ ||
         window.__NUXT__ || window.__VUE_DEVTOOLS_GLOBAL_HOOK__ ||
         document.querySelector('[data-reactroot]') ||
         document.querySelector('#__next'))
    `);
    return result === true;
  } catch {
    return false;
  }
}

/**
 * Extract elements and run audit.
 * Exported for use by LiveSession.scanPage() — runs against any Playwright page.
 */
export async function extractAndAudit(
  page: PageLike,
  viewport: Viewport
): Promise<{ all: EnhancedElement[]; audit: AuditResult }> {
  const isMobile = viewport.width < 768;
  const elements = await extractInteractiveElements(page);
  const audit = analyzeElements(elements, isMobile);
  return { all: elements, audit };
}

/**
 * Aggregate issues from all analysis sources into a unified list.
 * Exported for use by LiveSession.scanPage().
 */
export function aggregateIssues(
  audit: AuditResult,
  interactivity: InteractivityResult,
  semantic: SemanticResult,
  consoleErrors: string[],
  themeAnalysis?: ThemeAnalysis
): ScanIssue[] {
  const collector = new IssueCollector();

  // Element audit issues
  collector.addFrom('interactivity', audit.issues.map(i => ({
    severity: i.severity,
    message: i.message,
    type: i.type,
  })), item => item.type === 'MISSING_ARIA_LABEL' ? 'accessibility' : 'interactivity');

  // Interactivity issues (deduplicate with audit)
  const auditMessages = new Set(audit.issues.map(i => i.message));
  const interactivityFiltered = interactivity.issues.filter(i => !auditMessages.has(i.description));
  collector.addFrom('interactivity', interactivityFiltered.map(i => ({
    severity: i.severity,
    description: i.description,
    element: i.element,
    type: i.type,
    fix: getFixSuggestion(i.type),
  })), item => item.type === 'MISSING_LABEL' ? 'accessibility' : 'interactivity');

  // Semantic issues
  collector.addFrom('semantic', semantic.issues.map(i => ({
    severity: i.severity,
    problem: i.problem,
  })));

  // Theme mismatch
  collector.addThemeAnalysis(themeAnalysis);

  // Console errors
  collector.addConsoleErrors(consoleErrors);

  return collector.getIssues();
}

/**
 * Run design system checks and inject violations into the issues array.
 * Reusable across all scan paths (main scan, live session, browser server, native).
 * Returns DesignSystemResult or undefined if no config exists.
 * Mutates the issues array by pushing design-system category issues.
 */
export async function applyDesignSystemCheck(
  elements: EnhancedElement[],
  issues: ScanIssue[],
  viewport: Viewport,
  url: string,
  outputDir: string
): Promise<DesignSystemResult | undefined> {
  const designSystem = await runDesignSystemCheck(
    elements,
    {
      isMobile: viewport.width < 768,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      url,
      allElements: elements,
    },
    outputDir
  ).catch(() => undefined);

  if (designSystem) {
    for (const v of designSystem.principleViolations) {
      issues.push({
        category: 'design-system' as const,
        severity: v.severity === 'error' ? 'error' as const : 'warning' as const,
        element: v.element,
        description: v.message,
        fix: v.fix,
      });
    }
    for (const v of designSystem.tokenViolations) {
      issues.push({
        category: 'design-system' as const,
        severity: v.severity === 'error' ? 'error' as const : 'warning' as const,
        element: v.element,
        description: v.message,
      });
    }
    for (const v of designSystem.customViolations) {
      issues.push({
        category: 'design-system' as const,
        severity: v.severity === 'error' ? 'error' as const : 'warning' as const,
        element: v.element,
        description: v.message,
        fix: v.fix,
      });
    }
  }

  return designSystem;
}

/**
 * Determine overall verdict from issues.
 * Exported for use by LiveSession.scanPage().
 */
export function determineVerdict(issues: ScanIssue[]): 'PASS' | 'ISSUES' | 'FAIL' {
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  if (errorCount >= 3) return 'FAIL';
  if (errorCount > 0 || warningCount >= 5) return 'ISSUES';
  return 'PASS';
}

/**
 * Generate human-readable summary.
 * Exported for use by LiveSession.scanPage().
 */
export function generateSummary(
  elements: { all: EnhancedElement[]; audit: AuditResult },
  interactivity: InteractivityResult,
  semantic: SemanticResult,
  issues: ScanIssue[],
  consoleErrors: string[]
): string {
  const parts: string[] = [];

  // Page type
  parts.push(`${semantic.pageIntent.intent} page`);

  // Element counts
  parts.push(`${elements.audit.totalElements} elements (${elements.audit.interactiveCount} interactive)`);

  // Interactivity
  const { buttons, links, forms } = interactivity;
  const interactiveParts: string[] = [];
  if (buttons.length > 0) interactiveParts.push(`${buttons.length} buttons`);
  if (links.length > 0) interactiveParts.push(`${links.length} links`);
  if (forms.length > 0) interactiveParts.push(`${forms.length} forms`);
  if (interactiveParts.length > 0) {
    parts.push(interactiveParts.join(', '));
  }

  // Handler coverage
  if (interactivity.summary.withoutHandlers > 0) {
    parts.push(`${interactivity.summary.withoutHandlers} elements without handlers`);
  }

  // Auth state
  if (semantic.state.auth.authenticated) {
    parts.push('authenticated');
  }

  // Loading
  if (semantic.state.loading.loading) {
    parts.push(`loading (${semantic.state.loading.type})`);
  }

  // Errors
  if (semantic.state.errors.hasErrors) {
    parts.push(`${semantic.state.errors.errors.length} page errors`);
  }

  // Console errors
  if (consoleErrors.length > 0) {
    parts.push(`${consoleErrors.length} console errors`);
  }

  // Issues summary
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  if (errorCount > 0 || warningCount > 0) {
    const issueParts = [];
    if (errorCount > 0) issueParts.push(`${errorCount} errors`);
    if (warningCount > 0) issueParts.push(`${warningCount} warnings`);
    parts.push(issueParts.join(', '));
  }

  return parts.join(', ');
}

/**
 * Get fix suggestion for common issue types
 */
function getFixSuggestion(type: string): string | undefined {
  switch (type) {
    case 'NO_HANDLER':
      return 'Add an onClick handler or remove the interactive appearance';
    case 'PLACEHOLDER_LINK':
      return 'Add a real href or an onClick handler';
    case 'MISSING_LABEL':
      return 'Add aria-label or visible text content';
    case 'FORM_NO_SUBMIT':
      return 'Add a submit handler or action attribute to the form';
    case 'ORPHAN_SUBMIT':
      return 'Ensure the submit button is inside a form';
    case 'SMALL_TOUCH_TARGET':
      return 'Increase element size to at least 44x44px for touch targets';
    default:
      return undefined;
  }
}

/**
 * R3: suppress "Page intent: unknown (< 30% confidence)" noise.
 * The condition was duplicated in scan.ts and tools.ts; single source here.
 * Returns true when the intent line carries zero information.
 */
export function isIntentNoise(intent: string, confidence: number): boolean {
  return intent === 'unknown' && confidence < 0.3;
}

/**
 * Format scan result for console output
 */
export function formatScanResult(result: ScanResult): string {
  const lines: string[] = [];

  const verdictIcon = result.verdict === 'PASS' ? '\x1b[32m✓\x1b[0m' :
                      result.verdict === 'ISSUES' ? '\x1b[33m!\x1b[0m' :
                      result.verdict === 'PARTIAL' ? '\x1b[33m~\x1b[0m' :
                      '\x1b[31m✗\x1b[0m';

  lines.push('═══════════════════════════════════════════════════════');
  lines.push('  IBR UI SCAN');
  lines.push('═══════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`  URL:      ${result.url}`);
  lines.push(`  Route:    ${result.route}`);
  lines.push(`  Viewport: ${result.viewport.name} (${result.viewport.width}x${result.viewport.height})`);
  lines.push(`  Verdict:  ${verdictIcon} ${result.verdict}`);
  lines.push('');

  // Summary line
  lines.push(`  ${result.summary}`);
  lines.push('');

  // Semantic
  lines.push('  PAGE UNDERSTANDING');
  lines.push('  ─────────────────');
  // R3: suppress the "Intent: unknown (0% confidence)" line that pervades
  // localhost scans. It carries zero information when the classifier
  // couldn't decide AND its score is near floor. Other intents — even
  // medium-confidence ones — still surface.
  const intent = result.semantic.pageIntent.intent;
  const intentConfidence = result.semantic.confidence;
  if (!isIntentNoise(intent, intentConfidence)) {
    lines.push(`  Intent:   ${intent} (${(intentConfidence * 100).toFixed(0)}% confidence)`);
  }
  lines.push(`  Auth:     ${result.semantic.state.auth.authenticated ? 'Authenticated' : 'Not authenticated'}`);
  lines.push(`  Loading:  ${result.semantic.state.loading.loading ? result.semantic.state.loading.type : 'Complete'}`);
  lines.push(`  Errors:   ${result.semantic.state.errors.hasErrors ? result.semantic.state.errors.errors.map(e => e.message).join(', ') : 'None'}`);
  lines.push('');

  // Elements
  lines.push('  ELEMENTS');
  lines.push('  ────────');
  lines.push(`  Total:              ${result.elements.audit.totalElements}`);
  lines.push(`  Interactive:        ${result.elements.audit.interactiveCount}`);
  lines.push(`  With handlers:      ${result.elements.audit.withHandlers}`);
  lines.push(`  Without handlers:   ${result.elements.audit.withoutHandlers}`);
  lines.push('');

  // Interactivity breakdown
  const { buttons, links, forms } = result.interactivity;
  lines.push('  INTERACTIVITY');
  lines.push('  ─────────────');
  lines.push(`  Buttons: ${buttons.length}  Links: ${links.length}  Forms: ${forms.length}`);

  if (forms.length > 0) {
    for (const form of forms) {
      const icon = form.hasSubmitHandler ? '✓' : '✗';
      lines.push(`    ${icon} Form ${form.selector}: ${form.fields.length} fields${form.hasValidation ? ', validated' : ''}`);
    }
  }
  lines.push('');

  // Console
  if (result.console.errors.length > 0 || result.console.warnings.length > 0) {
    lines.push('  CONSOLE');
    lines.push('  ───────');
    if (result.console.errors.length > 0) {
      lines.push(`  Errors: ${result.console.errors.length}`);
      for (const err of result.console.errors.slice(0, 3)) {
        lines.push(`    ✗ ${err.slice(0, 100)}`);
      }
    }
    if (result.console.warnings.length > 0) {
      lines.push(`  Warnings: ${result.console.warnings.length}`);
    }
    lines.push('');
  }

  // Layout collisions
  if (result.layoutCollisions?.hasCollisions) {
    const { collisions } = result.layoutCollisions;
    lines.push('  LAYOUT');
    lines.push('  ──────');
    lines.push(`  Collisions: ${collisions.length}`);
    for (const c of collisions) {
      const overlapPx = Math.round(Math.sqrt(c.overlapArea));
      const pct = Math.round(c.overlapPercent);
      const t1 = c.element1.text.slice(0, 30);
      const t2 = c.element2.text.slice(0, 30);
      lines.push(`    \x1b[31m✗\x1b[0m "${t1}" overlaps "${t2}" by ${pct}% (${overlapPx}px overlap)`);
    }
    lines.push('');
  }

  // Issues
  if (result.issues.length > 0) {
    lines.push('  ISSUES');
    lines.push('  ──────');
    for (const issue of result.issues) {
      const icon = issue.severity === 'error' ? '\x1b[31m✗\x1b[0m' :
                   issue.severity === 'warning' ? '\x1b[33m!\x1b[0m' : 'ℹ';
      lines.push(`  ${icon} [${issue.category}] ${issue.description}`);
      if (issue.fix) {
        lines.push(`    → ${issue.fix}`);
      }
    }
  } else {
    lines.push('  No issues detected.');
  }

  if (result.verdict === 'PARTIAL' && result.partialReason) {
    lines.push('');
    lines.push('  PARTIAL SCAN');
    lines.push('  ────────────');
    lines.push(`  \x1b[33m!\x1b[0m ${result.partialReason}`);
    lines.push('  Re-scan when the page has finished loading.');
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════');

  return lines.join('\n');
}
