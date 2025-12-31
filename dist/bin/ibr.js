#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/schemas.ts
var import_zod, ViewportSchema, VIEWPORTS, ConfigSchema, SessionQuerySchema, ComparisonResultSchema, ChangedRegionSchema, VerdictSchema, AnalysisSchema, SessionStatusSchema, SessionSchema, ComparisonReportSchema;
var init_schemas = __esm({
  "src/schemas.ts"() {
    "use strict";
    import_zod = require("zod");
    ViewportSchema = import_zod.z.object({
      name: import_zod.z.string().min(1).max(50),
      width: import_zod.z.number().min(320).max(3840),
      height: import_zod.z.number().min(480).max(2160)
    });
    VIEWPORTS = {
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
    ConfigSchema = import_zod.z.object({
      baseUrl: import_zod.z.string().url("Must be a valid URL"),
      outputDir: import_zod.z.string().default("./.ibr"),
      viewport: ViewportSchema.default(VIEWPORTS.desktop),
      viewports: import_zod.z.array(ViewportSchema).optional(),
      // Multi-viewport support
      threshold: import_zod.z.number().min(0).max(100).default(1),
      fullPage: import_zod.z.boolean().default(true),
      waitForNetworkIdle: import_zod.z.boolean().default(true),
      timeout: import_zod.z.number().min(1e3).max(12e4).default(3e4)
    });
    SessionQuerySchema = import_zod.z.object({
      route: import_zod.z.string().optional(),
      url: import_zod.z.string().optional(),
      status: import_zod.z.enum(["baseline", "compared", "pending"]).optional(),
      name: import_zod.z.string().optional(),
      createdAfter: import_zod.z.date().optional(),
      createdBefore: import_zod.z.date().optional(),
      viewport: import_zod.z.string().optional(),
      limit: import_zod.z.number().min(1).max(100).default(50)
    });
    ComparisonResultSchema = import_zod.z.object({
      match: import_zod.z.boolean(),
      diffPercent: import_zod.z.number(),
      diffPixels: import_zod.z.number(),
      totalPixels: import_zod.z.number(),
      threshold: import_zod.z.number()
    });
    ChangedRegionSchema = import_zod.z.object({
      location: import_zod.z.enum(["top", "bottom", "left", "right", "center", "full"]),
      bounds: import_zod.z.object({
        x: import_zod.z.number(),
        y: import_zod.z.number(),
        width: import_zod.z.number(),
        height: import_zod.z.number()
      }),
      description: import_zod.z.string(),
      severity: import_zod.z.enum(["expected", "unexpected", "critical"])
    });
    VerdictSchema = import_zod.z.enum([
      "MATCH",
      "EXPECTED_CHANGE",
      "UNEXPECTED_CHANGE",
      "LAYOUT_BROKEN"
    ]);
    AnalysisSchema = import_zod.z.object({
      verdict: VerdictSchema,
      summary: import_zod.z.string(),
      changedRegions: import_zod.z.array(ChangedRegionSchema),
      unexpectedChanges: import_zod.z.array(ChangedRegionSchema),
      recommendation: import_zod.z.string().nullable()
    });
    SessionStatusSchema = import_zod.z.enum(["baseline", "compared", "pending"]);
    SessionSchema = import_zod.z.object({
      id: import_zod.z.string(),
      name: import_zod.z.string(),
      url: import_zod.z.string().url(),
      viewport: ViewportSchema,
      status: SessionStatusSchema,
      createdAt: import_zod.z.string().datetime(),
      updatedAt: import_zod.z.string().datetime(),
      comparison: ComparisonResultSchema.optional(),
      analysis: AnalysisSchema.optional()
    });
    ComparisonReportSchema = import_zod.z.object({
      sessionId: import_zod.z.string(),
      sessionName: import_zod.z.string(),
      url: import_zod.z.string(),
      timestamp: import_zod.z.string().datetime(),
      viewport: ViewportSchema,
      comparison: ComparisonResultSchema,
      analysis: AnalysisSchema,
      files: import_zod.z.object({
        baseline: import_zod.z.string(),
        current: import_zod.z.string(),
        diff: import_zod.z.string()
      }),
      webViewUrl: import_zod.z.string().optional()
    });
  }
});

// src/auth.ts
var auth_exports = {};
__export(auth_exports, {
  clearAuthState: () => clearAuthState,
  getAuthStateInfo: () => getAuthStateInfo,
  getAuthStatePath: () => getAuthStatePath,
  getSecureAuthPath: () => getSecureAuthPath,
  hasAuthState: () => hasAuthState,
  isDeployedEnvironment: () => isDeployedEnvironment,
  loadAuthState: () => loadAuthState,
  performLogin: () => performLogin
});
function isDeployedEnvironment() {
  return !!(process.env.VERCEL || process.env.NETLIFY || process.env.CI || process.env.GITHUB_ACTIONS || process.env.GITLAB_CI || process.env.CIRCLECI || process.env.JENKINS_URL || process.env.TRAVIS || process.env.HEROKU || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AZURE_FUNCTIONS_ENVIRONMENT);
}
function getAuthStatePath(outputDir) {
  const username = (0, import_os.userInfo)().username;
  return (0, import_path.join)(outputDir, `auth.${username}.json`);
}
function getSecureAuthPath(projectPath) {
  const username = (0, import_os.userInfo)().username;
  const projectHash = (0, import_crypto.createHash)("sha256").update((0, import_path.resolve)(projectPath)).digest("hex").substring(0, 16);
  return (0, import_path.join)(
    (0, import_os.homedir)(),
    ".config",
    "ibr",
    "auth",
    `${projectHash}.${username}.json`
  );
}
function validateGitignore(projectDir) {
  const gitignorePath = (0, import_path.join)(projectDir, ".gitignore");
  if ((0, import_fs.existsSync)(gitignorePath)) {
    const gitignore = (0, import_fs.readFileSync)(gitignorePath, "utf-8");
    const lines = gitignore.split("\n").map((l) => l.trim());
    const hasIbrIgnore = lines.some(
      (line) => line === ".ibr/" || line === ".ibr" || line === "**/.ibr/" || line === "**/.ibr"
    );
    if (!hasIbrIgnore) {
      console.warn("\n\u26A0\uFE0F  WARNING: .ibr/ is not in .gitignore!");
      console.warn('   Add ".ibr/" to .gitignore to prevent credential leaks.\n');
    }
  } else {
    console.warn('\n\u26A0\uFE0F  No .gitignore found. Create one with ".ibr/" entry.\n');
  }
}
async function hasAuthState(outputDir) {
  try {
    await (0, import_promises.access)(getAuthStatePath(outputDir));
    return true;
  } catch {
    return false;
  }
}
async function loadAuthState(outputDir) {
  if (isDeployedEnvironment()) {
    console.warn("\u26A0\uFE0F  Deployed environment detected. Auth state not available.");
    return null;
  }
  try {
    const authPath = getAuthStatePath(outputDir);
    const content = await (0, import_promises.readFile)(authPath, "utf-8");
    const stored = JSON.parse(content);
    if (!stored.metadata) {
      console.warn("\u26A0\uFE0F  Legacy auth format detected. Please re-authenticate with `ibr login`.");
      return null;
    }
    const currentUser = (0, import_os.userInfo)().username;
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
async function performLogin(options) {
  const { url, outputDir, timeout = 3e5 } = options;
  if (isDeployedEnvironment()) {
    throw new Error(
      "Authentication cannot be performed in deployed environments.\nRun `ibr login` locally on your development machine."
    );
  }
  validateGitignore(process.cwd());
  await (0, import_promises.mkdir)(outputDir, { recursive: true, mode: 448 });
  try {
    await (0, import_promises.chmod)(outputDir, 448);
  } catch {
  }
  const authStatePath = getAuthStatePath(outputDir);
  const currentUser = (0, import_os.userInfo)().username;
  console.log("\n\u{1F510} Opening browser for login...");
  console.log(`   User: ${currentUser}`);
  console.log("   Navigate to your login page and complete authentication.");
  console.log("   When finished, close the browser window to save your session.\n");
  const browser2 = await import_playwright.chromium.launch({
    headless: false
    // Visible browser for manual login
  });
  const context = await browser2.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();
  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 3e4
    });
    await Promise.race([
      new Promise((resolve2) => {
        browser2.on("disconnected", () => resolve2());
      }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Login timeout exceeded")), timeout);
      })
    ]);
  } catch (error) {
    if (browser2.isConnected()) {
      await saveAuthState(context, authStatePath, outputDir);
      await browser2.close();
    }
    if (error instanceof Error && error.message.includes("timeout")) {
      throw error;
    }
  }
  if (browser2.isConnected()) {
    await saveAuthState(context, authStatePath, outputDir);
    await browser2.close();
  } else {
    console.log("\n\u26A0\uFE0F  Browser was closed. Attempting to save any captured state...");
    const newBrowser = await import_playwright.chromium.launch({ headless: true });
    const newContext = await newBrowser.newContext();
    try {
      await newContext.addCookies(await context.cookies());
    } catch {
    }
    await saveAuthState(newContext, authStatePath, outputDir);
    await newBrowser.close();
  }
  console.log(`
\u2705 Auth state saved for user: ${currentUser}`);
  console.log(`   Location: ${authStatePath}`);
  console.log("   Expires: 7 days from now");
  console.log("   Future captures will use this authentication.\n");
  return authStatePath;
}
async function saveAuthState(context, authStatePath, outputDir) {
  const state = await context.storageState();
  const currentUser = (0, import_os.userInfo)().username;
  const storedState = {
    state,
    metadata: {
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1e3,
      // 7 days
      username: currentUser,
      projectPath: (0, import_path.resolve)(process.cwd())
    }
  };
  await (0, import_promises.writeFile)(
    authStatePath,
    JSON.stringify(storedState, null, 2),
    { mode: 384 }
    // rw-------
  );
  try {
    await (0, import_promises.chmod)(authStatePath, 384);
  } catch {
  }
}
async function clearAuthState(outputDir) {
  const authPath = getAuthStatePath(outputDir);
  try {
    const stats = await (0, import_promises.stat)(authPath);
    const randomData = (0, import_crypto.randomBytes)(stats.size);
    await (0, import_promises.writeFile)(authPath, randomData, { mode: 384 });
    await (0, import_promises.unlink)(authPath);
    console.log("\u2705 Auth state securely cleared");
  } catch {
    console.log("\u2139\uFE0F  No auth state to clear");
  }
}
async function getAuthStateInfo(outputDir) {
  try {
    const authPath = getAuthStatePath(outputDir);
    const content = await (0, import_promises.readFile)(authPath, "utf-8");
    const stored = JSON.parse(content);
    if (!stored.metadata) {
      return { exists: true };
    }
    return {
      exists: true,
      username: stored.metadata.username,
      createdAt: new Date(stored.metadata.createdAt),
      expiresAt: new Date(stored.metadata.expiresAt),
      expired: Date.now() > stored.metadata.expiresAt
    };
  } catch {
    return null;
  }
}
var import_playwright, import_promises, import_path, import_fs, import_os, import_crypto;
var init_auth = __esm({
  "src/auth.ts"() {
    "use strict";
    import_playwright = require("playwright");
    import_promises = require("fs/promises");
    import_path = require("path");
    import_fs = require("fs");
    import_os = require("os");
    import_crypto = require("crypto");
  }
});

// src/capture.ts
var capture_exports = {};
__export(capture_exports, {
  captureMultipleViewports: () => captureMultipleViewports,
  captureScreenshot: () => captureScreenshot,
  captureWithDiagnostics: () => captureWithDiagnostics,
  closeBrowser: () => closeBrowser,
  getViewport: () => getViewport
});
async function getBrowser() {
  if (!browser) {
    browser = await import_playwright2.chromium.launch({
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
  await (0, import_promises2.mkdir)((0, import_path2.dirname)(outputPath), { recursive: true });
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
async function captureMultipleViewports(url, outputDir, viewports = ["desktop"], options = {}) {
  const results = {};
  for (const viewportName of viewports) {
    const viewport = getViewport(viewportName);
    const outputPath = `${outputDir}/${viewportName}.png`;
    await captureScreenshot({
      url,
      outputPath,
      viewport,
      ...options
    });
    results[viewportName] = outputPath;
  }
  return results;
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
    await (0, import_promises2.mkdir)((0, import_path2.dirname)(outputPath), { recursive: true });
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
var import_playwright2, import_promises2, import_path2, browser;
var init_capture = __esm({
  "src/capture.ts"() {
    "use strict";
    import_playwright2 = require("playwright");
    import_promises2 = require("fs/promises");
    import_path2 = require("path");
    init_schemas();
    init_auth();
    browser = null;
  }
});

// src/consistency.ts
var consistency_exports = {};
__export(consistency_exports, {
  checkConsistency: () => checkConsistency,
  formatConsistencyReport: () => formatConsistencyReport
});
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
    browser2 = await import_playwright3.chromium.launch({ headless: true });
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
var import_playwright3;
var init_consistency = __esm({
  "src/consistency.ts"() {
    "use strict";
    import_playwright3 = require("playwright");
  }
});

// src/crawl.ts
var crawl_exports = {};
__export(crawl_exports, {
  discoverPages: () => discoverPages,
  getNavigationLinks: () => getNavigationLinks
});
async function discoverPages(options) {
  const {
    url,
    maxPages = 5,
    pathPrefix,
    timeout = 1e4,
    includeExternal = false
  } = options;
  const startTime = Date.now();
  const startUrl = new import_url.URL(url);
  const origin = startUrl.origin;
  const discovered = /* @__PURE__ */ new Map();
  const visited = /* @__PURE__ */ new Set();
  const queue = [
    { url, depth: 0 }
  ];
  let browser2 = null;
  let totalLinks = 0;
  try {
    browser2 = await import_playwright4.chromium.launch({ headless: true });
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
        const parsedUrl = new import_url.URL(current.url);
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
            const absoluteUrl = new import_url.URL(link.href, current.url);
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
function normalizeUrl(url) {
  try {
    const parsed = new import_url.URL(url);
    let normalized = `${parsed.origin}${parsed.pathname}`;
    if (normalized.endsWith("/") && normalized.length > 1) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return url;
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
async function getNavigationLinks(url) {
  let browser2 = null;
  try {
    browser2 = await import_playwright4.chromium.launch({ headless: true });
    const page = await browser2.newPage();
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 15e3
    });
    const origin = new import_url.URL(url).origin;
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
        const absoluteUrl = new import_url.URL(link.href, url);
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
var import_playwright4, import_url;
var init_crawl = __esm({
  "src/crawl.ts"() {
    "use strict";
    import_playwright4 = require("playwright");
    import_url = require("url");
  }
});

// src/bin/ibr.ts
var import_commander = require("commander");
var import_promises5 = require("fs/promises");
var import_path5 = require("path");
var import_fs2 = require("fs");

// src/index.ts
init_schemas();
init_capture();

// src/compare.ts
var import_pixelmatch = __toESM(require("pixelmatch"));
var import_pngjs = require("pngjs");
var import_promises3 = require("fs/promises");
var import_path3 = require("path");
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
    (0, import_promises3.readFile)(baselinePath),
    (0, import_promises3.readFile)(currentPath)
  ]);
  const baseline = import_pngjs.PNG.sync.read(baselineBuffer);
  const current = import_pngjs.PNG.sync.read(currentBuffer);
  if (baseline.width !== current.width || baseline.height !== current.height) {
    throw new Error(
      `Image dimensions mismatch: baseline (${baseline.width}x${baseline.height}) vs current (${current.width}x${current.height})`
    );
  }
  const { width, height } = baseline;
  const diff = new import_pngjs.PNG({ width, height });
  const totalPixels = width * height;
  const diffPixels = (0, import_pixelmatch.default)(
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
  await (0, import_promises3.mkdir)((0, import_path3.dirname)(diffPath), { recursive: true });
  await (0, import_promises3.writeFile)(diffPath, import_pngjs.PNG.sync.write(diff));
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

// src/session.ts
var import_nanoid = require("nanoid");
var import_promises4 = require("fs/promises");
var import_path4 = require("path");
init_schemas();
var SESSION_PREFIX = "sess_";
function generateSessionId() {
  return `${SESSION_PREFIX}${(0, import_nanoid.nanoid)(10)}`;
}
function getSessionPaths(outputDir, sessionId) {
  const root = (0, import_path4.join)(outputDir, "sessions", sessionId);
  return {
    root,
    sessionJson: (0, import_path4.join)(root, "session.json"),
    baseline: (0, import_path4.join)(root, "baseline.png"),
    current: (0, import_path4.join)(root, "current.png"),
    diff: (0, import_path4.join)(root, "diff.png")
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
  await (0, import_promises4.mkdir)(paths.root, { recursive: true });
  await (0, import_promises4.writeFile)(paths.sessionJson, JSON.stringify(session, null, 2));
  return session;
}
async function getSession(outputDir, sessionId) {
  const paths = getSessionPaths(outputDir, sessionId);
  try {
    const content = await (0, import_promises4.readFile)(paths.sessionJson, "utf-8");
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
  await (0, import_promises4.writeFile)(paths.sessionJson, JSON.stringify(updated, null, 2));
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
  const sessionsDir = (0, import_path4.join)(outputDir, "sessions");
  try {
    const entries = await (0, import_promises4.readdir)(sessionsDir, { withFileTypes: true });
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
    await (0, import_promises4.rm)(paths.root, { recursive: true, force: true });
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
init_schemas();
init_capture();
init_consistency();
init_crawl();
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

// src/bin/ibr.ts
var program = new import_commander.Command();
async function loadConfig() {
  const configPath = (0, import_path5.join)(process.cwd(), ".ibrrc.json");
  if ((0, import_fs2.existsSync)(configPath)) {
    try {
      const content = await (0, import_promises5.readFile)(configPath, "utf-8");
      return JSON.parse(content);
    } catch {
    }
  }
  return {};
}
async function createIBR(options = {}) {
  const config = await loadConfig();
  const merged = {
    ...config,
    ...options.baseUrl ? { baseUrl: String(options.baseUrl) } : {},
    ...options.output ? { outputDir: String(options.output) } : {},
    ...options.viewport ? { viewport: VIEWPORTS[options.viewport] } : {},
    ...options.threshold ? { threshold: Number(options.threshold) } : {},
    ...options.fullPage !== void 0 ? { fullPage: Boolean(options.fullPage) } : {}
  };
  return new InterfaceBuiltRight(merged);
}
program.name("ibr").description("Visual regression testing for Claude Code").version("0.1.0");
program.option("-b, --base-url <url>", "Base URL for the application").option("-o, --output <dir>", "Output directory", "./.ibr").option("-v, --viewport <name>", "Viewport: desktop, mobile, tablet", "desktop").option("-t, --threshold <percent>", "Diff threshold percentage", "1.0");
program.command("start <url>").description("Start a visual session by capturing a baseline screenshot").option("-n, --name <name>", "Session name").option("--no-full-page", "Capture only the viewport, not full page").action(async (url, options) => {
  try {
    const ibr = await createIBR(program.opts());
    const result = await ibr.startSession(url, {
      name: options.name,
      fullPage: options.fullPage
    });
    console.log(`Session started: ${result.sessionId}`);
    console.log(`Baseline: ${result.baseline}`);
    console.log(`URL: ${result.session.url}`);
    await ibr.close();
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("check [sessionId]").description("Compare current state against baseline").option("-f, --format <format>", "Output format: json, text, minimal", "text").action(async (sessionId, options) => {
  try {
    const ibr = await createIBR(program.opts());
    const report = await ibr.check(sessionId);
    switch (options.format) {
      case "json":
        console.log(formatReportJson(report));
        break;
      case "minimal":
        console.log(formatReportMinimal(report));
        break;
      default:
        console.log(formatReportText(report));
    }
    await ibr.close();
    if (!report.comparison.match && (report.analysis.verdict === "UNEXPECTED_CHANGE" || report.analysis.verdict === "LAYOUT_BROKEN")) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("list").description("List all sessions").option("-f, --format <format>", "Output format: json, text", "text").action(async (options) => {
  try {
    const ibr = await createIBR(program.opts());
    const sessions = await ibr.listSessions();
    if (sessions.length === 0) {
      console.log("No sessions found.");
      return;
    }
    if (options.format === "json") {
      console.log(JSON.stringify(sessions, null, 2));
    } else {
      console.log("Sessions:");
      console.log("");
      console.log("ID              STATUS    VIEWPORT  DATE        NAME");
      console.log("-".repeat(70));
      for (const session of sessions) {
        console.log(formatSessionSummary(session));
      }
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("update [sessionId]").description("Update baseline with current screenshot").action(async (sessionId) => {
  try {
    const ibr = await createIBR(program.opts());
    const session = await ibr.updateBaseline(sessionId);
    console.log(`Baseline updated for session: ${session.id}`);
    console.log(`URL: ${session.url}`);
    await ibr.close();
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("clean").description("Clean old sessions").option("--older-than <duration>", "Delete sessions older than duration (e.g., 7d, 24h)").option("--keep-last <count>", "Keep the last N sessions", "0").option("--dry-run", "Show what would be deleted without deleting").action(async (options) => {
  try {
    const ibr = await createIBR(program.opts());
    const result = await ibr.clean({
      olderThan: options.olderThan,
      keepLast: parseInt(options.keepLast, 10),
      dryRun: options.dryRun
    });
    if (options.dryRun) {
      console.log("Dry run - would delete:");
    } else {
      console.log("Cleaned:");
    }
    if (result.deleted.length === 0) {
      console.log("  No sessions to delete.");
    } else {
      for (const id of result.deleted) {
        console.log(`  - ${id}`);
      }
    }
    console.log(`
Kept: ${result.kept.length} sessions`);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("delete <sessionId>").description("Delete a specific session").action(async (sessionId) => {
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
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("serve").description("Start the comparison viewer web UI").option("-p, --port <port>", "Port number", "4242").option("--no-open", "Do not open browser automatically").action(async (options) => {
  const { spawn } = await import("child_process");
  const { resolve: resolve2 } = await import("path");
  const packageRoot = resolve2(process.cwd());
  let webUiDir = (0, import_path5.join)(packageRoot, "web-ui");
  if (!(0, import_fs2.existsSync)(webUiDir)) {
    const possiblePaths = [
      (0, import_path5.join)(packageRoot, "node_modules", "interface-built-right", "web-ui"),
      (0, import_path5.join)(packageRoot, "..", "interface-built-right", "web-ui")
    ];
    for (const p of possiblePaths) {
      if ((0, import_fs2.existsSync)(p)) {
        webUiDir = p;
        break;
      }
    }
  }
  if (!(0, import_fs2.existsSync)(webUiDir)) {
    console.log("Web UI not found. Please ensure web-ui directory exists.");
    console.log("");
    console.log("For now, you can view the comparison images directly:");
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
    }
    return;
  }
  console.log(`Starting web UI on http://localhost:${options.port}`);
  console.log("Press Ctrl+C to stop the server.");
  console.log("");
  const server = spawn("npm", ["run", "dev", "--", "-p", options.port], {
    cwd: webUiDir,
    stdio: "inherit",
    shell: true
  });
  if (options.open !== false) {
    setTimeout(async () => {
      const open = (await import("child_process")).exec;
      const url = `http://localhost:${options.port}`;
      const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
      open(`${cmd} ${url}`);
    }, 3e3);
  }
  server.on("close", (code) => {
    if (code !== 0) {
      console.log(`Web UI server exited with code ${code}`);
    }
  });
});
program.command("login <url>").description("Open browser for manual login, then save auth state for future captures").option("--timeout <ms>", "Timeout in milliseconds (default: 5 minutes)", "300000").action(async (url, options) => {
  try {
    const { performLogin: performLogin2 } = await Promise.resolve().then(() => (init_auth(), auth_exports));
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    await performLogin2({
      url,
      outputDir,
      timeout: parseInt(options.timeout, 10)
    });
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("logout").description("Clear saved authentication state").action(async () => {
  try {
    const { clearAuthState: clearAuthState2 } = await Promise.resolve().then(() => (init_auth(), auth_exports));
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    await clearAuthState2(outputDir);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("scan <url>").description("Discover pages and capture baselines for each (up to 5 by default)").option("-n, --max-pages <count>", "Maximum pages to discover", "5").option("-p, --prefix <path>", "Only scan pages under this path prefix").option("--nav-only", "Only scan navigation links (faster)").option("-f, --format <format>", "Output format: json, text", "text").action(async (url, options) => {
  try {
    const { discoverPages: discoverPages2, getNavigationLinks: getNavigationLinks2 } = await Promise.resolve().then(() => (init_crawl(), crawl_exports));
    console.log(`Scanning ${url}...`);
    console.log("");
    let pages;
    if (options.navOnly) {
      pages = await getNavigationLinks2(url);
      console.log(`Found ${pages.length} navigation links:`);
    } else {
      const result = await discoverPages2({
        url,
        maxPages: parseInt(options.maxPages, 10),
        pathPrefix: options.prefix
      });
      pages = result.pages;
      console.log(`Discovered ${pages.length} pages (${result.crawlTime}ms):`);
    }
    console.log("");
    if (options.format === "json") {
      console.log(JSON.stringify(pages, null, 2));
    } else {
      for (const page of pages) {
        console.log(`  ${page.path}`);
        console.log(`    Title: ${page.title}`);
        if (page.linkText && page.linkText !== page.title) {
          console.log(`    Link: ${page.linkText}`);
        }
        console.log("");
      }
    }
    console.log("To capture baselines for all discovered pages:");
    console.log(`  npx ibr scan-start ${url} --max-pages ${options.maxPages}`);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("scan-start <url>").description("Discover pages and capture baseline for each").option("-n, --max-pages <count>", "Maximum pages to discover", "5").option("-p, --prefix <path>", "Only scan pages under this path prefix").option("--nav-only", "Only scan navigation links (faster)").action(async (url, options) => {
  try {
    const { discoverPages: discoverPages2, getNavigationLinks: getNavigationLinks2 } = await Promise.resolve().then(() => (init_crawl(), crawl_exports));
    const ibr = await createIBR(program.opts());
    console.log(`Scanning ${url}...`);
    let pages;
    if (options.navOnly) {
      pages = await getNavigationLinks2(url);
    } else {
      const result = await discoverPages2({
        url,
        maxPages: parseInt(options.maxPages, 10),
        pathPrefix: options.prefix
      });
      pages = result.pages;
    }
    console.log(`Found ${pages.length} pages. Capturing baselines...`);
    console.log("");
    const sessions = [];
    for (const page of pages) {
      try {
        console.log(`Capturing: ${page.path}`);
        const result = await ibr.startSession(page.url, {
          name: page.title.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase().slice(0, 50)
        });
        sessions.push({ page, sessionId: result.sessionId });
        console.log(`  \u2713 Session: ${result.sessionId}`);
      } catch (error) {
        console.log(`  \u2717 Failed: ${error instanceof Error ? error.message : error}`);
      }
    }
    console.log("");
    console.log(`Captured ${sessions.length}/${pages.length} pages.`);
    console.log("");
    console.log("To compare all after making changes:");
    console.log("  npx ibr scan-check");
    await ibr.close();
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("scan-check").description("Compare all sessions from the last scan-start").option("-f, --format <format>", "Output format: json, text, minimal", "text").action(async (options) => {
  try {
    const ibr = await createIBR(program.opts());
    const sessions = await ibr.listSessions();
    const recentSessions = sessions.filter((s) => {
      const age = Date.now() - new Date(s.createdAt).getTime();
      return age < 60 * 60 * 1e3 && s.status === "baseline";
    });
    if (recentSessions.length === 0) {
      console.log("No recent baseline sessions found. Run scan-start first.");
      return;
    }
    console.log(`Checking ${recentSessions.length} sessions...`);
    console.log("");
    const results = [];
    for (const session of recentSessions) {
      try {
        console.log(`Checking: ${session.name}`);
        const report = await ibr.check(session.id);
        results.push({ session, report });
        const icon = report.analysis.verdict === "MATCH" ? "\u2713" : report.analysis.verdict === "EXPECTED_CHANGE" ? "~" : report.analysis.verdict === "UNEXPECTED_CHANGE" ? "!" : "\u2717";
        console.log(`  ${icon} ${report.analysis.verdict}: ${report.analysis.summary}`);
      } catch (error) {
        console.log(`  \u2717 Failed: ${error instanceof Error ? error.message : error}`);
      }
    }
    console.log("");
    const matches = results.filter((r) => r.report.analysis.verdict === "MATCH").length;
    const expected = results.filter((r) => r.report.analysis.verdict === "EXPECTED_CHANGE").length;
    const unexpected = results.filter((r) => r.report.analysis.verdict === "UNEXPECTED_CHANGE").length;
    const broken = results.filter((r) => r.report.analysis.verdict === "LAYOUT_BROKEN").length;
    console.log("Summary:");
    console.log(`  \u2713 Match: ${matches}`);
    console.log(`  ~ Expected: ${expected}`);
    console.log(`  ! Unexpected: ${unexpected}`);
    console.log(`  \u2717 Broken: ${broken}`);
    if (unexpected > 0 || broken > 0) {
      console.log("");
      console.log("Issues detected. View in UI:");
      console.log("  npx ibr serve");
    }
    await ibr.close();
    if (broken > 0) process.exit(1);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("consistency <url>").description("Check UI consistency across multiple pages (opt-in)").option("-n, --max-pages <count>", "Maximum pages to check", "5").option("--nav-only", "Only check navigation links (faster)").option("--ignore <types>", "Ignore certain checks (layout,typography,color,spacing)", "").option("-f, --format <format>", "Output format: json, text", "text").option("--confirm", "Skip confirmation prompt (for automation/Claude Code)").action(async (url, options) => {
  try {
    if (!options.confirm) {
      console.log("");
      console.log("\u26A0\uFE0F  Consistency Check");
      console.log("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
      console.log("This will analyze UI styles across multiple pages to");
      console.log("detect potential inconsistencies (fonts, colors, spacing).");
      console.log("");
      console.log("Note: Some style differences may be intentional.");
      console.log("");
      console.log("To proceed, run with --confirm flag:");
      console.log(`  npx ibr consistency ${url} --confirm`);
      console.log("");
      console.log("Or for Claude Code automation:");
      console.log(`  npx ibr consistency ${url} --confirm --format json`);
      return;
    }
    const { discoverPages: discoverPages2, getNavigationLinks: getNavigationLinks2 } = await Promise.resolve().then(() => (init_crawl(), crawl_exports));
    const { checkConsistency: checkConsistency2, formatConsistencyReport: formatConsistencyReport2 } = await Promise.resolve().then(() => (init_consistency(), consistency_exports));
    console.log(`Discovering pages from ${url}...`);
    let pages;
    if (options.navOnly) {
      pages = await getNavigationLinks2(url);
    } else {
      const result2 = await discoverPages2({
        url,
        maxPages: parseInt(options.maxPages, 10)
      });
      pages = result2.pages;
    }
    if (pages.length < 2) {
      console.log("Need at least 2 pages to check consistency.");
      return;
    }
    console.log(`Found ${pages.length} pages. Analyzing styles...`);
    console.log("");
    const urls = pages.map((p) => p.url);
    const ignore = options.ignore ? options.ignore.split(",") : [];
    const result = await checkConsistency2({
      urls,
      ignore
    });
    if (options.format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatConsistencyReport2(result));
    }
    if (result.score < 50) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("diagnose <url>").description("Diagnose page load issues with detailed timing and error info").option("--timeout <ms>", "Timeout in milliseconds", "30000").action(async (url, options) => {
  try {
    const { captureWithDiagnostics: captureWithDiagnostics2, closeBrowser: closeBrowser2 } = await Promise.resolve().then(() => (init_capture(), capture_exports));
    const { join: join4 } = await import("path");
    const outputDir = program.opts().output || "./.ibr";
    console.log(`Diagnosing ${url}...`);
    console.log("");
    const result = await captureWithDiagnostics2({
      url,
      outputPath: join4(outputDir, "diagnose", "test.png"),
      timeout: parseInt(options.timeout, 10),
      outputDir
    });
    await closeBrowser2();
    console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
    console.log("  PAGE DIAGNOSTICS");
    console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
    console.log("");
    if (result.success) {
      console.log("\u2713 Page loaded successfully");
      console.log("");
    } else {
      console.log("\u2717 Page failed to load");
      console.log(`  Error: ${result.error?.message}`);
      console.log(`  Suggestion: ${result.error?.suggestion}`);
      console.log("");
    }
    console.log("Timing:");
    console.log(`  Navigation: ${result.timing.navigationMs}ms`);
    console.log(`  Render: ${result.timing.renderMs}ms`);
    console.log(`  Total: ${result.timing.totalMs}ms`);
    console.log("");
    if (result.diagnostics.httpStatus) {
      console.log(`HTTP Status: ${result.diagnostics.httpStatus}`);
    }
    if (result.diagnostics.consoleErrors.length > 0) {
      console.log("");
      console.log("Console Errors:");
      for (const err of result.diagnostics.consoleErrors.slice(0, 5)) {
        console.log(`  \u2022 ${err.substring(0, 100)}${err.length > 100 ? "..." : ""}`);
      }
      if (result.diagnostics.consoleErrors.length > 5) {
        console.log(`  ... and ${result.diagnostics.consoleErrors.length - 5} more`);
      }
    }
    if (result.diagnostics.networkErrors.length > 0) {
      console.log("");
      console.log("Network Errors:");
      for (const err of result.diagnostics.networkErrors.slice(0, 5)) {
        console.log(`  \u2022 ${err.substring(0, 100)}${err.length > 100 ? "..." : ""}`);
      }
      if (result.diagnostics.networkErrors.length > 5) {
        console.log(`  ... and ${result.diagnostics.networkErrors.length - 5} more`);
      }
    }
    if (result.diagnostics.suggestions.length > 0) {
      console.log("");
      console.log("Suggestions:");
      for (const suggestion of result.diagnostics.suggestions) {
        console.log(`  \u2192 ${suggestion}`);
      }
    }
    if (!result.success) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("init").description("Initialize .ibrrc.json configuration file").action(async () => {
  const configPath = (0, import_path5.join)(process.cwd(), ".ibrrc.json");
  if ((0, import_fs2.existsSync)(configPath)) {
    console.log(".ibrrc.json already exists.");
    return;
  }
  const config = {
    baseUrl: "http://localhost:3000",
    outputDir: "./.ibr",
    viewport: "desktop",
    threshold: 1,
    fullPage: true
  };
  const { writeFile: writeFile4 } = await import("fs/promises");
  await writeFile4(configPath, JSON.stringify(config, null, 2));
  console.log("Created .ibrrc.json");
  console.log("");
  console.log("Configuration:");
  console.log(JSON.stringify(config, null, 2));
});
program.parse();
//# sourceMappingURL=ibr.js.map