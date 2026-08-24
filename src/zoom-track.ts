/**
 * Zoom track — turn scanned element geometry into a spatial zoom signal.
 *
 * WHY THIS EXISTS. Spectra's `auto-zoom.ts` derives WHEN a recording is active
 * from ffmpeg scene-change scoring, and says so in its own words: the signal is
 * "TEMPORAL-ONLY … not where on screen the motion is". Every synthesized zoom
 * therefore anchors at a fixed point, defaulting to dead centre (0.5, 0.5).
 *
 * IBR already knows where things are. A scan returns every element's bounds,
 * its accessible text, and its computed styles. Converting those bounds into
 * Spectra's existing `ZoomClick { tMs, cx, cy }` shape gives the zoom a real
 * spatial target — "zoom to the Submit button", not "zoom to the middle".
 *
 * No change is needed on the Spectra side: `buildZoomTrack()` already accepts
 * this shape and `polish.ts` already accepts it via `--clicks-json`. The only
 * missing piece was a producer, which is all this module is.
 */

import { parseColor } from './rules/color-parse.js';

/** Spectra's ZoomClick. cx/cy are viewport FRACTIONS, not pixels. */
export interface ZoomClick {
  tMs: number;
  cx: number;
  cy: number;
  /**
   * Scroll offset in CSS pixels at which cx/cy are valid.
   *
   * Spectra's ZoomClick does not define this and ignores it, which is exactly
   * why it is safe to carry: a consumer that scrolls can use it, and one that
   * does not is unaffected. Without it a track can only ever describe the first
   * screenful, because `bounds` is document-relative and anything lower yields
   * a cy above 1 — a point outside the frame.
   */
  scrollY?: number;
}

/**
 * A ZoomClick enriched with what the element IS, not just where it is.
 *
 * Spectra ignores every field beyond {tMs,cx,cy}, so these ride along for free
 * and unlock the two things geometry alone cannot do: caption a moment with the
 * text actually on screen, and recolor or restyle a region in editing because
 * the current colour is known rather than sampled from pixels.
 */
export interface LabelledZoomClick extends ZoomClick {
  label: string;
  /** Element text, verbatim, untruncated — captions need the real string. */
  text: string;
  role: string;
  /** Importance 0..1. Higher wins when --max trims the track. */
  weight: number;
  /** Raw computed values, exactly as the browser reported them (may be oklch). */
  color?: string;
  backgroundColor?: string;
  /** The same colours resolved to #rrggbb, or undefined when undecodable.
   *  Undecodable is left UNDEFINED rather than defaulted — a wrong colour in an
   *  edit is worse than a missing one. */
  colorHex?: string;
  backgroundColorHex?: string;
}

export interface TimedEvent {
  tMs: number;
  /** Matched case-insensitively against an element's text, then its selector. */
  label: string;
}

export interface ZoomTrackResult {
  clicks: LabelledZoomClick[];
  viewport: { width: number; height: number };
  /** Elements seen before the interactive filter — separates "page was empty"
   *  from "nothing on the page was interactive". */
  elementsConsidered: number;
  /** Targets dropped by --max, lowest weight first. */
  trimmed: number;
  /** Interactive elements dropped for a reason other than scroll position
   *  (zero area, malformed bounds, horizontal overflow). */
  offscreenSkipped: number;
  /** Estimated document height used to clamp scrollY. Derived from the furthest
   *  element extent, so it is a FLOOR, not a measurement — the scan does not
   *  report page height. */
  estimatedDocHeight: number;
  /** Events supplied but matched to no element. Non-empty means the caller's
   *  timing source and the scanned page disagree, which is worth saying out
   *  loud rather than silently falling back to even spacing. */
  unmatchedEvents: string[];
}

interface Bounds { x: number; y: number; width: number; height: number }

interface ScanElement {
  bounds?: Bounds;
  computedStyles?: Record<string, string>;
  text?: string;
  selector?: string;
  tagName?: string;
  interactive?: {
    hasOnClick?: boolean;
    hasHref?: boolean;
    isDisabled?: boolean;
    tabIndex?: number | null;
    cursor?: string;
  };
}

const INTERACTIVE_TAGS = new Set(['button', 'a', 'input', 'select', 'textarea']);

/**
 * Importance by role. A track trimmed by --max should keep the primary action,
 * not whichever element happened to be scanned first.
 *
 * NOTE: headings are absent because the scan cannot supply them WITH GEOMETRY.
 * `sensors.hierarchy` reports h1-h6 text and counts but no bounds, and
 * `elements.all` is populated from INTERACTIVE_SELECTORS (src/extract.ts), which
 * by design excludes headings. Ranking by heading level needs a content-element
 * extraction that does not exist yet — see docs/AGENTS-QUICKSTART.md.
 */
const ROLE_WEIGHT: Record<string, number> = {
  button: 1.0,
  a: 0.7,
  select: 0.6,
  textarea: 0.6,
  input: 0.5,
  summary: 0.4,
};

/**
 * Is this element worth zooming to?
 *
 * NOTE THE SHAPE. IBR reports interactivity as SIGNALS — hasOnClick, hasHref,
 * cursor, tabIndex, isDisabled — never as a single `isInteractive` boolean.
 * Reading a field by that name yields `undefined`, which is falsy, which
 * silently filters out every element and produces an empty track with no error.
 * That exact mistake cost an hour during the spike this module came from.
 */
export function isInteractiveElement(el: ScanElement): boolean {
  const ia = el.interactive ?? {};
  if (ia.isDisabled) return false;
  const tag = (el.tagName ?? '').toLowerCase();
  return (
    INTERACTIVE_TAGS.has(tag)
    || ia.hasOnClick === true
    || ia.hasHref === true
    || ia.cursor === 'pointer'
    || (typeof ia.tabIndex === 'number' && ia.tabIndex >= 0)
  );
}

/**
 * Build a zoom track from a scan result.
 *
 * `perMs` spaces the targets evenly. A recording's real timing is not knowable
 * from a static scan, so this is a starting track a human or a later pass can
 * retime — not a claim about when anything happened.
 */
export function buildZoomTrackFromScan(
  scan: unknown,
  opts: { perMs?: number; events?: TimedEvent[]; max?: number } = {},
): ZoomTrackResult {
  const perMs = opts.perMs ?? 1500;
  const events = opts.events ?? [];
  const root = (scan ?? {}) as Record<string, any>;

  const vpRaw = root.viewport ?? {};
  const width = Number(vpRaw.width) > 0 ? Number(vpRaw.width) : 1920;
  const height = Number(vpRaw.height) > 0 ? Number(vpRaw.height) : 1080;

  const all: ScanElement[] = Array.isArray(root?.elements?.all) ? root.elements.all : [];

  // The scan does not report document height, so estimate it from the furthest
  // element extent. This is a FLOOR — real content may extend past the last
  // element we saw — and it is used only to stop scrollY running past the end
  // of a document, where a browser would clamp anyway.
  let estimatedDocHeight = height;
  for (const el of all) {
    const b = el.bounds;
    if (b && Number.isFinite(b.y) && Number.isFinite(b.height)) {
      estimatedDocHeight = Math.max(estimatedDocHeight, b.y + b.height);
    }
  }
  const maxScroll = Math.max(0, estimatedDocHeight - height);

  const clicks: LabelledZoomClick[] = [];
  const seen = new Set<string>();
  let offscreenSkipped = 0;
  const usedEvents = new Set<number>();

  for (const el of all) {
    const b = el.bounds;
    if (!b) continue;
    const { x, y, width: w, height: h } = b;
    if (![x, y, w, h].every((n) => Number.isFinite(n))) continue;
    if (w <= 0 || h <= 0) continue;          // zero-area cannot be aimed at
    if (!isInteractiveElement(el)) continue; // a wrapper div teaches nothing

    // `bounds` is DOCUMENT-relative. Rather than discard everything below the
    // fold — which limited a track to the first screenful — compute the scroll
    // offset that brings the element into view, then express cx/cy relative to
    // THAT viewport. One scan therefore covers the whole page.
    //
    // Centre the element where the document allows it. Near the top or bottom a
    // browser cannot scroll further, so the element sits off-centre and cy
    // reflects where it actually lands.
    const centreX = x + w / 2;
    const centreY = y + h / 2;
    const scrollY = clamp(centreY - height / 2, 0, maxScroll);

    const cxRaw = centreX / width;
    const cyRaw = (centreY - scrollY) / height;

    // Horizontal overflow has no equivalent fix here: this command emits no
    // horizontal scroll, so a target off the side of the viewport is genuinely
    // unreachable and is dropped and counted.
    if (cxRaw < 0 || cxRaw > 1 || cyRaw < 0 || cyRaw > 1) {
      offscreenSkipped += 1;
      continue;
    }

    const text = (el.text ?? '').trim();
    const label = (text || el.selector || '').slice(0, 40);
    const role = (el.tagName ?? '').toLowerCase();

    // Importance = role, nudged by how much of the viewport the element covers.
    // Area is a weak signal on its own (a full-width nav bar is not the primary
    // action) so it only ever adjusts, never dominates.
    const areaFrac = Math.min(1, (w * h) / (width * height));
    const weight = round4(Math.min(1, (ROLE_WEIGHT[role] ?? 0.3) + areaFrac * 0.2));

    const cs = el.computedStyles ?? {};
    const key = `${Math.round(x)},${Math.round(y)},${label}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Timing: a real timestamp when the caller supplied one for this element,
    // otherwise even spacing. Even spacing is a PLACEHOLDER — a static scan
    // cannot know when anything happened in a recording — so a caller with real
    // event times should always pass them.
    const evIdx = events.findIndex((e, i) =>
      !usedEvents.has(i) && matchesLabel(e.label, label, el.selector));
    if (evIdx >= 0) usedEvents.add(evIdx);
    const tMs = evIdx >= 0 ? events[evIdx].tMs : clicks.length * perMs;

    clicks.push({
      tMs,
      cx: round4(cxRaw),
      cy: round4(cyRaw),
      scrollY: Math.round(scrollY),
      label,
      text,
      role,
      weight,
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      colorHex: toHex(cs.color),
      backgroundColorHex: toHex(cs.backgroundColor),
    });
  }

  // Trim by IMPORTANCE, then restore time order. Emitting every interactive
  // element gives a real page dozens of zooms, which is unusable; dropping the
  // tail in scan order would keep whatever came first rather than what matters.
  let kept = clicks;
  let trimmed = 0;
  if (opts.max !== undefined && opts.max > 0 && clicks.length > opts.max) {
    kept = [...clicks].sort((a, b) => b.weight - a.weight).slice(0, opts.max);
    trimmed = clicks.length - kept.length;
  }
  kept.sort((a, b) => a.tMs - b.tMs);
  const unmatchedEvents = events.filter((_, i) => !usedEvents.has(i)).map((e) => e.label);

  return {
    clicks: kept,
    trimmed,
    viewport: { width, height },
    elementsConsidered: all.length,
    offscreenSkipped,
    estimatedDocHeight,
    unmatchedEvents,
  };
}

/**
 * Resolve a computed colour to #rrggbb, reusing the rule engine's parser so
 * oklch/oklab/lch/lab/hsl all decode — the same parser gap that made a Tailwind
 * v4 page scan as clean while nothing was measured.
 *
 * Returns undefined when the value cannot be decoded. Deliberately NOT a
 * fallback colour: an edit applied against an invented colour is worse than one
 * the caller knows it has to resolve itself.
 */
function toHex(css: string | undefined): string | undefined {
  if (!css) return undefined;
  const parsed = parseColor(css);
  if (parsed.kind !== 'rgb') return undefined;
  return '#' + parsed.rgb.map((c) => c.toString(16).padStart(2, '0')).join('');
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Match an event label to an element by text, then selector. Case-insensitive. */
function matchesLabel(eventLabel: string, text: string, selector?: string): boolean {
  const needle = eventLabel.trim().toLowerCase();
  if (!needle) return false;
  if (text.trim().toLowerCase() === needle) return true;
  return (selector ?? '').trim().toLowerCase() === needle;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/** Strip the label so the payload is exactly Spectra's ZoomClick shape. */
export function toSpectraClicks(clicks: LabelledZoomClick[]): ZoomClick[] {
  return clicks.map(({ tMs, cx, cy }) => ({ tMs, cx, cy }));
}
