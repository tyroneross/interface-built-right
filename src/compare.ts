import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { CompareOptions } from './types.js';
import type { ComparisonResult, Analysis, ChangedRegion, Verdict, VerdictPolicy } from './schemas.js';
import { WEB_VERDICT_POLICY, resolveVerdictPolicy } from './verdict-policy.js';

/**
 * Region detection configuration
 * Divides page into semantic regions based on common layout patterns
 */
export interface RegionConfig {
  name: string;
  location: 'top' | 'bottom' | 'left' | 'right' | 'center' | 'full';
  // Percentages of page dimensions
  xStart: number;  // 0-1
  xEnd: number;    // 0-1
  yStart: number;  // 0-1
  yEnd: number;    // 0-1
}

/**
 * Default regions based on common web layouts
 * Header (top 10%), Footer (bottom 10%), Left sidebar (left 20%), Content (center)
 */
export const DEFAULT_REGIONS: RegionConfig[] = [
  { name: 'header', location: 'top', xStart: 0, xEnd: 1, yStart: 0, yEnd: 0.1 },
  { name: 'navigation', location: 'left', xStart: 0, xEnd: 0.2, yStart: 0.1, yEnd: 0.9 },
  { name: 'content', location: 'center', xStart: 0.2, xEnd: 1, yStart: 0.1, yEnd: 0.9 },
  { name: 'footer', location: 'bottom', xStart: 0, xEnd: 1, yStart: 0.9, yEnd: 1 },
];

/**
 * Neutral native regions — top / middle / bottom bands.
 *
 * Native (iOS / macOS) screenshots have no web left-navigation sidebar, so the
 * web DEFAULT_REGIONS (which name a `navigation` sidebar and can trigger
 * "inspect menu links" guidance) are wrong for them. These bands describe
 * position only, without pretending any band is semantic navigation. They
 * fully partition the frame vertically at full width, so per-region counts
 * still reconcile with the total mismatch count.
 */
export const NATIVE_REGIONS: RegionConfig[] = [
  { name: 'top', location: 'top', xStart: 0, xEnd: 1, yStart: 0, yEnd: 0.2 },
  { name: 'middle', location: 'center', xStart: 0, xEnd: 1, yStart: 0.2, yEnd: 0.8 },
  { name: 'bottom', location: 'bottom', xStart: 0, xEnd: 1, yStart: 0.8, yEnd: 1 },
];

/**
 * Whether a diff-image pixel is a pixelmatch-counted mismatch marker.
 *
 * Pixelmatch paints mismatches with `diffColor` (red) OR `diffColorAlt` (green,
 * the opposite brightness direction of change) — BOTH are counted differences.
 * Anti-aliased pixels use a distinct `aaColor` (yellow) and are excluded here.
 * Counting only red silently drops every green (darker-vs-lighter) change, so
 * this predicate is color-independent across both diff colors.
 */
export function isDiffMarker(data: Uint8Array, idx: number): boolean {
  const r = data[idx];
  const g = data[idx + 1];
  const b = data[idx + 2];
  // diffColor [255,0,0] (red) or diffColorAlt [0,255,0] (green)
  return (r === 255 && g === 0 && b === 0) || (r === 0 && g === 255 && b === 0);
}

/**
 * Raw mismatch counts per region, color-independent.
 *
 * A `mask` (1 per counted diff pixel) is preferred when available — it is the
 * single source of truth and cannot drift from the diff-image palette. When no
 * mask is given, counts are derived from the diff image via {@link isDiffMarker}
 * (red OR green). Regions that fully partition the frame sum to the total
 * mismatch count.
 */
export function regionalDiffCounts(
  diffData: Uint8Array,
  width: number,
  height: number,
  regions: RegionConfig[] = DEFAULT_REGIONS,
  mask?: Uint8Array
): Array<{ region: RegionConfig; diffPixels: number; regionPixels: number }> {
  return regions.map((region) => {
    const xStart = Math.floor(region.xStart * width);
    const xEnd = Math.floor(region.xEnd * width);
    const yStart = Math.floor(region.yStart * height);
    const yEnd = Math.floor(region.yEnd * height);

    const regionPixels = (xEnd - xStart) * (yEnd - yStart);
    let diffPixels = 0;

    for (let y = yStart; y < yEnd; y++) {
      for (let x = xStart; x < xEnd; x++) {
        const pos = y * width + x;
        if (mask) {
          if (mask[pos]) diffPixels++;
        } else if (isDiffMarker(diffData, pos * 4)) {
          diffPixels++;
        }
      }
    }

    return { region, diffPixels, regionPixels };
  });
}

/**
 * Analyze diff image to detect which regions have changes.
 *
 * Counting is color-independent (red OR green) so darker-vs-lighter changes are
 * never dropped. Pass an explicit `mask` (from {@link compareImages}) to count
 * from the mismatch mask instead of re-reading the diff palette.
 *
 * All numeric boundaries — the report floor and the severity bands — are read
 * from the {@link VerdictPolicy} argument, never from inline literals, so they
 * carry provenance and are tunable per call/project/app-type.
 */
export function detectChangedRegions(
  diffData: Uint8Array,
  width: number,
  height: number,
  regions: RegionConfig[] = DEFAULT_REGIONS,
  mask?: Uint8Array,
  policy: VerdictPolicy = WEB_VERDICT_POLICY
): ChangedRegion[] {
  const changedRegions: ChangedRegion[] = [];
  const reportFloor = policy.regionReportFloorPercent.value;
  const criticalBand = policy.regionCriticalPercent.value;
  const unexpectedBand = policy.regionUnexpectedPercent.value;

  for (const { region, diffPixels, regionPixels } of regionalDiffCounts(diffData, width, height, regions, mask)) {
    if (regionPixels === 0) continue;

    const xStart = Math.floor(region.xStart * width);
    const yStart = Math.floor(region.yStart * height);
    const regionWidth = Math.floor(region.xEnd * width) - xStart;
    const regionHeight = Math.floor(region.yEnd * height) - yStart;

    const diffPercent = (diffPixels / regionPixels) * 100;

    // Report regions whose change exceeds the policy noise floor.
    if (diffPercent > reportFloor) {
      const severity = diffPercent > criticalBand ? 'critical' :
                       diffPercent > unexpectedBand ? 'unexpected' : 'expected';

      changedRegions.push({
        location: region.location,
        bounds: {
          x: xStart,
          y: yStart,
          width: regionWidth,
          height: regionHeight,
        },
        description: `${region.name}: ${diffPercent.toFixed(1)}% changed`,
        // Structured raw measurement — same number as in `description`, exposed
        // numerically so an agent can re-judge severity under a different policy.
        diffPercent,
        severity,
      });
    }
  }

  // Sort by severity (critical first) then by diff percentage
  return changedRegions.sort((a, b) => {
    const severityOrder = { critical: 0, unexpected: 1, expected: 2 };
    const aSev = severityOrder[a.severity];
    const bSev = severityOrder[b.severity];
    if (aSev !== bSev) return aSev - bSev;

    // Parse percentage from description for secondary sort
    const aPercent = parseFloat(a.description.match(/(\d+\.?\d*)%/)?.[1] || '0');
    const bPercent = parseFloat(b.description.match(/(\d+\.?\d*)%/)?.[1] || '0');
    return bPercent - aPercent;
  });
}

/**
 * Extended comparison result with diff image data for regional analysis
 */
export interface ExtendedComparisonResult extends ComparisonResult {
  diffData?: Uint8Array;
  /** Mismatch mask — 1 per pixelmatch-counted diff pixel (red OR green), 0 otherwise. */
  diffMask?: Uint8Array;
  width?: number;
  height?: number;
}

/**
 * Compare two images using pixelmatch.
 *
 * `pixelColorThreshold` (0-1) is Pixelmatch's per-pixel color sensitivity
 * (lower = stricter). It is NOT the verdict tolerance — that is a separate
 * percentage handled by {@link analyzeComparison}. The deprecated `threshold`
 * option is accepted as a backward-compatible alias for `pixelColorThreshold`.
 */
export async function compareImages(options: CompareOptions): Promise<ExtendedComparisonResult> {
  const {
    baselinePath,
    currentPath,
    diffPath,
  } = options;

  // Pixelmatch per-pixel color sensitivity (0-1). Prefer the explicit new
  // option; fall back to the deprecated `threshold` alias; default to
  // Pixelmatch-normal 0.1. This is decoupled from verdict tolerance so the
  // measured diff percent no longer moves when a caller changes tolerance.
  const pixelColorThreshold = options.pixelColorThreshold ?? options.threshold ?? 0.1;

  // Read images
  const [baselineBuffer, currentBuffer] = await Promise.all([
    readFile(baselinePath),
    readFile(currentPath),
  ]);

  const baseline = PNG.sync.read(baselineBuffer);
  const current = PNG.sync.read(currentBuffer);

  // Ensure images have same dimensions
  if (baseline.width !== current.width || baseline.height !== current.height) {
    throw new Error(
      `Image dimensions mismatch: baseline (${baseline.width}x${baseline.height}) vs current (${current.width}x${current.height})`
    );
  }

  const { width, height } = baseline;
  const diff = new PNG({ width, height });
  const totalPixels = width * height;

  // Run pixelmatch
  const diffPixels = pixelmatch(
    baseline.data,
    current.data,
    diff.data,
    width,
    height,
    {
      threshold: pixelColorThreshold,
      includeAA: false, // Anti-aliased pixels painted with aaColor, not counted
      alpha: 0.1,
      diffColor: [255, 0, 0],    // Mismatch (one brightness direction)
      diffColorAlt: [0, 255, 0], // Mismatch (opposite brightness direction) — NOT anti-aliasing
      aaColor: [255, 255, 0],    // Anti-aliased pixels (excluded from mismatch counting)
    }
  );

  // Build a color-independent mismatch mask so regional analysis counts every
  // pixelmatch-counted change (red AND green), not just red. The mask is the
  // single source of truth and reconciles with diffPixels by construction.
  const diffMask = new Uint8Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    if (isDiffMarker(diff.data, i * 4)) diffMask[i] = 1;
  }

  // Ensure output directory exists
  await mkdir(dirname(diffPath), { recursive: true });

  // Write diff image
  await writeFile(diffPath, PNG.sync.write(diff));

  const diffPercent = (diffPixels / totalPixels) * 100;

  return {
    match: diffPixels === 0,
    diffPercent: Math.round(diffPercent * 100) / 100, // Round to 2 decimal places
    diffPixels,
    totalPixels,
    threshold: pixelColorThreshold, // back-compat: threshold mirrors the pixel sensitivity used
    pixelColorThreshold,
    // Include diff data + mask for regional analysis
    diffData: diff.data,
    diffMask,
    width,
    height,
  };
}

/**
 * Analyze comparison result and generate verdict with regional analysis.
 *
 * Every numeric boundary flows from the resolved {@link VerdictPolicy}; this
 * function contains no inline threshold literals. The `allowedDiffPercent`
 * shorthand (kept for back-compat with existing callers) is folded onto the
 * policy as a per-call verdict-tolerance override.
 *
 * Verdict tolerance now genuinely GATES the EXPECTED↔UNEXPECTED decision
 * (previously it only shaped the summary wording): an overall change at or below
 * tolerance stays EXPECTED and is never escalated to UNEXPECTED, so raising
 * tolerance can only relax the verdict, never tighten it. Critical regions still
 * drive LAYOUT_BROKEN independently of tolerance — a broken layout is never
 * silenced by a high tolerance.
 *
 * @param allowedDiffPercent Optional per-call verdict-tolerance override. When
 *   omitted, `policy.allowedDiffPercent.value` is used.
 * @param policy Resolved verdict policy (defaults to the web preset).
 */
export function analyzeComparison(
  result: ExtendedComparisonResult,
  allowedDiffPercent?: number,
  regions: RegionConfig[] = DEFAULT_REGIONS,
  policy: VerdictPolicy = WEB_VERDICT_POLICY
): Analysis {
  const { match, diffPercent, diffData, diffMask, width, height } = result;

  // Fold the allowedDiffPercent shorthand onto the policy so there is a single
  // resolved source of truth for every boundary, and echo it back to the caller.
  const effective: VerdictPolicy = allowedDiffPercent === undefined
    ? policy
    : resolveVerdictPolicy(policy, { allowedDiffPercent });

  const tolerance = effective.allowedDiffPercent.value;
  const unexpectedOverall = effective.unexpectedOverallPercent.value;

  // Detect changed regions if diff data is available. Prefer the mismatch mask
  // (counts red AND green) and honor caller-supplied region semantics (e.g.
  // NATIVE_REGIONS for native screenshots — no web navigation sidebar).
  let detectedRegions: ChangedRegion[] = [];
  if (diffData && width && height && !match) {
    detectedRegions = detectChangedRegions(diffData, width, height, regions, diffMask, effective);
  }

  // Analyze regions for verdict determination
  const criticalRegions = detectedRegions.filter(r => r.severity === 'critical');
  const unexpectedRegions = detectedRegions.filter(r => r.severity === 'unexpected');
  const hasNavigationChanges = detectedRegions.some(r =>
    r.description.toLowerCase().includes('navigation') ||
    r.description.toLowerCase().includes('header')
  );

  // Verdict tolerance gate: a change within tolerance can never be escalated to
  // UNEXPECTED. This makes raising tolerance monotonically relaxing.
  const withinTolerance = diffPercent <= tolerance;

  // Determine verdict based on regions and overall diff
  let verdict: Verdict;
  let summary: string;
  let recommendation: string | null = null;

  if (match || diffPercent === 0) {
    verdict = 'MATCH';
    summary = 'No visual changes detected. Screenshots are identical.';
  } else if (criticalRegions.length > 0) {
    verdict = 'LAYOUT_BROKEN';
    const regionNames = criticalRegions.map(r =>
      r.description.split(':')[0]
    ).join(', ');
    summary = `Critical changes in: ${regionNames}. Layout may be broken.`;
    recommendation = `Major changes detected in ${regionNames}. Check for missing elements, broken layout, or loading errors.`;
  } else if (!withinTolerance && (unexpectedRegions.length > 0 || diffPercent > unexpectedOverall)) {
    verdict = 'UNEXPECTED_CHANGE';
    const regionNames = unexpectedRegions.length > 0
      ? unexpectedRegions.map(r => r.description.split(':')[0]).join(', ')
      : 'multiple areas';
    summary = `Significant changes in: ${regionNames} (${diffPercent}% overall).`;
    recommendation = hasNavigationChanges
      ? 'Navigation area changed - verify menu items and links are correct.'
      : 'Review changes carefully - some may be unintentional.';
  } else if (withinTolerance) {
    verdict = 'EXPECTED_CHANGE';
    summary = `Minor changes detected (${diffPercent}%). Within acceptable threshold.`;
  } else {
    verdict = 'EXPECTED_CHANGE';
    const regionNames = detectedRegions.length > 0
      ? detectedRegions.map(r => r.description.split(':')[0]).join(', ')
      : 'content area';
    summary = `Changes in: ${regionNames} (${diffPercent}% overall). Changes appear intentional.`;
  }

  // Separate expected vs unexpected changes
  const changedRegions = detectedRegions.filter(r => r.severity === 'expected');
  const unexpectedChanges = detectedRegions.filter(r =>
    r.severity === 'unexpected' || r.severity === 'critical'
  );

  // If no regions detected but there are changes, create a fallback region
  if (detectedRegions.length === 0 && !match) {
    const fallbackRegion: ChangedRegion = {
      location: diffPercent > effective.fullFrameFallbackPercent.value ? 'full' : 'center',
      bounds: { x: 0, y: 0, width: width || 0, height: height || 0 },
      description: `overall: ${diffPercent}% changed`,
      diffPercent,
      severity: verdict === 'LAYOUT_BROKEN' ? 'critical' :
                verdict === 'UNEXPECTED_CHANGE' ? 'unexpected' : 'expected',
    };

    if (verdict === 'UNEXPECTED_CHANGE' || verdict === 'LAYOUT_BROKEN') {
      unexpectedChanges.push(fallbackRegion);
    } else {
      changedRegions.push(fallbackRegion);
    }
  }

  return {
    verdict,
    summary,
    changedRegions,
    unexpectedChanges,
    recommendation,
    // Echo the applied policy (values + basis + rationale) so downstream agents
    // can see which boundaries drove the verdict and re-judge under different
    // thresholds without re-running the comparison.
    policy: effective,
  };
}

/**
 * Get a human-readable verdict description
 */
export function getVerdictDescription(verdict: Verdict): string {
  switch (verdict) {
    case 'MATCH':
      return 'No changes - screenshots match';
    case 'EXPECTED_CHANGE':
      return 'Changes detected - appear intentional';
    case 'UNEXPECTED_CHANGE':
      return 'Unexpected changes - review required';
    case 'LAYOUT_BROKEN':
      return 'Layout broken - significant issues detected';
    default:
      return 'Unknown verdict';
  }
}
