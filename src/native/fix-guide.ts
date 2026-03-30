/**
 * Fix Guide Generator
 *
 * Takes scan results + source correlations and produces structured fix
 * instructions that Claude Code can act on.
 */

import type { NativeScanResult } from './types.js';
import type { BridgeResult, SourceCorrelation } from './bridge.js';

// =============================================================================
// TYPES
// =============================================================================

export interface FixableIssue {
  id: number;
  category: string;           // 'touch-target' | 'accessibility' | 'contrast'
  severity: 'error' | 'warning';
  what: string;
  where: {
    element: string;          // AX selector
    bounds: { x: number; y: number; width: number; height: number };
    screenRegion: string;     // "top-left" through "bottom-right" (3x3 grid)
  };
  current: string;
  required: string;
  source?: {
    file: string;
    line?: number;
    confidence: number;
    matchedOn: string;
    searchPattern: string;
  };
  suggestedFix: string;
}

export interface FixGuide {
  screenshot: string;
  screenshotRaw: string;
  issues: FixableIssue[];
  summary: string;
}

// =============================================================================
// SIMULATOR CHROME FILTER
// =============================================================================

const SIMULATOR_CHROME_PATTERNS = [
  'Save Screen', 'Rotate', 'Sheet Grabber', 'Home Indicator',
  'Status Bar', 'Side Button', 'Volume', 'Mute Switch',
];

function isSimulatorChrome(selector: string, label: string): boolean {
  const text = `${selector} ${label}`.toLowerCase();
  return SIMULATOR_CHROME_PATTERNS.some(p => text.includes(p.toLowerCase()));
}

// =============================================================================
// SCREEN REGION
// =============================================================================

function computeScreenRegion(
  bounds: { x: number; y: number; width: number; height: number },
  viewport: { width: number; height: number }
): string {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;

  const col = cx < viewport.width / 3 ? 'left'
    : cx < (viewport.width * 2) / 3 ? 'center'
    : 'right';

  const row = cy < viewport.height / 3 ? 'top'
    : cy < (viewport.height * 2) / 3 ? 'middle'
    : 'bottom';

  return `${row}-${col}`;
}

// =============================================================================
// SUGGESTED FIXES
// =============================================================================

function buildSuggestedFix(issueType: string, elementLabel: string): string {
  switch (issueType) {
    case 'TOUCH_TARGET_SMALL':
      return '.frame(minWidth: 44, minHeight: 44) or wrap in a larger tap area with .contentShape(Rectangle())';
    case 'MISSING_ARIA_LABEL': {
      const desc = elementLabel && elementLabel.length > 0 ? elementLabel : 'descriptive text';
      return `Add .accessibilityLabel("${desc}")`;
    }
    case 'NO_HANDLER':
      return 'Add tap action or remove interactive appearance';
    case 'PLACEHOLDER_LINK':
      return 'Replace href="#" with a real destination or add an onTapGesture handler';
    case 'DISABLED_NO_VISUAL':
      return 'Add .opacity(0.5) or .foregroundColor(.gray) to visually indicate disabled state';
    default:
      return 'Review and fix accessibility issue';
  }
}

function issueTypeToCategory(issueType: string): string {
  if (issueType === 'TOUCH_TARGET_SMALL') return 'touch-target';
  if (issueType === 'MISSING_ARIA_LABEL' || issueType === 'DISABLED_NO_VISUAL') return 'accessibility';
  if (issueType === 'NO_HANDLER' || issueType === 'PLACEHOLDER_LINK') return 'accessibility';
  return 'accessibility';
}

function buildSearchPattern(
  correlation: SourceCorrelation | undefined,
  elementSelector: string,
  elementLabel: string
): string {
  if (!correlation) {
    if (elementLabel) {
      const escaped = elementLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return `Button.*${escaped}|Text.*${escaped}`;
    }
    return elementSelector;
  }

  switch (correlation.matchType) {
    case 'identifier':
      return correlation.elementSelector;
    case 'label':
      return `.accessibilityLabel("${correlation.elementLabel}")`;
    case 'view-name':
      return `struct ${correlation.viewName}: View`;
    case 'text': {
      const label = correlation.elementLabel || elementLabel;
      if (label) {
        const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return `Button.*${escaped}|Image.*${escaped}`;
      }
      return elementSelector;
    }
    default:
      return elementSelector;
  }
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

export function generateFixGuide(
  scanResult: NativeScanResult,
  bridgeResult: BridgeResult | null,
  annotatedScreenshot: string | null
): FixGuide {
  const viewport = scanResult.viewport;

  // Build a lookup: elementSelector → SourceCorrelation
  const correlationMap = new Map<string, SourceCorrelation>();
  if (bridgeResult) {
    for (const c of bridgeResult.correlations) {
      correlationMap.set(c.elementSelector.toLowerCase(), c);
      if (c.elementLabel) {
        correlationMap.set(c.elementLabel.toLowerCase(), c);
      }
    }
  }

  // Build a lookup: element selector → EnhancedElement bounds
  const boundsMap = new Map<string, { x: number; y: number; width: number; height: number }>();
  for (const el of scanResult.elements.all) {
    if (el.selector) {
      boundsMap.set(el.selector.toLowerCase(), {
        x: el.bounds.x,
        y: el.bounds.y,
        width: el.bounds.width,
        height: el.bounds.height,
      });
    }
  }

  const fixableIssues: FixableIssue[] = [];
  let idCounter = 1;

  // Process nativeIssues (ElementIssue[]) — these have type + severity + message
  // nativeIssues don't carry an element reference directly; correlate via message text
  for (const issue of scanResult.nativeIssues) {
    // Extract element hint from message (e.g. "Button 'Play'")
    const labelMatch = issue.message.match(/['"]([^'"]+)['"]/);
    const elementLabel = labelMatch ? labelMatch[1] : '';
    const elementSelector = elementLabel || issue.type;

    if (isSimulatorChrome(elementSelector, elementLabel)) continue;

    const bounds = boundsMap.get(elementLabel.toLowerCase()) ?? { x: 0, y: 0, width: 0, height: 0 };
    const region = computeScreenRegion(bounds, viewport);
    const correlation = correlationMap.get(elementLabel.toLowerCase())
      ?? correlationMap.get(elementSelector.toLowerCase());

    const category = issueTypeToCategory(issue.type);
    const severity = issue.severity === 'info' ? 'warning' : issue.severity;

    fixableIssues.push({
      id: idCounter++,
      category,
      severity,
      what: issue.message,
      where: { element: elementSelector, bounds, screenRegion: region },
      current: issue.message,
      required: buildSuggestedFix(issue.type, elementLabel),
      source: correlation ? {
        file: correlation.sourceFile,
        line: correlation.sourceLine,
        confidence: correlation.confidence,
        matchedOn: correlation.matchType,
        searchPattern: buildSearchPattern(correlation, elementSelector, elementLabel),
      } : undefined,
      suggestedFix: buildSuggestedFix(issue.type, elementLabel),
    });
  }

  // Process ScanIssues — these have category + element + description + fix
  for (const issue of scanResult.issues) {
    const elementSelector = issue.element ?? '';
    const elementLabel = elementSelector;

    if (isSimulatorChrome(elementSelector, '')) continue;
    if (issue.severity === 'info') continue;

    const bounds = boundsMap.get(elementSelector.toLowerCase()) ?? { x: 0, y: 0, width: 0, height: 0 };
    const region = computeScreenRegion(bounds, viewport);
    const correlation = correlationMap.get(elementSelector.toLowerCase());

    const category = issue.category === 'interactivity' ? 'accessibility' : issue.category;

    fixableIssues.push({
      id: idCounter++,
      category,
      severity: issue.severity,
      what: issue.description,
      where: { element: elementSelector, bounds, screenRegion: region },
      current: issue.description,
      required: issue.fix ?? 'Fix the reported issue',
      source: correlation ? {
        file: correlation.sourceFile,
        line: correlation.sourceLine,
        confidence: correlation.confidence,
        matchedOn: correlation.matchType,
        searchPattern: buildSearchPattern(correlation, elementSelector, elementLabel),
      } : undefined,
      suggestedFix: issue.fix ?? 'Review and fix the reported issue',
    });
  }

  // Build summary
  const uniqueFiles = new Set(
    fixableIssues.filter(i => i.source).map(i => i.source!.file)
  );
  const fileCount = uniqueFiles.size;
  const issueCount = fixableIssues.length;
  const summary = issueCount === 0
    ? 'No issues found'
    : `${issueCount} issue${issueCount !== 1 ? 's' : ''} in ${fileCount} file${fileCount !== 1 ? 's' : ''}`;

  return {
    screenshot: annotatedScreenshot ?? scanResult.screenshotPath ?? '',
    screenshotRaw: scanResult.screenshotPath ?? '',
    issues: fixableIssues,
    summary,
  };
}
