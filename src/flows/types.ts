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
