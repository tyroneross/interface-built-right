/**
 * Scan Summarization Layer
 *
 * Condenses raw EnhancedElement arrays into structured, token-efficient reports.
 * Pure deterministic algorithms — no LLM calls, no npm dependencies.
 */

import type { EnhancedElement } from './schemas.js';

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
// WCAG 2.1 contrast utilities (no external deps)
// ============================================================================

interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Parse CSS color string → RGB (0–255), returns null on failure */
function parseColor(color: string): RGB | null {
  if (!color || color === 'transparent' || color === 'none') return null;

  // rgb() / rgba()
  const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3]),
    };
  }

  // hex #rrggbb or #rgb
  const hexMatch = color.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) {
    const h = hexMatch[1];
    if (h.length === 3) {
      return {
        r: parseInt(h[0] + h[0], 16),
        g: parseInt(h[1] + h[1], 16),
        b: parseInt(h[2] + h[2], 16),
      };
    }
    if (h.length >= 6) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
      };
    }
  }

  // Named colors (minimal set)
  const named: Record<string, RGB> = {
    white: { r: 255, g: 255, b: 255 },
    black: { r: 0, g: 0, b: 0 },
    red: { r: 255, g: 0, b: 0 },
    green: { r: 0, g: 128, b: 0 },
    blue: { r: 0, g: 0, b: 255 },
    gray: { r: 128, g: 128, b: 128 },
    grey: { r: 128, g: 128, b: 128 },
  };
  return named[color.toLowerCase()] ?? null;
}

/** WCAG 2.1 relative luminance from 0–255 RGB */
function relativeLuminance(r: number, g: number, b: number): number {
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two luminance values */
function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
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

  let route = '/';
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

function buildContrastReport(elements: EnhancedElement[]): ContrastReportEntry[] {
  if (elements.length === 0) return [];

  // Accumulate by color pair key
  const pairMap = new Map<
    string,
    { fg: string; bg: string; elements: EnhancedElement[] }
  >();

  for (const el of elements) {
    const styles = el.computedStyles ?? {};
    const fg = styles['color'] ?? '';
    const bg = styles['backgroundColor'] ?? '';

    if (!fg && !bg) continue;

    const key = `${fg}|${bg}`;
    const existing = pairMap.get(key);
    if (existing) {
      existing.elements.push(el);
    } else {
      pairMap.set(key, { fg, bg, elements: [el] });
    }
  }

  return Array.from(pairMap.values()).map(({ fg, bg, elements: els }) => {
    const fgRgb = parseColor(fg);
    const bgRgb = parseColor(bg);

    let status: 'pass' | 'fail' | 'unknown' = 'unknown';
    let ratio = 0;

    if (fgRgb && bgRgb) {
      const fgL = relativeLuminance(fgRgb.r, fgRgb.g, fgRgb.b);
      const bgL = relativeLuminance(bgRgb.r, bgRgb.g, bgRgb.b);
      ratio = contrastRatio(fgL, bgL);
      // WCAG AA normal text threshold: 4.5
      status = ratio >= 4.5 ? 'pass' : 'fail';
    }

    const sampleElements = els
      .slice(0, 3)
      .map(elementLabel)
      .filter(Boolean);

    return {
      status,
      ratio: Math.round(ratio * 100) / 100,
      foreground: fg,
      background: bg,
      elementCount: els.length,
      sampleElements,
    };
  });
}

// ============================================================================
// 5. Interaction Map
// ============================================================================

const INTERACTIVE_TAGS = new Set(['button', 'a', 'input', 'select', 'textarea']);
const INTERACTIVE_ROLES = new Set(['button', 'link', 'textbox', 'checkbox', 'radio', 'combobox', 'menuitem', 'option', 'tab']);

function isLooksInteractive(el: EnhancedElement): boolean {
  const tag = el.tagName ?? '';
  const role = el.a11y?.role ?? '';
  const cursor = el.interactive?.cursor ?? el.computedStyles?.['cursor'] ?? '';
  return (
    INTERACTIVE_TAGS.has(tag) ||
    INTERACTIVE_ROLES.has(role) ||
    cursor === 'pointer'
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
      inter.hasOnClick || inter.hasHref || !!inter.hasReactHandler;
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
