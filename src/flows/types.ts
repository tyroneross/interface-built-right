/**
 * Flow Types
 *
 * Common types used across all built-in flows.
 */

import type { Page } from 'playwright';

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

/**
 * Find a form field by common label patterns
 */
export async function findFieldByLabel(
  page: Page,
  labels: string[]
): Promise<ReturnType<Page['$']>> {
  for (const label of labels) {
    // Try various selector patterns
    const selectors = [
      `input[name*="${label}" i]`,
      `input[id*="${label}" i]`,
      `input[placeholder*="${label}" i]`,
      `input[aria-label*="${label}" i]`,
      `label:has-text("${label}") + input`,
      `label:has-text("${label}") input`,
    ];

    for (const selector of selectors) {
      const element = await page.$(selector);
      if (element) return element;
    }
  }
  return null;
}

/**
 * Find a button by common patterns
 */
export async function findButton(
  page: Page,
  patterns: string[]
): Promise<ReturnType<Page['$']>> {
  for (const pattern of patterns) {
    const selectors = [
      `button:has-text("${pattern}")`,
      `input[type="submit"][value*="${pattern}" i]`,
      `button[type="submit"]:has-text("${pattern}")`,
      `a:has-text("${pattern}")`,
      `[role="button"]:has-text("${pattern}")`,
    ];

    for (const selector of selectors) {
      const element = await page.$(selector);
      if (element) return element;
    }
  }

  // Fallback to generic submit button
  return page.$('button[type="submit"], input[type="submit"]');
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
      page.waitForNavigation({ timeout }),
      page.waitForLoadState('networkidle', { timeout }),
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
