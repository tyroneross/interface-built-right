import { describe, it, expect } from 'vitest';
import { detectChangedRegions, analyzeComparison, getVerdictDescription } from './compare.js';
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
