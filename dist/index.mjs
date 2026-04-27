import * as fs from 'fs/promises';
import { mkdir, readFile, writeFile, unlink, readdir, copyFile, rm, access, appendFile, stat } from 'fs/promises';
import { existsSync, readFileSync, statSync, writeFileSync, mkdtempSync } from 'fs';
import * as path from 'path';
import { join, dirname } from 'path';
import { homedir, tmpdir, userInfo } from 'os';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { execFile, exec, spawn } from 'child_process';
import { createServer } from 'net';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { randomBytes } from 'crypto';
import { URL as URL$1 } from 'url';
import { promisify } from 'util';

var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/engine/resolve.ts
var resolve_exports = {};
__export(resolve_exports, {
  jaroWinkler: () => jaroWinkler,
  parseSpatialHints: () => parseSpatialHints,
  resolve: () => resolve
});
function resolve(options) {
  if (options.mode === "algorithmic") {
    return resolveAlgorithmic(options);
  }
  const { intent, elements } = options;
  if (elements.length === 0) {
    return { element: null, confidence: 0, candidates: [] };
  }
  const intentLower = intent.toLowerCase();
  const scored = scoreElements(elements, intentLower);
  if (scored.length === 0) {
    return {
      element: elements[0],
      confidence: 0,
      candidates: elements.filter((e) => e.actions.length > 0),
      visionFallback: options.mode === "claude"
    };
  }
  const best = scored[0];
  if (best.score >= 1 || scored.length === 1 && best.score >= 0.5) {
    return {
      element: best.element,
      confidence: best.score
    };
  }
  const threshold = best.score * 0.8;
  const candidates = scored.filter((s) => s.score >= threshold).map((s) => s.element);
  const result = {
    element: best.element,
    confidence: best.score,
    candidates: candidates.length > 1 ? candidates : void 0
  };
  if (best.score < 0.3 && options.mode === "claude") {
    result.visionFallback = true;
  }
  return result;
}
function scoreElements(elements, intentLower) {
  const scored = [];
  for (const el of elements) {
    const labelLower = el.label.toLowerCase();
    let score = 0;
    if (labelLower.length === 0) continue;
    const escapedLabel = escapeRegex(labelLower);
    const labelRegex = new RegExp(`\\b${escapedLabel}\\b`, "i");
    if (labelRegex.test(intentLower)) {
      const labelWords = labelLower.trim().split(/\s+/);
      if (labelWords.length > 1) {
        score = 1;
      } else {
        const intentWords = intentLower.split(/\s+/);
        const exactWordMatch = intentWords.includes(labelLower);
        if (exactWordMatch && labelWords[0].length > 1) {
          score = 0.5;
        }
      }
    } else {
      const intentWords = intentLower.split(/\s+/);
      const matchedWords = intentWords.filter(
        (w) => w.length > 2 && labelLower.includes(w)
      );
      if (matchedWords.length > 0) {
        score = 0.5;
      }
    }
    if (intentLower.includes(el.role)) {
      score = Math.min(score + 0.2, 1);
    }
    if (el.actions.length === 0 && score > 0) {
      score *= 0.5;
    }
    if (score > 0) {
      scored.push({ element: el, score });
    }
  }
  return scored.sort((a, b) => b.score - a.score);
}
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function resolveAlgorithmic(options) {
  const { intent, elements } = options;
  if (elements.length === 0) {
    return { element: null, confidence: 0, candidates: [] };
  }
  const intentLower = intent.toLowerCase();
  const hints = parseSpatialHints(intentLower);
  const cleanedIntent = cleanIntent(intentLower);
  const scored = [];
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    let score = 0;
    const roleScore = scoreRole(cleanedIntent, el.role);
    const intentIsOnlyRole = cleanedIntent.trim() === el.role.toLowerCase() || cleanedIntent.trim().split(/\s+/).every((w) => scoreRole(w, el.role) > 0);
    const labelScore = intentIsOnlyRole ? 0 : scoreLabelSimilarity(cleanedIntent, el.label);
    const spatialScore = scoreSpatial(hints, el, i, elements);
    score = roleScore * 0.3 + labelScore * 0.5 + spatialScore * 0.2;
    if (labelScore >= 0.99) {
      score = Math.max(score, 0.75);
    }
    if (score > 0) {
      scored.push({ element: el, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  if (scored.length === 0) {
    return { element: elements[0], confidence: 0, candidates: [] };
  }
  const best = scored[0];
  if (best.score >= 0.7) {
    return {
      element: best.element,
      confidence: best.score
    };
  }
  return {
    element: best.element,
    confidence: best.score,
    candidates: scored.map((s) => s.element)
  };
}
function scoreRole(intent, role) {
  const roleLower = role.toLowerCase();
  const intentWords = intent.split(/\s+/);
  for (const word of intentWords) {
    if (word === roleLower) return 1;
    if (word === "btn" && roleLower === "button") return 0.8;
    if (word === "input" && roleLower === "textfield") return 0.8;
    if (word === "text" && roleLower === "textfield") return 0.6;
  }
  return 0;
}
function scoreLabelSimilarity(intent, label) {
  if (!label) return 0;
  const labelLower = label.toLowerCase();
  if (intent.includes(labelLower)) return 1;
  if (labelLower.includes(intent.trim())) return 0.9;
  const jw = jaroWinkler(intent, labelLower);
  const intentWords = intent.split(/\s+/).filter((w) => w.length > 2);
  let bestWordJw = 0;
  for (const word of intentWords) {
    bestWordJw = Math.max(bestWordJw, jaroWinkler(word, labelLower));
  }
  const labelWords = labelLower.split(/\s+/).filter((w) => w.length > 2);
  let bestLabelWordJw = 0;
  for (const lw of labelWords) {
    for (const iw of intentWords) {
      bestLabelWordJw = Math.max(bestLabelWordJw, jaroWinkler(iw, lw));
    }
  }
  return Math.max(jw, bestWordJw, bestLabelWordJw);
}
function parseSpatialHints(intent) {
  const hints = {};
  if (/\bfirst\b/.test(intent)) hints.position = "first";
  else if (/\blast\b/.test(intent)) hints.position = "last";
  else if (/\btop\b/.test(intent)) hints.position = "top";
  else if (/\bbottom\b/.test(intent)) hints.position = "bottom";
  const nearMatch = intent.match(/\b(?:next to|near|beside|by)\s+(.+?)(?:\s*$)/);
  if (nearMatch) hints.near = nearMatch[1].trim();
  return hints;
}
function scoreSpatial(hints, _el, index, allElements) {
  if (!hints.position && !hints.near) return 0;
  let score = 0;
  if (hints.position) {
    switch (hints.position) {
      case "first":
      case "top":
        score = Math.max(0, 1 - index / Math.max(allElements.length - 1, 1));
        break;
      case "last":
      case "bottom":
        score = index / Math.max(allElements.length - 1, 1);
        break;
    }
  }
  if (hints.near) {
    const nearLower = hints.near.toLowerCase();
    for (let i = 0; i < allElements.length; i++) {
      if (allElements[i].label.toLowerCase().includes(nearLower)) {
        const distance = Math.abs(index - i);
        if (distance > 0 && distance <= 3) {
          score = Math.max(score, 1 - (distance - 1) * 0.3);
        }
        break;
      }
    }
  }
  return score;
}
function cleanIntent(intent) {
  return intent.replace(/\b(first|last|top|bottom)\b/g, "").replace(/\b(next to|near|beside|by)\s+\S+/g, "").replace(/\b(click|tap|press|select|choose)\b/g, "").replace(/\s+/g, " ").trim();
}
function jaroWinkler(s1, s2) {
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  const jaro = jaroDistance(s1, s2);
  if (jaro === 0) return 0;
  let prefixLen = 0;
  const maxPrefix = Math.min(4, Math.min(s1.length, s2.length));
  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] === s2[i]) {
      prefixLen++;
    } else {
      break;
    }
  }
  return jaro + prefixLen * 0.1 * (1 - jaro);
}
function jaroDistance(s1, s2) {
  if (s1 === s2) return 1;
  const len1 = s1.length;
  const len2 = s2.length;
  const matchWindow = Math.max(0, Math.floor(Math.max(len1, len2) / 2) - 1);
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);
  let matches = 0;
  let transpositions = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  return (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
}
var init_resolve = __esm({
  "src/engine/resolve.ts"() {
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
    return new Promise((resolve3) => {
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
        resolve3(result);
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
  await new Promise((resolve3) => {
    const startWait = Date.now();
    const check = () => {
      if (requests.size === 0 || Date.now() - startWait > timeout) {
        resolve3();
        return;
      }
      setTimeout(check, 100);
    };
    setTimeout(check, 1e3);
  });
  page.off?.("request", requestHandler);
  page.off?.("response", responseHandler);
  page.off?.("requestfailed", requestFailedHandler);
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
      page.off?.("request", requestHandler);
      page.off?.("response", responseHandler);
      page.off?.("requestfailed", requestFailedHandler);
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
async function initMemory(outputDir) {
  const memoryDir = join(outputDir, MEMORY_DIR);
  await mkdir(join(memoryDir, PREFERENCES_DIR), { recursive: true });
  await mkdir(join(memoryDir, LEARNED_DIR), { recursive: true });
  await mkdir(join(memoryDir, ARCHIVE_DIR), { recursive: true });
}
function getMemoryPath(outputDir, ...segments) {
  return join(outputDir, MEMORY_DIR, ...segments);
}
async function loadSummary(outputDir) {
  const summaryPath = getMemoryPath(outputDir, SUMMARY_FILE);
  if (!existsSync(summaryPath)) {
    return createEmptySummary();
  }
  try {
    const content = await readFile(summaryPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return createEmptySummary();
  }
}
async function saveSummary(outputDir, summary) {
  await initMemory(outputDir);
  const summaryPath = getMemoryPath(outputDir, SUMMARY_FILE);
  await writeFile(summaryPath, JSON.stringify(summary, null, 2));
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
    id: `${PREF_PREFIX}${nanoid(8)}`,
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
  await writeFile(prefPath, JSON.stringify(pref, null, 2));
  await rebuildSummary(outputDir);
  return pref;
}
async function getPreference(outputDir, prefId) {
  const prefPath = getMemoryPath(outputDir, PREFERENCES_DIR, `${prefId}.json`);
  if (!existsSync(prefPath)) return null;
  try {
    const content = await readFile(prefPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
async function removePreference(outputDir, prefId) {
  const prefPath = getMemoryPath(outputDir, PREFERENCES_DIR, `${prefId}.json`);
  if (!existsSync(prefPath)) return false;
  await unlink(prefPath);
  await rebuildSummary(outputDir);
  return true;
}
async function listPreferences(outputDir, filter) {
  const prefsDir = getMemoryPath(outputDir, PREFERENCES_DIR);
  if (!existsSync(prefsDir)) return [];
  const files = await readdir(prefsDir);
  const prefs = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const content = await readFile(join(prefsDir, file), "utf-8");
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
    id: `${LEARN_PREFIX}${nanoid(8)}`,
    sessionId: session.id,
    route,
    observations,
    approved: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const learnPath = getMemoryPath(outputDir, LEARNED_DIR, `${learned.id}.json`);
  await writeFile(learnPath, JSON.stringify(learned, null, 2));
  return learned;
}
async function listLearned(outputDir) {
  const learnedDir = getMemoryPath(outputDir, LEARNED_DIR);
  if (!existsSync(learnedDir)) return [];
  const files = await readdir(learnedDir);
  const items = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const content = await readFile(join(learnedDir, file), "utf-8");
      items.push(JSON.parse(content));
    } catch {
    }
  }
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
async function promoteToPreference(outputDir, learnedId) {
  const learnedPath = getMemoryPath(outputDir, LEARNED_DIR, `${learnedId}.json`);
  if (!existsSync(learnedPath)) return null;
  const content = await readFile(learnedPath, "utf-8");
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
  if (!existsSync(summaryPath)) return;
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
  const archivePath = getMemoryPath(outputDir, ARCHIVE_DIR, `summary_${timestamp}.json`);
  try {
    await copyFile(summaryPath, archivePath);
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
  const rules2 = preferencesToRules(preferences);
  const defaults = {};
  for (const rule of rules2) {
    defaults[rule.id] = rule.defaultSeverity;
  }
  return {
    name: "memory",
    description: "UI/UX preferences from IBR memory",
    rules: rules2,
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
async function initGlobalMemory() {
  await mkdir(GLOBAL_PREFS_DIR, { recursive: true });
}
async function promoteToGlobal(outputDir) {
  await initGlobalMemory();
  const localPrefs = await listPreferences(outputDir);
  const globalPrefs = await listGlobalPreferences();
  const globalIndex = new Set(
    globalPrefs.map((p) => `${p.expectation.property}|${p.expectation.operator}|${p.expectation.value}`)
  );
  const promoted = [];
  let skipped = 0;
  let alreadyGlobal = 0;
  for (const pref of localPrefs) {
    if (pref.route) {
      skipped++;
      continue;
    }
    if (pref.confidence < GLOBAL_PROMOTION_THRESHOLD) {
      skipped++;
      continue;
    }
    const key = `${pref.expectation.property}|${pref.expectation.operator}|${pref.expectation.value}`;
    if (globalIndex.has(key)) {
      alreadyGlobal++;
      continue;
    }
    const globalPref = {
      ...pref,
      id: `global_${nanoid(8)}`,
      source: "learned",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const globalPath = join(GLOBAL_PREFS_DIR, `${globalPref.id}.json`);
    await writeFile(globalPath, JSON.stringify(globalPref, null, 2));
    globalIndex.add(key);
    promoted.push(`${pref.category}: ${pref.description}`);
  }
  await rebuildGlobalSummary();
  return { promoted, skipped, alreadyGlobal };
}
async function listGlobalPreferences() {
  if (!existsSync(GLOBAL_PREFS_DIR)) return [];
  const files = await readdir(GLOBAL_PREFS_DIR);
  const prefs = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const content = await readFile(join(GLOBAL_PREFS_DIR, file), "utf-8");
      prefs.push(JSON.parse(content));
    } catch {
    }
  }
  return prefs.sort((a, b) => b.confidence - a.confidence);
}
async function seedFromGlobal(outputDir) {
  await initMemory(outputDir);
  const globalPrefs = await listGlobalPreferences();
  const localPrefs = await listPreferences(outputDir);
  const localIndex = new Set(
    localPrefs.map((p) => `${p.expectation.property}|${p.expectation.operator}|${p.expectation.value}`)
  );
  const seeded = [];
  let skipped = 0;
  for (const pref of globalPrefs) {
    const key = `${pref.expectation.property}|${pref.expectation.operator}|${pref.expectation.value}`;
    if (localIndex.has(key)) {
      skipped++;
      continue;
    }
    await addPreference(outputDir, {
      description: pref.description,
      category: pref.category,
      source: "learned",
      componentType: pref.componentType,
      property: pref.expectation.property,
      operator: pref.expectation.operator,
      value: pref.expectation.value,
      confidence: 0.7
      // Lower than locally-learned (0.8)
    });
    seeded.push(`${pref.category}: ${pref.description}`);
  }
  return { seeded, skipped };
}
async function rebuildGlobalSummary() {
  const prefs = await listGlobalPreferences();
  const byCategory = {};
  for (const pref of prefs) {
    byCategory[pref.category] = (byCategory[pref.category] || 0) + 1;
  }
  const summary = {
    version: 1,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    totalPreferences: prefs.length,
    byCategory,
    preferences: prefs.slice(0, MAX_ACTIVE_PREFERENCES).map((p) => ({
      id: p.id,
      description: p.description,
      category: p.category,
      property: p.expectation.property,
      operator: p.expectation.operator,
      value: p.expectation.value,
      confidence: p.confidence
    }))
  };
  await writeFile(GLOBAL_SUMMARY, JSON.stringify(summary, null, 2));
}
async function removeGlobalPreference(prefId) {
  const prefPath = join(GLOBAL_PREFS_DIR, `${prefId}.json`);
  if (!existsSync(prefPath)) return false;
  await unlink(prefPath);
  await rebuildGlobalSummary();
  return true;
}
function formatGlobalMemory(prefs) {
  if (prefs.length === 0) return "No global preferences. Run `memory:promote` to promote local patterns.";
  const lines = [
    `Global Memory: ${prefs.length} preferences`,
    `Location: ${GLOBAL_DIR}`,
    ""
  ];
  const byCategory = /* @__PURE__ */ new Map();
  for (const p of prefs) {
    const arr = byCategory.get(p.category) || [];
    arr.push(p);
    byCategory.set(p.category, arr);
  }
  for (const [cat, catPrefs] of byCategory) {
    lines.push(`  ${cat} (${catPrefs.length}):`);
    for (const p of catPrefs) {
      lines.push(`    ${p.id}: ${p.description} [${Math.round(p.confidence * 100)}%]`);
    }
  }
  return lines.join("\n");
}
var MEMORY_DIR, SUMMARY_FILE, PREFERENCES_DIR, LEARNED_DIR, ARCHIVE_DIR, PREF_PREFIX, LEARN_PREFIX, MAX_ACTIVE_PREFERENCES, GLOBAL_DIR, GLOBAL_PREFS_DIR, GLOBAL_SUMMARY, GLOBAL_PROMOTION_THRESHOLD;
var init_memory = __esm({
  "src/memory.ts"() {
    MEMORY_DIR = "memory";
    SUMMARY_FILE = "summary.json";
    PREFERENCES_DIR = "preferences";
    LEARNED_DIR = "learned";
    ARCHIVE_DIR = "archive";
    PREF_PREFIX = "pref_";
    LEARN_PREFIX = "learn_";
    MAX_ACTIVE_PREFERENCES = 50;
    GLOBAL_DIR = join(homedir(), ".ibr", "global-memory");
    GLOBAL_PREFS_DIR = join(GLOBAL_DIR, "preferences");
    GLOBAL_SUMMARY = join(GLOBAL_DIR, "summary.json");
    GLOBAL_PROMOTION_THRESHOLD = 0.9;
  }
});

// src/design-system/principles/gestalt.ts
var gestaltRules;
var init_gestalt = __esm({
  "src/design-system/principles/gestalt.ts"() {
    gestaltRules = [
      {
        id: "calm-precision/gestalt-grouping",
        name: "Gestalt: Border Grouping",
        description: "Related items should be grouped with a single border, not individually bordered",
        defaultSeverity: "error",
        check: (element, _context) => {
          const style = element.computedStyles;
          if (!style) return null;
          const hasBorder = style.border && style.border !== "none" && style.border !== "0px";
          const borderWidth = style["border-width"];
          const hasBorderWidth = borderWidth && borderWidth !== "0px";
          const isListItem = element.tagName === "li" || element.selector?.includes("item") && !element.selector?.includes("item-");
          if ((hasBorder || hasBorderWidth) && isListItem) {
            return {
              ruleId: "calm-precision/gestalt-grouping",
              ruleName: "Gestalt: Border Grouping",
              severity: "error",
              message: `List item "${(element.text || "").slice(0, 40)}" has individual border. Group related items with a single container border.`,
              element: element.selector,
              bounds: element.bounds,
              fix: "Use single border around the group container with dividers between items, not individual item borders."
            };
          }
          return null;
        }
      }
    ];
  }
});

// src/design-system/principles/signal-noise.ts
var signalNoiseRules;
var init_signal_noise = __esm({
  "src/design-system/principles/signal-noise.ts"() {
    signalNoiseRules = [
      {
        id: "calm-precision/signal-noise-status",
        name: "Signal-to-Noise: Status Indication",
        description: "Status should use text color only, not background badges",
        defaultSeverity: "error",
        check: (element, _context) => {
          const style = element.computedStyles;
          if (!style) return null;
          const text = (element.text || "").toLowerCase();
          const isStatus = /\b(success|error|warning|pending|active|inactive|status|failed|completed|approved|rejected)\b/i.test(text);
          if (!isStatus) return null;
          const bg = style.backgroundColor || style["background-color"];
          if (!bg || bg === "transparent" || bg === "rgba(0, 0, 0, 0)") return null;
          const subtleMatch = bg.match(/rgba?\([^)]*,\s*(0\.(?:0[0-9]|1[0-4]))\)/);
          if (subtleMatch) return null;
          return {
            ruleId: "calm-precision/signal-noise-status",
            ruleName: "Signal-to-Noise: Status Indication",
            severity: "error",
            message: `Status element "${text.slice(0, 30)}" has heavy background (${bg}). Use text color only for status.`,
            element: element.selector,
            bounds: element.bounds,
            fix: "Remove background color. Use text color (green for success, red for error, yellow for warning) instead of background badges."
          };
        }
      }
    ];
  }
});

// src/design-system/principles/fitts.ts
var fittsRules;
var init_fitts = __esm({
  "src/design-system/principles/fitts.ts"() {
    fittsRules = [
      {
        id: "calm-precision/fitts-button-sizing",
        name: "Fitts' Law: Button Sizing",
        description: "Primary action buttons should be prominently sized",
        defaultSeverity: "warn",
        check: (element, _context) => {
          if (element.tagName !== "button" && element.a11y?.role !== "button") return null;
          const text = (element.text || "").toLowerCase();
          const isPrimary = /\b(submit|save|confirm|checkout|buy|sign.?up|log.?in|register|continue|create|publish|send)\b/i.test(text);
          if (!isPrimary) return null;
          const width = element.bounds?.width || 0;
          if (width > 0 && width < 120) {
            return {
              ruleId: "calm-precision/fitts-button-sizing",
              ruleName: "Fitts' Law: Button Sizing",
              severity: "warn",
              message: `Primary action "${text.slice(0, 30)}" is ${width}px wide. Primary actions should be more prominent.`,
              element: element.selector,
              bounds: element.bounds,
              fix: "Increase button width. Primary actions should be the most prominent interactive element."
            };
          }
          return null;
        }
      }
    ];
  }
});

// src/design-system/principles/hick.ts
var hickRules;
var init_hick = __esm({
  "src/design-system/principles/hick.ts"() {
    hickRules = [
      {
        id: "calm-precision/hick-choice-count",
        name: "Hick's Law: Choice Count",
        description: "Limit visible choices to reduce decision time",
        defaultSeverity: "warn",
        check: (element, context) => {
          if (!element.interactive?.hasOnClick && !element.interactive?.hasHref) return null;
          const y = element.bounds?.y || 0;
          const siblings = context.allElements.filter((el) => {
            if (!el.interactive?.hasOnClick && !el.interactive?.hasHref) return false;
            const elY = el.bounds?.y || 0;
            return Math.abs(elY - y) < 20;
          });
          if (siblings.length > 7 && siblings[0]?.selector === element.selector) {
            return {
              ruleId: "calm-precision/hick-choice-count",
              ruleName: "Hick's Law: Choice Count",
              severity: "warn",
              message: `${siblings.length} interactive elements in one visual row. Consider progressive disclosure (max 5-7 visible).`,
              element: element.selector,
              bounds: element.bounds,
              fix: 'Group less-used options behind a "More" menu or overflow. Show max 5-7 choices at once.'
            };
          }
          return null;
        }
      }
    ];
  }
});

// src/design-system/principles/content-chrome.ts
var contentChromeRules;
var init_content_chrome = __esm({
  "src/design-system/principles/content-chrome.ts"() {
    contentChromeRules = [
      {
        id: "calm-precision/content-chrome-ratio",
        name: "Content >= Chrome",
        description: "Content area should be at least 70% of the viewport",
        defaultSeverity: "warn",
        check: (element, context) => {
          if (context.allElements[0]?.selector !== element.selector) return null;
          const viewportArea = context.viewportWidth * context.viewportHeight;
          if (viewportArea === 0) return null;
          const chromeSelectors = /\b(nav|header|footer|sidebar|toolbar|menu|breadcrumb|tabs)\b/i;
          let chromeArea = 0;
          for (const el of context.allElements) {
            const isChrome = chromeSelectors.test(el.tagName) || chromeSelectors.test(el.selector || "") || chromeSelectors.test(el.a11y?.role || "");
            if (isChrome && el.bounds) {
              chromeArea += el.bounds.width * el.bounds.height;
            }
          }
          const chromePercent = chromeArea / viewportArea * 100;
          if (chromePercent > 30) {
            return {
              ruleId: "calm-precision/content-chrome-ratio",
              ruleName: "Content >= Chrome",
              severity: "warn",
              message: `Chrome elements occupy ~${Math.round(chromePercent)}% of viewport. Content should be >= 70%.`,
              fix: "Reduce navigation/toolbar/sidebar chrome. Consider collapsible panels or minimized navigation."
            };
          }
          return null;
        }
      }
    ];
  }
});

// src/design-system/principles/cognitive-load.ts
var cognitiveLoadRules;
var init_cognitive_load = __esm({
  "src/design-system/principles/cognitive-load.ts"() {
    cognitiveLoadRules = [
      {
        id: "calm-precision/cognitive-load-elements",
        name: "Cognitive Load: Element Count",
        description: "Visual groups should have 5-7 items max to stay within working memory limits",
        defaultSeverity: "warn",
        check: (element, context) => {
          if (element.interactive?.hasOnClick || element.interactive?.hasHref) return null;
          if (!element.bounds) return null;
          const { x, y, width, height } = element.bounds;
          const children = context.allElements.filter((el) => {
            if (el.selector === element.selector) return false;
            if (!el.interactive?.hasOnClick && !el.interactive?.hasHref) return false;
            if (!el.bounds) return false;
            return el.bounds.x >= x && el.bounds.y >= y && el.bounds.x + el.bounds.width <= x + width && el.bounds.y + el.bounds.height <= y + height;
          });
          if (children.length > 10) {
            return {
              ruleId: "calm-precision/cognitive-load-elements",
              ruleName: "Cognitive Load: Element Count",
              severity: "warn",
              message: `Container has ${children.length} interactive elements. Consider grouping or progressive disclosure (5-7 max per group).`,
              element: element.selector,
              bounds: element.bounds,
              fix: 'Group related actions. Use sections, tabs, or "Show more" to reduce visible elements per group.'
            };
          }
          return null;
        }
      }
    ];
  }
});

// src/design-system/principles/calm-precision.ts
var allCalmPrecisionRules, corePrincipleIds, stylisticPrincipleIds, principleToRules;
var init_calm_precision = __esm({
  "src/design-system/principles/calm-precision.ts"() {
    init_gestalt();
    init_signal_noise();
    init_fitts();
    init_hick();
    init_content_chrome();
    init_cognitive_load();
    allCalmPrecisionRules = [
      ...gestaltRules,
      ...signalNoiseRules,
      ...fittsRules,
      ...hickRules,
      ...contentChromeRules,
      ...cognitiveLoadRules
    ];
    corePrincipleIds = ["gestalt", "signal-noise", "content-chrome", "cognitive-load"];
    stylisticPrincipleIds = ["fitts", "hick"];
    principleToRules = {
      "gestalt": gestaltRules.map((r) => r.id),
      "signal-noise": signalNoiseRules.map((r) => r.id),
      "fitts": fittsRules.map((r) => r.id),
      "hick": hickRules.map((r) => r.id),
      "content-chrome": contentChromeRules.map((r) => r.id),
      "cognitive-load": cognitiveLoadRules.map((r) => r.id)
    };
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
        const isInteractive2 = element.interactive.hasOnClick || element.interactive.hasHref;
        if (!isInteractive2) return null;
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
        const isInteractive2 = element.interactive.hasOnClick || element.interactive.hasHref;
        if (!isInteractive2) return null;
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

// src/rules/presets/calm-precision.ts
var calm_precision_exports = {};
__export(calm_precision_exports, {
  register: () => register2
});
function register2() {
  const defaults = {};
  for (const rule of allCalmPrecisionRules) {
    const isCore = corePrincipleIds.some(
      (pid) => principleToRules[pid]?.includes(rule.id)
    );
    defaults[rule.id] = isCore ? "error" : "warn";
  }
  registerPreset({
    name: "calm-precision",
    description: "Calm Precision design principles \u2014 Gestalt, Signal-to-Noise, Fitts, Hick, Content-Chrome, Cognitive Load",
    rules: allCalmPrecisionRules,
    defaults
  });
}
var init_calm_precision2 = __esm({
  "src/rules/presets/calm-precision.ts"() {
    init_engine();
    init_calm_precision();
  }
});

// src/rules/presets/wcag-contrast.ts
var wcag_contrast_exports = {};
__export(wcag_contrast_exports, {
  register: () => register3,
  wcagContrastPresetRules: () => wcagContrastPresetRules
});
function parseColor5(color) {
  if (!color || color === "transparent" || color === "initial" || color === "inherit" || color === "unset") {
    return null;
  }
  const rgbaMatch = color.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([\d.]+))?\s*\)$/);
  if (rgbaMatch) {
    const alpha = rgbaMatch[4] !== void 0 ? parseFloat(rgbaMatch[4]) : 1;
    if (alpha === 0) return null;
    return [parseInt(rgbaMatch[1], 10), parseInt(rgbaMatch[2], 10), parseInt(rgbaMatch[3], 10)];
  }
  const hex6Match = color.match(/^#([0-9a-fA-F]{6})$/);
  if (hex6Match) {
    const n = parseInt(hex6Match[1], 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  const hex3Match = color.match(/^#([0-9a-fA-F]{3})$/);
  if (hex3Match) {
    const r = parseInt(hex3Match[1][0], 16) * 17;
    const g = parseInt(hex3Match[1][1], 16) * 17;
    const b = parseInt(hex3Match[1][2], 16) * 17;
    return [r, g, b];
  }
  return null;
}
function linearize3(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function relativeLuminance4(r, g, b) {
  return 0.2126 * linearize3(r) + 0.7152 * linearize3(g) + 0.0722 * linearize3(b);
}
function contrastRatio4(fg, bg) {
  const l1 = relativeLuminance4(...fg);
  const l2 = relativeLuminance4(...bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
function isLargeText3(styles) {
  const fontSizeStr = styles.fontSize ?? "";
  const fontWeightStr = styles.fontWeight ?? "";
  const fontSize = parseFloat(fontSizeStr);
  if (isNaN(fontSize)) return false;
  const isBold = fontWeightStr === "bold" || parseInt(fontWeightStr, 10) >= 700;
  return fontSize >= 18 || isBold && fontSize >= 14;
}
function register3() {
  const defaults = {
    "wcag-aa-contrast": "error",
    "wcag-aaa-contrast": "warn"
  };
  registerPreset({
    name: "wcag-contrast",
    description: "WCAG 2.1 contrast ratio checks \u2014 AA (4.5:1 / 3:1) and AAA (7:1 / 4.5:1)",
    rules: wcagContrastPresetRules,
    defaults
  });
}
var wcagAAContrastRule, wcagAAAContrastRule, wcagContrastPresetRules;
var init_wcag_contrast = __esm({
  "src/rules/presets/wcag-contrast.ts"() {
    init_engine();
    wcagAAContrastRule = {
      id: "wcag-aa-contrast",
      name: "WCAG 2.1 AA Contrast",
      description: "Text must meet WCAG 2.1 AA contrast ratio: 4.5:1 normal text, 3:1 large text",
      defaultSeverity: "error",
      check(element, _context) {
        const style = element.computedStyles;
        if (!style) return null;
        const hasText = element.text && element.text.trim().length > 0;
        if (!hasText) return null;
        const fg = parseColor5(style.color ?? "");
        const bg = parseColor5(style.backgroundColor ?? "");
        if (!fg || !bg) return null;
        const ratio = contrastRatio4(fg, bg);
        const large = isLargeText3(style);
        const required = large ? 3 : 4.5;
        if (ratio < required) {
          const ratioStr = ratio.toFixed(2);
          const textSnippet = (element.text ?? "").slice(0, 40);
          return {
            ruleId: "wcag-aa-contrast",
            ruleName: "WCAG 2.1 AA Contrast",
            severity: "error",
            message: `"${textSnippet}" contrast ratio ${ratioStr}:1 fails WCAG 2.1 AA (requires ${required}:1 for ${large ? "large" : "normal"} text)`,
            element: element.selector,
            bounds: element.bounds,
            fix: `Increase contrast between foreground ${style.color ?? ""} and background ${style.backgroundColor ?? ""}`
          };
        }
        return null;
      }
    };
    wcagAAAContrastRule = {
      id: "wcag-aaa-contrast",
      name: "WCAG 2.1 AAA Contrast",
      description: "Text should meet WCAG 2.1 AAA contrast ratio: 7:1 normal text, 4.5:1 large text",
      defaultSeverity: "warn",
      check(element, _context) {
        const style = element.computedStyles;
        if (!style) return null;
        const hasText = element.text && element.text.trim().length > 0;
        if (!hasText) return null;
        const fg = parseColor5(style.color ?? "");
        const bg = parseColor5(style.backgroundColor ?? "");
        if (!fg || !bg) return null;
        const ratio = contrastRatio4(fg, bg);
        const large = isLargeText3(style);
        const required = large ? 4.5 : 7;
        if (ratio < required) {
          const ratioStr = ratio.toFixed(2);
          const textSnippet = (element.text ?? "").slice(0, 40);
          return {
            ruleId: "wcag-aaa-contrast",
            ruleName: "WCAG 2.1 AAA Contrast",
            severity: "warn",
            message: `"${textSnippet}" contrast ratio ${ratioStr}:1 below WCAG 2.1 AAA (${required}:1 for ${large ? "large" : "normal"} text)`,
            element: element.selector,
            bounds: element.bounds,
            fix: `Increase contrast between foreground ${style.color ?? ""} and background ${style.backgroundColor ?? ""} to ${required}:1`
          };
        }
        return null;
      }
    };
    wcagContrastPresetRules = [wcagAAContrastRule, wcagAAAContrastRule];
  }
});

// src/rules/presets/touch-targets.ts
var touch_targets_exports = {};
__export(touch_targets_exports, {
  register: () => register4,
  touchTargetPresetRules: () => touchTargetPresetRules
});
function isInteractive(el) {
  const role = el.a11y.role ?? "";
  const tag = (el.tagName ?? "").toLowerCase();
  const interactiveRoles = /* @__PURE__ */ new Set([
    "button",
    "link",
    "menuitem",
    "tab",
    "checkbox",
    "radio",
    "switch",
    "textbox",
    "combobox",
    "slider"
  ]);
  if (interactiveRoles.has(role)) return true;
  if (["a", "button", "input", "select", "textarea"].includes(tag)) return true;
  if (el.interactive.hasOnClick || el.interactive.hasHref || el.interactive.hasReactHandler === true || el.interactive.hasVueHandler === true || el.interactive.hasAngularHandler === true) {
    return true;
  }
  return false;
}
function register4() {
  const defaults = {
    "touch-target-mobile": "error",
    "touch-target-desktop": "warn"
  };
  registerPreset({
    name: "touch-targets",
    description: "Minimum touch and pointer target sizes \u2014 WCAG 2.5.5 (mobile 44px) and WCAG 2.5.8 (desktop 24px)",
    rules: touchTargetPresetRules,
    defaults
  });
}
var mobileTouchTargetRule, desktopPointerTargetRule, touchTargetPresetRules;
var init_touch_targets = __esm({
  "src/rules/presets/touch-targets.ts"() {
    init_engine();
    mobileTouchTargetRule = {
      id: "touch-target-mobile",
      name: "Mobile Touch Target Size",
      description: "Interactive elements must be at least 44x44px on mobile viewports (WCAG 2.5.5 AAA / Apple HIG)",
      defaultSeverity: "error",
      check(element, context) {
        if (!context.isMobile) return null;
        if (!isInteractive(element)) return null;
        const { width, height } = element.bounds;
        if (width === 0 || height === 0) return null;
        const MIN = 44;
        if (width < MIN || height < MIN) {
          return {
            ruleId: "touch-target-mobile",
            ruleName: "Mobile Touch Target Size",
            severity: "error",
            message: `"${element.text || element.selector}" touch target is ${width}x${height}px (minimum ${MIN}x${MIN}px)`,
            element: element.selector,
            bounds: element.bounds,
            fix: `Increase element size to at least ${MIN}x${MIN}px (WCAG 2.5.5 / Apple HIG)`
          };
        }
        return null;
      }
    };
    desktopPointerTargetRule = {
      id: "touch-target-desktop",
      name: "Desktop Pointer Target Size",
      description: "Interactive elements should be at least 24x24px on desktop viewports (WCAG 2.5.8 AA)",
      defaultSeverity: "warn",
      check(element, context) {
        if (context.isMobile) return null;
        if (!isInteractive(element)) return null;
        const { width, height } = element.bounds;
        if (width === 0 || height === 0) return null;
        const MIN = 24;
        if (width < MIN || height < MIN) {
          return {
            ruleId: "touch-target-desktop",
            ruleName: "Desktop Pointer Target Size",
            severity: "warn",
            message: `"${element.text || element.selector}" pointer target is ${width}x${height}px (minimum ${MIN}x${MIN}px per WCAG 2.5.8)`,
            element: element.selector,
            bounds: element.bounds,
            fix: `Increase element size to at least ${MIN}x${MIN}px (WCAG 2.5.8)`
          };
        }
        return null;
      }
    };
    touchTargetPresetRules = [mobileTouchTargetRule, desktopPointerTargetRule];
  }
});

// src/rules/engine.ts
function registerPreset(preset) {
  presets.set(preset.name, preset);
}
function mergeRuleSettings(presetNames, userRules = {}) {
  const allRules2 = [];
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
        allRules2.push(rule);
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
  return { rules: allRules2, settings };
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
var presets;
var init_engine = __esm({
  "src/rules/engine.ts"() {
    presets = /* @__PURE__ */ new Map();
    Promise.resolve().then(() => (init_minimal(), minimal_exports)).then((m) => m.register()).catch(() => {
    });
    Promise.resolve().then(() => (init_calm_precision2(), calm_precision_exports)).then((m) => m.register()).catch(() => {
    });
    Promise.resolve().then(() => (init_wcag_contrast(), wcag_contrast_exports)).then((m) => m.register()).catch(() => {
    });
    Promise.resolve().then(() => (init_touch_targets(), touch_targets_exports)).then((m) => m.register()).catch(() => {
    });
  }
});
var ViewportSchema = z.object({
  name: z.string().min(1).max(50),
  width: z.number().min(100).max(3840),
  height: z.number().min(100).max(2160)
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
var ConfigSchema = z.object({
  baseUrl: z.string().url("Must be a valid URL"),
  outputDir: z.string().default("./.ibr"),
  viewport: ViewportSchema.default(VIEWPORTS.desktop),
  viewports: z.array(ViewportSchema).optional(),
  // Multi-viewport support
  threshold: z.number().min(0).max(100).default(1),
  fullPage: z.boolean().default(true),
  waitForNetworkIdle: z.boolean().default(true),
  timeout: z.number().min(1e3).max(12e4).default(3e4),
  browserMode: z.enum(["local", "connect"]).optional(),
  cdpUrl: z.string().url().optional(),
  wsEndpoint: z.string().url().optional(),
  chromePath: z.string().optional()
});
var SessionQuerySchema = z.object({
  route: z.string().optional(),
  url: z.string().optional(),
  status: z.enum(["baseline", "compared", "pending"]).optional(),
  name: z.string().optional(),
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
  viewport: z.string().optional(),
  limit: z.number().min(1).max(100).default(50)
});
var ComparisonResultSchema = z.object({
  match: z.boolean(),
  diffPercent: z.number(),
  diffPixels: z.number(),
  totalPixels: z.number(),
  threshold: z.number()
});
var ChangedRegionSchema = z.object({
  location: z.enum(["top", "bottom", "left", "right", "center", "full"]),
  bounds: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number()
  }),
  description: z.string(),
  severity: z.enum(["expected", "unexpected", "critical"])
});
var VerdictSchema = z.enum([
  "MATCH",
  "EXPECTED_CHANGE",
  "UNEXPECTED_CHANGE",
  "LAYOUT_BROKEN"
]);
var AnalysisSchema = z.object({
  verdict: VerdictSchema,
  summary: z.string(),
  changedRegions: z.array(ChangedRegionSchema),
  unexpectedChanges: z.array(ChangedRegionSchema),
  recommendation: z.string().nullable()
});
var SessionStatusSchema = z.enum(["baseline", "compared", "pending"]);
var BoundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number()
});
var LandmarkElementSchema = z.object({
  name: z.string(),
  // e.g., 'logo', 'header', 'nav'
  selector: z.string(),
  // CSS selector used to find it
  found: z.boolean(),
  bounds: BoundsSchema.optional()
});
var SessionSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().min(1),
  viewport: ViewportSchema,
  status: SessionStatusSchema,
  platform: z.enum(["web", "ios", "watchos"]).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  comparison: ComparisonResultSchema.optional(),
  analysis: AnalysisSchema.optional(),
  // Landmark elements detected at baseline capture
  landmarkElements: z.array(LandmarkElementSchema).optional(),
  // Page intent detected at baseline
  pageIntent: z.string().optional()
});
var ComparisonReportSchema = z.object({
  sessionId: z.string(),
  sessionName: z.string(),
  url: z.string(),
  timestamp: z.string().datetime(),
  viewport: ViewportSchema,
  comparison: ComparisonResultSchema,
  analysis: AnalysisSchema,
  files: z.object({
    baseline: z.string(),
    current: z.string(),
    diff: z.string()
  }),
  webViewUrl: z.string().optional()
});
var InteractiveStateSchema = z.object({
  hasOnClick: z.boolean(),
  hasHref: z.boolean(),
  isDisabled: z.boolean(),
  tabIndex: z.number(),
  cursor: z.string(),
  // Framework-specific detection
  hasReactHandler: z.boolean().optional(),
  hasVueHandler: z.boolean().optional(),
  hasAngularHandler: z.boolean().optional()
});
var A11yAttributesSchema = z.object({
  role: z.string().nullable(),
  ariaLabel: z.string().nullable(),
  ariaDescribedBy: z.string().nullable(),
  ariaHidden: z.boolean().optional()
});
var EnhancedElementSchema = z.object({
  // Identity
  selector: z.string(),
  tagName: z.string(),
  id: z.string().optional(),
  className: z.string().optional(),
  text: z.string().optional(),
  // Position
  bounds: BoundsSchema,
  // Styles (subset)
  computedStyles: z.record(z.string(), z.string()).optional(),
  // Interactivity
  interactive: InteractiveStateSchema,
  // Accessibility
  a11y: A11yAttributesSchema,
  // Source hints for debugging
  sourceHint: z.object({
    dataTestId: z.string().nullable()
  }).optional()
});
var ElementIssueSchema = z.object({
  type: z.enum([
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
  severity: z.enum(["error", "warning", "info"]),
  message: z.string()
});
var AuditResultSchema = z.object({
  totalElements: z.number(),
  interactiveCount: z.number(),
  withHandlers: z.number(),
  withoutHandlers: z.number(),
  issues: z.array(ElementIssueSchema)
});
var RuleSeveritySchema = z.enum(["off", "warn", "error"]);
var RuleSettingSchema = z.union([
  RuleSeveritySchema,
  z.tuple([RuleSeveritySchema, z.record(z.string(), z.unknown())])
]);
var RulesConfigSchema = z.object({
  extends: z.array(z.string()).optional(),
  rules: z.record(z.string(), RuleSettingSchema).optional()
});
var ViolationSchema = z.object({
  ruleId: z.string(),
  ruleName: z.string(),
  severity: z.enum(["warn", "error"]),
  message: z.string(),
  element: z.string().optional(),
  // Selector of violating element
  bounds: BoundsSchema.optional(),
  fix: z.string().optional()
  // Suggested fix
});
var RuleAuditResultSchema = z.object({
  url: z.string(),
  timestamp: z.string(),
  elementsScanned: z.number(),
  violations: z.array(ViolationSchema),
  summary: z.object({
    errors: z.number(),
    warnings: z.number(),
    passed: z.number()
  })
});
var MemorySourceSchema = z.enum(["user", "learned", "framework"]);
var PreferenceCategorySchema = z.enum([
  "color",
  "layout",
  "typography",
  "navigation",
  "component",
  "spacing",
  "interaction",
  "content"
]);
var ExpectationOperatorSchema = z.enum(["equals", "contains", "matches", "gte", "lte"]);
var ExpectationSchema = z.object({
  property: z.string(),
  operator: ExpectationOperatorSchema,
  value: z.string()
});
var PreferenceSchema = z.object({
  id: z.string(),
  description: z.string(),
  category: PreferenceCategorySchema,
  source: MemorySourceSchema,
  route: z.string().optional(),
  componentType: z.string().optional(),
  expectation: ExpectationSchema,
  confidence: z.number().min(0).max(1).default(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  sessionIds: z.array(z.string()).optional()
});
var ObservationSchema = z.object({
  description: z.string(),
  category: PreferenceCategorySchema,
  property: z.string(),
  value: z.string()
});
var LearnedExpectationSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  route: z.string(),
  observations: z.array(ObservationSchema),
  approved: z.boolean(),
  createdAt: z.string().datetime()
});
var ActivePreferenceSchema = z.object({
  id: z.string(),
  description: z.string(),
  category: PreferenceCategorySchema,
  route: z.string().optional(),
  componentType: z.string().optional(),
  property: z.string(),
  operator: ExpectationOperatorSchema,
  value: z.string(),
  confidence: z.number()
});
var MemorySummarySchema = z.object({
  version: z.literal(1),
  updatedAt: z.string().datetime(),
  stats: z.object({
    totalPreferences: z.number(),
    totalLearned: z.number(),
    byCategory: z.record(z.string(), z.number()),
    bySource: z.record(z.string(), z.number())
  }),
  activePreferences: z.array(ActivePreferenceSchema)
});
var DesignSystemViolationSchema = z.object({
  principleId: z.string(),
  principleName: z.string(),
  severity: z.enum(["error", "warn"]),
  message: z.string(),
  element: z.string().optional(),
  bounds: BoundsSchema.optional(),
  fix: z.string().optional()
});
var DesignSystemResultSchema = z.object({
  configName: z.string(),
  principleViolations: z.array(DesignSystemViolationSchema),
  tokenViolations: z.array(z.object({
    element: z.string(),
    property: z.string(),
    expected: z.union([z.string(), z.number()]),
    actual: z.union([z.string(), z.number()]),
    severity: z.enum(["error", "warning"]),
    message: z.string()
  })),
  customViolations: z.array(DesignSystemViolationSchema),
  complianceScore: z.number().min(0).max(100)
});

// src/engine/cdp/connection.ts
var DEFAULT_TIMEOUT_MS = 3e4;
var CdpConnection = class {
  ws = null;
  nextId = 0;
  pending = /* @__PURE__ */ new Map();
  eventHandlers = /* @__PURE__ */ new Map();
  timeoutMs;
  constructor(options) {
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }
  async connect(wsUrl) {
    return new Promise((resolve3, reject) => {
      const ws = new WebSocket(wsUrl);
      let settled = false;
      const onOpen = () => {
        if (settled) return;
        settled = true;
        this.ws = ws;
        ws.addEventListener("message", (event) => this.handleMessage(event));
        ws.addEventListener("close", () => this.handleClose());
        ws.addEventListener("error", () => this.handleClose());
        resolve3();
      };
      const onError = () => {
        if (settled) return;
        settled = true;
        reject(new Error(`WebSocket connection failed: ${wsUrl}`));
      };
      ws.addEventListener("open", onOpen);
      ws.addEventListener("error", onError);
    });
  }
  async send(method, params, sessionId) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected");
    }
    const id = ++this.nextId;
    return new Promise((resolve3, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          const secs = (this.timeoutMs / 1e3).toFixed(0);
          reject(new Error(
            `CDP request '${method}' timed out after ${secs}s. The browser may be unresponsive or the operation is taking too long.`
          ));
        }
      }, this.timeoutMs);
      this.pending.set(id, {
        resolve: resolve3,
        reject,
        timer
      });
      const msg = { id, method };
      if (params) msg.params = params;
      if (sessionId) msg.sessionId = sessionId;
      this.ws.send(JSON.stringify(msg));
    });
  }
  on(method, handler) {
    if (!this.eventHandlers.has(method)) {
      this.eventHandlers.set(method, /* @__PURE__ */ new Set());
    }
    this.eventHandlers.get(method).add(handler);
  }
  off(method, handler) {
    this.eventHandlers.get(method)?.delete(handler);
  }
  handleMessage(event) {
    let data;
    try {
      data = JSON.parse(String(event.data));
    } catch {
      return;
    }
    if ("id" in data && this.pending.has(data.id)) {
      const id = data.id;
      const { resolve: resolve3, reject, timer } = this.pending.get(id);
      clearTimeout(timer);
      this.pending.delete(id);
      if (data.error) {
        const err = data.error;
        reject(new Error(`CDP error ${err.code}: ${err.message}`));
      } else {
        resolve3(data.result);
      }
    } else if ("method" in data) {
      const handlers = this.eventHandlers.get(data.method);
      if (handlers) {
        for (const handler of handlers) handler(data.params);
      }
    }
  }
  handleClose() {
    for (const [, { reject, timer }] of this.pending) {
      clearTimeout(timer);
      reject(new Error("WebSocket closed"));
    }
    this.pending.clear();
    this.ws = null;
  }
  async close() {
    for (const [, { timer }] of this.pending) {
      clearTimeout(timer);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.pending.clear();
  }
  get connected() {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
};
var CHROME_PATHS = [
  // macOS
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  // Linux
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  // Windows (WSL)
  "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
];
function findChrome() {
  for (const p of CHROME_PATHS) {
    if (existsSync(p)) return p;
  }
  return null;
}
function randomPort() {
  return 49152 + Math.floor(Math.random() * (65535 - 49152));
}
async function findFreePort(maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const port = randomPort();
    const isFree = await checkPortFree(port);
    if (isFree) return port;
  }
  return new Promise((resolve3, reject) => {
    const srv = createServer();
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close(() => resolve3(port));
    });
    srv.on("error", reject);
  });
}
function checkPortFree(port) {
  return new Promise((resolve3) => {
    const srv = createServer();
    srv.once("error", () => resolve3(false));
    srv.listen(port, () => srv.close(() => resolve3(true)));
  });
}
async function resolveWsEndpoint(cdpUrl) {
  const res = await fetch(`${cdpUrl}/json/version`);
  if (!res.ok) {
    throw new Error(`CDP endpoint did not respond: ${cdpUrl}`);
  }
  const data = await res.json();
  if (!data.webSocketDebuggerUrl) {
    throw new Error(`CDP endpoint did not return a WebSocket URL: ${cdpUrl}`);
  }
  return data.webSocketDebuggerUrl;
}
function resolveBrowserConnectionOptions(options = {}, env = process.env) {
  const wsEndpoint = options.wsEndpoint || env.IBR_WS_ENDPOINT;
  const cdpUrl = options.cdpUrl || env.IBR_CDP_URL;
  const requestedMode = options.mode || env.IBR_BROWSER_MODE;
  const mode = requestedMode === "local" ? "local" : requestedMode === "connect" || wsEndpoint || cdpUrl ? "connect" : "local";
  return {
    mode,
    cdpUrl,
    wsEndpoint,
    chromePath: options.chromePath || env.IBR_CHROME_PATH
  };
}
var BrowserManager = class {
  process = null;
  _port = 0;
  _mode = "local";
  _cdpUrl = null;
  _wsEndpoint = null;
  async launch(options = {}) {
    const connection = resolveBrowserConnectionOptions(options);
    this._mode = connection.mode;
    if (connection.mode === "connect") {
      this.process = null;
      this._port = 0;
      this._cdpUrl = connection.cdpUrl ?? null;
      if (connection.wsEndpoint) {
        this._wsEndpoint = connection.wsEndpoint;
        return connection.wsEndpoint;
      }
      if (connection.cdpUrl) {
        const wsUrl2 = await resolveWsEndpoint(connection.cdpUrl);
        this._wsEndpoint = wsUrl2;
        return wsUrl2;
      }
      throw new Error(
        "Connect mode requires a CDP endpoint.\nProvide --cdp-url http://127.0.0.1:9222 or --ws-endpoint ws://...\nYou can also set IBR_CDP_URL or IBR_WS_ENDPOINT."
      );
    }
    const headless = options.headless ?? true;
    this._port = options.port ?? await findFreePort();
    let userDataDir = options.userDataDir ?? join(homedir(), ".ibr", "chromium-profile");
    const lockPath = join(userDataDir, "SingletonLock");
    if (existsSync(lockPath)) {
      userDataDir = mkdtempSync(join(tmpdir(), "ibr-chrome-"));
    }
    const chromePath = connection.chromePath ?? findChrome();
    if (!chromePath) {
      throw new Error(
        `Chrome not found. Install Google Chrome or pass chromePath option.
Checked: ${CHROME_PATHS.join(", ")}`
      );
    }
    await mkdir(userDataDir, { recursive: true });
    const args = [
      `--remote-debugging-port=${this._port}`,
      `--user-data-dir=${userDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-sync"
    ];
    if (headless) {
      args.push("--headless=new");
    }
    if (options.normalize) {
      args.push("--disable-lcd-text");
      args.push("--force-device-scale-factor=1");
    }
    this.process = spawn(chromePath, args, { stdio: "pipe" });
    this.process.on("error", (err) => {
      console.error(`Chrome process error: ${err.message}`);
    });
    const wsUrl = await this.waitForDebugger();
    this._cdpUrl = `http://127.0.0.1:${this._port}`;
    this._wsEndpoint = wsUrl;
    return wsUrl;
  }
  async waitForDebugger() {
    const maxAttempts = 50;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${this._port}/json/version`);
        const data = await res.json();
        return data.webSocketDebuggerUrl;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    throw new Error(
      `Chrome debugger did not respond within 5s on port ${this._port}. Is another Chrome instance using this port?
If you are running inside a sandbox, retry with connect mode:
  --browser-mode connect --cdp-url http://127.0.0.1:9222`
    );
  }
  async close() {
    if (this._mode !== "local" || !this.process) return;
    const proc = this.process;
    this.process = null;
    await new Promise((resolve3) => {
      const killTimer = setTimeout(() => {
        try {
          proc.kill("SIGKILL");
        } catch {
        }
        resolve3();
      }, 3e3);
      proc.once("close", () => {
        clearTimeout(killTimer);
        resolve3();
      });
      proc.kill("SIGTERM");
    });
  }
  get running() {
    return this.process !== null && !this.process.killed;
  }
  get port() {
    return this._port;
  }
  get pid() {
    return this.process?.pid ?? null;
  }
  get mode() {
    return this._mode;
  }
  get cdpUrl() {
    return this._cdpUrl;
  }
  get wsEndpoint() {
    return this._wsEndpoint;
  }
};

// src/engine/cdp/target.ts
var TargetDomain = class {
  constructor(conn) {
    this.conn = conn;
  }
  async createPage(url) {
    const result = await this.conn.send(
      "Target.createTarget",
      { url }
    );
    return result.targetId;
  }
  async attach(targetId) {
    const result = await this.conn.send(
      "Target.attachToTarget",
      { targetId, flatten: true }
    );
    return result.sessionId;
  }
  async close(targetId) {
    await this.conn.send("Target.closeTarget", { targetId });
  }
  async list() {
    const result = await this.conn.send("Target.getTargets");
    return result.targetInfos;
  }
};

// src/engine/cdp/page.ts
var PageDomain = class {
  constructor(conn, sessionId) {
    this.conn = conn;
    this.sessionId = sessionId;
  }
  async navigate(url) {
    const result = await this.conn.send(
      "Page.navigate",
      { url },
      this.sessionId
    );
    return result.frameId;
  }
  async screenshot(options = {}) {
    const format = options.format ?? "png";
    if (options.fullPage) {
      return this.fullPageScreenshot(format, options.quality);
    }
    const params = { format };
    if (options.quality !== void 0) params.quality = options.quality;
    if (options.clip) {
      params.clip = { ...options.clip, scale: options.clip.scale ?? 1 };
    }
    const result = await this.conn.send(
      "Page.captureScreenshot",
      params,
      this.sessionId
    );
    return Buffer.from(result.data, "base64");
  }
  /**
   * Full-page screenshot via getLayoutMetrics + device metrics override.
   * Technique: get content size → override viewport to content size →
   * capture with captureBeyondViewport → restore viewport.
   */
  async fullPageScreenshot(format, quality) {
    const metrics = await this.getLayoutMetrics();
    const { width, height } = metrics.contentSize;
    await this.conn.send("Emulation.setDeviceMetricsOverride", {
      width: Math.ceil(width),
      height: Math.ceil(height),
      deviceScaleFactor: 1,
      mobile: false
    }, this.sessionId);
    try {
      const params = {
        format,
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width, height, scale: 1 }
      };
      if (quality !== void 0) params.quality = quality;
      const result = await this.conn.send(
        "Page.captureScreenshot",
        params,
        this.sessionId
      );
      return Buffer.from(result.data, "base64");
    } finally {
      await this.conn.send("Emulation.clearDeviceMetricsOverride", {}, this.sessionId);
    }
  }
  async getLayoutMetrics() {
    return this.conn.send(
      "Page.getLayoutMetrics",
      {},
      this.sessionId
    );
  }
  async enableLifecycleEvents() {
    await this.conn.send("Page.setLifecycleEventsEnabled", { enabled: true }, this.sessionId);
    await this.conn.send("Page.enable", {}, this.sessionId);
  }
  /**
   * Inject CSS into the page.
   * Uses callFunctionOn with CSS passed as a proper argument (not interpolated)
   * to avoid injection issues with special characters in CSS content.
   */
  async addStyleTag(css) {
    const docResult = await this.conn.send("Runtime.evaluate", {
      expression: "document",
      returnByValue: false
    }, this.sessionId);
    await this.conn.send("Runtime.callFunctionOn", {
      functionDeclaration: '(cssText) => { const style = document.createElement("style"); style.textContent = cssText; document.head.appendChild(style); }',
      objectId: docResult.result.objectId,
      arguments: [{ value: css }],
      returnByValue: true
    }, this.sessionId);
  }
  /**
   * Inject script that runs on every navigation (including future ones).
   * Uses Page.addScriptToEvaluateOnNewDocument.
   */
  async addScriptOnLoad(source) {
    const result = await this.conn.send(
      "Page.addScriptToEvaluateOnNewDocument",
      { source },
      this.sessionId
    );
    return result.identifier;
  }
};

// src/engine/normalize.ts
var WEB_ROLES = {
  button: "button",
  textbox: "textfield",
  TextField: "textfield",
  link: "link",
  checkbox: "checkbox",
  switch: "switch",
  slider: "slider",
  tab: "tab",
  combobox: "select",
  listbox: "select",
  heading: "heading",
  img: "image",
  image: "image",
  StaticText: "text",
  group: "group",
  generic: "group",
  navigation: "group",
  main: "group",
  contentinfo: "group",
  banner: "group",
  form: "group",
  search: "group",
  region: "group",
  article: "group",
  section: "group",
  complementary: "group"
};
function normalizeRole(rawRole, platform) {
  return WEB_ROLES[rawRole] ?? "group";
}

// src/engine/cdp/accessibility.ts
var SKIP_ROLES = /* @__PURE__ */ new Set(["WebArea", "RootWebArea", "GenericContainer", "none", "IgnoredRole"]);
var AccessibilityDomain = class {
  constructor(conn, sessionId) {
    this.conn = conn;
    this.sessionId = sessionId;
  }
  nodeMap = /* @__PURE__ */ new Map();
  // elementId → backendDOMNodeId
  loadCompleteHandlers = /* @__PURE__ */ new Set();
  nodesUpdatedHandlers = /* @__PURE__ */ new Set();
  enabled = false;
  // Stored references for cleanup
  loadCompleteListener = null;
  nodesUpdatedListener = null;
  async enable() {
    if (this.enabled) return;
    this.enabled = true;
    await this.conn.send("Accessibility.enable", {}, this.sessionId);
    this.loadCompleteListener = () => {
      for (const handler of this.loadCompleteHandlers) handler();
    };
    this.nodesUpdatedListener = (params) => {
      const { nodes } = params;
      for (const handler of this.nodesUpdatedHandlers) handler(nodes);
    };
    this.conn.on("Accessibility.loadComplete", this.loadCompleteListener);
    this.conn.on("Accessibility.nodesUpdated", this.nodesUpdatedListener);
  }
  async disable() {
    if (!this.enabled) return;
    this.enabled = false;
    if (this.loadCompleteListener) {
      this.conn.off("Accessibility.loadComplete", this.loadCompleteListener);
      this.loadCompleteListener = null;
    }
    if (this.nodesUpdatedListener) {
      this.conn.off("Accessibility.nodesUpdated", this.nodesUpdatedListener);
      this.nodesUpdatedListener = null;
    }
  }
  async getSnapshot() {
    const result = await this.conn.send(
      "Accessibility.getFullAXTree",
      {},
      this.sessionId
    );
    return this.convertToElements(result.nodes);
  }
  /**
   * queryAXTree — CDP-native search by accessible name and/or role.
   * Faster than getFullAXTree + filter for targeted element finding.
   * Note: does NOT clear/repopulate nodeMap — merges into existing map.
   */
  async queryAXTree(options) {
    const params = {};
    if (options.accessibleName) params.accessibleName = options.accessibleName;
    if (options.role) params.role = options.role;
    if (options.backendNodeId) {
      params.backendNodeId = options.backendNodeId;
    } else {
      const doc = await this.conn.send(
        "DOM.getDocument",
        {},
        this.sessionId
      );
      params.nodeId = doc.root.nodeId;
    }
    try {
      const result = await this.conn.send(
        "Accessibility.queryAXTree",
        params,
        this.sessionId
      );
      return this.convertToElements(result.nodes, false);
    } catch {
      return [];
    }
  }
  getBackendNodeId(elementId) {
    return this.nodeMap.get(elementId);
  }
  /** Subscribe to Accessibility.loadComplete events. */
  onLoadComplete(handler) {
    this.loadCompleteHandlers.add(handler);
  }
  /** Subscribe to Accessibility.nodesUpdated events. */
  onNodesUpdated(handler) {
    this.nodesUpdatedHandlers.add(handler);
  }
  offLoadComplete(handler) {
    this.loadCompleteHandlers.delete(handler);
  }
  offNodesUpdated(handler) {
    this.nodesUpdatedHandlers.delete(handler);
  }
  /**
   * Convert CDP AX nodes to Elements.
   * @param clearMap If true (default), clears nodeMap first. Set false for queryAXTree
   *   to merge results into existing map without invalidating prior IDs.
   */
  convertToElements(nodes, clearMap = true) {
    const elements = [];
    if (clearMap) {
      this.nodeMap.clear();
    }
    for (const node of nodes) {
      if (SKIP_ROLES.has(node.role.value)) continue;
      const role = normalizeRole(node.role.value);
      const label = node.name?.value ?? "";
      if (role === "group" && !label) continue;
      const id = node.backendDOMNodeId ? `e${node.backendDOMNodeId}` : `ex${Math.random().toString(36).slice(2, 8)}`;
      const el = {
        id,
        role,
        label,
        value: node.value?.value ?? null,
        enabled: this.getProperty(node, "disabled") !== true,
        focused: this.getProperty(node, "focused") === true,
        actions: this.inferActions(role),
        bounds: [0, 0, 0, 0],
        parent: null
      };
      if (node.backendDOMNodeId) {
        this.nodeMap.set(el.id, node.backendDOMNodeId);
      }
      elements.push(el);
    }
    return elements;
  }
  getProperty(node, name) {
    return node.properties?.find((p) => p.name === name)?.value?.value;
  }
  inferActions(role) {
    switch (role) {
      case "button":
      case "link":
      case "checkbox":
      case "tab":
      case "switch":
        return ["press"];
      case "textfield":
        return ["setValue"];
      case "slider":
        return ["increment", "decrement", "setValue"];
      case "select":
        return ["press", "showMenu"];
      default:
        return [];
    }
  }
};

// src/engine/cdp/dom.ts
var DomDomain = class {
  constructor(conn, sessionId) {
    this.conn = conn;
    this.sessionId = sessionId;
  }
  async getElementCenter(backendNodeId) {
    const result = await this.conn.send("DOM.getBoxModel", { backendNodeId }, this.sessionId);
    const q = result.model.content;
    const x = Math.round((q[0] + q[2] + q[4] + q[6]) / 4);
    const y = Math.round((q[1] + q[3] + q[5] + q[7]) / 4);
    return { x, y };
  }
  async getBoxModel(backendNodeId) {
    const result = await this.conn.send("DOM.getBoxModel", { backendNodeId }, this.sessionId);
    return result.model;
  }
  async getDocument() {
    return this.conn.send("DOM.getDocument", {}, this.sessionId);
  }
  /**
   * Find a single element by CSS selector.
   * Returns the nodeId, or null if not found.
   */
  async querySelector(nodeId, selector) {
    try {
      const result = await this.conn.send(
        "DOM.querySelector",
        { nodeId, selector },
        this.sessionId
      );
      return result.nodeId > 0 ? result.nodeId : null;
    } catch {
      return null;
    }
  }
  /**
   * Find all elements matching a CSS selector.
   * Returns array of nodeIds.
   */
  async querySelectorAll(nodeId, selector) {
    try {
      const result = await this.conn.send(
        "DOM.querySelectorAll",
        { nodeId, selector },
        this.sessionId
      );
      return result.nodeIds.filter((id) => id > 0);
    } catch {
      return [];
    }
  }
  /**
   * Get the outer HTML of a node.
   */
  async getOuterHTML(nodeId, backendNodeId) {
    const params = {};
    if (nodeId !== void 0) params.nodeId = nodeId;
    if (backendNodeId !== void 0) params.backendNodeId = backendNodeId;
    const result = await this.conn.send(
      "DOM.getOuterHTML",
      params,
      this.sessionId
    );
    return result.outerHTML;
  }
  /**
   * Get attributes of a node as key-value pairs.
   */
  async getAttributes(nodeId) {
    const result = await this.conn.send(
      "DOM.getAttributes",
      { nodeId },
      this.sessionId
    );
    const attrs = {};
    for (let i = 0; i < result.attributes.length; i += 2) {
      attrs[result.attributes[i]] = result.attributes[i + 1];
    }
    return attrs;
  }
};

// src/engine/cdp/input.ts
var InputDomain = class {
  constructor(conn, sessionId) {
    this.conn = conn;
    this.sessionId = sessionId;
  }
  async click(x, y) {
    await this.conn.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x,
      y,
      button: "left",
      clickCount: 1
    }, this.sessionId);
    await this.conn.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x,
      y,
      button: "left",
      clickCount: 1
    }, this.sessionId);
  }
  async type(text) {
    for (const char of text) {
      const code = charToCode(char);
      await this.conn.send("Input.dispatchKeyEvent", {
        type: "keyDown",
        text: char,
        key: char,
        code
      }, this.sessionId);
      await this.conn.send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key: char,
        code
      }, this.sessionId);
    }
  }
  /**
   * Press a special key (Enter, Tab, Escape, Backspace, etc.)
   */
  async pressKey(key) {
    const keyDef = SPECIAL_KEYS[key];
    if (!keyDef) {
      await this.type(key);
      return;
    }
    await this.conn.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: keyDef.key,
      code: keyDef.code,
      text: keyDef.text
    }, this.sessionId);
    await this.conn.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: keyDef.key,
      code: keyDef.code
    }, this.sessionId);
  }
  async hover(x, y) {
    await this.conn.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x,
      y
    }, this.sessionId);
  }
  async scroll(x, y, deltaX, deltaY) {
    await this.conn.send("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x,
      y,
      deltaX,
      deltaY
    }, this.sessionId);
  }
};
var SPECIAL_KEYS = {
  Enter: { key: "Enter", code: "Enter", text: "\r" },
  Tab: { key: "Tab", code: "Tab", text: "	" },
  Escape: { key: "Escape", code: "Escape" },
  Backspace: { key: "Backspace", code: "Backspace" },
  Delete: { key: "Delete", code: "Delete" },
  ArrowUp: { key: "ArrowUp", code: "ArrowUp" },
  ArrowDown: { key: "ArrowDown", code: "ArrowDown" },
  ArrowLeft: { key: "ArrowLeft", code: "ArrowLeft" },
  ArrowRight: { key: "ArrowRight", code: "ArrowRight" },
  Home: { key: "Home", code: "Home" },
  End: { key: "End", code: "End" },
  PageUp: { key: "PageUp", code: "PageUp" },
  PageDown: { key: "PageDown", code: "PageDown" }
};
var SPECIAL_CODES = {
  " ": "Space",
  "0": "Digit0",
  "1": "Digit1",
  "2": "Digit2",
  "3": "Digit3",
  "4": "Digit4",
  "5": "Digit5",
  "6": "Digit6",
  "7": "Digit7",
  "8": "Digit8",
  "9": "Digit9",
  "`": "Backquote",
  "-": "Minus",
  "=": "Equal",
  "[": "BracketLeft",
  "]": "BracketRight",
  "\\": "Backslash",
  ";": "Semicolon",
  "'": "Quote",
  ",": "Comma",
  ".": "Period",
  "/": "Slash",
  "~": "Backquote",
  "!": "Digit1",
  "@": "Digit2",
  "#": "Digit3",
  "$": "Digit4",
  "%": "Digit5",
  "^": "Digit6",
  "&": "Digit7",
  "*": "Digit8",
  "(": "Digit9",
  ")": "Digit0",
  "_": "Minus",
  "+": "Equal",
  "{": "BracketLeft",
  "}": "BracketRight",
  "|": "Backslash",
  ":": "Semicolon",
  '"': "Quote",
  "<": "Comma",
  ">": "Period",
  "?": "Slash",
  "	": "Tab",
  "\n": "Enter"
};
function charToCode(char) {
  if (SPECIAL_CODES[char]) return SPECIAL_CODES[char];
  const upper = char.toUpperCase();
  if (upper >= "A" && upper <= "Z") return `Key${upper}`;
  return "";
}

// src/engine/cdp/runtime.ts
var RuntimeDomain = class {
  constructor(conn, sessionId) {
    this.conn = conn;
    this.sessionId = sessionId;
  }
  /**
   * Evaluate a JavaScript expression string in the page context.
   */
  async evaluate(expression) {
    const result = await this.conn.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true
    }, this.sessionId);
    if (result.exceptionDetails) {
      const msg = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
      throw new Error(`Evaluation failed: ${msg}`);
    }
    return result.result.value;
  }
  /**
   * Call a function with structured arguments in the page context.
   * This is the CDP equivalent of Playwright's page.evaluate(fn, ...args).
   *
   * The function declaration is serialized as a string, and arguments
   * are passed as CDP CallArgument objects (primitives by value).
   *
   * Usage:
   *   await runtime.callFunctionOn(
   *     '(selector, prop) => getComputedStyle(document.querySelector(selector))[prop]',
   *     ['.header', 'color']
   *   )
   */
  async callFunctionOn(functionDeclaration, args) {
    const docResult = await this.conn.send("Runtime.evaluate", {
      expression: "document",
      returnByValue: false
    }, this.sessionId);
    const callArgs = args?.map((arg) => {
      if (arg === void 0) return { unserializableValue: "undefined" };
      return { value: arg };
    });
    const result = await this.conn.send("Runtime.callFunctionOn", {
      functionDeclaration,
      objectId: docResult.result.objectId,
      arguments: callArgs,
      returnByValue: true,
      awaitPromise: true
    }, this.sessionId);
    if (result.exceptionDetails) {
      const msg = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
      throw new Error(`callFunctionOn failed: ${msg}`);
    }
    return result.result.value;
  }
  /**
   * Enable the Runtime domain to receive events (like consoleAPICalled).
   */
  async enable() {
    await this.conn.send("Runtime.enable", {}, this.sessionId);
  }
};

// src/engine/cdp/css.ts
var CssDomain = class {
  constructor(conn, sessionId) {
    this.conn = conn;
    this.sessionId = sessionId;
  }
  async enable() {
    await this.conn.send("CSS.enable", {}, this.sessionId);
  }
  /**
   * Get computed styles for a DOM node.
   * Returns all computed CSS properties as key-value pairs.
   */
  async getComputedStyle(nodeId) {
    const result = await this.conn.send("CSS.getComputedStyleForNode", { nodeId }, this.sessionId);
    const styles = {};
    for (const { name, value } of result.computedStyle) {
      styles[name] = value;
    }
    return styles;
  }
  /**
   * Get computed styles filtered to specific properties.
   * More efficient when you only need a few properties.
   */
  async getComputedStyleFiltered(nodeId, properties) {
    const all = await this.getComputedStyle(nodeId);
    const filtered = {};
    for (const prop of properties) {
      if (prop in all) {
        filtered[prop] = all[prop];
      }
    }
    return filtered;
  }
  /**
   * Get matched CSS rules for a node — includes inline, attribute,
   * inherited, pseudo-element, and keyframe styles.
   */
  async getMatchedStyles(nodeId) {
    return this.conn.send("CSS.getMatchedStylesForNode", { nodeId }, this.sessionId);
  }
};

// src/engine/cdp/snapshot.ts
var SnapshotDomain = class {
  constructor(conn, sessionId) {
    this.conn = conn;
    this.sessionId = sessionId;
  }
  async enable() {
    await this.conn.send("DOMSnapshot.enable", {}, this.sessionId);
  }
  /**
   * Capture full DOM snapshot — one call gets everything.
   * Returns flattened arrays with string deduplication.
   */
  async captureSnapshot(options) {
    return this.conn.send(
      "DOMSnapshot.captureSnapshot",
      {
        computedStyles: options.computedStyles,
        includePaintOrder: options.includePaintOrder,
        includeDOMRects: options.includeDOMRects,
        includeBlendedBackgroundColors: options.includeBlendedBackgroundColors,
        includeTextColorOpacities: options.includeTextColorOpacities
      },
      this.sessionId
    );
  }
  /**
   * Helper: resolve a string index from the snapshot's strings array.
   */
  resolveString(strings, index) {
    return strings[index] ?? "";
  }
  /**
   * Helper: extract computed style values for a layout node.
   *
   * CDP format: `styles[nodeIndex]` is an array of string indices.
   * Each index maps to the value of the corresponding property in the
   * `computedStyles` parameter you passed to `captureSnapshot`.
   * The property names are known — they're the strings you requested.
   *
   * @param strings The strings array from CaptureSnapshotResult
   * @param styleIndices The style indices for one layout node (from LayoutTreeSnapshot.styles[n])
   * @param requestedProperties The computedStyles array you passed to captureSnapshot
   */
  resolveStyles(strings, styleIndices, requestedProperties) {
    const result = {};
    for (let i = 0; i < styleIndices.length && i < requestedProperties.length; i++) {
      const name = requestedProperties[i];
      const value = strings[styleIndices[i]];
      if (name) result[name] = value ?? "";
    }
    return result;
  }
};

// src/engine/cdp/emulation.ts
var EmulationDomain = class {
  constructor(conn, sessionId) {
    this.conn = conn;
    this.sessionId = sessionId;
  }
  /**
   * Override device metrics (viewport size, scale, mobile mode).
   */
  async setDeviceMetrics(config) {
    await this.conn.send("Emulation.setDeviceMetricsOverride", {
      width: config.width,
      height: config.height,
      deviceScaleFactor: config.deviceScaleFactor ?? 1,
      mobile: config.mobile ?? false
    }, this.sessionId);
  }
  /**
   * Clear device metrics override (restore defaults).
   */
  async clearDeviceMetrics() {
    await this.conn.send("Emulation.clearDeviceMetricsOverride", {}, this.sessionId);
  }
  /**
   * Hide scrollbars (useful for consistent screenshots).
   */
  async setScrollbarsHidden(hidden) {
    await this.conn.send("Emulation.setScrollbarsHidden", { hidden }, this.sessionId);
  }
  /**
   * Emulate reduced motion preference (disable animations for screenshots).
   */
  async setReducedMotion(enabled) {
    await this.conn.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: enabled ? "reduce" : "" }]
    }, this.sessionId);
  }
};

// src/engine/cdp/network.ts
var NetworkDomain = class {
  constructor(conn, sessionId) {
    this.conn = conn;
    this.sessionId = sessionId;
  }
  async enable() {
    await this.conn.send("Network.enable", {}, this.sessionId);
  }
  /**
   * Get all cookies, optionally filtered by URLs.
   */
  async getCookies(urls) {
    const params = {};
    if (urls) params.urls = urls;
    const result = await this.conn.send(
      "Network.getCookies",
      params,
      this.sessionId
    );
    return result.cookies;
  }
  /**
   * Set a cookie.
   */
  async setCookie(cookie) {
    const result = await this.conn.send(
      "Network.setCookie",
      cookie,
      this.sessionId
    );
    return result.success;
  }
  /**
   * Set multiple cookies at once.
   */
  async setCookies(cookies) {
    await this.conn.send("Network.setCookies", {
      cookies
    }, this.sessionId);
  }
  /**
   * Clear all browser cookies.
   */
  async clearCookies() {
    await this.conn.send("Network.clearBrowserCookies", {}, this.sessionId);
  }
  /**
   * Delete specific cookies by name and optional URL/domain.
   */
  async deleteCookies(params) {
    await this.conn.send("Network.deleteCookies", params, this.sessionId);
  }
};

// src/engine/cdp/console.ts
var ConsoleDomain = class {
  constructor(conn, sessionId) {
    this.conn = conn;
    this.sessionId = sessionId;
  }
  handlers = /* @__PURE__ */ new Set();
  messages = [];
  enabled = false;
  /**
   * Enable console capture.
   * Must call Runtime.enable first to receive consoleAPICalled events.
   */
  async enable() {
    if (this.enabled) return;
    this.enabled = true;
    await this.conn.send("Runtime.enable", {}, this.sessionId);
    this.conn.on("Runtime.consoleAPICalled", (params) => {
      const data = params;
      const text = data.args.map((arg) => arg.value !== void 0 ? String(arg.value) : arg.description ?? "").join(" ");
      const frame = data.stackTrace?.callFrames[0];
      const message = {
        type: data.type,
        text,
        url: frame?.url,
        lineNumber: frame?.lineNumber,
        timestamp: data.timestamp
      };
      this.messages.push(message);
      for (const handler of this.handlers) {
        handler(message);
      }
    });
  }
  /** Subscribe to console messages. */
  onMessage(handler) {
    this.handlers.add(handler);
  }
  offMessage(handler) {
    this.handlers.delete(handler);
  }
  /** Get all captured messages. */
  getMessages() {
    return [...this.messages];
  }
  /** Get only errors and warnings. */
  getErrors() {
    return this.messages.filter((m) => m.type === "error" || m.type === "warning");
  }
  /** Clear captured messages. */
  clear() {
    this.messages = [];
  }
};

// src/engine/cdp/wait.ts
function buildFingerprint(elements) {
  return elements.filter((e) => e.actions.length > 0).map((e) => `${e.role}:${e.label}:${e.enabled}`).sort().join("|");
}
async function waitForStableTree(getSnapshot, options) {
  const interval = options?.interval ?? 100;
  const stableTime = options?.stableTime ?? 300;
  const timeout = options?.timeout ?? 1e4;
  let lastFingerprint = "";
  let stableSince = Date.now();
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const elements2 = await getSnapshot();
    const fingerprint = buildFingerprint(elements2);
    if (fingerprint === lastFingerprint) {
      if (Date.now() - stableSince >= stableTime) {
        return { elements: elements2, timedOut: false };
      }
    } else {
      lastFingerprint = fingerprint;
      stableSince = Date.now();
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  const elements = await getSnapshot();
  return { elements, timedOut: true };
}
async function waitForHydration(_conn, getSnapshot, evaluate, options) {
  const timeout = options?.timeout ?? 1e4;
  const stableTime = options?.stableTime;
  const minElements = options?.minElements;
  const settleTime = options?.settleTime;
  const deadline = Date.now() + timeout;
  let hydrationDetected = false;
  let reason = "timeout";
  try {
    const marker = await evaluate(`(function(){
      if (document.readyState !== 'complete') return null;
      if (typeof window === 'undefined') return null;
      var hasNext = typeof window.__NEXT_DATA__ !== 'undefined';
      var hasReact = typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined';
      var rootHydrated = false;
      try {
        var root = document.querySelector('#__next, #root, [data-reactroot]');
        rootHydrated = !!root && root.children.length > 0;
      } catch(e) {}
      return { hasNext: hasNext, hasReact: hasReact, rootHydrated: rootHydrated };
    })()`);
    if (marker && typeof marker === "object") {
      const m = marker;
      if (m.rootHydrated) {
        hydrationDetected = true;
        reason = m.hasNext ? "nextjs-marker" : m.hasReact ? "react-marker" : "root-populated";
      }
    }
  } catch {
  }
  let lastFingerprint = "";
  let stableSince = Date.now();
  let lastElements = [];
  while (Date.now() < deadline) {
    const elements = await getSnapshot();
    lastElements = elements;
    const fingerprint = buildFingerprint(elements);
    const hasEnough = elements.filter((e) => e.actions.length > 0).length >= minElements;
    if (fingerprint === lastFingerprint && hasEnough) {
      if (Date.now() - stableSince >= stableTime) {
        {
          await new Promise((r) => setTimeout(r, settleTime));
        }
        const finalElements = await getSnapshot();
        return {
          elements: finalElements,
          timedOut: false,
          hydrationDetected: true,
          reason: hydrationDetected ? reason : "ax-tree-stable"
        };
      }
    } else {
      lastFingerprint = fingerprint;
      stableSince = Date.now();
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return {
    elements: lastElements,
    timedOut: true,
    hydrationDetected: false,
    reason: "timeout"
  };
}
async function waitForStable(conn, getSnapshot, options) {
  const eventName = options?.eventName;
  const timeout = options?.timeout ?? 1e4;
  const stableTime = options?.stableTime ?? 300;
  const deadline = Date.now() + timeout;
  let changed = false;
  const handler = () => {
    changed = true;
  };
  conn.on(eventName, handler);
  let elements = await getSnapshot();
  let lastFingerprint = buildFingerprint(elements);
  let stableSince = Date.now();
  try {
    while (Date.now() < deadline) {
      if (changed) {
        changed = false;
        elements = await getSnapshot();
        const fingerprint = buildFingerprint(elements);
        if (fingerprint !== lastFingerprint) {
          lastFingerprint = fingerprint;
          stableSince = Date.now();
        }
      }
      if (Date.now() - stableSince >= stableTime) {
        return { elements, timedOut: false };
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    elements = await getSnapshot();
    return { elements, timedOut: true };
  } finally {
    conn.off(eventName, handler);
  }
}

// src/engine/serialize.ts
function serializeSnapshot(snapshot) {
  const target = snapshot.url ?? snapshot.appName ?? "unknown";
  const lines = [
    `# Page: ${target}`,
    `# Platform: ${snapshot.platform} | Elements: ${snapshot.elements.length}`,
    ""
  ];
  for (const el of snapshot.elements) {
    lines.push(serializeElement(el));
  }
  return lines.join("\n");
}
function serializeElement(el) {
  let line = `[${el.id}] ${el.role} "${el.label}"`;
  const props = [];
  if (el.role === "textfield") {
    if (el.value !== null && el.value !== "") {
      props.push(`value="${el.value}"`);
    } else {
      props.push("empty");
    }
  } else if (el.value !== null && el.value !== "") {
    props.push(`value="${el.value}"`);
  }
  if (el.focused) props.push("focused");
  if (el.role === "button") {
    props.push(el.enabled ? "enabled" : "disabled");
  }
  if (props.length > 0) line += " " + props.join(", ");
  return line;
}

// src/engine/observe.ts
function observe(elements, options = {}) {
  let filtered = elements.filter((e) => e.actions.length > 0);
  if (options.role) {
    const role = options.role.toLowerCase();
    filtered = filtered.filter((e) => e.role === role);
  }
  if (options.intent) {
    const words = options.intent.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    if (words.length > 0) {
      filtered = filtered.filter((e) => {
        const labelLower = e.label.toLowerCase();
        return words.some((w) => labelLower.includes(w));
      });
    }
  }
  const descriptors = filtered.map((el) => ({
    elementId: el.id,
    description: describeAction(el),
    actions: el.actions,
    role: el.role,
    label: el.label,
    serialized: serializeElement(el)
  }));
  if (options.limit && descriptors.length > options.limit) {
    return descriptors.slice(0, options.limit);
  }
  return descriptors;
}
function describeAction(el) {
  const actionVerb = el.actions[0] === "press" ? "Click" : el.actions[0] === "setValue" ? "Type into" : el.actions[0] === "showMenu" ? "Open" : "Interact with";
  const state = el.enabled ? "" : " (disabled)";
  return `${actionVerb} ${el.role} "${el.label}"${state}`;
}

// src/engine/extract.ts
function extractFromAXTree(elements, schema) {
  const result = {};
  for (const [fieldName, field] of Object.entries(schema)) {
    const match = findMatchingElement(elements, field);
    if (!match) {
      result[fieldName] = field.extract === "exists" ? false : null;
      continue;
    }
    switch (field.extract) {
      case "text":
        result[fieldName] = match.label || match.value || null;
        break;
      case "value":
        result[fieldName] = match.value || null;
        break;
      case "exists":
        result[fieldName] = true;
        break;
      default:
        result[fieldName] = null;
    }
  }
  return result;
}
function extractList(elements, options) {
  let filtered = elements;
  if (options.role) {
    filtered = filtered.filter((e) => e.role === options.role);
  }
  if (options.labelPattern) {
    filtered = filtered.filter((e) => options.labelPattern.test(e.label));
  }
  const items = filtered.map((e) => ({
    label: e.label,
    value: e.value,
    id: e.id
  }));
  if (options.maxItems) {
    return items.slice(0, options.maxItems);
  }
  return items;
}
function extractPageMeta(elements) {
  return {
    headings: elements.filter((e) => e.role === "heading").map((e) => e.label),
    links: elements.filter((e) => e.role === "link").map((e) => ({ label: e.label, id: e.id })),
    inputs: elements.filter((e) => e.role === "textfield").map((e) => ({ label: e.label, value: e.value, id: e.id })),
    buttons: elements.filter((e) => e.role === "button").map((e) => ({ label: e.label, enabled: e.enabled, id: e.id }))
  };
}
function findMatchingElement(elements, field) {
  for (const el of elements) {
    if (field.role && el.role !== field.role) continue;
    if (field.label) {
      if (!el.label.toLowerCase().includes(field.label.toLowerCase())) continue;
    }
    return el;
  }
  return null;
}

// src/engine/cache.ts
var ResolutionCache = class {
  cache = /* @__PURE__ */ new Map();
  maxEntries;
  ttl;
  minConfidence;
  constructor(options = {}) {
    this.maxEntries = options.maxEntries ?? 100;
    this.ttl = options.ttl ?? 5 * 60 * 1e3;
    this.minConfidence = options.minConfidence ?? 0.7;
  }
  /**
   * Look up a cached resolution for an intent.
   * Returns the cached elementId if found and not expired, null otherwise.
   */
  get(intent) {
    const key = this.normalizeKey(intent);
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    entry.hits++;
    entry.lastHit = Date.now();
    return entry;
  }
  /**
   * Cache a successful resolution.
   * Only caches if confidence meets threshold.
   */
  set(intent, elementId, metadata) {
    if (metadata.confidence < this.minConfidence) return;
    const key = this.normalizeKey(intent);
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      this.evictOldest();
    }
    this.cache.set(key, {
      intent,
      elementId,
      role: metadata.role,
      label: metadata.label,
      confidence: metadata.confidence,
      createdAt: Date.now(),
      hits: 0,
      lastHit: 0
    });
  }
  /**
   * Invalidate a specific cache entry (e.g., when element is gone).
   */
  invalidate(intent) {
    this.cache.delete(this.normalizeKey(intent));
  }
  /**
   * Clear all cache entries (e.g., after navigation).
   */
  clear() {
    this.cache.clear();
  }
  /**
   * Get cache statistics.
   */
  stats() {
    let totalHits = 0;
    let totalConfidence = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
      totalConfidence += entry.confidence;
    }
    return {
      entries: this.cache.size,
      totalHits,
      avgConfidence: this.cache.size > 0 ? totalConfidence / this.cache.size : 0
    };
  }
  normalizeKey(intent) {
    return intent.toLowerCase().trim();
  }
  evictOldest() {
    let oldest = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.cache) {
      const lastUsed = entry.lastHit || entry.createdAt;
      if (lastUsed < oldestTime) {
        oldestTime = lastUsed;
        oldest = key;
      }
    }
    if (oldest) this.cache.delete(oldest);
  }
};

// src/engine/modality.ts
function assessUnderstanding(elements, options = {}) {
  const threshold = options.threshold ?? 0.6;
  if (elements.length === 0) {
    return {
      score: 0,
      needsScreenshot: true,
      dimensions: { textQuality: 0, semanticRelevance: 0, structuralClarity: 0, specialCasePenalty: 0 },
      reasoning: "Empty AX tree \u2014 screenshot required for any understanding"
    };
  }
  const textQuality = scoreTextQuality(elements);
  const semanticRelevance = scoreSemanticRelevance(elements);
  const structuralClarity = scoreStructuralClarity(elements);
  const specialCasePenalty = scoreSpecialCases(elements);
  const raw = textQuality * 0.35 + semanticRelevance * 0.3 + structuralClarity * 0.2;
  const score = Math.max(0, Math.min(1, raw - specialCasePenalty));
  const needsScreenshot = score < threshold;
  const reasoning = buildReasoning(score, threshold, { textQuality, semanticRelevance, structuralClarity, specialCasePenalty });
  return {
    score,
    needsScreenshot,
    dimensions: { textQuality, semanticRelevance, structuralClarity, specialCasePenalty },
    reasoning
  };
}
function scoreTextQuality(elements) {
  if (elements.length === 0) return 0;
  let labeled = 0;
  let meaningful = 0;
  for (const el of elements) {
    if (el.label) {
      labeled++;
      if (el.label.length > 1 && /[a-zA-Z]/.test(el.label)) {
        meaningful++;
      }
    }
  }
  const labelRatio = labeled / elements.length;
  const meaningfulRatio = elements.length > 0 ? meaningful / elements.length : 0;
  return labelRatio * 0.4 + meaningfulRatio * 0.6;
}
function scoreSemanticRelevance(elements) {
  const interactive = elements.filter((e) => e.actions.length > 0);
  if (interactive.length === 0) return 0.5;
  let wellLabeled = 0;
  for (const el of interactive) {
    if (el.label && el.label.length > 1) {
      wellLabeled++;
    }
  }
  return wellLabeled / interactive.length;
}
function scoreStructuralClarity(elements) {
  const roles = new Set(elements.map((e) => e.role));
  const roleDiversity = Math.min(1, roles.size / 5);
  const count = elements.length;
  let countScore;
  if (count < 3) {
    countScore = count / 3;
  } else if (count > 500) {
    countScore = Math.max(0.3, 1 - (count - 500) / 2e3);
  } else {
    countScore = 1;
  }
  return roleDiversity * 0.5 + countScore * 0.5;
}
function scoreSpecialCases(elements) {
  let penalty = 0;
  const roles = new Set(elements.map((e) => e.role));
  if (roles.size === 1 && elements.length > 5) {
    penalty += 0.3;
  }
  if (elements.length < 3) {
    penalty += 0.2;
  }
  const interactive = elements.filter((e) => e.actions.length > 0);
  const unlabeled = interactive.filter((e) => !e.label || e.label.length <= 1);
  if (interactive.length > 0 && unlabeled.length / interactive.length > 0.5) {
    penalty += 0.2;
  }
  return Math.min(0.8, penalty);
}
function buildReasoning(score, threshold, dims) {
  const parts = [];
  if (dims.textQuality < 0.4) parts.push("low text quality (many unlabeled elements)");
  if (dims.semanticRelevance < 0.5) parts.push("poor semantic relevance (interactive elements lack labels)");
  if (dims.structuralClarity < 0.4) parts.push("weak structure (low role diversity)");
  if (dims.specialCasePenalty > 0.1) parts.push("special case detected (possible Canvas/custom rendering)");
  if (parts.length === 0) {
    return score >= threshold ? "AX tree provides sufficient understanding \u2014 screenshot not needed" : "AX tree quality is borderline \u2014 screenshot recommended for accuracy";
  }
  const action = score >= threshold ? "AX tree usable despite" : "Screenshot recommended due to";
  return `${action}: ${parts.join(", ")}`;
}

// src/engine/shadow-dom.ts
async function extractShadowElements(runtime) {
  const result = await runtime.evaluate(`
    (function() {
      const found = [];

      function walk(root) {
        const children = root.querySelectorAll ? Array.from(root.querySelectorAll('*')) : [];
        for (const el of children) {
          // Descend into open shadow roots
          if (el.shadowRoot) {
            const shadowChildren = Array.from(el.shadowRoot.querySelectorAll('*'));
            for (const shadowEl of shadowChildren) {
              const rect = shadowEl.getBoundingClientRect();
              found.push({
                tagName: shadowEl.tagName.toLowerCase(),
                role: shadowEl.getAttribute('role'),
                label: shadowEl.getAttribute('aria-label') || shadowEl.getAttribute('aria-labelledby'),
                textContent: (shadowEl.textContent || '').trim().slice(0, 200) || null,
                bounds: rect.width > 0 || rect.height > 0
                  ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
                  : null,
              });
              // Recurse into nested shadow roots
              if (shadowEl.shadowRoot) {
                walk(shadowEl.shadowRoot);
              }
            }
          }
        }
      }

      walk(document);
      return found;
    })()
  `);
  if (!Array.isArray(result)) return [];
  return result.map((item) => ({
    tagName: String(item.tagName ?? "unknown"),
    role: item.role != null ? String(item.role) : null,
    label: item.label != null ? String(item.label) : null,
    textContent: item.textContent != null ? String(item.textContent) : null,
    bounds: item.bounds != null ? item.bounds : null
  }));
}

// src/engine/driver.ts
var EngineDriver = class {
  browser = new BrowserManager();
  conn = new CdpConnection();
  // Resolution cache initialized in constructor or with defaults
  target;
  _page;
  ax;
  dom;
  input;
  runtime;
  css;
  snapshot;
  emulation;
  network;
  console;
  targetId = null;
  sessionId = null;
  _currentUrl = "";
  launched = false;
  resolutionCache = new ResolutionCache();
  // ─── Lifecycle ──────────────────────────────────────────
  async launch(options = {}) {
    const wsUrl = await this.browser.launch(options);
    await this.conn.connect(wsUrl);
    this.target = new TargetDomain(this.conn);
    this.launched = true;
    this.targetId = await this.target.createPage("about:blank");
    this.sessionId = await this.target.attach(this.targetId);
    this._page = new PageDomain(this.conn, this.sessionId);
    this.ax = new AccessibilityDomain(this.conn, this.sessionId);
    this.dom = new DomDomain(this.conn, this.sessionId);
    this.input = new InputDomain(this.conn, this.sessionId);
    this.runtime = new RuntimeDomain(this.conn, this.sessionId);
    this.css = new CssDomain(this.conn, this.sessionId);
    this.snapshot = new SnapshotDomain(this.conn, this.sessionId);
    this.emulation = new EmulationDomain(this.conn, this.sessionId);
    this.network = new NetworkDomain(this.conn, this.sessionId);
    this.console = new ConsoleDomain(this.conn, this.sessionId);
    await this._page.enableLifecycleEvents();
    await this.ax.enable();
    await this.console.enable();
    if (options.viewport) {
      await this.emulation.setDeviceMetrics(options.viewport);
    }
  }
  async close() {
    if (this.targetId) {
      await this.target.close(this.targetId).catch(() => {
      });
      this.targetId = null;
    }
    await this.conn.close();
    await this.browser.close();
    this.launched = false;
  }
  /**
   * Release the CDP WebSocket for this driver without terminating the browser.
   * Used by one-shot CLI commands that attach to a shared browser-server via
   * connectExisting() — they must drop their WebSocket at the end of the
   * command so the node process can exit, but the browser-server's Chrome
   * process must keep running for subsequent commands.
   *
   * Closes the per-command tab that was spawned in connectExisting(), then
   * closes the WebSocket. Does NOT call this.browser.close() (which would
   * terminate the whole browser-server process).
   */
  async disconnect() {
    if (this.targetId) {
      await this.target.close(this.targetId).catch(() => {
      });
      this.targetId = null;
    }
    await this.conn.close().catch(() => {
    });
    this.launched = false;
  }
  get isLaunched() {
    return this.launched;
  }
  // ─── Navigation ─────────────────────────────────────────
  async navigate(url, options = {}) {
    const waitFor = options.waitFor ?? "stable";
    await this._page.navigate(url);
    if (waitFor === "stable") {
      await waitForStable(
        this.conn,
        () => this.ax.getSnapshot(),
        { timeout: options.timeout ?? 1e4, eventName: "Accessibility.nodesUpdated" }
      );
    } else if (waitFor === "load") {
      await waitForStableTree(
        () => this.ax.getSnapshot(),
        { timeout: options.timeout ?? 1e4 }
      );
    }
    this._currentUrl = await this.runtime.evaluate("location.href") ?? url;
    this.resolutionCache.clear();
  }
  get url() {
    return this._currentUrl;
  }
  /** BrowserDriver interface: currentUrl alias */
  get currentUrl() {
    return this._currentUrl;
  }
  // ─── Element Discovery (LLM-native) ────────────────────
  /**
   * Discover elements on the page with filtering and chunking.
   * Designed for LLM context windows — returns only actionable elements.
   */
  async discover(options = {}) {
    const filter = options.filter ?? "interactive";
    const elements = await this.ax.getSnapshot();
    let filtered;
    switch (filter) {
      case "interactive":
        filtered = elements.filter((e) => e.actions.length > 0);
        break;
      case "leaf":
        filtered = elements.filter((e) => e.label && e.role !== "group");
        break;
      case "all":
      default:
        filtered = elements;
    }
    if (options.chunk && options.maxTokens) {
      filtered = chunkElements(filtered, options.maxTokens);
    }
    if (options.serialize) {
      const snap = {
        url: this._currentUrl,
        platform: "web",
        elements: filtered};
      return serializeSnapshot(snap);
    }
    return filtered;
  }
  /**
   * 3-tier element resolution with auto-caching:
   * Tier 1: Check cache → Tier 2: queryAXTree → Tier 3: Jaro-Winkler → Tier 4: vision fallback.
   * Delegates to findWithDiagnostics() and returns the matched element or null.
   */
  async find(name, options = {}) {
    const diag = await this.findWithDiagnostics(name, options);
    if (!diag.elementId) return null;
    const elements = await this.ax.getSnapshot();
    return elements.find((e) => e.id === diag.elementId) ?? null;
  }
  /**
   * Like find(), but returns rich diagnostics for agent error feedback.
   * Includes confidence, resolution tier, and fuzzy alternatives when not found.
   */
  async findWithDiagnostics(name, options = {}) {
    const { jaroWinkler: jaroWinkler2 } = await Promise.resolve().then(() => (init_resolve(), resolve_exports));
    const cacheKey = options.role ? `${name}:${options.role}` : name;
    const cached = this.resolutionCache.get(cacheKey);
    if (cached) {
      const elements = await this.ax.getSnapshot();
      const match = elements.find((e) => e.id === cached.elementId);
      if (match) {
        const interactive2 = elements.filter((e) => e.actions.length > 0);
        return {
          elementId: cached.elementId,
          confidence: cached.confidence,
          tier: 1,
          tierName: "cache",
          alternatives: [],
          totalInteractive: interactive2.length
        };
      }
      this.resolutionCache.invalidate(cacheKey);
    }
    const queryResult = await this.ax.queryAXTree({
      accessibleName: name,
      role: options.role
    });
    if (queryResult.length > 0) {
      const el = queryResult[0];
      this.resolutionCache.set(cacheKey, el.id, {
        role: el.role,
        label: el.label,
        confidence: 1
      });
      const allElements2 = await this.ax.getSnapshot();
      const interactive2 = allElements2.filter((e) => e.actions.length > 0);
      return {
        elementId: el.id,
        confidence: 0.95,
        tier: 2,
        tierName: "queryAXTree",
        alternatives: [],
        totalInteractive: interactive2.length
      };
    }
    const { resolve: resolve3 } = await Promise.resolve().then(() => (init_resolve(), resolve_exports));
    const allElements = await this.ax.getSnapshot();
    const interactive = allElements.filter((e) => e.actions.length > 0);
    const result = resolve3({
      intent: options.role ? `${name} ${options.role}` : name,
      elements: allElements,
      mode: "algorithmic"
    });
    if (result.confidence >= 0.5 && result.element) {
      this.resolutionCache.set(cacheKey, result.element.id, {
        role: result.element.role,
        label: result.element.label,
        confidence: result.confidence
      });
      return {
        elementId: result.element.id,
        confidence: result.confidence,
        tier: 3,
        tierName: "jaro-winkler",
        alternatives: [],
        totalInteractive: interactive.length
      };
    }
    const nameLower = name.toLowerCase();
    const scored = interactive.filter((e) => e.label).map((e) => ({
      name: e.label,
      role: e.role,
      score: jaroWinkler2(nameLower, e.label.toLowerCase())
    })).sort((a, b) => b.score - a.score).slice(0, 5);
    let screenshot;
    try {
      const buf = await this.screenshot();
      screenshot = buf.toString("base64");
    } catch {
    }
    return {
      elementId: null,
      confidence: 0,
      tier: 4,
      tierName: "vision",
      alternatives: scored,
      totalInteractive: interactive.length,
      screenshot
    };
  }
  // ─── Interactions ───────────────────────────────────────
  async click(elementId) {
    const backendNodeId = this.ax.getBackendNodeId(elementId);
    if (!backendNodeId) throw new Error(`Element ${elementId} not found in AX tree`);
    const sid = this.sessionId ?? void 0;
    let domClickWorked = false;
    try {
      const resolved = await this.conn.send("DOM.resolveNode", { backendNodeId }, sid);
      if (resolved?.object?.objectId) {
        await this.conn.send("Runtime.callFunctionOn", {
          objectId: resolved.object.objectId,
          functionDeclaration: "function() { this.click(); }"
        }, sid);
        domClickWorked = true;
      }
    } catch {
    }
    if (!domClickWorked) {
      const { x, y } = await this.dom.getElementCenter(backendNodeId);
      await this.input.click(x, y);
    }
  }
  async type(elementId, text) {
    const backendNodeId = this.ax.getBackendNodeId(elementId);
    if (!backendNodeId) throw new Error(`Element ${elementId} not found in AX tree`);
    const { x, y } = await this.dom.getElementCenter(backendNodeId);
    await this.input.click(x, y);
    await this.input.type(text);
  }
  async fill(elementId, value) {
    const backendNodeId = this.ax.getBackendNodeId(elementId);
    if (!backendNodeId) throw new Error(`Element ${elementId} not found in AX tree`);
    const { x, y } = await this.dom.getElementCenter(backendNodeId);
    await this.input.click(x, y);
    await this.runtime.callFunctionOn(
      '() => { if (document.activeElement) { document.activeElement.value = ""; document.activeElement.dispatchEvent(new Event("input", { bubbles: true })); } }'
    );
    await this.input.type(value);
  }
  async hover(elementId) {
    const backendNodeId = this.ax.getBackendNodeId(elementId);
    if (!backendNodeId) throw new Error(`Element ${elementId} not found in AX tree`);
    const { x, y } = await this.dom.getElementCenter(backendNodeId);
    await this.input.hover(x, y);
  }
  async pressKey(key) {
    await this.input.pressKey(key);
  }
  async scroll(deltaY, x = 0, y = 0) {
    await this.input.scroll(x, y, 0, deltaY);
  }
  // ─── Interaction Assertions ─────────────────────────────
  /**
   * Before/after state capture around an action.
   * Returns element diff and pixel diff.
   */
  async actAndCapture(action) {
    const [beforeElements, beforeScreenshot] = await Promise.all([
      this.ax.getSnapshot(),
      this._page.screenshot()
    ]);
    await action();
    await waitForStableTree(() => this.ax.getSnapshot(), { timeout: 5e3, stableTime: 300 });
    await this.runtime.evaluate(
      "new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))"
    ).catch(() => {
    });
    const [afterElements, afterScreenshot] = await Promise.all([
      this.ax.getSnapshot(),
      this._page.screenshot()
    ]);
    const beforeIds = new Set(beforeElements.map((e) => e.id));
    const afterIds = new Set(afterElements.map((e) => e.id));
    const addedElements = afterElements.filter((e) => !beforeIds.has(e.id));
    const removedElements = beforeElements.filter((e) => !afterIds.has(e.id));
    let pixelDiff = 0;
    try {
      const beforePng = PNG.sync.read(beforeScreenshot);
      const afterPng = PNG.sync.read(afterScreenshot);
      if (beforePng.width === afterPng.width && beforePng.height === afterPng.height) {
        const { width, height } = beforePng;
        const diffPng = new PNG({ width, height });
        pixelDiff = pixelmatch(beforePng.data, afterPng.data, diffPng.data, width, height, {
          threshold: 0.1,
          includeAA: false
        });
      }
    } catch {
    }
    return {
      before: { elements: beforeElements, screenshot: beforeScreenshot },
      after: { elements: afterElements, screenshot: afterScreenshot },
      diff: { addedElements, removedElements, pixelDiff }
    };
  }
  /**
   * Set a <select> element's value and dispatch change event.
   */
  async select(elementId, value) {
    const backendNodeId = this.ax.getBackendNodeId(elementId);
    if (!backendNodeId) throw new Error(`Element ${elementId} not found in AX tree`);
    const { x, y } = await this.dom.getElementCenter(backendNodeId);
    await this.input.click(x, y);
    await new Promise((r) => setTimeout(r, 100));
    await this.runtime.callFunctionOn(
      '(val) => { const el = document.activeElement; if (el && el.tagName === "SELECT") { el.value = val; el.dispatchEvent(new Event("change", { bubbles: true })); el.dispatchEvent(new Event("input", { bubbles: true })); } }',
      [value]
    );
  }
  /**
   * Toggle a checkbox element.
   */
  async check(elementId) {
    const backendNodeId = this.ax.getBackendNodeId(elementId);
    if (!backendNodeId) throw new Error(`Element ${elementId} not found in AX tree`);
    const { x, y } = await this.dom.getElementCenter(backendNodeId);
    await this.input.click(x, y);
  }
  /**
   * Double-click an element.
   */
  async doubleClick(elementId) {
    const backendNodeId = this.ax.getBackendNodeId(elementId);
    if (!backendNodeId) throw new Error(`Element ${elementId} not found in AX tree`);
    const { x, y } = await this.dom.getElementCenter(backendNodeId);
    await this.input.click(x, y);
    await new Promise((r) => setTimeout(r, 50));
    await this.input.click(x, y);
  }
  /**
   * Right-click an element (opens context menu).
   */
  async rightClick(elementId) {
    const backendNodeId = this.ax.getBackendNodeId(elementId);
    if (!backendNodeId) throw new Error(`Element ${elementId} not found in AX tree`);
    const { x, y } = await this.dom.getElementCenter(backendNodeId);
    const sid = this.sessionId ?? void 0;
    await this.conn.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x,
      y,
      button: "right",
      buttons: 2,
      clickCount: 1
    }, sid);
    await this.conn.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x,
      y,
      button: "right",
      buttons: 0,
      clickCount: 1
    }, sid);
  }
  /**
   * Wait until an element with the given name (and optional role) appears in the AX tree.
   * Polls at 200ms intervals. Throws on timeout.
   */
  async waitForElement(name, options) {
    const timeout = options?.timeout ?? 1e4;
    const deadline = Date.now() + timeout;
    const interval = 200;
    while (Date.now() < deadline) {
      const elements = await this.ax.getSnapshot();
      const match = elements.find((e) => {
        const nameMatch = e.label?.toLowerCase().includes(name.toLowerCase()) || e.value?.toString().toLowerCase().includes(name.toLowerCase());
        const roleMatch = !options?.role || e.role === options.role;
        return nameMatch && roleMatch;
      });
      if (match) return match;
      await new Promise((r) => setTimeout(r, interval));
    }
    throw new Error(
      `waitForElement: element "${name}"${options?.role ? ` (role: ${options.role})` : ""} not found within ${timeout}ms`
    );
  }
  // ─── Screenshots ────────────────────────────────────────
  async screenshot(options = {}) {
    return this._page.screenshot(options);
  }
  async screenshotElement(elementId) {
    const backendNodeId = this.ax.getBackendNodeId(elementId);
    if (!backendNodeId) throw new Error(`Element ${elementId} not found in AX tree`);
    const model = await this.dom.getBoxModel(backendNodeId);
    const q = model.content;
    const x = Math.min(q[0], q[2], q[4], q[6]);
    const y = Math.min(q[1], q[3], q[5], q[7]);
    return this._page.screenshot({
      clip: { x, y, width: model.width, height: model.height }
    });
  }
  // ─── Page State ─────────────────────────────────────────
  /**
   * One-call page state capture — combines DOMSnapshot, AX tree, and screenshot.
   */
  async captureState(options = {}) {
    const state = {
      url: this._currentUrl,
      timestamp: Date.now()
    };
    const promises = [];
    if (options.computedStyles) {
      promises.push(
        this.snapshot.captureSnapshot({
          computedStyles: options.computedStyles
        }).then((result) => {
          state.domSnapshot = result;
        })
      );
    }
    if (options.includeAXTree !== false) {
      promises.push(
        this.ax.getSnapshot().then((elements) => {
          state.axTree = elements;
        })
      );
    }
    if (options.includeScreenshot) {
      promises.push(
        this._page.screenshot().then((buf) => {
          state.screenshot = buf;
        })
      );
    }
    await Promise.all(promises);
    return state;
  }
  /** Get AX tree snapshot. */
  async getSnapshot() {
    return this.ax.getSnapshot();
  }
  async evaluate(exprOrFn, ...args) {
    if (args.length > 0) {
      return this.runtime.callFunctionOn(exprOrFn, args);
    }
    return this.runtime.evaluate(exprOrFn);
  }
  // ─── DOM Queries ────────────────────────────────────────
  async querySelector(selector) {
    const doc = await this.dom.getDocument();
    return this.dom.querySelector(doc.root.nodeId, selector);
  }
  async querySelectorAll(selector) {
    const doc = await this.dom.getDocument();
    return this.dom.querySelectorAll(doc.root.nodeId, selector);
  }
  async getOuterHTML(nodeId) {
    return this.dom.getOuterHTML(nodeId);
  }
  async getAttributes(nodeId) {
    return this.dom.getAttributes(nodeId);
  }
  async getComputedStyle(nodeId, properties) {
    if (properties) {
      return this.css.getComputedStyleFiltered(nodeId, properties);
    }
    return this.css.getComputedStyle(nodeId);
  }
  // ─── CSS Injection ──────────────────────────────────────
  async addStyleTag(css) {
    return this._page.addStyleTag(css);
  }
  // ─── Viewport ───────────────────────────────────────────
  async setViewport(config) {
    await this.emulation.setDeviceMetrics(config);
  }
  async clearViewport() {
    await this.emulation.clearDeviceMetrics();
  }
  // ─── Cookies / Auth ─────────────────────────────────────
  async getCookies(urls) {
    return this.network.getCookies(urls);
  }
  async setCookies(cookies) {
    return this.network.setCookies(cookies);
  }
  async clearCookies() {
    return this.network.clearCookies();
  }
  // ─── Console ────────────────────────────────────────────
  getConsoleMessages() {
    return this.console.getMessages();
  }
  getConsoleErrors() {
    return this.console.getErrors();
  }
  clearConsole() {
    this.console.clear();
  }
  // ─── Content ────────────────────────────────────────────
  async content() {
    return this.runtime.evaluate("document.documentElement.outerHTML");
  }
  async title() {
    return this.runtime.evaluate("document.title");
  }
  async textContent(selector) {
    return this.runtime.callFunctionOn(
      "(sel) => { const el = document.querySelector(sel); return el ? el.textContent : null; }",
      [selector]
    );
  }
  async getAttribute(selector, attribute) {
    return this.runtime.callFunctionOn(
      "(sel, attr) => { const el = document.querySelector(sel); return el ? el.getAttribute(attr) : null; }",
      [selector, attribute]
    );
  }
  // ─── LLM-Native: Observe ─────────────────────────────────
  /**
   * Preview what actions are possible without executing.
   * Returns serializable descriptors for act().
   */
  async observe(options) {
    const elements = await this.ax.getSnapshot();
    return observe(elements, options);
  }
  // ─── LLM-Native: Extract ───────────────────────────────
  /**
   * Extract structured data from AX tree using a schema.
   */
  async extract(schema) {
    const elements = await this.ax.getSnapshot();
    return extractFromAXTree(elements, schema);
  }
  /**
   * Extract a list of repeated elements.
   */
  async extractItems(options) {
    const elements = await this.ax.getSnapshot();
    return extractList(elements, options);
  }
  /**
   * Extract page-level metadata (headings, links, inputs, buttons).
   */
  async extractMeta() {
    const elements = await this.ax.getSnapshot();
    return extractPageMeta(elements);
  }
  // ─── LLM-Native: Adaptive Modality ─────────────────────
  /**
   * Assess how well the AX tree captures the page.
   * Returns a score and whether a screenshot is recommended.
   */
  async assessUnderstanding(options) {
    const elements = await this.ax.getSnapshot();
    return assessUnderstanding(elements, options);
  }
  // ─── Coverage Reporting ────────────────────────────────
  /**
   * Report AX tree coverage against estimated visible DOM elements.
   * Surfaces blind spots: shadow DOM, canvas, iframes.
   */
  async getCoverage() {
    const gaps = [];
    const axElements = await this.ax.getSnapshot();
    const axTreeCount = axElements.length;
    const estimatedVisible = await this.runtime.evaluate(`
      (function() {
        const all = document.querySelectorAll('*');
        let count = 0;
        for (const el of all) {
          if (el.getAttribute('aria-hidden') === 'true') continue;
          if (el.offsetWidth > 0 || el.offsetHeight > 0) count++;
        }
        return count;
      })()
    `);
    const canvasCount = await this.runtime.evaluate(
      `document.querySelectorAll('canvas').length`
    );
    const iframeCount = await this.runtime.evaluate(
      `document.querySelectorAll('iframe').length`
    );
    const shadowElements = await extractShadowElements(this.runtime);
    const shadowDomCount = shadowElements.length;
    const recovered = shadowDomCount;
    if (canvasCount > 0) {
      gaps.push(`${canvasCount} canvas element${canvasCount > 1 ? "s" : ""} (invisible to AX tree)`);
    }
    if (iframeCount > 0) {
      gaps.push(`${iframeCount} iframe${iframeCount > 1 ? "s" : ""} (separate AX tree${iframeCount > 1 ? "s" : ""})`);
    }
    if (shadowDomCount > 0) {
      gaps.push(`${shadowDomCount} shadow DOM element${shadowDomCount > 1 ? "s" : ""} (open shadow root \u2014 recovered via piercing)`);
    }
    const safeVisible = estimatedVisible > 0 ? estimatedVisible : 1;
    const coveragePercent = Math.min(100, Math.round(axTreeCount / safeVisible * 100));
    if (coveragePercent < 50) {
      gaps.push(`Low AX coverage: ${coveragePercent}% of visible DOM captured`);
    }
    return {
      axTreeCount,
      estimatedVisible,
      coveragePercent,
      shadowDomCount,
      canvasCount,
      iframeCount,
      recovered,
      gaps
    };
  }
  // ─── LLM-Native: Cache ─────────────────────────────────
  /** Get resolution cache statistics. */
  get cacheStats() {
    return this.resolutionCache.stats();
  }
  /** Configure the resolution cache. */
  configureCache(options) {
    this.resolutionCache = new ResolutionCache(options);
  }
  // ─── Direct domain access (for advanced use) ───────────
  get page() {
    return this._page;
  }
  get accessibility() {
    return this.ax;
  }
  get domDomain() {
    return this.dom;
  }
  get runtimeDomain() {
    return this.runtime;
  }
  get cssDomain() {
    return this.css;
  }
  get snapshotDomain() {
    return this.snapshot;
  }
  get emulationDomain() {
    return this.emulation;
  }
  get networkDomain() {
    return this.network;
  }
  get consoleDomain() {
    return this.console;
  }
  get connection() {
    return this.conn;
  }
  /** The CDP debug port Chrome is listening on. Only valid after launch(). */
  get debugPort() {
    return this.browser.port;
  }
  /** The OS PID of the Chrome process. Only valid after launch(). Null when connected to existing. */
  get chromePid() {
    return this.browser.pid;
  }
  /** The browser connection mode used for this driver. */
  get browserMode() {
    return this.browser.mode;
  }
  /** The resolved CDP HTTP endpoint, when available. */
  get cdpUrl() {
    return this.browser.cdpUrl;
  }
  /** The resolved browser WebSocket endpoint, when available. */
  get wsEndpoint() {
    return this.browser.wsEndpoint;
  }
  /**
   * Connect to an already-running Chrome instance instead of launching a new one.
   * Used by browser-server reconnection to attach to a persistent Chrome process.
   */
  async connectExisting(wsUrl) {
    await this.conn.connect(wsUrl);
    this.target = new TargetDomain(this.conn);
    this.launched = true;
    this.targetId = await this.target.createPage("about:blank");
    this.sessionId = await this.target.attach(this.targetId);
    this._page = new PageDomain(this.conn, this.sessionId);
    this.ax = new AccessibilityDomain(this.conn, this.sessionId);
    this.dom = new DomDomain(this.conn, this.sessionId);
    this.input = new InputDomain(this.conn, this.sessionId);
    this.runtime = new RuntimeDomain(this.conn, this.sessionId);
    this.css = new CssDomain(this.conn, this.sessionId);
    this.snapshot = new SnapshotDomain(this.conn, this.sessionId);
    this.emulation = new EmulationDomain(this.conn, this.sessionId);
    this.network = new NetworkDomain(this.conn, this.sessionId);
    this.console = new ConsoleDomain(this.conn, this.sessionId);
    await this._page.enableLifecycleEvents();
    await this.ax.enable();
    await this.console.enable();
  }
};
function chunkElements(elements, maxTokens) {
  const charsPerToken = 4;
  const charsPerElement = 40;
  const maxElements = Math.floor(maxTokens * charsPerToken / charsPerElement);
  return elements.slice(0, maxElements);
}
var CompatElementHandle = class {
  constructor(driver2, nodeId) {
    this.driver = driver2;
    this.nodeId = nodeId;
  }
  async screenshot(options) {
    const model = await this.driver.domDomain.getBoxModel(this.nodeId);
    const q = model.content;
    const x = Math.min(q[0], q[2], q[4], q[6]);
    const y = Math.min(q[1], q[3], q[5], q[7]);
    const buf = await this.driver.page.screenshot({
      clip: { x, y, width: model.width, height: model.height }
    });
    if (options?.path) {
      await mkdir(dirname(options.path), { recursive: true });
      await writeFile(options.path, buf);
    }
    return buf;
  }
  async textContent() {
    const html = await this.driver.domDomain.getOuterHTML(this.nodeId);
    return html.replace(/<[^>]*>/g, "").trim() || null;
  }
  async boundingBox() {
    try {
      const model = await this.driver.domDomain.getBoxModel(this.nodeId);
      const q = model.content;
      return {
        x: Math.min(q[0], q[2], q[4], q[6]),
        y: Math.min(q[1], q[3], q[5], q[7]),
        width: model.width,
        height: model.height
      };
    } catch {
      return null;
    }
  }
  async getAttribute(name) {
    try {
      const attrs = await this.driver.domDomain.getAttributes(this.nodeId);
      return attrs[name] ?? null;
    } catch {
      return null;
    }
  }
};
var CompatLocator = class _CompatLocator {
  constructor(driver2, selector) {
    this.driver = driver2;
    this.selector = selector;
  }
  // Visible filter stored for potential future use in resolveNode
  visible = false;
  filter(options) {
    const loc = new _CompatLocator(this.driver, this.selector);
    loc.visible = options.visible ?? false;
    return loc;
  }
  first() {
    return this;
  }
  async click(_options) {
    const nodeId = await this.resolveNode(_options?.timeout);
    if (!nodeId) throw new Error(`Element not found: ${this.selector}`);
    await this.driver.runtimeDomain.callFunctionOn(
      '(sel) => { const el = document.querySelector(sel); if (el) el.click(); else throw new Error("Not found: " + sel); }',
      [this.selector]
    );
  }
  async fill(text, _options) {
    await this.driver.runtimeDomain.callFunctionOn(
      `(sel, val) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error('Not found: ' + sel);
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }`,
      [this.selector, text]
    );
  }
  async focus(_options) {
    await this.driver.runtimeDomain.callFunctionOn(
      "(sel) => { const el = document.querySelector(sel); if (el) el.focus(); }",
      [this.selector]
    );
  }
  async press(key, _options) {
    await this.focus();
    await this.driver.pressKey(key);
  }
  async pressSequentially(text, _options) {
    await this.focus();
    for (const char of text) {
      await this.driver.runtimeDomain.callFunctionOn(
        '(sel, ch) => { const el = document.querySelector(sel); if (el) { el.value += ch; el.dispatchEvent(new Event("input", { bubbles: true })); } }',
        [this.selector, char]
      );
    }
  }
  async waitFor(options) {
    const timeout = options?.timeout ?? 3e4;
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const nodeId = await this.driver.querySelector(this.selector);
      if (nodeId) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`Timed out waiting for ${this.selector}`);
  }
  async resolveNode(timeout) {
    const deadline = Date.now() + (timeout ?? 5e3);
    while (Date.now() < deadline) {
      const nodeId = await this.driver.querySelector(this.selector);
      if (nodeId) return nodeId;
      await new Promise((r) => setTimeout(r, 100));
    }
    return null;
  }
};
var CompatPage = class {
  constructor(driver2) {
    this.driver = driver2;
  }
  consoleHandlers = [];
  consoleListening = false;
  async goto(url, options) {
    await this.driver.navigate(url, {
      waitFor: options?.waitUntil === "networkidle" ? "stable" : "load",
      timeout: options?.timeout
    });
  }
  async evaluate(fnOrExpr, ...args) {
    if (typeof fnOrExpr === "function") {
      const fnStr = fnOrExpr.toString();
      if (args.length > 0) {
        return this.driver.evaluate(`(${fnStr})`, ...args);
      }
      return this.driver.evaluate(`(${fnStr})()`);
    }
    if (args.length > 0) {
      return this.driver.evaluate(fnOrExpr, ...args);
    }
    return this.driver.evaluate(fnOrExpr);
  }
  async $(selector) {
    const nodeId = await this.driver.querySelector(selector);
    if (!nodeId) return null;
    return new CompatElementHandle(this.driver, nodeId);
  }
  async $$(selector) {
    const nodeIds = await this.driver.querySelectorAll(selector);
    return nodeIds.map((id) => new CompatElementHandle(this.driver, id));
  }
  async screenshot(options) {
    const buf = await this.driver.screenshot({
      fullPage: options?.fullPage
    });
    if (options?.path) {
      await mkdir(dirname(options.path), { recursive: true });
      await writeFile(options.path, buf);
    }
    return buf;
  }
  async addStyleTag(options) {
    await this.driver.addStyleTag(options.content);
  }
  async waitForSelector(selector, options) {
    const timeout = options?.timeout ?? 3e4;
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const nodeId = await this.driver.querySelector(selector);
      if (nodeId) return new CompatElementHandle(this.driver, nodeId);
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`Timed out waiting for selector: ${selector}`);
  }
  async waitForTimeout(ms) {
    await new Promise((r) => setTimeout(r, ms));
  }
  async waitForLoadState(_state, _options) {
    await this.driver.navigate(this.driver.url, { waitFor: "stable", timeout: _options?.timeout ?? 1e4 }).catch(() => {
    });
  }
  async waitForNavigation() {
    await new Promise((r) => setTimeout(r, 500));
  }
  async content() {
    return this.driver.content();
  }
  async title() {
    return this.driver.title();
  }
  async textContent(selector) {
    return this.driver.textContent(selector);
  }
  async innerText(selector) {
    return this.driver.evaluate(
      '(sel) => { const el = document.querySelector(sel); return el ? el.innerText : ""; }',
      selector
    );
  }
  async getAttribute(selector, name) {
    return this.driver.getAttribute(selector, name);
  }
  async click(selector, _options) {
    await this.driver.runtimeDomain.callFunctionOn(
      '(sel) => { const el = document.querySelector(sel); if (el) el.click(); else throw new Error("Not found: " + sel); }',
      [selector]
    );
  }
  async fill(selector, value) {
    await this.driver.runtimeDomain.callFunctionOn(
      `(sel, val) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error('Not found: ' + sel);
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }`,
      [selector, value]
    );
  }
  async type(selector, text, _options) {
    await this.driver.runtimeDomain.callFunctionOn(
      "(sel) => { const el = document.querySelector(sel); if (el) el.focus(); }",
      [selector]
    );
    for (const char of text) {
      await this.driver.runtimeDomain.callFunctionOn(
        '(sel, ch) => { const el = document.querySelector(sel); if (el) { el.value += ch; el.dispatchEvent(new Event("input", { bubbles: true })); } }',
        [selector, char]
      );
    }
  }
  async check(selector) {
    await this.driver.runtimeDomain.callFunctionOn(
      "(sel) => { const el = document.querySelector(sel); if (el && !el.checked) el.click(); }",
      [selector]
    );
  }
  async uncheck(selector) {
    await this.driver.runtimeDomain.callFunctionOn(
      "(sel) => { const el = document.querySelector(sel); if (el && el.checked) el.click(); }",
      [selector]
    );
  }
  async selectOption(selector, value) {
    await this.driver.runtimeDomain.callFunctionOn(
      `(sel, val) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error('Not found: ' + sel);
        el.value = val;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }`,
      [selector, value]
    );
  }
  async hover(selector, _options) {
    const nodeId = await this.driver.querySelector(selector);
    if (!nodeId) throw new Error(`Element not found: ${selector}`);
    const center = await this.driver.domDomain.getElementCenter(nodeId);
    await this.driver.runtimeDomain.callFunctionOn(
      '(x, y) => { const el = document.elementFromPoint(x, y); if (el) el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true })); }',
      [center.x, center.y]
    );
  }
  locator(selector) {
    return new CompatLocator(this.driver, selector);
  }
  on(event, handler) {
    if (event === "console") {
      this.consoleHandlers.push(handler);
      if (!this.consoleListening) {
        this.consoleListening = true;
        this.driver.consoleDomain.onMessage((msg) => {
          const compatMsg = {
            type: () => msg.type,
            text: () => msg.text
          };
          for (const h of this.consoleHandlers) h(compatMsg);
        });
      }
    }
  }
  url() {
    return this.driver.url;
  }
  keyboard = {
    press: async (key) => {
      await this.driver.pressKey(key);
    }
  };
};

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
  const username = userInfo().username;
  return join(outputDir, `auth.${username}.json`);
}
async function loadAuthState(outputDir) {
  if (isDeployedEnvironment()) {
    console.warn("\u26A0\uFE0F  Deployed environment detected. Auth state not available.");
    return null;
  }
  try {
    const authPath = getAuthStatePath(outputDir);
    const content = await readFile(authPath, "utf-8");
    const stored = JSON.parse(content);
    if (!stored.metadata) {
      console.warn("\u26A0\uFE0F  Legacy auth format detected. Please re-authenticate with `ibr login`.");
      return null;
    }
    const currentUser = userInfo().username;
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
    const stats = await stat(authPath);
    const randomData = randomBytes(stats.size);
    await writeFile(authPath, randomData, { mode: 384 });
    await unlink(authPath);
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
async function closeBrowser() {
}
async function captureScreenshot(options) {
  const {
    url,
    outputPath,
    viewport = VIEWPORTS.desktop,
    fullPage = true,
    headed = false,
    waitForNetworkIdle = true,
    timeout = 3e4,
    outputDir,
    selector,
    waitFor,
    delay,
    browserMode,
    cdpUrl,
    wsEndpoint,
    chromePath
  } = options;
  await mkdir(dirname(outputPath), { recursive: true });
  if (outputDir && !isDeployedEnvironment()) {
    const authState = await loadAuthState(outputDir);
    if (authState) {
      console.log("\u{1F510} Using saved authentication state");
    }
  }
  const driverInstance = new EngineDriver();
  await driverInstance.launch({
    headless: !headed,
    viewport: { width: viewport.width, height: viewport.height },
    mode: browserMode,
    cdpUrl,
    wsEndpoint,
    chromePath
  });
  const page = new CompatPage(driverInstance);
  try {
    await page.goto(url, {
      waitUntil: waitForNetworkIdle ? "networkidle" : "load",
      timeout
    });
    if (waitFor) {
      await page.waitForSelector(waitFor, { timeout });
    }
    await page.waitForTimeout(delay ?? 500);
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
    await driverInstance.close();
  }
}
async function captureWithLandmarks(options) {
  const {
    url,
    outputPath,
    viewport = VIEWPORTS.desktop,
    fullPage = true,
    headed = false,
    waitForNetworkIdle = true,
    timeout = 3e4,
    outputDir,
    selector,
    waitFor,
    browserMode,
    cdpUrl,
    wsEndpoint,
    chromePath
  } = options;
  await mkdir(dirname(outputPath), { recursive: true });
  if (outputDir && !isDeployedEnvironment()) {
    const authState = await loadAuthState(outputDir);
    if (authState) {
      console.log("\u{1F510} Using saved authentication state");
    }
  }
  const driverInstance = new EngineDriver();
  await driverInstance.launch({
    headless: !headed,
    viewport: { width: viewport.width, height: viewport.height },
    mode: browserMode,
    cdpUrl,
    wsEndpoint,
    chromePath
  });
  const page = new CompatPage(driverInstance);
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
    await driverInstance.close();
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
    headed = false,
    waitForNetworkIdle = true,
    timeout = 3e4,
    outputDir,
    selector,
    browserMode,
    cdpUrl,
    wsEndpoint,
    chromePath
  } = options;
  const startTime = Date.now();
  let navigationTime = 0;
  let renderTime = 0;
  const consoleErrors = [];
  const networkErrors = [];
  const suggestions = [];
  let httpStatus;
  try {
    await mkdir(dirname(outputPath), { recursive: true });
    if (outputDir && !isDeployedEnvironment()) {
      await loadAuthState(outputDir);
    }
    const driverInstance = new EngineDriver();
    await driverInstance.launch({
      headless: !headed,
      viewport: { width: viewport.width, height: viewport.height },
      mode: browserMode,
      cdpUrl,
      wsEndpoint,
      chromePath
    });
    const page = new CompatPage(driverInstance);
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on?.("requestfailed", ((request) => {
      const failure = request.failure();
      networkErrors.push(`${request.url()}: ${failure?.errorText || "failed"}`);
    }));
    page.on?.("response", ((response) => {
      if (response.url() === url || response.url() === url + "/") {
        httpStatus = response.status();
      }
    }));
    try {
      const navStart = Date.now();
      await page.goto(url, {
        waitUntil: waitForNetworkIdle ? "networkidle" : "load",
        timeout
      });
      navigationTime = Date.now() - navStart;
    } catch (navError) {
      await driverInstance.close();
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
    await driverInstance.close();
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
        suggestion: "Check that Chrome is installed and accessible. IBR uses a direct CDP connection \u2014 ensure Chrome is available on your PATH or at the default install location."
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
    readFile(baselinePath),
    readFile(currentPath)
  ]);
  const baseline = PNG.sync.read(baselineBuffer);
  const current = PNG.sync.read(currentBuffer);
  if (baseline.width !== current.width || baseline.height !== current.height) {
    throw new Error(
      `Image dimensions mismatch: baseline (${baseline.width}x${baseline.height}) vs current (${current.width}x${current.height})`
    );
  }
  const { width, height } = baseline;
  const diff = new PNG({ width, height });
  const totalPixels = width * height;
  const diffPixels = pixelmatch(
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
  await mkdir(dirname(diffPath), { recursive: true });
  await writeFile(diffPath, PNG.sync.write(diff));
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
  return `${SESSION_PREFIX}${nanoid(10)}`;
}
function getSessionPaths(outputDir, sessionId) {
  const root = join(outputDir, "sessions", sessionId);
  return {
    root,
    sessionJson: join(root, "session.json"),
    baseline: join(root, "baseline.png"),
    current: join(root, "current.png"),
    diff: join(root, "diff.png")
  };
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
  await mkdir(paths.root, { recursive: true });
  await writeFile(paths.sessionJson, JSON.stringify(session, null, 2));
  return session;
}
async function getSession(outputDir, sessionId) {
  const paths = getSessionPaths(outputDir, sessionId);
  try {
    const content = await readFile(paths.sessionJson, "utf-8");
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
  await writeFile(paths.sessionJson, JSON.stringify(updated, null, 2));
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
  const sessionsDir = join(outputDir, "sessions");
  try {
    const entries = await readdir(sessionsDir, { withFileTypes: true });
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
    await rm(paths.root, { recursive: true, force: true });
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
    let hasAuthCookie = false;
    try {
      hasAuthCookie = document.cookie.includes("auth") || document.cookie.includes("session") || document.cookie.includes("token");
    } catch {
    }
    const socialProviderPatterns = ["google", "github", "apple", "microsoft", "facebook", "discord"];
    const socialTriggerPhrases = ["sign in with", "continue with"];
    const socialProviders = [];
    const socialElements = Array.from(doc.querySelectorAll(
      'button, a, [class*="social"], [class*="oauth"], [class*="provider"]'
    ));
    for (const el of socialElements) {
      const t = el.textContent?.trim().toLowerCase() || "";
      const cls = el.className?.toLowerCase() || "";
      for (const provider of socialProviderPatterns) {
        if (!socialProviders.includes(provider)) {
          if (t.includes(provider) || cls.includes(provider)) {
            const isTriggered = socialTriggerPhrases.some((ph) => t.includes(ph)) || t === provider || t === `sign in with ${provider}` || t === `continue with ${provider}` || cls.includes("social") || cls.includes("oauth") || cls.includes("provider");
            if (isTriggered) socialProviders.push(provider);
          }
        }
      }
    }
    const forgotPasswordPatterns = ["forgot", "reset password", "can't sign in", "trouble signing in", "lost password"];
    const forgotEl = findByText(["a", "button"], forgotPasswordPatterns) || doc.querySelector('[href*="forgot"], [href*="reset-password"], [href*="password-reset"]');
    const toggleEl = doc.querySelector(
      '[aria-label*="show password" i], [aria-label*="hide password" i], [aria-label*="toggle password" i], [class*="eye"], [class*="visibility"], [class*="toggle-password"]'
    );
    let hasPasswordToggle = !!toggleEl;
    if (!hasPasswordToggle) {
      const passwordInput = doc.querySelector('input[type="password"]');
      if (passwordInput) {
        const parent = passwordInput.parentElement;
        const sibling = passwordInput.nextElementSibling;
        if (parent?.querySelector("button")) hasPasswordToggle = true;
        if (sibling?.tagName === "BUTTON") hasPasswordToggle = true;
      }
    }
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
      hasAuthCookie,
      socialLoginProviders: socialProviders,
      hasForgotPassword: !!forgotEl,
      hasPasswordToggle
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
  if (checks.socialLoginProviders.length > 0) {
    signals.push(`social login: ${checks.socialLoginProviders.join(", ")}`);
  }
  if (checks.hasForgotPassword) {
    signals.push("forgot password link present");
  }
  if (checks.hasPasswordToggle) {
    signals.push("password visibility toggle present");
  }
  confidence = Math.min(confidence / 100, 1);
  if (confidence < 0.3) {
    authenticated = null;
  }
  return {
    authenticated,
    confidence,
    signals,
    username,
    socialLoginProviders: checks.socialLoginProviders,
    hasForgotPassword: checks.hasForgotPassword,
    hasSignupLink: checks.hasSignupLink,
    hasPasswordToggle: checks.hasPasswordToggle
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
  const url = page.url?.() ?? "";
  const title = await page.title();
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const [pageIntent, state] = await Promise.all([
    classifyPageIntent(page),
    detectPageState(page)
  ]);
  const availableActions = await detectAvailableActions(page, pageIntent.intent);
  const issues = collectIssues(state, pageIntent, url);
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
    const socialProviderNames = ["google", "github", "apple", "microsoft", "facebook", "discord"];
    const socialTriggerPhrases = ["sign in with", "continue with"];
    const detectedProviders = [];
    const socialEls = Array.from(doc.querySelectorAll(
      'button, a, [class*="social"], [class*="oauth"], [class*="provider"]'
    ));
    for (const el of socialEls) {
      const t = el.textContent?.trim().toLowerCase() || "";
      const cls = el.className?.toLowerCase() || "";
      for (const provider of socialProviderNames) {
        if (!detectedProviders.includes(provider)) {
          if (t.includes(provider) || cls.includes(provider)) {
            const triggered = socialTriggerPhrases.some((ph) => t.includes(ph)) || t === provider || cls.includes("social") || cls.includes("oauth") || cls.includes("provider");
            if (triggered) detectedProviders.push(provider);
          }
        }
      }
    }
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
      hasPagination: !!pagination,
      hasSocialLogin: detectedProviders.length > 0,
      socialProviders: detectedProviders
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
  if (intent === "auth" && checks.hasSocialLogin) {
    for (const provider of checks.socialProviders) {
      actions.push({
        action: `login-with-${provider}`,
        selector: `[class*="${provider}"], button:has-text("${provider}")`,
        description: `Sign in with ${provider.charAt(0).toUpperCase() + provider.slice(1)}`
      });
    }
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
function collectIssues(state, intent, url = "") {
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
  if (intent.intent === "auth") {
    const socialProviders = state.auth.socialLoginProviders ?? [];
    if (socialProviders.length === 0) {
      issues.push({
        severity: "minor",
        type: "auth-no-social-login",
        problem: "Auth page has no social login options (Google, GitHub, etc.)",
        fix: "Add OAuth/social login buttons to reduce friction"
      });
    }
    const signals = state.auth.signals;
    const hasSignupLinkSignal = signals.includes("signup link visible") || (state.auth.hasSignupLink ?? false);
    const hasLoginLinkSignal = signals.includes("login link visible");
    const urlPath = (() => {
      try {
        return new URL(url).pathname.toLowerCase();
      } catch {
        return url.toLowerCase();
      }
    })();
    const isSignUp = hasLoginLinkSignal || urlPath.includes("sign-up") || urlPath.includes("signup") || urlPath.includes("register");
    const isSignIn = hasSignupLinkSignal || urlPath.includes("sign-in") || urlPath.includes("signin") || urlPath.includes("login");
    if (!state.auth.hasForgotPassword && (isSignIn || !isSignIn && !isSignUp)) {
      issues.push({
        severity: "minor",
        type: "auth-no-forgot-password",
        problem: "Sign-in page has no forgot password option",
        fix: 'Add a "Forgot your password?" link'
      });
    }
    if (!state.auth.hasPasswordToggle) {
      issues.push({
        severity: "minor",
        type: "auth-no-password-toggle",
        problem: "Password field has no show/hide toggle",
        fix: "Add a visibility toggle for the password field"
      });
    }
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
      page.waitForNavigation?.(),
      page.waitForLoadState?.("networkidle", { timeout })
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
    await emailField.fill?.(options.email);
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
    await passwordField.fill?.(options.password);
    steps.push({ action: "fill password", success: true });
    if (options.rememberMe) {
      const rememberCheckbox = await page.$(
        'input[type="checkbox"][name*="remember"], input[type="checkbox"][id*="remember"], label:has-text("remember") input[type="checkbox"]'
      );
      if (rememberCheckbox) {
        await rememberCheckbox.check?.();
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
    await submitButton.click?.();
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
    await searchField.fill?.("");
    await searchField.fill?.(options.query);
    steps.push({ action: `type "${options.query}"`, success: true });
    if (options.submit !== false) {
      await searchField.press?.("Enter");
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
  const path2 = join(artifactDir, filename);
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
    artifactDir = join(options.sessionDir, `search-${Date.now()}`);
    await mkdir(artifactDir, { recursive: true });
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
    await searchField.fill?.("");
    await searchField.fill?.(options.query);
    timing.typing = Date.now() - typingStart;
    steps.push({ action: `type "${options.query}"`, success: true, duration: timing.typing });
    if (captureSteps && artifactDir) {
      const shot = await captureStepScreenshot(page, "after-query", artifactDir, startTime);
      screenshots.push(shot);
      steps.push({ action: "capture after-query screenshot", success: true });
    }
    const waitingStart = Date.now();
    if (options.submit !== false) {
      await searchField.press?.("Enter");
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
      await writeFile(
        join(artifactDir, "results.json"),
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
            await element.selectOption?.(field.value);
          } else if (fieldType === "checkbox") {
            if (field.value === "true" || field.value === "1") {
              await element.check?.();
            } else {
              await element.uncheck?.();
            }
          } else if (fieldType === "radio") {
            await element.check?.();
          } else {
            await element.fill?.(field.value);
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
    await submitButton.click?.();
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
    const matchCount2 = queryTerms.filter((term) => textLower.includes(term)).length;
    const matchRatio = matchCount2 / queryTerms.length;
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
  const configPath = join(outputDir, "..", ".ibrrc.json");
  try {
    await access(configPath);
    const content = await readFile(configPath, "utf-8");
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

// src/consistency.ts
function parseColor(color) {
  if (!color || color === "transparent") return null;
  const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return { r: Number(rgbMatch[1]), g: Number(rgbMatch[2]), b: Number(rgbMatch[3]) };
  }
  const hexMatch = color.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16)
      };
    }
    if (hex.length >= 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16)
      };
    }
  }
  const named = {
    white: { r: 255, g: 255, b: 255 },
    black: { r: 0, g: 0, b: 0 },
    red: { r: 255, g: 0, b: 0 },
    green: { r: 0, g: 128, b: 0 },
    blue: { r: 0, g: 0, b: 255 },
    gray: { r: 128, g: 128, b: 128 },
    grey: { r: 128, g: 128, b: 128 }
  };
  return named[color.toLowerCase()] ?? null;
}
function relativeLuminance(r, g, b) {
  const linearize4 = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linearize4(r) + 0.7152 * linearize4(g) + 0.0722 * linearize4(b);
}
async function analyzeThemeConsistency(page) {
  const data = await page.evaluate(() => {
    const bodyBg = window.getComputedStyle(document.body).backgroundColor;
    const htmlBg = window.getComputedStyle(document.documentElement).backgroundColor;
    const pageBg = bodyBg && bodyBg !== "rgba(0, 0, 0, 0)" && bodyBg !== "transparent" ? bodyBg : htmlBg;
    const containerSelectors = [
      '[class*="card"]',
      '[class*="form"]',
      '[class*="dialog"]',
      '[class*="modal"]',
      '[class*="panel"]',
      "main > *",
      "form"
    ];
    const cards = [];
    const seen = /* @__PURE__ */ new Set();
    for (const sel of containerSelectors) {
      let elements;
      try {
        elements = Array.from(document.querySelectorAll(sel));
      } catch {
        continue;
      }
      for (const el of elements) {
        if (seen.has(el)) continue;
        seen.add(el);
        const bg = window.getComputedStyle(el).backgroundColor;
        if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 50 || rect.height < 50) continue;
        cards.push({ selector: sel, color: bg });
        if (cards.length >= 10) break;
      }
      if (cards.length >= 10) break;
    }
    return { pageBg, cards };
  });
  const pageParsed = parseColor(data.pageBg);
  const pageLuminance = pageParsed ? relativeLuminance(pageParsed.r, pageParsed.g, pageParsed.b) : 0.5;
  const pageBackground = { color: data.pageBg, luminance: pageLuminance };
  const contentCards = data.cards.map((c) => {
    const parsed = parseColor(c.color);
    const luminance2 = parsed ? relativeLuminance(parsed.r, parsed.g, parsed.b) : 0.5;
    return { selector: c.selector, color: c.color, luminance: luminance2 };
  });
  let themeMismatch = false;
  let mismatchDetails;
  const darkPage = pageLuminance < 0.2;
  const lightPage = pageLuminance > 0.7;
  for (const card of contentCards) {
    if (darkPage && card.luminance > 0.7) {
      themeMismatch = true;
      mismatchDetails = `Page background is dark (luminance ${pageLuminance.toFixed(3)}) but a content container matched by "${card.selector}" has a light background (luminance ${card.luminance.toFixed(3)})`;
      break;
    }
    if (lightPage && card.luminance < 0.2) {
      themeMismatch = true;
      mismatchDetails = `Page background is light (luminance ${pageLuminance.toFixed(3)}) but a content container matched by "${card.selector}" has a dark background (luminance ${card.luminance.toFixed(3)})`;
      break;
    }
  }
  return { pageBackground, contentCards, themeMismatch, mismatchDetails };
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
  let driver2 = null;
  const pages = [];
  try {
    driver2 = new EngineDriver();
    await driver2.launch({
      headless: true,
      viewport: { width: 1920, height: 1080 }
    });
    const page = new CompatPage(driver2);
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
    await driver2.close();
  } catch (error) {
    if (driver2) await driver2.close();
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
    url,
    maxPages = 5,
    pathPrefix,
    timeout = 1e4,
    includeExternal = false
  } = options;
  const startTime = Date.now();
  const startUrl = new URL$1(url);
  const origin = startUrl.origin;
  const discovered = /* @__PURE__ */ new Map();
  const visited = /* @__PURE__ */ new Set();
  const queue = [
    { url, depth: 0 }
  ];
  let driver2 = null;
  let totalLinks = 0;
  try {
    driver2 = new EngineDriver();
    await driver2.launch({ headless: true });
    const page = new CompatPage(driver2);
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
        const parsedUrl = new URL$1(current.url);
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
            const absoluteUrl = new URL$1(link.href, current.url);
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
    await driver2.close();
  } catch (error) {
    if (driver2) await driver2.close();
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
    const parsed = new URL$1(url);
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
  let driver2 = null;
  try {
    driver2 = new EngineDriver();
    await driver2.launch({ headless: true });
    const page = new CompatPage(driver2);
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 15e3
    });
    const origin = new URL$1(url).origin;
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
    await driver2.close();
    const pages = [];
    for (const link of navLinks) {
      try {
        const absoluteUrl = new URL$1(link.href, url);
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
    if (driver2) await driver2.close();
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
var OPERATION_PREFIX = "op_";
function getOperationsPath(outputDir) {
  return join(outputDir, "operations.json");
}
async function readState(outputDir) {
  const path2 = getOperationsPath(outputDir);
  try {
    const content = await readFile(path2, "utf-8");
    return JSON.parse(content);
  } catch {
    return { pending: [], lastUpdated: (/* @__PURE__ */ new Date()).toISOString() };
  }
}
async function writeState(outputDir, state) {
  const path2 = getOperationsPath(outputDir);
  await mkdir(dirname(path2), { recursive: true });
  state.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
  await writeFile(path2, JSON.stringify(state, null, 2));
}
async function registerOperation(outputDir, options) {
  const state = await readState(outputDir);
  state.pending = await cleanupStaleOperations(state.pending);
  const operation = {
    id: `${OPERATION_PREFIX}${nanoid(8)}`,
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
    await new Promise((resolve3) => setTimeout(resolve3, pollInterval));
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

// src/responsive.ts
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
    const driver2 = new EngineDriver();
    await driver2.launch({
      headless: true,
      viewport: { width: viewport.width, height: viewport.height }
    });
    const page = new CompatPage(driver2);
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
        const { mkdir: mkdir16 } = await import('fs/promises');
        await mkdir16(outputDir, { recursive: true });
        const screenshotPath = `${outputDir}/${viewportName}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        result.screenshot = screenshotPath;
      }
      results.push(result);
    } finally {
      await driver2.close();
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

// src/index.ts
init_memory();
var DecisionTypeSchema = z.enum([
  "css_change",
  "layout_change",
  "color_change",
  "spacing_change",
  "component_add",
  "component_remove",
  "component_modify",
  "content_change"
]);
var DecisionStateSchema = z.object({
  css: z.record(z.string(), z.string()).optional(),
  html_snippet: z.string().optional(),
  screenshot_ref: z.string().optional()
});
var DecisionEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  route: z.string(),
  component: z.string().optional(),
  type: DecisionTypeSchema,
  description: z.string(),
  rationale: z.string().optional(),
  before: DecisionStateSchema.optional(),
  after: DecisionStateSchema.optional(),
  files_changed: z.array(z.string()),
  session_id: z.string().optional()
});
var DecisionSummarySchema = z.object({
  route: z.string(),
  component: z.string().optional(),
  latest_change: z.string(),
  decision_count: z.number(),
  full_log_ref: z.string()
});
var CurrentUIStateSchema = z.object({
  last_snapshot_ref: z.string().optional(),
  pending_verifications: z.number(),
  known_issues: z.array(z.string())
});
var CompactContextSchema = z.object({
  version: z.literal(1),
  session_id: z.string(),
  updated_at: z.string().datetime(),
  active_route: z.string().optional(),
  decisions_summary: z.array(DecisionSummarySchema),
  current_ui_state: CurrentUIStateSchema,
  preferences_active: z.number()
});
var CompactionRequestSchema = z.object({
  reason: z.enum(["session_ending", "context_limit", "manual"]),
  preserve_decisions: z.array(z.string()).optional()
});
var CompactionResultSchema = z.object({
  compact_context: CompactContextSchema,
  archived_to: z.string(),
  decisions_compacted: z.number(),
  decisions_preserved: z.number()
});
var DesignCheckOperatorSchema = z.enum([
  "eq",
  // exact equality
  "gt",
  // numeric greater-than
  "lt",
  // numeric less-than
  "contains",
  // substring or token match
  "not",
  // negation
  "exists",
  // element is present in AX tree
  "truthy"
  // value is non-empty / non-zero
]);
var DesignCheckSchema = z.object({
  property: z.string(),
  operator: DesignCheckOperatorSchema,
  value: z.union([z.string(), z.number()]),
  confidence: z.number().min(0).max(1)
});
var DesignChangeSchema = z.object({
  description: z.string(),
  element: z.string(),
  checks: z.array(DesignCheckSchema),
  source: z.enum(["structured", "parsed"]),
  platform: z.enum(["web", "ios", "macos"]).optional(),
  timestamp: z.string()
});
var DecisionEntryWithChecksSchema = DecisionEntrySchema.extend({
  checks: z.array(DesignCheckSchema).optional()
});

// src/decision-tracker.ts
var CONTEXT_DIR = "context";
var DECISIONS_DIR = "decisions";
function getDecisionsDir(outputDir) {
  return join(outputDir, CONTEXT_DIR, DECISIONS_DIR);
}
function routeToFilename(route) {
  return route.replace(/^\/+/, "").replace(/\//g, "_").replace(/[^a-zA-Z0-9_-]/g, "") || "_root";
}
function getRouteLogPath(outputDir, route) {
  const filename = `${routeToFilename(route)}.jsonl`;
  return join(getDecisionsDir(outputDir), filename);
}
async function ensureContextDirs(outputDir) {
  await mkdir(getDecisionsDir(outputDir), { recursive: true });
}
async function recordDecision(outputDir, options) {
  await ensureContextDirs(outputDir);
  const entry = {
    id: `dec_${nanoid(10)}`,
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
  await appendFile(logPath, JSON.stringify(entry) + "\n");
  return entry;
}
async function getDecisionsByRoute(outputDir, route) {
  const logPath = getRouteLogPath(outputDir, route);
  if (!existsSync(logPath)) {
    return [];
  }
  const content = await readFile(logPath, "utf-8");
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
    if (!existsSync(decisionsDir)) {
      return [];
    }
    const files = await readdir(decisionsDir);
    for (const file of files) {
      if (!file.endsWith(".jsonl")) continue;
      const filePath = join(decisionsDir, file);
      const content = await readFile(filePath, "utf-8");
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
  if (!existsSync(decisionsDir)) {
    return null;
  }
  const files = await readdir(decisionsDir);
  for (const file of files) {
    if (!file.endsWith(".jsonl")) continue;
    const filePath = join(decisionsDir, file);
    const content = await readFile(filePath, "utf-8");
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
  if (!existsSync(decisionsDir)) {
    return [];
  }
  const files = await readdir(decisionsDir);
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
  if (!existsSync(decisionsDir)) {
    return 0;
  }
  const files = await readdir(decisionsDir);
  let total = 0;
  for (const file of files) {
    if (!file.endsWith(".jsonl")) continue;
    const s = await stat(join(decisionsDir, file));
    total += s.size;
  }
  return total;
}
var CONTEXT_DIR2 = "context";
var COMPACT_FILE = "compact.json";
var ARCHIVE_DIR2 = "archive";
function getCompactPath(outputDir) {
  return join(outputDir, CONTEXT_DIR2, COMPACT_FILE);
}
function getArchiveDir(outputDir) {
  return join(outputDir, CONTEXT_DIR2, ARCHIVE_DIR2);
}
async function loadCompactContext(outputDir, sessionId) {
  const compactPath = getCompactPath(outputDir);
  if (existsSync(compactPath)) {
    const content = await readFile(compactPath, "utf-8");
    return CompactContextSchema.parse(JSON.parse(content));
  }
  return {
    version: 1,
    session_id: sessionId || `ctx_${nanoid(8)}`,
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
  const contextDir = join(outputDir, CONTEXT_DIR2);
  await mkdir(contextDir, { recursive: true });
  const compactPath = getCompactPath(outputDir);
  await writeFile(compactPath, JSON.stringify(context, null, 2));
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
  await mkdir(archiveDir, { recursive: true });
  const archiveFilename = `compact_${Date.now()}.json`;
  const archivePath = join(archiveDir, archiveFilename);
  await writeFile(archivePath, JSON.stringify(current, null, 2));
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
  if (!existsSync(compactPath)) return false;
  const content = await readFile(compactPath, "utf-8");
  return Buffer.byteLength(content, "utf-8") > 4096;
}

// src/extract.ts
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

// src/layout-collision.ts
function detectLayoutCollisions(elements) {
  const textElements = elements.filter(
    (el) => el.text && el.text.trim().length > 0 && el.bounds.width > 0 && el.bounds.height > 0
  );
  textElements.sort((a, b) => a.bounds.y !== b.bounds.y ? a.bounds.y - b.bounds.y : a.bounds.x - b.bounds.x);
  const collisions = [];
  for (let i = 0; i < textElements.length; i++) {
    const a = textElements[i];
    const aBottom = a.bounds.y + a.bounds.height;
    for (let j = i + 1; j < textElements.length; j++) {
      const b = textElements[j];
      if (b.bounds.y > aBottom + 2) break;
      if (b.selector.startsWith(a.selector) || a.selector.startsWith(b.selector)) continue;
      const ix = Math.max(a.bounds.x, b.bounds.x);
      const iy = Math.max(a.bounds.y, b.bounds.y);
      const ix2 = Math.min(a.bounds.x + a.bounds.width, b.bounds.x + b.bounds.width);
      const iy2 = Math.min(a.bounds.y + a.bounds.height, b.bounds.y + b.bounds.height);
      const overlapW = ix2 - ix;
      const overlapH = iy2 - iy;
      if (overlapW <= 0 || overlapH <= 0) continue;
      const overlapArea = overlapW * overlapH;
      if (overlapW < 4 || overlapH < 4) continue;
      const areaA = a.bounds.width * a.bounds.height;
      const areaB = b.bounds.width * b.bounds.height;
      const smallerArea = Math.min(areaA, areaB);
      const overlapPercent = smallerArea > 0 ? overlapArea / smallerArea * 100 : 0;
      if (overlapPercent < 5) continue;
      collisions.push({
        element1: {
          selector: a.selector,
          text: a.text,
          bounds: { x: a.bounds.x, y: a.bounds.y, width: a.bounds.width, height: a.bounds.height }
        },
        element2: {
          selector: b.selector,
          text: b.text,
          bounds: { x: b.bounds.x, y: b.bounds.y, width: b.bounds.width, height: b.bounds.height }
        },
        overlapArea,
        overlapPercent
      });
    }
  }
  return {
    collisions,
    hasCollisions: collisions.length > 0
  };
}
var CustomCheckSchema = z.object({
  property: z.string(),
  operator: z.enum(["equals", "in-set", "not-in-set", "gte", "lte", "contains"]),
  values: z.array(z.union([z.string(), z.number()]))
});
var CustomPrincipleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  severity: z.enum(["error", "warn", "off"]),
  checks: z.array(CustomCheckSchema)
});
var CalmPrecisionConfigSchema = z.object({
  core: z.array(z.string()).default(["gestalt", "signal-noise", "content-chrome", "cognitive-load"]),
  stylistic: z.array(z.string()).default(["fitts", "hick"]),
  severity: z.record(z.string(), z.enum(["error", "warn", "off"])).default({})
});
var TypographyTokensSchema = z.object({
  fontFamilies: z.record(z.string(), z.string()).optional(),
  fontSizes: z.record(z.string(), z.number()).optional(),
  fontWeights: z.record(z.string(), z.number()).optional(),
  lineHeights: z.record(z.string(), z.number()).optional()
});
var DesignSystemConfigSchema = z.object({
  version: z.literal(1),
  name: z.string(),
  principles: z.object({
    calmPrecision: CalmPrecisionConfigSchema.default({}),
    custom: z.array(CustomPrincipleSchema).default([])
  }).default({}),
  tokens: z.object({
    colors: z.record(z.string(), z.string()).optional(),
    typography: TypographyTokensSchema.optional(),
    spacing: z.array(z.number()).optional(),
    borderRadius: z.record(z.string(), z.number()).optional(),
    shadows: z.record(z.string(), z.string()).optional(),
    transitions: z.record(z.string(), z.string()).optional(),
    touchTargets: z.object({ min: z.number() }).optional()
  }).default({})
});
async function loadDesignSystemConfig(projectDir) {
  let configPath = join(projectDir, ".ibr", "design-system.json");
  if (!existsSync(configPath)) {
    configPath = join(projectDir, "design-system.json");
    if (!existsSync(configPath)) {
      return void 0;
    }
  }
  const content = await readFile(configPath, "utf-8");
  const raw = JSON.parse(content);
  return DesignSystemConfigSchema.parse(raw);
}
function getDefaultSeverity(principleId, config) {
  const explicit = config.principles.calmPrecision.severity[principleId];
  if (explicit) return explicit;
  if (config.principles.calmPrecision.core.includes(principleId)) return "error";
  if (config.principles.calmPrecision.stylistic.includes(principleId)) return "warn";
  return "warn";
}
z.object({
  colors: z.record(z.string(), z.string()).optional(),
  typography: z.object({
    fontFamilies: z.record(z.string(), z.string()).optional(),
    fontSizes: z.record(z.string(), z.number()).optional(),
    fontWeights: z.record(z.string(), z.number()).optional(),
    lineHeights: z.record(z.string(), z.number()).optional()
  }).optional(),
  spacing: z.array(z.number()).optional(),
  borderRadius: z.record(z.string(), z.number()).optional(),
  shadows: z.record(z.string(), z.string()).optional(),
  transitions: z.record(z.string(), z.string()).optional(),
  touchTargets: z.object({ min: z.number() }).optional()
});
function toDesignTokenSpec(extended, name) {
  return {
    name,
    tokens: {
      colors: extended.colors,
      spacing: extended.spacing ? Object.fromEntries(extended.spacing.map((v, i) => [`${i}`, v])) : void 0,
      fontSizes: extended.typography?.fontSizes,
      touchTargets: extended.touchTargets,
      cornerRadius: extended.borderRadius
    }
  };
}
function loadTokenSpec(specPath) {
  if (!existsSync(specPath)) {
    throw new Error(`Token spec not found: ${specPath}`);
  }
  let spec;
  try {
    const content = readFileSync(specPath, "utf-8");
    spec = JSON.parse(content);
  } catch (err) {
    throw new Error(`Failed to parse token spec: ${err instanceof Error ? err.message : "Unknown error"}`);
  }
  const { tokens } = spec;
  const hasAnyTokens = tokens.colors || tokens.spacing || tokens.fontSizes || tokens.touchTargets || tokens.cornerRadius;
  if (!hasAnyTokens) {
    throw new Error("Token spec must define at least one token category (colors, spacing, fontSizes, touchTargets, or cornerRadius)");
  }
  return spec;
}
function normalizeColor(color) {
  if (!color) return "";
  if (color.startsWith("#")) {
    return color.toLowerCase();
  }
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }
  return color.toLowerCase();
}
function parsePx(value) {
  if (!value) return null;
  const match = value.match(/^([\d.]+)px$/);
  return match ? parseFloat(match[1]) : null;
}
function getStyle(styles, kebab) {
  if (!styles) return void 0;
  const val = styles[kebab];
  if (val !== void 0) return val;
  const camel = kebab.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  return styles[camel];
}
var touchTargetValidator = {
  name: "touchTargets",
  validate(elements, spec) {
    const violations = [];
    if (!spec.tokens.touchTargets) return violations;
    const minSize = spec.tokens.touchTargets.min;
    for (const element of elements) {
      const selector = element.selector || element.tagName || "unknown";
      const isInteractive2 = element.interactive?.hasOnClick || element.interactive?.hasHref;
      if (!isInteractive2) continue;
      const actualSize = Math.min(element.bounds.width, element.bounds.height);
      if (actualSize < minSize) {
        violations.push({
          element: selector,
          property: "touch-target",
          expected: minSize,
          actual: actualSize,
          severity: "error",
          message: `Touch target too small: ${actualSize}px < ${minSize}px (${selector})`
        });
      }
    }
    return violations;
  }
};
var fontSizeValidator = {
  name: "fontSizes",
  validate(elements, spec) {
    const violations = [];
    if (!spec.tokens.fontSizes) return violations;
    const tokenValues = Object.values(spec.tokens.fontSizes);
    for (const element of elements) {
      const selector = element.selector || element.tagName || "unknown";
      if (!element.computedStyles) continue;
      const fontSize = parsePx(getStyle(element.computedStyles, "font-size"));
      if (fontSize === null) continue;
      if (!tokenValues.includes(fontSize)) {
        violations.push({
          element: selector,
          property: "font-size",
          expected: `one of ${tokenValues.join(", ")}px`,
          actual: fontSize,
          severity: "warning",
          message: `Non-token font size: ${fontSize}px (expected one of ${tokenValues.join(", ")}px) (${selector})`
        });
      }
    }
    return violations;
  }
};
var colorValidator = {
  name: "colors",
  validate(elements, spec) {
    const violations = [];
    if (!spec.tokens.colors) return violations;
    const tokenColors = new Set(
      Object.values(spec.tokens.colors).map(normalizeColor)
    );
    for (const element of elements) {
      const selector = element.selector || element.tagName || "unknown";
      if (!element.computedStyles) continue;
      const textColor = getStyle(element.computedStyles, "color");
      if (textColor) {
        const normalized = normalizeColor(textColor);
        if (!tokenColors.has(normalized)) {
          violations.push({
            element: selector,
            property: "color",
            expected: "token color",
            actual: textColor,
            severity: "warning",
            message: `Non-token text color: ${textColor} (${selector})`
          });
        }
      }
      const bgColor = getStyle(element.computedStyles, "background-color");
      if (bgColor && bgColor !== "rgba(0, 0, 0, 0)" && bgColor !== "transparent") {
        const normalized = normalizeColor(bgColor);
        if (!tokenColors.has(normalized)) {
          violations.push({
            element: selector,
            property: "color",
            expected: "token color",
            actual: bgColor,
            severity: "warning",
            message: `Non-token background color: ${bgColor} (${selector})`
          });
        }
      }
    }
    return violations;
  }
};
var cornerRadiusValidator = {
  name: "cornerRadius",
  validate(elements, spec) {
    const violations = [];
    if (!spec.tokens.cornerRadius) return violations;
    const tokenValues = Object.values(spec.tokens.cornerRadius);
    for (const element of elements) {
      const selector = element.selector || element.tagName || "unknown";
      if (!element.computedStyles) continue;
      const borderRadius = parsePx(getStyle(element.computedStyles, "border-radius"));
      if (borderRadius === null || borderRadius === 0) continue;
      if (!tokenValues.includes(borderRadius)) {
        violations.push({
          element: selector,
          property: "corner-radius",
          expected: `one of ${tokenValues.join(", ")}px`,
          actual: borderRadius,
          severity: "warning",
          message: `Non-token border radius: ${borderRadius}px (expected one of ${tokenValues.join(", ")}px) (${selector})`
        });
      }
    }
    return violations;
  }
};
var spacingValidator = {
  name: "spacing",
  validate(elements, spec) {
    const violations = [];
    if (!spec.tokens.spacing) return violations;
    const tokenValues = Object.values(spec.tokens.spacing);
    for (const element of elements) {
      const selector = element.selector || element.tagName || "unknown";
      if (!element.computedStyles) continue;
      for (const prop of ["gap", "padding", "margin"]) {
        const raw = element.computedStyles[prop];
        const value = parsePx(raw);
        if (value === null || value === 0) continue;
        if (!tokenValues.includes(value)) {
          violations.push({
            element: selector,
            property: "spacing",
            expected: `one of ${tokenValues.join(", ")}px`,
            actual: value,
            severity: "warning",
            message: `Non-token ${prop}: ${value}px (expected one of ${tokenValues.join(", ")}px) (${selector})`
          });
        }
      }
    }
    return violations;
  }
};
var tokenValidators = /* @__PURE__ */ new Map([
  ["touchTargets", touchTargetValidator],
  ["fontSizes", fontSizeValidator],
  ["colors", colorValidator],
  ["cornerRadius", cornerRadiusValidator],
  ["spacing", spacingValidator]
]);
function validateAgainstTokens(elements, spec) {
  const violations = [];
  for (const [key, validator] of tokenValidators) {
    if (spec.tokens[key]) {
      violations.push(...validator.validate(elements, spec));
    }
  }
  return violations;
}

// src/design-system/tokens/validator.ts
function validateFontWeights(elements, weights) {
  const violations = [];
  const validWeights = new Set(Object.values(weights));
  for (const element of elements) {
    const style = element.computedStyles;
    if (!style) continue;
    const fw = getStyle(style, "font-weight");
    if (!fw) continue;
    const weight = parseInt(fw, 10);
    if (isNaN(weight)) continue;
    if (!validWeights.has(weight)) {
      violations.push({
        element: element.selector || element.tagName || "unknown",
        property: "font-weight",
        expected: `one of ${Array.from(validWeights).join(", ")}`,
        actual: weight,
        severity: "warning",
        message: `Non-token font weight: ${weight} (expected one of ${Array.from(validWeights).join(", ")}) (${element.selector || element.tagName})`
      });
    }
  }
  return violations;
}
function validateLineHeights(elements, lineHeights) {
  const violations = [];
  const validHeights = new Set(Object.values(lineHeights));
  for (const element of elements) {
    const style = element.computedStyles;
    if (!style) continue;
    const lh = getStyle(style, "line-height");
    if (!lh || lh === "normal") continue;
    let value;
    const pxVal = parsePx(lh);
    if (pxVal !== null) {
      const fontSize = parsePx(getStyle(style, "font-size"));
      if (fontSize && fontSize > 0) {
        value = Math.round(pxVal / fontSize * 100) / 100;
      } else {
        continue;
      }
    } else {
      value = parseFloat(lh);
      if (isNaN(value)) continue;
    }
    const isValid = Array.from(validHeights).some((vh) => Math.abs(vh - value) < 0.05);
    if (!isValid) {
      violations.push({
        element: element.selector || element.tagName || "unknown",
        property: "line-height",
        expected: `one of ${Array.from(validHeights).join(", ")}`,
        actual: value,
        severity: "warning",
        message: `Non-token line height: ${value} (expected one of ${Array.from(validHeights).join(", ")}) (${element.selector || element.tagName})`
      });
    }
  }
  return violations;
}
function validateExtendedTokens(elements, tokens, systemName) {
  const violations = [];
  const oldSpec = toDesignTokenSpec(tokens, systemName);
  violations.push(...validateAgainstTokens(elements, oldSpec));
  if (tokens.typography?.fontWeights) {
    violations.push(...validateFontWeights(elements, tokens.typography.fontWeights));
  }
  if (tokens.typography?.lineHeights) {
    violations.push(...validateLineHeights(elements, tokens.typography.lineHeights));
  }
  return violations;
}
function calculateComplianceScore(totalChecked, violationCount) {
  if (totalChecked === 0) return 100;
  const passing = totalChecked - violationCount;
  return Math.round(passing / totalChecked * 100);
}

// src/design-system/index.ts
init_calm_precision();
async function runDesignSystemCheck(elements, context, projectDir) {
  const config = await loadDesignSystemConfig(projectDir);
  if (!config) return void 0;
  const principleViolations = [];
  for (const rule of allCalmPrecisionRules) {
    const principleId = Object.entries(principleToRules).find(
      ([, ruleIds]) => ruleIds.includes(rule.id)
    )?.[0];
    if (!principleId) continue;
    const severity = getDefaultSeverity(principleId, config);
    if (severity === "off") continue;
    for (const element of elements) {
      const violation = rule.check(element, context);
      if (violation) {
        principleViolations.push({
          principleId: rule.id,
          principleName: rule.name,
          severity: severity === "error" ? "error" : "warn",
          message: violation.message,
          element: violation.element,
          bounds: violation.bounds,
          fix: violation.fix
        });
      }
    }
  }
  const customViolations = [];
  for (const custom of config.principles.custom) {
    if (custom.severity === "off") continue;
    for (const element of elements) {
      for (const check of custom.checks) {
        const style = element.computedStyles;
        if (!style) continue;
        const actual = style[check.property];
        if (!actual) continue;
        let violated = false;
        switch (check.operator) {
          case "in-set":
            violated = !check.values.map(String).includes(actual);
            break;
          case "not-in-set":
            violated = check.values.map(String).includes(actual);
            break;
          case "equals":
            violated = actual !== String(check.values[0]);
            break;
          case "gte":
            violated = parseFloat(actual) < Number(check.values[0]);
            break;
          case "lte":
            violated = parseFloat(actual) > Number(check.values[0]);
            break;
          case "contains":
            violated = !String(check.values[0]).split(",").some((v) => actual.includes(v.trim()));
            break;
        }
        if (violated) {
          customViolations.push({
            principleId: custom.id,
            principleName: custom.name,
            severity: custom.severity,
            message: `${custom.name}: ${check.property} is "${actual}" (expected ${check.operator} ${check.values.join(", ")})`,
            element: element.selector,
            bounds: element.bounds,
            fix: custom.description
          });
        }
      }
    }
  }
  const tokenViolations = config.tokens ? validateExtendedTokens(elements, config.tokens, config.name) : [];
  const tokenCategories = Object.keys(config.tokens).filter(
    (k) => config.tokens[k] !== void 0
  ).length;
  const totalChecked = elements.length * Math.max(tokenCategories, 1);
  const complianceScore = calculateComplianceScore(totalChecked, tokenViolations.length);
  return {
    configName: config.name,
    principleViolations,
    tokenViolations,
    customViolations,
    complianceScore
  };
}

// src/sensors/visual-patterns.ts
function styleFingerprint(el) {
  const s = el.computedStyles ?? {};
  return {
    backgroundColor: s.backgroundColor ?? "",
    color: s.color ?? "",
    borderRadius: s.borderRadius ?? "",
    padding: s.padding ?? "",
    fontSize: s.fontSize ?? "",
    fontWeight: s.fontWeight ?? "",
    borderWidth: s.borderWidth ?? "",
    borderColor: s.borderColor ?? ""
  };
}
function fingerprintKey(fp) {
  return Object.entries(fp).map(([k, v]) => `${k}=${v}`).join("|");
}
function categorize(el) {
  const tag = el.tagName.toLowerCase();
  const role = el.a11y.role ?? "";
  if (tag === "button" || role === "button") return "button";
  if (tag === "a" || role === "link") return "link";
  if (tag === "input" || tag === "textarea" || tag === "select" || role === "textbox" || role === "combobox") return "input";
  if (/^h[1-6]$/.test(tag) || role === "heading") return "heading";
  return null;
}
function collectVisualPatterns(ctx) {
  const byCategory = /* @__PURE__ */ new Map();
  for (const el of ctx.elements) {
    const cat = categorize(el);
    if (!cat) continue;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(el);
  }
  const reports = [];
  for (const [category, els] of byCategory.entries()) {
    const groupMap = /* @__PURE__ */ new Map();
    for (const el of els) {
      const fp = styleFingerprint(el);
      const key = fingerprintKey(fp);
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          patternKey: key.slice(0, 80),
          count: 0,
          elements: [],
          styleFingerprint: fp
        });
      }
      const g = groupMap.get(key);
      g.count++;
      if (g.elements.length < 5) {
        g.elements.push({
          selector: el.selector,
          text: (el.text ?? "").slice(0, 40)
        });
      }
    }
    const groups = Array.from(groupMap.values()).sort((a, b) => b.count - a.count);
    const total = els.length;
    const dominant = groups[0] && groups[0].count / total > 0.8 ? groups[0] : void 0;
    reports.push({
      category,
      totalElements: total,
      distinctPatterns: groups.length,
      groups,
      dominant
    });
  }
  return reports;
}

// src/sensors/component-census.ts
function detectComponentName(el) {
  const attrs = el.attributes;
  if (attrs?.["data-component"]) return attrs["data-component"];
  const testId = el.sourceHint?.dataTestId;
  if (testId) {
    const name = testId.split(/[-_]/).filter(Boolean).map((p) => (p[0]?.toUpperCase() ?? "") + p.slice(1)).join("");
    if (name.length > 0) return name;
  }
  const className = el.className ?? attrs?.["class"] ?? attrs?.["className"];
  if (className) {
    const match = className.match(/\b([A-Z][a-zA-Z0-9]+)(?:_|$|\s)/);
    if (match) return match[1];
  }
  return null;
}
function collectComponentCensus(ctx) {
  const byTag = {};
  const byRole = {};
  let withHandlers = 0;
  let withoutHandlers = 0;
  const orphanInteractive = [];
  const componentMap = /* @__PURE__ */ new Map();
  for (const el of ctx.elements) {
    const tag = el.tagName.toLowerCase();
    if (tag) byTag[tag] = (byTag[tag] ?? 0) + 1;
    const role = el.a11y.role;
    if (role) byRole[role] = (byRole[role] ?? 0) + 1;
    const interactive = el.interactive;
    const hasHandler = !!(interactive.hasOnClick || interactive.hasHref || interactive.hasReactHandler || interactive.hasVueHandler || interactive.hasAngularHandler);
    if (hasHandler) {
      withHandlers++;
    } else {
      withoutHandlers++;
      const cursor = el.computedStyles?.cursor;
      if (cursor === "pointer" && (el.text ?? "").trim().length > 0) {
        if (orphanInteractive.length < 20) {
          orphanInteractive.push({
            selector: el.selector,
            text: (el.text ?? "").slice(0, 60),
            reason: "cursor:pointer with no handler"
          });
        }
      }
    }
    const componentName = detectComponentName(el) ?? el.tagName.toLowerCase();
    const existing = componentMap.get(componentName);
    if (existing) {
      existing.count++;
      if (existing.selectors.length < 5) existing.selectors.push(el.selector);
    } else {
      componentMap.set(componentName, { count: 1, selectors: [el.selector] });
    }
  }
  const byComponent = {};
  for (const [name, data] of componentMap) {
    byComponent[name] = data.count;
  }
  const topComponents = Array.from(componentMap.entries()).sort((a, b) => b[1].count - a[1].count).slice(0, 20).map(([name, data]) => ({ name, count: data.count, selectors: data.selectors }));
  return {
    byTag,
    byRole,
    withHandlers,
    withoutHandlers,
    orphanInteractive,
    byComponent,
    topComponents
  };
}

// src/sensors/interaction-map.ts
function collectInteractionMap(ctx) {
  const missingHandlers = [];
  let total = 0;
  let withHandlers = 0;
  let withoutHandlers = 0;
  let disabled = 0;
  let formCount = 0;
  for (const el of ctx.elements) {
    const tag = el.tagName.toLowerCase();
    const role = el.a11y.role ?? "";
    const cursor = el.computedStyles?.cursor;
    const looksInteractive2 = tag === "button" || tag === "a" || role === "button" || role === "link" || cursor === "pointer";
    if (tag === "form") formCount++;
    if (!looksInteractive2) continue;
    total++;
    const interactive = el.interactive;
    const hasHandler = !!(interactive.hasOnClick || interactive.hasHref || interactive.hasReactHandler || interactive.hasVueHandler || interactive.hasAngularHandler);
    if (hasHandler) {
      withHandlers++;
    } else {
      withoutHandlers++;
      if (missingHandlers.length < 25) {
        missingHandlers.push({
          selector: el.selector,
          text: (el.text ?? "").slice(0, 60),
          tagName: tag,
          role: role || void 0
        });
      }
    }
    if (interactive.isDisabled) disabled++;
  }
  return { total, withHandlers, withoutHandlers, missingHandlers, disabled, formCount };
}

// src/sensors/contrast-report.ts
function parseColor2(color) {
  if (!color || color === "transparent" || color === "initial" || color === "inherit" || color === "unset") {
    return null;
  }
  const rgbaMatch = color.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([\d.]+))?\s*\)$/);
  if (rgbaMatch) {
    const alpha = rgbaMatch[4] !== void 0 ? parseFloat(rgbaMatch[4]) : 1;
    if (alpha === 0) return null;
    return [parseInt(rgbaMatch[1], 10), parseInt(rgbaMatch[2], 10), parseInt(rgbaMatch[3], 10)];
  }
  const hex6 = color.match(/^#([0-9a-fA-F]{6})$/);
  if (hex6) {
    const n = parseInt(hex6[1], 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  const hex3 = color.match(/^#([0-9a-fA-F]{3})$/);
  if (hex3) {
    return [
      parseInt(hex3[1][0], 16) * 17,
      parseInt(hex3[1][1], 16) * 17,
      parseInt(hex3[1][2], 16) * 17
    ];
  }
  return null;
}
function linearize(c) {
  const n = c / 255;
  return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
}
function luminance([r, g, b]) {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}
function contrastRatio(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
function isLargeText(styles) {
  const fontSize = parseFloat(styles.fontSize ?? "");
  if (isNaN(fontSize)) return false;
  const fw = styles.fontWeight ?? "400";
  const isBold = fw === "bold" || parseInt(fw, 10) >= 700;
  return fontSize >= 18 || isBold && fontSize >= 14;
}
function collectContrastReport(ctx) {
  let pass = 0;
  let fail = 0;
  let passAAA = 0;
  const failing = [];
  let minRatio;
  let lightOnDark = 0;
  let darkOnLight = 0;
  for (const el of ctx.elements) {
    const text = (el.text ?? "").trim();
    if (!text) continue;
    const styles = el.computedStyles;
    if (!styles) continue;
    const fg = parseColor2(styles.color ?? "");
    const bg = parseColor2(styles.backgroundColor ?? "");
    if (!fg || !bg) continue;
    const large = isLargeText(styles);
    const ratio = contrastRatio(fg, bg);
    const aaThreshold = large ? 3 : 4.5;
    const aaaThreshold = large ? 4.5 : 7;
    const fontSize = parseFloat(styles.fontSize ?? "16") || 16;
    const entry = {
      selector: el.selector,
      text: text.slice(0, 60),
      ratio: Number(ratio.toFixed(2)),
      pass: ratio >= aaaThreshold ? "AAA" : ratio >= aaThreshold ? "AA" : "FAIL",
      fontSize,
      largeText: large
    };
    if (ratio >= aaThreshold) {
      pass++;
    } else {
      fail++;
      if (failing.length < 50) failing.push(entry);
    }
    if (ratio >= aaaThreshold) passAAA++;
    if (!minRatio || ratio < minRatio.ratio) minRatio = entry;
    const fgAvg = (fg[0] + fg[1] + fg[2]) / 3;
    const bgAvg = (bg[0] + bg[1] + bg[2]) / 3;
    if (fgAvg > bgAvg) lightOnDark++;
    else darkOnLight++;
  }
  return {
    totalChecked: pass + fail,
    pass,
    fail,
    passAAA,
    failing,
    minRatio,
    byTone: { lightOnDark, darkOnLight }
  };
}

// src/sensors/navigation.ts
function selectorDepth(selector) {
  return (selector || "").split(/\s*>\s*/).length;
}
function isDescendantOf(childSelector, ancestorSelector) {
  if (!ancestorSelector || !childSelector) return false;
  return childSelector.startsWith(ancestorSelector + " ") || childSelector.startsWith(ancestorSelector + ">") || childSelector.startsWith(ancestorSelector + " >") || childSelector === ancestorSelector;
}
function linkLabel(el) {
  return (el.text ?? el.a11y.ariaLabel ?? "").trim().slice(0, 60);
}
function buildTree(links, navSelector) {
  const navDepth = selectorDepth(navSelector);
  const sorted = [...links].sort((a, b) => a.selector.length - b.selector.length);
  const roots = [];
  const stack = [];
  for (const el of sorted) {
    const label = linkLabel(el);
    if (!label) continue;
    const absDepth = selectorDepth(el.selector);
    const relDepth = absDepth - navDepth;
    const node = {
      label,
      selector: el.selector,
      depth: relDepth,
      children: []
    };
    let parentEntry;
    for (let i = stack.length - 1; i >= 0; i--) {
      const candidate = stack[i];
      if (candidate.absDepth < absDepth && isDescendantOf(el.selector, candidate.node.selector)) {
        parentEntry = candidate;
        break;
      }
    }
    if (parentEntry) {
      parentEntry.node.children.push(node);
    } else {
      roots.push(node);
    }
    stack.push({ node, absDepth });
  }
  function maxD(nodes, current) {
    let m = current;
    for (const n of nodes) m = Math.max(m, maxD(n.children, current + 1));
    return m;
  }
  const maxDepth = roots.length > 0 ? maxD(roots, 1) : 0;
  return { roots, maxDepth };
}
function flattenTree(nodes, depth, counts) {
  for (const node of nodes) {
    counts[depth] = (counts[depth] ?? 0) + 1;
    flattenTree(node.children, depth + 1, counts);
  }
}
function collectNavigationMap(ctx) {
  const navElements = ctx.elements.filter((el) => {
    const role = el.a11y.role ?? "";
    const tag = el.tagName.toLowerCase();
    return role === "navigation" || tag === "nav";
  });
  const links = ctx.elements.filter((el) => {
    const role = el.a11y.role ?? "";
    const tag = el.tagName.toLowerCase();
    return role === "link" || tag === "a";
  });
  if (links.length === 0 && navElements.length === 0) return void 0;
  if (navElements.length > 0) {
    const navRegions = [];
    const byDepth = [];
    for (const nav of navElements) {
      const navLinks = links.filter(
        (link) => isDescendantOf(link.selector, nav.selector)
      );
      const { roots, maxDepth } = buildTree(navLinks, nav.selector);
      flattenTree(roots, 0, byDepth);
      navRegions.push({
        rootSelector: nav.selector,
        roots,
        depth: maxDepth
      });
    }
    const allRoots = navRegions.flatMap((r) => r.roots);
    const overallMaxDepth = navRegions.reduce((m, r) => Math.max(m, r.depth), 0);
    return {
      navs: navRegions,
      roots: allRoots.slice(0, 40),
      depth: overallMaxDepth,
      totalLinks: links.length,
      byDepth
    };
  }
  const flatRoots = [];
  for (const link of links.slice(0, 60)) {
    const label = linkLabel(link);
    if (!label) continue;
    flatRoots.push({
      label,
      selector: link.selector,
      depth: 0,
      children: []
    });
  }
  return {
    navs: [],
    roots: flatRoots.slice(0, 40),
    depth: 1,
    totalLinks: links.length,
    byDepth: [flatRoots.length]
  };
}

// src/sensors/index.ts
function runSensors(ctx) {
  const visualPatterns = collectVisualPatterns(ctx);
  const componentCensus = collectComponentCensus(ctx);
  const interactionMap = collectInteractionMap(ctx);
  const contrast = collectContrastReport(ctx);
  const navigation = collectNavigationMap(ctx);
  const oneLiners = [];
  for (const vp of visualPatterns) {
    if (vp.distinctPatterns > 1) {
      const dominantNote = vp.dominant ? ` (${vp.dominant.count}/${vp.totalElements} share dominant pattern)` : "";
      oneLiners.push(
        `${vp.category}: ${vp.totalElements} total, ${vp.distinctPatterns} distinct patterns${dominantNote}`
      );
    }
  }
  if (interactionMap.withoutHandlers > 0) {
    oneLiners.push(
      `${interactionMap.withoutHandlers}/${interactionMap.total} interactive-looking elements have no handler`
    );
  }
  if (contrast.fail > 0) {
    oneLiners.push(`Contrast: ${contrast.fail}/${contrast.totalChecked} text elements fail WCAG AA`);
  }
  if (componentCensus.orphanInteractive.length > 0) {
    oneLiners.push(
      `${componentCensus.orphanInteractive.length} cursor:pointer elements have no handler`
    );
  }
  if (navigation) {
    if (navigation.navs.length > 0) {
      oneLiners.push(
        `Nav: ${navigation.navs.length} nav region(s), max depth ${navigation.depth}, ${navigation.totalLinks} total links`
      );
    } else {
      oneLiners.push(`Navigation: ${navigation.totalLinks} links, ${navigation.depth} level(s) deep`);
    }
  }
  const namedComponents = componentCensus.topComponents.filter(
    (c) => !/^[a-z]/.test(c.name) || c.name.includes("-")
    // PascalCase or testid-derived names
  );
  if (namedComponents.length > 0) {
    const top3 = namedComponents.slice(0, 3).map((c) => `${c.name}\xD7${c.count}`).join(", ");
    const totalNamed = namedComponents.length;
    oneLiners.push(`Components: ${top3}${totalNamed > 3 ? ` (top 3 of ${totalNamed})` : ""}`);
  }
  const report = {
    visualPatterns,
    navigation,
    componentCensus,
    interactionMap,
    contrast,
    oneLiners
  };
  if (ctx.semantic) {
    const sem = ctx.semantic;
    const states = [];
    if (sem.state.auth.authenticated === true) states.push("authenticated");
    if (sem.state.auth.authenticated === false) states.push("not authenticated");
    if (sem.state.loading.loading) states.push(`loading:${sem.state.loading.type}`);
    if (sem.state.errors.hasErrors) {
      for (const e of sem.state.errors.errors) states.push(`error:${e.type}`);
    }
    report.semanticState = {
      pageIntent: sem.pageIntent.intent,
      states,
      availableActions: sem.availableActions.map((a) => a.action)
    };
  }
  return report;
}

// src/rules/wcag-contrast.ts
function parseColor3(color) {
  if (!color || color === "transparent" || color === "initial" || color === "inherit" || color === "unset") {
    return null;
  }
  const rgbaMatch = color.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([\d.]+))?\s*\)$/);
  if (rgbaMatch) {
    const alpha = rgbaMatch[4] !== void 0 ? parseFloat(rgbaMatch[4]) : 1;
    if (alpha === 0) return null;
    return [parseInt(rgbaMatch[1], 10), parseInt(rgbaMatch[2], 10), parseInt(rgbaMatch[3], 10)];
  }
  const hex6Match = color.match(/^#([0-9a-fA-F]{6})$/);
  if (hex6Match) {
    const n = parseInt(hex6Match[1], 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  const hex3Match = color.match(/^#([0-9a-fA-F]{3})$/);
  if (hex3Match) {
    const r = parseInt(hex3Match[1][0], 16) * 17;
    const g = parseInt(hex3Match[1][1], 16) * 17;
    const b = parseInt(hex3Match[1][2], 16) * 17;
    return [r, g, b];
  }
  return null;
}
function linearize2(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function relativeLuminance2(r, g, b) {
  return 0.2126 * linearize2(r) + 0.7152 * linearize2(g) + 0.0722 * linearize2(b);
}
function contrastRatio2(l1, l2) {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
function isLargeText2(styles) {
  const fontSizeStr = styles.fontSize ?? "";
  const fontWeightStr = styles.fontWeight ?? "";
  const fontSize = parseFloat(fontSizeStr);
  if (isNaN(fontSize)) return false;
  const isBold = fontWeightStr === "bold" || parseInt(fontWeightStr, 10) >= 700;
  return fontSize >= 18 || isBold && fontSize >= 14;
}
var wcagContrastRules = [
  {
    id: "wcag/contrast",
    name: "WCAG 2.1: Color Contrast",
    description: "Text must meet WCAG 2.1 minimum contrast: 4.5:1 normal, 3:1 large text",
    defaultSeverity: "error",
    check: (element, _context) => {
      const style = element.computedStyles;
      if (!style) return null;
      const hasText = element.text && element.text.trim().length > 0;
      if (!hasText) return null;
      const fgColor = parseColor3(style.color ?? "");
      const bgColor = parseColor3(style.backgroundColor ?? "");
      if (!fgColor || !bgColor) return null;
      const fgL = relativeLuminance2(...fgColor);
      const bgL = relativeLuminance2(...bgColor);
      const ratio = contrastRatio2(fgL, bgL);
      const largeText = isLargeText2(style);
      const threshold = largeText ? 3 : 4.5;
      if (ratio < threshold) {
        const ratioStr = ratio.toFixed(2);
        const textSnippet = (element.text ?? "").slice(0, 40);
        return {
          ruleId: "wcag/contrast",
          ruleName: "WCAG 2.1: Color Contrast",
          severity: "error",
          message: `"${textSnippet}" has contrast ratio ${ratioStr}:1 (required ${threshold}:1 for ${largeText ? "large" : "normal"} text)`,
          element: element.selector,
          bounds: element.bounds,
          fix: `Increase contrast between foreground ${style.color ?? ""} and background ${style.backgroundColor ?? ""}`
        };
      }
      return null;
    }
  }
];

// src/rules/touch-targets.ts
var INTERACTIVE_ROLES = /* @__PURE__ */ new Set([
  "button",
  "link",
  "textbox",
  "checkbox",
  "radio",
  "combobox",
  "listbox",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "searchbox",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "treeitem"
]);
var INTERACTIVE_TAGS = /* @__PURE__ */ new Set(["button", "a", "input", "select", "textarea"]);
function isInteractiveElement(element) {
  if (INTERACTIVE_TAGS.has(element.tagName.toLowerCase())) return true;
  const role = element.a11y?.role;
  if (role && INTERACTIVE_ROLES.has(role)) return true;
  return false;
}
var touchTargetRules = [
  {
    id: "touch-targets/minimum-size",
    name: "Touch Target: Minimum Size",
    description: "Interactive elements must meet minimum touch target size (44x44px mobile, 24x24px desktop)",
    defaultSeverity: "warn",
    check: (element, context, options) => {
      if (!isInteractiveElement(element)) return null;
      const isMobile = context.isMobile || context.viewportWidth < 768;
      const minSize = isMobile ? options?.mobileMinSize ?? 44 : options?.desktopMinSize ?? 24;
      const { width, height } = element.bounds;
      if (width === 0 && height === 0) return null;
      if (width < minSize || height < minSize) {
        const label = element.text || element.a11y?.ariaLabel || element.selector;
        return {
          ruleId: "touch-targets/minimum-size",
          ruleName: "Touch Target: Minimum Size",
          severity: "warn",
          message: `"${label.slice(0, 40)}" touch target is ${width}x${height}px (minimum ${minSize}x${minSize}px on ${isMobile ? "mobile" : "desktop"})`,
          element: element.selector,
          bounds: element.bounds,
          fix: `Increase element size to at least ${minSize}x${minSize}px`
        };
      }
      return null;
    }
  }
];

// src/rules/text-hierarchy.ts
var TITLE_TAGS = /* @__PURE__ */ new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
var DESCRIPTION_TAGS = /* @__PURE__ */ new Set(["p", "blockquote", "figcaption", "li"]);
function inferLevel(element) {
  const tag = element.tagName.toLowerCase();
  const role = element.a11y?.role ?? "";
  if (TITLE_TAGS.has(tag) || role === "heading") return "title";
  if (DESCRIPTION_TAGS.has(tag) || role === "paragraph") return "description";
  if (tag === "span" || tag === "small" || tag === "label") {
    const size = parseFloat(element.computedStyles?.fontSize ?? "0");
    if (size > 0 && size <= 12) return "metadata";
  }
  return "unknown";
}
function parseFontSize(element) {
  const raw = element.computedStyles?.fontSize;
  if (!raw) return null;
  const val = parseFloat(raw);
  return isNaN(val) ? null : val;
}
var textHierarchyRules = [
  {
    id: "text-hierarchy/title-vs-description",
    name: "Text Hierarchy: Title vs Description Size",
    description: "Title-level elements must be visually larger than description-level elements",
    defaultSeverity: "warn",
    check: (element, context) => {
      if (inferLevel(element) !== "title") return null;
      const titleSize = parseFontSize(element);
      if (titleSize === null) return null;
      for (const other of context.allElements) {
        if (inferLevel(other) !== "description") continue;
        const descSize = parseFontSize(other);
        if (descSize === null) continue;
        if (descSize >= titleSize) {
          const titleLabel = element.text?.slice(0, 30) || element.selector;
          const descLabel = other.text?.slice(0, 30) || other.selector;
          return {
            ruleId: "text-hierarchy/title-vs-description",
            ruleName: "Text Hierarchy: Title vs Description Size",
            severity: "warn",
            message: `Title "${titleLabel}" (${titleSize}px) is not larger than description "${descLabel}" (${descSize}px)`,
            element: element.selector,
            bounds: element.bounds,
            fix: "Ensure heading/title font sizes are larger than body/description text"
          };
        }
      }
      return null;
    }
  }
];

// src/rules/handler-integrity.ts
var VISUALLY_INTERACTIVE_ROLES = /* @__PURE__ */ new Set(["button", "link", "menuitem", "tab", "option"]);
var VISUALLY_INTERACTIVE_TAGS = /* @__PURE__ */ new Set(["button", "a"]);
function looksInteractive(element) {
  const tag = element.tagName.toLowerCase();
  const role = element.a11y?.role ?? "";
  const cursor = element.interactive?.cursor ?? "";
  if (VISUALLY_INTERACTIVE_TAGS.has(tag)) return true;
  if (VISUALLY_INTERACTIVE_ROLES.has(role)) return true;
  if (cursor === "pointer") return true;
  return false;
}
function hasAnyHandler(element) {
  return !!(element.interactive.hasOnClick || element.interactive.hasHref || element.interactive.hasReactHandler || element.interactive.hasVueHandler || element.interactive.hasAngularHandler);
}
function hasDisabledVisual(element) {
  const style = element.computedStyles;
  if (!style) return false;
  const opacity = parseFloat(style.opacity ?? "1");
  if (!isNaN(opacity) && opacity <= 0.7) return true;
  if (element.interactive.cursor === "not-allowed") return true;
  const bg = style.backgroundColor ?? "";
  const color = style.color ?? "";
  const grayPattern = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/;
  for (const c of [bg, color]) {
    const m = c.match(grayPattern);
    if (m) {
      const r = parseInt(m[1], 10);
      const g = parseInt(m[2], 10);
      const b = parseInt(m[3], 10);
      const range = Math.max(r, g, b) - Math.min(r, g, b);
      if (range < 30 && r > 100 && r < 220) return true;
    }
  }
  return false;
}
var handlerIntegrityRules = [
  {
    id: "handler-integrity/fake-interactive",
    name: "Handler Integrity: Fake Interactive Element",
    description: "Elements that look interactive must have actual handlers",
    defaultSeverity: "error",
    check: (element, _context) => {
      if (!looksInteractive(element)) return null;
      if (element.interactive.isDisabled) return null;
      if (hasAnyHandler(element)) return null;
      const label = element.text || element.a11y?.ariaLabel || element.selector;
      return {
        ruleId: "handler-integrity/fake-interactive",
        ruleName: "Handler Integrity: Fake Interactive Element",
        severity: "error",
        message: `"${label.slice(0, 40)}" looks interactive (role/tag/cursor) but has no handler`,
        element: element.selector,
        bounds: element.bounds,
        fix: "Add an onClick handler, href, or remove interactive appearance"
      };
    }
  },
  {
    id: "handler-integrity/disabled-no-visual",
    name: "Handler Integrity: Disabled Without Visual State",
    description: "Disabled elements must have a visible disabled appearance",
    defaultSeverity: "warn",
    check: (element, _context) => {
      if (!element.interactive.isDisabled) return null;
      if (hasDisabledVisual(element)) return null;
      const label = element.text || element.a11y?.ariaLabel || element.selector;
      return {
        ruleId: "handler-integrity/disabled-no-visual",
        ruleName: "Handler Integrity: Disabled Without Visual State",
        severity: "warn",
        message: `"${label.slice(0, 40)}" is disabled but shows no visual disabled state`,
        element: element.selector,
        bounds: element.bounds,
        fix: "Apply opacity <= 0.7, cursor: not-allowed, or muted color to disabled elements"
      };
    }
  }
];

// src/rules/spacing-grid.ts
var SPACING_PROPERTIES = [
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  // Shorthand forms that may appear in computedStyles
  "padding",
  "margin",
  "gap",
  "rowGap",
  "columnGap"
];
function parsePxValue(value) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "auto" || trimmed === "normal" || trimmed === "initial" || trimmed === "inherit") {
    return null;
  }
  if (trimmed.endsWith("%")) return null;
  if (trimmed.endsWith("em") || trimmed.endsWith("rem") || trimmed.endsWith("vw") || trimmed.endsWith("vh")) {
    return null;
  }
  if (!trimmed.endsWith("px")) return null;
  const n = parseFloat(trimmed);
  return isNaN(n) ? null : n;
}
function isOnGrid(px) {
  if (px === 0) return true;
  return Math.round(px) % 4 === 0;
}
function parseSpacingShorthand(value) {
  const parts = value.trim().split(/\s+/);
  const results = [];
  for (const part of parts) {
    const px = parsePxValue(part);
    if (px !== null) results.push(px);
  }
  return results;
}
var spacingGridRules = [
  {
    id: "spacing-grid/off-grid",
    name: "Spacing Grid: Off 8pt Grid",
    description: "Padding and margin values should be multiples of 4px (half 8pt grid)",
    defaultSeverity: "warn",
    check: (element, _context) => {
      const style = element.computedStyles;
      if (!style) return null;
      const offGridValues = [];
      for (const prop of SPACING_PROPERTIES) {
        const raw = style[prop];
        if (!raw) continue;
        const isShorthand = prop === "padding" || prop === "margin";
        if (isShorthand) {
          const values = parseSpacingShorthand(raw);
          for (const v of values) {
            if (!isOnGrid(v)) {
              offGridValues.push({ property: prop, value: raw });
              break;
            }
          }
        } else {
          const px = parsePxValue(raw);
          if (px !== null && !isOnGrid(px)) {
            offGridValues.push({ property: prop, value: raw });
          }
        }
      }
      if (offGridValues.length === 0) return null;
      const detail = offGridValues.map((v) => `${v.property}: ${v.value}`).join(", ");
      const label = element.text?.slice(0, 30) || element.selector;
      return {
        ruleId: "spacing-grid/off-grid",
        ruleName: "Spacing Grid: Off 8pt Grid",
        severity: "warn",
        message: `"${label}" has off-grid spacing: ${detail}`,
        element: element.selector,
        bounds: element.bounds,
        fix: "Use spacing values that are multiples of 4px (e.g., 4, 8, 12, 16, 20, 24, 32px)"
      };
    }
  }
];

// src/rules/index.ts
var allRules = [
  ...wcagContrastRules,
  ...touchTargetRules,
  ...textHierarchyRules,
  ...handlerIntegrityRules,
  ...spacingGridRules
];
function runAllRules(elements, context) {
  const results = [];
  for (const element of elements) {
    for (const rule of allRules) {
      const violation = rule.check(element, context);
      if (!violation) continue;
      const severity = violation.severity === "error" ? "error" : "warning";
      results.push({
        rule: violation.ruleId,
        severity,
        element: violation.element ?? element.selector,
        expected: violation.fix ?? "",
        actual: violation.message,
        evidence: {
          ruleName: violation.ruleName,
          bounds: violation.bounds,
          selector: element.selector,
          tagName: element.tagName,
          text: element.text
        }
      });
    }
  }
  return results;
}

// src/summarize.ts
var SIGNATURE_KEYS = [
  "fontSize",
  "fontWeight",
  "color",
  "backgroundColor",
  "borderRadius",
  "padding"
];
function extractSignature(el) {
  const s = el.computedStyles ?? {};
  return {
    fontSize: s["fontSize"] ?? "",
    fontWeight: s["fontWeight"] ?? "",
    color: s["color"] ?? "",
    backgroundColor: s["backgroundColor"] ?? "",
    borderRadius: s["borderRadius"] ?? "",
    padding: s["padding"] ?? ""
  };
}
function hashSignature(sig) {
  return SIGNATURE_KEYS.map((k) => `${k}:${sig[k]}`).join("|");
}
function matchCount(a, b) {
  let count = 0;
  for (const key of SIGNATURE_KEYS) {
    if (a[key] === b[key]) count++;
  }
  return count;
}
function elementLabel(el) {
  return el.text?.trim() || el.a11y?.ariaLabel || el.id || el.selector.slice(0, 60);
}
function resolveRole(el) {
  return el.a11y?.role ?? el.tagName ?? "unknown";
}
function parseColor4(color) {
  if (!color || color === "transparent" || color === "none") return null;
  const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3])
    };
  }
  const hexMatch = color.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) {
    const h = hexMatch[1];
    if (h.length === 3) {
      return {
        r: parseInt(h[0] + h[0], 16),
        g: parseInt(h[1] + h[1], 16),
        b: parseInt(h[2] + h[2], 16)
      };
    }
    if (h.length >= 6) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16)
      };
    }
  }
  const named = {
    white: { r: 255, g: 255, b: 255 },
    black: { r: 0, g: 0, b: 0 },
    red: { r: 255, g: 0, b: 0 },
    green: { r: 0, g: 128, b: 0 },
    blue: { r: 0, g: 0, b: 255 },
    gray: { r: 128, g: 128, b: 128 },
    grey: { r: 128, g: 128, b: 128 }
  };
  return named[color.toLowerCase()] ?? null;
}
function relativeLuminance3(r, g, b) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrastRatio3(l1, l2) {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
function buildVisualPatterns(elements) {
  if (elements.length === 0) return [];
  const groups = /* @__PURE__ */ new Map();
  for (const el of elements) {
    const sig = extractSignature(el);
    const key = hashSignature(sig);
    const existing = groups.get(key);
    if (existing) {
      existing.elements.push(el);
    } else {
      groups.set(key, { sig, elements: [el] });
    }
  }
  const groupList = Array.from(groups.entries()).map(([key, { sig, elements: els }]) => ({
    patternId: key.slice(0, 32),
    // truncate for readability
    styleSignature: sig,
    count: els.length,
    roles: [...new Set(els.map(resolveRole))],
    memberElements: els
  }));
  const result = groupList.map((group) => {
    const outliers = [];
    for (const other of groupList) {
      if (other.patternId === group.patternId) continue;
      const matches = matchCount(group.styleSignature, other.styleSignature);
      if (matches >= 5) {
        for (const el of other.memberElements) {
          outliers.push(elementLabel(el));
        }
      }
    }
    return {
      patternId: group.patternId,
      styleSignature: group.styleSignature,
      count: group.count,
      roles: group.roles,
      outliers: [...new Set(outliers)].slice(0, 10)
    };
  });
  return result.sort((a, b) => b.count - a.count);
}
var PRIMITIVE_PATTERNS = [
  { testIdIncludes: "page-header", name: "PageHeader" },
  { testIdIncludes: "page-title", name: "PageHeader" },
  { testIdIncludes: "surface", name: "Surface+Row" },
  { testIdIncludes: "card", name: "Surface+Row" },
  { testIdIncludes: "nav-item", name: "NavItem" },
  { testIdIncludes: "tab", name: "Tab" },
  { testIdIncludes: "modal", name: "Modal" },
  { testIdIncludes: "dialog", name: "Dialog" },
  { testIdIncludes: "toast", name: "Toast" },
  { testIdIncludes: "badge", name: "Badge" },
  { testIdIncludes: "avatar", name: "Avatar" },
  { testIdIncludes: "input", name: "Input" },
  { testIdIncludes: "btn", name: "Button" },
  { testIdIncludes: "button", name: "Button" }
];
function classifyElement(el) {
  const testId = el.sourceHint?.dataTestId?.toLowerCase() ?? "";
  for (const p of PRIMITIVE_PATTERNS) {
    if (testId.includes(p.testIdIncludes)) {
      return { pattern: p.name, compliance: "primitive" };
    }
  }
  if (el.tagName === "button") {
    return { pattern: "raw-button", compliance: "raw" };
  }
  if (["h1", "h2", "h3"].includes(el.tagName)) {
    return { pattern: `raw-${el.tagName}`, compliance: "raw" };
  }
  if (["input", "select", "textarea"].includes(el.tagName)) {
    return { pattern: "raw-input", compliance: "raw" };
  }
  if (el.tagName === "a") {
    return { pattern: "raw-link", compliance: "raw" };
  }
  return { pattern: `raw-${el.tagName ?? "unknown"}`, compliance: "raw" };
}
function buildComponentCensus(elements, url) {
  if (elements.length === 0) return [];
  let route = "/";
  try {
    route = new URL(url).pathname;
  } catch {
    route = url;
  }
  const map = /* @__PURE__ */ new Map();
  for (const el of elements) {
    const { pattern, compliance } = classifyElement(el);
    const existing = map.get(pattern);
    if (existing) {
      existing.count++;
      existing.pages.add(route);
      existing.complianceCounts[compliance] = (existing.complianceCounts[compliance] ?? 0) + 1;
    } else {
      map.set(pattern, {
        count: 1,
        pages: /* @__PURE__ */ new Set([route]),
        complianceCounts: { [compliance]: 1 }
      });
    }
  }
  return Array.from(map.entries()).map(([pattern, { count, pages, complianceCounts }]) => {
    const primitiveCount = complianceCounts["primitive"] ?? 0;
    const rawCount = complianceCounts["raw"] ?? 0;
    let compliance;
    if (primitiveCount > 0 && rawCount > 0) {
      compliance = "mixed";
    } else if (primitiveCount > 0) {
      compliance = "primitive";
    } else {
      compliance = "raw";
    }
    return {
      pattern,
      count,
      pages: [...pages],
      compliance
    };
  }).sort((a, b) => b.count - a.count);
}
var HEADING_DEPTH = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6
};
var NAV_ROLES = /* @__PURE__ */ new Set(["navigation", "link", "tab", "menuitem", "option"]);
function buildNavigationMap(elements) {
  if (elements.length === 0) return [];
  const nodes = [];
  for (const el of elements) {
    const role = resolveRole(el);
    const tag = el.tagName ?? "";
    const isHeading = tag in HEADING_DEPTH;
    const isNavRole = NAV_ROLES.has(role);
    if (!isHeading && !isNavRole) continue;
    const label = elementLabel(el);
    if (!label) continue;
    const depth = isHeading ? HEADING_DEPTH[tag] ?? 1 : 1;
    const styles = el.computedStyles ?? {};
    const hasFontWeightBold = styles["fontWeight"] === "bold" || parseInt(styles["fontWeight"] ?? "0", 10) >= 700;
    const isActive = el.a11y?.role === "tab" ? hasFontWeightBold : void 0;
    nodes.push({
      label,
      role,
      depth,
      isActive
    });
  }
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    let children = 0;
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodes[j].depth <= node.depth) break;
      if (nodes[j].depth === node.depth + 1) children++;
    }
    if (children > 0) {
      node.childCount = children;
    }
  }
  return nodes;
}
function buildContrastReport(elements) {
  if (elements.length === 0) return [];
  const pairMap = /* @__PURE__ */ new Map();
  for (const el of elements) {
    const styles = el.computedStyles ?? {};
    const fg = styles["color"] ?? "";
    const bg = styles["backgroundColor"] ?? "";
    if (!fg && !bg) continue;
    const key = `${fg}|${bg}`;
    const existing = pairMap.get(key);
    if (existing) {
      existing.elements.push(el);
    } else {
      pairMap.set(key, { fg, bg, elements: [el] });
    }
  }
  return Array.from(pairMap.values()).map(({ fg, bg, elements: els }) => {
    const fgRgb = parseColor4(fg);
    const bgRgb = parseColor4(bg);
    let status = "unknown";
    let ratio = 0;
    if (fgRgb && bgRgb) {
      const fgL = relativeLuminance3(fgRgb.r, fgRgb.g, fgRgb.b);
      const bgL = relativeLuminance3(bgRgb.r, bgRgb.g, bgRgb.b);
      ratio = contrastRatio3(fgL, bgL);
      status = ratio >= 4.5 ? "pass" : "fail";
    }
    const sampleElements = els.slice(0, 3).map(elementLabel).filter(Boolean);
    return {
      status,
      ratio: Math.round(ratio * 100) / 100,
      foreground: fg,
      background: bg,
      elementCount: els.length,
      sampleElements
    };
  });
}
var INTERACTIVE_TAGS2 = /* @__PURE__ */ new Set(["button", "a", "input", "select", "textarea"]);
var INTERACTIVE_ROLES2 = /* @__PURE__ */ new Set(["button", "link", "textbox", "checkbox", "radio", "combobox", "menuitem", "option", "tab"]);
function isLooksInteractive(el) {
  const tag = el.tagName ?? "";
  const role = el.a11y?.role ?? "";
  const cursor = el.interactive?.cursor ?? el.computedStyles?.["cursor"] ?? "";
  return INTERACTIVE_TAGS2.has(tag) || INTERACTIVE_ROLES2.has(role) || cursor === "pointer";
}
function buildInteractionMap(elements) {
  if (elements.length === 0) return [];
  const buckets = {
    "has-handler": [],
    "looks-interactive-no-handler": [],
    "disabled-with-handler": [],
    "properly-disabled": []
  };
  for (const el of elements) {
    const inter = el.interactive;
    if (!inter) continue;
    const hasHandler = inter.hasOnClick || inter.hasHref || !!inter.hasReactHandler;
    const isDisabled = inter.isDisabled ?? false;
    const looksInteractive2 = isLooksInteractive(el);
    if (isDisabled && hasHandler) {
      buckets["disabled-with-handler"].push(el);
    } else if (isDisabled && !hasHandler) {
      buckets["properly-disabled"].push(el);
    } else if (hasHandler) {
      buckets["has-handler"].push(el);
    } else if (looksInteractive2) {
      buckets["looks-interactive-no-handler"].push(el);
    }
  }
  return Object.entries(buckets).filter(([, els]) => els.length > 0).map(([category, els]) => ({
    category,
    count: els.length,
    elements: els.slice(0, 5).map(elementLabel)
  }));
}
function estimateTokens(data) {
  return Math.ceil(JSON.stringify(data).length / 4);
}
function summarizeScan(elements, url) {
  const safeElements = elements ?? [];
  const visualPatterns = buildVisualPatterns(safeElements);
  const componentCensus = buildComponentCensus(safeElements, url);
  const navigationMap = buildNavigationMap(safeElements);
  const contrastReport = buildContrastReport(safeElements);
  const interactionMap = buildInteractionMap(safeElements);
  const summary = {
    visualPatterns,
    componentCensus,
    navigationMap,
    contrastReport,
    interactionMap
  };
  const rawTokenEstimate = estimateTokens(safeElements);
  const summaryTokenEstimate = estimateTokens(summary);
  const reductionPercent = rawTokenEstimate > 0 ? Math.round(
    (rawTokenEstimate - summaryTokenEstimate) / rawTokenEstimate * 100
  ) : 0;
  return {
    ...summary,
    tokenEfficiency: {
      rawTokenEstimate,
      summaryTokenEstimate,
      reductionPercent
    }
  };
}

// src/scan.ts
init_engine();
var IssueCollector = class {
  issues = [];
  add(issue) {
    this.issues.push(issue);
  }
  /**
   * Add issues from a source array with varying shapes.
   * Handles the different field names used across audit, interactivity, and semantic results.
   */
  addFrom(category, items, overrideCategory) {
    for (const item of items) {
      const description = item.message ?? item.description ?? item.problem ?? "";
      const severity = item.severity ?? "info";
      const resolvedCategory = overrideCategory ? overrideCategory(item) : category;
      this.issues.push({
        category: resolvedCategory,
        severity,
        element: item.element,
        description,
        fix: item.fix
      });
    }
  }
  /**
   * Add console errors, skipping favicon/manifest noise.
   */
  addConsoleErrors(errors) {
    for (const error of errors) {
      if (error.includes("favicon") || error.includes("manifest")) continue;
      this.issues.push({
        category: "console",
        severity: "error",
        description: `Console error: ${error.slice(0, 200)}`
      });
    }
  }
  /**
   * Add theme mismatch issue if present.
   */
  addThemeAnalysis(analysis) {
    if (analysis?.themeMismatch) {
      this.issues.push({
        category: "semantic",
        severity: "warning",
        description: analysis.mismatchDetails ?? "Content card has different theme than page background",
        fix: "Ensure content containers match the page theme (dark/light)"
      });
    }
  }
  /**
   * Remove issues with identical descriptions, preserving first occurrence.
   */
  deduplicate() {
    const seen = /* @__PURE__ */ new Set();
    this.issues = this.issues.filter((issue) => {
      if (seen.has(issue.description)) return false;
      seen.add(issue.description);
      return true;
    });
  }
  getIssues() {
    return [...this.issues];
  }
};
async function scan(url, options = {}) {
  const {
    viewport: viewportOpt = "desktop",
    timeout = 3e4,
    waitFor,
    screenshot,
    networkIdleTimeout,
    patience,
    headed = false,
    browserMode,
    cdpUrl,
    wsEndpoint,
    chromePath,
    hydrationStrategy = "auto",
    rules: rulePresets
  } = options;
  const resolvedViewport = typeof viewportOpt === "string" ? VIEWPORTS[viewportOpt] || VIEWPORTS.desktop : viewportOpt;
  const driver2 = new EngineDriver();
  await driver2.launch({
    headless: !headed,
    viewport: { width: resolvedViewport.width, height: resolvedViewport.height },
    mode: browserMode,
    cdpUrl,
    wsEndpoint,
    chromePath
  });
  const page = new CompatPage(driver2);
  const consoleErrors = [];
  const consoleWarnings = [];
  page.on?.("console", (msg) => {
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
    let networkIdleTimedOut = false;
    await page.waitForLoadState?.("networkidle", { timeout: patience ?? networkIdleTimeout ?? 1e4 }).catch(() => {
      networkIdleTimedOut = true;
    });
    let waitForTimedOut = false;
    if (waitFor) {
      await page.waitForSelector(waitFor, { timeout: patience ?? networkIdleTimeout ?? 1e4 }).catch(() => {
        waitForTimedOut = true;
      });
    }
    let hydrationTimedOut = false;
    let hydrationReason = "skipped";
    if (hydrationStrategy !== "none") {
      const shouldWaitForHydration = hydrationStrategy === "stable" || await detectSPAFramework(driver2);
      if (shouldWaitForHydration) {
        const hydrationResult = await waitForHydration(
          driver2.connection,
          () => driver2.getSnapshot(),
          (expr) => driver2.evaluate(expr),
          {
            timeout: patience ?? 8e3,
            stableTime: 500,
            minElements: 1,
            settleTime: 200
          }
        );
        hydrationTimedOut = hydrationResult.timedOut;
        hydrationReason = hydrationResult.reason;
      }
    }
    const [elements, interactivity, semantic, coverage, themeAnalysis] = await Promise.all([
      extractAndAudit(page, resolvedViewport),
      testInteractivity(page),
      getSemanticOutput(page),
      driver2.getCoverage().catch(() => void 0),
      analyzeThemeConsistency(page).catch(() => void 0)
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
    const layoutCollisions = detectLayoutCollisions(elements.all);
    const issues = aggregateIssues(elements.audit, interactivity, semantic, consoleErrors, themeAnalysis);
    const designSystem = await applyDesignSystemCheck(
      elements.all,
      issues,
      resolvedViewport,
      url,
      options.outputDir || process.cwd()
    );
    const verdict = determineVerdict2(issues);
    const summary = generateSummary2(elements, interactivity, semantic, issues, consoleErrors);
    const sensors = runSensors({
      elements: elements.all,
      interactivity,
      semantic,
      url,
      viewport: resolvedViewport
    });
    const ruleContext = {
      isMobile: resolvedViewport.width < 768,
      viewportWidth: resolvedViewport.width,
      viewportHeight: resolvedViewport.height,
      url,
      allElements: elements.all
    };
    const ruleEngine = runAllRules(elements.all, ruleContext);
    if (rulePresets && rulePresets.length > 0) {
      const presetConfig = { extends: rulePresets, rules: {} };
      const presetViolations = runRules(elements.all, ruleContext, presetConfig);
      for (const v of presetViolations) {
        issues.push({
          category: "interactivity",
          severity: v.severity === "error" ? "error" : "warning",
          element: v.element,
          description: `[${v.ruleId}] ${v.message}`,
          fix: v.fix
        });
      }
    }
    const summaries = summarizeScan(elements.all, url);
    const baseResult = {
      url,
      route,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      viewport: resolvedViewport,
      elements,
      interactivity,
      semantic,
      sensors,
      ruleEngine,
      summaries,
      console: {
        errors: consoleErrors,
        warnings: consoleWarnings
      },
      coverage,
      layoutCollisions,
      themeAnalysis,
      designSystem,
      hydration: hydrationReason !== "skipped" ? { timedOut: hydrationTimedOut, reason: hydrationReason } : void 0,
      verdict,
      issues,
      summary
    };
    if (patience && (networkIdleTimedOut || waitForTimedOut)) {
      return {
        ...baseResult,
        verdict: "PARTIAL",
        partialReason: `Page still loading after ${patience}ms \u2014 ${networkIdleTimedOut ? "network still active" : "selector not found"}. Re-scan when content has loaded.`
      };
    }
    return baseResult;
  } finally {
    await driver2.close();
  }
}
async function detectSPAFramework(driver2) {
  try {
    const result = await driver2.evaluate(`
      !!(window.__NEXT_DATA__ || window.__REACT_DEVTOOLS_GLOBAL_HOOK__ ||
         window.__NUXT__ || window.__VUE_DEVTOOLS_GLOBAL_HOOK__ ||
         document.querySelector('[data-reactroot]') ||
         document.querySelector('#__next'))
    `);
    return result === true;
  } catch {
    return false;
  }
}
async function extractAndAudit(page, viewport) {
  const isMobile = viewport.width < 768;
  const elements = await extractInteractiveElements(page);
  const audit = analyzeElements(elements, isMobile);
  return { all: elements, audit };
}
function aggregateIssues(audit, interactivity, semantic, consoleErrors, themeAnalysis) {
  const collector = new IssueCollector();
  collector.addFrom("interactivity", audit.issues.map((i) => ({
    severity: i.severity,
    message: i.message,
    type: i.type
  })), (item) => item.type === "MISSING_ARIA_LABEL" ? "accessibility" : "interactivity");
  const auditMessages = new Set(audit.issues.map((i) => i.message));
  const interactivityFiltered = interactivity.issues.filter((i) => !auditMessages.has(i.description));
  collector.addFrom("interactivity", interactivityFiltered.map((i) => ({
    severity: i.severity,
    description: i.description,
    element: i.element,
    type: i.type,
    fix: getFixSuggestion(i.type)
  })), (item) => item.type === "MISSING_LABEL" ? "accessibility" : "interactivity");
  collector.addFrom("semantic", semantic.issues.map((i) => ({
    severity: i.severity,
    problem: i.problem
  })));
  collector.addThemeAnalysis(themeAnalysis);
  collector.addConsoleErrors(consoleErrors);
  return collector.getIssues();
}
async function applyDesignSystemCheck(elements, issues, viewport, url, outputDir) {
  const designSystem = await runDesignSystemCheck(
    elements,
    {
      isMobile: viewport.width < 768,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      url,
      allElements: elements
    },
    outputDir
  ).catch(() => void 0);
  if (designSystem) {
    for (const v of designSystem.principleViolations) {
      issues.push({
        category: "design-system",
        severity: v.severity === "error" ? "error" : "warning",
        element: v.element,
        description: v.message,
        fix: v.fix
      });
    }
    for (const v of designSystem.tokenViolations) {
      issues.push({
        category: "design-system",
        severity: v.severity === "error" ? "error" : "warning",
        element: v.element,
        description: v.message
      });
    }
    for (const v of designSystem.customViolations) {
      issues.push({
        category: "design-system",
        severity: v.severity === "error" ? "error" : "warning",
        element: v.element,
        description: v.message,
        fix: v.fix
      });
    }
  }
  return designSystem;
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
  const verdictIcon2 = result.verdict === "PASS" ? "\x1B[32m\u2713\x1B[0m" : result.verdict === "ISSUES" ? "\x1B[33m!\x1B[0m" : result.verdict === "PARTIAL" ? "\x1B[33m~\x1B[0m" : "\x1B[31m\u2717\x1B[0m";
  lines.push("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  lines.push("  IBR UI SCAN");
  lines.push("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  lines.push("");
  lines.push(`  URL:      ${result.url}`);
  lines.push(`  Route:    ${result.route}`);
  lines.push(`  Viewport: ${result.viewport.name} (${result.viewport.width}x${result.viewport.height})`);
  lines.push(`  Verdict:  ${verdictIcon2} ${result.verdict}`);
  lines.push("");
  lines.push(`  ${result.summary}`);
  lines.push("");
  lines.push("  PAGE UNDERSTANDING");
  lines.push("  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  lines.push(`  Intent:   ${result.semantic.pageIntent.intent} (${(result.semantic.confidence * 100).toFixed(0)}% confidence)`);
  lines.push(`  Auth:     ${result.semantic.state.auth.authenticated ? "Authenticated" : "Not authenticated"}`);
  lines.push(`  Loading:  ${result.semantic.state.loading.loading ? result.semantic.state.loading.type : "Complete"}`);
  lines.push(`  Errors:   ${result.semantic.state.errors.hasErrors ? result.semantic.state.errors.errors.map((e) => e.message).join(", ") : "None"}`);
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
  if (result.layoutCollisions?.hasCollisions) {
    const { collisions } = result.layoutCollisions;
    lines.push("  LAYOUT");
    lines.push("  \u2500\u2500\u2500\u2500\u2500\u2500");
    lines.push(`  Collisions: ${collisions.length}`);
    for (const c of collisions) {
      const overlapPx = Math.round(Math.sqrt(c.overlapArea));
      const pct = Math.round(c.overlapPercent);
      const t1 = c.element1.text.slice(0, 30);
      const t2 = c.element2.text.slice(0, 30);
      lines.push(`    \x1B[31m\u2717\x1B[0m "${t1}" overlaps "${t2}" by ${pct}% (${overlapPx}px overlap)`);
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
  if (result.verdict === "PARTIAL" && result.partialReason) {
    lines.push("");
    lines.push("  PARTIAL SCAN");
    lines.push("  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
    lines.push(`  \x1B[33m!\x1B[0m ${result.partialReason}`);
    lines.push("  Re-scan when the page has finished loading.");
  }
  lines.push("");
  lines.push("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  return lines.join("\n");
}

// src/design-system/principles/index.ts
init_calm_precision();
init_gestalt();
init_signal_noise();
init_fitts();
init_hick();
init_content_chrome();
init_cognitive_load();

// src/index.ts
init_memory();

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
var execFileAsync = promisify(execFile);
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
  await new Promise((resolve3) => setTimeout(resolve3, 2e3));
}
function formatDevice(device) {
  const runtimeVersion = device.runtime.replace(/^.*SimRuntime\./, "").replace(/-/g, ".");
  const stateIcon = device.state === "Booted" ? "\x1B[32m\u25CF\x1B[0m" : "\x1B[90m\u25CB\x1B[0m";
  return `${stateIcon} ${device.name} (${runtimeVersion}) [${device.udid.slice(0, 8)}...]`;
}
var execFileAsync2 = promisify(execFile);
async function captureNativeScreenshot(options) {
  const { device, outputPath, mask } = options;
  const start = Date.now();
  try {
    await mkdir(dirname(outputPath), { recursive: true });
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

// src/native/role-map.ts
var TAG_MAP = {
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
var ARIA_MAP = {
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
var INTERACTIVE_ROLES3 = /* @__PURE__ */ new Set([
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
function mapRoleToTag(role) {
  return TAG_MAP[role] || role.replace(/^AX/, "").toLowerCase();
}
function mapRoleToAriaRole(role) {
  return ARIA_MAP[role] || null;
}
function isInteractiveRole(role) {
  return INTERACTIVE_ROLES3.has(role);
}

// src/native/extract.ts
var execFileAsync3 = promisify(execFile);
var EXTRACTOR_DIR = join(process.cwd(), ".ibr", "bin");
var EXTRACTOR_PATH = join(EXTRACTOR_DIR, "ibr-ax-extract");
var SWIFT_SOURCE_DIR = join(__dirname, "..", "..", "src", "native", "swift", "ibr-ax-extract");
var SWIFT_MAIN_PATH = join(SWIFT_SOURCE_DIR, "Sources", "main.swift");
var SWIFT_PACKAGE_PATH = join(SWIFT_SOURCE_DIR, "Package.swift");
async function ensureExtractor() {
  if (existsSync(EXTRACTOR_PATH) && isExtractorCacheFresh()) {
    return EXTRACTOR_PATH;
  }
  await mkdir(EXTRACTOR_DIR, { recursive: true });
  try {
    await execFileAsync3("swift", ["build", "-c", "release"], {
      cwd: SWIFT_SOURCE_DIR,
      timeout: 12e4
      // 2 minutes for first compile
    });
    const buildPath = join(SWIFT_SOURCE_DIR, ".build", "release", "ibr-ax-extract");
    if (!existsSync(buildPath)) {
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
function isExtractorCacheFresh() {
  try {
    const binaryMtime = statSync(EXTRACTOR_PATH).mtimeMs;
    const sourceMtime = Math.max(
      statSync(SWIFT_MAIN_PATH).mtimeMs,
      statSync(SWIFT_PACKAGE_PATH).mtimeMs
    );
    return binaryMtime >= sourceMtime;
  } catch {
    return false;
  }
}
function isExtractorAvailable() {
  if (existsSync(EXTRACTOR_PATH)) return true;
  return existsSync(join(SWIFT_SOURCE_DIR, "Package.swift"));
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
      const isInteractive2 = isInteractiveRole(el.role) && el.isEnabled;
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
          hasOnClick: isInteractive2,
          hasHref: false,
          isDisabled: !el.isEnabled,
          tabIndex: isInteractive2 ? 0 : -1,
          cursor: isInteractive2 ? "pointer" : "default"
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
var execFileAsync4 = promisify(execFile);
var execAsync = promisify(exec);
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
    const extractorPath = await ensureExtractor();
    const { stdout } = await execFileAsync4(extractorPath, ["--resolve-app", appNameOrBundleId], {
      timeout: 1e4
    });
    const resolved = JSON.parse(stdout);
    if (typeof resolved.pid === "number" && resolved.pid > 0) {
      return resolved.pid;
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
  function flatten(elements, path2, depth) {
    const roleCounts = {};
    for (const el of elements) {
      const roleCount = roleCounts[el.role] || 0;
      roleCounts[el.role] = roleCount + 1;
      const currentPath = path2 ? `${path2} > ${el.role}[${roleCount}]` : `${el.role}[${roleCount}]`;
      const tagName = mapRoleToTag(el.role);
      const isInteractive2 = isInteractiveRole(el.role) && el.enabled;
      const hasPress = el.actions.includes("AXPress");
      const text = el.title || el.description || el.value || void 0;
      const bounds = {
        x: el.position?.x ?? 0,
        y: el.position?.y ?? 0,
        width: el.size?.width ?? 0,
        height: el.size?.height ?? 0
      };
      if (bounds.width > 0 || bounds.height > 0 || text || isInteractive2 || depth <= 1) {
        enhanced.push({
          selector: el.identifier || currentPath,
          tagName,
          id: el.identifier || void 0,
          text: text ? text.slice(0, 100) : void 0,
          bounds,
          interactive: {
            hasOnClick: hasPress || isInteractive2,
            hasHref: el.role === "AXLink",
            isDisabled: !el.enabled,
            tabIndex: el.focused || isInteractive2 ? 0 : -1,
            cursor: isInteractive2 ? "pointer" : "default"
          },
          a11y: {
            role: mapRoleToAriaRole(el.role),
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
  await mkdir(dirname(outputPath), { recursive: true });
  await execFileAsync4("screencapture", ["-l", String(windowId), "-x", outputPath], {
    timeout: 1e4
  });
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
        signals: authSignals,
        socialLoginProviders: [],
        hasForgotPassword: false,
        hasSignupLink: false,
        hasPasswordToggle: false
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
    const ssPath = join(outputDir, "native", `${device.udid.slice(0, 8)}-${timestamp}.png`);
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
  const designSystem = options.outputDir ? await applyDesignSystemCheck(
    elements,
    issues,
    viewport,
    url,
    options.outputDir
  ) : void 0;
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
    designSystem,
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
  const viewport = {
    name: "native",
    width: window2.width,
    height: window2.height
  };
  const issues = aggregateIssues(audit, interactivity, semantic, []);
  const designSystem = options.outputDir ? await applyDesignSystemCheck(
    elements,
    issues,
    viewport,
    url,
    options.outputDir
  ) : void 0;
  const verdict = determineVerdict2(issues);
  const summary = generateSummary2(
    { audit },
    interactivity,
    semantic,
    issues,
    []
  );
  return {
    url,
    route,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    viewport,
    elements: { all: elements, audit },
    interactivity,
    semantic,
    console: { errors: [], warnings: [] },
    designSystem,
    verdict,
    issues,
    summary
  };
}
function verdictIcon(verdict) {
  return verdict === "PASS" ? "\x1B[32m\u2713\x1B[0m" : verdict === "ISSUES" ? "\x1B[33m!\x1B[0m" : "\x1B[31m\u2717\x1B[0m";
}
function formatElementsSection(audit) {
  return [
    "  ELEMENTS",
    "  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
    `  Total:              ${audit.totalElements}`,
    `  Interactive:        ${audit.interactiveCount}`,
    `  With handlers:      ${audit.withHandlers}`,
    `  Without handlers:   ${audit.withoutHandlers}`,
    ""
  ];
}
function formatIssuesSection(issues) {
  if (issues.length === 0) return ["  No issues detected."];
  const lines = ["  ISSUES", "  \u2500\u2500\u2500\u2500\u2500\u2500"];
  for (const issue of issues) {
    const icon = issue.severity === "error" ? "\x1B[31m\u2717\x1B[0m" : issue.severity === "warning" ? "\x1B[33m!\x1B[0m" : "\u2139";
    lines.push(`  ${icon} [${issue.category}] ${issue.description}`);
    if (issue.fix) lines.push(`    \u2192 ${issue.fix}`);
  }
  return lines;
}
function formatMacOSScanResult(result) {
  const lines = [
    "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550",
    "  IBR NATIVE macOS SCAN",
    "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550",
    "",
    `  App:      ${result.url}`,
    `  Window:   ${result.route.slice(1)}`,
    `  Viewport: ${result.viewport.width}x${result.viewport.height}`,
    `  Verdict:  ${verdictIcon(result.verdict)} ${result.verdict}`,
    "",
    `  ${result.summary}`,
    "",
    "  PAGE UNDERSTANDING",
    "  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
    `  Intent:   ${result.semantic.pageIntent.intent} (${Math.round(result.semantic.confidence * 100)}% confidence)`,
    `  Auth:     ${result.semantic.state.auth.authenticated === false ? "Not authenticated" : result.semantic.state.auth.authenticated ? "Authenticated" : "Unknown"}`,
    "",
    ...formatElementsSection(result.elements.audit)
  ];
  const { buttons, links, forms } = result.interactivity;
  lines.push("  INTERACTIVITY", "  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  lines.push(`  Buttons: ${buttons.length}  Links: ${links.length}  Forms: ${forms.length}`, "");
  lines.push(...formatIssuesSection(result.issues));
  lines.push("", "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  return lines.join("\n");
}
function formatNativeScanResult(result) {
  const lines = [
    "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550",
    "  IBR NATIVE SCAN",
    "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550",
    "",
    `  Device:   ${result.device.name}`,
    `  Platform: ${result.platform}`,
    `  Runtime:  ${result.device.runtime.replace(/^.*SimRuntime\./, "").replace(/-/g, ".")}`,
    `  Viewport: ${result.viewport.name} (${result.viewport.width}x${result.viewport.height})`,
    `  Verdict:  ${verdictIcon(result.verdict)} ${result.verdict}`,
    "",
    `  ${result.summary}`,
    "",
    ...formatElementsSection(result.elements.audit)
  ];
  if (result.screenshotPath) {
    lines.push(`  Screenshot: ${result.screenshotPath}`, "");
  }
  lines.push(...formatIssuesSection(result.issues));
  lines.push("", "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  return lines.join("\n");
}
var DIGITS = [
  [31, 17, 17, 17, 17, 17, 31],
  // 0
  [4, 6, 4, 4, 4, 4, 14],
  // 1
  [31, 16, 16, 31, 1, 1, 31],
  // 2
  [31, 16, 16, 31, 16, 16, 31],
  // 3
  [17, 17, 17, 31, 16, 16, 16],
  // 4
  [31, 1, 1, 31, 16, 16, 31],
  // 5
  [31, 1, 1, 31, 17, 17, 31],
  // 6
  [31, 16, 16, 8, 4, 4, 4],
  // 7
  [31, 17, 17, 31, 17, 17, 31],
  // 8
  [31, 17, 17, 31, 16, 16, 31]
  // 9
];
function setPixel(png, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (y * png.width + x) * 4;
  png.data[idx] = r;
  png.data[idx + 1] = g;
  png.data[idx + 2] = b;
  png.data[idx + 3] = a;
}
function drawRect(png, x, y, w, h, r, g, b, thickness = 2) {
  for (let t = 0; t < thickness; t++) {
    for (let i = x; i < x + w; i++) {
      setPixel(png, i, y + t, r, g, b);
      setPixel(png, i, y + h - 1 - t, r, g, b);
    }
    for (let j = y; j < y + h; j++) {
      setPixel(png, x + t, j, r, g, b);
      setPixel(png, x + w - 1 - t, j, r, g, b);
    }
  }
}
function drawFilledCircle(png, cx, cy, radius, r, g, b) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy <= radius * radius) setPixel(png, cx + dx, cy + dy, r, g, b);
    }
  }
}
function drawDigit(png, cx, cy, digit, r, g, b) {
  const rows = DIGITS[digit] ?? DIGITS[0];
  const scale = 2;
  const offX = cx - Math.floor(5 * scale / 2);
  const offY = cy - Math.floor(7 * scale / 2);
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      if (rows[row] & 16 >> col) {
        for (let sy = 0; sy < scale; sy++)
          for (let sx = 0; sx < scale; sx++)
            setPixel(png, offX + col * scale + sx, offY + row * scale + sy, r, g, b);
      }
    }
  }
}
function drawLabel(png, cx, cy, id) {
  drawFilledCircle(png, cx, cy, 10, 220, 30, 30);
  const tens = Math.floor(id / 10);
  const ones = id % 10;
  if (tens > 0) {
    drawDigit(png, cx - 5, cy, tens, 255, 255, 255);
    drawDigit(png, cx + 5, cy, ones, 255, 255, 255);
  } else {
    drawDigit(png, cx, cy, ones, 255, 255, 255);
  }
}
async function annotateScreenshot(screenshotPath, issues) {
  let png;
  try {
    const buf = readFileSync(screenshotPath);
    png = PNG.sync.read(buf);
  } catch {
    return null;
  }
  for (const issue of issues) {
    const { x, y, width: w, height: h } = issue.bounds;
    drawRect(png, x, y, w, h, 220, 30, 30, 2);
    drawLabel(png, x, y, issue.id);
  }
  const outPath = screenshotPath.replace(/\.png$/i, "-annotated.png");
  try {
    writeFileSync(outPath, PNG.sync.write(png));
  } catch {
    return null;
  }
  return outPath;
}

// src/native/fix-guide.ts
var SIMULATOR_CHROME_PATTERNS = [
  "Save Screen",
  "Rotate",
  "Sheet Grabber",
  "Home Indicator",
  "Status Bar",
  "Side Button",
  "Volume",
  "Mute Switch"
];
function isSimulatorChrome(selector, label) {
  const text = `${selector} ${label}`.toLowerCase();
  return SIMULATOR_CHROME_PATTERNS.some((p) => text.includes(p.toLowerCase()));
}
function computeScreenRegion(bounds, viewport) {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const col = cx < viewport.width / 3 ? "left" : cx < viewport.width * 2 / 3 ? "center" : "right";
  const row = cy < viewport.height / 3 ? "top" : cy < viewport.height * 2 / 3 ? "middle" : "bottom";
  return `${row}-${col}`;
}
function buildSuggestedFix(issueType, elementLabel2) {
  switch (issueType) {
    case "TOUCH_TARGET_SMALL":
      return ".frame(minWidth: 44, minHeight: 44) or wrap in a larger tap area with .contentShape(Rectangle())";
    case "MISSING_ARIA_LABEL": {
      const desc = elementLabel2 && elementLabel2.length > 0 && !elementLabel2.startsWith("[role") ? elementLabel2 : "descriptive text for this control";
      return `Add .accessibilityLabel("${desc}")`;
    }
    case "NO_HANDLER":
      return "Add tap action or remove interactive appearance";
    case "PLACEHOLDER_LINK":
      return 'Replace href="#" with a real destination or add an onTapGesture handler';
    case "DISABLED_NO_VISUAL":
      return "Add .opacity(0.5) or .foregroundColor(.gray) to visually indicate disabled state";
    default:
      return "Review and fix accessibility issue";
  }
}
function issueTypeToCategory(issueType) {
  if (issueType === "TOUCH_TARGET_SMALL") return "touch-target";
  if (issueType === "MISSING_ARIA_LABEL" || issueType === "DISABLED_NO_VISUAL") return "accessibility";
  if (issueType === "NO_HANDLER" || issueType === "PLACEHOLDER_LINK") return "accessibility";
  return "accessibility";
}
function buildSearchPattern(correlation, elementSelector, elementLabel2) {
  if (!correlation) {
    if (elementLabel2) {
      const escaped = elementLabel2.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return `Button.*${escaped}|Text.*${escaped}`;
    }
    return elementSelector;
  }
  switch (correlation.matchType) {
    case "identifier":
      return correlation.elementSelector;
    case "label":
      return `.accessibilityLabel("${correlation.elementLabel}")`;
    case "view-name":
      return `struct ${correlation.viewName}: View`;
    case "text": {
      const label = correlation.elementLabel || elementLabel2;
      if (label) {
        const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return `Button.*${escaped}|Image.*${escaped}`;
      }
      return elementSelector;
    }
    default:
      return elementSelector;
  }
}
function generateFixGuide(scanResult, bridgeResult, annotatedScreenshot) {
  const viewport = scanResult.viewport;
  const correlationMap = /* @__PURE__ */ new Map();
  if (bridgeResult) {
    for (const c of bridgeResult.correlations) {
      correlationMap.set(c.elementSelector.toLowerCase(), c);
      if (c.elementLabel) {
        correlationMap.set(c.elementLabel.toLowerCase(), c);
      }
    }
  }
  const boundsMap = /* @__PURE__ */ new Map();
  const unlabeledButtons = [];
  for (const el of scanResult.elements.all) {
    const bounds = { x: el.bounds.x, y: el.bounds.y, width: el.bounds.width, height: el.bounds.height };
    if (el.selector) boundsMap.set(el.selector.toLowerCase(), bounds);
    if (el.a11y?.ariaLabel) boundsMap.set(el.a11y.ariaLabel.toLowerCase(), bounds);
    if (el.text) boundsMap.set(el.text.toLowerCase(), bounds);
    if (el.interactive?.hasOnClick && (!el.a11y?.ariaLabel || el.a11y.ariaLabel === "") && (!el.text || el.text === "")) {
      unlabeledButtons.push(bounds);
    }
  }
  let unlabeledIdx = 0;
  function extractLabel(text) {
    const m = text.match(/"([^"]+)"/);
    return m ? m[1] : "";
  }
  const seen = /* @__PURE__ */ new Set();
  function dedupKey(label, issueType) {
    return `${label.toLowerCase()}:${issueType}`;
  }
  const fixableIssues = [];
  let idCounter = 1;
  for (const issue of scanResult.nativeIssues) {
    const elementLabel2 = extractLabel(issue.message);
    const elementSelector = elementLabel2 || issue.type;
    if (isSimulatorChrome(elementSelector, issue.message)) continue;
    const key = dedupKey(elementLabel2 || elementSelector, issue.type);
    if (seen.has(key)) continue;
    seen.add(key);
    let bounds = boundsMap.get(elementLabel2.toLowerCase()) ?? boundsMap.get(elementSelector.toLowerCase()) ?? null;
    if (!bounds && elementLabel2 === "" && unlabeledIdx < unlabeledButtons.length) {
      bounds = unlabeledButtons[unlabeledIdx++];
    }
    bounds = bounds ?? { x: 0, y: 0, width: 0, height: 0 };
    const region = bounds.x > 0 || bounds.y > 0 ? computeScreenRegion(bounds, viewport) : "unknown";
    const correlation = correlationMap.get(elementLabel2.toLowerCase()) ?? correlationMap.get(elementSelector.toLowerCase());
    fixableIssues.push({
      id: idCounter++,
      category: issueTypeToCategory(issue.type),
      severity: issue.severity === "info" ? "warning" : issue.severity,
      what: issue.message,
      where: { element: elementSelector, bounds, screenRegion: region },
      current: issue.message,
      required: buildSuggestedFix(issue.type, elementLabel2),
      source: correlation ? {
        file: correlation.sourceFile,
        line: correlation.sourceLine,
        confidence: correlation.confidence,
        matchedOn: correlation.matchType,
        searchPattern: buildSearchPattern(correlation, elementSelector, elementLabel2)
      } : void 0,
      suggestedFix: buildSuggestedFix(issue.type, elementLabel2)
    });
  }
  for (const issue of scanResult.issues) {
    if (issue.severity === "info") continue;
    const elementLabel2 = extractLabel(issue.description);
    const elementSelector = issue.element ?? elementLabel2;
    if (isSimulatorChrome(elementSelector, issue.description)) continue;
    const issueType = issue.description.includes("touch target") || issue.description.includes("Touch target") ? "TOUCH_TARGET_SMALL" : issue.description.includes("accessibility label") || issue.description.includes("aria-label") ? "MISSING_ARIA_LABEL" : issue.category;
    const key = dedupKey(elementLabel2 || elementSelector, issueType);
    if (seen.has(key)) continue;
    seen.add(key);
    const bounds = boundsMap.get(elementLabel2.toLowerCase()) ?? boundsMap.get(elementSelector.toLowerCase()) ?? { x: 0, y: 0, width: 0, height: 0 };
    const region = bounds.x > 0 || bounds.y > 0 ? computeScreenRegion(bounds, viewport) : "unknown";
    const correlation = correlationMap.get(elementLabel2.toLowerCase()) ?? correlationMap.get(elementSelector.toLowerCase());
    fixableIssues.push({
      id: idCounter++,
      category: issue.category === "interactivity" ? "touch-target" : issue.category,
      severity: issue.severity,
      what: issue.description,
      where: { element: elementSelector, bounds, screenRegion: region },
      current: issue.description,
      required: issue.fix ?? buildSuggestedFix(issueType, elementLabel2),
      source: correlation ? {
        file: correlation.sourceFile,
        line: correlation.sourceLine,
        confidence: correlation.confidence,
        matchedOn: correlation.matchType,
        searchPattern: buildSearchPattern(correlation, elementSelector, elementLabel2)
      } : void 0,
      suggestedFix: issue.fix ?? buildSuggestedFix(issueType, elementLabel2)
    });
  }
  const uniqueFiles = new Set(
    fixableIssues.filter((i) => i.source).map((i) => i.source.file)
  );
  const fileCount = uniqueFiles.size;
  const issueCount = fixableIssues.length;
  const summary = issueCount === 0 ? "No issues found" : fileCount > 0 ? `${issueCount} issue${issueCount !== 1 ? "s" : ""} in ${fileCount} file${fileCount !== 1 ? "s" : ""}` : `${issueCount} issue${issueCount !== 1 ? "s" : ""}`;
  return {
    screenshot: annotatedScreenshot ?? scanResult.screenshotPath ?? "",
    screenshotRaw: scanResult.screenshotPath ?? "",
    issues: fixableIssues,
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
    outputDir = join(tmpdir(), "ibr-compare"),
    viewport = "desktop",
    fullPage = true,
    waitForNetworkIdle = true,
    timeout = 3e4,
    headed = false,
    browserMode,
    cdpUrl,
    wsEndpoint,
    chromePath
  } = options;
  if (!baselinePath && !url) {
    throw new Error("Either baselinePath or url must be provided");
  }
  const resolvedViewport = typeof viewport === "string" ? VIEWPORTS[viewport] || VIEWPORTS.desktop : viewport;
  await mkdir(outputDir, { recursive: true });
  const timestamp = Date.now();
  const actualBaselinePath = baselinePath || join(outputDir, `baseline-${timestamp}.png`);
  let actualCurrentPath = currentPath || join(outputDir, `current-${timestamp}.png`);
  const diffPath = join(outputDir, `diff-${timestamp}.png`);
  if (url && !baselinePath) {
    await captureScreenshot({
      url,
      outputPath: actualBaselinePath,
      viewport: resolvedViewport,
      fullPage,
      headed,
      waitForNetworkIdle,
      timeout,
      browserMode,
      cdpUrl,
      wsEndpoint,
      chromePath
    });
  }
  if (url && !currentPath) {
    await captureScreenshot({
      url,
      outputPath: actualCurrentPath,
      viewport: resolvedViewport,
      fullPage,
      headed,
      waitForNetworkIdle,
      timeout,
      browserMode,
      cdpUrl,
      wsEndpoint,
      chromePath
    });
  }
  try {
    await access(actualBaselinePath);
  } catch {
    throw new Error(`Baseline image not found: ${actualBaselinePath}`);
  }
  try {
    await access(actualCurrentPath);
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
      outputDir: dirname(paths.diff),
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
          outputDir: dirname(paths.diff),
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
      waitFor,
      headed = false,
      browserMode = this.config.browserMode,
      cdpUrl = this.config.cdpUrl,
      wsEndpoint = this.config.wsEndpoint,
      chromePath = this.config.chromePath
    } = options;
    const url = this.resolveUrl(path2);
    const session = await createSession(this.config.outputDir, url, name, viewport);
    const paths = getSessionPaths(this.config.outputDir, session.id);
    const captureResult = await captureWithLandmarks({
      url,
      outputPath: paths.baseline,
      viewport,
      fullPage,
      headed,
      waitForNetworkIdle: this.config.waitForNetworkIdle,
      timeout: this.config.timeout,
      outputDir: this.config.outputDir,
      selector,
      waitFor,
      browserMode,
      cdpUrl,
      wsEndpoint,
      chromePath
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
      outputDir: this.config.outputDir,
      browserMode: this.config.browserMode,
      cdpUrl: this.config.cdpUrl,
      wsEndpoint: this.config.wsEndpoint,
      chromePath: this.config.chromePath
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
      outputDir: this.config.outputDir,
      browserMode: this.config.browserMode,
      cdpUrl: this.config.cdpUrl,
      wsEndpoint: this.config.wsEndpoint,
      chromePath: this.config.chromePath
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
    const driver2 = new EngineDriver();
    await driver2.launch({
      headless: !options.headed,
      viewport: { width: viewport.width, height: viewport.height },
      mode: this.config.browserMode,
      cdpUrl: this.config.cdpUrl,
      wsEndpoint: this.config.wsEndpoint,
      chromePath: this.config.chromePath
    });
    const page = new CompatPage(driver2);
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
    return new IBRSession(page, driver2, this.config);
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
  /** Page interface for browser interaction */
  page;
  driver;
  config;
  constructor(page, driver2, config) {
    this.page = page;
    this.driver = driver2;
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
   * Mock a network request.
   * NOTE: Network mocking requires CDP Fetch domain support (not yet implemented).
   * This is a placeholder that throws until CDP Fetch is added to the engine.
   */
  async mock(_pattern, _response) {
    throw new Error(
      "Network mocking not yet supported by CDP engine. This requires the CDP Fetch domain which is planned for a future update."
    );
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
    await this.driver.close();
  }
};

export { A11yAttributesSchema, ActivePreferenceSchema, AnalysisSchema, AuditResultSchema, BoundsSchema, ChangedRegionSchema, CompactContextSchema, CompactionRequestSchema, CompactionResultSchema, ComparisonReportSchema, ComparisonResultSchema, ConfigSchema, CurrentUIStateSchema, DEFAULT_DYNAMIC_SELECTORS, DEFAULT_RETENTION, DecisionEntrySchema, DecisionEntryWithChecksSchema, DecisionStateSchema, DecisionSummarySchema, DecisionTypeSchema, DesignChangeSchema, DesignCheckOperatorSchema, DesignCheckSchema, DesignSystemResultSchema, DesignSystemViolationSchema, ElementIssueSchema, EnhancedElementSchema, ExpectationOperatorSchema, ExpectationSchema, IBRSession, InteractiveStateSchema, InterfaceBuiltRight, LANDMARK_SELECTORS, LandmarkElementSchema, LearnedExpectationSchema, MemorySourceSchema, MemorySummarySchema, NATIVE_VIEWPORTS, ObservationSchema, PERFORMANCE_THRESHOLDS, PreferenceCategorySchema, PreferenceSchema, RuleAuditResultSchema, RuleSettingSchema, RuleSeveritySchema, RulesConfigSchema, SessionQuerySchema, SessionSchema, SessionStatusSchema, VIEWPORTS, VerdictSchema, ViewportSchema, ViolationSchema, addKnownIssue, addPreference, aiSearchFlow, allCalmPrecisionRules, analyzeComparison, analyzeForObviousIssues, annotateScreenshot, applyDesignSystemCheck, archiveSummary, auditNativeElements, bootDevice, buildNativeInteractivity, buildNativeSemantic, calculateComplianceScore, captureMacOSScreenshot, captureNativeScreenshot, captureScreenshot, captureWithDiagnostics, checkConsistency, classifyPageIntent, cleanSessions, closeBrowser, compactContext, compare, compareAll, compareImages, compareLandmarks, completeOperation, corePrincipleIds, createApiTracker, createMemoryPreset, createSession, deleteSession, detectAuthState, detectChangedRegions, detectErrorState, detectLandmarks, detectLoadingState, detectPageState, discoverApiRoutes, discoverPages, enforceRetentionPolicy, ensureExtractor, extractApiCalls, extractMacOSElements, extractNativeElements, filePathToRoute, filterByEndpoint, filterByMethod, findButton, findDevice, findFieldByLabel, findOrphanEndpoints, findProcess, findSessions, flows, formFlow, formatApiTimingResult, formatConsistencyReport, formatDevice, formatGlobalMemory, formatInteractivityResult, formatLandmarkComparison, formatMacOSScanResult, formatMemorySummary, formatNativeScanResult, formatPendingOperations, formatPerformanceResult, formatPreference, formatReportJson, formatReportMinimal, formatReportText, formatResponsiveResult, formatRetentionStatus, formatScanResult, formatSemanticJson, formatSemanticText, formatSessionSummary, formatValidationResult, generateDevModePrompt, generateFixGuide, generateQuickSummary, generateReport, generateSessionId, generateValidationContext, generateValidationPrompt, getBootedDevices, getDecision, getDecisionStats, getDecisionsByRoute, getDecisionsSize, getDeviceViewport, getExpectedLandmarksForIntent, getExpectedLandmarksFromContext, getIntentDescription, getMostRecentSession, getNavigationLinks, getPendingOperations, getPreference, getRetentionStatus, getSemanticOutput, getSession, getSessionPaths, getSessionStats, getSessionsByRoute, getTimeline, getTrackedRoutes, getVerdictDescription, getViewport, groupByEndpoint, groupByFile, initMemory, isCompactContextOversize, isExtractorAvailable, learnFromSession, listDevices, listGlobalPreferences, listLearned, listPreferences, listSessions, loadCompactContext, loadDesignSystemConfig, loadRetentionConfig, loadSummary, loadTokenSpec, loginFlow, mapMacOSToEnhancedElements, mapToEnhancedElements, markSessionCompared, maybeAutoClean, measureApiTiming, measurePerformance, measureWebVitals, normalizeColor, preferencesToRules, promoteToGlobal, promoteToPreference, queryDecisions, queryMemory, rebuildSummary, recordDecision, registerOperation, removeGlobalPreference, removePreference, runAllRules, runDesignSystemCheck, saveCompactContext, saveSummary, scan, scanDirectoryForApiCalls, scanMacOS, scanNative, searchFlow, seedFromGlobal, setActiveRoute, stylisticPrincipleIds, summarizeScan, testInteractivity, testResponsive, updateCompactContext, updateSession, validateAgainstTokens, validateExtendedTokens, waitForCompletion, waitForNavigation, waitForPageReady, withOperationTracking };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map