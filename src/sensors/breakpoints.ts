import type { SensorContext, ExtractedCSSRule } from './types.js';

/**
 * Breakpoints sensor — enumerates declared @media and @container queries
 * from the page's stylesheets, de-dupes identical conditions across sheets,
 * and reports rule counts per breakpoint.
 *
 * Why this sensor exists: prior to this sensor, IBR's scan could not surface
 * responsive design intent without grepping raw HTML/CSS. See
 * linear-app-20260527.md §"Schema / tooling gaps observed" —
 * "Breakpoints not extractable. No @media rule enumeration."
 */

export type BreakpointType =
  | 'min-width'
  | 'max-width'
  | 'range'
  | 'container-min-width'
  | 'container-max-width'
  | 'container-range'
  | 'print'
  | 'other';

export interface BreakpointEntry {
  type: BreakpointType;
  /** For min-width / max-width / container variants: the single bound in px. */
  value_px?: number;
  /** For range types: the min bound. */
  min?: number;
  /** For range types: the max bound. */
  max?: number;
  /** Total rule count under this condition (summed across stylesheets). */
  rule_count: number;
  /** For container queries: the named container, if specified. */
  container_name?: string;
  /** Raw conditionText for debugging/forward-compat (the literal media text). */
  raw_condition: string;
}

/**
 * Width conditions in px, rem, or em.
 *
 * The unit used to be a hard literal `px`, so `@media (min-width: 48rem)` fell
 * through to `type: 'other'` — and `src/sensors/index.ts` filters `other` out
 * of the one-liner. Tailwind's breakpoints are all rem, so a Tailwind site
 * reported "0 viewport breakpoints" while declaring five. Not a wrong number;
 * an absent one, reported as though the page had nothing to say.
 */
const MIN_WIDTH_RE = /\(\s*min-width\s*:\s*([\d.]+)(px|rem|em)\s*\)/i;
const MAX_WIDTH_RE = /\(\s*max-width\s*:\s*([\d.]+)(px|rem|em)\s*\)/i;

/**
 * Resolve a width match to pixels.
 *
 * rem/em resolve against the ROOT font size — inside a media query there is no
 * element context, so em means the same thing rem does. `rootPx` comes from
 * `documentMeta.rootFontSizePx`; 16 is the browser default and the honest
 * fallback when the document meta is unavailable.
 */
function widthToPx(match: RegExpMatchArray, rootPx: number): number {
  const value = parseFloat(match[1]!);
  const unit = (match[2] ?? 'px').toLowerCase();
  return unit === 'px' ? value : value * rootPx;
}

/**
 * Recursively count style rules under a (possibly nested) rule.
 * Only `style` rules count toward rule_count; we don't double-count nested
 * at-rules (e.g. `@supports` inside `@media`).
 */
function countStyleRules(rule: ExtractedCSSRule): number {
  if (rule.kind === 'style') return 1;
  if (rule.kind === 'media' || rule.kind === 'container' || rule.kind === 'supports') {
    return rule.rules.reduce((acc, r) => acc + countStyleRules(r), 0);
  }
  return 0;
}

function classifyMediaCondition(text: string, rootPx = 16): {
  type: BreakpointType;
  value_px?: number;
  min?: number;
  max?: number;
} {
  const lower = text.toLowerCase().trim();

  if (lower.includes('print')) {
    return { type: 'print' };
  }

  const minMatch = lower.match(MIN_WIDTH_RE);
  const maxMatch = lower.match(MAX_WIDTH_RE);

  if (minMatch && maxMatch) {
    return {
      type: 'range',
      min: widthToPx(minMatch, rootPx),
      max: widthToPx(maxMatch, rootPx),
    };
  }
  if (minMatch) {
    return { type: 'min-width', value_px: widthToPx(minMatch, rootPx) };
  }
  if (maxMatch) {
    return { type: 'max-width', value_px: widthToPx(maxMatch, rootPx) };
  }

  return { type: 'other' };
}

function classifyContainerCondition(
  text: string,
  containerName?: string,
): { type: BreakpointType; value_px?: number; min?: number; max?: number; container_name?: string } {
  const minMatch = text.match(MIN_WIDTH_RE);
  const maxMatch = text.match(MAX_WIDTH_RE);
  const base = containerName ? { container_name: containerName } : {};

  if (minMatch && maxMatch) {
    return { type: 'container-range', min: parseFloat(minMatch[1]!), max: parseFloat(maxMatch[1]!), ...base };
  }
  if (minMatch) {
    return { type: 'container-min-width', value_px: parseFloat(minMatch[1]!), ...base };
  }
  if (maxMatch) {
    return { type: 'container-max-width', value_px: parseFloat(maxMatch[1]!), ...base };
  }
  return { type: 'other', ...base };
}

function dedupKey(e: Pick<BreakpointEntry, 'type' | 'value_px' | 'min' | 'max' | 'container_name'>): string {
  return `${e.type}|${e.value_px ?? ''}|${e.min ?? ''}|${e.max ?? ''}|${e.container_name ?? ''}`;
}

export function collectBreakpoints(ctx: SensorContext): BreakpointEntry[] {
  const rules = ctx.cssRules ?? [];
  if (rules.length === 0) return [];

  const byKey = new Map<string, BreakpointEntry>();
  // rem/em breakpoints resolve against the document root font size.
  const rootPx = ctx.documentMeta?.rootFontSizePx ?? 16;

  for (const rule of rules) {
    if (rule.kind === 'media') {
      const classified = classifyMediaCondition(rule.conditionText, rootPx);
      const ruleCount = rule.rules.reduce((acc, r) => acc + countStyleRules(r), 0);
      const entry: BreakpointEntry = {
        ...classified,
        rule_count: ruleCount,
        raw_condition: rule.conditionText,
      };
      const key = dedupKey(entry);
      const existing = byKey.get(key);
      if (existing) {
        existing.rule_count += ruleCount;
      } else {
        byKey.set(key, entry);
      }
    } else if (rule.kind === 'container') {
      const classified = classifyContainerCondition(rule.conditionText, rule.containerName);
      const ruleCount = rule.rules.reduce((acc, r) => acc + countStyleRules(r), 0);
      const entry: BreakpointEntry = {
        ...classified,
        rule_count: ruleCount,
        raw_condition: rule.conditionText,
      };
      const key = dedupKey(entry);
      const existing = byKey.get(key);
      if (existing) {
        existing.rule_count += ruleCount;
      } else {
        byKey.set(key, entry);
      }
    }
  }

  // Sort: viewport min-width ascending → range → max-width → container variants → print → other
  const typeOrder: Record<BreakpointType, number> = {
    'min-width': 0,
    'range': 1,
    'max-width': 2,
    'container-min-width': 3,
    'container-range': 4,
    'container-max-width': 5,
    'print': 6,
    'other': 7,
  };
  return Array.from(byKey.values()).sort((a, b) => {
    const t = typeOrder[a.type] - typeOrder[b.type];
    if (t !== 0) return t;
    return (a.value_px ?? a.min ?? 0) - (b.value_px ?? b.min ?? 0);
  });
}
