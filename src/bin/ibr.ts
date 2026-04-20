import { Command } from 'commander';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { EngineDriver } from '../engine/driver.js';
import type { BrowserConnectionOptions } from '../engine/cdp/browser.js';
import type { BrowserDriver } from '../engine/types.js';
import { CompatPage } from '../engine/compat.js';
import {
  InterfaceBuiltRight,
  formatReportText,
  formatReportJson,
  formatReportMinimal,
  formatSessionSummary,
  VIEWPORTS,
  type Config,
} from '../index.js';
import {
  registerOperation,
  completeOperation,
  getPendingOperations,
  waitForCompletion,
  formatPendingOperations,
} from '../operation-tracker.js';
import type { FixGuide } from '../native/fix-guide.js';

// =============================================================================
// FORMAT HELPERS
// =============================================================================

function formatFixGuide(guide: FixGuide): string {
  const lines: string[] = [];
  const count = guide.issues.length;

  // Count unique files
  const files = new Set(guide.issues.map(i => i.source?.file).filter(Boolean));
  const fileCount = files.size;

  lines.push('═══════════════════════════════════════════════════════');
  lines.push(`  IBR FIX GUIDE — ${count} ${count === 1 ? 'issue' : 'issues'}${fileCount > 0 ? ` in ${fileCount} ${fileCount === 1 ? 'file' : 'files'}` : ''}`);
  lines.push('═══════════════════════════════════════════════════════');

  if (guide.screenshot) {
    lines.push('');
    lines.push(`  Annotated: ${guide.screenshot}`);
  }

  const CIRCLED = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩',
                   '⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳'];

  for (let idx = 0; idx < guide.issues.length; idx++) {
    const i = guide.issues[idx];
    const num = idx < CIRCLED.length ? CIRCLED[idx] : `(${idx + 1})`;
    lines.push('');
    lines.push(`  ${num} [${i.severity}] ${i.what} (${i.where.screenRegion})`);
    lines.push(`     Element: ${i.where.element} — ${i.current}`);
    if (i.source) {
      const conf = Math.round(i.source.confidence * 10) / 10;
      lines.push(`     Source:  ${i.source.file}${i.source.line != null ? `:${i.source.line}` : ''} (${conf})`);
      if (i.source.searchPattern) {
        lines.push(`     Search:  ${i.source.searchPattern}`);
      }
    }
    lines.push(`     Fix:     ${i.suggestedFix}`);
  }

  if (count === 0) {
    lines.push('');
    lines.push('  No issues found.');
  }

  lines.push('');
  return lines.join('\n');
}

const program = new Command();

// ─────────────────────────────────────────────────────────────────────────
// Session lifecycle: disconnect + exit
//
// Every session:* subcommand (click, type, wait, scan, screenshot, capture,
// html, text, eval, actions, navigate, modal, etc.) calls getSession() →
// connectToBrowserServer() which opens a fresh CDP WebSocket AND spawns a
// new Chrome tab. When the action resolves:
//   1. The tab must be closed (otherwise tabs accumulate on the shared Chrome).
//   2. The WebSocket must be released (otherwise node's event loop hangs).
//
// We solve both with a single pattern:
//   - Each session command registers its PersistentSession via
//     `setActiveSession(session)` after getSession() returns.
//   - The postAction hook calls `session.disconnect()` (closes tab + WS)
//     then `process.exit()`.
//
// `session:start` is safe because its action blocks on a SIGINT-waiting
// Promise — postAction only fires on Ctrl+C when exiting is correct.
//
// `session:list`, `session:pending`, `session:close`, and `session:actions`
// don't always call getSession, so activeSession may be null — that's fine,
// disconnect() is a no-op on null.
// ─────────────────────────────────────────────────────────────────────────

/** Module-level ref so the postAction hook can reach the session opened by any command. */
let activeSession: { disconnect(): Promise<void> } | null = null;

/** Called by each session:* command after getSession() succeeds. */
function setActiveSession(session: { disconnect(): Promise<void> }): void {
  activeSession = session;
}

program.hook('postAction', async (_thisCommand, actionCommand) => {
  const name = actionCommand.name();
  if (!name.startsWith('session:')) return;
  // Gracefully close the per-command tab + WebSocket before exit.
  if (activeSession) {
    try {
      await activeSession.disconnect();
    } catch {
      // Non-fatal — process.exit below will tear down remaining handles anyway.
    }
    activeSession = null;
  }
  const code = typeof process.exitCode === 'number' ? process.exitCode : 0;
  setImmediate(() => process.exit(code));
});

program.hook('preAction', () => {
  const browserOpts = getBrowserConnectionOptions();
  if (browserOpts.mode) process.env.IBR_BROWSER_MODE = browserOpts.mode;
  if (browserOpts.cdpUrl) process.env.IBR_CDP_URL = browserOpts.cdpUrl;
  if (browserOpts.wsEndpoint) process.env.IBR_WS_ENDPOINT = browserOpts.wsEndpoint;
  if (browserOpts.chromePath) process.env.IBR_CHROME_PATH = browserOpts.chromePath;
});

// Load config from .ibrrc.json if it exists
async function loadConfig(): Promise<Partial<Config>> {
  const configPath = join(process.cwd(), '.ibrrc.json');
  if (existsSync(configPath)) {
    try {
      const content = await readFile(configPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      // Ignore config errors
    }
  }
  return {};
}

// Default IBR UI port
const IBR_DEFAULT_PORT = 4200;

// Check if a port is available
async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    import('net').then(({ createServer }) => {
      const server = createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      server.listen(port, '127.0.0.1');
    });
  });
}

// Find an available port starting from the given port
async function findAvailablePort(startPort: number, maxAttempts = 10): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available ports found in range ${startPort}-${startPort + maxAttempts - 1}`);
}

// Create IBR instance with config
async function createIBR(options: Record<string, unknown> = {}): Promise<InterfaceBuiltRight> {
  const config = await loadConfig();

  // Merge CLI options with config
  const merged: Partial<Config> = {
    ...config,
    ...(options.baseUrl ? { baseUrl: String(options.baseUrl) } : {}),
    ...(options.output ? { outputDir: String(options.output) } : {}),
    ...(options.viewport ? { viewport: VIEWPORTS[options.viewport as keyof typeof VIEWPORTS] } : {}),
    ...(options.threshold ? { threshold: Number(options.threshold) } : {}),
    ...(options.fullPage !== undefined ? { fullPage: Boolean(options.fullPage) } : {}),
    ...(options.browserMode ? { browserMode: String(options.browserMode) as Config['browserMode'] } : {}),
    ...(options.cdpUrl ? { cdpUrl: String(options.cdpUrl) } : {}),
    ...(options.wsEndpoint ? { wsEndpoint: String(options.wsEndpoint) } : {}),
    ...(options.chromePath ? { chromePath: String(options.chromePath) } : {}),
  };

  return new InterfaceBuiltRight(merged);
}

/**
 * Create the appropriate BrowserDriver based on --browser global option.
 * Defaults to Chrome (EngineDriver).
 */
async function createDriver(browser?: string): Promise<BrowserDriver> {
  if (browser === 'safari') {
    const { SafariDriver } = await import('../engine/safari/driver.js');
    return new SafariDriver();
  }
  return new EngineDriver();
}

/**
 * Merge global --chrome-path into launch options for EngineDriver.
 */
function getBrowserConnectionOptions(): BrowserConnectionOptions {
  const globalOpts = program.opts();
  return {
    mode: globalOpts.browserMode as BrowserConnectionOptions['mode'] | undefined,
    cdpUrl: globalOpts.cdpUrl as string | undefined,
    wsEndpoint: globalOpts.wsEndpoint as string | undefined,
    chromePath: globalOpts.chromePath as string | undefined,
  };
}

function withBrowserOptions<T extends Record<string, unknown>>(opts: T): T & {
  mode?: BrowserConnectionOptions['mode'];
  cdpUrl?: string;
  wsEndpoint?: string;
  chromePath?: string;
} {
  return {
    ...opts,
    ...getBrowserConnectionOptions(),
  };
}

program
  .name('ibr')
  .description('End-to-end design tool for AI coding agents')
  .version('1.0.0');

// Global options
program
  .option('-b, --base-url <url>', 'Base URL for the application')
  .option('-o, --output <dir>', 'Output directory', './.ibr')
  .option('-v, --viewport <name>', 'Viewport: desktop, mobile, tablet', 'desktop')
  .option('-t, --threshold <percent>', 'Diff threshold percentage', '1.0')
  .option('--browser <browser>', 'Browser to use: chrome or safari', 'chrome')
  .option('--browser-mode <mode>', 'Browser transport: local or connect')
  .option('--cdp-url <url>', 'Connect to an existing browser via CDP HTTP endpoint')
  .option('--ws-endpoint <url>', 'Connect to an existing browser via CDP WebSocket endpoint')
  .option('--chrome-path <path>', 'Path to Chrome/Chromium executable');

// Start command
program
  .command('start [url]')
  .description('Capture a baseline screenshot (auto-detects dev server if no URL)')
  .option('-n, --name <name>', 'Session name')
  .option('-s, --selector <css>', 'CSS selector to capture specific element')
  .option('-w, --wait-for <selector>', 'Wait for selector before screenshot')
  .option('--no-full-page', 'Capture only the viewport, not full page')
  .option('--headed', 'Show visible browser window (default: headless)')
  .option('--sandbox', 'Deprecated alias for --headed')
  .option('--debug', 'Visible browser + slow motion + devtools')
  .action(async (url: string | undefined, options: {
    name?: string;
    fullPage?: boolean;
    selector?: string;
    waitFor?: string;
    headed?: boolean;
    sandbox?: boolean;
    debug?: boolean;
  }) => {
    try {
      const resolvedUrl = await resolveBaseUrl(url);
      const ibr = await createIBR(program.opts());
      const result = await ibr.startSession(resolvedUrl, {
        name: options.name,
        fullPage: options.fullPage,
        selector: options.selector,
        waitFor: options.waitFor,
        headed: Boolean(options.headed || options.sandbox || options.debug),
        ...getBrowserConnectionOptions(),
      });

      console.log(`Session started: ${result.sessionId}`);
      console.log(`Baseline: ${result.baseline}`);
      console.log(`URL: ${result.session.url}`);
      console.log('');
      console.log('Next: Make your changes, then run:');
      console.log(`  npx ibr check ${result.sessionId}`);

      await ibr.close();
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Auto command - zero-config workflow
program
  .command('auto')
  .description('Zero-config: detect server, scan pages, open viewer')
  .option('-n, --max-pages <count>', 'Maximum pages to scan', '5')
  .option('--nav-only', 'Only scan navigation links (faster)')
  .option('--no-open', 'Do not open browser automatically')
  .action(async (options: { maxPages: string; navOnly?: boolean; open?: boolean }) => {
    try {
      // 1. Detect dev server
      const baseUrl = await detectDevServer();
      if (!baseUrl) {
        console.log('No dev server detected.');
        console.log('');
        console.log('Start your dev server, then run:');
        console.log('  npx ibr auto');
        console.log('');
        console.log('Or specify a URL:');
        console.log('  npx ibr scan-start http://localhost:3000');
        return;
      }

      console.log(`Detected: ${baseUrl}`);
      console.log('');

      // 2. Discover and capture pages
      const { discoverPages, getNavigationLinks } = await import('../crawl.js');
      const ibr = await createIBR(program.opts());

      let pages;
      if (options.navOnly) {
        pages = await getNavigationLinks(baseUrl);
        console.log(`Found ${pages.length} navigation links.`);
      } else {
        const result = await discoverPages({
          url: baseUrl,
          maxPages: parseInt(options.maxPages, 10),
        });
        pages = result.pages;
        console.log(`Discovered ${pages.length} pages.`);
      }

      if (pages.length === 0) {
        console.log('No pages found to capture.');
        await ibr.close();
        return;
      }

      console.log('Capturing baselines...');
      console.log('');

      let captured = 0;
      for (const page of pages) {
        try {
          const result = await ibr.startSession(page.url, {
            name: page.title.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase().slice(0, 50),
          });
          captured++;
          console.log(`  ${page.path} -> ${result.sessionId}`);
        } catch {
          console.log(`  ${page.path} -> failed`);
        }
      }

      await ibr.close();

      console.log('');
      console.log(`Captured ${captured}/${pages.length} pages.`);
      console.log('');
      console.log('Next steps:');
      console.log('  1. Make your UI changes');
      console.log('  2. Run: npx ibr scan-check');
      console.log('  3. View: npx ibr serve');

      // 3. Optionally open viewer
      if (options.open !== false && captured > 0) {
        console.log('');
        console.log('Opening viewer...');
        const { spawn } = await import('child_process');
        spawn('npx', ['ibr', 'serve'], {
          stdio: 'inherit',
          shell: true,
          detached: true,
        }).unref();
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Check command
program
  .command('check [sessionId]')
  .description('Compare current state against baseline')
  .option('-f, --format <format>', 'Output format: json, text, minimal', 'text')
  .action(async (sessionId: string | undefined, options: { format: string }) => {
    try {
      const ibr = await createIBR(program.opts());
      const report = await ibr.check(sessionId);

      switch (options.format) {
        case 'json':
          console.log(formatReportJson(report));
          break;
        case 'minimal':
          console.log(formatReportMinimal(report));
          break;
        default:
          console.log(formatReportText(report));
      }

      // Contextual tips based on verdict
      if (options.format === 'text') {
        console.log('');
        if (report.analysis.verdict === 'MATCH') {
          console.log('All good! To capture more pages: npx ibr scan');
        } else if (report.analysis.verdict === 'EXPECTED_CHANGE') {
          console.log('To accept as new baseline: npx ibr update');
        } else if (report.analysis.verdict === 'UNEXPECTED_CHANGE' || report.analysis.verdict === 'LAYOUT_BROKEN') {
          console.log('View diff in browser: npx ibr serve');
        }
      }

      await ibr.close();

      // Exit with error code if not matching and not expected
      if (!report.comparison.match &&
          (report.analysis.verdict === 'UNEXPECTED_CHANGE' ||
           report.analysis.verdict === 'LAYOUT_BROKEN')) {
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Audit command - context-aware UI audit with visual and semantic checks
program
  .command('audit [url]')
  .description('Full audit: functional checks + visual comparison + semantic verification')
  .option('-r, --rules <preset>', 'Override with preset (minimal). Auto-detects from CLAUDE.md by default')
  .option('--show-framework', 'Display detected design framework')
  .option('--check-apis [dir]', 'Cross-reference UI API calls against backend routes')
  .option('--visual', 'Include visual comparison against most recent baseline')
  .option('--baseline <session>', 'Compare against specific baseline session')
  .option('--semantic', 'Include semantic verification (expected elements, page intent)')
  .option('--full', 'Run all checks: functional + visual + semantic (default)')
  .option('--json', 'Output as JSON')
  .option('--fail-on <level>', 'Exit non-zero on errors/warnings', 'error')
  .action(async (url: string | undefined, options: { rules?: string; showFramework?: boolean; checkApis?: string | boolean; visual?: boolean; baseline?: string; semantic?: boolean; full?: boolean; json?: boolean; failOn: string }) => {
    try {
      const resolvedUrl = await resolveBaseUrl(url);
      const globalOpts = program.opts();

      // Import modules
      const { loadRulesConfig, runRules, createAuditResult, formatAuditResult, registerPreset } = await import('../rules/engine.js');
      const { register } = await import('../rules/presets/minimal.js');
      const { extractInteractiveElements } = await import('../extract.js');
      const { discoverUserContext, formatContextSummary } = await import('../context-loader.js');
      const { createPresetFromFramework } = await import('../rules/dynamic-rules.js');

      // Register built-in presets
      register();

      // Discover user context (design framework from CLAUDE.md)
      const userContext = await discoverUserContext(process.cwd());

      // Show framework info if requested
      if (options.showFramework) {
        console.log(formatContextSummary(userContext));
        console.log('');
        if (!url) return; // Exit if just showing framework
      }

      // Load rules config
      const rulesConfig = await loadRulesConfig(process.cwd());

      // Priority: CLI flag > config file > detected framework > minimal
      if (options.rules) {
        // CLI flag overrides everything
        rulesConfig.extends = [options.rules];
        console.log(`Using preset: ${options.rules}`);
      } else if (rulesConfig.extends && rulesConfig.extends.length > 0) {
        // Config file has explicit rules
        console.log(`Using configured presets: ${rulesConfig.extends.join(', ')}`);
      } else if (userContext.framework) {
        // Auto-detect from CLAUDE.md
        const preset = createPresetFromFramework(userContext.framework);
        registerPreset(preset);
        rulesConfig.extends = [preset.name];
        console.log(`Detected: ${userContext.framework.name}`);
        console.log(`Source: ${userContext.framework.source}`);
        console.log(`Generated ${preset.rules.length} rules from ${userContext.framework.principles.length} principles`);
      } else {
        // No framework detected - show guidance
        console.log('No design framework detected in CLAUDE.md.');
        console.log('Running basic interactivity checks only.');
        console.log('');
        console.log('To enable design validation:');
        console.log('  Add your framework to ~/.claude/CLAUDE.md or .claude/CLAUDE.md');
        console.log('  Or use --rules minimal for basic checks');
        rulesConfig.extends = ['minimal'];
      }

      console.log('');
      console.log(`Auditing ${resolvedUrl}...`);
      console.log('');

      // Launch browser for audit
      const viewport = VIEWPORTS[globalOpts.viewport as keyof typeof VIEWPORTS] || VIEWPORTS.desktop;
      const driver = new EngineDriver();
      await driver.launch(withBrowserOptions({ headless: true, viewport: { width: viewport.width, height: viewport.height } }));
      const page = new CompatPage(driver);
      await page.goto(resolvedUrl, { waitUntil: 'networkidle', timeout: 30000 });

      // Wait for React/Vue/Angular hydration
      await page.waitForTimeout(1000);

      // Extract elements
      const elements = await extractInteractiveElements(page);

      // Run rules
      const isMobile = viewport.width < 768;
      const violations = runRules(elements, {
        isMobile,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        url: resolvedUrl,
        allElements: elements,
      }, rulesConfig);

      // Create result
      const result = createAuditResult(resolvedUrl, elements, violations);

      // Determine which checks to run (default: all if --full or no specific flags)
      const runVisual = options.full || options.visual || options.baseline || (!options.semantic && !options.checkApis);
      const runSemantic = options.full || options.semantic || (!options.visual && !options.baseline && !options.checkApis);

      // --- VISUAL COMPARISON ---
      let visualResult: {
        hasBaseline: boolean;
        verdict?: string;
        diffPercent?: number;
        baselineSession?: string;
        currentPath?: string;
        diffPath?: string;
      } | null = null;

      if (runVisual) {
        const { compareImages, analyzeComparison } = await import('../compare.js');
        const { listSessions, getSessionPaths } = await import('../session.js');
        const { mkdir, access } = await import('fs/promises');
        const { join } = await import('path');

        // Find baseline for this URL
        const outputDir = globalOpts.outputDir || '.ibr';
        const sessions = await listSessions(outputDir);

        // Find matching baseline (same URL path)
        const urlPath = new URL(resolvedUrl).pathname;
        let baselineSession = options.baseline
          ? sessions.find(s => s.id === options.baseline)
          : sessions
              .filter(s => new URL(s.url).pathname === urlPath && s.status !== 'compared')
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

        if (baselineSession) {
          const paths = getSessionPaths(outputDir, baselineSession.id);

          // Capture current screenshot
          const currentPath = paths.current;
          await mkdir(join(outputDir, 'sessions', baselineSession.id), { recursive: true });
          await page.screenshot({ path: currentPath, fullPage: true });

          // Check if baseline exists
          try {
            await access(paths.baseline);

            // Compare
            const comparison = await compareImages({
              baselinePath: paths.baseline,
              currentPath: currentPath,
              diffPath: paths.diff,
              threshold: 0.01,
            });

            const analysis = analyzeComparison(comparison, 1.0);

            visualResult = {
              hasBaseline: true,
              verdict: analysis.verdict,
              diffPercent: comparison.diffPercent,
              baselineSession: baselineSession.id,
              currentPath,
              diffPath: comparison.diffPercent > 0 ? paths.diff : undefined,
            };
          } catch {
            visualResult = { hasBaseline: false };
          }
        } else {
          visualResult = { hasBaseline: false };
        }
      }

      // --- SEMANTIC VERIFICATION ---
      let semanticResult: {
        pageIntent: string;
        confidence: number;
        authenticated: boolean | null;
        loading: boolean;
        hasErrors: boolean;
        ready: boolean;
        expectedElements: Array<{ element: string; found: boolean }>;
        issues: Array<{ type: string; problem: string }>;
      } | null = null;

      if (runSemantic) {
        const { getSemanticOutput, detectLandmarks, compareLandmarks, getExpectedLandmarksForIntent, getExpectedLandmarksFromContext, LANDMARK_SELECTORS } = await import('../semantic/index.js');
        const { listSessions } = await import('../session.js');
        const { readFile } = await import('fs/promises');
        const { join } = await import('path');

        const semantic = await getSemanticOutput(page);

        // --- HYBRID APPROACH: Baseline landmarks OR inferred from intent ---
        const outputDir = globalOpts.outputDir || '.ibr';
        const sessions = await listSessions(outputDir);
        const urlPath = new URL(resolvedUrl).pathname;

        // Find baseline session with landmark elements
        const baselineSession = sessions
          .filter(s => new URL(s.url).pathname === urlPath && s.landmarkElements && s.landmarkElements.length > 0)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

        let elementChecks: Array<{ element: string; found: boolean; source: 'baseline' | 'inferred' }> = [];

        if (baselineSession && baselineSession.landmarkElements) {
          // APPROACH 1: Compare against baseline landmarks
          const currentLandmarks = await detectLandmarks(page);
          void compareLandmarks(baselineSession.landmarkElements, currentLandmarks);

          // Check which baseline elements are now missing
          for (const landmark of baselineSession.landmarkElements) {
            if (landmark.found) {
              const stillExists = currentLandmarks.find(l => l.name === landmark.name && l.found);
              elementChecks.push({
                element: landmark.name.charAt(0).toUpperCase() + landmark.name.slice(1),
                found: !!stillExists,
                source: 'baseline',
              });
            }
          }
        } else {
          // APPROACH 2: Infer expected elements from page intent + user context
          const pageIntent = semantic.pageIntent.intent;
          const intentLandmarks = getExpectedLandmarksForIntent(pageIntent as any);

          // Try to load user context (CLAUDE.md design framework)
          let contextLandmarks: string[] = [];
          try {
            const claudeMdPath = join(process.cwd(), 'CLAUDE.md');
            const content = await readFile(claudeMdPath, 'utf-8');
            // Simple parsing - look for principles or requirements
            contextLandmarks = getExpectedLandmarksFromContext({ principles: [content] }) as any;
          } catch {
            // No CLAUDE.md, that's fine
          }

          // Combine intent + context landmarks (dedupe)
          const expectedLandmarkTypes = [...new Set([...intentLandmarks, ...contextLandmarks])];

          // Check each expected landmark on the current page
          for (const landmarkType of expectedLandmarkTypes) {
            const selector = LANDMARK_SELECTORS[landmarkType as keyof typeof LANDMARK_SELECTORS];
            if (selector) {
              const found = await page.$(selector);
              elementChecks.push({
                element: landmarkType.charAt(0).toUpperCase() + landmarkType.slice(1),
                found: !!found,
                source: 'inferred',
              });
            }
          }
        }

        // Collect semantic issues
        const semanticIssues: Array<{ type: string; problem: string }> = [];

        // Missing expected elements
        for (const check of elementChecks) {
          if (!check.found) {
            semanticIssues.push({
              type: 'missing-element',
              problem: `Expected ${check.element} not found (${check.source} from ${check.source === 'baseline' ? 'previous capture' : 'page intent'})`,
            });
          }
        }

        // Add issues from semantic analysis
        for (const issue of semantic.issues) {
          semanticIssues.push({
            type: issue.type,
            problem: issue.problem,
          });
        }

        semanticResult = {
          pageIntent: semantic.pageIntent.intent,
          confidence: semantic.confidence,
          authenticated: semantic.state.auth.authenticated,
          loading: semantic.state.loading.loading,
          hasErrors: semantic.state.errors.hasErrors,
          ready: semantic.state.ready,
          expectedElements: elementChecks.map(e => ({ element: e.element, found: e.found })),
          issues: semanticIssues,
        };
      }

      await driver.close();

      // Run integration checks if requested
      let integrationResult: { orphanCount: number; orphans: Array<{ endpoint: string; method: string; file: string; line?: number }> } | null = null;

      if (options.checkApis) {
        const { scanDirectoryForApiCalls, discoverApiRoutes, findOrphanEndpoints } = await import('../integration.js');

        const projectDir = typeof options.checkApis === 'string' ? options.checkApis : process.cwd();

        const [apiCalls, apiRoutes] = await Promise.all([
          scanDirectoryForApiCalls(projectDir),
          discoverApiRoutes(projectDir),
        ]);

        const orphans = findOrphanEndpoints(apiCalls, apiRoutes);

        integrationResult = {
          orphanCount: orphans.length,
          orphans: orphans.map(o => ({
            endpoint: o.call.endpoint,
            method: o.call.method,
            file: o.call.sourceFile,
            line: o.call.lineNumber,
          })),
        };
      }

      // Output
      if (options.json) {
        console.log(JSON.stringify({
          ...result,
          visual: visualResult,
          semantic: semanticResult,
          integration: integrationResult,
        }, null, 2));
      } else {
        console.log(formatAuditResult(result));

        // Print visual results
        if (visualResult) {
          console.log('');
          console.log('Visual Comparison:');
          if (visualResult.hasBaseline) {
            const verdictColor = visualResult.verdict === 'MATCH' ? '\x1b[32m' : // green
                                 visualResult.verdict === 'EXPECTED_CHANGE' ? '\x1b[33m' : // yellow
                                 '\x1b[31m'; // red
            console.log(`  Verdict: ${verdictColor}${visualResult.verdict}\x1b[0m`);
            console.log(`  Diff: ${visualResult.diffPercent?.toFixed(2)}%`);
            console.log(`  Baseline: ${visualResult.baselineSession}`);
            if (visualResult.diffPath) {
              console.log(`  Diff image: ${visualResult.diffPath}`);
            }
          } else {
            console.log('  No baseline found for this URL.');
            console.log('  Run: npx ibr start <url> --name "feature" to capture baseline first.');
          }
        }

        // Print semantic results
        if (semanticResult) {
          console.log('');
          console.log('Semantic Verification:');
          console.log(`  Page type: ${semanticResult.pageIntent} (${Math.round(semanticResult.confidence * 100)}% confidence)`);
          console.log(`  Ready: ${semanticResult.ready ? 'Yes' : 'No'}`);

          // Expected elements
          const missing = semanticResult.expectedElements.filter(e => !e.found);
          const found = semanticResult.expectedElements.filter(e => e.found);

          if (missing.length > 0) {
            console.log('');
            console.log('  Missing expected elements:');
            for (const el of missing) {
              console.log(`    \x1b[31m!\x1b[0m ${el.element}`);
            }
          }

          if (found.length > 0) {
            console.log('');
            console.log('  Found elements:');
            for (const el of found) {
              console.log(`    \x1b[32m✓\x1b[0m ${el.element}`);
            }
          }

          // Semantic issues
          if (semanticResult.issues.length > 0) {
            console.log('');
            console.log('  Semantic issues:');
            for (const issue of semanticResult.issues) {
              console.log(`    ! ${issue.problem}`);
            }
          }
        }

        // Print integration results if available
        if (integrationResult && integrationResult.orphanCount > 0) {
          console.log('');
          console.log('Integration Issues:');
          console.log(`  ${integrationResult.orphanCount} orphan API calls (UI calls backend that doesn't exist):`);
          console.log('');

          for (const orphan of integrationResult.orphans) {
            console.log(`  ! ${orphan.method} ${orphan.endpoint}`);
            console.log(`    Called from: ${orphan.file}${orphan.line ? `:${orphan.line}` : ''}`);
          }
        } else if (integrationResult) {
          console.log('');
          console.log('Integration: All API calls have matching backend routes.');
        }
      }

      // Exit code based on --fail-on
      const hasIntegrationErrors = integrationResult && integrationResult.orphanCount > 0;
      const hasVisualRegression = visualResult?.hasBaseline &&
        visualResult.verdict !== 'MATCH' &&
        visualResult.verdict !== 'EXPECTED_CHANGE';
      const hasSemanticIssues = semanticResult && semanticResult.issues.length > 0;
      const hasMissingElements = semanticResult &&
        semanticResult.expectedElements.some(e => !e.found);

      if (options.failOn === 'error' && (
        result.summary.errors > 0 ||
        hasIntegrationErrors ||
        hasVisualRegression ||
        hasMissingElements
      )) {
        process.exit(1);
      } else if (options.failOn === 'warning' && (
        result.summary.errors > 0 ||
        result.summary.warnings > 0 ||
        hasIntegrationErrors ||
        hasVisualRegression ||
        hasSemanticIssues
      )) {
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Apply output mode filtering post-scan.
 * Keeps library API (scan()) unchanged — trimming happens in the CLI layer.
 *
 * full    — default, no change
 * summary — omits elements.all and interactivity.detailedResults; keeps sensors, verdict, issues, console, semantic intent/state (~60% token reduction)
 * raw     — omits sensors; keeps everything else
 */
function applyOutputMode(result: import('../scan.js').ScanResult, mode: string): Partial<import('../scan.js').ScanResult> {
  if (mode === 'summary') {
    return {
      url: result.url,
      route: result.route,
      timestamp: result.timestamp,
      verdict: result.verdict,
      summary: result.summary,
      issues: result.issues,
      sensors: result.sensors,
      console: result.console,
      semantic: result.semantic ? {
        pageIntent: (result.semantic as unknown as Record<string, unknown>).pageIntent,
        state: (result.semantic as unknown as Record<string, unknown>).state,
      } as import('../scan.js').ScanResult['semantic'] : undefined,
      coverage: result.coverage,
      hydration: result.hydration,
    };
  }
  if (mode === 'raw') {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { sensors: _sensors, ...rest } = result as unknown as Record<string, unknown>;
    return rest as Partial<import('../scan.js').ScanResult>;
  }
  return result;
}

// Scan command - comprehensive end-to-end UI scan
program
  .command('scan <url>')
  .description('Full UI scan: elements + interactivity + semantic + console errors')
  .option('-v, --viewport <preset>', 'Viewport preset (desktop, mobile, tablet)', 'desktop')
  .option('--wait-for <selector>', 'Wait for selector before scanning')
  .option('--screenshot <path>', 'Save screenshot to path')
  .option('--json', 'Output as JSON')
  .option('--timeout <ms>', 'Page load timeout in ms', '30000')
  .option('--patience <ms>', 'Wait longer for slow async content (AI search, LLM results)')
  .option('--network-idle-timeout <ms>', 'Network idle timeout in ms (default: 10000)')
  .option('--rules <presets>', 'Comma-separated rule presets to enable (wcag-contrast,touch-targets,calm-precision,minimal)')
  .option('--output <mode>', 'Output mode: full (default), summary (sensor summaries + verdict only, ~60% fewer tokens), raw (no sensors)', 'full')
  .action(async (url: string, options: { viewport: string; waitFor?: string; screenshot?: string; json?: boolean; timeout: string; patience?: string; networkIdleTimeout?: string; rules?: string; output: string }) => {
    try {
      const { scan, formatScanResult } = await import('../scan.js');
      const resolvedUrl = await resolveBaseUrl(url);

      console.log(`Scanning ${resolvedUrl}...`);

      // Parse comma-separated rule presets
      const rulePresets = options.rules
        ? options.rules.split(',').map(s => s.trim()).filter(Boolean)
        : undefined;

      const result = await scan(resolvedUrl, {
        viewport: options.viewport as 'desktop' | 'mobile' | 'tablet',
        waitFor: options.waitFor,
        timeout: parseInt(options.timeout, 10),
        patience: options.patience ? parseInt(options.patience, 10) : undefined,
        networkIdleTimeout: options.networkIdleTimeout ? parseInt(options.networkIdleTimeout, 10) : undefined,
        screenshot: options.screenshot ? { path: options.screenshot } : undefined,
        rules: rulePresets,
        ...getBrowserConnectionOptions(),
      });

      if (options.json) {
        const output = applyOutputMode(result, options.output);
        console.log(JSON.stringify(output, null, 2));
      } else {
        console.log(formatScanResult(result));
      }

      // Exit with error code if scan failed
      if (result.verdict === 'FAIL') {
        process.exit(1);
      }
    } catch (error) {
      console.error('Scan error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Status command - show pending baselines
program
  .command('status')
  .description('Show sessions awaiting comparison (baselines without checks)')
  .action(async () => {
    try {
      const ibr = await createIBR(program.opts());
      const sessions = await ibr.listSessions();

      // Filter to baseline-only sessions (not yet compared)
      const pending = sessions.filter(s => s.status === 'baseline');

      if (pending.length === 0) {
        console.log('No pending visual checks.');
        console.log('');
        console.log('To capture a baseline:');
        console.log('  npx ibr start <url> --name "feature-name"');
        return;
      }

      console.log('Pending visual checks:');
      console.log('');

      for (const session of pending) {
        const age = Date.now() - new Date(session.createdAt).getTime();
        const ageStr = age < 60000 ? 'just now' :
                       age < 3600000 ? `${Math.floor(age / 60000)}m ago` :
                       age < 86400000 ? `${Math.floor(age / 3600000)}h ago` :
                       `${Math.floor(age / 86400000)}d ago`;

        const urlPath = new URL(session.url).pathname;
        console.log(`  ${session.id}  ${urlPath.padEnd(20)}  ${ageStr.padEnd(10)}  ${session.name || ''}`);
      }

      console.log('');
      console.log('Run comparison:');
      console.log('  npx ibr check              # checks most recent');
      console.log('  npx ibr check <session-id> # checks specific session');
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .description('List all sessions')
  .option('-f, --format <format>', 'Output format: json, text', 'text')
  .option('--by-app', 'Group sessions by app/branch (git context)')
  .action(async (options: { format: string; byApp?: boolean }) => {
    try {
      const ibr = await createIBR(program.opts());
      const sessions = await ibr.listSessions();

      if (sessions.length === 0) {
        console.log('No sessions found.');
        return;
      }

      if (options.format === 'json') {
        console.log(JSON.stringify(sessions, null, 2));
      } else if (options.byApp) {
        // Group by app context
        const { getAppContext } = await import('../git-context.js');
        const context = await getAppContext(process.cwd()).catch(() => null);
        const currentApp = context?.appName || 'unknown';
        const currentBranch = context?.branch || 'unknown';

        // Group sessions by URL domain or infer from session paths
        const groups: Map<string, typeof sessions> = new Map();

        for (const session of sessions) {
          let groupKey = 'Other';
          try {
            if (session.url) {
              const url = new URL(session.url);
              groupKey = url.hostname;
            }
          } catch {
            groupKey = 'Other';
          }

          if (!groups.has(groupKey)) {
            groups.set(groupKey, []);
          }
          groups.get(groupKey)!.push(session);
        }

        console.log(`Current App: ${currentApp} (${currentBranch})`);
        console.log('');

        for (const [groupName, groupSessions] of groups) {
          console.log(`${groupName} (${groupSessions.length} sessions)`);
          console.log('-'.repeat(50));
          for (const session of groupSessions) {
            console.log(`  ${formatSessionSummary(session)}`);
          }
          console.log('');
        }
      } else {
        console.log('Sessions:');
        console.log('');
        console.log('ID              STATUS    VIEWPORT  DATE        NAME');
        console.log('-'.repeat(70));
        for (const session of sessions) {
          console.log(formatSessionSummary(session));
        }
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Update command
program
  .command('update [sessionId]')
  .alias('approve')
  .description('Update baseline with current screenshot (alias: approve)')
  .action(async (sessionId: string | undefined) => {
    try {
      const ibr = await createIBR(program.opts());
      const session = await ibr.updateBaseline(sessionId);

      console.log(`Baseline updated for session: ${session.id}`);
      console.log(`URL: ${session.url}`);

      await ibr.close();
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Clean command
program
  .command('clean')
  .description('Clean old sessions')
  .option('--older-than <duration>', 'Delete sessions older than duration (e.g., 7d, 24h)')
  .option('--keep-last <count>', 'Keep the last N sessions', '0')
  .option('--dry-run', 'Show what would be deleted without deleting')
  .action(async (options: { olderThan?: string; keepLast: string; dryRun?: boolean }) => {
    try {
      const ibr = await createIBR(program.opts());
      const result = await ibr.clean({
        olderThan: options.olderThan,
        keepLast: parseInt(options.keepLast, 10),
        dryRun: options.dryRun,
      });

      if (options.dryRun) {
        console.log('Dry run - would delete:');
      } else {
        console.log('Cleaned:');
      }

      if (result.deleted.length === 0) {
        console.log('  No sessions to delete.');
      } else {
        for (const id of result.deleted) {
          console.log(`  - ${id}`);
        }
      }

      console.log(`\nKept: ${result.kept.length} sessions`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Delete command
program
  .command('delete <sessionId>')
  .description('Delete a specific session')
  .action(async (sessionId: string) => {
    try {
      const ibr = await createIBR(program.opts());
      const deleted = await ibr.deleteSession(sessionId);

      if (deleted) {
        console.log(`Deleted session: ${sessionId}`);
      } else {
        console.log(`Session not found: ${sessionId}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Serve command (placeholder - will be implemented with web-ui)
program
  .command('serve')
  .description('Start the comparison viewer web UI')
  .option('-p, --port <port>', `Port number (default: ${IBR_DEFAULT_PORT}, auto-scans for available)`)
  .option('--no-open', 'Do not open browser automatically')
  .action(async (options: { port?: string; open?: boolean }) => {
    const { spawn } = await import('child_process');
    const { resolve } = await import('path');

    // Find web-ui directory relative to package root
    // In CJS build, use process.cwd() or resolve from known location
    const packageRoot = resolve(process.cwd());
    let webUiDir = join(packageRoot, 'web-ui');

    // If not found in cwd, try relative to node_modules install
    if (!existsSync(webUiDir)) {
      // Try finding it relative to this package when installed as dependency
      const possiblePaths = [
        join(packageRoot, 'node_modules', 'interface-built-right', 'web-ui'),
        join(packageRoot, '..', 'interface-built-right', 'web-ui'),
      ];
      for (const p of possiblePaths) {
        if (existsSync(p)) {
          webUiDir = p;
          break;
        }
      }
    }

    // Check if web-ui exists
    if (!existsSync(webUiDir)) {
      console.log('Web UI not found. Please ensure web-ui directory exists.');
      console.log('');
      console.log('For now, you can view the comparison images directly:');

      try {
        const ibr = await createIBR(program.opts());
        const session = await ibr.getMostRecentSession();

        if (session) {
          const config = ibr.getConfig();
          console.log(`  Baseline: ${config.outputDir}/sessions/${session.id}/baseline.png`);
          console.log(`  Current:  ${config.outputDir}/sessions/${session.id}/current.png`);
          console.log(`  Diff:     ${config.outputDir}/sessions/${session.id}/diff.png`);
        }
      } catch {
        // Ignore errors
      }
      return;
    }

    // Determine port: use specified, or find available starting from default
    let port: number;
    if (options.port) {
      port = parseInt(options.port, 10);
      // Check if specified port is available
      if (!(await isPortAvailable(port))) {
        console.log(`Port ${port} is already in use.`);
        try {
          port = await findAvailablePort(port + 1);
          console.log(`Using next available port: ${port}`);
        } catch (e) {
          console.error(e instanceof Error ? e.message : 'Failed to find available port');
          process.exit(1);
        }
      }
    } else {
      // Auto-find available port starting from default
      try {
        port = await findAvailablePort(IBR_DEFAULT_PORT);
        if (port !== IBR_DEFAULT_PORT) {
          console.log(`Default port ${IBR_DEFAULT_PORT} in use, using port ${port}`);
        }
      } catch (e) {
        console.error(e instanceof Error ? e.message : 'Failed to find available port');
        process.exit(1);
      }
    }

    console.log(`Starting web UI on http://localhost:${port}`);
    console.log('Press Ctrl+C to stop the server.');
    console.log('');

    // Start Next.js dev server
    const server = spawn('npm', ['run', 'dev', '--', '-p', String(port)], {
      cwd: webUiDir,
      stdio: 'inherit',
      shell: true,
    });

    // Open browser after a short delay (if --no-open not specified)
    if (options.open !== false) {
      setTimeout(async () => {
        const open = (await import('child_process')).exec;
        const url = `http://localhost:${port}`;
        // Cross-platform open command
        const cmd = process.platform === 'darwin' ? 'open' :
                    process.platform === 'win32' ? 'start' : 'xdg-open';
        open(`${cmd} ${url}`);
      }, 3000);
    }

    // Handle server exit
    server.on('close', (code) => {
      if (code !== 0) {
        console.log(`Web UI server exited with code ${code}`);
      }
    });
  });

// Login command - save auth state for authenticated captures
program
  .command('login <url>')
  .description('Open browser for manual login, then save auth state for future captures')
  .option('--timeout <ms>', 'Timeout in milliseconds (default: 5 minutes)', '300000')
  .action(async (url: string, options: { timeout: string }) => {
    try {
      const { performLogin } = await import('../auth.js');
      const globalOpts = program.opts();
      const outputDir = globalOpts.output || './.ibr';

      await performLogin({
        url,
        outputDir,
        timeout: parseInt(options.timeout, 10),
        ...getBrowserConnectionOptions(),
      });
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Logout command - clear saved auth state
program
  .command('logout')
  .description('Clear saved authentication state')
  .action(async () => {
    try {
      const { clearAuthState } = await import('../auth.js');
      const globalOpts = program.opts();
      const outputDir = globalOpts.output || './.ibr';

      await clearAuthState(outputDir);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ============================================================
// FLOW COMMANDS - Pre-built interaction flows
// ============================================================

const flowCmd = program.command('flow').description('Execute pre-built interaction flows');

flowCmd.command('search <url>')
  .description('Execute search flow')
  .requiredOption('--query <text>', 'Search query')
  .option('--session <id>', 'Use existing session')
  .action(async (url: string, options: { query: string; session?: string }) => {
    try {
      const { EngineDriver } = await import('../engine/driver.js');
      const { CompatPage } = await import('../engine/compat.js');
      const { searchFlow } = await import('../flows/search.js');

      const driver = new EngineDriver();
      await driver.launch(withBrowserOptions({}));
      await driver.navigate(url);

      const page = new CompatPage(driver);
      const result = await searchFlow(page, { query: options.query });

      console.log(result.success ? 'Search flow succeeded' : 'Search flow failed');
      console.log(`Query: "${options.query}"`);
      console.log(`Results found: ${result.resultCount}`);
      if (result.error) console.log(`Error: ${result.error}`);

      result.steps.forEach(s => {
        console.log(`  ${s.success ? '✓' : '✗'} ${s.action}`);
      });

      await driver.close().catch(() => {});
      if (!result.success) process.exit(1);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

flowCmd.command('form <url>')
  .description('Fill and submit a form')
  .requiredOption('--fields <json>', 'Field values as JSON, e.g. \'{"Email":"test@example.com"}\'')
  .option('--no-submit', 'Fill without submitting')
  .option('--session <id>', 'Use existing session')
  .action(async (url: string, options: { fields: string; submit: boolean; session?: string }) => {
    try {
      const { EngineDriver } = await import('../engine/driver.js');
      const { CompatPage } = await import('../engine/compat.js');
      const { formFlow } = await import('../flows/form.js');

      let fieldMap: Record<string, string>;
      try {
        fieldMap = JSON.parse(options.fields);
      } catch {
        console.error('--fields must be valid JSON, e.g. \'{"Email":"test@example.com"}\'');
        process.exit(1);
        return;
      }

      const driver = new EngineDriver();
      await driver.launch(withBrowserOptions({}));
      await driver.navigate(url);

      const page = new CompatPage(driver);
      const formFields = Object.entries(fieldMap).map(([name, value]) => ({ name, value }));
      const result = await formFlow(page, {
        fields: formFields,
        submitButton: options.submit ? undefined : '__NO_SUBMIT__',
      });

      console.log(result.success ? 'Form flow succeeded' : 'Form flow failed');
      console.log(`Filled: ${result.filledFields.join(', ') || 'none'}`);
      if (result.failedFields.length > 0) {
        console.log(`Failed: ${result.failedFields.join(', ')}`);
      }
      if (result.error) console.log(`Error: ${result.error}`);

      await driver.close().catch(() => {});
      if (!result.success) process.exit(1);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

flowCmd.command('login <url>')
  .description('Execute login flow')
  .requiredOption('--username <text>', 'Username or email')
  .requiredOption('--password <text>', 'Password')
  .option('--session <id>', 'Use existing session')
  .action(async (url: string, options: { username: string; password: string; session?: string }) => {
    try {
      const { EngineDriver } = await import('../engine/driver.js');
      const { CompatPage } = await import('../engine/compat.js');
      const { loginFlow } = await import('../flows/login.js');

      const driver = new EngineDriver();
      await driver.launch(withBrowserOptions({}));
      await driver.navigate(url);

      const page = new CompatPage(driver);
      const result = await loginFlow(page, { email: options.username, password: options.password });

      console.log(result.success ? 'Login flow succeeded' : 'Login flow failed');
      console.log(`Logged in: ${result.authenticated}`);
      if (result.username) console.log(`Username detected: ${result.username}`);
      if (result.error) console.log(`Error: ${result.error}`);

      result.steps.forEach(s => {
        console.log(`  ${s.success ? '✓' : '✗'} ${s.action}`);
      });

      await driver.close().catch(() => {});
      if (!result.success) process.exit(1);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ============================================================
// LIVE SESSION COMMANDS - Interactive browser sessions
// ============================================================
// Uses Browser Server mode for persistent sessions across CLI invocations.
// The first session:start launches a headless browser server that persists
// until session:close all is called.

// Session start command - create interactive session with persistent browser
program
  .command('session:start [url]')
  .description('Start an interactive browser session (browser persists across commands)')
  .option('-n, --name <name>', 'Session name')
  .option('-w, --wait-for <selector>', 'Wait for selector before considering page ready')
  .option('--headed', 'Show visible browser window (default: headless)')
  .option('--sandbox', 'Deprecated alias for --headed')
  .option('--debug', 'Visible browser + slow motion + devtools')
  .option('--low-memory', 'Reduce memory usage for lower-powered machines (4GB RAM)')
  .option('--auto-capture', 'Auto-capture screenshot + scan after every interaction')
  .action(async (url: string | undefined, options: {
    name?: string;
    waitFor?: string;
    headed?: boolean;
    sandbox?: boolean;
    debug?: boolean;
    lowMemory?: boolean;
    autoCapture?: boolean;
  }) => {
    try {
      const {
        startBrowserServer,
        isServerRunning,
        PersistentSession,
      } = await import('../browser-server.js');
      const globalOpts = program.opts();
      const outputDir = globalOpts.output || './.ibr';
      const resolvedUrl = await resolveBaseUrl(url);
      const headed = Boolean(options.headed || options.sandbox || options.debug);
      const headless = !headed;

      // Check if browser server is already running
      const serverRunning = await isServerRunning(outputDir);

      if (!serverRunning) {
        // First session - launch browser server and keep process alive
        const modeLabel = options.lowMemory ? ' (low-memory mode)' : '';
        console.log(headless ? `Starting headless browser server${modeLabel}...` : `Starting visible browser server${modeLabel}...`);

        const { driver, ownsBrowser } = await startBrowserServer(outputDir, {
          headless,
          debug: options.debug,
          isolated: true,  // Prevents conflicts with Playwright MCP
          lowMemory: options.lowMemory,
          ...getBrowserConnectionOptions(),
        });

        // Create the session
        const session = await PersistentSession.create(outputDir, {
          url: resolvedUrl,
          name: options.name,
          waitFor: options.waitFor,
          viewport: VIEWPORTS[globalOpts.viewport as keyof typeof VIEWPORTS] || VIEWPORTS.desktop,
        });

        console.log('');
        console.log(`Session started: ${session.id}`);
        console.log(`URL: ${session.url}`);
        console.log('');
        console.log('Available commands (run in another terminal):');
        console.log(`  npx ibr session:click ${session.id} "<selector>"`);
        console.log(`  npx ibr session:type ${session.id} "<selector>" "<text>"`);
        console.log(`  npx ibr session:screenshot ${session.id}`);
        console.log(`  npx ibr session:scan ${session.id}          # structured scan data`);
        console.log(`  npx ibr session:capture ${session.id}        # screenshot + scan together`);
        console.log(`  npx ibr session:wait ${session.id} "<selector>"`);
        console.log('');
        if (options.autoCapture) {
          console.log('Auto-capture: ON (screenshot + scan after every interaction)');
          console.log('');
        }
        console.log('To close: npx ibr session:close all');
        console.log('');
        if (!ownsBrowser) {
          console.log('Connected to external browser. Session metadata saved.');
          await driver.disconnect();
          return;
        }

        console.log('Browser server running. Press Ctrl+C to stop.');

        // Keep process alive until SIGINT
        await new Promise<void>((resolve) => {
          const cleanup = async () => {
            console.log('\nShutting down browser server...');
            await driver.close();
            resolve();
          };
          process.on('SIGINT', cleanup);
          process.on('SIGTERM', cleanup);
        });
      } else {
        // Browser server already running - just create new session
        console.log('Connecting to existing browser server...');

        const session = await PersistentSession.create(outputDir, {
          url: resolvedUrl,
          name: options.name,
          waitFor: options.waitFor,
          viewport: VIEWPORTS[globalOpts.viewport as keyof typeof VIEWPORTS] || VIEWPORTS.desktop,
        });

        console.log('');
        console.log(`Session started: ${session.id}`);
        console.log(`URL: ${session.url}`);
        console.log('');
        console.log('Use session commands to interact:');
        console.log(`  npx ibr session:type ${session.id} "<selector>" "<text>"`);
        console.log(`  npx ibr session:click ${session.id} "<selector>"`);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Helper for session commands that need to connect
async function getSession(outputDir: string, sessionId: string) {
  const { PersistentSession, isServerRunning } = await import('../browser-server.js');

  if (!(await isServerRunning(outputDir))) {
    console.error('No browser server running.');
    console.log('');
    console.log('Start one with:');
    console.log('  npx ibr session:start <url>');
    console.log('');
    console.log('The first session:start launches the server and keeps it alive.');
    console.log('Run session commands in a separate terminal.');
    process.exit(1);
  }

  const session = await PersistentSession.get(outputDir, sessionId);
  if (!session) {
    console.error(`Session not found: ${sessionId}`);
    console.log('');
    console.log('This can happen if:');
    console.log('  1. The session ID is incorrect');
    console.log('  2. The session was created with a different browser server');
    console.log('');
    console.log('List sessions with: npx ibr session:list');
    process.exit(1);
  }

  return session;
}

// Session click command
program
  .command('session:click <sessionId> <selector>')
  .description('Click an element in an active session (auto-targets visible elements)')
  .option('--force', 'Force click, bypassing overlay interception checks')
  .action(async (sessionId: string, selector: string, options: { force?: boolean }) => {
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || './.ibr';
    const opId = await registerOperation(outputDir, {
      type: 'click',
      sessionId,
      command: `session:click ${sessionId} "${selector}"${options.force ? ' --force' : ''}`,
    });

    try {
      const session = await getSession(outputDir, sessionId);
      setActiveSession(session);

      await session.click(selector, { force: options.force });
      console.log(`Clicked: ${selector}${options.force ? ' (forced)' : ''}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error:', msg);
      console.log('');
      if (msg.includes('intercept') || msg.includes('pointer-events')) {
        console.log('Tip: Element is blocked by an overlay (modal, backdrop, etc.)');
        console.log('     Use --force to click through, or dismiss the overlay first');
        console.log('     npx ibr session:click ' + sessionId + ' "' + selector + '" --force');
      } else if (msg.includes('not visible') || msg.includes('Timeout')) {
        console.log('Tip: IBR auto-filters to visible elements. Element may be:');
        console.log('     - Hidden by CSS (display:none, visibility:hidden)');
        console.log('     - Off-screen or zero-sized');
        console.log('     Use session:html --selector "' + selector + '" to inspect');
      } else {
        console.log('Tip: Session is still active. Use session:html to inspect the DOM.');
      }
    } finally {
      await completeOperation(outputDir, opId);
    }
  });

// Session type command
program
  .command('session:type <sessionId> <selector> <text>')
  .description('Type text into an element in an active session')
  .option('--delay <ms>', 'Delay between keystrokes', '0')
  .option('--submit', 'Press Enter after typing (waits for network idle)')
  .option('--wait-after <ms>', 'Wait this long after typing/submitting before next command')
  .option('--append', 'Append to existing content without clearing')
  .action(async (sessionId: string, selector: string, text: string, options: { delay: string; submit?: boolean; waitAfter?: string; append?: boolean }) => {
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || './.ibr';
    const opId = await registerOperation(outputDir, {
      type: 'type',
      sessionId,
      command: `session:type ${sessionId} "${selector}" "${text.slice(0, 20)}..."`,
    });

    try {
      const session = await getSession(outputDir, sessionId);
      setActiveSession(session);

      await session.type(selector, text, {
        delay: parseInt(options.delay, 10),
        submit: options.submit,
        waitAfter: options.waitAfter ? parseInt(options.waitAfter, 10) : undefined,
        append: options.append,
      });

      const action = options.append ? 'Appended' : (options.submit ? 'Typed and submitted' : 'Typed');
      console.log(`${action}: "${text.length > 20 ? text.slice(0, 20) + '...' : text}" into: ${selector}`);
      if (options.submit) {
        console.log('Waited for network idle after submit');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error:', msg);
      console.log('');
      // Smart error suggestions
      if (msg.includes('not visible') || msg.includes('multiple elements')) {
        console.log('Tip: IBR auto-filters to visible elements. If still failing:');
        console.log('     - Use session:html to inspect the DOM');
        console.log('     - Try a more specific selector (add class, id, or attribute)');
      } else {
        console.log('Tip: Session is still active. Use session:html to inspect the page.');
      }
    } finally {
      await completeOperation(outputDir, opId);
    }
  });

// Session press command - keyboard key press
program
  .command('session:press <sessionId> <key>')
  .description('Press a keyboard key (Enter, Tab, Escape, ArrowDown, etc.)')
  .action(async (sessionId: string, key: string) => {
    try {
      const globalOpts = program.opts();
      const outputDir = globalOpts.output || './.ibr';
      const session = await getSession(outputDir, sessionId);
      setActiveSession(session);

      await session.press(key);
      console.log(`Pressed: ${key}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error:', msg);
      console.log('');
      console.log('Tip: Valid keys include: Enter, Tab, Escape, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Backspace, Delete, Space');
    }
  });

// Session scroll command
program
  .command('session:scroll <sessionId> <direction> [amount]')
  .description('Scroll the page or a container (direction: up, down, left, right)')
  .option('-s, --selector <css>', 'Scroll within a specific container (modal, sidebar, etc.)')
  .action(async (sessionId: string, direction: string, amount?: string, options?: { selector?: string }) => {
    const validDirections = ['up', 'down', 'left', 'right'];
    if (!validDirections.includes(direction)) {
      console.error(`Error: Invalid direction "${direction}"`);
      console.log(`Valid directions: ${validDirections.join(', ')}`);
      process.exit(1);
    }

    try {
      const globalOpts = program.opts();
      const outputDir = globalOpts.output || './.ibr';
      const session = await getSession(outputDir, sessionId);
      setActiveSession(session);

      const pixels = amount ? parseInt(amount, 10) : 500;
      const position = await session.scroll(direction as 'up' | 'down' | 'left' | 'right', pixels, { selector: options?.selector });

      if (options?.selector) {
        console.log(`Scrolled ${direction} ${pixels}px in: ${options.selector}`);
      } else {
        console.log(`Scrolled ${direction} ${pixels}px`);
      }
      console.log(`Position: x=${position.x}, y=${position.y}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error:', msg);
      if (options?.selector) {
        console.log('');
        console.log('Tip: The container may not exist or may not be scrollable.');
        console.log('     Check: overflow-y: auto/scroll, or that content exceeds container bounds.');
      }
    }
  });

// Session screenshot command
program
  .command('session:screenshot <sessionId>')
  .description('Take a screenshot and audit interactive elements')
  .option('-n, --name <name>', 'Screenshot name')
  .option('-s, --selector <css>', 'CSS selector to capture specific element')
  .option('--no-full-page', 'Capture only the viewport')
  .option('--viewport-only', 'Capture only viewport (alias for --no-full-page)')
  .option('--json', 'Output audit results as JSON')
  .action(async (sessionId: string, options: { name?: string; selector?: string; fullPage?: boolean; viewportOnly?: boolean; json?: boolean }) => {
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || './.ibr';
    const opId = await registerOperation(outputDir, {
      type: 'screenshot',
      sessionId,
      command: `session:screenshot ${sessionId}${options.name ? ` --name ${options.name}` : ''}`,
    });

    try {
      const session = await getSession(outputDir, sessionId);
      setActiveSession(session);

      // Handle --viewport-only as alias for --no-full-page
      const fullPage = options.viewportOnly ? false : options.fullPage;

      const { path, elements, audit } = await session.screenshot({
        name: options.name,
        selector: options.selector,
        fullPage,
      });

      if (options.json) {
        console.log(JSON.stringify({ path, elements, audit }, null, 2));
      } else {
        console.log(`Screenshot saved: ${path}`);
        console.log('');
        console.log('Element Audit:');
        console.log(`  Total elements: ${audit.totalElements}`);
        console.log(`  Interactive: ${audit.interactiveCount}`);
        console.log(`  With handlers: ${audit.withHandlers}`);
        console.log(`  Without handlers: ${audit.withoutHandlers}`);

        if (audit.issues.length > 0) {
          console.log('');
          console.log('Issues detected:');
          for (const issue of audit.issues) {
            const icon = issue.severity === 'error' ? '✗' : issue.severity === 'warning' ? '!' : 'i';
            console.log(`  ${icon} [${issue.type}] ${issue.message}`);
          }
        } else {
          console.log('');
          console.log('No issues detected.');
        }
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      console.log('');
      console.log('Tip: Session is still active. Try without --selector for full page.');
    } finally {
      await completeOperation(outputDir, opId);
    }
  });

// Session scan command — run IBR scan against live session page
program
  .command('session:scan <sessionId>')
  .description('Run full IBR scan against the live session page (no new browser)')
  .option('--json', 'Output as JSON')
  .action(async (sessionId: string, options: { json?: boolean }) => {
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || './.ibr';

    try {
      const session = await getSession(outputDir, sessionId);
      setActiveSession(session);
      const result = await session.scanPage();

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        const { formatScanResult } = await import('../scan.js');
        console.log(formatScanResult(result));
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
    }
  });

// Session capture command — combined screenshot + scan in one step
program
  .command('session:capture <sessionId>')
  .description('Combined screenshot + scan capture (visual + structured data together)')
  .option('-l, --label <label>', 'Label for this capture step')
  .option('-k, --keep', 'Keep screenshot after session close (default: archive)')
  .option('--json', 'Output as JSON')
  .action(async (sessionId: string, options: { label?: string; keep?: boolean; json?: boolean }) => {
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || './.ibr';

    try {
      const session = await getSession(outputDir, sessionId);
      setActiveSession(session);
      const result = await session.capture({
        label: options.label,
        keep: options.keep || false,
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Capture #${result.step}: ${result.action}`);
        console.log(`  Screenshot: ${result.screenshot}${result.keep ? ' (kept)' : ' (ephemeral)'}`);
        console.log(`  Verdict:    ${result.scan.verdict}`);
        console.log(`  Elements:   ${result.scan.elements.audit.totalElements} (${result.scan.elements.audit.interactiveCount} interactive)`);
        console.log(`  Handlers:   ${result.scan.elements.audit.withHandlers}/${result.scan.elements.audit.interactiveCount} wired`);
        console.log(`  Page:       ${result.scan.semantic.pageIntent.intent} (${(result.scan.semantic.confidence * 100).toFixed(0)}%)`);

        if (result.scan.console.errors.length > 0) {
          console.log(`  Console:    ${result.scan.console.errors.length} errors`);
        }

        if (result.scan.issues.length > 0) {
          console.log('');
          console.log('  Issues:');
          for (const issue of result.scan.issues.slice(0, 5)) {
            const icon = issue.severity === 'error' ? '  ✗' : issue.severity === 'warning' ? '  !' : '  i';
            console.log(`  ${icon} [${issue.category}] ${issue.description}`);
          }
          if (result.scan.issues.length > 5) {
            console.log(`    ... and ${result.scan.issues.length - 5} more`);
          }
        }
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
    }
  });

// Session wait command
program
  .command('session:wait <sessionId> <selectorOrMs>')
  .description('Wait for a selector to appear or a duration (in ms)')
  .action(async (sessionId: string, selectorOrMs: string) => {
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || './.ibr';
    const opId = await registerOperation(outputDir, {
      type: 'wait',
      sessionId,
      command: `session:wait ${sessionId} "${selectorOrMs}"`,
    });

    try {
      const session = await getSession(outputDir, sessionId);
      setActiveSession(session);

      const isNumber = /^\d+$/.test(selectorOrMs);
      if (isNumber) {
        await session.waitFor(parseInt(selectorOrMs, 10));
        console.log(`Waited ${selectorOrMs}ms`);
      } else {
        await session.waitFor(selectorOrMs);
        console.log(`Found: ${selectorOrMs}`);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      console.log('');
      console.log('Tip: Session is still active. Element may not exist yet or selector is wrong.');
    } finally {
      await completeOperation(outputDir, opId);
    }
  });

// Session navigate command
program
  .command('session:navigate <sessionId> <url>')
  .description('Navigate to a new URL in an active session')
  .option('-w, --wait-for <selector>', 'Wait for selector after navigation')
  .action(async (sessionId: string, url: string, options: { waitFor?: string }) => {
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || './.ibr';
    const opId = await registerOperation(outputDir, {
      type: 'navigate',
      sessionId,
      command: `session:navigate ${sessionId} "${url}"`,
    });

    try {
      const session = await getSession(outputDir, sessionId);
      setActiveSession(session);

      await session.navigate(url, { waitFor: options.waitFor });
      console.log(`Navigated to: ${url}`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      console.log('');
      console.log('Tip: Session is still active. Check URL or try without --wait-for.');
    } finally {
      await completeOperation(outputDir, opId);
    }
  });

// Session list command
program
  .command('session:list')
  .description('List all active interactive sessions')
  .action(async () => {
    try {
      const { isServerRunning, listActiveSessions } = await import('../browser-server.js');
      const globalOpts = program.opts();
      const outputDir = globalOpts.output || './.ibr';

      const serverRunning = await isServerRunning(outputDir);
      const sessions = await listActiveSessions(outputDir);

      console.log(`Browser server: ${serverRunning ? 'running' : 'not running'}`);
      console.log('');

      if (sessions.length === 0) {
        console.log('No sessions found.');
        console.log('');
        console.log('Start one with:');
        console.log('  npx ibr session:start <url>');
        return;
      }

      console.log('Sessions:');
      for (const id of sessions) {
        console.log(`  ${id}`);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Session pending command - list pending operations
program
  .command('session:pending')
  .description('List pending operations (useful before session:close all)')
  .option('--json', 'Output as JSON')
  .action(async (options: { json?: boolean }) => {
    try {
      const globalOpts = program.opts();
      const outputDir = globalOpts.output || './.ibr';

      const pending = await getPendingOperations(outputDir);

      if (options.json) {
        console.log(JSON.stringify(pending, null, 2));
        return;
      }

      if (pending.length === 0) {
        console.log('No pending operations.');
        console.log('');
        console.log('Safe to close browser server:');
        console.log('  npx ibr session:close all');
        return;
      }

      console.log(`${pending.length} pending operation(s):`);
      console.log('');
      console.log(formatPendingOperations(pending));
      console.log('');
      console.log('Wait for these to complete, or use:');
      console.log('  npx ibr session:close all --force');
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Session close command
program
  .command('session:close <sessionId>')
  .description('Close a session (use "all" to stop browser server)')
  .option('--force', 'Skip waiting for pending operations')
  .option('--wait-timeout <ms>', 'Max wait time for pending operations (default: 30000)', '30000')
  .action(async (sessionId: string, options: { force?: boolean; waitTimeout: string }) => {
    try {
      const { stopBrowserServer, PersistentSession, isServerRunning } = await import('../browser-server.js');
      const globalOpts = program.opts();
      const outputDir = globalOpts.output || './.ibr';

      if (sessionId === 'all') {
        // Check for pending operations before closing
        const pending = await getPendingOperations(outputDir);

        if (pending.length > 0 && !options.force) {
          console.log(`Found ${pending.length} pending operation(s):`);
          console.log(formatPendingOperations(pending));
          console.log('');
          console.log(`Waiting for completion (timeout: ${options.waitTimeout}ms)...`);
          console.log('Use --force to skip waiting');
          console.log('');

          const completed = await waitForCompletion(outputDir, {
            timeout: parseInt(options.waitTimeout, 10),
            onProgress: (remaining) => {
              process.stdout.write(`\rWaiting for ${remaining} operation(s)...`);
            },
          });

          console.log(''); // Clear line

          if (!completed) {
            const remaining = await getPendingOperations(outputDir);
            console.log(`Timeout reached. ${remaining.length} operation(s) still pending.`);
            console.log('Use --force to close anyway, or wait for operations to complete.');
            process.exit(1);
          }

          console.log('All operations completed.');
        }

        const stopped = await stopBrowserServer(outputDir);
        if (stopped) {
          console.log('Browser server stopped. All sessions closed.');
        } else {
          console.log('No browser server running.');
        }
        return;
      }

      // Close individual session
      if (!(await isServerRunning(outputDir))) {
        console.log('No browser server running.');
        return;
      }

      const session = await PersistentSession.get(outputDir, sessionId);
      if (session) {
        await session.close();
        console.log(`Session closed: ${sessionId}`);
      } else {
        console.log(`Session not found: ${sessionId}`);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Session HTML command - get page DOM
program
  .command('session:html <sessionId>')
  .description('Get the full page HTML/DOM structure')
  .option('-s, --selector <css>', 'Get HTML of specific element only')
  .action(async (sessionId: string, options: { selector?: string }) => {
    try {
      const globalOpts = program.opts();
      const outputDir = globalOpts.output || './.ibr';
      const session = await getSession(outputDir, sessionId);
      setActiveSession(session);

      if (options.selector) {
        // Get outer HTML of specific element
        const escapedSelector = options.selector.replace(/'/g, "\\'");
        const html = await session.evaluate(`(() => {
          const el = document.querySelector('${escapedSelector}');
          return el ? el.outerHTML : null;
        })()`);
        if (html) {
          console.log(html);
        } else {
          console.error(`Element not found: ${options.selector}`);
          process.exit(1);
        }
      } else {
        const html = await session.content();
        console.log(html);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Session text command - get text content
program
  .command('session:text <sessionId> <selector>')
  .description('Get text content from a specific element')
  .option('-a, --all', 'Get text from all matching elements')
  .action(async (sessionId: string, selector: string, options: { all?: boolean }) => {
    try {
      const globalOpts = program.opts();
      const outputDir = globalOpts.output || './.ibr';
      const session = await getSession(outputDir, sessionId);
      setActiveSession(session);

      if (options.all) {
        const texts = await session.allTextContent(selector);
        if (texts.length === 0) {
          console.error(`No elements found: ${selector}`);
          process.exit(1);
        }
        texts.forEach((text, i) => {
          console.log(`[${i + 1}] ${text}`);
        });
      } else {
        const text = await session.textContent(selector);
        if (text === null) {
          console.error(`Element not found: ${selector}`);
          process.exit(1);
        }
        console.log(text.trim());
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Session eval command - execute JavaScript in browser context
program
  .command('session:eval <sessionId> <script>')
  .description('Execute JavaScript in the browser context')
  .option('--json', 'Output result as JSON')
  .action(async (sessionId: string, script: string, options: { json?: boolean }) => {
    try {
      const globalOpts = program.opts();
      const outputDir = globalOpts.output || './.ibr';
      const session = await getSession(outputDir, sessionId);
      setActiveSession(session);

      const result = await session.evaluate(script);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (result === undefined) {
        console.log('[undefined]');
      } else if (result === null) {
        console.log('[null]');
      } else if (typeof result === 'object') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(result);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error:', msg);
      console.log('');
      console.log('Tip: Script must be valid JavaScript. Examples:');
      console.log('  npx ibr session:eval <id> "document.title"');
      console.log('  npx ibr session:eval <id> "document.querySelectorAll(\'.item\').length"');
      console.log('  npx ibr session:eval <id> "window.scrollY"');
      process.exit(1);
    }
  });

// Session actions command - show action history
program
  .command('session:actions <sessionId>')
  .description('Show action history for a session')
  .action(async (sessionId: string) => {
    try {
      const { liveSessionManager } = await import('../live-session.js');
      const session = liveSessionManager.get(sessionId);

      if (!session) {
        console.error(`Session not found or not active: ${sessionId}`);
        process.exit(1);
      }

      const actions = session.actions;
      console.log(`Actions for ${sessionId}:`);
      console.log('');

      for (const action of actions) {
        const icon = action.success ? '✓' : '✗';
        const duration = action.duration ? `(${action.duration}ms)` : '';
        console.log(`  ${icon} ${action.type} ${duration}`);
        if (action.params) {
          const params = Object.entries(action.params)
            .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
            .join(', ');
          console.log(`      ${params}`);
        }
        if (!action.success && action.error) {
          console.log(`      Error: ${action.error}`);
        }
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Session modal command - detect and dismiss modals
program
  .command('session:modal <sessionId>')
  .description('Detect and optionally dismiss active modals')
  .option('--dismiss', 'Attempt to dismiss the modal')
  .action(async (sessionId: string, options: { dismiss?: boolean }) => {
    try {
      const globalOpts = program.opts();
      const outputDir = globalOpts.output || './.ibr';
      const session = await getSession(outputDir, sessionId);
      setActiveSession(session);

      const modal = await session.detectModal();

      if (!modal.hasModal) {
        console.log('No modal detected');
        return;
      }

      console.log(`Modal detected: ${modal.selector}`);
      console.log(`Dismiss method: ${modal.dismissMethod}`);
      if (modal.closeButtonSelector) {
        console.log(`Close button: ${modal.closeButtonSelector}`);
      }

      if (options.dismiss) {
        console.log('');
        console.log('Attempting to dismiss...');

        if (modal.dismissMethod === 'close-button' && modal.closeButtonSelector) {
          await session.click(modal.closeButtonSelector, { force: true });
        } else {
          await session.press('Escape');
        }

        // Verify dismissal
        await session.waitFor(300);
        const stillOpen = await session.detectModal();
        if (stillOpen.hasModal) {
          console.log('Warning: Modal may still be open. Try:');
          console.log(`  npx ibr session:press ${sessionId} Escape`);
          console.log(`  npx ibr session:click ${sessionId} ".backdrop" --force`);
        } else {
          console.log('Modal dismissed successfully');
        }
      } else {
        console.log('');
        console.log('To dismiss, run:');
        console.log(`  npx ibr session:modal ${sessionId} --dismiss`);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ============================================================
// SCREENSHOT MANAGEMENT COMMANDS
// ============================================================

// Screenshots list command
program
  .command('screenshots:list [sessionId]')
  .description('List screenshots for a session or all sessions')
  .option('--json', 'Output as JSON')
  .action(async (sessionId: string | undefined, options: { json?: boolean }) => {
    try {
      const { ScreenshotManager, formatBytes, formatAge } = await import('../screenshot-manager.js');
      const globalOpts = program.opts();
      const outputDir = globalOpts.output || './.ibr';

      const manager = new ScreenshotManager(outputDir);

      const screenshots = sessionId
        ? await manager.list(sessionId)
        : await manager.listAll();

      if (screenshots.length === 0) {
        console.log('No screenshots found.');
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(screenshots, null, 2));
        return;
      }

      console.log(`Found ${screenshots.length} screenshot(s):`);
      console.log('');
      console.log('PATH                                           SIZE       AGE');
      console.log('-'.repeat(70));

      for (const shot of screenshots) {
        const shortPath = shot.path.length > 45 ? '...' + shot.path.slice(-42) : shot.path.padEnd(45);
        console.log(`${shortPath} ${formatBytes(shot.size).padStart(10)} ${formatAge(shot.ageMs).padStart(10)}`);
      }

      // Show storage usage
      const usage = await manager.getStorageUsage();
      console.log('');
      console.log(`Total: ${formatBytes(usage.totalBytes)} across ${usage.fileCount} files`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Screenshots cleanup command
program
  .command('screenshots:cleanup')
  .description('Clean up old screenshots based on retention policy')
  .option('--max-age <days>', 'Delete screenshots older than N days', '7')
  .option('--max-size <mb>', 'Max total storage in MB', '500')
  .option('--dry-run', 'Show what would be deleted without deleting')
  .action(async (options: { maxAge: string; maxSize: string; dryRun?: boolean }) => {
    try {
      const { ScreenshotManager, formatBytes } = await import('../screenshot-manager.js');
      const globalOpts = program.opts();
      const outputDir = globalOpts.output || './.ibr';

      const manager = new ScreenshotManager(outputDir, {
        maxAgeDays: parseInt(options.maxAge, 10),
        maxSizeBytes: parseInt(options.maxSize, 10) * 1024 * 1024,
        retentionPolicy: 'both',
      });

      console.log(`Cleanup policy: max ${options.maxAge} days, max ${options.maxSize}MB`);
      console.log('');

      const report = await manager.cleanup({ dryRun: options.dryRun });

      if (options.dryRun) {
        console.log('DRY RUN - no files deleted');
        console.log('');
      }

      console.log(`Scanned: ${report.scanned} files`);
      console.log(`${options.dryRun ? 'Would delete' : 'Deleted'}: ${report.deleted} files`);
      console.log(`Space ${options.dryRun ? 'to be freed' : 'freed'}: ${formatBytes(report.bytesFreed)}`);
      console.log(`Kept: ${report.kept} files`);

      if (report.errors.length > 0) {
        console.log('');
        console.log('Errors:');
        for (const err of report.errors) {
          console.log(`  ${err}`);
        }
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Screenshots view command
program
  .command('screenshots:view <path>')
  .description('View a screenshot with metadata')
  .action(async (path: string) => {
    try {
      const { ScreenshotManager, formatBytes } = await import('../screenshot-manager.js');
      const globalOpts = program.opts();
      const outputDir = globalOpts.output || './.ibr';

      const manager = new ScreenshotManager(outputDir);
      const metadata = await manager.getMetadata(path);

      if (!metadata) {
        console.error(`Screenshot not found: ${path}`);
        process.exit(1);
      }

      console.log('Screenshot Metadata:');
      console.log(`  Path: ${metadata.path}`);
      console.log(`  Size: ${formatBytes(metadata.size)}`);
      console.log(`  Created: ${metadata.createdAt}`);
      if (metadata.sessionId) console.log(`  Session: ${metadata.sessionId}`);
      if (metadata.step) console.log(`  Step: ${metadata.step}`);
      if (metadata.query) console.log(`  Query: ${metadata.query}`);
      if (metadata.userIntent) console.log(`  Intent: ${metadata.userIntent}`);
      console.log('');

      // Try to open in default viewer
      const { exec } = await import('child_process');
      const cmd = process.platform === 'darwin' ? 'open' :
                  process.platform === 'win32' ? 'start' : 'xdg-open';

      exec(`${cmd} "${path}"`, (err) => {
        if (err) {
          console.log('Could not open image viewer. File path above.');
        }
      });
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// AI Search test command
program
  .command('search-test <url>')
  .description('Run AI search test with screenshots and validation context')
  .option('-q, --query <query>', 'Search query to test', 'test')
  .option('-i, --intent <intent>', 'User intent for validation')
  .option('--results-selector <css>', 'CSS selector for results')
  .option('--no-screenshots', 'Skip capturing screenshots')
  .option('--json', 'Output as JSON')
  .action(async (url: string, options: {
    query: string;
    intent?: string;
    resultsSelector?: string;
    screenshots?: boolean;
    json?: boolean;
  }) => {
    try {
      const { aiSearchFlow } = await import('../flows/search.js');
      const { generateValidationContext, generateValidationPrompt, analyzeForObviousIssues } = await import('../flows/search-validation.js');
      const globalOpts = program.opts();
      const outputDir = globalOpts.output || './.ibr';
      const { mkdir } = await import('fs/promises');

      console.log(`Testing search on ${url}...`);
      console.log(`Query: "${options.query}"`);
      if (options.intent) console.log(`Intent: ${options.intent}`);
      console.log('');

      // Launch browser
      const viewport = VIEWPORTS[globalOpts.viewport as keyof typeof VIEWPORTS] || VIEWPORTS.desktop;
      const driver = new EngineDriver();
      await driver.launch(withBrowserOptions({ headless: true, viewport: { width: viewport.width, height: viewport.height } }));
      const page = new CompatPage(driver);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // Create session directory for artifacts
      const sessionDir = join(outputDir, 'sessions', `search-${Date.now()}`);
      await mkdir(sessionDir, { recursive: true });

      // Run AI search flow
      const result = await aiSearchFlow(page, {
        query: options.query,
        userIntent: options.intent || `Find results related to: ${options.query}`,
        resultsSelector: options.resultsSelector,
        captureSteps: options.screenshots !== false,
        extractContent: true,
        sessionDir,
      });

      await driver.close();

      // Generate validation context
      const validationContext = generateValidationContext(result);
      const obvIssues = analyzeForObviousIssues(validationContext);

      if (options.json) {
        console.log(JSON.stringify({
          result,
          validationContext,
          obviousIssues: obvIssues,
        }, null, 2));
        return;
      }

      // Display results
      console.log('═══════════════════════════════════════════════════════════');
      console.log('  SEARCH TEST RESULTS');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('');
      console.log(`Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      console.log(`Results found: ${result.resultCount}`);
      console.log('');
      console.log('Timing:');
      console.log(`  Typing: ${result.timing.typing}ms`);
      console.log(`  Waiting: ${result.timing.waiting}ms`);
      console.log(`  Rendering: ${result.timing.rendering}ms`);
      console.log(`  Total: ${result.timing.total}ms`);

      if (result.screenshots.length > 0) {
        console.log('');
        console.log('Screenshots:');
        for (const shot of result.screenshots) {
          console.log(`  ${shot.step}: ${shot.path}`);
        }
      }

      if (result.extractedResults.length > 0) {
        console.log('');
        console.log(`Extracted Results (${result.extractedResults.length}):`);
        for (const r of result.extractedResults.slice(0, 5)) {
          const title = r.title || r.fullText.slice(0, 50);
          console.log(`  ${r.index + 1}. ${title}`);
        }
        if (result.extractedResults.length > 5) {
          console.log(`  ... and ${result.extractedResults.length - 5} more`);
        }
      }

      if (obvIssues.length > 0) {
        console.log('');
        console.log('Potential Issues:');
        for (const issue of obvIssues) {
          const severity = issue.severity.toUpperCase();
          console.log(`  [${severity}] ${issue.description}`);
        }
      }

      // Output validation prompt for Claude Code
      console.log('');
      console.log('───────────────────────────────────────────────────────────');
      console.log('VALIDATION CONTEXT FOR CLAUDE CODE:');
      console.log('───────────────────────────────────────────────────────────');
      console.log('');
      console.log(generateValidationPrompt(validationContext));

      if (result.artifactDir) {
        console.log('');
        console.log(`Artifacts saved to: ${result.artifactDir}`);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Discover command - discover and test multiple pages
program
  .command('discover [url]')
  .description('Discover pages (auto-detects dev server if no URL)')
  .option('-n, --max-pages <count>', 'Maximum pages to discover', '5')
  .option('-p, --prefix <path>', 'Only scan pages under this path prefix')
  .option('--nav-only', 'Only scan navigation links (faster)')
  .option('-f, --format <format>', 'Output format: json, text', 'text')
  .action(async (url: string | undefined, options: { maxPages: string; prefix?: string; navOnly?: boolean; format: string }) => {
    try {
      const resolvedUrl = await resolveBaseUrl(url);
      const { discoverPages, getNavigationLinks } = await import('../crawl.js');

      console.log(`Scanning ${resolvedUrl}...`);
      console.log('');

      let pages;

      if (options.navOnly) {
        // Quick nav-only scan
        pages = await getNavigationLinks(resolvedUrl);
        console.log(`Found ${pages.length} navigation links:`);
      } else {
        // Full crawl
        const result = await discoverPages({
          url: resolvedUrl,
          maxPages: parseInt(options.maxPages, 10),
          pathPrefix: options.prefix,
        });
        pages = result.pages;
        console.log(`Discovered ${pages.length} pages (${result.crawlTime}ms):`);
      }

      console.log('');

      if (options.format === 'json') {
        console.log(JSON.stringify(pages, null, 2));
      } else {
        for (const page of pages) {
          console.log(`  ${page.path}`);
          console.log(`    Title: ${page.title}`);
          if (page.linkText && page.linkText !== page.title) {
            console.log(`    Link: ${page.linkText}`);
          }
          console.log('');
        }
      }

      // Contextual tip
      console.log('To capture baselines for these pages:');
      console.log(`  npx ibr scan-start`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Scan-start command - discover and capture baselines for multiple pages
program
  .command('scan-start [url]')
  .description('Discover pages and capture baselines (auto-detects dev server if no URL)')
  .option('-n, --max-pages <count>', 'Maximum pages to discover', '5')
  .option('-p, --prefix <path>', 'Only scan pages under this path prefix')
  .option('--nav-only', 'Only scan navigation links (faster)')
  .action(async (url: string | undefined, options: { maxPages: string; prefix?: string; navOnly?: boolean }) => {
    try {
      const resolvedUrl = await resolveBaseUrl(url);
      const { discoverPages, getNavigationLinks } = await import('../crawl.js');
      const ibr = await createIBR(program.opts());

      console.log(`Scanning ${resolvedUrl}...`);

      let pages;

      if (options.navOnly) {
        pages = await getNavigationLinks(resolvedUrl);
      } else {
        const result = await discoverPages({
          url: resolvedUrl,
          maxPages: parseInt(options.maxPages, 10),
          pathPrefix: options.prefix,
        });
        pages = result.pages;
      }

      console.log(`Found ${pages.length} pages. Capturing baselines...`);
      console.log('');

      const sessions = [];

      for (const page of pages) {
        try {
          console.log(`Capturing: ${page.path}`);
          const result = await ibr.startSession(page.url, {
            name: page.title.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase().slice(0, 50),
          });
          sessions.push({ page, sessionId: result.sessionId });
          console.log(`  Done: ${result.sessionId}`);
        } catch (error) {
          console.log(`  Failed: ${error instanceof Error ? error.message : error}`);
        }
      }

      console.log('');
      console.log(`Captured ${sessions.length}/${pages.length} pages.`);
      console.log('');
      console.log('Next: Make your changes, then run:');
      console.log('  npx ibr scan-check');

      await ibr.close();
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Scan-check command - compare all recent sessions
program
  .command('scan-check')
  .description('Compare all sessions from the last scan-start')
  .option('-f, --format <format>', 'Output format: json, text, minimal', 'text')
  .action(async (_options: { format: string }) => {
    try {
      const ibr = await createIBR(program.opts());
      const sessions = await ibr.listSessions();

      // Get sessions from the last hour (likely from same scan)
      const recentSessions = sessions.filter(s => {
        const age = Date.now() - new Date(s.createdAt).getTime();
        return age < 60 * 60 * 1000 && s.status === 'baseline';
      });

      if (recentSessions.length === 0) {
        console.log('No recent baseline sessions found. Run scan-start first.');
        return;
      }

      console.log(`Checking ${recentSessions.length} sessions...`);
      console.log('');

      const results = [];

      for (const session of recentSessions) {
        try {
          console.log(`Checking: ${session.name}`);
          const report = await ibr.check(session.id);
          results.push({ session, report });

          const icon = report.analysis.verdict === 'MATCH' ? '✓' :
                       report.analysis.verdict === 'EXPECTED_CHANGE' ? '~' :
                       report.analysis.verdict === 'UNEXPECTED_CHANGE' ? '!' : '✗';
          console.log(`  ${icon} ${report.analysis.verdict}: ${report.analysis.summary}`);
        } catch (error) {
          console.log(`  ✗ Failed: ${error instanceof Error ? error.message : error}`);
        }
      }

      console.log('');

      // Summary
      const matches = results.filter(r => r.report.analysis.verdict === 'MATCH').length;
      const expected = results.filter(r => r.report.analysis.verdict === 'EXPECTED_CHANGE').length;
      const unexpected = results.filter(r => r.report.analysis.verdict === 'UNEXPECTED_CHANGE').length;
      const broken = results.filter(r => r.report.analysis.verdict === 'LAYOUT_BROKEN').length;

      console.log('Summary:');
      console.log(`  ✓ Match: ${matches}`);
      console.log(`  ~ Expected: ${expected}`);
      console.log(`  ! Unexpected: ${unexpected}`);
      console.log(`  ✗ Broken: ${broken}`);

      if (unexpected > 0 || broken > 0) {
        console.log('');
        console.log('Issues detected. View in UI:');
        console.log('  npx ibr serve');
      }

      await ibr.close();

      // Exit with error if issues
      if (broken > 0) process.exit(1);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Consistency check command - compare UI consistency across pages
program
  .command('consistency <url>')
  .description('Check UI consistency across multiple pages (opt-in)')
  .option('-n, --max-pages <count>', 'Maximum pages to check', '5')
  .option('--nav-only', 'Only check navigation links (faster)')
  .option('--ignore <types>', 'Ignore certain checks (layout,typography,color,spacing)', '')
  .option('-f, --format <format>', 'Output format: json, text', 'text')
  .option('--confirm', 'Skip confirmation prompt (for automation/Claude Code)')
  .action(async (url: string, options: {
    maxPages: string;
    navOnly?: boolean;
    ignore: string;
    format: string;
    confirm?: boolean;
  }) => {
    try {
      // Permission check - require explicit confirmation unless --confirm flag
      if (!options.confirm) {
        console.log('');
        console.log('⚠️  Consistency Check');
        console.log('───────────────────────────────────────────────────');
        console.log('This will analyze UI styles across multiple pages to');
        console.log('detect potential inconsistencies (fonts, colors, spacing).');
        console.log('');
        console.log('Note: Some style differences may be intentional.');
        console.log('');
        console.log('To proceed, run with --confirm flag:');
        console.log(`  npx ibr consistency ${url} --confirm`);
        console.log('');
        console.log('Or for Claude Code automation:');
        console.log(`  npx ibr consistency ${url} --confirm --format json`);
        return;
      }

      const { discoverPages, getNavigationLinks } = await import('../crawl.js');
      const { checkConsistency, formatConsistencyReport } = await import('../consistency.js');

      console.log(`Discovering pages from ${url}...`);

      let pages;
      if (options.navOnly) {
        pages = await getNavigationLinks(url);
      } else {
        const result = await discoverPages({
          url,
          maxPages: parseInt(options.maxPages, 10),
        });
        pages = result.pages;
      }

      if (pages.length < 2) {
        console.log('Need at least 2 pages to check consistency.');
        return;
      }

      console.log(`Found ${pages.length} pages. Analyzing styles...`);
      console.log('');

      const urls = pages.map(p => p.url);
      const ignore = options.ignore ? options.ignore.split(',') as Array<'layout' | 'typography' | 'color' | 'spacing'> : [];

      const result = await checkConsistency({
        urls,
        ignore,
      });

      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatConsistencyReport(result));
      }

      // Exit with error if score is low
      if (result.score < 50) {
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Diagnose command - enhanced error diagnostics for a URL
program
  .command('diagnose [url]')
  .description('Diagnose page load issues (auto-detects dev server if no URL)')
  .option('--timeout <ms>', 'Timeout in milliseconds', '30000')
  .action(async (url: string | undefined, options: { timeout: string }) => {
    try {
      const resolvedUrl = await resolveBaseUrl(url);
      const { captureWithDiagnostics, closeBrowser } = await import('../capture.js');
      const { join } = await import('path');
      const outputDir = program.opts().output || './.ibr';

      console.log(`Diagnosing ${resolvedUrl}...`);
      console.log('');

      const result = await captureWithDiagnostics({
        url: resolvedUrl,
        outputPath: join(outputDir, 'diagnose', 'test.png'),
        timeout: parseInt(options.timeout, 10),
        outputDir,
      });

      await closeBrowser();

      console.log('═══════════════════════════════════════════════════════════');
      console.log('  PAGE DIAGNOSTICS');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('');

      if (result.success) {
        console.log('✓ Page loaded successfully');
        console.log('');
      } else {
        console.log('✗ Page failed to load');
        console.log(`  Error: ${result.error?.message}`);
        console.log(`  Suggestion: ${result.error?.suggestion}`);
        console.log('');
      }

      console.log('Timing:');
      console.log(`  Navigation: ${result.timing.navigationMs}ms`);
      console.log(`  Render: ${result.timing.renderMs}ms`);
      console.log(`  Total: ${result.timing.totalMs}ms`);
      console.log('');

      if (result.diagnostics.httpStatus) {
        console.log(`HTTP Status: ${result.diagnostics.httpStatus}`);
      }

      if (result.diagnostics.consoleErrors.length > 0) {
        console.log('');
        console.log('Console Errors:');
        for (const err of result.diagnostics.consoleErrors.slice(0, 5)) {
          console.log(`  • ${err.substring(0, 100)}${err.length > 100 ? '...' : ''}`);
        }
        if (result.diagnostics.consoleErrors.length > 5) {
          console.log(`  ... and ${result.diagnostics.consoleErrors.length - 5} more`);
        }
      }

      if (result.diagnostics.networkErrors.length > 0) {
        console.log('');
        console.log('Network Errors:');
        for (const err of result.diagnostics.networkErrors.slice(0, 5)) {
          console.log(`  • ${err.substring(0, 100)}${err.length > 100 ? '...' : ''}`);
        }
        if (result.diagnostics.networkErrors.length > 5) {
          console.log(`  ... and ${result.diagnostics.networkErrors.length - 5} more`);
        }
      }

      if (result.diagnostics.suggestions.length > 0) {
        console.log('');
        console.log('Suggestions:');
        for (const suggestion of result.diagnostics.suggestions) {
          console.log(`  → ${suggestion}`);
        }
      }

      if (!result.success) {
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Helper to check if port is in use
async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port, '127.0.0.1');
  });
}

// Find available port from list
async function findAvailablePortFromList(ports: number[]): Promise<number | null> {
  for (const port of ports) {
    if (!(await isPortInUse(port))) {
      return port;
    }
  }
  return null;
}

// Common dev server ports (ordered by likelihood)
const DEV_SERVER_PORTS = [3000, 3001, 5173, 5174, 4200, 8080, 8000, 5000, 3100, 4321];

// Detect running dev server by checking common ports
async function detectDevServer(): Promise<string | null> {
  for (const port of DEV_SERVER_PORTS) {
    if (await isPortInUse(port)) {
      // Verify it responds to HTTP
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1000);
        await fetch(`http://localhost:${port}`, {
          signal: controller.signal,
          method: 'HEAD'
        });
        clearTimeout(timeout);
        return `http://localhost:${port}`;
      } catch {
        // Port in use but not HTTP, try next
        continue;
      }
    }
  }
  return null;
}

// Resolve URL: use provided, or from config, or auto-detect
async function resolveBaseUrl(providedUrl?: string): Promise<string> {
  if (providedUrl) {
    return providedUrl;
  }

  const config = await loadConfig();
  if (config.baseUrl) {
    return config.baseUrl;
  }

  const detected = await detectDevServer();
  if (detected) {
    console.log(`Auto-detected dev server: ${detected}`);
    return detected;
  }

  throw new Error('No URL provided and no dev server detected. Start your dev server or specify a URL.');
}

// Init command
program
  .command('init')
  .description('Initialize IBR config and optionally register Claude Code plugin')
  .option('-p, --port <port>', 'Port for baseUrl (auto-detects available port if not specified)')
  .option('-u, --url <url>', 'Full base URL (overrides port)')
  .option('--skip-plugin', 'Skip Claude Code plugin registration prompt')
  .action(async (options: { port?: string; url?: string; skipPlugin?: boolean }) => {
    const { writeFile, readFile, mkdir } = await import('fs/promises');
    const configPath = join(process.cwd(), '.ibrrc.json');
    const claudeSettingsPath = join(process.cwd(), '.claude', 'settings.json');

    // --- Step 1: Create .ibrrc.json if needed ---
    let configCreated = false;
    if (!existsSync(configPath)) {
      let baseUrl: string;

      if (options.url) {
        baseUrl = options.url;
      } else if (options.port) {
        baseUrl = `http://localhost:${options.port}`;
      } else {
        const preferredPort = 5000;
        const fallbackPorts = [5050, 5555, 4200, 4321, 6789, 7777];

        if (!(await isPortInUse(preferredPort))) {
          baseUrl = `http://localhost:${preferredPort}`;
          console.log(`Using default port ${preferredPort}`);
        } else {
          console.log(`Port ${preferredPort} in use, finding alternative...`);
          const availablePort = await findAvailablePortFromList(fallbackPorts);

          if (availablePort) {
            baseUrl = `http://localhost:${availablePort}`;
            console.log(`Auto-selected port ${availablePort}`);
          } else {
            baseUrl = 'http://localhost:YOUR_PORT';
            console.log('All candidate ports in use. Please edit baseUrl in .ibrrc.json');
          }
        }
      }

      const config = {
        baseUrl,
        outputDir: './.ibr',
        viewport: 'desktop',
        threshold: 1.0,
        fullPage: true,
        retention: {
          maxSessions: 20,
          maxAgeDays: 7,
          keepFailed: true,
          autoClean: true,
        },
      };

      await writeFile(configPath, JSON.stringify(config, null, 2));
      configCreated = true;

      console.log('');
      console.log('Created .ibrrc.json');
      console.log('');
      console.log('Configuration:');
      console.log(JSON.stringify(config, null, 2));
    } else {
      console.log('.ibrrc.json already exists.');
    }

    // --- Step 2: Claude Code plugin registration ---
    if (options.skipPlugin) {
      if (configCreated) {
        console.log('');
        console.log('Edit baseUrl to match your dev server.');
      }
      return;
    }

    // Check if Claude Code is present (look for .claude directory or settings)
    const claudeDirExists = existsSync(join(process.cwd(), '.claude'));
    const hasClaudeSettings = existsSync(claudeSettingsPath);

    // Find the IBR plugin path
    const possiblePluginPaths = [
      'node_modules/@tyroneross/interface-built-right/plugin',
      'node_modules/interface-built-right/plugin',
      './plugin', // if running from IBR repo
    ];

    let pluginPath: string | null = null;
    for (const p of possiblePluginPaths) {
      if (existsSync(join(process.cwd(), p))) {
        pluginPath = p;
        break;
      }
    }

    if (!pluginPath) {
      console.log('');
      console.log('IBR plugin path not found. Skipping Claude Code integration.');
      if (configCreated) {
        console.log('');
        console.log('Edit baseUrl to match your dev server.');
      }
      return;
    }

    // Check if already registered
    let settings: { plugins?: string[] } = { plugins: [] };
    if (hasClaudeSettings) {
      try {
        const content = await readFile(claudeSettingsPath, 'utf-8');
        settings = JSON.parse(content);
        if (!settings.plugins) {
          settings.plugins = [];
        }
      } catch {
        settings = { plugins: [] };
      }

      // Check if already registered
      const alreadyRegistered = (settings.plugins ?? []).some(p =>
        p.includes('interface-built-right/plugin') || p === pluginPath
      );

      if (alreadyRegistered) {
        console.log('');
        console.log('IBR plugin already registered in Claude Code.');
        if (configCreated) {
          console.log('');
          console.log('Edit baseUrl to match your dev server.');
        }
        return;
      }
    }

    // Show plugin benefits and prompt
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  CLAUDE CODE PLUGIN');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('IBR includes a Claude Code plugin for AI-assisted visual testing:');
    console.log('');
    console.log('  /ibr:build     - Guided UI build (preamble → plan → implement → validate)');
    console.log('  /ibr:scan      - Full page scan with structured output');
    console.log('  /ibr:ui        - Open comparison viewer');
    console.log('');
    console.log('Benefits:');
    console.log('  • Validate UI matches user intent with structured data');
    console.log('  • AI understands page semantics (intent, state, landmarks)');
    console.log('  • Automatic suggestions when UI files change');
    console.log('');

    // Simple prompt using readline
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question('Register IBR plugin for Claude Code? [Y/n] ', (ans) => {
        rl.close();
        resolve(ans.trim().toLowerCase());
      });
    });

    if (answer === 'n' || answer === 'no') {
      console.log('');
      console.log('Skipped plugin registration.');
      console.log('');
      console.log('To register later, add to .claude/settings.json:');
      console.log(`  "plugins": ["${pluginPath}"]`);
      if (configCreated) {
        console.log('');
        console.log('Edit baseUrl in .ibrrc.json to match your dev server.');
      }
      return;
    }

    // Register the plugin
    try {
      // Ensure .claude directory exists
      if (!claudeDirExists) {
        await mkdir(join(process.cwd(), '.claude'), { recursive: true });
      }

      settings.plugins = settings.plugins || [];
      settings.plugins.push(pluginPath);

      await writeFile(claudeSettingsPath, JSON.stringify(settings, null, 2));

      console.log('');
      console.log('IBR plugin registered.');
      console.log('');
      console.log('Restart Claude Code to activate. Then use:');
      console.log('  /ibr:scan <url>      - Full page scan');
      console.log('  /ibr:build <topic>   - Guided UI build workflow');

    } catch (err) {
      console.log('');
      console.log('Failed to register plugin:', err instanceof Error ? err.message : err);
      console.log('');
      console.log('To register manually, add to .claude/settings.json:');
      console.log(`  "plugins": ["${pluginPath}"]`);
    }

    if (configCreated) {
      console.log('');
      console.log('Edit baseUrl in .ibrrc.json to match your dev server.');
    }
  });

// ============================================================================
// MEMORY COMMANDS
// ============================================================================

const memoryCmd = program
  .command('memory')
  .description('Manage UI/UX preferences and memory');

memoryCmd
  .command('add <description>')
  .description('Add a UI/UX preference')
  .option('--category <category>', 'Category: color, layout, typography, navigation, component, spacing, interaction, content', 'component')
  .option('--component <type>', 'Component type (e.g., button, nav, card)')
  .option('--property <property>', 'CSS property or semantic key', 'background-color')
  .option('--operator <op>', 'Comparison: equals, contains, matches, gte, lte', 'equals')
  .option('--value <value>', 'Expected value')
  .option('--route <route>', 'Scope to route pattern')
  .action(async (description: string, opts: any) => {
    const { addPreference, formatPreference } = await import('../memory.js');
    if (!opts.value) {
      console.error('Error: --value is required');
      process.exit(1);
    }
    const pref = await addPreference(program.opts().output || './.ibr', {
      description,
      category: opts.category,
      componentType: opts.component,
      property: opts.property,
      operator: opts.operator,
      value: opts.value,
      route: opts.route,
    });
    console.log('Preference added:');
    console.log(formatPreference(pref));
  });

memoryCmd
  .command('list')
  .description('List all preferences')
  .option('--category <category>', 'Filter by category')
  .option('--route <route>', 'Filter by route')
  .action(async (opts: any) => {
    const { listPreferences } = await import('../memory.js');
    const prefs = await listPreferences(program.opts().output || './.ibr', {
      category: opts.category,
      route: opts.route,
    });
    if (prefs.length === 0) {
      console.log('No preferences stored.');
      return;
    }
    for (const pref of prefs) {
      const scope = pref.route ? ` (${pref.route})` : ' (global)';
      const conf = pref.confidence < 1.0 ? ` [${Math.round(pref.confidence * 100)}%]` : '';
      console.log(`  ${pref.id}: ${pref.description}${scope}${conf}`);
    }
  });

memoryCmd
  .command('remove <id>')
  .description('Remove a preference')
  .action(async (id: string) => {
    const { removePreference } = await import('../memory.js');
    const removed = await removePreference(program.opts().output || './.ibr', id);
    console.log(removed ? `Removed: ${id}` : `Not found: ${id}`);
  });

memoryCmd
  .command('show <id>')
  .description('Show full preference detail')
  .action(async (id: string) => {
    const { getPreference, formatPreference } = await import('../memory.js');
    const pref = await getPreference(program.opts().output || './.ibr', id);
    if (!pref) {
      console.log(`Not found: ${id}`);
      return;
    }
    console.log(formatPreference(pref));
  });

memoryCmd
  .command('summary')
  .description('Show memory summary and stats')
  .action(async () => {
    const { loadSummary, formatMemorySummary } = await import('../memory.js');
    const summary = await loadSummary(program.opts().output || './.ibr');
    console.log(formatMemorySummary(summary));
  });

memoryCmd
  .command('rebuild')
  .description('Force rebuild summary from preference files')
  .action(async () => {
    const { rebuildSummary, formatMemorySummary } = await import('../memory.js');
    const summary = await rebuildSummary(program.opts().output || './.ibr');
    console.log('Summary rebuilt:');
    console.log(formatMemorySummary(summary));
  });

memoryCmd
  .command('learned')
  .description('Show learned expectations pending promotion')
  .action(async () => {
    const { listLearned } = await import('../memory.js');
    const items = await listLearned(program.opts().output || './.ibr');
    if (items.length === 0) {
      console.log('No learned expectations yet.');
      console.log('Approve sessions with ibr check to start learning.');
      return;
    }
    for (const item of items) {
      console.log(`  ${item.id} (from ${item.sessionId}):`);
      for (const obs of item.observations) {
        console.log(`    ${obs.category}: ${obs.description}`);
      }
    }
  });

memoryCmd
  .command('promote <learnedId>')
  .description('Promote learned expectation to preference')
  .action(async (learnedId: string) => {
    const { promoteToPreference, formatPreference } = await import('../memory.js');
    const pref = await promoteToPreference(program.opts().output || './.ibr', learnedId);
    if (!pref) {
      console.log(`Not found or empty: ${learnedId}`);
      return;
    }
    console.log('Promoted to preference:');
    console.log(formatPreference(pref));
  });

// ============================================================================
// NATIVE SIMULATOR COMMANDS
// ============================================================================

program
  .command('native:devices')
  .description('List available iOS/watchOS simulator devices')
  .option('-p, --platform <platform>', 'Filter by platform: ios, watchos')
  .action(async (options: { platform?: string }) => {
    try {
      const { listDevices, formatDevice } = await import('../native/index.js');

      let devices = await listDevices();
      devices = devices.filter(d => d.isAvailable);

      if (options.platform) {
        devices = devices.filter(d => d.platform === options.platform);
      }

      if (devices.length === 0) {
        console.log('No available simulators found.');
        return;
      }

      const ios = devices.filter(d => d.platform === 'ios');
      const watchos = devices.filter(d => d.platform === 'watchos');

      if (ios.length > 0) {
        console.log(`iOS (${ios.length}):`);
        for (const d of ios) {
          console.log(`  ${formatDevice(d)}`);
        }
      }

      if (watchos.length > 0) {
        if (ios.length > 0) console.log('');
        console.log(`watchOS (${watchos.length}):`);
        for (const d of watchos) {
          console.log(`  ${formatDevice(d)}`);
        }
      }

      const booted = devices.filter(d => d.state === 'Booted');
      console.log('');
      console.log(`Total: ${devices.length} available, ${booted.length} booted`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('native:scan [device]')
  .description('Scan a running simulator for accessibility and design issues')
  .option('--no-screenshot', 'Skip screenshot capture')
  .option('--json', 'Output as JSON')
  .option('--fix-guide', 'Generate actionable fix instructions with source mapping')
  .action(async (device: string | undefined, options: { screenshot?: boolean; json?: boolean; fixGuide?: boolean }) => {
    try {
      const { scanNative, formatNativeScanResult } = await import('../native/index.js');
      const globalOpts = program.opts();
      const outputDir = globalOpts.output || './.ibr';

      const result = await scanNative({
        device,
        screenshot: options.screenshot !== false,
        outputDir,
      });

      if (options.fixGuide) {
        const { correlateToSource } = await import('../native/bridge.js');
        const { generateFixGuide } = await import('../native/fix-guide.js');
        const { annotateScreenshot } = await import('../native/annotate.js');

        const bridgeResult = correlateToSource(result.elements.all, process.cwd());
        const fixGuide = generateFixGuide(result, bridgeResult, null);

        // Annotate screenshot if available
        if (result.screenshotPath && fixGuide.issues.length > 0) {
          const annotated = await annotateScreenshot(
            result.screenshotPath,
            fixGuide.issues.map(i => ({ id: i.id, bounds: i.where.bounds }))
          );
          if (annotated) fixGuide.screenshot = annotated;
        }

        // Save to disk
        const { mkdirSync, writeFileSync } = await import('fs');
        const guidePath = join(outputDir, 'native', 'fix-guide.json');
        mkdirSync(join(outputDir, 'native'), { recursive: true });
        writeFileSync(guidePath, JSON.stringify(fixGuide, null, 2));

        if (options.json) {
          console.log(JSON.stringify(fixGuide, null, 2));
        } else {
          console.log(formatFixGuide(fixGuide));
        }
      } else if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatNativeScanResult(result));
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('native:start [device]')
  .description('Capture a native simulator baseline screenshot')
  .option('-n, --name <name>', 'Baseline session name')
  .action(async (device: string | undefined, options: { name?: string }) => {
    try {
      const { findDevice, getBootedDevices, captureNativeScreenshot, getDeviceViewport } = await import('../native/index.js');
      const { createSession, getSessionPaths } = await import('../session.js');
      const globalOpts = program.opts();
      const outputDir = globalOpts.output || './.ibr';

      let resolved;
      if (device) {
        resolved = await findDevice(device);
        if (!resolved) {
          console.error(`No simulator found matching "${device}".`);
          process.exit(1);
        }
      } else {
        const booted = await getBootedDevices();
        if (booted.length === 0) {
          console.error('No booted simulators. Boot one first.');
          process.exit(1);
        }
        resolved = booted[0];
      }

      const viewport = getDeviceViewport(resolved);
      const name = options.name || `native-${resolved.name.replace(/\s+/g, '-').toLowerCase()}`;

      const session = await createSession(
        outputDir,
        `simulator://${resolved.name}`,
        name,
        viewport,
        resolved.platform
      );

      const paths = getSessionPaths(outputDir, session.id);
      const captureResult = await captureNativeScreenshot({
        device: resolved,
        outputPath: paths.baseline,
      });

      if (!captureResult.success) {
        console.error(`Screenshot failed: ${captureResult.error}`);
        process.exit(1);
      }

      console.log(`Baseline captured: ${session.id}`);
      console.log(`Device: ${resolved.name} (${resolved.platform})`);
      console.log(`Screenshot: ${paths.baseline}`);
      console.log('');
      console.log('After changes, run:');
      console.log(`  npx ibr native:check ${session.id}`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('native:check [sessionId]')
  .description('Compare current simulator state against native baseline')
  .option('-d, --device <device>', 'Device name or UDID')
  .action(async (sessionId: string | undefined, options: { device?: string }) => {
    try {
      const { findDevice, getBootedDevices, captureNativeScreenshot } = await import('../native/index.js');
      const { listSessions, getSession: getSessionById, getSessionPaths } = await import('../session.js');
      const { compare: compareFn } = await import('../index.js');
      const globalOpts = program.opts();
      const outputDir = globalOpts.output || './.ibr';

      // Find session
      let session;
      if (sessionId) {
        session = await getSessionById(outputDir, sessionId);
        if (!session) {
          console.error(`Session not found: ${sessionId}`);
          process.exit(1);
        }
      } else {
        const sessions = await listSessions(outputDir);
        session = sessions.find(s => s.platform === 'ios' || s.platform === 'watchos');
        if (!session) {
          console.error('No native sessions found. Run native:start first.');
          process.exit(1);
        }
      }

      // Find device
      let resolved;
      if (options.device) {
        resolved = await findDevice(options.device);
      } else {
        const booted = await getBootedDevices();
        resolved = booted[0];
      }

      if (!resolved) {
        console.error('No booted simulator found.');
        process.exit(1);
      }

      const paths = getSessionPaths(outputDir, session!.id);

      // Capture current
      const captureResult = await captureNativeScreenshot({
        device: resolved,
        outputPath: paths.current,
      });

      if (!captureResult.success) {
        console.error(`Screenshot failed: ${captureResult.error}`);
        process.exit(1);
      }

      // Compare
      const result = await compareFn({
        baselinePath: paths.baseline,
        currentPath: paths.current,
      });

      const verdictIcon = result.verdict === 'MATCH' ? '✓' :
                          result.verdict === 'EXPECTED_CHANGE' ? '~' : '✗';

      console.log(`${verdictIcon} ${result.verdict}`);
      console.log(`Diff: ${result.diffPercent.toFixed(2)}% (${result.diffPixels} pixels)`);
      console.log(result.summary);

      if (result.recommendation) {
        console.log('');
        console.log(`Recommendation: ${result.recommendation}`);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// macOS native app scanning
program
  .command('scan:macos')
  .description('Scan a running macOS native app via Accessibility API')
  .option('--app <name>', 'App name (e.g., "Secrets Vault")')
  .option('--bundle-id <id>', 'Bundle identifier (e.g., "com.secretsvault.app")')
  .option('--pid <pid>', 'Process ID')
  .option('--screenshot <path>', 'Save screenshot to path')
  .option('--json', 'Output as JSON')
  .action(async (options: { app?: string; bundleId?: string; pid?: string; screenshot?: string; json?: boolean }) => {
    try {
      if (process.platform !== 'darwin') {
        console.error('Error: scan:macos is only available on macOS');
        process.exit(1);
      }

      if (!options.app && !options.bundleId && !options.pid) {
        console.error('Error: Provide --app, --bundle-id, or --pid to identify the target app');
        process.exit(1);
      }

      const { scanMacOS, formatMacOSScanResult } = await import('../native/index.js');

      if (!options.json) {
        console.log(`Scanning macOS app${options.app ? ` "${options.app}"` : ''}...`);
      }

      const result = await scanMacOS({
        app: options.app,
        bundleId: options.bundleId,
        pid: options.pid ? parseInt(options.pid, 10) : undefined,
        screenshot: options.screenshot ? { path: options.screenshot } : undefined,
        outputDir: program.opts().output || '.ibr',
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatMacOSScanResult(result));
      }

      if (result.verdict === 'FAIL') {
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// test-search command — run searchFlow against a URL
program
  .command('test-search <url>')
  .description('Test search functionality on a page using the search flow')
  .option('-q, --query <q>', 'Search query', 'test')
  .option('--expect-count <n>', 'Expected minimum result count', '0')
  .option('--results-selector <css>', 'CSS selector for result elements')
  .option('--json', 'Output as JSON')
  .action(async (url: string, options: {
    query: string;
    expectCount: string;
    resultsSelector?: string;
    json?: boolean;
  }) => {
    const driver = new EngineDriver();
    try {
      const resolvedUrl = await resolveBaseUrl(url);
      const globalOpts = program.opts();
      const viewport = VIEWPORTS[globalOpts.viewport as keyof typeof VIEWPORTS] || VIEWPORTS.desktop;

      const { searchFlow } = await import('../flows/search.js');

      await driver.launch(withBrowserOptions({ headless: true, viewport: { width: viewport.width, height: viewport.height } }));
      const page = new CompatPage(driver);
      await page.goto(resolvedUrl, { waitUntil: 'networkidle', timeout: 30000 });

      const result = await searchFlow(page, {
        query: options.query,
        resultsSelector: options.resultsSelector,
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
        console.log(`Results found: ${result.resultCount}`);
        console.log(`Has results: ${result.hasResults}`);
        console.log(`Duration: ${result.duration}ms`);
        if (result.error) console.log(`Error: ${result.error}`);
        const expected = parseInt(options.expectCount, 10);
        if (expected > 0 && result.resultCount < expected) {
          console.log(`Expected at least ${expected} results, got ${result.resultCount}`);
        }
      }

      if (!result.success) process.exit(1);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    } finally {
      await driver.close();
    }
  });

// test-form command — run formFlow against a URL
program
  .command('test-form <url>')
  .description('Test form submission on a page using the form flow')
  .option('--fill <json>', 'JSON object of field name to value pairs, e.g. \'{"email":"user@example.com"}\'')
  .option('--submit-button <text>', 'Text of the submit button')
  .option('--json', 'Output as JSON')
  .action(async (url: string, options: {
    fill?: string;
    submitButton?: string;
    json?: boolean;
  }) => {
    const driver = new EngineDriver();
    try {
      const resolvedUrl = await resolveBaseUrl(url);
      const globalOpts = program.opts();
      const viewport = VIEWPORTS[globalOpts.viewport as keyof typeof VIEWPORTS] || VIEWPORTS.desktop;

      const { formFlow } = await import('../flows/form.js');

      // Parse fill JSON into FormField array
      let fields: Array<{ name: string; value: string }> = [];
      if (options.fill) {
        try {
          const parsed = JSON.parse(options.fill) as Record<string, string>;
          fields = Object.entries(parsed).map(([name, value]) => ({ name, value }));
        } catch {
          console.error('Error: --fill must be valid JSON, e.g. \'{"email":"user@example.com"}\'');
          process.exit(1);
        }
      }

      await driver.launch(withBrowserOptions({ headless: true, viewport: { width: viewport.width, height: viewport.height } }));
      const page = new CompatPage(driver);
      await page.goto(resolvedUrl, { waitUntil: 'networkidle', timeout: 30000 });

      const result = await formFlow(page, {
        fields,
        submitButton: options.submitButton,
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
        console.log(`Fields filled: ${result.filledFields.join(', ') || 'none'}`);
        if (result.failedFields.length > 0) {
          console.log(`Fields failed: ${result.failedFields.join(', ')}`);
        }
        console.log(`Duration: ${result.duration}ms`);
        if (result.error) console.log(`Error: ${result.error}`);
      }

      if (!result.success) process.exit(1);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    } finally {
      await driver.close();
    }
  });

// test-login command — run loginFlow against a URL
program
  .command('test-login <url>')
  .description('Test login flow on a page using the login flow')
  .option('--email <email>', 'Email or username to log in with')
  .option('--password <password>', 'Password to log in with')
  .option('--success-indicator <text>', 'Selector or text indicating successful login')
  .option('--json', 'Output as JSON')
  .action(async (url: string, options: {
    email?: string;
    password?: string;
    successIndicator?: string;
    json?: boolean;
  }) => {
    const driver = new EngineDriver();
    try {
      const resolvedUrl = await resolveBaseUrl(url);
      const globalOpts = program.opts();
      const viewport = VIEWPORTS[globalOpts.viewport as keyof typeof VIEWPORTS] || VIEWPORTS.desktop;

      const { loginFlow } = await import('../flows/login.js');

      if (!options.email || !options.password) {
        console.error('Error: --email and --password are required');
        process.exit(1);
      }

      await driver.launch(withBrowserOptions({ headless: true, viewport: { width: viewport.width, height: viewport.height } }));
      const page = new CompatPage(driver);
      await page.goto(resolvedUrl, { waitUntil: 'networkidle', timeout: 30000 });

      const result = await loginFlow(page, {
        email: options.email,
        password: options.password,
        successIndicator: options.successIndicator,
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
        console.log(`Authenticated: ${result.authenticated}`);
        if (result.username) console.log(`Username: ${result.username}`);
        console.log(`Duration: ${result.duration}ms`);
        if (result.error) console.log(`Error: ${result.error}`);
      }

      if (!result.success) process.exit(1);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    } finally {
      await driver.close();
    }
  });

// ============================================================================
// INTERACT COMMAND — act→verify→screenshot pipeline
// ============================================================================

program
  .command('test-interact <url>')
  .description('Run interaction assertions: click X, verify Y happened')
  .option('-a, --action <spec>', 'Action specification (repeatable). Format: type[:role]:target[:value]', (val, acc: string[]) => { acc.push(val); return acc }, [] as string[])
  .option('-e, --expect <spec>', 'Assertion specification (repeatable). Format: visible|hidden|text|count:value', (val, acc: string[]) => { acc.push(val); return acc }, [] as string[])
  .option('--expect-screenshot <name>', 'Capture screenshot after last action with this name')
  .option('--json', 'Output as JSON')
  .option('--headed', 'Show visible browser window (default: headless)')
  .option('--sandbox', 'Deprecated alias for --headed')
  .action(async (url: string, options: {
    action: string[]
    expect: string[]
    expectScreenshot?: string
    json?: boolean
    headed?: boolean
    sandbox?: boolean
  }) => {
    const {
      runInteractionTest,
      parseActionArg,
      parseExpectArg,
      formatInteractionResult,
    } = await import('../interaction-test.js')

    const globalOpts = program.opts()
    const outputDir = globalOpts.output || './.ibr'
    const viewport = VIEWPORTS[globalOpts.viewport as keyof typeof VIEWPORTS] || VIEWPORTS.desktop

    if (!options.action || options.action.length === 0) {
      console.error('Error: at least one --action is required')
      console.error('')
      console.error('Usage:')
      console.error('  npx ibr interact <url> --action "click:button:Submit" --expect "heading:Success"')
      process.exit(1)
    }

    // Parse action args into steps — each --action gets its own step
    // All --expect args apply to the last step
    const steps = options.action.map((actionSpec, i) => {
      let action
      try {
        action = parseActionArg(actionSpec)
      } catch (err) {
        console.error(`Error parsing --action "${actionSpec}": ${err instanceof Error ? err.message : err}`)
        process.exit(1)
      }

      const isLastStep = i === options.action.length - 1

      // Assign expect assertions to the last step only
      let expectObj: ReturnType<typeof parseExpectArg> = undefined

      if (isLastStep && (options.expect.length > 0 || options.expectScreenshot)) {
        expectObj = {}

        for (const expectSpec of options.expect) {
          try {
            const parsed = parseExpectArg(expectSpec)
            Object.assign(expectObj, parsed)
          } catch (err) {
            console.error(`Error parsing --expect "${expectSpec}": ${err instanceof Error ? err.message : err}`)
            process.exit(1)
          }
        }

        if (options.expectScreenshot) {
          expectObj.screenshot = options.expectScreenshot
        }
      }

      return { action, expect: expectObj }
    })

    try {
      const resolvedUrl = await resolveBaseUrl(url)

      if (!options.json) {
        console.log(`Interacting with ${resolvedUrl}...`)
        console.log(`${steps.length} step(s)`)
        console.log('')
      }

      const results = await runInteractionTest({
        url: resolvedUrl,
        steps,
        viewport,
        outputDir: join(outputDir, 'interactions'),
        headless: !(options.headed || options.sandbox),
        ...getBrowserConnectionOptions(),
      })

      if (options.json) {
        console.log(JSON.stringify(results.map((r) => ({
          ...r,
          before: { ...r.before, screenshot: undefined },
          after: { ...r.after, screenshot: undefined },
        })), null, 2))
      } else {
        for (const result of results) {
          console.log(formatInteractionResult(result))
          console.log('')
        }

        // Summary
        const totalAssertions = results.flatMap((r) => r.assertions).length
        const passedAssertions = results.flatMap((r) => r.assertions).filter((a) => a.passed).length
        const failedActions = results.filter((r) => !r.action.success).length

        if (totalAssertions > 0) {
          console.log(`Assertions: ${passedAssertions}/${totalAssertions} passed`)
        }
        if (failedActions > 0) {
          console.log(`Actions failed: ${failedActions}/${results.length}`)
        }
      }

      // Exit 1 if any assertion failed or any action failed
      const anyFailed =
        results.some((r) => !r.action.success) ||
        results.some((r) => r.assertions.some((a) => !a.passed))

      if (anyFailed) process.exit(1)
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// ─── match command ────────────────────────────────────────────────────────────
// Compare a design mockup PNG against a live rendered web page.
// Usage:
//   npx ibr match <mockup.png> <url>
//   npx ibr match <mockup.png> <url> --selector '.hero-section'
//   npx ibr match <mockup.png> <url> --mask-dynamic --save-diff diff.png

program
  .command('match <mockup> <url>')
  .description('Compare a design mockup PNG against a live rendered page (SSIM + pixelmatch)')
  .option('-s, --selector <css>', 'Crop live page to this CSS selector before comparison')
  .option('-m, --mask-dynamic', 'Auto-mask dynamic content (timestamps, ads, live regions)')
  .option('--json', 'Output results as JSON')
  .option('--save-diff <path>', 'Save the pixel diff image to this file path')
  .option('--headless', 'Run browser headless (default: true)', true)
  .action(async (mockup: string, url: string, options: {
    selector?: string
    maskDynamic?: boolean
    json?: boolean
    saveDiff?: string
    headless?: boolean
  }) => {
    try {
      const { matchMockup, saveDiffImage } = await import('../mockup-match.js')
      const { basename } = await import('path')
      const globalOpts = program.opts()

      // Resolve viewport from global --viewport option
      const viewportName = (globalOpts.viewport as string) || 'desktop'
      const viewportPreset = VIEWPORTS[viewportName as keyof typeof VIEWPORTS]

      const result = await matchMockup({
        mockupPath: mockup,
        url,
        selector: options.selector,
        maskDynamic: options.maskDynamic ?? false,
        headless: options.headless ?? true,
        ...(viewportPreset ? { viewport: { width: viewportPreset.width, height: viewportPreset.height } } : {}),
      })

      // Save diff image if requested
      if (options.saveDiff) {
        await saveDiffImage(result.pixelDiff.diffImage, options.saveDiff)
      }

      if (options.json) {
        const out = {
          ssim: result.ssim,
          pixelDiff: {
            count: result.pixelDiff.count,
            percentage: result.pixelDiff.percentage,
          },
          mockupDimensions: result.mockupDimensions,
          liveDimensions: result.liveDimensions,
          maskedRegions: result.maskedRegions,
          ...(options.saveDiff ? { diffSavedTo: options.saveDiff } : {}),
        }
        console.log(JSON.stringify(out, null, 2))
      } else {
        const label = options.selector
          ? options.selector.replace(/^[.#]/, '')
          : basename(mockup, '.png')

        const verdictSymbol = result.ssim.verdict === 'pass' ? 'PASS'
          : result.ssim.verdict === 'review' ? 'REVIEW' : 'FAIL'

        console.log(`\nMockup Match: ${label}`)
        console.log(`  SSIM: ${result.ssim.score.toFixed(4)} (${verdictSymbol})`)
        console.log(`  Pixel diff: ${result.pixelDiff.percentage}% (${result.pixelDiff.count} pixels)`)
        console.log(`  Mockup: ${result.mockupDimensions.width}x${result.mockupDimensions.height}`)
        console.log(`  Live: ${result.liveDimensions.width}x${result.liveDimensions.height}`)

        if (result.maskedRegions.length > 0) {
          console.log(`  Masked: ${result.maskedRegions.length} regions (${result.maskedRegions.join(', ')})`)
        }

        if (options.saveDiff) {
          console.log(`  Diff saved: ${options.saveDiff}`)
        }
        console.log('')
      }

      // Exit 0 for pass, 1 for review or fail
      if (result.ssim.verdict !== 'pass') {
        process.exit(1)
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// ─── record-change command ────────────────────────────────────────────────────
// Record a structured design change specification for later verification.
// Usage:
//   npx ibr record-change http://localhost:3000 \
//     --element "header" \
//     --description "Blue header, 48px bold" \
//     --checks '[{"property":"color","operator":"contains","value":"blue","confidence":0.6}]'

program
  .command('record-change <url>')
  .description('Record a design change specification for later verification')
  .option('--element <name>', 'Accessible name or CSS selector of the target element')
  .option('--description <text>', 'Human-readable description of the change')
  .option('--checks <json>', 'JSON array of check objects: [{property,operator,value,confidence}]')
  .option('--platform <platform>', 'Target platform: web, ios, macos', 'web')
  .action(async (url: string, options: {
    element?: string;
    description?: string;
    checks?: string;
    platform?: string;
  }) => {
    try {
      const { saveChange } = await import('../design-verifier.js');
      const { DesignChangeSchema } = await import('../context/types.js');
      const globalOpts = program.opts();
      const outputDir = globalOpts.output || './.ibr';

      if (!options.element) {
        console.error('Error: --element is required');
        process.exit(1);
      }
      if (!options.description) {
        console.error('Error: --description is required');
        process.exit(1);
      }

      let checks: unknown[] = [];
      if (options.checks) {
        try {
          checks = JSON.parse(options.checks);
          if (!Array.isArray(checks)) {
            console.error('Error: --checks must be a JSON array');
            process.exit(1);
          }
        } catch {
          console.error('Error: --checks is not valid JSON');
          process.exit(1);
        }
      }

      // Validate and parse the change using Zod schema
      const changeRaw = {
        description: options.description,
        element: options.element,
        checks,
        source: 'structured' as const,
        platform: (options.platform as 'web' | 'ios' | 'macos') || 'web',
        timestamp: new Date().toISOString(),
      };

      const parseResult = DesignChangeSchema.safeParse(changeRaw);
      if (!parseResult.success) {
        console.error('Error: invalid change specification');
        for (const issue of parseResult.error.issues) {
          console.error(`  ${issue.path.join('.')}: ${issue.message}`);
        }
        process.exit(1);
      }

      await saveChange(outputDir, parseResult.data);

      console.log('Design change recorded:');
      console.log(`  Element:     ${parseResult.data.element}`);
      console.log(`  Description: ${parseResult.data.description}`);
      console.log(`  Checks:      ${parseResult.data.checks.length}`);
      console.log(`  Platform:    ${parseResult.data.platform ?? 'web'}`);
      console.log(`  Saved to:    ${outputDir}/design-changes.json`);
      console.log('');
      console.log('To verify:');
      console.log(`  npx ibr verify-changes ${url}`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ─── verify-changes command ───────────────────────────────────────────────────
// Verify all recorded design changes against a live page.
// Usage:
//   npx ibr verify-changes http://localhost:3000
//   npx ibr verify-changes http://localhost:3000 --json

program
  .command('verify-changes <url>')
  .description('Verify all recorded design changes against the live page')
  .option('--json', 'Output results as JSON')
  .action(async (url: string, options: { json?: boolean }) => {
    const globalOpts = program.opts();
    const driver = await createDriver(globalOpts.browser);
    try {
      const { loadChanges, verifyAllChanges, formatVerifyResult } = await import('../design-verifier.js');
      const resolvedUrl = await resolveBaseUrl(url);
      const outputDir = globalOpts.output || './.ibr';
      const viewport = VIEWPORTS[globalOpts.viewport as keyof typeof VIEWPORTS] || VIEWPORTS.desktop;

      const changes = await loadChanges(outputDir);

      if (changes.length === 0) {
        console.log('No design changes recorded.');
        console.log('');
        console.log('Record a change first:');
        console.log('  npx ibr record-change <url> --element "header" --description "Blue header" --checks \'[...]\'');
        return;
      }

      console.log(`Verifying ${changes.length} design change(s) against ${resolvedUrl}...`);
      console.log('');

      await driver.launch(withBrowserOptions({ headless: true, viewport: { width: viewport.width, height: viewport.height } }));
      await driver.navigate(resolvedUrl);

      // Small wait for hydration
      await new Promise((r) => setTimeout(r, 500));

      const results = await verifyAllChanges(changes, driver);

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        for (const result of results) {
          console.log(formatVerifyResult(result));
          console.log('');
        }

        const passed = results.filter((r) => r.overallPassed).length;
        const failed = results.filter((r) => !r.overallPassed).length;
        console.log(`Summary: ${passed} passed, ${failed} failed`);
      }

      await driver.close();

      if (results.some((r) => !r.overallPassed)) {
        process.exit(1);
      }
    } catch (error) {
      await driver.close().catch(() => {});
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ============================================================
// PHASE 5 — TEST GENERATION, EXECUTION, SCRIPTING, ITERATE
// ============================================================

// generate-test command
program
  .command('generate-test <url>')
  .description('Generate a declarative .ibr-test.json file from page observation')
  .option('--scenario <text>', 'Natural language scenario description')
  .option('--test-file <path>', 'Output path for test file', '.ibr-test.json')
  .action(async (url: string, options: { scenario?: string; testFile: string }) => {
    try {
      const { generateTest } = await import('../test-generator.js')
      const suite = await generateTest({
        url,
        scenario: options.scenario,
        outputPath: options.testFile,
      })
      const pageNames = Object.keys(suite)
      const total = pageNames.reduce((s, k) => s + suite[k].tests.length, 0)
      console.log(`Generated ${total} test(s) for ${pageNames.length} page(s) → ${options.testFile}`)
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// test command
program
  .command('test')
  .description('Run declarative .ibr-test.json test file')
  .option('--file <path>', 'Path to test file', '.ibr-test.json')
  .option('--output-dir <dir>', 'Directory to store screenshots/results', '.ibr/test-results')
  .option('--headless', 'Run headless (default: true)', true)
  .option('--json', 'Output results as JSON')
  .action(async (options: { file: string; outputDir: string; headless: boolean; json?: boolean }) => {
    try {
      const { runTests, formatRunResult } = await import('../test-runner.js')
      const results = await runTests({
        filePath: options.file,
        outputDir: options.outputDir,
        headless: options.headless,
        ...getBrowserConnectionOptions(),
      })

      if (options.json) {
        console.log(JSON.stringify(results, null, 2))
      } else {
        for (const result of results) {
          console.log(formatRunResult(result))
          console.log('')
        }
        const totalPassed = results.reduce((s, r) => s + r.passed, 0)
        const totalFailed = results.reduce((s, r) => s + r.failed, 0)
        console.log(`Summary: ${totalPassed} passed, ${totalFailed} failed`)
      }

      const anyFailed = results.some(r => r.failed > 0)
      process.exit(anyFailed ? 1 : 0)
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// run-script command
program
  .command('run-script <script>')
  .description('Execute a Python test script with sandboxed resource limits')
  .option('--url <url>', 'URL passed to script as IBR_URL env var')
  .option('--timeout <ms>', 'Timeout in milliseconds', '60000')
  .option('--memory <mb>', 'Memory limit in MB', '512')
  .option('--cpu <seconds>', 'CPU time limit in seconds', '30')
  .option('--json', 'Output result as JSON')
  .action(async (script: string, options: { url?: string; timeout: string; memory: string; cpu: string; json?: boolean }) => {
    try {
      const { runScript, formatScriptResult } = await import('../script-runner.js')
      const result = await runScript({
        scriptPath: script,
        url: options.url,
        timeout: parseInt(options.timeout, 10),
        memoryMB: parseInt(options.memory, 10),
        cpuSeconds: parseInt(options.cpu, 10),
      })

      if (options.json) {
        console.log(JSON.stringify(result, null, 2))
      } else {
        console.log(formatScriptResult(result))
      }

      process.exit(result.exitCode)
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// iterate command
program
  .command('iterate <url>')
  .description('Run one iteration of the test-fix loop and report convergence state')
  .option('--test <path>', 'Path to .ibr-test.json (uses IBR scan if omitted)')
  .option('--max-iterations <n>', 'Maximum iterations before stopping', '7')
  .option('--output-dir <dir>', 'Directory for iteration state and results', '.ibr/iterate')
  .option('--auto-approve', 'Skip user approval at checkpoint iterations')
  .option('--reset', 'Reset iteration state and start fresh')
  .option('--json', 'Output result as JSON')
  .action(async (url: string, options: { test?: string; maxIterations: string; outputDir: string; autoApprove?: boolean; reset?: boolean; json?: boolean }) => {
    try {
      const { iterate, resetIterateState } = await import('../iterate.js')

      if (options.reset) {
        await resetIterateState(options.outputDir)
        console.log('Iteration state reset.')
        return
      }

      const result = await iterate({
        url,
        testFile: options.test,
        maxIterations: parseInt(options.maxIterations, 10),
        outputDir: options.outputDir,
        autoApprove: options.autoApprove ?? false,
      })

      if (options.json) {
        console.log(JSON.stringify(result, null, 2))
      } else {
        const last = result.iterations[result.iterations.length - 1]
        if (last) {
          console.log(`Iteration ${last.iteration}: ${last.issueCount} issue(s) | hash=${last.scanHash} | delta=${last.netDelta >= 0 ? '+' : ''}${last.netDelta} | ${last.approachHint}`)
        }
        console.log(`State: ${result.finalState}`)
        console.log(result.summary)
      }

      // Exit non-zero if regressing or budget exceeded with remaining issues
      const last = result.iterations[result.iterations.length - 1]
      const hasIssues = last ? last.issueCount > 0 : false
      if (result.finalState === 'regressing' || (result.finalState === 'budget_exceeded' && hasIssues)) {
        process.exit(1)
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// ─── compare-browsers command ─────────────────────────────────────────────────
// Run a scan in both Chrome and Safari, then diff screenshots + element lists.
// Usage:
//   npx ibr compare-browsers <url>
//   npx ibr compare-browsers <url> --save-diff .ibr/browser-diff.png --json

program
  .command('compare-browsers <url>')
  .description('Scan in Chrome and Safari, diff screenshots and element counts')
  .option('--save-diff <path>', 'Save pixel diff image to this path')
  .option('--json', 'Output results as JSON')
  .option('--timeout <ms>', 'Navigation timeout in ms', '15000')
  .action(async (url: string, options: {
    saveDiff?: string
    json?: boolean
    timeout: string
  }) => {
    const resolvedUrl = await resolveBaseUrl(url)
    const globalOpts = program.opts()
    const viewport = VIEWPORTS[globalOpts.viewport as keyof typeof VIEWPORTS] || VIEWPORTS.desktop
    const timeout = parseInt(options.timeout, 10)

    if (!options.json) {
      console.log(`Comparing browsers for: ${resolvedUrl}`)
      console.log('')
    }

    // ── Chrome scan ──────────────────────────────────────────
    if (!options.json) console.log('Chrome: launching...')
    const chromeDriver = new EngineDriver()
    let chromeScreenshot: Buffer | null = null
    let chromeElements: any[] = []
    let chromeError: string | null = null

    try {
      await chromeDriver.launch(withBrowserOptions({
        headless: true,
        viewport: { width: viewport.width, height: viewport.height },
      }))
      await chromeDriver.navigate(resolvedUrl, { waitFor: 'stable', timeout })
      chromeScreenshot = await chromeDriver.screenshot()
      const discovered = await chromeDriver.discover({ filter: 'interactive' })
      chromeElements = Array.isArray(discovered) ? discovered : []
      if (!options.json) console.log(`Chrome: ${chromeElements.length} interactive elements`)
    } catch (err) {
      chromeError = err instanceof Error ? err.message : String(err)
      if (!options.json) console.log(`Chrome: failed — ${chromeError}`)
    } finally {
      await chromeDriver.close().catch(() => {})
    }

    // ── Safari scan ──────────────────────────────────────────
    if (!options.json) console.log('Safari: launching...')
    const { SafariDriver } = await import('../engine/safari/driver.js')
    const safariDriver = new SafariDriver()
    let safariScreenshot: Buffer | null = null
    let safariElements: any[] = []
    let safariError: string | null = null

    try {
      // Check safaridriver is enabled before attempting
      const { SafariSession } = await import('../engine/safari/session.js')
      const enabled = await SafariSession.isEnabled()
      if (!enabled) {
        safariError = 'safaridriver not enabled. Run: sudo safaridriver --enable'
        if (!options.json) console.log(`Safari: skipped — ${safariError}`)
      } else {
        await safariDriver.launch({ viewport: { width: viewport.width, height: viewport.height } })
        await safariDriver.navigate(resolvedUrl, { waitFor: 'load', timeout })
        safariScreenshot = await safariDriver.screenshot()
        const discovered = await safariDriver.discover({ filter: 'interactive' })
        safariElements = Array.isArray(discovered) ? discovered : []
        if (!options.json) console.log(`Safari: ${safariElements.length} interactive elements`)
      }
    } catch (err) {
      safariError = err instanceof Error ? err.message : String(err)
      if (!options.json) console.log(`Safari: failed — ${safariError}`)
    } finally {
      await safariDriver.close().catch(() => {})
    }

    // ── Visual diff ──────────────────────────────────────────
    let pixelDiff: number | null = null
    let diffPercent: number | null = null
    let diffSaved = false

    if (chromeScreenshot && safariScreenshot) {
      try {
        const { PNG } = await import('pngjs')
        const pixelmatch = (await import('pixelmatch')).default

        const chromePng = PNG.sync.read(chromeScreenshot)
        const safariPng = PNG.sync.read(safariScreenshot)

        // Resize to smaller dimension if sizes differ
        const w = Math.min(chromePng.width, safariPng.width)
        const h = Math.min(chromePng.height, safariPng.height)

        const diff = new PNG({ width: w, height: h })

        // Crop chrome to match safari dims
        const chromeData = cropPngData(chromePng.data, chromePng.width, w, h)
        const safariData = cropPngData(safariPng.data, safariPng.width, w, h)

        pixelDiff = pixelmatch(chromeData, safariData, diff.data, w, h, {
          threshold: 0.1,
          includeAA: false,
        })
        diffPercent = Math.round((pixelDiff / (w * h)) * 10000) / 100

        if (options.saveDiff) {
          const { writeFile, mkdir: mkdirFs } = await import('fs/promises')
          const { dirname } = await import('path')
          await mkdirFs(dirname(options.saveDiff), { recursive: true })
          await writeFile(options.saveDiff, PNG.sync.write(diff))
          diffSaved = true
        }
      } catch {
        // Pixel diff is best-effort
      }
    }

    // ── Element diff ─────────────────────────────────────────
    const chromeLabels = new Set(chromeElements.map((e: any) => e.label?.toLowerCase()).filter(Boolean))
    const safariLabels = new Set(safariElements.map((e: any) => e.label?.toLowerCase()).filter(Boolean))
    const onlyInChrome = [...chromeLabels].filter((l) => !safariLabels.has(l))
    const onlyInSafari = [...safariLabels].filter((l) => !chromeLabels.has(l))

    // ── Output ───────────────────────────────────────────────
    const result = {
      url: resolvedUrl,
      chrome: {
        elementCount: chromeElements.length,
        error: chromeError,
      },
      safari: {
        elementCount: safariElements.length,
        error: safariError,
      },
      diff: {
        pixelDiff,
        diffPercent,
        diffSaved: diffSaved ? options.saveDiff : null,
        elementsOnlyInChrome: onlyInChrome,
        elementsOnlyInSafari: onlyInSafari,
      },
    }

    if (options.json) {
      console.log(JSON.stringify(result, null, 2))
    } else {
      console.log('')
      console.log('Results:')
      console.log(`  Chrome: ${chromeError ? 'ERROR' : `${chromeElements.length} elements`}`)
      console.log(`  Safari: ${safariError ? 'ERROR' : `${safariElements.length} elements`}`)
      if (pixelDiff !== null) {
        console.log(`  Visual diff: ${diffPercent}% (${pixelDiff} pixels)`)
      }
      if (onlyInChrome.length > 0) {
        console.log(`  Only in Chrome: ${onlyInChrome.slice(0, 5).join(', ')}${onlyInChrome.length > 5 ? ` +${onlyInChrome.length - 5} more` : ''}`)
      }
      if (onlyInSafari.length > 0) {
        console.log(`  Only in Safari: ${onlyInSafari.slice(0, 5).join(', ')}${onlyInSafari.length > 5 ? ` +${onlyInSafari.length - 5} more` : ''}`)
      }
      if (diffSaved) {
        console.log(`  Diff saved: ${options.saveDiff}`)
      }
    }
  })

/** Helper: crop PNG pixel data to new dimensions */
function cropPngData(data: Buffer, srcWidth: number, dstWidth: number, dstHeight: number): Buffer {
  const dst = Buffer.alloc(dstWidth * dstHeight * 4)
  for (let y = 0; y < dstHeight; y++) {
    const srcOff = y * srcWidth * 4
    const dstOff = y * dstWidth * 4
    data.copy(dst, dstOff, srcOff, srcOff + dstWidth * 4)
  }
  return dst
}

// ============================================================
// ENGINE INTERACTION COMMANDS
// interact / observe / extract — direct EngineDriver wrappers
// ============================================================

program
  .command('interact <url>')
  .description('Click, type, fill, or interact with elements on a page')
  .requiredOption('-a, --action <action>', 'Action: click, type, fill, hover, press, scroll, select, check')
  .requiredOption('-t, --target <name>', 'Element accessible name')
  .option('-v, --value <text>', 'Value for type/fill/press/select')
  .option('-r, --role <role>', 'ARIA role filter')
  .option('--no-screenshot', 'Skip screenshot after interaction')
  .action(async (url: string, opts: any) => {
    const { EngineDriver } = await import('../engine/driver.js')
    const driver = new EngineDriver()
    try {
      await driver.launch(withBrowserOptions({ headless: true }))
      await driver.navigate(url)

      const element = await driver.find(opts.target, opts.role ? { role: opts.role } : undefined)
      if (!element) {
        console.error(`Element not found: "${opts.target}"`)
        console.error('Use "ibr observe <url>" to see available elements.')
        process.exit(1)
      }

      const action = opts.action
      switch (action) {
        case 'click': await driver.click(element.id); break
        case 'type': await driver.type(element.id, opts.value || ''); break
        case 'fill': await driver.fill(element.id, opts.value || ''); break
        case 'hover': await driver.hover(element.id); break
        case 'press': await driver.pressKey(opts.value || 'Enter'); break
        case 'scroll': await driver.scroll(Number(opts.value) || 300); break
        case 'select': await driver.select(element.id, opts.value || ''); break
        case 'check': await driver.check(element.id); break
        default: console.error(`Unknown action: ${action}`); process.exit(1)
      }

      await new Promise(r => setTimeout(r, 500))
      console.log(`✓ ${action} on "${opts.target}" succeeded`)

      if (opts.screenshot !== false) {
        const fs = await import('fs')
        const path = await import('path')
        const buf = await driver.screenshot()
        const globalOpts = program.opts()
        const outDir = globalOpts.output || './.ibr'
        fs.mkdirSync(outDir, { recursive: true })
        const filename = `interact-${Date.now()}.png`
        fs.writeFileSync(path.join(outDir, filename), buf)
        console.log(`Screenshot: ${path.join(outDir, filename)}`)
      }
    } catch (err) {
      console.error(`Failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exit(1)
    } finally {
      await driver.close().catch(() => {})
    }
  })

program
  .command('observe <url>')
  .description('Preview available actions on a page without executing them')
  .option('-r, --role <role>', 'Filter by ARIA role')
  .option('-l, --limit <n>', 'Max results', '30')
  .action(async (url: string, opts: any) => {
    const { EngineDriver } = await import('../engine/driver.js')
    const driver = new EngineDriver()
    try {
      await driver.launch(withBrowserOptions({ headless: true }))
      await driver.navigate(url)
      const actions = await driver.observe({ role: opts.role, limit: Number(opts.limit) })

      if (actions.length === 0) {
        console.log('No interactive elements found.')
        return
      }

      console.log(`Found ${actions.length} interactive elements:\n`)
      actions.forEach((a, i) => {
        console.log(`  ${String(i + 1).padStart(2)}. [${a.role}] "${a.label}" — ${a.actions.join(', ')}`)
      })
    } catch (err) {
      console.error(`Failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exit(1)
    } finally {
      await driver.close().catch(() => {})
    }
  })

program
  .command('extract <url>')
  .description('Extract structured data from a page — headings, buttons, inputs, links')
  .action(async (url: string) => {
    const { EngineDriver } = await import('../engine/driver.js')
    const driver = new EngineDriver()
    try {
      await driver.launch(withBrowserOptions({ headless: true }))
      await driver.navigate(url)
      const meta = await driver.extractMeta()

      if (meta.headings.length > 0) {
        console.log('Headings:')
        meta.headings.forEach(h => console.log(`  ${h}`))
        console.log()
      }
      if (meta.buttons.length > 0) {
        console.log(`Buttons (${meta.buttons.length}):`)
        meta.buttons.forEach((b: any) => console.log(`  • ${b.label}${b.enabled === false ? ' (disabled)' : ''}`))
        console.log()
      }
      if (meta.inputs.length > 0) {
        console.log(`Inputs (${meta.inputs.length}):`)
        meta.inputs.forEach((inp: any) => console.log(`  • ${inp.label}${inp.value ? ` = "${inp.value}"` : ''}`))
        console.log()
      }
      if (meta.links.length > 0) {
        console.log(`Links (${meta.links.length}):`)
        meta.links.slice(0, 20).forEach((l: any) => console.log(`  • ${l.label}`))
        if (meta.links.length > 20) console.log(`  ... and ${meta.links.length - 20} more`)
      }
    } catch (err) {
      console.error(`Failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exit(1)
    } finally {
      await driver.close().catch(() => {})
    }
  })

program.parse();
