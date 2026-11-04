# Native sidebar repair and comparison — 2026-11-04

The repaired IBR selects SwiftUI sidebar rows and separates delivered actions from verified AX outcomes. All work is local. No push, publish, authentication change, or new permission grant occurred.

## Repair

A row may expose AXEnabled=false while AXSelected is writable. The Swift extractor now reports this capability. One unambiguous child text labels its AXRow/AXOutlineRow. Click/select targets the nearest selectable row; embedded buttons keep AXPress. AXCell is excluded. Unsupported actionless text fails before dispatch. Selection reads back AXSelected; repeated selection can pass without claiming a change. Value/focus verify their absolute states. Other element actions require an observed change plus any requested waiter. Stable unchanged trees and already-present waiters alone do not pass.

CLI compact refs preserve actionDelivered and verificationPassed independently, including failure. Replay checks supported action ownership and reads back outcomes. Simulator actions and coordinate actions no longer treat an unchanged tree as verification. AX change is observational evidence, not causal or persistence proof. Application-specific postconditions remain necessary for stronger claims.

## Matched local experiment

TruePace retained main97bcf06 review binary SHA25634e3636750f98e64cd829ae6057aa1f160d36c495c21ddacefb05e444d2c3d92, isolated fixture account/in-memory stores,560x680pt. Task: Today→Plan and verify selection. IBR baseline28c73a42 and repaired snapshot include dist, Swift package/sources, helper and dependency manifests. Each has a separate cwd and AX cache. Node dependencies share the existing installation. Toolchain hashes are recorded; warmup/compilation excluded. The baseline helper warmup took18.01s; repaired cached warmup0.37s. These are distinct cache states and not a cold-start comparison.

Three serial trials per driver. IBR baseline/repair order alternated; computer-use trials were a separate preceding block. Same app and fixture; reset/setup excluded. The IBR observer independently checked the actual window after each IBR attempt. Computer use checked its own returned selected row. No concurrent driver controlled the same UI. No model-inference or cross-host orchestration latency is included.

| Driver | Actual Plan selected | Reported success | Median read + action/readback | Median text tokens |
|---|---:|---:|---:|---:|
| IBR before |0/3|3/3|1.636s|1,631|
| IBR repaired |3/3|3/3|1.061s|2,685|
| Computer use |3/3|3/3|1.071s|970|

The old IBR outcomes were false successes, not fast successful navigation. Repaired IBR and computer use were approximately equal in elapsed time in this small experiment; a10ms median difference does not establish a speed advantage. Computer use used about64% fewer measured text tokens. IBR's refs/diff include more nodes, bounds and evidence metadata. The first computer-use trial was2.550s; the remaining trials1.071s and1.060s. All trials are retained, with no outlier removal.

## Isolated token method

Each trial encodes only four independently serialized components: the same task sentence, actual before observation text, action arguments, and actual result text. Exact payloads and hashes are saved in isolated-token-speed.json. Tokenizer: tiktoken0.14.0, o200k_base; [official tokenizer documentation](https://github.com/openai/tiktoken). Components are encoded independently and summed; this is an explicitly defined proxy, not a model's billed token count. Shared chat, reasoning, system/skill/tool schemas, resets, independent validation reads, image tokens, wrapper timing prose and setup instructions are excluded. No image cost or full-agent efficiency claim follows from these numbers. CUA raw text was recovered unchanged from this chat's tool output, identified by IBR_BENCH_CUA_20261104.

## Checks and limitations

Native/API/MCP/CLI suite:29files,413tests pass; TypeScript and full packaged build pass. A following targeted rerun adds an unchanged-simulator regression and passes67tests across3files. Live repeated Plan selection passes with stateChanged=false; clicking an actionless heading fails with actionDelivered=false. Test logs and immutable toolchain snapshots remain in the archived run.

On Xcode27, the simulator's legacy semantic observe route still looks for Simulator.app. Apple now exposes simulated devices in [Device Hub](https://developer.apple.com/documentation/xcode/device-hub). IBR guest refs and screenshots work; computer use through Device Hub completed the iPhone UI checks. This separate platform compatibility limitation is recorded rather than represented as a successful semantic scan. Screenshot viewport metadata is a device-profile default; actual iPhone17e capture1170x2532px and guestAX390x844pt are authoritative.

Review covered intent, sibling callers, metric provenance, fixture isolation and external-frame handling inline in Codex. No independent agent audit was run because delegation was not user-authorized; no independent-auditor approval is claimed. Physical device/iCloud delivery is outside these fixture results. See TruePace docs/maintenance/ibr-mobile-20261104 for sync findings and evidence.
