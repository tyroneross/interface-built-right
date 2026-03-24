import { EngineDriver } from './engine/driver.js';
import { CompatPage } from './engine/compat.js';
import type { PageLike } from './engine/page-like.js';
import { writeFile, readFile, mkdir, rename } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { nanoid } from 'nanoid';
import { VIEWPORTS, type Viewport } from './schemas.js';
import {
  type ScanResult,
  extractAndAudit,
  aggregateIssues,
  determineVerdict,
  generateSummary,
} from './scan.js';
import { testInteractivity } from './interactivity.js';
import { getSemanticOutput } from './semantic/index.js';

/**
 * Combined screenshot + scan data captured at a single point in time
 */
export interface StepCapture {
  /** Step number (1-indexed) */
  step: number;
  /** Action that triggered this capture */
  action: string;
  /** Screenshot file path (relative to session dir) */
  screenshot: string;
  /** Full scan result at this moment */
  scan: ScanResult;
  /** Whether to keep this screenshot after session close */
  keep: boolean;
  /** ISO timestamp */
  timestamp: string;
}

/**
 * Live session state file structure
 */
interface LiveSessionState {
  id: string;
  url: string;
  name: string;
  viewport: Viewport;
  sandbox: boolean;
  autoCapture: boolean;
  createdAt: string;
  actions: ActionRecord[];
  /** Combined captures (screenshot + scan) at each step */
  captures: StepCapture[];
}

/**
 * Recorded action for reproducibility
 */
export interface ActionRecord {
  type: 'navigate' | 'click' | 'type' | 'fill' | 'hover' | 'evaluate' | 'screenshot' | 'wait' | 'capture' | 'scan';
  timestamp: string;
  params: Record<string, unknown>;
  success: boolean;
  error?: string;
  duration?: number;
  /** Index into captures array, if this action triggered a capture */
  captureIndex?: number;
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
  /** Auto-capture screenshot + scan after every interaction (default: false) */
  autoCapture?: boolean;
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
 * Keeps browser alive for sequential interactions.
 * Supports combined screenshot + scan capture at each step.
 */
export class LiveSession {
  private driver: EngineDriver | null = null;
  private page: CompatPage | null = null;
  private state: LiveSessionState;
  public readonly outputDir: string;
  private sessionDir: string;
  private stepCounter = 0;
  private consoleErrors: string[] = [];
  private consoleWarnings: string[] = [];

  private constructor(
    state: LiveSessionState,
    outputDir: string,
    driver: EngineDriver,
    page: CompatPage
  ) {
    this.state = state;
    this.outputDir = outputDir;
    this.sessionDir = join(outputDir, 'sessions', state.id);
    this.driver = driver;
    this.page = page;

    // Listen for console messages throughout session lifetime
    page.on('console', msg => {
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        this.consoleWarnings.push(msg.text());
      }
    });
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
      autoCapture = false,
    } = options;

    // Generate session ID
    const sessionId = `live_${nanoid(10)}`;
    const sessionDir = join(outputDir, 'sessions', sessionId);
    await mkdir(sessionDir, { recursive: true });

    // Launch browser with appropriate mode
    const driver = new EngineDriver();
    await driver.launch({
      headless: !sandbox && !debug,
      slowMo: debug ? 100 : 0,
      devtools: debug,
      viewport: {
        width: viewport.width,
        height: viewport.height,
      },
    });

    // Create page
    const page = new CompatPage(driver);

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
      autoCapture,
      createdAt: new Date().toISOString(),
      actions: [{
        type: 'navigate',
        timestamp: new Date().toISOString(),
        params: { url },
        success: true,
        duration: navDuration,
      }],
      captures: [],
    };

    // Save initial state
    await writeFile(
      join(sessionDir, 'live-session.json'),
      JSON.stringify(state, null, 2)
    );

    // Capture initial screenshot as baseline
    await page.screenshot({
      path: join(sessionDir, 'baseline.png'),
      fullPage: false,
    });

    const session = new LiveSession(state, outputDir, driver, page);

    // If auto-capture is on, do initial combined capture
    if (autoCapture) {
      await session.capture({ keep: true, label: 'initial' });
    }

    return session;
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
    const driver = new EngineDriver();
    await driver.launch({
      headless: !state.sandbox,
      viewport: {
        width: state.viewport.width,
        height: state.viewport.height,
      },
    });

    const page = new CompatPage(driver);
    await page.goto(state.url, { waitUntil: 'networkidle' });

    const session = new LiveSession(state, outputDir, driver, page);
    session.stepCounter = state.captures.length;

    return session;
  }

  // ============================================================================
  // PROPERTIES
  // ============================================================================

  get id(): string {
    return this.state.id;
  }

  get url(): string {
    return this.page?.url() || this.state.url;
  }

  get actions(): ActionRecord[] {
    return [...this.state.actions];
  }

  get captures(): StepCapture[] {
    return [...this.state.captures];
  }

  get isActive(): boolean {
    return this.driver !== null && this.page !== null;
  }

  // ============================================================================
  // SCAN + CAPTURE (NEW)
  // ============================================================================

  /**
   * Run a full IBR scan against the current page state.
   * No new browser — uses the session's live page directly.
   */
  async scanPage(): Promise<ScanResult> {
    const page = this.ensurePage();
    const start = Date.now();

    // Snapshot console state for this scan
    const errorsSnapshot = [...this.consoleErrors];
    const warningsSnapshot = [...this.consoleWarnings];

    try {
      // Run all three analysis functions in parallel against the live page
      const [elements, interactivity, semantic] = await Promise.all([
        extractAndAudit(page, this.state.viewport),
        testInteractivity(page),
        getSemanticOutput(page),
      ]);

      const issues = aggregateIssues(elements.audit, interactivity, semantic, errorsSnapshot);
      const verdict = determineVerdict(issues);
      const summary = generateSummary(elements, interactivity, semantic, issues, errorsSnapshot);

      let route: string;
      try {
        route = new URL(this.url).pathname;
      } catch {
        route = this.url;
      }

      const result: ScanResult = {
        url: this.url,
        route,
        timestamp: new Date().toISOString(),
        viewport: this.state.viewport,
        elements,
        interactivity,
        semantic,
        console: {
          errors: errorsSnapshot,
          warnings: warningsSnapshot,
        },
        verdict,
        issues,
        summary,
      };

      await this.recordAction({
        type: 'scan',
        timestamp: new Date().toISOString(),
        params: { url: this.url },
        success: true,
        duration: Date.now() - start,
      });

      return result;
    } catch (error) {
      await this.recordAction({
        type: 'scan',
        timestamp: new Date().toISOString(),
        params: { url: this.url },
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - start,
      });
      throw error;
    }
  }

  /**
   * Combined capture: screenshot + scan in parallel.
   * Returns a StepCapture with both visual and structured data.
   *
   * @param options.keep - If true, screenshot is retained after session close.
   *                       If false (default), moved to archive/ on close.
   * @param options.label - Human-readable label for this step (e.g. "after-search")
   * @param options.fullPage - Capture full page screenshot (default: true)
   */
  async capture(options?: {
    keep?: boolean;
    label?: string;
    fullPage?: boolean;
  }): Promise<StepCapture> {
    const page = this.ensurePage();
    const start = Date.now();
    const keep = options?.keep ?? false;
    const label = options?.label || '';

    this.stepCounter++;
    const stepNum = this.stepCounter;
    const stepLabel = label || `step-${String(stepNum).padStart(3, '0')}`;
    const screenshotFile = `${stepLabel}.png`;
    const screenshotPath = join(this.sessionDir, screenshotFile);

    try {
      // Disable animations before capture
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

      // Run screenshot + scan in parallel
      const [, scanResult] = await Promise.all([
        page.screenshot({
          path: screenshotPath,
          fullPage: options?.fullPage ?? true,
          type: 'png',
        }),
        this.runScanAnalysis(),
      ]);

      const stepCapture: StepCapture = {
        step: stepNum,
        action: label || this.lastActionLabel(),
        screenshot: screenshotFile,
        scan: scanResult,
        keep,
        timestamp: new Date().toISOString(),
      };

      this.state.captures.push(stepCapture);

      await this.recordAction({
        type: 'capture',
        timestamp: new Date().toISOString(),
        params: { step: stepNum, label: stepLabel, keep, screenshot: screenshotFile },
        success: true,
        duration: Date.now() - start,
        captureIndex: this.state.captures.length - 1,
      });

      await this.saveState();
      return stepCapture;
    } catch (error) {
      await this.recordAction({
        type: 'capture',
        timestamp: new Date().toISOString(),
        params: { step: stepNum, label: stepLabel, keep },
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - start,
      });
      throw error;
    }
  }

  /**
   * Internal scan analysis without recording a separate action.
   * Used by capture() to run scan in parallel with screenshot.
   */
  private async runScanAnalysis(): Promise<ScanResult> {
    const page = this.ensurePage();
    const errorsSnapshot = [...this.consoleErrors];
    const warningsSnapshot = [...this.consoleWarnings];

    const [elements, interactivity, semantic] = await Promise.all([
      extractAndAudit(page, this.state.viewport),
      testInteractivity(page),
      getSemanticOutput(page),
    ]);

    const issues = aggregateIssues(elements.audit, interactivity, semantic, errorsSnapshot);
    const verdict = determineVerdict(issues);
    const summary = generateSummary(elements, interactivity, semantic, issues, errorsSnapshot);

    let route: string;
    try {
      route = new URL(this.url).pathname;
    } catch {
      route = this.url;
    }

    return {
      url: this.url,
      route,
      timestamp: new Date().toISOString(),
      viewport: this.state.viewport,
      elements,
      interactivity,
      semantic,
      console: { errors: errorsSnapshot, warnings: warningsSnapshot },
      verdict,
      issues,
      summary,
    };
  }

  /**
   * Get the label of the last recorded action (for auto-capture naming)
   */
  private lastActionLabel(): string {
    const last = this.state.actions[this.state.actions.length - 1];
    if (!last) return 'unknown';
    const params = last.params;
    if (last.type === 'click') return `click-${String(params.selector || '').slice(0, 30)}`;
    if (last.type === 'type') return `type-${String(params.selector || '').slice(0, 30)}`;
    if (last.type === 'navigate') return `navigate`;
    if (last.type === 'wait') return `wait-${String(params.target || '').slice(0, 30)}`;
    return last.type;
  }

  /**
   * Auto-capture after a successful action (when autoCapture is enabled)
   */
  private async autoCapAfterAction(): Promise<void> {
    if (!this.state.autoCapture) return;
    try {
      // Brief wait for any transitions/network to settle
      await this.page?.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
      await this.capture({ keep: false });
    } catch {
      // Auto-capture failures are non-fatal — don't break the action
    }
  }

  // ============================================================================
  // INTERACTION METHODS (with auto-capture support)
  // ============================================================================

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
      await this.autoCapAfterAction();
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
      await this.autoCapAfterAction();
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
      await this.autoCapAfterAction();
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

    await this.autoCapAfterAction();
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
      await this.autoCapAfterAction();
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
      await this.autoCapAfterAction();
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
   * Take a screenshot (standalone, without scan)
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

  // ============================================================================
  // PAGE INSPECTION
  // ============================================================================

  async content(): Promise<string> {
    const page = this.ensurePage();
    return page.content();
  }

  async title(): Promise<string> {
    const page = this.ensurePage();
    return page.title();
  }

  async exists(selector: string): Promise<boolean> {
    const page = this.ensurePage();
    const element = await page.$(selector);
    return element !== null;
  }

  async textContent(selector: string): Promise<string | null> {
    const page = this.ensurePage();
    return page.textContent(selector);
  }

  async getAttribute(selector: string, attribute: string): Promise<string | null> {
    const page = this.ensurePage();
    return page.getAttribute(selector, attribute);
  }

  async press(key: string): Promise<void> {
    const page = this.ensurePage();
    await page.keyboard.press(key);
  }

  async select(selector: string, values: string | string[]): Promise<void> {
    const page = this.ensurePage();
    await page.selectOption(selector, values);
  }

  /**
   * Get underlying CompatPage (for advanced use)
   */
  getPage(): CompatPage {
    return this.ensurePage();
  }

  // ============================================================================
  // SESSION LIFECYCLE
  // ============================================================================

  /**
   * Close the session and browser.
   * Ephemeral screenshots (keep: false) are moved to archive/ folder.
   * Kept screenshots (keep: true) and baseline.png stay in session dir.
   * Scan data in live-session.json is always preserved.
   */
  async close(): Promise<void> {
    // Take a final screenshot before closing (kept for dashboard)
    if (this.page && this.state.autoCapture && this.state.captures.length > 0) {
      try {
        await this.capture({ keep: true, label: 'final' });
      } catch {
        // Non-fatal
      }
    }

    // Archive ephemeral screenshots
    await this.archiveEphemeralScreenshots();

    if (this.driver) {
      await this.driver.close();
      this.driver = null;
    }
    this.page = null;

    // Save final state
    await this.saveState();
  }

  /**
   * Move ephemeral screenshots to archive/ subfolder.
   * User can delete archive/ whenever they want.
   */
  private async archiveEphemeralScreenshots(): Promise<void> {
    const ephemeral = this.state.captures.filter(c => !c.keep);
    if (ephemeral.length === 0) return;

    const archiveDir = join(this.sessionDir, 'archive');
    await mkdir(archiveDir, { recursive: true });

    for (const cap of ephemeral) {
      const src = join(this.sessionDir, cap.screenshot);
      const dest = join(archiveDir, cap.screenshot);
      try {
        if (existsSync(src)) {
          await rename(src, dest);
          // Update the path in state to reflect archive location
          cap.screenshot = `archive/${cap.screenshot}`;
        }
      } catch {
        // Non-fatal — screenshot may already be gone
      }
    }
  }

  // ============================================================================
  // INTERNAL
  // ============================================================================

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

  private ensurePage(): CompatPage {
    if (!this.page) {
      throw new Error('Session is closed. Create a new session.');
    }
    return this.page;
  }
}

/**
 * Singleton manager for live sessions
 */
class LiveSessionManager {
  private sessions: Map<string, LiveSession> = new Map();

  async create(outputDir: string, options: LiveSessionOptions): Promise<LiveSession> {
    const session = await LiveSession.create(outputDir, options);
    this.sessions.set(session.id, session);
    return session;
  }

  get(sessionId: string): LiveSession | undefined {
    return this.sessions.get(sessionId);
  }

  async close(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.close();
      this.sessions.delete(sessionId);
      return true;
    }
    return false;
  }

  async closeAll(): Promise<void> {
    for (const session of this.sessions.values()) {
      await session.close();
    }
    this.sessions.clear();
  }

  list(): string[] {
    return Array.from(this.sessions.keys());
  }
}

// Export singleton manager
export const liveSessionManager = new LiveSessionManager();
