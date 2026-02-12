'use strict';

var zod = require('zod');
var playwright = require('playwright');
var fs = require('fs/promises');
var path = require('path');
var os = require('os');
var crypto = require('crypto');
var pixelmatch = require('pixelmatch');
var pngjs = require('pngjs');
var nanoid = require('nanoid');
var url = require('url');
var fs$1 = require('fs');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var fs__namespace = /*#__PURE__*/_interopNamespace(fs);
var path__namespace = /*#__PURE__*/_interopNamespace(path);
var pixelmatch__default = /*#__PURE__*/_interopDefault(pixelmatch);

var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/performance.ts
var performance_exports = {};
__export(performance_exports, {
  PERFORMANCE_THRESHOLDS: () => exports.PERFORMANCE_THRESHOLDS,
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
    LCP: { value: metrics.LCP, rating: rateMetric(metrics.LCP, exports.PERFORMANCE_THRESHOLDS.LCP) },
    FID: { value: metrics.FID, rating: rateMetric(metrics.FID, exports.PERFORMANCE_THRESHOLDS.FID) },
    CLS: { value: metrics.CLS, rating: rateMetric(metrics.CLS, exports.PERFORMANCE_THRESHOLDS.CLS) },
    TTFB: { value: metrics.TTFB, rating: rateMetric(metrics.TTFB, exports.PERFORMANCE_THRESHOLDS.TTFB) },
    FCP: { value: metrics.FCP, rating: rateMetric(metrics.FCP, exports.PERFORMANCE_THRESHOLDS.FCP) },
    TTI: { value: metrics.TTI, rating: rateMetric(metrics.TTI, exports.PERFORMANCE_THRESHOLDS.TTI) }
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
exports.PERFORMANCE_THRESHOLDS = void 0;
var init_performance = __esm({
  "src/performance.ts"() {
    exports.PERFORMANCE_THRESHOLDS = {
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
    if (btn.isDisabled && btn.isVisible) ;
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
  }
});
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
var BoundsSchema = zod.z.object({
  x: zod.z.number(),
  y: zod.z.number(),
  width: zod.z.number(),
  height: zod.z.number()
});
var LandmarkElementSchema = zod.z.object({
  name: zod.z.string(),
  // e.g., 'logo', 'header', 'nav'
  selector: zod.z.string(),
  // CSS selector used to find it
  found: zod.z.boolean(),
  bounds: BoundsSchema.optional()
});
var SessionSchema = zod.z.object({
  id: zod.z.string(),
  name: zod.z.string(),
  url: zod.z.string().url(),
  viewport: ViewportSchema,
  status: SessionStatusSchema,
  createdAt: zod.z.string().datetime(),
  updatedAt: zod.z.string().datetime(),
  comparison: ComparisonResultSchema.optional(),
  analysis: AnalysisSchema.optional(),
  // Landmark elements detected at baseline capture
  landmarkElements: zod.z.array(LandmarkElementSchema).optional(),
  // Page intent detected at baseline
  pageIntent: zod.z.string().optional()
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
var InteractiveStateSchema = zod.z.object({
  hasOnClick: zod.z.boolean(),
  hasHref: zod.z.boolean(),
  isDisabled: zod.z.boolean(),
  tabIndex: zod.z.number(),
  cursor: zod.z.string(),
  // Framework-specific detection
  hasReactHandler: zod.z.boolean().optional(),
  hasVueHandler: zod.z.boolean().optional(),
  hasAngularHandler: zod.z.boolean().optional()
});
var A11yAttributesSchema = zod.z.object({
  role: zod.z.string().nullable(),
  ariaLabel: zod.z.string().nullable(),
  ariaDescribedBy: zod.z.string().nullable(),
  ariaHidden: zod.z.boolean().optional()
});
var EnhancedElementSchema = zod.z.object({
  // Identity
  selector: zod.z.string(),
  tagName: zod.z.string(),
  id: zod.z.string().optional(),
  className: zod.z.string().optional(),
  text: zod.z.string().optional(),
  // Position
  bounds: BoundsSchema,
  // Styles (subset)
  computedStyles: zod.z.record(zod.z.string(), zod.z.string()).optional(),
  // Interactivity
  interactive: InteractiveStateSchema,
  // Accessibility
  a11y: A11yAttributesSchema,
  // Source hints for debugging
  sourceHint: zod.z.object({
    dataTestId: zod.z.string().nullable()
  }).optional()
});
var ElementIssueSchema = zod.z.object({
  type: zod.z.enum([
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
  severity: zod.z.enum(["error", "warning", "info"]),
  message: zod.z.string()
});
var AuditResultSchema = zod.z.object({
  totalElements: zod.z.number(),
  interactiveCount: zod.z.number(),
  withHandlers: zod.z.number(),
  withoutHandlers: zod.z.number(),
  issues: zod.z.array(ElementIssueSchema)
});
var RuleSeveritySchema = zod.z.enum(["off", "warn", "error"]);
var RuleSettingSchema = zod.z.union([
  RuleSeveritySchema,
  zod.z.tuple([RuleSeveritySchema, zod.z.record(zod.z.string(), zod.z.unknown())])
]);
var RulesConfigSchema = zod.z.object({
  extends: zod.z.array(zod.z.string()).optional(),
  rules: zod.z.record(zod.z.string(), RuleSettingSchema).optional()
});
var ViolationSchema = zod.z.object({
  ruleId: zod.z.string(),
  ruleName: zod.z.string(),
  severity: zod.z.enum(["warn", "error"]),
  message: zod.z.string(),
  element: zod.z.string().optional(),
  // Selector of violating element
  bounds: BoundsSchema.optional(),
  fix: zod.z.string().optional()
  // Suggested fix
});
var RuleAuditResultSchema = zod.z.object({
  url: zod.z.string(),
  timestamp: zod.z.string(),
  elementsScanned: zod.z.number(),
  violations: zod.z.array(ViolationSchema),
  summary: zod.z.object({
    errors: zod.z.number(),
    warnings: zod.z.number(),
    passed: zod.z.number()
  })
});
var MemorySourceSchema = zod.z.enum(["user", "learned", "framework"]);
var PreferenceCategorySchema = zod.z.enum([
  "color",
  "layout",
  "typography",
  "navigation",
  "component",
  "spacing",
  "interaction",
  "content"
]);
var ExpectationOperatorSchema = zod.z.enum(["equals", "contains", "matches", "gte", "lte"]);
var ExpectationSchema = zod.z.object({
  property: zod.z.string(),
  operator: ExpectationOperatorSchema,
  value: zod.z.string()
});
var PreferenceSchema = zod.z.object({
  id: zod.z.string(),
  description: zod.z.string(),
  category: PreferenceCategorySchema,
  source: MemorySourceSchema,
  route: zod.z.string().optional(),
  componentType: zod.z.string().optional(),
  expectation: ExpectationSchema,
  confidence: zod.z.number().min(0).max(1).default(1),
  createdAt: zod.z.string().datetime(),
  updatedAt: zod.z.string().datetime(),
  sessionIds: zod.z.array(zod.z.string()).optional()
});
var ObservationSchema = zod.z.object({
  description: zod.z.string(),
  category: PreferenceCategorySchema,
  property: zod.z.string(),
  value: zod.z.string()
});
var LearnedExpectationSchema = zod.z.object({
  id: zod.z.string(),
  sessionId: zod.z.string(),
  route: zod.z.string(),
  observations: zod.z.array(ObservationSchema),
  approved: zod.z.boolean(),
  createdAt: zod.z.string().datetime()
});
var ActivePreferenceSchema = zod.z.object({
  id: zod.z.string(),
  description: zod.z.string(),
  category: PreferenceCategorySchema,
  route: zod.z.string().optional(),
  componentType: zod.z.string().optional(),
  property: zod.z.string(),
  operator: ExpectationOperatorSchema,
  value: zod.z.string(),
  confidence: zod.z.number()
});
var MemorySummarySchema = zod.z.object({
  version: zod.z.literal(1),
  updatedAt: zod.z.string().datetime(),
  stats: zod.z.object({
    totalPreferences: zod.z.number(),
    totalLearned: zod.z.number(),
    byCategory: zod.z.record(zod.z.string(), zod.z.number()),
    bySource: zod.z.record(zod.z.string(), zod.z.number())
  }),
  activePreferences: zod.z.array(ActivePreferenceSchema)
});

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
    const content = await fs.readFile(authPath, "utf-8");
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
    const stats = await fs.stat(authPath);
    const randomData = crypto.randomBytes(stats.size);
    await fs.writeFile(authPath, randomData, { mode: 384 });
    await fs.unlink(authPath);
    console.log("\u2705 Auth state securely cleared");
  } catch {
    console.log("\u2139\uFE0F  No auth state to clear");
  }
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
    outputDir,
    selector,
    waitFor
  } = options;
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
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
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
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
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
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
    fs.readFile(baselinePath),
    fs.readFile(currentPath)
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
  await fs.mkdir(path.dirname(diffPath), { recursive: true });
  await fs.writeFile(diffPath, pngjs.PNG.sync.write(diff));
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
  await fs.mkdir(paths.root, { recursive: true });
  await fs.writeFile(paths.sessionJson, JSON.stringify(session, null, 2));
  return session;
}
async function getSession(outputDir, sessionId) {
  const paths = getSessionPaths(outputDir, sessionId);
  try {
    const content = await fs.readFile(paths.sessionJson, "utf-8");
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
  await fs.writeFile(paths.sessionJson, JSON.stringify(updated, null, 2));
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
    const entries = await fs.readdir(sessionsDir, { withFileTypes: true });
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
    await fs.rm(paths.root, { recursive: true, force: true });
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
  const path2 = path.join(artifactDir, filename);
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
    artifactDir = path.join(options.sessionDir, `search-${Date.now()}`);
    await fs.mkdir(artifactDir, { recursive: true });
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
      await fs.writeFile(
        path.join(artifactDir, "results.json"),
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

// src/flows/search-validation.ts
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

// src/flows/index.ts
var flows = {
  login: loginFlow,
  search: searchFlow,
  aiSearch: aiSearchFlow,
  form: formFlow
};
var DEFAULT_RETENTION = {
  maxSessions: void 0,
  maxAgeDays: void 0,
  keepFailed: true,
  autoClean: false
};
async function loadRetentionConfig(outputDir) {
  const configPath = path.join(outputDir, "..", ".ibrrc.json");
  try {
    await fs.access(configPath);
    const content = await fs.readFile(configPath, "utf-8");
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
async function getRetentionStatus(outputDir) {
  const config = await loadRetentionConfig(outputDir);
  const sessions = await listSessions(outputDir);
  let wouldDelete = 0;
  const cutoffTime = config.maxAgeDays ? Date.now() - config.maxAgeDays * 24 * 60 * 60 * 1e3 : 0;
  let keptCount = 0;
  for (const session of sessions) {
    const sessionTime = new Date(session.createdAt).getTime();
    const isTooOld = config.maxAgeDays && sessionTime < cutoffTime;
    const isOverLimit = config.maxSessions && keptCount >= config.maxSessions;
    const isFailed = isFailedSession(session);
    if (isFailed && config.keepFailed) {
      continue;
    }
    if (isTooOld || isOverLimit) {
      wouldDelete++;
    } else {
      keptCount++;
    }
  }
  return {
    config,
    currentSessions: sessions.length,
    oldestSession: sessions.length > 0 ? new Date(sessions[sessions.length - 1].createdAt) : null,
    newestSession: sessions.length > 0 ? new Date(sessions[0].createdAt) : null,
    wouldDelete
  };
}
function formatRetentionStatus(status) {
  const lines = [];
  lines.push("Session Retention Status");
  lines.push("========================");
  lines.push("");
  lines.push(`Current sessions: ${status.currentSessions}`);
  if (status.oldestSession) {
    lines.push(`Oldest: ${status.oldestSession.toISOString()}`);
  }
  if (status.newestSession) {
    lines.push(`Newest: ${status.newestSession.toISOString()}`);
  }
  lines.push("");
  lines.push("Retention Policy:");
  if (status.config.maxSessions) {
    lines.push(`  Max sessions: ${status.config.maxSessions}`);
  } else {
    lines.push("  Max sessions: unlimited");
  }
  if (status.config.maxAgeDays) {
    lines.push(`  Max age: ${status.config.maxAgeDays} days`);
  } else {
    lines.push("  Max age: unlimited");
  }
  lines.push(`  Keep failed: ${status.config.keepFailed ? "yes" : "no"}`);
  lines.push(`  Auto-clean: ${status.config.autoClean ? "enabled" : "disabled"}`);
  if (status.wouldDelete > 0) {
    lines.push("");
    lines.push(`\u26A0\uFE0F  ${status.wouldDelete} session(s) would be deleted if cleanup runs`);
  } else {
    lines.push("");
    lines.push("\u2713 All sessions within retention policy");
  }
  return lines.join("\n");
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
    const content = await fs__namespace.readFile(filePath, "utf-8");
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
      const entries = await fs__namespace.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path__namespace.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          const skipDirs = ["node_modules", "dist", "build", ".git", "coverage", ".next", "__tests__", "__mocks__"];
          if (!skipDirs.includes(entry.name)) {
            await scanDir(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path__namespace.extname(entry.name);
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
    const appApiDir = path__namespace.join(dir, "app", "api");
    if (await directoryExists(appApiDir)) {
      const appRoutes = await discoverAppRouterRoutes(appApiDir, dir);
      routes.push(...appRoutes);
    }
    const pagesApiDir = path__namespace.join(dir, "pages", "api");
    if (await directoryExists(pagesApiDir)) {
      const pagesRoutes = await discoverPagesRouterRoutes(pagesApiDir, dir);
      routes.push(...pagesRoutes);
    }
    const srcAppApiDir = path__namespace.join(dir, "src", "app", "api");
    if (await directoryExists(srcAppApiDir)) {
      const srcAppRoutes = await discoverAppRouterRoutes(srcAppApiDir, dir);
      routes.push(...srcAppRoutes);
    }
    const srcPagesApiDir = path__namespace.join(dir, "src", "pages", "api");
    if (await directoryExists(srcPagesApiDir)) {
      const srcPagesRoutes = await discoverPagesRouterRoutes(srcPagesApiDir, dir);
      routes.push(...srcPagesRoutes);
    }
  }
  await discoverInDir(projectDir);
  try {
    const entries = await fs__namespace.readdir(projectDir, { withFileTypes: true });
    const skipDirs = ["node_modules", "dist", "build", ".git", "coverage", ".next"];
    for (const entry of entries) {
      if (entry.isDirectory() && !skipDirs.includes(entry.name)) {
        const subDir = path__namespace.join(projectDir, entry.name);
        const hasPackageJson = await fileExists(path__namespace.join(subDir, "package.json"));
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
    const stat4 = await fs__namespace.stat(filePath);
    return stat4.isFile();
  } catch {
    return false;
  }
}
function filePathToRoute(filePath, projectDir) {
  const normalizedFilePath = path__namespace.normalize(filePath);
  const normalizedProjectDir = path__namespace.normalize(projectDir);
  const relativePath = path__namespace.relative(normalizedProjectDir, normalizedFilePath);
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
      const content = await fs__namespace.readFile(file, "utf-8");
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
      const content = await fs__namespace.readFile(file, "utf-8");
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
    const entries = await fs__namespace.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path__namespace.join(dir, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await findRouteFiles(fullPath, filename);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = path__namespace.extname(entry.name);
        const baseName = path__namespace.basename(entry.name, ext);
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
    const stat4 = await fs__namespace.stat(dir);
    return stat4.isDirectory();
  } catch {
    return false;
  }
}
var OPERATION_PREFIX = "op_";
function getOperationsPath(outputDir) {
  return path.join(outputDir, "operations.json");
}
async function readState(outputDir) {
  const path2 = getOperationsPath(outputDir);
  try {
    const content = await fs.readFile(path2, "utf-8");
    return JSON.parse(content);
  } catch {
    return { pending: [], lastUpdated: (/* @__PURE__ */ new Date()).toISOString() };
  }
}
async function writeState(outputDir, state) {
  const path2 = getOperationsPath(outputDir);
  await fs.mkdir(path.dirname(path2), { recursive: true });
  state.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
  await fs.writeFile(path2, JSON.stringify(state, null, 2));
}
async function registerOperation(outputDir, options) {
  const state = await readState(outputDir);
  state.pending = await cleanupStaleOperations(state.pending);
  const operation = {
    id: `${OPERATION_PREFIX}${nanoid.nanoid(8)}`,
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
function withOperationTracking(outputDir, options) {
  return async (fn) => {
    const opId = await registerOperation(outputDir, options);
    try {
      return await fn();
    } finally {
      await completeOperation(outputDir, opId);
    }
  };
}

// src/index.ts
init_performance();
init_interactivity();
init_api_timing();
async function testResponsive(url, options = {}) {
  const {
    viewports = ["desktop", "tablet", "mobile"],
    captureScreenshots = false,
    outputDir = "./.ibr/responsive",
    minTouchTarget = 44,
    minFontSize = 12,
    timeout = 3e4
  } = options;
  const results = [];
  let browser2 = null;
  try {
    browser2 = await playwright.chromium.launch({ headless: true });
    for (const viewportSpec of viewports) {
      let viewport;
      let viewportName;
      if (typeof viewportSpec === "string") {
        viewport = VIEWPORTS[viewportSpec];
        viewportName = viewportSpec;
      } else {
        viewport = viewportSpec;
        viewportName = `${viewportSpec.width}x${viewportSpec.height}`;
      }
      const context = await browser2.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: "reduce"
      });
      const page = await context.newPage();
      try {
        await page.goto(url, {
          waitUntil: "networkidle",
          timeout
        });
        await page.waitForTimeout(500);
        const result = await analyzeViewport(page, viewport, viewportName, {
          minTouchTarget,
          minFontSize
        });
        if (captureScreenshots) {
          const { mkdir: mkdir11 } = await import('fs/promises');
          await mkdir11(outputDir, { recursive: true });
          const screenshotPath = `${outputDir}/${viewportName}.png`;
          await page.screenshot({ path: screenshotPath, fullPage: true });
          result.screenshot = screenshotPath;
        }
        results.push(result);
      } finally {
        await context.close();
      }
    }
  } finally {
    if (browser2) {
      await browser2.close();
    }
  }
  const totalIssues = results.reduce(
    (sum, r) => sum + r.layoutIssues.length + r.touchTargets.filter((t) => t.isTooSmall).length + r.textIssues.length,
    0
  );
  const viewportsWithIssues = results.filter(
    (r) => r.layoutIssues.length > 0 || r.touchTargets.some((t) => t.isTooSmall) || r.textIssues.length > 0
  ).length;
  const criticalIssues = results.reduce(
    (sum, r) => sum + r.layoutIssues.filter((i) => i.issue === "overflow" || i.issue === "hidden").length,
    0
  );
  return {
    url,
    results,
    summary: {
      totalIssues,
      viewportsWithIssues,
      criticalIssues
    }
  };
}
async function analyzeViewport(page, viewport, viewportName, options) {
  const isMobile = viewport.width < 768;
  const analysisResult = await page.evaluate(({ viewportWidth, minTouchTarget, minFontSize, isMobile: isMobile2 }) => {
    const layoutIssues = [];
    const touchTargets = [];
    const textIssues = [];
    function getSelector(el) {
      if (el.id) return `#${el.id}`;
      const classes = Array.from(el.classList).slice(0, 2).join(".");
      const tag = el.tagName.toLowerCase();
      if (classes) return `${tag}.${classes}`;
      return tag;
    }
    const bodyWidth = document.body.scrollWidth;
    if (bodyWidth > viewportWidth) {
      layoutIssues.push({
        element: "body",
        issue: "overflow",
        description: `Page has horizontal overflow (${bodyWidth}px > ${viewportWidth}px viewport)`,
        bounds: { x: 0, y: 0, width: bodyWidth, height: document.body.scrollHeight }
      });
    }
    const allElements = Array.from(document.querySelectorAll("*"));
    for (const el of allElements) {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0) {
        continue;
      }
      if (rect.right > viewportWidth + 10) {
        layoutIssues.push({
          element: getSelector(el),
          issue: "overflow",
          description: `Element extends ${Math.round(rect.right - viewportWidth)}px beyond viewport`,
          bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        });
      }
      if (style.textOverflow === "ellipsis" && style.overflow === "hidden") {
        const scrollWidth = el.scrollWidth;
        const clientWidth = el.clientWidth;
        if (scrollWidth > clientWidth) {
          layoutIssues.push({
            element: getSelector(el),
            issue: "truncated",
            description: "Text is truncated with ellipsis",
            bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          });
        }
      }
    }
    if (isMobile2) {
      const interactiveElements = Array.from(document.querySelectorAll(
        'a, button, [role="button"], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ));
      for (const el of interactiveElements) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") {
          continue;
        }
        const width = rect.width;
        const height = rect.height;
        const isTooSmall = width < minTouchTarget || height < minTouchTarget;
        touchTargets.push({
          element: el.textContent?.trim().slice(0, 30) || getSelector(el),
          selector: getSelector(el),
          size: { width: Math.round(width), height: Math.round(height) },
          minimumSize: minTouchTarget,
          isTooSmall
        });
      }
    }
    const textElements = Array.from(document.querySelectorAll("p, span, a, li, td, th, label, h1, h2, h3, h4, h5, h6"));
    for (const el of textElements) {
      const style = window.getComputedStyle(el);
      const fontSize = parseFloat(style.fontSize);
      if (fontSize < minFontSize && el.textContent?.trim()) {
        textIssues.push({
          element: getSelector(el),
          issue: "too-small",
          fontSize: Math.round(fontSize)
        });
      }
    }
    return { layoutIssues, touchTargets, textIssues };
  }, {
    viewportWidth: viewport.width,
    minTouchTarget: options.minTouchTarget,
    minFontSize: options.minFontSize,
    isMobile
  });
  return {
    viewport,
    viewportName,
    ...analysisResult
  };
}
function formatResponsiveResult(result) {
  const lines = [];
  lines.push("Responsive Test Results");
  lines.push("=======================");
  lines.push("");
  lines.push(`URL: ${result.url}`);
  lines.push(`Viewports tested: ${result.results.length}`);
  lines.push("");
  const icon = result.summary.criticalIssues > 0 ? "\x1B[31m\u2717\x1B[0m" : result.summary.totalIssues > 0 ? "\x1B[33m!\x1B[0m" : "\x1B[32m\u2713\x1B[0m";
  lines.push(`${icon} Total issues: ${result.summary.totalIssues}`);
  lines.push(`   Critical: ${result.summary.criticalIssues}`);
  lines.push(`   Viewports with issues: ${result.summary.viewportsWithIssues}/${result.results.length}`);
  lines.push("");
  for (const vr of result.results) {
    const issueCount = vr.layoutIssues.length + vr.touchTargets.filter((t) => t.isTooSmall).length + vr.textIssues.length;
    const vpIcon = issueCount === 0 ? "\x1B[32m\u2713\x1B[0m" : "\x1B[33m!\x1B[0m";
    lines.push(`${vpIcon} ${vr.viewportName} (${vr.viewport.width}x${vr.viewport.height})`);
    if (issueCount === 0) {
      lines.push("   No issues detected");
    } else {
      if (vr.layoutIssues.length > 0) {
        lines.push("   Layout issues:");
        for (const issue of vr.layoutIssues.slice(0, 5)) {
          lines.push(`     ! ${issue.issue}: ${issue.description}`);
        }
        if (vr.layoutIssues.length > 5) {
          lines.push(`     ... and ${vr.layoutIssues.length - 5} more`);
        }
      }
      const smallTargets = vr.touchTargets.filter((t) => t.isTooSmall);
      if (smallTargets.length > 0) {
        lines.push("   Small touch targets:");
        for (const target of smallTargets.slice(0, 5)) {
          lines.push(`     ! "${target.element}" is ${target.size.width}x${target.size.height}px (min: ${target.minimumSize}px)`);
        }
        if (smallTargets.length > 5) {
          lines.push(`     ... and ${smallTargets.length - 5} more`);
        }
      }
      if (vr.textIssues.length > 0) {
        lines.push("   Text issues:");
        for (const issue of vr.textIssues.slice(0, 5)) {
          lines.push(`     ! ${issue.element}: ${issue.issue} (${issue.fontSize}px)`);
        }
        if (vr.textIssues.length > 5) {
          lines.push(`     ... and ${vr.textIssues.length - 5} more`);
        }
      }
    }
    if (vr.screenshot) {
      lines.push(`   Screenshot: ${vr.screenshot}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
var MEMORY_DIR = "memory";
var SUMMARY_FILE = "summary.json";
var PREFERENCES_DIR = "preferences";
var LEARNED_DIR = "learned";
var ARCHIVE_DIR = "archive";
var PREF_PREFIX = "pref_";
var LEARN_PREFIX = "learn_";
var MAX_ACTIVE_PREFERENCES = 50;
async function initMemory(outputDir) {
  const memoryDir = path.join(outputDir, MEMORY_DIR);
  await fs.mkdir(path.join(memoryDir, PREFERENCES_DIR), { recursive: true });
  await fs.mkdir(path.join(memoryDir, LEARNED_DIR), { recursive: true });
  await fs.mkdir(path.join(memoryDir, ARCHIVE_DIR), { recursive: true });
}
function getMemoryPath(outputDir, ...segments) {
  return path.join(outputDir, MEMORY_DIR, ...segments);
}
async function loadSummary(outputDir) {
  const summaryPath = getMemoryPath(outputDir, SUMMARY_FILE);
  if (!fs$1.existsSync(summaryPath)) {
    return createEmptySummary();
  }
  try {
    const content = await fs.readFile(summaryPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return createEmptySummary();
  }
}
async function saveSummary(outputDir, summary) {
  await initMemory(outputDir);
  const summaryPath = getMemoryPath(outputDir, SUMMARY_FILE);
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
}
function createEmptySummary() {
  return {
    version: 1,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    stats: {
      totalPreferences: 0,
      totalLearned: 0,
      byCategory: {},
      bySource: {}
    },
    activePreferences: []
  };
}
async function addPreference(outputDir, input) {
  await initMemory(outputDir);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const pref = {
    id: `${PREF_PREFIX}${nanoid.nanoid(8)}`,
    description: input.description,
    category: input.category,
    source: input.source ?? "user",
    route: input.route,
    componentType: input.componentType,
    expectation: {
      property: input.property,
      operator: input.operator ?? "equals",
      value: input.value
    },
    confidence: input.confidence ?? 1,
    createdAt: now,
    updatedAt: now,
    sessionIds: input.sessionIds
  };
  const prefPath = getMemoryPath(outputDir, PREFERENCES_DIR, `${pref.id}.json`);
  await fs.writeFile(prefPath, JSON.stringify(pref, null, 2));
  await rebuildSummary(outputDir);
  return pref;
}
async function getPreference(outputDir, prefId) {
  const prefPath = getMemoryPath(outputDir, PREFERENCES_DIR, `${prefId}.json`);
  if (!fs$1.existsSync(prefPath)) return null;
  try {
    const content = await fs.readFile(prefPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
async function removePreference(outputDir, prefId) {
  const prefPath = getMemoryPath(outputDir, PREFERENCES_DIR, `${prefId}.json`);
  if (!fs$1.existsSync(prefPath)) return false;
  await fs.unlink(prefPath);
  await rebuildSummary(outputDir);
  return true;
}
async function listPreferences(outputDir, filter) {
  const prefsDir = getMemoryPath(outputDir, PREFERENCES_DIR);
  if (!fs$1.existsSync(prefsDir)) return [];
  const files = await fs.readdir(prefsDir);
  const prefs = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const content = await fs.readFile(path.join(prefsDir, file), "utf-8");
      const pref = JSON.parse(content);
      if (filter?.category && pref.category !== filter.category) continue;
      if (filter?.route && pref.route !== filter.route) continue;
      if (filter?.componentType && pref.componentType !== filter.componentType) continue;
      prefs.push(pref);
    } catch {
    }
  }
  return prefs.sort((a, b) => b.confidence - a.confidence);
}
async function learnFromSession(outputDir, session, observations) {
  await initMemory(outputDir);
  const route = new URL(session.url).pathname;
  const learned = {
    id: `${LEARN_PREFIX}${nanoid.nanoid(8)}`,
    sessionId: session.id,
    route,
    observations,
    approved: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const learnPath = getMemoryPath(outputDir, LEARNED_DIR, `${learned.id}.json`);
  await fs.writeFile(learnPath, JSON.stringify(learned, null, 2));
  return learned;
}
async function listLearned(outputDir) {
  const learnedDir = getMemoryPath(outputDir, LEARNED_DIR);
  if (!fs$1.existsSync(learnedDir)) return [];
  const files = await fs.readdir(learnedDir);
  const items = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const content = await fs.readFile(path.join(learnedDir, file), "utf-8");
      items.push(JSON.parse(content));
    } catch {
    }
  }
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
async function promoteToPreference(outputDir, learnedId) {
  const learnedPath = getMemoryPath(outputDir, LEARNED_DIR, `${learnedId}.json`);
  if (!fs$1.existsSync(learnedPath)) return null;
  const content = await fs.readFile(learnedPath, "utf-8");
  const learned = JSON.parse(content);
  if (learned.observations.length === 0) return null;
  const obs = learned.observations[0];
  const pref = await addPreference(outputDir, {
    description: obs.description,
    category: obs.category,
    source: "learned",
    route: learned.route,
    property: obs.property,
    value: obs.value,
    confidence: 0.8,
    sessionIds: [learned.sessionId]
  });
  return pref;
}
async function rebuildSummary(outputDir) {
  await archiveSummary(outputDir);
  const prefs = await listPreferences(outputDir);
  const learned = await listLearned(outputDir);
  const byCategory = {};
  const bySource = {};
  for (const pref of prefs) {
    byCategory[pref.category] = (byCategory[pref.category] || 0) + 1;
    bySource[pref.source] = (bySource[pref.source] || 0) + 1;
  }
  const activePrefs = prefs.slice(0, MAX_ACTIVE_PREFERENCES).map((pref) => ({
    id: pref.id,
    description: pref.description,
    category: pref.category,
    route: pref.route,
    componentType: pref.componentType,
    property: pref.expectation.property,
    operator: pref.expectation.operator,
    value: pref.expectation.value,
    confidence: pref.confidence
  }));
  const summary = {
    version: 1,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    stats: {
      totalPreferences: prefs.length,
      totalLearned: learned.length,
      byCategory,
      bySource
    },
    activePreferences: activePrefs
  };
  await saveSummary(outputDir, summary);
  return summary;
}
async function archiveSummary(outputDir) {
  const summaryPath = getMemoryPath(outputDir, SUMMARY_FILE);
  if (!fs$1.existsSync(summaryPath)) return;
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
  const archivePath = getMemoryPath(outputDir, ARCHIVE_DIR, `summary_${timestamp}.json`);
  try {
    await fs.copyFile(summaryPath, archivePath);
  } catch {
  }
}
async function queryMemory(outputDir, query) {
  const summary = await loadSummary(outputDir);
  return summary.activePreferences.filter((pref) => {
    if (query.route && pref.route && !query.route.includes(pref.route)) return false;
    if (query.category && pref.category !== query.category) return false;
    if (query.componentType && pref.componentType !== query.componentType) return false;
    return true;
  });
}
function evaluateOperator(operator, actual, expected) {
  switch (operator) {
    case "equals":
      return actual.toLowerCase() === expected.toLowerCase();
    case "contains":
      return actual.toLowerCase().includes(expected.toLowerCase());
    case "matches":
      try {
        return new RegExp(expected, "i").test(actual);
      } catch {
        return false;
      }
    case "gte":
      return parseFloat(actual) >= parseFloat(expected);
    case "lte":
      return parseFloat(actual) <= parseFloat(expected);
    default:
      return false;
  }
}
function preferencesToRules(preferences) {
  return preferences.map((pref) => ({
    id: `memory-${pref.id}`,
    name: `Memory: ${pref.description}`,
    description: `User preference: ${pref.description}`,
    defaultSeverity: pref.confidence >= 0.8 ? "error" : "warn",
    check: (element, context) => {
      if (pref.route && !context.url.includes(pref.route)) return null;
      if (pref.componentType) {
        const matchesTag = element.tagName.toLowerCase() === pref.componentType.toLowerCase();
        const matchesRole = element.a11y?.role?.toLowerCase() === pref.componentType.toLowerCase();
        if (!matchesTag && !matchesRole) return null;
      }
      const styles = element.computedStyles;
      if (!styles) return null;
      const actual = styles[pref.property];
      if (!actual) return null;
      if (evaluateOperator(pref.operator, actual, pref.value)) return null;
      return {
        ruleId: `memory-${pref.id}`,
        ruleName: `Memory: ${pref.description}`,
        severity: pref.confidence >= 0.8 ? "error" : "warn",
        message: `Expected ${pref.property} to ${pref.operator} "${pref.value}", got "${actual}". (${pref.description})`,
        element: element.selector,
        bounds: element.bounds,
        fix: `Update ${pref.property} to ${pref.value}`
      };
    }
  }));
}
function createMemoryPreset(preferences) {
  const rules = preferencesToRules(preferences);
  const defaults = {};
  for (const rule of rules) {
    defaults[rule.id] = rule.defaultSeverity;
  }
  return {
    name: "memory",
    description: "UI/UX preferences from IBR memory",
    rules,
    defaults
  };
}
function formatMemorySummary(summary) {
  const lines = [];
  lines.push("IBR Memory");
  lines.push(`Updated: ${summary.updatedAt}`);
  lines.push("");
  lines.push(`Preferences: ${summary.stats.totalPreferences}`);
  lines.push(`Learned: ${summary.stats.totalLearned}`);
  if (Object.keys(summary.stats.byCategory).length > 0) {
    lines.push("");
    lines.push("By category:");
    for (const [cat, count] of Object.entries(summary.stats.byCategory)) {
      lines.push(`  ${cat}: ${count}`);
    }
  }
  if (summary.activePreferences.length > 0) {
    lines.push("");
    lines.push("Active preferences:");
    for (const pref of summary.activePreferences) {
      const scope = pref.route ? ` (${pref.route})` : " (global)";
      const conf = pref.confidence < 1 ? ` [${Math.round(pref.confidence * 100)}%]` : "";
      lines.push(`  ${pref.id}: ${pref.description}${scope}${conf}`);
    }
  }
  return lines.join("\n");
}
function formatPreference(pref) {
  const lines = [];
  lines.push(`ID: ${pref.id}`);
  lines.push(`Description: ${pref.description}`);
  lines.push(`Category: ${pref.category}`);
  lines.push(`Source: ${pref.source}`);
  lines.push(`Confidence: ${Math.round(pref.confidence * 100)}%`);
  lines.push(`Expectation: ${pref.expectation.property} ${pref.expectation.operator} "${pref.expectation.value}"`);
  if (pref.route) lines.push(`Route: ${pref.route}`);
  if (pref.componentType) lines.push(`Component: ${pref.componentType}`);
  if (pref.sessionIds?.length) lines.push(`Sessions: ${pref.sessionIds.join(", ")}`);
  lines.push(`Created: ${pref.createdAt}`);
  lines.push(`Updated: ${pref.updatedAt}`);
  return lines.join("\n");
}
var DecisionTypeSchema = zod.z.enum([
  "css_change",
  "layout_change",
  "color_change",
  "spacing_change",
  "component_add",
  "component_remove",
  "component_modify",
  "content_change"
]);
var DecisionStateSchema = zod.z.object({
  css: zod.z.record(zod.z.string(), zod.z.string()).optional(),
  html_snippet: zod.z.string().optional(),
  screenshot_ref: zod.z.string().optional()
});
var DecisionEntrySchema = zod.z.object({
  id: zod.z.string(),
  timestamp: zod.z.string().datetime(),
  route: zod.z.string(),
  component: zod.z.string().optional(),
  type: DecisionTypeSchema,
  description: zod.z.string(),
  rationale: zod.z.string().optional(),
  before: DecisionStateSchema.optional(),
  after: DecisionStateSchema.optional(),
  files_changed: zod.z.array(zod.z.string()),
  session_id: zod.z.string().optional()
});
var DecisionSummarySchema = zod.z.object({
  route: zod.z.string(),
  component: zod.z.string().optional(),
  latest_change: zod.z.string(),
  decision_count: zod.z.number(),
  full_log_ref: zod.z.string()
});
var CurrentUIStateSchema = zod.z.object({
  last_snapshot_ref: zod.z.string().optional(),
  pending_verifications: zod.z.number(),
  known_issues: zod.z.array(zod.z.string())
});
var CompactContextSchema = zod.z.object({
  version: zod.z.literal(1),
  session_id: zod.z.string(),
  updated_at: zod.z.string().datetime(),
  active_route: zod.z.string().optional(),
  decisions_summary: zod.z.array(DecisionSummarySchema),
  current_ui_state: CurrentUIStateSchema,
  preferences_active: zod.z.number()
});
var CompactionRequestSchema = zod.z.object({
  reason: zod.z.enum(["session_ending", "context_limit", "manual"]),
  preserve_decisions: zod.z.array(zod.z.string()).optional()
});
var CompactionResultSchema = zod.z.object({
  compact_context: CompactContextSchema,
  archived_to: zod.z.string(),
  decisions_compacted: zod.z.number(),
  decisions_preserved: zod.z.number()
});

// src/decision-tracker.ts
var CONTEXT_DIR = "context";
var DECISIONS_DIR = "decisions";
function getDecisionsDir(outputDir) {
  return path.join(outputDir, CONTEXT_DIR, DECISIONS_DIR);
}
function routeToFilename(route) {
  return route.replace(/^\/+/, "").replace(/\//g, "_").replace(/[^a-zA-Z0-9_-]/g, "") || "_root";
}
function getRouteLogPath(outputDir, route) {
  const filename = `${routeToFilename(route)}.jsonl`;
  return path.join(getDecisionsDir(outputDir), filename);
}
async function ensureContextDirs(outputDir) {
  await fs.mkdir(getDecisionsDir(outputDir), { recursive: true });
}
async function recordDecision(outputDir, options) {
  await ensureContextDirs(outputDir);
  const entry = {
    id: `dec_${nanoid.nanoid(10)}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    route: options.route,
    component: options.component,
    type: options.type,
    description: options.description,
    rationale: options.rationale,
    before: options.before,
    after: options.after,
    files_changed: options.files_changed,
    session_id: options.session_id
  };
  DecisionEntrySchema.parse(entry);
  const logPath = getRouteLogPath(outputDir, options.route);
  await fs.appendFile(logPath, JSON.stringify(entry) + "\n");
  return entry;
}
async function getDecisionsByRoute(outputDir, route) {
  const logPath = getRouteLogPath(outputDir, route);
  if (!fs$1.existsSync(logPath)) {
    return [];
  }
  const content = await fs.readFile(logPath, "utf-8");
  const lines = content.trim().split("\n").filter(Boolean);
  return lines.map((line) => DecisionEntrySchema.parse(JSON.parse(line)));
}
async function queryDecisions(outputDir, options = {}) {
  const { route, component, type, since, limit = 50 } = options;
  let decisions = [];
  if (route) {
    decisions = await getDecisionsByRoute(outputDir, route);
  } else {
    const decisionsDir = getDecisionsDir(outputDir);
    if (!fs$1.existsSync(decisionsDir)) {
      return [];
    }
    const files = await fs.readdir(decisionsDir);
    for (const file of files) {
      if (!file.endsWith(".jsonl")) continue;
      const filePath = path.join(decisionsDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);
      for (const line of lines) {
        decisions.push(DecisionEntrySchema.parse(JSON.parse(line)));
      }
    }
  }
  if (component) {
    decisions = decisions.filter((d) => d.component === component);
  }
  if (type) {
    decisions = decisions.filter((d) => d.type === type);
  }
  if (since) {
    const sinceTime = new Date(since).getTime();
    decisions = decisions.filter((d) => new Date(d.timestamp).getTime() >= sinceTime);
  }
  decisions.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  return decisions.slice(0, limit);
}
async function getDecision(outputDir, decisionId) {
  const decisionsDir = getDecisionsDir(outputDir);
  if (!fs$1.existsSync(decisionsDir)) {
    return null;
  }
  const files = await fs.readdir(decisionsDir);
  for (const file of files) {
    if (!file.endsWith(".jsonl")) continue;
    const filePath = path.join(decisionsDir, file);
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      const entry = DecisionEntrySchema.parse(JSON.parse(line));
      if (entry.id === decisionId) {
        return entry;
      }
    }
  }
  return null;
}
async function getTrackedRoutes(outputDir) {
  const decisionsDir = getDecisionsDir(outputDir);
  if (!fs$1.existsSync(decisionsDir)) {
    return [];
  }
  const files = await fs.readdir(decisionsDir);
  return files.filter((f) => f.endsWith(".jsonl")).map((f) => f.replace(".jsonl", "").replace(/_/g, "/").replace(/^\/?/, "/"));
}
async function getDecisionStats(outputDir) {
  const all = await queryDecisions(outputDir, { limit: 1e4 });
  const byRoute = {};
  const byType = {};
  for (const d of all) {
    byRoute[d.route] = (byRoute[d.route] || 0) + 1;
    byType[d.type] = (byType[d.type] || 0) + 1;
  }
  return { total: all.length, byRoute, byType };
}
async function getDecisionsSize(outputDir) {
  const decisionsDir = getDecisionsDir(outputDir);
  if (!fs$1.existsSync(decisionsDir)) {
    return 0;
  }
  const files = await fs.readdir(decisionsDir);
  let total = 0;
  for (const file of files) {
    if (!file.endsWith(".jsonl")) continue;
    const s = await fs.stat(path.join(decisionsDir, file));
    total += s.size;
  }
  return total;
}
var CONTEXT_DIR2 = "context";
var COMPACT_FILE = "compact.json";
var ARCHIVE_DIR2 = "archive";
function getCompactPath(outputDir) {
  return path.join(outputDir, CONTEXT_DIR2, COMPACT_FILE);
}
function getArchiveDir(outputDir) {
  return path.join(outputDir, CONTEXT_DIR2, ARCHIVE_DIR2);
}
async function loadCompactContext(outputDir, sessionId) {
  const compactPath = getCompactPath(outputDir);
  if (fs$1.existsSync(compactPath)) {
    const content = await fs.readFile(compactPath, "utf-8");
    return CompactContextSchema.parse(JSON.parse(content));
  }
  return {
    version: 1,
    session_id: sessionId || `ctx_${nanoid.nanoid(8)}`,
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    active_route: void 0,
    decisions_summary: [],
    current_ui_state: {
      last_snapshot_ref: void 0,
      pending_verifications: 0,
      known_issues: []
    },
    preferences_active: 0
  };
}
async function saveCompactContext(outputDir, context) {
  const contextDir = path.join(outputDir, CONTEXT_DIR2);
  await fs.mkdir(contextDir, { recursive: true });
  const compactPath = getCompactPath(outputDir);
  await fs.writeFile(compactPath, JSON.stringify(context, null, 2));
}
async function updateCompactContext(outputDir, sessionId) {
  const current = await loadCompactContext(outputDir, sessionId);
  const routes = await getTrackedRoutes(outputDir);
  const summaries = [];
  for (const route of routes) {
    const decisions = await queryDecisions(outputDir, { route, limit: 100 });
    if (decisions.length === 0) continue;
    const byComponent = /* @__PURE__ */ new Map();
    for (const d of decisions) {
      const key = d.component || "_page";
      if (!byComponent.has(key)) {
        byComponent.set(key, []);
      }
      byComponent.get(key).push(d);
    }
    for (const [component, componentDecisions] of byComponent) {
      const latest = componentDecisions[0];
      const routeFilename = route.replace(/^\/+/, "").replace(/\//g, "_").replace(/[^a-zA-Z0-9_-]/g, "") || "_root";
      summaries.push({
        route,
        component: component === "_page" ? void 0 : component,
        latest_change: latest.description,
        decision_count: componentDecisions.length,
        full_log_ref: `.ibr/context/decisions/${routeFilename}.jsonl`
      });
    }
  }
  const updated = {
    ...current,
    session_id: sessionId || current.session_id,
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    decisions_summary: summaries
  };
  await saveCompactContext(outputDir, updated);
  return updated;
}
async function compactContext(outputDir, request) {
  const current = await loadCompactContext(outputDir);
  const archiveDir = getArchiveDir(outputDir);
  await fs.mkdir(archiveDir, { recursive: true });
  const archiveFilename = `compact_${Date.now()}.json`;
  const archivePath = path.join(archiveDir, archiveFilename);
  await fs.writeFile(archivePath, JSON.stringify(current, null, 2));
  const decisionsCompacted = current.decisions_summary.reduce(
    (sum, s) => sum + s.decision_count,
    0
  );
  const hasPreserves = (request.preserve_decisions || []).length > 0;
  const preserved = hasPreserves ? current.decisions_summary : [];
  const newContext = {
    version: 1,
    session_id: current.session_id,
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    active_route: current.active_route,
    decisions_summary: preserved,
    current_ui_state: {
      last_snapshot_ref: current.current_ui_state.last_snapshot_ref,
      pending_verifications: 0,
      known_issues: []
    },
    preferences_active: current.preferences_active
  };
  await saveCompactContext(outputDir, newContext);
  return {
    compact_context: newContext,
    archived_to: archivePath,
    decisions_compacted: decisionsCompacted,
    decisions_preserved: preserved.length
  };
}
async function setActiveRoute(outputDir, route) {
  const current = await loadCompactContext(outputDir);
  const updated = {
    ...current,
    active_route: route,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  await saveCompactContext(outputDir, updated);
  return updated;
}
async function addKnownIssue(outputDir, issue) {
  const current = await loadCompactContext(outputDir);
  const issues = [...current.current_ui_state.known_issues, issue];
  const updated = {
    ...current,
    current_ui_state: {
      ...current.current_ui_state,
      known_issues: issues
    },
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  await saveCompactContext(outputDir, updated);
  return updated;
}
async function isCompactContextOversize(outputDir) {
  const compactPath = getCompactPath(outputDir);
  if (!fs$1.existsSync(compactPath)) return false;
  const content = await fs.readFile(compactPath, "utf-8");
  return Buffer.byteLength(content, "utf-8") > 4096;
}
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

// src/scan.ts
init_interactivity();
async function scan(url, options = {}) {
  const {
    viewport: viewportOpt = "desktop",
    timeout = 3e4,
    waitFor,
    screenshot
  } = options;
  const resolvedViewport = typeof viewportOpt === "string" ? VIEWPORTS[viewportOpt] || VIEWPORTS.desktop : viewportOpt;
  const browser2 = await playwright.chromium.launch({ headless: true });
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
function formatScanResult(result) {
  const lines = [];
  const verdictIcon = result.verdict === "PASS" ? "\x1B[32m\u2713\x1B[0m" : result.verdict === "ISSUES" ? "\x1B[33m!\x1B[0m" : "\x1B[31m\u2717\x1B[0m";
  lines.push("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  lines.push("  IBR UI SCAN");
  lines.push("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  lines.push("");
  lines.push(`  URL:      ${result.url}`);
  lines.push(`  Route:    ${result.route}`);
  lines.push(`  Viewport: ${result.viewport.name} (${result.viewport.width}x${result.viewport.height})`);
  lines.push(`  Verdict:  ${verdictIcon} ${result.verdict}`);
  lines.push("");
  lines.push(`  ${result.summary}`);
  lines.push("");
  lines.push("  PAGE UNDERSTANDING");
  lines.push("  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  lines.push(`  Intent:   ${result.semantic.pageIntent.intent} (${(result.semantic.confidence * 100).toFixed(0)}% confidence)`);
  lines.push(`  Auth:     ${result.semantic.state.auth.authenticated ? "Authenticated" : "Not authenticated"}`);
  lines.push(`  Loading:  ${result.semantic.state.loading.loading ? result.semantic.state.loading.type : "Complete"}`);
  lines.push(`  Errors:   ${result.semantic.state.errors.hasErrors ? result.semantic.state.errors.errors.join(", ") : "None"}`);
  lines.push("");
  lines.push("  ELEMENTS");
  lines.push("  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  lines.push(`  Total:              ${result.elements.audit.totalElements}`);
  lines.push(`  Interactive:        ${result.elements.audit.interactiveCount}`);
  lines.push(`  With handlers:      ${result.elements.audit.withHandlers}`);
  lines.push(`  Without handlers:   ${result.elements.audit.withoutHandlers}`);
  lines.push("");
  const { buttons, links, forms } = result.interactivity;
  lines.push("  INTERACTIVITY");
  lines.push("  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  lines.push(`  Buttons: ${buttons.length}  Links: ${links.length}  Forms: ${forms.length}`);
  if (forms.length > 0) {
    for (const form of forms) {
      const icon = form.hasSubmitHandler ? "\u2713" : "\u2717";
      lines.push(`    ${icon} Form ${form.selector}: ${form.fields.length} fields${form.hasValidation ? ", validated" : ""}`);
    }
  }
  lines.push("");
  if (result.console.errors.length > 0 || result.console.warnings.length > 0) {
    lines.push("  CONSOLE");
    lines.push("  \u2500\u2500\u2500\u2500\u2500\u2500\u2500");
    if (result.console.errors.length > 0) {
      lines.push(`  Errors: ${result.console.errors.length}`);
      for (const err of result.console.errors.slice(0, 3)) {
        lines.push(`    \u2717 ${err.slice(0, 100)}`);
      }
    }
    if (result.console.warnings.length > 0) {
      lines.push(`  Warnings: ${result.console.warnings.length}`);
    }
    lines.push("");
  }
  if (result.issues.length > 0) {
    lines.push("  ISSUES");
    lines.push("  \u2500\u2500\u2500\u2500\u2500\u2500");
    for (const issue of result.issues) {
      const icon = issue.severity === "error" ? "\x1B[31m\u2717\x1B[0m" : issue.severity === "warning" ? "\x1B[33m!\x1B[0m" : "\u2139";
      lines.push(`  ${icon} [${issue.category}] ${issue.description}`);
      if (issue.fix) {
        lines.push(`    \u2192 ${issue.fix}`);
      }
    }
  } else {
    lines.push("  No issues detected.");
  }
  lines.push("");
  lines.push("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  return lines.join("\n");
}

// src/index.ts
async function compare(options) {
  const {
    url,
    baselinePath,
    currentPath,
    threshold = 1,
    outputDir = path.join(os.tmpdir(), "ibr-compare"),
    viewport = "desktop",
    fullPage = true,
    waitForNetworkIdle = true,
    timeout = 3e4
  } = options;
  if (!baselinePath && !url) {
    throw new Error("Either baselinePath or url must be provided");
  }
  const resolvedViewport = typeof viewport === "string" ? VIEWPORTS[viewport] || VIEWPORTS.desktop : viewport;
  await fs.mkdir(outputDir, { recursive: true });
  const timestamp = Date.now();
  const actualBaselinePath = baselinePath || path.join(outputDir, `baseline-${timestamp}.png`);
  let actualCurrentPath = currentPath || path.join(outputDir, `current-${timestamp}.png`);
  const diffPath = path.join(outputDir, `diff-${timestamp}.png`);
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
    await fs.access(actualBaselinePath);
  } catch {
    throw new Error(`Baseline image not found: ${actualBaselinePath}`);
  }
  try {
    await fs.access(actualCurrentPath);
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
async function compareAll(options = {}) {
  const {
    sessionId,
    outputDir = "./.ibr",
    urlPattern,
    statuses = ["baseline"],
    limit = 50
  } = options;
  const results = [];
  if (sessionId) {
    const session = await getSession(outputDir, sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    const paths = getSessionPaths(outputDir, session.id);
    const result = await compare({
      url: session.url,
      baselinePath: paths.baseline,
      outputDir: path.dirname(paths.diff),
      viewport: session.viewport
    });
    results.push(result);
  } else {
    let sessions = await listSessions(outputDir);
    sessions = sessions.filter((s) => statuses.includes(s.status));
    if (urlPattern) {
      const pattern = typeof urlPattern === "string" ? new RegExp(urlPattern) : urlPattern;
      sessions = sessions.filter((s) => pattern.test(s.url));
    }
    sessions = sessions.slice(0, limit);
    for (const session of sessions) {
      try {
        const paths = getSessionPaths(outputDir, session.id);
        const result = await compare({
          url: session.url,
          baselinePath: paths.baseline,
          outputDir: path.dirname(paths.diff),
          viewport: session.viewport
        });
        results.push(result);
      } catch (err) {
        console.warn(`Failed to compare session ${session.id}: ${err}`);
      }
    }
  }
  await closeBrowser();
  return results;
}
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
    const browser2 = await playwright.chromium.launch({ headless: true });
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

exports.A11yAttributesSchema = A11yAttributesSchema;
exports.ActivePreferenceSchema = ActivePreferenceSchema;
exports.AnalysisSchema = AnalysisSchema;
exports.AuditResultSchema = AuditResultSchema;
exports.BoundsSchema = BoundsSchema;
exports.ChangedRegionSchema = ChangedRegionSchema;
exports.CompactContextSchema = CompactContextSchema;
exports.CompactionRequestSchema = CompactionRequestSchema;
exports.CompactionResultSchema = CompactionResultSchema;
exports.ComparisonReportSchema = ComparisonReportSchema;
exports.ComparisonResultSchema = ComparisonResultSchema;
exports.ConfigSchema = ConfigSchema;
exports.CurrentUIStateSchema = CurrentUIStateSchema;
exports.DEFAULT_DYNAMIC_SELECTORS = DEFAULT_DYNAMIC_SELECTORS;
exports.DEFAULT_RETENTION = DEFAULT_RETENTION;
exports.DecisionEntrySchema = DecisionEntrySchema;
exports.DecisionStateSchema = DecisionStateSchema;
exports.DecisionSummarySchema = DecisionSummarySchema;
exports.DecisionTypeSchema = DecisionTypeSchema;
exports.ElementIssueSchema = ElementIssueSchema;
exports.EnhancedElementSchema = EnhancedElementSchema;
exports.ExpectationOperatorSchema = ExpectationOperatorSchema;
exports.ExpectationSchema = ExpectationSchema;
exports.IBRSession = IBRSession;
exports.InteractiveStateSchema = InteractiveStateSchema;
exports.InterfaceBuiltRight = InterfaceBuiltRight;
exports.LANDMARK_SELECTORS = LANDMARK_SELECTORS;
exports.LandmarkElementSchema = LandmarkElementSchema;
exports.LearnedExpectationSchema = LearnedExpectationSchema;
exports.MemorySourceSchema = MemorySourceSchema;
exports.MemorySummarySchema = MemorySummarySchema;
exports.ObservationSchema = ObservationSchema;
exports.PreferenceCategorySchema = PreferenceCategorySchema;
exports.PreferenceSchema = PreferenceSchema;
exports.RuleAuditResultSchema = RuleAuditResultSchema;
exports.RuleSettingSchema = RuleSettingSchema;
exports.RuleSeveritySchema = RuleSeveritySchema;
exports.RulesConfigSchema = RulesConfigSchema;
exports.SessionQuerySchema = SessionQuerySchema;
exports.SessionSchema = SessionSchema;
exports.SessionStatusSchema = SessionStatusSchema;
exports.VIEWPORTS = VIEWPORTS;
exports.VerdictSchema = VerdictSchema;
exports.ViewportSchema = ViewportSchema;
exports.ViolationSchema = ViolationSchema;
exports.addKnownIssue = addKnownIssue;
exports.addPreference = addPreference;
exports.aiSearchFlow = aiSearchFlow;
exports.analyzeComparison = analyzeComparison;
exports.analyzeForObviousIssues = analyzeForObviousIssues;
exports.archiveSummary = archiveSummary;
exports.captureScreenshot = captureScreenshot;
exports.captureWithDiagnostics = captureWithDiagnostics;
exports.checkConsistency = checkConsistency;
exports.classifyPageIntent = classifyPageIntent;
exports.cleanSessions = cleanSessions;
exports.closeBrowser = closeBrowser;
exports.compactContext = compactContext;
exports.compare = compare;
exports.compareAll = compareAll;
exports.compareImages = compareImages;
exports.compareLandmarks = compareLandmarks;
exports.completeOperation = completeOperation;
exports.createApiTracker = createApiTracker;
exports.createMemoryPreset = createMemoryPreset;
exports.createSession = createSession;
exports.deleteSession = deleteSession;
exports.detectAuthState = detectAuthState;
exports.detectChangedRegions = detectChangedRegions;
exports.detectErrorState = detectErrorState;
exports.detectLandmarks = detectLandmarks;
exports.detectLoadingState = detectLoadingState;
exports.detectPageState = detectPageState;
exports.discoverApiRoutes = discoverApiRoutes;
exports.discoverPages = discoverPages;
exports.enforceRetentionPolicy = enforceRetentionPolicy;
exports.extractApiCalls = extractApiCalls;
exports.filePathToRoute = filePathToRoute;
exports.filterByEndpoint = filterByEndpoint;
exports.filterByMethod = filterByMethod;
exports.findButton = findButton;
exports.findFieldByLabel = findFieldByLabel;
exports.findOrphanEndpoints = findOrphanEndpoints;
exports.findSessions = findSessions;
exports.flows = flows;
exports.formFlow = formFlow;
exports.formatApiTimingResult = formatApiTimingResult;
exports.formatConsistencyReport = formatConsistencyReport;
exports.formatInteractivityResult = formatInteractivityResult;
exports.formatLandmarkComparison = formatLandmarkComparison;
exports.formatMemorySummary = formatMemorySummary;
exports.formatPendingOperations = formatPendingOperations;
exports.formatPerformanceResult = formatPerformanceResult;
exports.formatPreference = formatPreference;
exports.formatReportJson = formatReportJson;
exports.formatReportMinimal = formatReportMinimal;
exports.formatReportText = formatReportText;
exports.formatResponsiveResult = formatResponsiveResult;
exports.formatRetentionStatus = formatRetentionStatus;
exports.formatScanResult = formatScanResult;
exports.formatSemanticJson = formatSemanticJson;
exports.formatSemanticText = formatSemanticText;
exports.formatSessionSummary = formatSessionSummary;
exports.formatValidationResult = formatValidationResult;
exports.generateDevModePrompt = generateDevModePrompt;
exports.generateQuickSummary = generateQuickSummary;
exports.generateReport = generateReport;
exports.generateSessionId = generateSessionId;
exports.generateValidationContext = generateValidationContext;
exports.generateValidationPrompt = generateValidationPrompt;
exports.getDecision = getDecision;
exports.getDecisionStats = getDecisionStats;
exports.getDecisionsByRoute = getDecisionsByRoute;
exports.getDecisionsSize = getDecisionsSize;
exports.getExpectedLandmarksForIntent = getExpectedLandmarksForIntent;
exports.getExpectedLandmarksFromContext = getExpectedLandmarksFromContext;
exports.getIntentDescription = getIntentDescription;
exports.getMostRecentSession = getMostRecentSession;
exports.getNavigationLinks = getNavigationLinks;
exports.getPendingOperations = getPendingOperations;
exports.getPreference = getPreference;
exports.getRetentionStatus = getRetentionStatus;
exports.getSemanticOutput = getSemanticOutput;
exports.getSession = getSession;
exports.getSessionPaths = getSessionPaths;
exports.getSessionStats = getSessionStats;
exports.getSessionsByRoute = getSessionsByRoute;
exports.getTimeline = getTimeline;
exports.getTrackedRoutes = getTrackedRoutes;
exports.getVerdictDescription = getVerdictDescription;
exports.getViewport = getViewport;
exports.groupByEndpoint = groupByEndpoint;
exports.groupByFile = groupByFile;
exports.initMemory = initMemory;
exports.isCompactContextOversize = isCompactContextOversize;
exports.learnFromSession = learnFromSession;
exports.listLearned = listLearned;
exports.listPreferences = listPreferences;
exports.listSessions = listSessions;
exports.loadCompactContext = loadCompactContext;
exports.loadRetentionConfig = loadRetentionConfig;
exports.loadSummary = loadSummary;
exports.loginFlow = loginFlow;
exports.markSessionCompared = markSessionCompared;
exports.maybeAutoClean = maybeAutoClean;
exports.measureApiTiming = measureApiTiming;
exports.measurePerformance = measurePerformance;
exports.measureWebVitals = measureWebVitals;
exports.preferencesToRules = preferencesToRules;
exports.promoteToPreference = promoteToPreference;
exports.queryDecisions = queryDecisions;
exports.queryMemory = queryMemory;
exports.rebuildSummary = rebuildSummary;
exports.recordDecision = recordDecision;
exports.registerOperation = registerOperation;
exports.removePreference = removePreference;
exports.saveCompactContext = saveCompactContext;
exports.saveSummary = saveSummary;
exports.scan = scan;
exports.scanDirectoryForApiCalls = scanDirectoryForApiCalls;
exports.searchFlow = searchFlow;
exports.setActiveRoute = setActiveRoute;
exports.testInteractivity = testInteractivity;
exports.testResponsive = testResponsive;
exports.updateCompactContext = updateCompactContext;
exports.updateSession = updateSession;
exports.waitForCompletion = waitForCompletion;
exports.waitForNavigation = waitForNavigation;
exports.waitForPageReady = waitForPageReady;
exports.withOperationTracking = withOperationTracking;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map