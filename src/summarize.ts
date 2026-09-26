/**
 * Scan Summarization Layer
 *
 * Condenses raw EnhancedElement arrays into structured, token-efficient reports.
 * Pure deterministic algorithms — no LLM calls, no npm dependencies.
 */

import type { EnhancedElement } from './schemas.js';
import { measureElementContrast } from './rules/contrast-measure.js';

// ============================================================================
// Public interfaces
// ============================================================================

export interface VisualPatternGroup {
  /** Hash of the style signature */
  patternId: string;
  /** The shared style properties */
  styleSignature: {
    fontSize: string;
    fontWeight: string;
    color: string;
    backgroundColor: string;
    borderRadius: string;
    padding: string;
  };
  /** Number of elements that fully match this signature */
  count: number;
  /** Unique roles present in this group */
  roles: string[];
  /** Selectors of elements that almost match (5/6 properties match) */
  outliers: string[];
}

export interface ComponentCensusEntry {
  /** Pattern name e.g. "PageHeader", "Surface+Row", "raw-button", "raw-div" */
  pattern: string;
  count: number;
  /** Routes (URL pathnames) that contain this pattern */
  pages: string[];
  compliance: 'primitive' | 'raw' | 'mixed';
}

export interface NavigationNode {
  label: string;
  role: string;
  depth: number;
  childCount?: number;
  isActive?: boolean;
}

export interface ContrastReportEntry {
  status: 'pass' | 'fail' | 'unknown';
  ratio: number;
  foreground: string;
  background: string;
  /** Number of elements sharing this exact color pair */
  elementCount: number;
  /** Up to 3 representative element labels */
  sampleElements: string[];
  /** WCAG large-text classification (3:1 threshold instead of 4.5:1). Absent for 'unknown' rows. */
  largeText?: boolean;
  /** Why an 'unknown' row could not be graded, e.g. "unparseable color". */
  reason?: string;
}

export interface InteractionMapEntry {
  category:
    | 'has-handler'
    | 'looks-interactive-no-handler'
    | 'disabled-with-handler'
    | 'properly-disabled';
  count: number;
  /** Element labels, max 5 */
  elements: string[];
}

export interface ScanSummary {
  /** Visual pattern groups — elements clustered by their styling */
  visualPatterns: VisualPatternGroup[];
  /** Component census — how consistently primitives/patterns are used */
  componentCensus: ComponentCensusEntry[];
  /** Navigation map — page structure derived from headings + nav elements */
  navigationMap: NavigationNode[];
  /** Contrast report — pre-computed ratios grouped by pass/fail */
  contrastReport: ContrastReportEntry[];
  /** Interaction map — handler coverage stats */
  interactionMap: InteractionMapEntry[];
  /** Token efficiency — raw vs summary size comparison */
  tokenEfficiency: {
    rawTokenEstimate: number;
    summaryTokenEstimate: number;
    reductionPercent: number;
  };
}

// ============================================================================
// Internal helpers
// ============================================================================

/** Style properties that form the visual signature */
const SIGNATURE_KEYS = [
  'fontSize',
  'fontWeight',
  'color',
  'backgroundColor',
  'borderRadius',
  'padding',
] as const;

type SignatureKey = (typeof SIGNATURE_KEYS)[number];

type StyleSignature = Record<SignatureKey, string>;

/** Extract a 6-property style signature from an element's computedStyles */
function extractSignature(el: EnhancedElement): StyleSignature {
  const s = el.computedStyles ?? {};
  return {
    fontSize: s['fontSize'] ?? '',
    fontWeight: s['fontWeight'] ?? '',
    color: s['color'] ?? '',
    backgroundColor: s['backgroundColor'] ?? '',
    borderRadius: s['borderRadius'] ?? '',
    padding: s['padding'] ?? '',
  };
}

/** Deterministic hash of a style signature for use as a group key */
function hashSignature(sig: StyleSignature): string {
  return SIGNATURE_KEYS.map((k) => `${k}:${sig[k]}`).join('|');
}

/** Count how many of 6 signature fields match between two signatures */
function matchCount(a: StyleSignature, b: StyleSignature): number {
  let count = 0;
  for (const key of SIGNATURE_KEYS) {
    if (a[key] === b[key]) count++;
  }
  return count;
}

/** Readable label for an element (text, ariaLabel, id, or selector fallback) */
function elementLabel(el: EnhancedElement): string {
  return (
    el.text?.trim() ||
    el.a11y?.ariaLabel ||
    el.id ||
    el.selector.slice(0, 60)
  );
}

/** Resolve an element's effective role */
function resolveRole(el: EnhancedElement): string {
  return el.a11y?.role ?? el.tagName ?? 'unknown';
}

// ============================================================================
// 1. Visual Pattern Groups
// ============================================================================

function buildVisualPatterns(elements: EnhancedElement[]): VisualPatternGroup[] {
  if (elements.length === 0) return [];

  // Group elements by exact style signature
  const groups = new Map<
    string,
    { sig: StyleSignature; elements: EnhancedElement[] }
  >();

  for (const el of elements) {
    const sig = extractSignature(el);
    const key = hashSignature(sig);
    const existing = groups.get(key);
    if (existing) {
      existing.elements.push(el);
    } else {
      groups.set(key, { sig, elements: [el] });
    }
  }

  // Convert to VisualPatternGroup, then find outliers for each group
  const groupList = Array.from(groups.entries()).map(([key, { sig, elements: els }]) => ({
    patternId: key.slice(0, 32), // truncate for readability
    styleSignature: sig,
    count: els.length,
    roles: [...new Set(els.map(resolveRole))],
    memberElements: els,
  }));

  // Outlier detection: elements in smaller groups that match 5/6 of a larger group
  const result: VisualPatternGroup[] = groupList.map((group) => {
    const outliers: string[] = [];

    for (const other of groupList) {
      if (other.patternId === group.patternId) continue;
      const matches = matchCount(group.styleSignature, other.styleSignature);
      if (matches >= 5) {
        // All elements from the smaller group are outliers of the larger
        for (const el of other.memberElements) {
          outliers.push(elementLabel(el));
        }
      }
    }

    return {
      patternId: group.patternId,
      styleSignature: group.styleSignature,
      count: group.count,
      roles: group.roles,
      outliers: [...new Set(outliers)].slice(0, 10),
    };
  });

  // Sort by count descending
  return result.sort((a, b) => b.count - a.count);
}

// ============================================================================
// 2. Component Census
// ============================================================================

/** Known primitive testId patterns → pattern name */
const PRIMITIVE_PATTERNS: Array<{ testIdIncludes: string; name: string }> = [
  { testIdIncludes: 'page-header', name: 'PageHeader' },
  { testIdIncludes: 'page-title', name: 'PageHeader' },
  { testIdIncludes: 'surface', name: 'Surface+Row' },
  { testIdIncludes: 'card', name: 'Surface+Row' },
  { testIdIncludes: 'nav-item', name: 'NavItem' },
  { testIdIncludes: 'tab', name: 'Tab' },
  { testIdIncludes: 'modal', name: 'Modal' },
  { testIdIncludes: 'dialog', name: 'Dialog' },
  { testIdIncludes: 'toast', name: 'Toast' },
  { testIdIncludes: 'badge', name: 'Badge' },
  { testIdIncludes: 'avatar', name: 'Avatar' },
  { testIdIncludes: 'input', name: 'Input' },
  { testIdIncludes: 'btn', name: 'Button' },
  { testIdIncludes: 'button', name: 'Button' },
];

function classifyElement(el: EnhancedElement): {
  pattern: string;
  compliance: 'primitive' | 'raw' | 'mixed';
} {
  const testId = el.sourceHint?.dataTestId?.toLowerCase() ?? '';

  // Check for known primitive data-testid
  for (const p of PRIMITIVE_PATTERNS) {
    if (testId.includes(p.testIdIncludes)) {
      return { pattern: p.name, compliance: 'primitive' };
    }
  }

  // Raw button: <button> tag without a recognizable primitive testId
  if (el.tagName === 'button') {
    return { pattern: 'raw-button', compliance: 'raw' };
  }

  // Raw heading
  if (['h1', 'h2', 'h3'].includes(el.tagName)) {
    return { pattern: `raw-${el.tagName}`, compliance: 'raw' };
  }

  // Raw input
  if (['input', 'select', 'textarea'].includes(el.tagName)) {
    return { pattern: 'raw-input', compliance: 'raw' };
  }

  // Raw link
  if (el.tagName === 'a') {
    return { pattern: 'raw-link', compliance: 'raw' };
  }

  // Generic div/span
  return { pattern: `raw-${el.tagName ?? 'unknown'}`, compliance: 'raw' };
}

function buildComponentCensus(
  elements: EnhancedElement[],
  url: string
): ComponentCensusEntry[] {
  if (elements.length === 0) return [];

  let route: string;
  try {
    route = new URL(url).pathname;
  } catch {
    route = url;
  }

  const map = new Map<
    string,
    { count: number; pages: Set<string>; complianceCounts: Record<string, number> }
  >();

  for (const el of elements) {
    const { pattern, compliance } = classifyElement(el);
    const existing = map.get(pattern);
    if (existing) {
      existing.count++;
      existing.pages.add(route);
      existing.complianceCounts[compliance] =
        (existing.complianceCounts[compliance] ?? 0) + 1;
    } else {
      map.set(pattern, {
        count: 1,
        pages: new Set([route]),
        complianceCounts: { [compliance]: 1 },
      });
    }
  }

  return Array.from(map.entries())
    .map(([pattern, { count, pages, complianceCounts }]) => {
      const primitiveCount = complianceCounts['primitive'] ?? 0;
      const rawCount = complianceCounts['raw'] ?? 0;
      let compliance: 'primitive' | 'raw' | 'mixed';
      if (primitiveCount > 0 && rawCount > 0) {
        compliance = 'mixed';
      } else if (primitiveCount > 0) {
        compliance = 'primitive';
      } else {
        compliance = 'raw';
      }
      return {
        pattern,
        count,
        pages: [...pages],
        compliance,
      };
    })
    .sort((a, b) => b.count - a.count);
}

// ============================================================================
// 3. Navigation Map
// ============================================================================

const HEADING_DEPTH: Record<string, number> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6,
};

const NAV_ROLES = new Set(['navigation', 'link', 'tab', 'menuitem', 'option']);

function buildNavigationMap(elements: EnhancedElement[]): NavigationNode[] {
  if (elements.length === 0) return [];

  const nodes: NavigationNode[] = [];

  for (const el of elements) {
    const role = resolveRole(el);
    const tag = el.tagName ?? '';
    const isHeading = tag in HEADING_DEPTH;
    const isNavRole = NAV_ROLES.has(role);

    if (!isHeading && !isNavRole) continue;

    const label = elementLabel(el);
    if (!label) continue;

    const depth = isHeading ? (HEADING_DEPTH[tag] ?? 1) : 1;

    // isActive: check aria-current or aria-selected
    const styles = el.computedStyles ?? {};
    const hasFontWeightBold =
      styles['fontWeight'] === 'bold' ||
      parseInt(styles['fontWeight'] ?? '0', 10) >= 700;
    const isActive =
      el.a11y?.role === 'tab'
        ? hasFontWeightBold
        : undefined;

    nodes.push({
      label,
      role,
      depth,
      isActive,
    });
  }

  // Annotate childCount: number of direct children (next nodes one level deeper)
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    let children = 0;
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodes[j].depth <= node.depth) break;
      if (nodes[j].depth === node.depth + 1) children++;
    }
    if (children > 0) {
      node.childCount = children;
    }
  }

  return nodes;
}

// ============================================================================
// 4. Contrast Report
// ============================================================================

// This delegates to the canonical `measureElementContrast` (src/rules/contrast-measure.ts)
// instead of a private rgb/hex-only parser. That private parser returned `null` for any
// modern color space (oklch, lab, color(), ...), so every such pair fell through to
// `status:'unknown'` here — and the MCP summary line then counted `total - failing` as
// passing, silently counting every unknown-colour element as a pass.
function buildContrastReport(elements: EnhancedElement[]): ContrastReportEntry[] {
  if (elements.length === 0) return [];

  interface GroupAcc {
    status: 'pass' | 'fail' | 'unknown';
    ratio: number;
    foreground: string;
    background: string;
    largeText?: boolean;
    reason?: string;
    elements: EnhancedElement[];
  }

  const groups = new Map<string, GroupAcc>();

  const addEntry = (el: EnhancedElement, acc: Omit<GroupAcc, 'elements'>) => {
    const key = `${acc.status}|${acc.foreground}|${acc.background}|${acc.largeText ?? ''}`;
    const existing = groups.get(key);
    if (existing) {
      existing.elements.push(el);
    } else {
      groups.set(key, { ...acc, elements: [el] });
    }
  };

  for (const el of elements) {
    const m = measureElementContrast(el);

    if (m.status === 'no-text' || m.status === 'no-styles' || m.status === 'invisible') {
      continue;
    }

    if (m.status === 'unmeasurable') {
      addEntry(el, {
        status: 'unknown',
        ratio: 0,
        foreground: el.computedStyles?.['color'] ?? '',
        background: m.raw,
        reason: `unparseable colour: ${m.raw}`,
      });
      continue;
    }

    // m.status === 'measured'
    const threshold = m.large ? 3 : 4.5;
    addEntry(el, {
      status: m.ratio >= threshold ? 'pass' : 'fail',
      ratio: Math.round(m.ratio * 100) / 100,
      foreground: m.fgRaw,
      background: m.bgRaw,
      largeText: m.large,
    });
  }

  return Array.from(groups.values()).map(({ elements: els, ...acc }) => ({
    ...acc,
    elementCount: els.length,
    sampleElements: els.slice(0, 3).map(elementLabel).filter(Boolean),
  }));
}

/**
 * Render the one-line contrast summary for a report's entries, weighted by
 * `elementCount` (a group represents N elements, not one). Returns null when
 * there is nothing to report. Pulled out as a pure helper so callers (MCP
 * tool output, CLI, live formatter) share one counting rule instead of each
 * re-deriving "pass" from `total - failing`, which is how unknown rows were
 * previously counted as passes.
 */
export function formatContrastSummaryLine(entries: ContrastReportEntry[]): string | null {
  if (entries.length === 0) return null;

  let pass = 0;
  let fail = 0;
  let unknown = 0;
  for (const entry of entries) {
    if (entry.status === 'pass') pass += entry.elementCount;
    else if (entry.status === 'fail') fail += entry.elementCount;
    else unknown += entry.elementCount;
  }

  const measured = pass + fail;
  if (measured === 0) {
    return `Contrast: NOT MEASURED — ${unknown} element(s) use colours the checker could not parse`;
  }

  let line = `Contrast: ${pass}/${measured} pass WCAG AA`;
  if (unknown > 0) {
    line += `, ${unknown} not measured (unparseable colour)`;
  }
  return line;
}

// ============================================================================
// 5. Interaction Map
// ============================================================================

// 'summary' is HTML-native interactivity (expand/collapse <details>), not
// an ARIA role — kept in this tag set rather than INTERACTIVE_ROLES.
const INTERACTIVE_TAGS = new Set(['button', 'a', 'input', 'select', 'textarea', 'summary']);
// Explicit `role="..."` attribute values (el.a11y.role reads getAttribute,
// not the computed/implicit AX role — see extract.ts). Reconciled against
// engine/normalize.ts's WEB_ROLES: every raw ARIA role string a page author
// could plausibly write that WEB_ROLES now treats as actionable is listed
// here too, so a custom-role widget (e.g. `<div role="radio">`) isn't
// flagged upstream but dropped from this downstream classifier. Chrome-
// internal, non-ARIA role names (Date, ColorWell, DisclosureTriangle,
// spinbutton's native counterpart) are deliberately excluded — they're
// never legal `role="..."` attribute values, so they can't appear here.
const INTERACTIVE_ROLES = new Set([
  'button', 'link', 'textbox', 'checkbox', 'radio', 'combobox', 'menuitem',
  'option', 'tab', 'switch', 'slider', 'searchbox', 'spinbutton',
  'menuitemcheckbox', 'menuitemradio', 'treeitem',
]);

function isLooksInteractive(el: EnhancedElement): boolean {
  const tag = el.tagName ?? '';
  const role = el.a11y?.role ?? '';
  const cursor = el.interactive?.cursor ?? el.computedStyles?.['cursor'] ?? '';
  return (
    INTERACTIVE_TAGS.has(tag) ||
    INTERACTIVE_ROLES.has(role) ||
    cursor === 'pointer' ||
    // contenteditable is native, attribute-driven interactivity with no
    // role or click handler of its own — see extract.ts's isContentEditable
    // capture and buildInteractionMap's hasHandler treatment below.
    !!el.interactive?.isContentEditable
  );
}

function buildInteractionMap(elements: EnhancedElement[]): InteractionMapEntry[] {
  if (elements.length === 0) return [];

  const buckets: Record<InteractionMapEntry['category'], EnhancedElement[]> = {
    'has-handler': [],
    'looks-interactive-no-handler': [],
    'disabled-with-handler': [],
    'properly-disabled': [],
  };

  for (const el of elements) {
    const inter = el.interactive;
    if (!inter) continue;

    const hasHandler =
      inter.hasOnClick || inter.hasHref || !!inter.hasReactHandler ||
      // contenteditable and <summary> are natively interactive without a
      // JS handler; without this they'd be misclassified as
      // 'looks-interactive-no-handler' (a false "looks broken" signal).
      !!inter.isContentEditable || el.tagName === 'summary';
    const isDisabled = inter.isDisabled ?? false;
    const looksInteractive = isLooksInteractive(el);

    if (isDisabled && hasHandler) {
      buckets['disabled-with-handler'].push(el);
    } else if (isDisabled && !hasHandler) {
      buckets['properly-disabled'].push(el);
    } else if (hasHandler) {
      buckets['has-handler'].push(el);
    } else if (looksInteractive) {
      buckets['looks-interactive-no-handler'].push(el);
    }
  }

  return (
    Object.entries(buckets) as Array<
      [InteractionMapEntry['category'], EnhancedElement[]]
    >
  )
    .filter(([, els]) => els.length > 0)
    .map(([category, els]) => ({
      category,
      count: els.length,
      elements: els.slice(0, 5).map(elementLabel),
    }));
}

// ============================================================================
// 6. Token Efficiency
// ============================================================================

function estimateTokens(data: unknown): number {
  return Math.ceil(JSON.stringify(data).length / 4);
}

// ============================================================================
// Main export
// ============================================================================

/**
 * Summarize raw element scan data into a structured, token-efficient report.
 *
 * @param elements - Raw EnhancedElement array from a scan
 * @param url - The page URL (used for route extraction in component census)
 * @returns ScanSummary with visual patterns, component census, navigation map,
 *          contrast report, interaction map, and token efficiency metrics
 */
export function summarizeScan(
  elements: EnhancedElement[],
  url: string
): ScanSummary {
  const safeElements = elements ?? [];

  const visualPatterns = buildVisualPatterns(safeElements);
  const componentCensus = buildComponentCensus(safeElements, url);
  const navigationMap = buildNavigationMap(safeElements);
  const contrastReport = buildContrastReport(safeElements);
  const interactionMap = buildInteractionMap(safeElements);

  const summary: Omit<ScanSummary, 'tokenEfficiency'> = {
    visualPatterns,
    componentCensus,
    navigationMap,
    contrastReport,
    interactionMap,
  };

  const rawTokenEstimate = estimateTokens(safeElements);
  const summaryTokenEstimate = estimateTokens(summary);
  const reductionPercent =
    rawTokenEstimate > 0
      ? Math.round(
          ((rawTokenEstimate - summaryTokenEstimate) / rawTokenEstimate) * 100
        )
      : 0;

  return {
    ...summary,
    tokenEfficiency: {
      rawTokenEstimate,
      summaryTokenEstimate,
      reductionPercent,
    },
  };
}
