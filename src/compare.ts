import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { CompareOptions } from './types.js';
import type { ComparisonResult, Analysis, ChangedRegion, Verdict } from './schemas.js';

/**
 * Region detection configuration
 * Divides page into semantic regions based on common layout patterns
 */
interface RegionConfig {
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
const DEFAULT_REGIONS: RegionConfig[] = [
  { name: 'header', location: 'top', xStart: 0, xEnd: 1, yStart: 0, yEnd: 0.1 },
  { name: 'navigation', location: 'left', xStart: 0, xEnd: 0.2, yStart: 0.1, yEnd: 0.9 },
  { name: 'content', location: 'center', xStart: 0.2, xEnd: 1, yStart: 0.1, yEnd: 0.9 },
  { name: 'footer', location: 'bottom', xStart: 0, xEnd: 1, yStart: 0.9, yEnd: 1 },
];

/**
 * Analyze diff image to detect which regions have changes
 */
export function detectChangedRegions(
  diffData: Uint8Array,
  width: number,
  height: number,
  regions: RegionConfig[] = DEFAULT_REGIONS
): ChangedRegion[] {
  const changedRegions: ChangedRegion[] = [];

  for (const region of regions) {
    // Calculate pixel bounds
    const xStart = Math.floor(region.xStart * width);
    const xEnd = Math.floor(region.xEnd * width);
    const yStart = Math.floor(region.yStart * height);
    const yEnd = Math.floor(region.yEnd * height);

    const regionWidth = xEnd - xStart;
    const regionHeight = yEnd - yStart;
    const regionPixels = regionWidth * regionHeight;

    if (regionPixels === 0) continue;

    // Count red pixels (diff color) in this region
    let diffPixels = 0;

    for (let y = yStart; y < yEnd; y++) {
      for (let x = xStart; x < xEnd; x++) {
        const idx = (y * width + x) * 4;
        // Check if pixel is red (diff marker from pixelmatch)
        // pixelmatch uses [255, 0, 0] for differences
        if (diffData[idx] === 255 && diffData[idx + 1] === 0 && diffData[idx + 2] === 0) {
          diffPixels++;
        }
      }
    }

    const diffPercent = (diffPixels / regionPixels) * 100;

    // Only report regions with >0.1% changes
    if (diffPercent > 0.1) {
      const severity = diffPercent > 30 ? 'critical' :
                       diffPercent > 10 ? 'unexpected' : 'expected';

      changedRegions.push({
        location: region.location,
        bounds: {
          x: xStart,
          y: yStart,
          width: regionWidth,
          height: regionHeight,
        },
        description: `${region.name}: ${diffPercent.toFixed(1)}% changed`,
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
  width?: number;
  height?: number;
}

/**
 * Compare two images using pixelmatch
 */
export async function compareImages(options: CompareOptions): Promise<ExtendedComparisonResult> {
  const {
    baselinePath,
    currentPath,
    diffPath,
    threshold = 0.1, // pixelmatch threshold (0-1), lower = stricter
  } = options;

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
      threshold,
      includeAA: false, // Ignore anti-aliasing differences
      alpha: 0.1,
      diffColor: [255, 0, 0], // Red for differences
      diffColorAlt: [0, 255, 0], // Green for anti-aliased differences
    }
  );

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
    threshold,
    // Include diff data for regional analysis
    diffData: diff.data,
    width,
    height,
  };
}

/**
 * Analyze comparison result and generate verdict with regional analysis
 */
export function analyzeComparison(
  result: ExtendedComparisonResult,
  thresholdPercent: number = 1.0
): Analysis {
  const { match, diffPercent, diffData, width, height } = result;

  // Detect changed regions if diff data is available
  let detectedRegions: ChangedRegion[] = [];
  if (diffData && width && height && !match) {
    detectedRegions = detectChangedRegions(diffData, width, height);
  }

  // Analyze regions for verdict determination
  const criticalRegions = detectedRegions.filter(r => r.severity === 'critical');
  const unexpectedRegions = detectedRegions.filter(r => r.severity === 'unexpected');
  const hasNavigationChanges = detectedRegions.some(r =>
    r.description.toLowerCase().includes('navigation') ||
    r.description.toLowerCase().includes('header')
  );

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
  } else if (unexpectedRegions.length > 0 || diffPercent > 20) {
    verdict = 'UNEXPECTED_CHANGE';
    const regionNames = unexpectedRegions.length > 0
      ? unexpectedRegions.map(r => r.description.split(':')[0]).join(', ')
      : 'multiple areas';
    summary = `Significant changes in: ${regionNames} (${diffPercent}% overall).`;
    recommendation = hasNavigationChanges
      ? 'Navigation area changed - verify menu items and links are correct.'
      : 'Review changes carefully - some may be unintentional.';
  } else if (diffPercent <= thresholdPercent) {
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
      location: diffPercent > 50 ? 'full' : 'center',
      bounds: { x: 0, y: 0, width: width || 0, height: height || 0 },
      description: `overall: ${diffPercent}% changed`,
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
