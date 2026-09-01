import { EngineDriver } from './engine/driver.js';
import { CompatPage } from './engine/compat.js';
import { writeFile, readFile, unlink, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { nanoid } from 'nanoid';
import { VIEWPORTS, type Viewport, type EnhancedElement, type AuditResult } from './schemas.js';
import { viewportToConfig } from './devices.js';
import type { BrowserConnectionOptions, BrowserMode } from './engine/cdp/browser.js';
import {
  CDP_PROBE_TIMEOUT_MS,
  WS_CONNECT_TIMEOUT_MS,
  fetchWithTimeout,
  withTimeout,
} from './engine/net-timeout.js';
import { extractInteractiveElements, analyzeElements } from './extract.js';
import {
  type ScanResult,
  extractAndAudit,
  aggregateIssues,
  applyDesignSystemCheck,
  determineVerdict,
  generateSummary,
} from './scan.js';
import { testInteractivity } from './interactivity.js';
import { getSemanticOutput } from './semantic/index.js';
import {
  formatUserActionRequired,
  inspectSessionHardWall,
  sessionAttemptKey,
  type SessionHardWall,
} from './session-hard-wall.js';

/**
 * Browser server state persisted to disk
 */
interface BrowserServerState {
  wsEndpoint: string;
  cdpUrl?: string;  // CDP URL for reconnection (shares contexts)
  pid: number;
  chromePid?: number | null;  // Chrome process PID for zombie cleanup
  startedAt: string;
  headless: boolean;
  mode: BrowserMode;
  ownsBrowser: boolean;
  isolatedProfile: string;
  lowMemory?: boolean;  // Whether low-memory mode is enabled
}

/**
 * Session state stored in the session directory
 */
interface SessionState {
  id: string;
  url: string;
  currentUrl: string;
  targetId: string;
  strategyKey: string;
  hardWall?: SessionHardWall;
  name: string;
  viewport: Viewport;
  createdAt: string;
  pageIndex: number;  // Index in the browser context
  actions: ActionRecord[];
  // Element audit data (captured on each screenshot)
  elements?: EnhancedElement[];
  audit?: AuditResult;
  // Combined captures (screenshot + scan) at each step
  captures?: StepCapture[];
  autoCapture?: boolean;
}

/**
 * Combined screenshot + scan captured at a single point in time
 */
export interface StepCapture {
  step: number;
  action: string;
  screenshot: string;
  scan: ScanResult;
  keep: boolean;
  timestamp: string;
}

/**
 * Action record for session history
 */
export interface ActionRecord {
  type: 'navigate' | 'click' | 'type' | 'select' | 'fill' | 'hover' | 'evaluate' | 'screenshot' | 'wait' | 'capture' | 'scan';
  timestamp: string;
  params: Record<string, unknown>;
  success: boolean;
  error?: string;
  duration?: number;
  captureIndex?: number;
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
  strategyKey?: string;
}

export class UserActionRequiredError extends Error {
  constructor(public readonly wall: SessionHardWall, repeatBlocked = false) {
    super(formatUserActionRequired(wall, repeatBlocked));
    this.name = 'UserActionRequiredError';
  }
}

/**
 * Options for starting the browser server
 */
export interface BrowserServerOptions extends BrowserConnectionOptions {
  headless?: boolean;  // Default: true
  debug?: boolean;     // Visible + slowMo + devtools
  isolated?: boolean;  // Use isolated profile (default: true)
  lowMemory?: boolean; // Reduce memory usage for lower-powered machines
  /** Reports each spawn stage, so a slow start is visible rather than silent. */
  onProgress?: (step: string) => void;
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

async function findPendingHardWall(
  outputDir: string,
  requestedUrl: string,
  strategyKey: string,
): Promise<SessionHardWall | null> {
  const { sessionsDir } = getPaths(outputDir);
  if (!existsSync(sessionsDir)) return null;

  const attemptKey = sessionAttemptKey(requestedUrl, strategyKey);
  const entries = await readdir(sessionsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('live_')) continue;
    const statePath = join(sessionsDir, entry.name, 'live-session.json');
    if (!existsSync(statePath)) continue;
    try {
      const state = JSON.parse(await readFile(statePath, 'utf-8')) as Partial<SessionState>;
      if (state.hardWall?.attemptKey === attemptKey) return state.hardWall;
    } catch {
      // A malformed unrelated session record must not block a new session.
    }
  }
  return null;
}

/**
 * What the on-disk manifest actually proves right now.
 *
 * `alive` requires BOTH checks to pass: the owning ibr pid is still running AND
 * the CDP endpoint answers `GET /json/version` inside a short deadline. Either
 * check failing means the manifest is stale — a file on disk is a claim, not
 * evidence, and `browser-server.json` outlives the browser routinely (a
 * terminated `session:start` used to leave one behind on every run).
 *
 * `unreachable` is deliberately NOT `stale`: Chrome is alive by pid but did not
 * answer in time, which happens when it is merely busy. Killing it there would
 * destroy a working browser out from under an active session.
 */
export type ServerStatus = 'no-manifest' | 'alive' | 'stale' | 'unreachable';

export interface ServerInspection {
  status: ServerStatus;
  /** One sentence naming what was checked and what it said. */
  reason: string;
  state: BrowserServerState | null;
}

/**
 * Validate the manifest before anything trusts it.
 *
 * Cleans up the manifest on `stale` so the next `session:start` spawns fresh
 * rather than trying to connect to something that is gone.
 */
export async function inspectBrowserServer(outputDir: string): Promise<ServerInspection> {
  const { stateFile } = getPaths(outputDir);

  if (!existsSync(stateFile)) {
    return { status: 'no-manifest', reason: 'No browser-server.json on disk.', state: null };
  }

  let state: BrowserServerState;
  try {
    state = JSON.parse(await readFile(stateFile, 'utf-8')) as BrowserServerState;
  } catch {
    await cleanupServerState(outputDir);
    return {
      status: 'stale',
      reason: 'browser-server.json was unreadable or malformed; removed it.',
      state: null,
    };
  }

  // Check 1 — is the ibr process that owns this server still alive?
  // process.kill(pid, 0) delivers no signal; it only asks.
  if (state.pid && state.pid !== process.pid && !pidAlive(state.pid)) {
    if (state.chromePid) {
      try { process.kill(state.chromePid, 'SIGKILL'); } catch { /* already dead */ }
    }
    await cleanupServerState(outputDir);
    return {
      status: 'stale',
      reason:
        `Owning ibr process pid ${state.pid} is dead, so the browser it launched is orphaned. `
        + `Reaped chrome pid ${state.chromePid ?? 'unknown'} and removed the manifest.`,
      state,
    };
  }

  if (!state.cdpUrl) {
    return state.wsEndpoint
      ? { status: 'alive', reason: `Manifest carries a ws endpoint and pid ${state.pid} is alive.`, state }
      : (await cleanupServerState(outputDir), {
          status: 'stale' as const,
          reason: 'Manifest has neither a CDP URL nor a ws endpoint; removed it.',
          state,
        });
  }

  // Check 2 — does the CDP endpoint actually answer?
  const probeUrl = `${state.cdpUrl}/json/version`;
  try {
    const res = await fetchWithTimeout(probeUrl, {
      timeoutMs: CDP_PROBE_TIMEOUT_MS,
      waitingOn: `CDP version probe ${probeUrl}`,
    });
    if (res.ok) {
      return { status: 'alive', reason: `${probeUrl} answered ${res.status}.`, state };
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);

    // A FETCH THAT THREW IS NOT PROOF CHROME IS DEAD.
    //
    // This block used to SIGKILL `state.chromePid` and delete the state file on
    // any throw — including the probe deadline firing. A Chrome that is alive
    // and merely BUSY can miss a short deadline, and this is a read-only
    // liveness CHECK called by ordinary commands like `session:list`. So
    // checking whether the browser was running could destroy the browser, and a
    // poll loop became repeated kill attempts. It cost two interaction passes
    // on 2026-09-01.
    //
    // A failed MEASUREMENT ("could not reach Chrome in time") is not a FACT
    // ("Chrome is gone"). Ask the pid, which answers the actual question.
    if (state.chromePid && pidAlive(state.chromePid)) {
      return {
        status: 'unreachable',
        reason:
          `Chrome pid ${state.chromePid} is alive but ${probeUrl} did not answer: ${detail}. `
          + 'Leaving it running — close it explicitly with: npx ibr session:close all',
        state,
      };
    }
    if (state.chromePid) {
      try { process.kill(state.chromePid, 'SIGKILL'); } catch { /* already dead */ }
    }
    await cleanupServerState(outputDir);
    return {
      status: 'stale',
      reason: `Chrome pid ${state.chromePid ?? 'unknown'} is gone and ${probeUrl} did not answer: ${detail}. Removed the manifest.`,
      state,
    };
  }

  await cleanupServerState(outputDir);
  return {
    status: 'stale',
    reason: `${probeUrl} responded with a non-OK status; removed the manifest.`,
    state,
  };
}

/** `process.kill(pid, 0)` delivers no signal — it only asks whether pid exists. */
function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM means the process exists but belongs to another user.
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * Check if browser server is running.
 *
 * `unreachable` counts as running on purpose: a busy browser is still a browser,
 * and reporting it as gone would let the caller launch a second one.
 */
export async function isServerRunning(outputDir: string): Promise<boolean> {
  const { status } = await inspectBrowserServer(outputDir);
  return status === 'alive' || status === 'unreachable';
}

/**
 * Clean up stale server state
 */
export async function cleanupServerState(outputDir: string): Promise<void> {
  const { stateFile } = getPaths(outputDir);
  try {
    await unlink(stateFile);
  } catch {
    // Ignore if file doesn't exist
  }
}

/**
 * Resolve the browser-level WebSocket URL from the CDP debug endpoint.
 *
 * Bounded: an unbounded `fetch()` here blocks forever against a port that is
 * listening but silent, which is exactly what a recycled ephemeral port from a
 * stale manifest looks like.
 */
async function resolveWsEndpoint(cdpUrl: string): Promise<string> {
  const res = await fetchWithTimeout(`${cdpUrl}/json/version`, {
    timeoutMs: CDP_PROBE_TIMEOUT_MS,
    waitingOn: `CDP version probe ${cdpUrl}/json/version`,
  });
  const data = await res.json() as { webSocketDebuggerUrl: string };
  return data.webSocketDebuggerUrl;
}

/**
 * Start the browser server (long-running process)
 * This should be called from session:start and will keep the process alive
 */
export async function startBrowserServer(
  outputDir: string,
  options: BrowserServerOptions = {}
): Promise<{ driver: EngineDriver; wsEndpoint: string; ownsBrowser: boolean }> {
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

  // Build browser args (extra flags beyond what BrowserManager adds by default)
  const extraArgs: string[] = [];

  // Low memory mode args - reduces Chromium memory footprint
  // Useful for lower-powered machines (4GB RAM, older CPUs)
  if (options.lowMemory) {
    extraArgs.push(
      '--disable-gpu',                    // Disable GPU acceleration
      '--disable-dev-shm-usage',          // Use /tmp instead of /dev/shm
      '--disable-extensions',             // No extensions
      '--disable-background-networking',  // Reduce background activity
      '--disable-default-apps',           // No default Chrome apps
      '--disable-sync',                   // No Chrome sync
      '--no-first-run',                   // Skip first run tasks
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--memory-pressure-off',            // Don't respond to memory pressure
      '--js-flags=--max-old-space-size=256', // Limit V8 heap to 256MB
    );
  }

  // Launch browser via EngineDriver
  const driver = new EngineDriver();
  await driver.launch({
    headless,
    userDataDir: isolated ? profileDir : undefined,
    mode: options.mode,
    cdpUrl: options.cdpUrl,
    wsEndpoint: options.wsEndpoint,
    chromePath: options.chromePath,
    onProgress: options.onProgress,
  });
  const mode = driver.browserMode;
  const cdpUrl = driver.cdpUrl ?? undefined;
  const wsEndpoint = driver.wsEndpoint ?? (cdpUrl ? await resolveWsEndpoint(cdpUrl) : undefined);
  const ownsBrowser = mode === 'local';

  if (!wsEndpoint) {
    throw new Error('Failed to resolve browser WebSocket endpoint.');
  }

  // Save server state
  const state: BrowserServerState = {
    wsEndpoint,
    cdpUrl,
    pid: process.pid,
    chromePid: driver.chromePid,
    startedAt: new Date().toISOString(),
    headless,
    mode,
    ownsBrowser,
    isolatedProfile: isolated ? profileDir : '',
    lowMemory: options.lowMemory,
  };

  await writeFile(stateFile, JSON.stringify(state, null, 2));

  return { driver, wsEndpoint, ownsBrowser };
}

/**
 * Connect to existing browser server
 * Creates a new EngineDriver and attaches it to the running Chrome process
 */
export async function connectToBrowserServer(outputDir: string, targetId?: string): Promise<EngineDriver | null> {
  // Validate before trusting: never attempt a connect against a manifest that
  // has already been shown to be stale. `inspectBrowserServer` removes the file
  // in that case, so the caller's next step is a clean spawn rather than a
  // connect to a port that belongs to something else now.
  const inspection = await inspectBrowserServer(outputDir);
  if (inspection.status === 'no-manifest' || inspection.status === 'stale' || !inspection.state) {
    lastConnectFailure = inspection.reason;
    return null;
  }

  const state = inspection.state;
  try {
    // Resolve the current browser-level WS endpoint (avoids stale cached URL)
    const wsUrl = state.cdpUrl ? await resolveWsEndpoint(state.cdpUrl) : state.wsEndpoint;

    // Create a new driver and connect to the existing Chrome process. Bounded:
    // the CDP handshake plus domain setup must not outlive the connect budget.
    const driver = new EngineDriver();
    await withTimeout(
      driver.connectExisting(wsUrl, targetId),
      WS_CONNECT_TIMEOUT_MS,
      `CDP attach to browser server at ${state.cdpUrl ?? wsUrl}`,
    );
    lastConnectFailure = null;
    return driver;
  } catch (error) {
    // Reaching here means the manifest looked live a moment ago but the attach
    // failed. Record why so the caller can print a cause instead of a bare
    // "no browser server running".
    lastConnectFailure = error instanceof Error ? error.message : String(error);
    // Only reap when the browser is genuinely gone. An attach that timed out
    // against a LIVE Chrome is a failed measurement, not proof of death —
    // deleting the manifest there strands a running browser with nothing on
    // disk pointing at it, so `session:close all` can no longer find it.
    if (!state.chromePid || !pidAlive(state.chromePid)) {
      await cleanupServerState(outputDir);
    }
    return null;
  }
}

/**
 * Why the last `connectToBrowserServer` returned null. Read by callers that
 * would otherwise turn a specific, diagnosable failure into a generic message.
 */
let lastConnectFailure: string | null = null;

export function lastBrowserServerFailure(): string | null {
  return lastConnectFailure;
}

/**
 * Stop the browser server
 */
/**
 * Why the last `stopBrowserServer` returned false after finding a manifest.
 * Null when there was simply nothing to stop.
 */
let lastStopFailure: string | null = null;

export function lastBrowserServerStopFailure(): string | null {
  return lastStopFailure;
}

export async function stopBrowserServer(outputDir: string): Promise<boolean> {
  lastStopFailure = null;
  const { stateFile, profileDir: _profileDir } = getPaths(outputDir);

  if (!existsSync(stateFile)) {
    return false;
  }

  try {
    const content = await readFile(stateFile, 'utf-8');
    const state: BrowserServerState = JSON.parse(content);

    // Connect and release the session. In local mode this shuts down the
    // browser we launched; in connect mode it only drops IBR's attachment.
    const wsUrl = state.cdpUrl
      ? await resolveWsEndpoint(state.cdpUrl)
      : state.wsEndpoint;

    // Bounded: a shutdown that hangs is worse than one that escalates to
    // SIGKILL, because the user is left with no way to reclaim the browser.
    const driver = new EngineDriver();
    await withTimeout(
      driver.connectExisting(wsUrl),
      WS_CONNECT_TIMEOUT_MS,
      `CDP attach to shut down browser server at ${state.cdpUrl ?? wsUrl}`,
    );
    if (state.ownsBrowser) {
      await withTimeout(driver.close(), WS_CONNECT_TIMEOUT_MS, 'browser shutdown');
    } else {
      await withTimeout(driver.disconnect(), WS_CONNECT_TIMEOUT_MS, 'browser detach');
    }

    // Clean up state file
    await unlink(stateFile);

    // Optionally clean up profile dir
    // await rm(profileDir, { recursive: true, force: true });

    return true;
  } catch (error) {
    // CDP connect failed or timed out — Chrome may be a zombie. The user asked
    // to stop it, so escalating to SIGKILL is the right call here (unlike the
    // read-only liveness check, which must never kill on a failed probe).
    lastStopFailure = error instanceof Error ? error.message : String(error);
    try {
      const content = await readFile(stateFile, 'utf-8');
      const state = JSON.parse(content);
      if (state.chromePid) {
        process.kill(state.chromePid, 'SIGKILL');
      }
    } catch { /* PID already dead or state unreadable */ }
    await cleanupServerState(outputDir);
    return false;
  }
}

/**
 * Persistent session that connects to browser server
 */
export class PersistentSession {
  public readonly driver: EngineDriver;
  private page: CompatPage;
  private state: SessionState;
  private sessionDir: string;
  private outputDir: string;

  private constructor(
    driver: EngineDriver,
    page: CompatPage,
    state: SessionState,
    sessionDir: string,
    outputDir: string
  ) {
    this.driver = driver;
    this.page = page;
    this.state = state;
    this.sessionDir = sessionDir;
    this.outputDir = outputDir;
  }

  /**
   * Create a new session using the browser server
   */
  static async create(
    outputDir: string,
    options: SessionOptions
  ): Promise<PersistentSession> {
    const {
      url,
      name,
      viewport = VIEWPORTS.desktop,
      waitFor,
      timeout = 30000,
      strategyKey = 'chrome:local',
    } = options;

    const priorWall = await findPendingHardWall(outputDir, url, strategyKey);
    if (priorWall) {
      throw new UserActionRequiredError(priorWall, true);
    }

    // Connect to browser server
    const driver = await connectToBrowserServer(outputDir);
    if (!driver) {
      const why = lastBrowserServerFailure();
      throw new Error(
        'No browser server running.\n' +
        (why ? `Reason: ${why}\n` : '') +
        'Start one with: npx ibr session:start <url>\n' +
        'The first session:start launches the server and keeps it alive.'
      );
    }

    // Generate session ID
    const sessionId = `live_${nanoid(10)}`;
    const sessionsDir = join(outputDir, 'sessions');
    const sessionDir = join(sessionsDir, sessionId);
    await mkdir(sessionDir, { recursive: true });

    // Apply full device profile (metrics + UA + touch) so a session
    // started with --device or --viewport mobile actually renders as
    // mobile, not the pre-1.1.0 silently-desktop behavior.
    await driver.emulationDomain.applyDeviceProfile(viewportToConfig(viewport));

    // Enable reduced motion via emulation domain
    await driver.emulationDomain.setReducedMotion(true);

    // Create CompatPage and navigate
    const page = new CompatPage(driver);

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
    const targetId = driver.pageTargetId;
    if (!targetId) {
      throw new Error('Browser session started without a page target.');
    }
    const currentUrl = page.url();
    const hardWall = await inspectSessionHardWall(page, url, strategyKey);

    // Initialize state
    const state: SessionState = {
      id: sessionId,
      url,
      currentUrl,
      targetId,
      strategyKey,
      ...(hardWall ? { hardWall } : {}),
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

    return new PersistentSession(driver, page, state, sessionDir, outputDir);
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

    // Load session state
    const content = await readFile(statePath, 'utf-8');
    const state = JSON.parse(content) as SessionState;
    if (!state.targetId) {
      throw new Error(
        'This session predates safe target reattachment. Start a new session once; IBR will not navigate the old URL automatically.',
      );
    }

    // Reattach to the original page target. This is intentionally not a
    // navigation: reads, captures, and scans must not request the URL again.
    const driver = await connectToBrowserServer(outputDir, state.targetId);
    if (!driver) {
      // `null` here means "no such session", and the record on disk proves
      // otherwise. Reporting a live record as missing sends the reader to check
      // the session id when the browser is the thing that failed — the same
      // failed-measurement-as-fact mistake this whole change is about.
      const why = lastBrowserServerFailure();
      throw new Error(
        `Session ${sessionId} exists on disk but its browser could not be attached.\n`
        + (why ? `Reason: ${why}\n` : '')
        + 'The browser server is gone or unresponsive. Close it and start again:\n'
        + '  npx ibr session:close all\n'
        + '  npx ibr session:start <url>',
      );
    }

    const page = new CompatPage(driver);

    // Re-apply the device profile so a session reattach preserves the
    // original --device / --viewport mobile behavior.
    await driver.emulationDomain.applyDeviceProfile(viewportToConfig(state.viewport));

    state.currentUrl = page.url();
    const wall = await inspectSessionHardWall(page, state.url, state.strategyKey);
    if (wall) {
      state.hardWall = wall;
    } else {
      delete state.hardWall;
    }
    await writeFile(statePath, JSON.stringify(state, null, 2));

    return new PersistentSession(driver, page, state, sessionDir, outputDir);
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

  get hardWall(): SessionHardWall | undefined {
    return this.state.hardWall;
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

  async click(selector: string, options?: { timeout?: number; force?: boolean }): Promise<void> {
    const start = Date.now();
    const timeout = options?.timeout || 5000;

    try {
      // Use locator API with visible filter - targets only visible elements
      // This is BETTER than waitForSelector which waits for first match to become visible
      const locator = this.page.locator(selector).filter({ visible: true }).first();
      await locator.click({ timeout, force: options?.force });
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
   * Choose an option in a <select>.
   *
   * A native select cannot be driven by click: its option list is painted by the
   * OS rather than the page, so there is no option node in the DOM to click. That
   * is why click and press both fail on one and this command exists.
   *
   * `by` picks the matching strategy. Default 'auto' tries value then label,
   * because a caller usually knows what the option SAYS, not what its value
   * attribute is.
   */
  async select(
    selector: string,
    option: string,
    options?: { timeout?: number; by?: 'auto' | 'value' | 'label' | 'index' },
  ): Promise<string[]> {
    const start = Date.now();
    const timeout = options?.timeout || 5000;
    const by = options?.by || 'auto';

    try {
      const locator = this.page.locator(selector).filter({ visible: true }).first();

      let chosen: string[] = [];
      if (by === 'index') {
        const index = Number.parseInt(option, 10);
        if (!Number.isInteger(index)) throw new Error(`--by index needs a number, got "${option}"`);
        chosen = await locator.selectOption({ index }, { timeout });
      } else if (by === 'value') {
        chosen = await locator.selectOption({ value: option }, { timeout });
      } else if (by === 'label') {
        chosen = await locator.selectOption({ label: option }, { timeout });
      } else {
        chosen = await locator.selectOption({ value: option }, { timeout });
        if (chosen.length === 0) {
          chosen = await locator.selectOption({ label: option }, { timeout });
        }
      }

      if (chosen.length === 0) {
        const available = await locator.listOptions();
        throw new Error(
          `No option matched "${option}" on ${selector}. ` +
          `Available: ${available.join(', ') || '(none)'}`,
        );
      }

      await this.recordAction({
        type: 'select',
        timestamp: new Date().toISOString(),
        params: { selector, option, by },
        success: true,
        duration: Date.now() - start,
      });
      return chosen;
    } catch (error) {
      await this.recordAction({
        type: 'select',
        timestamp: new Date().toISOString(),
        params: { selector, option, by },
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - start,
      });
      throw error;
    }
  }

  async type(selector: string, text: string, options?: { delay?: number; timeout?: number; submit?: boolean; waitAfter?: number; append?: boolean }): Promise<void> {
    const start = Date.now();
    const timeout = options?.timeout || 5000;

    try {
      // Use locator API with visible filter - auto-targets visible input
      const locator = this.page.locator(selector).filter({ visible: true }).first();

      // Clear existing content unless appending
      if (!options?.append) {
        await locator.fill('', { timeout });
      }

      if (options?.delay && options.delay > 0) {
        // Type character by character with delay
        if (options?.append) {
          await locator.focus({ timeout });
        }
        await locator.pressSequentially(text, { delay: options.delay, timeout });
      } else if (options?.append) {
        // Append mode: focus and type without clearing
        await locator.focus({ timeout });
        await locator.pressSequentially(text, { timeout });
      } else {
        // Fast fill (default)
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

  async screenshot(options?: { name?: string; fullPage?: boolean; selector?: string }): Promise<{ path: string; elements: EnhancedElement[]; audit: AuditResult }> {
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

      // Extract interactive elements for audit
      const elements = await extractInteractiveElements(this.page);

      // Analyze for issues (detect mobile by viewport width)
      const isMobile = this.state.viewport.width < 768;
      const audit = analyzeElements(elements, isMobile);

      // Store in session state
      this.state.elements = elements;
      this.state.audit = audit;
      await this.saveState();

      await this.recordAction({
        type: 'screenshot',
        timestamp: new Date().toISOString(),
        params: {
          name: screenshotName,
          path: outputPath,
          selector: options?.selector,
          elementsCount: elements.length,
          issuesCount: audit.issues.length,
        },
        success: true,
        duration: Date.now() - start,
      });

      return { path: outputPath, elements, audit };
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

  /**
   * Scroll the page or a specific container
   * @param direction - 'up', 'down', 'left', 'right'
   * @param amount - pixels to scroll (default: 500)
   * @param options - optional selector to scroll within a container
   */
  async scroll(
    direction: 'up' | 'down' | 'left' | 'right',
    amount: number = 500,
    options?: { selector?: string }
  ): Promise<{ x: number; y: number }> {
    const scrollMap = {
      up: { x: 0, y: -amount },
      down: { x: 0, y: amount },
      left: { x: -amount, y: 0 },
      right: { x: amount, y: 0 },
    };
    const { x, y } = scrollMap[direction];

    if (options?.selector) {
      // Scroll within a specific container (modal, sidebar, etc.)
      const position = await this.page.evaluate(
        `(function(sel, deltaX, deltaY) {
          var el = document.querySelector(sel);
          if (!el) throw new Error('Container not found: ' + sel);
          el.scrollBy(deltaX, deltaY);
          return { x: el.scrollLeft, y: el.scrollTop };
        })(${JSON.stringify(options.selector)}, ${x}, ${y})`
      ) as { x: number; y: number };

      return position;
    }

    // Default: scroll window
    const position = await this.page.evaluate(
      `(function(deltaX, deltaY) {
        window.scrollBy(deltaX, deltaY);
        return { x: window.scrollX, y: window.scrollY };
      })(${x}, ${y})`
    ) as { x: number; y: number };

    return position;
  }

  async evaluate<T>(script: string | (() => T)): Promise<T> {
    return this.page.evaluate(script) as Promise<T>;
  }

  /**
   * Detect if a modal is currently open and how to dismiss it
   */
  async detectModal(): Promise<{
    hasModal: boolean;
    selector?: string;
    dismissMethod?: 'escape' | 'close-button' | 'backdrop';
    closeButtonSelector?: string;
  }> {
    return this.page.evaluate(() => {
      // Common modal selectors (Bootstrap, Radix, Headless UI, custom)
      const modalSelectors = [
        '[role="dialog"]',
        '[role="alertdialog"]',
        '[aria-modal="true"]',
        '.modal.show',
        '.modal.open',
        '.modal[style*="display: block"]',
        '[data-state="open"][data-modal]',
        '.fixed.inset-0', // Tailwind modal pattern
      ];

      for (const sel of modalSelectors) {
        const modal = document.querySelector(sel);
        if (modal && getComputedStyle(modal).display !== 'none') {
          // Check for close button
          const closeSelectors = [
            '[aria-label="Close"]',
            '[aria-label="close"]',
            '.close',
            '.btn-close',
            '[data-dismiss="modal"]',
            'button[type="button"]:has(svg)', // Icon-only close button
          ];

          let closeButtonSelector: string | undefined;
          for (const closeSel of closeSelectors) {
            const closeBtn = modal.querySelector(closeSel);
            if (closeBtn) {
              closeButtonSelector = `${sel} ${closeSel}`;
              break;
            }
          }

          return {
            hasModal: true,
            selector: sel,
            dismissMethod: closeButtonSelector ? 'close-button' : 'escape',
            closeButtonSelector,
          };
        }
      }

      return { hasModal: false };
    });
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

  // ============================================================================
  // SCAN + CAPTURE
  // ============================================================================

  private consoleErrors: string[] = [];
  private consoleWarnings: string[] = [];
  private stepCounter = 0;
  private consoleListenerAttached = false;

  /**
   * Ensure console listener is attached (lazy — attaches on first scan/capture)
   */
  private attachConsoleListener(): void {
    if (this.consoleListenerAttached) return;
    this.page.on('console', msg => {
      if (msg.type() === 'error') this.consoleErrors.push(msg.text());
      else if (msg.type() === 'warning') this.consoleWarnings.push(msg.text());
    });
    this.consoleListenerAttached = true;
  }

  /**
   * Run a full IBR scan against the current page state.
   * No new browser — uses the session's live page directly.
   */
  async scanPage(): Promise<ScanResult> {
    this.attachConsoleListener();
    const start = Date.now();
    const errorsSnapshot = [...this.consoleErrors];
    const warningsSnapshot = [...this.consoleWarnings];

    try {
      const [elements, interactivity, semantic] = await Promise.all([
        extractAndAudit(this.page, this.state.viewport),
        testInteractivity(this.page),
        getSemanticOutput(this.page),
      ]);

      const issues = aggregateIssues(elements.audit, interactivity, semantic, errorsSnapshot);
      const designSystem = await applyDesignSystemCheck(
        elements.all,
        issues,
        this.state.viewport,
        this.url,
        this.outputDir
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
        console: { errors: errorsSnapshot, warnings: warningsSnapshot },
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
   * @param options.keep - If true, screenshot retained after session close. Default: false.
   * @param options.label - Human-readable label for this step.
   * @param options.fullPage - Full page screenshot. Default: true.
   */
  async capture(options?: {
    keep?: boolean;
    label?: string;
    fullPage?: boolean;
  }): Promise<StepCapture> {
    this.attachConsoleListener();
    const start = Date.now();
    const keep = options?.keep ?? false;
    const label = options?.label || '';

    this.stepCounter++;
    const stepNum = this.stepCounter;
    const stepLabel = label || `step-${String(stepNum).padStart(3, '0')}`;
    const screenshotFile = `${stepLabel}.png`;
    const screenshotPath = join(this.sessionDir, screenshotFile);

    try {
      // Disable animations
      await this.page.addStyleTag({
        content: `*, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }`,
      });

      // Run screenshot + scan in parallel
      const errorsSnapshot = [...this.consoleErrors];
      const warningsSnapshot = [...this.consoleWarnings];

      const [, elements, interactivity, semantic] = await Promise.all([
        this.page.screenshot({
          path: screenshotPath,
          fullPage: options?.fullPage ?? true,
          type: 'png',
        }),
        extractAndAudit(this.page, this.state.viewport),
        testInteractivity(this.page),
        getSemanticOutput(this.page),
      ]);

      const issues = aggregateIssues(elements.audit, interactivity, semantic, errorsSnapshot);
      const designSystem = await applyDesignSystemCheck(
        elements.all,
        issues,
        this.state.viewport,
        this.url,
        this.outputDir
      );
      const verdict = determineVerdict(issues);
      const summary = generateSummary(elements, interactivity, semantic, issues, errorsSnapshot);

      let route: string;
      try {
        route = new URL(this.url).pathname;
      } catch {
        route = this.url;
      }

      const scanResult: ScanResult = {
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

      const stepCapture: StepCapture = {
        step: stepNum,
        action: label || this.lastActionLabel(),
        screenshot: screenshotFile,
        scan: scanResult,
        keep,
        timestamp: new Date().toISOString(),
      };

      if (!this.state.captures) this.state.captures = [];
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

  private lastActionLabel(): string {
    const last = this.state.actions[this.state.actions.length - 1];
    if (!last) return 'unknown';
    const params = last.params;
    if (last.type === 'click') return `click-${String(params.selector || '').slice(0, 30)}`;
    if (last.type === 'type') return `type-${String(params.selector || '').slice(0, 30)}`;
    if (last.type === 'navigate') return 'navigate';
    if (last.type === 'wait') return `wait-${String(params.target || '').slice(0, 30)}`;
    return last.type;
  }

  /**
   * Close just this session (not the browser server)
   */
  async close(): Promise<void> {
    // Archive ephemeral screenshots
    if (this.state.captures && this.state.captures.length > 0) {
      const ephemeral = this.state.captures.filter(c => !c.keep);
      if (ephemeral.length > 0) {
        const archiveDir = join(this.sessionDir, 'archive');
        await mkdir(archiveDir, { recursive: true });
        const { rename } = await import('fs/promises');
        for (const cap of ephemeral) {
          const src = join(this.sessionDir, cap.screenshot);
          const dest = join(archiveDir, cap.screenshot);
          try {
            if (existsSync(src)) {
              await rename(src, dest);
              cap.screenshot = `archive/${cap.screenshot}`;
            }
          } catch { /* non-fatal */ }
        }
        await this.saveState();
      }
    }
    await this.driver.close();
    // Clean up session state file so listActiveSessions() doesn't show stale entries
    const liveSessionPath = join(this.sessionDir, 'live-session.json');
    try {
      if (existsSync(liveSessionPath)) {
        await unlink(liveSessionPath);
      }
    } catch { /* non-fatal */ }
  }

  /**
   * Release the driver's WebSocket without terminating the shared browser or
   * the persisted session tab.
   *
   * Every one-shot CLI command (session:click, session:wait, session:scan,
   * session:screenshot, etc.) creates a new PersistentSession via get(), which
   * in turn reattaches to the persisted target and opens a new CDP WebSocket.
   * If we don't release it at the end of the command, the node process hangs
   * on the open socket.
   *
   * Safe to call multiple times; no-op if driver is already disconnected.
   */
  async disconnect(): Promise<void> {
    await this.driver.disconnect().catch(() => {});
  }

  /**
   * Get raw CompatPage (engine-backed page adapter)
   */
  getPage(): CompatPage {
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
