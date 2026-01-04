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
var import_zod, ViewportSchema, VIEWPORTS, ConfigSchema, SessionQuerySchema, ComparisonResultSchema, ChangedRegionSchema, VerdictSchema, AnalysisSchema, SessionStatusSchema, SessionSchema, ComparisonReportSchema, InteractiveStateSchema, A11yAttributesSchema, BoundsSchema, EnhancedElementSchema, ElementIssueSchema, AuditResultSchema, RuleSeveritySchema, RuleSettingSchema, RulesConfigSchema, ViolationSchema, RuleAuditResultSchema;
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
    InteractiveStateSchema = import_zod.z.object({
      hasOnClick: import_zod.z.boolean(),
      hasHref: import_zod.z.boolean(),
      isDisabled: import_zod.z.boolean(),
      tabIndex: import_zod.z.number(),
      cursor: import_zod.z.string(),
      // Framework-specific detection
      hasReactHandler: import_zod.z.boolean().optional(),
      hasVueHandler: import_zod.z.boolean().optional(),
      hasAngularHandler: import_zod.z.boolean().optional()
    });
    A11yAttributesSchema = import_zod.z.object({
      role: import_zod.z.string().nullable(),
      ariaLabel: import_zod.z.string().nullable(),
      ariaDescribedBy: import_zod.z.string().nullable(),
      ariaHidden: import_zod.z.boolean().optional()
    });
    BoundsSchema = import_zod.z.object({
      x: import_zod.z.number(),
      y: import_zod.z.number(),
      width: import_zod.z.number(),
      height: import_zod.z.number()
    });
    EnhancedElementSchema = import_zod.z.object({
      // Identity
      selector: import_zod.z.string(),
      tagName: import_zod.z.string(),
      id: import_zod.z.string().optional(),
      className: import_zod.z.string().optional(),
      text: import_zod.z.string().optional(),
      // Position
      bounds: BoundsSchema,
      // Styles (subset)
      computedStyles: import_zod.z.record(import_zod.z.string()).optional(),
      // Interactivity
      interactive: InteractiveStateSchema,
      // Accessibility
      a11y: A11yAttributesSchema,
      // Source hints for debugging
      sourceHint: import_zod.z.object({
        dataTestId: import_zod.z.string().nullable()
      }).optional()
    });
    ElementIssueSchema = import_zod.z.object({
      type: import_zod.z.enum([
        "NO_HANDLER",
        // Interactive-looking but no handler
        "PLACEHOLDER_LINK",
        // href="#" without handler
        "TOUCH_TARGET_SMALL",
        // < 44px on mobile
        "MISSING_ARIA_LABEL",
        // Interactive without label
        "DISABLED_NO_VISUAL"
        // Disabled but no visual indication
      ]),
      severity: import_zod.z.enum(["error", "warning", "info"]),
      message: import_zod.z.string()
    });
    AuditResultSchema = import_zod.z.object({
      totalElements: import_zod.z.number(),
      interactiveCount: import_zod.z.number(),
      withHandlers: import_zod.z.number(),
      withoutHandlers: import_zod.z.number(),
      issues: import_zod.z.array(ElementIssueSchema)
    });
    RuleSeveritySchema = import_zod.z.enum(["off", "warn", "error"]);
    RuleSettingSchema = import_zod.z.union([
      RuleSeveritySchema,
      import_zod.z.tuple([RuleSeveritySchema, import_zod.z.record(import_zod.z.unknown())])
    ]);
    RulesConfigSchema = import_zod.z.object({
      extends: import_zod.z.array(import_zod.z.string()).optional(),
      rules: import_zod.z.record(RuleSettingSchema).optional()
    });
    ViolationSchema = import_zod.z.object({
      ruleId: import_zod.z.string(),
      ruleName: import_zod.z.string(),
      severity: import_zod.z.enum(["warn", "error"]),
      message: import_zod.z.string(),
      element: import_zod.z.string().optional(),
      // Selector of violating element
      bounds: BoundsSchema.optional(),
      fix: import_zod.z.string().optional()
      // Suggested fix
    });
    RuleAuditResultSchema = import_zod.z.object({
      url: import_zod.z.string(),
      timestamp: import_zod.z.string(),
      elementsScanned: import_zod.z.number(),
      violations: import_zod.z.array(ViolationSchema),
      summary: import_zod.z.object({
        errors: import_zod.z.number(),
        warnings: import_zod.z.number(),
        passed: import_zod.z.number()
      })
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
  const browser3 = await import_playwright.chromium.launch({
    headless: false
    // Visible browser for manual login
  });
  const context = await browser3.newContext({
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
        browser3.on("disconnected", () => resolve2());
      }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Login timeout exceeded")), timeout);
      })
    ]);
  } catch (error) {
    if (browser3.isConnected()) {
      await saveAuthState(context, authStatePath, outputDir);
      await browser3.close();
    }
    if (error instanceof Error && error.message.includes("timeout")) {
      throw error;
    }
  }
  if (browser3.isConnected()) {
    await saveAuthState(context, authStatePath, outputDir);
    await browser3.close();
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
    outputDir,
    selector,
    waitFor
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
    if (waitFor) {
      await page.waitForSelector(waitFor, { timeout });
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
    if (selector) {
      const element = await page.waitForSelector(selector, { timeout: 5e3 });
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      await element.screenshot({
        path: outputPath,
        type: "png"
      });
    } else {
      await page.screenshot({
        path: outputPath,
        fullPage,
        type: "png"
      });
    }
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
    outputDir,
    selector
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
    if (selector) {
      const element = await page.waitForSelector(selector, { timeout: 5e3 });
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      await element.screenshot({
        path: outputPath,
        type: "png"
      });
    } else {
      await page.screenshot({
        path: outputPath,
        fullPage,
        type: "png"
      });
    }
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
  let browser3 = null;
  const pages = [];
  try {
    browser3 = await import_playwright3.chromium.launch({ headless: true });
    const context = await browser3.newContext({
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
    await browser3.close();
  } catch (error) {
    if (browser3) await browser3.close();
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
  let browser3 = null;
  let totalLinks = 0;
  try {
    browser3 = await import_playwright4.chromium.launch({ headless: true });
    const context = await browser3.newContext();
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
    await browser3.close();
  } catch (error) {
    if (browser3) await browser3.close();
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
  let browser3 = null;
  try {
    browser3 = await import_playwright4.chromium.launch({ headless: true });
    const page = await browser3.newPage();
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
    await browser3.close();
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
    if (browser3) await browser3.close();
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

// src/rules/presets/minimal.ts
var minimal_exports = {};
__export(minimal_exports, {
  register: () => register,
  rules: () => rules
});
function register() {
  registerPreset(minimalPreset);
}
var noHandlerRule, placeholderLinkRule, touchTargetRule, missingAriaLabelRule, disabledNoVisualRule, minimalPreset, rules;
var init_minimal = __esm({
  "src/rules/presets/minimal.ts"() {
    "use strict";
    init_engine();
    noHandlerRule = {
      id: "no-handler",
      name: "No Click Handler",
      description: "Interactive elements like buttons must have click handlers",
      defaultSeverity: "error",
      check: (element, _context) => {
        const isButton = element.tagName === "button" || element.a11y.role === "button";
        const isDisabled = element.interactive.isDisabled;
        const hasHandler = element.interactive.hasOnClick;
        if (isButton && !isDisabled && !hasHandler) {
          return {
            ruleId: "no-handler",
            ruleName: "No Click Handler",
            severity: "error",
            message: `Button "${element.text || element.selector}" has no click handler`,
            element: element.selector,
            bounds: element.bounds,
            fix: "Add an onClick handler or make the button disabled"
          };
        }
        return null;
      }
    };
    placeholderLinkRule = {
      id: "placeholder-link",
      name: "Placeholder Link",
      description: "Links must have valid hrefs or click handlers",
      defaultSeverity: "error",
      check: (element, _context) => {
        const isLink = element.tagName === "a";
        const hasValidHref = element.interactive.hasHref;
        const hasHandler = element.interactive.hasOnClick;
        if (isLink && !hasValidHref && !hasHandler) {
          return {
            ruleId: "placeholder-link",
            ruleName: "Placeholder Link",
            severity: "error",
            message: `Link "${element.text || element.selector}" has placeholder href and no handler`,
            element: element.selector,
            bounds: element.bounds,
            fix: "Add a valid href or onClick handler"
          };
        }
        return null;
      }
    };
    touchTargetRule = {
      id: "touch-target-small",
      name: "Touch Target Too Small",
      description: "Interactive elements must meet minimum touch target size",
      defaultSeverity: "warn",
      check: (element, context, options) => {
        const isInteractive = element.interactive.hasOnClick || element.interactive.hasHref;
        if (!isInteractive) return null;
        const minSize = context.isMobile ? options?.mobileMinSize ?? 44 : options?.desktopMinSize ?? 24;
        const { width, height } = element.bounds;
        if (width < minSize || height < minSize) {
          return {
            ruleId: "touch-target-small",
            ruleName: "Touch Target Too Small",
            severity: "warn",
            message: `"${element.text || element.selector}" touch target is ${width}x${height}px (min: ${minSize}px)`,
            element: element.selector,
            bounds: element.bounds,
            fix: `Increase element size to at least ${minSize}x${minSize}px`
          };
        }
        return null;
      }
    };
    missingAriaLabelRule = {
      id: "missing-aria-label",
      name: "Missing Accessible Label",
      description: "Interactive elements without text need aria-label",
      defaultSeverity: "warn",
      check: (element, _context) => {
        const isInteractive = element.interactive.hasOnClick || element.interactive.hasHref;
        if (!isInteractive) return null;
        const hasText = element.text && element.text.trim().length > 0;
        const hasAriaLabel = element.a11y.ariaLabel && element.a11y.ariaLabel.trim().length > 0;
        if (!hasText && !hasAriaLabel) {
          return {
            ruleId: "missing-aria-label",
            ruleName: "Missing Accessible Label",
            severity: "warn",
            message: `"${element.selector}" is interactive but has no text or aria-label`,
            element: element.selector,
            bounds: element.bounds,
            fix: "Add visible text or aria-label attribute"
          };
        }
        return null;
      }
    };
    disabledNoVisualRule = {
      id: "disabled-no-visual",
      name: "Disabled Without Visual",
      description: "Disabled elements should have visual indication",
      defaultSeverity: "warn",
      check: (element, _context) => {
        if (!element.interactive.isDisabled) return null;
        const cursor = element.interactive.cursor;
        const hasDisabledCursor = cursor === "not-allowed" || cursor === "default";
        const bgColor = element.computedStyles?.backgroundColor;
        const hasGrayedBg = bgColor?.includes("gray") || bgColor?.includes("rgb(200") || bgColor?.includes("rgb(220");
        if (!hasDisabledCursor && !hasGrayedBg) {
          return {
            ruleId: "disabled-no-visual",
            ruleName: "Disabled Without Visual",
            severity: "warn",
            message: `"${element.text || element.selector}" is disabled but has no visual indication`,
            element: element.selector,
            bounds: element.bounds,
            fix: "Add cursor: not-allowed and/or gray background to disabled state"
          };
        }
        return null;
      }
    };
    minimalPreset = {
      name: "minimal",
      description: "Basic interactivity and accessibility checks",
      rules: [
        noHandlerRule,
        placeholderLinkRule,
        touchTargetRule,
        missingAriaLabelRule,
        disabledNoVisualRule
      ],
      defaults: {
        "no-handler": "error",
        "placeholder-link": "error",
        "touch-target-small": "warn",
        "missing-aria-label": "warn",
        "disabled-no-visual": "warn"
      }
    };
    rules = {
      noHandlerRule,
      placeholderLinkRule,
      touchTargetRule,
      missingAriaLabelRule,
      disabledNoVisualRule
    };
  }
});

// src/rules/engine.ts
var engine_exports = {};
__export(engine_exports, {
  createAuditResult: () => createAuditResult,
  formatAuditResult: () => formatAuditResult,
  getPreset: () => getPreset,
  listPresets: () => listPresets,
  loadRulesConfig: () => loadRulesConfig,
  registerPreset: () => registerPreset,
  runRules: () => runRules
});
function registerPreset(preset) {
  presets.set(preset.name, preset);
}
function getPreset(name) {
  return presets.get(name);
}
function listPresets() {
  return Array.from(presets.keys());
}
async function loadRulesConfig(projectDir) {
  const configPath = (0, import_path5.join)(projectDir, ".ibr", "rules.json");
  if (!(0, import_fs2.existsSync)(configPath)) {
    return { extends: ["minimal"] };
  }
  try {
    const content = await (0, import_promises5.readFile)(configPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.warn(`Failed to parse rules.json: ${error}`);
    return { extends: ["minimal"] };
  }
}
function mergeRuleSettings(presetNames, userRules = {}) {
  const allRules = [];
  const settings = /* @__PURE__ */ new Map();
  const seenRuleIds = /* @__PURE__ */ new Set();
  for (const presetName of presetNames) {
    const preset = presets.get(presetName);
    if (!preset) {
      console.warn(`Unknown preset: ${presetName}`);
      continue;
    }
    for (const rule of preset.rules) {
      if (!seenRuleIds.has(rule.id)) {
        allRules.push(rule);
        seenRuleIds.add(rule.id);
        const defaultSetting = preset.defaults[rule.id] ?? rule.defaultSeverity;
        if (typeof defaultSetting === "string") {
          settings.set(rule.id, { severity: defaultSetting });
        } else {
          settings.set(rule.id, { severity: defaultSetting[0], options: defaultSetting[1] });
        }
      }
    }
  }
  for (const [ruleId, setting] of Object.entries(userRules)) {
    if (typeof setting === "string") {
      settings.set(ruleId, { severity: setting });
    } else {
      settings.set(ruleId, { severity: setting[0], options: setting[1] });
    }
  }
  return { rules: allRules, settings };
}
function runRules(elements, context, config) {
  const { rules: rules2, settings } = mergeRuleSettings(config.extends ?? ["minimal"], config.rules);
  const violations = [];
  for (const element of elements) {
    for (const rule of rules2) {
      const setting = settings.get(rule.id);
      if (!setting || setting.severity === "off") {
        continue;
      }
      const violation = rule.check(element, context, setting.options);
      if (violation) {
        violations.push({
          ...violation,
          severity: setting.severity
        });
      }
    }
  }
  return violations;
}
function createAuditResult(url, elements, violations) {
  const errors = violations.filter((v) => v.severity === "error").length;
  const warnings = violations.filter((v) => v.severity === "warn").length;
  return {
    url,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    elementsScanned: elements.length,
    violations,
    summary: {
      errors,
      warnings,
      passed: elements.length - errors - warnings
    }
  };
}
function formatAuditResult(result) {
  const lines = [];
  lines.push(`IBR Audit: ${result.url}`);
  lines.push(`Scanned: ${result.elementsScanned} elements`);
  lines.push("");
  if (result.violations.length === 0) {
    lines.push("No violations found.");
  } else {
    lines.push(`Found ${result.summary.errors} errors, ${result.summary.warnings} warnings:`);
    lines.push("");
    for (const v of result.violations) {
      const icon = v.severity === "error" ? "\u2717" : "!";
      lines.push(`  ${icon} [${v.ruleId}] ${v.message}`);
      if (v.element) {
        lines.push(`    Element: ${v.element.slice(0, 60)}${v.element.length > 60 ? "..." : ""}`);
      }
      if (v.fix) {
        lines.push(`    Fix: ${v.fix}`);
      }
    }
  }
  lines.push("");
  lines.push(`Summary: ${result.summary.errors} errors, ${result.summary.warnings} warnings, ${result.summary.passed} passed`);
  return lines.join("\n");
}
var import_promises5, import_fs2, import_path5, presets;
var init_engine = __esm({
  "src/rules/engine.ts"() {
    "use strict";
    import_promises5 = require("fs/promises");
    import_fs2 = require("fs");
    import_path5 = require("path");
    presets = /* @__PURE__ */ new Map();
    Promise.resolve().then(() => (init_minimal(), minimal_exports)).then((m) => m.register()).catch(() => {
    });
  }
});

// src/extract.ts
var extract_exports = {};
__export(extract_exports, {
  analyzeElements: () => analyzeElements,
  closeBrowser: () => closeBrowser2,
  extractFromURL: () => extractFromURL,
  extractInteractiveElements: () => extractInteractiveElements,
  getReferenceSessionPaths: () => getReferenceSessionPaths
});
async function getBrowser2() {
  if (!browser2) {
    browser2 = await import_playwright5.chromium.launch({
      headless: true
    });
  }
  return browser2;
}
async function closeBrowser2() {
  if (browser2) {
    await browser2.close();
    browser2 = null;
  }
}
async function checkLock(outputDir) {
  const lockPath = (0, import_path6.join)(outputDir, LOCK_FILE);
  if (!(0, import_fs3.existsSync)(lockPath)) {
    return false;
  }
  try {
    const content = await (0, import_promises6.readFile)(lockPath, "utf-8");
    const timestamp = parseInt(content, 10);
    const age = Date.now() - timestamp;
    if (age > LOCK_TIMEOUT_MS) {
      await (0, import_promises6.unlink)(lockPath);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
async function createLock(outputDir) {
  const lockPath = (0, import_path6.join)(outputDir, LOCK_FILE);
  await (0, import_promises6.writeFile)(lockPath, Date.now().toString());
}
async function releaseLock(outputDir) {
  const lockPath = (0, import_path6.join)(outputDir, LOCK_FILE);
  try {
    await (0, import_promises6.unlink)(lockPath);
  } catch {
  }
}
async function extractElementStyles(page, selector) {
  return page.evaluate(
    ({ sel, props }) => {
      const elements = document.querySelectorAll(sel);
      const results = [];
      elements.forEach((el, index) => {
        const htmlEl = el;
        const rect = htmlEl.getBoundingClientRect();
        const computed = window.getComputedStyle(htmlEl);
        const styles = {};
        props.forEach((prop) => {
          const value = computed.getPropertyValue(
            prop.replace(/([A-Z])/g, "-$1").toLowerCase()
          );
          if (value && value !== "none" && value !== "normal" && value !== "0px") {
            styles[prop] = value;
          }
        });
        results.push({
          selector: `${sel}:nth-of-type(${index + 1})`,
          tagName: htmlEl.tagName.toLowerCase(),
          id: htmlEl.id || void 0,
          className: htmlEl.className || void 0,
          bounds: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          },
          computedStyles: styles
        });
      });
      return results;
    },
    { sel: selector, props: CSS_PROPERTIES_TO_EXTRACT }
  );
}
async function extractInteractiveElements(page) {
  return page.evaluate((selectors) => {
    const seen = /* @__PURE__ */ new Set();
    const elements = [];
    function generateSelector(el) {
      if (el.id) return `#${el.id}`;
      const path = [];
      let current = el;
      while (current && current !== document.body) {
        let selector = current.tagName.toLowerCase();
        if (current.id) {
          selector = `#${current.id}`;
          path.unshift(selector);
          break;
        } else if (current.className && typeof current.className === "string") {
          const classes = current.className.split(" ").filter((c) => c.trim() && !c.includes(":"));
          if (classes.length > 0) {
            selector += `.${classes[0]}`;
          }
        }
        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(
            (c) => c.tagName === current.tagName
          );
          if (siblings.length > 1) {
            const index = siblings.indexOf(current) + 1;
            selector += `:nth-of-type(${index})`;
          }
        }
        path.unshift(selector);
        current = current.parentElement;
      }
      return path.join(" > ").slice(0, 200);
    }
    function detectHandlers(el) {
      const keys = Object.keys(el);
      const reactPropsKey = keys.find((k) => k.startsWith("__reactProps$"));
      let hasReactHandler = false;
      if (reactPropsKey) {
        const props = el[reactPropsKey];
        hasReactHandler = !!(props?.onClick || props?.onSubmit || props?.onMouseDown);
      }
      const fiberKey = keys.find((k) => k.startsWith("__reactFiber$"));
      if (!hasReactHandler && fiberKey) {
        const fiber = el[fiberKey];
        hasReactHandler = !!(fiber?.pendingProps?.onClick || fiber?.memoizedProps?.onClick);
      }
      const hasVueHandler = !!(el.__vue__?.$listeners?.click || el.__vnode?.props?.onClick);
      const hasAngularHandler = !!el.__ngContext__ || el.hasAttribute("ng-click");
      const hasVanillaHandler = typeof el.onclick === "function" || el.hasAttribute("onclick");
      return {
        hasReactHandler,
        hasVueHandler,
        hasAngularHandler,
        hasVanillaHandler,
        hasAnyHandler: hasReactHandler || hasVueHandler || hasAngularHandler || hasVanillaHandler
      };
    }
    for (const selector of selectors) {
      try {
        document.querySelectorAll(selector).forEach((el) => {
          if (seen.has(el)) return;
          seen.add(el);
          const htmlEl = el;
          const rect = htmlEl.getBoundingClientRect();
          const computed = window.getComputedStyle(htmlEl);
          const handlers = detectHandlers(htmlEl);
          const href = htmlEl.getAttribute("href");
          const hasValidHref = href !== null && href !== "#" && href !== "" && !href.startsWith("javascript:");
          elements.push({
            selector: generateSelector(htmlEl),
            tagName: htmlEl.tagName.toLowerCase(),
            id: htmlEl.id || void 0,
            className: typeof htmlEl.className === "string" ? htmlEl.className : void 0,
            text: (htmlEl.textContent || "").trim().slice(0, 100) || void 0,
            bounds: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            },
            computedStyles: {
              cursor: computed.cursor,
              color: computed.color,
              backgroundColor: computed.backgroundColor
            },
            interactive: {
              hasOnClick: handlers.hasAnyHandler,
              hasHref: hasValidHref,
              isDisabled: htmlEl.hasAttribute("disabled") || htmlEl.getAttribute("aria-disabled") === "true" || computed.pointerEvents === "none",
              tabIndex: parseInt(htmlEl.getAttribute("tabindex") || "0", 10),
              cursor: computed.cursor,
              hasReactHandler: handlers.hasReactHandler || void 0,
              hasVueHandler: handlers.hasVueHandler || void 0,
              hasAngularHandler: handlers.hasAngularHandler || void 0
            },
            a11y: {
              role: htmlEl.getAttribute("role"),
              ariaLabel: htmlEl.getAttribute("aria-label"),
              ariaDescribedBy: htmlEl.getAttribute("aria-describedby"),
              ariaHidden: htmlEl.getAttribute("aria-hidden") === "true" || void 0
            },
            sourceHint: {
              dataTestId: htmlEl.getAttribute("data-testid")
            }
          });
        });
      } catch {
      }
    }
    return elements;
  }, INTERACTIVE_SELECTORS);
}
function analyzeElements(elements, isMobile = false) {
  const issues = [];
  let withHandlers = 0;
  let withoutHandlers = 0;
  const interactiveElements = elements.filter((el) => {
    const isButton = el.tagName === "button" || el.a11y.role === "button";
    const isLink = el.tagName === "a";
    const isInput = ["input", "select", "textarea"].includes(el.tagName);
    const looksClickable = el.interactive.cursor === "pointer";
    return isButton || isLink || isInput || looksClickable;
  });
  for (const el of interactiveElements) {
    const isButton = el.tagName === "button" || el.a11y.role === "button";
    const isLink = el.tagName === "a";
    const hasHandler = el.interactive.hasOnClick || el.interactive.hasHref;
    if (hasHandler) {
      withHandlers++;
    } else {
      withoutHandlers++;
    }
    if (isButton && !el.interactive.hasOnClick && !el.interactive.isDisabled) {
      issues.push({
        type: "NO_HANDLER",
        severity: "error",
        message: `Button "${el.text || el.selector}" has no click handler`
      });
    }
    if (isLink && !el.interactive.hasHref && !el.interactive.hasOnClick) {
      issues.push({
        type: "PLACEHOLDER_LINK",
        severity: "error",
        message: `Link "${el.text || el.selector}" has placeholder href and no handler`
      });
    }
    const minSize = isMobile ? 44 : 24;
    if (el.bounds.width < minSize || el.bounds.height < minSize) {
      issues.push({
        type: "TOUCH_TARGET_SMALL",
        severity: isMobile ? "error" : "warning",
        message: `"${el.text || el.selector}" touch target is ${el.bounds.width}x${el.bounds.height}px (min: ${minSize}px)`
      });
    }
    if (hasHandler && !el.text && !el.a11y.ariaLabel) {
      issues.push({
        type: "MISSING_ARIA_LABEL",
        severity: "warning",
        message: `"${el.selector}" is interactive but has no text or aria-label`
      });
    }
  }
  return {
    totalElements: elements.length,
    interactiveCount: interactiveElements.length,
    withHandlers,
    withoutHandlers,
    issues
  };
}
async function extractCSSVariables(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const computed = window.getComputedStyle(root);
    const variables = {};
    const sheets = Array.from(document.styleSheets);
    sheets.forEach((sheet) => {
      try {
        const rules2 = Array.from(sheet.cssRules || []);
        rules2.forEach((rule) => {
          if (rule instanceof CSSStyleRule && rule.selectorText === ":root") {
            const style = rule.style;
            for (let i = 0; i < style.length; i++) {
              const prop = style[i];
              if (prop.startsWith("--")) {
                variables[prop] = style.getPropertyValue(prop).trim();
              }
            }
          }
        });
      } catch {
      }
    });
    const rootStyles = getComputedStyle(root);
    ["--primary", "--secondary", "--accent", "--background", "--foreground", "--border", "--radius", "--spacing"].forEach((prefix) => {
      for (let i = 0; i < 20; i++) {
        const variations = [
          prefix,
          `${prefix}-${i}`,
          `${prefix}-color`,
          `${prefix}-bg`
        ];
        variations.forEach((varName) => {
          const value = rootStyles.getPropertyValue(varName).trim();
          if (value && !variables[varName]) {
            variables[varName] = value;
          }
        });
      }
    });
    return variables;
  });
}
async function extractFromURL(options) {
  const {
    url,
    outputDir,
    sessionId,
    viewport = VIEWPORTS.desktop,
    timeout = EXTRACTION_TIMEOUT_MS,
    selectors = DEFAULT_SELECTORS
  } = options;
  if (await checkLock(outputDir)) {
    throw new Error("Another extraction is in progress. Please wait.");
  }
  const sessionDir = (0, import_path6.join)(outputDir, "sessions", sessionId);
  await (0, import_promises6.mkdir)(sessionDir, { recursive: true });
  await createLock(outputDir);
  const browserInstance = await getBrowser2();
  let timeoutHandle = null;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`Extraction timed out after ${timeout}ms`));
      }, timeout);
    });
    const extractionPromise = async () => {
      const context = await browserInstance.newContext({
        viewport: {
          width: viewport.width,
          height: viewport.height
        },
        reducedMotion: "reduce"
      });
      const page = await context.newPage();
      try {
        await page.goto(url, {
          waitUntil: "networkidle",
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
        const html = await page.content();
        const elements = [];
        for (const selector of selectors) {
          const extracted = await extractElementStyles(page, selector);
          elements.push(...extracted);
        }
        const cssVariables = await extractCSSVariables(page);
        const screenshotPath = (0, import_path6.join)(sessionDir, "reference.png");
        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
          type: "png"
        });
        const result2 = {
          url,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          viewport,
          html,
          elements,
          cssVariables,
          screenshotPath
        };
        await (0, import_promises6.writeFile)(
          (0, import_path6.join)(sessionDir, "reference.json"),
          JSON.stringify(result2, null, 2)
        );
        await (0, import_promises6.writeFile)((0, import_path6.join)(sessionDir, "reference.html"), html);
        return result2;
      } finally {
        await context.close();
      }
    };
    const result = await Promise.race([extractionPromise(), timeoutPromise]);
    return result;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    await releaseLock(outputDir);
  }
}
function getReferenceSessionPaths(outputDir, sessionId) {
  const root = (0, import_path6.join)(outputDir, "sessions", sessionId);
  return {
    root,
    sessionJson: (0, import_path6.join)(root, "session.json"),
    reference: (0, import_path6.join)(root, "reference.png"),
    referenceHtml: (0, import_path6.join)(root, "reference.html"),
    referenceData: (0, import_path6.join)(root, "reference.json"),
    current: (0, import_path6.join)(root, "current.png"),
    diff: (0, import_path6.join)(root, "diff.png")
  };
}
var import_playwright5, import_promises6, import_fs3, import_path6, LOCK_FILE, LOCK_TIMEOUT_MS, EXTRACTION_TIMEOUT_MS, DEFAULT_SELECTORS, CSS_PROPERTIES_TO_EXTRACT, browser2, INTERACTIVE_SELECTORS;
var init_extract = __esm({
  "src/extract.ts"() {
    "use strict";
    import_playwright5 = require("playwright");
    import_promises6 = require("fs/promises");
    import_fs3 = require("fs");
    import_path6 = require("path");
    init_schemas();
    LOCK_FILE = ".extracting";
    LOCK_TIMEOUT_MS = 18e4;
    EXTRACTION_TIMEOUT_MS = 12e4;
    DEFAULT_SELECTORS = [
      "header",
      "nav",
      "main",
      "section",
      "article",
      "aside",
      "footer",
      "h1",
      "h2",
      "h3",
      "button",
      "a[href]",
      "form",
      "input",
      "img"
    ];
    CSS_PROPERTIES_TO_EXTRACT = [
      "display",
      "position",
      "width",
      "height",
      "padding",
      "margin",
      "backgroundColor",
      "color",
      "fontSize",
      "fontFamily",
      "fontWeight",
      "lineHeight",
      "textAlign",
      "borderRadius",
      "border",
      "boxShadow",
      "gap",
      "flexDirection",
      "alignItems",
      "justifyContent",
      "gridTemplateColumns",
      "gridTemplateRows"
    ];
    browser2 = null;
    INTERACTIVE_SELECTORS = [
      "button",
      "a[href]",
      "a:not([href])",
      // Links without href (potential issues)
      'input[type="submit"]',
      'input[type="button"]',
      'input[type="text"]',
      'input[type="email"]',
      'input[type="password"]',
      "select",
      "textarea",
      '[role="button"]',
      '[role="link"]',
      "[onclick]",
      '[tabindex]:not([tabindex="-1"])'
    ];
  }
});

// src/browser-server.ts
var browser_server_exports = {};
__export(browser_server_exports, {
  PersistentSession: () => PersistentSession,
  connectToBrowserServer: () => connectToBrowserServer,
  isServerRunning: () => isServerRunning,
  listActiveSessions: () => listActiveSessions,
  startBrowserServer: () => startBrowserServer,
  stopBrowserServer: () => stopBrowserServer
});
function getPaths(outputDir) {
  return {
    stateFile: (0, import_path7.join)(outputDir, SERVER_STATE_FILE),
    profileDir: (0, import_path7.join)(outputDir, ISOLATED_PROFILE_DIR),
    sessionsDir: (0, import_path7.join)(outputDir, "sessions")
  };
}
async function isServerRunning(outputDir) {
  const { stateFile } = getPaths(outputDir);
  if (!(0, import_fs4.existsSync)(stateFile)) {
    return false;
  }
  try {
    const content = await (0, import_promises7.readFile)(stateFile, "utf-8");
    const state = JSON.parse(content);
    const browser3 = await import_playwright6.chromium.connect(state.wsEndpoint, { timeout: 2e3 });
    await browser3.close();
    return true;
  } catch {
    await cleanupServerState(outputDir);
    return false;
  }
}
async function cleanupServerState(outputDir) {
  const { stateFile } = getPaths(outputDir);
  try {
    await (0, import_promises7.unlink)(stateFile);
  } catch {
  }
}
async function startBrowserServer(outputDir, options = {}) {
  const { stateFile, profileDir } = getPaths(outputDir);
  const headless = options.headless ?? !options.debug;
  const isolated = options.isolated ?? true;
  if (await isServerRunning(outputDir)) {
    throw new Error("Browser server already running. Use session:close all to stop it first.");
  }
  await (0, import_promises7.mkdir)(outputDir, { recursive: true });
  if (isolated) {
    await (0, import_promises7.mkdir)(profileDir, { recursive: true });
  }
  const debugPort = 9222 + Math.floor(Math.random() * 1e3);
  const server = await import_playwright6.chromium.launchServer({
    headless,
    slowMo: options.debug ? 100 : 0,
    args: [`--remote-debugging-port=${debugPort}`]
  });
  const wsEndpoint = server.wsEndpoint();
  const cdpUrl = `http://127.0.0.1:${debugPort}`;
  const state = {
    wsEndpoint,
    cdpUrl,
    pid: process.pid,
    startedAt: (/* @__PURE__ */ new Date()).toISOString(),
    headless,
    isolatedProfile: isolated ? profileDir : ""
  };
  await (0, import_promises7.writeFile)(stateFile, JSON.stringify(state, null, 2));
  return { server, wsEndpoint };
}
async function connectToBrowserServer(outputDir) {
  const { stateFile } = getPaths(outputDir);
  if (!(0, import_fs4.existsSync)(stateFile)) {
    return null;
  }
  try {
    const content = await (0, import_promises7.readFile)(stateFile, "utf-8");
    const state = JSON.parse(content);
    if (state.cdpUrl) {
      const browser4 = await import_playwright6.chromium.connectOverCDP(state.cdpUrl, { timeout: 5e3 });
      return browser4;
    }
    const browser3 = await import_playwright6.chromium.connect(state.wsEndpoint, { timeout: 5e3 });
    return browser3;
  } catch (error) {
    await cleanupServerState(outputDir);
    return null;
  }
}
async function stopBrowserServer(outputDir) {
  const { stateFile, profileDir } = getPaths(outputDir);
  if (!(0, import_fs4.existsSync)(stateFile)) {
    return false;
  }
  try {
    const content = await (0, import_promises7.readFile)(stateFile, "utf-8");
    const state = JSON.parse(content);
    const browser3 = await import_playwright6.chromium.connect(state.wsEndpoint, { timeout: 5e3 });
    await browser3.close();
    await (0, import_promises7.unlink)(stateFile);
    return true;
  } catch {
    await cleanupServerState(outputDir);
    return false;
  }
}
async function listActiveSessions(outputDir) {
  const { sessionsDir } = getPaths(outputDir);
  if (!(0, import_fs4.existsSync)(sessionsDir)) {
    return [];
  }
  const { readdir: readdir2 } = await import("fs/promises");
  const entries = await readdir2(sessionsDir, { withFileTypes: true });
  const liveSessions = [];
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith("live_")) {
      const statePath = (0, import_path7.join)(sessionsDir, entry.name, "live-session.json");
      if ((0, import_fs4.existsSync)(statePath)) {
        liveSessions.push(entry.name);
      }
    }
  }
  return liveSessions;
}
var import_playwright6, import_promises7, import_fs4, import_path7, import_nanoid2, SERVER_STATE_FILE, ISOLATED_PROFILE_DIR, PersistentSession;
var init_browser_server = __esm({
  "src/browser-server.ts"() {
    "use strict";
    import_playwright6 = require("playwright");
    import_promises7 = require("fs/promises");
    import_fs4 = require("fs");
    import_path7 = require("path");
    import_nanoid2 = require("nanoid");
    init_schemas();
    init_extract();
    SERVER_STATE_FILE = "browser-server.json";
    ISOLATED_PROFILE_DIR = "browser-profile";
    PersistentSession = class _PersistentSession {
      browser;
      context;
      page;
      state;
      sessionDir;
      constructor(browser3, context, page, state, sessionDir) {
        this.browser = browser3;
        this.context = context;
        this.page = page;
        this.state = state;
        this.sessionDir = sessionDir;
      }
      /**
       * Create a new session using the browser server
       */
      static async create(outputDir, options) {
        const { url, name, viewport = VIEWPORTS.desktop, waitFor, timeout = 3e4 } = options;
        const browser3 = await connectToBrowserServer(outputDir);
        if (!browser3) {
          throw new Error(
            "No browser server running.\nStart one with: npx ibr session:start <url>\nThe first session:start launches the server and keeps it alive."
          );
        }
        const sessionId = `live_${(0, import_nanoid2.nanoid)(10)}`;
        const sessionsDir = (0, import_path7.join)(outputDir, "sessions");
        const sessionDir = (0, import_path7.join)(sessionsDir, sessionId);
        await (0, import_promises7.mkdir)(sessionDir, { recursive: true });
        const context = await browser3.newContext({
          viewport: {
            width: viewport.width,
            height: viewport.height
          },
          reducedMotion: "reduce"
        });
        const page = await context.newPage();
        const navStart = Date.now();
        await page.goto(url, {
          waitUntil: "networkidle",
          timeout
        });
        if (waitFor) {
          await page.waitForSelector(waitFor, { timeout });
        }
        const navDuration = Date.now() - navStart;
        const state = {
          id: sessionId,
          url,
          name: name || new URL(url).pathname,
          viewport,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          pageIndex: 0,
          actions: [{
            type: "navigate",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { url, waitFor },
            success: true,
            duration: navDuration
          }]
        };
        await (0, import_promises7.writeFile)(
          (0, import_path7.join)(sessionDir, "live-session.json"),
          JSON.stringify(state, null, 2)
        );
        await page.screenshot({
          path: (0, import_path7.join)(sessionDir, "baseline.png"),
          fullPage: false
        });
        return new _PersistentSession(browser3, context, page, state, sessionDir);
      }
      /**
       * Get session from browser server by ID
       */
      static async get(outputDir, sessionId) {
        const sessionDir = (0, import_path7.join)(outputDir, "sessions", sessionId);
        const statePath = (0, import_path7.join)(sessionDir, "live-session.json");
        if (!(0, import_fs4.existsSync)(statePath)) {
          return null;
        }
        const browser3 = await connectToBrowserServer(outputDir);
        if (!browser3) {
          return null;
        }
        const content = await (0, import_promises7.readFile)(statePath, "utf-8");
        const state = JSON.parse(content);
        const contexts = browser3.contexts();
        let context;
        let page;
        const targetHost = new URL(state.url).host;
        if (contexts.length > 0) {
          for (const ctx of contexts) {
            const pages = ctx.pages();
            for (const p of pages) {
              if (p.url().includes(targetHost)) {
                context = ctx;
                page = p;
                return new _PersistentSession(browser3, context, page, state, sessionDir);
              }
            }
          }
        }
        context = await browser3.newContext({
          viewport: {
            width: state.viewport.width,
            height: state.viewport.height
          },
          reducedMotion: "reduce"
        });
        page = await context.newPage();
        await page.goto(state.url, { waitUntil: "networkidle" });
        return new _PersistentSession(browser3, context, page, state, sessionDir);
      }
      get id() {
        return this.state.id;
      }
      get url() {
        return this.page?.url() || this.state.url;
      }
      get actions() {
        return [...this.state.actions];
      }
      async recordAction(action) {
        this.state.actions.push(action);
        await this.saveState();
      }
      async saveState() {
        await (0, import_promises7.writeFile)(
          (0, import_path7.join)(this.sessionDir, "live-session.json"),
          JSON.stringify(this.state, null, 2)
        );
      }
      async navigate(url, options) {
        const start = Date.now();
        try {
          await this.page.goto(url, {
            waitUntil: "networkidle",
            timeout: options?.timeout || 3e4
          });
          if (options?.waitFor) {
            await this.page.waitForSelector(options.waitFor, { timeout: options?.timeout || 3e4 });
          }
          this.state.url = url;
          await this.recordAction({
            type: "navigate",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { url, waitFor: options?.waitFor },
            success: true,
            duration: Date.now() - start
          });
        } catch (error) {
          await this.recordAction({
            type: "navigate",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { url },
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start
          });
          throw error;
        }
      }
      async click(selector, options) {
        const start = Date.now();
        const timeout = options?.timeout || 5e3;
        try {
          const locator = this.page.locator(selector).filter({ visible: true }).first();
          await locator.click({ timeout });
          await this.recordAction({
            type: "click",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { selector },
            success: true,
            duration: Date.now() - start
          });
        } catch (error) {
          await this.recordAction({
            type: "click",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { selector },
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start
          });
          throw error;
        }
      }
      async type(selector, text, options) {
        const start = Date.now();
        const timeout = options?.timeout || 5e3;
        try {
          const locator = this.page.locator(selector).filter({ visible: true }).first();
          await locator.fill("", { timeout });
          if (options?.delay && options.delay > 0) {
            await locator.pressSequentially(text, { delay: options.delay, timeout });
          } else {
            await locator.fill(text, { timeout });
          }
          if (options?.submit) {
            await locator.press("Enter", { timeout });
            if (options?.waitAfter) {
              await this.page.waitForTimeout(options.waitAfter);
            } else {
              await this.page.waitForLoadState("networkidle", { timeout: 1e4 }).catch(() => {
              });
            }
          } else if (options?.waitAfter) {
            await this.page.waitForTimeout(options.waitAfter);
          }
          await this.recordAction({
            type: "type",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { selector, text: text.length > 50 ? `${text.slice(0, 50)}...` : text, submit: options?.submit },
            success: true,
            duration: Date.now() - start
          });
        } catch (error) {
          await this.recordAction({
            type: "type",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { selector, text: text.length > 50 ? `${text.slice(0, 50)}...` : text },
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start
          });
          throw error;
        }
      }
      async waitFor(selectorOrTime, options) {
        const start = Date.now();
        try {
          if (typeof selectorOrTime === "number") {
            await this.page.waitForTimeout(selectorOrTime);
          } else {
            const locator = this.page.locator(selectorOrTime).filter({ visible: true }).first();
            await locator.waitFor({
              state: "visible",
              timeout: options?.timeout || 3e4
            });
          }
          await this.recordAction({
            type: "wait",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { target: selectorOrTime },
            success: true,
            duration: Date.now() - start
          });
        } catch (error) {
          await this.recordAction({
            type: "wait",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { target: selectorOrTime },
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start
          });
          throw error;
        }
      }
      async screenshot(options) {
        const start = Date.now();
        const screenshotName = options?.name || `screenshot-${Date.now()}`;
        const outputPath = (0, import_path7.join)(this.sessionDir, `${screenshotName}.png`);
        try {
          await this.page.addStyleTag({
            content: `
          *, *::before, *::after {
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            transition-duration: 0s !important;
            transition-delay: 0s !important;
          }
        `
          });
          if (options?.selector) {
            const element = await this.page.waitForSelector(options.selector, { timeout: 5e3 });
            if (!element) {
              throw new Error(`Element not found: ${options.selector}`);
            }
            await element.screenshot({ path: outputPath, type: "png" });
          } else {
            await this.page.screenshot({
              path: outputPath,
              fullPage: options?.fullPage ?? true,
              type: "png"
            });
          }
          const elements = await extractInteractiveElements(this.page);
          const isMobile = this.state.viewport.width < 768;
          const audit = analyzeElements(elements, isMobile);
          this.state.elements = elements;
          this.state.audit = audit;
          await this.saveState();
          await this.recordAction({
            type: "screenshot",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: {
              name: screenshotName,
              path: outputPath,
              selector: options?.selector,
              elementsCount: elements.length,
              issuesCount: audit.issues.length
            },
            success: true,
            duration: Date.now() - start
          });
          return { path: outputPath, elements, audit };
        } catch (error) {
          await this.recordAction({
            type: "screenshot",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { name: screenshotName, selector: options?.selector },
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start
          });
          throw error;
        }
      }
      async press(key) {
        await this.page.keyboard.press(key);
      }
      async evaluate(script) {
        return this.page.evaluate(script);
      }
      async content() {
        return this.page.content();
      }
      async title() {
        return this.page.title();
      }
      /**
       * Get text content from a specific selector
       */
      async textContent(selector) {
        return this.page.textContent(selector);
      }
      /**
       * Get inner text from a specific selector (visible text only)
       */
      async innerText(selector) {
        return this.page.innerText(selector);
      }
      /**
       * Get all matching elements' text content
       */
      async allTextContent(selector) {
        const elements = await this.page.$$(selector);
        const texts = [];
        for (const el of elements) {
          const text = await el.textContent();
          if (text) texts.push(text.trim());
        }
        return texts;
      }
      /**
       * Close just this session (not the browser server)
       */
      async close() {
        await this.context.close();
      }
      /**
       * Get raw Playwright page
       */
      getPage() {
        return this.page;
      }
    };
  }
});

// src/live-session.ts
var live_session_exports = {};
__export(live_session_exports, {
  LiveSession: () => LiveSession,
  liveSessionManager: () => liveSessionManager
});
var import_playwright7, import_promises8, import_fs5, import_path8, import_nanoid3, LiveSession, LiveSessionManager, liveSessionManager;
var init_live_session = __esm({
  "src/live-session.ts"() {
    "use strict";
    import_playwright7 = require("playwright");
    import_promises8 = require("fs/promises");
    import_fs5 = require("fs");
    import_path8 = require("path");
    import_nanoid3 = require("nanoid");
    init_schemas();
    LiveSession = class _LiveSession {
      browser = null;
      context = null;
      page = null;
      state;
      outputDir;
      sessionDir;
      constructor(state, outputDir, browser3, context, page) {
        this.state = state;
        this.outputDir = outputDir;
        this.sessionDir = (0, import_path8.join)(outputDir, "sessions", state.id);
        this.browser = browser3;
        this.context = context;
        this.page = page;
      }
      /**
       * Create a new live session
       */
      static async create(outputDir, options) {
        const {
          url,
          name,
          viewport = VIEWPORTS.desktop,
          sandbox = false,
          debug = false,
          timeout = 3e4
        } = options;
        const sessionId = `live_${(0, import_nanoid3.nanoid)(10)}`;
        const sessionDir = (0, import_path8.join)(outputDir, "sessions", sessionId);
        await (0, import_promises8.mkdir)(sessionDir, { recursive: true });
        const browser3 = await import_playwright7.chromium.launch({
          headless: !sandbox && !debug,
          slowMo: debug ? 100 : 0,
          devtools: debug
        });
        const context = await browser3.newContext({
          viewport: {
            width: viewport.width,
            height: viewport.height
          },
          reducedMotion: "reduce"
        });
        const page = await context.newPage();
        const navStart = Date.now();
        await page.goto(url, {
          waitUntil: "networkidle",
          timeout
        });
        const navDuration = Date.now() - navStart;
        const state = {
          id: sessionId,
          url,
          name: name || new URL(url).pathname,
          viewport,
          sandbox: sandbox || debug,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          actions: [{
            type: "navigate",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { url },
            success: true,
            duration: navDuration
          }]
        };
        await (0, import_promises8.writeFile)(
          (0, import_path8.join)(sessionDir, "live-session.json"),
          JSON.stringify(state, null, 2)
        );
        await page.screenshot({
          path: (0, import_path8.join)(sessionDir, "baseline.png"),
          fullPage: false
        });
        return new _LiveSession(state, outputDir, browser3, context, page);
      }
      /**
       * Resume an existing live session (if browser still running)
       * Note: This only works within the same process - browser state is not persisted
       */
      static async resume(outputDir, sessionId) {
        const sessionDir = (0, import_path8.join)(outputDir, "sessions", sessionId);
        const statePath = (0, import_path8.join)(sessionDir, "live-session.json");
        if (!(0, import_fs5.existsSync)(statePath)) {
          return null;
        }
        const content = await (0, import_promises8.readFile)(statePath, "utf-8");
        const state = JSON.parse(content);
        const browser3 = await import_playwright7.chromium.launch({
          headless: !state.sandbox
        });
        const context = await browser3.newContext({
          viewport: {
            width: state.viewport.width,
            height: state.viewport.height
          },
          reducedMotion: "reduce"
        });
        const page = await context.newPage();
        await page.goto(state.url, { waitUntil: "networkidle" });
        return new _LiveSession(state, outputDir, browser3, context, page);
      }
      /**
       * Get session ID
       */
      get id() {
        return this.state.id;
      }
      /**
       * Get current URL
       */
      get url() {
        return this.page?.url() || this.state.url;
      }
      /**
       * Get action history
       */
      get actions() {
        return [...this.state.actions];
      }
      /**
       * Record an action
       */
      async recordAction(action) {
        this.state.actions.push(action);
        await this.saveState();
      }
      /**
       * Save session state
       */
      async saveState() {
        await (0, import_promises8.writeFile)(
          (0, import_path8.join)(this.sessionDir, "live-session.json"),
          JSON.stringify(this.state, null, 2)
        );
      }
      /**
       * Ensure page is available
       */
      ensurePage() {
        if (!this.page) {
          throw new Error("Session is closed. Create a new session.");
        }
        return this.page;
      }
      /**
       * Navigate to a new URL
       */
      async navigate(url, options) {
        const page = this.ensurePage();
        const start = Date.now();
        try {
          await page.goto(url, {
            waitUntil: "networkidle",
            timeout: options?.timeout || 3e4
          });
          this.state.url = url;
          await this.recordAction({
            type: "navigate",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { url },
            success: true,
            duration: Date.now() - start
          });
        } catch (error) {
          await this.recordAction({
            type: "navigate",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { url },
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start
          });
          throw error;
        }
      }
      /**
       * Click an element
       */
      async click(selector, options) {
        const page = this.ensurePage();
        const start = Date.now();
        try {
          await page.click(selector, { timeout: options?.timeout || 5e3 });
          await this.recordAction({
            type: "click",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { selector },
            success: true,
            duration: Date.now() - start
          });
        } catch (error) {
          await this.recordAction({
            type: "click",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { selector },
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start
          });
          throw error;
        }
      }
      /**
       * Type text into an element (clears existing content first)
       */
      async type(selector, text, options) {
        const page = this.ensurePage();
        const start = Date.now();
        try {
          await page.fill(selector, "");
          await page.type(selector, text, { delay: options?.delay || 0 });
          await this.recordAction({
            type: "type",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { selector, text: text.length > 50 ? `${text.slice(0, 50)}...` : text },
            success: true,
            duration: Date.now() - start
          });
        } catch (error) {
          await this.recordAction({
            type: "type",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { selector, text: text.length > 50 ? `${text.slice(0, 50)}...` : text },
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start
          });
          throw error;
        }
      }
      /**
       * Fill a form with multiple fields
       */
      async fill(fields) {
        const page = this.ensurePage();
        const start = Date.now();
        const results = [];
        for (const field of fields) {
          try {
            if (field.type === "checkbox") {
              if (field.value === "true" || field.value === "1") {
                await page.check(field.selector);
              } else {
                await page.uncheck(field.selector);
              }
            } else if (field.type === "select") {
              await page.selectOption(field.selector, field.value);
            } else {
              await page.fill(field.selector, field.value);
            }
            results.push({ selector: field.selector, success: true });
          } catch (error) {
            results.push({
              selector: field.selector,
              success: false,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
        const allSuccess = results.every((r) => r.success);
        await this.recordAction({
          type: "fill",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          params: { fields: fields.map((f) => ({ selector: f.selector, type: f.type || "text" })), results },
          success: allSuccess,
          error: allSuccess ? void 0 : `Failed to fill ${results.filter((r) => !r.success).length} field(s)`,
          duration: Date.now() - start
        });
        if (!allSuccess) {
          const failed = results.filter((r) => !r.success);
          throw new Error(`Failed to fill fields: ${failed.map((f) => f.selector).join(", ")}`);
        }
      }
      /**
       * Hover over an element
       */
      async hover(selector, options) {
        const page = this.ensurePage();
        const start = Date.now();
        try {
          await page.hover(selector, { timeout: options?.timeout || 5e3 });
          await this.recordAction({
            type: "hover",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { selector },
            success: true,
            duration: Date.now() - start
          });
        } catch (error) {
          await this.recordAction({
            type: "hover",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { selector },
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start
          });
          throw error;
        }
      }
      /**
       * Execute JavaScript in the page context
       */
      async evaluate(script) {
        const page = this.ensurePage();
        const start = Date.now();
        try {
          const result = await page.evaluate(script);
          await this.recordAction({
            type: "evaluate",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { script: typeof script === "string" ? script.slice(0, 100) : "[function]" },
            success: true,
            duration: Date.now() - start
          });
          return result;
        } catch (error) {
          await this.recordAction({
            type: "evaluate",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { script: typeof script === "string" ? script.slice(0, 100) : "[function]" },
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start
          });
          throw error;
        }
      }
      /**
       * Wait for a selector or timeout
       */
      async waitFor(selectorOrTime, options) {
        const page = this.ensurePage();
        const start = Date.now();
        try {
          if (typeof selectorOrTime === "number") {
            await page.waitForTimeout(selectorOrTime);
          } else {
            await page.waitForSelector(selectorOrTime, { timeout: options?.timeout || 3e4 });
          }
          await this.recordAction({
            type: "wait",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { target: selectorOrTime },
            success: true,
            duration: Date.now() - start
          });
        } catch (error) {
          await this.recordAction({
            type: "wait",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { target: selectorOrTime },
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start
          });
          throw error;
        }
      }
      /**
       * Take a screenshot
       */
      async screenshot(options) {
        const page = this.ensurePage();
        const start = Date.now();
        const screenshotName = options?.name || `screenshot-${Date.now()}`;
        const outputPath = (0, import_path8.join)(this.sessionDir, `${screenshotName}.png`);
        try {
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
          if (options?.selector) {
            const element = await page.waitForSelector(options.selector, { timeout: 5e3 });
            if (!element) {
              throw new Error(`Element not found: ${options.selector}`);
            }
            await element.screenshot({ path: outputPath, type: "png" });
          } else {
            await page.screenshot({
              path: outputPath,
              fullPage: options?.fullPage ?? true,
              type: "png"
            });
          }
          await this.recordAction({
            type: "screenshot",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { name: screenshotName, path: outputPath, selector: options?.selector },
            success: true,
            duration: Date.now() - start
          });
          return outputPath;
        } catch (error) {
          await this.recordAction({
            type: "screenshot",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            params: { name: screenshotName, selector: options?.selector },
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start
          });
          throw error;
        }
      }
      /**
       * Get page content (HTML)
       */
      async content() {
        const page = this.ensurePage();
        return page.content();
      }
      /**
       * Get page title
       */
      async title() {
        const page = this.ensurePage();
        return page.title();
      }
      /**
       * Check if an element exists
       */
      async exists(selector) {
        const page = this.ensurePage();
        const element = await page.$(selector);
        return element !== null;
      }
      /**
       * Get text content of an element
       */
      async textContent(selector) {
        const page = this.ensurePage();
        return page.textContent(selector);
      }
      /**
       * Get attribute of an element
       */
      async getAttribute(selector, attribute) {
        const page = this.ensurePage();
        return page.getAttribute(selector, attribute);
      }
      /**
       * Press a keyboard key
       */
      async press(key) {
        const page = this.ensurePage();
        await page.keyboard.press(key);
      }
      /**
       * Select option(s) from a dropdown
       */
      async select(selector, values) {
        const page = this.ensurePage();
        await page.selectOption(selector, values);
      }
      /**
       * Close the session and browser
       */
      async close() {
        if (this.context) {
          await this.context.close();
          this.context = null;
        }
        if (this.browser) {
          await this.browser.close();
          this.browser = null;
        }
        this.page = null;
        await this.saveState();
      }
      /**
       * Check if session is still active
       */
      get isActive() {
        return this.browser !== null && this.page !== null;
      }
      /**
       * Get underlying Playwright page (for advanced use)
       */
      getPage() {
        return this.ensurePage();
      }
    };
    LiveSessionManager = class {
      sessions = /* @__PURE__ */ new Map();
      /**
       * Create a new live session
       */
      async create(outputDir, options) {
        const session = await LiveSession.create(outputDir, options);
        this.sessions.set(session.id, session);
        return session;
      }
      /**
       * Get an active session by ID
       */
      get(sessionId) {
        return this.sessions.get(sessionId);
      }
      /**
       * Close a session
       */
      async close(sessionId) {
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
      async closeAll() {
        for (const session of this.sessions.values()) {
          await session.close();
        }
        this.sessions.clear();
      }
      /**
       * List active session IDs
       */
      list() {
        return Array.from(this.sessions.keys());
      }
    };
    liveSessionManager = new LiveSessionManager();
  }
});

// src/bin/ibr.ts
var import_commander = require("commander");
var import_promises9 = require("fs/promises");
var import_path9 = require("path");
var import_fs6 = require("fs");

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
function getVerdictIndicator(verdict) {
  switch (verdict) {
    case "MATCH":
      return { symbol: "[PASS]", label: "No visual changes detected" };
    case "EXPECTED_CHANGE":
      return { symbol: "[OK]  ", label: "Changes detected, appear intentional" };
    case "UNEXPECTED_CHANGE":
      return { symbol: "[WARN]", label: "Unexpected changes - investigate" };
    case "LAYOUT_BROKEN":
      return { symbol: "[FAIL]", label: "Layout broken - fix required" };
    default:
      return { symbol: "[????]", label: "Unknown verdict" };
  }
}
function formatReportText(report) {
  const lines = [];
  const { symbol, label } = getVerdictIndicator(report.analysis.verdict);
  lines.push("");
  lines.push(`${symbol} ${report.analysis.verdict} - ${label}`);
  lines.push("");
  lines.push(`Diff: ${report.comparison.diffPercent}% (${report.comparison.diffPixels.toLocaleString()} pixels)`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(`Session: ${report.sessionName} (${report.sessionId})`);
  lines.push(`URL: ${report.url}`);
  lines.push(`Viewport: ${report.viewport.name} (${report.viewport.width}x${report.viewport.height})`);
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
      fullPage = this.config.fullPage,
      selector,
      waitFor
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
      outputDir: this.config.outputDir,
      selector,
      waitFor
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
  const configPath = (0, import_path9.join)(process.cwd(), ".ibrrc.json");
  if ((0, import_fs6.existsSync)(configPath)) {
    try {
      const content = await (0, import_promises9.readFile)(configPath, "utf-8");
      return JSON.parse(content);
    } catch {
    }
  }
  return {};
}
var IBR_DEFAULT_PORT = 4200;
async function isPortAvailable(port) {
  return new Promise((resolve2) => {
    import("net").then(({ createServer }) => {
      const server = createServer();
      server.once("error", () => resolve2(false));
      server.once("listening", () => {
        server.close();
        resolve2(true);
      });
      server.listen(port, "127.0.0.1");
    });
  });
}
async function findAvailablePort(startPort, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available ports found in range ${startPort}-${startPort + maxAttempts - 1}`);
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
program.name("ibr").description("Visual regression testing for Claude Code").version("0.2.4");
program.option("-b, --base-url <url>", "Base URL for the application").option("-o, --output <dir>", "Output directory", "./.ibr").option("-v, --viewport <name>", "Viewport: desktop, mobile, tablet", "desktop").option("-t, --threshold <percent>", "Diff threshold percentage", "1.0");
program.command("start [url]").description("Capture a baseline screenshot (auto-detects dev server if no URL)").option("-n, --name <name>", "Session name").option("-s, --selector <css>", "CSS selector to capture specific element").option("-w, --wait-for <selector>", "Wait for selector before screenshot").option("--no-full-page", "Capture only the viewport, not full page").option("--sandbox", "Show visible browser window (default: headless)").option("--debug", "Visible browser + slow motion + devtools").action(async (url, options) => {
  try {
    const resolvedUrl = await resolveBaseUrl(url);
    const ibr = await createIBR(program.opts());
    const result = await ibr.startSession(resolvedUrl, {
      name: options.name,
      fullPage: options.fullPage,
      selector: options.selector,
      waitFor: options.waitFor
    });
    console.log(`Session started: ${result.sessionId}`);
    console.log(`Baseline: ${result.baseline}`);
    console.log(`URL: ${result.session.url}`);
    console.log("");
    console.log("Next: Make your changes, then run:");
    console.log(`  npx ibr check ${result.sessionId}`);
    await ibr.close();
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("auto").description("Zero-config: detect server, scan pages, open viewer").option("-n, --max-pages <count>", "Maximum pages to scan", "5").option("--nav-only", "Only scan navigation links (faster)").option("--no-open", "Do not open browser automatically").action(async (options) => {
  try {
    const baseUrl = await detectDevServer();
    if (!baseUrl) {
      console.log("No dev server detected.");
      console.log("");
      console.log("Start your dev server, then run:");
      console.log("  npx ibr auto");
      console.log("");
      console.log("Or specify a URL:");
      console.log("  npx ibr scan-start http://localhost:3000");
      return;
    }
    console.log(`Detected: ${baseUrl}`);
    console.log("");
    const { discoverPages: discoverPages2, getNavigationLinks: getNavigationLinks2 } = await Promise.resolve().then(() => (init_crawl(), crawl_exports));
    const ibr = await createIBR(program.opts());
    let pages;
    if (options.navOnly) {
      pages = await getNavigationLinks2(baseUrl);
      console.log(`Found ${pages.length} navigation links.`);
    } else {
      const result = await discoverPages2({
        url: baseUrl,
        maxPages: parseInt(options.maxPages, 10)
      });
      pages = result.pages;
      console.log(`Discovered ${pages.length} pages.`);
    }
    if (pages.length === 0) {
      console.log("No pages found to capture.");
      await ibr.close();
      return;
    }
    console.log("Capturing baselines...");
    console.log("");
    let captured = 0;
    for (const page of pages) {
      try {
        const result = await ibr.startSession(page.url, {
          name: page.title.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase().slice(0, 50)
        });
        captured++;
        console.log(`  ${page.path} -> ${result.sessionId}`);
      } catch {
        console.log(`  ${page.path} -> failed`);
      }
    }
    await ibr.close();
    console.log("");
    console.log(`Captured ${captured}/${pages.length} pages.`);
    console.log("");
    console.log("Next steps:");
    console.log("  1. Make your UI changes");
    console.log("  2. Run: npx ibr scan-check");
    console.log("  3. View: npx ibr serve");
    if (options.open !== false && captured > 0) {
      console.log("");
      console.log("Opening viewer...");
      const { spawn } = await import("child_process");
      spawn("npx", ["ibr", "serve"], {
        stdio: "inherit",
        shell: true,
        detached: true
      }).unref();
    }
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
    if (options.format === "text") {
      console.log("");
      if (report.analysis.verdict === "MATCH") {
        console.log("All good! To capture more pages: npx ibr scan");
      } else if (report.analysis.verdict === "EXPECTED_CHANGE") {
        console.log("To accept as new baseline: npx ibr update");
      } else if (report.analysis.verdict === "UNEXPECTED_CHANGE" || report.analysis.verdict === "LAYOUT_BROKEN") {
        console.log("View diff in browser: npx ibr serve");
      }
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
program.command("audit [url]").description("Audit a page for UI issues (handlers, accessibility, touch targets)").option("-r, --rules <preset>", "Rule preset: minimal (default)", "minimal").option("--json", "Output as JSON").option("--fail-on <level>", "Exit non-zero on errors/warnings", "error").action(async (url, options) => {
  try {
    const resolvedUrl = await resolveBaseUrl(url);
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const { loadRulesConfig: loadRulesConfig2, runRules: runRules2, createAuditResult: createAuditResult2, formatAuditResult: formatAuditResult2 } = await Promise.resolve().then(() => (init_engine(), engine_exports));
    const { register: register2 } = await Promise.resolve().then(() => (init_minimal(), minimal_exports));
    const { startBrowserServer: startBrowserServer2, connectToBrowserServer: connectToBrowserServer2, stopBrowserServer: stopBrowserServer2, isServerRunning: isServerRunning2 } = await Promise.resolve().then(() => (init_browser_server(), browser_server_exports));
    const { extractInteractiveElements: extractInteractiveElements2 } = await Promise.resolve().then(() => (init_extract(), extract_exports));
    const { chromium: chromium8 } = await import("playwright");
    register2();
    const rulesConfig = await loadRulesConfig2(process.cwd());
    if (options.rules && options.rules !== "minimal") {
      rulesConfig.extends = [options.rules];
    }
    console.log(`Auditing ${resolvedUrl}...`);
    console.log("");
    const browser3 = await chromium8.launch({ headless: true });
    const viewport = VIEWPORTS[globalOpts.viewport] || VIEWPORTS.desktop;
    const context = await browser3.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: "reduce"
    });
    const page = await context.newPage();
    await page.goto(resolvedUrl, { waitUntil: "networkidle", timeout: 3e4 });
    const elements = await extractInteractiveElements2(page);
    const isMobile = viewport.width < 768;
    const violations = runRules2(elements, {
      isMobile,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      url: resolvedUrl,
      allElements: elements
    }, rulesConfig);
    const result = createAuditResult2(resolvedUrl, elements, violations);
    await context.close();
    await browser3.close();
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatAuditResult2(result));
    }
    if (options.failOn === "error" && result.summary.errors > 0) {
      process.exit(1);
    } else if (options.failOn === "warning" && (result.summary.errors > 0 || result.summary.warnings > 0)) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("status").description("Show sessions awaiting comparison (baselines without checks)").action(async () => {
  try {
    const ibr = await createIBR(program.opts());
    const sessions = await ibr.listSessions();
    const pending = sessions.filter((s) => s.status === "baseline");
    if (pending.length === 0) {
      console.log("No pending visual checks.");
      console.log("");
      console.log("To capture a baseline:");
      console.log('  npx ibr start <url> --name "feature-name"');
      return;
    }
    console.log("Pending visual checks:");
    console.log("");
    for (const session of pending) {
      const age = Date.now() - new Date(session.createdAt).getTime();
      const ageStr = age < 6e4 ? "just now" : age < 36e5 ? `${Math.floor(age / 6e4)}m ago` : age < 864e5 ? `${Math.floor(age / 36e5)}h ago` : `${Math.floor(age / 864e5)}d ago`;
      const urlPath = new URL(session.url).pathname;
      console.log(`  ${session.id}  ${urlPath.padEnd(20)}  ${ageStr.padEnd(10)}  ${session.name || ""}`);
    }
    console.log("");
    console.log("Run comparison:");
    console.log("  npx ibr check              # checks most recent");
    console.log("  npx ibr check <session-id> # checks specific session");
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
program.command("update [sessionId]").alias("approve").description("Update baseline with current screenshot (alias: approve)").action(async (sessionId) => {
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
program.command("serve").description("Start the comparison viewer web UI").option("-p, --port <port>", `Port number (default: ${IBR_DEFAULT_PORT}, auto-scans for available)`).option("--no-open", "Do not open browser automatically").action(async (options) => {
  const { spawn } = await import("child_process");
  const { resolve: resolve2 } = await import("path");
  const packageRoot = resolve2(process.cwd());
  let webUiDir = (0, import_path9.join)(packageRoot, "web-ui");
  if (!(0, import_fs6.existsSync)(webUiDir)) {
    const possiblePaths = [
      (0, import_path9.join)(packageRoot, "node_modules", "interface-built-right", "web-ui"),
      (0, import_path9.join)(packageRoot, "..", "interface-built-right", "web-ui")
    ];
    for (const p of possiblePaths) {
      if ((0, import_fs6.existsSync)(p)) {
        webUiDir = p;
        break;
      }
    }
  }
  if (!(0, import_fs6.existsSync)(webUiDir)) {
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
  let port;
  if (options.port) {
    port = parseInt(options.port, 10);
    if (!await isPortAvailable(port)) {
      console.log(`Port ${port} is already in use.`);
      try {
        port = await findAvailablePort(port + 1);
        console.log(`Using next available port: ${port}`);
      } catch (e) {
        console.error(e instanceof Error ? e.message : "Failed to find available port");
        process.exit(1);
      }
    }
  } else {
    try {
      port = await findAvailablePort(IBR_DEFAULT_PORT);
      if (port !== IBR_DEFAULT_PORT) {
        console.log(`Default port ${IBR_DEFAULT_PORT} in use, using port ${port}`);
      }
    } catch (e) {
      console.error(e instanceof Error ? e.message : "Failed to find available port");
      process.exit(1);
    }
  }
  console.log(`Starting web UI on http://localhost:${port}`);
  console.log("Press Ctrl+C to stop the server.");
  console.log("");
  const server = spawn("npm", ["run", "dev", "--", "-p", String(port)], {
    cwd: webUiDir,
    stdio: "inherit",
    shell: true
  });
  if (options.open !== false) {
    setTimeout(async () => {
      const open = (await import("child_process")).exec;
      const url = `http://localhost:${port}`;
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
program.command("session:start [url]").description("Start an interactive browser session (browser persists across commands)").option("-n, --name <name>", "Session name").option("-w, --wait-for <selector>", "Wait for selector before considering page ready").option("--sandbox", "Show visible browser window (default: headless)").option("--debug", "Visible browser + slow motion + devtools").action(async (url, options) => {
  try {
    const {
      startBrowserServer: startBrowserServer2,
      isServerRunning: isServerRunning2,
      PersistentSession: PersistentSession2
    } = await Promise.resolve().then(() => (init_browser_server(), browser_server_exports));
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const resolvedUrl = await resolveBaseUrl(url);
    const headless = !options.sandbox && !options.debug;
    const serverRunning = await isServerRunning2(outputDir);
    if (!serverRunning) {
      console.log(headless ? "Starting headless browser server..." : "Starting visible browser server...");
      const { server } = await startBrowserServer2(outputDir, {
        headless,
        debug: options.debug,
        isolated: true
        // Prevents conflicts with Playwright MCP
      });
      const session = await PersistentSession2.create(outputDir, {
        url: resolvedUrl,
        name: options.name,
        waitFor: options.waitFor,
        viewport: VIEWPORTS[globalOpts.viewport] || VIEWPORTS.desktop
      });
      console.log("");
      console.log(`Session started: ${session.id}`);
      console.log(`URL: ${session.url}`);
      console.log("");
      console.log("Available commands (run in another terminal):");
      console.log(`  npx ibr session:click ${session.id} "<selector>"`);
      console.log(`  npx ibr session:type ${session.id} "<selector>" "<text>"`);
      console.log(`  npx ibr session:screenshot ${session.id}`);
      console.log(`  npx ibr session:wait ${session.id} "<selector>"`);
      console.log("");
      console.log("To close: npx ibr session:close all");
      console.log("");
      console.log("Browser server running. Press Ctrl+C to stop.");
      await new Promise((resolve2) => {
        const cleanup = async () => {
          console.log("\nShutting down browser server...");
          server.close();
          resolve2();
        };
        process.on("SIGINT", cleanup);
        process.on("SIGTERM", cleanup);
      });
    } else {
      console.log("Connecting to existing browser server...");
      const session = await PersistentSession2.create(outputDir, {
        url: resolvedUrl,
        name: options.name,
        waitFor: options.waitFor,
        viewport: VIEWPORTS[globalOpts.viewport] || VIEWPORTS.desktop
      });
      console.log("");
      console.log(`Session started: ${session.id}`);
      console.log(`URL: ${session.url}`);
      console.log("");
      console.log("Use session commands to interact:");
      console.log(`  npx ibr session:type ${session.id} "<selector>" "<text>"`);
      console.log(`  npx ibr session:click ${session.id} "<selector>"`);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
async function getSession2(outputDir, sessionId) {
  const { PersistentSession: PersistentSession2, isServerRunning: isServerRunning2 } = await Promise.resolve().then(() => (init_browser_server(), browser_server_exports));
  if (!await isServerRunning2(outputDir)) {
    console.error("No browser server running.");
    console.log("");
    console.log("Start one with:");
    console.log("  npx ibr session:start <url>");
    console.log("");
    console.log("The first session:start launches the server and keeps it alive.");
    console.log("Run session commands in a separate terminal.");
    process.exit(1);
  }
  const session = await PersistentSession2.get(outputDir, sessionId);
  if (!session) {
    console.error(`Session not found: ${sessionId}`);
    console.log("");
    console.log("This can happen if:");
    console.log("  1. The session ID is incorrect");
    console.log("  2. The session was created with a different browser server");
    console.log("");
    console.log("List sessions with: npx ibr session:list");
    process.exit(1);
  }
  return session;
}
program.command("session:click <sessionId> <selector>").description("Click an element in an active session (auto-targets visible elements)").action(async (sessionId, selector) => {
  try {
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const session = await getSession2(outputDir, sessionId);
    await session.click(selector);
    console.log(`Clicked: ${selector}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error:", msg);
    console.log("");
    if (msg.includes("not visible") || msg.includes("Timeout")) {
      console.log("Tip: IBR auto-filters to visible elements. Element may be:");
      console.log("     - Hidden by CSS (display:none, visibility:hidden)");
      console.log("     - Off-screen or zero-sized");
      console.log('     Use session:html --selector "' + selector + '" to inspect');
    } else {
      console.log("Tip: Session is still active. Use session:html to inspect the DOM.");
    }
  }
});
program.command("session:type <sessionId> <selector> <text>").description("Type text into an element in an active session").option("--delay <ms>", "Delay between keystrokes", "0").option("--submit", "Press Enter after typing (waits for network idle)").option("--wait-after <ms>", "Wait this long after typing/submitting before next command").action(async (sessionId, selector, text, options) => {
  try {
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const session = await getSession2(outputDir, sessionId);
    await session.type(selector, text, {
      delay: parseInt(options.delay, 10),
      submit: options.submit,
      waitAfter: options.waitAfter ? parseInt(options.waitAfter, 10) : void 0
    });
    const action = options.submit ? "Typed and submitted" : "Typed";
    console.log(`${action}: "${text.length > 20 ? text.slice(0, 20) + "..." : text}" into: ${selector}`);
    if (options.submit) {
      console.log("Waited for network idle after submit");
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error:", msg);
    console.log("");
    if (msg.includes("not visible") || msg.includes("multiple elements")) {
      console.log("Tip: IBR auto-filters to visible elements. If still failing:");
      console.log("     - Use session:html to inspect the DOM");
      console.log("     - Try a more specific selector (add class, id, or attribute)");
    } else {
      console.log("Tip: Session is still active. Use session:html to inspect the page.");
    }
  }
});
program.command("session:screenshot <sessionId>").description("Take a screenshot and audit interactive elements").option("-n, --name <name>", "Screenshot name").option("-s, --selector <css>", "CSS selector to capture specific element").option("--no-full-page", "Capture only the viewport").option("--json", "Output audit results as JSON").action(async (sessionId, options) => {
  try {
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const session = await getSession2(outputDir, sessionId);
    const { path, elements, audit } = await session.screenshot({
      name: options.name,
      selector: options.selector,
      fullPage: options.fullPage
    });
    if (options.json) {
      console.log(JSON.stringify({ path, elements, audit }, null, 2));
    } else {
      console.log(`Screenshot saved: ${path}`);
      console.log("");
      console.log("Element Audit:");
      console.log(`  Total elements: ${audit.totalElements}`);
      console.log(`  Interactive: ${audit.interactiveCount}`);
      console.log(`  With handlers: ${audit.withHandlers}`);
      console.log(`  Without handlers: ${audit.withoutHandlers}`);
      if (audit.issues.length > 0) {
        console.log("");
        console.log("Issues detected:");
        for (const issue of audit.issues) {
          const icon = issue.severity === "error" ? "\u2717" : issue.severity === "warning" ? "!" : "i";
          console.log(`  ${icon} [${issue.type}] ${issue.message}`);
        }
      } else {
        console.log("");
        console.log("No issues detected.");
      }
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    console.log("");
    console.log("Tip: Session is still active. Try without --selector for full page.");
  }
});
program.command("session:wait <sessionId> <selectorOrMs>").description("Wait for a selector to appear or a duration (in ms)").action(async (sessionId, selectorOrMs) => {
  try {
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const session = await getSession2(outputDir, sessionId);
    const isNumber = /^\d+$/.test(selectorOrMs);
    if (isNumber) {
      await session.waitFor(parseInt(selectorOrMs, 10));
      console.log(`Waited ${selectorOrMs}ms`);
    } else {
      await session.waitFor(selectorOrMs);
      console.log(`Found: ${selectorOrMs}`);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    console.log("");
    console.log("Tip: Session is still active. Element may not exist yet or selector is wrong.");
  }
});
program.command("session:navigate <sessionId> <url>").description("Navigate to a new URL in an active session").option("-w, --wait-for <selector>", "Wait for selector after navigation").action(async (sessionId, url, options) => {
  try {
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const session = await getSession2(outputDir, sessionId);
    await session.navigate(url, { waitFor: options.waitFor });
    console.log(`Navigated to: ${url}`);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    console.log("");
    console.log("Tip: Session is still active. Check URL or try without --wait-for.");
  }
});
program.command("session:list").description("List all active interactive sessions").action(async () => {
  try {
    const { isServerRunning: isServerRunning2, listActiveSessions: listActiveSessions2 } = await Promise.resolve().then(() => (init_browser_server(), browser_server_exports));
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const serverRunning = await isServerRunning2(outputDir);
    const sessions = await listActiveSessions2(outputDir);
    console.log(`Browser server: ${serverRunning ? "running" : "not running"}`);
    console.log("");
    if (sessions.length === 0) {
      console.log("No sessions found.");
      console.log("");
      console.log("Start one with:");
      console.log("  npx ibr session:start <url>");
      return;
    }
    console.log("Sessions:");
    for (const id of sessions) {
      console.log(`  ${id}`);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("session:close <sessionId>").description('Close a session (use "all" to stop browser server)').action(async (sessionId) => {
  try {
    const { stopBrowserServer: stopBrowserServer2, PersistentSession: PersistentSession2, isServerRunning: isServerRunning2 } = await Promise.resolve().then(() => (init_browser_server(), browser_server_exports));
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    if (sessionId === "all") {
      const stopped = await stopBrowserServer2(outputDir);
      if (stopped) {
        console.log("Browser server stopped. All sessions closed.");
      } else {
        console.log("No browser server running.");
      }
      return;
    }
    if (!await isServerRunning2(outputDir)) {
      console.log("No browser server running.");
      return;
    }
    const session = await PersistentSession2.get(outputDir, sessionId);
    if (session) {
      await session.close();
      console.log(`Session closed: ${sessionId}`);
    } else {
      console.log(`Session not found: ${sessionId}`);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("session:html <sessionId>").description("Get the full page HTML/DOM structure").option("-s, --selector <css>", "Get HTML of specific element only").action(async (sessionId, options) => {
  try {
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const session = await getSession2(outputDir, sessionId);
    if (options.selector) {
      const html = await session.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? el.outerHTML : null;
      });
      if (html) {
        console.log(html);
      } else {
        console.error(`Element not found: ${options.selector}`);
        process.exit(1);
      }
    } else {
      const html = await session.content();
      console.log(html);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("session:text <sessionId> <selector>").description("Get text content from a specific element").option("-a, --all", "Get text from all matching elements").action(async (sessionId, selector, options) => {
  try {
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const session = await getSession2(outputDir, sessionId);
    if (options.all) {
      const texts = await session.allTextContent(selector);
      if (texts.length === 0) {
        console.error(`No elements found: ${selector}`);
        process.exit(1);
      }
      texts.forEach((text, i) => {
        console.log(`[${i + 1}] ${text}`);
      });
    } else {
      const text = await session.textContent(selector);
      if (text === null) {
        console.error(`Element not found: ${selector}`);
        process.exit(1);
      }
      console.log(text.trim());
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("session:actions <sessionId>").description("Show action history for a session").action(async (sessionId) => {
  try {
    const { liveSessionManager: liveSessionManager2 } = await Promise.resolve().then(() => (init_live_session(), live_session_exports));
    const session = liveSessionManager2.get(sessionId);
    if (!session) {
      console.error(`Session not found or not active: ${sessionId}`);
      process.exit(1);
    }
    const actions = session.actions;
    console.log(`Actions for ${sessionId}:`);
    console.log("");
    for (const action of actions) {
      const icon = action.success ? "\u2713" : "\u2717";
      const duration = action.duration ? `(${action.duration}ms)` : "";
      console.log(`  ${icon} ${action.type} ${duration}`);
      if (action.params) {
        const params = Object.entries(action.params).map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`).join(", ");
        console.log(`      ${params}`);
      }
      if (!action.success && action.error) {
        console.log(`      Error: ${action.error}`);
      }
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("scan [url]").description("Discover pages (auto-detects dev server if no URL)").option("-n, --max-pages <count>", "Maximum pages to discover", "5").option("-p, --prefix <path>", "Only scan pages under this path prefix").option("--nav-only", "Only scan navigation links (faster)").option("-f, --format <format>", "Output format: json, text", "text").action(async (url, options) => {
  try {
    const resolvedUrl = await resolveBaseUrl(url);
    const { discoverPages: discoverPages2, getNavigationLinks: getNavigationLinks2 } = await Promise.resolve().then(() => (init_crawl(), crawl_exports));
    console.log(`Scanning ${resolvedUrl}...`);
    console.log("");
    let pages;
    if (options.navOnly) {
      pages = await getNavigationLinks2(resolvedUrl);
      console.log(`Found ${pages.length} navigation links:`);
    } else {
      const result = await discoverPages2({
        url: resolvedUrl,
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
    console.log("To capture baselines for these pages:");
    console.log(`  npx ibr scan-start`);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("scan-start [url]").description("Discover pages and capture baselines (auto-detects dev server if no URL)").option("-n, --max-pages <count>", "Maximum pages to discover", "5").option("-p, --prefix <path>", "Only scan pages under this path prefix").option("--nav-only", "Only scan navigation links (faster)").action(async (url, options) => {
  try {
    const resolvedUrl = await resolveBaseUrl(url);
    const { discoverPages: discoverPages2, getNavigationLinks: getNavigationLinks2 } = await Promise.resolve().then(() => (init_crawl(), crawl_exports));
    const ibr = await createIBR(program.opts());
    console.log(`Scanning ${resolvedUrl}...`);
    let pages;
    if (options.navOnly) {
      pages = await getNavigationLinks2(resolvedUrl);
    } else {
      const result = await discoverPages2({
        url: resolvedUrl,
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
        console.log(`  Done: ${result.sessionId}`);
      } catch (error) {
        console.log(`  Failed: ${error instanceof Error ? error.message : error}`);
      }
    }
    console.log("");
    console.log(`Captured ${sessions.length}/${pages.length} pages.`);
    console.log("");
    console.log("Next: Make your changes, then run:");
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
program.command("diagnose [url]").description("Diagnose page load issues (auto-detects dev server if no URL)").option("--timeout <ms>", "Timeout in milliseconds", "30000").action(async (url, options) => {
  try {
    const resolvedUrl = await resolveBaseUrl(url);
    const { captureWithDiagnostics: captureWithDiagnostics2, closeBrowser: closeBrowser3 } = await Promise.resolve().then(() => (init_capture(), capture_exports));
    const { join: join8 } = await import("path");
    const outputDir = program.opts().output || "./.ibr";
    console.log(`Diagnosing ${resolvedUrl}...`);
    console.log("");
    const result = await captureWithDiagnostics2({
      url: resolvedUrl,
      outputPath: join8(outputDir, "diagnose", "test.png"),
      timeout: parseInt(options.timeout, 10),
      outputDir
    });
    await closeBrowser3();
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
async function isPortInUse(port) {
  return new Promise((resolve2) => {
    const net = require("net");
    const server = net.createServer();
    server.once("error", () => resolve2(true));
    server.once("listening", () => {
      server.close();
      resolve2(false);
    });
    server.listen(port, "127.0.0.1");
  });
}
async function findAvailablePortFromList(ports) {
  for (const port of ports) {
    if (!await isPortInUse(port)) {
      return port;
    }
  }
  return null;
}
var DEV_SERVER_PORTS = [3e3, 3001, 5173, 5174, 4200, 8080, 8e3, 5e3, 3100, 4321];
async function detectDevServer() {
  for (const port of DEV_SERVER_PORTS) {
    if (await isPortInUse(port)) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1e3);
        await fetch(`http://localhost:${port}`, {
          signal: controller.signal,
          method: "HEAD"
        });
        clearTimeout(timeout);
        return `http://localhost:${port}`;
      } catch {
        continue;
      }
    }
  }
  return null;
}
async function resolveBaseUrl(providedUrl) {
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
  throw new Error("No URL provided and no dev server detected. Start your dev server or specify a URL.");
}
program.command("init").description("Initialize .ibrrc.json configuration file").option("-p, --port <port>", "Port for baseUrl (auto-detects available port if not specified)").option("-u, --url <url>", "Full base URL (overrides port)").action(async (options) => {
  const configPath = (0, import_path9.join)(process.cwd(), ".ibrrc.json");
  if ((0, import_fs6.existsSync)(configPath)) {
    console.log(".ibrrc.json already exists.");
    console.log("Edit it directly or delete and run init again.");
    return;
  }
  let baseUrl;
  if (options.url) {
    baseUrl = options.url;
  } else if (options.port) {
    baseUrl = `http://localhost:${options.port}`;
  } else {
    const preferredPort = 5e3;
    const fallbackPorts = [5050, 5555, 4200, 4321, 6789, 7777];
    if (!await isPortInUse(preferredPort)) {
      baseUrl = `http://localhost:${preferredPort}`;
      console.log(`Using default port ${preferredPort}`);
    } else {
      console.log(`Port ${preferredPort} in use, finding alternative...`);
      const availablePort = await findAvailablePortFromList(fallbackPorts);
      if (availablePort) {
        baseUrl = `http://localhost:${availablePort}`;
        console.log(`Auto-selected port ${availablePort}`);
      } else {
        baseUrl = "http://localhost:YOUR_PORT";
        console.log("All candidate ports in use. Please edit baseUrl in .ibrrc.json");
      }
    }
  }
  const config = {
    baseUrl,
    outputDir: "./.ibr",
    viewport: "desktop",
    threshold: 1,
    fullPage: true
  };
  const { writeFile: writeFile7 } = await import("fs/promises");
  await writeFile7(configPath, JSON.stringify(config, null, 2));
  console.log("");
  console.log("Created .ibrrc.json");
  console.log("");
  console.log("Configuration:");
  console.log(JSON.stringify(config, null, 2));
  console.log("");
  console.log("Edit baseUrl to match your dev server.");
});
program.parse();
//# sourceMappingURL=ibr.js.map