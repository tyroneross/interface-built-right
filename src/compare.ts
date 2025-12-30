import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { CompareOptions } from './types.js';
import type { ComparisonResult, Analysis, ChangedRegion, Verdict } from './schemas.js';

/**
 * Compare two images using pixelmatch
 */
export async function compareImages(options: CompareOptions): Promise<ComparisonResult> {
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
  };
}

/**
 * Analyze comparison result and generate verdict
 */
export function analyzeComparison(
  result: ComparisonResult,
  thresholdPercent: number = 1.0
): Analysis {
  const { match, diffPercent, diffPixels } = result;

  // Determine verdict
  let verdict: Verdict;
  let summary: string;
  let recommendation: string | null = null;

  if (match || diffPercent === 0) {
    verdict = 'MATCH';
    summary = 'No visual changes detected. Screenshots are identical.';
  } else if (diffPercent <= thresholdPercent) {
    verdict = 'EXPECTED_CHANGE';
    summary = `Minor changes detected (${diffPercent}% difference). Changes appear intentional.`;
  } else if (diffPercent <= 20) {
    verdict = 'EXPECTED_CHANGE';
    summary = `Moderate changes detected (${diffPercent}% difference, ${diffPixels.toLocaleString()} pixels). Review the diff image to verify changes are as expected.`;
  } else if (diffPercent <= 50) {
    verdict = 'UNEXPECTED_CHANGE';
    summary = `Significant changes detected (${diffPercent}% difference). Some changes may be unintentional.`;
    recommendation = 'Review the diff image carefully. Large portions of the page have changed.';
  } else {
    verdict = 'LAYOUT_BROKEN';
    summary = `Major changes detected (${diffPercent}% difference). Layout may be broken or page failed to load correctly.`;
    recommendation = 'Check for JavaScript errors, missing assets, or layout issues. The page appears significantly different from the baseline.';
  }

  // Generate changed regions (simplified - just one region for now)
  const changedRegions: ChangedRegion[] = [];
  const unexpectedChanges: ChangedRegion[] = [];

  if (!match) {
    const region: ChangedRegion = {
      location: diffPercent > 50 ? 'full' : 'center',
      bounds: { x: 0, y: 0, width: 0, height: 0 }, // Would need pixel analysis for accurate bounds
      description: `${diffPercent}% of pixels changed`,
      severity: verdict === 'LAYOUT_BROKEN' ? 'critical' :
                verdict === 'UNEXPECTED_CHANGE' ? 'unexpected' : 'expected',
    };

    if (verdict === 'UNEXPECTED_CHANGE' || verdict === 'LAYOUT_BROKEN') {
      unexpectedChanges.push(region);
    } else {
      changedRegions.push(region);
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
