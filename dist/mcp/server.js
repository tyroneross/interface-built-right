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
var import_zod, ViewportSchema, VIEWPORTS, ConfigSchema, SessionQuerySchema, ComparisonResultSchema, ChangedRegionSchema, VerdictSchema, AnalysisSchema, SessionStatusSchema, BoundsSchema, LandmarkElementSchema, SessionSchema, ComparisonReportSchema, InteractiveStateSchema, A11yAttributesSchema, EnhancedElementSchema, ElementIssueSchema, AuditResultSchema, RuleSeveritySchema, RuleSettingSchema, RulesConfigSchema, ViolationSchema, RuleAuditResultSchema, MemorySourceSchema, PreferenceCategorySchema, ExpectationOperatorSchema, ExpectationSchema, PreferenceSchema, ObservationSchema, LearnedExpectationSchema, ActivePreferenceSchema, MemorySummarySchema;
var init_schemas = __esm({
  "src/schemas.ts"() {
    "use strict";
    import_zod = require("zod");
    ViewportSchema = import_zod.z.object({
      name: import_zod.z.string().min(1).max(50),
      width: import_zod.z.number().min(100).max(3840),
      height: import_zod.z.number().min(100).max(2160)
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
      "iphone-14-pro-max": { name: "iphone-14-pro-max", width: 430, height: 932 },
      // Native simulator viewports
      "iphone-16": { name: "iphone-16", width: 393, height: 852 },
      "iphone-16-plus": { name: "iphone-16-plus", width: 430, height: 932 },
      "iphone-16-pro": { name: "iphone-16-pro", width: 402, height: 874 },
      "iphone-16-pro-max": { name: "iphone-16-pro-max", width: 440, height: 956 },
      "watch-series-10-42mm": { name: "watch-series-10-42mm", width: 176, height: 215 },
      "watch-series-10-46mm": { name: "watch-series-10-46mm", width: 198, height: 242 },
      "watch-ultra-2-49mm": { name: "watch-ultra-2-49mm", width: 205, height: 251 }
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
      url: import_zod.z.string().min(1),
      viewport: ViewportSchema,
      status: SessionStatusSchema,
      platform: import_zod.z.enum(["web", "ios", "watchos"]).optional(),
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
    MemorySourceSchema = import_zod.z.enum(["user", "learned", "framework"]);
    PreferenceCategorySchema = import_zod.z.enum([
      "color",
      "layout",
      "typography",
      "navigation",
      "component",
      "spacing",
      "interaction",
      "content"
    ]);
    ExpectationOperatorSchema = import_zod.z.enum(["equals", "contains", "matches", "gte", "lte"]);
    ExpectationSchema = import_zod.z.object({
      property: import_zod.z.string(),
      operator: ExpectationOperatorSchema,
      value: import_zod.z.string()
    });
    PreferenceSchema = import_zod.z.object({
      id: import_zod.z.string(),
      description: import_zod.z.string(),
      category: PreferenceCategorySchema,
      source: MemorySourceSchema,
      route: import_zod.z.string().optional(),
      componentType: import_zod.z.string().optional(),
      expectation: ExpectationSchema,
      confidence: import_zod.z.number().min(0).max(1).default(1),
      createdAt: import_zod.z.string().datetime(),
      updatedAt: import_zod.z.string().datetime(),
      sessionIds: import_zod.z.array(import_zod.z.string()).optional()
    });
    ObservationSchema = import_zod.z.object({
      description: import_zod.z.string(),
      category: PreferenceCategorySchema,
      property: import_zod.z.string(),
      value: import_zod.z.string()
    });
    LearnedExpectationSchema = import_zod.z.object({
      id: import_zod.z.string(),
      sessionId: import_zod.z.string(),
      route: import_zod.z.string(),
      observations: import_zod.z.array(ObservationSchema),
      approved: import_zod.z.boolean(),
      createdAt: import_zod.z.string().datetime()
    });
    ActivePreferenceSchema = import_zod.z.object({
      id: import_zod.z.string(),
      description: import_zod.z.string(),
      category: PreferenceCategorySchema,
      route: import_zod.z.string().optional(),
      componentType: import_zod.z.string().optional(),
      property: import_zod.z.string(),
      operator: ExpectationOperatorSchema,
      value: import_zod.z.string(),
      confidence: import_zod.z.number()
    });
    MemorySummarySchema = import_zod.z.object({
      version: import_zod.z.literal(1),
      updatedAt: import_zod.z.string().datetime(),
      stats: import_zod.z.object({
        totalPreferences: import_zod.z.number(),
        totalLearned: import_zod.z.number(),
        byCategory: import_zod.z.record(import_zod.z.string(), import_zod.z.number()),
        bySource: import_zod.z.record(import_zod.z.string(), import_zod.z.number())
      }),
      activePreferences: import_zod.z.array(ActivePreferenceSchema)
    });
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

// src/git-context.ts
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
async function createSession(outputDir, url, name, viewport, platform) {
  const sessionId = generateSessionId();
  const paths = getSessionPaths(outputDir, sessionId);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const session = {
    id: sessionId,
    name,
    url,
    viewport,
    status: "baseline",
    ...platform ? { platform } : {},
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
    const path = parsed.pathname + parsed.search;
    if (path.length > maxLength) {
      return path.substring(0, maxLength - 3) + "...";
    }
    return path;
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

// src/native/simulator.ts
var simulator_exports = {};
__export(simulator_exports, {
  bootDevice: () => bootDevice,
  findDevice: () => findDevice,
  formatDevice: () => formatDevice,
  getBootedDevices: () => getBootedDevices,
  listDevices: () => listDevices
});
function parseRuntime(runtime) {
  if (/watchOS/i.test(runtime)) return "watchos";
  return "ios";
}
async function listDevices() {
  const { stdout } = await execFileAsync("xcrun", ["simctl", "list", "devices", "--json"]);
  const data = JSON.parse(stdout);
  const devices = [];
  for (const [runtime, deviceList] of Object.entries(data.devices)) {
    if (!Array.isArray(deviceList)) continue;
    for (const dev of deviceList) {
      devices.push({
        udid: dev.udid,
        name: dev.name,
        state: dev.state,
        runtime,
        platform: parseRuntime(runtime),
        isAvailable: dev.isAvailable
      });
    }
  }
  return devices;
}
async function findDevice(nameOrUdid) {
  const devices = await listDevices();
  const search = nameOrUdid.toLowerCase();
  const byUdid = devices.find((d) => d.udid.toLowerCase() === search);
  if (byUdid) return byUdid;
  const matches = devices.filter((d) => d.name.toLowerCase().includes(search) && d.isAvailable).sort((a, b) => {
    if (a.state === "Booted" && b.state !== "Booted") return -1;
    if (b.state === "Booted" && a.state !== "Booted") return 1;
    return 0;
  });
  return matches[0] || null;
}
async function getBootedDevices() {
  const devices = await listDevices();
  return devices.filter((d) => d.state === "Booted");
}
async function bootDevice(udid) {
  const devices = await listDevices();
  const device = devices.find((d) => d.udid === udid);
  if (!device) {
    throw new Error(`Device not found: ${udid}`);
  }
  if (device.state === "Booted") {
    return;
  }
  await execFileAsync("xcrun", ["simctl", "boot", udid]);
  await new Promise((resolve2) => setTimeout(resolve2, 2e3));
}
function formatDevice(device) {
  const runtimeVersion = device.runtime.replace(/^.*SimRuntime\./, "").replace(/-/g, ".");
  const stateIcon = device.state === "Booted" ? "\x1B[32m\u25CF\x1B[0m" : "\x1B[90m\u25CB\x1B[0m";
  return `${stateIcon} ${device.name} (${runtimeVersion}) [${device.udid.slice(0, 8)}...]`;
}
var import_child_process2, import_util, execFileAsync;
var init_simulator = __esm({
  "src/native/simulator.ts"() {
    "use strict";
    import_child_process2 = require("child_process");
    import_util = require("util");
    execFileAsync = (0, import_util.promisify)(import_child_process2.execFile);
  }
});

// src/mcp/server.ts
var import_readline = require("readline");

// src/scan.ts
var import_playwright2 = require("playwright");
init_schemas();

// src/extract.ts
var import_playwright = require("playwright");
init_schemas();
var INTERACTIVE_SELECTORS = [
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
async function extractInteractiveElements(page) {
  return page.evaluate((selectors) => {
    const seen = /* @__PURE__ */ new Set();
    const elements = [];
    const generateSelector = (el) => {
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

// src/scan.ts
init_interactivity();

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

// src/semantic/state-detector.ts
async function detectAuthState(page) {
  const signals = [];
  let authenticated = null;
  let confidence = 0;
  let username;
  const checks = await page.evaluate(() => {
    const doc = document;
    const text = doc.body?.innerText?.toLowerCase() || "";
    function findByText(tags, patterns) {
      for (const tag of tags) {
        for (const el of Array.from(doc.querySelectorAll(tag))) {
          const t = el.textContent?.trim().toLowerCase() || "";
          if (patterns.some((p) => t === p || t.includes(p))) return el;
        }
      }
      return null;
    }
    const logoutButton = findByText(["button", "a"], ["logout", "sign out"]) || doc.querySelector('[class*="logout"], [data-testid*="logout"]');
    const userMenu = doc.querySelector(
      '[class*="user-menu"], [class*="avatar"], [class*="profile-menu"], [class*="account-menu"], [data-testid*="user"]'
    );
    const welcomeText = text.match(/welcome,?\s+(\w+)/i);
    const userNameEl = doc.querySelector(
      '[class*="username"], [class*="user-name"], [class*="display-name"]'
    );
    const loginLink = findByText(["a", "button"], ["login", "sign in"]) || doc.querySelector('[class*="login-link"], [href*="/login"], [href*="/signin"]');
    const signupLink = findByText(["a"], ["sign up", "register"]) || doc.querySelector('[href*="/signup"], [href*="/register"]');
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
    function findByText(tags, patterns) {
      for (const tag of tags) {
        for (const el of Array.from(doc.querySelectorAll(tag))) {
          const t = el.textContent?.trim().toLowerCase() || "";
          if (patterns.some((p) => t === p || t.includes(p))) return el;
        }
      }
      return null;
    }
    const submitButton = doc.querySelector('button[type="submit"], input[type="submit"]');
    const searchInput = doc.querySelector('input[type="search"], input[name*="search"], input[placeholder*="search"]');
    const loginForm = doc.querySelector('form input[type="password"]');
    const mainNav = doc.querySelector("nav a, header a");
    const backButton = findByText(["a", "button"], ["back"]);
    const addButton = findByText(["button"], ["add", "create", "new"]);
    const editButton = findByText(["button", "a"], ["edit"]);
    const deleteButton = findByText(["button"], ["delete", "remove"]);
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
      selector: checks.addSelector || "button",
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

// src/semantic/landmarks.ts
var LANDMARK_SELECTORS = {
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

// src/scan.ts
async function scan(url, options = {}) {
  const {
    viewport: viewportOpt = "desktop",
    timeout = 3e4,
    waitFor,
    screenshot
  } = options;
  const resolvedViewport = typeof viewportOpt === "string" ? VIEWPORTS[viewportOpt] || VIEWPORTS.desktop : viewportOpt;
  const browser2 = await import_playwright2.chromium.launch({ headless: true });
  const context = await browser2.newContext({
    viewport: { width: resolvedViewport.width, height: resolvedViewport.height },
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const consoleWarnings = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    } else if (msg.type() === "warning") {
      consoleWarnings.push(msg.text());
    }
  });
  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout
    });
    await page.waitForLoadState("networkidle", { timeout: 1e4 }).catch(() => {
    });
    if (waitFor) {
      await page.waitForSelector(waitFor, { timeout: 1e4 }).catch(() => {
      });
    }
    const [elements, interactivity, semantic] = await Promise.all([
      extractAndAudit(page, resolvedViewport),
      testInteractivity(page),
      getSemanticOutput(page)
    ]);
    if (screenshot) {
      await page.screenshot({
        path: screenshot.path,
        fullPage: screenshot.fullPage ?? true
      });
    }
    let route;
    try {
      route = new URL(url).pathname;
    } catch {
      route = url;
    }
    const issues = aggregateIssues(elements.audit, interactivity, semantic, consoleErrors);
    const verdict = determineVerdict2(issues);
    const summary = generateSummary2(elements, interactivity, semantic, issues, consoleErrors);
    return {
      url,
      route,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      viewport: resolvedViewport,
      elements,
      interactivity,
      semantic,
      console: {
        errors: consoleErrors,
        warnings: consoleWarnings
      },
      verdict,
      issues,
      summary
    };
  } finally {
    await context.close();
    await browser2.close();
  }
}
async function extractAndAudit(page, viewport) {
  const isMobile = viewport.width < 768;
  const elements = await extractInteractiveElements(page);
  const audit = analyzeElements(elements, isMobile);
  return { all: elements, audit };
}
function aggregateIssues(audit, interactivity, semantic, consoleErrors) {
  const issues = [];
  for (const issue of audit.issues) {
    issues.push({
      category: issue.type === "MISSING_ARIA_LABEL" ? "accessibility" : "interactivity",
      severity: issue.severity,
      element: issue.type === "TOUCH_TARGET_SMALL" ? void 0 : void 0,
      description: issue.message
    });
  }
  const auditMessages = new Set(audit.issues.map((i) => i.message));
  for (const issue of interactivity.issues) {
    if (auditMessages.has(issue.description)) continue;
    issues.push({
      category: issue.type === "MISSING_LABEL" ? "accessibility" : "interactivity",
      severity: issue.severity,
      element: issue.element,
      description: issue.description,
      fix: getFixSuggestion(issue.type)
    });
  }
  for (const issue of semantic.issues) {
    issues.push({
      category: "semantic",
      severity: issue.severity,
      description: issue.problem
    });
  }
  for (const error of consoleErrors) {
    if (error.includes("favicon") || error.includes("manifest")) continue;
    issues.push({
      category: "console",
      severity: "error",
      description: `Console error: ${error.slice(0, 200)}`
    });
  }
  return issues;
}
function determineVerdict2(issues) {
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  if (errorCount >= 3) return "FAIL";
  if (errorCount > 0 || warningCount >= 5) return "ISSUES";
  return "PASS";
}
function generateSummary2(elements, interactivity, semantic, issues, consoleErrors) {
  const parts = [];
  parts.push(`${semantic.pageIntent.intent} page`);
  parts.push(`${elements.audit.totalElements} elements (${elements.audit.interactiveCount} interactive)`);
  const { buttons, links, forms } = interactivity;
  const interactiveParts = [];
  if (buttons.length > 0) interactiveParts.push(`${buttons.length} buttons`);
  if (links.length > 0) interactiveParts.push(`${links.length} links`);
  if (forms.length > 0) interactiveParts.push(`${forms.length} forms`);
  if (interactiveParts.length > 0) {
    parts.push(interactiveParts.join(", "));
  }
  if (interactivity.summary.withoutHandlers > 0) {
    parts.push(`${interactivity.summary.withoutHandlers} elements without handlers`);
  }
  if (semantic.state.auth.authenticated) {
    parts.push("authenticated");
  }
  if (semantic.state.loading.loading) {
    parts.push(`loading (${semantic.state.loading.type})`);
  }
  if (semantic.state.errors.hasErrors) {
    parts.push(`${semantic.state.errors.errors.length} page errors`);
  }
  if (consoleErrors.length > 0) {
    parts.push(`${consoleErrors.length} console errors`);
  }
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  if (errorCount > 0 || warningCount > 0) {
    const issueParts = [];
    if (errorCount > 0) issueParts.push(`${errorCount} errors`);
    if (warningCount > 0) issueParts.push(`${warningCount} warnings`);
    parts.push(issueParts.join(", "));
  }
  return parts.join(", ");
}
function getFixSuggestion(type) {
  switch (type) {
    case "NO_HANDLER":
      return "Add an onClick handler or remove the interactive appearance";
    case "PLACEHOLDER_LINK":
      return "Add a real href or an onClick handler";
    case "MISSING_LABEL":
      return "Add aria-label or visible text content";
    case "FORM_NO_SUBMIT":
      return "Add a submit handler or action attribute to the form";
    case "ORPHAN_SUBMIT":
      return "Ensure the submit button is inside a form";
    case "SMALL_TOUCH_TARGET":
      return "Increase element size to at least 44x44px for touch targets";
    default:
      return void 0;
  }
}

// src/index.ts
init_schemas();

// src/capture.ts
var import_playwright4 = require("playwright");
var import_promises2 = require("fs/promises");
var import_path2 = require("path");
init_schemas();

// src/types.ts
var DEFAULT_DYNAMIC_SELECTORS = [
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

// src/auth.ts
var import_playwright3 = require("playwright");
var import_promises = require("fs/promises");
var import_path = require("path");
var import_os = require("os");
var import_crypto = require("crypto");
function isDeployedEnvironment() {
  return !!(process.env.VERCEL || process.env.NETLIFY || process.env.CI || process.env.GITHUB_ACTIONS || process.env.GITLAB_CI || process.env.CIRCLECI || process.env.JENKINS_URL || process.env.TRAVIS || process.env.HEROKU || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AZURE_FUNCTIONS_ENVIRONMENT);
}
function getAuthStatePath(outputDir) {
  const username = (0, import_os.userInfo)().username;
  return (0, import_path.join)(outputDir, `auth.${username}.json`);
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

// src/capture.ts
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
var browser = null;
async function getBrowser() {
  if (!browser) {
    browser = await import_playwright4.chromium.launch({
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

// src/index.ts
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

// src/flows/login.ts
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

// src/flows/search.ts
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

// src/flows/form.ts
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

// src/index.ts
var import_playwright8 = require("playwright");
var import_promises10 = require("fs/promises");
var import_path11 = require("path");
var import_os2 = require("os");

// src/cleanup.ts
var import_promises6 = require("fs/promises");
var import_path6 = require("path");
init_session();
var DEFAULT_RETENTION = {
  maxSessions: void 0,
  maxAgeDays: void 0,
  keepFailed: true,
  autoClean: false
};
async function loadRetentionConfig(outputDir) {
  const configPath = (0, import_path6.join)(outputDir, "..", ".ibrrc.json");
  try {
    await (0, import_promises6.access)(configPath);
    const content = await (0, import_promises6.readFile)(configPath, "utf-8");
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

// src/consistency.ts
var import_playwright5 = require("playwright");

// src/crawl.ts
var import_playwright6 = require("playwright");

// src/index.ts
init_session();

// src/operation-tracker.ts
var import_nanoid2 = require("nanoid");

// src/index.ts
init_performance();
init_interactivity();
init_api_timing();

// src/responsive.ts
var import_playwright7 = require("playwright");
init_schemas();

// src/memory.ts
var import_nanoid3 = require("nanoid");

// src/decision-tracker.ts
var import_nanoid4 = require("nanoid");

// src/context/types.ts
var import_zod2 = require("zod");
var DecisionTypeSchema = import_zod2.z.enum([
  "css_change",
  "layout_change",
  "color_change",
  "spacing_change",
  "component_add",
  "component_remove",
  "component_modify",
  "content_change"
]);
var DecisionStateSchema = import_zod2.z.object({
  css: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.string()).optional(),
  html_snippet: import_zod2.z.string().optional(),
  screenshot_ref: import_zod2.z.string().optional()
});
var DecisionEntrySchema = import_zod2.z.object({
  id: import_zod2.z.string(),
  timestamp: import_zod2.z.string().datetime(),
  route: import_zod2.z.string(),
  component: import_zod2.z.string().optional(),
  type: DecisionTypeSchema,
  description: import_zod2.z.string(),
  rationale: import_zod2.z.string().optional(),
  before: DecisionStateSchema.optional(),
  after: DecisionStateSchema.optional(),
  files_changed: import_zod2.z.array(import_zod2.z.string()),
  session_id: import_zod2.z.string().optional()
});
var DecisionSummarySchema = import_zod2.z.object({
  route: import_zod2.z.string(),
  component: import_zod2.z.string().optional(),
  latest_change: import_zod2.z.string(),
  decision_count: import_zod2.z.number(),
  full_log_ref: import_zod2.z.string()
});
var CurrentUIStateSchema = import_zod2.z.object({
  last_snapshot_ref: import_zod2.z.string().optional(),
  pending_verifications: import_zod2.z.number(),
  known_issues: import_zod2.z.array(import_zod2.z.string())
});
var CompactContextSchema = import_zod2.z.object({
  version: import_zod2.z.literal(1),
  session_id: import_zod2.z.string(),
  updated_at: import_zod2.z.string().datetime(),
  active_route: import_zod2.z.string().optional(),
  decisions_summary: import_zod2.z.array(DecisionSummarySchema),
  current_ui_state: CurrentUIStateSchema,
  preferences_active: import_zod2.z.number()
});
var CompactionRequestSchema = import_zod2.z.object({
  reason: import_zod2.z.enum(["session_ending", "context_limit", "manual"]),
  preserve_decisions: import_zod2.z.array(import_zod2.z.string()).optional()
});
var CompactionResultSchema = import_zod2.z.object({
  compact_context: CompactContextSchema,
  archived_to: import_zod2.z.string(),
  decisions_compacted: import_zod2.z.number(),
  decisions_preserved: import_zod2.z.number()
});

// src/context/compact.ts
var import_nanoid5 = require("nanoid");

// src/native/viewports.ts
var NATIVE_VIEWPORTS = {
  // iPhone 16 series
  "iphone-16": { name: "iphone-16", width: 393, height: 852 },
  "iphone-16-plus": { name: "iphone-16-plus", width: 430, height: 932 },
  "iphone-16-pro": { name: "iphone-16-pro", width: 402, height: 874 },
  "iphone-16-pro-max": { name: "iphone-16-pro-max", width: 440, height: 956 },
  // Apple Watch Series 10
  "watch-series-10-42mm": { name: "watch-series-10-42mm", width: 176, height: 215 },
  "watch-series-10-46mm": { name: "watch-series-10-46mm", width: 198, height: 242 },
  // Apple Watch Ultra 2
  "watch-ultra-2-49mm": { name: "watch-ultra-2-49mm", width: 205, height: 251 }
};
var DEVICE_NAME_PATTERNS = [
  [/iPhone 16 Pro Max/i, "iphone-16-pro-max"],
  [/iPhone 16 Pro/i, "iphone-16-pro"],
  [/iPhone 16 Plus/i, "iphone-16-plus"],
  [/iPhone 16/i, "iphone-16"],
  [/Apple Watch.*Ultra.*49/i, "watch-ultra-2-49mm"],
  [/Apple Watch.*46/i, "watch-series-10-46mm"],
  [/Apple Watch.*42/i, "watch-series-10-42mm"],
  // Fallbacks for generic watch/phone
  [/Apple Watch Ultra/i, "watch-ultra-2-49mm"],
  [/Apple Watch/i, "watch-series-10-42mm"],
  [/iPhone/i, "iphone-16-pro"]
];
function getDeviceViewport(device) {
  for (const [pattern, key] of DEVICE_NAME_PATTERNS) {
    if (pattern.test(device.name)) {
      return NATIVE_VIEWPORTS[key];
    }
  }
  if (device.platform === "watchos") {
    return NATIVE_VIEWPORTS["watch-series-10-42mm"];
  }
  return NATIVE_VIEWPORTS["iphone-16-pro"];
}

// src/native/index.ts
init_simulator();

// src/native/capture.ts
var import_child_process3 = require("child_process");
var import_util2 = require("util");
var import_promises7 = require("fs/promises");
var import_path7 = require("path");
var execFileAsync2 = (0, import_util2.promisify)(import_child_process3.execFile);
async function captureNativeScreenshot(options) {
  const { device, outputPath, mask } = options;
  const start = Date.now();
  try {
    await (0, import_promises7.mkdir)((0, import_path7.dirname)(outputPath), { recursive: true });
    const args = ["simctl", "io", device.udid, "screenshot", "--type=png"];
    const effectiveMask = mask ?? (device.platform === "watchos" ? "black" : void 0);
    if (effectiveMask) {
      args.push(`--mask=${effectiveMask}`);
    }
    args.push(outputPath);
    await execFileAsync2("xcrun", args, { timeout: 15e3 });
    const viewport = getDeviceViewport(device);
    return {
      success: true,
      outputPath,
      device,
      viewport,
      timing: Date.now() - start
    };
  } catch (err) {
    return {
      success: false,
      device,
      viewport: getDeviceViewport(device),
      timing: Date.now() - start,
      error: err instanceof Error ? err.message : "Screenshot capture failed"
    };
  }
}

// src/native/extract.ts
var import_child_process4 = require("child_process");
var import_util3 = require("util");
var import_fs = require("fs");
var import_promises8 = require("fs/promises");
var import_path8 = require("path");
var execFileAsync3 = (0, import_util3.promisify)(import_child_process4.execFile);
var EXTRACTOR_DIR = (0, import_path8.join)(process.cwd(), ".ibr", "bin");
var EXTRACTOR_PATH = (0, import_path8.join)(EXTRACTOR_DIR, "ibr-ax-extract");
var SWIFT_SOURCE_DIR = (0, import_path8.join)(__dirname, "..", "..", "src", "native", "swift", "ibr-ax-extract");
async function ensureExtractor() {
  if ((0, import_fs.existsSync)(EXTRACTOR_PATH)) {
    return EXTRACTOR_PATH;
  }
  await (0, import_promises8.mkdir)(EXTRACTOR_DIR, { recursive: true });
  try {
    await execFileAsync3("swift", ["build", "-c", "release"], {
      cwd: SWIFT_SOURCE_DIR,
      timeout: 12e4
      // 2 minutes for first compile
    });
    const buildPath = (0, import_path8.join)(SWIFT_SOURCE_DIR, ".build", "release", "ibr-ax-extract");
    if (!(0, import_fs.existsSync)(buildPath)) {
      throw new Error("Swift build succeeded but binary not found at expected path");
    }
    await execFileAsync3("cp", [buildPath, EXTRACTOR_PATH]);
    await execFileAsync3("chmod", ["+x", EXTRACTOR_PATH]);
    return EXTRACTOR_PATH;
  } catch (err) {
    throw new Error(
      `Failed to compile Swift extractor: ${err instanceof Error ? err.message : "Unknown error"}. Ensure Xcode Command Line Tools are installed: xcode-select --install`
    );
  }
}
function isExtractorAvailable() {
  if ((0, import_fs.existsSync)(EXTRACTOR_PATH)) return true;
  return (0, import_fs.existsSync)((0, import_path8.join)(SWIFT_SOURCE_DIR, "Package.swift"));
}
async function extractNativeElements(device) {
  const extractorPath = await ensureExtractor();
  try {
    const { stdout } = await execFileAsync3(extractorPath, [
      "--device-name",
      device.name
    ], {
      timeout: 3e4
    });
    const elements = JSON.parse(stdout);
    return elements;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("permission") || message.includes("accessibility")) {
      throw new Error(
        "Accessibility permission required. Grant Terminal/IDE access in System Settings > Privacy & Security > Accessibility"
      );
    }
    throw new Error(`Element extraction failed: ${message}`);
  }
}
function mapToEnhancedElements(nativeElements) {
  const enhanced = [];
  function flatten(elements, depth = 0) {
    for (const el of elements) {
      const tagName = mapRoleToTag(el.role);
      const isInteractive = isInteractiveRole(el.role) && el.isEnabled;
      enhanced.push({
        selector: el.identifier || `[role="${el.role}"][label="${el.label}"]`,
        tagName,
        text: el.label || void 0,
        bounds: {
          x: el.frame.x,
          y: el.frame.y,
          width: el.frame.width,
          height: el.frame.height
        },
        interactive: {
          hasOnClick: isInteractive,
          hasHref: false,
          isDisabled: !el.isEnabled,
          tabIndex: isInteractive ? 0 : -1,
          cursor: isInteractive ? "pointer" : "default"
        },
        a11y: {
          role: mapRoleToAriaRole(el.role),
          ariaLabel: el.label || null,
          ariaDescribedBy: null
        }
      });
      if (el.children.length > 0) {
        flatten(el.children, depth + 1);
      }
    }
  }
  flatten(nativeElements);
  return enhanced;
}
function mapRoleToTag(role) {
  const roleMap = {
    "AXButton": "button",
    "AXLink": "a",
    "AXTextField": "input",
    "AXTextArea": "textarea",
    "AXStaticText": "span",
    "AXImage": "img",
    "AXGroup": "div",
    "AXList": "ul",
    "AXCell": "li",
    "AXTable": "table",
    "AXScrollArea": "div",
    "AXToolbar": "nav",
    "AXMenuBar": "nav",
    "AXMenu": "menu",
    "AXMenuItem": "li",
    "AXCheckBox": "input",
    "AXRadioButton": "input",
    "AXSlider": "input",
    "AXSwitch": "input",
    "AXPopUpButton": "select",
    "AXComboBox": "select",
    "AXTabGroup": "div",
    "AXTab": "button",
    "AXNavigationBar": "nav",
    "AXHeader": "header"
  };
  return roleMap[role] || "div";
}
function mapRoleToAriaRole(role) {
  const roleMap = {
    "AXButton": "button",
    "AXLink": "link",
    "AXTextField": "textbox",
    "AXTextArea": "textbox",
    "AXStaticText": "text",
    "AXImage": "img",
    "AXGroup": "group",
    "AXList": "list",
    "AXCell": "listitem",
    "AXTable": "table",
    "AXCheckBox": "checkbox",
    "AXRadioButton": "radio",
    "AXSlider": "slider",
    "AXSwitch": "switch",
    "AXTab": "tab",
    "AXTabGroup": "tablist",
    "AXNavigationBar": "navigation",
    "AXToolbar": "toolbar",
    "AXMenuItem": "menuitem",
    "AXMenu": "menu"
  };
  return roleMap[role] || null;
}
function isInteractiveRole(role) {
  const interactiveRoles = /* @__PURE__ */ new Set([
    "AXButton",
    "AXLink",
    "AXTextField",
    "AXTextArea",
    "AXCheckBox",
    "AXRadioButton",
    "AXSlider",
    "AXSwitch",
    "AXPopUpButton",
    "AXComboBox",
    "AXMenuItem",
    "AXTab"
  ]);
  return interactiveRoles.has(role);
}

// src/native/rules.ts
function auditNativeElements(elements, platform, viewport) {
  const issues = [];
  const interactive = elements.filter(
    (e) => e.interactive.hasOnClick && !e.interactive.isDisabled
  );
  if (platform === "watchos" && interactive.length > 7) {
    issues.push({
      type: "TOUCH_TARGET_SMALL",
      // Reuse closest existing type
      severity: "warning",
      message: `watchOS screen has ${interactive.length} interactive elements (recommended max: 7). Reduce choices to avoid cognitive overload on small displays.`
    });
  }
  for (const el of interactive) {
    const minDimension = Math.min(el.bounds.width, el.bounds.height);
    if (minDimension < 44) {
      issues.push({
        type: "TOUCH_TARGET_SMALL",
        severity: "error",
        message: `Touch target too small: "${el.text || el.selector}" is ${el.bounds.width}x${el.bounds.height}pt (minimum: 44x44pt)`
      });
    }
  }
  if (platform === "watchos") {
    for (const el of elements) {
      const rightEdge = el.bounds.x + el.bounds.width;
      if (rightEdge > viewport.width) {
        issues.push({
          type: "TOUCH_TARGET_SMALL",
          // Closest existing type
          severity: "warning",
          message: `Element "${el.text || el.selector}" overflows watchOS viewport (right edge: ${rightEdge}pt, viewport width: ${viewport.width}pt)`
        });
      }
    }
  }
  for (const el of interactive) {
    if (!el.text && !el.a11y.ariaLabel) {
      issues.push({
        type: "MISSING_ARIA_LABEL",
        severity: "error",
        message: `Interactive element "${el.selector}" has no accessibility label`
      });
    }
  }
  return issues;
}

// src/native/scan.ts
var import_path10 = require("path");
init_simulator();

// src/native/macos.ts
var import_child_process5 = require("child_process");
var import_util4 = require("util");
var import_promises9 = require("fs/promises");
var import_path9 = require("path");
var execFileAsync4 = (0, import_util4.promisify)(import_child_process5.execFile);
var execAsync = (0, import_util4.promisify)(import_child_process5.exec);
async function findProcess(appNameOrBundleId) {
  try {
    const { stdout } = await execAsync(
      `lsappinfo info -only pid "${appNameOrBundleId}" 2>/dev/null || true`
    );
    const pidMatch = stdout.match(/"pid"\s*=\s*(\d+)/);
    if (pidMatch) {
      return parseInt(pidMatch[1], 10);
    }
  } catch {
  }
  try {
    const { stdout } = await execAsync(
      `pgrep -f "${appNameOrBundleId}" 2>/dev/null | head -1`
    );
    const pid = parseInt(stdout.trim(), 10);
    if (!isNaN(pid) && pid > 0) {
      return pid;
    }
  } catch {
  }
  throw new Error(
    `No running process found for "${appNameOrBundleId}". Ensure the app is running and try again.`
  );
}
async function extractMacOSElements(options) {
  const extractorPath = await ensureExtractor();
  const args = [];
  if (options.pid) {
    args.push("--pid", String(options.pid));
  } else if (options.app) {
    args.push("--app", options.app);
  } else {
    throw new Error("Either pid or app must be provided");
  }
  try {
    const { stdout, stderr } = await execFileAsync4(extractorPath, args, {
      timeout: 3e4
    });
    if (stderr && stderr.includes("Error:")) {
      throw new Error(stderr.trim());
    }
    const lines = stdout.split("\n");
    const headerLine = lines[0];
    const jsonStr = lines.slice(1).join("\n");
    let window2 = { windowId: 0, width: 800, height: 600, title: "Unknown" };
    if (headerLine.startsWith("WINDOW:")) {
      const parts = headerLine.slice(7).split(":");
      const windowId = parseInt(parts[0], 10);
      const dims = (parts[1] || "800x600").split("x");
      const title = parts.slice(2).join(":");
      window2 = {
        windowId,
        width: parseInt(dims[0], 10) || 800,
        height: parseInt(dims[1], 10) || 600,
        title
      };
    }
    const elements = JSON.parse(jsonStr);
    return { elements, window: window2 };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("Accessibility permission")) {
      throw new Error(
        "Accessibility permission required. Grant Terminal/IDE access in System Settings > Privacy & Security > Accessibility"
      );
    }
    if (message.includes("No running app")) {
      throw err;
    }
    throw new Error(`macOS element extraction failed: ${message}`);
  }
}
function mapMacOSToEnhancedElements(nativeElements, parentPath = "") {
  const enhanced = [];
  function flatten(elements, path, depth) {
    const roleCounts = {};
    for (const el of elements) {
      const roleCount = roleCounts[el.role] || 0;
      roleCounts[el.role] = roleCount + 1;
      const currentPath = path ? `${path} > ${el.role}[${roleCount}]` : `${el.role}[${roleCount}]`;
      const tagName = mapRoleToTag2(el.role);
      const isInteractive = isInteractiveRole2(el.role) && el.enabled;
      const hasPress = el.actions.includes("AXPress");
      const text = el.title || el.description || el.value || void 0;
      const bounds = {
        x: el.position?.x ?? 0,
        y: el.position?.y ?? 0,
        width: el.size?.width ?? 0,
        height: el.size?.height ?? 0
      };
      if (bounds.width > 0 || bounds.height > 0 || text || isInteractive || depth <= 1) {
        enhanced.push({
          selector: el.identifier || currentPath,
          tagName,
          id: el.identifier || void 0,
          text: text ? text.slice(0, 100) : void 0,
          bounds,
          interactive: {
            hasOnClick: hasPress || isInteractive,
            hasHref: el.role === "AXLink",
            isDisabled: !el.enabled,
            tabIndex: el.focused || isInteractive ? 0 : -1,
            cursor: isInteractive ? "pointer" : "default"
          },
          a11y: {
            role: mapRoleToAriaRole2(el.role),
            ariaLabel: el.title || el.description || null,
            ariaDescribedBy: null
          },
          sourceHint: el.identifier ? { dataTestId: el.identifier } : void 0
        });
      }
      if (el.children.length > 0) {
        flatten(el.children, currentPath, depth + 1);
      }
    }
  }
  flatten(nativeElements, parentPath, 0);
  return enhanced;
}
async function captureMacOSScreenshot(windowId, outputPath) {
  await (0, import_promises9.mkdir)((0, import_path9.dirname)(outputPath), { recursive: true });
  await execFileAsync4("screencapture", ["-l", String(windowId), "-x", outputPath], {
    timeout: 1e4
  });
}
function mapRoleToTag2(role) {
  const roleMap = {
    "AXButton": "button",
    "AXLink": "a",
    "AXTextField": "input",
    "AXTextArea": "textarea",
    "AXSecureTextField": "input",
    "AXStaticText": "span",
    "AXImage": "img",
    "AXGroup": "div",
    "AXSplitGroup": "div",
    "AXList": "ul",
    "AXCell": "li",
    "AXTable": "table",
    "AXScrollArea": "div",
    "AXToolbar": "nav",
    "AXMenuBar": "nav",
    "AXMenu": "nav",
    "AXMenuItem": "li",
    "AXCheckBox": "input",
    "AXRadioButton": "input",
    "AXSlider": "input",
    "AXSwitch": "input",
    "AXPopUpButton": "select",
    "AXComboBox": "select",
    "AXTabGroup": "div",
    "AXTab": "button",
    "AXNavigationBar": "nav",
    "AXHeader": "header",
    "AXWindow": "main"
  };
  return roleMap[role] || role.replace(/^AX/, "").toLowerCase();
}
function mapRoleToAriaRole2(role) {
  const roleMap = {
    "AXButton": "button",
    "AXLink": "link",
    "AXTextField": "textbox",
    "AXTextArea": "textbox",
    "AXSecureTextField": "textbox",
    "AXStaticText": "text",
    "AXImage": "img",
    "AXGroup": "group",
    "AXList": "list",
    "AXCell": "listitem",
    "AXTable": "table",
    "AXCheckBox": "checkbox",
    "AXRadioButton": "radio",
    "AXSlider": "slider",
    "AXSwitch": "switch",
    "AXTab": "tab",
    "AXTabGroup": "tablist",
    "AXNavigationBar": "navigation",
    "AXToolbar": "toolbar",
    "AXMenuItem": "menuitem",
    "AXMenu": "menu",
    "AXScrollArea": "scrollbar",
    "AXWindow": "main"
  };
  return roleMap[role] || null;
}
function isInteractiveRole2(role) {
  const interactiveRoles = /* @__PURE__ */ new Set([
    "AXButton",
    "AXLink",
    "AXTextField",
    "AXTextArea",
    "AXSecureTextField",
    "AXCheckBox",
    "AXRadioButton",
    "AXSlider",
    "AXSwitch",
    "AXPopUpButton",
    "AXComboBox",
    "AXMenuItem",
    "AXTab"
  ]);
  return interactiveRoles.has(role);
}

// src/native/interactivity.ts
function buildNativeInteractivity(elements) {
  const buttons = [];
  const links = [];
  const forms = [];
  const issues = [];
  for (const el of elements) {
    const isButton = el.tagName === "button" || el.a11y.role === "button";
    const isLink = el.tagName === "a" || el.a11y.role === "link";
    if (isButton) {
      const btn = {
        selector: el.selector,
        tagName: el.tagName,
        text: el.text,
        hasHandler: el.interactive.hasOnClick,
        isDisabled: el.interactive.isDisabled,
        isVisible: el.bounds.width > 0 && el.bounds.height > 0,
        a11y: {
          role: el.a11y.role || void 0,
          ariaLabel: el.a11y.ariaLabel || void 0,
          tabIndex: el.interactive.tabIndex
        },
        buttonType: "button"
      };
      buttons.push(btn);
      if (!btn.hasHandler && !btn.isDisabled) {
        issues.push({
          type: "NO_HANDLER",
          element: el.selector,
          severity: "warning",
          description: `Button "${el.text || el.selector}" has no press action`
        });
      }
      if (!el.text && !el.a11y.ariaLabel) {
        issues.push({
          type: "MISSING_LABEL",
          element: el.selector,
          severity: "error",
          description: `Button has no accessible label (no text or accessibility label)`
        });
      }
    }
    if (isLink) {
      const link = {
        selector: el.selector,
        tagName: el.tagName,
        text: el.text,
        hasHandler: el.interactive.hasOnClick || el.interactive.hasHref,
        isDisabled: el.interactive.isDisabled,
        isVisible: el.bounds.width > 0 && el.bounds.height > 0,
        a11y: {
          role: el.a11y.role || void 0,
          ariaLabel: el.a11y.ariaLabel || void 0,
          tabIndex: el.interactive.tabIndex
        },
        href: "",
        // Native links don't have traditional hrefs
        isPlaceholder: false,
        opensNewTab: false,
        isExternal: false
      };
      links.push(link);
      if (!el.text && !el.a11y.ariaLabel) {
        issues.push({
          type: "MISSING_LABEL",
          element: el.selector,
          severity: "error",
          description: `Link has no accessible label (no text or accessibility label)`
        });
      }
    }
  }
  const inputs = elements.filter(
    (e) => ["input", "textarea", "select"].includes(e.tagName) || e.a11y.role === "textbox"
  );
  if (inputs.length > 0) {
    const submitButton = buttons.find(
      (b) => b.text?.toLowerCase().includes("submit") || b.text?.toLowerCase().includes("save") || b.text?.toLowerCase().includes("login") || b.text?.toLowerCase().includes("sign") || b.text?.toLowerCase().includes("unlock") || b.text?.toLowerCase().includes("confirm")
    );
    if (inputs.length >= 1) {
      forms.push({
        selector: "native-form",
        hasSubmitHandler: !!submitButton,
        fields: inputs.map((inp) => ({
          selector: inp.selector,
          name: inp.id || void 0,
          type: inp.a11y.role === "textbox" ? "text" : inp.tagName,
          label: inp.a11y.ariaLabel || inp.text || void 0,
          required: false,
          hasValidation: false
        })),
        hasValidation: false,
        submitButton
      });
    }
  }
  const allInteractive = [...buttons, ...links];
  const withHandlers = allInteractive.filter((e) => e.hasHandler).length;
  return {
    buttons,
    links,
    forms,
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

// src/native/semantic.ts
function buildNativeSemantic(elements, window2) {
  const intent = classifyNativeIntent(elements, window2.title);
  const issues = [];
  const hasPasswordField = elements.some(
    (e) => e.a11y.role === "textbox" && (e.text?.toLowerCase().includes("password") || e.a11y.ariaLabel?.toLowerCase().includes("password") || e.selector.toLowerCase().includes("secure"))
  );
  const hasLockIcon = elements.some(
    (e) => e.text?.toLowerCase().includes("lock") || e.a11y.ariaLabel?.toLowerCase().includes("lock")
  );
  const hasUnlockButton = elements.some(
    (e) => (e.tagName === "button" || e.a11y.role === "button") && (e.text?.toLowerCase().includes("unlock") || e.text?.toLowerCase().includes("sign in") || e.text?.toLowerCase().includes("log in"))
  );
  const isAuthScreen = hasPasswordField || hasLockIcon && hasUnlockButton;
  const errorElements = elements.filter(
    (e) => e.text?.toLowerCase().includes("error") || e.text?.toLowerCase().includes("failed") || e.a11y.ariaLabel?.toLowerCase().includes("error")
  );
  const hasErrors = errorElements.length > 0;
  if (hasErrors) {
    for (const el of errorElements.slice(0, 3)) {
      issues.push({
        severity: "major",
        type: "error-indicator",
        problem: `Error detected: "${el.text || el.a11y.ariaLabel}"`,
        fix: "Investigate the error state in the native app"
      });
    }
  }
  const verdict = hasErrors ? "FAIL" : "PASS";
  const availableActions = elements.filter((e) => e.interactive.hasOnClick && !e.interactive.isDisabled && e.text).slice(0, 10).map((e) => ({
    action: e.text.toLowerCase().replace(/\s+/g, "-"),
    selector: e.selector,
    description: e.text
  }));
  const interactive = elements.filter((e) => e.interactive.hasOnClick).length;
  const authSignals = [];
  if (hasPasswordField) authSignals.push("password-field");
  if (hasLockIcon) authSignals.push("lock-icon");
  if (hasUnlockButton) authSignals.push("unlock-button");
  const summaryParts = [
    `${intent.intent} window`,
    `${elements.length} elements (${interactive} interactive)`,
    isAuthScreen ? "auth required" : "ready"
  ];
  return {
    verdict,
    confidence: intent.confidence,
    pageIntent: intent,
    state: {
      auth: {
        authenticated: isAuthScreen ? false : null,
        confidence: isAuthScreen ? 0.8 : 0.3,
        signals: authSignals
      },
      loading: {
        loading: false,
        type: "none",
        elements: 0
      },
      errors: {
        hasErrors,
        errors: errorElements.map((e) => ({
          type: "unknown",
          message: e.text || "Error"
        })),
        severity: hasErrors ? "error" : "none"
      },
      ready: !hasErrors
    },
    availableActions,
    issues,
    summary: summaryParts.join(", "),
    url: `macos://${window2.title}`,
    title: window2.title,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function classifyNativeIntent(elements, windowTitle) {
  const titleLower = windowTitle.toLowerCase();
  const hasPasswordInput = elements.some(
    (e) => e.selector.toLowerCase().includes("secure") || e.text?.toLowerCase().includes("password")
  );
  const hasLoginButton = elements.some(
    (e) => e.tagName === "button" && (e.text?.toLowerCase().includes("login") || e.text?.toLowerCase().includes("sign in") || e.text?.toLowerCase().includes("unlock"))
  );
  if (hasPasswordInput || hasLoginButton) {
    return { intent: "auth", confidence: 0.9, signals: ["password-field", "login-button"] };
  }
  if (titleLower.includes("settings") || titleLower.includes("preferences")) {
    return { intent: "form", confidence: 0.85, signals: ["title-settings"] };
  }
  const listElements = elements.filter(
    (e) => e.a11y.role === "list" || e.a11y.role === "listitem" || e.tagName === "ul" || e.tagName === "li"
  );
  if (listElements.length > 3) {
    return { intent: "listing", confidence: 0.75, signals: ["list-elements"] };
  }
  const inputElements = elements.filter(
    (e) => e.tagName === "input" || e.tagName === "textarea" || e.a11y.role === "textbox"
  );
  if (inputElements.length >= 2) {
    return { intent: "form", confidence: 0.7, signals: ["multiple-inputs"] };
  }
  const interactive = elements.filter((e) => e.interactive.hasOnClick).length;
  if (interactive > 5) {
    return { intent: "dashboard", confidence: 0.6, signals: ["many-interactive"] };
  }
  return { intent: "detail", confidence: 0.5, signals: ["default"] };
}

// src/native/scan.ts
async function scanNative(options = {}) {
  const { device: deviceQuery, screenshot = true, outputDir = ".ibr" } = options;
  let device;
  if (deviceQuery) {
    device = await findDevice(deviceQuery);
    if (!device) {
      throw new Error(
        `No simulator found matching "${deviceQuery}". Run \`xcrun simctl list devices available\` to see available simulators.`
      );
    }
  } else {
    const booted = await getBootedDevices();
    if (booted.length === 0) {
      throw new Error(
        "No booted simulators found. Boot one with: xcrun simctl boot <device-name>"
      );
    }
    device = booted[0];
  }
  if (device.state !== "Booted") {
    await bootDevice(device.udid);
    const refreshed = await findDevice(device.udid);
    if (refreshed) device = refreshed;
  }
  const viewport = getDeviceViewport(device);
  const url = `simulator://${device.name}/${options.bundleId || "current"}`;
  let screenshotPath;
  if (screenshot) {
    const timestamp = Date.now();
    const ssPath = (0, import_path10.join)(outputDir, "native", `${device.udid.slice(0, 8)}-${timestamp}.png`);
    const captureResult = await captureNativeScreenshot({
      device,
      outputPath: ssPath
    });
    if (captureResult.success) {
      screenshotPath = captureResult.outputPath;
    }
  }
  let elements = [];
  let audit = {
    totalElements: 0,
    interactiveCount: 0,
    withHandlers: 0,
    withoutHandlers: 0,
    issues: []
  };
  let extractionSucceeded = false;
  if (isExtractorAvailable()) {
    try {
      const nativeElements = await extractNativeElements(device);
      elements = mapToEnhancedElements(nativeElements);
      audit = analyzeElements(elements, true);
      extractionSucceeded = true;
    } catch {
    }
  }
  const nativeIssues = extractionSucceeded ? auditNativeElements(elements, device.platform, viewport) : [];
  const issues = [];
  for (const issue of audit.issues) {
    issues.push({
      category: issue.type === "MISSING_ARIA_LABEL" ? "accessibility" : "interactivity",
      severity: issue.severity,
      description: issue.message
    });
  }
  for (const issue of nativeIssues) {
    issues.push({
      category: issue.type === "MISSING_ARIA_LABEL" ? "accessibility" : "structure",
      severity: issue.severity,
      description: issue.message
    });
  }
  const verdict = determineVerdict2(issues);
  const summary = generateNativeSummary(device, elements, issues, extractionSucceeded);
  return {
    url,
    route: `/${device.name}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    viewport,
    platform: device.platform,
    device: {
      name: device.name,
      udid: device.udid,
      runtime: device.runtime
    },
    elements: { all: elements, audit },
    nativeIssues,
    screenshotPath,
    verdict,
    issues,
    summary
  };
}
function generateNativeSummary(device, elements, issues, extractionSucceeded) {
  const parts = [];
  parts.push(`${device.platform} simulator (${device.name})`);
  if (extractionSucceeded) {
    const interactive = elements.filter((e) => e.interactive.hasOnClick).length;
    parts.push(`${elements.length} elements (${interactive} interactive)`);
  } else {
    parts.push("screenshot-only mode (element extraction unavailable)");
  }
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  if (errorCount > 0 || warningCount > 0) {
    const issueParts = [];
    if (errorCount > 0) issueParts.push(`${errorCount} errors`);
    if (warningCount > 0) issueParts.push(`${warningCount} warnings`);
    parts.push(issueParts.join(", "));
  }
  return parts.join(", ");
}
async function scanMacOS(options) {
  if (process.platform !== "darwin") {
    throw new Error("macOS native scanning is only available on macOS");
  }
  const { app, bundleId, pid: directPid, screenshot } = options;
  if (!app && !bundleId && !directPid) {
    throw new Error("Provide --app, --bundle-id, or --pid to identify the target app");
  }
  let pid;
  if (directPid) {
    pid = directPid;
  } else {
    pid = await findProcess(app || bundleId);
  }
  const { elements: nativeElements, window: window2 } = await extractMacOSElements({
    pid,
    app: app || bundleId
  });
  const elements = mapMacOSToEnhancedElements(nativeElements);
  const audit = analyzeElements(elements, false);
  const interactivity = buildNativeInteractivity(elements);
  const semantic = buildNativeSemantic(elements, window2);
  if (screenshot && window2.windowId > 0) {
    await captureMacOSScreenshot(window2.windowId, screenshot.path);
  }
  const url = `macos://${app || bundleId || `pid-${pid}`}/${window2.title}`;
  const route = `/${window2.title}`;
  const issues = aggregateIssues(audit, interactivity, semantic, []);
  const verdict = determineVerdict2(issues);
  const summary = generateSummary2(
    { all: elements, audit },
    interactivity,
    semantic,
    issues,
    []
  );
  const viewport = {
    name: "native",
    width: window2.width,
    height: window2.height
  };
  return {
    url,
    route,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    viewport,
    elements: { all: elements, audit },
    interactivity,
    semantic,
    console: { errors: [], warnings: [] },
    verdict,
    issues,
    summary
  };
}

// src/index.ts
async function compare(options) {
  const {
    url,
    baselinePath,
    currentPath,
    threshold = 1,
    outputDir = (0, import_path11.join)((0, import_os2.tmpdir)(), "ibr-compare"),
    viewport = "desktop",
    fullPage = true,
    waitForNetworkIdle = true,
    timeout = 3e4
  } = options;
  if (!baselinePath && !url) {
    throw new Error("Either baselinePath or url must be provided");
  }
  const resolvedViewport = typeof viewport === "string" ? VIEWPORTS[viewport] || VIEWPORTS.desktop : viewport;
  await (0, import_promises10.mkdir)(outputDir, { recursive: true });
  const timestamp = Date.now();
  const actualBaselinePath = baselinePath || (0, import_path11.join)(outputDir, `baseline-${timestamp}.png`);
  let actualCurrentPath = currentPath || (0, import_path11.join)(outputDir, `current-${timestamp}.png`);
  const diffPath = (0, import_path11.join)(outputDir, `diff-${timestamp}.png`);
  if (url && !baselinePath) {
    await captureScreenshot({
      url,
      outputPath: actualBaselinePath,
      viewport: resolvedViewport,
      fullPage,
      waitForNetworkIdle,
      timeout
    });
  }
  if (url && !currentPath) {
    await captureScreenshot({
      url,
      outputPath: actualCurrentPath,
      viewport: resolvedViewport,
      fullPage,
      waitForNetworkIdle,
      timeout
    });
  }
  try {
    await (0, import_promises10.access)(actualBaselinePath);
  } catch {
    throw new Error(`Baseline image not found: ${actualBaselinePath}`);
  }
  try {
    await (0, import_promises10.access)(actualCurrentPath);
  } catch {
    throw new Error(`Current image not found: ${actualCurrentPath}`);
  }
  const comparison = await compareImages({
    baselinePath: actualBaselinePath,
    currentPath: actualCurrentPath,
    diffPath,
    threshold: threshold / 100
    // Convert percentage to 0-1 for pixelmatch
  });
  const analysis = analyzeComparison(comparison, threshold);
  await closeBrowser();
  return {
    match: comparison.match,
    diffPercent: comparison.diffPercent,
    diffPixels: comparison.diffPixels,
    totalPixels: comparison.totalPixels,
    verdict: analysis.verdict,
    summary: analysis.summary,
    changedRegions: analysis.changedRegions.map((r) => ({
      location: r.location,
      description: r.description,
      severity: r.severity
    })),
    recommendation: analysis.recommendation,
    diffPath: comparison.match ? void 0 : diffPath,
    baselinePath: actualBaselinePath,
    currentPath: actualCurrentPath
  };
}
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
    const browser2 = await import_playwright8.chromium.launch({ headless: true });
    const context = await browser2.newContext({
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
    return new IBRSession(page, browser2, context, this.config);
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
var IBRSession = class {
  /** Raw Playwright page for advanced use */
  page;
  browser;
  context;
  config;
  constructor(page, browser2, context, config) {
    this.page = page;
    this.browser = browser2;
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
  async screenshot(path) {
    return this.page.screenshot({
      path,
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

// src/mcp/tools.ts
init_session();
function textResponse(text) {
  return { content: [{ type: "text", text }] };
}
function errorResponse(text) {
  return { content: [{ type: "text", text }], isError: true };
}
var TOOLS = [
  {
    name: "scan",
    description: "Comprehensive UI scan \u2014 extracts all interactive elements with computed CSS, handler wiring, accessibility data, page intent classification, and console errors. Use after building or modifying UI to validate implementation matches user intent.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL to scan (e.g. http://localhost:3000/page)"
        },
        viewport: {
          type: "string",
          enum: ["desktop", "mobile", "tablet"],
          description: "Viewport preset (default: 'desktop')"
        }
      },
      required: ["url"]
    },
    annotations: {
      title: "UI Scan",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  {
    name: "snapshot",
    description: "Capture a visual baseline screenshot for regression testing. Use before making UI changes so you can compare afterwards with the 'compare' tool.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL to capture baseline from"
        },
        name: {
          type: "string",
          description: "Name for the baseline session (e.g. 'header-redesign')"
        },
        selector: {
          type: "string",
          description: "CSS selector to wait for before capturing (optional)"
        }
      },
      required: ["url"]
    },
    annotations: {
      title: "Capture Baseline",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  {
    name: "compare",
    description: "Compare current UI state against a baseline. Returns a verdict (MATCH, EXPECTED_CHANGE, UNEXPECTED_CHANGE, LAYOUT_BROKEN) with changed regions and recommendations. Use after making UI changes to check for visual regressions.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: {
          type: "string",
          description: "Session ID to compare against (default: most recent session)"
        }
      }
    },
    annotations: {
      title: "Compare Against Baseline",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  {
    name: "list_sessions",
    description: "List all IBR sessions with timestamps, URLs, viewports, and comparison status. Shows baseline sessions available for regression comparison.",
    inputSchema: {
      type: "object",
      properties: {}
    },
    annotations: {
      title: "List Sessions",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  // --- Native iOS/watchOS tools ---
  {
    name: "native_scan",
    description: "Scan a running iOS or watchOS simulator \u2014 extracts accessibility elements, validates touch targets, checks watchOS constraints, and audits accessibility labels. Use after building or modifying Swift UI to validate implementation.",
    inputSchema: {
      type: "object",
      properties: {
        device: {
          type: "string",
          description: "Device name fragment or UDID (e.g. 'Apple Watch', 'iPhone 16'). Uses first booted device if omitted."
        },
        screenshot: {
          type: "boolean",
          description: "Capture a screenshot (default: true)"
        }
      }
    },
    annotations: {
      title: "Native Simulator Scan",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: "native_snapshot",
    description: "Capture a baseline screenshot from a running iOS or watchOS simulator for regression testing. Use before making native UI changes.",
    inputSchema: {
      type: "object",
      properties: {
        device: {
          type: "string",
          description: "Device name fragment or UDID. Uses first booted device if omitted."
        },
        name: {
          type: "string",
          description: "Name for the baseline session (e.g. 'watch-timer-screen')"
        }
      }
    },
    annotations: {
      title: "Native Baseline Capture",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false
    }
  },
  {
    name: "native_compare",
    description: "Compare current simulator state against a native baseline. Returns a verdict (MATCH, EXPECTED_CHANGE, UNEXPECTED_CHANGE, LAYOUT_BROKEN). Use after making native UI changes to check for visual regressions.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: {
          type: "string",
          description: "Session ID to compare against (default: most recent native session)"
        },
        device: {
          type: "string",
          description: "Device name fragment or UDID. Uses first booted device if omitted."
        }
      }
    },
    annotations: {
      title: "Native Compare Against Baseline",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  // --- macOS native app scanning ---
  {
    name: "scan_macos",
    description: "Scan a running macOS native app via the Accessibility API \u2014 extracts all UI elements, validates touch targets, checks accessibility labels, classifies page intent, and produces a verdict. Use after building or modifying a native macOS app (SwiftUI/AppKit) to validate the UI.",
    inputSchema: {
      type: "object",
      properties: {
        app: {
          type: "string",
          description: "App name to scan (e.g. 'Secrets Vault', 'Calculator'). Case-insensitive substring match."
        },
        bundle_id: {
          type: "string",
          description: "Bundle identifier (e.g. 'com.secretsvault.app'). Alternative to app name."
        },
        pid: {
          type: "number",
          description: "Direct process ID. Alternative to app/bundle_id."
        },
        screenshot: {
          type: "string",
          description: "Path to save a screenshot of the app window (optional)."
        }
      }
    },
    annotations: {
      title: "macOS Native App Scan",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: "native_devices",
    description: "List available iOS and watchOS simulator devices with their boot status, runtime versions, and UDIDs.",
    inputSchema: {
      type: "object",
      properties: {
        platform: {
          type: "string",
          enum: ["ios", "watchos"],
          description: "Filter by platform (optional)"
        }
      }
    },
    annotations: {
      title: "List Simulator Devices",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  }
];
var DEFAULT_OUTPUT_DIR = ".ibr";
async function handleToolCall(name, args) {
  try {
    switch (name) {
      case "scan":
        return await handleScan(args);
      case "snapshot":
        return await handleSnapshot(args);
      case "compare":
        return await handleCompare(args);
      case "list_sessions":
        return await handleListSessions();
      case "scan_macos":
        return await handleScanMacOS(args);
      case "native_scan":
        return await handleNativeScan(args);
      case "native_snapshot":
        return await handleNativeSnapshot(args);
      case "native_compare":
        return await handleNativeCompare(args);
      case "native_devices":
        return await handleNativeDevices(args);
      default:
        return errorResponse(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Tool execution failed"
    );
  }
}
async function handleScan(args) {
  const url = args.url;
  if (!url) {
    return errorResponse("The 'url' parameter is required.");
  }
  const viewport = args.viewport || "desktop";
  const result = await scan(url, {
    viewport
  });
  const lines = [
    `UI Scan: ${result.url}`,
    `Viewport: ${result.viewport.name} (${result.viewport.width}x${result.viewport.height})`,
    `Verdict: ${result.verdict}`,
    `${result.summary}`,
    "",
    `Page intent: ${result.semantic.pageIntent.intent} (${Math.round(result.semantic.confidence * 100)}% confidence)`,
    `Auth: ${result.semantic.state.auth.authenticated ? "Authenticated" : "Not authenticated"}`,
    `Loading: ${result.semantic.state.loading.loading ? result.semantic.state.loading.type : "Complete"}`
  ];
  if (result.console.errors.length > 0) {
    lines.push("");
    lines.push(`Console errors (${result.console.errors.length}):`);
    for (const e of result.console.errors.slice(0, 5)) {
      lines.push(`- ${e.slice(0, 200)}`);
    }
  }
  if (result.issues.length > 0) {
    lines.push("");
    lines.push(`Issues (${result.issues.length}):`);
    for (const issue of result.issues.slice(0, 10)) {
      lines.push(`- [${issue.severity}] ${issue.message}`);
    }
    if (result.issues.length > 10) {
      lines.push(`  ... and ${result.issues.length - 10} more`);
    }
  }
  const totalElements = result.elements.all.length;
  const interactive = result.elements.all.filter(
    (e) => e.interactive.hasOnClick || e.interactive.hasHref
  ).length;
  lines.push("");
  lines.push(`Elements: ${totalElements} total, ${interactive} interactive`);
  if (result.interactivity) {
    const { buttons, links, forms } = result.interactivity;
    lines.push(
      `Buttons: ${buttons?.length || 0}, Links: ${links?.length || 0}, Forms: ${forms?.length || 0}`
    );
  }
  if (result.elements.audit) {
    const audit = result.elements.audit;
    if (audit.issues && audit.issues.length > 0) {
      lines.push("");
      lines.push(`Audit issues (${audit.issues.length}):`);
      for (const a of audit.issues.slice(0, 5)) {
        lines.push(`- ${a.message || a}`);
      }
    }
  }
  return textResponse(lines.join("\n"));
}
async function handleSnapshot(args) {
  const url = args.url;
  if (!url) {
    return errorResponse("The 'url' parameter is required.");
  }
  const name = args.name || `baseline-${Date.now()}`;
  const ibr = new InterfaceBuiltRight({ outputDir: DEFAULT_OUTPUT_DIR });
  const result = await ibr.startSession(url, { name });
  return textResponse(
    [
      `Baseline captured: ${result.session.id}`,
      `Name: ${result.session.name}`,
      `URL: ${result.session.url}`,
      `Viewport: ${result.session.viewport.name} (${result.session.viewport.width}x${result.session.viewport.height})`,
      `Status: ${result.session.status}`,
      "",
      "Run the 'compare' tool after making changes to check for visual regressions."
    ].join("\n")
  );
}
async function handleCompare(args) {
  const ibr = new InterfaceBuiltRight({ outputDir: DEFAULT_OUTPUT_DIR });
  const sessionId = args.session_id;
  let session;
  if (sessionId) {
    session = await ibr.getSession(sessionId);
    if (!session) {
      return errorResponse(`Session "${sessionId}" not found.`);
    }
  } else {
    session = await ibr.getMostRecentSession();
    if (!session) {
      return errorResponse(
        "No sessions found. Capture a baseline first with the 'snapshot' tool."
      );
    }
  }
  const report = await ibr.check(session.id);
  const lines = [
    `Comparison: ${report.session.name} (${report.session.id})`,
    `URL: ${report.session.url}`,
    `Verdict: ${report.verdict}`,
    `Diff: ${report.diffPercent.toFixed(2)}% (${report.diffPixels} pixels)`,
    `${report.summary}`
  ];
  if (report.changedRegions && report.changedRegions.length > 0) {
    lines.push("");
    lines.push(`Changed regions (${report.changedRegions.length}):`);
    for (const r of report.changedRegions.slice(0, 5)) {
      lines.push(`- ${r.location}: ${r.description} [${r.severity}]`);
    }
  }
  if (report.recommendation) {
    lines.push("");
    lines.push(`Recommendation: ${report.recommendation}`);
  }
  return textResponse(lines.join("\n"));
}
async function handleListSessions() {
  const sessions = await listSessions(DEFAULT_OUTPUT_DIR);
  if (sessions.length === 0) {
    return textResponse(
      "No sessions found. Capture a baseline with the 'snapshot' tool."
    );
  }
  const lines = [`Sessions (${sessions.length}):`];
  for (const s of sessions.slice(0, 20)) {
    const date = new Date(s.createdAt).toISOString().replace("T", " ").slice(0, 19);
    const viewport = `${s.viewport.name} (${s.viewport.width}x${s.viewport.height})`;
    const verdict = s.analysis && s.analysis.verdict ? ` | ${s.analysis.verdict}` : "";
    lines.push(
      `- ${s.id} | ${s.name} | ${date} | ${viewport} | ${s.status}${verdict}`
    );
  }
  if (sessions.length > 20) {
    lines.push(`  ... and ${sessions.length - 20} more`);
  }
  const stats = await getSessionStats(DEFAULT_OUTPUT_DIR);
  lines.push("");
  lines.push(
    `Total: ${stats.total} | By status: ${Object.entries(stats.byStatus).map(([k, v]) => `${k}: ${v}`).join(", ")}`
  );
  return textResponse(lines.join("\n"));
}
async function handleScanMacOS(args) {
  if (process.platform !== "darwin") {
    return errorResponse("scan_macos is only available on macOS.");
  }
  const app = args.app;
  const bundleId = args.bundle_id;
  const pid = args.pid;
  const screenshot = args.screenshot;
  if (!app && !bundleId && !pid) {
    return errorResponse("Provide 'app', 'bundle_id', or 'pid' to identify the target app.");
  }
  const result = await scanMacOS({
    app,
    bundleId,
    pid,
    screenshot: screenshot ? { path: screenshot } : void 0
  });
  const lines = [
    `macOS App Scan: ${result.url}`,
    `Window: ${result.route.slice(1)}`,
    `Viewport: ${result.viewport.width}x${result.viewport.height}`,
    `Verdict: ${result.verdict}`,
    `${result.summary}`,
    "",
    `Page intent: ${result.semantic.pageIntent.intent} (${Math.round(result.semantic.confidence * 100)}% confidence)`,
    `Auth: ${result.semantic.state.auth.authenticated === false ? "Not authenticated" : result.semantic.state.auth.authenticated ? "Authenticated" : "Unknown"}`
  ];
  lines.push("");
  lines.push(`Elements: ${result.elements.audit.totalElements} total, ${result.elements.audit.interactiveCount} interactive`);
  lines.push(`With handlers: ${result.elements.audit.withHandlers}, Without: ${result.elements.audit.withoutHandlers}`);
  const { buttons, links, forms } = result.interactivity;
  lines.push(`Buttons: ${buttons.length}, Links: ${links.length}, Forms: ${forms.length}`);
  if (result.issues.length > 0) {
    lines.push("");
    lines.push(`Issues (${result.issues.length}):`);
    for (const issue of result.issues.slice(0, 10)) {
      lines.push(`- [${issue.severity}] ${issue.description}`);
      if (issue.fix) {
        lines.push(`  Fix: ${issue.fix}`);
      }
    }
    if (result.issues.length > 10) {
      lines.push(`  ... and ${result.issues.length - 10} more`);
    }
  }
  if (result.elements.audit.issues.length > 0) {
    lines.push("");
    lines.push(`Audit issues (${result.elements.audit.issues.length}):`);
    for (const a of result.elements.audit.issues.slice(0, 5)) {
      lines.push(`- ${a.message}`);
    }
  }
  return textResponse(lines.join("\n"));
}
async function handleNativeScan(args) {
  const device = args.device;
  const screenshot = args.screenshot !== false;
  const result = await scanNative({
    device,
    screenshot,
    outputDir: DEFAULT_OUTPUT_DIR
  });
  const lines = [
    `Native Scan: ${result.device.name}`,
    `Platform: ${result.platform}`,
    `Runtime: ${result.device.runtime.replace(/^.*SimRuntime\./, "").replace(/-/g, ".")}`,
    `Viewport: ${result.viewport.name} (${result.viewport.width}x${result.viewport.height})`,
    `Verdict: ${result.verdict}`,
    `${result.summary}`
  ];
  lines.push("");
  lines.push(`Elements: ${result.elements.audit.totalElements} total, ${result.elements.audit.interactiveCount} interactive`);
  lines.push(`With handlers: ${result.elements.audit.withHandlers}, Without: ${result.elements.audit.withoutHandlers}`);
  if (result.issues.length > 0) {
    lines.push("");
    lines.push(`Issues (${result.issues.length}):`);
    for (const issue of result.issues.slice(0, 10)) {
      lines.push(`- [${issue.severity}] ${issue.description}`);
    }
    if (result.issues.length > 10) {
      lines.push(`  ... and ${result.issues.length - 10} more`);
    }
  }
  if (result.screenshotPath) {
    lines.push("");
    lines.push(`Screenshot: ${result.screenshotPath}`);
  }
  return textResponse(lines.join("\n"));
}
async function handleNativeSnapshot(args) {
  const deviceQuery = args.device;
  const name = args.name || `native-baseline-${Date.now()}`;
  let device;
  if (deviceQuery) {
    device = await findDevice(deviceQuery);
    if (!device) {
      return errorResponse(`No simulator found matching "${deviceQuery}".`);
    }
  } else {
    const { getBootedDevices: getBootedDevices2 } = await Promise.resolve().then(() => (init_simulator(), simulator_exports));
    const booted = await getBootedDevices2();
    if (booted.length === 0) {
      return errorResponse("No booted simulators found. Boot one first.");
    }
    device = booted[0];
  }
  const viewport = getDeviceViewport(device);
  const session = await createSession(
    DEFAULT_OUTPUT_DIR,
    `simulator://${device.name}`,
    name,
    viewport,
    device.platform
  );
  const paths = getSessionPaths(DEFAULT_OUTPUT_DIR, session.id);
  const captureResult = await captureNativeScreenshot({
    device,
    outputPath: paths.baseline
  });
  if (!captureResult.success) {
    return errorResponse(`Screenshot capture failed: ${captureResult.error}`);
  }
  return textResponse(
    [
      `Native baseline captured: ${session.id}`,
      `Name: ${session.name}`,
      `Device: ${device.name} (${device.platform})`,
      `Viewport: ${viewport.name} (${viewport.width}x${viewport.height})`,
      `Status: ${session.status}`,
      "",
      "Run 'native_compare' after making changes to check for visual regressions."
    ].join("\n")
  );
}
async function handleNativeCompare(args) {
  const sessionId = args.session_id;
  const deviceQuery = args.device;
  let session;
  if (sessionId) {
    const { getSession: getSession2 } = await Promise.resolve().then(() => (init_session(), session_exports));
    session = await getSession2(DEFAULT_OUTPUT_DIR, sessionId);
    if (!session) {
      return errorResponse(`Session "${sessionId}" not found.`);
    }
  } else {
    const sessions = await listSessions(DEFAULT_OUTPUT_DIR);
    session = sessions.find((s) => s.platform === "ios" || s.platform === "watchos");
    if (!session) {
      return errorResponse(
        "No native sessions found. Capture a baseline first with 'native_snapshot'."
      );
    }
  }
  let device;
  if (deviceQuery) {
    device = await findDevice(deviceQuery);
  } else {
    const { getBootedDevices: getBootedDevices2 } = await Promise.resolve().then(() => (init_simulator(), simulator_exports));
    const booted = await getBootedDevices2();
    device = booted[0];
  }
  if (!device) {
    return errorResponse("No booted simulator found for comparison.");
  }
  const paths = getSessionPaths(DEFAULT_OUTPUT_DIR, session.id);
  const captureResult = await captureNativeScreenshot({
    device,
    outputPath: paths.current
  });
  if (!captureResult.success) {
    return errorResponse(`Screenshot capture failed: ${captureResult.error}`);
  }
  const result = await compare({
    baselinePath: paths.baseline,
    currentPath: paths.current
  });
  const lines = [
    `Native Comparison: ${session.name} (${session.id})`,
    `Device: ${device.name}`,
    `Verdict: ${result.verdict}`,
    `Diff: ${result.diffPercent.toFixed(2)}% (${result.diffPixels} pixels)`,
    `${result.summary}`
  ];
  if (result.changedRegions.length > 0) {
    lines.push("");
    lines.push(`Changed regions (${result.changedRegions.length}):`);
    for (const r of result.changedRegions.slice(0, 5)) {
      lines.push(`- ${r.location}: ${r.description} [${r.severity}]`);
    }
  }
  if (result.recommendation) {
    lines.push("");
    lines.push(`Recommendation: ${result.recommendation}`);
  }
  return textResponse(lines.join("\n"));
}
async function handleNativeDevices(args) {
  const platformFilter = args.platform;
  let devices = await listDevices();
  devices = devices.filter((d) => d.isAvailable);
  if (platformFilter) {
    devices = devices.filter((d) => d.platform === platformFilter);
  }
  if (devices.length === 0) {
    return textResponse(
      platformFilter ? `No available ${platformFilter} simulators found.` : "No available simulators found. Install simulators via Xcode."
    );
  }
  const ios = devices.filter((d) => d.platform === "ios");
  const watchos = devices.filter((d) => d.platform === "watchos");
  const lines = [];
  if (ios.length > 0 && (!platformFilter || platformFilter === "ios")) {
    lines.push(`iOS Simulators (${ios.length}):`);
    for (const d of ios) {
      lines.push(`  ${formatDevice(d)}`);
    }
  }
  if (watchos.length > 0 && (!platformFilter || platformFilter === "watchos")) {
    if (lines.length > 0) lines.push("");
    lines.push(`watchOS Simulators (${watchos.length}):`);
    for (const d of watchos) {
      lines.push(`  ${formatDevice(d)}`);
    }
  }
  const booted = devices.filter((d) => d.state === "Booted");
  lines.push("");
  lines.push(`Total: ${devices.length} available, ${booted.length} booted`);
  return textResponse(lines.join("\n"));
}

// src/mcp/server.ts
var rl = (0, import_readline.createInterface)({ input: process.stdin, terminal: false });
var buffer = "";
rl.on("line", (line) => {
  buffer += line;
  try {
    const msg = JSON.parse(buffer);
    buffer = "";
    handleMessage(msg);
  } catch {
  }
});
function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}
function sendResult(id, result) {
  send({ jsonrpc: "2.0", id, result });
}
function sendError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}
var SERVER_INFO = {
  name: "ibr",
  version: "0.4.9"
};
var CAPABILITIES = {
  tools: {}
};
async function handleMessage(msg) {
  if (msg.jsonrpc !== "2.0") return;
  const { id, method, params } = msg;
  try {
    switch (method) {
      case "initialize": {
        sendResult(id, {
          protocolVersion: "2025-11-25",
          serverInfo: SERVER_INFO,
          capabilities: CAPABILITIES
        });
        break;
      }
      case "notifications/initialized": {
        break;
      }
      case "tools/list": {
        sendResult(id, { tools: TOOLS });
        break;
      }
      case "tools/call": {
        const { name, arguments: args } = params;
        const result = await handleToolCall(name, args || {});
        sendResult(id, result);
        break;
      }
      default: {
        if (id !== void 0) {
          sendError(id, -32601, `Method not found: ${method}`);
        }
      }
    }
  } catch (err) {
    if (id !== void 0) {
      sendError(
        id,
        -32e3,
        err instanceof Error ? err.message : "Internal error"
      );
    }
  }
}
process.stderr.write("IBR MCP server started\n");
//# sourceMappingURL=server.js.map