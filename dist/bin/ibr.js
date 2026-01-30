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
var import_zod, ViewportSchema, VIEWPORTS, ConfigSchema, SessionQuerySchema, ComparisonResultSchema, ChangedRegionSchema, VerdictSchema, AnalysisSchema, SessionStatusSchema, BoundsSchema, LandmarkElementSchema, SessionSchema, ComparisonReportSchema, InteractiveStateSchema, A11yAttributesSchema, EnhancedElementSchema, ElementIssueSchema, AuditResultSchema, RuleSeveritySchema, RuleSettingSchema, RulesConfigSchema, ViolationSchema, RuleAuditResultSchema;
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
    BoundsSchema = import_zod.z.object({
      x: import_zod.z.number(),
      y: import_zod.z.number(),
      width: import_zod.z.number(),
      height: import_zod.z.number()
    });
    LandmarkElementSchema = import_zod.z.object({
      name: import_zod.z.string(),
      // e.g., 'logo', 'header', 'nav'
      selector: import_zod.z.string(),
      // CSS selector used to find it
      found: import_zod.z.boolean(),
      bounds: BoundsSchema.optional()
    });
    SessionSchema = import_zod.z.object({
      id: import_zod.z.string(),
      name: import_zod.z.string(),
      url: import_zod.z.string().url(),
      viewport: ViewportSchema,
      status: SessionStatusSchema,
      createdAt: import_zod.z.string().datetime(),
      updatedAt: import_zod.z.string().datetime(),
      comparison: ComparisonResultSchema.optional(),
      analysis: AnalysisSchema.optional(),
      // Landmark elements detected at baseline capture
      landmarkElements: import_zod.z.array(LandmarkElementSchema).optional(),
      // Page intent detected at baseline
      pageIntent: import_zod.z.string().optional()
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
      computedStyles: import_zod.z.record(import_zod.z.string(), import_zod.z.string()).optional(),
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
      import_zod.z.tuple([RuleSeveritySchema, import_zod.z.record(import_zod.z.string(), import_zod.z.unknown())])
    ]);
    RulesConfigSchema = import_zod.z.object({
      extends: import_zod.z.array(import_zod.z.string()).optional(),
      rules: import_zod.z.record(import_zod.z.string(), RuleSettingSchema).optional()
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

// src/types.ts
var DEFAULT_DYNAMIC_SELECTORS;
var init_types = __esm({
  "src/types.ts"() {
    "use strict";
    DEFAULT_DYNAMIC_SELECTORS = [
      // Timestamps and dates
      '[data-testid*="timestamp"]',
      '[data-testid*="date"]',
      '[data-testid*="time"]',
      '[class*="timestamp"]',
      '[class*="relative-time"]',
      '[class*="timeago"]',
      "time[datetime]",
      // Loading indicators
      '[class*="loading"]',
      '[class*="spinner"]',
      '[class*="skeleton"]',
      '[class*="shimmer"]',
      '[role="progressbar"]',
      // Live counters
      '[class*="live-count"]',
      '[class*="viewer-count"]',
      '[class*="online-count"]',
      // Avatars with random colors
      '[class*="avatar"][style*="background"]',
      // Random IDs displayed
      '[data-testid*="session-id"]',
      '[class*="request-id"]'
    ];
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
async function saveAuthState(context, authStatePath, _outputDir) {
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

// src/semantic/landmarks.ts
async function detectLandmarks(page) {
  const landmarks = [];
  for (const [name, selector] of Object.entries(LANDMARK_SELECTORS)) {
    try {
      const element = await page.$(selector);
      if (element) {
        const box = await element.boundingBox();
        landmarks.push({
          name,
          selector,
          found: true,
          bounds: box ? {
            x: Math.round(box.x),
            y: Math.round(box.y),
            width: Math.round(box.width),
            height: Math.round(box.height)
          } : void 0
        });
      } else {
        landmarks.push({
          name,
          selector,
          found: false
        });
      }
    } catch {
      landmarks.push({
        name,
        selector,
        found: false
      });
    }
  }
  return landmarks;
}
function getExpectedLandmarksForIntent(intent) {
  const common = ["header", "navigation", "main", "footer", "logo"];
  const intentSpecific = {
    auth: ["loginForm", "logo"],
    form: ["heading"],
    listing: ["search", "heading"],
    detail: ["heading"],
    dashboard: ["sidebar", "userMenu", "heading"],
    error: ["heading"],
    landing: ["heroSection", "ctaButton", "heading"],
    empty: ["heading"],
    unknown: []
  };
  const expected = [.../* @__PURE__ */ new Set([...common, ...intentSpecific[intent] || []])];
  return expected;
}
function compareLandmarks(baseline, current) {
  const baselineFound = baseline.filter((l) => l.found);
  const currentFound = current.filter((l) => l.found);
  const baselineNames = new Set(baselineFound.map((l) => l.name));
  const currentNames = new Set(currentFound.map((l) => l.name));
  const missing = baselineFound.filter((l) => !currentNames.has(l.name));
  const added = currentFound.filter((l) => !baselineNames.has(l.name));
  const unchanged = currentFound.filter((l) => baselineNames.has(l.name));
  return { missing, added, unchanged };
}
function getExpectedLandmarksFromContext(framework) {
  if (!framework) return [];
  const expected = [];
  const principlesText = framework.principles.join(" ").toLowerCase();
  if (principlesText.includes("logo") || principlesText.includes("brand")) {
    expected.push("logo");
  }
  if (principlesText.includes("navigation") || principlesText.includes("nav")) {
    expected.push("navigation");
  }
  if (principlesText.includes("header") || principlesText.includes("banner")) {
    expected.push("header");
  }
  if (principlesText.includes("footer")) {
    expected.push("footer");
  }
  if (principlesText.includes("sidebar")) {
    expected.push("sidebar");
  }
  if (principlesText.includes("search")) {
    expected.push("search");
  }
  if (principlesText.includes("cta") || principlesText.includes("call-to-action")) {
    expected.push("ctaButton");
  }
  if (principlesText.includes("hero")) {
    expected.push("heroSection");
  }
  return expected;
}
function formatLandmarkComparison(comparison) {
  const lines = [];
  if (comparison.missing.length > 0) {
    lines.push("Missing (were in baseline):");
    for (const el of comparison.missing) {
      lines.push(`  ! ${el.name}`);
    }
  }
  if (comparison.added.length > 0) {
    lines.push("New (not in baseline):");
    for (const el of comparison.added) {
      lines.push(`  + ${el.name}`);
    }
  }
  if (comparison.unchanged.length > 0) {
    lines.push("Unchanged:");
    for (const el of comparison.unchanged) {
      lines.push(`  \u2713 ${el.name}`);
    }
  }
  return lines.join("\n");
}
var LANDMARK_SELECTORS;
var init_landmarks = __esm({
  "src/semantic/landmarks.ts"() {
    "use strict";
    LANDMARK_SELECTORS = {
      logo: 'img[src*="logo"], img[alt*="logo" i], [class*="logo"], [id*="logo"], svg[class*="logo"]',
      header: 'header, [role="banner"], [class*="header"]:not([class*="subheader"])',
      navigation: 'nav, [role="navigation"], [class*="nav"]:not([class*="subnav"])',
      main: 'main, [role="main"], [class*="main-content"], #main',
      footer: 'footer, [role="contentinfo"], [class*="footer"]',
      sidebar: 'aside, [role="complementary"], [class*="sidebar"]',
      search: 'input[type="search"], [role="search"], [class*="search-input"], input[name*="search"]',
      heading: "h1",
      userMenu: '[class*="user-menu"], [class*="avatar"], [class*="profile"], [class*="account"]',
      loginForm: 'form:has(input[type="password"])',
      heroSection: '[class*="hero"], [class*="banner"], [class*="jumbotron"]',
      ctaButton: '[class*="cta"], a[class*="primary"], button[class*="primary"]'
    };
  }
});

// src/semantic/page-intent.ts
async function classifyPageIntent(page) {
  const signals = [];
  const scores = {
    auth: 0,
    form: 0,
    listing: 0,
    detail: 0,
    dashboard: 0,
    error: 0,
    landing: 0,
    empty: 0
  };
  const checks = await page.evaluate(() => {
    const doc = document;
    const body = doc.body;
    const text = body?.innerText?.toLowerCase() || "";
    const count = (selector) => doc.querySelectorAll(selector).length;
    const exists = (selector) => count(selector) > 0;
    const textContains = (terms) => terms.some((t) => text.includes(t));
    return {
      // Auth signals
      hasPasswordField: exists('input[type="password"]'),
      hasEmailField: exists('input[type="email"], input[name*="email"], input[name*="username"]'),
      hasLoginText: textContains(["sign in", "log in", "login", "sign up", "register", "forgot password", "reset password"]),
      hasRememberMe: exists('input[type="checkbox"][name*="remember"]') || Array.from(doc.querySelectorAll("label")).some((l) => l.textContent?.toLowerCase().includes("remember")),
      hasOAuthButtons: exists('[class*="google"], [class*="facebook"], [class*="github"], [class*="oauth"], [class*="social"]'),
      // Form signals
      formCount: count("form"),
      inputCount: count('input:not([type="hidden"]):not([type="search"])'),
      textareaCount: count("textarea"),
      selectCount: count("select"),
      hasSubmitButton: exists('button[type="submit"], input[type="submit"]'),
      hasFormLabels: count("label") > 2,
      // Listing signals
      listItemCount: count('li, [class*="item"], [class*="card"], [class*="row"]'),
      hasGrid: exists('[class*="grid"], [class*="list"], [class*="feed"]'),
      hasTable: exists("table tbody tr"),
      hasPagination: exists('[class*="pagination"], [class*="pager"], nav[aria-label*="page"]'),
      hasFilters: exists('[class*="filter"], [class*="sort"], [class*="facet"]'),
      repeatingSimilarElements: (() => {
        const cards = doc.querySelectorAll('[class*="card"], [class*="item"]');
        if (cards.length < 3) return false;
        const classes = Array.from(cards).map((c) => c.className);
        const unique = new Set(classes);
        return unique.size <= 3;
      })(),
      // Detail signals
      hasMainArticle: exists('article, main > [class*="content"], [class*="detail"]'),
      hasLongContent: text.length > 2e3,
      hasSingleHeading: count("h1") === 1,
      hasMetadata: exists('[class*="meta"], [class*="author"], [class*="date"], time'),
      hasComments: exists('[class*="comment"], [id*="comment"]'),
      hasSocialShare: exists('[class*="share"], [class*="social"]'),
      // Dashboard signals
      hasCharts: exists('canvas, svg[class*="chart"], [class*="chart"], [class*="graph"]'),
      hasStats: exists('[class*="stat"], [class*="metric"], [class*="kpi"]'),
      hasSidebar: exists('aside, [class*="sidebar"], nav[class*="side"]'),
      hasWidgets: exists('[class*="widget"], [class*="panel"], [class*="tile"]'),
      hasUserMenu: exists('[class*="user"], [class*="avatar"], [class*="profile"]'),
      hasNavTabs: exists('[role="tablist"], [class*="tabs"]'),
      // Error signals
      hasErrorCode: textContains(["404", "500", "403", "401", "not found", "error", "denied", "forbidden"]),
      hasErrorClass: exists('[class*="error"], [class*="404"], [class*="500"]'),
      isMinimalContent: text.length < 200,
      hasBackLink: textContains(["go back", "go home", "return"]),
      // Landing signals
      hasHero: exists('[class*="hero"], [class*="banner"], [class*="jumbotron"]'),
      hasCTA: exists('[class*="cta"], [class*="call-to-action"], a[class*="primary"]'),
      hasTestimonials: exists('[class*="testimonial"], [class*="review"], [class*="quote"]'),
      hasPricing: exists('[class*="pricing"], [class*="plan"]'),
      hasFeatures: exists('[class*="feature"], [class*="benefit"]'),
      // Empty signals
      hasEmptyState: exists('[class*="empty"], [class*="no-data"], [class*="no-results"]'),
      hasEmptyText: textContains(["no results", "nothing here", "no items", "empty"]),
      // General metrics
      totalElements: count("*"),
      interactiveElements: count("a, button, input, select, textarea")
    };
  });
  if (checks.hasPasswordField) {
    scores.auth += 40;
    signals.push("password field present");
  }
  if (checks.hasEmailField && checks.hasPasswordField) {
    scores.auth += 20;
    signals.push("email + password combination");
  }
  if (checks.hasLoginText) {
    scores.auth += 15;
    signals.push("login-related text");
  }
  if (checks.hasRememberMe) {
    scores.auth += 10;
    signals.push("remember me checkbox");
  }
  if (checks.hasOAuthButtons) {
    scores.auth += 10;
    signals.push("OAuth buttons");
  }
  if (checks.formCount > 0 && !checks.hasPasswordField) {
    scores.form += 20;
    signals.push("form without password");
  }
  if (checks.inputCount > 3 && !checks.hasPasswordField) {
    scores.form += 15;
    signals.push("multiple input fields");
  }
  if (checks.textareaCount > 0) {
    scores.form += 15;
    signals.push("textarea present");
  }
  if (checks.hasFormLabels && checks.inputCount > 2) {
    scores.form += 10;
    signals.push("labeled form fields");
  }
  if (checks.listItemCount > 5) {
    scores.listing += 25;
    signals.push(`${checks.listItemCount} list items`);
  }
  if (checks.hasGrid) {
    scores.listing += 15;
    signals.push("grid/list layout");
  }
  if (checks.hasTable) {
    scores.listing += 20;
    signals.push("data table");
  }
  if (checks.hasPagination) {
    scores.listing += 20;
    signals.push("pagination");
  }
  if (checks.hasFilters) {
    scores.listing += 15;
    signals.push("filters/sorting");
  }
  if (checks.repeatingSimilarElements) {
    scores.listing += 15;
    signals.push("repeating card elements");
  }
  if (checks.hasMainArticle) {
    scores.detail += 25;
    signals.push("main article element");
  }
  if (checks.hasLongContent) {
    scores.detail += 20;
    signals.push("long content");
  }
  if (checks.hasSingleHeading && checks.hasMetadata) {
    scores.detail += 20;
    signals.push("single heading with metadata");
  }
  if (checks.hasComments) {
    scores.detail += 15;
    signals.push("comments section");
  }
  if (checks.hasSocialShare) {
    scores.detail += 10;
    signals.push("social share buttons");
  }
  if (checks.hasCharts) {
    scores.dashboard += 30;
    signals.push("charts/graphs");
  }
  if (checks.hasStats) {
    scores.dashboard += 25;
    signals.push("stats/metrics");
  }
  if (checks.hasSidebar && checks.hasWidgets) {
    scores.dashboard += 20;
    signals.push("sidebar with widgets");
  }
  if (checks.hasNavTabs) {
    scores.dashboard += 10;
    signals.push("navigation tabs");
  }
  if (checks.hasUserMenu) {
    scores.dashboard += 10;
    signals.push("user menu");
  }
  if (checks.hasErrorCode && checks.isMinimalContent) {
    scores.error += 50;
    signals.push("error code with minimal content");
  }
  if (checks.hasErrorClass) {
    scores.error += 30;
    signals.push("error CSS class");
  }
  if (checks.hasBackLink && checks.isMinimalContent) {
    scores.error += 20;
    signals.push("back link on minimal page");
  }
  if (checks.hasHero) {
    scores.landing += 25;
    signals.push("hero section");
  }
  if (checks.hasCTA) {
    scores.landing += 20;
    signals.push("call-to-action");
  }
  if (checks.hasTestimonials) {
    scores.landing += 15;
    signals.push("testimonials");
  }
  if (checks.hasPricing) {
    scores.landing += 20;
    signals.push("pricing section");
  }
  if (checks.hasFeatures) {
    scores.landing += 15;
    signals.push("features section");
  }
  if (checks.hasEmptyState) {
    scores.empty += 40;
    signals.push("empty state element");
  }
  if (checks.hasEmptyText && checks.listItemCount === 0) {
    scores.empty += 30;
    signals.push("empty text with no items");
  }
  const entries = Object.entries(scores);
  entries.sort((a, b) => b[1] - a[1]);
  const [topIntent, topScore] = entries[0];
  const [secondIntent, secondScore] = entries[1];
  const maxPossible = 100;
  const confidence = Math.min(topScore / maxPossible, 1);
  const hasSecondary = secondScore > 30 && secondScore > topScore * 0.5;
  return {
    intent: topScore > 20 ? topIntent : "unknown",
    confidence,
    signals: signals.slice(0, 5),
    // Top 5 signals
    secondaryIntent: hasSecondary ? secondIntent : void 0
  };
}
function getIntentDescription(intent) {
  const descriptions = {
    auth: "Authentication page (login, register, password reset)",
    form: "Form page (data entry, settings, contact)",
    listing: "Listing page (search results, product grid, table)",
    detail: "Detail page (article, product, profile)",
    dashboard: "Dashboard (admin panel, analytics, user home)",
    error: "Error page (404, 500, access denied)",
    landing: "Landing page (marketing, homepage)",
    empty: "Empty state (no content)",
    unknown: "Unknown page type"
  };
  return descriptions[intent];
}
var init_page_intent = __esm({
  "src/semantic/page-intent.ts"() {
    "use strict";
  }
});

// src/capture.ts
var capture_exports = {};
__export(capture_exports, {
  captureMultipleViewports: () => captureMultipleViewports,
  captureScreenshot: () => captureScreenshot,
  captureWithDiagnostics: () => captureWithDiagnostics,
  captureWithLandmarks: () => captureWithLandmarks,
  closeBrowser: () => closeBrowser,
  getViewport: () => getViewport
});
async function applyMasking(page, mask) {
  const hideAnimations = mask?.hideAnimations !== false;
  const selectorsToHide = [];
  if (mask?.selectors) {
    selectorsToHide.push(...mask.selectors);
  }
  if (mask?.hideDynamicContent) {
    selectorsToHide.push(...DEFAULT_DYNAMIC_SELECTORS);
  }
  const cssRules = [];
  if (hideAnimations) {
    cssRules.push(`
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
      }
      @keyframes none { }
    `);
  }
  if (selectorsToHide.length > 0) {
    const selectorList = selectorsToHide.join(",\n");
    cssRules.push(`
      ${selectorList} {
        visibility: hidden !important;
        opacity: 0 !important;
      }
    `);
  }
  if (cssRules.length > 0) {
    await page.addStyleTag({
      content: cssRules.join("\n")
    });
  }
  if (mask?.textPatterns && mask.textPatterns.length > 0) {
    const placeholder = mask.placeholder || "\u2588\u2588\u2588";
    const patterns = mask.textPatterns.map(
      (p) => typeof p === "string" ? p : p.source
    );
    await page.evaluate(({ patterns: patterns2, placeholder: placeholder2 }) => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null
      );
      const textNodes = [];
      let node;
      while (node = walker.nextNode()) {
        textNodes.push(node);
      }
      for (const textNode of textNodes) {
        let text = textNode.textContent || "";
        for (const pattern of patterns2) {
          const regex = new RegExp(pattern, "gi");
          text = text.replace(regex, placeholder2);
        }
        if (text !== textNode.textContent) {
          textNode.textContent = text;
        }
      }
    }, { patterns, placeholder });
  }
}
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
    await applyMasking(page, options.mask);
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
async function captureWithLandmarks(options) {
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
    reducedMotion: "reduce",
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
    const intentResult = await classifyPageIntent(page);
    const landmarkElements = await detectLandmarks(page);
    await applyMasking(page, options.mask);
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
    return {
      outputPath,
      landmarkElements,
      pageIntent: intentResult.intent
    };
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
    await applyMasking(page, options.mask);
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
    init_types();
    init_auth();
    init_landmarks();
    init_page_intent();
    browser = null;
  }
});

// src/compare.ts
var compare_exports = {};
__export(compare_exports, {
  analyzeComparison: () => analyzeComparison,
  compareImages: () => compareImages,
  detectChangedRegions: () => detectChangedRegions,
  getVerdictDescription: () => getVerdictDescription
});
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
var import_pixelmatch, import_pngjs, import_promises3, import_path3, DEFAULT_REGIONS;
var init_compare = __esm({
  "src/compare.ts"() {
    "use strict";
    import_pixelmatch = __toESM(require("pixelmatch"));
    import_pngjs = require("pngjs");
    import_promises3 = require("fs/promises");
    import_path3 = require("path");
    DEFAULT_REGIONS = [
      { name: "header", location: "top", xStart: 0, xEnd: 1, yStart: 0, yEnd: 0.1 },
      { name: "navigation", location: "left", xStart: 0, xEnd: 0.2, yStart: 0.1, yEnd: 0.9 },
      { name: "content", location: "center", xStart: 0.2, xEnd: 1, yStart: 0.1, yEnd: 0.9 },
      { name: "footer", location: "bottom", xStart: 0, xEnd: 1, yStart: 0.9, yEnd: 1 }
    ];
  }
});

// src/git-context.ts
var git_context_exports = {};
__export(git_context_exports, {
  getAppContext: () => getAppContext,
  getAppName: () => getAppName,
  getGitContext: () => getGitContext,
  getSessionBasePath: () => getSessionBasePath
});
async function parseGitConfig(configPath) {
  try {
    const content = await (0, import_promises4.readFile)(configPath, "utf-8");
    const lines = content.split("\n");
    let currentRemote = null;
    let remoteUrl = null;
    for (const line of lines) {
      const trimmed = line.trim();
      const remoteMatch = trimmed.match(/^\[remote "(.+)"\]$/);
      if (remoteMatch) {
        currentRemote = remoteMatch[1];
        continue;
      }
      if (currentRemote && trimmed.startsWith("url = ")) {
        remoteUrl = trimmed.substring(6).trim();
        break;
      }
    }
    return { remote: currentRemote, remoteUrl };
  } catch {
    return { remote: null, remoteUrl: null };
  }
}
function extractRepoName(remoteUrl) {
  try {
    const sshMatch = remoteUrl.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    if (sshMatch) {
      const parts = sshMatch[1].split("/");
      return parts[parts.length - 1].replace(/\.git$/, "");
    }
    const httpsMatch = remoteUrl.match(/\/([^/]+?)(?:\.git)?$/);
    if (httpsMatch) {
      return httpsMatch[1].replace(/\.git$/, "");
    }
    return null;
  } catch {
    return null;
  }
}
function getCurrentBranch(dir) {
  try {
    const branch = (0, import_child_process.execSync)("git branch --show-current", {
      cwd: dir,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    return branch || null;
  } catch {
    return null;
  }
}
async function getGitContext(dir) {
  const gitConfigPath = (0, import_path4.join)(dir, ".git", "config");
  const { remote, remoteUrl } = await parseGitConfig(gitConfigPath);
  const repoName = remoteUrl ? extractRepoName(remoteUrl) : null;
  const branch = getCurrentBranch(dir);
  return {
    repoName,
    branch,
    remote,
    remoteUrl
  };
}
async function getAppName(dir) {
  try {
    const packageJsonPath = (0, import_path4.join)(dir, "package.json");
    const content = await (0, import_promises4.readFile)(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(content);
    if (packageJson.name) {
      const name = packageJson.name;
      const scopeMatch = name.match(/^@[^/]+\/(.+)$/);
      return scopeMatch ? scopeMatch[1] : name;
    }
  } catch {
  }
  return (0, import_path4.basename)(dir);
}
async function getAppContext(dir) {
  const [gitContext, appName] = await Promise.all([
    getGitContext(dir),
    getAppName(dir)
  ]);
  return {
    ...gitContext,
    appName
  };
}
function getSessionBasePath(outputDir, context) {
  if (context.repoName && context.branch) {
    return (0, import_path4.join)(outputDir, "apps", context.appName, context.branch, "sessions");
  }
  return (0, import_path4.join)(outputDir, "sessions");
}
var import_promises4, import_path4, import_child_process;
var init_git_context = __esm({
  "src/git-context.ts"() {
    "use strict";
    import_promises4 = require("fs/promises");
    import_path4 = require("path");
    import_child_process = require("child_process");
  }
});

// src/session.ts
var session_exports = {};
__export(session_exports, {
  cleanSessions: () => cleanSessions,
  createSession: () => createSession,
  deleteSession: () => deleteSession,
  findSessions: () => findSessions,
  generateSessionId: () => generateSessionId,
  getCachedAppContext: () => getCachedAppContext,
  getMostRecentSession: () => getMostRecentSession,
  getSession: () => getSession,
  getSessionPaths: () => getSessionPaths,
  getSessionPathsWithContext: () => getSessionPathsWithContext,
  getSessionStats: () => getSessionStats,
  getSessionsByRoute: () => getSessionsByRoute,
  getTimeline: () => getTimeline,
  listSessions: () => listSessions,
  markSessionCompared: () => markSessionCompared,
  updateSession: () => updateSession
});
function generateSessionId() {
  return `${SESSION_PREFIX}${(0, import_nanoid.nanoid)(10)}`;
}
function getSessionPaths(outputDir, sessionId) {
  const root = (0, import_path5.join)(outputDir, "sessions", sessionId);
  return {
    root,
    sessionJson: (0, import_path5.join)(root, "session.json"),
    baseline: (0, import_path5.join)(root, "baseline.png"),
    current: (0, import_path5.join)(root, "current.png"),
    diff: (0, import_path5.join)(root, "diff.png")
  };
}
function getSessionPathsWithContext(outputDir, sessionId, context) {
  const basePath = context ? getSessionBasePath(outputDir, context) : (0, import_path5.join)(outputDir, "sessions");
  const root = (0, import_path5.join)(basePath, sessionId);
  return {
    root,
    sessionJson: (0, import_path5.join)(root, "session.json"),
    baseline: (0, import_path5.join)(root, "baseline.png"),
    current: (0, import_path5.join)(root, "current.png"),
    diff: (0, import_path5.join)(root, "diff.png")
  };
}
async function getCachedAppContext(projectDir) {
  if (contextCacheDir === projectDir && cachedContext !== null) {
    return cachedContext;
  }
  try {
    cachedContext = await getAppContext(projectDir);
    contextCacheDir = projectDir;
    return cachedContext;
  } catch {
    cachedContext = null;
    contextCacheDir = projectDir;
    return null;
  }
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
  await (0, import_promises5.mkdir)(paths.root, { recursive: true });
  await (0, import_promises5.writeFile)(paths.sessionJson, JSON.stringify(session, null, 2));
  return session;
}
async function getSession(outputDir, sessionId) {
  const paths = getSessionPaths(outputDir, sessionId);
  try {
    const content = await (0, import_promises5.readFile)(paths.sessionJson, "utf-8");
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
  await (0, import_promises5.writeFile)(paths.sessionJson, JSON.stringify(updated, null, 2));
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
  const sessionsDir = (0, import_path5.join)(outputDir, "sessions");
  try {
    const entries = await (0, import_promises5.readdir)(sessionsDir, { withFileTypes: true });
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
    await (0, import_promises5.rm)(paths.root, { recursive: true, force: true });
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
var import_nanoid, import_promises5, import_path5, SESSION_PREFIX, cachedContext, contextCacheDir;
var init_session = __esm({
  "src/session.ts"() {
    "use strict";
    import_nanoid = require("nanoid");
    import_promises5 = require("fs/promises");
    import_path5 = require("path");
    init_schemas();
    init_git_context();
    SESSION_PREFIX = "sess_";
    cachedContext = null;
    contextCacheDir = null;
  }
});

// src/semantic/state-detector.ts
async function detectAuthState(page) {
  const signals = [];
  let authenticated = null;
  let confidence = 0;
  let username;
  const checks = await page.evaluate(() => {
    const doc = document;
    const text = doc.body?.innerText?.toLowerCase() || "";
    const logoutButton = doc.querySelector(
      'button:has-text("logout"), button:has-text("sign out"), a:has-text("logout"), a:has-text("sign out"), [class*="logout"], [data-testid*="logout"]'
    );
    const userMenu = doc.querySelector(
      '[class*="user-menu"], [class*="avatar"], [class*="profile-menu"], [class*="account-menu"], [data-testid*="user"]'
    );
    const welcomeText = text.match(/welcome,?\s+(\w+)/i);
    const userNameEl = doc.querySelector(
      '[class*="username"], [class*="user-name"], [class*="display-name"]'
    );
    const loginLink = doc.querySelector(
      'a:has-text("login"), a:has-text("sign in"), button:has-text("login"), button:has-text("sign in"), [class*="login-link"], [href*="/login"], [href*="/signin"]'
    );
    const signupLink = doc.querySelector(
      'a:has-text("sign up"), a:has-text("register"), [href*="/signup"], [href*="/register"]'
    );
    const authRequired = doc.querySelector(
      '[class*="auth-required"], [class*="login-required"], [class*="protected"]'
    );
    const hasAuthCookie = document.cookie.includes("auth") || document.cookie.includes("session") || document.cookie.includes("token");
    return {
      hasLogoutButton: !!logoutButton,
      hasUserMenu: !!userMenu,
      hasWelcomeText: !!welcomeText,
      welcomeName: welcomeText?.[1],
      hasUserNameElement: !!userNameEl,
      userName: userNameEl?.textContent?.trim(),
      hasLoginLink: !!loginLink,
      hasSignupLink: !!signupLink,
      hasAuthRequired: !!authRequired,
      hasAuthCookie
    };
  });
  if (checks.hasLogoutButton) {
    authenticated = true;
    confidence += 40;
    signals.push("logout button present");
  }
  if (checks.hasUserMenu) {
    authenticated = true;
    confidence += 30;
    signals.push("user menu present");
  }
  if (checks.hasWelcomeText) {
    authenticated = true;
    confidence += 20;
    signals.push("welcome text");
    username = checks.welcomeName;
  }
  if (checks.hasUserNameElement) {
    authenticated = true;
    confidence += 15;
    signals.push("username displayed");
    username = username || checks.userName;
  }
  if (checks.hasAuthCookie) {
    confidence += 10;
    signals.push("auth cookie present");
  }
  if (checks.hasLoginLink && !checks.hasLogoutButton) {
    authenticated = false;
    confidence += 30;
    signals.push("login link visible");
  }
  if (checks.hasSignupLink && !checks.hasUserMenu) {
    authenticated = false;
    confidence += 20;
    signals.push("signup link visible");
  }
  if (checks.hasAuthRequired) {
    authenticated = false;
    confidence += 25;
    signals.push("auth-required message");
  }
  confidence = Math.min(confidence / 100, 1);
  if (confidence < 0.3) {
    authenticated = null;
  }
  return {
    authenticated,
    confidence,
    signals,
    username
  };
}
async function detectLoadingState(page) {
  const checks = await page.evaluate(() => {
    const doc = document;
    const spinners = doc.querySelectorAll(
      '[class*="spinner"], [class*="loading"], [class*="loader"], [role="progressbar"][aria-busy="true"], .animate-spin, [class*="spin"]'
    );
    const skeletons = doc.querySelectorAll(
      '[class*="skeleton"], [class*="shimmer"], [class*="placeholder"], [class*="pulse"], [aria-busy="true"]'
    );
    const progress = doc.querySelectorAll(
      'progress, [role="progressbar"], [class*="progress-bar"], [class*="loading-bar"]'
    );
    const lazyImages = doc.querySelectorAll(
      'img[loading="lazy"]:not([src]), [class*="lazy"]:not([src])'
    );
    const bodyLoading = doc.body?.classList.contains("loading") || doc.body?.getAttribute("aria-busy") === "true";
    return {
      spinnerCount: spinners.length,
      skeletonCount: skeletons.length,
      progressCount: progress.length,
      lazyCount: lazyImages.length,
      bodyLoading
    };
  });
  let type = "none";
  let elements = 0;
  let loading = false;
  if (checks.spinnerCount > 0) {
    type = "spinner";
    elements = checks.spinnerCount;
    loading = true;
  } else if (checks.skeletonCount > 0) {
    type = "skeleton";
    elements = checks.skeletonCount;
    loading = true;
  } else if (checks.progressCount > 0) {
    type = "progress";
    elements = checks.progressCount;
    loading = true;
  } else if (checks.lazyCount > 0) {
    type = "lazy";
    elements = checks.lazyCount;
    loading = true;
  } else if (checks.bodyLoading) {
    type = "spinner";
    loading = true;
  }
  return { loading, type, elements };
}
async function detectErrorState(page) {
  const errors = [];
  const checks = await page.evaluate(() => {
    const doc = document;
    const text = doc.body?.innerText || "";
    const validationErrors = doc.querySelectorAll(
      '[class*="error"]:not([class*="error-boundary"]), [class*="invalid"], [aria-invalid="true"], .field-error, .form-error, .validation-error'
    );
    const apiErrors = doc.querySelectorAll(
      '[class*="api-error"], [class*="server-error"], [class*="fetch-error"], [class*="network-error"]'
    );
    const permissionText = text.match(/access denied|forbidden|unauthorized|not allowed/i);
    const notFoundText = text.match(/not found|404|page doesn't exist|no longer available/i);
    const serverText = text.match(/500|server error|something went wrong|internal error/i);
    const toastErrors = doc.querySelectorAll(
      '[class*="toast"][class*="error"], [class*="notification"][class*="error"], [role="alert"][class*="error"], [class*="snackbar"][class*="error"]'
    );
    const extractText = (el) => el.textContent?.trim().slice(0, 200) || "";
    return {
      validationErrors: Array.from(validationErrors).map(extractText).filter(Boolean),
      apiErrors: Array.from(apiErrors).map(extractText).filter(Boolean),
      toastErrors: Array.from(toastErrors).map(extractText).filter(Boolean),
      hasPermissionError: !!permissionText,
      hasNotFoundError: !!notFoundText,
      hasServerError: !!serverText
    };
  });
  if (checks.hasPermissionError) {
    errors.push({
      type: "permission",
      message: "Access denied or unauthorized"
    });
  }
  if (checks.hasNotFoundError) {
    errors.push({
      type: "notfound",
      message: "Page or resource not found"
    });
  }
  if (checks.hasServerError) {
    errors.push({
      type: "server",
      message: "Server error occurred"
    });
  }
  for (const msg of checks.validationErrors) {
    errors.push({
      type: "validation",
      message: msg
    });
  }
  for (const msg of checks.apiErrors) {
    errors.push({
      type: "api",
      message: msg
    });
  }
  for (const msg of checks.toastErrors) {
    errors.push({
      type: "unknown",
      message: msg
    });
  }
  let severity = "none";
  if (errors.length > 0) {
    const hasCritical = errors.some(
      (e) => e.type === "server" || e.type === "permission"
    );
    const hasError = errors.some(
      (e) => e.type === "api" || e.type === "notfound"
    );
    const hasWarning = errors.some((e) => e.type === "validation");
    if (hasCritical) severity = "critical";
    else if (hasError) severity = "error";
    else if (hasWarning) severity = "warning";
  }
  return {
    hasErrors: errors.length > 0,
    errors,
    severity
  };
}
async function detectPageState(page) {
  const [auth, loading, errors] = await Promise.all([
    detectAuthState(page),
    detectLoadingState(page),
    detectErrorState(page)
  ]);
  const ready = !loading.loading && errors.severity !== "critical" && errors.severity !== "error";
  return {
    auth,
    loading,
    errors,
    ready
  };
}
async function waitForPageReady(page, options = {}) {
  const { timeout = 1e4, ignoreErrors = false } = options;
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const state = await detectPageState(page);
    if (!state.loading.loading) {
      if (ignoreErrors || !state.errors.hasErrors) {
        return state;
      }
    }
    await page.waitForTimeout(200);
  }
  return detectPageState(page);
}
var init_state_detector = __esm({
  "src/semantic/state-detector.ts"() {
    "use strict";
  }
});

// src/semantic/output.ts
async function getSemanticOutput(page) {
  const url = page.url();
  const title = await page.title();
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const [pageIntent, state] = await Promise.all([
    classifyPageIntent(page),
    detectPageState(page)
  ]);
  const availableActions = await detectAvailableActions(page, pageIntent.intent);
  const issues = collectIssues(state, pageIntent);
  const verdict = determineVerdict(state, issues);
  const recovery = verdict === "FAIL" || verdict === "ERROR" ? generateRecoveryHint(state, pageIntent.intent) : void 0;
  const summary = generateSummary(pageIntent, state, verdict, issues.length);
  return {
    verdict,
    confidence: pageIntent.confidence,
    pageIntent,
    state,
    availableActions,
    issues,
    recovery,
    summary,
    url,
    title,
    timestamp
  };
}
async function detectAvailableActions(page, intent) {
  const actions = [];
  const checks = await page.evaluate(() => {
    const doc = document;
    const submitButton = doc.querySelector('button[type="submit"], input[type="submit"]');
    const searchInput = doc.querySelector('input[type="search"], input[name*="search"], input[placeholder*="search"]');
    const loginForm = doc.querySelector('form input[type="password"]');
    const mainNav = doc.querySelector("nav a, header a");
    const backButton = doc.querySelector('a:has-text("back"), button:has-text("back")');
    const addButton = doc.querySelector('button:has-text("add"), button:has-text("create"), button:has-text("new")');
    const editButton = doc.querySelector('button:has-text("edit"), a:has-text("edit")');
    const deleteButton = doc.querySelector('button:has-text("delete"), button:has-text("remove")');
    const filterSelect = doc.querySelector('select[name*="filter"], [class*="filter"] select');
    const sortSelect = doc.querySelector('select[name*="sort"], [class*="sort"] select');
    const pagination = doc.querySelector('[class*="pagination"] a, [class*="pager"] button');
    return {
      hasSubmit: !!submitButton,
      submitSelector: submitButton ? getSelector(submitButton) : null,
      hasSearch: !!searchInput,
      searchSelector: searchInput ? getSelector(searchInput) : null,
      hasLogin: !!loginForm,
      hasNav: !!mainNav,
      hasBack: !!backButton,
      hasAdd: !!addButton,
      addSelector: addButton ? getSelector(addButton) : null,
      hasEdit: !!editButton,
      hasDelete: !!deleteButton,
      hasFilter: !!filterSelect,
      hasSort: !!sortSelect,
      hasPagination: !!pagination
    };
    function getSelector(el) {
      if (el.id) return `#${el.id}`;
      if (el.getAttribute("data-testid")) return `[data-testid="${el.getAttribute("data-testid")}"]`;
      if (el.className) return `.${el.className.split(" ")[0]}`;
      return el.tagName.toLowerCase();
    }
  });
  if (intent === "auth" && checks.hasLogin) {
    actions.push({
      action: "login",
      selector: "form",
      description: "Submit login credentials"
    });
  }
  if (checks.hasSearch) {
    actions.push({
      action: "search",
      selector: checks.searchSelector || 'input[type="search"]',
      description: "Search for content"
    });
  }
  if (checks.hasSubmit && intent !== "auth") {
    actions.push({
      action: "submit",
      selector: checks.submitSelector || 'button[type="submit"]',
      description: "Submit form"
    });
  }
  if (checks.hasAdd) {
    actions.push({
      action: "create",
      selector: checks.addSelector || 'button:has-text("add")',
      description: "Create new item"
    });
  }
  if (intent === "listing") {
    if (checks.hasFilter) {
      actions.push({
        action: "filter",
        description: "Filter results"
      });
    }
    if (checks.hasSort) {
      actions.push({
        action: "sort",
        description: "Sort results"
      });
    }
    if (checks.hasPagination) {
      actions.push({
        action: "paginate",
        description: "Navigate to next/previous page"
      });
    }
  }
  if (checks.hasBack) {
    actions.push({
      action: "back",
      description: "Go back to previous page"
    });
  }
  return actions;
}
function collectIssues(state, intent) {
  const issues = [];
  for (const error of state.errors.errors) {
    issues.push({
      severity: error.type === "server" || error.type === "permission" ? "critical" : "major",
      type: error.type,
      problem: error.message,
      fix: getErrorFix(error.type)
    });
  }
  if (state.loading.loading && state.loading.elements > 3) {
    issues.push({
      severity: "minor",
      type: "slow-loading",
      problem: `Page has ${state.loading.elements} loading indicators`,
      fix: "Wait for content to load or check network"
    });
  }
  if (state.auth.authenticated === false && intent.intent === "dashboard") {
    issues.push({
      severity: "major",
      type: "auth-required",
      problem: "Dashboard requires authentication",
      fix: "Login first before accessing this page"
    });
  }
  return issues;
}
function getErrorFix(errorType) {
  const fixes = {
    validation: "Fix the highlighted form fields",
    api: "Retry the request or check API status",
    permission: "Login with appropriate permissions",
    notfound: "Check the URL or navigate to a valid page",
    server: "Wait and retry, or contact support",
    network: "Check internet connection",
    unknown: "Investigate the error message"
  };
  return fixes[errorType] || "Investigate the issue";
}
function determineVerdict(state, issues) {
  const hasCritical = issues.some((i) => i.severity === "critical");
  if (hasCritical) return "ERROR";
  if (state.loading.loading) return "LOADING";
  if (state.errors.hasErrors) return "FAIL";
  const hasMajor = issues.some((i) => i.severity === "major");
  if (hasMajor) return "ISSUES";
  return "PASS";
}
function generateRecoveryHint(state, _intent) {
  if (state.auth.authenticated === false) {
    return {
      suggestion: "Login to access this page",
      alternatives: ["Use ibr.flow.login()", "Navigate to /login first"],
      waitFor: '[class*="user"], [class*="avatar"]'
    };
  }
  if (state.errors.errors.some((e) => e.type === "server")) {
    return {
      suggestion: "Server error - wait and retry",
      alternatives: ["Refresh the page", "Check server status"]
    };
  }
  if (state.errors.errors.some((e) => e.type === "notfound")) {
    return {
      suggestion: "Page not found - check URL",
      alternatives: ["Navigate to homepage", "Use search to find content"]
    };
  }
  if (state.loading.loading) {
    return {
      suggestion: "Wait for page to finish loading",
      waitFor: state.loading.type === "skeleton" ? ':not([class*="skeleton"])' : ':not([class*="loading"])'
    };
  }
  return {
    suggestion: "Investigate the page state and retry"
  };
}
function generateSummary(intent, state, verdict, issueCount) {
  const parts = [];
  parts.push(`${intent.intent} page`);
  if (intent.confidence < 0.5) {
    parts.push("(low confidence)");
  }
  if (state.auth.authenticated === true) {
    parts.push(`authenticated${state.auth.username ? ` as ${state.auth.username}` : ""}`);
  } else if (state.auth.authenticated === false) {
    parts.push("not authenticated");
  }
  if (state.loading.loading) {
    parts.push(`loading (${state.loading.type})`);
  }
  if (verdict === "PASS") {
    parts.push("ready for interaction");
  } else if (verdict === "ISSUES") {
    parts.push(`${issueCount} issue${issueCount > 1 ? "s" : ""} detected`);
  } else if (verdict === "ERROR" || verdict === "FAIL") {
    parts.push(`${issueCount} error${issueCount > 1 ? "s" : ""}`);
  }
  return parts.join(", ");
}
function formatSemanticText(result) {
  const lines = [];
  lines.push(`Verdict: ${result.verdict}`);
  lines.push(`Page: ${result.pageIntent.intent} (${Math.round(result.confidence * 100)}% confidence)`);
  lines.push(`Summary: ${result.summary}`);
  if (result.state.auth.authenticated !== null) {
    lines.push(`Auth: ${result.state.auth.authenticated ? "logged in" : "logged out"}`);
  }
  if (result.availableActions.length > 0) {
    lines.push(`Actions: ${result.availableActions.map((a) => a.action).join(", ")}`);
  }
  if (result.issues.length > 0) {
    lines.push(`Issues: ${result.issues.map((i) => i.problem).join("; ")}`);
  }
  if (result.recovery) {
    lines.push(`Recovery: ${result.recovery.suggestion}`);
  }
  return lines.join("\n");
}
function formatSemanticJson(result) {
  return JSON.stringify({
    verdict: result.verdict,
    intent: result.pageIntent.intent,
    confidence: result.confidence,
    authenticated: result.state.auth.authenticated,
    loading: result.state.loading.loading,
    ready: result.state.ready,
    actions: result.availableActions.map((a) => a.action),
    issues: result.issues.map((i) => ({ severity: i.severity, problem: i.problem })),
    recovery: result.recovery?.suggestion
  }, null, 2);
}
var init_output = __esm({
  "src/semantic/output.ts"() {
    "use strict";
    init_page_intent();
    init_state_detector();
  }
});

// src/semantic/index.ts
var semantic_exports = {};
__export(semantic_exports, {
  LANDMARK_SELECTORS: () => LANDMARK_SELECTORS,
  classifyPageIntent: () => classifyPageIntent,
  compareLandmarks: () => compareLandmarks,
  detectAuthState: () => detectAuthState,
  detectErrorState: () => detectErrorState,
  detectLandmarks: () => detectLandmarks,
  detectLoadingState: () => detectLoadingState,
  detectPageState: () => detectPageState,
  formatLandmarkComparison: () => formatLandmarkComparison,
  formatSemanticJson: () => formatSemanticJson,
  formatSemanticText: () => formatSemanticText,
  getExpectedLandmarksForIntent: () => getExpectedLandmarksForIntent,
  getExpectedLandmarksFromContext: () => getExpectedLandmarksFromContext,
  getIntentDescription: () => getIntentDescription,
  getSemanticOutput: () => getSemanticOutput,
  waitForPageReady: () => waitForPageReady
});
var init_semantic = __esm({
  "src/semantic/index.ts"() {
    "use strict";
    init_page_intent();
    init_state_detector();
    init_output();
    init_landmarks();
  }
});

// src/flows/types.ts
async function findFieldByLabel(page, labels) {
  for (const label of labels) {
    const selectors = [
      `input[name*="${label}" i]`,
      `input[id*="${label}" i]`,
      `input[placeholder*="${label}" i]`,
      `input[aria-label*="${label}" i]`,
      `label:has-text("${label}") + input`,
      `label:has-text("${label}") input`
    ];
    for (const selector of selectors) {
      const element = await page.$(selector);
      if (element) return element;
    }
  }
  return null;
}
async function findButton(page, patterns) {
  for (const pattern of patterns) {
    const selectors = [
      `button:has-text("${pattern}")`,
      `input[type="submit"][value*="${pattern}" i]`,
      `button[type="submit"]:has-text("${pattern}")`,
      `a:has-text("${pattern}")`,
      `[role="button"]:has-text("${pattern}")`
    ];
    for (const selector of selectors) {
      const element = await page.$(selector);
      if (element) return element;
    }
  }
  return page.$('button[type="submit"], input[type="submit"]');
}
async function waitForNavigation(page, timeout = 1e4) {
  try {
    await Promise.race([
      page.waitForNavigation({ timeout }),
      page.waitForLoadState("networkidle", { timeout })
    ]);
  } catch {
  }
}
var init_types2 = __esm({
  "src/flows/types.ts"() {
    "use strict";
  }
});

// src/flows/search.ts
var search_exports = {};
__export(search_exports, {
  aiSearchFlow: () => aiSearchFlow,
  searchFlow: () => searchFlow
});
async function searchFlow(page, options) {
  const startTime = Date.now();
  const steps = [];
  const timeout = options.timeout || 1e4;
  try {
    const searchInput = await findFieldByLabel(page, [
      "search",
      "query",
      "q",
      "find"
    ]);
    const searchField = searchInput || await page.$(
      'input[type="search"], input[name="q"], input[name="query"], input[placeholder*="search" i], [role="searchbox"]'
    );
    if (!searchField) {
      return {
        success: false,
        resultCount: 0,
        hasResults: false,
        steps,
        error: "Could not find search input",
        duration: Date.now() - startTime
      };
    }
    await searchField.fill("");
    await searchField.fill(options.query);
    steps.push({ action: `type "${options.query}"`, success: true });
    if (options.submit !== false) {
      await searchField.press("Enter");
      steps.push({ action: "submit search", success: true });
      await waitForNavigation(page, timeout);
      steps.push({ action: "wait for results", success: true });
    } else {
      await page.waitForTimeout(500);
      steps.push({ action: "wait for autocomplete", success: true });
    }
    const resultsSelector = options.resultsSelector || '[class*="result"], [class*="item"], [class*="card"], [data-testid*="result"], li[class*="search"]';
    const results = await page.$$(resultsSelector);
    const resultCount = results.length;
    const hasResults = resultCount > 0;
    const emptyState = await page.$(
      '[class*="no-results"], [class*="empty"], :has-text("no results"), :has-text("nothing found")'
    );
    steps.push({
      action: `found ${resultCount} results`,
      success: hasResults || !!emptyState
    });
    return {
      success: true,
      resultCount,
      hasResults,
      steps,
      duration: Date.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      resultCount: 0,
      hasResults: false,
      steps,
      error: error instanceof Error ? error.message : "Unknown error",
      duration: Date.now() - startTime
    };
  }
}
async function captureStepScreenshot(page, step, artifactDir, startTime) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const timing = Date.now() - startTime;
  const stepNum = { before: "01", "after-query": "02", loading: "03", results: "04" }[step];
  const filename = `${stepNum}-${step}.png`;
  const path2 = (0, import_path6.join)(artifactDir, filename);
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
    path: path2,
    fullPage: false,
    type: "png"
  });
  return { step, path: path2, timestamp, timing };
}
async function extractResultContent(page, resultsSelector) {
  return page.evaluate((selector) => {
    const elements = document.querySelectorAll(selector);
    const results = [];
    elements.forEach((el, index) => {
      const htmlEl = el;
      const rect = htmlEl.getBoundingClientRect();
      const titleEl = htmlEl.querySelector('h1, h2, h3, h4, h5, h6, strong, b, [class*="title"]');
      const title = titleEl?.textContent?.trim();
      const snippetEl = htmlEl.querySelector('p, [class*="snippet"], [class*="description"], [class*="summary"]');
      const snippet = snippetEl?.textContent?.trim();
      const fullText = htmlEl.textContent?.trim() || "";
      let selector2 = el.tagName.toLowerCase();
      if (el.id) {
        selector2 = `#${el.id}`;
      } else if (el.className && typeof el.className === "string") {
        const classes = el.className.split(" ").filter((c) => c.trim())[0];
        if (classes) selector2 += `.${classes}`;
        selector2 += `:nth-of-type(${index + 1})`;
      }
      results.push({
        index,
        title: title || void 0,
        snippet: snippet || void 0,
        fullText: fullText.slice(0, 500),
        // Limit length
        selector: selector2,
        visible: rect.top >= 0 && rect.top < window.innerHeight
      });
    });
    return results;
  }, resultsSelector);
}
async function aiSearchFlow(page, options) {
  const startTime = Date.now();
  const steps = [];
  const screenshots = [];
  const timeout = options.timeout || 1e4;
  const captureSteps = options.captureSteps !== false;
  const extractContent = options.extractContent !== false;
  const timing = {
    total: 0,
    typing: 0,
    waiting: 0,
    rendering: 0
  };
  let artifactDir;
  if (captureSteps && options.sessionDir) {
    artifactDir = (0, import_path6.join)(options.sessionDir, `search-${Date.now()}`);
    await (0, import_promises6.mkdir)(artifactDir, { recursive: true });
  }
  try {
    if (captureSteps && artifactDir) {
      const shot = await captureStepScreenshot(page, "before", artifactDir, startTime);
      screenshots.push(shot);
      steps.push({ action: "capture before screenshot", success: true, duration: shot.timing });
    }
    const searchInput = await findFieldByLabel(page, ["search", "query", "q", "find"]);
    const searchField = searchInput || await page.$(
      'input[type="search"], input[name="q"], input[name="query"], input[placeholder*="search" i], [role="searchbox"]'
    );
    if (!searchField) {
      return {
        success: false,
        query: options.query,
        userIntent: options.userIntent,
        resultCount: 0,
        hasResults: false,
        steps,
        screenshots,
        extractedResults: [],
        timing: { ...timing, total: Date.now() - startTime },
        error: "Could not find search input",
        duration: Date.now() - startTime,
        artifactDir
      };
    }
    const typingStart = Date.now();
    await searchField.fill("");
    await searchField.fill(options.query);
    timing.typing = Date.now() - typingStart;
    steps.push({ action: `type "${options.query}"`, success: true, duration: timing.typing });
    if (captureSteps && artifactDir) {
      const shot = await captureStepScreenshot(page, "after-query", artifactDir, startTime);
      screenshots.push(shot);
      steps.push({ action: "capture after-query screenshot", success: true });
    }
    const waitingStart = Date.now();
    if (options.submit !== false) {
      await searchField.press("Enter");
      steps.push({ action: "submit search", success: true });
      await waitForNavigation(page, timeout);
      steps.push({ action: "wait for results", success: true });
    } else {
      await page.waitForTimeout(500);
      steps.push({ action: "wait for autocomplete", success: true });
    }
    timing.waiting = Date.now() - waitingStart;
    const renderingStart = Date.now();
    if (captureSteps && artifactDir) {
      const shot = await captureStepScreenshot(page, "results", artifactDir, startTime);
      screenshots.push(shot);
      steps.push({ action: "capture results screenshot", success: true });
    }
    const resultsSelector = options.resultsSelector || '[class*="result"], [class*="item"], [class*="card"], [data-testid*="result"], li[class*="search"]';
    const resultElements = await page.$$(resultsSelector);
    const resultCount = resultElements.length;
    const hasResults = resultCount > 0;
    let extractedResults = [];
    if (extractContent && hasResults) {
      extractedResults = await extractResultContent(page, resultsSelector);
      steps.push({ action: `extracted ${extractedResults.length} results`, success: true });
    }
    timing.rendering = Date.now() - renderingStart;
    timing.total = Date.now() - startTime;
    if (artifactDir) {
      const resultsData = {
        query: options.query,
        userIntent: options.userIntent,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        resultCount,
        hasResults,
        timing,
        extractedResults
      };
      await (0, import_promises6.writeFile)(
        (0, import_path6.join)(artifactDir, "results.json"),
        JSON.stringify(resultsData, null, 2)
      );
    }
    steps.push({
      action: `found ${resultCount} results`,
      success: hasResults
    });
    return {
      success: true,
      query: options.query,
      userIntent: options.userIntent,
      resultCount,
      hasResults,
      steps,
      screenshots,
      extractedResults,
      timing,
      duration: timing.total,
      artifactDir
    };
  } catch (error) {
    timing.total = Date.now() - startTime;
    return {
      success: false,
      query: options.query,
      userIntent: options.userIntent,
      resultCount: 0,
      hasResults: false,
      steps,
      screenshots,
      extractedResults: [],
      timing,
      error: error instanceof Error ? error.message : "Unknown error",
      duration: timing.total,
      artifactDir
    };
  }
}
var import_promises6, import_path6;
var init_search = __esm({
  "src/flows/search.ts"() {
    "use strict";
    import_promises6 = require("fs/promises");
    import_path6 = require("path");
    init_types2();
  }
});

// src/flows/search-validation.ts
var search_validation_exports = {};
__export(search_validation_exports, {
  analyzeForObviousIssues: () => analyzeForObviousIssues,
  formatValidationResult: () => formatValidationResult,
  generateDevModePrompt: () => generateDevModePrompt,
  generateQuickSummary: () => generateQuickSummary,
  generateValidationContext: () => generateValidationContext,
  generateValidationPrompt: () => generateValidationPrompt
});
function generateValidationContext(result) {
  return {
    query: result.query,
    userIntent: result.userIntent || `Find results related to: ${result.query}`,
    results: result.extractedResults,
    screenshotPaths: result.screenshots.map((s) => s.path),
    timing: result.timing,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    hasResults: result.hasResults,
    resultCount: result.resultCount
  };
}
function generateValidationPrompt(context) {
  const lines = [];
  lines.push("# Search Result Validation Request");
  lines.push("");
  lines.push("Please analyze the following search results and determine if they are relevant to the user's intent.");
  lines.push("");
  lines.push("## Search Details");
  lines.push(`- **Query:** "${context.query}"`);
  lines.push(`- **User Intent:** ${context.userIntent}`);
  lines.push(`- **Results Found:** ${context.resultCount}`);
  lines.push(`- **Total Time:** ${context.timing.total}ms`);
  lines.push("");
  if (context.screenshotPaths.length > 0) {
    lines.push("## Screenshots");
    lines.push("The following screenshots capture the search interaction:");
    for (const path2 of context.screenshotPaths) {
      lines.push(`- ${path2}`);
    }
    lines.push("");
    lines.push("*Please view these screenshots using the Read tool to see the visual state.*");
    lines.push("");
  }
  if (context.results.length > 0) {
    lines.push("## Extracted Results");
    lines.push("");
    for (const result of context.results.slice(0, 10)) {
      lines.push(`### Result ${result.index + 1}`);
      if (result.title) {
        lines.push(`**Title:** ${result.title}`);
      }
      if (result.snippet) {
        lines.push(`**Snippet:** ${result.snippet}`);
      }
      lines.push(`**Full Text:** ${result.fullText.slice(0, 200)}${result.fullText.length > 200 ? "..." : ""}`);
      lines.push(`**Visible:** ${result.visible ? "Yes" : "No"}`);
      lines.push("");
    }
    if (context.results.length > 10) {
      lines.push(`*...and ${context.results.length - 10} more results*`);
      lines.push("");
    }
  } else {
    lines.push("## No Results");
    lines.push("The search returned no results. This may indicate:");
    lines.push("- The search query is too specific");
    lines.push("- No matching content exists");
    lines.push("- A bug in the search functionality");
    lines.push("");
  }
  lines.push("## Validation Questions");
  lines.push("");
  lines.push("1. **Relevance:** Do the results match the user's intent?");
  lines.push("2. **Quality:** Are the results useful and informative?");
  lines.push("3. **Issues:** Are there any obvious problems (e.g., unrelated content)?");
  lines.push("4. **Suggestions:** What could improve the search experience?");
  lines.push("");
  lines.push("## Expected Response");
  lines.push("");
  lines.push("Please respond with:");
  lines.push("- `relevant`: true/false - whether results match user intent");
  lines.push("- `confidence`: 0-1 - how confident you are in the assessment");
  lines.push("- `reasoning`: brief explanation of your assessment");
  lines.push("- `suggestions`: (optional) array of improvement suggestions");
  lines.push("- `issues`: (optional) array of specific issues found");
  return lines.join("\n");
}
function generateQuickSummary(context) {
  const lines = [];
  lines.push(`Search: "${context.query}"`);
  lines.push(`Intent: ${context.userIntent}`);
  lines.push(`Results: ${context.resultCount} found in ${context.timing.total}ms`);
  if (context.results.length > 0) {
    lines.push("");
    lines.push("Top results:");
    for (const result of context.results.slice(0, 3)) {
      const title = result.title || result.fullText.slice(0, 50);
      lines.push(`  ${result.index + 1}. ${title}`);
    }
  }
  return lines.join("\n");
}
function analyzeForObviousIssues(context) {
  const issues = [];
  if (!context.hasResults) {
    issues.push({
      type: "empty",
      description: "Search returned no results",
      severity: "high"
    });
  }
  if (context.timing.total > 5e3) {
    issues.push({
      type: "slow",
      description: `Search took ${context.timing.total}ms (>5s)`,
      severity: context.timing.total > 1e4 ? "high" : "medium"
    });
  }
  for (const result of context.results) {
    if (!result.fullText || result.fullText.trim().length < 10) {
      issues.push({
        type: "error",
        resultIndex: result.index,
        description: `Result ${result.index + 1} has no meaningful content`,
        severity: "medium"
      });
    }
  }
  const queryTerms = context.query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  for (const result of context.results) {
    const textLower = result.fullText.toLowerCase();
    const matchCount = queryTerms.filter((term) => textLower.includes(term)).length;
    const matchRatio = matchCount / queryTerms.length;
    if (matchRatio < 0.2 && queryTerms.length > 1) {
      issues.push({
        type: "irrelevant",
        resultIndex: result.index,
        description: `Result ${result.index + 1} may not match query (low keyword overlap)`,
        severity: "low"
      });
    }
  }
  return issues;
}
function formatValidationResult(result) {
  const lines = [];
  const status = result.relevant ? "PASS" : "FAIL";
  const confidence = Math.round(result.confidence * 100);
  lines.push(`## Validation: ${status} (${confidence}% confidence)`);
  lines.push("");
  lines.push(`**Assessment:** ${result.reasoning}`);
  if (result.issues && result.issues.length > 0) {
    lines.push("");
    lines.push("**Issues Found:**");
    for (const issue of result.issues) {
      const severity = issue.severity.toUpperCase();
      lines.push(`- [${severity}] ${issue.description}`);
    }
  }
  if (result.suggestions && result.suggestions.length > 0) {
    lines.push("");
    lines.push("**Suggestions:**");
    for (const suggestion of result.suggestions) {
      lines.push(`- ${suggestion}`);
    }
  }
  return lines.join("\n");
}
function generateDevModePrompt(context, issues) {
  const lines = [];
  lines.push("## Search Results Review");
  lines.push("");
  lines.push(`Query: "${context.query}"`);
  lines.push(`Intent: ${context.userIntent}`);
  lines.push("");
  if (issues.length > 0) {
    lines.push("**Potential issues detected:**");
    for (const issue of issues) {
      lines.push(`- ${issue.description}`);
    }
    lines.push("");
  }
  if (context.results.length > 0) {
    lines.push("**Sample results:**");
    for (const result of context.results.slice(0, 3)) {
      const title = result.title || result.fullText.slice(0, 40);
      lines.push(`  ${result.index + 1}. ${title}`);
    }
    lines.push("");
  }
  lines.push("**What would you like to do?**");
  lines.push("1. Accept results as expected");
  lines.push("2. Refine the search query");
  lines.push("3. Report as bug");
  lines.push("4. Skip this test");
  return lines.join("\n");
}
var init_search_validation = __esm({
  "src/flows/search-validation.ts"() {
    "use strict";
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
  const path2 = url.pathname.toLowerCase();
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
  if (skipExtensions.some((ext) => path2.endsWith(ext))) return true;
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
  if (skipPaths.some((p) => path2.includes(p))) return true;
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

// src/integration.ts
var integration_exports = {};
__export(integration_exports, {
  discoverApiRoutes: () => discoverApiRoutes,
  extractApiCalls: () => extractApiCalls,
  filePathToRoute: () => filePathToRoute,
  filterByEndpoint: () => filterByEndpoint,
  filterByMethod: () => filterByMethod,
  findOrphanEndpoints: () => findOrphanEndpoints,
  groupByEndpoint: () => groupByEndpoint,
  groupByFile: () => groupByFile,
  scanDirectoryForApiCalls: () => scanDirectoryForApiCalls
});
function extractCallerContext(content, targetLine) {
  const lines = content.split("\n");
  for (let i = targetLine - 1; i >= Math.max(0, targetLine - 30); i--) {
    const line = lines[i];
    const functionMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
    const arrowMatch = line.match(/(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/);
    const componentMatch = line.match(/(?:export\s+)?(?:const|function)\s+([A-Z]\w+)/);
    if (functionMatch) return functionMatch[1];
    if (arrowMatch) return arrowMatch[1];
    if (componentMatch) return componentMatch[1];
  }
  return void 0;
}
function parseEndpoint(rawEndpoint) {
  const hasTemplateLiteral = rawEndpoint.includes("${") || rawEndpoint.includes("`");
  const hasConcatenation = /['"].*\+|^\w+$/.test(rawEndpoint);
  if (hasTemplateLiteral || hasConcatenation) {
    return {
      endpoint: rawEndpoint.replace(/`/g, "").replace(/\$\{[^}]+\}/g, "{dynamic}"),
      isDynamic: true
    };
  }
  return {
    endpoint: rawEndpoint.replace(/['"]/g, ""),
    isDynamic: false
  };
}
function extractFromContent(content, sourceFile) {
  const calls = [];
  const lines = content.split("\n");
  const fetchPattern = /fetch\s*\(\s*(['"`])([^'"`]+)\1/g;
  const fetchWithOptionsPattern = /fetch\s*\(\s*(['"`])([^'"`]+)\1\s*,\s*\{[^}]*method\s*:\s*['"](\w+)['"]/g;
  const axiosPattern = /axios\.(get|post|put|delete|patch|head|options)\s*\(\s*(['"`])([^'"`]+)\2/g;
  const axiosConfigPattern = /axios\s*\(\s*\{[^}]*url\s*:\s*(['"`])([^'"`]+)\1[^}]*method\s*:\s*['"](\w+)['"]/g;
  const templateLiteralPattern = /(?:fetch|axios(?:\.\w+)?)\s*\(\s*`([^`]+)`/g;
  const urlVariablePattern = /const\s+(\w*[Uu]rl\w*)\s*=\s*(['"`])([^'"`]+)\2/g;
  const urlUsagePattern = /(?:fetch|axios(?:\.\w+)?)\s*\(\s*(\w+)/g;
  const urlVariables = /* @__PURE__ */ new Map();
  lines.forEach((line, index) => {
    let match;
    const urlVarRegex = new RegExp(urlVariablePattern.source, "g");
    while ((match = urlVarRegex.exec(line)) !== null) {
      urlVariables.set(match[1], {
        endpoint: match[3],
        lineNumber: index + 1
      });
    }
  });
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    let match;
    const fetchOptsRegex = new RegExp(fetchWithOptionsPattern.source, "g");
    while ((match = fetchOptsRegex.exec(line)) !== null) {
      const { endpoint, isDynamic } = parseEndpoint(match[2]);
      calls.push({
        endpoint,
        method: match[3].toUpperCase(),
        sourceFile,
        lineNumber,
        callerContext: extractCallerContext(content, lineNumber),
        isDynamic
      });
    }
    const fetchRegex = new RegExp(fetchPattern.source, "g");
    while ((match = fetchRegex.exec(line)) !== null) {
      if (!line.includes("method:")) {
        const { endpoint, isDynamic } = parseEndpoint(match[2]);
        calls.push({
          endpoint,
          method: "GET",
          sourceFile,
          lineNumber,
          callerContext: extractCallerContext(content, lineNumber),
          isDynamic
        });
      }
    }
    const axiosRegex = new RegExp(axiosPattern.source, "g");
    while ((match = axiosRegex.exec(line)) !== null) {
      const { endpoint, isDynamic } = parseEndpoint(match[3]);
      calls.push({
        endpoint,
        method: match[1].toUpperCase(),
        sourceFile,
        lineNumber,
        callerContext: extractCallerContext(content, lineNumber),
        isDynamic
      });
    }
    const axiosConfigRegex = new RegExp(axiosConfigPattern.source, "g");
    while ((match = axiosConfigRegex.exec(line)) !== null) {
      const { endpoint, isDynamic } = parseEndpoint(match[2]);
      calls.push({
        endpoint,
        method: match[3].toUpperCase(),
        sourceFile,
        lineNumber,
        callerContext: extractCallerContext(content, lineNumber),
        isDynamic
      });
    }
    const templateRegex = new RegExp(templateLiteralPattern.source, "g");
    while ((match = templateRegex.exec(line)) !== null) {
      const { endpoint } = parseEndpoint(match[1]);
      let method = "GET";
      const methodMatch = line.match(/method\s*:\s*['"](\w+)['"]/);
      if (methodMatch) {
        method = methodMatch[1].toUpperCase();
      }
      calls.push({
        endpoint,
        method,
        sourceFile,
        lineNumber,
        callerContext: extractCallerContext(content, lineNumber),
        isDynamic: true
        // Template literals are always dynamic
      });
    }
    const urlUsageRegex = new RegExp(urlUsagePattern.source, "g");
    while ((match = urlUsageRegex.exec(line)) !== null) {
      const varName = match[1];
      if (urlVariables.has(varName)) {
        const urlInfo = urlVariables.get(varName);
        const { endpoint, isDynamic } = parseEndpoint(urlInfo.endpoint);
        let method = "GET";
        const methodMatch = line.match(/method\s*:\s*['"](\w+)['"]/);
        if (methodMatch) {
          method = methodMatch[1].toUpperCase();
        }
        calls.push({
          endpoint,
          method,
          sourceFile,
          lineNumber,
          callerContext: extractCallerContext(content, lineNumber),
          isDynamic
        });
      }
    }
  });
  const uniqueCalls = calls.filter(
    (call, index, self) => index === self.findIndex(
      (c) => c.endpoint === call.endpoint && c.method === call.method && c.lineNumber === call.lineNumber
    )
  );
  return uniqueCalls;
}
async function extractApiCalls(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return extractFromContent(content, filePath);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return [];
  }
}
async function scanDirectoryForApiCalls(dir, _pattern = "**/*.{ts,tsx,js,jsx}") {
  const allCalls = [];
  async function scanDir(currentDir) {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          const skipDirs = ["node_modules", "dist", "build", ".git", "coverage", ".next", "__tests__", "__mocks__"];
          if (!skipDirs.includes(entry.name)) {
            await scanDir(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
            const isTestFile = entry.name.includes(".test.") || entry.name.includes(".spec.") || entry.name.includes(".mock.") || entry.name === "integration.ts";
            if (!isTestFile) {
              const calls = await extractApiCalls(fullPath);
              allCalls.push(...calls);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${currentDir}:`, error);
    }
  }
  await scanDir(dir);
  return allCalls;
}
function groupByEndpoint(calls) {
  const grouped = /* @__PURE__ */ new Map();
  for (const call of calls) {
    const key = call.endpoint;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(call);
  }
  return grouped;
}
function groupByFile(calls) {
  const grouped = /* @__PURE__ */ new Map();
  for (const call of calls) {
    const key = call.sourceFile;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(call);
  }
  return grouped;
}
function filterByMethod(calls, methods) {
  const upperMethods = methods.map((m) => m.toUpperCase());
  return calls.filter((call) => upperMethods.includes(call.method));
}
function filterByEndpoint(calls, endpointPattern) {
  const regex = new RegExp(
    "^" + endpointPattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
  );
  return calls.filter((call) => regex.test(call.endpoint));
}
async function discoverApiRoutes(projectDir) {
  const routes = [];
  async function discoverInDir(dir) {
    const appApiDir = path.join(dir, "app", "api");
    if (await directoryExists(appApiDir)) {
      const appRoutes = await discoverAppRouterRoutes(appApiDir, dir);
      routes.push(...appRoutes);
    }
    const pagesApiDir = path.join(dir, "pages", "api");
    if (await directoryExists(pagesApiDir)) {
      const pagesRoutes = await discoverPagesRouterRoutes(pagesApiDir, dir);
      routes.push(...pagesRoutes);
    }
    const srcAppApiDir = path.join(dir, "src", "app", "api");
    if (await directoryExists(srcAppApiDir)) {
      const srcAppRoutes = await discoverAppRouterRoutes(srcAppApiDir, dir);
      routes.push(...srcAppRoutes);
    }
    const srcPagesApiDir = path.join(dir, "src", "pages", "api");
    if (await directoryExists(srcPagesApiDir)) {
      const srcPagesRoutes = await discoverPagesRouterRoutes(srcPagesApiDir, dir);
      routes.push(...srcPagesRoutes);
    }
  }
  await discoverInDir(projectDir);
  try {
    const entries = await fs.readdir(projectDir, { withFileTypes: true });
    const skipDirs = ["node_modules", "dist", "build", ".git", "coverage", ".next"];
    for (const entry of entries) {
      if (entry.isDirectory() && !skipDirs.includes(entry.name)) {
        const subDir = path.join(projectDir, entry.name);
        const hasPackageJson = await fileExists(path.join(subDir, "package.json"));
        if (hasPackageJson) {
          await discoverInDir(subDir);
        }
      }
    }
  } catch {
  }
  return routes;
}
async function fileExists(filePath) {
  try {
    const stat4 = await fs.stat(filePath);
    return stat4.isFile();
  } catch {
    return false;
  }
}
function filePathToRoute(filePath, projectDir) {
  const normalizedFilePath = path.normalize(filePath);
  const normalizedProjectDir = path.normalize(projectDir);
  const relativePath = path.relative(normalizedProjectDir, normalizedFilePath);
  let routePath = relativePath.replace(/\.(ts|tsx|js|jsx)$/, "");
  routePath = routePath.replace(/\/route$/, "");
  routePath = routePath.replace(/\\route$/, "");
  let apiPath = "";
  if (routePath.includes("app/api/") || routePath.includes("app\\api\\")) {
    apiPath = routePath.split(/app[/\\]api[/\\]/)[1] || "";
  } else if (routePath.includes("src/app/api/") || routePath.includes("src\\app\\api\\")) {
    apiPath = routePath.split(/src[/\\]app[/\\]api[/\\]/)[1] || "";
  } else if (routePath.includes("pages/api/") || routePath.includes("pages\\api\\")) {
    apiPath = routePath.split(/pages[/\\]api[/\\]/)[1] || "";
  } else if (routePath.includes("src/pages/api/") || routePath.includes("src\\pages\\api\\")) {
    apiPath = routePath.split(/src[/\\]pages[/\\]api[/\\]/)[1] || "";
  }
  const route = "/api/" + (apiPath ? apiPath.replace(/\\/g, "/") : "");
  return route;
}
function findOrphanEndpoints(apiCalls, apiRoutes) {
  const orphans = [];
  for (const call of apiCalls) {
    const endpoint = call.endpoint;
    if (!endpoint.startsWith("/api") && !endpoint.includes("/api/")) {
      continue;
    }
    if (endpoint.includes("{dynamic}")) {
      continue;
    }
    let apiPath = endpoint;
    if (endpoint.includes("/api/")) {
      apiPath = "/api/" + endpoint.split("/api/")[1].split("?")[0];
    }
    const matchedRoute = apiRoutes.find((route) => {
      const methodMatches = route.method.includes(call.method) || route.method.includes("ALL");
      if (!methodMatches) {
        return false;
      }
      return routeMatchesEndpoint(route.route, apiPath);
    });
    if (!matchedRoute) {
      const searchedLocations = generatePossibleRouteFiles(apiPath);
      orphans.push({
        call,
        searchedLocations
      });
    }
  }
  return orphans;
}
function routeMatchesEndpoint(routePattern, endpoint) {
  const routeParts = routePattern.split("/").filter(Boolean);
  const endpointParts = endpoint.split("/").filter(Boolean);
  if (routeParts.length !== endpointParts.length) {
    return false;
  }
  for (let i = 0; i < routeParts.length; i++) {
    const routePart = routeParts[i];
    const endpointPart = endpointParts[i];
    if (routePart.startsWith("[") && routePart.endsWith("]")) {
      continue;
    }
    if (routePart !== endpointPart) {
      return false;
    }
  }
  return true;
}
function generatePossibleRouteFiles(apiPath) {
  const pathWithoutApi = apiPath.replace(/^\/api\//, "");
  const locations = [];
  locations.push(`app/api/${pathWithoutApi}/route.ts`);
  locations.push(`app/api/${pathWithoutApi}/route.js`);
  locations.push(`src/app/api/${pathWithoutApi}/route.ts`);
  locations.push(`src/app/api/${pathWithoutApi}/route.js`);
  locations.push(`pages/api/${pathWithoutApi}.ts`);
  locations.push(`pages/api/${pathWithoutApi}.js`);
  locations.push(`src/pages/api/${pathWithoutApi}.ts`);
  locations.push(`src/pages/api/${pathWithoutApi}.js`);
  return locations;
}
async function discoverAppRouterRoutes(apiDir, projectDir) {
  const routes = [];
  try {
    const files = await findRouteFiles(apiDir, "route");
    for (const file of files) {
      const content = await fs.readFile(file, "utf-8");
      const methods = extractHttpMethods(content);
      const route = filePathToRoute(file, projectDir);
      const isDynamic = route.includes("[") && route.includes("]");
      if (methods.length > 0) {
        routes.push({
          route,
          method: methods,
          sourceFile: file,
          isDynamic
        });
      }
    }
  } catch (error) {
  }
  return routes;
}
async function discoverPagesRouterRoutes(apiDir, projectDir) {
  const routes = [];
  try {
    const files = await findRouteFiles(apiDir);
    for (const file of files) {
      const content = await fs.readFile(file, "utf-8");
      const methods = extractHttpMethods(content);
      const route = filePathToRoute(file, projectDir);
      const isDynamic = route.includes("[") && route.includes("]");
      if (methods.length > 0 || content.includes("export default")) {
        routes.push({
          route,
          method: methods.length > 0 ? methods : ["GET", "POST", "PUT", "DELETE", "PATCH"],
          sourceFile: file,
          isDynamic
        });
      }
    }
  } catch (error) {
  }
  return routes;
}
async function findRouteFiles(dir, filename) {
  const files = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await findRouteFiles(fullPath, filename);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        const baseName = path.basename(entry.name, ext);
        if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
          if (filename) {
            if (baseName === filename) {
              files.push(fullPath);
            }
          } else {
            files.push(fullPath);
          }
        }
      }
    }
  } catch (error) {
  }
  return files;
}
function extractHttpMethods(content) {
  const methods = [];
  const httpMethods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];
  for (const method of httpMethods) {
    const exportPattern = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\s*\\(`, "g");
    if (exportPattern.test(content)) {
      methods.push(method);
    }
  }
  return methods;
}
async function directoryExists(dir) {
  try {
    const stat4 = await fs.stat(dir);
    return stat4.isDirectory();
  } catch {
    return false;
  }
}
var fs, path;
var init_integration = __esm({
  "src/integration.ts"() {
    "use strict";
    fs = __toESM(require("fs/promises"));
    path = __toESM(require("path"));
  }
});

// src/performance.ts
var performance_exports = {};
__export(performance_exports, {
  PERFORMANCE_THRESHOLDS: () => PERFORMANCE_THRESHOLDS,
  formatPerformanceResult: () => formatPerformanceResult,
  measurePerformance: () => measurePerformance,
  measureWebVitals: () => measureWebVitals
});
function rateMetric(value, thresholds) {
  if (value === null) return null;
  if (value <= thresholds.good) return "good";
  if (value <= thresholds.poor) return "needs-improvement";
  return "poor";
}
async function measureWebVitals(page) {
  const metrics = await page.evaluate(() => {
    return new Promise((resolve2) => {
      const result = {
        LCP: null,
        FID: null,
        CLS: null,
        TTFB: null,
        FCP: null,
        TTI: null
      };
      const navEntry = performance.getEntriesByType("navigation")[0];
      if (navEntry) {
        result.TTFB = navEntry.responseStart - navEntry.requestStart;
      }
      const paintEntries = performance.getEntriesByType("paint");
      const fcpEntry = paintEntries.find((e) => e.name === "first-contentful-paint");
      if (fcpEntry) {
        result.FCP = fcpEntry.startTime;
      }
      let lcpValue = null;
      let clsValue = 0;
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          lcpValue = lastEntry.startTime;
        }
      });
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
      });
      try {
        lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
      } catch {
      }
      try {
        clsObserver.observe({ type: "layout-shift", buffered: true });
      } catch {
      }
      setTimeout(() => {
        lcpObserver.disconnect();
        clsObserver.disconnect();
        result.LCP = lcpValue;
        result.CLS = clsValue;
        if (navEntry) {
          result.TTI = navEntry.domInteractive;
        }
        resolve2(result);
      }, 3e3);
    });
  });
  return metrics;
}
async function measurePerformance(page) {
  const metrics = await measureWebVitals(page);
  const ratings = {
    LCP: { value: metrics.LCP, rating: rateMetric(metrics.LCP, PERFORMANCE_THRESHOLDS.LCP) },
    FID: { value: metrics.FID, rating: rateMetric(metrics.FID, PERFORMANCE_THRESHOLDS.FID) },
    CLS: { value: metrics.CLS, rating: rateMetric(metrics.CLS, PERFORMANCE_THRESHOLDS.CLS) },
    TTFB: { value: metrics.TTFB, rating: rateMetric(metrics.TTFB, PERFORMANCE_THRESHOLDS.TTFB) },
    FCP: { value: metrics.FCP, rating: rateMetric(metrics.FCP, PERFORMANCE_THRESHOLDS.FCP) },
    TTI: { value: metrics.TTI, rating: rateMetric(metrics.TTI, PERFORMANCE_THRESHOLDS.TTI) }
  };
  const issues = [];
  const recommendations = [];
  let passedVitals = 0;
  let totalVitals = 0;
  const coreVitals = ["LCP", "CLS", "TTFB", "FCP"];
  for (const vital of coreVitals) {
    const rated = ratings[vital];
    if (rated.value !== null) {
      totalVitals++;
      if (rated.rating === "good") {
        passedVitals++;
      } else if (rated.rating === "poor") {
        issues.push(`${vital} is poor (${formatMetric(vital, rated.value)})`);
        recommendations.push(getRecommendation(vital));
      } else if (rated.rating === "needs-improvement") {
        issues.push(`${vital} needs improvement (${formatMetric(vital, rated.value)})`);
      }
    }
  }
  const poorCount = Object.values(ratings).filter((r) => r.rating === "poor").length;
  const needsImprovementCount = Object.values(ratings).filter((r) => r.rating === "needs-improvement").length;
  let overallRating = "good";
  if (poorCount > 0) {
    overallRating = "poor";
  } else if (needsImprovementCount > 0) {
    overallRating = "needs-improvement";
  }
  return {
    metrics,
    ratings,
    summary: {
      overallRating,
      passedVitals,
      totalVitals,
      issues,
      recommendations
    }
  };
}
function formatMetric(name, value) {
  if (name === "CLS") {
    return value.toFixed(3);
  }
  return `${Math.round(value)}ms`;
}
function getRecommendation(metric) {
  const recommendations = {
    LCP: "Optimize largest image/text block: use lazy loading, preload critical assets, optimize server response",
    FID: "Reduce JavaScript execution time: split code, defer non-critical JS, use web workers",
    CLS: "Reserve space for dynamic content: set explicit dimensions for images/ads/embeds",
    TTFB: "Improve server response: use CDN, optimize database queries, enable caching",
    FCP: "Eliminate render-blocking resources: inline critical CSS, defer non-critical JS",
    TTI: "Reduce main thread work: minimize/defer JavaScript, reduce DOM size"
  };
  return recommendations[metric];
}
function formatPerformanceResult(result) {
  const lines = [];
  lines.push("Performance Metrics");
  lines.push("===================");
  lines.push("");
  const ratingIcon = result.summary.overallRating === "good" ? "\u2713" : result.summary.overallRating === "needs-improvement" ? "~" : "\u2717";
  const ratingColor = result.summary.overallRating === "good" ? "\x1B[32m" : result.summary.overallRating === "needs-improvement" ? "\x1B[33m" : "\x1B[31m";
  lines.push(`Overall: ${ratingColor}${ratingIcon} ${result.summary.overallRating.toUpperCase()}\x1B[0m`);
  lines.push(`Passed: ${result.summary.passedVitals}/${result.summary.totalVitals} core vitals`);
  lines.push("");
  lines.push("Core Web Vitals:");
  const vitals = ["LCP", "FCP", "TTFB", "CLS"];
  for (const vital of vitals) {
    const rated = result.ratings[vital];
    if (rated.value !== null) {
      const icon = rated.rating === "good" ? "\u2713" : rated.rating === "needs-improvement" ? "~" : "\u2717";
      const color = rated.rating === "good" ? "\x1B[32m" : rated.rating === "needs-improvement" ? "\x1B[33m" : "\x1B[31m";
      lines.push(`  ${color}${icon}\x1B[0m ${vital}: ${formatMetric(vital, rated.value)}`);
    }
  }
  if (result.summary.issues.length > 0) {
    lines.push("");
    lines.push("Issues:");
    for (const issue of result.summary.issues) {
      lines.push(`  ! ${issue}`);
    }
  }
  if (result.summary.recommendations.length > 0) {
    lines.push("");
    lines.push("Recommendations:");
    for (const rec of result.summary.recommendations) {
      lines.push(`  -> ${rec}`);
    }
  }
  return lines.join("\n");
}
var PERFORMANCE_THRESHOLDS;
var init_performance = __esm({
  "src/performance.ts"() {
    "use strict";
    PERFORMANCE_THRESHOLDS = {
      LCP: { good: 2500, poor: 4e3 },
      FID: { good: 100, poor: 300 },
      CLS: { good: 0.1, poor: 0.25 },
      TTFB: { good: 800, poor: 1800 },
      FCP: { good: 1800, poor: 3e3 },
      TTI: { good: 3800, poor: 7300 }
    };
  }
});

// src/interactivity.ts
var interactivity_exports = {};
__export(interactivity_exports, {
  formatInteractivityResult: () => formatInteractivityResult,
  testInteractivity: () => testInteractivity
});
async function testInteractivity(page) {
  const data = await page.evaluate(() => {
    const results = {
      buttons: [],
      links: [],
      forms: []
    };
    function hasEventHandler(el) {
      const inlineHandlers = ["onclick", "onmousedown", "onmouseup", "ontouchstart", "ontouchend"];
      for (const handler of inlineHandlers) {
        if (el.getAttribute(handler)) return true;
      }
      const attrs = Array.from(el.attributes).map((a) => a.name);
      const frameworkPatterns = ["@click", "v-on:click", "ng-click", "(click)"];
      for (const pattern of frameworkPatterns) {
        if (attrs.some((a) => a.includes(pattern) || a.startsWith(pattern))) return true;
      }
      if (el.getAttribute("data-action") || el.getAttribute("data-onclick")) return true;
      const tagName = el.tagName.toLowerCase();
      if (tagName === "a" && el.href) return true;
      if (tagName === "button") return true;
      if (tagName === "input" && ["submit", "button"].includes(el.type)) return true;
      return false;
    }
    function getSelector(el) {
      if (el.id) return `#${el.id}`;
      const classes = Array.from(el.classList).slice(0, 2).join(".");
      const tag = el.tagName.toLowerCase();
      if (classes) return `${tag}.${classes}`;
      return tag;
    }
    function isVisible(el) {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && rect.width > 0 && rect.height > 0;
    }
    const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]'));
    for (const btn of buttons) {
      const el = btn;
      results.buttons.push({
        selector: getSelector(el),
        tagName: el.tagName.toLowerCase(),
        type: el.type || void 0,
        text: el.textContent?.trim() || el.value || void 0,
        hasHandler: hasEventHandler(el),
        isDisabled: el.disabled || el.getAttribute("aria-disabled") === "true",
        isVisible: isVisible(el),
        a11y: {
          role: el.getAttribute("role") || void 0,
          ariaLabel: el.getAttribute("aria-label") || void 0,
          tabIndex: el.tabIndex
        },
        buttonType: el.type || void 0,
        formId: el.form?.id || void 0
      });
    }
    const links = Array.from(document.querySelectorAll("a[href]"));
    for (const link of links) {
      const el = link;
      const href = el.getAttribute("href") || "";
      const isPlaceholder = href === "#" || href === "" || href === "javascript:void(0)";
      results.links.push({
        selector: getSelector(el),
        tagName: "a",
        text: el.textContent?.trim() || void 0,
        hasHandler: hasEventHandler(el) || !isPlaceholder,
        isDisabled: el.getAttribute("aria-disabled") === "true",
        isVisible: isVisible(el),
        a11y: {
          role: el.getAttribute("role") || void 0,
          ariaLabel: el.getAttribute("aria-label") || void 0,
          tabIndex: el.tabIndex
        },
        href,
        isPlaceholder,
        opensNewTab: el.target === "_blank",
        isExternal: el.hostname !== window.location.hostname
      });
    }
    const forms = Array.from(document.querySelectorAll("form"));
    for (const form of forms) {
      const el = form;
      const fields = [];
      const inputs = Array.from(el.querySelectorAll("input, select, textarea"));
      for (const input of inputs) {
        const field = input;
        if (["hidden", "submit", "button"].includes(field.type)) continue;
        const labelEl = el.querySelector(`label[for="${field.id}"]`) || field.closest("label");
        fields.push({
          selector: getSelector(field),
          name: field.name || void 0,
          type: field.type || field.tagName.toLowerCase(),
          label: labelEl?.textContent?.trim() || void 0,
          required: field.required,
          hasValidation: field.hasAttribute("pattern") || field.hasAttribute("min") || field.hasAttribute("max") || field.hasAttribute("minlength") || field.hasAttribute("maxlength")
        });
      }
      const submitBtn = el.querySelector('button[type="submit"], input[type="submit"]');
      let submitInfo;
      if (submitBtn) {
        const btn = submitBtn;
        submitInfo = {
          selector: getSelector(btn),
          tagName: btn.tagName.toLowerCase(),
          text: btn.textContent?.trim() || btn.value || void 0,
          hasHandler: hasEventHandler(btn),
          isDisabled: btn.disabled,
          isVisible: isVisible(btn),
          a11y: {
            role: btn.getAttribute("role") || void 0,
            ariaLabel: btn.getAttribute("aria-label") || void 0
          },
          buttonType: "submit"
        };
      }
      const hasSubmitHandler = hasEventHandler(el) || el.getAttribute("action") !== null || submitBtn !== null;
      results.forms.push({
        selector: getSelector(el),
        action: el.action || void 0,
        method: el.method || void 0,
        hasSubmitHandler,
        fields,
        hasValidation: fields.some((f) => f.hasValidation || f.required),
        submitButton: submitInfo
      });
    }
    return results;
  });
  const issues = [];
  for (const btn of data.buttons) {
    if (!btn.hasHandler && !btn.isDisabled) {
      issues.push({
        type: "NO_HANDLER",
        element: btn.selector,
        severity: "warning",
        description: `Button "${btn.text || btn.selector}" has no click handler`
      });
    }
    if (btn.isDisabled && btn.isVisible) {
    }
    if (!btn.a11y.ariaLabel && !btn.text) {
      issues.push({
        type: "MISSING_LABEL",
        element: btn.selector,
        severity: "error",
        description: `Button has no accessible label (no text or aria-label)`
      });
    }
  }
  for (const link of data.links) {
    if (link.isPlaceholder && !link.hasHandler) {
      issues.push({
        type: "PLACEHOLDER_LINK",
        element: link.selector,
        severity: "error",
        description: `Link "${link.text || link.selector}" has placeholder href without handler`
      });
    }
    if (!link.a11y.ariaLabel && !link.text) {
      issues.push({
        type: "MISSING_LABEL",
        element: link.selector,
        severity: "error",
        description: `Link has no accessible label (no text or aria-label)`
      });
    }
  }
  for (const form of data.forms) {
    if (!form.hasSubmitHandler) {
      issues.push({
        type: "FORM_NO_SUBMIT",
        element: form.selector,
        severity: "warning",
        description: `Form has no submit handler or action`
      });
    }
    for (const field of form.fields) {
      if (!field.label && field.type !== "hidden") {
        issues.push({
          type: "MISSING_LABEL",
          element: field.selector,
          severity: "warning",
          description: `Form field "${field.name || field.selector}" has no label`
        });
      }
    }
  }
  const allInteractive = [...data.buttons, ...data.links];
  const withHandlers = allInteractive.filter((e) => e.hasHandler).length;
  return {
    buttons: data.buttons,
    links: data.links,
    forms: data.forms,
    issues,
    summary: {
      totalInteractive: allInteractive.length,
      withHandlers,
      withoutHandlers: allInteractive.length - withHandlers,
      issueCount: {
        error: issues.filter((i) => i.severity === "error").length,
        warning: issues.filter((i) => i.severity === "warning").length,
        info: issues.filter((i) => i.severity === "info").length
      }
    }
  };
}
function formatInteractivityResult(result) {
  const lines = [];
  lines.push("Interactivity Analysis");
  lines.push("======================");
  lines.push("");
  lines.push(`Total interactive elements: ${result.summary.totalInteractive}`);
  lines.push(`  With handlers: ${result.summary.withHandlers}`);
  lines.push(`  Without handlers: ${result.summary.withoutHandlers}`);
  lines.push("");
  lines.push(`Buttons: ${result.buttons.length}`);
  lines.push(`Links: ${result.links.length}`);
  lines.push(`Forms: ${result.forms.length}`);
  lines.push("");
  if (result.forms.length > 0) {
    lines.push("Forms:");
    for (const form of result.forms) {
      const icon = form.hasSubmitHandler ? "\u2713" : "!";
      lines.push(`  ${icon} ${form.selector} (${form.fields.length} fields)`);
    }
    lines.push("");
  }
  if (result.issues.length > 0) {
    lines.push("Issues:");
    for (const issue of result.issues) {
      const icon = issue.severity === "error" ? "\x1B[31m\u2717\x1B[0m" : issue.severity === "warning" ? "\x1B[33m!\x1B[0m" : "i";
      lines.push(`  ${icon} [${issue.type}] ${issue.description}`);
    }
  } else {
    lines.push("No issues detected.");
  }
  return lines.join("\n");
}
var init_interactivity = __esm({
  "src/interactivity.ts"() {
    "use strict";
  }
});

// src/api-timing.ts
var api_timing_exports = {};
__export(api_timing_exports, {
  createApiTracker: () => createApiTracker,
  formatApiTimingResult: () => formatApiTimingResult,
  measureApiTiming: () => measureApiTiming
});
async function measureApiTiming(page, options = {}) {
  const {
    filter,
    includeStatic = false,
    timeout = 1e4,
    minDuration = 0
  } = options;
  const requests = /* @__PURE__ */ new Map();
  const completedRequests = [];
  const requestHandler = (request) => {
    const url = request.url();
    const resourceType = request.resourceType();
    if (!includeStatic && ["image", "font", "stylesheet", "media"].includes(resourceType)) {
      return;
    }
    if (filter && !filter.test(url)) {
      return;
    }
    requests.set(request, { startTime: Date.now() });
  };
  const responseHandler = async (response) => {
    const request = response.request();
    const requestData = requests.get(request);
    if (!requestData) return;
    const duration = Date.now() - requestData.startTime;
    if (duration < minDuration) {
      requests.delete(request);
      return;
    }
    try {
      const body = await response.body().catch(() => Buffer.alloc(0));
      const size = body.length;
      let timing = {};
      try {
        timing = response.request().timing();
      } catch {
      }
      completedRequests.push({
        url: request.url(),
        method: request.method(),
        duration,
        status: response.status(),
        size,
        resourceType: request.resourceType(),
        timing: {
          dnsLookup: timing.domainLookupEnd !== void 0 && timing.domainLookupStart !== void 0 ? timing.domainLookupEnd - timing.domainLookupStart : void 0,
          tcpConnect: timing.connectEnd !== void 0 && timing.connectStart !== void 0 ? timing.connectEnd - timing.connectStart : void 0,
          requestSent: timing.requestStart !== void 0 && timing.connectEnd !== void 0 ? timing.requestStart - timing.connectEnd : void 0,
          waiting: timing.responseStart !== void 0 && timing.requestStart !== void 0 ? timing.responseStart - timing.requestStart : void 0,
          contentDownload: timing.responseEnd !== void 0 && timing.responseStart !== void 0 ? timing.responseEnd - timing.responseStart : void 0
        }
      });
    } catch {
    }
    requests.delete(request);
  };
  const requestFailedHandler = (request) => {
    const requestData = requests.get(request);
    if (!requestData) return;
    const duration = Date.now() - requestData.startTime;
    completedRequests.push({
      url: request.url(),
      method: request.method(),
      duration,
      status: 0,
      // 0 indicates failure
      size: 0,
      resourceType: request.resourceType(),
      timing: {}
    });
    requests.delete(request);
  };
  page.on("request", requestHandler);
  page.on("response", responseHandler);
  page.on("requestfailed", requestFailedHandler);
  await new Promise((resolve2) => {
    const startWait = Date.now();
    const check = () => {
      if (requests.size === 0 || Date.now() - startWait > timeout) {
        resolve2();
        return;
      }
      setTimeout(check, 100);
    };
    setTimeout(check, 1e3);
  });
  page.off("request", requestHandler);
  page.off("response", responseHandler);
  page.off("requestfailed", requestFailedHandler);
  const totalRequests = completedRequests.length;
  const totalTime = completedRequests.reduce((sum, r) => sum + r.duration, 0);
  const totalSize = completedRequests.reduce((sum, r) => sum + r.size, 0);
  const failedRequests = completedRequests.filter((r) => r.status === 0 || r.status >= 400).length;
  let slowestRequest = null;
  let fastestRequest = null;
  if (completedRequests.length > 0) {
    const sorted = [...completedRequests].sort((a, b) => b.duration - a.duration);
    slowestRequest = { url: sorted[0].url, duration: sorted[0].duration };
    fastestRequest = { url: sorted[sorted.length - 1].url, duration: sorted[sorted.length - 1].duration };
  }
  const byStatus = {};
  for (const req of completedRequests) {
    byStatus[req.status] = (byStatus[req.status] || 0) + 1;
  }
  return {
    requests: completedRequests.sort((a, b) => b.duration - a.duration),
    summary: {
      totalRequests,
      totalTime,
      totalSize,
      averageTime: totalRequests > 0 ? Math.round(totalTime / totalRequests) : 0,
      slowestRequest,
      fastestRequest,
      failedRequests,
      byStatus
    }
  };
}
function createApiTracker(page, options = {}) {
  const {
    filter,
    includeStatic = false,
    minDuration = 0
  } = options;
  const requests = /* @__PURE__ */ new Map();
  const completedRequests = [];
  let isTracking = false;
  const requestHandler = (request) => {
    if (!isTracking) return;
    const url = request.url();
    const resourceType = request.resourceType();
    if (!includeStatic && ["image", "font", "stylesheet", "media"].includes(resourceType)) {
      return;
    }
    if (filter && !filter.test(url)) {
      return;
    }
    requests.set(request, { startTime: Date.now() });
  };
  const responseHandler = async (response) => {
    const request = response.request();
    const requestData = requests.get(request);
    if (!requestData) return;
    const duration = Date.now() - requestData.startTime;
    if (duration < minDuration) {
      requests.delete(request);
      return;
    }
    try {
      const body = await response.body().catch(() => Buffer.alloc(0));
      completedRequests.push({
        url: request.url(),
        method: request.method(),
        duration,
        status: response.status(),
        size: body.length,
        resourceType: request.resourceType(),
        timing: {}
      });
    } catch {
    }
    requests.delete(request);
  };
  const requestFailedHandler = (request) => {
    const requestData = requests.get(request);
    if (!requestData) return;
    completedRequests.push({
      url: request.url(),
      method: request.method(),
      duration: Date.now() - requestData.startTime,
      status: 0,
      size: 0,
      resourceType: request.resourceType(),
      timing: {}
    });
    requests.delete(request);
  };
  return {
    start() {
      isTracking = true;
      page.on("request", requestHandler);
      page.on("response", responseHandler);
      page.on("requestfailed", requestFailedHandler);
    },
    stop() {
      isTracking = false;
      page.off("request", requestHandler);
      page.off("response", responseHandler);
      page.off("requestfailed", requestFailedHandler);
      const totalRequests = completedRequests.length;
      const totalTime = completedRequests.reduce((sum, r) => sum + r.duration, 0);
      const totalSize = completedRequests.reduce((sum, r) => sum + r.size, 0);
      const failedRequests = completedRequests.filter((r) => r.status === 0 || r.status >= 400).length;
      let slowestRequest = null;
      let fastestRequest = null;
      if (completedRequests.length > 0) {
        const sorted = [...completedRequests].sort((a, b) => b.duration - a.duration);
        slowestRequest = { url: sorted[0].url, duration: sorted[0].duration };
        fastestRequest = { url: sorted[sorted.length - 1].url, duration: sorted[sorted.length - 1].duration };
      }
      const byStatus = {};
      for (const req of completedRequests) {
        byStatus[req.status] = (byStatus[req.status] || 0) + 1;
      }
      return {
        requests: completedRequests.sort((a, b) => b.duration - a.duration),
        summary: {
          totalRequests,
          totalTime,
          totalSize,
          averageTime: totalRequests > 0 ? Math.round(totalTime / totalRequests) : 0,
          slowestRequest,
          fastestRequest,
          failedRequests,
          byStatus
        }
      };
    },
    getRequests() {
      return [...completedRequests];
    }
  };
}
function formatApiTimingResult(result) {
  const lines = [];
  lines.push("API Timing Analysis");
  lines.push("===================");
  lines.push("");
  lines.push("Summary:");
  lines.push(`  Total requests: ${result.summary.totalRequests}`);
  lines.push(`  Total time: ${result.summary.totalTime}ms`);
  lines.push(`  Total size: ${formatBytes(result.summary.totalSize)}`);
  lines.push(`  Average time: ${result.summary.averageTime}ms`);
  lines.push(`  Failed requests: ${result.summary.failedRequests}`);
  lines.push("");
  if (result.summary.slowestRequest) {
    lines.push(`Slowest: ${result.summary.slowestRequest.duration}ms`);
    lines.push(`  ${truncateUrl(result.summary.slowestRequest.url)}`);
  }
  if (result.summary.fastestRequest && result.requests.length > 1) {
    lines.push(`Fastest: ${result.summary.fastestRequest.duration}ms`);
    lines.push(`  ${truncateUrl(result.summary.fastestRequest.url)}`);
  }
  lines.push("");
  if (result.requests.length > 0) {
    lines.push("Slowest requests:");
    const top10 = result.requests.slice(0, 10);
    for (const req of top10) {
      const statusIcon = req.status === 0 ? "\x1B[31m\u2717\x1B[0m" : req.status >= 400 ? "\x1B[31m!\x1B[0m" : "\x1B[32m\u2713\x1B[0m";
      lines.push(`  ${statusIcon} ${req.duration}ms ${req.method} ${truncateUrl(req.url)}`);
    }
  }
  return lines.join("\n");
}
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
function truncateUrl(url, maxLength = 60) {
  try {
    const parsed = new URL(url);
    const path2 = parsed.pathname + parsed.search;
    if (path2.length > maxLength) {
      return path2.substring(0, maxLength - 3) + "...";
    }
    return path2;
  } catch {
    if (url.length > maxLength) {
      return url.substring(0, maxLength - 3) + "...";
    }
    return url;
  }
}
var init_api_timing = __esm({
  "src/api-timing.ts"() {
    "use strict";
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
  const configPath = (0, import_path9.join)(projectDir, ".ibr", "rules.json");
  if (!(0, import_fs2.existsSync)(configPath)) {
    return { extends: [], rules: {} };
  }
  try {
    const content = await (0, import_promises9.readFile)(configPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.warn(`Failed to parse rules.json: ${error}`);
    return { extends: [], rules: {} };
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
  const { rules: rules2, settings } = mergeRuleSettings(config.extends ?? [], config.rules);
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
var import_promises9, import_fs2, import_path9, presets;
var init_engine = __esm({
  "src/rules/engine.ts"() {
    "use strict";
    import_promises9 = require("fs/promises");
    import_fs2 = require("fs");
    import_path9 = require("path");
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
    browser2 = await import_playwright7.chromium.launch({
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
  const lockPath = (0, import_path10.join)(outputDir, LOCK_FILE);
  if (!(0, import_fs3.existsSync)(lockPath)) {
    return false;
  }
  try {
    const content = await (0, import_promises10.readFile)(lockPath, "utf-8");
    const timestamp = parseInt(content, 10);
    const age = Date.now() - timestamp;
    if (age > LOCK_TIMEOUT_MS) {
      await (0, import_promises10.unlink)(lockPath);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
async function createLock(outputDir) {
  const lockPath = (0, import_path10.join)(outputDir, LOCK_FILE);
  await (0, import_promises10.writeFile)(lockPath, Date.now().toString());
}
async function releaseLock(outputDir) {
  const lockPath = (0, import_path10.join)(outputDir, LOCK_FILE);
  try {
    await (0, import_promises10.unlink)(lockPath);
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
    const generateSelector = (el) => {
      if (el.id) return `#${el.id}`;
      const path2 = [];
      let current = el;
      while (current && current !== document.body) {
        let selector = current.tagName.toLowerCase();
        if (current.id) {
          selector = `#${current.id}`;
          path2.unshift(selector);
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
        path2.unshift(selector);
        current = current.parentElement;
      }
      return path2.join(" > ").slice(0, 200);
    };
    const detectHandlers = (el) => {
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
    };
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
  const sessionDir = (0, import_path10.join)(outputDir, "sessions", sessionId);
  await (0, import_promises10.mkdir)(sessionDir, { recursive: true });
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
        const screenshotPath = (0, import_path10.join)(sessionDir, "reference.png");
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
        await (0, import_promises10.writeFile)(
          (0, import_path10.join)(sessionDir, "reference.json"),
          JSON.stringify(result2, null, 2)
        );
        await (0, import_promises10.writeFile)((0, import_path10.join)(sessionDir, "reference.html"), html);
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
  const root = (0, import_path10.join)(outputDir, "sessions", sessionId);
  return {
    root,
    sessionJson: (0, import_path10.join)(root, "session.json"),
    reference: (0, import_path10.join)(root, "reference.png"),
    referenceHtml: (0, import_path10.join)(root, "reference.html"),
    referenceData: (0, import_path10.join)(root, "reference.json"),
    current: (0, import_path10.join)(root, "current.png"),
    diff: (0, import_path10.join)(root, "diff.png")
  };
}
var import_playwright7, import_promises10, import_fs3, import_path10, LOCK_FILE, LOCK_TIMEOUT_MS, EXTRACTION_TIMEOUT_MS, DEFAULT_SELECTORS, CSS_PROPERTIES_TO_EXTRACT, browser2, INTERACTIVE_SELECTORS;
var init_extract = __esm({
  "src/extract.ts"() {
    "use strict";
    import_playwright7 = require("playwright");
    import_promises10 = require("fs/promises");
    import_fs3 = require("fs");
    import_path10 = require("path");
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

// src/framework-parser.ts
function parseDesignFramework(content, sourcePath) {
  const frameworkInfo = detectFrameworkName(content);
  if (!frameworkInfo) {
    const principles2 = extractPrinciples(content);
    if (principles2.length >= 3) {
      return {
        name: "Custom Design Framework",
        principles: principles2,
        source: sourcePath,
        rawContent: content
      };
    }
    return null;
  }
  const principles = extractPrinciples(content);
  if (principles.length === 0) {
    return null;
  }
  return {
    name: frameworkInfo.name,
    version: frameworkInfo.version,
    principles,
    source: sourcePath,
    rawContent: content
  };
}
function detectFrameworkName(content) {
  for (const pattern of FRAMEWORK_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      const name = match[1].trim();
      const version = match[2]?.trim();
      if (!name.toLowerCase().includes("instructions") && !name.toLowerCase().includes("readme") && !name.toLowerCase().includes("overview")) {
        return { name, version };
      }
    }
  }
  const knownFrameworks = [
    "calm precision",
    "material design",
    "human interface guidelines",
    "fluent design",
    "ant design",
    "carbon design",
    "atlassian design"
  ];
  const contentLower = content.toLowerCase();
  for (const framework of knownFrameworks) {
    if (contentLower.includes(framework)) {
      const regex = new RegExp(framework, "i");
      const match = content.match(regex);
      if (match) {
        return { name: match[0] };
      }
    }
  }
  return null;
}
function extractPrinciples(content) {
  const principles = [];
  let principlesSection = content;
  for (const pattern of PRINCIPLES_SECTION_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      const startIndex = match.index || 0;
      const afterMatch = content.slice(startIndex);
      const nextMajorSection = afterMatch.match(/^##\s+[A-Z]/m);
      if (nextMajorSection && nextMajorSection.index) {
        principlesSection = afterMatch.slice(0, nextMajorSection.index);
      } else {
        principlesSection = afterMatch;
      }
      break;
    }
  }
  const numberedMatches = principlesSection.matchAll(
    /###\s*(\d+)\.\s*(.+?)(?:\n|\r\n)([\s\S]*?)(?=###\s*\d+\.|##\s|$)/g
  );
  for (const match of numberedMatches) {
    const number = match[1];
    const name = match[2].trim();
    const body = match[3].trim();
    const principle = parsePrincipleBody(number, name, body);
    if (principle) {
      principles.push(principle);
    }
  }
  if (principles.length === 0) {
    const bulletMatches = principlesSection.matchAll(
      /[-*]\s*\*\*(.+?)\*\*[:\s]*(.+?)(?=\n[-*]|\n\n|$)/gs
    );
    let index = 1;
    for (const match of bulletMatches) {
      const name = match[1].trim();
      const description = match[2].trim();
      principles.push({
        id: `principle-${index}`,
        name,
        description,
        implementation: extractImplementationRules(description)
      });
      index++;
    }
  }
  return principles;
}
function parsePrincipleBody(number, name, body) {
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const foundationMatch = body.match(
    /\*\*(?:Foundation|Based on|Principle):\*\*\s*(.+?)(?:\n|$)/i
  );
  const foundation = foundationMatch ? foundationMatch[1].split(/[,+]/).map((f) => f.trim()).filter(Boolean) : void 0;
  const lines = body.split("\n").filter((l) => l.trim());
  let description = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase().includes("foundation:")) continue;
    if (trimmed.startsWith("-") || trimmed.startsWith("*")) continue;
    description = trimmed;
    break;
  }
  const implementation = extractImplementationRules(body);
  return {
    id: `${number}-${id}`,
    name,
    description: description || name,
    foundation,
    implementation
  };
}
function extractImplementationRules(body) {
  const rules2 = [];
  const bulletMatches = body.matchAll(/^[-*]\s+(.+?)$/gm);
  for (const match of bulletMatches) {
    const rule = match[1].trim();
    if (rule && rule.length > 5) {
      rules2.push(rule);
    }
  }
  if (rules2.length === 0) {
    const sentences = body.split(/[.!]\s+/);
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length > 10 && (trimmed.match(/^(use|don't|never|always|avoid|prefer|ensure)/i) || trimmed.match(/should|must|need to|better to/i))) {
        rules2.push(trimmed);
      }
    }
  }
  return rules2;
}
var FRAMEWORK_PATTERNS, PRINCIPLES_SECTION_PATTERNS;
var init_framework_parser = __esm({
  "src/framework-parser.ts"() {
    "use strict";
    FRAMEWORK_PATTERNS = [
      /^#\s*(.+?)\s*(\d+\.?\d*)?$/m,
      // "# CALM PRECISION 6.1"
      /^\*\*(.+?)\*\*\s*v?(\d+\.?\d*)?/m,
      // "**Framework Name** v1.0"
      /^##?\s*(?:Design\s+)?Framework:\s*(.+?)(?:\s+v?(\d+\.?\d*))?$/im
    ];
    PRINCIPLES_SECTION_PATTERNS = [
      /^##\s*(?:CORE\s+)?PRINCIPLES?/im,
      /^##\s*DESIGN\s+PRINCIPLES?/im,
      /^##\s*GUIDELINES?/im,
      /^##\s*RULES?/im
    ];
  }
});

// src/context-loader.ts
var context_loader_exports = {};
__export(context_loader_exports, {
  discoverUserContext: () => discoverUserContext,
  formatContextSummary: () => formatContextSummary
});
async function discoverUserContext(projectDir) {
  const sources = [];
  let framework;
  const projectClaudePath = (0, import_path11.join)(projectDir, ".claude", "CLAUDE.md");
  const projectClaudeResult = await tryLoadFramework(projectClaudePath, "project-claude");
  sources.push(projectClaudeResult.source);
  if (projectClaudeResult.framework && !framework) {
    framework = projectClaudeResult.framework;
  }
  const rootClaudePath = (0, import_path11.join)(projectDir, "CLAUDE.md");
  const rootClaudeResult = await tryLoadFramework(rootClaudePath, "root-claude");
  sources.push(rootClaudeResult.source);
  if (rootClaudeResult.framework && !framework) {
    framework = rootClaudeResult.framework;
  }
  const userClaudePath = (0, import_path11.join)((0, import_os2.homedir)(), ".claude", "CLAUDE.md");
  const userClaudeResult = await tryLoadFramework(userClaudePath, "user-claude");
  sources.push(userClaudeResult.source);
  if (userClaudeResult.framework && !framework) {
    framework = userClaudeResult.framework;
  }
  const config = await loadIBRConfig(projectDir);
  return {
    projectDir,
    framework,
    sources,
    config
  };
}
async function tryLoadFramework(filePath, type) {
  const source = {
    path: filePath,
    type,
    found: false,
    hasFramework: false
  };
  if (!(0, import_fs4.existsSync)(filePath)) {
    return { source };
  }
  source.found = true;
  try {
    const content = await (0, import_promises11.readFile)(filePath, "utf-8");
    const framework = parseDesignFramework(content, filePath);
    if (framework) {
      source.hasFramework = true;
      return { source, framework };
    }
  } catch (error) {
  }
  return { source };
}
async function loadIBRConfig(projectDir) {
  const configPath = (0, import_path11.join)(projectDir, ".ibrrc.json");
  if (!(0, import_fs4.existsSync)(configPath)) {
    return {};
  }
  try {
    const content = await (0, import_promises11.readFile)(configPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}
function formatContextSummary(context) {
  const lines = [];
  if (context.framework) {
    lines.push(`Design Framework: ${context.framework.name}`);
    lines.push(`Source: ${context.framework.source}`);
    lines.push(`Principles: ${context.framework.principles.length}`);
  } else {
    lines.push("No design framework detected.");
    lines.push("");
    lines.push("To enable design validation, add your framework to CLAUDE.md.");
    lines.push("IBR will parse principles and generate validation rules automatically.");
  }
  lines.push("");
  lines.push("Context sources checked:");
  for (const source of context.sources) {
    const status = !source.found ? "(not found)" : source.hasFramework ? "(framework detected)" : "(no framework)";
    lines.push(`  ${source.type}: ${source.path} ${status}`);
  }
  return lines.join("\n");
}
var import_fs4, import_promises11, import_path11, import_os2;
var init_context_loader = __esm({
  "src/context-loader.ts"() {
    "use strict";
    import_fs4 = require("fs");
    import_promises11 = require("fs/promises");
    import_path11 = require("path");
    import_os2 = require("os");
    init_framework_parser();
  }
});

// src/rules/dynamic-rules.ts
var dynamic_rules_exports = {};
__export(dynamic_rules_exports, {
  createPresetFromFramework: () => createPresetFromFramework,
  generateRulesFromFramework: () => generateRulesFromFramework,
  getRulesSummary: () => getRulesSummary
});
function generateRulesFromFramework(framework) {
  const rules2 = [];
  for (let i = 0; i < framework.principles.length; i++) {
    const principle = framework.principles[i];
    const principleRules = generateRulesForPrinciple(principle, framework.name, i);
    rules2.push(...principleRules);
  }
  return rules2;
}
function createPresetFromFramework(framework) {
  const rules2 = generateRulesFromFramework(framework);
  const defaults = {};
  for (const rule of rules2) {
    defaults[rule.id] = rule.defaultSeverity;
  }
  return {
    name: framework.name.toLowerCase().replace(/\s+/g, "-"),
    description: `Rules generated from ${framework.name}`,
    rules: rules2,
    defaults
  };
}
function generateRulesForPrinciple(principle, frameworkName, index) {
  const rules2 = [];
  const baseId = principle.id || `principle-${index + 1}`;
  const keywords = extractKeywords(principle);
  if (keywords.has("group") || keywords.has("border") || keywords.has("isolate")) {
    rules2.push(createBorderGroupingRule(principle, frameworkName, index));
  }
  if (keywords.has("size") || keywords.has("importance") || keywords.has("button") || keywords.has("fitts")) {
    rules2.push(createButtonSizingRule(principle, frameworkName, index));
  }
  if (keywords.has("touch") || keywords.has("target") || keywords.has("44px") || keywords.has("mobile")) {
    rules2.push(createTouchTargetRule(principle, frameworkName, index));
  }
  if (keywords.has("hierarchy") || keywords.has("title") || keywords.has("description") || keywords.has("metadata")) {
    rules2.push(createHierarchyRule(principle, frameworkName, index));
  }
  if (keywords.has("status") || keywords.has("color") || keywords.has("background")) {
    rules2.push(createStatusColorRule(principle, frameworkName, index));
  }
  if (keywords.has("content") || keywords.has("chrome") || keywords.has("70%")) {
    rules2.push(createContentChromeRule(principle, frameworkName, index));
  }
  if (rules2.length === 0) {
    rules2.push(createGenericPrincipleRule(principle, frameworkName, index));
  }
  return rules2;
}
function extractKeywords(principle) {
  const text = [
    principle.name,
    principle.description,
    ...principle.foundation || [],
    ...principle.implementation
  ].join(" ").toLowerCase();
  return new Set(text.match(/\b\w+\b/g) || []);
}
function createBorderGroupingRule(principle, frameworkName, index) {
  return {
    id: `${principle.id}-border`,
    name: `${principle.name}: Border Usage`,
    description: principle.description,
    defaultSeverity: "warn",
    principleId: principle.id,
    framework: frameworkName,
    principleIndex: index,
    check: (element, _context) => {
      const style = element.computedStyles;
      if (!style) return null;
      const hasBorder = style.border && style.border !== "none" && style.border !== "0px";
      const isListItem = element.tagName === "li" || element.selector?.includes("item");
      if (hasBorder && isListItem) {
        return {
          ruleId: `${principle.id}-border`,
          ruleName: `${frameworkName}: ${principle.name}`,
          severity: "warn",
          message: `Individual borders on list items may isolate rather than group. Consider single group border per "${principle.name}".`,
          element: element.selector,
          bounds: element.bounds,
          fix: "Use single border around group with dividers between items."
        };
      }
      return null;
    }
  };
}
function createButtonSizingRule(principle, frameworkName, index) {
  return {
    id: `${principle.id}-button-size`,
    name: `${principle.name}: Button Sizing`,
    description: principle.description,
    defaultSeverity: "warn",
    principleId: principle.id,
    framework: frameworkName,
    principleIndex: index,
    check: (element, context) => {
      if (element.tagName !== "button" && element.role !== "button") return null;
      const width = element.bounds?.width || 0;
      const height = element.bounds?.height || 0;
      const text = (element.text || element.innerText || "").toLowerCase();
      const isPrimaryAction = /submit|save|confirm|checkout|buy|sign|login|register|continue/i.test(text);
      if (isPrimaryAction && width < 120) {
        return {
          ruleId: `${principle.id}-button-size`,
          ruleName: `${frameworkName}: ${principle.name}`,
          severity: "warn",
          message: `Primary action button "${text}" is ${width}px wide. Per "${principle.name}", primary actions should be more prominent.`,
          element: element.selector,
          bounds: element.bounds,
          fix: "Increase button width to match importance of the action."
        };
      }
      return null;
    }
  };
}
function createTouchTargetRule(principle, frameworkName, index) {
  return {
    id: `${principle.id}-touch-target`,
    name: `${principle.name}: Touch Targets`,
    description: principle.description,
    defaultSeverity: "warn",
    principleId: principle.id,
    framework: frameworkName,
    principleIndex: index,
    check: (element, context) => {
      if (!element.interactive?.isInteractive) return null;
      const width = element.bounds?.width || 0;
      const height = element.bounds?.height || 0;
      const minSize = context.isMobile ? 44 : 24;
      if (width < minSize || height < minSize) {
        return {
          ruleId: `${principle.id}-touch-target`,
          ruleName: `${frameworkName}: ${principle.name}`,
          severity: "warn",
          message: `Interactive element is ${width}x${height}px, below ${minSize}px minimum per "${principle.name}".`,
          element: element.selector,
          bounds: element.bounds,
          fix: `Increase to at least ${minSize}x${minSize}px for ${context.isMobile ? "mobile" : "desktop"}.`
        };
      }
      return null;
    }
  };
}
function createHierarchyRule(principle, frameworkName, index) {
  return {
    id: `${principle.id}-hierarchy`,
    name: `${principle.name}: Content Hierarchy`,
    description: principle.description,
    defaultSeverity: "warn",
    principleId: principle.id,
    framework: frameworkName,
    principleIndex: index,
    check: (_element, _context) => {
      return null;
    }
  };
}
function createStatusColorRule(principle, frameworkName, index) {
  return {
    id: `${principle.id}-status`,
    name: `${principle.name}: Status Indication`,
    description: principle.description,
    defaultSeverity: "warn",
    principleId: principle.id,
    framework: frameworkName,
    principleIndex: index,
    check: (element, _context) => {
      const style = element.computedStyles;
      if (!style) return null;
      const text = (element.text || element.innerText || "").toLowerCase();
      const isStatusText = /success|error|warning|pending|active|inactive|status/i.test(text);
      if (isStatusText && style.backgroundColor && style.backgroundColor !== "transparent") {
        const bgColor = style.backgroundColor;
        if (bgColor && !bgColor.includes("rgba") && !bgColor.includes("0.1") && !bgColor.includes("0.05")) {
          return {
            ruleId: `${principle.id}-status`,
            ruleName: `${frameworkName}: ${principle.name}`,
            severity: "warn",
            message: `Status element "${text}" has heavy background. Per "${principle.name}", consider text color only.`,
            element: element.selector,
            bounds: element.bounds,
            fix: "Use text color only for status indication, not background."
          };
        }
      }
      return null;
    }
  };
}
function createContentChromeRule(principle, frameworkName, index) {
  return {
    id: `${principle.id}-content-chrome`,
    name: `${principle.name}: Content Ratio`,
    description: principle.description,
    defaultSeverity: "warn",
    principleId: principle.id,
    framework: frameworkName,
    principleIndex: index,
    check: (_element, _context) => {
      return null;
    }
  };
}
function createGenericPrincipleRule(principle, frameworkName, index) {
  return {
    id: `${principle.id}-reminder`,
    name: `${principle.name}`,
    description: principle.description,
    defaultSeverity: "warn",
    principleId: principle.id,
    framework: frameworkName,
    principleIndex: index,
    check: (_element, _context) => {
      return null;
    }
  };
}
function getRulesSummary(rules2) {
  const byPrinciple = /* @__PURE__ */ new Map();
  for (const rule of rules2) {
    const existing = byPrinciple.get(rule.principleId) || [];
    existing.push(rule);
    byPrinciple.set(rule.principleId, existing);
  }
  const lines = [];
  lines.push(`Generated ${rules2.length} rules from ${byPrinciple.size} principles:`);
  lines.push("");
  for (const [principleId, principleRules] of byPrinciple) {
    lines.push(`  ${principleId}: ${principleRules.length} rules`);
    for (const rule of principleRules) {
      lines.push(`    - ${rule.name}`);
    }
  }
  return lines.join("\n");
}
var init_dynamic_rules = __esm({
  "src/rules/dynamic-rules.ts"() {
    "use strict";
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
    stateFile: (0, import_path12.join)(outputDir, SERVER_STATE_FILE),
    profileDir: (0, import_path12.join)(outputDir, ISOLATED_PROFILE_DIR),
    sessionsDir: (0, import_path12.join)(outputDir, "sessions")
  };
}
async function isServerRunning(outputDir) {
  const { stateFile } = getPaths(outputDir);
  if (!(0, import_fs5.existsSync)(stateFile)) {
    return false;
  }
  try {
    const content = await (0, import_promises12.readFile)(stateFile, "utf-8");
    const state = JSON.parse(content);
    const browser3 = await import_playwright8.chromium.connect(state.wsEndpoint, { timeout: 2e3 });
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
    await (0, import_promises12.unlink)(stateFile);
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
  await (0, import_promises12.mkdir)(outputDir, { recursive: true });
  if (isolated) {
    await (0, import_promises12.mkdir)(profileDir, { recursive: true });
  }
  const debugPort = 9222 + Math.floor(Math.random() * 1e3);
  const browserArgs = [`--remote-debugging-port=${debugPort}`];
  if (options.lowMemory) {
    browserArgs.push(
      "--disable-gpu",
      // Disable GPU acceleration
      "--disable-dev-shm-usage",
      // Use /tmp instead of /dev/shm
      "--disable-extensions",
      // No extensions
      "--disable-background-networking",
      // Reduce background activity
      "--disable-default-apps",
      // No default Chrome apps
      "--disable-sync",
      // No Chrome sync
      "--no-first-run",
      // Skip first run tasks
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-features=TranslateUI",
      "--disable-ipc-flooding-protection",
      "--memory-pressure-off",
      // Don't respond to memory pressure
      "--js-flags=--max-old-space-size=256"
      // Limit V8 heap to 256MB
    );
  }
  const server = await import_playwright8.chromium.launchServer({
    headless,
    args: browserArgs
  });
  const wsEndpoint = server.wsEndpoint();
  const cdpUrl = `http://127.0.0.1:${debugPort}`;
  const state = {
    wsEndpoint,
    cdpUrl,
    pid: process.pid,
    startedAt: (/* @__PURE__ */ new Date()).toISOString(),
    headless,
    isolatedProfile: isolated ? profileDir : "",
    lowMemory: options.lowMemory
  };
  await (0, import_promises12.writeFile)(stateFile, JSON.stringify(state, null, 2));
  return { server, wsEndpoint };
}
async function connectToBrowserServer(outputDir) {
  const { stateFile } = getPaths(outputDir);
  if (!(0, import_fs5.existsSync)(stateFile)) {
    return null;
  }
  try {
    const content = await (0, import_promises12.readFile)(stateFile, "utf-8");
    const state = JSON.parse(content);
    if (state.cdpUrl) {
      const browser4 = await import_playwright8.chromium.connectOverCDP(state.cdpUrl, { timeout: 5e3 });
      return browser4;
    }
    const browser3 = await import_playwright8.chromium.connect(state.wsEndpoint, { timeout: 5e3 });
    return browser3;
  } catch (error) {
    await cleanupServerState(outputDir);
    return null;
  }
}
async function stopBrowserServer(outputDir) {
  const { stateFile, profileDir: _profileDir } = getPaths(outputDir);
  if (!(0, import_fs5.existsSync)(stateFile)) {
    return false;
  }
  try {
    const content = await (0, import_promises12.readFile)(stateFile, "utf-8");
    const state = JSON.parse(content);
    const browser3 = await import_playwright8.chromium.connect(state.wsEndpoint, { timeout: 5e3 });
    await browser3.close();
    await (0, import_promises12.unlink)(stateFile);
    return true;
  } catch {
    await cleanupServerState(outputDir);
    return false;
  }
}
async function listActiveSessions(outputDir) {
  const { sessionsDir } = getPaths(outputDir);
  if (!(0, import_fs5.existsSync)(sessionsDir)) {
    return [];
  }
  const { readdir: readdir4 } = await import("fs/promises");
  const entries = await readdir4(sessionsDir, { withFileTypes: true });
  const liveSessions = [];
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith("live_")) {
      const statePath = (0, import_path12.join)(sessionsDir, entry.name, "live-session.json");
      if ((0, import_fs5.existsSync)(statePath)) {
        liveSessions.push(entry.name);
      }
    }
  }
  return liveSessions;
}
var import_playwright8, import_promises12, import_fs5, import_path12, import_nanoid3, SERVER_STATE_FILE, ISOLATED_PROFILE_DIR, PersistentSession;
var init_browser_server = __esm({
  "src/browser-server.ts"() {
    "use strict";
    import_playwright8 = require("playwright");
    import_promises12 = require("fs/promises");
    import_fs5 = require("fs");
    import_path12 = require("path");
    import_nanoid3 = require("nanoid");
    init_schemas();
    init_extract();
    SERVER_STATE_FILE = "browser-server.json";
    ISOLATED_PROFILE_DIR = "browser-profile";
    PersistentSession = class _PersistentSession {
      // Browser reference kept for potential future cleanup operations
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
        const sessionId = `live_${(0, import_nanoid3.nanoid)(10)}`;
        const sessionsDir = (0, import_path12.join)(outputDir, "sessions");
        const sessionDir = (0, import_path12.join)(sessionsDir, sessionId);
        await (0, import_promises12.mkdir)(sessionDir, { recursive: true });
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
        await (0, import_promises12.writeFile)(
          (0, import_path12.join)(sessionDir, "live-session.json"),
          JSON.stringify(state, null, 2)
        );
        await page.screenshot({
          path: (0, import_path12.join)(sessionDir, "baseline.png"),
          fullPage: false
        });
        return new _PersistentSession(browser3, context, page, state, sessionDir);
      }
      /**
       * Get session from browser server by ID
       */
      static async get(outputDir, sessionId) {
        const sessionDir = (0, import_path12.join)(outputDir, "sessions", sessionId);
        const statePath = (0, import_path12.join)(sessionDir, "live-session.json");
        if (!(0, import_fs5.existsSync)(statePath)) {
          return null;
        }
        const browser3 = await connectToBrowserServer(outputDir);
        if (!browser3) {
          return null;
        }
        const content = await (0, import_promises12.readFile)(statePath, "utf-8");
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
        await (0, import_promises12.writeFile)(
          (0, import_path12.join)(this.sessionDir, "live-session.json"),
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
          await locator.click({ timeout, force: options?.force });
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
          if (!options?.append) {
            await locator.fill("", { timeout });
          }
          if (options?.delay && options.delay > 0) {
            if (options?.append) {
              await locator.focus({ timeout });
            }
            await locator.pressSequentially(text, { delay: options.delay, timeout });
          } else if (options?.append) {
            await locator.focus({ timeout });
            await locator.pressSequentially(text, { timeout });
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
        const outputPath = (0, import_path12.join)(this.sessionDir, `${screenshotName}.png`);
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
      /**
       * Scroll the page or a specific container
       * @param direction - 'up', 'down', 'left', 'right'
       * @param amount - pixels to scroll (default: 500)
       * @param options - optional selector to scroll within a container
       */
      async scroll(direction, amount = 500, options) {
        const scrollMap = {
          up: { x: 0, y: -amount },
          down: { x: 0, y: amount },
          left: { x: -amount, y: 0 },
          right: { x: amount, y: 0 }
        };
        const { x, y } = scrollMap[direction];
        if (options?.selector) {
          const position2 = await this.page.evaluate(({ sel, deltaX, deltaY }) => {
            const el = document.querySelector(sel);
            if (!el) {
              throw new Error(`Container not found: ${sel}`);
            }
            el.scrollBy(deltaX, deltaY);
            return { x: el.scrollLeft, y: el.scrollTop };
          }, { sel: options.selector, deltaX: x, deltaY: y });
          return position2;
        }
        const position = await this.page.evaluate(({ deltaX, deltaY }) => {
          window.scrollBy(deltaX, deltaY);
          return { x: window.scrollX, y: window.scrollY };
        }, { deltaX: x, deltaY: y });
        return position;
      }
      async evaluate(script) {
        return this.page.evaluate(script);
      }
      /**
       * Detect if a modal is currently open and how to dismiss it
       */
      async detectModal() {
        return this.page.evaluate(() => {
          const modalSelectors = [
            '[role="dialog"]',
            '[role="alertdialog"]',
            '[aria-modal="true"]',
            ".modal.show",
            ".modal.open",
            '.modal[style*="display: block"]',
            '[data-state="open"][data-modal]',
            ".fixed.inset-0"
            // Tailwind modal pattern
          ];
          for (const sel of modalSelectors) {
            const modal = document.querySelector(sel);
            if (modal && getComputedStyle(modal).display !== "none") {
              const closeSelectors = [
                '[aria-label="Close"]',
                '[aria-label="close"]',
                ".close",
                ".btn-close",
                '[data-dismiss="modal"]',
                'button[type="button"]:has(svg)'
                // Icon-only close button
              ];
              let closeButtonSelector;
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
                dismissMethod: closeButtonSelector ? "close-button" : "escape",
                closeButtonSelector
              };
            }
          }
          return { hasModal: false };
        });
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
var import_playwright9, import_promises13, import_fs6, import_path13, import_nanoid4, LiveSession, LiveSessionManager, liveSessionManager;
var init_live_session = __esm({
  "src/live-session.ts"() {
    "use strict";
    import_playwright9 = require("playwright");
    import_promises13 = require("fs/promises");
    import_fs6 = require("fs");
    import_path13 = require("path");
    import_nanoid4 = require("nanoid");
    init_schemas();
    LiveSession = class _LiveSession {
      browser = null;
      context = null;
      page = null;
      state;
      // Output directory kept for potential future directory operations
      outputDir;
      sessionDir;
      constructor(state, outputDir, browser3, context, page) {
        this.state = state;
        this.outputDir = outputDir;
        this.sessionDir = (0, import_path13.join)(outputDir, "sessions", state.id);
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
        const sessionId = `live_${(0, import_nanoid4.nanoid)(10)}`;
        const sessionDir = (0, import_path13.join)(outputDir, "sessions", sessionId);
        await (0, import_promises13.mkdir)(sessionDir, { recursive: true });
        const browser3 = await import_playwright9.chromium.launch({
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
        await (0, import_promises13.writeFile)(
          (0, import_path13.join)(sessionDir, "live-session.json"),
          JSON.stringify(state, null, 2)
        );
        await page.screenshot({
          path: (0, import_path13.join)(sessionDir, "baseline.png"),
          fullPage: false
        });
        return new _LiveSession(state, outputDir, browser3, context, page);
      }
      /**
       * Resume an existing live session (if browser still running)
       * Note: This only works within the same process - browser state is not persisted
       */
      static async resume(outputDir, sessionId) {
        const sessionDir = (0, import_path13.join)(outputDir, "sessions", sessionId);
        const statePath = (0, import_path13.join)(sessionDir, "live-session.json");
        if (!(0, import_fs6.existsSync)(statePath)) {
          return null;
        }
        const content = await (0, import_promises13.readFile)(statePath, "utf-8");
        const state = JSON.parse(content);
        const browser3 = await import_playwright9.chromium.launch({
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
        await (0, import_promises13.writeFile)(
          (0, import_path13.join)(this.sessionDir, "live-session.json"),
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
        const outputPath = (0, import_path13.join)(this.sessionDir, `${screenshotName}.png`);
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

// src/screenshot-manager.ts
var screenshot_manager_exports = {};
__export(screenshot_manager_exports, {
  ScreenshotManager: () => ScreenshotManager,
  formatAge: () => formatAge,
  formatBytes: () => formatBytes2
});
function formatBytes2(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
function formatAge(ms) {
  const seconds = Math.floor(ms / 1e3);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}
var import_promises14, import_fs7, import_path14, DEFAULT_CONFIG, ScreenshotManager;
var init_screenshot_manager = __esm({
  "src/screenshot-manager.ts"() {
    "use strict";
    import_promises14 = require("fs/promises");
    import_fs7 = require("fs");
    import_path14 = require("path");
    DEFAULT_CONFIG = {
      maxAgeDays: 7,
      maxSizeBytes: 500 * 1024 * 1024,
      // 500MB
      retentionPolicy: "both"
    };
    ScreenshotManager = class {
      outputDir;
      config;
      constructor(outputDir, config = {}) {
        this.outputDir = outputDir;
        this.config = { ...DEFAULT_CONFIG, ...config };
      }
      /**
       * Capture a screenshot from a Playwright page
       */
      async capture(page, name, options = {}) {
        const { sessionId, fullPage = false, selector } = options;
        let outputPath;
        if (sessionId) {
          const sessionDir = (0, import_path14.join)(this.outputDir, "sessions", sessionId);
          await (0, import_promises14.mkdir)(sessionDir, { recursive: true });
          outputPath = (0, import_path14.join)(sessionDir, `${name}.png`);
        } else {
          await (0, import_promises14.mkdir)(this.outputDir, { recursive: true });
          outputPath = (0, import_path14.join)(this.outputDir, `${name}.png`);
        }
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
          const element = await page.$(selector);
          if (!element) {
            throw new Error(`Element not found: ${selector}`);
          }
          await element.screenshot({ path: outputPath, type: "png" });
        } else {
          await page.screenshot({
            path: outputPath,
            fullPage,
            type: "png"
          });
        }
        return outputPath;
      }
      /**
       * List all screenshots for a session
       */
      async list(sessionId) {
        const sessionDir = (0, import_path14.join)(this.outputDir, "sessions", sessionId);
        if (!(0, import_fs7.existsSync)(sessionDir)) {
          return [];
        }
        const screenshots = [];
        await this.scanDirectory(sessionDir, sessionId, screenshots);
        screenshots.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return screenshots;
      }
      /**
       * List all screenshots across all sessions
       */
      async listAll() {
        const sessionsDir = (0, import_path14.join)(this.outputDir, "sessions");
        if (!(0, import_fs7.existsSync)(sessionsDir)) {
          return [];
        }
        const screenshots = [];
        const sessions = await (0, import_promises14.readdir)(sessionsDir);
        for (const sessionId of sessions) {
          const sessionDir = (0, import_path14.join)(sessionsDir, sessionId);
          const stats = await (0, import_promises14.stat)(sessionDir);
          if (stats.isDirectory()) {
            await this.scanDirectory(sessionDir, sessionId, screenshots);
          }
        }
        screenshots.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return screenshots;
      }
      /**
       * Scan a directory for PNG files
       */
      async scanDirectory(dir, sessionId, results) {
        const entries = await (0, import_promises14.readdir)(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = (0, import_path14.join)(dir, entry.name);
          if (entry.isDirectory()) {
            await this.scanDirectory(fullPath, sessionId, results);
          } else if (entry.name.endsWith(".png")) {
            const stats = await (0, import_promises14.stat)(fullPath);
            const now = Date.now();
            const stepMatch = entry.name.match(/^\d+-(.+)\.png$/);
            const step = stepMatch ? stepMatch[1] : void 0;
            results.push({
              path: fullPath,
              name: entry.name,
              size: stats.size,
              createdAt: stats.birthtime,
              ageMs: now - stats.birthtime.getTime(),
              sessionId,
              step
            });
          }
        }
      }
      /**
       * Get metadata for a specific screenshot
       */
      async getMetadata(path2) {
        if (!(0, import_fs7.existsSync)(path2)) {
          return null;
        }
        const stats = await (0, import_promises14.stat)(path2);
        const name = (0, import_path14.basename)(path2);
        const dir = (0, import_path14.dirname)(path2);
        const stepMatch = name.match(/^\d+-(.+)\.png$/);
        const step = stepMatch ? stepMatch[1] : void 0;
        const sessionMatch = dir.match(/sessions[/\\]([^/\\]+)/);
        const sessionId = sessionMatch ? sessionMatch[1] : void 0;
        let query;
        let userIntent;
        const resultsPath = (0, import_path14.join)(dir, "results.json");
        if ((0, import_fs7.existsSync)(resultsPath)) {
          try {
            const resultsContent = await (0, import_promises14.readFile)(resultsPath, "utf-8");
            const results = JSON.parse(resultsContent);
            query = results.query;
            userIntent = results.userIntent;
          } catch {
          }
        }
        return {
          path: path2,
          name,
          size: stats.size,
          createdAt: stats.birthtime.toISOString(),
          sessionId,
          step,
          query,
          userIntent
        };
      }
      /**
       * Cleanup old screenshots based on retention policy
       */
      async cleanup(options = {}) {
        const { dryRun = false } = options;
        const report = {
          scanned: 0,
          deleted: 0,
          bytesFreed: 0,
          kept: 0,
          errors: [],
          dryRun
        };
        const screenshots = await this.listAll();
        report.scanned = screenshots.length;
        if (screenshots.length === 0) {
          return report;
        }
        const toDelete = [];
        const maxAgeMs = this.config.maxAgeDays * 24 * 60 * 60 * 1e3;
        if (this.config.retentionPolicy === "age" || this.config.retentionPolicy === "both") {
          for (const shot of screenshots) {
            if (shot.ageMs > maxAgeMs && !toDelete.includes(shot)) {
              toDelete.push(shot);
            }
          }
        }
        if (this.config.retentionPolicy === "size" || this.config.retentionPolicy === "both") {
          let totalSize = screenshots.reduce((sum, s) => sum + s.size, 0);
          const sortedByAge = [...screenshots].sort((a, b) => b.ageMs - a.ageMs);
          for (const shot of sortedByAge) {
            if (totalSize <= this.config.maxSizeBytes) break;
            if (!toDelete.includes(shot)) {
              toDelete.push(shot);
              totalSize -= shot.size;
            }
          }
        }
        for (const shot of toDelete) {
          try {
            if (!dryRun) {
              await (0, import_promises14.unlink)(shot.path);
            }
            report.deleted++;
            report.bytesFreed += shot.size;
          } catch (error) {
            report.errors.push(`Failed to delete ${shot.path}: ${error}`);
          }
        }
        report.kept = report.scanned - report.deleted;
        return report;
      }
      /**
       * Get total storage used by screenshots
       */
      async getStorageUsage() {
        const screenshots = await this.listAll();
        if (screenshots.length === 0) {
          return { totalBytes: 0, fileCount: 0 };
        }
        const totalBytes = screenshots.reduce((sum, s) => sum + s.size, 0);
        const sorted = [...screenshots].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        return {
          totalBytes,
          fileCount: screenshots.length,
          oldestFile: sorted[0].createdAt,
          newestFile: sorted[sorted.length - 1].createdAt
        };
      }
      /**
       * Update configuration
       */
      updateConfig(config) {
        this.config = { ...this.config, ...config };
      }
      /**
       * Save configuration to file
       */
      async saveConfig() {
        const configPath = (0, import_path14.join)(this.outputDir, "screenshot-config.json");
        await (0, import_promises14.writeFile)(configPath, JSON.stringify(this.config, null, 2));
      }
      /**
       * Load configuration from file
       */
      async loadConfig() {
        const configPath = (0, import_path14.join)(this.outputDir, "screenshot-config.json");
        if ((0, import_fs7.existsSync)(configPath)) {
          try {
            const content = await (0, import_promises14.readFile)(configPath, "utf-8");
            const loaded = JSON.parse(content);
            this.config = { ...DEFAULT_CONFIG, ...loaded };
          } catch {
          }
        }
      }
    };
  }
});

// src/bin/ibr.ts
var import_commander = require("commander");
var import_promises15 = require("fs/promises");
var import_path15 = require("path");
var import_fs8 = require("fs");

// src/index.ts
init_schemas();
init_capture();
init_compare();
init_session();

// src/report.ts
init_session();
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
init_semantic();

// src/flows/login.ts
init_types2();
init_state_detector();
async function loginFlow(page, options) {
  const startTime = Date.now();
  const steps = [];
  const timeout = options.timeout || 3e4;
  try {
    const emailField = await findFieldByLabel(page, [
      "email",
      "username",
      "login",
      "user",
      "mail"
    ]);
    if (!emailField) {
      return {
        success: false,
        authenticated: false,
        steps,
        error: "Could not find email/username field",
        duration: Date.now() - startTime
      };
    }
    await emailField.fill(options.email);
    steps.push({ action: "fill email/username", success: true });
    const passwordField = await page.$('input[type="password"]');
    if (!passwordField) {
      return {
        success: false,
        authenticated: false,
        steps,
        error: "Could not find password field",
        duration: Date.now() - startTime
      };
    }
    await passwordField.fill(options.password);
    steps.push({ action: "fill password", success: true });
    if (options.rememberMe) {
      const rememberCheckbox = await page.$(
        'input[type="checkbox"][name*="remember"], input[type="checkbox"][id*="remember"], label:has-text("remember") input[type="checkbox"]'
      );
      if (rememberCheckbox) {
        await rememberCheckbox.check();
        steps.push({ action: "check remember me", success: true });
      }
    }
    const submitButton = await findButton(page, [
      "login",
      "sign in",
      "log in",
      "submit",
      "continue"
    ]);
    if (!submitButton) {
      return {
        success: false,
        authenticated: false,
        steps,
        error: "Could not find submit button",
        duration: Date.now() - startTime
      };
    }
    await submitButton.click();
    steps.push({ action: "click submit", success: true });
    await waitForNavigation(page, timeout);
    steps.push({ action: "wait for response", success: true });
    const authState = await detectAuthState(page);
    const authenticated = authState.authenticated === true;
    let successVerified = authenticated;
    if (options.successIndicator && authenticated) {
      if (options.successIndicator.startsWith(".") || options.successIndicator.startsWith("#") || options.successIndicator.startsWith("[")) {
        const indicator = await page.$(options.successIndicator);
        successVerified = !!indicator;
      }
    }
    steps.push({
      action: "verify authentication",
      success: successVerified
    });
    return {
      success: successVerified,
      authenticated: successVerified,
      username: authState.username,
      steps,
      duration: Date.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      authenticated: false,
      steps,
      error: error instanceof Error ? error.message : "Unknown error",
      duration: Date.now() - startTime
    };
  }
}

// src/flows/index.ts
init_search();

// src/flows/form.ts
init_types2();
async function formFlow(page, options) {
  const startTime = Date.now();
  const steps = [];
  const filledFields = [];
  const failedFields = [];
  const timeout = options.timeout || 1e4;
  try {
    for (const field of options.fields) {
      const fieldType = field.type || "text";
      let element;
      if (fieldType === "textarea") {
        element = await page.$(`textarea[name*="${field.name}" i], textarea[id*="${field.name}" i]`);
      } else if (fieldType === "select") {
        element = await page.$(`select[name*="${field.name}" i], select[id*="${field.name}" i]`);
      } else if (fieldType === "checkbox" || fieldType === "radio") {
        element = await page.$(
          `input[type="${fieldType}"][name*="${field.name}" i], input[type="${fieldType}"][id*="${field.name}" i]`
        );
      } else {
        element = await findFieldByLabel(page, [field.name]);
      }
      if (element) {
        try {
          if (fieldType === "select") {
            await element.selectOption(field.value);
          } else if (fieldType === "checkbox") {
            if (field.value === "true" || field.value === "1") {
              await element.check();
            } else {
              await element.uncheck();
            }
          } else if (fieldType === "radio") {
            await element.check();
          } else {
            await element.fill(field.value);
          }
          filledFields.push(field.name);
          steps.push({ action: `fill ${field.name}`, success: true });
        } catch (err) {
          failedFields.push(field.name);
          steps.push({
            action: `fill ${field.name}`,
            success: false,
            error: err instanceof Error ? err.message : "Unknown error"
          });
        }
      } else {
        failedFields.push(field.name);
        steps.push({
          action: `fill ${field.name}`,
          success: false,
          error: "Field not found"
        });
      }
    }
    const submitPatterns = options.submitButton ? [options.submitButton] : ["submit", "save", "send", "continue", "confirm"];
    const submitButton = await findButton(page, submitPatterns);
    if (!submitButton) {
      return {
        success: false,
        filledFields,
        failedFields,
        steps,
        error: "Could not find submit button",
        duration: Date.now() - startTime
      };
    }
    await submitButton.click();
    steps.push({ action: "click submit", success: true });
    await waitForNavigation(page, timeout);
    steps.push({ action: "wait for response", success: true });
    let success = true;
    if (options.successSelector) {
      const successElement = await page.$(options.successSelector);
      success = !!successElement;
      steps.push({
        action: "verify success",
        success
      });
    }
    const errorElement = await page.$(
      '[class*="error"]:not([class*="error-boundary"]), [role="alert"][class*="error"], .form-error, .validation-error'
    );
    if (errorElement) {
      const errorText = await errorElement.textContent();
      success = false;
      steps.push({
        action: "check for errors",
        success: false,
        error: errorText?.trim() || "Form has errors"
      });
    }
    return {
      success: success && failedFields.length === 0,
      filledFields,
      failedFields,
      steps,
      duration: Date.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      filledFields,
      failedFields,
      steps,
      error: error instanceof Error ? error.message : "Unknown error",
      duration: Date.now() - startTime
    };
  }
}

// src/flows/index.ts
init_types2();
init_search_validation();
init_search();

// src/index.ts
var import_playwright6 = require("playwright");

// src/cleanup.ts
var import_promises7 = require("fs/promises");
var import_path7 = require("path");
init_session();
var DEFAULT_RETENTION = {
  maxSessions: void 0,
  maxAgeDays: void 0,
  keepFailed: true,
  autoClean: false
};
async function loadRetentionConfig(outputDir) {
  const configPath = (0, import_path7.join)(outputDir, "..", ".ibrrc.json");
  try {
    await (0, import_promises7.access)(configPath);
    const content = await (0, import_promises7.readFile)(configPath, "utf-8");
    const config = JSON.parse(content);
    return {
      ...DEFAULT_RETENTION,
      ...config.retention
    };
  } catch {
    return DEFAULT_RETENTION;
  }
}
function isFailedSession(session) {
  return session.analysis?.verdict === "LAYOUT_BROKEN" || session.analysis?.verdict === "UNEXPECTED_CHANGE";
}
async function enforceRetentionPolicy(outputDir, config) {
  const retentionConfig = config || await loadRetentionConfig(outputDir);
  if (!retentionConfig.maxSessions && !retentionConfig.maxAgeDays) {
    const sessions2 = await listSessions(outputDir);
    return {
      deleted: [],
      kept: sessions2.map((s) => s.id),
      keptFailed: [],
      totalBefore: sessions2.length,
      totalAfter: sessions2.length
    };
  }
  const sessions = await listSessions(outputDir);
  const totalBefore = sessions.length;
  const deleted = [];
  const kept = [];
  const keptFailed = [];
  const cutoffTime = retentionConfig.maxAgeDays ? Date.now() - retentionConfig.maxAgeDays * 24 * 60 * 60 * 1e3 : 0;
  let keptCount = 0;
  for (const session of sessions) {
    const sessionTime = new Date(session.createdAt).getTime();
    const isTooOld = retentionConfig.maxAgeDays && sessionTime < cutoffTime;
    const isOverLimit = retentionConfig.maxSessions && keptCount >= retentionConfig.maxSessions;
    const isFailed = isFailedSession(session);
    if (isFailed && retentionConfig.keepFailed) {
      kept.push(session.id);
      keptFailed.push(session.id);
      continue;
    }
    if (isTooOld || isOverLimit) {
      await deleteSession(outputDir, session.id);
      deleted.push(session.id);
    } else {
      kept.push(session.id);
      keptCount++;
    }
  }
  return {
    deleted,
    kept,
    keptFailed,
    totalBefore,
    totalAfter: kept.length
  };
}
async function maybeAutoClean(outputDir) {
  const config = await loadRetentionConfig(outputDir);
  if (!config.autoClean) {
    return null;
  }
  return enforceRetentionPolicy(outputDir, config);
}

// src/index.ts
init_schemas();
init_types();
init_types();
init_capture();
init_consistency();
init_compare();
init_crawl();
init_session();
init_integration();

// src/operation-tracker.ts
var import_nanoid2 = require("nanoid");
var import_promises8 = require("fs/promises");
var import_path8 = require("path");
var OPERATION_PREFIX = "op_";
function getOperationsPath(outputDir) {
  return (0, import_path8.join)(outputDir, "operations.json");
}
async function readState(outputDir) {
  const path2 = getOperationsPath(outputDir);
  try {
    const content = await (0, import_promises8.readFile)(path2, "utf-8");
    return JSON.parse(content);
  } catch {
    return { pending: [], lastUpdated: (/* @__PURE__ */ new Date()).toISOString() };
  }
}
async function writeState(outputDir, state) {
  const path2 = getOperationsPath(outputDir);
  await (0, import_promises8.mkdir)((0, import_path8.dirname)(path2), { recursive: true });
  state.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
  await (0, import_promises8.writeFile)(path2, JSON.stringify(state, null, 2));
}
async function registerOperation(outputDir, options) {
  const state = await readState(outputDir);
  state.pending = await cleanupStaleOperations(state.pending);
  const operation = {
    id: `${OPERATION_PREFIX}${(0, import_nanoid2.nanoid)(8)}`,
    type: options.type,
    sessionId: options.sessionId,
    startedAt: (/* @__PURE__ */ new Date()).toISOString(),
    pid: process.pid,
    command: options.command
  };
  state.pending.push(operation);
  await writeState(outputDir, state);
  return operation.id;
}
async function completeOperation(outputDir, operationId) {
  const state = await readState(outputDir);
  state.pending = state.pending.filter((op) => op.id !== operationId);
  await writeState(outputDir, state);
}
async function getPendingOperations(outputDir) {
  const state = await readState(outputDir);
  const activeOps = await cleanupStaleOperations(state.pending);
  if (activeOps.length !== state.pending.length) {
    state.pending = activeOps;
    await writeState(outputDir, state);
  }
  return activeOps;
}
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
async function cleanupStaleOperations(operations) {
  return operations.filter((op) => isProcessAlive(op.pid));
}
async function waitForCompletion(outputDir, options = {}) {
  const timeout = options.timeout ?? 3e4;
  const pollInterval = options.pollInterval ?? 500;
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const pending = await getPendingOperations(outputDir);
    if (pending.length === 0) {
      return true;
    }
    if (options.onProgress) {
      options.onProgress(pending.length);
    }
    await new Promise((resolve2) => setTimeout(resolve2, pollInterval));
  }
  return false;
}
function formatPendingOperations(operations) {
  if (operations.length === 0) {
    return "No pending operations";
  }
  const lines = operations.map((op) => {
    const age = Math.round((Date.now() - new Date(op.startedAt).getTime()) / 1e3);
    return `  ${op.id.slice(0, 11)} | ${op.type.padEnd(10)} | ${op.sessionId.slice(0, 12)} | ${age}s`;
  });
  return [
    "  ID          | Type       | Session      | Age",
    "  ----------- | ---------- | ------------ | ---",
    ...lines
  ].join("\n");
}

// src/index.ts
init_semantic();
init_performance();
init_interactivity();
init_api_timing();

// src/responsive.ts
var import_playwright5 = require("playwright");
init_schemas();

// src/index.ts
var InterfaceBuiltRight = class {
  config;
  constructor(options = {}) {
    this.config = ConfigSchema.parse(options);
  }
  /**
   * Start a visual session by capturing a baseline screenshot
   */
  async startSession(path2, options = {}) {
    const {
      name = this.generateSessionName(path2),
      viewport = this.config.viewport,
      fullPage = this.config.fullPage,
      selector,
      waitFor
    } = options;
    const url = this.resolveUrl(path2);
    const session = await createSession(this.config.outputDir, url, name, viewport);
    const paths = getSessionPaths(this.config.outputDir, session.id);
    const captureResult = await captureWithLandmarks({
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
    const updatedSession = await updateSession(this.config.outputDir, session.id, {
      landmarkElements: captureResult.landmarkElements,
      pageIntent: captureResult.pageIntent
    });
    await maybeAutoClean(this.config.outputDir);
    return {
      sessionId: session.id,
      baseline: paths.baseline,
      session: updatedSession
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
   * Start a simplified session with semantic understanding
   *
   * This is the new simpler API - one line to start:
   * ```typescript
   * const session = await ibr.start('http://localhost:3000');
   * const understanding = await session.understand();
   * ```
   */
  async start(url, options = {}) {
    const fullUrl = this.resolveUrl(url);
    const viewportName = options.viewport || "desktop";
    const viewport = VIEWPORTS[viewportName];
    const browser3 = await import_playwright6.chromium.launch({ headless: true });
    const context = await browser3.newContext({
      viewport,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    });
    const page = await context.newPage();
    await page.goto(fullUrl, {
      waitUntil: "domcontentloaded",
      timeout: options.timeout || this.config.timeout
    });
    if (this.config.waitForNetworkIdle) {
      await page.waitForLoadState("networkidle", { timeout: 1e4 }).catch(() => {
      });
    }
    if (options.waitFor) {
      await page.waitForSelector(options.waitFor, { timeout: 1e4 }).catch(() => {
      });
    }
    return new IBRSession(page, browser3, context, this.config);
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
  resolveUrl(path2) {
    if (path2.startsWith("http://") || path2.startsWith("https://")) {
      return path2;
    }
    return `${this.config.baseUrl}${path2.startsWith("/") ? path2 : `/${path2}`}`;
  }
  /**
   * Generate a session name from path
   */
  generateSessionName(path2) {
    return path2.replace(/^\/+/, "").replace(/\//g, "-").replace(/[^a-zA-Z0-9-_]/g, "") || "homepage";
  }
};
var IBRSession = class {
  /** Raw Playwright page for advanced use */
  page;
  browser;
  context;
  config;
  constructor(page, browser3, context, config) {
    this.page = page;
    this.browser = browser3;
    this.context = context;
    this.config = config;
  }
  /**
   * Get semantic understanding of the current page
   */
  async understand() {
    return getSemanticOutput(this.page);
  }
  /**
   * Get semantic understanding as formatted text
   */
  async understandText() {
    const result = await getSemanticOutput(this.page);
    return formatSemanticText(result);
  }
  /**
   * Click an element by selector
   */
  async click(selector) {
    await this.page.click(selector);
  }
  /**
   * Type text into an element
   */
  async type(selector, text) {
    await this.page.fill(selector, text);
  }
  /**
   * Navigate to a new URL
   */
  async goto(url) {
    await this.page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: this.config.timeout
    });
  }
  /**
   * Wait for a selector to appear
   */
  async waitFor(selector, timeout = 1e4) {
    await this.page.waitForSelector(selector, { timeout });
  }
  /**
   * Take a screenshot
   */
  async screenshot(path2) {
    return this.page.screenshot({
      path: path2,
      fullPage: this.config.fullPage
    });
  }
  /**
   * Mock a network request (thin wrapper on page.route)
   */
  async mock(pattern, response) {
    await this.page.route(pattern, async (route) => {
      const body = typeof response.body === "object" ? JSON.stringify(response.body) : response.body || "";
      await route.fulfill({
        status: response.status || 200,
        body,
        headers: {
          "Content-Type": typeof response.body === "object" ? "application/json" : "text/plain",
          ...response.headers
        }
      });
    });
  }
  /**
   * Built-in flows for common automation patterns
   */
  flow = {
    /**
     * Login with email/password
     * @example
     * const result = await session.flow.login({ email: 'test@test.com', password: 'secret' });
     */
    login: (options) => loginFlow(this.page, { ...options, timeout: this.config.timeout }),
    /**
     * Search for content
     * @example
     * const result = await session.flow.search({ query: 'test' });
     */
    search: (options) => searchFlow(this.page, { ...options, timeout: this.config.timeout }),
    /**
     * Fill and submit a form
     * @example
     * const result = await session.flow.form({
     *   fields: [{ name: 'email', value: 'test@test.com' }]
     * });
     */
    form: (options) => formFlow(this.page, { ...options, timeout: this.config.timeout })
  };
  /**
   * Measure Web Vitals performance metrics
   * @example
   * const result = await session.measurePerformance();
   * console.log(result.ratings.LCP); // { value: 1200, rating: 'good' }
   */
  async measurePerformance() {
    const { measurePerformance: mp } = await Promise.resolve().then(() => (init_performance(), performance_exports));
    return mp(this.page);
  }
  /**
   * Test interactivity of buttons, links, and forms
   * @example
   * const result = await session.testInteractivity();
   * console.log(result.issues); // List of issues with buttons/links
   */
  async testInteractivity() {
    const { testInteractivity: ti } = await Promise.resolve().then(() => (init_interactivity(), interactivity_exports));
    return ti(this.page);
  }
  /**
   * Start tracking API request timing
   * Call before actions, then call stop() to get results
   * @example
   * const tracker = session.trackApiTiming({ filter: /\/api\// });
   * tracker.start();
   * await session.click('button');
   * const result = tracker.stop();
   */
  trackApiTiming(options) {
    const createTracker = async () => {
      const { createApiTracker: createApiTracker2 } = await Promise.resolve().then(() => (init_api_timing(), api_timing_exports));
      return createApiTracker2(this.page, options);
    };
    return createTracker();
  }
  /**
   * Close the session and browser
   */
  async close() {
    await this.context.close();
    await this.browser.close();
  }
};

// src/bin/ibr.ts
var program = new import_commander.Command();
async function loadConfig() {
  const configPath = (0, import_path15.join)(process.cwd(), ".ibrrc.json");
  if ((0, import_fs8.existsSync)(configPath)) {
    try {
      const content = await (0, import_promises15.readFile)(configPath, "utf-8");
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
program.name("ibr").description("Visual regression testing for Claude Code").version("0.4.1");
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
program.command("audit [url]").description("Full audit: functional checks + visual comparison + semantic verification").option("-r, --rules <preset>", "Override with preset (minimal). Auto-detects from CLAUDE.md by default").option("--show-framework", "Display detected design framework").option("--check-apis [dir]", "Cross-reference UI API calls against backend routes").option("--visual", "Include visual comparison against most recent baseline").option("--baseline <session>", "Compare against specific baseline session").option("--semantic", "Include semantic verification (expected elements, page intent)").option("--full", "Run all checks: functional + visual + semantic (default)").option("--json", "Output as JSON").option("--fail-on <level>", "Exit non-zero on errors/warnings", "error").action(async (url, options) => {
  try {
    const resolvedUrl = await resolveBaseUrl(url);
    const globalOpts = program.opts();
    const { loadRulesConfig: loadRulesConfig2, runRules: runRules2, createAuditResult: createAuditResult2, formatAuditResult: formatAuditResult2, registerPreset: registerPreset2 } = await Promise.resolve().then(() => (init_engine(), engine_exports));
    const { register: register2 } = await Promise.resolve().then(() => (init_minimal(), minimal_exports));
    const { extractInteractiveElements: extractInteractiveElements2 } = await Promise.resolve().then(() => (init_extract(), extract_exports));
    const { chromium: chromium10 } = await import("playwright");
    const { discoverUserContext: discoverUserContext2, formatContextSummary: formatContextSummary2 } = await Promise.resolve().then(() => (init_context_loader(), context_loader_exports));
    const { generateRulesFromFramework: generateRulesFromFramework2, createPresetFromFramework: createPresetFromFramework2 } = await Promise.resolve().then(() => (init_dynamic_rules(), dynamic_rules_exports));
    register2();
    const userContext = await discoverUserContext2(process.cwd());
    if (options.showFramework) {
      console.log(formatContextSummary2(userContext));
      console.log("");
      if (!url) return;
    }
    const rulesConfig = await loadRulesConfig2(process.cwd());
    if (options.rules) {
      rulesConfig.extends = [options.rules];
      console.log(`Using preset: ${options.rules}`);
    } else if (rulesConfig.extends && rulesConfig.extends.length > 0) {
      console.log(`Using configured presets: ${rulesConfig.extends.join(", ")}`);
    } else if (userContext.framework) {
      const preset = createPresetFromFramework2(userContext.framework);
      registerPreset2(preset);
      rulesConfig.extends = [preset.name];
      console.log(`Detected: ${userContext.framework.name}`);
      console.log(`Source: ${userContext.framework.source}`);
      console.log(`Generated ${preset.rules.length} rules from ${userContext.framework.principles.length} principles`);
    } else {
      console.log("No design framework detected in CLAUDE.md.");
      console.log("Running basic interactivity checks only.");
      console.log("");
      console.log("To enable design validation:");
      console.log("  Add your framework to ~/.claude/CLAUDE.md or .claude/CLAUDE.md");
      console.log("  Or use --rules minimal for basic checks");
      rulesConfig.extends = ["minimal"];
    }
    console.log("");
    console.log(`Auditing ${resolvedUrl}...`);
    console.log("");
    const browser3 = await chromium10.launch({ headless: true });
    const viewport = VIEWPORTS[globalOpts.viewport] || VIEWPORTS.desktop;
    const context = await browser3.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: "reduce"
    });
    const page = await context.newPage();
    await page.goto(resolvedUrl, { waitUntil: "networkidle", timeout: 3e4 });
    await page.waitForTimeout(1e3);
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
    const runVisual = options.full || options.visual || options.baseline || !options.semantic && !options.checkApis;
    const runSemantic = options.full || options.semantic || !options.visual && !options.baseline && !options.checkApis;
    let visualResult = null;
    if (runVisual) {
      const { compareImages: compareImages2, analyzeComparison: analyzeComparison2 } = await Promise.resolve().then(() => (init_compare(), compare_exports));
      const { listSessions: listSessions2, getSessionPaths: getSessionPaths2, getMostRecentSession: getMostRecentSession2 } = await Promise.resolve().then(() => (init_session(), session_exports));
      const { mkdir: mkdir11, access: access3 } = await import("fs/promises");
      const { join: join15 } = await import("path");
      const outputDir = globalOpts.outputDir || ".ibr";
      const sessions = await listSessions2(outputDir);
      const urlPath = new URL(resolvedUrl).pathname;
      let baselineSession = options.baseline ? sessions.find((s) => s.id === options.baseline) : sessions.filter((s) => new URL(s.url).pathname === urlPath && s.status !== "compared").sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      if (baselineSession) {
        const paths = getSessionPaths2(outputDir, baselineSession.id);
        const currentPath = paths.current;
        await mkdir11(join15(outputDir, "sessions", baselineSession.id), { recursive: true });
        await page.screenshot({ path: currentPath, fullPage: true });
        try {
          await access3(paths.baseline);
          const comparison = await compareImages2({
            baselinePath: paths.baseline,
            currentPath,
            diffPath: paths.diff,
            threshold: 0.01
          });
          const analysis = analyzeComparison2(comparison, 1);
          visualResult = {
            hasBaseline: true,
            verdict: analysis.verdict,
            diffPercent: comparison.diffPercent,
            baselineSession: baselineSession.id,
            currentPath,
            diffPath: comparison.diffPercent > 0 ? paths.diff : void 0
          };
        } catch {
          visualResult = { hasBaseline: false };
        }
      } else {
        visualResult = { hasBaseline: false };
      }
    }
    let semanticResult = null;
    if (runSemantic) {
      const { getSemanticOutput: getSemanticOutput2, detectLandmarks: detectLandmarks2, compareLandmarks: compareLandmarks2, getExpectedLandmarksForIntent: getExpectedLandmarksForIntent2, getExpectedLandmarksFromContext: getExpectedLandmarksFromContext2, LANDMARK_SELECTORS: LANDMARK_SELECTORS2 } = await Promise.resolve().then(() => (init_semantic(), semantic_exports));
      const { listSessions: listSessions2 } = await Promise.resolve().then(() => (init_session(), session_exports));
      const { readFile: readFile15 } = await import("fs/promises");
      const { join: join15 } = await import("path");
      const semantic = await getSemanticOutput2(page);
      const outputDir = globalOpts.outputDir || ".ibr";
      const sessions = await listSessions2(outputDir);
      const urlPath = new URL(resolvedUrl).pathname;
      const baselineSession = sessions.filter((s) => new URL(s.url).pathname === urlPath && s.landmarkElements && s.landmarkElements.length > 0).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      let elementChecks = [];
      if (baselineSession && baselineSession.landmarkElements) {
        const currentLandmarks = await detectLandmarks2(page);
        const comparison = compareLandmarks2(baselineSession.landmarkElements, currentLandmarks);
        for (const landmark of baselineSession.landmarkElements) {
          if (landmark.found) {
            const stillExists = currentLandmarks.find((l) => l.name === landmark.name && l.found);
            elementChecks.push({
              element: landmark.name.charAt(0).toUpperCase() + landmark.name.slice(1),
              found: !!stillExists,
              source: "baseline"
            });
          }
        }
      } else {
        const pageIntent = semantic.pageIntent.intent;
        const intentLandmarks = getExpectedLandmarksForIntent2(pageIntent);
        let contextLandmarks = [];
        try {
          const claudeMdPath = join15(process.cwd(), "CLAUDE.md");
          const content = await readFile15(claudeMdPath, "utf-8");
          contextLandmarks = getExpectedLandmarksFromContext2({ principles: [content] });
        } catch {
        }
        const expectedLandmarkTypes = [.../* @__PURE__ */ new Set([...intentLandmarks, ...contextLandmarks])];
        for (const landmarkType of expectedLandmarkTypes) {
          const selector = LANDMARK_SELECTORS2[landmarkType];
          if (selector) {
            const found = await page.$(selector);
            elementChecks.push({
              element: landmarkType.charAt(0).toUpperCase() + landmarkType.slice(1),
              found: !!found,
              source: "inferred"
            });
          }
        }
      }
      const semanticIssues = [];
      for (const check of elementChecks) {
        if (!check.found) {
          semanticIssues.push({
            type: "missing-element",
            problem: `Expected ${check.element} not found (${check.source} from ${check.source === "baseline" ? "previous capture" : "page intent"})`
          });
        }
      }
      for (const issue of semantic.issues) {
        semanticIssues.push({
          type: issue.type,
          problem: issue.problem
        });
      }
      semanticResult = {
        pageIntent: semantic.pageIntent.intent,
        confidence: semantic.confidence,
        authenticated: semantic.state.auth.authenticated,
        loading: semantic.state.loading.loading,
        hasErrors: semantic.state.errors.hasErrors,
        ready: semantic.state.ready,
        expectedElements: elementChecks.map((e) => ({ element: e.element, found: e.found })),
        issues: semanticIssues
      };
    }
    await context.close();
    await browser3.close();
    let integrationResult = null;
    if (options.checkApis) {
      const { scanDirectoryForApiCalls: scanDirectoryForApiCalls2, discoverApiRoutes: discoverApiRoutes2, findOrphanEndpoints: findOrphanEndpoints2 } = await Promise.resolve().then(() => (init_integration(), integration_exports));
      const projectDir = typeof options.checkApis === "string" ? options.checkApis : process.cwd();
      const [apiCalls, apiRoutes] = await Promise.all([
        scanDirectoryForApiCalls2(projectDir),
        discoverApiRoutes2(projectDir)
      ]);
      const orphans = findOrphanEndpoints2(apiCalls, apiRoutes);
      integrationResult = {
        orphanCount: orphans.length,
        orphans: orphans.map((o) => ({
          endpoint: o.call.endpoint,
          method: o.call.method,
          file: o.call.sourceFile,
          line: o.call.lineNumber
        }))
      };
    }
    if (options.json) {
      console.log(JSON.stringify({
        ...result,
        visual: visualResult,
        semantic: semanticResult,
        integration: integrationResult
      }, null, 2));
    } else {
      console.log(formatAuditResult2(result));
      if (visualResult) {
        console.log("");
        console.log("Visual Comparison:");
        if (visualResult.hasBaseline) {
          const verdictColor = visualResult.verdict === "MATCH" ? "\x1B[32m" : (
            // green
            visualResult.verdict === "EXPECTED_CHANGE" ? "\x1B[33m" : (
              // yellow
              "\x1B[31m"
            )
          );
          console.log(`  Verdict: ${verdictColor}${visualResult.verdict}\x1B[0m`);
          console.log(`  Diff: ${visualResult.diffPercent?.toFixed(2)}%`);
          console.log(`  Baseline: ${visualResult.baselineSession}`);
          if (visualResult.diffPath) {
            console.log(`  Diff image: ${visualResult.diffPath}`);
          }
        } else {
          console.log("  No baseline found for this URL.");
          console.log('  Run: npx ibr start <url> --name "feature" to capture baseline first.');
        }
      }
      if (semanticResult) {
        console.log("");
        console.log("Semantic Verification:");
        console.log(`  Page type: ${semanticResult.pageIntent} (${Math.round(semanticResult.confidence * 100)}% confidence)`);
        console.log(`  Ready: ${semanticResult.ready ? "Yes" : "No"}`);
        const missing = semanticResult.expectedElements.filter((e) => !e.found);
        const found = semanticResult.expectedElements.filter((e) => e.found);
        if (missing.length > 0) {
          console.log("");
          console.log("  Missing expected elements:");
          for (const el of missing) {
            console.log(`    \x1B[31m!\x1B[0m ${el.element}`);
          }
        }
        if (found.length > 0) {
          console.log("");
          console.log("  Found elements:");
          for (const el of found) {
            console.log(`    \x1B[32m\u2713\x1B[0m ${el.element}`);
          }
        }
        if (semanticResult.issues.length > 0) {
          console.log("");
          console.log("  Semantic issues:");
          for (const issue of semanticResult.issues) {
            console.log(`    ! ${issue.problem}`);
          }
        }
      }
      if (integrationResult && integrationResult.orphanCount > 0) {
        console.log("");
        console.log("Integration Issues:");
        console.log(`  ${integrationResult.orphanCount} orphan API calls (UI calls backend that doesn't exist):`);
        console.log("");
        for (const orphan of integrationResult.orphans) {
          console.log(`  ! ${orphan.method} ${orphan.endpoint}`);
          console.log(`    Called from: ${orphan.file}${orphan.line ? `:${orphan.line}` : ""}`);
        }
      } else if (integrationResult) {
        console.log("");
        console.log("Integration: All API calls have matching backend routes.");
      }
    }
    const hasIntegrationErrors = integrationResult && integrationResult.orphanCount > 0;
    const hasVisualRegression = visualResult?.hasBaseline && visualResult.verdict !== "MATCH" && visualResult.verdict !== "EXPECTED_CHANGE";
    const hasSemanticIssues = semanticResult && semanticResult.issues.length > 0;
    const hasMissingElements = semanticResult && semanticResult.expectedElements.some((e) => !e.found);
    if (options.failOn === "error" && (result.summary.errors > 0 || hasIntegrationErrors || hasVisualRegression || hasMissingElements)) {
      process.exit(1);
    } else if (options.failOn === "warning" && (result.summary.errors > 0 || result.summary.warnings > 0 || hasIntegrationErrors || hasVisualRegression || hasSemanticIssues)) {
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
program.command("list").description("List all sessions").option("-f, --format <format>", "Output format: json, text", "text").option("--by-app", "Group sessions by app/branch (git context)").action(async (options) => {
  try {
    const ibr = await createIBR(program.opts());
    const sessions = await ibr.listSessions();
    if (sessions.length === 0) {
      console.log("No sessions found.");
      return;
    }
    if (options.format === "json") {
      console.log(JSON.stringify(sessions, null, 2));
    } else if (options.byApp) {
      const { getAppContext: getAppContext2 } = await Promise.resolve().then(() => (init_git_context(), git_context_exports));
      const context = await getAppContext2(process.cwd()).catch(() => null);
      const currentApp = context?.appName || "unknown";
      const currentBranch = context?.branch || "unknown";
      const groups = /* @__PURE__ */ new Map();
      for (const session of sessions) {
        let groupKey = "Other";
        try {
          if (session.url) {
            const url = new URL(session.url);
            groupKey = url.hostname;
          }
        } catch {
          groupKey = "Other";
        }
        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey).push(session);
      }
      console.log(`Current App: ${currentApp} (${currentBranch})`);
      console.log("");
      for (const [groupName, groupSessions] of groups) {
        console.log(`${groupName} (${groupSessions.length} sessions)`);
        console.log("-".repeat(50));
        for (const session of groupSessions) {
          console.log(`  ${formatSessionSummary(session)}`);
        }
        console.log("");
      }
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
  let webUiDir = (0, import_path15.join)(packageRoot, "web-ui");
  if (!(0, import_fs8.existsSync)(webUiDir)) {
    const possiblePaths = [
      (0, import_path15.join)(packageRoot, "node_modules", "interface-built-right", "web-ui"),
      (0, import_path15.join)(packageRoot, "..", "interface-built-right", "web-ui")
    ];
    for (const p of possiblePaths) {
      if ((0, import_fs8.existsSync)(p)) {
        webUiDir = p;
        break;
      }
    }
  }
  if (!(0, import_fs8.existsSync)(webUiDir)) {
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
program.command("session:start [url]").description("Start an interactive browser session (browser persists across commands)").option("-n, --name <name>", "Session name").option("-w, --wait-for <selector>", "Wait for selector before considering page ready").option("--sandbox", "Show visible browser window (default: headless)").option("--debug", "Visible browser + slow motion + devtools").option("--low-memory", "Reduce memory usage for lower-powered machines (4GB RAM)").action(async (url, options) => {
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
      const modeLabel = options.lowMemory ? " (low-memory mode)" : "";
      console.log(headless ? `Starting headless browser server${modeLabel}...` : `Starting visible browser server${modeLabel}...`);
      const { server } = await startBrowserServer2(outputDir, {
        headless,
        debug: options.debug,
        isolated: true,
        // Prevents conflicts with Playwright MCP
        lowMemory: options.lowMemory
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
program.command("session:click <sessionId> <selector>").description("Click an element in an active session (auto-targets visible elements)").option("--force", "Force click, bypassing overlay interception checks").action(async (sessionId, selector, options) => {
  const globalOpts = program.opts();
  const outputDir = globalOpts.output || "./.ibr";
  const opId = await registerOperation(outputDir, {
    type: "click",
    sessionId,
    command: `session:click ${sessionId} "${selector}"${options.force ? " --force" : ""}`
  });
  try {
    const session = await getSession2(outputDir, sessionId);
    await session.click(selector, { force: options.force });
    console.log(`Clicked: ${selector}${options.force ? " (forced)" : ""}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error:", msg);
    console.log("");
    if (msg.includes("intercept") || msg.includes("pointer-events")) {
      console.log("Tip: Element is blocked by an overlay (modal, backdrop, etc.)");
      console.log("     Use --force to click through, or dismiss the overlay first");
      console.log("     npx ibr session:click " + sessionId + ' "' + selector + '" --force');
    } else if (msg.includes("not visible") || msg.includes("Timeout")) {
      console.log("Tip: IBR auto-filters to visible elements. Element may be:");
      console.log("     - Hidden by CSS (display:none, visibility:hidden)");
      console.log("     - Off-screen or zero-sized");
      console.log('     Use session:html --selector "' + selector + '" to inspect');
    } else {
      console.log("Tip: Session is still active. Use session:html to inspect the DOM.");
    }
  } finally {
    await completeOperation(outputDir, opId);
  }
});
program.command("session:type <sessionId> <selector> <text>").description("Type text into an element in an active session").option("--delay <ms>", "Delay between keystrokes", "0").option("--submit", "Press Enter after typing (waits for network idle)").option("--wait-after <ms>", "Wait this long after typing/submitting before next command").option("--append", "Append to existing content without clearing").action(async (sessionId, selector, text, options) => {
  const globalOpts = program.opts();
  const outputDir = globalOpts.output || "./.ibr";
  const opId = await registerOperation(outputDir, {
    type: "type",
    sessionId,
    command: `session:type ${sessionId} "${selector}" "${text.slice(0, 20)}..."`
  });
  try {
    const session = await getSession2(outputDir, sessionId);
    await session.type(selector, text, {
      delay: parseInt(options.delay, 10),
      submit: options.submit,
      waitAfter: options.waitAfter ? parseInt(options.waitAfter, 10) : void 0,
      append: options.append
    });
    const action = options.append ? "Appended" : options.submit ? "Typed and submitted" : "Typed";
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
  } finally {
    await completeOperation(outputDir, opId);
  }
});
program.command("session:press <sessionId> <key>").description("Press a keyboard key (Enter, Tab, Escape, ArrowDown, etc.)").action(async (sessionId, key) => {
  try {
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const session = await getSession2(outputDir, sessionId);
    await session.press(key);
    console.log(`Pressed: ${key}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error:", msg);
    console.log("");
    console.log("Tip: Valid keys include: Enter, Tab, Escape, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Backspace, Delete, Space");
  }
});
program.command("session:scroll <sessionId> <direction> [amount]").description("Scroll the page or a container (direction: up, down, left, right)").option("-s, --selector <css>", "Scroll within a specific container (modal, sidebar, etc.)").action(async (sessionId, direction, amount, options) => {
  const validDirections = ["up", "down", "left", "right"];
  if (!validDirections.includes(direction)) {
    console.error(`Error: Invalid direction "${direction}"`);
    console.log(`Valid directions: ${validDirections.join(", ")}`);
    process.exit(1);
  }
  try {
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const session = await getSession2(outputDir, sessionId);
    const pixels = amount ? parseInt(amount, 10) : 500;
    const position = await session.scroll(direction, pixels, { selector: options?.selector });
    if (options?.selector) {
      console.log(`Scrolled ${direction} ${pixels}px in: ${options.selector}`);
    } else {
      console.log(`Scrolled ${direction} ${pixels}px`);
    }
    console.log(`Position: x=${position.x}, y=${position.y}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error:", msg);
    if (options?.selector) {
      console.log("");
      console.log("Tip: The container may not exist or may not be scrollable.");
      console.log("     Check: overflow-y: auto/scroll, or that content exceeds container bounds.");
    }
  }
});
program.command("session:screenshot <sessionId>").description("Take a screenshot and audit interactive elements").option("-n, --name <name>", "Screenshot name").option("-s, --selector <css>", "CSS selector to capture specific element").option("--no-full-page", "Capture only the viewport").option("--viewport-only", "Capture only viewport (alias for --no-full-page)").option("--json", "Output audit results as JSON").action(async (sessionId, options) => {
  const globalOpts = program.opts();
  const outputDir = globalOpts.output || "./.ibr";
  const opId = await registerOperation(outputDir, {
    type: "screenshot",
    sessionId,
    command: `session:screenshot ${sessionId}${options.name ? ` --name ${options.name}` : ""}`
  });
  try {
    const session = await getSession2(outputDir, sessionId);
    const fullPage = options.viewportOnly ? false : options.fullPage;
    const { path: path2, elements, audit } = await session.screenshot({
      name: options.name,
      selector: options.selector,
      fullPage
    });
    if (options.json) {
      console.log(JSON.stringify({ path: path2, elements, audit }, null, 2));
    } else {
      console.log(`Screenshot saved: ${path2}`);
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
  } finally {
    await completeOperation(outputDir, opId);
  }
});
program.command("session:wait <sessionId> <selectorOrMs>").description("Wait for a selector to appear or a duration (in ms)").action(async (sessionId, selectorOrMs) => {
  const globalOpts = program.opts();
  const outputDir = globalOpts.output || "./.ibr";
  const opId = await registerOperation(outputDir, {
    type: "wait",
    sessionId,
    command: `session:wait ${sessionId} "${selectorOrMs}"`
  });
  try {
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
  } finally {
    await completeOperation(outputDir, opId);
  }
});
program.command("session:navigate <sessionId> <url>").description("Navigate to a new URL in an active session").option("-w, --wait-for <selector>", "Wait for selector after navigation").action(async (sessionId, url, options) => {
  const globalOpts = program.opts();
  const outputDir = globalOpts.output || "./.ibr";
  const opId = await registerOperation(outputDir, {
    type: "navigate",
    sessionId,
    command: `session:navigate ${sessionId} "${url}"`
  });
  try {
    const session = await getSession2(outputDir, sessionId);
    await session.navigate(url, { waitFor: options.waitFor });
    console.log(`Navigated to: ${url}`);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    console.log("");
    console.log("Tip: Session is still active. Check URL or try without --wait-for.");
  } finally {
    await completeOperation(outputDir, opId);
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
program.command("session:pending").description("List pending operations (useful before session:close all)").option("--json", "Output as JSON").action(async (options) => {
  try {
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const pending = await getPendingOperations(outputDir);
    if (options.json) {
      console.log(JSON.stringify(pending, null, 2));
      return;
    }
    if (pending.length === 0) {
      console.log("No pending operations.");
      console.log("");
      console.log("Safe to close browser server:");
      console.log("  npx ibr session:close all");
      return;
    }
    console.log(`${pending.length} pending operation(s):`);
    console.log("");
    console.log(formatPendingOperations(pending));
    console.log("");
    console.log("Wait for these to complete, or use:");
    console.log("  npx ibr session:close all --force");
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("session:close <sessionId>").description('Close a session (use "all" to stop browser server)').option("--force", "Skip waiting for pending operations").option("--wait-timeout <ms>", "Max wait time for pending operations (default: 30000)", "30000").action(async (sessionId, options) => {
  try {
    const { stopBrowserServer: stopBrowserServer2, PersistentSession: PersistentSession2, isServerRunning: isServerRunning2 } = await Promise.resolve().then(() => (init_browser_server(), browser_server_exports));
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    if (sessionId === "all") {
      const pending = await getPendingOperations(outputDir);
      if (pending.length > 0 && !options.force) {
        console.log(`Found ${pending.length} pending operation(s):`);
        console.log(formatPendingOperations(pending));
        console.log("");
        console.log(`Waiting for completion (timeout: ${options.waitTimeout}ms)...`);
        console.log("Use --force to skip waiting");
        console.log("");
        const completed = await waitForCompletion(outputDir, {
          timeout: parseInt(options.waitTimeout, 10),
          onProgress: (remaining) => {
            process.stdout.write(`\rWaiting for ${remaining} operation(s)...`);
          }
        });
        console.log("");
        if (!completed) {
          const remaining = await getPendingOperations(outputDir);
          console.log(`Timeout reached. ${remaining.length} operation(s) still pending.`);
          console.log("Use --force to close anyway, or wait for operations to complete.");
          process.exit(1);
        }
        console.log("All operations completed.");
      }
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
      const escapedSelector = options.selector.replace(/'/g, "\\'");
      const html = await session.evaluate(`(() => {
          const el = document.querySelector('${escapedSelector}');
          return el ? el.outerHTML : null;
        })()`);
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
program.command("session:eval <sessionId> <script>").description("Execute JavaScript in the browser context").option("--json", "Output result as JSON").action(async (sessionId, script, options) => {
  try {
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const session = await getSession2(outputDir, sessionId);
    const result = await session.evaluate(script);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result === void 0) {
      console.log("[undefined]");
    } else if (result === null) {
      console.log("[null]");
    } else if (typeof result === "object") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(result);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error:", msg);
    console.log("");
    console.log("Tip: Script must be valid JavaScript. Examples:");
    console.log('  npx ibr session:eval <id> "document.title"');
    console.log(`  npx ibr session:eval <id> "document.querySelectorAll('.item').length"`);
    console.log('  npx ibr session:eval <id> "window.scrollY"');
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
program.command("session:modal <sessionId>").description("Detect and optionally dismiss active modals").option("--dismiss", "Attempt to dismiss the modal").action(async (sessionId, options) => {
  try {
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const session = await getSession2(outputDir, sessionId);
    const modal = await session.detectModal();
    if (!modal.hasModal) {
      console.log("No modal detected");
      return;
    }
    console.log(`Modal detected: ${modal.selector}`);
    console.log(`Dismiss method: ${modal.dismissMethod}`);
    if (modal.closeButtonSelector) {
      console.log(`Close button: ${modal.closeButtonSelector}`);
    }
    if (options.dismiss) {
      console.log("");
      console.log("Attempting to dismiss...");
      if (modal.dismissMethod === "close-button" && modal.closeButtonSelector) {
        await session.click(modal.closeButtonSelector, { force: true });
      } else {
        await session.press("Escape");
      }
      await session.waitFor(300);
      const stillOpen = await session.detectModal();
      if (stillOpen.hasModal) {
        console.log("Warning: Modal may still be open. Try:");
        console.log(`  npx ibr session:press ${sessionId} Escape`);
        console.log(`  npx ibr session:click ${sessionId} ".backdrop" --force`);
      } else {
        console.log("Modal dismissed successfully");
      }
    } else {
      console.log("");
      console.log("To dismiss, run:");
      console.log(`  npx ibr session:modal ${sessionId} --dismiss`);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("screenshots:list [sessionId]").description("List screenshots for a session or all sessions").option("--json", "Output as JSON").action(async (sessionId, options) => {
  try {
    const { ScreenshotManager: ScreenshotManager2, formatBytes: formatBytes3, formatAge: formatAge2 } = await Promise.resolve().then(() => (init_screenshot_manager(), screenshot_manager_exports));
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const manager = new ScreenshotManager2(outputDir);
    const screenshots = sessionId ? await manager.list(sessionId) : await manager.listAll();
    if (screenshots.length === 0) {
      console.log("No screenshots found.");
      return;
    }
    if (options.json) {
      console.log(JSON.stringify(screenshots, null, 2));
      return;
    }
    console.log(`Found ${screenshots.length} screenshot(s):`);
    console.log("");
    console.log("PATH                                           SIZE       AGE");
    console.log("-".repeat(70));
    for (const shot of screenshots) {
      const shortPath = shot.path.length > 45 ? "..." + shot.path.slice(-42) : shot.path.padEnd(45);
      console.log(`${shortPath} ${formatBytes3(shot.size).padStart(10)} ${formatAge2(shot.ageMs).padStart(10)}`);
    }
    const usage = await manager.getStorageUsage();
    console.log("");
    console.log(`Total: ${formatBytes3(usage.totalBytes)} across ${usage.fileCount} files`);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("screenshots:cleanup").description("Clean up old screenshots based on retention policy").option("--max-age <days>", "Delete screenshots older than N days", "7").option("--max-size <mb>", "Max total storage in MB", "500").option("--dry-run", "Show what would be deleted without deleting").action(async (options) => {
  try {
    const { ScreenshotManager: ScreenshotManager2, formatBytes: formatBytes3 } = await Promise.resolve().then(() => (init_screenshot_manager(), screenshot_manager_exports));
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const manager = new ScreenshotManager2(outputDir, {
      maxAgeDays: parseInt(options.maxAge, 10),
      maxSizeBytes: parseInt(options.maxSize, 10) * 1024 * 1024,
      retentionPolicy: "both"
    });
    console.log(`Cleanup policy: max ${options.maxAge} days, max ${options.maxSize}MB`);
    console.log("");
    const report = await manager.cleanup({ dryRun: options.dryRun });
    if (options.dryRun) {
      console.log("DRY RUN - no files deleted");
      console.log("");
    }
    console.log(`Scanned: ${report.scanned} files`);
    console.log(`${options.dryRun ? "Would delete" : "Deleted"}: ${report.deleted} files`);
    console.log(`Space ${options.dryRun ? "to be freed" : "freed"}: ${formatBytes3(report.bytesFreed)}`);
    console.log(`Kept: ${report.kept} files`);
    if (report.errors.length > 0) {
      console.log("");
      console.log("Errors:");
      for (const err of report.errors) {
        console.log(`  ${err}`);
      }
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("screenshots:view <path>").description("View a screenshot with metadata").action(async (path2) => {
  try {
    const { ScreenshotManager: ScreenshotManager2, formatBytes: formatBytes3 } = await Promise.resolve().then(() => (init_screenshot_manager(), screenshot_manager_exports));
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const manager = new ScreenshotManager2(outputDir);
    const metadata = await manager.getMetadata(path2);
    if (!metadata) {
      console.error(`Screenshot not found: ${path2}`);
      process.exit(1);
    }
    console.log("Screenshot Metadata:");
    console.log(`  Path: ${metadata.path}`);
    console.log(`  Size: ${formatBytes3(metadata.size)}`);
    console.log(`  Created: ${metadata.createdAt}`);
    if (metadata.sessionId) console.log(`  Session: ${metadata.sessionId}`);
    if (metadata.step) console.log(`  Step: ${metadata.step}`);
    if (metadata.query) console.log(`  Query: ${metadata.query}`);
    if (metadata.userIntent) console.log(`  Intent: ${metadata.userIntent}`);
    console.log("");
    const { exec } = await import("child_process");
    const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    exec(`${cmd} "${path2}"`, (err) => {
      if (err) {
        console.log("Could not open image viewer. File path above.");
      }
    });
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
program.command("search-test <url>").description("Run AI search test with screenshots and validation context").option("-q, --query <query>", "Search query to test", "test").option("-i, --intent <intent>", "User intent for validation").option("--results-selector <css>", "CSS selector for results").option("--no-screenshots", "Skip capturing screenshots").option("--json", "Output as JSON").action(async (url, options) => {
  try {
    const { chromium: chromium10 } = await import("playwright");
    const { aiSearchFlow: aiSearchFlow2 } = await Promise.resolve().then(() => (init_search(), search_exports));
    const { generateValidationContext: generateValidationContext2, generateValidationPrompt: generateValidationPrompt2, analyzeForObviousIssues: analyzeForObviousIssues2 } = await Promise.resolve().then(() => (init_search_validation(), search_validation_exports));
    const globalOpts = program.opts();
    const outputDir = globalOpts.output || "./.ibr";
    const { mkdir: mkdir11 } = await import("fs/promises");
    console.log(`Testing search on ${url}...`);
    console.log(`Query: "${options.query}"`);
    if (options.intent) console.log(`Intent: ${options.intent}`);
    console.log("");
    const browser3 = await chromium10.launch({ headless: true });
    const viewport = VIEWPORTS[globalOpts.viewport] || VIEWPORTS.desktop;
    const context = await browser3.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: "reduce"
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 3e4 });
    const sessionDir = (0, import_path15.join)(outputDir, "sessions", `search-${Date.now()}`);
    await mkdir11(sessionDir, { recursive: true });
    const result = await aiSearchFlow2(page, {
      query: options.query,
      userIntent: options.intent || `Find results related to: ${options.query}`,
      resultsSelector: options.resultsSelector,
      captureSteps: options.screenshots !== false,
      extractContent: true,
      sessionDir
    });
    await context.close();
    await browser3.close();
    const validationContext = generateValidationContext2(result);
    const obvIssues = analyzeForObviousIssues2(validationContext);
    if (options.json) {
      console.log(JSON.stringify({
        result,
        validationContext,
        obviousIssues: obvIssues
      }, null, 2));
      return;
    }
    console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
    console.log("  SEARCH TEST RESULTS");
    console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
    console.log("");
    console.log(`Status: ${result.success ? "SUCCESS" : "FAILED"}`);
    console.log(`Results found: ${result.resultCount}`);
    console.log("");
    console.log("Timing:");
    console.log(`  Typing: ${result.timing.typing}ms`);
    console.log(`  Waiting: ${result.timing.waiting}ms`);
    console.log(`  Rendering: ${result.timing.rendering}ms`);
    console.log(`  Total: ${result.timing.total}ms`);
    if (result.screenshots.length > 0) {
      console.log("");
      console.log("Screenshots:");
      for (const shot of result.screenshots) {
        console.log(`  ${shot.step}: ${shot.path}`);
      }
    }
    if (result.extractedResults.length > 0) {
      console.log("");
      console.log(`Extracted Results (${result.extractedResults.length}):`);
      for (const r of result.extractedResults.slice(0, 5)) {
        const title = r.title || r.fullText.slice(0, 50);
        console.log(`  ${r.index + 1}. ${title}`);
      }
      if (result.extractedResults.length > 5) {
        console.log(`  ... and ${result.extractedResults.length - 5} more`);
      }
    }
    if (obvIssues.length > 0) {
      console.log("");
      console.log("Potential Issues:");
      for (const issue of obvIssues) {
        const severity = issue.severity.toUpperCase();
        console.log(`  [${severity}] ${issue.description}`);
      }
    }
    console.log("");
    console.log("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
    console.log("VALIDATION CONTEXT FOR CLAUDE CODE:");
    console.log("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
    console.log("");
    console.log(generateValidationPrompt2(validationContext));
    if (result.artifactDir) {
      console.log("");
      console.log(`Artifacts saved to: ${result.artifactDir}`);
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
program.command("scan-check").description("Compare all sessions from the last scan-start").option("-f, --format <format>", "Output format: json, text, minimal", "text").action(async (_options) => {
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
    const { join: join15 } = await import("path");
    const outputDir = program.opts().output || "./.ibr";
    console.log(`Diagnosing ${resolvedUrl}...`);
    console.log("");
    const result = await captureWithDiagnostics2({
      url: resolvedUrl,
      outputPath: join15(outputDir, "diagnose", "test.png"),
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
program.command("init").description("Initialize IBR config and optionally register Claude Code plugin").option("-p, --port <port>", "Port for baseUrl (auto-detects available port if not specified)").option("-u, --url <url>", "Full base URL (overrides port)").option("--skip-plugin", "Skip Claude Code plugin registration prompt").action(async (options) => {
  const { writeFile: writeFile10, readFile: readFile15, mkdir: mkdir11 } = await import("fs/promises");
  const configPath = (0, import_path15.join)(process.cwd(), ".ibrrc.json");
  const claudeSettingsPath = (0, import_path15.join)(process.cwd(), ".claude", "settings.json");
  let configCreated = false;
  if (!(0, import_fs8.existsSync)(configPath)) {
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
      fullPage: true,
      retention: {
        maxSessions: 20,
        maxAgeDays: 7,
        keepFailed: true,
        autoClean: true
      }
    };
    await writeFile10(configPath, JSON.stringify(config, null, 2));
    configCreated = true;
    console.log("");
    console.log("Created .ibrrc.json");
    console.log("");
    console.log("Configuration:");
    console.log(JSON.stringify(config, null, 2));
  } else {
    console.log(".ibrrc.json already exists.");
  }
  if (options.skipPlugin) {
    if (configCreated) {
      console.log("");
      console.log("Edit baseUrl to match your dev server.");
    }
    return;
  }
  const claudeDirExists = (0, import_fs8.existsSync)((0, import_path15.join)(process.cwd(), ".claude"));
  const hasClaudeSettings = (0, import_fs8.existsSync)(claudeSettingsPath);
  const possiblePluginPaths = [
    "node_modules/@tyroneross/interface-built-right/plugin",
    "node_modules/interface-built-right/plugin",
    "./plugin"
    // if running from IBR repo
  ];
  let pluginPath = null;
  for (const p of possiblePluginPaths) {
    if ((0, import_fs8.existsSync)((0, import_path15.join)(process.cwd(), p))) {
      pluginPath = p;
      break;
    }
  }
  if (!pluginPath) {
    console.log("");
    console.log("IBR plugin path not found. Skipping Claude Code integration.");
    if (configCreated) {
      console.log("");
      console.log("Edit baseUrl to match your dev server.");
    }
    return;
  }
  let settings = { plugins: [] };
  if (hasClaudeSettings) {
    try {
      const content = await readFile15(claudeSettingsPath, "utf-8");
      settings = JSON.parse(content);
      if (!settings.plugins) {
        settings.plugins = [];
      }
    } catch {
      settings = { plugins: [] };
    }
    const alreadyRegistered = settings.plugins.some(
      (p) => p.includes("interface-built-right/plugin") || p === pluginPath
    );
    if (alreadyRegistered) {
      console.log("");
      console.log("IBR plugin already registered in Claude Code.");
      if (configCreated) {
        console.log("");
        console.log("Edit baseUrl to match your dev server.");
      }
      return;
    }
  }
  console.log("");
  console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  console.log("  CLAUDE CODE PLUGIN");
  console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  console.log("");
  console.log("IBR includes a Claude Code plugin for AI-assisted visual testing:");
  console.log("");
  console.log("  /ibr:snapshot  - Capture baseline with one command");
  console.log("  /ibr:compare   - Visual diff without leaving conversation");
  console.log("  /ibr:ui        - Open comparison viewer");
  console.log("");
  console.log("Benefits:");
  console.log("  \u2022 Instant visual regression checks during development");
  console.log("  \u2022 AI understands page semantics (intent, state, landmarks)");
  console.log("  \u2022 Automatic suggestions when UI files change");
  console.log("");
  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const answer = await new Promise((resolve2) => {
    rl.question("Register IBR plugin for Claude Code? [Y/n] ", (ans) => {
      rl.close();
      resolve2(ans.trim().toLowerCase());
    });
  });
  if (answer === "n" || answer === "no") {
    console.log("");
    console.log("Skipped plugin registration.");
    console.log("");
    console.log("To register later, add to .claude/settings.json:");
    console.log(`  "plugins": ["${pluginPath}"]`);
    if (configCreated) {
      console.log("");
      console.log("Edit baseUrl in .ibrrc.json to match your dev server.");
    }
    return;
  }
  try {
    if (!claudeDirExists) {
      await mkdir11((0, import_path15.join)(process.cwd(), ".claude"), { recursive: true });
    }
    settings.plugins = settings.plugins || [];
    settings.plugins.push(pluginPath);
    await writeFile10(claudeSettingsPath, JSON.stringify(settings, null, 2));
    console.log("");
    console.log("IBR plugin registered.");
    console.log("");
    console.log("Restart Claude Code to activate. Then use:");
    console.log("  /ibr:snapshot <url>  - Capture baseline");
    console.log("  /ibr:compare         - Compare after changes");
  } catch (err) {
    console.log("");
    console.log("Failed to register plugin:", err instanceof Error ? err.message : err);
    console.log("");
    console.log("To register manually, add to .claude/settings.json:");
    console.log(`  "plugins": ["${pluginPath}"]`);
  }
  if (configCreated) {
    console.log("");
    console.log("Edit baseUrl in .ibrrc.json to match your dev server.");
  }
});
program.parse();
//# sourceMappingURL=ibr.js.map