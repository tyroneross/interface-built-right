import type { PageLike } from './engine/page-like.js';
import { EngineDriver, type CoverageReport } from './engine/driver.js';
import type { SetCookieParams } from './engine/cdp/network.js';
import type { EmulationDomain } from './engine/cdp/emulation.js';
import { CompatPage } from './engine/compat.js';
import type { EnhancedElement, AuditResult, Viewport } from './schemas.js';
import { VIEWPORTS } from './schemas.js';
import {
  extractInteractiveElements,
  analyzeElements,
  extractContentElements,
  CONTENT_ELEMENT_TAGS,
  extractPageMetadata,
  type ContentElement,
  type PageMetadata,
} from './extract.js';
import { testInteractivity, type InteractivityResult } from './interactivity.js';
import { getSemanticOutput, type SemanticResult } from './semantic/index.js';
import { detectLayoutCollisions, type LayoutCollisionResult } from './layout-collision.js';
import { analyzeThemeConsistency, type ThemeAnalysis } from './consistency.js';
import { runDesignSystemCheck } from './design-system/index.js';
import type { DesignSystemResult } from './schemas.js';
import type { BrowserLaunchOptions } from './types.js'
import { waitForHydration, waitForSkeletonSettled } from './engine/cdp/wait.js';
import { runSensors, type SensorReport } from './sensors/index.js';
import { extractCssRulesAndMeta } from './sensors/css-extract.js';
import { runAllRules, type RuleEngineResult } from './rules/index.js';
import { summarizeScan, type ScanSummary } from './summarize.js';
import { runRules, resolveRulesConfig, configHasContentRules, getActiveRules } from './rules/engine.js';
import { contentElementsToEnhanced } from './rules/content-adapter.js';
import { measureElementContrast } from './rules/contrast-measure.js';
import type { RuleContext as PresetRuleContext } from './rules/types.js';

/**
 * Boxes that CONTAIN page regions — the population the page-level rules
 * (`content-chrome-ratio`, `cognitive-load-elements`) reason over.
 *
 * Text carriers are deliberately absent: they are the content pass's job, and
 * inline wrappers are excluded from contrast grading on purpose.
 */
const CONTAINER_TAGS: ReadonlySet<string> = new Set([
  'header', 'nav', 'main', 'aside', 'footer', 'section', 'form',
]);


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

  /**
   * CONTENT elements (headings/paragraphs/images/captions/quotes) with real
   * bounds and computed styles — opt-in via `ScanOptions.content`. Kept out
   * of `elements.all`: a heading is not a touch target, and mixing lanes
   * would corrupt the touch-target audit rules that consume that array.
   * Absent entirely (not `undefined`-valued) when `content` was not
   * requested, so existing callers pay no extra token cost.
   */
  content?: { elements: ContentElement[] };

  /**
   * <head> SEO/social metadata — opt-in via `ScanOptions.content`, same
   * absence contract as `content` above.
   */
  metadata?: PageMetadata;

  /** Hydration wait result — present when SPA hydration detection ran */
  hydration?: {
    timedOut: boolean;
    reason: string;
  };

  /** Skeleton/loading state detection — present when skeleton check ran and nodes were found */
  skeleton?: {
    /** true when skeleton nodes persisted past the timeout */
    persistent: boolean;
    /** number of skeleton nodes still present at timeout */
    count: number;
  };

  /** Pre-processed sensor summaries — condensed patterns for model consumption */
  sensors?: SensorReport;

  /** Deterministic rule engine results — no LLM needed */
  ruleEngine?: RuleEngineResult[];

  /**
   * Which preset rules ran, and why they were chosen. Present on every scan so
   * "no findings" can be read against "these checks ran" instead of being
   * mistaken for a clean page when nothing ran at all.
   */
  rulesApplied?: {
    presets: string[];
    /** `default` = built-in defaults, `config` = .ibr/rules.json, `flag` = --rules, `opt-out` = --rules none. */
    source: 'opt-out' | 'flag' | 'config' | 'default';
    /** Headings/paragraphs/captions/quotes fed through the text rules. */
    gradedContentElements: number;
    /**
     * The tag names the content pass actually looked at. A raw count cannot
     * say what it covered; this can. Inline wrappers (span, div) are absent by
     * design, so text colored on a nested <span> inside a graded <p> is graded
     * at the <p>'s color — a real gap, stated rather than assumed.
     */
    gradedTags?: string[];
    /**
     * Present when content extraction THREW. Body copy and headings were not
     * graded at all, which is a coverage hole rather than a clean page.
     */
    contentExtractionFailed?: string;
  };

  /**
   * Text-contrast measurement accounting. Present only when a contrast rule was
   * active.
   *
   * WHY THIS EXISTS: the contrast rule used to return null for any text on a
   * transparent background, which is nearly all text on a real page. It
   * reported zero findings because it measured nothing, and nothing in the
   * output could tell those two states apart. `measured` is the number that
   * makes a clean report trustworthy.
   */
  contrastCoverage?: ContrastCoverage;

  /**
   * Results of caller-supplied DOM probes, keyed by the name given in
   * `ScanOptions.probes`. A probe that threw is absent from this map rather
   * than present-and-null, so a caller can tell "did not run" from "returned
   * nothing".
   */
  probes?: Record<string, unknown>;

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
   * Per-scan viewport IS re-applied on every pool-path call (see
   * `initScanViewport`), so a pooled driver correctly picks up whatever
   * `viewport` each call requests — desktop, mobile, or a custom profile —
   * even when consecutive calls on the same pool request different ones.
   */
  pool?: import('./engine/browser-pool.js').BrowserPool;
  /**
   * Extra DOM measurements to collect from the settled page, as
   * `{ name: jsExpression }`. Each expression is evaluated with
   * `returnByValue`, so it must return JSON-serialisable data, and results land
   * on `ScanResult.probes[name]`.
   *
   * Runs AFTER every wait and after element extraction, so a probe sees the
   * same laid-out page the rest of the scan measured. A probe that throws is
   * skipped — a supplementary measurement must never fail the scan that
   * carries it.
   */
  probes?: Record<string, string>;
  /**
   * Opt-in extraction of CONTENT elements (headings/paragraphs/images with
   * real bounds) plus <head> metadata (title, description, canonical,
   * og: and twitter: tags, JSON-LD). Off by default — a plain scan() call is
   * unchanged. When true, populates `ScanResult.content` and
   * `ScanResult.metadata`; when false/absent, BOTH fields are entirely
   * absent from the result (not present-and-undefined).
   */
  content?: boolean;

  /**
   * Directory searched for `.ibr/rules.json` when resolving which rule presets
   * to run. Defaults to `process.cwd()`.
   */
  projectDir?: string;
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
 * Apply device-metrics emulation to a driver acquired from a warm
 * BrowserPool, before navigation — closes the "mobile viewport silently
 * ignored on the pool path" bug.
 *
 * Contract:
 * - Fresh-driver path (`ownDriver === true`): a no-op here. `driver.launch()`
 *   already applied the FULL resolved viewport (metrics + UA + touch) before
 *   its own first navigate — see the launch call above.
 * - Pool path (`ownDriver === false`): `driver.launch()` is never called for
 *   a reused driver, and the pool itself launches with no viewport at all
 *   (see `getMcpBrowserPool()` in src/mcp/tools.ts, which constructs
 *   `BrowserPool({ launchOptions: { headless: true } })`). Without this
 *   call, a pooled driver keeps whatever device-metrics state it last had —
 *   none on first use, or a PRIOR caller's viewport on later calls — so a
 *   caller requesting `viewport: 'mobile'` silently measured the page at
 *   the pool's stale/default (desktop-ish) size. Bounds and
 *   viewport-conditional CSS (`hidden md:flex`, `@media` breakpoints)
 *   rendered under the WRONG breakpoint as a result. Called on EVERY
 *   pool-path scan, unconditionally, so viewport is correct regardless of
 *   what the previous caller on this pooled driver requested.
 *
 * Unlike `initScanCookies`, failures here are NOT swallowed: a scan that
 * silently keeps the wrong viewport reproduces the exact bug this function
 * fixes, so surfacing the error (and letting the caller's `finally` still
 * release the pooled driver) is preferable to a quiet wrong-viewport scan.
 *
 * Exported for direct unit testing of the viewport-pool regression
 * (browser-pool.test.ts), mirroring `initScanCookies` above.
 */
export async function initScanViewport(
  driver: { emulationDomain: Pick<EmulationDomain, 'applyDeviceProfile'> },
  ownDriver: boolean,
  viewport: Viewport,
): Promise<void> {
  if (ownDriver) return;
  await driver.emulationDomain.applyDeviceProfile({
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
    mobile: viewport.mobile,
    userAgent: viewport.userAgent,
    hasTouch: viewport.hasTouch,
  });
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
  // Pool path: reuses the pool's EngineDriver. Per-scan viewport IS
  // re-applied — see `initScanViewport` below, called right before
  // navigate. (Prior to that fix, emulation was sticky on the pooled
  // driver and a requested viewport was silently ignored; see the
  // touch-target false-positive bug this closed.)
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

    // SECURITY-ADJACENT CORRECTNESS: the warm BrowserPool reuses the
    // EngineDriver's device-metrics emulation across scan() calls just like
    // it reuses cookies above. Without an explicit re-apply on the pool
    // path, a `viewport: 'mobile'` request silently measured the page at
    // whatever viewport the pool's driver last had (or none, on first use)
    // — see `initScanViewport` for the full contract and the false-positive
    // touch-target bug this fixes.
    await initScanViewport(driver, ownDriver, resolvedViewport);

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

    // Check for persistent skeleton/loading state before extracting content.
    // A stable skeleton screen fools waitForHydration (fingerprint stops changing),
    // so this guard catches headless-only hydration failures on SPAs like Next.js.
    let skeletonResult: Awaited<ReturnType<typeof waitForSkeletonSettled>> | undefined;
    if (hydrationStrategy !== 'none') {
      skeletonResult = await waitForSkeletonSettled(
        (expr: string) => driver.evaluate(expr),
        { timeout: patience ?? 8000 },
      );
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

    // Page-level rules reason over the PAGE, not over the control list.
    // `allElements` used to be `elements.all` — the interactive-only array —
    // so `calm-precision/content-chrome-ratio` summed chrome area over a
    // population containing no <nav>, <header>, or <footer>, always computed
    // ~0%, and never fired; and `calm-precision/cognitive-load-elements`,
    // which by construction only grades NON-interactive containers, was handed
    // exclusively interactive elements and returned null every single time.
    // Both were proven silent by planted defect (an 800x360 <nav> in an
    // 800x600 viewport, and a <div> holding 12 buttons, produced no findings).
    //
    // The landmark and container elements already exist — `cssExtract`
    // gathers them a few lines above for the sensor layer. They were simply
    // never offered to the rules.
    const structuralElements = cssExtract?.structuralElements ?? [];
    const ruleContext = {
      isMobile: resolvedViewport.width < 768,
      viewportWidth: resolvedViewport.width,
      viewportHeight: resolvedViewport.height,
      url,
      allElements: [...elements.all, ...structuralElements],
    };
    // The always-on engine ran ONLY over interactive elements, so its two
    // content-shaped rules could never fire: `text-hierarchy/title-vs-
    // description` returns null unless the element is a heading, and
    // `spacing-grid/off-grid` grades the margins that set a page's rhythm —
    // which live on body copy. The content pass is added below, after content
    // extraction resolves; `runAllRules` filters by `appliesTo`, so the
    // touch-target and handler-integrity rules stay off paragraphs.
    const ruleEngine = runAllRules(elements.all, ruleContext);

    // Decide the preset rule set BEFORE extracting content, so a run that
    // grades no content never pays for the extra page.evaluate.
    //
    // `--rules` beats `.ibr/rules.json` beats DEFAULT_RULE_PRESETS. Passing
    // `--rules none` runs nothing. Before this, presets ran ONLY when --rules
    // was passed, so a bare scan graded no contrast and no touch targets and
    // still printed a verdict.
    const resolvedRules = await resolveRulesConfig(options.projectDir ?? process.cwd(), rulePresets);
    const activeRuleIds = new Set(getActiveRules(resolvedRules.config).map((r) => r.id));
    const gradesContent = configHasContentRules(resolvedRules.config);

    // CONTENT extraction (headings/paragraphs/images with real bounds) +
    // <head> metadata. Runs when the caller asked for it OR when a rule will
    // actually grade page content — body copy and headings are where most
    // readability defects live, and they were never reaching the rule engine.
    // Best-effort like cssExtract above: a broken extraction must not take
    // down the scan that requested it.
    let contentResult: { elements: ContentElement[] } | undefined;
    let metadataResult: PageMetadata | undefined;
    let contentElements: ContentElement[] = [];
    let contentExtractionFailed: string | undefined;
    if (options.content || gradesContent) {
      try {
        const [extractedContent, pageMetadata] = await Promise.all([
          extractContentElements(page),
          extractPageMetadata(page),
        ]);
        contentElements = extractedContent;
        // `content`/`metadata` stay ABSENT from the result unless the caller
        // asked, so a default scan pays no extra output tokens for elements it
        // only needed internally.
        if (options.content) {
          contentResult = { elements: extractedContent };
          metadataResult = pageMetadata;
        }
      } catch (err) {
        contentElements = [];
        contentResult = undefined;
        metadataResult = undefined;
        // Say so. Swallowing this produced output byte-identical in shape to a
        // page that genuinely has no headings or paragraphs: same PASS verdict,
        // same rule list, no body copy graded, nothing to tell them apart.
        // This whole commit exists because a coverage hole looked like a clean
        // page. `scan-obsidian` already sets the precedent — it grades PARTIAL
        // and names the defect class it can no longer see when its base CSS
        // will not load.
        contentExtractionFailed = err instanceof Error ? err.message : String(err);
        issues.push({
          category: 'structure' as const,
          severity: 'warning' as const,
          description: `[content-extraction-failed] Body copy and headings were NOT contrast-graded: ${contentExtractionFailed}`,
          fix: 'Re-run the scan. If it persists, the page navigated or detached mid-scan.',
        });
      }
    }

    // Adapt content into the rule engine's element shape. The `surface` option
    // is what keeps touch-target and handler-integrity rules off paragraphs:
    // only rules declaring `appliesTo: 'any' | 'text'` run on this pass.
    const contentAsElements = gradesContent ? contentElementsToEnhanced(contentElements) : [];

    // Landmarks and containers ONLY — an explicit allowlist, not "everything
    // structural minus the content tags".
    //
    // The subtractive version let `<span>` through, because span is in the
    // structural extractor's list and NOT in CONTENT_ELEMENT_TAGS. That
    // silently reversed a deliberate, documented decision: see the
    // CONTENT_SELECTORS comment in src/extract.ts — span and div wrap almost
    // everything, so grading them re-grades the same words many times at many
    // inherited colors. It showed up immediately as a wrapper reported with the
    // concatenated text of its three children.
    //
    // These rules need boxes that CONTAIN things (chrome area, child counts).
    // A text wrapper is not one, and inline span/div contrast stays the
    // declared gap it was, reported through `rulesApplied.gradedTags`.
    const containerElements = gradesContent
      ? structuralElements.filter((el) => CONTAINER_TAGS.has(el.tagName))
      : [];

    // Same surface filter the preset engine uses, applied to the always-on
    // rules. Without this, a heading was never handed to a rule that only
    // grades headings.
    ruleEngine.push(
      ...runAllRules([...contentAsElements, ...containerElements], ruleContext, { surface: 'content' }),
    );

    if (resolvedRules.presets.length > 0 || Object.keys(resolvedRules.config.rules ?? {}).length > 0) {
      const presetViolations = [
        ...runRules(elements.all, ruleContext as PresetRuleContext, resolvedRules.config, { surface: 'interactive' }),
        ...runRules(contentAsElements, ruleContext as PresetRuleContext, resolvedRules.config, { surface: 'content' }),
        // Containers and landmarks. CONTENT_SELECTORS covers text carriers
        // (h1-h6, p, li, td...) and deliberately excludes wrappers, so a
        // <nav>/<section>/<div> was iterated by NO pass and the container
        // rules could not fire even once the styles existed. Filtered to the
        // tags the content pass does not already carry, so nothing is graded
        // twice.
        ...runRules(containerElements, ruleContext as PresetRuleContext, resolvedRules.config, { surface: 'content' }),
      ];
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

    // How much text was actually GRADED. Zero findings and zero measurements
    // are different outcomes and used to be indistinguishable — that ambiguity
    // is what let a contrast rule that measured nothing read as a clean page.
    const contrastCoverage = activeRuleIds.has('wcag-aa-contrast') || activeRuleIds.has('wcag-aaa-contrast')
      ? summarizeContrastCoverage([...elements.all, ...contentAsElements])
      : undefined;

    // Verdict is computed HERE, after every violation has been aggregated into
    // `issues`. It used to be computed before the preset violations were
    // injected, so a scan could print a contrast ERROR and still report PASS.
    const verdict = determineVerdict(issues);
    const summary = generateSummary(elements, interactivity, semantic, issues, consoleErrors);

    // Generate condensed summaries
    const summaries = summarizeScan(elements.all, url);

    // Run caller-supplied DOM probes against the settled page. Best-effort by
    // contract: a probe is a supplementary measurement, and a broken one must
    // not take down the scan that carries it. Sequential rather than parallel —
    // probes measure LAYOUT, and concurrent evaluation on one page buys nothing.
    let probeResults: Record<string, unknown> | undefined;
    if (options.probes) {
      for (const [name, expression] of Object.entries(options.probes)) {
        try {
          const value = await driver.evaluate(expression);
          probeResults = { ...(probeResults ?? {}), [name]: value };
        } catch {
          // Absent from the map = "did not run". See ScanResult.probes.
        }
      }
    }

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
      rulesApplied: {
        presets: resolvedRules.presets,
        source: resolvedRules.source,
        gradedContentElements: contentAsElements.length,
        // A count with no denominator is the same ambiguity this commit set out
        // to remove: "42 measured" reads as coverage without saying coverage OF
        // WHAT. Naming the tags makes the gap (span, div, and other inline
        // wrappers are not graded on their own) legible instead of assumed.
        ...(gradesContent ? { gradedTags: [...CONTENT_ELEMENT_TAGS] } : {}),
        ...(contentExtractionFailed ? { contentExtractionFailed } : {}),
      },
      ...(contrastCoverage ? { contrastCoverage } : {}),
      summaries,
      probes: probeResults,
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
      skeleton: (skeletonResult && !skeletonResult.settled)
        ? { persistent: true, count: skeletonResult.skeletonCount }
        : undefined,
      // Spread rather than a plain key: false/absent `content` must leave
      // both fields entirely ABSENT from the result (not present with value
      // `undefined`) so existing callers and their token cost are unchanged.
      ...(contentResult ? { content: contentResult, metadata: metadataResult } : {}),
      verdict,
      issues,
      summary,
    };

    // Skeleton PARTIAL takes priority — a scan that captured skeleton-as-content
    // is structurally incomplete regardless of network/waitFor state.
    if (skeletonResult && !skeletonResult.settled) {
      const skeletonTimeout = patience ?? 8000;
      const skeletonReason = `Persistent skeleton/loading state — ${skeletonResult.skeletonCount} skeleton nodes still present after ${skeletonTimeout}ms; content may not have loaded. Re-scan or use a headed browser.`;
      const networkReason = (patience && (networkIdleTimedOut || waitForTimedOut))
        ? ` Additionally: ${networkIdleTimedOut ? 'network still active' : 'selector not found'}.`
        : '';
      return {
        ...baseResult,
        verdict: 'PARTIAL' as const,
        partialReason: skeletonReason + networkReason,
      };
    }

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
  // A THROW HERE USED TO VANISH. `.catch(() => undefined)` discarded the error
  // without binding it, and `runDesignSystemCheck` also returns `undefined`
  // when no config exists — so a malformed `.ibr/design-system.json` produced
  // output byte-identical to having no design system at all. Proven by planted
  // config: writing `{ this is not json` yielded no `designSystem` section, no
  // issue, and no warning, on a page with 52 real token violations. The user
  // asked for design-system enforcement and silently got none.
  let designSystemConfigError: string | undefined;
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
  ).catch((err) => {
    designSystemConfigError = err instanceof Error ? err.message : String(err);
    return undefined;
  });

  if (designSystemConfigError) {
    issues.push({
      category: 'design-system' as const,
      severity: 'error' as const,
      description: `[design-system-config-failed] Design system checks did NOT run: ${designSystemConfigError}`,
      fix: 'Fix .ibr/design-system.json (malformed JSON, or a field that fails the schema). Until then no principle or token check is being applied.',
    });
  }

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
 * Text-contrast measurement accounting for one scan.
 *
 * Every text-bearing element lands in exactly one bucket, so `measured +
 * assumedWhiteBackground` is the count a reader can trust a clean contrast
 * report against, and `unmeasurable` is the count that still needs a human.
 */
export interface ContrastCoverage {
  /** Elements considered (interactive + content), before text filtering. */
  candidates: number;
  /** Graded against a background that was actually found in the DOM. */
  measured: number;
  /** Graded, but no opaque background existed anywhere up the tree — white was assumed. */
  assumedWhiteBackground: number;
  /** A color in the stack could not be decoded. Each one also emits a warn-level finding. */
  unmeasurable: number;
  /** `color: transparent` or alpha 0 — the text is not painted, so there is nothing to grade. */
  invisibleText: number;
  /** No rendered text. */
  noText: number;
  /** No computed styles were captured (extraction gap, not a page problem). */
  noStyles: number;
}

/**
 * Tally what the contrast rules were actually able to look at.
 *
 * Uses the SAME `measureElementContrast` the rules use, so the accounting
 * cannot drift from the grading — a second implementation here would be able
 * to claim coverage the rules never had.
 */
export function summarizeContrastCoverage(elements: EnhancedElement[]): ContrastCoverage {
  const coverage: ContrastCoverage = {
    candidates: elements.length,
    measured: 0,
    assumedWhiteBackground: 0,
    unmeasurable: 0,
    invisibleText: 0,
    noText: 0,
    noStyles: 0,
  };

  for (const element of elements) {
    const m = measureElementContrast(element);
    switch (m.status) {
      case 'measured':
        if (m.backgroundResolved) coverage.measured++;
        else coverage.assumedWhiteBackground++;
        break;
      case 'unmeasurable':
        coverage.unmeasurable++;
        break;
      case 'invisible':
        coverage.invisibleText++;
        break;
      case 'no-text':
        coverage.noText++;
        break;
      case 'no-styles':
        coverage.noStyles++;
        break;
    }
  }

  return coverage;
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

  // What actually ran, and how much it measured. Printed unconditionally: "no
  // issues" is only trustworthy next to the count of things that were checked.
  if (result.rulesApplied) {
    const { presets, source, gradedContentElements } = result.rulesApplied;
    lines.push('  CHECKS');
    lines.push('  ──────');
    lines.push(
      presets.length > 0
        ? `  Rules:              ${presets.join(', ')} (${source})`
        : `  Rules:              \x1b[33mnone — no preset rules ran (${source})\x1b[0m`,
    );
    // Printed whenever a content rule was active, including at ZERO. Hiding the
    // line at zero made "extraction failed" and "this page has no body copy"
    // render identically — the exact ambiguity this work exists to remove.
    if (result.rulesApplied.gradedTags) {
      lines.push(`  Content graded:     ${gradedContentElements} (${result.rulesApplied.gradedTags.join(', ')})`);
    }
    if (result.rulesApplied.contentExtractionFailed) {
      lines.push(`  \x1b[33m!\x1b[0m Content extraction FAILED — no body copy or headings were graded.`);
    }
    const cc = result.contrastCoverage;
    if (cc) {
      // "Text graded", not "Text measured": the JSON field `measured` excludes
      // assumedWhiteBackground while this line includes it, and one word
      // meaning two numbers across the two surfaces a reader consumes is how a
      // coverage claim gets misread.
      lines.push(`  Text graded:        ${cc.measured + cc.assumedWhiteBackground}`);
      if (cc.assumedWhiteBackground > 0) {
        lines.push(`    measured against a real background: ${cc.measured}; against assumed white: ${cc.assumedWhiteBackground}`);
      }
      if (cc.unmeasurable > 0) {
        lines.push(`  \x1b[33mNot measurable:     ${cc.unmeasurable} (color could not be decoded)\x1b[0m`);
      }
      if (cc.noStyles > 0) {
        lines.push(`  \x1b[33mNo styles captured: ${cc.noStyles}\x1b[0m`);
      }
      if (cc.measured + cc.assumedWhiteBackground === 0) {
        lines.push('  \x1b[33m!\x1b[0m No text was graded — a clean contrast result here means nothing.');
      }
    }
    lines.push('');
  }

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

  // Issues, ranked so the user-impacting ones read first. Nothing is dropped —
  // ordering is the answer to volume, not suppression.
  if (result.issues.length > 0) {
    const rank = { error: 0, warning: 1, info: 2 } as const;
    const ranked = [...result.issues].sort((a, b) => rank[a.severity] - rank[b.severity]);
    lines.push('  ISSUES');
    lines.push('  ──────');
    for (const issue of ranked) {
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
