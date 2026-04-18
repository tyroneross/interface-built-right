# IBR 0.9.0-alpha — `/ibr:build` Scorecard

**Date:** 2026-04-13
**Plan:** docs/superpowers/plans/2026-04-13-ibr-build.md (19 tasks)
**Spec:** docs/superpowers/specs/2026-04-13-ibr-build-design.md
**Execution:** subagent-driven, Sonnet implementation, Opus review

## Scorecard

| # | Criterion | Method | Result | Evidence |
|---|---|---|---|---|
| C1 | New-code tests pass | `npx vitest run` on new dirs | ✅ 14/14 | Phase 5 run |
| C2 | Build succeeds | `tsup` (npm run build) | ✅ ok | Task 18 subagent |
| C3 | 6 new skills load | frontmatter check | ✅ 6/6 | `ui-guidance-library`, `mockup-gallery-bridge`, `ui-brainstorm-preamble`, `mobile-web-ui`, `ios-ui`, `macos-ui` |
| C4 | 3 new commands load | frontmatter check | ✅ 3/3 | `/ibr:build`, `/ibr:capture`, `/ibr:ui-guidance` |
| C5 | Plugin manifest valid | JSON parse + version | ✅ | version=0.9.0-alpha |
| C6 | Commits per task | `git log` | ✅ 19 IBR + 1 build-loop | 18 feature + 1 fixture-fix + 1 cross-repo |
| C7 | No mock/placeholder in production | mock-scanner agent | ✅ clean | 0 findings |
| C8 | Build-loop routing entry | `grep` | ✅ present | `/ibr:build --from=build-loop` row added |

**Overall: 8/8 criteria pass.**

## Delivered

**TypeScript modules** (src/, all with tests):
- `src/ui-guidance/library.ts` (indexTemplates)
- `src/ui-guidance/snapshot.ts` (snapshotTemplate)
- `src/ui-guidance/promote.ts` (promoteDraft with --confirm gate)
- `src/mockup-gallery/reader.ts` (readGallery, malformed-JSON-safe)
- `src/mockup-gallery/writer.ts` (recordImplementation)

**Skills** (6 new):
- `ui-guidance-library` — indexes central + project-local templates
- `mockup-gallery-bridge` — reads ratings/selections, writes implemented.json
- `ui-brainstorm-preamble` — 6-Q UI context capture + platform routing
- `mobile-web-ui` — Material 3 + WCAG 2.2 + iOS Safari rules
- `ios-ui` — HIG + FloDoro/SpeakSavvy lessons + Apple doc URLs (HealthKit, Live Activities, TestFlight, ASC, device deploy)
- `macos-ui` — HIG + notarization + Developer ID + Sparkle distribution

**Commands** (3 new):
- `/ibr:build <topic>` — UI orchestrator, supports `--from=build-loop` subordinate mode
- `/ibr:capture <url>` — unified screenshot/extract/crawl wrapper
- `/ibr:ui-guidance list|show|promote` — UI Guidance library management

**Cross-plugin:**
- build-loop SKILL.md routing table gains "Orchestrated UI build" row pointing to `/ibr:build --from=build-loop`

**Docs:**
- `docs/research/2026-04-13-mobile-ui-best-practices.md` — T1/T2-cited research report (single source of truth; platform skills link here)
- README "What's New in v0.9.0-alpha"
- CLAUDE.md + AGENTS.md updated skills/commands tables
- QUICK-START.md usage examples

**Tests:** 14 new unit tests (ui-guidance: 7, mockup-gallery: 5, e2e smoke: 2) + fixture files committed

## ✅ Known (verified)

- All new production code path is tested (TDD throughout)
- All 6 skills + 3 commands load with valid frontmatter
- Build-loop routing confirmed — `/ibr:build --from=build-loop` entry live
- Smoke test reproducible (fixtures committed)
- Version bumped to 0.9.0-alpha across package.json, plugin.json, universal/tools.yaml
- Full test suite 391 passing (42 integration/native tests skipped — environment, pre-existing)

## ⚠️ Unknown

- `/ibr:build` end-to-end live flow not executed against a real project. Smoke test covers primitive integration only. First real `/ibr:build run` on a consumer project will surface any phase-sequencing issues not caught by unit tests.
- iOS 26 Liquid Glass SwiftUI modifier names (referenced in `ios-ui` and `macos-ui`) come from secondary sources — skill notes explicitly say "verify against live Xcode docs before quoting."
- macOS pointer minimum target size (`macos-ui` skill) uses WCAG 2.5.8 floor because Apple HIG doesn't publish an iOS-equivalent number.

## ❓ Unfixed

- Pre-existing `tsc --noEmit` errors in `src/mcp/tools.ts` (12 errors) and `src/native/idb.ts` (3 errors). Not introduced by this work; `tsup` build still succeeds. Out of scope for this build loop.
- Full-session e2e test (drive `/ibr:build` through a real brainstorm → plan → implement → validate cycle) — explicitly deferred to first real-world invocation.

## Commit chain (IBR)

```
7a1fc1b chore: bump version to 0.9.0-alpha
b9e1c48 feat(ui-guidance): index central + project-local templates
5190bac feat(ui-guidance): snapshot template to project active.md
8e07e62 feat(ui-guidance): promote project draft to central library with confirm gate
c206965 feat(mockup-gallery): read ratings and selections safely
3a1cfbb feat(mockup-gallery): record implementation completion
c5afc7e feat(skills): ui-guidance-library
3f57443 feat(skills): mockup-gallery-bridge
03e0d77 feat(skills): ui-brainstorm-preamble hybrid layer-1
73299f1 feat(commands): /ibr:capture unified reference ingestion
7fa5f10 feat(commands): /ibr:ui-guidance list/show/promote
34cd4de feat(commands): /ibr:build UI orchestrator with subordinate mode
2a101a5 feat(skills): macos-ui with HIG + notarization + distribution
6064eb5 feat(skills): ios-ui with HIG + FloDoro/SpeakSavvy lessons + Apple doc links
c29bed4 feat(skills): mobile-web-ui with Material 3 + WCAG 2.2 + iOS Safari
f9f6068 feat(ui-brainstorm-preamble): route to platform-specific skills
7ff48e4 docs: /ibr:build, /ibr:capture, /ibr:ui-guidance + supporting skills
2881867 test: smoke test /ibr:build primitives integration
<fixtures> test: commit smoke test fixtures so reproducible
```

build-loop: `c271225 feat: route orchestrated UI build to /ibr:build --from=build-loop`

## Execution performance (Opus spot-checks)

Sonnet implementation agents performed cleanly — each task completed in 12–70s, zero task failures, zero rework needed. One Opus-caught issue (Task 19 fixture files not staged) fixed in Phase 6 iteration before Phase 7. Parallel dispatch (6-wide peak on B4+B5) saved substantial wall-clock vs sequential.
