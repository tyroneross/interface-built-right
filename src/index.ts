import { ConfigSchema, VIEWPORTS, type Config, type Session, type SessionQuery, type ComparisonReport } from './schemas.js';
import { captureScreenshot, closeBrowser } from './capture.js';
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
    } = options;

    const url = this.resolveUrl(path);

    // Create session
    const session = await createSession(this.config.outputDir, url, name, viewport);
    const paths = getSessionPaths(this.config.outputDir, session.id);

    // Capture baseline (outputDir enables auth state loading)
    await captureScreenshot({
      url,
      outputPath: paths.baseline,
      viewport,
      fullPage,
      waitForNetworkIdle: this.config.waitForNetworkIdle,
      timeout: this.config.timeout,
      outputDir: this.config.outputDir,
    });

    return {
      sessionId: session.id,
      baseline: paths.baseline,
      session,
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

// Export everything for programmatic use
export * from './schemas.js';
export * from './types.js';
export { captureScreenshot, closeBrowser, getViewport } from './capture.js';
export { compareImages, analyzeComparison, getVerdictDescription, detectChangedRegions } from './compare.js';
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
export { VIEWPORTS };
