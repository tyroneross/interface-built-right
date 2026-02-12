import { ConfigSchema, VIEWPORTS, type Config, type Session, type SessionQuery, type ComparisonReport, type Viewport } from './schemas.js';
import { captureScreenshot, captureWithLandmarks, closeBrowser } from './capture.js';
import { compareImages, analyzeComparison } from './compare.js';
import {
  createSession,
  getSession,
  updateSession,
  markSessionCompared,
  listSessions,
  getMostRecentSession,
  deleteSession,
  cleanSessions,
  getSessionPaths,
  findSessions,
  getTimeline,
  getSessionsByRoute,
  getSessionStats,
} from './session.js';
import { generateReport } from './report.js';
import type { StartSessionOptions, StartSessionResult, CleanOptions } from './types.js';
import { getSemanticOutput, formatSemanticText, type SemanticResult } from './semantic/index.js';
import { loginFlow, searchFlow, formFlow, type FlowLoginOptions, type FlowSearchOptions, type FlowFormOptions } from './flows/index.js';
import { chromium, type Page, type Browser, type BrowserContext } from 'playwright';
import { mkdir, access } from 'fs/promises';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { maybeAutoClean } from './cleanup.js';

// ============================================================================
// STANDALONE PROGRAMMATIC API
// These functions provide first-class programmatic comparison without
// requiring session management or CLI wrappers.
// ============================================================================

/**
 * Options for standalone compare function
 */
export interface CompareInput {
  /** URL to capture and compare (will auto-capture current state) */
  url?: string;
  /** Path to baseline image (required if no url) */
  baselinePath?: string;
  /** Path to current image (auto-captured if url provided) */
  currentPath?: string;
  /** Pixel difference threshold (0-100, default 1.0) */
  threshold?: number;
  /** Output directory for diff and temp files */
  outputDir?: string;
  /** Viewport configuration */
  viewport?: 'desktop' | 'mobile' | 'tablet' | Viewport;
  /** Capture full page */
  fullPage?: boolean;
  /** Wait for network idle before capture */
  waitForNetworkIdle?: boolean;
  /** Capture timeout in ms */
  timeout?: number;
}

/**
 * Result from standalone compare function
 */
export interface CompareResult {
  /** Whether images match within threshold */
  match: boolean;
  /** Percentage of pixels that differ */
  diffPercent: number;
  /** Number of differing pixels */
  diffPixels: number;
  /** Total pixels compared */
  totalPixels: number;
  /** Analysis verdict: MATCH, EXPECTED_CHANGE, UNEXPECTED_CHANGE, LAYOUT_BROKEN */
  verdict: string;
  /** Human-readable summary */
  summary: string;
  /** Regions with changes */
  changedRegions: Array<{
    location: string;
    description: string;
    severity: 'expected' | 'unexpected' | 'critical';
  }>;
  /** Recommendation for fixing issues */
  recommendation: string | null;
  /** Path to diff image (if generated) */
  diffPath?: string;
  /** Path to baseline used */
  baselinePath: string;
  /** Path to current image used */
  currentPath: string;
}

/**
 * Standalone compare function - compare images without session management
 *
 * @example
 * ```typescript
 * // Compare by URL (auto-captures current state)
 * const result = await compare({
 *   url: 'http://localhost:3000',
 *   baselinePath: './baseline.png'
 * });
 *
 * // Compare two existing images
 * const result = await compare({
 *   baselinePath: './baseline.png',
 *   currentPath: './current.png'
 * });
 *
 * // Compare URL with auto threshold
 * const result = await compare({
 *   url: 'http://localhost:3000',
 *   baselinePath: './baseline.png',
 *   threshold: 0.5  // 0.5% difference allowed
 * });
 * ```
 */
export async function compare(options: CompareInput): Promise<CompareResult> {
  const {
    url,
    baselinePath,
    currentPath,
    threshold = 1.0,
    outputDir = join(tmpdir(), 'ibr-compare'),
    viewport = 'desktop',
    fullPage = true,
    waitForNetworkIdle = true,
    timeout = 30000,
  } = options;

  // Validate inputs
  if (!baselinePath && !url) {
    throw new Error('Either baselinePath or url must be provided');
  }

  // Resolve viewport
  const resolvedViewport: Viewport = typeof viewport === 'string'
    ? VIEWPORTS[viewport] || VIEWPORTS.desktop
    : viewport;

  // Create output directory
  await mkdir(outputDir, { recursive: true });

  // Determine paths
  const timestamp = Date.now();
  const actualBaselinePath = baselinePath || join(outputDir, `baseline-${timestamp}.png`);
  let actualCurrentPath = currentPath || join(outputDir, `current-${timestamp}.png`);
  const diffPath = join(outputDir, `diff-${timestamp}.png`);

  // If URL provided but no baseline, capture baseline first
  if (url && !baselinePath) {
    await captureScreenshot({
      url,
      outputPath: actualBaselinePath,
      viewport: resolvedViewport,
      fullPage,
      waitForNetworkIdle,
      timeout,
    });
  }

  // If URL provided, capture current state
  if (url && !currentPath) {
    await captureScreenshot({
      url,
      outputPath: actualCurrentPath,
      viewport: resolvedViewport,
      fullPage,
      waitForNetworkIdle,
      timeout,
    });
  }

  // Verify files exist
  try {
    await access(actualBaselinePath);
  } catch {
    throw new Error(`Baseline image not found: ${actualBaselinePath}`);
  }
  try {
    await access(actualCurrentPath);
  } catch {
    throw new Error(`Current image not found: ${actualCurrentPath}`);
  }

  // Compare images
  const comparison = await compareImages({
    baselinePath: actualBaselinePath,
    currentPath: actualCurrentPath,
    diffPath,
    threshold: threshold / 100, // Convert percentage to 0-1 for pixelmatch
  });

  // Analyze results
  const analysis = analyzeComparison(comparison, threshold);

  // Close browser if we opened one
  await closeBrowser();

  return {
    match: comparison.match,
    diffPercent: comparison.diffPercent,
    diffPixels: comparison.diffPixels,
    totalPixels: comparison.totalPixels,
    verdict: analysis.verdict,
    summary: analysis.summary,
    changedRegions: analysis.changedRegions.map(r => ({
      location: r.location,
      description: r.description,
      severity: r.severity,
    })),
    recommendation: analysis.recommendation,
    diffPath: comparison.match ? undefined : diffPath,
    baselinePath: actualBaselinePath,
    currentPath: actualCurrentPath,
  };
}

/**
 * Options for batch comparison
 */
export interface CompareAllInput {
  /** Session ID to compare (uses most recent if not provided) */
  sessionId?: string;
  /** Output directory (defaults to .ibr) */
  outputDir?: string;
  /** Only compare sessions matching this URL pattern */
  urlPattern?: string | RegExp;
  /** Only compare sessions with these statuses */
  statuses?: Array<'baseline' | 'compared' | 'pending'>;
  /** Maximum number of sessions to compare */
  limit?: number;
}

/**
 * Batch compare all sessions or a filtered subset
 *
 * @example
 * ```typescript
 * // Compare all sessions
 * const results = await compareAll();
 *
 * // Compare sessions matching URL
 * const results = await compareAll({
 *   urlPattern: /\/dashboard/
 * });
 *
 * // Compare specific session
 * const results = await compareAll({
 *   sessionId: 'sess_abc123'
 * });
 * ```
 */
export async function compareAll(options: CompareAllInput = {}): Promise<CompareResult[]> {
  const {
    sessionId,
    outputDir = './.ibr',
    urlPattern,
    statuses = ['baseline'],
    limit = 50,
  } = options;

  const results: CompareResult[] = [];

  if (sessionId) {
    // Compare single session
    const session = await getSession(outputDir, sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    const paths = getSessionPaths(outputDir, session.id);

    const result = await compare({
      url: session.url,
      baselinePath: paths.baseline,
      outputDir: dirname(paths.diff),
      viewport: session.viewport,
    });

    results.push(result);
  } else {
    // Get all matching sessions
    let sessions = await listSessions(outputDir);

    // Filter by status
    sessions = sessions.filter(s => statuses.includes(s.status as 'baseline' | 'compared' | 'pending'));

    // Filter by URL pattern
    if (urlPattern) {
      const pattern = typeof urlPattern === 'string' ? new RegExp(urlPattern) : urlPattern;
      sessions = sessions.filter(s => pattern.test(s.url));
    }

    // Apply limit
    sessions = sessions.slice(0, limit);

    // Compare each session
    for (const session of sessions) {
      try {
        const paths = getSessionPaths(outputDir, session.id);
        const result = await compare({
          url: session.url,
          baselinePath: paths.baseline,
          outputDir: dirname(paths.diff),
          viewport: session.viewport,
        });
        results.push(result);
      } catch (err) {
        // Continue on individual session failures
        console.warn(`Failed to compare session ${session.id}: ${err}`);
      }
    }
  }

  // Close browser after all comparisons
  await closeBrowser();

  return results;
}

// ============================================================================
// CLASS-BASED API (Original)
// ============================================================================

export class InterfaceBuiltRight {
  private config: Config;

  constructor(options: Partial<Config> = {}) {
    // Validate and merge with defaults
    this.config = ConfigSchema.parse(options);
  }

  /**
   * Start a visual session by capturing a baseline screenshot
   */
  async startSession(path: string, options: StartSessionOptions = {}): Promise<StartSessionResult> {
    const {
      name = this.generateSessionName(path),
      viewport = this.config.viewport,
      fullPage = this.config.fullPage,
      selector,
      waitFor,
    } = options;

    const url = this.resolveUrl(path);

    // Create session
    const session = await createSession(this.config.outputDir, url, name, viewport);
    const paths = getSessionPaths(this.config.outputDir, session.id);

    // Capture baseline with landmark detection (outputDir enables auth state loading)
    const captureResult = await captureWithLandmarks({
      url,
      outputPath: paths.baseline,
      viewport,
      fullPage,
      waitForNetworkIdle: this.config.waitForNetworkIdle,
      timeout: this.config.timeout,
      outputDir: this.config.outputDir,
      selector,
      waitFor,
    });

    // Update session with detected landmarks and page intent
    const updatedSession = await updateSession(this.config.outputDir, session.id, {
      landmarkElements: captureResult.landmarkElements,
      pageIntent: captureResult.pageIntent,
    });

    // Run auto-cleanup if enabled in retention config
    await maybeAutoClean(this.config.outputDir);

    return {
      sessionId: session.id,
      baseline: paths.baseline,
      session: updatedSession,
    };
  }

  /**
   * Check current state against baseline
   */
  async check(sessionId?: string): Promise<ComparisonReport> {
    // Get session
    const session = sessionId
      ? await getSession(this.config.outputDir, sessionId)
      : await getMostRecentSession(this.config.outputDir);

    if (!session) {
      throw new Error(sessionId
        ? `Session not found: ${sessionId}`
        : 'No sessions found. Run startSession first.');
    }

    const paths = getSessionPaths(this.config.outputDir, session.id);

    // Capture current screenshot (outputDir enables auth state loading)
    await captureScreenshot({
      url: session.url,
      outputPath: paths.current,
      viewport: session.viewport,
      fullPage: this.config.fullPage,
      waitForNetworkIdle: this.config.waitForNetworkIdle,
      timeout: this.config.timeout,
      outputDir: this.config.outputDir,
    });

    // Compare images
    const comparison = await compareImages({
      baselinePath: paths.baseline,
      currentPath: paths.current,
      diffPath: paths.diff,
      threshold: this.config.threshold / 100, // Convert percentage to 0-1 range for pixelmatch
    });

    // Analyze results
    const analysis = analyzeComparison(comparison, this.config.threshold);

    // Update session
    await markSessionCompared(this.config.outputDir, session.id, comparison, analysis);

    // Generate report
    return generateReport(session, comparison, analysis, this.config.outputDir);
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<Session | null> {
    return getSession(this.config.outputDir, sessionId);
  }

  /**
   * Get the most recent session
   */
  async getMostRecentSession(): Promise<Session | null> {
    return getMostRecentSession(this.config.outputDir);
  }

  /**
   * List all sessions
   */
  async listSessions(): Promise<Session[]> {
    return listSessions(this.config.outputDir);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    return deleteSession(this.config.outputDir, sessionId);
  }

  /**
   * Clean old sessions
   */
  async clean(options: CleanOptions = {}): Promise<{ deleted: string[]; kept: string[] }> {
    return cleanSessions(this.config.outputDir, options);
  }

  /**
   * Find sessions matching query criteria
   */
  async find(query: Partial<SessionQuery> = {}): Promise<Session[]> {
    return findSessions(this.config.outputDir, query);
  }

  /**
   * Get timeline of sessions for a specific route
   * Returns sessions in chronological order (oldest first)
   */
  async getTimeline(route: string, limit: number = 10): Promise<Session[]> {
    return getTimeline(this.config.outputDir, route, limit);
  }

  /**
   * Get sessions grouped by route
   */
  async getSessionsByRoute(): Promise<Record<string, Session[]>> {
    return getSessionsByRoute(this.config.outputDir);
  }

  /**
   * Get session statistics
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byViewport: Record<string, number>;
    byVerdict: Record<string, number>;
  }> {
    return getSessionStats(this.config.outputDir);
  }

  /**
   * Update baseline with current screenshot
   */
  async updateBaseline(sessionId?: string): Promise<Session> {
    const session = sessionId
      ? await getSession(this.config.outputDir, sessionId)
      : await getMostRecentSession(this.config.outputDir);

    if (!session) {
      throw new Error(sessionId
        ? `Session not found: ${sessionId}`
        : 'No sessions found.');
    }

    const paths = getSessionPaths(this.config.outputDir, session.id);

    // Capture new baseline (outputDir enables auth state loading)
    await captureScreenshot({
      url: session.url,
      outputPath: paths.baseline,
      viewport: session.viewport,
      fullPage: this.config.fullPage,
      waitForNetworkIdle: this.config.waitForNetworkIdle,
      timeout: this.config.timeout,
      outputDir: this.config.outputDir,
    });

    // Reset session status
    return updateSession(this.config.outputDir, session.id, {
      status: 'baseline',
      comparison: undefined,
      analysis: undefined,
    });
  }

  /**
   * Start a simplified session with semantic understanding
   *
   * This is the new simpler API - one line to start:
   * ```typescript
   * const session = await ibr.start('http://localhost:3000');
   * const understanding = await session.understand();
   * ```
   */
  async start(url: string, options: {
    viewport?: 'desktop' | 'mobile' | 'tablet';
    waitFor?: string;
    timeout?: number;
  } = {}): Promise<IBRSession> {
    const fullUrl = this.resolveUrl(url);
    const viewportName = options.viewport || 'desktop';
    const viewport = VIEWPORTS[viewportName];

    // Launch browser
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    });
    const page = await context.newPage();

    // Navigate
    await page.goto(fullUrl, {
      waitUntil: 'domcontentloaded',
      timeout: options.timeout || this.config.timeout,
    });

    // Wait for network idle
    if (this.config.waitForNetworkIdle) {
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    }

    // Wait for specific selector if provided
    if (options.waitFor) {
      await page.waitForSelector(options.waitFor, { timeout: 10000 }).catch(() => {});
    }

    return new IBRSession(page, browser, context, this.config);
  }

  /**
   * Close the browser instance
   */
  async close(): Promise<void> {
    await closeBrowser();
  }

  /**
   * Get configuration
   */
  getConfig(): Config {
    return { ...this.config };
  }

  /**
   * Resolve a path to full URL
   */
  private resolveUrl(path: string): string {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    return `${this.config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  /**
   * Generate a session name from path
   */
  private generateSessionName(path: string): string {
    // Remove leading slash and replace remaining slashes with dashes
    return path
      .replace(/^\/+/, '')
      .replace(/\//g, '-')
      .replace(/[^a-zA-Z0-9-_]/g, '')
      || 'homepage';
  }
}

/**
 * IBRSession - Simplified session with semantic understanding
 *
 * Provides a cleaner API for interacting with pages and getting
 * AI-friendly semantic output.
 */
export class IBRSession {
  /** Raw Playwright page for advanced use */
  readonly page: Page;

  private browser: Browser;
  private context: BrowserContext;
  private config: Config;

  constructor(page: Page, browser: Browser, context: BrowserContext, config: Config) {
    this.page = page;
    this.browser = browser;
    this.context = context;
    this.config = config;
  }

  /**
   * Get semantic understanding of the current page
   */
  async understand(): Promise<SemanticResult> {
    return getSemanticOutput(this.page);
  }

  /**
   * Get semantic understanding as formatted text
   */
  async understandText(): Promise<string> {
    const result = await getSemanticOutput(this.page);
    return formatSemanticText(result);
  }

  /**
   * Click an element by selector
   */
  async click(selector: string): Promise<void> {
    await this.page.click(selector);
  }

  /**
   * Type text into an element
   */
  async type(selector: string, text: string): Promise<void> {
    await this.page.fill(selector, text);
  }

  /**
   * Navigate to a new URL
   */
  async goto(url: string): Promise<void> {
    await this.page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: this.config.timeout,
    });
  }

  /**
   * Wait for a selector to appear
   */
  async waitFor(selector: string, timeout = 10000): Promise<void> {
    await this.page.waitForSelector(selector, { timeout });
  }

  /**
   * Take a screenshot
   */
  async screenshot(path?: string): Promise<Buffer> {
    return this.page.screenshot({
      path,
      fullPage: this.config.fullPage,
    });
  }

  /**
   * Mock a network request (thin wrapper on page.route)
   */
  async mock(pattern: string | RegExp, response: {
    status?: number;
    body?: string | object;
    headers?: Record<string, string>;
  }): Promise<void> {
    await this.page.route(pattern, async (route) => {
      const body = typeof response.body === 'object'
        ? JSON.stringify(response.body)
        : response.body || '';

      await route.fulfill({
        status: response.status || 200,
        body,
        headers: {
          'Content-Type': typeof response.body === 'object'
            ? 'application/json'
            : 'text/plain',
          ...response.headers,
        },
      });
    });
  }

  /**
   * Built-in flows for common automation patterns
   */
  readonly flow = {
    /**
     * Login with email/password
     * @example
     * const result = await session.flow.login({ email: 'test@test.com', password: 'secret' });
     */
    login: (options: Omit<FlowLoginOptions, 'timeout'>) =>
      loginFlow(this.page, { ...options, timeout: this.config.timeout }),

    /**
     * Search for content
     * @example
     * const result = await session.flow.search({ query: 'test' });
     */
    search: (options: Omit<FlowSearchOptions, 'timeout'>) =>
      searchFlow(this.page, { ...options, timeout: this.config.timeout }),

    /**
     * Fill and submit a form
     * @example
     * const result = await session.flow.form({
     *   fields: [{ name: 'email', value: 'test@test.com' }]
     * });
     */
    form: (options: Omit<FlowFormOptions, 'timeout'>) =>
      formFlow(this.page, { ...options, timeout: this.config.timeout }),
  };

  /**
   * Measure Web Vitals performance metrics
   * @example
   * const result = await session.measurePerformance();
   * console.log(result.ratings.LCP); // { value: 1200, rating: 'good' }
   */
  async measurePerformance() {
    const { measurePerformance: mp } = await import('./performance.js');
    return mp(this.page);
  }

  /**
   * Test interactivity of buttons, links, and forms
   * @example
   * const result = await session.testInteractivity();
   * console.log(result.issues); // List of issues with buttons/links
   */
  async testInteractivity() {
    const { testInteractivity: ti } = await import('./interactivity.js');
    return ti(this.page);
  }

  /**
   * Start tracking API request timing
   * Call before actions, then call stop() to get results
   * @example
   * const tracker = session.trackApiTiming({ filter: /\/api\// });
   * tracker.start();
   * await session.click('button');
   * const result = tracker.stop();
   */
  trackApiTiming(options?: { filter?: RegExp; includeStatic?: boolean; minDuration?: number }) {
    // Import synchronously for tracker creation
    const createTracker = async () => {
      const { createApiTracker } = await import('./api-timing.js');
      return createApiTracker(this.page, options);
    };
    // Return a promise that resolves to the tracker
    return createTracker();
  }

  /**
   * Close the session and browser
   */
  async close(): Promise<void> {
    await this.context.close();
    await this.browser.close();
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Standalone programmatic API (recommended for most users)
// compare() and compareAll() are exported inline above
// Types re-exported for convenience

// Export everything for programmatic use
export * from './schemas.js';
export * from './types.js';
export { DEFAULT_DYNAMIC_SELECTORS } from './types.js';
export type { MaskOptions } from './types.js';
export { captureScreenshot, closeBrowser, getViewport, captureWithDiagnostics } from './capture.js';
export type { CaptureResult } from './capture.js';
export { checkConsistency, formatConsistencyReport } from './consistency.js';
export type { ConsistencyOptions, ConsistencyResult, PageMetrics, Inconsistency } from './consistency.js';
export { compareImages, analyzeComparison, getVerdictDescription, detectChangedRegions } from './compare.js';
export type { ExtendedComparisonResult } from './compare.js';
export { discoverPages, getNavigationLinks } from './crawl.js';
export type { CrawlOptions, CrawlResult, DiscoveredPage } from './crawl.js';
export {
  createSession,
  getSession,
  updateSession,
  markSessionCompared,
  listSessions,
  getMostRecentSession,
  deleteSession,
  cleanSessions,
  getSessionPaths,
  generateSessionId,
  findSessions,
  getTimeline,
  getSessionsByRoute,
  getSessionStats,
} from './session.js';
export { generateReport, formatReportText, formatReportJson, formatReportMinimal, formatSessionSummary } from './report.js';
export {
  extractApiCalls,
  scanDirectoryForApiCalls,
  discoverApiRoutes,
  filePathToRoute,
  findOrphanEndpoints,
  groupByEndpoint,
  groupByFile,
  filterByMethod,
  filterByEndpoint,
} from './integration.js';
export type { ApiCall, ApiRoute } from './integration.js';
export { VIEWPORTS };
export {
  registerOperation,
  completeOperation,
  getPendingOperations,
  waitForCompletion,
  formatPendingOperations,
  withOperationTracking,
} from './operation-tracker.js';
export type { PendingOperation, OperationState, OperationType } from './operation-tracker.js';

// Semantic layer exports
export * from './semantic/index.js';

// Flows exports
export * from './flows/index.js';

// Cleanup and retention exports
export {
  enforceRetentionPolicy,
  maybeAutoClean,
  getRetentionStatus,
  formatRetentionStatus,
  loadRetentionConfig,
  DEFAULT_RETENTION,
} from './cleanup.js';
export type { RetentionConfig, RetentionResult } from './cleanup.js';

// Performance testing exports
export {
  measureWebVitals,
  measurePerformance,
  formatPerformanceResult,
  PERFORMANCE_THRESHOLDS,
} from './performance.js';
export type {
  WebVitals,
  PerformanceResult,
  PerformanceRating,
  RatedMetric,
} from './performance.js';

// Interactivity testing exports
export {
  testInteractivity,
  formatInteractivityResult,
} from './interactivity.js';
export type {
  InteractivityResult,
  InteractiveElement,
  ButtonInfo,
  LinkInfo,
  FormInfo,
  FormFieldInfo,
  InteractivityIssue,
} from './interactivity.js';

// API timing exports
export {
  measureApiTiming,
  createApiTracker,
  formatApiTimingResult,
} from './api-timing.js';
export type {
  ApiTimingResult,
  ApiRequestTiming,
  ApiTimingOptions,
} from './api-timing.js';

// Responsive testing exports
export {
  testResponsive,
  formatResponsiveResult,
} from './responsive.js';
export type {
  ResponsiveResult,
  ViewportResult,
  LayoutIssue,
  TouchTargetIssue,
  TextIssue,
  ResponsiveTestOptions,
} from './responsive.js';

// Memory system exports
export {
  initMemory,
  loadSummary,
  saveSummary,
  addPreference,
  getPreference,
  removePreference,
  listPreferences,
  learnFromSession,
  listLearned,
  promoteToPreference,
  rebuildSummary,
  archiveSummary,
  queryMemory,
  preferencesToRules,
  createMemoryPreset,
  formatMemorySummary,
  formatPreference,
} from './memory.js';

// Decision context system exports
export {
  recordDecision,
  getDecisionsByRoute,
  queryDecisions,
  getDecision,
  getTrackedRoutes,
  getDecisionStats,
  getDecisionsSize,
} from './decision-tracker.js';
export type { RecordDecisionOptions, QueryDecisionsOptions } from './decision-tracker.js';

export {
  loadCompactContext,
  saveCompactContext,
  updateCompactContext,
  compactContext,
  setActiveRoute,
  addKnownIssue,
  isCompactContextOversize,
} from './context/compact.js';

export * from './context/types.js';
