/**
 * Semantic Output Formatter
 *
 * Transforms raw page data into AI-friendly semantic output.
 * Provides verdicts, recommendations, and recovery hints.
 */

import type { Page } from 'playwright';
import { classifyPageIntent, type PageIntent, type PageIntentResult } from './page-intent.js';
import { detectPageState, type PageState } from './state-detector.js';

export type SemanticVerdict = 'PASS' | 'ISSUES' | 'FAIL' | 'LOADING' | 'ERROR';

export interface SemanticIssue {
  severity: 'critical' | 'major' | 'minor';
  type: string;
  element?: string;      // Human-readable description or selector
  problem: string;
  fix: string;
}

export interface AvailableAction {
  action: string;        // e.g., 'login', 'search', 'submit'
  selector?: string;     // Best selector to use
  description: string;   // What this action does
}

export interface RecoveryHint {
  suggestion: string;
  alternatives?: string[];
  waitFor?: string;      // Selector to wait for
}

export interface SemanticResult {
  // Primary verdict for decision loops
  verdict: SemanticVerdict;
  confidence: number;

  // Page understanding
  pageIntent: PageIntentResult;
  state: PageState;

  // What can be done on this page
  availableActions: AvailableAction[];

  // Issues found (if any)
  issues: SemanticIssue[];

  // Recovery suggestions (if failed)
  recovery?: RecoveryHint;

  // Summary for AI reasoning
  summary: string;

  // Raw data for advanced use
  url: string;
  title: string;
  timestamp: string;
}

/**
 * Get semantic understanding of a page
 */
export async function getSemanticOutput(page: Page): Promise<SemanticResult> {
  // Get page basics
  const url = page.url();
  const title = await page.title();
  const timestamp = new Date().toISOString();

  // Run semantic analysis in parallel
  const [pageIntent, state] = await Promise.all([
    classifyPageIntent(page),
    detectPageState(page),
  ]);

  // Detect available actions based on intent
  const availableActions = await detectAvailableActions(page, pageIntent.intent);

  // Collect issues
  const issues = collectIssues(state, pageIntent);

  // Determine verdict
  const verdict = determineVerdict(state, issues);

  // Generate recovery hints if needed
  const recovery = verdict === 'FAIL' || verdict === 'ERROR'
    ? generateRecoveryHint(state, pageIntent.intent)
    : undefined;

  // Generate summary
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
    timestamp,
  };
}

/**
 * Detect available actions based on page intent
 */
async function detectAvailableActions(
  page: Page,
  intent: PageIntent
): Promise<AvailableAction[]> {
  const actions: AvailableAction[] = [];

  const checks = await page.evaluate(() => {
    const doc = document;

    // Form actions
    const submitButton = doc.querySelector('button[type="submit"], input[type="submit"]');
    const searchInput = doc.querySelector('input[type="search"], input[name*="search"], input[placeholder*="search"]');
    const loginForm = doc.querySelector('form input[type="password"]');

    // Navigation actions
    const mainNav = doc.querySelector('nav a, header a');
    const backButton = doc.querySelector('a:has-text("back"), button:has-text("back")');

    // Content actions
    const addButton = doc.querySelector('button:has-text("add"), button:has-text("create"), button:has-text("new")');
    const editButton = doc.querySelector('button:has-text("edit"), a:has-text("edit")');
    const deleteButton = doc.querySelector('button:has-text("delete"), button:has-text("remove")');

    // List actions
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
      hasPagination: !!pagination,
    };

    function getSelector(el: Element): string {
      if (el.id) return `#${el.id}`;
      if (el.getAttribute('data-testid')) return `[data-testid="${el.getAttribute('data-testid')}"]`;
      if (el.className) return `.${el.className.split(' ')[0]}`;
      return el.tagName.toLowerCase();
    }
  });

  // Build actions based on intent and available elements
  if (intent === 'auth' && checks.hasLogin) {
    actions.push({
      action: 'login',
      selector: 'form',
      description: 'Submit login credentials',
    });
  }

  if (checks.hasSearch) {
    actions.push({
      action: 'search',
      selector: checks.searchSelector || 'input[type="search"]',
      description: 'Search for content',
    });
  }

  if (checks.hasSubmit && intent !== 'auth') {
    actions.push({
      action: 'submit',
      selector: checks.submitSelector || 'button[type="submit"]',
      description: 'Submit form',
    });
  }

  if (checks.hasAdd) {
    actions.push({
      action: 'create',
      selector: checks.addSelector || 'button:has-text("add")',
      description: 'Create new item',
    });
  }

  if (intent === 'listing') {
    if (checks.hasFilter) {
      actions.push({
        action: 'filter',
        description: 'Filter results',
      });
    }
    if (checks.hasSort) {
      actions.push({
        action: 'sort',
        description: 'Sort results',
      });
    }
    if (checks.hasPagination) {
      actions.push({
        action: 'paginate',
        description: 'Navigate to next/previous page',
      });
    }
  }

  if (checks.hasBack) {
    actions.push({
      action: 'back',
      description: 'Go back to previous page',
    });
  }

  return actions;
}

/**
 * Collect issues from page state
 */
function collectIssues(state: PageState, intent: PageIntentResult): SemanticIssue[] {
  const issues: SemanticIssue[] = [];

  // Add error-based issues
  for (const error of state.errors.errors) {
    issues.push({
      severity: error.type === 'server' || error.type === 'permission' ? 'critical' : 'major',
      type: error.type,
      problem: error.message,
      fix: getErrorFix(error.type),
    });
  }

  // Add loading issues if taking too long
  if (state.loading.loading && state.loading.elements > 3) {
    issues.push({
      severity: 'minor',
      type: 'slow-loading',
      problem: `Page has ${state.loading.elements} loading indicators`,
      fix: 'Wait for content to load or check network',
    });
  }

  // Add auth issues
  if (state.auth.authenticated === false && intent.intent === 'dashboard') {
    issues.push({
      severity: 'major',
      type: 'auth-required',
      problem: 'Dashboard requires authentication',
      fix: 'Login first before accessing this page',
    });
  }

  return issues;
}

function getErrorFix(errorType: string): string {
  const fixes: Record<string, string> = {
    validation: 'Fix the highlighted form fields',
    api: 'Retry the request or check API status',
    permission: 'Login with appropriate permissions',
    notfound: 'Check the URL or navigate to a valid page',
    server: 'Wait and retry, or contact support',
    network: 'Check internet connection',
    unknown: 'Investigate the error message',
  };
  return fixes[errorType] || 'Investigate the issue';
}

/**
 * Determine overall verdict
 */
function determineVerdict(state: PageState, issues: SemanticIssue[]): SemanticVerdict {
  // Check for critical issues first
  const hasCritical = issues.some(i => i.severity === 'critical');
  if (hasCritical) return 'ERROR';

  // Check for loading state
  if (state.loading.loading) return 'LOADING';

  // Check for errors
  if (state.errors.hasErrors) return 'FAIL';

  // Check for major issues
  const hasMajor = issues.some(i => i.severity === 'major');
  if (hasMajor) return 'ISSUES';

  // All good
  return 'PASS';
}

/**
 * Generate recovery hints for failed states
 */
function generateRecoveryHint(state: PageState, _intent: PageIntent): RecoveryHint {
  // Auth issues
  if (state.auth.authenticated === false) {
    return {
      suggestion: 'Login to access this page',
      alternatives: ['Use ibr.flow.login()', 'Navigate to /login first'],
      waitFor: '[class*="user"], [class*="avatar"]',
    };
  }

  // Server errors
  if (state.errors.errors.some(e => e.type === 'server')) {
    return {
      suggestion: 'Server error - wait and retry',
      alternatives: ['Refresh the page', 'Check server status'],
    };
  }

  // Not found errors
  if (state.errors.errors.some(e => e.type === 'notfound')) {
    return {
      suggestion: 'Page not found - check URL',
      alternatives: ['Navigate to homepage', 'Use search to find content'],
    };
  }

  // Loading issues
  if (state.loading.loading) {
    return {
      suggestion: 'Wait for page to finish loading',
      waitFor: state.loading.type === 'skeleton'
        ? ':not([class*="skeleton"])'
        : ':not([class*="loading"])',
    };
  }

  // Default
  return {
    suggestion: 'Investigate the page state and retry',
  };
}

/**
 * Generate human-readable summary
 */
function generateSummary(
  intent: PageIntentResult,
  state: PageState,
  verdict: SemanticVerdict,
  issueCount: number
): string {
  const parts: string[] = [];

  // Intent
  parts.push(`${intent.intent} page`);

  // Confidence
  if (intent.confidence < 0.5) {
    parts.push('(low confidence)');
  }

  // Auth state
  if (state.auth.authenticated === true) {
    parts.push(`authenticated${state.auth.username ? ` as ${state.auth.username}` : ''}`);
  } else if (state.auth.authenticated === false) {
    parts.push('not authenticated');
  }

  // Loading
  if (state.loading.loading) {
    parts.push(`loading (${state.loading.type})`);
  }

  // Verdict
  if (verdict === 'PASS') {
    parts.push('ready for interaction');
  } else if (verdict === 'ISSUES') {
    parts.push(`${issueCount} issue${issueCount > 1 ? 's' : ''} detected`);
  } else if (verdict === 'ERROR' || verdict === 'FAIL') {
    parts.push(`${issueCount} error${issueCount > 1 ? 's' : ''}`);
  }

  return parts.join(', ');
}

/**
 * Format semantic result as concise text for AI consumption
 */
export function formatSemanticText(result: SemanticResult): string {
  const lines: string[] = [];

  lines.push(`Verdict: ${result.verdict}`);
  lines.push(`Page: ${result.pageIntent.intent} (${Math.round(result.confidence * 100)}% confidence)`);
  lines.push(`Summary: ${result.summary}`);

  if (result.state.auth.authenticated !== null) {
    lines.push(`Auth: ${result.state.auth.authenticated ? 'logged in' : 'logged out'}`);
  }

  if (result.availableActions.length > 0) {
    lines.push(`Actions: ${result.availableActions.map(a => a.action).join(', ')}`);
  }

  if (result.issues.length > 0) {
    lines.push(`Issues: ${result.issues.map(i => i.problem).join('; ')}`);
  }

  if (result.recovery) {
    lines.push(`Recovery: ${result.recovery.suggestion}`);
  }

  return lines.join('\n');
}

/**
 * Format semantic result as JSON for structured consumption
 */
export function formatSemanticJson(result: SemanticResult): string {
  // Return a cleaned version with just the essential fields
  return JSON.stringify({
    verdict: result.verdict,
    intent: result.pageIntent.intent,
    confidence: result.confidence,
    authenticated: result.state.auth.authenticated,
    loading: result.state.loading.loading,
    ready: result.state.ready,
    actions: result.availableActions.map(a => a.action),
    issues: result.issues.map(i => ({ severity: i.severity, problem: i.problem })),
    recovery: result.recovery?.suggestion,
  }, null, 2);
}
