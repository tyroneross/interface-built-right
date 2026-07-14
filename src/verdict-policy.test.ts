import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import {
  WEB_VERDICT_POLICY,
  NATIVE_VERDICT_POLICY,
  VERDICT_POLICY_KEYS,
  resolveVerdictPolicy,
} from './verdict-policy.js';
import { analyzeComparison } from './compare.js';
import type { ExtendedComparisonResult } from './compare.js';
import { VerdictPolicySchema } from './schemas.js';
import type { VerdictPolicy } from './schemas.js';

// ---------------------------------------------------------------------------
// Provenance completeness (mechanical enforcement — req 6)
// A future hard-coded number cannot land silently: every threshold in every
// shipped policy/preset must carry complete provenance.
// ---------------------------------------------------------------------------
describe('provenance completeness', () => {
  const presets: Array<[string, VerdictPolicy]> = [
    ['WEB_VERDICT_POLICY', WEB_VERDICT_POLICY],
    ['NATIVE_VERDICT_POLICY', NATIVE_VERDICT_POLICY],
  ];

  for (const [name, policy] of presets) {
    it(`${name}: every threshold has complete, valid provenance`, () => {
      // zod schema validates shape (value:number, basis enum, rationale non-empty, reviewedAt string)
      expect(() => VerdictPolicySchema.parse(policy)).not.toThrow();

      for (const key of VERDICT_POLICY_KEYS) {
        const t = policy[key];
        expect(typeof t.value, `${name}.${key}.value`).toBe('number');
        expect(['research', 'internal-testing', 'hypothesis'], `${name}.${key}.basis`).toContain(t.basis);
        expect(t.rationale.length, `${name}.${key}.rationale`).toBeGreaterThan(0);
        // reviewedAt must be an ISO calendar date (sets the regular-review expectation)
        expect(t.reviewedAt, `${name}.${key}.reviewedAt`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        // when basis claims research, a source citation is required
        if (t.basis === 'research') {
          expect(t.source, `${name}.${key}.source (research basis must cite)`).toBeTruthy();
        }
      }
    });
  }

  it('shipped defaults are honestly labelled hypothesis (no invented research citations)', () => {
    for (const key of VERDICT_POLICY_KEYS) {
      expect(WEB_VERDICT_POLICY[key].basis).toBe('hypothesis');
      expect(NATIVE_VERDICT_POLICY[key].basis).toBe('hypothesis');
    }
  });
});

// ---------------------------------------------------------------------------
// Override precedence: call > project > preset (req 3)
// ---------------------------------------------------------------------------
describe('resolveVerdictPolicy override precedence', () => {
  it('bare-number override sets only value, inherits basis/rationale/reviewedAt from preset', () => {
    const resolved = resolveVerdictPolicy(WEB_VERDICT_POLICY, { unexpectedOverallPercent: 35 });
    expect(resolved.unexpectedOverallPercent.value).toBe(35);
    expect(resolved.unexpectedOverallPercent.basis).toBe(WEB_VERDICT_POLICY.unexpectedOverallPercent.basis);
    expect(resolved.unexpectedOverallPercent.rationale).toBe(WEB_VERDICT_POLICY.unexpectedOverallPercent.rationale);
    // Unspecified keys are untouched
    expect(resolved.regionCriticalPercent).toEqual(WEB_VERDICT_POLICY.regionCriticalPercent);
  });

  it('partial-object override updates named provenance fields', () => {
    const resolved = resolveVerdictPolicy(WEB_VERDICT_POLICY, {
      regionCriticalPercent: { value: 25, basis: 'internal-testing', rationale: 'calibrated on sample set X' },
    });
    expect(resolved.regionCriticalPercent.value).toBe(25);
    expect(resolved.regionCriticalPercent.basis).toBe('internal-testing');
    expect(resolved.regionCriticalPercent.rationale).toBe('calibrated on sample set X');
    // reviewedAt inherited (not in the override)
    expect(resolved.regionCriticalPercent.reviewedAt).toBe(WEB_VERDICT_POLICY.regionCriticalPercent.reviewedAt);
  });

  it('most-specific wins: call override beats project override beats preset', () => {
    const projectOverride = { allowedDiffPercent: 5, unexpectedOverallPercent: 40 };
    const callOverride = { allowedDiffPercent: 12 };
    const resolved = resolveVerdictPolicy(WEB_VERDICT_POLICY, projectOverride, callOverride);
    // allowedDiffPercent: call (12) beats project (5) beats preset (1)
    expect(resolved.allowedDiffPercent.value).toBe(12);
    // unexpectedOverallPercent: project (40) beats preset (20), no call override
    expect(resolved.unexpectedOverallPercent.value).toBe(40);
    // untouched key stays at preset
    expect(resolved.regionReportFloorPercent.value).toBe(WEB_VERDICT_POLICY.regionReportFloorPercent.value);
  });

  it('a full policy (e.g. NATIVE) as an override replaces every boundary', () => {
    const resolved = resolveVerdictPolicy(WEB_VERDICT_POLICY, NATIVE_VERDICT_POLICY);
    for (const key of VERDICT_POLICY_KEYS) {
      expect(resolved[key]).toEqual(NATIVE_VERDICT_POLICY[key]);
    }
  });

  it('resolve does not mutate the base preset', () => {
    const snapshot = JSON.stringify(WEB_VERDICT_POLICY);
    resolveVerdictPolicy(WEB_VERDICT_POLICY, { allowedDiffPercent: 99 });
    expect(JSON.stringify(WEB_VERDICT_POLICY)).toBe(snapshot);
  });
});

// ---------------------------------------------------------------------------
// Default-verdict parity pin (regression): the default policy's numeric values
// MUST equal the pre-refactor hard-coded constants, and default-policy verdicts
// MUST match the pre-refactor branch outcomes.
// ---------------------------------------------------------------------------
describe('default-verdict parity (regression pin)', () => {
  it('web default policy numeric values equal the pre-refactor hard-coded constants', () => {
    expect(WEB_VERDICT_POLICY.regionReportFloorPercent.value).toBe(0.1);  // was `> 0.1`
    expect(WEB_VERDICT_POLICY.regionUnexpectedPercent.value).toBe(10);    // was `> 10`
    expect(WEB_VERDICT_POLICY.regionCriticalPercent.value).toBe(30);      // was `> 30`
    expect(WEB_VERDICT_POLICY.unexpectedOverallPercent.value).toBe(20);   // was `diffPercent > 20`
    expect(WEB_VERDICT_POLICY.fullFrameFallbackPercent.value).toBe(50);   // was `> 50 ? 'full' : 'center'`
    expect(WEB_VERDICT_POLICY.allowedDiffPercent.value).toBe(1.0);        // was thresholdPercent default 1.0
  });

  // Pre-refactor branch outcomes (no diffData path), asserted explicitly.
  const noDiff = (diffPercent: number): ExtendedComparisonResult => ({
    match: diffPercent === 0,
    diffPercent,
    diffPixels: Math.round(diffPercent * 100),
    totalPixels: 10000,
    threshold: 0.1,
  });

  it('MATCH for identical', () => {
    expect(analyzeComparison(noDiff(0)).verdict).toBe('MATCH');
  });
  it('EXPECTED for within-tolerance minor change', () => {
    expect(analyzeComparison(noDiff(0.5)).verdict).toBe('EXPECTED_CHANGE');
  });
  it('EXPECTED for moderate change below unexpected-overall', () => {
    expect(analyzeComparison(noDiff(5)).verdict).toBe('EXPECTED_CHANGE');
  });
  it('UNEXPECTED for overall change above 20% at default tolerance', () => {
    expect(analyzeComparison(noDiff(25)).verdict).toBe('UNEXPECTED_CHANGE');
  });
});

// ---------------------------------------------------------------------------
// allowedDiffPercent now genuinely GATES EXPECTED vs UNEXPECTED, monotonically
// (sanctioned behaviour change — req 1 + tests contract)
// ---------------------------------------------------------------------------
describe('allowedDiffPercent gating', () => {
  const noDiff = (diffPercent: number): ExtendedComparisonResult => ({
    match: false, diffPercent, diffPixels: Math.round(diffPercent * 100), totalPixels: 10000, threshold: 0.1,
  });
  const rank: Record<string, number> = { MATCH: 0, EXPECTED_CHANGE: 1, UNEXPECTED_CHANGE: 2, LAYOUT_BROKEN: 3 };

  it('raising tolerance monotonically relaxes the verdict at a fixed diff', () => {
    const diffPercent = 25;
    const tolerances = [1, 10, 20, 24, 30, 50];
    const verdicts = tolerances.map(t => analyzeComparison(noDiff(diffPercent), t).verdict);
    for (let i = 1; i < verdicts.length; i++) {
      expect(rank[verdicts[i]]).toBeLessThanOrEqual(rank[verdicts[i - 1]]);
    }
    // And it actually gates: some tolerances yield UNEXPECTED, others EXPECTED
    expect(new Set(verdicts).size).toBeGreaterThan(1);
    expect(verdicts).toContain('UNEXPECTED_CHANGE');
    expect(verdicts).toContain('EXPECTED_CHANGE');
  });

  it('a 25% change is UNEXPECTED at tolerance 1 but EXPECTED at tolerance 30', () => {
    expect(analyzeComparison(noDiff(25), 1).verdict).toBe('UNEXPECTED_CHANGE');
    expect(analyzeComparison(noDiff(25), 30).verdict).toBe('EXPECTED_CHANGE');
  });

  it('tolerance never suppresses LAYOUT_BROKEN (critical regions are tolerance-independent)', () => {
    const width = 100, height = 100;
    const diffData = new Uint8Array(width * height * 4);
    for (let y = 10; y < 90; y++) for (let x = 20; x < 100; x++) {
      const idx = (y * width + x) * 4;
      diffData[idx] = 255; diffData[idx + 3] = 255; // red, content region fully changed → critical
    }
    const result: ExtendedComparisonResult = {
      match: false, diffPercent: 64, diffPixels: 6400, totalPixels: 10000, threshold: 0.1, diffData, width, height,
    };
    // Even with an absurdly high tolerance, a broken layout still surfaces.
    expect(analyzeComparison(result, 99).verdict).toBe('LAYOUT_BROKEN');
  });
});

// ---------------------------------------------------------------------------
// Policy echo + structured per-region measurements (transparency — req 4)
// ---------------------------------------------------------------------------
describe('policy echo + structured measurements', () => {
  it('analyzeComparison echoes the applied policy with basis metadata', () => {
    const analysis = analyzeComparison({ match: true, diffPercent: 0, diffPixels: 0, totalPixels: 100, threshold: 0.1 });
    expect(analysis.policy).toBeDefined();
    expect(analysis.policy!.unexpectedOverallPercent.basis).toBe('hypothesis');
    expect(analysis.policy!.allowedDiffPercent.value).toBe(1.0);
  });

  it('the echoed policy reflects a per-call tolerance override', () => {
    const analysis = analyzeComparison(
      { match: false, diffPercent: 5, diffPixels: 500, totalPixels: 10000, threshold: 0.1 },
      7,
    );
    expect(analysis.policy!.allowedDiffPercent.value).toBe(7);
  });

  it('detected regions expose a numeric diffPercent reconciling with the description', () => {
    const width = 100, height = 100;
    const diffData = new Uint8Array(width * height * 4);
    for (let y = 20; y < 70; y++) for (let x = 30; x < 80; x++) {
      const idx = (y * width + x) * 4;
      diffData[idx + 1] = 255; diffData[idx + 3] = 255; // green content change
    }
    const analysis = analyzeComparison({
      match: false, diffPercent: 25, diffPixels: 2500, totalPixels: 10000, threshold: 0.1, diffData, width, height,
    });
    const all = [...analysis.changedRegions, ...analysis.unexpectedChanges];
    expect(all.length).toBeGreaterThan(0);
    for (const r of all) {
      expect(typeof r.diffPercent).toBe('number');
      // numeric field matches the number embedded in the description string
      const fromDesc = parseFloat(r.description.match(/(\d+\.?\d*)%/)?.[1] || 'NaN');
      expect(r.diffPercent).toBeCloseTo(fromDesc, 1);
    }
  });
});

// ---------------------------------------------------------------------------
// Native preset produces no web-semantics guidance and echoes native provenance
// ---------------------------------------------------------------------------
describe('native verdict policy', () => {
  it('analyzeComparison with NATIVE preset echoes native rationale, never web nav guidance', () => {
    const width = 100, height = 100;
    // left-band green would be "navigation" under web regions — but with NATIVE
    // regions the bands are neutral top/middle/bottom.
    const diffData = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < 20; x++) {
      const idx = (y * width + x) * 4;
      diffData[idx + 1] = 255; diffData[idx + 3] = 255;
    }
    // Use NATIVE regions + NATIVE policy explicitly.
    const NATIVE_REGIONS = [
      { name: 'top', location: 'top' as const, xStart: 0, xEnd: 1, yStart: 0, yEnd: 0.2 },
      { name: 'middle', location: 'center' as const, xStart: 0, xEnd: 1, yStart: 0.2, yEnd: 0.8 },
      { name: 'bottom', location: 'bottom' as const, xStart: 0, xEnd: 1, yStart: 0.8, yEnd: 1 },
    ];
    const analysis = analyzeComparison(
      { match: false, diffPercent: 25, diffPixels: 2000, totalPixels: 10000, threshold: 0.1, diffData, width, height },
      undefined,
      NATIVE_REGIONS,
      NATIVE_VERDICT_POLICY,
    );
    const rec = (analysis.recommendation ?? '').toLowerCase();
    expect(rec).not.toContain('menu');
    expect(rec).not.toContain('link');
    expect(rec).not.toContain('navigation');
    for (const r of [...analysis.changedRegions, ...analysis.unexpectedChanges]) {
      expect(r.description.toLowerCase()).not.toContain('navigation');
    }
    // Echoed policy carries the native rationale, not the web rationale.
    expect(analysis.policy!.unexpectedOverallPercent.rationale).toContain('Native');
  });
});

// ---------------------------------------------------------------------------
// Structural guard: no inline magic-number comparisons in the verdict path (req 6)
// The former thresholds (0.1 / 10 / 20 / 30 / 50) must flow only from the policy
// object, never appear as comparison literals in the function bodies.
// ---------------------------------------------------------------------------
describe('no inline magic-number comparisons', () => {
  it('detectChangedRegions and analyzeComparison bodies contain no threshold literals', async () => {
    const src = await readFile(fileURLToPath(new URL('./compare.ts', import.meta.url)), 'utf8');

    const sliceBody = (startMarker: string, endMarker: string): string => {
      const start = src.indexOf(startMarker);
      expect(start, `marker not found: ${startMarker}`).toBeGreaterThanOrEqual(0);
      const end = src.indexOf(endMarker, start);
      expect(end, `end marker not found: ${endMarker}`).toBeGreaterThan(start);
      return src.slice(start, end);
    };

    const detect = sliceBody('export function detectChangedRegions', 'export interface ExtendedComparisonResult');
    const analyze = sliceBody('export function analyzeComparison', 'export function getVerdictDescription');

    // strip comments so documentation may still reference numbers if needed
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const body = strip(detect) + '\n' + strip(analyze);

    // Ban the former magic thresholds appearing as comparison operands.
    const banned = /[<>]=?\s*(0\.1|10|20|30|50)\b/g;
    const hits = body.match(banned) ?? [];
    expect(hits, `inline threshold comparison(s) found: ${hits.join(', ')}`).toEqual([]);
  });
});
