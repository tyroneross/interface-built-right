import type { EnhancedElement } from '../schemas.js';
import type { SensorContext } from './types.js';

/**
 * Typography sensor — fingerprints text-bearing elements by their declared
 * font-family + font-size + font-weight + line-height and aggregates identical
 * fingerprints into one row with a frequency count.
 *
 * Why this sensor exists: prior to this sensor, IBR's scan output included
 * `color` and `backgroundColor` on every element but did NOT bubble up the
 * font triplet to a per-rendition aggregation. The contrast sensor surfaced
 * `fontSize` only for failing contrast samples. See linear-app-20260527.md
 * §1 Typography — "the data exists in DOM but isn't bubbled through the
 * typography-aggregation path."
 */

export interface TypographyRow {
  /** Representative selector for this fingerprint (first observed). */
  selector: string;
  /** Full font-family chain as declared (or computed if no spec available). */
  family: string;
  /** Computed font-size in pixels. */
  size_px: number;
  /** Numeric font-weight (100..900). Keyword weights are resolved to numbers. */
  weight: number;
  /** Numeric line-height multiplier OR the sentinel string "normal" when unresolved. */
  line_height: number | 'normal';
  /** Number of elements sharing this exact fingerprint. */
  count: number;
  /** True when scan ran before document.fonts finished loading. */
  font_loading_pending?: boolean;
  /** Original spec value of font-size if available (e.g. "1.25rem"); resolved size is in size_px. */
  size_spec?: string;
}

export interface TypographyReport {
  rows: TypographyRow[];
  /** True when document.fonts.status was "loading" at scan time. */
  font_loading_pending: boolean;
  /** True when no text-bearing elements were found. */
  data_unavailable?: boolean;
}

const WEIGHT_KEYWORDS: Record<string, number> = {
  normal: 400,
  bold: 700,
  lighter: 300,
  bolder: 600,
};

/**
 * Resolve a font-weight value (numeric string or keyword) to a number.
 * Returns 400 for unparseable input.
 */
function resolveWeight(raw: string | undefined): number {
  if (!raw) return 400;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed in WEIGHT_KEYWORDS) return WEIGHT_KEYWORDS[trimmed]!;
  const n = parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : 400;
}

/**
 * Resolve a font-size value to pixels.
 * Handles px, rem, em (em treated as rem since per-element parent context
 * is not available in the sensor layer — computedStyles already resolved this).
 * Returns 16 for unparseable input (browser default).
 */
function resolveFontSizePx(raw: string | undefined, rootPx: number): number {
  if (!raw) return rootPx;
  const trimmed = raw.trim();
  // bare number (legacy fixture shape)
  const bareNum = Number(trimmed);
  if (Number.isFinite(bareNum) && bareNum > 0) return bareNum;
  const m = trimmed.match(/^([\d.]+)(px|rem|em)?$/i);
  if (!m) return rootPx;
  const value = parseFloat(m[1]!);
  const unit = (m[2] || 'px').toLowerCase();
  if (unit === 'px') return value;
  if (unit === 'rem' || unit === 'em') return value * rootPx;
  return value;
}

/**
 * Resolve line-height. Returns the sentinel string "normal" when the value
 * is the literal "normal" (so callers know the spec didn't pin a value).
 * Otherwise returns a numeric multiplier or px-divided-by-fontSize ratio.
 */
function resolveLineHeight(raw: string | undefined, fontSizePx: number): number | 'normal' {
  if (!raw) return 'normal';
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === 'normal' || trimmed === '') return 'normal';
  // pure number → multiplier (e.g. "1.5")
  const bareNum = Number(trimmed);
  if (Number.isFinite(bareNum) && bareNum > 0) return bareNum;
  // px value → divide by fontSize for multiplier
  const m = trimmed.match(/^([\d.]+)(px|rem|em|%)?$/);
  if (!m) return 'normal';
  const value = parseFloat(m[1]!);
  const unit = m[2] || '';
  if (unit === 'px') return fontSizePx > 0 ? Number((value / fontSizePx).toFixed(2)) : 'normal';
  if (unit === '%') return Number((value / 100).toFixed(2));
  return value; // rem/em → multiplier directly (already resolved at extract layer)
}

/**
 * Build the fingerprint key for an element.
 * Distinct fingerprints become separate rows; matching fingerprints aggregate.
 */
function fingerprintKey(family: string, sizePx: number, weight: number, lineHeight: number | 'normal'): string {
  return `${family}|${sizePx}|${weight}|${lineHeight}`;
}

function isTextBearing(el: EnhancedElement): boolean {
  const text = (el.text ?? '').trim();
  if (text.length === 0) return false;
  // Exclude script/style/meta tags
  const tag = el.tagName.toLowerCase();
  if (tag === 'script' || tag === 'style' || tag === 'meta' || tag === 'noscript') return false;
  return true;
}

export function collectTypography(ctx: SensorContext): TypographyReport {
  const rootPx = ctx.documentMeta?.rootFontSizePx ?? 16;
  const fontsStatus = ctx.documentMeta?.fontsStatus;
  const fontLoadingPending = fontsStatus === 'loading';
  const rawSpecValues = ctx.documentMeta?.rawSpecValues ?? {};

  const textElements = ctx.elements.filter(isTextBearing);
  if (textElements.length === 0) {
    return { rows: [], font_loading_pending: fontLoadingPending, data_unavailable: true };
  }

  const groups = new Map<string, TypographyRow>();

  for (const el of textElements) {
    const styles = el.computedStyles ?? {};
    const family = (styles.fontFamily ?? styles['font-family'] ?? '').trim() || '<unspecified>';
    const sizeRaw = styles.fontSize ?? styles['font-size'];
    const weightRaw = styles.fontWeight ?? styles['font-weight'];
    const lineHeightRaw = styles.lineHeight ?? styles['line-height'];

    const size_px = resolveFontSizePx(sizeRaw, rootPx);
    const weight = resolveWeight(weightRaw);
    const line_height = resolveLineHeight(lineHeightRaw, size_px);

    // Pull raw spec values for this selector if the extract layer captured them
    const rawForSel = rawSpecValues[el.selector] ?? {};
    const size_spec = rawForSel['font-size'] ?? rawForSel.fontSize;

    const key = fingerprintKey(family, size_px, weight, line_height);
    let row = groups.get(key);
    if (!row) {
      row = {
        selector: el.selector,
        family,
        size_px,
        weight,
        line_height,
        count: 0,
        ...(fontLoadingPending ? { font_loading_pending: true } : {}),
        ...(size_spec ? { size_spec } : {}),
      };
      groups.set(key, row);
    }
    row.count++;
  }

  const rows = Array.from(groups.values()).sort((a, b) => b.count - a.count);

  return {
    rows,
    font_loading_pending: fontLoadingPending,
    ...(rows.length === 0 ? { data_unavailable: true } : {}),
  };
}
