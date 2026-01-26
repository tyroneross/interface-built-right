/**
 * Search Flow
 *
 * Handles common search patterns with result detection.
 */

import type { Page } from 'playwright';
import { findFieldByLabel, waitForNavigation, type FlowResult, type FlowStep, type FlowOptions } from './types.js';

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
