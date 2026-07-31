/**
 * Per-element measurement of a LIVE, already-running page.
 *
 * Why this exists next to `src/obsidian/`: that path inlines a plugin's
 * `main.js` + `styles.css` into a generated page with a hand-written stub of
 * the Obsidian API and scans THAT. It never sees the host app's own `app.css`
 * cascade or its theme variables, so it structurally cannot catch a plugin rule
 * that loses the cascade to a host rule and never paints. This module attaches
 * to the real running app instead and reads what the app actually computed.
 *
 * Read-only by contract: it evaluates one expression that queries the DOM and
 * builds a detached (never appended) canvas for font metrics. It never
 * navigates, reloads, injects styles, or mutates the document.
 */

import {
  attachToLiveTarget,
  type LiveAttachOptions,
  type LiveTarget,
} from './attach.js';
import {
  aaThreshold,
  compositeOver,
  contrastRatio,
  formatRgba,
  isLargeText,
  parseCssColor,
  parseFontWeight,
  parsePx,
  resolveEffectiveBackground,
} from './color.js';

export interface LiveBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface LiveBoxModel {
  height: string;
  minHeight: string;
  maxHeight: string;
  width: string;
  minWidth: string;
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
  borderTopWidth: string;
  borderRightWidth: string;
  borderBottomWidth: string;
  borderLeftWidth: string;
  borderRadius: string;
  boxSizing: string;
}

export interface LiveTypography {
  fontSize: string;
  fontFamily: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  whiteSpace: string;
}

export interface LiveLayout {
  display: string;
  position: string;
  alignItems: string;
  alignSelf: string;
  justifyContent: string;
  flexGrow: string;
  flexShrink: string;
  flexBasis: string;
  gap: string;
  overflow: string;
  visibility: string;
  opacity: string;
}

export interface LiveColor {
  /** As Chrome computed it */
  color: string;
  backgroundColor: string;
  /**
   * The background actually visible behind this element's text: its own
   * background composited over each ancestor's until an opaque one is reached.
   * Obsidian controls are routinely fully transparent, which is exactly the
   * case where naive contrast code returns nothing.
   */
  effectiveBackgroundColor: string;
  /** True when an opaque background really was found; false means white was assumed. */
  effectiveBackgroundResolved: boolean;
  /** Element bg first, then each ancestor up to (and including) the opaque one. */
  backgroundChain: string[];
  /** `color` composited over `effectiveBackgroundColor` — what the eye sees. */
  resolvedTextColor: string | null;
  contrastRatio: number | null;
  passesAA: boolean | null;
  largeText: boolean;
  aaThreshold: number;
}

export interface LiveElementMeasurement {
  index: number;
  tagName: string;
  className: string;
  id: string;
  /** Trimmed, capped at 80 chars (with a trailing ellipsis when truncated). */
  textContent: string;
  /** null when the element has no `disabled` IDL attribute. */
  disabled: boolean | null;
  ariaDisabled: string | null;
  bounds: LiveBounds;
  box: LiveBoxModel;
  typography: LiveTypography;
  layout: LiveLayout;
  color: LiveColor;
  /**
   * Y of the first text baseline, in the same viewport coordinate space as
   * `bounds` (add `scrollY` for page coordinates). null when the element has no
   * rendered text or the font metrics were unavailable — never a guess.
   */
  firstLineBaselineY: number | null;
}

export interface LiveMeasureResult {
  ok: true;
  cdpUrl?: string;
  wsEndpoint: string;
  target: LiveTarget;
  selector: string;
  matched: number;
  page: {
    title: string;
    url: string;
    scrollX: number;
    scrollY: number;
    innerWidth: number;
    innerHeight: number;
    devicePixelRatio: number;
  };
  measuredAt: string;
  elements: LiveElementMeasurement[];
}

/** Raw, pre-color-math payload returned by the in-page collector. */
export interface RawLiveElement {
  index: number;
  tagName: string;
  className: string;
  id: string;
  textContent: string;
  disabled: boolean | null;
  ariaDisabled: string | null;
  bounds: LiveBounds;
  box: LiveBoxModel;
  typography: LiveTypography;
  layout: LiveLayout;
  colorRaw: string;
  backgroundColorRaw: string;
  colorNorm: string;
  backgroundChain: string[];
  backgroundChainResolved: boolean;
  firstLineBaselineY: number | null;
}

export interface RawLivePayload {
  ok: boolean;
  error?: string;
  page: LiveMeasureResult['page'];
  elements: RawLiveElement[];
}

export interface LiveMeasureOptions extends LiveAttachOptions {
  selector: string;
  /** Cap on measured elements. Default 200. */
  limit?: number;
}

const DEFAULT_LIMIT = 200;

/**
 * Build the single expression evaluated in the live page. Kept as a pure
 * function so it is unit-testable without a browser.
 *
 * It is written in ES5-flavoured JS on purpose (no template literals, no
 * optional chaining) so it survives any host Electron runtime and so this
 * TypeScript template literal never has to escape a `${`.
 */
export function buildMeasureExpression(selector: string, limit = DEFAULT_LIMIT): string {
  return `(function () {
  try {
    var SELECTOR = ${JSON.stringify(selector)};
    var LIMIT = ${JSON.stringify(limit)};
    var MAX_TEXT = 80;

    // Detached canvas. Created, never appended — the document is not mutated.
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext ? canvas.getContext('2d') : null;

    function norm(color) {
      if (!color) return '';
      if (!ctx) return color;
      try {
        ctx.fillStyle = '#000000';
        ctx.fillStyle = color;
        return String(ctx.fillStyle);
      } catch (e) {
        return color;
      }
    }

    function alphaOf(c) {
      if (!c) return 1;
      var m = /rgba\\(([^)]*)\\)/i.exec(c);
      if (m) {
        var parts = m[1].split(',');
        if (parts.length >= 4) {
          var a = parseFloat(parts[3]);
          return isNaN(a) ? 1 : a;
        }
      }
      if (/^#[0-9a-f]{8}$/i.test(c)) return parseInt(c.slice(7, 9), 16) / 255;
      return 1;
    }

    function backgroundChain(el) {
      var chain = [];
      var resolved = false;
      var node = el;
      var guard = 0;
      while (node && guard < 200) {
        guard++;
        var bg = norm(getComputedStyle(node).backgroundColor);
        chain.push(bg);
        if (alphaOf(bg) >= 1) { resolved = true; break; }
        node = node.parentElement;
      }
      return { chain: chain, resolved: resolved };
    }

    function baselineY(el) {
      if (!ctx) return null;
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
      var textNode = null;
      var n;
      while ((n = walker.nextNode())) {
        if (n.nodeValue && n.nodeValue.trim().length > 0) { textNode = n; break; }
      }
      if (!textNode) return null;

      var range = document.createRange();
      range.selectNodeContents(textNode);
      var rects = range.getClientRects();
      if (!rects || rects.length === 0) return null;
      var rect = null;
      for (var i = 0; i < rects.length; i++) {
        if (rects[i].height > 0) { rect = rects[i]; break; }
      }
      if (!rect) return null;

      var host = textNode.parentElement || el;
      var cs = getComputedStyle(host);
      var shorthand = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize
        + '/' + cs.lineHeight + ' ' + cs.fontFamily;
      var applied = false;
      try {
        ctx.font = '10px sans-serif';
        ctx.font = shorthand;
        applied = ctx.font !== '10px sans-serif';
      } catch (e) { applied = false; }
      if (!applied) {
        try {
          ctx.font = cs.fontSize + ' ' + cs.fontFamily;
          applied = true;
        } catch (e2) { applied = false; }
      }
      if (!applied) return null;

      var metrics = ctx.measureText(textNode.nodeValue.trim() || 'Hg');
      var asc = metrics.fontBoundingBoxAscent;
      var desc = metrics.fontBoundingBoxDescent;
      if (typeof asc !== 'number' || typeof desc !== 'number') return null;
      if (!isFinite(asc) || !isFinite(desc)) return null;

      // CSS half-leading: the font content box is centered in the line box, so
      // this is correct whether the range rect is the font box or the line box.
      var y = rect.top + (rect.height - (asc + desc)) / 2 + asc;
      if (!isFinite(y)) return null;
      return Math.round(y * 100) / 100;
    }

    function px(v) { return Math.round(v * 100) / 100; }

    var nodes = document.querySelectorAll(SELECTOR);
    var out = [];
    var count = Math.min(nodes.length, LIMIT);
    for (var k = 0; k < count; k++) {
      var el = nodes[k];
      var cs = getComputedStyle(el);
      var r = el.getBoundingClientRect();
      var text = (el.textContent || '').replace(/\\s+/g, ' ').trim();
      if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT - 1) + '\\u2026';
      var chain = backgroundChain(el);

      out.push({
        index: k,
        tagName: el.tagName.toLowerCase(),
        className: typeof el.className === 'string' ? el.className : String(el.getAttribute('class') || ''),
        id: el.id || '',
        textContent: text,
        disabled: ('disabled' in el) ? Boolean(el.disabled) : null,
        ariaDisabled: el.getAttribute('aria-disabled'),
        bounds: {
          x: px(r.x), y: px(r.y), width: px(r.width), height: px(r.height),
          top: px(r.top), right: px(r.right), bottom: px(r.bottom), left: px(r.left)
        },
        box: {
          height: cs.height, minHeight: cs.minHeight, maxHeight: cs.maxHeight,
          width: cs.width, minWidth: cs.minWidth,
          paddingTop: cs.paddingTop, paddingRight: cs.paddingRight,
          paddingBottom: cs.paddingBottom, paddingLeft: cs.paddingLeft,
          marginTop: cs.marginTop, marginRight: cs.marginRight,
          marginBottom: cs.marginBottom, marginLeft: cs.marginLeft,
          borderTopWidth: cs.borderTopWidth, borderRightWidth: cs.borderRightWidth,
          borderBottomWidth: cs.borderBottomWidth, borderLeftWidth: cs.borderLeftWidth,
          borderRadius: cs.borderRadius,
          boxSizing: cs.boxSizing
        },
        typography: {
          fontSize: cs.fontSize, fontFamily: cs.fontFamily, fontWeight: cs.fontWeight,
          lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing, whiteSpace: cs.whiteSpace
        },
        layout: {
          display: cs.display, position: cs.position,
          alignItems: cs.alignItems, alignSelf: cs.alignSelf,
          justifyContent: cs.justifyContent,
          flexGrow: cs.flexGrow, flexShrink: cs.flexShrink, flexBasis: cs.flexBasis,
          gap: cs.gap, overflow: cs.overflow,
          visibility: cs.visibility, opacity: cs.opacity
        },
        colorRaw: cs.color,
        backgroundColorRaw: cs.backgroundColor,
        colorNorm: norm(cs.color),
        backgroundChain: chain.chain,
        backgroundChainResolved: chain.resolved,
        firstLineBaselineY: baselineY(el)
      });
    }

    return {
      ok: true,
      page: {
        title: document.title,
        url: location.href,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio
      },
      elements: out
    };
  } catch (err) {
    return { ok: false, error: (err && err.message) ? err.message : String(err), page: null, elements: [] };
  }
})()`;
}

/**
 * Turn the raw in-page payload into finished measurements: composite the
 * background chain, composite translucent text over it, and grade contrast.
 * Pure — this is where the color math is unit-tested.
 */
export function finalizeMeasurements(raw: RawLiveElement[]): LiveElementMeasurement[] {
  return raw.map((el) => {
    const effective = resolveEffectiveBackground(el.backgroundChain);
    const fg = parseCssColor(el.colorNorm) ?? parseCssColor(el.colorRaw);
    const fontSizePx = parsePx(el.typography.fontSize) ?? Number.NaN;
    const weight = parseFontWeight(el.typography.fontWeight);
    const large = isLargeText(fontSizePx, weight);
    const threshold = aaThreshold(large);

    let resolvedTextColor: string | null = null;
    let ratio: number | null = null;
    let passesAA: boolean | null = null;
    if (fg) {
      const composited = compositeOver(fg, effective.color);
      resolvedTextColor = formatRgba(composited);
      ratio = contrastRatio(composited, effective.color);
      passesAA = ratio >= threshold;
    }

    return {
      index: el.index,
      tagName: el.tagName,
      className: el.className,
      id: el.id,
      textContent: el.textContent,
      disabled: el.disabled,
      ariaDisabled: el.ariaDisabled,
      bounds: el.bounds,
      box: el.box,
      typography: el.typography,
      layout: el.layout,
      color: {
        color: el.colorRaw,
        backgroundColor: el.backgroundColorRaw,
        effectiveBackgroundColor: formatRgba(effective.color),
        effectiveBackgroundResolved: effective.resolved,
        backgroundChain: el.backgroundChain,
        resolvedTextColor,
        contrastRatio: ratio,
        passesAA,
        largeText: large,
        aaThreshold: threshold,
      },
      firstLineBaselineY: el.firstLineBaselineY,
    };
  });
}

/**
 * Attach to a running app, measure everything matching `selector`, detach.
 * The page is left exactly as found.
 */
export async function measureLive(options: LiveMeasureOptions): Promise<LiveMeasureResult> {
  if (!options.selector || !options.selector.trim()) {
    throw new Error('A CSS selector is required (--selector).');
  }

  const attachment = await attachToLiveTarget(options);
  try {
    const payload = await attachment.evaluate<RawLivePayload | null>(
      buildMeasureExpression(options.selector, options.limit ?? DEFAULT_LIMIT),
    );

    if (!payload) {
      throw new Error('The live page returned nothing for the measurement expression.');
    }
    if (!payload.ok) {
      throw new Error(
        `Selector "${options.selector}" could not be evaluated in the live page: ${payload.error}`,
      );
    }

    return {
      ok: true,
      cdpUrl: attachment.cdpUrl,
      wsEndpoint: attachment.wsEndpoint,
      target: attachment.target,
      selector: options.selector,
      matched: payload.elements.length,
      page: payload.page,
      measuredAt: new Date().toISOString(),
      elements: finalizeMeasurements(payload.elements),
    };
  } finally {
    await attachment.release();
  }
}
