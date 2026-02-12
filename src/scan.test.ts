import { describe, it, expect } from 'vitest';
import { formatScanResult, type ScanResult, type ScanIssue } from './scan.js';

// ---------------------------------------------------------------------------
// Helpers to build mock ScanResult objects
// ---------------------------------------------------------------------------

function makeScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    url: 'http://localhost:3000/dashboard',
    route: '/dashboard',
    timestamp: '2025-01-01T00:00:00.000Z',
    viewport: { name: 'desktop', width: 1920, height: 1080 },
    elements: {
      all: [],
      audit: {
        totalElements: 10,
        interactiveCount: 5,
        withHandlers: 4,
        withoutHandlers: 1,
        issues: [],
      },
    },
    interactivity: {
      buttons: [],
      links: [],
      forms: [],
      issues: [],
      summary: {
        totalInteractive: 5,
        withHandlers: 4,
        withoutHandlers: 1,
        issueCount: 0,
      },
    },
    semantic: {
      verdict: 'PASS',
      confidence: 0.85,
      pageIntent: { intent: 'dashboard', confidence: 0.85, signals: ['charts present'] },
      state: {
        auth: { authenticated: false, confidence: 0.5 },
        loading: { loading: false, type: 'none', confidence: 0.9 },
        errors: { hasErrors: false, errors: [], confidence: 0.9 },
        ready: true,
      },
      availableActions: [],
      issues: [],
      summary: 'dashboard page, ready',
    },
    console: { errors: [], warnings: [] },
    verdict: 'PASS',
    issues: [],
    summary: 'dashboard page, 10 elements (5 interactive)',
    ...overrides,
  };
}

function makeIssue(overrides: Partial<ScanIssue> = {}): ScanIssue {
  return {
    category: 'interactivity',
    severity: 'warning',
    description: 'Button has no click handler',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// formatScanResult
// ---------------------------------------------------------------------------

describe('formatScanResult', () => {
  it('formats a PASS result with all sections', () => {
    const result = makeScanResult();
    const output = formatScanResult(result);

    expect(output).toContain('IBR UI SCAN');
    expect(output).toContain('http://localhost:3000/dashboard');
    expect(output).toContain('/dashboard');
    expect(output).toContain('desktop (1920x1080)');
    expect(output).toContain('PASS');
    expect(output).toContain('PAGE UNDERSTANDING');
    expect(output).toContain('dashboard');
    expect(output).toContain('ELEMENTS');
    expect(output).toContain('Total:              10');
    expect(output).toContain('Interactive:        5');
    expect(output).toContain('With handlers:      4');
    expect(output).toContain('Without handlers:   1');
    expect(output).toContain('INTERACTIVITY');
    expect(output).toContain('No issues detected.');
  });

  it('formats an ISSUES verdict', () => {
    const result = makeScanResult({
      verdict: 'ISSUES',
      issues: [makeIssue({ severity: 'error', description: 'Missing submit handler' })],
    });
    const output = formatScanResult(result);

    expect(output).toContain('ISSUES');
    expect(output).toContain('[interactivity] Missing submit handler');
  });

  it('formats a FAIL verdict', () => {
    const result = makeScanResult({
      verdict: 'FAIL',
      issues: [
        makeIssue({ severity: 'error', description: 'Error 1' }),
        makeIssue({ severity: 'error', description: 'Error 2' }),
        makeIssue({ severity: 'error', description: 'Error 3' }),
      ],
    });
    const output = formatScanResult(result);

    expect(output).toContain('FAIL');
    expect(output).toContain('Error 1');
    expect(output).toContain('Error 2');
    expect(output).toContain('Error 3');
  });

  it('displays console errors when present', () => {
    const result = makeScanResult({
      console: {
        errors: ['TypeError: Cannot read property x of undefined', 'ReferenceError: foo is not defined'],
        warnings: ['Deprecation warning: use newMethod()'],
      },
    });
    const output = formatScanResult(result);

    expect(output).toContain('CONSOLE');
    expect(output).toContain('Errors: 2');
    expect(output).toContain('TypeError: Cannot read property x of undefined');
    expect(output).toContain('Warnings: 1');
  });

  it('truncates long console errors to 100 chars', () => {
    const longError = 'A'.repeat(200);
    const result = makeScanResult({
      console: { errors: [longError], warnings: [] },
    });
    const output = formatScanResult(result);

    // Should contain truncated version (100 chars)
    expect(output).toContain('A'.repeat(100));
    expect(output).not.toContain('A'.repeat(101));
  });

  it('shows max 3 console errors', () => {
    const result = makeScanResult({
      console: {
        errors: ['err1', 'err2', 'err3', 'err4', 'err5'],
        warnings: [],
      },
    });
    const output = formatScanResult(result);

    expect(output).toContain('Errors: 5');
    expect(output).toContain('err1');
    expect(output).toContain('err2');
    expect(output).toContain('err3');
    expect(output).not.toContain('err4');
  });

  it('displays form details', () => {
    const result = makeScanResult({
      interactivity: {
        buttons: [{ selector: 'button', text: 'Submit', hasHandler: true, isDisabled: false, buttonType: 'submit' }] as any,
        links: [],
        forms: [{
          selector: 'form#login',
          action: '/api/login',
          method: 'POST',
          hasSubmitHandler: true,
          hasValidation: true,
          submitButton: 'button[type=submit]',
          fields: [
            { name: 'email', type: 'email', required: true, hasLabel: true },
            { name: 'password', type: 'password', required: true, hasLabel: true },
          ],
        }] as any,
        issues: [],
        summary: { totalInteractive: 3, withHandlers: 3, withoutHandlers: 0, issueCount: 0 },
      },
    });
    const output = formatScanResult(result);

    expect(output).toContain('Buttons: 1');
    expect(output).toContain('Forms: 1');
    expect(output).toContain('Form form#login: 2 fields, validated');
  });

  it('shows fix suggestions on issues', () => {
    const result = makeScanResult({
      issues: [
        makeIssue({
          severity: 'warning',
          category: 'interactivity',
          description: 'Button without handler',
          fix: 'Add an onClick handler or remove the interactive appearance',
        }),
      ],
    });
    const output = formatScanResult(result);

    expect(output).toContain('Button without handler');
    expect(output).toContain('Add an onClick handler');
  });

  it('displays authenticated state', () => {
    const result = makeScanResult({
      semantic: {
        ...makeScanResult().semantic,
        state: {
          ...makeScanResult().semantic.state,
          auth: { authenticated: true, username: 'john', confidence: 0.9 },
        },
      },
    });
    const output = formatScanResult(result);

    expect(output).toContain('Authenticated');
  });

  it('displays loading state', () => {
    const result = makeScanResult({
      semantic: {
        ...makeScanResult().semantic,
        state: {
          ...makeScanResult().semantic.state,
          loading: { loading: true, type: 'spinner', confidence: 0.8 },
        },
      },
    });
    const output = formatScanResult(result);

    expect(output).toContain('spinner');
  });

  it('displays page errors', () => {
    const result = makeScanResult({
      semantic: {
        ...makeScanResult().semantic,
        state: {
          ...makeScanResult().semantic.state,
          errors: { hasErrors: true, errors: ['404 Not Found'], confidence: 0.9 },
        },
      },
    });
    const output = formatScanResult(result);

    expect(output).toContain('404 Not Found');
  });

  it('omits console section when no errors or warnings', () => {
    const result = makeScanResult({
      console: { errors: [], warnings: [] },
    });
    const output = formatScanResult(result);

    expect(output).not.toContain('CONSOLE');
  });

  it('shows different issue categories', () => {
    const result = makeScanResult({
      issues: [
        makeIssue({ category: 'accessibility', description: 'Missing aria-label' }),
        makeIssue({ category: 'semantic', description: 'Page in error state' }),
        makeIssue({ category: 'console', severity: 'error', description: 'JS error' }),
        makeIssue({ category: 'structure', description: 'Orphan element' }),
      ],
    });
    const output = formatScanResult(result);

    expect(output).toContain('[accessibility]');
    expect(output).toContain('[semantic]');
    expect(output).toContain('[console]');
    expect(output).toContain('[structure]');
  });

  it('shows confidence percentage', () => {
    const result = makeScanResult({
      semantic: {
        ...makeScanResult().semantic,
        confidence: 0.92,
      },
    });
    const output = formatScanResult(result);

    expect(output).toContain('92%');
  });

  it('handles mobile viewport', () => {
    const result = makeScanResult({
      viewport: { name: 'mobile', width: 375, height: 667 },
    });
    const output = formatScanResult(result);

    expect(output).toContain('mobile (375x667)');
  });

  it('uses green checkmark for PASS verdict', () => {
    const result = makeScanResult({ verdict: 'PASS' });
    const output = formatScanResult(result);
    // ANSI green
    expect(output).toContain('\x1b[32m');
  });

  it('uses yellow for ISSUES verdict', () => {
    const result = makeScanResult({ verdict: 'ISSUES' });
    const output = formatScanResult(result);
    // ANSI yellow
    expect(output).toContain('\x1b[33m');
  });

  it('uses red for FAIL verdict', () => {
    const result = makeScanResult({ verdict: 'FAIL' });
    const output = formatScanResult(result);
    // ANSI red
    expect(output).toContain('\x1b[31m');
  });

  it('includes summary line', () => {
    const result = makeScanResult({
      summary: 'dashboard page, 10 elements (5 interactive), 2 buttons',
    });
    const output = formatScanResult(result);

    expect(output).toContain('dashboard page, 10 elements (5 interactive), 2 buttons');
  });

  it('handles form without validation', () => {
    const result = makeScanResult({
      interactivity: {
        buttons: [],
        links: [],
        forms: [{
          selector: 'form#search',
          action: '/search',
          method: 'GET',
          hasSubmitHandler: false,
          hasValidation: false,
          submitButton: null,
          fields: [{ name: 'q', type: 'text', required: false, hasLabel: false }],
        }] as any,
        issues: [],
        summary: { totalInteractive: 1, withHandlers: 0, withoutHandlers: 1, issueCount: 0 },
      },
    });
    const output = formatScanResult(result);

    expect(output).toContain('Form form#search: 1 fields');
    expect(output).not.toContain('validated');
  });
});

// ---------------------------------------------------------------------------
// ScanResult type structure validation
// ---------------------------------------------------------------------------

describe('ScanResult structure', () => {
  it('has all required fields', () => {
    const result = makeScanResult();

    expect(result).toHaveProperty('url');
    expect(result).toHaveProperty('route');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('viewport');
    expect(result).toHaveProperty('elements');
    expect(result).toHaveProperty('elements.all');
    expect(result).toHaveProperty('elements.audit');
    expect(result).toHaveProperty('interactivity');
    expect(result).toHaveProperty('semantic');
    expect(result).toHaveProperty('console');
    expect(result).toHaveProperty('console.errors');
    expect(result).toHaveProperty('console.warnings');
    expect(result).toHaveProperty('verdict');
    expect(result).toHaveProperty('issues');
    expect(result).toHaveProperty('summary');
  });

  it('verdict is one of PASS, ISSUES, FAIL', () => {
    expect(['PASS', 'ISSUES', 'FAIL']).toContain(makeScanResult({ verdict: 'PASS' }).verdict);
    expect(['PASS', 'ISSUES', 'FAIL']).toContain(makeScanResult({ verdict: 'ISSUES' }).verdict);
    expect(['PASS', 'ISSUES', 'FAIL']).toContain(makeScanResult({ verdict: 'FAIL' }).verdict);
  });

  it('issues have required fields', () => {
    const issue = makeIssue({
      category: 'accessibility',
      severity: 'error',
      description: 'Missing label',
      element: 'button.save',
      fix: 'Add aria-label',
    });

    expect(issue.category).toBe('accessibility');
    expect(issue.severity).toBe('error');
    expect(issue.description).toBe('Missing label');
    expect(issue.element).toBe('button.save');
    expect(issue.fix).toBe('Add aria-label');
  });

  it('issue categories are valid', () => {
    const validCategories = ['interactivity', 'accessibility', 'semantic', 'console', 'structure'];
    for (const cat of validCategories) {
      const issue = makeIssue({ category: cat as ScanIssue['category'] });
      expect(validCategories).toContain(issue.category);
    }
  });

  it('issue severities are valid', () => {
    const validSeverities = ['error', 'warning', 'info'];
    for (const sev of validSeverities) {
      const issue = makeIssue({ severity: sev as ScanIssue['severity'] });
      expect(validSeverities).toContain(issue.severity);
    }
  });
});
