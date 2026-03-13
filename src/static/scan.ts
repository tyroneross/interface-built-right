/**
 * Static HTML/CSS Scanner
 *
 * Orchestrates static analysis without browser execution.
 * Checks structure, accessibility, touch targets, and content.
 */

import { readFileSync, existsSync } from 'fs';
import { parseStaticHTML, parseCSS, applyStyles, type StaticElement } from './parser.js';

export interface StaticScanOptions {
  htmlPath: string;
  cssPath?: string;
}

export interface StaticScanResult {
  htmlPath: string;
  cssPath?: string;
  timestamp: string;
  elements: {
    all: StaticElement[];
    audit: {
      totalElements: number;
      interactiveCount: number;
      withHandlers: number;
      withoutHandlers: number;
      issues: Array<{ type: string; severity: string; message: string }>;
    };
  };
  verdict: 'PASS' | 'ISSUES' | 'FAIL';
  issues: Array<{ category: string; severity: string; description: string; fix?: string }>;
  summary: string;
}

/**
 * Scan static HTML/CSS files
 *
 * Process:
 * 1. Read and parse HTML
 * 2. Optionally read and apply CSS
 * 3. Run accessibility and structure audits
 * 4. Determine verdict
 * 5. Generate summary
 */
export function scanStatic(options: StaticScanOptions): StaticScanResult {
  const { htmlPath, cssPath } = options;

  // Validate inputs
  if (!existsSync(htmlPath)) {
    throw new Error(`HTML file not found: ${htmlPath}`);
  }

  if (cssPath && !existsSync(cssPath)) {
    throw new Error(`CSS file not found: ${cssPath}`);
  }

  // Read HTML
  const html = readFileSync(htmlPath, 'utf-8');

  // Parse HTML → StaticElement[]
  let elements = parseStaticHTML(html);

  // Apply CSS if provided
  if (cssPath) {
    const css = readFileSync(cssPath, 'utf-8');
    const rules = parseCSS(css);
    elements = applyStyles(elements, rules);
  }

  // Run audits
  const issues = runAudits(elements);

  // Build audit summary
  const totalElements = elements.length;
  const interactiveCount = elements.filter(e => e.interactive.hasOnClick || e.interactive.hasHref).length;
  const withHandlers = elements.filter(e => e.interactive.hasHandler).length;
  const withoutHandlers = interactiveCount - withHandlers;

  const auditIssues = issues.map(i => ({
    type: i.category.toUpperCase().replace(/\s+/g, '_'),
    severity: i.severity,
    message: i.description,
  }));

  // Determine verdict
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  const verdict = errors.length > 0 ? 'FAIL' : warnings.length > 0 ? 'ISSUES' : 'PASS';

  // Generate summary
  const summary = generateSummary(totalElements, interactiveCount, errors.length, warnings.length);

  return {
    htmlPath,
    cssPath,
    timestamp: new Date().toISOString(),
    elements: {
      all: elements,
      audit: {
        totalElements,
        interactiveCount,
        withHandlers,
        withoutHandlers,
        issues: auditIssues,
      },
    },
    verdict,
    issues,
    summary,
  };
}

/**
 * Run accessibility and structure audits
 */
function runAudits(elements: StaticElement[]): Array<{ category: string; severity: string; description: string; fix?: string }> {
  const issues: Array<{ category: string; severity: string; description: string; fix?: string }> = [];

  for (const element of elements) {
    // Check touch targets (mobile: 44px min)
    if (element.interactive.hasOnClick || element.interactive.hasHref) {
      const { width, height } = element.bounds;
      if (width > 0 && height > 0 && (width < 44 || height < 44)) {
        issues.push({
          category: 'Touch Target',
          severity: 'warning',
          description: `${element.selector} is ${width}x${height}px (min 44x44px for mobile)`,
          fix: `Set min-width: 44px; min-height: 44px;`,
        });
      }
    }

    // Check missing aria labels on interactive elements
    if ((element.interactive.hasOnClick || element.interactive.hasHref) && !element.a11y.ariaLabel && !element.text) {
      issues.push({
        category: 'Accessibility',
        severity: 'error',
        description: `${element.selector} has no accessible label (no aria-label or text content)`,
        fix: `Add aria-label="..." or text content`,
      });
    }

    // Check placeholder links (href="#")
    if (element.interactive.hasHref && element.tagName === 'a') {
      const href = element.computedStyles.href;
      if (href === '#' && !element.interactive.hasOnClick) {
        issues.push({
          category: 'Interactivity',
          severity: 'warning',
          description: `${element.selector} has href="#" without handler (placeholder link)`,
          fix: `Add onClick handler or use a real href`,
        });
      }
    }

    // Check disabled elements without visual indication
    if (element.interactive.isDisabled) {
      const opacity = element.computedStyles.opacity;
      const cursor = element.computedStyles.cursor;
      if (opacity !== '0.5' && cursor !== 'not-allowed') {
        issues.push({
          category: 'Visual Feedback',
          severity: 'info',
          description: `${element.selector} is disabled but has no visual indication`,
          fix: `Set opacity: 0.5; cursor: not-allowed;`,
        });
      }
    }

    // Check aria-hidden on interactive elements (anti-pattern)
    if (element.a11y.ariaHidden && (element.interactive.hasOnClick || element.interactive.hasHref)) {
      issues.push({
        category: 'Accessibility',
        severity: 'error',
        description: `${element.selector} is interactive but aria-hidden="true"`,
        fix: `Remove aria-hidden or remove interactivity`,
      });
    }
  }

  return issues;
}

/**
 * Generate human-readable summary
 */
function generateSummary(totalElements: number, interactiveCount: number, errors: number, warnings: number): string {
  const parts: string[] = [];

  parts.push(`Scanned ${totalElements} elements`);
  parts.push(`${interactiveCount} interactive`);

  if (errors > 0) {
    parts.push(`${errors} error${errors === 1 ? '' : 's'}`);
  }

  if (warnings > 0) {
    parts.push(`${warnings} warning${warnings === 1 ? '' : 's'}`);
  }

  if (errors === 0 && warnings === 0) {
    parts.push('no issues found');
  }

  return parts.join(', ') + '.';
}
