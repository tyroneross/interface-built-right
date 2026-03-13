/**
 * IBR↔NavGator Bridge
 *
 * Correlates runtime AX elements (from IBR native scan) with source code
 * locations (from NavGator architecture data or direct Swift file scanning).
 *
 * Independence model:
 * - If NavGator data exists at .navgator/architecture/, uses file_map.json
 *   to locate Swift files and component data for enrichment.
 * - If NavGator data is absent, falls back to globbing .swift files
 *   from the project root.
 * - IBR works standalone; bridge gracefully degrades without NavGator.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import type { EnhancedElement } from '../schemas.js';

// =============================================================================
// TYPES
// =============================================================================

export interface SourceCorrelation {
  /** Element selector or identifier from AX tree */
  elementSelector: string;
  /** Element label/text for display */
  elementLabel: string;
  /** Matched Swift source file (relative to project root) */
  sourceFile: string;
  /** Line number in source */
  sourceLine: number;
  /** View struct name if identified */
  viewName: string | null;
  /** Matched modifier/declaration text */
  matchedSnippet: string;
  /** Match strategy used */
  matchType: 'identifier' | 'label' | 'text' | 'view-name';
  /** Confidence: 1.0=identifier, 0.8=label, 0.6=text, 0.5=view-name */
  confidence: number;
}

export interface BridgeResult {
  projectRoot: string;
  navgatorAvailable: boolean;
  swiftFilesScanned: number;
  correlations: SourceCorrelation[];
  unmatchedElements: string[];
}

/** Internal: extracted from Swift source files */
interface SwiftSourceMatch {
  file: string;       // relative path
  line: number;
  type: 'identifier' | 'label' | 'text' | 'view-name';
  value: string;      // the matched string value
  snippet: string;    // surrounding code
  viewName: string | null;
}

// =============================================================================
// SWIFT SOURCE SCANNING
// =============================================================================

/**
 * Find all .swift files in a directory, recursively.
 * Skips build dirs, .build, DerivedData, Pods, etc.
 */
function findSwiftFiles(dir: string, rootDir: string): string[] {
  const SKIP_DIRS = new Set([
    'node_modules', '.build', 'DerivedData', 'Pods',
    '.git', 'build', 'Build', '.swiftpm',
  ]);

  const results: string[] = [];

  function walk(currentDir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(currentDir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry)) continue;

      const fullPath = join(currentDir, entry);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (entry.endsWith('.swift')) {
        results.push(relative(rootDir, fullPath));
      }
    }
  }

  walk(dir);
  return results;
}

/**
 * Scan Swift source files for accessibility identifiers, labels,
 * button/label text, and view struct declarations.
 */
function scanSwiftSources(projectRoot: string, swiftFiles: string[]): SwiftSourceMatch[] {
  const matches: SwiftSourceMatch[] = [];

  // Patterns to extract
  const IDENTIFIER_RE = /\.accessibilityIdentifier\(\s*"([^"]+)"\s*\)/g;
  const LABEL_RE = /\.accessibilityLabel\(\s*"([^"]+)"\s*\)/g;
  const BUTTON_TEXT_RE = /Button\(\s*"([^"]+)"/g;
  const LABEL_TEXT_RE = /Label\(\s*"([^"]+)"/g;
  const TEXT_RE = /Text\(\s*"([^"]+)"/g;
  const VIEW_STRUCT_RE = /struct\s+(\w+)\s*:\s*(?:\w+,\s*)*View\b/g;

  for (const filePath of swiftFiles) {
    const fullPath = join(projectRoot, filePath);
    let content: string;
    try {
      content = readFileSync(fullPath, 'utf-8');
    } catch {
      continue;
    }

    const lines = content.split('\n');

    // Track which view struct we're inside (approximate)
    let currentViewName: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Track view struct context
      const viewMatch = VIEW_STRUCT_RE.exec(line);
      if (viewMatch) {
        currentViewName = viewMatch[1];
        VIEW_STRUCT_RE.lastIndex = 0;

        matches.push({
          file: filePath,
          line: lineNum,
          type: 'view-name',
          value: currentViewName,
          snippet: line.trim(),
          viewName: currentViewName,
        });
      }

      // Reset regex lastIndex for each line
      IDENTIFIER_RE.lastIndex = 0;
      LABEL_RE.lastIndex = 0;
      BUTTON_TEXT_RE.lastIndex = 0;
      LABEL_TEXT_RE.lastIndex = 0;
      TEXT_RE.lastIndex = 0;

      // accessibilityIdentifier
      let m: RegExpExecArray | null;
      while ((m = IDENTIFIER_RE.exec(line)) !== null) {
        matches.push({
          file: filePath,
          line: lineNum,
          type: 'identifier',
          value: m[1],
          snippet: line.trim(),
          viewName: currentViewName,
        });
      }

      // accessibilityLabel
      while ((m = LABEL_RE.exec(line)) !== null) {
        matches.push({
          file: filePath,
          line: lineNum,
          type: 'label',
          value: m[1],
          snippet: line.trim(),
          viewName: currentViewName,
        });
      }

      // Button("text")
      while ((m = BUTTON_TEXT_RE.exec(line)) !== null) {
        matches.push({
          file: filePath,
          line: lineNum,
          type: 'text',
          value: m[1],
          snippet: line.trim(),
          viewName: currentViewName,
        });
      }

      // Label("text")
      while ((m = LABEL_TEXT_RE.exec(line)) !== null) {
        matches.push({
          file: filePath,
          line: lineNum,
          type: 'text',
          value: m[1],
          snippet: line.trim(),
          viewName: currentViewName,
        });
      }

      // Text("text") — lower priority but useful for matching static text elements
      while ((m = TEXT_RE.exec(line)) !== null) {
        matches.push({
          file: filePath,
          line: lineNum,
          type: 'text',
          value: m[1],
          snippet: line.trim(),
          viewName: currentViewName,
        });
      }
    }
  }

  return matches;
}

// =============================================================================
// NAVGATOR DATA LOADING
// =============================================================================

/** Current and legacy NavGator storage paths */
const NAVGATOR_PATHS = [
  join('.navgator', 'architecture'),
  join('.claude', 'architecture'),  // legacy — NavGator < 0.3
];

/**
 * Try to load NavGator's file_map.json to get known Swift files.
 * Checks current path first, falls back to legacy.
 * Returns null if NavGator data doesn't exist at either path.
 */
function loadNavGatorFileMap(projectRoot: string): Record<string, string> | null {
  for (const navPath of NAVGATOR_PATHS) {
    const fileMapPath = join(projectRoot, navPath, 'file_map.json');
    if (!existsSync(fileMapPath)) continue;

    try {
      const content = readFileSync(fileMapPath, 'utf-8');
      const parsed = JSON.parse(content);
      return parsed.files || null;
    } catch {
      continue;
    }
  }
  return null;
}

// =============================================================================
// CORRELATION ENGINE
// =============================================================================

const CONFIDENCE: Record<SwiftSourceMatch['type'], number> = {
  'identifier': 1.0,
  'label': 0.8,
  'text': 0.6,
  'view-name': 0.5,
};

/**
 * Correlate AX elements from IBR scan to Swift source code locations.
 *
 * @param elements - EnhancedElements from IBR native/macOS scan
 * @param projectRoot - Absolute path to the project root
 * @returns BridgeResult with correlations and unmatched elements
 */
export function correlateToSource(
  elements: EnhancedElement[],
  projectRoot: string
): BridgeResult {
  // Step 1: Determine Swift files to scan
  const navFileMap = loadNavGatorFileMap(projectRoot);
  const navgatorAvailable = navFileMap !== null;

  let swiftFiles: string[];
  if (navFileMap) {
    // Use NavGator's file map — filter to .swift files
    swiftFiles = Object.keys(navFileMap).filter(f => f.endsWith('.swift'));
    // Also add any .swift files NavGator may have missed (glob as supplement)
    const globbed = findSwiftFiles(projectRoot, projectRoot);
    const fileSet = new Set(swiftFiles);
    for (const f of globbed) {
      if (!fileSet.has(f)) swiftFiles.push(f);
    }
  } else {
    // No NavGator — glob all Swift files
    swiftFiles = findSwiftFiles(projectRoot, projectRoot);
  }

  // Step 2: Scan source files for matchable patterns
  const sourceMatches = scanSwiftSources(projectRoot, swiftFiles);

  // Build lookup indices for fast matching
  const byIdentifier = new Map<string, SwiftSourceMatch[]>();
  const byLabel = new Map<string, SwiftSourceMatch[]>();
  const byText = new Map<string, SwiftSourceMatch[]>();
  const byViewName = new Map<string, SwiftSourceMatch[]>();

  for (const match of sourceMatches) {
    const key = match.value.toLowerCase();
    switch (match.type) {
      case 'identifier': {
        if (!byIdentifier.has(key)) byIdentifier.set(key, []);
        byIdentifier.get(key)!.push(match);
        break;
      }
      case 'label': {
        if (!byLabel.has(key)) byLabel.set(key, []);
        byLabel.get(key)!.push(match);
        break;
      }
      case 'text': {
        if (!byText.has(key)) byText.set(key, []);
        byText.get(key)!.push(match);
        break;
      }
      case 'view-name': {
        if (!byViewName.has(key)) byViewName.set(key, []);
        byViewName.get(key)!.push(match);
        break;
      }
    }
  }

  // Step 3: Match each element
  const correlations: SourceCorrelation[] = [];
  const unmatchedElements: string[] = [];
  const matchedIds = new Set<string>();

  for (const el of elements) {
    const elId = el.selector || el.id || '';
    const elLabel = el.a11y?.ariaLabel || '';
    const elText = el.text || '';
    const elRole = el.a11y?.role || '';

    // Deduplicate — skip if we already matched this selector
    if (matchedIds.has(elId) && elId) continue;

    let bestMatch: { source: SwiftSourceMatch; type: SwiftSourceMatch['type'] } | null = null;

    // Strategy 1: Match by accessibilityIdentifier (highest confidence)
    // In native scans, identifier maps to selector or sourceHint.dataTestId
    const testId = el.sourceHint?.dataTestId;
    if (testId) {
      const idMatches = byIdentifier.get(testId.toLowerCase());
      if (idMatches && idMatches.length > 0) {
        bestMatch = { source: idMatches[0], type: 'identifier' };
      }
    }

    // Also check the element id against identifiers
    if (!bestMatch && el.id) {
      const idMatches = byIdentifier.get(el.id.toLowerCase());
      if (idMatches && idMatches.length > 0) {
        bestMatch = { source: idMatches[0], type: 'identifier' };
      }
    }

    // Strategy 2: Match by accessibilityLabel
    if (!bestMatch && elLabel) {
      const labelMatches = byLabel.get(elLabel.toLowerCase());
      if (labelMatches && labelMatches.length > 0) {
        bestMatch = { source: labelMatches[0], type: 'label' };
      }
    }

    // Strategy 3: Match by text content (Button/Label/Text text)
    if (!bestMatch && elText && elText.length >= 2 && elText.length <= 100) {
      const textMatches = byText.get(elText.toLowerCase());
      if (textMatches && textMatches.length > 0) {
        bestMatch = { source: textMatches[0], type: 'text' };
      }
    }

    // Strategy 4: Match by view name in element identifier
    if (!bestMatch && elId) {
      // Check if element selector/id contains a view struct name
      const elIdLower = elId.toLowerCase();
      for (const [viewKey, viewMatches] of byViewName) {
        if (elIdLower.includes(viewKey) && viewMatches.length > 0) {
          bestMatch = { source: viewMatches[0], type: 'view-name' };
          break;
        }
      }
    }

    if (bestMatch) {
      if (elId) matchedIds.add(elId);
      correlations.push({
        elementSelector: elId || elLabel || elText || '(unknown)',
        elementLabel: elLabel || elText || elRole || elId || '',
        sourceFile: bestMatch.source.file,
        sourceLine: bestMatch.source.line,
        viewName: bestMatch.source.viewName,
        matchedSnippet: bestMatch.source.snippet,
        matchType: bestMatch.type,
        confidence: CONFIDENCE[bestMatch.type],
      });
    } else {
      // Only track meaningful unmatched elements (skip empty/generic)
      const desc = elLabel || elText || elId;
      if (desc && desc.length > 1) {
        unmatchedElements.push(desc);
      }
    }
  }

  // Sort by confidence desc, then by file
  correlations.sort((a, b) => b.confidence - a.confidence || a.sourceFile.localeCompare(b.sourceFile));

  return {
    projectRoot,
    navgatorAvailable,
    swiftFilesScanned: swiftFiles.length,
    correlations,
    unmatchedElements,
  };
}

// =============================================================================
// FORMATTING
// =============================================================================

/**
 * Format bridge results as text for MCP tool output.
 */
export function formatBridgeResult(result: BridgeResult): string {
  const lines: string[] = [];

  lines.push(`Source Bridge: ${result.projectRoot}`);
  lines.push(`NavGator data: ${result.navgatorAvailable ? 'available' : 'not found (used file glob)'}`);
  lines.push(`Swift files scanned: ${result.swiftFilesScanned}`);
  lines.push(`Correlations: ${result.correlations.length}`);
  lines.push(`Unmatched elements: ${result.unmatchedElements.length}`);

  if (result.correlations.length > 0) {
    lines.push('');
    lines.push('Matched elements:');

    for (const c of result.correlations) {
      const conf = `${Math.round(c.confidence * 100)}%`;
      const view = c.viewName ? ` (in ${c.viewName})` : '';
      lines.push(`- ${c.elementSelector}`);
      lines.push(`  → ${c.sourceFile}:${c.sourceLine}${view} [${c.matchType}, ${conf}]`);
      lines.push(`  snippet: ${c.matchedSnippet.slice(0, 120)}`);
    }
  }

  if (result.unmatchedElements.length > 0) {
    lines.push('');
    const maxUnmatched = Math.min(result.unmatchedElements.length, 15);
    lines.push(`Unmatched (${result.unmatchedElements.length}):`);
    for (let i = 0; i < maxUnmatched; i++) {
      lines.push(`- ${result.unmatchedElements[i]}`);
    }
    if (result.unmatchedElements.length > 15) {
      lines.push(`  ... and ${result.unmatchedElements.length - 15} more`);
    }
  }

  return lines.join('\n');
}
