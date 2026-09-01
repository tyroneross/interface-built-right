/**
 * CSS color parsing for the rule engine.
 *
 * WHY THIS EXISTS AS ITS OWN MODULE: the contrast rule used to accept only
 * rgb/rgba and hex, and returned `null` for everything else. Anything modern
 * (oklch, lab, lch, color()) was therefore indistinguishable from `transparent`,
 * so the rule skipped it and reported zero findings. A site built on Tailwind v4
 * — which emits `oklch()` for its entire default palette — scanned as clean
 * because nothing was measured at all. `totalChecked: 0` read as a pass.
 *
 * Two changes follow from that:
 *   1. Parse the modern spaces (oklch/oklab/lch/lab/hsl + hex4/hex8 + named).
 *   2. Distinguish CANNOT-PARSE from LEGITIMATELY-SKIPPED, so an unmeasured
 *      element can be surfaced instead of silently dropped. A checker that
 *      cannot say "I did not check this" will eventually report a clean page
 *      it never looked at.
 */

export type ParsedColor =
  /** Resolved to sRGB 0–255. Safe to measure. */
  | { kind: 'rgb'; rgb: [number, number, number]; alpha: number }
  /** Genuinely nothing to measure (transparent, unset, inherited). */
  | { kind: 'none'; reason: string }
  /** A real color we could not decode. MUST be surfaced, never silently skipped. */
  | { kind: 'unsupported'; raw: string };

const NAMED: Record<string, [number, number, number]> = {
  black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0], green: [0, 128, 0],
  blue: [0, 0, 255], gray: [128, 128, 128], grey: [128, 128, 128],
  silver: [192, 192, 192], maroon: [128, 0, 0], olive: [128, 128, 0],
  lime: [0, 255, 0], aqua: [0, 255, 255], cyan: [0, 255, 255], teal: [0, 128, 128],
  navy: [0, 0, 128], fuchsia: [255, 0, 255], magenta: [255, 0, 255],
  purple: [128, 0, 128], yellow: [255, 255, 0], orange: [255, 165, 0],
};

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

/** Linear-light sRGB channel -> gamma-encoded 0–255. */
function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055;
  return clamp255(v * 255);
}

/** OKLab -> linear sRGB (Ottosson's matrices). */
function oklabToLinearSrgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** CIE Lab (D50, as CSS uses) -> linear sRGB, via XYZ with Bradford adaptation. */
function labToLinearSrgb(L: number, a: number, bb: number): [number, number, number] {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - bb / 200;
  const f = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (116 * t - 16) / 903.3);
  // D50 white point
  const X = 0.96422 * f(fx), Y = 1.0 * f(fy), Z = 0.82521 * f(fz);
  // XYZ(D50) -> linear sRGB(D65), Bradford-adapted matrix
  return [
    3.1338561 * X - 1.6168667 * Y - 0.4906146 * Z,
    -0.9787684 * X + 1.9161415 * Y + 0.033454 * Z,
    0.0719453 * X - 0.2289914 * Y + 1.4052427 * Z,
  ];
}

/** Accepts `50%`, `0.5`, `.5`, `12`. `pctBasis` scales a percentage. */
function num(tok: string, pctBasis = 1): number {
  const t = tok.trim();
  if (t.endsWith('%')) return (parseFloat(t) / 100) * pctBasis;
  return parseFloat(t);
}

/** Split modern CSS color args: space-separated, optional `/ alpha`. */
function splitArgs(body: string): { parts: string[]; alpha: number } {
  const [main, alphaPart] = body.split('/');
  const parts = main.trim().split(/[\s,]+/).filter(Boolean);
  const alpha = alphaPart !== undefined ? num(alphaPart, 1) : 1;
  return { parts, alpha };
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x]
    : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = l - c / 2;
  return [clamp255((r1 + m) * 255), clamp255((g1 + m) * 255), clamp255((b1 + m) * 255)];
}

export function parseColor(color: string): ParsedColor {
  const raw = (color ?? '').trim();
  if (!raw) return { kind: 'none', reason: 'empty' };

  const lower = raw.toLowerCase();
  if (lower === 'transparent') return { kind: 'none', reason: 'transparent' };
  if (['initial', 'inherit', 'unset', 'revert', 'currentcolor', 'none', 'auto'].includes(lower)) {
    return { kind: 'none', reason: lower };
  }
  if (NAMED[lower]) return { kind: 'rgb', rgb: NAMED[lower], alpha: 1 };

  // hex: #rgb #rgba #rrggbb #rrggbbaa
  const hex = lower.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    const h = hex[1];
    const exp = (i: number) => parseInt(h[i] + h[i], 16);
    const pair = (i: number) => parseInt(h.slice(i, i + 2), 16);
    if (h.length === 3) return { kind: 'rgb', rgb: [exp(0), exp(1), exp(2)], alpha: 1 };
    if (h.length === 4) return { kind: 'rgb', rgb: [exp(0), exp(1), exp(2)], alpha: exp(3) / 255 };
    if (h.length === 6) return { kind: 'rgb', rgb: [pair(0), pair(2), pair(4)], alpha: 1 };
    if (h.length === 8) return { kind: 'rgb', rgb: [pair(0), pair(2), pair(4)], alpha: pair(6) / 255 };
    return { kind: 'unsupported', raw };
  }

  const fn = lower.match(/^([a-z]+)\(([^)]*)\)$/);
  if (!fn) return { kind: 'unsupported', raw };
  const [, name, body] = fn;
  const { parts, alpha } = splitArgs(body);
  if (alpha === 0) return { kind: 'none', reason: 'alpha-0' };

  // A DECODED COLOUR MUST BE A NUMBER. `num()` is `parseFloat`, which returns
  // NaN for any token it does not understand, and NaN flows through clamp255
  // and the colour-space conversions untouched. So CSS Color 5 relative syntax
  // — `rgb(from red r g b)`, now shipping in Chrome — came back as
  // `{ kind: 'rgb', rgb: [NaN, NaN, NaN], alpha: NaN }`: a claimed measurement
  // with no measurement in it. Downstream that produces a NaN luminance, a NaN
  // ratio, and `ratio >= threshold` is false for NaN — so it reports a contrast
  // VIOLATION reading "NaN:1" rather than admitting it could not read the
  // colour.
  //
  // Gated once, structurally, around every branch, rather than per-case: the
  // point is that no arm CAN return a non-finite channel, not that today's arms
  // happen not to.
  const finite = (r: ParsedColor): ParsedColor =>
    r.kind === 'rgb' && (!r.rgb.every(Number.isFinite) || !Number.isFinite(r.alpha))
      ? { kind: 'unsupported', raw }
      : r;

  try {
    return finite(parseColorBody(name!, parts, alpha, raw));
  } catch {
    return { kind: 'unsupported', raw };
  }
}

/** The per-function-name decode. Wrapped by `parseColor`, which validates it. */
function parseColorBody(
  name: string,
  parts: string[],
  alpha: number,
  raw: string,
): ParsedColor {
  {
    switch (name) {
      case 'rgb':
      case 'rgba': {
        const rgb: [number, number, number] = [
          clamp255(num(parts[0], 255)), clamp255(num(parts[1], 255)), clamp255(num(parts[2], 255)),
        ];
        const a = parts[3] !== undefined ? num(parts[3]) : alpha;
        return a === 0 ? { kind: 'none', reason: 'alpha-0' } : { kind: 'rgb', rgb, alpha: a };
      }
      case 'hsl':
      case 'hsla': {
        const a = parts[3] !== undefined ? num(parts[3]) : alpha;
        if (a === 0) return { kind: 'none', reason: 'alpha-0' };
        return { kind: 'rgb', rgb: hslToRgb(parseFloat(parts[0]), num(parts[1], 1), num(parts[2], 1)), alpha: a };
      }
      case 'oklch':
      case 'lch': {
        const L = num(parts[0], name === 'oklch' ? 1 : 100);
        const C = num(parts[1], name === 'oklch' ? 0.4 : 150);
        const H = (parseFloat(parts[2]) || 0) * (Math.PI / 180);
        const a = C * Math.cos(H), b = C * Math.sin(H);
        const lin = name === 'oklch' ? oklabToLinearSrgb(L, a, b) : labToLinearSrgb(L, a, b);
        return { kind: 'rgb', rgb: lin.map(linearToSrgb) as [number, number, number], alpha };
      }
      case 'oklab':
      case 'lab': {
        const L = num(parts[0], name === 'oklab' ? 1 : 100);
        const a = num(parts[1], name === 'oklab' ? 0.4 : 125);
        const b = num(parts[2], name === 'oklab' ? 0.4 : 125);
        const lin = name === 'oklab' ? oklabToLinearSrgb(L, a, b) : labToLinearSrgb(L, a, b);
        return { kind: 'rgb', rgb: lin.map(linearToSrgb) as [number, number, number], alpha };
      }
      case 'color': {
        // color(srgb r g b) and color(display-p3 r g b). p3 is treated as srgb,
        // which is close enough for a luminance ratio and far better than skipping.
        const space = parts[0];
        if (space !== 'srgb' && space !== 'srgb-linear' && space !== 'display-p3') {
          return { kind: 'unsupported', raw };
        }
        const ch = parts.slice(1, 4).map((p) => num(p, 1));
        const rgb = (space === 'srgb-linear' ? ch.map(linearToSrgb) : ch.map((v) => clamp255(v * 255)));
        return { kind: 'rgb', rgb: rgb as [number, number, number], alpha };
      }
      default:
        return { kind: 'unsupported', raw };
    }
  }
}

/**
 * Composite a possibly-translucent foreground over a known background.
 * Without this an `rgba(...)` text colour is measured at full strength, which
 * overstates its contrast.
 */
export function flatten(fg: ParsedColor, bg: [number, number, number]): [number, number, number] | null {
  if (fg.kind !== 'rgb') return null;
  if (fg.alpha >= 1) return fg.rgb;
  return fg.rgb.map((c, i) => clamp255(c * fg.alpha + bg[i] * (1 - fg.alpha))) as [number, number, number];
}

/** What the browser paints under a page whose html/body background is transparent. */
export const CANVAS_BASE: [number, number, number] = [255, 255, 255];

export interface EffectiveBackground {
  /** The composited sRGB background actually behind the text. */
  rgb: [number, number, number];
  /**
   * true when an opaque layer was found in the chain. false means `rgb` is the
   * white canvas default — a working assumption, not a measurement.
   */
  resolved: boolean;
  /**
   * Set when a layer carried a colour we could not decode. The chain is then
   * NOT gradeable: everything below that layer is unknown, so the caller must
   * report `unknown` rather than composite past it.
   */
  unsupported?: string;
}

/**
 * Composite an element's background chain down to one concrete sRGB colour.
 *
 * `chain[0]` is the element's own `background-color`; each later entry is the
 * next ancestor going up. Transparent layers contribute nothing and are skipped;
 * translucent layers are alpha-composited; the walk stops at the first opaque
 * layer. With no opaque layer anywhere the browser canvas (white) is the base
 * and `resolved` is false.
 *
 * WHY THE `unsupported` ARM MATTERS: a text element almost always has
 * `background-color: rgba(0, 0, 0, 0)`, so its effective background lives on
 * some ancestor. If that ancestor's colour is a format the parser cannot read,
 * silently falling through to white invents a measurement. Returning
 * `unsupported` forces the caller to say "not checked" instead.
 */
export function resolveEffectiveBackground(chain: readonly string[]): EffectiveBackground {
  const layers: Array<{ rgb: [number, number, number]; alpha: number }> = [];

  for (const raw of chain) {
    const parsed = parseColor(raw);
    if (parsed.kind === 'unsupported') {
      return { rgb: CANVAS_BASE, resolved: false, unsupported: parsed.raw };
    }
    if (parsed.kind === 'none') continue;
    layers.push({ rgb: parsed.rgb, alpha: parsed.alpha });
    if (parsed.alpha >= 1) break;
  }

  const bottom = layers[layers.length - 1];
  const resolved = bottom !== undefined && bottom.alpha >= 1;

  // Paint from the bottom-most layer upward so each translucent layer composites
  // over everything already behind it.
  let acc: [number, number, number] = resolved ? bottom.rgb : CANVAS_BASE;
  for (let i = resolved ? layers.length - 2 : layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    acc = layer.rgb.map((c, ch) =>
      clamp255(c * layer.alpha + acc[ch] * (1 - layer.alpha)),
    ) as [number, number, number];
  }

  return { rgb: acc, resolved };
}
