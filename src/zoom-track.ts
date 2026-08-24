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

/** A ZoomClick plus the label it came from — useful for logs, not for Spectra. */
export interface LabelledZoomClick extends ZoomClick {
  label: string;
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
  opts: { perMs?: number; events?: TimedEvent[] } = {},
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

    const label = (el.text ?? el.selector ?? '').trim().slice(0, 40);
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
    });
  }

  clicks.sort((a, b) => a.tMs - b.tMs);
  const unmatchedEvents = events.filter((_, i) => !usedEvents.has(i)).map((e) => e.label);

  return {
    clicks,
    viewport: { width, height },
    elementsConsidered: all.length,
    offscreenSkipped,
    estimatedDocHeight,
    unmatchedEvents,
  };
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
