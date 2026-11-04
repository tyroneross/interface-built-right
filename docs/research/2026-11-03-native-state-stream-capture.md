# Native state, refs, compact output, and capture experiment

Measured 2026-11-03. Local source/build evidence; no plugin install or publication.

## Result

Native values, selection, and enabled state are preserved. Refs retain unique semantic identity through geometry/state changes, reject ambiguous or changed action-time targets, retain removed-number high-water marks, and bind persisted refs to session generation and window. Ref identity is semantic; AX cannot distinguish identical app replacements or make read/act atomic.

Compact output retains validation and links private immutable full evidence. Long values expose a 256-character preview with truncation and original length. Ref diffs include state updates rather than only membership.

## Matched navigation benchmark

| Method | Median execution ms | Median reference text tokens | Success |
|---|---:|---:|---:|
| full | 1216.8 | 2557 | 3/3 |
| observed-full | 1393.6 | 7333 | 3/3 |
| compact | 1346.9 | 2383 | 3/3 |
| refs | 1600.3 | 2780 | 3/3 |
| CUA full AX | 1076.0 | 1961 | 3/3 |

Compact output used 67.5% fewer reference text tokens than full observations. Full observations return rich static and structural data inline; compact returns controls while retaining complete data locally. This is not a lossless equivalence claim.

Same isolated Easy Terminal b4998b0a5, 1280x800 logical points, Focus → Projects (Plan) → Focus (setup). Three warm local trials per method; no randomization. IBR uses fresh CLI processes; Computer Use uses its persistent runtime. Computer Use forces full AX, not its default diff mode. Timing excludes outer tool/model roundtrips. o200k_base/tiktoken reference output-text counts exclude screenshots, prompts/history, reasoning, and actual provider billing. The earlier pretty-JSON raw baseline was 4506 tokens; current full output is minified and includes additional native state. Do not attribute all timing or token changes to a single fix.

## Streaming fixture

The final recording sampled 43 AX observations in 7.33 seconds and selected five screenshots (846,370 bytes). The largest sample-start gap was 335.1 ms despite a requested 150 ms interval. Screenshot acquisition adds latency.

Captured append, replacement, numeric checkbox change, disabled-to-enabled Send, error, cancellation, reconnection, and final reply. The 80 ms transient warning was missed. The final two PNGs were identical; preserving the final receipt establishes a final readback rather than a new visual transition.

The retained event log contains 24,122 reference text tokens; the returned manifest summary contains 1,240. These carry different information. Sending selected frames plus summary avoids placing every event in model context; image billing was not measured.

This is bounded AX polling, not AX notifications or ScreenCaptureKit video. Sampling completion does not establish agent/task completion. Capture records ordered baseline/deltas, trigger events, acquisition intervals, maximum gaps, screenshot dimensions/hashes, operation errors, and an explicit non-atomic AX/pixel boundary. It reserves finalization time, counts failed screenshot attempts, rejects partial extracts, and stores private immutable PNG copies. Backend cancellation is unavailable; timed-out read-only calls may finish later. Filesystem finalization is best effort.

## Validation and limits

Focused state/ref/CLI/MCP/capture regressions, Swift tests, typecheck, lint, package exports, source build, native fixture, and matched navigation are recorded in the benchmark evidence directory. Final focused regressions: 139 pass. Final full suite: 2014 pass, one known browser contrast failure; source hashes remained unchanged throughout that final run. Swift: 15 pass. Typecheck, lint, build, and package-export checks pass. Independent correction reviews closed the identified issues; the final missing-snapshot boundary received a yay verdict. This is composite review evidence rather than a claim that the last narrow auditor re-reviewed the entire product. One browser no-background contrast test also fails on an untouched HEAD snapshot and is outside this native change.

The first streaming harness waited for a keyframe event whose type had been overwritten by screenshot metadata; that defect was corrected and regression-tested. Initial static recordings and rejected audits remain in local evidence. Normal Claude review was blocked by a tool hook using an older blanket Keychain rule; no auth changes or repeated probes were made. Independent Codex reviews found additional issues that were repaired; cross-vendor review remains unavailable.

Production screenshot image editing was not performed. Test data is generated only in an explicitly disposable local native fixture.

## Execution receipt

The initially overlapping final-verifier attempts shared a log and are excluded. They were stopped, then one serial full verifier ran with unchanged-source hashes. The isolated benchmark app lost its window during the broad-test period; cause was not isolated. It was relaunched before all 12 final IBR navigation trials passed. Three earlier Computer Use trials used the same app revision, dimensions, and flow. No installed application or plugin was replaced.
