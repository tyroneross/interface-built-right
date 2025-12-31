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
var url = require('url');

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
async function captureWithDiagnostics(options) {
  const {
    url,
    outputPath,
    viewport = VIEWPORTS.desktop,
    fullPage = true,
    waitForNetworkIdle = true,
    timeout = 3e4,
    outputDir
  } = options;
  const startTime = Date.now();
  let navigationTime = 0;
  let renderTime = 0;
  const consoleErrors = [];
  const networkErrors = [];
  const suggestions = [];
  let httpStatus;
  try {
    await promises.mkdir(path.dirname(outputPath), { recursive: true });
    let storageState;
    if (outputDir && !isDeployedEnvironment()) {
      const authState = await loadAuthState(outputDir);
      if (authState) {
        storageState = authState;
      }
    }
    const browserInstance = await getBrowser();
    const context = await browserInstance.newContext({
      viewport: {
        width: viewport.width,
        height: viewport.height
      },
      reducedMotion: "reduce",
      ...storageState ? { storageState } : {}
    });
    const page = await context.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("requestfailed", (request) => {
      const failure = request.failure();
      networkErrors.push(`${request.url()}: ${failure?.errorText || "failed"}`);
    });
    page.on("response", (response) => {
      if (response.url() === url || response.url() === url + "/") {
        httpStatus = response.status();
      }
    });
    try {
      const navStart = Date.now();
      await page.goto(url, {
        waitUntil: waitForNetworkIdle ? "networkidle" : "load",
        timeout
      });
      navigationTime = Date.now() - navStart;
    } catch (navError) {
      await context.close();
      const errorMsg = navError instanceof Error ? navError.message : String(navError);
      const isTimeout = errorMsg.includes("Timeout");
      if (isTimeout) {
        suggestions.push(`Page took longer than ${timeout}ms to load`);
        suggestions.push("Try increasing timeout: --timeout 60000");
        if (waitForNetworkIdle) {
          suggestions.push('Try disabling network idle wait: use "load" instead of "networkidle"');
        }
      }
      if (networkErrors.length > 0) {
        suggestions.push(`${networkErrors.length} network request(s) failed`);
      }
      if (httpStatus && httpStatus >= 400) {
        suggestions.push(`Server returned HTTP ${httpStatus}`);
      }
      return {
        success: false,
        timing: {
          navigationMs: Date.now() - startTime,
          renderMs: 0,
          totalMs: Date.now() - startTime
        },
        diagnostics: {
          httpStatus,
          consoleErrors,
          networkErrors,
          suggestions
        },
        error: {
          type: isTimeout ? "timeout" : "navigation",
          message: errorMsg,
          suggestion: isTimeout ? `Increase timeout or check if ${url} is responding` : `Check if the server is running at ${url}`
        }
      };
    }
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
    const renderStart = Date.now();
    await page.screenshot({
      path: outputPath,
      fullPage,
      type: "png"
    });
    renderTime = Date.now() - renderStart;
    await context.close();
    if (navigationTime > 5e3) {
      suggestions.push(`Slow page load: ${(navigationTime / 1e3).toFixed(1)}s`);
    }
    if (consoleErrors.length > 0) {
      suggestions.push(`${consoleErrors.length} JavaScript error(s) detected`);
    }
    return {
      success: true,
      outputPath,
      timing: {
        navigationMs: navigationTime,
        renderMs: renderTime,
        totalMs: Date.now() - startTime
      },
      diagnostics: {
        httpStatus,
        consoleErrors,
        networkErrors,
        suggestions
      }
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      timing: {
        navigationMs: navigationTime,
        renderMs: renderTime,
        totalMs: Date.now() - startTime
      },
      diagnostics: {
        httpStatus,
        consoleErrors,
        networkErrors,
        suggestions
      },
      error: {
        type: "unknown",
        message: errorMsg,
        suggestion: "Check browser installation: npx playwright install chromium"
      }
    };
  }
}
var DEFAULT_REGIONS = [
  { name: "header", location: "top", xStart: 0, xEnd: 1, yStart: 0, yEnd: 0.1 },
  { name: "navigation", location: "left", xStart: 0, xEnd: 0.2, yStart: 0.1, yEnd: 0.9 },
  { name: "content", location: "center", xStart: 0.2, xEnd: 1, yStart: 0.1, yEnd: 0.9 },
  { name: "footer", location: "bottom", xStart: 0, xEnd: 1, yStart: 0.9, yEnd: 1 }
];
function detectChangedRegions(diffData, width, height, regions = DEFAULT_REGIONS) {
  const changedRegions = [];
  for (const region of regions) {
    const xStart = Math.floor(region.xStart * width);
    const xEnd = Math.floor(region.xEnd * width);
    const yStart = Math.floor(region.yStart * height);
    const yEnd = Math.floor(region.yEnd * height);
    const regionWidth = xEnd - xStart;
    const regionHeight = yEnd - yStart;
    const regionPixels = regionWidth * regionHeight;
    if (regionPixels === 0) continue;
    let diffPixels = 0;
    for (let y = yStart; y < yEnd; y++) {
      for (let x = xStart; x < xEnd; x++) {
        const idx = (y * width + x) * 4;
        if (diffData[idx] === 255 && diffData[idx + 1] === 0 && diffData[idx + 2] === 0) {
          diffPixels++;
        }
      }
    }
    const diffPercent = diffPixels / regionPixels * 100;
    if (diffPercent > 0.1) {
      const severity = diffPercent > 30 ? "critical" : diffPercent > 10 ? "unexpected" : "expected";
      changedRegions.push({
        location: region.location,
        bounds: {
          x: xStart,
          y: yStart,
          width: regionWidth,
          height: regionHeight
        },
        description: `${region.name}: ${diffPercent.toFixed(1)}% changed`,
        severity
      });
    }
  }
  return changedRegions.sort((a, b) => {
    const severityOrder = { critical: 0, unexpected: 1, expected: 2 };
    const aSev = severityOrder[a.severity];
    const bSev = severityOrder[b.severity];
    if (aSev !== bSev) return aSev - bSev;
    const aPercent = parseFloat(a.description.match(/(\d+\.?\d*)%/)?.[1] || "0");
    const bPercent = parseFloat(b.description.match(/(\d+\.?\d*)%/)?.[1] || "0");
    return bPercent - aPercent;
  });
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
    threshold,
    // Include diff data for regional analysis
    diffData: diff.data,
    width,
    height
  };
}
function analyzeComparison(result, thresholdPercent = 1) {
  const { match, diffPercent, diffData, width, height } = result;
  let detectedRegions = [];
  if (diffData && width && height && !match) {
    detectedRegions = detectChangedRegions(diffData, width, height);
  }
  const criticalRegions = detectedRegions.filter((r) => r.severity === "critical");
  const unexpectedRegions = detectedRegions.filter((r) => r.severity === "unexpected");
  const hasNavigationChanges = detectedRegions.some(
    (r) => r.description.toLowerCase().includes("navigation") || r.description.toLowerCase().includes("header")
  );
  let verdict;
  let summary;
  let recommendation = null;
  if (match || diffPercent === 0) {
    verdict = "MATCH";
    summary = "No visual changes detected. Screenshots are identical.";
  } else if (criticalRegions.length > 0) {
    verdict = "LAYOUT_BROKEN";
    const regionNames = criticalRegions.map(
      (r) => r.description.split(":")[0]
    ).join(", ");
    summary = `Critical changes in: ${regionNames}. Layout may be broken.`;
    recommendation = `Major changes detected in ${regionNames}. Check for missing elements, broken layout, or loading errors.`;
  } else if (unexpectedRegions.length > 0 || diffPercent > 20) {
    verdict = "UNEXPECTED_CHANGE";
    const regionNames = unexpectedRegions.length > 0 ? unexpectedRegions.map((r) => r.description.split(":")[0]).join(", ") : "multiple areas";
    summary = `Significant changes in: ${regionNames} (${diffPercent}% overall).`;
    recommendation = hasNavigationChanges ? "Navigation area changed - verify menu items and links are correct." : "Review changes carefully - some may be unintentional.";
  } else if (diffPercent <= thresholdPercent) {
    verdict = "EXPECTED_CHANGE";
    summary = `Minor changes detected (${diffPercent}%). Within acceptable threshold.`;
  } else {
    verdict = "EXPECTED_CHANGE";
    const regionNames = detectedRegions.length > 0 ? detectedRegions.map((r) => r.description.split(":")[0]).join(", ") : "content area";
    summary = `Changes in: ${regionNames} (${diffPercent}% overall). Changes appear intentional.`;
  }
  const changedRegions = detectedRegions.filter((r) => r.severity === "expected");
  const unexpectedChanges = detectedRegions.filter(
    (r) => r.severity === "unexpected" || r.severity === "critical"
  );
  if (detectedRegions.length === 0 && !match) {
    const fallbackRegion = {
      location: diffPercent > 50 ? "full" : "center",
      bounds: { x: 0, y: 0, width: width || 0, height: height || 0 },
      description: `overall: ${diffPercent}% changed`,
      severity: verdict === "LAYOUT_BROKEN" ? "critical" : verdict === "UNEXPECTED_CHANGE" ? "unexpected" : "expected"
    };
    if (verdict === "UNEXPECTED_CHANGE" || verdict === "LAYOUT_BROKEN") {
      unexpectedChanges.push(fallbackRegion);
    } else {
      changedRegions.push(fallbackRegion);
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
async function extractMetrics(page, url) {
  const parsedUrl = new URL(url);
  const metrics = await page.evaluate(() => {
    const getComputedStyleProp = (selector, prop) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      return window.getComputedStyle(el).getPropertyValue(prop) || null;
    };
    const getElementHeight = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      return el.getBoundingClientRect().height;
    };
    const getElementWidth = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      return el.getBoundingClientRect().width;
    };
    const headerSelectors = ["header", '[role="banner"]', ".header", "#header", "nav"];
    const navSelectors = ["nav", '[role="navigation"]', ".sidebar", ".nav", "#sidebar"];
    const mainSelectors = ["main", '[role="main"]', ".content", "#content", ".main"];
    const footerSelectors = ["footer", '[role="contentinfo"]', ".footer", "#footer"];
    const buttonSelectors = ["button", ".btn", '[role="button"]', "a.button"];
    const cardSelectors = [".card", '[class*="card"]', ".panel", ".box"];
    const findFirst = (selectors, fn) => {
      for (const sel of selectors) {
        const result = fn(sel);
        if (result !== null) return result;
      }
      return null;
    };
    const getContentPadding = () => {
      for (const sel of mainSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          const style = window.getComputedStyle(el);
          return {
            top: parseFloat(style.paddingTop) || 0,
            right: parseFloat(style.paddingRight) || 0,
            bottom: parseFloat(style.paddingBottom) || 0,
            left: parseFloat(style.paddingLeft) || 0
          };
        }
      }
      return null;
    };
    return {
      title: document.title,
      layout: {
        headerHeight: findFirst(headerSelectors, getElementHeight),
        navWidth: findFirst(navSelectors, getElementWidth),
        contentPadding: getContentPadding(),
        footerHeight: findFirst(footerSelectors, getElementHeight)
      },
      typography: {
        bodyFontFamily: getComputedStyleProp("body", "font-family"),
        bodyFontSize: getComputedStyleProp("body", "font-size"),
        headingFontFamily: getComputedStyleProp("h1, h2, h3", "font-family"),
        h1FontSize: getComputedStyleProp("h1", "font-size"),
        h2FontSize: getComputedStyleProp("h2", "font-size"),
        lineHeight: getComputedStyleProp("body", "line-height")
      },
      colors: {
        backgroundColor: getComputedStyleProp("body", "background-color"),
        textColor: getComputedStyleProp("body", "color"),
        linkColor: getComputedStyleProp("a", "color"),
        primaryButtonBg: findFirst(buttonSelectors, (s) => getComputedStyleProp(s, "background-color")),
        primaryButtonText: findFirst(buttonSelectors, (s) => getComputedStyleProp(s, "color"))
      },
      spacing: {
        buttonPadding: findFirst(buttonSelectors, (s) => getComputedStyleProp(s, "padding")),
        cardPadding: findFirst(cardSelectors, (s) => getComputedStyleProp(s, "padding")),
        sectionGap: getComputedStyleProp("main > *", "margin-bottom")
      }
    };
  });
  return {
    url,
    path: parsedUrl.pathname,
    ...metrics
  };
}
function findInconsistencies(pages, ignore = []) {
  const inconsistencies = [];
  const checkProperty = (type, property, getValue, description, severity = "warning") => {
    if (ignore.includes(type)) return;
    const values = pages.map((p) => ({
      path: p.path,
      value: getValue(p)
    }));
    const nonNullValues = values.filter((v) => v.value !== null);
    if (nonNullValues.length < 2) return;
    const uniqueValues = new Set(nonNullValues.map((v) => String(v.value)));
    if (uniqueValues.size > 1) {
      inconsistencies.push({
        type,
        property,
        severity,
        description,
        pages: values
      });
    }
  };
  checkProperty("layout", "headerHeight", (p) => p.layout.headerHeight, "Header height differs across pages");
  checkProperty("layout", "navWidth", (p) => p.layout.navWidth, "Navigation width differs across pages");
  checkProperty("layout", "footerHeight", (p) => p.layout.footerHeight, "Footer height differs across pages");
  checkProperty("typography", "bodyFontFamily", (p) => p.typography.bodyFontFamily, "Body font family differs across pages", "error");
  checkProperty("typography", "bodyFontSize", (p) => p.typography.bodyFontSize, "Body font size differs across pages");
  checkProperty("typography", "headingFontFamily", (p) => p.typography.headingFontFamily, "Heading font family differs across pages", "error");
  checkProperty("typography", "h1FontSize", (p) => p.typography.h1FontSize, "H1 font size differs across pages");
  checkProperty("typography", "lineHeight", (p) => p.typography.lineHeight, "Line height differs across pages");
  checkProperty("color", "backgroundColor", (p) => p.colors.backgroundColor, "Background color differs across pages");
  checkProperty("color", "textColor", (p) => p.colors.textColor, "Text color differs across pages", "error");
  checkProperty("color", "linkColor", (p) => p.colors.linkColor, "Link color differs across pages");
  checkProperty("color", "primaryButtonBg", (p) => p.colors.primaryButtonBg, "Primary button background differs across pages");
  checkProperty("spacing", "buttonPadding", (p) => p.spacing.buttonPadding, "Button padding differs across pages");
  checkProperty("spacing", "cardPadding", (p) => p.spacing.cardPadding, "Card padding differs across pages");
  return inconsistencies;
}
function calculateScore(inconsistencies) {
  if (inconsistencies.length === 0) return 100;
  const weights = { error: 10, warning: 5, info: 1 };
  const totalPenalty = inconsistencies.reduce((sum, i) => sum + weights[i.severity], 0);
  return Math.max(0, 100 - totalPenalty);
}
async function checkConsistency(options) {
  const { urls, timeout = 15e3, ignore = [] } = options;
  let browser2 = null;
  const pages = [];
  try {
    browser2 = await playwright.chromium.launch({ headless: true });
    const context = await browser2.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();
    for (const url of urls) {
      try {
        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout
        });
        const metrics = await extractMetrics(page, url);
        pages.push(metrics);
      } catch (error) {
        console.error(`Failed to analyze ${url}:`, error instanceof Error ? error.message : error);
      }
    }
    await browser2.close();
  } catch (error) {
    if (browser2) await browser2.close();
    throw error;
  }
  if (pages.length < 2) {
    return {
      pages,
      inconsistencies: [],
      score: 100,
      summary: "Need at least 2 pages to check consistency"
    };
  }
  const inconsistencies = findInconsistencies(pages, ignore);
  const score = calculateScore(inconsistencies);
  const errorCount = inconsistencies.filter((i) => i.severity === "error").length;
  const warningCount = inconsistencies.filter((i) => i.severity === "warning").length;
  let summary;
  if (score === 100) {
    summary = `All ${pages.length} pages are consistent.`;
  } else if (score >= 80) {
    summary = `Minor inconsistencies found across ${pages.length} pages. ${warningCount} warning(s).`;
  } else if (score >= 50) {
    summary = `Notable inconsistencies found. ${errorCount} error(s), ${warningCount} warning(s).`;
  } else {
    summary = `Significant style inconsistencies detected. ${errorCount} error(s), ${warningCount} warning(s). Review recommended.`;
  }
  return {
    pages,
    inconsistencies,
    score,
    summary
  };
}
function formatConsistencyReport(result) {
  const lines = [];
  lines.push("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  lines.push("  UI CONSISTENCY REPORT");
  lines.push("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  lines.push("");
  lines.push(`Score: ${result.score}/100`);
  lines.push(`Pages analyzed: ${result.pages.length}`);
  lines.push(`Summary: ${result.summary}`);
  lines.push("");
  if (result.inconsistencies.length === 0) {
    lines.push("\u2713 No inconsistencies found");
  } else {
    lines.push("Inconsistencies:");
    lines.push("");
    for (const issue of result.inconsistencies) {
      const icon = issue.severity === "error" ? "\u2717" : issue.severity === "warning" ? "!" : "\u2139";
      lines.push(`  ${icon} [${issue.type}] ${issue.description}`);
      for (const page of issue.pages) {
        if (page.value !== null) {
          lines.push(`      ${page.path}: ${page.value}`);
        }
      }
      lines.push("");
    }
  }
  lines.push("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  lines.push("Pages analyzed:");
  for (const page of result.pages) {
    lines.push(`  \u2022 ${page.path} (${page.title})`);
  }
  return lines.join("\n");
}
async function discoverPages(options) {
  const {
    url: url$1,
    maxPages = 5,
    pathPrefix,
    timeout = 1e4,
    includeExternal = false
  } = options;
  const startTime = Date.now();
  const startUrl = new url.URL(url$1);
  const origin = startUrl.origin;
  const discovered = /* @__PURE__ */ new Map();
  const visited = /* @__PURE__ */ new Set();
  const queue = [
    { url: url$1, depth: 0 }
  ];
  let browser2 = null;
  let totalLinks = 0;
  try {
    browser2 = await playwright.chromium.launch({ headless: true });
    const context = await browser2.newContext();
    const page = await context.newPage();
    while (queue.length > 0 && discovered.size < maxPages) {
      const current = queue.shift();
      if (!current) break;
      const currentUrl = normalizeUrl(current.url);
      if (visited.has(currentUrl)) continue;
      visited.add(currentUrl);
      try {
        await page.goto(current.url, {
          waitUntil: "domcontentloaded",
          timeout
        });
        const title = await page.title();
        const parsedUrl = new url.URL(current.url);
        discovered.set(currentUrl, {
          url: current.url,
          path: parsedUrl.pathname,
          title: title || parsedUrl.pathname,
          linkText: current.linkText,
          depth: current.depth
        });
        if (discovered.size >= maxPages) break;
        const links = await page.evaluate(() => {
          const anchors = Array.from(document.querySelectorAll("a[href]"));
          return anchors.map((a) => ({
            href: a.getAttribute("href") || "",
            text: a.textContent?.trim() || ""
          }));
        });
        totalLinks += links.length;
        for (const link of links) {
          if (discovered.size >= maxPages) break;
          try {
            const absoluteUrl = new url.URL(link.href, current.url);
            const normalizedUrl = normalizeUrl(absoluteUrl.href);
            if (visited.has(normalizedUrl)) continue;
            if (!includeExternal && absoluteUrl.origin !== origin) continue;
            if (pathPrefix && !absoluteUrl.pathname.startsWith(pathPrefix)) continue;
            if (shouldSkipUrl(absoluteUrl)) continue;
            queue.push({
              url: absoluteUrl.href,
              depth: current.depth + 1,
              linkText: link.text
            });
          } catch {
          }
        }
      } catch (error) {
        console.error(`Failed to load ${current.url}:`, error instanceof Error ? error.message : error);
      }
    }
    await browser2.close();
  } catch (error) {
    if (browser2) await browser2.close();
    throw error;
  }
  const crawlTime = Date.now() - startTime;
  return {
    baseUrl: origin,
    pages: Array.from(discovered.values()).sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      return a.path.localeCompare(b.path);
    }),
    totalLinks,
    crawlTime
  };
}
function normalizeUrl(url$1) {
  try {
    const parsed = new url.URL(url$1);
    let normalized = `${parsed.origin}${parsed.pathname}`;
    if (normalized.endsWith("/") && normalized.length > 1) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return url$1;
  }
}
function shouldSkipUrl(url) {
  const path = url.pathname.toLowerCase();
  const skipExtensions = [
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".svg",
    ".webp",
    ".css",
    ".js",
    ".json",
    ".xml",
    ".ico",
    ".woff",
    ".woff2",
    ".mp3",
    ".mp4",
    ".webm",
    ".zip",
    ".tar",
    ".gz"
  ];
  if (skipExtensions.some((ext) => path.endsWith(ext))) return true;
  const skipPaths = [
    "/api/",
    "/static/",
    "/assets/",
    "/_next/",
    "/fonts/",
    "/images/",
    "/img/",
    "/cdn/",
    "/admin/",
    "/auth/"
  ];
  if (skipPaths.some((p) => path.includes(p))) return true;
  if (url.hash && url.pathname === "/") return true;
  return false;
}
async function getNavigationLinks(url$1) {
  let browser2 = null;
  try {
    browser2 = await playwright.chromium.launch({ headless: true });
    const page = await browser2.newPage();
    await page.goto(url$1, {
      waitUntil: "domcontentloaded",
      timeout: 15e3
    });
    const origin = new url.URL(url$1).origin;
    const navLinks = await page.evaluate(() => {
      const selectors = [
        "nav a[href]",
        "header a[href]",
        '[role="navigation"] a[href]',
        ".nav a[href]",
        ".navbar a[href]",
        ".sidebar a[href]",
        ".menu a[href]"
      ];
      const links = [];
      const seen = /* @__PURE__ */ new Set();
      for (const selector of selectors) {
        const anchors = Array.from(document.querySelectorAll(selector));
        for (const a of anchors) {
          const href = a.getAttribute("href");
          const text = a.textContent?.trim();
          if (href && text && !seen.has(href)) {
            seen.add(href);
            links.push({ href, text });
          }
        }
      }
      return links;
    });
    await browser2.close();
    const pages = [];
    for (const link of navLinks) {
      try {
        const absoluteUrl = new url.URL(link.href, url$1);
        if (absoluteUrl.origin !== origin) continue;
        if (shouldSkipUrl(absoluteUrl)) continue;
        pages.push({
          url: absoluteUrl.href,
          path: absoluteUrl.pathname,
          title: link.text,
          linkText: link.text,
          depth: 1
        });
      } catch {
      }
    }
    const uniquePages = /* @__PURE__ */ new Map();
    for (const page2 of pages) {
      if (!uniquePages.has(page2.path)) {
        uniquePages.set(page2.path, page2);
      }
    }
    return Array.from(uniquePages.values());
  } catch (error) {
    if (browser2) await browser2.close();
    throw error;
  }
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
exports.captureWithDiagnostics = captureWithDiagnostics;
exports.checkConsistency = checkConsistency;
exports.cleanSessions = cleanSessions;
exports.closeBrowser = closeBrowser;
exports.compareImages = compareImages;
exports.createSession = createSession;
exports.deleteSession = deleteSession;
exports.detectChangedRegions = detectChangedRegions;
exports.discoverPages = discoverPages;
exports.findSessions = findSessions;
exports.formatConsistencyReport = formatConsistencyReport;
exports.formatReportJson = formatReportJson;
exports.formatReportMinimal = formatReportMinimal;
exports.formatReportText = formatReportText;
exports.formatSessionSummary = formatSessionSummary;
exports.generateReport = generateReport;
exports.generateSessionId = generateSessionId;
exports.getMostRecentSession = getMostRecentSession;
exports.getNavigationLinks = getNavigationLinks;
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