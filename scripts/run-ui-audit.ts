#!/usr/bin/env npx tsx
/**
 * IBR UI Audit Runner
 *
 * Reusable script that systematically audits pages using IBR's scan engine.
 * Reads an audit manifest, runs scans + interaction checks, outputs structured results.
 *
 * Usage:
 *   npx tsx scripts/run-ui-audit.ts                          # Auto-discover routes
 *   npx tsx scripts/run-ui-audit.ts --manifest manifest.json # Use existing manifest
 *   npx tsx scripts/run-ui-audit.ts --url http://localhost:3000/dashboard  # Single page
 *   npx tsx scripts/run-ui-audit.ts --base-url http://localhost:3000       # Crawl from base
 *
 * Output:
 *   tools/ui-audit/audit-manifest.json   — Routes scanned
 *   tools/ui-audit/element-inventory.json — Interactive elements per page
 *   tools/ui-audit/audit-results.json    — Full scan results + verdicts
 */

import { scan, type ScanResult } from '../src/scan.js';
import { createSession, getSessionPaths } from '../src/session.js';
import { captureWithLandmarks } from '../src/capture.js';
import { VIEWPORTS } from '../src/schemas.js';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ManifestEntry {
  route: string;
  url: string;
  name: string;
  sessionId?: string;
  auth: boolean;
}

interface ElementEntry {
  route: string;
  selector: string;
  tagName: string;
  label: string;
  type: 'button' | 'link' | 'input' | 'form' | 'select' | 'other';
  hasHandler: boolean;
  isDisabled: boolean;
  bounds: { x: number; y: number; width: number; height: number };
  issues: string[];
}

interface PageAuditResult {
  route: string;
  url: string;
  scanResult: ScanResult;
  elementCount: number;
  interactiveCount: number;
  issueCount: number;
  errorCount: number;
  warningCount: number;
  consoleErrorCount: number;
  sessionId?: string;
}

interface AuditResults {
  timestamp: string;
  baseUrl: string;
  pages: PageAuditResult[];
  summary: {
    totalPages: number;
    totalElements: number;
    totalInteractive: number;
    totalIssues: number;
    totalErrors: number;
    totalWarnings: number;
    totalConsoleErrors: number;
    verdicts: Record<string, number>;
  };
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const OUTPUT_DIR = 'tools/ui-audit';
const IBR_DIR = '.ibr';
const VIEWPORT = VIEWPORTS.desktop;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(route: string): string {
  return route
    .replace(/^\/+/, '')
    .replace(/\/+/g, '-')
    .replace(/[^a-zA-Z0-9-_]/g, '')
    || 'root';
}

function classifyElement(tagName: string, el: { interactive?: { hasHref?: boolean } }): ElementEntry['type'] {
  const tag = tagName.toLowerCase();
  if (tag === 'button' || tag === 'input' && el.interactive?.hasHref === false) return 'button';
  if (tag === 'a') return 'link';
  if (tag === 'input' || tag === 'textarea') return 'input';
  if (tag === 'form') return 'form';
  if (tag === 'select') return 'select';
  return 'other';
}

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

async function captureBaseline(entry: ManifestEntry): Promise<string | undefined> {
  try {
    const session = await createSession(IBR_DIR, entry.url, entry.name, VIEWPORT);
    const paths = getSessionPaths(IBR_DIR, session.id);
    await captureWithLandmarks({
      url: entry.url,
      outputPath: paths.baseline,
      viewport: VIEWPORT,
      fullPage: true,
      waitForNetworkIdle: true,
      timeout: 30000,
    });
    return session.id;
  } catch (err) {
    console.warn(`  [warn] Baseline capture failed for ${entry.route}: ${err}`);
    return undefined;
  }
}

async function scanPage(entry: ManifestEntry): Promise<ScanResult> {
  return scan(entry.url, {
    viewport: VIEWPORT,
    timeout: 30000,
  });
}

function extractInventory(route: string, result: ScanResult): ElementEntry[] {
  const entries: ElementEntry[] = [];

  for (const el of result.elements.all) {
    const label =
      el.a11y?.ariaLabel ||
      el.selector ||
      el.tagName;

    entries.push({
      route,
      selector: el.selector,
      tagName: el.tagName,
      label,
      type: classifyElement(el.tagName, el),
      hasHandler: el.interactive?.hasOnClick ?? false,
      isDisabled: el.interactive?.isDisabled ?? false,
      bounds: el.bounds,
      issues: [],
    });
  }

  // Enrich with interactivity issues
  for (const issue of result.interactivity.issues) {
    const match = entries.find(e => e.selector === issue.element || e.label === issue.element);
    if (match) {
      match.issues.push(`${issue.type}: ${issue.description}`);
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);

  // Parse args
  let manifestPath: string | undefined;
  let singleUrl: string | undefined;
  let baseUrl: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--manifest' && args[i + 1]) {
      manifestPath = args[++i];
    } else if (args[i] === '--url' && args[i + 1]) {
      singleUrl = args[++i];
    } else if (args[i] === '--base-url' && args[i + 1]) {
      baseUrl = args[++i];
    }
  }

  await ensureDir(OUTPUT_DIR);

  // Build manifest
  let manifest: ManifestEntry[];

  if (manifestPath) {
    const raw = await readFile(manifestPath, 'utf-8');
    manifest = JSON.parse(raw);
    console.log(`Loaded ${manifest.length} routes from manifest`);
  } else if (singleUrl) {
    const route = new URL(singleUrl).pathname;
    manifest = [{
      route,
      url: singleUrl,
      name: slugify(route),
      auth: false,
    }];
  } else if (baseUrl) {
    // Auto-discover by crawling common routes
    const commonRoutes = ['/', '/dashboard', '/settings', '/login', '/signup', '/profile'];
    manifest = commonRoutes.map(route => ({
      route,
      url: `${baseUrl.replace(/\/$/, '')}${route}`,
      name: slugify(route),
      auth: false,
    }));
    console.log(`Auto-generated manifest with ${manifest.length} common routes`);
  } else {
    console.error('Usage: run-ui-audit.ts --manifest <path> | --url <url> | --base-url <url>');
    process.exit(1);
  }

  // Save manifest
  const manifestOut = join(OUTPUT_DIR, 'audit-manifest.json');
  await writeFile(manifestOut, JSON.stringify(manifest, null, 2));
  console.log(`Manifest: ${manifestOut}`);

  // Run audit
  const allInventory: ElementEntry[] = [];
  const pageResults: PageAuditResult[] = [];

  console.log(`\nAuditing ${manifest.length} pages...\n`);

  for (const entry of manifest) {
    const label = `${entry.name} (${entry.route})`;
    console.log(`── ${label}`);

    // 1. Capture baseline
    process.stdout.write('   Baseline... ');
    const sessionId = await captureBaseline(entry);
    entry.sessionId = sessionId;
    console.log(sessionId ? `${sessionId}` : 'skipped');

    // 2. Run scan
    process.stdout.write('   Scanning... ');
    let scanResult: ScanResult;
    try {
      scanResult = await scanPage(entry);
      console.log(`${scanResult.verdict} (${scanResult.issues.length} issues)`);
    } catch (err) {
      console.log(`FAILED: ${err}`);
      continue;
    }

    // 3. Extract inventory
    const inventory = extractInventory(entry.route, scanResult);
    allInventory.push(...inventory);

    // 4. Summarize
    const errorCount = scanResult.issues.filter(i => i.severity === 'error').length;
    const warningCount = scanResult.issues.filter(i => i.severity === 'warning').length;

    pageResults.push({
      route: entry.route,
      url: entry.url,
      scanResult,
      elementCount: scanResult.elements.audit.totalElements,
      interactiveCount: scanResult.elements.audit.interactiveCount,
      issueCount: scanResult.issues.length,
      errorCount,
      warningCount,
      consoleErrorCount: scanResult.console.errors.length,
      sessionId,
    });

    // Print quick summary
    console.log(`   Elements: ${scanResult.elements.audit.totalElements} total, ${scanResult.elements.audit.interactiveCount} interactive`);
    console.log(`   Buttons: ${scanResult.interactivity.buttons.length}, Links: ${scanResult.interactivity.links.length}, Forms: ${scanResult.interactivity.forms.length}`);
    console.log(`   Page type: ${scanResult.semantic.pageIntent.intent}`);
    if (errorCount > 0) console.log(`   Errors: ${errorCount}`);
    if (warningCount > 0) console.log(`   Warnings: ${warningCount}`);
    if (scanResult.console.errors.length > 0) console.log(`   Console errors: ${scanResult.console.errors.length}`);
    console.log('');
  }

  // Build aggregate results
  const results: AuditResults = {
    timestamp: new Date().toISOString(),
    baseUrl: baseUrl || singleUrl || manifest[0]?.url || '',
    pages: pageResults,
    summary: {
      totalPages: pageResults.length,
      totalElements: pageResults.reduce((s, p) => s + p.elementCount, 0),
      totalInteractive: pageResults.reduce((s, p) => s + p.interactiveCount, 0),
      totalIssues: pageResults.reduce((s, p) => s + p.issueCount, 0),
      totalErrors: pageResults.reduce((s, p) => s + p.errorCount, 0),
      totalWarnings: pageResults.reduce((s, p) => s + p.warningCount, 0),
      totalConsoleErrors: pageResults.reduce((s, p) => s + p.consoleErrorCount, 0),
      verdicts: pageResults.reduce((acc, p) => {
        acc[p.scanResult.verdict] = (acc[p.scanResult.verdict] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    },
  };

  // Write outputs
  const inventoryOut = join(OUTPUT_DIR, 'element-inventory.json');
  const resultsOut = join(OUTPUT_DIR, 'audit-results.json');

  await writeFile(inventoryOut, JSON.stringify(allInventory, null, 2));
  await writeFile(resultsOut, JSON.stringify(results, null, 2));

  // Update manifest with session IDs
  await writeFile(manifestOut, JSON.stringify(manifest, null, 2));

  // Print summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('  IBR UI AUDIT COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log(`  Pages:           ${results.summary.totalPages}`);
  console.log(`  Elements:        ${results.summary.totalElements}`);
  console.log(`  Interactive:     ${results.summary.totalInteractive}`);
  console.log(`  Issues:          ${results.summary.totalIssues}`);
  console.log(`  Errors:          ${results.summary.totalErrors}`);
  console.log(`  Warnings:        ${results.summary.totalWarnings}`);
  console.log(`  Console errors:  ${results.summary.totalConsoleErrors}`);
  console.log('');
  console.log('  Verdicts:');
  for (const [verdict, count] of Object.entries(results.summary.verdicts)) {
    const icon = verdict === 'PASS' ? '\x1b[32m✓\x1b[0m' :
                 verdict === 'ISSUES' ? '\x1b[33m!\x1b[0m' :
                 '\x1b[31m✗\x1b[0m';
    console.log(`    ${icon} ${verdict}: ${count}`);
  }
  console.log('');
  console.log('  Output files:');
  console.log(`    ${manifestOut}`);
  console.log(`    ${inventoryOut}`);
  console.log(`    ${resultsOut}`);
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
