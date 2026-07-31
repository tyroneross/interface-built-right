/**
 * sRGB color math for live-pane measurement: parsing, alpha compositing,
 * WCAG 2.x relative luminance and contrast ratio.
 *
 * DUPLICATION NOTE — deliberate, not an oversight.
 * `src/rules/color-parse.ts` and `src/rules/wcag-contrast.ts` cover overlapping
 * ground, but both are being rewritten concurrently by another workstream.
 * Importing an in-flight interface would couple this module to a moving target,
 * so `src/live/` carries its own copy.
 * FOLLOW-UP: once the rules/ rewrite lands, collapse this file into
 * `src/rules/color-parse.ts` (one sRGB parser) + `src/rules/wcag-contrast.ts`
 * (one ratio implementation) and re-point `src/live/measure.ts` at them.
 */

export interface Rgba {
  r: number;
  g: number;
  b: number;
  /** 0..1 */
  a: number;
}

const HEX_RE = /^#([0-9a-f]{3,8})$/i;
const FUNC_RE = /^(rgba?)\(([^)]*)\)$/i;
/**
 * `color(srgb r g b)` / `color(srgb r g b / a)`.
 *
 * This is what Chrome computes `color-mix(in srgb, ...)` down to, and
 * `color-mix()` is how a theme-derived stylesheet stays theme-derived instead
 * of hardcoding a palette. Before this, the one element whose contrast most
 * needed grading — a status colour mixed toward the theme's text colour — came
 * back with `contrastRatio: null`, which reads like "no text here" rather than
 * "this parser gave up". Canvas `fillStyle` does not normalize it away: Chrome
 * round-trips CSS Color 4 forms unchanged.
 *
 * sRGB only, on purpose. `color(display-p3 ...)` needs a gamut conversion whose
 * error belongs in a colour-space module, not in a contrast grader; it keeps
 * returning null.
 */
const COLOR_SRGB_RE = /^color\(\s*srgb\s+([^)]*)\)$/i;

function clamp(n: number, min: number, max: number): number {
  return n < min ? min : n > max ? max : n;
}

function parseChannel(token: string): number | null {
  const t = token.trim();
  if (t === '') return null;
  if (t.endsWith('%')) {
    const pct = Number(t.slice(0, -1));
    if (!Number.isFinite(pct)) return null;
    return clamp(Math.round((pct / 100) * 255), 0, 255);
  }
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return clamp(Math.round(n), 0, 255);
}

function parseAlpha(token: string | undefined): number {
  if (token === undefined) return 1;
  const t = token.trim();
  if (t === '') return 1;
  if (t.endsWith('%')) {
    const pct = Number(t.slice(0, -1));
    return Number.isFinite(pct) ? clamp(pct / 100, 0, 1) : 1;
  }
  const n = Number(t);
  return Number.isFinite(n) ? clamp(n, 0, 1) : 1;
}

/**
 * Parse the color forms Chrome hands back from `getComputedStyle` and from
 * canvas `fillStyle` normalization: `transparent`, `#rgb`/`#rgba`/`#rrggbb`/
 * `#rrggbbaa`, `rgb(...)`, `rgba(...)` in both comma and space/slash syntax,
 * plus `color(srgb ...)` — the computed form of `color-mix(in srgb, ...)`.
 * Anything else (oklch, color(display-p3 ...), named colors) returns null.
 */
export function parseCssColor(input: string | null | undefined): Rgba | null {
  if (!input) return null;
  const s = String(input).trim().toLowerCase();
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

  const hex = HEX_RE.exec(s);
  if (hex) {
    const h = hex[1];
    if (h.length === 3 || h.length === 4) {
      const r = parseInt(h[0] + h[0], 16);
      const g = parseInt(h[1] + h[1], 16);
      const b = parseInt(h[2] + h[2], 16);
      const a = h.length === 4 ? parseInt(h[3] + h[3], 16) / 255 : 1;
      return { r, g, b, a };
    }
    if (h.length === 6 || h.length === 8) {
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
    return null;
  }

  const func = FUNC_RE.exec(s);
  if (func) {
    const body = func[2];
    // Both `rgb(1, 2, 3)` and `rgb(1 2 3 / 0.5)` are legal.
    const [rgbPart, slashAlpha] = body.split('/');
    const parts = rgbPart.trim().split(/[\s,]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const r = parseChannel(parts[0]);
    const g = parseChannel(parts[1]);
    const b = parseChannel(parts[2]);
    if (r === null || g === null || b === null) return null;
    const a = parseAlpha(slashAlpha ?? parts[3]);
    return { r, g, b, a };
  }

  const srgb = COLOR_SRGB_RE.exec(s);
  if (srgb) {
    const [channelPart, slashAlpha] = srgb[1].split('/');
    const parts = channelPart.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 3) return null;
    const chans = parts.slice(0, 3).map(parseUnitChannel);
    if (chans.some((c) => c === null)) return null;
    const [r, g, b] = chans as number[];
    return { r, g, b, a: parseAlpha(slashAlpha) };
  }

  return null;
}

/** A `color()` channel: 0..1 float, or a percentage. Scaled to 0..255. */
function parseUnitChannel(token: string): number | null {
  const t = token.trim();
  if (t === '' || t === 'none') return t === 'none' ? 0 : null;
  const n = t.endsWith('%') ? Number(t.slice(0, -1)) / 100 : Number(t);
  if (!Number.isFinite(n)) return null;
  return clamp(Math.round(n * 255), 0, 255);
}

export function formatRgba(c: Rgba): string {
  const a = Math.round(c.a * 1000) / 1000;
  return a >= 1
    ? `rgb(${c.r}, ${c.g}, ${c.b})`
    : `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
}

export function isOpaque(c: Rgba): boolean {
  return c.a >= 1;
}

/** Source-over composite: `src` painted on top of `dst`. */
export function compositeOver(src: Rgba, dst: Rgba): Rgba {
  if (src.a >= 1) return { ...src };
  if (src.a <= 0) return { ...dst };
  const outA = src.a + dst.a * (1 - src.a);
  if (outA <= 0) return { r: 0, g: 0, b: 0, a: 0 };
  const mix = (s: number, d: number) =>
    Math.round((s * src.a + d * dst.a * (1 - src.a)) / outA);
  return {
    r: mix(src.r, dst.r),
    g: mix(src.g, dst.g),
    b: mix(src.b, dst.b),
    a: outA,
  };
}

export const DEFAULT_CANVAS_BASE: Rgba = { r: 255, g: 255, b: 255, a: 1 };

export interface EffectiveBackground {
  color: Rgba;
  /** true when an opaque background was actually found in the ancestor chain */
  resolved: boolean;
}

/**
 * Composite an element's background chain down to one concrete color.
 *
 * `chain[0]` is the element's own `background-color`; each following entry is
 * the next ancestor going up. The walk stops at the first opaque entry. If no
 * entry is opaque, the browser canvas default (white) is used as the base and
 * `resolved` is false — an honest signal that the answer is an assumption.
 */
export function resolveEffectiveBackground(chain: readonly string[]): EffectiveBackground {
  const parsed: Rgba[] = [];
  for (const raw of chain) {
    const c = parseCssColor(raw);
    if (!c) continue;
    parsed.push(c);
    if (isOpaque(c)) break;
  }

  const last = parsed[parsed.length - 1];
  const resolved = last !== undefined && isOpaque(last);
  let acc: Rgba = resolved ? parsed[parsed.length - 1] : DEFAULT_CANVAS_BASE;
  const top = resolved ? parsed.length - 2 : parsed.length - 1;
  for (let i = top; i >= 0; i--) {
    acc = compositeOver(parsed[i], acc);
  }
  return { color: acc, resolved };
}

function channelLuminance(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG 2.x relative luminance. Alpha is ignored — composite first. */
export function relativeLuminance(c: Rgba): number {
  return (
    0.2126 * channelLuminance(c.r) +
    0.7152 * channelLuminance(c.g) +
    0.0722 * channelLuminance(c.b)
  );
}

/** WCAG 2.x contrast ratio, 1..21, rounded to 2 decimals. */
export function contrastRatio(fg: Rgba, bg: Rgba): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const ratio = (lighter + 0.05) / (darker + 0.05);
  return Math.round(ratio * 100) / 100;
}

/**
 * WCAG "large text": >= 18.66px when bold (weight >= 700), else >= 24px.
 * Large text passes AA at 3:1; everything else needs 4.5:1.
 */
export function isLargeText(fontSizePx: number, fontWeight: number): boolean {
  if (!Number.isFinite(fontSizePx)) return false;
  if (fontWeight >= 700 && fontSizePx >= 18.66) return true;
  return fontSizePx >= 24;
}

export function aaThreshold(large: boolean): number {
  return large ? 3 : 4.5;
}

/** Parse `"14px"` / `"14.5px"` to a number; NaN-safe (returns null). */
export function parsePx(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Computed `font-weight` is numeric in Chrome, but accept the keywords too so
 * this stays correct if a caller feeds it a specified value.
 */
export function parseFontWeight(value: string | null | undefined): number {
  if (!value) return 400;
  const t = String(value).trim().toLowerCase();
  if (t === 'bold') return 700;
  if (t === 'bolder') return 700;
  if (t === 'normal' || t === 'lighter') return 400;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : 400;
}
