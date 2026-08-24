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
}

/** A ZoomClick plus the label it came from — useful for logs, not for Spectra. */
export interface LabelledZoomClick extends ZoomClick {
  label: string;
}

export interface ZoomTrackResult {
  clicks: LabelledZoomClick[];
  viewport: { width: number; height: number };
  /** Elements seen before the interactive filter — separates "page was empty"
   *  from "nothing on the page was interactive". */
  elementsConsidered: number;
  /** Interactive elements dropped because they sit outside the viewport. A
   *  non-zero count means the page scrolls and this track covers only what was
   *  visible without scrolling — the caller should know that, not discover it. */
  offscreenSkipped: number;
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
  opts: { perMs?: number } = {},
): ZoomTrackResult {
  const perMs = opts.perMs ?? 1500;
  const root = (scan ?? {}) as Record<string, any>;

  const vpRaw = root.viewport ?? {};
  const width = Number(vpRaw.width) > 0 ? Number(vpRaw.width) : 1920;
  const height = Number(vpRaw.height) > 0 ? Number(vpRaw.height) : 1080;

  const all: ScanElement[] = Array.isArray(root?.elements?.all) ? root.elements.all : [];

  const clicks: LabelledZoomClick[] = [];
  const seen = new Set<string>();
  let offscreenSkipped = 0;

  for (const el of all) {
    const b = el.bounds;
    if (!b) continue;
    const { x, y, width: w, height: h } = b;
    if (![x, y, w, h].every((n) => Number.isFinite(n))) continue;
    if (w <= 0 || h <= 0) continue;          // zero-area cannot be aimed at
    if (!isInteractiveElement(el)) continue; // a wrapper div teaches nothing

    // `bounds` is DOCUMENT-relative, so an element below the fold yields a cy
    // above 1 — on a 3-viewport-tall page the bottom button came back at
    // cy=3.01. As a zoom anchor that is not merely imprecise, it is outside the
    // frame entirely, and Spectra would aim the camera at nothing. Until this
    // command can emit a scroll position alongside each target, restrict the
    // track to what is on screen without scrolling and COUNT what that drops,
    // so a short track on a long page is visibly explained rather than silently
    // wrong.
    const cxRaw = (x + w / 2) / width;
    const cyRaw = (y + h / 2) / height;
    if (cxRaw < 0 || cxRaw > 1 || cyRaw < 0 || cyRaw > 1) {
      offscreenSkipped += 1;
      continue;
    }

    const label = (el.text ?? el.selector ?? '').trim().slice(0, 40);
    const key = `${Math.round(x)},${Math.round(y)},${label}`;
    if (seen.has(key)) continue;
    seen.add(key);

    clicks.push({
      tMs: clicks.length * perMs,
      cx: round4(cxRaw),
      cy: round4(cyRaw),
      label,
    });
  }

  return { clicks, viewport: { width, height }, elementsConsidered: all.length, offscreenSkipped };
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/** Strip the label so the payload is exactly Spectra's ZoomClick shape. */
export function toSpectraClicks(clicks: LabelledZoomClick[]): ZoomClick[] {
  return clicks.map(({ tMs, cx, cy }) => ({ tMs, cx, cy }));
}
