/**
 * Flow Types
 *
 * Common types used across all built-in flows.
 */

import type { PageLike as Page } from '../engine/page-like.js';

export interface FlowStep {
  action: string;
  success: boolean;
  duration?: number;
  error?: string;
}

export interface FlowResult {
  success: boolean;
  steps: FlowStep[];
  error?: string;
  /** Time taken in ms */
  duration: number;
}

export interface FlowOptions {
  /** Timeout for the entire flow in ms */
  timeout?: number;
  /** Whether to take screenshots at each step */
  debug?: boolean;
}

// `:has-text(...)` is Playwright pseudo-syntax — it's NOT valid CSS.
// Native `document.querySelector` rejects the whole selector list when one
// component is invalid (the entire string fails to parse). Calls coming from
// the CDP engine therefore crashed with:
//   Failed to execute 'querySelector': '...:has-text("X")...' is not a valid selector.
//
// Helpers below split the work in two:
//   1. Valid-CSS selectors run through `page.$` directly.
//   2. Text-based fallback runs in-page via `page.evaluate`, walking
//      candidate tags and matching `textContent` (or attributes for
//      `<label>` ↔ `<input>` association). The first hit returns a
//      handle obtained via a generated, structurally-unique selector.
//
// The signatures stay the same so callers don't change.

/**
 * Build a unique CSS path for an element by walking up to <body>.
 * Used inside the in-page evaluator to hand a stable selector back to
 * the page-like layer's `$()` so we still return an ElementHandleLike.
 */
const PATH_BUILDER_SOURCE = `
function buildSelectorPath(el) {
  if (!(el instanceof Element)) return null;
  const path = [];
  let cur = el;
  while (cur && cur.nodeType === 1 && cur !== document.body) {
    let sel = cur.nodeName.toLowerCase();
    if (cur.id) {
      // ID alone is unique enough — short-circuit.
      const safeId = cur.id.replace(/(["\\\\])/g, '\\\\$1');
      path.unshift(sel + '[id="' + safeId + '"]');
      break;
    }
    const parent = cur.parentElement;
    if (parent) {
      const sibs = Array.from(parent.children).filter(c => c.nodeName === cur.nodeName);
      if (sibs.length > 1) {
        sel += ':nth-of-type(' + (sibs.indexOf(cur) + 1) + ')';
      }
    }
    path.unshift(sel);
    cur = cur.parentElement;
  }
  return path.length ? path.join(' > ') : null;
}
`;

/**
 * Find a form field by common label patterns.
 *
 * Order:
 *  1. Plain attribute selectors (name/id/placeholder/aria-label).
 *  2. In-page <label>-association walk: find a label whose textContent
 *     contains the term (case-insensitive), then return its associated
 *     input via `for=` lookup or DOM proximity.
 */
export async function findFieldByLabel(
  page: Page,
  labels: string[]
): Promise<ReturnType<Page['$']>> {
  for (const label of labels) {
    // Plain CSS round
    const attrSelectors = [
      `input[name*="${label}" i]`,
      `input[id*="${label}" i]`,
      `input[placeholder*="${label}" i]`,
      `input[aria-label*="${label}" i]`,
    ];
    for (const selector of attrSelectors) {
      const element = await page.$(selector);
      if (element) return element;
    }

    // Text-association fallback — does what `label:has-text("X") input`
    // would have meant in Playwright, but with native DOM walking.
    const selectorPath = await page.evaluate(
      `(function() {
        ${PATH_BUILDER_SOURCE}
        const needle = ${JSON.stringify(label.toLowerCase())};
        const labels = document.querySelectorAll('label');
        for (const l of labels) {
          const t = (l.textContent || '').trim().toLowerCase();
          if (!t.includes(needle)) continue;
          // <label for="x">: find #x.
          const forId = l.getAttribute('for');
          if (forId) {
            const direct = document.getElementById(forId);
            if (direct && direct.tagName === 'INPUT') {
              return buildSelectorPath(direct);
            }
          }
          // <label>...<input>...</label>
          const inside = l.querySelector('input, textarea, select');
          if (inside) return buildSelectorPath(inside);
          // <label>...</label><input> sibling
          const sib = l.nextElementSibling;
          if (sib && (sib.tagName === 'INPUT' || sib.tagName === 'TEXTAREA' || sib.tagName === 'SELECT')) {
            return buildSelectorPath(sib);
          }
        }
        return null;
      })()`
    );
    if (typeof selectorPath === 'string' && selectorPath) {
      const handle = await page.$(selectorPath);
      if (handle) return handle;
    }
  }
  return null;
}

/**
 * Find a button by common patterns.
 *
 * Order:
 *  1. Plain attribute selectors (input[type=submit][value], etc.).
 *  2. In-page text walk over button / a / [role=button] candidates.
 */
export async function findButton(
  page: Page,
  patterns: string[]
): Promise<ReturnType<Page['$']>> {
  for (const pattern of patterns) {
    // CSS-only round (no :has-text).
    const cssSelectors = [
      `input[type="submit"][value*="${pattern}" i]`,
    ];
    for (const selector of cssSelectors) {
      const element = await page.$(selector);
      if (element) return element;
    }

    // Text-content round — what `:has-text(...)` was trying to express.
    const selectorPath = await page.evaluate(
      `(function() {
        ${PATH_BUILDER_SOURCE}
        const needle = ${JSON.stringify(pattern.toLowerCase())};
        const candidates = document.querySelectorAll('button, a, [role="button"]');
        for (const el of candidates) {
          const t = (el.textContent || '').trim().toLowerCase();
          if (t.includes(needle)) return buildSelectorPath(el);
        }
        return null;
      })()`
    );
    if (typeof selectorPath === 'string' && selectorPath) {
      const handle = await page.$(selectorPath);
      if (handle) return handle;
    }
  }

  // Fallback to generic submit button
  return page.$('button[type="submit"], input[type="submit"]');
}

/**
 * Combine valid-CSS selectors with a JS textContent search.
 *
 * Use when a Playwright-style pseudo-selector list mixes valid CSS
 * (`[class*="logout"]`) with `:has-text(...)`. The CSS portion runs
 * through `querySelectorAll`; the text portion runs in-page over the
 * supplied tag set; results are deduped and a stable selector path is
 * returned so callers can `page.$(...)` it.
 */
export async function combinedTextOrCssQuery(
  page: Page,
  options: { cssSelectors: string[]; tags: string[]; textNeedles: string[] }
): Promise<string | null> {
  const { cssSelectors, tags, textNeedles } = options;
  return await page.evaluate(
    `(function() {
      ${PATH_BUILDER_SOURCE}
      const cssList = ${JSON.stringify(cssSelectors)};
      const tags = ${JSON.stringify(tags)};
      const needles = ${JSON.stringify(textNeedles.map(n => n.toLowerCase()))};
      // CSS round first — preserves the historical preference order.
      for (const sel of cssList) {
        try {
          const m = document.querySelector(sel);
          if (m) return buildSelectorPath(m);
        } catch (e) {
          // Skip a selector that the host's CSS engine rejects
          // (e.g. CSS-4-only pseudo-classes). The text round below
          // is the safety net.
        }
      }
      // Text round
      for (const tag of tags) {
        const els = document.querySelectorAll(tag);
        for (const el of els) {
          const t = (el.textContent || '').trim().toLowerCase();
          if (needles.some(n => t.includes(n))) return buildSelectorPath(el);
        }
      }
      return null;
    })()`
  ) as string | null;
}

/**
 * Wait for navigation or network idle
 */
export async function waitForNavigation(
  page: Page,
  timeout = 10000
): Promise<void> {
  try {
    await Promise.race([
      page.waitForNavigation?.(),
      page.waitForLoadState?.('networkidle', { timeout }),
    ]);
  } catch {
    // Timeout is acceptable - page might not navigate
  }
}

// =============================================================================
// AI Search Testing Types
// =============================================================================

/**
 * Screenshot captured at a specific step during search flow
 */
export interface StepScreenshot {
  /** Which step this screenshot was taken at */
  step: 'before' | 'after-query' | 'loading' | 'results';
  /** Path to the screenshot file */
  path: string;
  /** ISO timestamp when captured */
  timestamp: string;
  /** Milliseconds since flow start */
  timing: number;
}

/**
 * Extracted content from a single search result element
 */
export interface ExtractedResult {
  /** Zero-based index in result list */
  index: number;
  /** Title text if identifiable */
  title?: string;
  /** Snippet/description text if present */
  snippet?: string;
  /** Full text content of the result element */
  fullText: string;
  /** CSS selector to locate this element */
  selector: string;
  /** Whether the element is visible in viewport */
  visible: boolean;
}

/**
 * Timing breakdown for search flow phases
 */
export interface SearchTiming {
  /** Total flow duration in ms */
  total: number;
  /** Time spent typing the query */
  typing: number;
  /** Time waiting for results to load */
  waiting: number;
  /** Time for results to render after load */
  rendering: number;
}

/**
 * Extended options for AI search testing
 */
export interface AISearchOptions extends FlowOptions {
  /** Search query to execute */
  query: string;
  /** CSS selector for search results container */
  resultsSelector?: string;
  /** Whether to submit the form or just type (for autocomplete) */
  submit?: boolean;
  /** Capture screenshots at each step (default: true) */
  captureSteps?: boolean;
  /** Extract text content from results (default: true) */
  extractContent?: boolean;
  /** User's intent for validation (what they expect to find) */
  userIntent?: string;
  /** Session directory for storing screenshots */
  sessionDir?: string;
}

/**
 * Extended result from AI search flow with full context for validation
 */
export interface AISearchResult extends FlowResult {
  /** The search query that was executed */
  query: string;
  /** User's stated intent for validation */
  userIntent?: string;
  /** Number of results found */
  resultCount: number;
  /** Whether any results were found */
  hasResults: boolean;
  /** Timing breakdown for each phase */
  timing: SearchTiming;
  /** Screenshots captured at each step */
  screenshots: StepScreenshot[];
  /** Extracted content from result elements */
  extractedResults: ExtractedResult[];
  /** Directory where search artifacts are stored */
  artifactDir?: string;
}
