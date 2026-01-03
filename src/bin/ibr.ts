import { Command } from 'commander';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import {
  InterfaceBuiltRight,
  formatReportText,
  formatReportJson,
  formatReportMinimal,
  formatSessionSummary,
  VIEWPORTS,
  type Config,
} from '../index.js';

const program = new Command();

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
  };

  return new InterfaceBuiltRight(merged);
}

program
  .name('ibr')
  .description('Visual regression testing for Claude Code')
  .version('0.2.2');

// Global options
program
  .option('-b, --base-url <url>', 'Base URL for the application')
  .option('-o, --output <dir>', 'Output directory', './.ibr')
  .option('-v, --viewport <name>', 'Viewport: desktop, mobile, tablet', 'desktop')
  .option('-t, --threshold <percent>', 'Diff threshold percentage', '1.0');

// Start command
program
  .command('start [url]')
  .description('Capture a baseline screenshot (auto-detects dev server if no URL)')
  .option('-n, --name <name>', 'Session name')
  .option('-s, --selector <css>', 'CSS selector to capture specific element')
  .option('--no-full-page', 'Capture only the viewport, not full page')
  .option('--sandbox', 'Show visible browser window (default: headless)')
  .option('--debug', 'Visible browser + slow motion + devtools')
  .action(async (url: string | undefined, options: { name?: string; fullPage?: boolean; selector?: string; sandbox?: boolean; debug?: boolean }) => {
    try {
      const resolvedUrl = await resolveBaseUrl(url);
      const ibr = await createIBR(program.opts());
      const result = await ibr.startSession(resolvedUrl, {
        name: options.name,
        fullPage: options.fullPage,
        selector: options.selector,
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
  .action(async (options: { format: string }) => {
    try {
      const ibr = await createIBR(program.opts());
      const sessions = await ibr.listSessions();

      if (sessions.length === 0) {
        console.log('No sessions found.');
        return;
      }

      if (options.format === 'json') {
        console.log(JSON.stringify(sessions, null, 2));
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
  .option('-p, --port <port>', 'Port number', '4242')
  .option('--no-open', 'Do not open browser automatically')
  .action(async (options: { port: string; open?: boolean }) => {
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

    console.log(`Starting web UI on http://localhost:${options.port}`);
    console.log('Press Ctrl+C to stop the server.');
    console.log('');

    // Start Next.js dev server
    const server = spawn('npm', ['run', 'dev', '--', '-p', options.port], {
      cwd: webUiDir,
      stdio: 'inherit',
      shell: true,
    });

    // Open browser after a short delay (if --no-open not specified)
    if (options.open !== false) {
      setTimeout(async () => {
        const open = (await import('child_process')).exec;
        const url = `http://localhost:${options.port}`;
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
// LIVE SESSION COMMANDS - Interactive browser sessions
// ============================================================

// Session start command - create interactive session
program
  .command('session:start [url]')
  .description('Start an interactive browser session (keeps browser alive)')
  .option('-n, --name <name>', 'Session name')
  .option('--sandbox', 'Show visible browser window (required for user to toggle)')
  .option('--debug', 'Visible browser + slow motion + devtools')
  .action(async (url: string | undefined, options: { name?: string; sandbox?: boolean; debug?: boolean }) => {
    try {
      const { liveSessionManager } = await import('../live-session.js');
      const globalOpts = program.opts();
      const outputDir = globalOpts.output || './.ibr';
      const resolvedUrl = await resolveBaseUrl(url);

      // Sandbox must be explicitly requested
      if (!options.sandbox && !options.debug) {
        console.log('Starting headless session...');
      } else if (options.debug) {
        console.log('Starting debug session (visible + slow motion + devtools)...');
      } else {
        console.log('Starting sandbox session (visible browser)...');
      }

      const session = await liveSessionManager.create(outputDir, {
        url: resolvedUrl,
        name: options.name,
        viewport: VIEWPORTS[globalOpts.viewport as keyof typeof VIEWPORTS] || VIEWPORTS.desktop,
        sandbox: options.sandbox,
        debug: options.debug,
      });

      console.log('');
      console.log(`Session started: ${session.id}`);
      console.log(`URL: ${session.url}`);
      console.log('');
      console.log('Available commands:');
      console.log(`  npx ibr session:click ${session.id} "<selector>"`);
      console.log(`  npx ibr session:type ${session.id} "<selector>" "<text>"`);
      console.log(`  npx ibr session:screenshot ${session.id}`);
      console.log(`  npx ibr session:close ${session.id}`);
      console.log('');
      console.log('Note: Session stays active until closed. Use session:close when done.');
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Session click command
program
  .command('session:click <sessionId> <selector>')
  .description('Click an element in an active session')
  .action(async (sessionId: string, selector: string) => {
    try {
      const { liveSessionManager } = await import('../live-session.js');
      const session = liveSessionManager.get(sessionId);

      if (!session) {
        console.error(`Session not found or not active: ${sessionId}`);
        console.log('Active sessions:', liveSessionManager.list().join(', ') || 'none');
        process.exit(1);
      }

      await session.click(selector);
      console.log(`Clicked: ${selector}`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Session type command
program
  .command('session:type <sessionId> <selector> <text>')
  .description('Type text into an element in an active session')
  .option('--delay <ms>', 'Delay between keystrokes', '0')
  .action(async (sessionId: string, selector: string, text: string, options: { delay: string }) => {
    try {
      const { liveSessionManager } = await import('../live-session.js');
      const session = liveSessionManager.get(sessionId);

      if (!session) {
        console.error(`Session not found or not active: ${sessionId}`);
        process.exit(1);
      }

      await session.type(selector, text, { delay: parseInt(options.delay, 10) });
      console.log(`Typed "${text.length > 20 ? text.slice(0, 20) + '...' : text}" into: ${selector}`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Session fill command - fill multiple form fields
program
  .command('session:fill <sessionId> <fieldsJson>')
  .description('Fill multiple form fields (JSON array: [{"selector": "...", "value": "..."}])')
  .action(async (sessionId: string, fieldsJson: string) => {
    try {
      const { liveSessionManager } = await import('../live-session.js');
      const session = liveSessionManager.get(sessionId);

      if (!session) {
        console.error(`Session not found or not active: ${sessionId}`);
        process.exit(1);
      }

      const fields = JSON.parse(fieldsJson);
      await session.fill(fields);
      console.log(`Filled ${fields.length} field(s)`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Session hover command
program
  .command('session:hover <sessionId> <selector>')
  .description('Hover over an element in an active session')
  .action(async (sessionId: string, selector: string) => {
    try {
      const { liveSessionManager } = await import('../live-session.js');
      const session = liveSessionManager.get(sessionId);

      if (!session) {
        console.error(`Session not found or not active: ${sessionId}`);
        process.exit(1);
      }

      await session.hover(selector);
      console.log(`Hovered: ${selector}`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Session screenshot command
program
  .command('session:screenshot <sessionId>')
  .description('Take a screenshot of the current page state')
  .option('-n, --name <name>', 'Screenshot name')
  .option('-s, --selector <css>', 'CSS selector to capture specific element')
  .option('--no-full-page', 'Capture only the viewport')
  .action(async (sessionId: string, options: { name?: string; selector?: string; fullPage?: boolean }) => {
    try {
      const { liveSessionManager } = await import('../live-session.js');
      const session = liveSessionManager.get(sessionId);

      if (!session) {
        console.error(`Session not found or not active: ${sessionId}`);
        process.exit(1);
      }

      const path = await session.screenshot({
        name: options.name,
        selector: options.selector,
        fullPage: options.fullPage,
      });
      console.log(`Screenshot saved: ${path}`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Session evaluate command - run JavaScript
program
  .command('session:eval <sessionId> <script>')
  .description('Execute JavaScript in the page context')
  .action(async (sessionId: string, script: string) => {
    try {
      const { liveSessionManager } = await import('../live-session.js');
      const session = liveSessionManager.get(sessionId);

      if (!session) {
        console.error(`Session not found or not active: ${sessionId}`);
        process.exit(1);
      }

      const result = await session.evaluate(script);
      console.log('Result:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Session navigate command
program
  .command('session:navigate <sessionId> <url>')
  .description('Navigate to a new URL in an active session')
  .action(async (sessionId: string, url: string) => {
    try {
      const { liveSessionManager } = await import('../live-session.js');
      const session = liveSessionManager.get(sessionId);

      if (!session) {
        console.error(`Session not found or not active: ${sessionId}`);
        process.exit(1);
      }

      await session.navigate(url);
      console.log(`Navigated to: ${url}`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Session wait command
program
  .command('session:wait <sessionId> <selectorOrMs>')
  .description('Wait for a selector to appear or a duration (in ms)')
  .action(async (sessionId: string, selectorOrMs: string) => {
    try {
      const { liveSessionManager } = await import('../live-session.js');
      const session = liveSessionManager.get(sessionId);

      if (!session) {
        console.error(`Session not found or not active: ${sessionId}`);
        process.exit(1);
      }

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
      process.exit(1);
    }
  });

// Session list command
program
  .command('session:list')
  .description('List all active interactive sessions')
  .action(async () => {
    try {
      const { liveSessionManager } = await import('../live-session.js');
      const sessions = liveSessionManager.list();

      if (sessions.length === 0) {
        console.log('No active sessions.');
        console.log('');
        console.log('Start one with:');
        console.log('  npx ibr session:start <url>');
        return;
      }

      console.log('Active sessions:');
      for (const id of sessions) {
        const session = liveSessionManager.get(id);
        if (session) {
          console.log(`  ${id}  ${session.url}`);
        }
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Session close command
program
  .command('session:close <sessionId>')
  .description('Close an active session and its browser')
  .action(async (sessionId: string) => {
    try {
      const { liveSessionManager } = await import('../live-session.js');

      if (sessionId === 'all') {
        await liveSessionManager.closeAll();
        console.log('All sessions closed.');
        return;
      }

      const closed = await liveSessionManager.close(sessionId);
      if (closed) {
        console.log(`Session closed: ${sessionId}`);
      } else {
        console.log(`Session not found: ${sessionId}`);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
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

// Scan command - discover and test multiple pages
program
  .command('scan [url]')
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
  .action(async (options: { format: string }) => {
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
async function findAvailablePort(ports: number[]): Promise<number | null> {
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
  .description('Initialize .ibrrc.json configuration file')
  .option('-p, --port <port>', 'Port for baseUrl (auto-detects available port if not specified)')
  .option('-u, --url <url>', 'Full base URL (overrides port)')
  .action(async (options: { port?: string; url?: string }) => {
    const configPath = join(process.cwd(), '.ibrrc.json');

    if (existsSync(configPath)) {
      console.log('.ibrrc.json already exists.');
      console.log('Edit it directly or delete and run init again.');
      return;
    }

    let baseUrl: string;

    if (options.url) {
      // User specified full URL
      baseUrl = options.url;
    } else if (options.port) {
      // User specified port
      baseUrl = `http://localhost:${options.port}`;
    } else {
      // Try port 5000 first, then auto-detect from alternatives
      const preferredPort = 5000;
      const fallbackPorts = [5050, 5555, 4242, 4321, 6789, 7777];

      if (!(await isPortInUse(preferredPort))) {
        baseUrl = `http://localhost:${preferredPort}`;
        console.log(`Using default port ${preferredPort}`);
      } else {
        console.log(`Port ${preferredPort} in use, finding alternative...`);
        const availablePort = await findAvailablePort(fallbackPorts);

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
    };

    const { writeFile } = await import('fs/promises');
    await writeFile(configPath, JSON.stringify(config, null, 2));

    console.log('');
    console.log('Created .ibrrc.json');
    console.log('');
    console.log('Configuration:');
    console.log(JSON.stringify(config, null, 2));
    console.log('');
    console.log('Edit baseUrl to match your dev server.');
  });

program.parse();
