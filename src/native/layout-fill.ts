/**
 * Native layout-fill / gap analyzer.
 *
 * Catches the bug class: a content element rendered narrow and CENTERED inside
 * its container, leaving large empty gutters — invisible to a screenshot, but
 * obvious from element frames. The Swift extractor already captures position +
 * size for every element; this pure function reads that tree and reports, per
 * container, the largest empty horizontal and vertical band as both pixels and
 * % of the container's extent on that axis, plus each element's % of the window.
 *
 * Why TS-side (not Swift-side):
 *   - The Swift extractor's JSON IS the input. The analyzer is unit-testable
 *     against a fixture tree without a live AX subsystem (AX/AppleEvent is
 *     wedged system-wide on this machine as of 2026-06-06; the bug missed by
 *     screenshot-only checks would also be missed if the test had to scan a
 *     live app).
 *   - Convention: IBR's native audit layer (rules.ts, semantic.ts) already
 *     analyzes extracted elements TS-side.
 *
 * Algorithm (per axis, per container):
 *   1. Take laid-out children (width AND height > 1px, both dimensions).
 *   2. Sort by minX (or minY) and merge overlapping spans.
 *   3. Measure the leading gap (container.minX → first span), each between-sibling
 *      gap, and the trailing gap (last span → container.maxX).
 *   4. Take the LARGEST single band (not the sum). Emit a finding when
 *      largest / container.dim >= threshold (default 0.12).
 *
 * The "largest single band" choice matters: two ~30% gutters around a centered
 * narrow element sum to ~60% empty, but each band individually is what the
 * design intended to fill OR not. Reporting the largest band is what makes the
 * finding actionable ("fix the leading band → the centering layout collapses").
 *
 * Backward-compatible: this is a pure additive module. No existing call sites
 * change shape; scan.ts opts in by calling analyzeLayoutFill().
 */

import type { MacOSAXElement } from './types.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface LayoutFillFinding {
  /** AX role of the container (e.g. "AXGroup", "AXSplitGroup") */
  containerRole: string;
  /** Best human-readable identifier — title || description || identifier || "" */
  containerLabel: string;
  axis: 'horizontal' | 'vertical';
  /** Largest single empty band in points */
  emptyPx: number;
  /** Largest single empty band as fraction of container extent on this axis (0..1) */
  emptyPct: number;
  /** Where the empty band sits relative to laid-out children */
  position: 'leading' | 'between' | 'trailing';
  containerWidth: number;
  containerHeight: number;
  /** Pre-formatted message suitable for surfacing as a ScanIssue.description */
  detail: string;
}

export interface LayoutFillOptions {
  /** Empty band must be ≥ this fraction of container width/height to emit. Default 0.12 */
  threshold?: number;
  /** Window bounds for relative-size reporting (optional) */
  window?: { width: number; height: number };
  /** Skip containers smaller than this (in points) on the analyzed axis */
  minContainerPx?: number;
  /** Maximum recursion depth (defensive) */
  maxDepth?: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function rectOf(el: MacOSAXElement): Rect | null {
  if (!el.position || !el.size) return null;
  if (el.size.width <= 0 || el.size.height <= 0) return null;
  return {
    x: el.position.x,
    y: el.position.y,
    width: el.size.width,
    height: el.size.height,
  };
}

function labelOf(el: MacOSAXElement): string {
  const candidates = [el.title, el.description, el.identifier, el.value];
  for (const c of candidates) {
    if (c && c.trim().length > 0) {
      const trimmed = c.trim();
      return trimmed.length > 40 ? trimmed.slice(0, 40) + '…' : trimmed;
    }
  }
  return '';
}

/**
 * Merge overlapping/touching 1-D spans. Input is sorted by .min ascending.
 */
function mergeSpans(spans: Array<[number, number]>): Array<[number, number]> {
  if (spans.length === 0) return [];
  const sorted = [...spans].sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const cur = sorted[i];
    if (cur[0] <= last[1]) {
      last[1] = Math.max(last[1], cur[1]);
    } else {
      merged.push([cur[0], cur[1]]);
    }
  }
  return merged;
}

/**
 * Find the largest single empty band along an axis given:
 *   container extent [min, max]
 *   laid-out children spans [[min,max], ...] (will be merged internally)
 * Returns the band size in points + its position relative to children.
 * Returns null when there are no children (no gap to report).
 */
function largestEmptyBand(
  min: number,
  max: number,
  spans: Array<[number, number]>
): { px: number; position: 'leading' | 'between' | 'trailing' } | null {
  if (spans.length === 0) return null;
  const merged = mergeSpans(spans);
  let best: { px: number; position: 'leading' | 'between' | 'trailing' } = {
    px: 0,
    position: 'leading',
  };

  // Leading: container.min → first span.min
  const leading = merged[0][0] - min;
  if (leading > best.px) best = { px: leading, position: 'leading' };

  // Between siblings
  for (let i = 1; i < merged.length; i++) {
    const gap = merged[i][0] - merged[i - 1][1];
    if (gap > best.px) best = { px: gap, position: 'between' };
  }

  // Trailing: last span.max → container.max
  const lastMax = merged[merged.length - 1][1];
  const trailing = max - lastMax;
  if (trailing > best.px) best = { px: trailing, position: 'trailing' };

  return best;
}

function formatDetail(
  containerRole: string,
  containerLabel: string,
  axis: 'horizontal' | 'vertical',
  position: 'leading' | 'between' | 'trailing',
  emptyPx: number,
  emptyPct: number,
  containerDim: number
): string {
  const lbl = containerLabel ? ` [${containerLabel}]` : '';
  const dimName = axis === 'horizontal' ? 'width' : 'height';
  return (
    `${containerRole}${lbl}: ${position} empty band ` +
    `${Math.round(emptyPx)}px = ${Math.round(emptyPct * 100)}% of ` +
    `container ${dimName} ${Math.round(containerDim)}px ` +
    `(${axis})`
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze an AX element tree for fill / gap violations.
 *
 * Walks the entire tree (depth-first). For every container with laid-out
 * children, emits a LayoutFillFinding for each axis whose largest single empty
 * band ≥ threshold. Containers with no children, zero-size containers, and
 * containers below `minContainerPx` are skipped.
 *
 * Pure function — no I/O, no AX dependency. Testable against a fixture tree.
 */
export function analyzeLayoutFill(
  roots: MacOSAXElement[],
  options: LayoutFillOptions = {}
): LayoutFillFinding[] {
  const threshold = options.threshold ?? 0.12;
  const minContainerPx = options.minContainerPx ?? 50;
  const maxDepth = options.maxDepth ?? 20;
  const findings: LayoutFillFinding[] = [];

  function visit(el: MacOSAXElement, depth: number): void {
    if (depth >= maxDepth) return;

    const r = rectOf(el);
    if (r) {
      // Only consider children with frames (laid-out elements).
      const laidOutKids = el.children.filter((k) => rectOf(k) !== null);

      if (laidOutKids.length >= 1) {
        // --- Horizontal axis ---
        if (r.width >= minContainerPx) {
          const xSpans: Array<[number, number]> = laidOutKids.map((k) => {
            const kr = rectOf(k)!;
            return [kr.x, kr.x + kr.width];
          });
          const band = largestEmptyBand(r.x, r.x + r.width, xSpans);
          if (band && band.px / r.width >= threshold) {
            const pct = band.px / r.width;
            findings.push({
              containerRole: el.role,
              containerLabel: labelOf(el),
              axis: 'horizontal',
              emptyPx: band.px,
              emptyPct: pct,
              position: band.position,
              containerWidth: r.width,
              containerHeight: r.height,
              detail: formatDetail(
                el.role,
                labelOf(el),
                'horizontal',
                band.position,
                band.px,
                pct,
                r.width
              ),
            });
          }
        }

        // --- Vertical axis ---
        if (r.height >= minContainerPx) {
          const ySpans: Array<[number, number]> = laidOutKids.map((k) => {
            const kr = rectOf(k)!;
            return [kr.y, kr.y + kr.height];
          });
          const band = largestEmptyBand(r.y, r.y + r.height, ySpans);
          if (band && band.px / r.height >= threshold) {
            const pct = band.px / r.height;
            findings.push({
              containerRole: el.role,
              containerLabel: labelOf(el),
              axis: 'vertical',
              emptyPx: band.px,
              emptyPct: pct,
              position: band.position,
              containerWidth: r.width,
              containerHeight: r.height,
              detail: formatDetail(
                el.role,
                labelOf(el),
                'vertical',
                band.position,
                band.px,
                pct,
                r.height
              ),
            });
          }
        }
      }
    }

    for (const c of el.children) visit(c, depth + 1);
  }

  for (const root of roots) visit(root, 0);

  // Highest-impact first.
  findings.sort((a, b) => b.emptyPct - a.emptyPct);
  return findings;
}

// ---------------------------------------------------------------------------
// Relative-size reporting
// ---------------------------------------------------------------------------

export interface ElementSizeReport {
  role: string;
  label: string;
  width: number;
  height: number;
  /** width / window.width (0..1) or null if window absent */
  widthPctOfWindow: number | null;
  /** height / window.height (0..1) or null if window absent */
  heightPctOfWindow: number | null;
  /** Index path inside the tree, e.g. [0, 2, 1] */
  path: number[];
}

/**
 * Flatten the AX tree into per-element size reports with % of window.
 * Useful as a secondary signal alongside layout-fill findings.
 */
export function reportElementSizes(
  roots: MacOSAXElement[],
  window?: { width: number; height: number }
): ElementSizeReport[] {
  const out: ElementSizeReport[] = [];

  function visit(el: MacOSAXElement): void {
    const r = rectOf(el);
    if (r) {
      out.push({
        role: el.role,
        label: labelOf(el),
        width: r.width,
        height: r.height,
        widthPctOfWindow:
          window && window.width > 0 ? r.width / window.width : null,
        heightPctOfWindow:
          window && window.height > 0 ? r.height / window.height : null,
        path: el.path,
      });
    }
    for (const c of el.children) visit(c);
  }

  for (const root of roots) visit(root);
  return out;
}
