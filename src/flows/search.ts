/**
 * Search Flow
 *
 * Handles common search patterns with result detection.
 * Includes AI-powered search testing with step screenshots and content extraction.
 */

import type { Page } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import {
  findFieldByLabel,
  waitForNavigation,
  type FlowResult,
  type FlowStep,
  type FlowOptions,
  type AISearchOptions,
  type AISearchResult,
  type StepScreenshot,
  type ExtractedResult,
  type SearchTiming,
} from './types.js';

export interface FlowSearchOptions extends FlowOptions {
  /** Search query */
  query: string;
  /** Selector for search results container */
  resultsSelector?: string;
  /** Whether to submit the form or just type (for autocomplete) */
  submit?: boolean;
}

export interface SearchResult extends FlowResult {
  /** Number of results found */
  resultCount: number;
  /** Whether results were found */
  hasResults: boolean;
}

/**
 * Execute search flow
 */
export async function searchFlow(
  page: Page,
  options: FlowSearchOptions
): Promise<SearchResult> {
  const startTime = Date.now();
  const steps: FlowStep[] = [];
  const timeout = options.timeout || 10000;

  try {
    // Step 1: Find search input
    const searchInput = await findFieldByLabel(page, [
      'search',
      'query',
      'q',
      'find',
    ]);

    // Also try common search input patterns
    const searchField = searchInput || await page.$(
      'input[type="search"], ' +
      'input[name="q"], ' +
      'input[name="query"], ' +
      'input[placeholder*="search" i], ' +
      '[role="searchbox"]'
    );

    if (!searchField) {
      return {
        success: false,
        resultCount: 0,
        hasResults: false,
        steps,
        error: 'Could not find search input',
        duration: Date.now() - startTime,
      };
    }

    // Clear existing content and type query
    await searchField.fill('');
    await searchField.fill(options.query);
    steps.push({ action: `type "${options.query}"`, success: true });

    // Step 2: Submit if requested (default true)
    if (options.submit !== false) {
      // Try pressing Enter first
      await searchField.press('Enter');
      steps.push({ action: 'submit search', success: true });

      // Wait for results
      await waitForNavigation(page, timeout);
      steps.push({ action: 'wait for results', success: true });
    } else {
      // Just wait for autocomplete
      await page.waitForTimeout(500);
      steps.push({ action: 'wait for autocomplete', success: true });
    }

    // Step 3: Count results
    const resultsSelector = options.resultsSelector ||
      '[class*="result"], [class*="item"], [class*="card"], ' +
      '[data-testid*="result"], li[class*="search"]';

    const results = await page.$$(resultsSelector);
    const resultCount = results.length;
    const hasResults = resultCount > 0;

    // Check for empty state
    const emptyState = await page.$(
      '[class*="no-results"], [class*="empty"], ' +
      ':has-text("no results"), :has-text("nothing found")'
    );

    steps.push({
      action: `found ${resultCount} results`,
      success: hasResults || !!emptyState,
    });

    return {
      success: true,
      resultCount,
      hasResults,
      steps,
      duration: Date.now() - startTime,
    };

  } catch (error) {
    return {
      success: false,
      resultCount: 0,
      hasResults: false,
      steps,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
}

// =============================================================================
// AI Search Flow - Enhanced search with screenshots, timing, and content extraction
// =============================================================================

/**
 * Capture a screenshot at a specific step
 */
async function captureStepScreenshot(
  page: Page,
  step: StepScreenshot['step'],
  artifactDir: string,
  startTime: number
): Promise<StepScreenshot> {
  const timestamp = new Date().toISOString();
  const timing = Date.now() - startTime;
  const stepNum = { before: '01', 'after-query': '02', loading: '03', results: '04' }[step];
  const filename = `${stepNum}-${step}.png`;
  const path = join(artifactDir, filename);

  // Disable animations before screenshot
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });

  await page.screenshot({
    path,
    fullPage: false,
    type: 'png',
  });

  return { step, path, timestamp, timing };
}

/**
 * Extract content from search result elements
 */
async function extractResultContent(
  page: Page,
  resultsSelector: string
): Promise<ExtractedResult[]> {
  return page.evaluate((selector) => {
    const elements = document.querySelectorAll(selector);
    const results: ExtractedResult[] = [];

    elements.forEach((el, index) => {
      const htmlEl = el as HTMLElement;
      const rect = htmlEl.getBoundingClientRect();

      // Try to identify title (usually in h1-h6, strong, or first bold text)
      const titleEl = htmlEl.querySelector('h1, h2, h3, h4, h5, h6, strong, b, [class*="title"]');
      const title = titleEl?.textContent?.trim();

      // Try to identify snippet/description
      const snippetEl = htmlEl.querySelector('p, [class*="snippet"], [class*="description"], [class*="summary"]');
      const snippet = snippetEl?.textContent?.trim();

      // Get full text content
      const fullText = htmlEl.textContent?.trim() || '';

      // Generate a unique selector for this element
      let selector = el.tagName.toLowerCase();
      if (el.id) {
        selector = `#${el.id}`;
      } else if (el.className && typeof el.className === 'string') {
        const classes = el.className.split(' ').filter(c => c.trim())[0];
        if (classes) selector += `.${classes}`;
        selector += `:nth-of-type(${index + 1})`;
      }

      results.push({
        index,
        title: title || undefined,
        snippet: snippet || undefined,
        fullText: fullText.slice(0, 500), // Limit length
        selector,
        visible: rect.top >= 0 && rect.top < window.innerHeight,
      });
    });

    return results;
  }, resultsSelector);
}

/**
 * Execute AI-enhanced search flow with screenshots and content extraction
 *
 * This function extends the basic search flow with:
 * - Step-by-step screenshots (before, after-query, results)
 * - Detailed timing breakdown
 * - Extraction of result content for AI validation
 * - User intent tracking for relevance checking
 */
export async function aiSearchFlow(
  page: Page,
  options: AISearchOptions
): Promise<AISearchResult> {
  const startTime = Date.now();
  const steps: FlowStep[] = [];
  const screenshots: StepScreenshot[] = [];
  const timeout = options.timeout || 10000;
  const captureSteps = options.captureSteps !== false;
  const extractContent = options.extractContent !== false;

  // Timing breakdown
  const timing: SearchTiming = {
    total: 0,
    typing: 0,
    waiting: 0,
    rendering: 0,
  };

  // Create artifact directory if capturing screenshots
  let artifactDir: string | undefined;
  if (captureSteps && options.sessionDir) {
    artifactDir = join(options.sessionDir, `search-${Date.now()}`);
    await mkdir(artifactDir, { recursive: true });
  }

  try {
    // Step 1: Capture "before" screenshot
    if (captureSteps && artifactDir) {
      const shot = await captureStepScreenshot(page, 'before', artifactDir, startTime);
      screenshots.push(shot);
      steps.push({ action: 'capture before screenshot', success: true, duration: shot.timing });
    }

    // Step 2: Find search input
    const searchInput = await findFieldByLabel(page, ['search', 'query', 'q', 'find']);
    const searchField = searchInput || await page.$(
      'input[type="search"], ' +
      'input[name="q"], ' +
      'input[name="query"], ' +
      'input[placeholder*="search" i], ' +
      '[role="searchbox"]'
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
        error: 'Could not find search input',
        duration: Date.now() - startTime,
        artifactDir,
      };
    }

    // Step 3: Type query with timing
    const typingStart = Date.now();
    await searchField.fill('');
    await searchField.fill(options.query);
    timing.typing = Date.now() - typingStart;
    steps.push({ action: `type "${options.query}"`, success: true, duration: timing.typing });

    // Step 4: Capture "after-query" screenshot (for autocomplete testing)
    if (captureSteps && artifactDir) {
      const shot = await captureStepScreenshot(page, 'after-query', artifactDir, startTime);
      screenshots.push(shot);
      steps.push({ action: 'capture after-query screenshot', success: true });
    }

    // Step 5: Submit if requested (default true)
    const waitingStart = Date.now();
    if (options.submit !== false) {
      await searchField.press('Enter');
      steps.push({ action: 'submit search', success: true });

      // Wait for results
      await waitForNavigation(page, timeout);
      steps.push({ action: 'wait for results', success: true });
    } else {
      // Just wait for autocomplete
      await page.waitForTimeout(500);
      steps.push({ action: 'wait for autocomplete', success: true });
    }
    timing.waiting = Date.now() - waitingStart;

    // Step 6: Capture "results" screenshot
    const renderingStart = Date.now();
    if (captureSteps && artifactDir) {
      const shot = await captureStepScreenshot(page, 'results', artifactDir, startTime);
      screenshots.push(shot);
      steps.push({ action: 'capture results screenshot', success: true });
    }

    // Step 7: Count and extract results
    const resultsSelector = options.resultsSelector ||
      '[class*="result"], [class*="item"], [class*="card"], ' +
      '[data-testid*="result"], li[class*="search"]';

    const resultElements = await page.$$(resultsSelector);
    const resultCount = resultElements.length;
    const hasResults = resultCount > 0;

    // Extract content if enabled
    let extractedResults: ExtractedResult[] = [];
    if (extractContent && hasResults) {
      extractedResults = await extractResultContent(page, resultsSelector);
      steps.push({ action: `extracted ${extractedResults.length} results`, success: true });
    }

    timing.rendering = Date.now() - renderingStart;
    timing.total = Date.now() - startTime;

    // Save results.json if we have an artifact directory
    if (artifactDir) {
      const resultsData = {
        query: options.query,
        userIntent: options.userIntent,
        timestamp: new Date().toISOString(),
        resultCount,
        hasResults,
        timing,
        extractedResults,
      };
      await writeFile(
        join(artifactDir, 'results.json'),
        JSON.stringify(resultsData, null, 2)
      );
    }

    steps.push({
      action: `found ${resultCount} results`,
      success: hasResults,
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
      artifactDir,
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
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: timing.total,
      artifactDir,
    };
  }
}
