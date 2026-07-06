# Goal — IBR Driving Foundation (Increment 1)

## Goal

Land the three foundation epics (native depth, web robustness, native controller PRD) as spine-ready substrate toward "drive any surface, script-first, efficient." Parallel where the dependency graph allows; controller interface frozen before native fan-out.

## Scoring Criteria

| # | Epic | Criterion | Method | Pass Condition | Evidence |
|---|---|---|---|---|---|
| 1 | 4 | Controller extraction is behavior-preserving | Tests + typecheck | `session-controller.ts` exists; MCP native tools delegate to it; existing native-session MCP tests pass WITHOUT weakened assertions | `src/native/session-controller.ts`, native-session-action.test.ts |
| 2 | 4 | CLI parity + JSON replay | Run CLI | `ibr native:session:{start,read,action,close} --json` return structured results + non-zero exit on failed action/missing session/failed wait/invalid target | terminal repro |
| 3 | 4 | Interface frozen before native fan-out | Plan/graph review | Controller public types committed as Wave 0; Epic 2 PRs consume, don't redefine | git history, plan waves |
| 4 | 2 | Native efficiency: no per-action respawn | Runtime measure | A 5-step macOS flow spawns the extractor ≤ (daemon-startup + N-reads), NOT ≥10 full walks; resolved paths cached, invalidated on tree-signature change | before/after timing, daemon logs |
| 5 | 2 | Drive any macOS app | Live drive | Keyboard synthesis (a shortcut/Tab/Escape) + app launch/switch/quit + menu traversal work on a real non-sim macOS app | demo transcript |
| 6 | 3 | Per-action auto-wait + actionability | Live drive + test | click/type/fill wait for target to be present+visible+enabled+stable before acting; no fixed post-sleeps on the verified path | interaction test, code |
| 7 | 3 | Network awareness real, not faked | Test | networkidle / waitForResponse reflect actual CDP Network events, not AX-stability or 500ms sleeps | test against fetch-driven page |
| 8 | 3 | Two live bugs fixed | Mutation test | `pressKey('Meta+k')` synthesizes a real chord (opens palette), not literal chars; `flow_form`/`flow_login` honor `sessionId` (reuse session, no relaunch) | failing-then-passing test per bug |
| 9 | all | Feedback loop tightened | Review | Verify-then-proceed is the default; failed actions return structured evidence (diff + alternatives + screenshot); focused-loop-builder applied | code review, envelope |
| 10 | all | Gates green | Tooling | `npm test`, `npm run typecheck`, `npm run build`, `git diff --check` pass | terminal |

## Verification posture

Native claims (criteria 4, 5) require **running app** evidence, not compile-green — per `feedback_verify_running_app_not_compile_green` and IBR's own native-UI verify policy. Bug fixes (criterion 8) require mutation proof (failing test first) — per `feedback_verify_test_validity_by_mutation`.
