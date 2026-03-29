/**
 * Design Verifier — verify structured UI change descriptions against live pages.
 *
 * Write-time capture (~95% accuracy) is preferred over NLP parsing (~60-85%).
 * Changes are stored in .ibr/design-changes.json (append-based).
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { BrowserDriver } from './engine/types.js';
import type { DesignChange, DesignCheck, DesignCheckOperator } from './context/types.js';

// ─── Result types ────────────────────────────────────────────

export interface CheckResult {
  property: string;
  expected: string | number;
  actual: string | number | null;
  passed: boolean;
  confidence: number;
  detail: string;
}

export interface VerifyResult {
  change: DesignChange;
  results: CheckResult[];
  overallPassed: boolean;
  summary: string; // e.g. "Verified 3/5 properties, 1 ambiguous, 1 skipped"
}

export interface ReconciliationRow {
  property: string;
  expected: string | number;
  platforms: Record<string, { actual: string | number | null; passed: boolean }>;
}

export interface ReconciliationMatrix {
  spec: string;
  rows: ReconciliationRow[];
  summary: string;
}

// ─── Comparison helpers ──────────────────────────────────────

function applyOperator(
  actual: string | number | null,
  operator: DesignCheckOperator,
  expected: string | number,
): { passed: boolean; detail: string } {
  if (actual === null) {
    if (operator === 'exists' || operator === 'truthy') {
      return { passed: false, detail: 'element not found' };
    }
    return { passed: false, detail: 'could not read property (element or value not found)' };
  }

  const actualStr = String(actual).trim();
  const expectedStr = String(expected).trim();

  switch (operator) {
    case 'eq':
      return {
        passed: actualStr === expectedStr,
        detail: actualStr === expectedStr
          ? `"${actualStr}" equals "${expectedStr}"`
          : `"${actualStr}" !== "${expectedStr}"`,
      };

    case 'contains':
      return {
        passed: actualStr.toLowerCase().includes(expectedStr.toLowerCase()),
        detail: actualStr.toLowerCase().includes(expectedStr.toLowerCase())
          ? `"${actualStr}" contains "${expectedStr}"`
          : `"${actualStr}" does not contain "${expectedStr}"`,
      };

    case 'not':
      return {
        passed: actualStr !== expectedStr,
        detail: actualStr !== expectedStr
          ? `"${actualStr}" is not "${expectedStr}"`
          : `"${actualStr}" equals "${expectedStr}" (expected not to)`,
      };

    case 'gt': {
      const a = parseFloat(actualStr);
      const e = parseFloat(expectedStr);
      if (isNaN(a) || isNaN(e)) {
        return { passed: false, detail: `cannot compare non-numeric values: "${actualStr}" > "${expectedStr}"` };
      }
      return {
        passed: a > e,
        detail: a > e ? `${a} > ${e}` : `${a} is not > ${e}`,
      };
    }

    case 'lt': {
      const a = parseFloat(actualStr);
      const e = parseFloat(expectedStr);
      if (isNaN(a) || isNaN(e)) {
        return { passed: false, detail: `cannot compare non-numeric values: "${actualStr}" < "${expectedStr}"` };
      }
      return {
        passed: a < e,
        detail: a < e ? `${a} < ${e}` : `${a} is not < ${e}`,
      };
    }

    case 'exists':
      // actual being non-null means element was found
      return { passed: true, detail: 'element exists in AX tree' };

    case 'truthy': {
      const isTruthy = actualStr !== '' && actualStr !== '0' && actualStr !== 'none' && actualStr !== 'false';
      return {
        passed: isTruthy,
        detail: isTruthy ? `"${actualStr}" is truthy` : `"${actualStr}" is falsy`,
      };
    }

    default:
      return { passed: false, detail: `unknown operator: ${operator as string}` };
  }
}

// ─── CSS property fetcher ────────────────────────────────────

async function getComputedProperty(
  driver: BrowserDriver,
  elementQuery: string,
  property: string,
): Promise<string | null> {
  try {
    // Try to find the element by accessible name first (AX tree lookup)
    // If the query looks like a CSS selector (starts with . # [ or tag), use querySelector
    const isSelector = /^[.#\[a-z]/i.test(elementQuery) && !/\s/.test(elementQuery.slice(1));

    let jsExpression: string;
    if (isSelector) {
      jsExpression = `
        (function() {
          const el = document.querySelector(${JSON.stringify(elementQuery)});
          if (!el) return null;
          return getComputedStyle(el)[${JSON.stringify(property)}] || null;
        })()
      `;
    } else {
      // Try to find by aria-label or text content
      jsExpression = `
        (function() {
          // Try aria-label match
          const byAria = document.querySelector('[aria-label=${JSON.stringify(elementQuery)}]');
          if (byAria) return getComputedStyle(byAria)[${JSON.stringify(property)}] || null;
          // Try text content match (first element with matching text)
          const all = document.querySelectorAll('*');
          for (const el of all) {
            if (el.children.length === 0 && el.textContent && el.textContent.trim() === ${JSON.stringify(elementQuery)}) {
              return getComputedStyle(el)[${JSON.stringify(property)}] || null;
            }
          }
          return null;
        })()
      `;
    }

    const result = await driver.evaluate(jsExpression);
    return result === null || result === undefined ? null : String(result);
  } catch {
    return null;
  }
}

// ─── Semantic check (exists / truthy via AX tree) ────────────

async function checkSemanticProperty(
  driver: BrowserDriver,
  elementQuery: string,
  property: string,
): Promise<string | null> {
  // For 'exists'/'truthy', check AX tree first
  const element = await driver.find(elementQuery);
  if (!element) return null;

  // Map semantic property names to element fields
  switch (property) {
    case 'visible':
    case 'exists':
      return 'true';
    case 'role':
      return element.role ?? null;
    case 'label':
    case 'name':
      return element.label ?? null;
    case 'value':
      return element.value !== undefined ? String(element.value) : null;
    default:
      // Fall through to CSS property lookup for any unknown semantic property
      return null;
  }
}

// ─── Core verification ───────────────────────────────────────

/**
 * Verify a single design change against the live page.
 */
export async function verifyChange(
  change: DesignChange,
  driver: BrowserDriver,
): Promise<VerifyResult> {
  const results: CheckResult[] = [];

  for (const check of change.checks) {
    const result = await verifyCheck(driver, change.element, check);
    results.push(result);
  }

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const ambiguous = results.filter((r) => !r.passed && r.actual === null).length;
  const failed = results.filter((r) => !r.passed && r.actual !== null).length;

  const overallPassed = passed === total;

  const parts: string[] = [`Verified ${passed}/${total} properties`];
  if (ambiguous > 0) parts.push(`${ambiguous} ambiguous`);
  if (failed > 0) parts.push(`${failed} failed`);

  return {
    change,
    results,
    overallPassed,
    summary: parts.join(', '),
  };
}

async function verifyCheck(
  driver: BrowserDriver,
  elementQuery: string,
  check: DesignCheck,
): Promise<CheckResult> {
  const { property, operator, value, confidence } = check;

  // For exists/truthy operators, use AX tree
  let actual: string | number | null = null;

  if (operator === 'exists' || operator === 'truthy' || property === 'role' || property === 'label' || property === 'name') {
    actual = await checkSemanticProperty(driver, elementQuery, property);
  }

  // Fallback: try CSS getComputedStyle
  if (actual === null && operator !== 'exists') {
    actual = await getComputedProperty(driver, elementQuery, property);
  }

  const { passed, detail } = applyOperator(actual, operator, value);

  return {
    property,
    expected: value,
    actual,
    passed,
    confidence,
    detail,
  };
}

/**
 * Verify all recorded design changes against the live page.
 */
export async function verifyAllChanges(
  changes: DesignChange[],
  driver: BrowserDriver,
): Promise<VerifyResult[]> {
  const results: VerifyResult[] = [];
  for (const change of changes) {
    results.push(await verifyChange(change, driver));
  }
  return results;
}

// ─── Cross-platform reconciliation ──────────────────────────

/**
 * Build a reconciliation matrix from results collected across platforms.
 */
export function buildReconciliationMatrix(
  spec: string,
  platformResults: Record<string, VerifyResult[]>,
): ReconciliationMatrix {
  // Collect all unique property+element combinations across all platforms
  const rowMap = new Map<string, ReconciliationRow>();

  for (const [platform, verifyResults] of Object.entries(platformResults)) {
    for (const vr of verifyResults) {
      for (const checkResult of vr.results) {
        const key = `${vr.change.element}::${checkResult.property}`;
        if (!rowMap.has(key)) {
          rowMap.set(key, {
            property: `${vr.change.element} — ${checkResult.property}`,
            expected: checkResult.expected,
            platforms: {},
          });
        }
        const row = rowMap.get(key)!;
        row.platforms[platform] = {
          actual: checkResult.actual,
          passed: checkResult.passed,
        };
      }
    }
  }

  const rows = Array.from(rowMap.values());
  const platformNames = Object.keys(platformResults);

  let allPass = 0;
  let anyFail = 0;
  for (const row of rows) {
    const platformStatuses = platformNames.map((p) => row.platforms[p]?.passed ?? null);
    const hasFail = platformStatuses.some((s) => s === false);
    if (hasFail) anyFail++;
    else allPass++;
  }

  return {
    spec,
    rows,
    summary: `${allPass} properties pass on all platforms, ${anyFail} have platform-specific failures`,
  };
}

// ─── Formatters ──────────────────────────────────────────────

/**
 * Format a single VerifyResult as human-readable text.
 */
export function formatVerifyResult(result: VerifyResult): string {
  const lines: string[] = [];
  const status = result.overallPassed ? 'PASS' : 'FAIL';
  lines.push(`[${status}] ${result.change.description}`);
  lines.push(`  Element: ${result.change.element}`);
  lines.push(`  ${result.summary}`);

  for (const r of result.results) {
    const icon = r.passed ? 'ok' : 'fail';
    const conf = `(confidence: ${(r.confidence * 100).toFixed(0)}%)`;
    lines.push(`    [${icon}] ${r.property}: ${r.detail} ${conf}`);
  }

  return lines.join('\n');
}

/**
 * Format a ReconciliationMatrix as a readable table.
 */
export function formatReconciliationMatrix(matrix: ReconciliationMatrix): string {
  const lines: string[] = [];
  lines.push(`Reconciliation: ${matrix.spec}`);
  lines.push(matrix.summary);
  lines.push('');

  if (matrix.rows.length === 0) {
    lines.push('  No properties to compare.');
    return lines.join('\n');
  }

  // Collect platform names
  const allPlatforms = Array.from(
    new Set(matrix.rows.flatMap((r) => Object.keys(r.platforms))),
  );

  // Header
  const colWidth = 30;
  const platWidth = 20;
  const header = 'Property'.padEnd(colWidth) + allPlatforms.map((p) => p.padEnd(platWidth)).join('');
  lines.push(header);
  lines.push('-'.repeat(colWidth + allPlatforms.length * platWidth));

  for (const row of matrix.rows) {
    const label = row.property.slice(0, colWidth - 1).padEnd(colWidth);
    const platformCols = allPlatforms.map((p) => {
      const cell = row.platforms[p];
      if (!cell) return 'n/a'.padEnd(platWidth);
      const icon = cell.passed ? 'ok' : 'fail';
      const val = cell.actual !== null ? String(cell.actual).slice(0, 12) : '(null)';
      return `[${icon}] ${val}`.padEnd(platWidth);
    });
    lines.push(label + platformCols.join(''));
  }

  return lines.join('\n');
}

// ─── Storage ─────────────────────────────────────────────────

const CHANGES_FILE = 'design-changes.json';

/**
 * Load all recorded design changes from .ibr/design-changes.json.
 */
export async function loadChanges(outputDir: string): Promise<DesignChange[]> {
  const filePath = join(outputDir, CHANGES_FILE);
  if (!existsSync(filePath)) return [];

  try {
    const raw = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as DesignChange[];
  } catch {
    return [];
  }
}

/**
 * Append a design change to .ibr/design-changes.json.
 */
export async function saveChange(outputDir: string, change: DesignChange): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  const existing = await loadChanges(outputDir);
  existing.push(change);
  const filePath = join(outputDir, CHANGES_FILE);
  await writeFile(filePath, JSON.stringify(existing, null, 2), 'utf-8');
}
