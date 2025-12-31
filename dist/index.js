'use strict';

var zod = require('zod');
var playwright = require('playwright');
var promises = require('fs/promises');
var path = require('path');
var os = require('os');
var crypto = require('crypto');
var pixelmatch = require('pixelmatch');
var pngjs = require('pngjs');
var nanoid = require('nanoid');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var pixelmatch__default = /*#__PURE__*/_interopDefault(pixelmatch);

// src/schemas.ts
var ViewportSchema = zod.z.object({
  name: zod.z.string().min(1).max(50),
  width: zod.z.number().min(320).max(3840),
  height: zod.z.number().min(480).max(2160)
});
var VIEWPORTS = {
  desktop: { name: "desktop", width: 1920, height: 1080 },
  "desktop-lg": { name: "desktop-lg", width: 2560, height: 1440 },
  "desktop-sm": { name: "desktop-sm", width: 1440, height: 900 },
  laptop: { name: "laptop", width: 1366, height: 768 },
  tablet: { name: "tablet", width: 768, height: 1024 },
  "tablet-landscape": { name: "tablet-landscape", width: 1024, height: 768 },
  mobile: { name: "mobile", width: 375, height: 667 },
  "mobile-lg": { name: "mobile-lg", width: 414, height: 896 },
  "iphone-14": { name: "iphone-14", width: 390, height: 844 },
  "iphone-14-pro-max": { name: "iphone-14-pro-max", width: 430, height: 932 }
};
var ConfigSchema = zod.z.object({
  baseUrl: zod.z.string().url("Must be a valid URL"),
  outputDir: zod.z.string().default("./.ibr"),
  viewport: ViewportSchema.default(VIEWPORTS.desktop),
  viewports: zod.z.array(ViewportSchema).optional(),
  // Multi-viewport support
  threshold: zod.z.number().min(0).max(100).default(1),
  fullPage: zod.z.boolean().default(true),
  waitForNetworkIdle: zod.z.boolean().default(true),
  timeout: zod.z.number().min(1e3).max(12e4).default(3e4)
});
var SessionQuerySchema = zod.z.object({
  route: zod.z.string().optional(),
  url: zod.z.string().optional(),
  status: zod.z.enum(["baseline", "compared", "pending"]).optional(),
  name: zod.z.string().optional(),
  createdAfter: zod.z.date().optional(),
  createdBefore: zod.z.date().optional(),
  viewport: zod.z.string().optional(),
  limit: zod.z.number().min(1).max(100).default(50)
});
var ComparisonResultSchema = zod.z.object({
  match: zod.z.boolean(),
  diffPercent: zod.z.number(),
  diffPixels: zod.z.number(),
  totalPixels: zod.z.number(),
  threshold: zod.z.number()
});
var ChangedRegionSchema = zod.z.object({
  location: zod.z.enum(["top", "bottom", "left", "right", "center", "full"]),
  bounds: zod.z.object({
    x: zod.z.number(),
    y: zod.z.number(),
    width: zod.z.number(),
    height: zod.z.number()
  }),
  description: zod.z.string(),
  severity: zod.z.enum(["expected", "unexpected", "critical"])
});
var VerdictSchema = zod.z.enum([
  "MATCH",
  "EXPECTED_CHANGE",
  "UNEXPECTED_CHANGE",
  "LAYOUT_BROKEN"
]);
var AnalysisSchema = zod.z.object({
  verdict: VerdictSchema,
  summary: zod.z.string(),
  changedRegions: zod.z.array(ChangedRegionSchema),
  unexpectedChanges: zod.z.array(ChangedRegionSchema),
  recommendation: zod.z.string().nullable()
});
var SessionStatusSchema = zod.z.enum(["baseline", "compared", "pending"]);
var SessionSchema = zod.z.object({
  id: zod.z.string(),
  name: zod.z.string(),
  url: zod.z.string().url(),
  viewport: ViewportSchema,
  status: SessionStatusSchema,
  createdAt: zod.z.string().datetime(),
  updatedAt: zod.z.string().datetime(),
  comparison: ComparisonResultSchema.optional(),
  analysis: AnalysisSchema.optional()
});
var ComparisonReportSchema = zod.z.object({
  sessionId: zod.z.string(),
  sessionName: zod.z.string(),
  url: zod.z.string(),
  timestamp: zod.z.string().datetime(),
  viewport: ViewportSchema,
  comparison: ComparisonResultSchema,
  analysis: AnalysisSchema,
  files: zod.z.object({
    baseline: zod.z.string(),
    current: zod.z.string(),
    diff: zod.z.string()
  }),
  webViewUrl: zod.z.string().optional()
});
function isDeployedEnvironment() {
  return !!(process.env.VERCEL || process.env.NETLIFY || process.env.CI || process.env.GITHUB_ACTIONS || process.env.GITLAB_CI || process.env.CIRCLECI || process.env.JENKINS_URL || process.env.TRAVIS || process.env.HEROKU || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AZURE_FUNCTIONS_ENVIRONMENT);
}
function getAuthStatePath(outputDir) {
  const username = os.userInfo().username;
  return path.join(outputDir, `auth.${username}.json`);
}
async function loadAuthState(outputDir) {
  if (isDeployedEnvironment()) {
    console.warn("\u26A0\uFE0F  Deployed environment detected. Auth state not available.");
    return null;
  }
  try {
    const authPath = getAuthStatePath(outputDir);
    const content = await promises.readFile(authPath, "utf-8");
    const stored = JSON.parse(content);
    if (!stored.metadata) {
      console.warn("\u26A0\uFE0F  Legacy auth format detected. Please re-authenticate with `ibr login`.");
      return null;
    }
    const currentUser = os.userInfo().username;
    if (stored.metadata.username !== currentUser) {
      console.warn(`\u26A0\uFE0F  Auth state belongs to different user (${stored.metadata.username}).`);
      return null;
    }
    if (Date.now() > stored.metadata.expiresAt) {
      console.warn("\u26A0\uFE0F  Auth state expired. Please re-authenticate with `ibr login`.");
      await clearAuthState(outputDir);
      return null;
    }
    const ageHours = (Date.now() - stored.metadata.createdAt) / (1e3 * 60 * 60);
    if (ageHours > 24) {
      console.warn(`\u26A0\uFE0F  Auth state is ${Math.floor(ageHours)} hours old. Consider re-authenticating.`);
    }
    return stored.state;
  } catch {
    return null;
  }
}
async function clearAuthState(outputDir) {
  const authPath = getAuthStatePath(outputDir);
  try {
    const stats = await promises.stat(authPath);
    const randomData = crypto.randomBytes(stats.size);
    await promises.writeFile(authPath, randomData, { mode: 384 });
    await promises.unlink(authPath);
    console.log("\u2705 Auth state securely cleared");
  } catch {
    console.log("\u2139\uFE0F  No auth state to clear");
  }
}

// src/capture.ts
var browser = null;
async function getBrowser() {
  if (!browser) {
    browser = await playwright.chromium.launch({
      headless: true
    });
  }
  return browser;
}
async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
async function captureScreenshot(options) {
  const {
    url,
    outputPath,
    viewport = VIEWPORTS.desktop,
    fullPage = true,
    waitForNetworkIdle = true,
    timeout = 3e4,
    outputDir
  } = options;
  await promises.mkdir(path.dirname(outputPath), { recursive: true });
  let storageState;
  if (outputDir && !isDeployedEnvironment()) {
    const authState = await loadAuthState(outputDir);
    if (authState) {
      storageState = authState;
      console.log("\u{1F510} Using saved authentication state");
    }
  }
  const browserInstance = await getBrowser();
  const context = await browserInstance.newContext({
    viewport: {
      width: viewport.width,
      height: viewport.height
    },
    // Disable animations for consistent screenshots
    reducedMotion: "reduce",
    // Load auth state if available (Playwright accepts object or file path)
    ...storageState ? { storageState } : {}
  });
  const page = await context.newPage();
  try {
    await page.goto(url, {
      waitUntil: waitForNetworkIdle ? "networkidle" : "load",
      timeout
    });
    await page.waitForTimeout(500);
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `
    });
    await page.screenshot({
      path: outputPath,
      fullPage,
      type: "png"
    });
    return outputPath;
  } finally {
    await context.close();
  }
}
function getViewport(name) {
  return VIEWPORTS[name];
}
async function compareImages(options) {
  const {
    baselinePath,
    currentPath,
    diffPath,
    threshold = 0.1
    // pixelmatch threshold (0-1), lower = stricter
  } = options;
  const [baselineBuffer, currentBuffer] = await Promise.all([
    promises.readFile(baselinePath),
    promises.readFile(currentPath)
  ]);
  const baseline = pngjs.PNG.sync.read(baselineBuffer);
  const current = pngjs.PNG.sync.read(currentBuffer);
  if (baseline.width !== current.width || baseline.height !== current.height) {
    throw new Error(
      `Image dimensions mismatch: baseline (${baseline.width}x${baseline.height}) vs current (${current.width}x${current.height})`
    );
  }
  const { width, height } = baseline;
  const diff = new pngjs.PNG({ width, height });
  const totalPixels = width * height;
  const diffPixels = pixelmatch__default.default(
    baseline.data,
    current.data,
    diff.data,
    width,
    height,
    {
      threshold,
      includeAA: false,
      // Ignore anti-aliasing differences
      alpha: 0.1,
      diffColor: [255, 0, 0],
      // Red for differences
      diffColorAlt: [0, 255, 0]
      // Green for anti-aliased differences
    }
  );
  await promises.mkdir(path.dirname(diffPath), { recursive: true });
  await promises.writeFile(diffPath, pngjs.PNG.sync.write(diff));
  const diffPercent = diffPixels / totalPixels * 100;
  return {
    match: diffPixels === 0,
    diffPercent: Math.round(diffPercent * 100) / 100,
    // Round to 2 decimal places
    diffPixels,
    totalPixels,
    threshold
  };
}
function analyzeComparison(result, thresholdPercent = 1) {
  const { match, diffPercent, diffPixels } = result;
  let verdict;
  let summary;
  let recommendation = null;
  if (match || diffPercent === 0) {
    verdict = "MATCH";
    summary = "No visual changes detected. Screenshots are identical.";
  } else if (diffPercent <= thresholdPercent) {
    verdict = "EXPECTED_CHANGE";
    summary = `Minor changes detected (${diffPercent}% difference). Changes appear intentional.`;
  } else if (diffPercent <= 20) {
    verdict = "EXPECTED_CHANGE";
    summary = `Moderate changes detected (${diffPercent}% difference, ${diffPixels.toLocaleString()} pixels). Review the diff image to verify changes are as expected.`;
  } else if (diffPercent <= 50) {
    verdict = "UNEXPECTED_CHANGE";
    summary = `Significant changes detected (${diffPercent}% difference). Some changes may be unintentional.`;
    recommendation = "Review the diff image carefully. Large portions of the page have changed.";
  } else {
    verdict = "LAYOUT_BROKEN";
    summary = `Major changes detected (${diffPercent}% difference). Layout may be broken or page failed to load correctly.`;
    recommendation = "Check for JavaScript errors, missing assets, or layout issues. The page appears significantly different from the baseline.";
  }
  const changedRegions = [];
  const unexpectedChanges = [];
  if (!match) {
    const region = {
      location: diffPercent > 50 ? "full" : "center",
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      // Would need pixel analysis for accurate bounds
      description: `${diffPercent}% of pixels changed`,
      severity: verdict === "LAYOUT_BROKEN" ? "critical" : verdict === "UNEXPECTED_CHANGE" ? "unexpected" : "expected"
    };
    if (verdict === "UNEXPECTED_CHANGE" || verdict === "LAYOUT_BROKEN") {
      unexpectedChanges.push(region);
    } else {
      changedRegions.push(region);
    }
  }
  return {
    verdict,
    summary,
    changedRegions,
    unexpectedChanges,
    recommendation
  };
}
function getVerdictDescription(verdict) {
  switch (verdict) {
    case "MATCH":
      return "No changes - screenshots match";
    case "EXPECTED_CHANGE":
      return "Changes detected - appear intentional";
    case "UNEXPECTED_CHANGE":
      return "Unexpected changes - review required";
    case "LAYOUT_BROKEN":
      return "Layout broken - significant issues detected";
    default:
      return "Unknown verdict";
  }
}
var SESSION_PREFIX = "sess_";
function generateSessionId() {
  return `${SESSION_PREFIX}${nanoid.nanoid(10)}`;
}
function getSessionPaths(outputDir, sessionId) {
  const root = path.join(outputDir, "sessions", sessionId);
  return {
    root,
    sessionJson: path.join(root, "session.json"),
    baseline: path.join(root, "baseline.png"),
    current: path.join(root, "current.png"),
    diff: path.join(root, "diff.png")
  };
}
async function createSession(outputDir, url, name, viewport) {
  const sessionId = generateSessionId();
  const paths = getSessionPaths(outputDir, sessionId);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const session = {
    id: sessionId,
    name,
    url,
    viewport,
    status: "baseline",
    createdAt: now,
    updatedAt: now
  };
  await promises.mkdir(paths.root, { recursive: true });
  await promises.writeFile(paths.sessionJson, JSON.stringify(session, null, 2));
  return session;
}
async function getSession(outputDir, sessionId) {
  const paths = getSessionPaths(outputDir, sessionId);
  try {
    const content = await promises.readFile(paths.sessionJson, "utf-8");
    const data = JSON.parse(content);
    return SessionSchema.parse(data);
  } catch {
    return null;
  }
}
async function updateSession(outputDir, sessionId, updates) {
  const session = await getSession(outputDir, sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  const updated = {
    ...session,
    ...updates,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const paths = getSessionPaths(outputDir, sessionId);
  await promises.writeFile(paths.sessionJson, JSON.stringify(updated, null, 2));
  return updated;
}
async function markSessionCompared(outputDir, sessionId, comparison, analysis) {
  return updateSession(outputDir, sessionId, {
    status: "compared",
    comparison,
    analysis
  });
}
async function listSessions(outputDir) {
  const sessionsDir = path.join(outputDir, "sessions");
  try {
    const entries = await promises.readdir(sessionsDir, { withFileTypes: true });
    const sessions = [];
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith(SESSION_PREFIX)) {
        const session = await getSession(outputDir, entry.name);
        if (session) {
          sessions.push(session);
        }
      }
    }
    return sessions.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch {
    return [];
  }
}
async function getMostRecentSession(outputDir) {
  const sessions = await listSessions(outputDir);
  return sessions[0] || null;
}
async function deleteSession(outputDir, sessionId) {
  const paths = getSessionPaths(outputDir, sessionId);
  try {
    await promises.rm(paths.root, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}
function parseDuration(duration) {
  const match = duration.match(/^(\d+)(d|h|m|s)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}. Use format like '7d', '24h', '30m', '60s'`);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case "d":
      return value * 24 * 60 * 60 * 1e3;
    case "h":
      return value * 60 * 60 * 1e3;
    case "m":
      return value * 60 * 1e3;
    case "s":
      return value * 1e3;
    default:
      return value * 1e3;
  }
}
async function cleanSessions(outputDir, options = {}) {
  const { olderThan, keepLast = 0, dryRun = false } = options;
  const sessions = await listSessions(outputDir);
  const deleted = [];
  const kept = [];
  const keepIds = new Set(sessions.slice(0, keepLast).map((s) => s.id));
  const cutoffTime = olderThan ? Date.now() - parseDuration(olderThan) : 0;
  for (const session of sessions) {
    const sessionTime = new Date(session.createdAt).getTime();
    const shouldDelete = !keepIds.has(session.id) && (olderThan ? sessionTime < cutoffTime : true);
    if (shouldDelete && !keepIds.has(session.id)) {
      if (!dryRun) {
        await deleteSession(outputDir, session.id);
      }
      deleted.push(session.id);
    } else {
      kept.push(session.id);
    }
  }
  return { deleted, kept };
}
async function findSessions(outputDir, query = {}) {
  const validatedQuery = SessionQuerySchema.parse({
    limit: 50,
    ...query
  });
  const allSessions = await listSessions(outputDir);
  let filtered = allSessions;
  if (validatedQuery.route) {
    const routePattern = validatedQuery.route.toLowerCase();
    filtered = filtered.filter((s) => {
      try {
        const urlPath = new URL(s.url).pathname.toLowerCase();
        return urlPath.includes(routePattern) || urlPath === routePattern;
      } catch {
        return s.url.toLowerCase().includes(routePattern);
      }
    });
  }
  if (validatedQuery.url) {
    const urlPattern = validatedQuery.url.toLowerCase();
    filtered = filtered.filter((s) => s.url.toLowerCase().includes(urlPattern));
  }
  if (validatedQuery.status) {
    filtered = filtered.filter((s) => s.status === validatedQuery.status);
  }
  if (validatedQuery.name) {
    const namePattern = validatedQuery.name.toLowerCase();
    filtered = filtered.filter((s) => s.name.toLowerCase().includes(namePattern));
  }
  if (validatedQuery.viewport) {
    const viewportPattern = validatedQuery.viewport.toLowerCase();
    filtered = filtered.filter((s) => s.viewport.name.toLowerCase() === viewportPattern);
  }
  if (validatedQuery.createdAfter) {
    const afterTime = validatedQuery.createdAfter.getTime();
    filtered = filtered.filter((s) => new Date(s.createdAt).getTime() >= afterTime);
  }
  if (validatedQuery.createdBefore) {
    const beforeTime = validatedQuery.createdBefore.getTime();
    filtered = filtered.filter((s) => new Date(s.createdAt).getTime() <= beforeTime);
  }
  return filtered.slice(0, validatedQuery.limit);
}
async function getTimeline(outputDir, route, limit = 10) {
  const sessions = await findSessions(outputDir, { route, limit });
  return sessions.reverse();
}
async function getSessionsByRoute(outputDir) {
  const allSessions = await listSessions(outputDir);
  const byRoute = {};
  for (const session of allSessions) {
    let route;
    try {
      route = new URL(session.url).pathname;
    } catch {
      route = session.url;
    }
    if (!byRoute[route]) {
      byRoute[route] = [];
    }
    byRoute[route].push(session);
  }
  return byRoute;
}
async function getSessionStats(outputDir) {
  const sessions = await listSessions(outputDir);
  const byStatus = {};
  const byViewport = {};
  const byVerdict = {};
  for (const session of sessions) {
    byStatus[session.status] = (byStatus[session.status] || 0) + 1;
    const viewportName = session.viewport.name;
    byViewport[viewportName] = (byViewport[viewportName] || 0) + 1;
    if (session.analysis?.verdict) {
      byVerdict[session.analysis.verdict] = (byVerdict[session.analysis.verdict] || 0) + 1;
    }
  }
  return {
    total: sessions.length,
    byStatus,
    byViewport,
    byVerdict
  };
}

// src/report.ts
function generateReport(session, comparison, analysis, outputDir, webViewPort) {
  const paths = getSessionPaths(outputDir, session.id);
  const report = {
    sessionId: session.id,
    sessionName: session.name,
    url: session.url,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    viewport: session.viewport,
    comparison,
    analysis,
    files: {
      baseline: paths.baseline,
      current: paths.current,
      diff: paths.diff
    }
  };
  if (webViewPort) {
    report.webViewUrl = `http://localhost:${webViewPort}/sessions/${session.id}`;
  }
  return report;
}
function formatReportText(report) {
  const lines = [];
  lines.push(`Session: ${report.sessionName} (${report.sessionId})`);
  lines.push(`URL: ${report.url}`);
  lines.push(`Viewport: ${report.viewport.name} (${report.viewport.width}x${report.viewport.height})`);
  lines.push("");
  lines.push("Comparison Results:");
  lines.push(`  Match: ${report.comparison.match ? "Yes" : "No"}`);
  lines.push(`  Diff: ${report.comparison.diffPercent}% (${report.comparison.diffPixels.toLocaleString()} pixels)`);
  lines.push(`  Threshold: ${report.comparison.threshold}%`);
  lines.push("");
  lines.push(`Verdict: ${report.analysis.verdict}`);
  lines.push(`  ${getVerdictDescription(report.analysis.verdict)}`);
  lines.push("");
  lines.push(`Summary: ${report.analysis.summary}`);
  if (report.analysis.recommendation) {
    lines.push("");
    lines.push(`Recommendation: ${report.analysis.recommendation}`);
  }
  if (report.analysis.unexpectedChanges.length > 0) {
    lines.push("");
    lines.push("Unexpected Changes:");
    for (const change of report.analysis.unexpectedChanges) {
      lines.push(`  - ${change.location}: ${change.description}`);
    }
  }
  lines.push("");
  lines.push("Files:");
  lines.push(`  Baseline: ${report.files.baseline}`);
  lines.push(`  Current: ${report.files.current}`);
  lines.push(`  Diff: ${report.files.diff}`);
  if (report.webViewUrl) {
    lines.push("");
    lines.push(`View in browser: ${report.webViewUrl}`);
  }
  return lines.join("\n");
}
function formatReportMinimal(report) {
  const status = report.comparison.match ? "PASS" : "FAIL";
  return `${status} ${report.sessionId} ${report.analysis.verdict} ${report.comparison.diffPercent}%`;
}
function formatReportJson(report) {
  return JSON.stringify(report, null, 2);
}
function formatSessionSummary(session) {
  const status = session.status.padEnd(8);
  const viewport = `${session.viewport.name}`.padEnd(8);
  const date = new Date(session.createdAt).toLocaleDateString();
  let diffInfo = "";
  if (session.comparison) {
    diffInfo = session.comparison.match ? " (no diff)" : ` (${session.comparison.diffPercent}% diff)`;
  }
  return `${session.id}  ${status}  ${viewport}  ${date}  ${session.name}${diffInfo}`;
}

// src/index.ts
var InterfaceBuiltRight = class {
  config;
  constructor(options = {}) {
    this.config = ConfigSchema.parse(options);
  }
  /**
   * Start a visual session by capturing a baseline screenshot
   */
  async startSession(path, options = {}) {
    const {
      name = this.generateSessionName(path),
      viewport = this.config.viewport,
      fullPage = this.config.fullPage
    } = options;
    const url = this.resolveUrl(path);
    const session = await createSession(this.config.outputDir, url, name, viewport);
    const paths = getSessionPaths(this.config.outputDir, session.id);
    await captureScreenshot({
      url,
      outputPath: paths.baseline,
      viewport,
      fullPage,
      waitForNetworkIdle: this.config.waitForNetworkIdle,
      timeout: this.config.timeout,
      outputDir: this.config.outputDir
    });
    return {
      sessionId: session.id,
      baseline: paths.baseline,
      session
    };
  }
  /**
   * Check current state against baseline
   */
  async check(sessionId) {
    const session = sessionId ? await getSession(this.config.outputDir, sessionId) : await getMostRecentSession(this.config.outputDir);
    if (!session) {
      throw new Error(sessionId ? `Session not found: ${sessionId}` : "No sessions found. Run startSession first.");
    }
    const paths = getSessionPaths(this.config.outputDir, session.id);
    await captureScreenshot({
      url: session.url,
      outputPath: paths.current,
      viewport: session.viewport,
      fullPage: this.config.fullPage,
      waitForNetworkIdle: this.config.waitForNetworkIdle,
      timeout: this.config.timeout,
      outputDir: this.config.outputDir
    });
    const comparison = await compareImages({
      baselinePath: paths.baseline,
      currentPath: paths.current,
      diffPath: paths.diff,
      threshold: this.config.threshold / 100
      // Convert percentage to 0-1 range for pixelmatch
    });
    const analysis = analyzeComparison(comparison, this.config.threshold);
    await markSessionCompared(this.config.outputDir, session.id, comparison, analysis);
    return generateReport(session, comparison, analysis, this.config.outputDir);
  }
  /**
   * Get a session by ID
   */
  async getSession(sessionId) {
    return getSession(this.config.outputDir, sessionId);
  }
  /**
   * Get the most recent session
   */
  async getMostRecentSession() {
    return getMostRecentSession(this.config.outputDir);
  }
  /**
   * List all sessions
   */
  async listSessions() {
    return listSessions(this.config.outputDir);
  }
  /**
   * Delete a session
   */
  async deleteSession(sessionId) {
    return deleteSession(this.config.outputDir, sessionId);
  }
  /**
   * Clean old sessions
   */
  async clean(options = {}) {
    return cleanSessions(this.config.outputDir, options);
  }
  /**
   * Find sessions matching query criteria
   */
  async find(query = {}) {
    return findSessions(this.config.outputDir, query);
  }
  /**
   * Get timeline of sessions for a specific route
   * Returns sessions in chronological order (oldest first)
   */
  async getTimeline(route, limit = 10) {
    return getTimeline(this.config.outputDir, route, limit);
  }
  /**
   * Get sessions grouped by route
   */
  async getSessionsByRoute() {
    return getSessionsByRoute(this.config.outputDir);
  }
  /**
   * Get session statistics
   */
  async getStats() {
    return getSessionStats(this.config.outputDir);
  }
  /**
   * Update baseline with current screenshot
   */
  async updateBaseline(sessionId) {
    const session = sessionId ? await getSession(this.config.outputDir, sessionId) : await getMostRecentSession(this.config.outputDir);
    if (!session) {
      throw new Error(sessionId ? `Session not found: ${sessionId}` : "No sessions found.");
    }
    const paths = getSessionPaths(this.config.outputDir, session.id);
    await captureScreenshot({
      url: session.url,
      outputPath: paths.baseline,
      viewport: session.viewport,
      fullPage: this.config.fullPage,
      waitForNetworkIdle: this.config.waitForNetworkIdle,
      timeout: this.config.timeout,
      outputDir: this.config.outputDir
    });
    return updateSession(this.config.outputDir, session.id, {
      status: "baseline",
      comparison: void 0,
      analysis: void 0
    });
  }
  /**
   * Close the browser instance
   */
  async close() {
    await closeBrowser();
  }
  /**
   * Get configuration
   */
  getConfig() {
    return { ...this.config };
  }
  /**
   * Resolve a path to full URL
   */
  resolveUrl(path) {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }
    return `${this.config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  }
  /**
   * Generate a session name from path
   */
  generateSessionName(path) {
    return path.replace(/^\/+/, "").replace(/\//g, "-").replace(/[^a-zA-Z0-9-_]/g, "") || "homepage";
  }
};

exports.AnalysisSchema = AnalysisSchema;
exports.ChangedRegionSchema = ChangedRegionSchema;
exports.ComparisonReportSchema = ComparisonReportSchema;
exports.ComparisonResultSchema = ComparisonResultSchema;
exports.ConfigSchema = ConfigSchema;
exports.InterfaceBuiltRight = InterfaceBuiltRight;
exports.SessionQuerySchema = SessionQuerySchema;
exports.SessionSchema = SessionSchema;
exports.SessionStatusSchema = SessionStatusSchema;
exports.VIEWPORTS = VIEWPORTS;
exports.VerdictSchema = VerdictSchema;
exports.ViewportSchema = ViewportSchema;
exports.analyzeComparison = analyzeComparison;
exports.captureScreenshot = captureScreenshot;
exports.cleanSessions = cleanSessions;
exports.closeBrowser = closeBrowser;
exports.compareImages = compareImages;
exports.createSession = createSession;
exports.deleteSession = deleteSession;
exports.findSessions = findSessions;
exports.formatReportJson = formatReportJson;
exports.formatReportMinimal = formatReportMinimal;
exports.formatReportText = formatReportText;
exports.formatSessionSummary = formatSessionSummary;
exports.generateReport = generateReport;
exports.generateSessionId = generateSessionId;
exports.getMostRecentSession = getMostRecentSession;
exports.getSession = getSession;
exports.getSessionPaths = getSessionPaths;
exports.getSessionStats = getSessionStats;
exports.getSessionsByRoute = getSessionsByRoute;
exports.getTimeline = getTimeline;
exports.getVerdictDescription = getVerdictDescription;
exports.getViewport = getViewport;
exports.listSessions = listSessions;
exports.markSessionCompared = markSessionCompared;
exports.updateSession = updateSession;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map