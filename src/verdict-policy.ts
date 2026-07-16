import type {
  VerdictPolicy,
  VerdictPolicyOverride,
  ProvenancedThreshold,
  ThresholdOverride,
} from './schemas.js';

/**
 * Verdict policy — the single owner of every numeric boundary used by
 * {@link analyzeComparison} and {@link detectChangedRegions}.
 *
 * Background: the comparison/verdict path historically hard-coded a handful of
 * percentages (region report floor 0.1%, severity bands 10%/30%, unexpected
 * overall 20%, full-frame fallback 50%, verdict tolerance 1%). None had a
 * research or internal-testing basis — they were undocumented hypotheses baked
 * into `if` statements. This module lifts every one into a typed, provenance-
 * carrying object so that:
 *
 *   1. Each boundary is HONESTLY labelled (`basis`, `rationale`, `reviewedAt`).
 *   2. Agents can tune boundaries per call / per project / per app-type without
 *      forking the code (deep-merge partial overrides via {@link resolveVerdictPolicy}).
 *   3. A future hard-coded number cannot land silently — the provenance-
 *      completeness test rejects any threshold missing its metadata.
 *
 * The numeric DEFAULTS below intentionally match the pre-refactor hard-coded
 * values so verdict behaviour is unchanged at the default policy. Only their
 * PROVENANCE is new — every default is `basis: 'hypothesis'`.
 */

/** ISO date the shipped defaults were last reviewed. */
const REVIEWED_AT = '2026-07-13';

/**
 * Stamp a hypothesis-basis threshold with today's review date. Keeping this in
 * one place guarantees every shipped default carries complete provenance and a
 * consistent `reviewedAt`, which the completeness test asserts.
 */
function hyp(value: number, rationale: string): ProvenancedThreshold {
  return { value, basis: 'hypothesis', rationale, reviewedAt: REVIEWED_AT };
}

/**
 * Web default policy. Values are the pre-refactor hard-coded numbers, now
 * labelled as unverified hypotheses pending calibration against real diff
 * distributions.
 */
export const WEB_VERDICT_POLICY: VerdictPolicy = {
  regionReportFloorPercent: hyp(
    0.1,
    'Regions whose changed-pixel share is at or below this are treated as noise and not reported. 0.1% is an undocumented heuristic carried from the original implementation; no measurement backs it. Review against real per-region diff distributions.'
  ),
  regionCriticalPercent: hyp(
    30,
    'A region changing more than this share is treated as structurally broken (drives LAYOUT_BROKEN). 30% is an unverified heuristic; calibrate against labelled layout-break vs intentional-redesign samples.'
  ),
  regionUnexpectedPercent: hyp(
    10,
    'A region changing more than this (but at or below the critical band) is flagged unexpected. 10% is an unverified heuristic pending calibration.'
  ),
  unexpectedOverallPercent: hyp(
    20,
    'Overall frame change above this is flagged unexpected even when no single region crosses its band. 20% is an unverified heuristic pending calibration.'
  ),
  fullFrameFallbackPercent: hyp(
    50,
    'Presentation only: when no region is isolated, an overall change above this is described as a full-frame change rather than centre-weighted. 50% does not change the verdict.'
  ),
  allowedDiffPercent: hyp(
    1.0,
    'Verdict tolerance — overall change at or below this is treated as an acceptable/expected change and never escalated to unexpected. 1% is a conservative default; tune per run / report / project via override.'
  ),
};

/**
 * Native (iOS / macOS) preset. Pairs with `NATIVE_REGIONS` (neutral
 * top/middle/bottom bands, no web navigation semantics). Numeric values
 * currently mirror the web defaults — native-specific calibration is pending,
 * so the values are honestly labelled hypotheses rather than tuned constants.
 * Distinct rationale text keeps the echoed policy truthful for native reports.
 */
export const NATIVE_VERDICT_POLICY: VerdictPolicy = {
  regionReportFloorPercent: hyp(
    0.1,
    'Native band report floor. Mirrors the web default; no native measurement backs it yet. Review against real simulator diff distributions.'
  ),
  regionCriticalPercent: hyp(
    30,
    'Native band critical threshold (drives LAYOUT_BROKEN). Mirrors the web default pending native-specific calibration.'
  ),
  regionUnexpectedPercent: hyp(
    10,
    'Native band unexpected threshold. Mirrors the web default pending native-specific calibration.'
  ),
  unexpectedOverallPercent: hyp(
    20,
    'Native overall unexpected threshold. Mirrors the web default pending native-specific calibration.'
  ),
  fullFrameFallbackPercent: hyp(
    50,
    'Native full-frame fallback (presentation only). Mirrors the web default; does not change the verdict.'
  ),
  allowedDiffPercent: hyp(
    1.0,
    'Native verdict tolerance. Mirrors the web default; tune per run / report / project via override.'
  ),
};

/** Every threshold key on a VerdictPolicy — the completeness test iterates these. */
export const VERDICT_POLICY_KEYS: Array<keyof VerdictPolicy> = [
  'regionReportFloorPercent',
  'regionCriticalPercent',
  'regionUnexpectedPercent',
  'unexpectedOverallPercent',
  'fullFrameFallbackPercent',
  'allowedDiffPercent',
];

/**
 * Coerce a single-threshold override onto a base threshold. A bare number
 * overrides only `.value` (basis/rationale/reviewedAt are inherited from the
 * base preset); a partial object overrides the named fields. The result always
 * carries complete provenance because the base always does.
 */
function mergeThreshold(
  base: ProvenancedThreshold,
  override: ThresholdOverride | undefined
): ProvenancedThreshold {
  if (override === undefined) return base;
  if (typeof override === 'number') return { ...base, value: override };
  // Drop explicitly-undefined keys before spreading so a partial override can
  // never clobber a base field with `undefined` (which would leave a threshold
  // without a value/basis). The base is always complete, so the result is too.
  const defined = Object.fromEntries(
    Object.entries(override).filter(([, v]) => v !== undefined)
  );
  return { ...base, ...defined };
}

/**
 * Deep-merge partial verdict-policy overrides onto a base preset, most-specific
 * last. Supports the three override levels (app-type preset → per-project config
 * → per-call): fold the project override then the call override over the preset.
 *
 * Overrides may be bare numbers (`{ allowedDiffPercent: 5 }`) or partial
 * provenance objects (`{ allowedDiffPercent: { value: 5, basis: 'internal-testing', ... } }`).
 * Unspecified keys keep the base preset's provenanced threshold.
 */
export function resolveVerdictPolicy(
  base: VerdictPolicy,
  ...overrides: Array<VerdictPolicyOverride | undefined>
): VerdictPolicy {
  let resolved: VerdictPolicy = { ...base };
  for (const override of overrides) {
    if (!override) continue;
    const next: VerdictPolicy = { ...resolved };
    for (const key of VERDICT_POLICY_KEYS) {
      next[key] = mergeThreshold(resolved[key], override[key]);
    }
    resolved = next;
  }
  return resolved;
}
