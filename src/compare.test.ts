import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { PNG } from 'pngjs';
import {
  detectChangedRegions,
  analyzeComparison,
  getVerdictDescription,
  compareImages,
  regionalDiffCounts,
  isDiffMarker,
  DEFAULT_REGIONS,
  NATIVE_REGIONS,
} from './compare.js';
import type { ExtendedComparisonResult } from './compare.js';

describe('getVerdictDescription', () => {
  it('returns correct description for each verdict', () => {
    expect(getVerdictDescription('MATCH')).toContain('No changes');
    expect(getVerdictDescription('EXPECTED_CHANGE')).toContain('intentional');
    expect(getVerdictDescription('UNEXPECTED_CHANGE')).toContain('review');
    expect(getVerdictDescription('LAYOUT_BROKEN')).toContain('broken');
  });

  it('returns fallback for unknown verdict', () => {
    expect(getVerdictDescription('NONEXISTENT' as any)).toContain('Unknown');
  });
});

describe('detectChangedRegions', () => {
  function makeDiffData(width: number, height: number, fill?: { x: number; y: number; w: number; h: number }) {
    const data = new Uint8Array(width * height * 4);
    if (fill) {
      for (let y = fill.y; y < fill.y + fill.h; y++) {
        for (let x = fill.x; x < fill.x + fill.w; x++) {
          const idx = (y * width + x) * 4;
          data[idx] = 255;     // R
          data[idx + 1] = 0;   // G
          data[idx + 2] = 0;   // B
          data[idx + 3] = 255; // A
        }
      }
    }
    return data;
  }

  it('returns empty array when no differences', () => {
    const data = makeDiffData(100, 100);
    const regions = detectChangedRegions(data, 100, 100);
    expect(regions).toEqual([]);
  });

  it('detects changes in the header region', () => {
    // Header is top 10% (y: 0-10 on a 100px tall image)
    const data = makeDiffData(100, 100, { x: 0, y: 0, w: 100, h: 10 });
    const regions = detectChangedRegions(data, 100, 100);
    expect(regions.length).toBeGreaterThan(0);
    expect(regions.some(r => r.description.includes('header'))).toBe(true);
  });

  it('detects changes in the content region', () => {
    // Content is x: 20-100, y: 10-90
    const data = makeDiffData(100, 100, { x: 30, y: 20, w: 50, h: 50 });
    const regions = detectChangedRegions(data, 100, 100);
    expect(regions.some(r => r.description.includes('content'))).toBe(true);
  });

  it('assigns critical severity for >30% diff in a region', () => {
    // Fill entire content area (80x80 = 6400 pixels in an 80x80 region)
    const data = makeDiffData(100, 100, { x: 20, y: 10, w: 80, h: 80 });
    const regions = detectChangedRegions(data, 100, 100);
    const content = regions.find(r => r.description.includes('content'));
    expect(content?.severity).toBe('critical');
  });

  it('sorts critical regions first', () => {
    // Fill everything red to trigger multiple region detections
    const data = makeDiffData(100, 100, { x: 0, y: 0, w: 100, h: 100 });
    const regions = detectChangedRegions(data, 100, 100);
    if (regions.length > 1) {
      const severities = regions.map(r => r.severity);
      const criticalIdx = severities.indexOf('critical');
      const expectedIdx = severities.indexOf('expected');
      if (criticalIdx >= 0 && expectedIdx >= 0) {
        expect(criticalIdx).toBeLessThan(expectedIdx);
      }
    }
  });
});

describe('analyzeComparison', () => {
  it('returns MATCH for identical images', () => {
    const result: ExtendedComparisonResult = {
      match: true,
      diffPercent: 0,
      diffPixels: 0,
      totalPixels: 10000,
      threshold: 0.1,
    };
    const analysis = analyzeComparison(result);
    expect(analysis.verdict).toBe('MATCH');
    expect(analysis.summary).toContain('identical');
  });

  it('returns EXPECTED_CHANGE for small diff within threshold', () => {
    const result: ExtendedComparisonResult = {
      match: false,
      diffPercent: 0.5,
      diffPixels: 50,
      totalPixels: 10000,
      threshold: 0.1,
    };
    const analysis = analyzeComparison(result, 1.0);
    expect(analysis.verdict).toBe('EXPECTED_CHANGE');
  });

  it('returns LAYOUT_BROKEN when critical regions exist', () => {
    const width = 100;
    const height = 100;
    const diffData = new Uint8Array(width * height * 4);
    // Fill content region fully red (>30% triggers critical)
    for (let y = 10; y < 90; y++) {
      for (let x = 20; x < 100; x++) {
        const idx = (y * width + x) * 4;
        diffData[idx] = 255;
        diffData[idx + 1] = 0;
        diffData[idx + 2] = 0;
        diffData[idx + 3] = 255;
      }
    }

    const result: ExtendedComparisonResult = {
      match: false,
      diffPercent: 64,
      diffPixels: 6400,
      totalPixels: 10000,
      threshold: 0.1,
      diffData,
      width,
      height,
    };
    const analysis = analyzeComparison(result);
    expect(analysis.verdict).toBe('LAYOUT_BROKEN');
  });

  it('creates fallback region when no regions detected but has diff', () => {
    const result: ExtendedComparisonResult = {
      match: false,
      diffPercent: 5,
      diffPixels: 500,
      totalPixels: 10000,
      threshold: 0.1,
      // No diffData → no region detection
    };
    const analysis = analyzeComparison(result);
    const allRegions = [...analysis.changedRegions, ...analysis.unexpectedChanges];
    expect(allRegions.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Real compareImages fixtures + defect regression tests
// ---------------------------------------------------------------------------

/** Build a solid-color RGBA PNG buffer. */
function solidPng(width: number, height: number, r: number, g: number, b: number): Buffer {
  const png = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    png.data[o] = r;
    png.data[o + 1] = g;
    png.data[o + 2] = b;
    png.data[o + 3] = 255;
  }
  return PNG.sync.write(png);
}

/** Count red / green / yellow(AA) markers in a written diff PNG. */
async function countDiffColors(diffPath: string): Promise<{ red: number; green: number; yellow: number }> {
  const png = PNG.sync.read(await readFile(diffPath));
  let red = 0, green = 0, yellow = 0;
  for (let i = 0; i < png.width * png.height; i++) {
    const o = i * 4;
    const r = png.data[o], g = png.data[o + 1], b = png.data[o + 2];
    if (r === 255 && g === 0 && b === 0) red++;
    else if (r === 0 && g === 255 && b === 0) green++;
    else if (r === 255 && g === 255 && b === 0) yellow++;
  }
  return { red, green, yellow };
}

describe('compareImages (real pixelmatch)', () => {
  let dir: string;
  const W = 40, H = 40;

  async function setup() {
    dir = await mkdtemp(join(tmpdir(), 'ibr-compare-test-'));
  }
  async function teardown() {
    if (dir) await rm(dir, { recursive: true, force: true });
  }

  it('lighter-to-darker produces GREEN diffs that are fully counted', async () => {
    await setup();
    try {
      const basePath = join(dir, 'base.png');
      const curPath = join(dir, 'cur.png');
      const diffPath = join(dir, 'diff.png');
      // baseline lighter (160) -> current darker (40): pixelmatch paints green (alt color)
      await writeFile(basePath, solidPng(W, H, 160, 160, 160));
      await writeFile(curPath, solidPng(W, H, 40, 40, 40));

      const result = await compareImages({ baselinePath: basePath, currentPath: curPath, diffPath, pixelColorThreshold: 0.1 });

      // Whole frame changed
      expect(result.diffPixels).toBe(W * H);
      expect(result.diffPercent).toBeCloseTo(100, 5);
      // Diff image is dominated by GREEN, not red
      const colors = await countDiffColors(diffPath);
      expect(colors.green).toBe(W * H);
      expect(colors.red).toBe(0);
      // Mask reconciles with the pixelmatch count (green counted)
      const maskSum = result.diffMask!.reduce((a, v) => a + v, 0);
      expect(maskSum).toBe(result.diffPixels);
    } finally {
      await teardown();
    }
  });

  it('darker-to-lighter produces RED diffs that are fully counted', async () => {
    await setup();
    try {
      const basePath = join(dir, 'base.png');
      const curPath = join(dir, 'cur.png');
      const diffPath = join(dir, 'diff.png');
      // baseline darker (40) -> current lighter (200): pixelmatch paints red
      await writeFile(basePath, solidPng(W, H, 40, 40, 40));
      await writeFile(curPath, solidPng(W, H, 200, 200, 200));

      const result = await compareImages({ baselinePath: basePath, currentPath: curPath, diffPath, pixelColorThreshold: 0.1 });

      expect(result.diffPixels).toBe(W * H);
      const colors = await countDiffColors(diffPath);
      expect(colors.red).toBe(W * H);
      expect(colors.green).toBe(0);
      const maskSum = result.diffMask!.reduce((a, v) => a + v, 0);
      expect(maskSum).toBe(result.diffPixels);
    } finally {
      await teardown();
    }
  });

  it('measured diff percent is independent of verdict tolerance (threshold independence)', async () => {
    await setup();
    try {
      const basePath = join(dir, 'base.png');
      const curPath = join(dir, 'cur.png');
      // half the image changed → ~50%
      const base = new PNG({ width: W, height: H });
      const cur = new PNG({ width: W, height: H });
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const o = (y * W + x) * 4;
          base.data[o] = base.data[o + 1] = base.data[o + 2] = 128; base.data[o + 3] = 255;
          const changed = y < H / 2;
          const v = changed ? 220 : 128;
          cur.data[o] = cur.data[o + 1] = cur.data[o + 2] = v; cur.data[o + 3] = 255;
        }
      }
      await writeFile(basePath, PNG.sync.write(base));
      await writeFile(curPath, PNG.sync.write(cur));

      // Same pixelColorThreshold → identical measured diff percent regardless of verdict tolerance
      const percents: number[] = [];
      const verdicts: string[] = [];
      for (const allowedDiffPercent of [1, 5, 10, 20]) {
        const cmp = await compareImages({ baselinePath: basePath, currentPath: curPath, diffPath: join(dir, `d${allowedDiffPercent}.png`), pixelColorThreshold: 0.1 });
        percents.push(cmp.diffPercent);
        verdicts.push(analyzeComparison(cmp, allowedDiffPercent).verdict);
      }
      // Threshold independence: every measured diff percent is identical
      expect(new Set(percents).size).toBe(1);
      expect(percents[0]).toBeCloseTo(50, 0);
      // Monotonicity: raising tolerance never makes the verdict stricter
      const rank: Record<string, number> = { MATCH: 0, EXPECTED_CHANGE: 1, UNEXPECTED_CHANGE: 2, LAYOUT_BROKEN: 3 };
      for (let i = 1; i < verdicts.length; i++) {
        expect(rank[verdicts[i]]).toBeLessThanOrEqual(rank[verdicts[i - 1]]);
      }
    } finally {
      await teardown();
    }
  });
});

describe('regionalDiffCounts / detectChangedRegions (Defect 2 — green not dropped)', () => {
  function greenDiff(width: number, height: number, fill: { x: number; y: number; w: number; h: number }) {
    const data = new Uint8Array(width * height * 4);
    for (let y = fill.y; y < fill.y + fill.h; y++) {
      for (let x = fill.x; x < fill.x + fill.w; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = 0; data[idx + 1] = 255; data[idx + 2] = 0; data[idx + 3] = 255; // GREEN
      }
    }
    return data;
  }

  it('isDiffMarker treats both red and green as diffs, excludes yellow AA', () => {
    const d = new Uint8Array([255, 0, 0, 255,  0, 255, 0, 255,  255, 255, 0, 255,  1, 2, 3, 255]);
    expect(isDiffMarker(d, 0)).toBe(true);   // red
    expect(isDiffMarker(d, 4)).toBe(true);   // green
    expect(isDiffMarker(d, 8)).toBe(false);  // yellow (AA)
    expect(isDiffMarker(d, 12)).toBe(false); // background
  });

  it('green-only changes still surface in detectChangedRegions', () => {
    // Green fill in the content region — red-only counting would report nothing
    const data = greenDiff(100, 100, { x: 30, y: 20, w: 50, h: 50 });
    const regions = detectChangedRegions(data, 100, 100);
    expect(regions.length).toBeGreaterThan(0);
    expect(regions.some(r => r.description.includes('content'))).toBe(true);
  });

  it('regional partition counts reconcile with total mismatch count', () => {
    const width = 100, height = 100;
    // Mixed red + green across the whole frame
    const data = new Uint8Array(width * height * 4);
    let expectedTotal = 0;
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      if (i % 3 === 0) { data[idx] = 255; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 255; expectedTotal++; }      // red
      else if (i % 3 === 1) { data[idx] = 0; data[idx + 1] = 255; data[idx + 2] = 0; data[idx + 3] = 255; expectedTotal++; } // green
      // else background
    }
    const counts = regionalDiffCounts(data, width, height, DEFAULT_REGIONS);
    const summed = counts.reduce((a, c) => a + c.diffPixels, 0);
    // DEFAULT_REGIONS fully partition the frame → sum equals total diff markers
    expect(summed).toBe(expectedTotal);
  });

  it('mask-based counting matches color-derived counting', () => {
    const width = 60, height = 60;
    const data = greenDiff(width, height, { x: 10, y: 10, w: 20, h: 20 });
    const mask = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) if (isDiffMarker(data, i * 4)) mask[i] = 1;
    const viaColor = regionalDiffCounts(data, width, height, DEFAULT_REGIONS);
    const viaMask = regionalDiffCounts(data, width, height, DEFAULT_REGIONS, mask);
    expect(viaMask.map(c => c.diffPixels)).toEqual(viaColor.map(c => c.diffPixels));
  });
});

describe('native region semantics (Defect 3 — no false navigation guidance)', () => {
  // A diff concentrated in the left 20% of the frame would land in the web
  // "navigation" region and trigger "verify menu items and links" guidance.
  function leftBandGreen(width: number, height: number) {
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < Math.floor(width * 0.2); x++) {
        const idx = (y * width + x) * 4;
        data[idx] = 0; data[idx + 1] = 255; data[idx + 2] = 0; data[idx + 3] = 255;
      }
    }
    return data;
  }

  it('web regions DO produce navigation guidance (baseline behavior)', () => {
    const width = 100, height = 100;
    const result: ExtendedComparisonResult = {
      match: false, diffPercent: 25, diffPixels: 2000, totalPixels: 10000, threshold: 0.1,
      diffData: leftBandGreen(width, height), width, height,
    };
    const analysis = analyzeComparison(result, 1.0, DEFAULT_REGIONS);
    const nav = analysis.changedRegions.concat(analysis.unexpectedChanges).some(r => r.description.toLowerCase().includes('navigation'));
    expect(nav).toBe(true);
  });

  it('native regions never emit navigation/menu/link guidance', () => {
    const width = 100, height = 100;
    const result: ExtendedComparisonResult = {
      match: false, diffPercent: 25, diffPixels: 2000, totalPixels: 10000, threshold: 0.1,
      diffData: leftBandGreen(width, height), width, height,
    };
    const analysis = analyzeComparison(result, 1.0, NATIVE_REGIONS);
    const allRegions = analysis.changedRegions.concat(analysis.unexpectedChanges);
    // No region is named 'navigation' / 'header' / 'footer'
    for (const r of allRegions) {
      expect(r.description.toLowerCase()).not.toContain('navigation');
    }
    // Recommendation (if any) must not reference menus or links
    const rec = (analysis.recommendation ?? '').toLowerCase();
    expect(rec).not.toContain('menu');
    expect(rec).not.toContain('link');
    expect(rec).not.toContain('navigation');
  });
});
