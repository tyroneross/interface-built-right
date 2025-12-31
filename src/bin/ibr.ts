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
  .version('0.1.0');

// Global options
program
  .option('-b, --base-url <url>', 'Base URL for the application')
  .option('-o, --output <dir>', 'Output directory', './.ibr')
  .option('-v, --viewport <name>', 'Viewport: desktop, mobile, tablet', 'desktop')
  .option('-t, --threshold <percent>', 'Diff threshold percentage', '1.0');

// Start command
program
  .command('start <url>')
  .description('Start a visual session by capturing a baseline screenshot')
  .option('-n, --name <name>', 'Session name')
  .option('--no-full-page', 'Capture only the viewport, not full page')
  .action(async (url: string, options: { name?: string; fullPage?: boolean }) => {
    try {
      const ibr = await createIBR(program.opts());
      const result = await ibr.startSession(url, {
        name: options.name,
        fullPage: options.fullPage,
      });

      console.log(`Session started: ${result.sessionId}`);
      console.log(`Baseline: ${result.baseline}`);
      console.log(`URL: ${result.session.url}`);

      await ibr.close();
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
  .description('Update baseline with current screenshot')
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
  .option('-p, --port <port>', 'Port number', '4200')
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

// Init command
program
  .command('init')
  .description('Initialize .ibrrc.json configuration file')
  .action(async () => {
    const configPath = join(process.cwd(), '.ibrrc.json');

    if (existsSync(configPath)) {
      console.log('.ibrrc.json already exists.');
      return;
    }

    const config = {
      baseUrl: 'http://localhost:3000',
      outputDir: './.ibr',
      viewport: 'desktop',
      threshold: 1.0,
      fullPage: true,
    };

    const { writeFile } = await import('fs/promises');
    await writeFile(configPath, JSON.stringify(config, null, 2));

    console.log('Created .ibrrc.json');
    console.log('');
    console.log('Configuration:');
    console.log(JSON.stringify(config, null, 2));
  });

program.parse();
