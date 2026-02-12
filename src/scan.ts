import type { Page } from 'playwright';
import { chromium } from 'playwright';
import type { EnhancedElement, AuditResult, Viewport } from './schemas.js';
import { VIEWPORTS } from './schemas.js';
import { extractInteractiveElements, analyzeElements } from './extract.js';
import { testInteractivity, type InteractivityResult } from './interactivity.js';
import { getSemanticOutput, type SemanticResult } from './semantic/index.js';


/**
 * Comprehensive UI scan result combining all IBR analysis capabilities
 */
export interface ScanResult {
  url: string;
  route: string;
  timestamp: string;
  viewport: Viewport;

  /** Element extraction: all interactive elements with computed styles */
  elements: {
    all: EnhancedElement[];
    audit: AuditResult;
  };

  /** Interactivity analysis: buttons, links, forms with handler detection */
  interactivity: InteractivityResult;

  /** Semantic understanding: page intent, auth/loading/error states */
  semantic: SemanticResult;

  /** Console output captured during page load */
  console: {
    errors: string[];
    warnings: string[];
  };

  /** Overall scan verdict */
  verdict: 'PASS' | 'ISSUES' | 'FAIL';
  issues: ScanIssue[];
  summary: string;
}

/**
 * Individual issue found during scan
 */
export interface ScanIssue {
  category: 'interactivity' | 'accessibility' | 'semantic' | 'console' | 'structure';
  severity: 'error' | 'warning' | 'info';
  element?: string;
  description: string;
  fix?: string;
}

/**
 * Options for running a scan
 */
export interface ScanOptions {
  /** Viewport to use (default: desktop) */
  viewport?: keyof typeof VIEWPORTS | Viewport;
  /** Timeout for page load in ms (default: 30000) */
  timeout?: number;
  /** Wait for this selector before scanning */
  waitFor?: string;
  /** IBR output directory for auth state */
  outputDir?: string;
  /** Whether to capture a screenshot */
  screenshot?: {
    path: string;
    fullPage?: boolean;
  };
}

/**
 * Run a comprehensive UI scan on a URL.
 *
 * Combines all IBR analysis capabilities into a single scan:
 * 1. Element extraction (computed styles, bounds, handlers)
 * 2. Interactivity testing (buttons, links, forms)
 * 3. Semantic analysis (page intent, auth/loading/error states)
 * 4. Console error capture
 * 5. Issue aggregation with verdict
 */
export async function scan(url: string, options: ScanOptions = {}): Promise<ScanResult> {
  const {
    viewport: viewportOpt = 'desktop',
    timeout = 30000,
    waitFor,
    screenshot,
  } = options;

  const resolvedViewport: Viewport = typeof viewportOpt === 'string'
    ? VIEWPORTS[viewportOpt] || VIEWPORTS.desktop
    : viewportOpt;

  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: resolvedViewport.width, height: resolvedViewport.height },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });
  const page = await context.newPage();

  // Capture console output
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    } else if (msg.type() === 'warning') {
      consoleWarnings.push(msg.text());
    }
  });

  try {
    // Navigate
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout,
    });

    // Wait for network idle
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Wait for specific selector if provided
    if (waitFor) {
      await page.waitForSelector(waitFor, { timeout: 10000 }).catch(() => {});
    }

    // Run all analyses in parallel where possible
    const [elements, interactivity, semantic] = await Promise.all([
      extractAndAudit(page, resolvedViewport),
      testInteractivity(page),
      getSemanticOutput(page),
    ]);

    // Capture screenshot if requested
    if (screenshot) {
      await page.screenshot({
        path: screenshot.path,
        fullPage: screenshot.fullPage ?? true,
      });
    }

    // Extract route from URL
    let route: string;
    try {
      route = new URL(url).pathname;
    } catch {
      route = url;
    }

    // Aggregate issues
    const issues = aggregateIssues(elements.audit, interactivity, semantic, consoleErrors);
    const verdict = determineVerdict(issues);
    const summary = generateSummary(elements, interactivity, semantic, issues, consoleErrors);

    return {
      url,
      route,
      timestamp: new Date().toISOString(),
      viewport: resolvedViewport,
      elements,
      interactivity,
      semantic,
      console: {
        errors: consoleErrors,
        warnings: consoleWarnings,
      },
      verdict,
      issues,
      summary,
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

/**
 * Extract elements and run audit
 */
async function extractAndAudit(
  page: Page,
  viewport: Viewport
): Promise<{ all: EnhancedElement[]; audit: AuditResult }> {
  const isMobile = viewport.width < 768;
  const elements = await extractInteractiveElements(page);
  const audit = analyzeElements(elements, isMobile);
  return { all: elements, audit };
}

/**
 * Aggregate issues from all analysis sources into a unified list
 */
function aggregateIssues(
  audit: AuditResult,
  interactivity: InteractivityResult,
  semantic: SemanticResult,
  consoleErrors: string[]
): ScanIssue[] {
  const issues: ScanIssue[] = [];

  // Element audit issues
  for (const issue of audit.issues) {
    issues.push({
      category: issue.type === 'MISSING_ARIA_LABEL' ? 'accessibility' : 'interactivity',
      severity: issue.severity,
      element: issue.type === 'TOUCH_TARGET_SMALL' ? undefined : undefined,
      description: issue.message,
    });
  }

  // Interactivity issues (deduplicate with audit)
  const auditMessages = new Set(audit.issues.map(i => i.message));
  for (const issue of interactivity.issues) {
    if (auditMessages.has(issue.description)) continue;
    issues.push({
      category: issue.type === 'MISSING_LABEL' ? 'accessibility' : 'interactivity',
      severity: issue.severity,
      element: issue.element,
      description: issue.description,
      fix: getFixSuggestion(issue.type),
    });
  }

  // Semantic issues
  for (const issue of semantic.issues) {
    issues.push({
      category: 'semantic',
      severity: issue.severity as 'error' | 'warning' | 'info',
      description: issue.problem,
    });
  }

  // Console errors
  for (const error of consoleErrors) {
    // Skip common noise
    if (error.includes('favicon') || error.includes('manifest')) continue;
    issues.push({
      category: 'console',
      severity: 'error',
      description: `Console error: ${error.slice(0, 200)}`,
    });
  }

  return issues;
}

/**
 * Determine overall verdict from issues
 */
function determineVerdict(issues: ScanIssue[]): 'PASS' | 'ISSUES' | 'FAIL' {
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  if (errorCount >= 3) return 'FAIL';
  if (errorCount > 0 || warningCount >= 5) return 'ISSUES';
  return 'PASS';
}

/**
 * Generate human-readable summary
 */
function generateSummary(
  elements: { all: EnhancedElement[]; audit: AuditResult },
  interactivity: InteractivityResult,
  semantic: SemanticResult,
  issues: ScanIssue[],
  consoleErrors: string[]
): string {
  const parts: string[] = [];

  // Page type
  parts.push(`${semantic.pageIntent.intent} page`);

  // Element counts
  parts.push(`${elements.audit.totalElements} elements (${elements.audit.interactiveCount} interactive)`);

  // Interactivity
  const { buttons, links, forms } = interactivity;
  const interactiveParts: string[] = [];
  if (buttons.length > 0) interactiveParts.push(`${buttons.length} buttons`);
  if (links.length > 0) interactiveParts.push(`${links.length} links`);
  if (forms.length > 0) interactiveParts.push(`${forms.length} forms`);
  if (interactiveParts.length > 0) {
    parts.push(interactiveParts.join(', '));
  }

  // Handler coverage
  if (interactivity.summary.withoutHandlers > 0) {
    parts.push(`${interactivity.summary.withoutHandlers} elements without handlers`);
  }

  // Auth state
  if (semantic.state.auth.authenticated) {
    parts.push('authenticated');
  }

  // Loading
  if (semantic.state.loading.loading) {
    parts.push(`loading (${semantic.state.loading.type})`);
  }

  // Errors
  if (semantic.state.errors.hasErrors) {
    parts.push(`${semantic.state.errors.errors.length} page errors`);
  }

  // Console errors
  if (consoleErrors.length > 0) {
    parts.push(`${consoleErrors.length} console errors`);
  }

  // Issues summary
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  if (errorCount > 0 || warningCount > 0) {
    const issueParts = [];
    if (errorCount > 0) issueParts.push(`${errorCount} errors`);
    if (warningCount > 0) issueParts.push(`${warningCount} warnings`);
    parts.push(issueParts.join(', '));
  }

  return parts.join(', ');
}

/**
 * Get fix suggestion for common issue types
 */
function getFixSuggestion(type: string): string | undefined {
  switch (type) {
    case 'NO_HANDLER':
      return 'Add an onClick handler or remove the interactive appearance';
    case 'PLACEHOLDER_LINK':
      return 'Add a real href or an onClick handler';
    case 'MISSING_LABEL':
      return 'Add aria-label or visible text content';
    case 'FORM_NO_SUBMIT':
      return 'Add a submit handler or action attribute to the form';
    case 'ORPHAN_SUBMIT':
      return 'Ensure the submit button is inside a form';
    case 'SMALL_TOUCH_TARGET':
      return 'Increase element size to at least 44x44px for touch targets';
    default:
      return undefined;
  }
}

/**
 * Format scan result for console output
 */
export function formatScanResult(result: ScanResult): string {
  const lines: string[] = [];

  const verdictIcon = result.verdict === 'PASS' ? '\x1b[32m✓\x1b[0m' :
                      result.verdict === 'ISSUES' ? '\x1b[33m!\x1b[0m' :
                      '\x1b[31m✗\x1b[0m';

  lines.push('═══════════════════════════════════════════════════════');
  lines.push('  IBR UI SCAN');
  lines.push('═══════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`  URL:      ${result.url}`);
  lines.push(`  Route:    ${result.route}`);
  lines.push(`  Viewport: ${result.viewport.name} (${result.viewport.width}x${result.viewport.height})`);
  lines.push(`  Verdict:  ${verdictIcon} ${result.verdict}`);
  lines.push('');

  // Summary line
  lines.push(`  ${result.summary}`);
  lines.push('');

  // Semantic
  lines.push('  PAGE UNDERSTANDING');
  lines.push('  ─────────────────');
  lines.push(`  Intent:   ${result.semantic.pageIntent.intent} (${(result.semantic.confidence * 100).toFixed(0)}% confidence)`);
  lines.push(`  Auth:     ${result.semantic.state.auth.authenticated ? 'Authenticated' : 'Not authenticated'}`);
  lines.push(`  Loading:  ${result.semantic.state.loading.loading ? result.semantic.state.loading.type : 'Complete'}`);
  lines.push(`  Errors:   ${result.semantic.state.errors.hasErrors ? result.semantic.state.errors.errors.join(', ') : 'None'}`);
  lines.push('');

  // Elements
  lines.push('  ELEMENTS');
  lines.push('  ────────');
  lines.push(`  Total:              ${result.elements.audit.totalElements}`);
  lines.push(`  Interactive:        ${result.elements.audit.interactiveCount}`);
  lines.push(`  With handlers:      ${result.elements.audit.withHandlers}`);
  lines.push(`  Without handlers:   ${result.elements.audit.withoutHandlers}`);
  lines.push('');

  // Interactivity breakdown
  const { buttons, links, forms } = result.interactivity;
  lines.push('  INTERACTIVITY');
  lines.push('  ─────────────');
  lines.push(`  Buttons: ${buttons.length}  Links: ${links.length}  Forms: ${forms.length}`);

  if (forms.length > 0) {
    for (const form of forms) {
      const icon = form.hasSubmitHandler ? '✓' : '✗';
      lines.push(`    ${icon} Form ${form.selector}: ${form.fields.length} fields${form.hasValidation ? ', validated' : ''}`);
    }
  }
  lines.push('');

  // Console
  if (result.console.errors.length > 0 || result.console.warnings.length > 0) {
    lines.push('  CONSOLE');
    lines.push('  ───────');
    if (result.console.errors.length > 0) {
      lines.push(`  Errors: ${result.console.errors.length}`);
      for (const err of result.console.errors.slice(0, 3)) {
        lines.push(`    ✗ ${err.slice(0, 100)}`);
      }
    }
    if (result.console.warnings.length > 0) {
      lines.push(`  Warnings: ${result.console.warnings.length}`);
    }
    lines.push('');
  }

  // Issues
  if (result.issues.length > 0) {
    lines.push('  ISSUES');
    lines.push('  ──────');
    for (const issue of result.issues) {
      const icon = issue.severity === 'error' ? '\x1b[31m✗\x1b[0m' :
                   issue.severity === 'warning' ? '\x1b[33m!\x1b[0m' : 'ℹ';
      lines.push(`  ${icon} [${issue.category}] ${issue.description}`);
      if (issue.fix) {
        lines.push(`    → ${issue.fix}`);
      }
    }
  } else {
    lines.push('  No issues detected.');
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════');

  return lines.join('\n');
}
