import { EngineDriver } from './engine/driver.js';
import { CompatPage } from './engine/compat.js';
import { writeFile, readFile, mkdir, rename } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { nanoid } from 'nanoid';
import { VIEWPORTS, type Viewport } from './schemas.js';
import type { BrowserLaunchOptions } from './types.js';
import {
  type ScanResult,
  extractAndAudit,
  aggregateIssues,
  determineVerdict,
  generateSummary,
  applyDesignSystemCheck,
} from './scan.js';
import { testInteractivity } from './interactivity.js';
import { getSemanticOutput } from './semantic/index.js';
import { waitForStableTree, waitForHydration } from './engine/cdp/wait.js';

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
  /** True if the triggering action caused a URL change */
  navigated?: boolean;
  /** URL before the action (only set when navigated is true) */
  urlBefore?: string;
  /** URL after navigation (only set when navigated is true) */
  urlAfter?: string;
  /** Console errors that fired during the triggering action window */
  actionErrors?: string[];
}

/**
 * Live session state file structure
 */
interface LiveSessionState {
  id: string;
  url: string;
  name: string;
  viewport: Viewport;
  headed: boolean;
  autoCapture: boolean;
  createdAt: string;
  actions: ActionRecord[];
  /** Combined captures (screenshot + scan) at each step */
  captures: StepCapture[];
}

/**
 * Before/after diff captured around an interaction when autoCapture is enabled.
 */
export interface ActionDiff {
  urlChanged: boolean;
  previousUrl: string;
  currentUrl: string;
  elementsAdded: string[];     // labels of new elements
  elementsRemoved: string[];   // labels of removed elements
  consoleErrors: string[];     // errors that appeared during the action
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
  /** Before/after diff (populated when autoCapture is enabled) */
  diff?: ActionDiff;
  /** Console errors that appeared during this action window */
  actionErrors?: string[];
  /** True if this action caused a URL change */
  navigated?: boolean;
  /** URL before the action (set when navigated is true) */
  urlBefore?: string;
  /** URL after navigation (set when navigated is true) */
  urlAfter?: string;
}

/**
 * Options for creating a live session
 */
export interface LiveSessionOptions extends BrowserLaunchOptions {
  url: string;
  name?: string;
  viewport?: Viewport;
  headed?: boolean;   // visible browser (default: false = headless)
  sandbox?: boolean;  // deprecated alias for headed
  debug?: boolean;    // headed + slowMo + devtools
  timeout?: number;
  /** Auto-capture screenshot + scan after every interaction (default: true) */
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
      headed = false,
      sandbox = false,
      debug = false,
      timeout = 30000,
      autoCapture = true,
      browserMode,
      cdpUrl,
      wsEndpoint,
      chromePath,
    } = options;
    const showBrowser = headed || sandbox || debug;

    // Generate session ID
    const sessionId = `live_${nanoid(10)}`;
    const sessionDir = join(outputDir, 'sessions', sessionId);
    await mkdir(sessionDir, { recursive: true });

    // Launch browser with appropriate mode
    const driver = new EngineDriver();
    await driver.launch({
      headless: !showBrowser,
      viewport: {
        width: viewport.width,
        height: viewport.height,
      },
      mode: browserMode,
      cdpUrl,
      wsEndpoint,
      chromePath,
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
      headed: showBrowser,
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
    const rawState = JSON.parse(content) as LiveSessionState & { sandbox?: boolean };
    const state: LiveSessionState = {
      ...rawState,
      headed: rawState.headed ?? rawState.sandbox ?? false,
    };

    // Relaunch browser and navigate to last URL
    const driver = new EngineDriver();
    await driver.launch({
      headless: !state.headed,
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
      const designSystem = await applyDesignSystemCheck(
        elements.all, issues, this.state.viewport, this.url, this.outputDir
      );
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
        designSystem,
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
    const designSystem = await applyDesignSystemCheck(
      elements.all, issues, this.state.viewport, this.url, this.outputDir
    );
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
      designSystem,
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
   * Wait for the page to be ready after a navigation-inducing action.
   * 1. Waits up to 2s for a Page.loadEventFired signal via AX tree stability.
   * 2. Then polls for stable AX tree.
   */
  private async waitForPageReady(): Promise<void> {
    if (!this.driver) return;
    try {
      await waitForStableTree(
        () => this.driver!.getSnapshot(),
        { timeout: 2000, stableTime: 300 },
      );
    } catch {
      // Non-fatal — page may already be stable
    }
  }

  /**
   * Capture a lightweight before/after diff around an interaction.
   * Returns undefined when autoCapture is disabled.
   * Only captures AX element labels (not full scan) for performance.
   */
  private async captureInteractionDiff(
    action: () => Promise<void>,
  ): Promise<ActionDiff | undefined> {
    if (!this.state.autoCapture || !this.driver) {
      await action();
      return undefined;
    }

    // --- Pre-action snapshot ---
    const previousUrl = this.page?.url() ?? this.state.url;

    // Clear console error buffer so we only collect errors from this action
    this.driver.consoleDomain.clear();
    // Reset our own accumulator too
    this.consoleErrors = [];

    const beforeElements = await this.driver.getSnapshot().catch(() => []);
    const beforeLabels = new Set(
      beforeElements.map(e => e.label).filter((l): l is string => !!l),
    );

    // --- Perform action ---
    await action();

    // --- Post-action snapshot ---
    const currentUrl = this.page?.url() ?? this.state.url;

    // Small settle wait before reading post state
    await new Promise(r => setTimeout(r, 100));

    const afterElements = await this.driver.getSnapshot().catch(() => []);
    const afterLabels = new Set(
      afterElements.map(e => e.label).filter((l): l is string => !!l),
    );

    // Collect console errors that fired during the action
    const newErrors = this.driver.consoleDomain.getErrors().map(m => m.text);

    const elementsAdded = [...afterLabels].filter(l => !beforeLabels.has(l));
    const elementsRemoved = [...beforeLabels].filter(l => !afterLabels.has(l));

    return {
      urlChanged: currentUrl !== previousUrl,
      previousUrl,
      currentUrl,
      elementsAdded,
      elementsRemoved,
      consoleErrors: newErrors,
    };
  }

  /**
   * Auto-capture after a successful action (when autoCapture is enabled).
   * Waits for SPA hydration stability before running the full scan so that
   * React/Next.js pages are fully mounted before element extraction.
   *
   * @param context - Navigation and error context from the triggering action.
   *   navigated: true when the action caused a URL change (full page load needed).
   *   urlBefore/urlAfter: URL pair for the navigation (set when navigated is true).
   *   actionErrors: console errors that fired during the action window.
   */
  private async autoCapAfterAction(context?: {
    navigated?: boolean;
    urlBefore?: string;
    urlAfter?: string;
    actionErrors?: string[];
  }): Promise<void> {
    if (!this.state.autoCapture) return;
    try {
      if (this.driver) {
        if (context?.navigated) {
          // Full page navigation — wait for load + hydration on the new URL.
          // waitForPageReady already ran in click(), so we just give hydration
          // a longer stable window to absorb the new page's React mount.
          await waitForHydration(
            this.driver.connection,
            () => this.driver!.getSnapshot(),
            (expr: string) => this.driver!.evaluate(expr),
            { timeout: 8000, stableTime: 600, minElements: 1, settleTime: 200 },
          ).catch(() => {});
        } else {
          // Same-page interaction — standard SPA hydration wait.
          await waitForHydration(
            this.driver.connection,
            () => this.driver!.getSnapshot(),
            (expr: string) => this.driver!.evaluate(expr),
            { timeout: 5000, stableTime: 400, minElements: 1, settleTime: 150 },
          ).catch(() => {});
        }
      }

      // Collect action errors to surface in capture and console output.
      const actionErrors = context?.actionErrors ?? [];

      // If action produced console errors, emit them to the session's accumulator
      // so they appear in the next scan result's console.errors array.
      if (actionErrors.length > 0) {
        for (const err of actionErrors) {
          if (!this.consoleErrors.includes(err)) {
            this.consoleErrors.push(err);
          }
        }
        // Log immediately so errors are visible in CLI output.
        console.error(`[IBR] Action triggered ${actionErrors.length} console error(s):`);
        for (const err of actionErrors) {
          console.error(`  [console.error] ${err}`);
        }
      }

      const stepCapture = await this.capture({ keep: false });

      // Annotate the capture with navigation and error context.
      if (context?.navigated) {
        stepCapture.navigated = true;
        stepCapture.urlBefore = context.urlBefore;
        stepCapture.urlAfter = context.urlAfter;
      }
      if (actionErrors.length > 0) {
        stepCapture.actionErrors = actionErrors;
      }

      // Persist the updated capture annotations.
      await this.saveState();
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
   * Click an element.
   * When autoCapture is enabled: captures pre/post element snapshot, URL diff, and console errors.
   * After any click, detects navigation (50ms check then 500ms confirm) and waits for the new
   * page to hydrate before running the auto-capture scan.
   */
  async click(selector: string, options?: { timeout?: number }): Promise<void> {
    this.ensurePage();
    const start = Date.now();

    // Snapshot URL before the click so navigation detection is independent of diff timing.
    const urlBefore = this.driver?.url ?? this.state.url;

    try {
      const diff = await this.captureInteractionDiff(async () => {
        const p = this.ensurePage();
        await p.click(selector, { timeout: options?.timeout || 5000 });
      });

      // Navigation detection — 50ms fast check first, then 500ms confirm window.
      await new Promise(r => setTimeout(r, 50));
      const urlAfterFast = this.driver?.url ?? (this.page?.url() ?? this.state.url);

      // If URL already changed at 50ms, navigation fired immediately.
      // Otherwise wait up to 500ms total for async navigations (pushState, redirects).
      let navigated = urlAfterFast !== urlBefore;
      if (!navigated) {
        await new Promise(r => setTimeout(r, 450)); // total: 500ms
      }
      const urlAfter = this.driver?.url ?? (this.page?.url() ?? this.state.url);
      navigated = urlAfter !== urlBefore;

      if (navigated) {
        // URL changed — wait for the new page to hydrate before auto-capture.
        await this.waitForPageReady();
        this.state.url = urlAfter;
      }

      // Collect console errors surfaced during the action window.
      const actionErrors = diff?.consoleErrors ?? [];

      await this.recordAction({
        type: 'click',
        timestamp: new Date().toISOString(),
        params: { selector },
        success: true,
        duration: Date.now() - start,
        diff,
        navigated,
        urlBefore: navigated ? urlBefore : undefined,
        urlAfter: navigated ? urlAfter : undefined,
        actionErrors: actionErrors.length > 0 ? actionErrors : undefined,
      });

      await this.autoCapAfterAction({
        navigated,
        urlBefore: navigated ? urlBefore : undefined,
        urlAfter: navigated ? urlAfter : undefined,
        actionErrors,
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
   * Type text into an element (clears existing content first).
   * When autoCapture is enabled: captures pre/post element snapshot and console errors.
   */
  async type(selector: string, text: string, options?: { delay?: number; timeout?: number }): Promise<void> {
    this.ensurePage();
    const start = Date.now();

    try {
      const diff = await this.captureInteractionDiff(async () => {
        const p = this.ensurePage();
        await p.fill(selector, ''); // Clear first
        await p.type(selector, text, { delay: options?.delay || 0 });
      });

      const actionErrors = diff?.consoleErrors ?? [];

      await this.recordAction({
        type: 'type',
        timestamp: new Date().toISOString(),
        params: { selector, text: text.length > 50 ? `${text.slice(0, 50)}...` : text },
        success: true,
        duration: Date.now() - start,
        diff,
        actionErrors: actionErrors.length > 0 ? actionErrors : undefined,
      });
      await this.autoCapAfterAction({ actionErrors });
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
   * Fill a form with multiple fields.
   * When autoCapture is enabled: captures pre/post element snapshot and console errors.
   */
  async fill(fields: FormField[]): Promise<void> {
    this.ensurePage();
    const start = Date.now();
    const results: { selector: string; success: boolean; error?: string }[] = [];

    let diff: ActionDiff | undefined;

    try {
      diff = await this.captureInteractionDiff(async () => {
        const page = this.ensurePage();
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
          } catch (fieldError) {
            results.push({
              selector: field.selector,
              success: false,
              error: fieldError instanceof Error ? fieldError.message : String(fieldError),
            });
          }
        }
      });
    } catch (error) {
      await this.recordAction({
        type: 'fill',
        timestamp: new Date().toISOString(),
        params: { fields: fields.map(f => ({ selector: f.selector, type: f.type || 'text' })), results },
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - start,
      });
      throw error;
    }

    const allSuccess = results.every(r => r.success);
    const actionErrors = diff?.consoleErrors ?? [];
    await this.recordAction({
      type: 'fill',
      timestamp: new Date().toISOString(),
      params: { fields: fields.map(f => ({ selector: f.selector, type: f.type || 'text' })), results },
      success: allSuccess,
      error: allSuccess ? undefined : `Failed to fill ${results.filter(r => !r.success).length} field(s)`,
      duration: Date.now() - start,
      diff,
      actionErrors: actionErrors.length > 0 ? actionErrors : undefined,
    });

    if (!allSuccess) {
      const failed = results.filter(r => !r.success);
      throw new Error(`Failed to fill fields: ${failed.map(f => f.selector).join(', ')}`);
    }

    await this.autoCapAfterAction({ actionErrors });
  }

  /**
   * Hover over an element.
   * When autoCapture is enabled: captures pre/post element snapshot and console errors.
   */
  async hover(selector: string, options?: { timeout?: number }): Promise<void> {
    this.ensurePage();
    const start = Date.now();

    try {
      const diff = await this.captureInteractionDiff(async () => {
        const p = this.ensurePage();
        await p.hover(selector, { timeout: options?.timeout || 5000 });
      });

      const actionErrors = diff?.consoleErrors ?? [];
      await this.recordAction({
        type: 'hover',
        timestamp: new Date().toISOString(),
        params: { selector },
        success: true,
        duration: Date.now() - start,
        diff,
        actionErrors: actionErrors.length > 0 ? actionErrors : undefined,
      });
      await this.autoCapAfterAction({ actionErrors });
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
    await page.selectOption?.(selector, Array.isArray(values) ? values[0] : values);
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
