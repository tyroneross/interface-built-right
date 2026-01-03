import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { nanoid } from 'nanoid';
import { VIEWPORTS, type Viewport } from './schemas.js';

/**
 * Live session state file structure
 */
interface LiveSessionState {
  id: string;
  url: string;
  name: string;
  viewport: Viewport;
  sandbox: boolean;
  createdAt: string;
  actions: ActionRecord[];
}

/**
 * Recorded action for reproducibility
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
 * Options for creating a live session
 */
export interface LiveSessionOptions {
  url: string;
  name?: string;
  viewport?: Viewport;
  sandbox?: boolean;  // visible browser (default: false = headless)
  debug?: boolean;    // sandbox + slowMo + devtools
  timeout?: number;
}

/**
 * Fill form field definition
 */
export interface FormField {
  selector: string;
  value: string;
  type?: 'text' | 'checkbox' | 'radio' | 'select';
}

/**
 * Screenshot options for live sessions
 */
export interface LiveScreenshotOptions {
  name?: string;
  fullPage?: boolean;
  selector?: string;
}

/**
 * Live interactive browser session
 * Keeps browser alive for sequential interactions
 */
export class LiveSession {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private state: LiveSessionState;
  private outputDir: string;
  private sessionDir: string;

  private constructor(
    state: LiveSessionState,
    outputDir: string,
    browser: Browser,
    context: BrowserContext,
    page: Page
  ) {
    this.state = state;
    this.outputDir = outputDir;
    this.sessionDir = join(outputDir, 'sessions', state.id);
    this.browser = browser;
    this.context = context;
    this.page = page;
  }

  /**
   * Create a new live session
   */
  static async create(outputDir: string, options: LiveSessionOptions): Promise<LiveSession> {
    const {
      url,
      name,
      viewport = VIEWPORTS.desktop,
      sandbox = false,
      debug = false,
      timeout = 30000,
    } = options;

    // Generate session ID
    const sessionId = `live_${nanoid(10)}`;
    const sessionDir = join(outputDir, 'sessions', sessionId);
    await mkdir(sessionDir, { recursive: true });

    // Launch browser with appropriate mode
    const browser = await chromium.launch({
      headless: !sandbox && !debug,
      slowMo: debug ? 100 : 0,
      devtools: debug,
    });

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
    const navDuration = Date.now() - navStart;

    // Initialize state
    const state: LiveSessionState = {
      id: sessionId,
      url,
      name: name || new URL(url).pathname,
      viewport,
      sandbox: sandbox || debug,
      createdAt: new Date().toISOString(),
      actions: [{
        type: 'navigate',
        timestamp: new Date().toISOString(),
        params: { url },
        success: true,
        duration: navDuration,
      }],
    };

    // Save initial state
    await writeFile(
      join(sessionDir, 'live-session.json'),
      JSON.stringify(state, null, 2)
    );

    return new LiveSession(state, outputDir, browser, context, page);
  }

  /**
   * Resume an existing live session (if browser still running)
   * Note: This only works within the same process - browser state is not persisted
   */
  static async resume(outputDir: string, sessionId: string): Promise<LiveSession | null> {
    const sessionDir = join(outputDir, 'sessions', sessionId);
    const statePath = join(sessionDir, 'live-session.json');

    if (!existsSync(statePath)) {
      return null;
    }

    // Load state - but browser needs to be recreated
    const content = await readFile(statePath, 'utf-8');
    const state = JSON.parse(content) as LiveSessionState;

    // Relaunch browser and navigate to last URL
    const browser = await chromium.launch({
      headless: !state.sandbox,
    });

    const context = await browser.newContext({
      viewport: {
        width: state.viewport.width,
        height: state.viewport.height,
      },
      reducedMotion: 'reduce',
    });

    const page = await context.newPage();
    await page.goto(state.url, { waitUntil: 'networkidle' });

    return new LiveSession(state, outputDir, browser, context, page);
  }

  /**
   * Get session ID
   */
  get id(): string {
    return this.state.id;
  }

  /**
   * Get current URL
   */
  get url(): string {
    return this.page?.url() || this.state.url;
  }

  /**
   * Get action history
   */
  get actions(): ActionRecord[] {
    return [...this.state.actions];
  }

  /**
   * Record an action
   */
  private async recordAction(action: ActionRecord): Promise<void> {
    this.state.actions.push(action);
    await this.saveState();
  }

  /**
   * Save session state
   */
  private async saveState(): Promise<void> {
    await writeFile(
      join(this.sessionDir, 'live-session.json'),
      JSON.stringify(this.state, null, 2)
    );
  }

  /**
   * Ensure page is available
   */
  private ensurePage(): Page {
    if (!this.page) {
      throw new Error('Session is closed. Create a new session.');
    }
    return this.page;
  }

  /**
   * Navigate to a new URL
   */
  async navigate(url: string, options?: { timeout?: number }): Promise<void> {
    const page = this.ensurePage();
    const start = Date.now();

    try {
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: options?.timeout || 30000,
      });
      this.state.url = url;
      await this.recordAction({
        type: 'navigate',
        timestamp: new Date().toISOString(),
        params: { url },
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

  /**
   * Click an element
   */
  async click(selector: string, options?: { timeout?: number }): Promise<void> {
    const page = this.ensurePage();
    const start = Date.now();

    try {
      await page.click(selector, { timeout: options?.timeout || 5000 });
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

  /**
   * Type text into an element (clears existing content first)
   */
  async type(selector: string, text: string, options?: { delay?: number; timeout?: number }): Promise<void> {
    const page = this.ensurePage();
    const start = Date.now();

    try {
      await page.fill(selector, ''); // Clear first
      await page.type(selector, text, { delay: options?.delay || 0 });
      await this.recordAction({
        type: 'type',
        timestamp: new Date().toISOString(),
        params: { selector, text: text.length > 50 ? `${text.slice(0, 50)}...` : text },
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

  /**
   * Fill a form with multiple fields
   */
  async fill(fields: FormField[]): Promise<void> {
    const page = this.ensurePage();
    const start = Date.now();
    const results: { selector: string; success: boolean; error?: string }[] = [];

    for (const field of fields) {
      try {
        if (field.type === 'checkbox') {
          if (field.value === 'true' || field.value === '1') {
            await page.check(field.selector);
          } else {
            await page.uncheck(field.selector);
          }
        } else if (field.type === 'select') {
          await page.selectOption(field.selector, field.value);
        } else {
          await page.fill(field.selector, field.value);
        }
        results.push({ selector: field.selector, success: true });
      } catch (error) {
        results.push({
          selector: field.selector,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const allSuccess = results.every(r => r.success);
    await this.recordAction({
      type: 'fill',
      timestamp: new Date().toISOString(),
      params: { fields: fields.map(f => ({ selector: f.selector, type: f.type || 'text' })), results },
      success: allSuccess,
      error: allSuccess ? undefined : `Failed to fill ${results.filter(r => !r.success).length} field(s)`,
      duration: Date.now() - start,
    });

    if (!allSuccess) {
      const failed = results.filter(r => !r.success);
      throw new Error(`Failed to fill fields: ${failed.map(f => f.selector).join(', ')}`);
    }
  }

  /**
   * Hover over an element
   */
  async hover(selector: string, options?: { timeout?: number }): Promise<void> {
    const page = this.ensurePage();
    const start = Date.now();

    try {
      await page.hover(selector, { timeout: options?.timeout || 5000 });
      await this.recordAction({
        type: 'hover',
        timestamp: new Date().toISOString(),
        params: { selector },
        success: true,
        duration: Date.now() - start,
      });
    } catch (error) {
      await this.recordAction({
        type: 'hover',
        timestamp: new Date().toISOString(),
        params: { selector },
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - start,
      });
      throw error;
    }
  }

  /**
   * Execute JavaScript in the page context
   */
  async evaluate<T>(script: string | (() => T)): Promise<T> {
    const page = this.ensurePage();
    const start = Date.now();

    try {
      const result = await page.evaluate(script);
      await this.recordAction({
        type: 'evaluate',
        timestamp: new Date().toISOString(),
        params: { script: typeof script === 'string' ? script.slice(0, 100) : '[function]' },
        success: true,
        duration: Date.now() - start,
      });
      return result as T;
    } catch (error) {
      await this.recordAction({
        type: 'evaluate',
        timestamp: new Date().toISOString(),
        params: { script: typeof script === 'string' ? script.slice(0, 100) : '[function]' },
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - start,
      });
      throw error;
    }
  }

  /**
   * Wait for a selector or timeout
   */
  async waitFor(selectorOrTime: string | number, options?: { timeout?: number }): Promise<void> {
    const page = this.ensurePage();
    const start = Date.now();

    try {
      if (typeof selectorOrTime === 'number') {
        await page.waitForTimeout(selectorOrTime);
      } else {
        await page.waitForSelector(selectorOrTime, { timeout: options?.timeout || 30000 });
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

  /**
   * Take a screenshot
   */
  async screenshot(options?: LiveScreenshotOptions): Promise<string> {
    const page = this.ensurePage();
    const start = Date.now();

    const screenshotName = options?.name || `screenshot-${Date.now()}`;
    const outputPath = join(this.sessionDir, `${screenshotName}.png`);

    try {
      // Disable animations
      await page.addStyleTag({
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
        const element = await page.waitForSelector(options.selector, { timeout: 5000 });
        if (!element) {
          throw new Error(`Element not found: ${options.selector}`);
        }
        await element.screenshot({ path: outputPath, type: 'png' });
      } else {
        await page.screenshot({
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

  /**
   * Get page content (HTML)
   */
  async content(): Promise<string> {
    const page = this.ensurePage();
    return page.content();
  }

  /**
   * Get page title
   */
  async title(): Promise<string> {
    const page = this.ensurePage();
    return page.title();
  }

  /**
   * Check if an element exists
   */
  async exists(selector: string): Promise<boolean> {
    const page = this.ensurePage();
    const element = await page.$(selector);
    return element !== null;
  }

  /**
   * Get text content of an element
   */
  async textContent(selector: string): Promise<string | null> {
    const page = this.ensurePage();
    return page.textContent(selector);
  }

  /**
   * Get attribute of an element
   */
  async getAttribute(selector: string, attribute: string): Promise<string | null> {
    const page = this.ensurePage();
    return page.getAttribute(selector, attribute);
  }

  /**
   * Press a keyboard key
   */
  async press(key: string): Promise<void> {
    const page = this.ensurePage();
    await page.keyboard.press(key);
  }

  /**
   * Select option(s) from a dropdown
   */
  async select(selector: string, values: string | string[]): Promise<void> {
    const page = this.ensurePage();
    await page.selectOption(selector, values);
  }

  /**
   * Close the session and browser
   */
  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    this.page = null;

    // Mark session as closed in state
    await this.saveState();
  }

  /**
   * Check if session is still active
   */
  get isActive(): boolean {
    return this.browser !== null && this.page !== null;
  }

  /**
   * Get underlying Playwright page (for advanced use)
   */
  getPage(): Page {
    return this.ensurePage();
  }
}

/**
 * Singleton manager for live sessions
 */
class LiveSessionManager {
  private sessions: Map<string, LiveSession> = new Map();

  /**
   * Create a new live session
   */
  async create(outputDir: string, options: LiveSessionOptions): Promise<LiveSession> {
    const session = await LiveSession.create(outputDir, options);
    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Get an active session by ID
   */
  get(sessionId: string): LiveSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Close a session
   */
  async close(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.close();
      this.sessions.delete(sessionId);
      return true;
    }
    return false;
  }

  /**
   * Close all sessions
   */
  async closeAll(): Promise<void> {
    for (const session of this.sessions.values()) {
      await session.close();
    }
    this.sessions.clear();
  }

  /**
   * List active session IDs
   */
  list(): string[] {
    return Array.from(this.sessions.keys());
  }
}

// Export singleton manager
export const liveSessionManager = new LiveSessionManager();
