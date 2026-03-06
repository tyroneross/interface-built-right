import { join } from 'path';
import type { NativeScanOptions, NativeScanResult, MacOSScanOptions, MacOSScanResult } from './types.js';
import type { ScanIssue } from '../scan.js';
import { aggregateIssues, determineVerdict, generateSummary } from '../scan.js';
import { analyzeElements } from '../extract.js';
import { findDevice, getBootedDevices, bootDevice } from './simulator.js';
import { captureNativeScreenshot } from './capture.js';
import { getDeviceViewport } from './viewports.js';
import { extractNativeElements, mapToEnhancedElements, isExtractorAvailable } from './extract.js';
import { auditNativeElements } from './rules.js';
import { findProcess, extractMacOSElements, mapMacOSToEnhancedElements, captureMacOSScreenshot } from './macos.js';
import { buildNativeInteractivity } from './interactivity.js';
import { buildNativeSemantic } from './semantic.js';
import type { AuditResult, EnhancedElement } from '../schemas.js';

/**
 * Run a comprehensive native simulator scan
 *
 * Orchestrates: device resolution → boot → screenshot → element extraction → audit → verdict
 *
 * Falls back to screenshot-only mode if the Swift AXUIElement extractor is unavailable.
 */
export async function scanNative(options: NativeScanOptions = {}): Promise<NativeScanResult> {
  const { device: deviceQuery, screenshot = true, outputDir = '.ibr' } = options;

  // --- Resolve device ---
  let device;
  if (deviceQuery) {
    device = await findDevice(deviceQuery);
    if (!device) {
      throw new Error(
        `No simulator found matching "${deviceQuery}". ` +
        'Run `xcrun simctl list devices available` to see available simulators.'
      );
    }
  } else {
    // Use first booted device
    const booted = await getBootedDevices();
    if (booted.length === 0) {
      throw new Error(
        'No booted simulators found. Boot one with: xcrun simctl boot <device-name>'
      );
    }
    device = booted[0];
  }

  // --- Boot if needed ---
  if (device.state !== 'Booted') {
    await bootDevice(device.udid);
    // Refresh device state
    const refreshed = await findDevice(device.udid);
    if (refreshed) device = refreshed;
  }

  const viewport = getDeviceViewport(device);
  const url = `simulator://${device.name}/${options.bundleId || 'current'}`;

  // --- Capture screenshot ---
  let screenshotPath: string | undefined;
  if (screenshot) {
    const timestamp = Date.now();
    const ssPath = join(outputDir, 'native', `${device.udid.slice(0, 8)}-${timestamp}.png`);
    const captureResult = await captureNativeScreenshot({
      device,
      outputPath: ssPath,
    });
    if (captureResult.success) {
      screenshotPath = captureResult.outputPath;
    }
  }

  // --- Extract elements ---
  let elements: EnhancedElement[] = [];
  let audit: AuditResult = {
    totalElements: 0,
    interactiveCount: 0,
    withHandlers: 0,
    withoutHandlers: 0,
    issues: [],
  };
  let extractionSucceeded = false;

  if (isExtractorAvailable()) {
    try {
      const nativeElements = await extractNativeElements(device);
      elements = mapToEnhancedElements(nativeElements);
      audit = analyzeElements(elements, true); // Always treat as mobile-sized targets
      extractionSucceeded = true;
    } catch {
      // Graceful fallback to screenshot-only mode
    }
  }

  // --- Native audit rules ---
  const nativeIssues = extractionSucceeded
    ? auditNativeElements(elements, device.platform, viewport)
    : [];

  // --- Aggregate issues ---
  // Build ScanIssue array from audit issues and native-specific issues
  const issues: ScanIssue[] = [];

  // Standard audit issues
  for (const issue of audit.issues) {
    issues.push({
      category: issue.type === 'MISSING_ARIA_LABEL' ? 'accessibility' : 'interactivity',
      severity: issue.severity,
      description: issue.message,
    });
  }

  // Native-specific issues
  for (const issue of nativeIssues) {
    issues.push({
      category: issue.type === 'MISSING_ARIA_LABEL' ? 'accessibility' : 'structure',
      severity: issue.severity,
      description: issue.message,
    });
  }

  // --- Verdict ---
  const verdict = determineVerdict(issues);

  // --- Summary ---
  const summary = generateNativeSummary(device, elements, issues, extractionSucceeded);

  return {
    url,
    route: `/${device.name}`,
    timestamp: new Date().toISOString(),
    viewport,
    platform: device.platform,
    device: {
      name: device.name,
      udid: device.udid,
      runtime: device.runtime,
    },
    elements: { all: elements, audit },
    nativeIssues,
    screenshotPath,
    verdict,
    issues,
    summary,
  };
}

/**
 * Generate human-readable summary for native scan
 */
function generateNativeSummary(
  device: { name: string; platform: string },
  elements: EnhancedElement[],
  issues: ScanIssue[],
  extractionSucceeded: boolean
): string {
  const parts: string[] = [];

  parts.push(`${device.platform} simulator (${device.name})`);

  if (extractionSucceeded) {
    const interactive = elements.filter(e => e.interactive.hasOnClick).length;
    parts.push(`${elements.length} elements (${interactive} interactive)`);
  } else {
    parts.push('screenshot-only mode (element extraction unavailable)');
  }

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

// ============================================================================
// macOS Native App Scanning
// ============================================================================

/**
 * Run a comprehensive scan of a running macOS native app
 *
 * Uses the Accessibility API (AXUIElement) to extract the full view hierarchy,
 * then runs the same analysis pipeline as web scans.
 *
 * Produces a MacOSScanResult with the same shape as web ScanResult.
 */
export async function scanMacOS(options: MacOSScanOptions): Promise<MacOSScanResult> {
  if (process.platform !== 'darwin') {
    throw new Error('macOS native scanning is only available on macOS');
  }

  const { app, bundleId, pid: directPid, screenshot } = options;

  if (!app && !bundleId && !directPid) {
    throw new Error('Provide --app, --bundle-id, or --pid to identify the target app');
  }

  // --- Resolve PID ---
  let pid: number;
  if (directPid) {
    pid = directPid;
  } else {
    pid = await findProcess(app || bundleId!);
  }

  // --- Extract elements via Swift CLI ---
  const { elements: nativeElements, window } = await extractMacOSElements({
    pid,
    app: app || bundleId,
  });

  // --- Map to EnhancedElement[] ---
  const elements = mapMacOSToEnhancedElements(nativeElements);

  // --- Analyze elements (reuse from extract.ts) ---
  const audit = analyzeElements(elements, false); // desktop-sized targets

  // --- Build interactivity result from AX data ---
  const interactivity = buildNativeInteractivity(elements);

  // --- Build semantic result from element composition ---
  const semantic = buildNativeSemantic(elements, window);

  // --- Capture screenshot if requested ---
  if (screenshot && window.windowId > 0) {
    await captureMacOSScreenshot(window.windowId, screenshot.path);
  }

  // --- Build URL ---
  const url = `macos://${app || bundleId || `pid-${pid}`}/${window.title}`;
  const route = `/${window.title}`;

  // --- Aggregate issues (reuse from scan.ts) ---
  const issues = aggregateIssues(audit, interactivity, semantic, []);
  const verdict = determineVerdict(issues);

  // --- Generate summary (reuse from scan.ts) ---
  const summary = generateSummary(
    { all: elements, audit },
    interactivity,
    semantic,
    issues,
    []
  );

  // --- Build viewport from window dimensions ---
  const viewport = {
    name: 'native',
    width: window.width,
    height: window.height,
  };

  return {
    url,
    route,
    timestamp: new Date().toISOString(),
    viewport,
    elements: { all: elements, audit },
    interactivity,
    semantic,
    console: { errors: [], warnings: [] },
    verdict,
    issues,
    summary,
  };
}

/**
 * Format macOS scan result for console output
 */
export function formatMacOSScanResult(result: MacOSScanResult): string {
  const lines: string[] = [];

  const verdictIcon = result.verdict === 'PASS' ? '\x1b[32m✓\x1b[0m' :
                      result.verdict === 'ISSUES' ? '\x1b[33m!\x1b[0m' :
                      '\x1b[31m✗\x1b[0m';

  lines.push('═══════════════════════════════════════════════════════');
  lines.push('  IBR NATIVE macOS SCAN');
  lines.push('═══════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`  App:      ${result.url}`);
  lines.push(`  Window:   ${result.route.slice(1)}`);
  lines.push(`  Viewport: ${result.viewport.width}x${result.viewport.height}`);
  lines.push(`  Verdict:  ${verdictIcon} ${result.verdict}`);
  lines.push('');

  lines.push(`  ${result.summary}`);
  lines.push('');

  // Semantic
  lines.push('  PAGE UNDERSTANDING');
  lines.push('  ─────────────────');
  lines.push(`  Intent:   ${result.semantic.pageIntent.intent} (${Math.round(result.semantic.confidence * 100)}% confidence)`);
  lines.push(`  Auth:     ${result.semantic.state.auth.authenticated === false ? 'Not authenticated' : result.semantic.state.auth.authenticated ? 'Authenticated' : 'Unknown'}`);
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
  lines.push('');

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

/**
 * Format native scan result for console output
 */
export function formatNativeScanResult(result: NativeScanResult): string {
  const lines: string[] = [];

  const verdictIcon = result.verdict === 'PASS' ? '\x1b[32m✓\x1b[0m' :
                      result.verdict === 'ISSUES' ? '\x1b[33m!\x1b[0m' :
                      '\x1b[31m✗\x1b[0m';

  lines.push('═══════════════════════════════════════════════════════');
  lines.push('  IBR NATIVE SCAN');
  lines.push('═══════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`  Device:   ${result.device.name}`);
  lines.push(`  Platform: ${result.platform}`);
  lines.push(`  Runtime:  ${result.device.runtime.replace(/^.*SimRuntime\./, '').replace(/-/g, '.')}`);
  lines.push(`  Viewport: ${result.viewport.name} (${result.viewport.width}x${result.viewport.height})`);
  lines.push(`  Verdict:  ${verdictIcon} ${result.verdict}`);
  lines.push('');

  lines.push(`  ${result.summary}`);
  lines.push('');

  // Elements
  lines.push('  ELEMENTS');
  lines.push('  ────────');
  lines.push(`  Total:              ${result.elements.audit.totalElements}`);
  lines.push(`  Interactive:        ${result.elements.audit.interactiveCount}`);
  lines.push(`  With handlers:      ${result.elements.audit.withHandlers}`);
  lines.push(`  Without handlers:   ${result.elements.audit.withoutHandlers}`);
  lines.push('');

  // Screenshot
  if (result.screenshotPath) {
    lines.push(`  Screenshot: ${result.screenshotPath}`);
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
    }
  } else {
    lines.push('  No issues detected.');
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════');

  return lines.join('\n');
}
