import { chromium, type BrowserServer, type Browser, type BrowserContext, type Page } from 'playwright';
import { writeFile, readFile, unlink, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { nanoid } from 'nanoid';
import { VIEWPORTS, type Viewport } from './schemas.js';

/**
 * Browser server state persisted to disk
 */
interface BrowserServerState {
  wsEndpoint: string;
  cdpUrl?: string;  // CDP URL for reconnection (shares contexts)
  pid: number;
  startedAt: string;
  headless: boolean;
  isolatedProfile: string;
}

/**
 * Session state stored in the session directory
 */
interface SessionState {
  id: string;
  url: string;
  name: string;
  viewport: Viewport;
  createdAt: string;
  pageIndex: number;  // Index in the browser context
  actions: ActionRecord[];
}

/**
 * Action record for session history
 */
export interface ActionRecord {
  type: 'navigate' | 'click' | 'type' | 'fill' | 'hover' | 'evaluate' | 'screenshot' | 'wait';
  timestamp: string;
  params: Record<string, unknown>;
  success: boolean;
  error?: string;
  duration?: number;
}

/**
 * Options for creating a session
 */
export interface SessionOptions {
  url: string;
  name?: string;
  viewport?: Viewport;
  waitFor?: string;  // CSS selector to wait for before considering page ready
  timeout?: number;
}

/**
 * Options for starting the browser server
 */
export interface BrowserServerOptions {
  headless?: boolean;  // Default: true
  debug?: boolean;     // Visible + slowMo + devtools
  isolated?: boolean;  // Use isolated profile (default: true)
}

const SERVER_STATE_FILE = 'browser-server.json';
const ISOLATED_PROFILE_DIR = 'browser-profile';

/**
 * Get paths for browser server files
 */
function getPaths(outputDir: string) {
  return {
    stateFile: join(outputDir, SERVER_STATE_FILE),
    profileDir: join(outputDir, ISOLATED_PROFILE_DIR),
    sessionsDir: join(outputDir, 'sessions'),
  };
}

/**
 * Check if browser server is running
 */
export async function isServerRunning(outputDir: string): Promise<boolean> {
  const { stateFile } = getPaths(outputDir);

  if (!existsSync(stateFile)) {
    return false;
  }

  try {
    const content = await readFile(stateFile, 'utf-8');
    const state: BrowserServerState = JSON.parse(content);

    // Try to connect to verify it's actually running
    const browser = await chromium.connect(state.wsEndpoint, { timeout: 2000 });
    await browser.close();
    return true;
  } catch {
    // Server not running or can't connect - clean up stale file
    await cleanupServerState(outputDir);
    return false;
  }
}

/**
 * Clean up stale server state
 */
async function cleanupServerState(outputDir: string): Promise<void> {
  const { stateFile } = getPaths(outputDir);
  try {
    await unlink(stateFile);
  } catch {
    // Ignore if file doesn't exist
  }
}

/**
 * Start the browser server (long-running process)
 * This should be called from session:start and will keep the process alive
 */
export async function startBrowserServer(
  outputDir: string,
  options: BrowserServerOptions = {}
): Promise<{ server: BrowserServer; wsEndpoint: string }> {
  const { stateFile, profileDir } = getPaths(outputDir);
  const headless = options.headless ?? !options.debug;
  const isolated = options.isolated ?? true;

  // Check if already running
  if (await isServerRunning(outputDir)) {
    throw new Error('Browser server already running. Use session:close all to stop it first.');
  }

  // Create directories
  await mkdir(outputDir, { recursive: true });
  if (isolated) {
    await mkdir(profileDir, { recursive: true });
  }

  // Find an available port for CDP debugging
  const debugPort = 9222 + Math.floor(Math.random() * 1000);

  // Launch browser server with CDP debugging enabled
  // This allows connectOverCDP to work and share contexts across reconnections
  const server = await chromium.launchServer({
    headless,
    slowMo: options.debug ? 100 : 0,
    args: [`--remote-debugging-port=${debugPort}`],
  });

  const wsEndpoint = server.wsEndpoint();
  const cdpUrl = `http://127.0.0.1:${debugPort}`;

  // Save server state
  const state: BrowserServerState = {
    wsEndpoint,
    cdpUrl,
    pid: process.pid,
    startedAt: new Date().toISOString(),
    headless,
    isolatedProfile: isolated ? profileDir : '',
  };

  await writeFile(stateFile, JSON.stringify(state, null, 2));

  return { server, wsEndpoint };
}

/**
 * Connect to existing browser server
 * Uses CDP connection which shares contexts across reconnections
 */
export async function connectToBrowserServer(outputDir: string): Promise<Browser | null> {
  const { stateFile } = getPaths(outputDir);

  if (!existsSync(stateFile)) {
    return null;
  }

  try {
    const content = await readFile(stateFile, 'utf-8');
    const state: BrowserServerState = JSON.parse(content);

    // Use connectOverCDP to share contexts across reconnections
    // This is critical - chromium.connect() creates isolated contexts per connection
    // but connectOverCDP shares the same browser instance and sees all contexts
    if (state.cdpUrl) {
      const browser = await chromium.connectOverCDP(state.cdpUrl, { timeout: 5000 });
      return browser;
    }

    // Fallback to standard connect (older state files without cdpUrl)
    const browser = await chromium.connect(state.wsEndpoint, { timeout: 5000 });
    return browser;
  } catch (error) {
    // Server not running - clean up
    await cleanupServerState(outputDir);
    return null;
  }
}

/**
 * Stop the browser server
 */
export async function stopBrowserServer(outputDir: string): Promise<boolean> {
  const { stateFile, profileDir } = getPaths(outputDir);

  if (!existsSync(stateFile)) {
    return false;
  }

  try {
    const content = await readFile(stateFile, 'utf-8');
    const state: BrowserServerState = JSON.parse(content);

    // Connect and close
    const browser = await chromium.connect(state.wsEndpoint, { timeout: 5000 });
    await browser.close();

    // Clean up state file
    await unlink(stateFile);

    // Optionally clean up profile dir
    // await rm(profileDir, { recursive: true, force: true });

    return true;
  } catch {
    // Force cleanup of state file
    await cleanupServerState(outputDir);
    return false;
  }
}

/**
 * Persistent session that connects to browser server
 */
export class PersistentSession {
  private browser: Browser;
  private context: BrowserContext;
  private page: Page;
  private state: SessionState;
  private sessionDir: string;

  private constructor(
    browser: Browser,
    context: BrowserContext,
    page: Page,
    state: SessionState,
    sessionDir: string
  ) {
    this.browser = browser;
    this.context = context;
    this.page = page;
    this.state = state;
    this.sessionDir = sessionDir;
  }

  /**
   * Create a new session using the browser server
   */
  static async create(
    outputDir: string,
    options: SessionOptions
  ): Promise<PersistentSession> {
    const { url, name, viewport = VIEWPORTS.desktop, waitFor, timeout = 30000 } = options;

    // Connect to browser server
    const browser = await connectToBrowserServer(outputDir);
    if (!browser) {
      throw new Error(
        'No browser server running.\n' +
        'Start one with: npx ibr session:start <url>\n' +
        'The first session:start launches the server and keeps it alive.'
      );
    }

    // Generate session ID
    const sessionId = `live_${nanoid(10)}`;
    const sessionsDir = join(outputDir, 'sessions');
    const sessionDir = join(sessionsDir, sessionId);
    await mkdir(sessionDir, { recursive: true });

    // Create context with viewport
    const context = await browser.newContext({
      viewport: {
        width: viewport.width,
        height: viewport.height,
      },
      reducedMotion: 'reduce',
    });

    // Create page and navigate
    const page = await context.newPage();

    const navStart = Date.now();
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout,
    });

    // Wait for specific selector if requested
    if (waitFor) {
      await page.waitForSelector(waitFor, { timeout });
    }

    const navDuration = Date.now() - navStart;

    // Initialize state
    const state: SessionState = {
      id: sessionId,
      url,
      name: name || new URL(url).pathname,
      viewport,
      createdAt: new Date().toISOString(),
      pageIndex: 0,
      actions: [{
        type: 'navigate',
        timestamp: new Date().toISOString(),
        params: { url, waitFor },
        success: true,
        duration: navDuration,
      }],
    };

    // Save state
    await writeFile(
      join(sessionDir, 'live-session.json'),
      JSON.stringify(state, null, 2)
    );

    // Capture initial screenshot as baseline
    await page.screenshot({
      path: join(sessionDir, 'baseline.png'),
      fullPage: false,
    });

    return new PersistentSession(browser, context, page, state, sessionDir);
  }

  /**
   * Get session from browser server by ID
   */
  static async get(outputDir: string, sessionId: string): Promise<PersistentSession | null> {
    const sessionDir = join(outputDir, 'sessions', sessionId);
    const statePath = join(sessionDir, 'live-session.json');

    if (!existsSync(statePath)) {
      return null;
    }

    // Connect to browser server
    const browser = await connectToBrowserServer(outputDir);
    if (!browser) {
      return null;
    }

    // Load session state
    const content = await readFile(statePath, 'utf-8');
    const state: SessionState = JSON.parse(content);

    // Find existing page or create new one
    const contexts = browser.contexts();
    let context: BrowserContext;
    let page: Page;

    const targetHost = new URL(state.url).host;

    if (contexts.length > 0) {
      // Try to find the page with matching URL
      for (const ctx of contexts) {
        const pages = ctx.pages();
        for (const p of pages) {
          if (p.url().includes(targetHost)) {
            context = ctx;
            page = p;
            return new PersistentSession(browser, context, page, state, sessionDir);
          }
        }
      }
    }

    // No matching page found - recreate
    context = await browser.newContext({
      viewport: {
        width: state.viewport.width,
        height: state.viewport.height,
      },
      reducedMotion: 'reduce',
    });

    page = await context.newPage();
    await page.goto(state.url, { waitUntil: 'networkidle' });

    return new PersistentSession(browser, context, page, state, sessionDir);
  }

  get id(): string {
    return this.state.id;
  }

  get url(): string {
    return this.page?.url() || this.state.url;
  }

  get actions(): ActionRecord[] {
    return [...this.state.actions];
  }

  private async recordAction(action: ActionRecord): Promise<void> {
    this.state.actions.push(action);
    await this.saveState();
  }

  private async saveState(): Promise<void> {
    await writeFile(
      join(this.sessionDir, 'live-session.json'),
      JSON.stringify(this.state, null, 2)
    );
  }

  async navigate(url: string, options?: { timeout?: number; waitFor?: string }): Promise<void> {
    const start = Date.now();

    try {
      await this.page.goto(url, {
        waitUntil: 'networkidle',
        timeout: options?.timeout || 30000,
      });

      if (options?.waitFor) {
        await this.page.waitForSelector(options.waitFor, { timeout: options?.timeout || 30000 });
      }

      this.state.url = url;
      await this.recordAction({
        type: 'navigate',
        timestamp: new Date().toISOString(),
        params: { url, waitFor: options?.waitFor },
        success: true,
        duration: Date.now() - start,
      });
    } catch (error) {
      await this.recordAction({
        type: 'navigate',
        timestamp: new Date().toISOString(),
        params: { url },
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - start,
      });
      throw error;
    }
  }

  async click(selector: string, options?: { timeout?: number }): Promise<void> {
    const start = Date.now();
    const timeout = options?.timeout || 5000;

    try {
      // Use locator API with visible filter - targets only visible elements
      // This is BETTER than waitForSelector which waits for first match to become visible
      const locator = this.page.locator(selector).filter({ visible: true }).first();
      await locator.click({ timeout });
      await this.recordAction({
        type: 'click',
        timestamp: new Date().toISOString(),
        params: { selector },
        success: true,
        duration: Date.now() - start,
      });
    } catch (error) {
      await this.recordAction({
        type: 'click',
        timestamp: new Date().toISOString(),
        params: { selector },
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - start,
      });
      throw error;
    }
  }

  async type(selector: string, text: string, options?: { delay?: number; timeout?: number; submit?: boolean; waitAfter?: number }): Promise<void> {
    const start = Date.now();
    const timeout = options?.timeout || 5000;

    try {
      // Use locator API with visible filter - auto-targets visible input
      const locator = this.page.locator(selector).filter({ visible: true }).first();

      // Clear existing content and fill with new text
      await locator.fill('', { timeout });

      if (options?.delay && options.delay > 0) {
        // Type character by character with delay
        await locator.pressSequentially(text, { delay: options.delay, timeout });
      } else {
        // Fast fill
        await locator.fill(text, { timeout });
      }

      // Submit if requested (press Enter)
      if (options?.submit) {
        await locator.press('Enter', { timeout });
        // Wait for navigation/network after submit
        if (options?.waitAfter) {
          await this.page.waitForTimeout(options.waitAfter);
        } else {
          // Default: wait for network idle after submit
          await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        }
      } else if (options?.waitAfter) {
        await this.page.waitForTimeout(options.waitAfter);
      }

      await this.recordAction({
        type: 'type',
        timestamp: new Date().toISOString(),
        params: { selector, text: text.length > 50 ? `${text.slice(0, 50)}...` : text, submit: options?.submit },
        success: true,
        duration: Date.now() - start,
      });
    } catch (error) {
      await this.recordAction({
        type: 'type',
        timestamp: new Date().toISOString(),
        params: { selector, text: text.length > 50 ? `${text.slice(0, 50)}...` : text },
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - start,
      });
      throw error;
    }
  }

  async waitFor(selectorOrTime: string | number, options?: { timeout?: number }): Promise<void> {
    const start = Date.now();

    try {
      if (typeof selectorOrTime === 'number') {
        await this.page.waitForTimeout(selectorOrTime);
      } else {
        // Use locator API with visible filter - waits for visible element only
        const locator = this.page.locator(selectorOrTime).filter({ visible: true }).first();
        await locator.waitFor({
          state: 'visible',
          timeout: options?.timeout || 30000
        });
      }
      await this.recordAction({
        type: 'wait',
        timestamp: new Date().toISOString(),
        params: { target: selectorOrTime },
        success: true,
        duration: Date.now() - start,
      });
    } catch (error) {
      await this.recordAction({
        type: 'wait',
        timestamp: new Date().toISOString(),
        params: { target: selectorOrTime },
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - start,
      });
      throw error;
    }
  }

  async screenshot(options?: { name?: string; fullPage?: boolean; selector?: string }): Promise<string> {
    const start = Date.now();
    const screenshotName = options?.name || `screenshot-${Date.now()}`;
    const outputPath = join(this.sessionDir, `${screenshotName}.png`);

    try {
      // Disable animations
      await this.page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            transition-duration: 0s !important;
            transition-delay: 0s !important;
          }
        `,
      });

      if (options?.selector) {
        const element = await this.page.waitForSelector(options.selector, { timeout: 5000 });
        if (!element) {
          throw new Error(`Element not found: ${options.selector}`);
        }
        await element.screenshot({ path: outputPath, type: 'png' });
      } else {
        await this.page.screenshot({
          path: outputPath,
          fullPage: options?.fullPage ?? true,
          type: 'png',
        });
      }

      await this.recordAction({
        type: 'screenshot',
        timestamp: new Date().toISOString(),
        params: { name: screenshotName, path: outputPath, selector: options?.selector },
        success: true,
        duration: Date.now() - start,
      });

      return outputPath;
    } catch (error) {
      await this.recordAction({
        type: 'screenshot',
        timestamp: new Date().toISOString(),
        params: { name: screenshotName, selector: options?.selector },
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - start,
      });
      throw error;
    }
  }

  async press(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  async evaluate<T>(script: string | (() => T)): Promise<T> {
    return this.page.evaluate(script) as Promise<T>;
  }

  async content(): Promise<string> {
    return this.page.content();
  }

  async title(): Promise<string> {
    return this.page.title();
  }

  /**
   * Get text content from a specific selector
   */
  async textContent(selector: string): Promise<string | null> {
    return this.page.textContent(selector);
  }

  /**
   * Get inner text from a specific selector (visible text only)
   */
  async innerText(selector: string): Promise<string> {
    return this.page.innerText(selector);
  }

  /**
   * Get all matching elements' text content
   */
  async allTextContent(selector: string): Promise<string[]> {
    const elements = await this.page.$$(selector);
    const texts: string[] = [];
    for (const el of elements) {
      const text = await el.textContent();
      if (text) texts.push(text.trim());
    }
    return texts;
  }

  /**
   * Close just this session (not the browser server)
   */
  async close(): Promise<void> {
    await this.context.close();
  }

  /**
   * Get raw Playwright page
   */
  getPage(): Page {
    return this.page;
  }
}

/**
 * List active sessions by checking session directories
 */
export async function listActiveSessions(outputDir: string): Promise<string[]> {
  const { sessionsDir } = getPaths(outputDir);

  if (!existsSync(sessionsDir)) {
    return [];
  }

  const { readdir } = await import('fs/promises');
  const entries = await readdir(sessionsDir, { withFileTypes: true });

  const liveSessions: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith('live_')) {
      const statePath = join(sessionsDir, entry.name, 'live-session.json');
      if (existsSync(statePath)) {
        liveSessions.push(entry.name);
      }
    }
  }

  return liveSessions;
}
