# IBR Evolution for Opus 4.7+ Era

## Goal

Evolve IBR from a raw data collector into a two-tier validation system: deterministic rule engine (no LLM tokens) + structured sensor layer (model-assisted with minimal tokens). Fix the hydration timing bug that causes "0 elements" on React/Next.js SPAs. Make interaction sessions more reliable with automatic pre/post scanning and navigation detection.

## Scoring Criteria

| # | Criterion | Method | Pass Condition | Evidence |
|---|-----------|--------|----------------|----------|
| 1 | Hydration fix | Code-based: scan Agent Astronomer /skills | elements.all.length > 0 on 3+ SPA pages | Scan output JSON |
| 2 | Rule engine | Code-based: run rules against fixtures | WCAG contrast, touch targets, text hierarchy, handler integrity all produce correct violations | Rule output JSON |
| 3 | Sensor layer | Token comparison: summary vs raw | Summary < 30% of raw element dump while preserving actionable info | Token counts |
| 4 | Interaction reliability | Code-based: session with navigating click | Auto-capture before/after navigation, URL change detected | Session state JSON |
| 5 | Code quality | `npm run build` + `npm test` | Zero build errors, no test regressions | Build + test output |
