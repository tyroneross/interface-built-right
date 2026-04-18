# IBR Evolution Scorecard — 2026-04-17

## Scoring Results

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Hydration fix | ⚠️ Partial | AX tree populates (55 elements on /skills). `waitForStableTree` + `detectSPAFramework` working. But `extractInteractiveElements` returns 0 due to pre-existing CompatPage.evaluate() issue with DOM querySelectorAll — separate from hydration. |
| 2 | Rule engine | ✅ Pass | 5 rule files (WCAG contrast, touch targets, text hierarchy, handler integrity, spacing grid) + index. All compile. Exported via public API. Rules run against elements and produce RuleEngineResult[]. |
| 3 | Sensor layer | ✅ Pass | `summarizeScan` produces 5 summary types (visual patterns, component census, nav map, contrast report, interaction map) + token efficiency calculation. All compile. |
| 4 | Interaction reliability | ✅ Pass | `captureInteractionDiff` wraps all actions with auto pre/post snapshot. Navigation detection after click with URL comparison + `waitForPageReady`. Console error capture per action. Session tests now passing (were failing before). |
| 5 | Code quality | ✅ Pass | Build: all 5 targets pass (CJS/ESM/DTS/bin/MCP). Tests: 399 pass / 46 fail (baseline was 393 pass / 52 fail — net improvement of +6 passing tests). |

## Pre-existing Issue Discovered

`extractInteractiveElements` uses `page.evaluate()` to run `document.querySelectorAll` in the browser. On Agent Astronomer (Next.js 16 SPA), this returns 0 elements even though the AX tree has 55 elements. The CompatPage evaluate wrapper may not be correctly serializing the selector array argument or the evaluate call is timing out silently. This is NOT a hydration issue — the AX tree is populated. Filed as a separate issue.

## Files Changed

### New files (11)
- `src/rules/wcag-contrast.ts` — WCAG 2.1 contrast ratio calculator
- `src/rules/touch-targets.ts` — Touch target size checker
- `src/rules/text-hierarchy.ts` — Text hierarchy validator
- `src/rules/handler-integrity.ts` — Handler integrity checker
- `src/rules/spacing-grid.ts` — 8pt spacing grid validator
- `src/rules/index.ts` — Rule engine aggregator + runAllRules
- `src/summarize.ts` — Sensor layer summarization

### Modified files (4)
- `src/scan.ts` — Hydration strategy + rule engine + sensor layer integration
- `src/live-session.ts` — ActionDiff, captureInteractionDiff, navigation detection
- `src/index.ts` — Public API exports for rules + summarize
- `.build-loop/state.json` — Build state tracking
