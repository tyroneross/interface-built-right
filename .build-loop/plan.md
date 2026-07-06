# Plan: IBR Increment 1 — Driving Foundation (Epics 2, 3, 4)

<!-- checklist
Item 1 — Auth guard: N/A: no server routes. IBR is a local CLI/MCP tool; no HTTP endpoints added.
Item 2 — External APIs: N/A: no new external API calls. All I/O is local — CDP over WebSocket to a local Chrome, macOS Accessibility API via the bundled Swift binary.
Item 3 — Rate-limit criterion: N/A: no paid API calls.
Item 4 — Discoverability: N/A: no UI surface. New CLI commands are documented in chunk E4-D (CLI reference + native-testing skill + release notes); reachability is pinned per capability in `## Activation Map`.
Item 5 — Server/client boundary: N/A: Node CLI/MCP package, not a web app. Public/internal boundary is `src/index.ts` exports (chunk C0 owns the export additions).
Item 6 — Concurrency: One write path — the CLI cross-process session store `.ibr/native-sessions/<sessionId>.json` (chunk E4-C). Mechanism: single-writer-per-session-file, atomic write (write temp + rename), last-writer-wins; concurrent CLI invocations against the SAME session are documented as unsupported (PRD risk mitigation). In-process MCP `sessions` Map is single-threaded (Node event loop) — no mechanism needed. Source-file concurrency: `src/bin/ibr.ts` is single-writer-sequenced (E4-C wiring hunk, then E3-E interact-success hunk).
Item 7 — Observability: Per-action provenance already emitted (tier/confidence/resolved element/postAction) — preserved and extended by the ActionOutcome contract (F-09): every action logs/returns `{validator, provenance, evidence-on-fail}`. Daemon (E2-A) writes a structured log line per request (op, pid, cacheHit, durationMs) to `.ibr/logs/ax-daemon.log`. CLI (E4-C) emits structured JSON on `--json`.
Item 8 — Input validation: MCP: JSON schema on every tool (existing, extended enums in E4-B). CLI: argument validation at the top of each `native:session:*` handler in `src/bin/native-session-cli.ts` — invalid target/missing session → non-zero exit + structured error JSON (T-03). Daemon: request-shape validation before dispatch in Swift (malformed request → error response, never a crash).
Item 9 — Stable ID traceability: U-01 → F-04/F-05 → T-04/T-05/T-12; U-02 → F-06/F-07/F-08 → T-06/T-07/T-08a/T-08b; U-03 → F-01/F-02/F-03 → T-01/T-02/T-03; cross-cutting F-09 → T-09, F-10 → T-10. Every P0 feature row carries a T- reference (see Spec Object).
Item 10 — JSON spec object: present — `## Spec Object (JSON)` section below; markdown rendered from it.
Item 11 — Blocking-and-novel question gate: zero open questions. Three unknowns resolved as labelled assumptions ([ASSUMED] blocks in ADR-02 / E2 chunk specs): TCC permission inheritance by daemon (same binary path → same grant — probed live in the E2-A spike, incl. the same-path/changed-content case), CGEventPostToPid for background keyboard delivery (fallback: foreground-retry + post, reusing 3e9375a machinery), file-backed CLI session store (PRD's own mitigation). All are reversible defaults; none changes a P0 acceptance test if flipped.
Item 12 — Low-reversibility ADRs: ADR-01 (controller boundary shape — frozen public contract), ADR-02 (daemon vs respawn-with-cache), ADR-03 (tools.ts physical split at Wave 0). All three below with alternatives/tradeoffs/rollback.
Item 13 — Analytical lens: DSM (dependency-structure matrix) — the plan's core problem is cross-component dependency ordering (freeze-before-fanout, file contention); plus TRIZ on the Epic2/Epic4 contradiction ("Epic 2 must extend the native surface" vs "the native surface is frozen") resolved by separating the invariant (types + dispatch) from the variant (backend implementations).
Item 14 — Handoff document: `.build-loop/plans/increment-1-driving-foundation.handoff.md` (sibling file, written with this plan).
Item 15 — Synthesis dimensions: N/A: no UI surface.
Item 16 — Risk reason: `risk_reason: runtime protocol` on chunks C0 and E4-B (MCP tool schemas + controller public types are contracts external agents — Claude/Codex plugin users — depend on at runtime). No other canonical value applies.
Item 17 — UI input/output contract: N/A: no UI surface — this increment is engine/CLI/MCP work only. Stated explicitly so Review does not flag it (plan requirement 6).
Item 19 — Env-var manifest: N/A: no new external service.
-->

---
modifies_api: true
scope_auditor_status: audited
---

## Goal

Land the three foundation epics — native controller extraction with a frozen typed boundary (Epic 4), native depth via a persistent AX daemon + keyboard/lifecycle/menu capabilities (Epic 2), and flake-free web driving via per-action auto-wait, real network awareness, and two live bug fixes (Epic 3) — as spine-ready substrate for the Increment-2 capture→replay→escalate spine. One falsifiable sentence: **after this increment, a 5-step macOS flow runs without per-step extractor respawn, a real non-sim macOS app can be driven by keyboard/lifecycle/menu, web verbs never act on a stale/hidden element or fake-report success (MCP `interact`/`session_action` AND CLI `ibr interact` — the CLI's unconditional success line at ibr.ts:4780 is in scope via E3-E), and the same native session lifecycle runs identically through API, MCP, and CLI — all provable by T-01..T-12.**

Certainty markers: all file/line citations below were re-verified by direct code read on 2026-07-06 (✅), including the C0 removal-region boundary (native block begins at tools.ts:2058, `handleNativeSessionStart`; ends at :2727, `formatNativeCandidate` close — `handleScan` begins at :2728), the sessions registry (`sessions` Map at tools.ts:92, `__test_setSession` at :102), and the six web→native delegation call sites (tools.ts:1722/1727, 1803/1808, 1944/1949). Anything marked [ASSUMED] is a labelled default, not a verified fact.

## Locked Decisions

| Decision | Value | Notes |
|---|---|---|
| Analytical lens | DSM (dependency ordering) + TRIZ (frozen-yet-extensible contradiction) | Item 13 |
| Wave 0 | Epic 4 Slice 1: controller extract + FREEZE + physical native/web split of `src/mcp/tools.ts` | ADR-01, ADR-03 |
| Controller boundary | Path B — typed contract with `NativeBackend` seam + full v1 action surface declared up front | ADR-01 |
| Daemon | Path B — long-lived Swift daemon with resolved-path cache | ADR-02 |
| Sessions registry | C0 extracts the shared `sessions` Map into `src/mcp/sessions.ts`; import direction is one-way (web → native, never reverse) | F1/Gap2 resolution, see MECE section |
| ActionOutcome wire timing | INTERNAL-ONLY at C0 (native MCP wire byte-identical in Wave 0); native wire gains `validator`/`evidence` at E2-B; web wire at E3-E | F4 resolution |
| `target` requiredness | Frozen types: `target` optional for `keystroke`/`app` kinds, required for element-targeted kinds; wire `required` array changes at E4-B, never silently | see E4-B spec |
| Release gate | No version bump / GitHub Release before T-05 passes (publish-npm.yml fires on GitHub Release) | V1 acceptance |
| No Playwright | Ever | intent.md |
| Capture→replay spine | OUT — Increment 2. Every artifact here must be spine-ready (typed boundary, provenance preserved, verify-then-proceed default) | intent.md |
| Model org | Opus orchestrates; Sonnet 5 implements; Fable = advisor + all critic verdicts; escalation target Sonnet→Opus | intent.md |
| UI I/O contract | Not required — engine work, no UI surface | plan req. 6 |
| Sub-agent cap | 8 parallel implementers; this plan peaks at 5 concurrent | plan req. 5 |
| Fixtures | Local HTML fixtures for web tests; no personal content in fixtures | memory rule |

## Scope

**In scope:** Epic 4 (all 4 PRD slices: controller extract, MCP thin adapters, CLI `ibr native:session:{start,read,action,close}`, docs); Epic 2 (Swift AX daemon + resolved-path cache, keyboard synthesis to arbitrary macOS apps, app lifecycle launch/switch/quit, AXMenu traversal); Epic 3 (per-action auto-wait + actionability, real CDP network awareness, frames + dialog handling, the two live bugs with mutation-proof tests, CLI `ibr interact` success-semantics alignment); the per-action feedback-loop contract (F-09) across Epic 3 verbs and Epic 4 controller actions.

### Out of scope

- The capture→replay→escalate spine itself (Increment 2). We freeze the seams it will consume; we do not build it.
- Playwright, ever.
- Remote hosted API; IDB-required macOS workflows.
- Rewriting the macOS AX extractor beyond what daemon/controller extraction requires.
- Digital Crown, multi-touch, drag-drop.
- A web implementation of the session-controller interface (spine work; this increment only makes the web side emit the same `ActionOutcome` shape).
- `src/native/scan.ts` / one-shot native scan paths — they keep the respawn backend untouched (they are single-shot by nature; daemon buys them nothing this increment). E2-A's flag-matrix check protects them (see E2-A acceptance).
- `mobile-ui/sim-driver` — the CGEvent-typing generalization happens in `ibr-ax-extract` (Epic 2), NOT by editing the sim-driver binary (its `com.apple.iphonesimulator` targeting at `mobile-ui/sim-driver/Sources/main.swift:73` stays as-is for sim flows).

## Dependency Graph & Waves

```
WAVE 0 ──────────────────────────────────────────────────────────────
  C0  Epic4-S1: extract session-controller + NativeBackend seam
      + sessions registry (src/mcp/sessions.ts) + golden-shape suite
      + move native MCP handlers → src/mcp/native-tools.ts + FREEZE   [opus]
  ── concurrent with C0 (file-disjoint from C0, verified):
  E3-A  actionability/auto-wait engine verbs (src/engine only)        [sonnet]
  E3-C1 BUG: chord synthesis (cdp/input.ts + flows/search.ts)         [sonnet]

WAVE 1 (fan-out after C0 commit = freeze point) ─────────────────────
  Epic 4 thread:   E4-B (MCP adapters+tests) → E4-C (CLI) → E4-D (docs)
  Epic 2 thread:   E2-A (daemon+cache) → E2-B (keyboard) → E2-C (lifecycle) → E2-D (menu)
  Epic 3 thread 1: (E3-A) → E3-B (network) → E3-D (frames/dialogs)
  Epic 3 thread 2: E3-C2 (BUG: flow sessionId) → E3-E (web MCP + CLI verify-then-proceed)
                   [E3-E also depends on E3-A; its ibr.ts hunk waits
                    for E4-C's ibr.ts wiring commit — single-writer]

WAVE 2 ──────────────────────────────────────────────────────────────
  V1  integration verification: gates, criterion-4 timing, criterion-5
      live demo transcript, evidence bundle, release gate              [sonnet]
```

Peak concurrency: Wave 0 = 3; Wave 1 = 5 (E4-B, E2-A, E3-B, E3-C2, +E4-C as E4-B finishes). Cap 8 respected.

**Why Epic 2 depends on C0 (freeze-before-fanout):** daemon/keyboard/lifecycle/menu consume the frozen `NativeBackend` interface — they never re-embed logic in MCP handlers, and they never edit `session-controller.ts` (criterion 3).

**Why E3-A/E3-C1 may start in Wave 0:** their owned files (`src/engine/driver.ts`, new `src/engine/actionability.ts`, `src/engine/cdp/input.ts`, `src/flows/search.ts`) are disjoint from every C0-owned file (verified against C0's file list below — note C0 owns `src/engine/session-tools.test.ts`, which E3-A does NOT touch; E3-A owns `src/engine/engine.test.ts`/`compat.test.ts`).

### Dispatch decision (parallel_batch)

- parallel_batch: wave-0 = [C0, E3-A, E3-C1] — file-disjoint, dispatched concurrently.
- parallel_batch: wave-1 = [Epic4-thread, Epic2-thread, Epic3-thread-1, Epic3-thread-2] — four concurrent threads after the C0 freeze commit.
- parallel_batch: wave-2 = [V1] — single verifier.
- parallel_skipped_reason: E2-A→E2-B→E2-C→E2-D serialized — all four share the Swift request-dispatch table in `src/native/swift/ibr-ax-extract/Sources/**`; same-file risk resolved by serialization, not co-ownership.
- parallel_skipped_reason: E4-B→E4-C→E4-D serialized — E4-C consumes E4-B's shared test fixtures; E4-D documents both.
- parallel_skipped_reason: E3-A→E3-B→E3-D serialized — one owner thread on `src/engine/driver.ts` + `src/engine/cdp/*`.
- parallel_skipped_reason: E3-C2→E3-E serialized — both edit `src/mcp/tools.ts` web regions.
- parallel_skipped_reason: E3-E's `src/bin/ibr.ts` interact-success hunk lands after E4-C's ibr.ts wiring commit — single-writer sequence on ibr.ts (E4-C → E3-E); the rest of E3-E does not wait on E4-C.

## Depends-on (reads-from)

Cross-chunk reads. Every entry re-verified by direct code read 2026-07-06.

- `src/native/backend.ts` `NativeBackend` interface (E2-A/B/C/D read C0's frozen seam) — verified
- `src/mcp/sessions.ts` registry — extraction of the `sessions` Map (tools.ts:92) + `__test_setSession` (tools.ts:102); read by BOTH `tools.ts` (web) and `native-tools.ts` (native) — verified
- Frozen web→native delegation signatures (or the controller calls replacing them) — `startMacOSSession`/`startSimulatorSession` (defs tools.ts:2151/2174; web call sites 1722/1727), `runMacOSSessionAction`/`runSimulatorSessionAction` (defs 2349/2406; call sites 1803/1808), `readMacOSSession`/`readSimulatorSession` (defs 2207/2273; call sites 1944/1949); read by tools.ts web handlers session_start/session_action/session_read — verified
- `src/action-outcome.ts` frozen `ActionOutcome` type (E4-B, E2-B, E3-E read C0's frozen type) — verified
- C0 golden-shape snapshot fixtures + shared session-controller test fixtures (E4-B and E4-C read them for adapter/CLI shape tests) — verified
- `src/engine/actionability.ts` waits + validator primitives (E3-E reads E3-A's output) — verified
- `src/engine/driver.ts` auto-waiting verbs (E3-B/E3-D extend E3-A's verbs in the same thread) — verified
- `src/native/extract.ts` `ensureExtractor` rebuild-and-replace path, extract.ts:27–53 (E2-A daemon spawn + TCC spike read this) — verified
- `nativeStateSignature` (tools.ts:2693, moves into the controller at C0; E2-A cache invalidation reads it) — verified
- `.ibr/native-sessions/<sessionId>.json` CLI session store (written and read by E4-C itself; cross-process reuse in T-03) — verified
- `.build-loop/evidence/increment-1/**` (V1 reads every chunk's evidence artifacts) — verified

## Activation Map

Every NEW capability with the exact wiring that makes it reachable. No capability ships dormant; V1 flips each `pending` to yes with evidence.

- CLI commands `ibr native:session:{start,read,action,close}` — trigger: command-registration hunk in `src/bin/ibr.ts` wiring `src/bin/native-session-cli.ts` (E4-C) — verified-live: pending (T-03 terminal transcript)
- Extended `native_session_action` enums (`keystroke`/`app`/`menuPath`) — trigger: `native-tools.ts` tool definitions aggregated into the TOOLS export that `src/mcp/tools.ts` re-exports to the MCP server (E4-B) — verified-live: pending (T-05)
- `DaemonBackend` — trigger: `NativeBackend` selection switch in `src/native/backend.ts` (daemon default once E2-A lands; `IBR_NATIVE_BACKEND=respawn` override; kill-9 auto-fallback) (E2-A) — verified-live: pending (T-04)
- Keyboard / lifecycle / menu capabilities — trigger: `native_session_action` MCP dispatch and CLI `native:session:action` → controller generic pass-through → `DaemonBackend` methods (E2-B/C/D) — verified-live: pending (T-05)
- Sessions registry `src/mcp/sessions.ts` — trigger: module import from both `tools.ts` and `native-tools.ts` at MCP server load (C0) — verified-live: pending (T-01)
- Web `validator`/`evidence` on the wire — trigger: every `interact`/`session_action` response path in `tools.ts` (E3-E) — verified-live: pending (T-09)
- CLI `ibr interact` truthful success line — trigger: interact result path in `src/bin/ibr.ts` (today unconditional at :4780) keyed to `ActionOutcome.success` (E3-E) — verified-live: pending (T-09 CLI leg)
- Native-wire `validator`/`evidence` fields — trigger: `nativeActionResponse` payload assembled from the controller's `ActionOutcome` (E2-B) — verified-live: pending (T-05)

## Permission tiers (tools & commands)

permission_tier: LOCAL for every tool and command this plan adds or extends. IBR tools are local-machine only — CDP over WebSocket to a local Chrome, macOS Accessibility via the bundled Swift binary; no auth, no network egress, no remote API. The new CLI commands (`native:session:*`), the extended MCP enums on `native_session_action`, and the daemon backend all inherit the existing local-tool permission tier posture (same process user, same TCC accessibility grant surface). No permission-tier escalation anywhere in this increment.

## Epic2 / Epic4 MECE resolution (the contested seam)

The contradiction: Epic 2 must ADD native capabilities (keyboard/lifecycle/menu actions) while Epic 4's controller is FROZEN at Wave 0, and today both epics' logic lives interleaved in `src/mcp/tools.ts` (native tool schemas at 980–1086; switch dispatch cases at 1240–1247; handlers + type-dispatch + execution at 2058–2727 — re-verified 2026-07-06). Resolution — separate invariant from variant:

1. **C0 (Wave 0) declares the FULL v1 type surface**, including the Epic 2 capabilities as typed action/op kinds: `keystroke` (chord syntax), `app` lifecycle ops (`launch|switch|quit`), `menuPath` traversal. The controller's action dispatch is a **generic pass-through to `NativeBackend`** — new action kinds require zero controller edits. Type decision (recorded here, frozen at C0): `target` is **optional for `keystroke` and `app` kinds** (a chord may go to the focused element; app ops target the app itself) and **required for element-targeted kinds**. The MCP wire's `required` array is untouched in Wave 0 (byte-identical wire); it changes at E4-B, explicitly and coherently — see E4-B spec.
2. **`src/native/backend.ts`** (created in C0, ownership transfers to Epic 2 at Wave 1): `NativeBackend` interface — `extract`, `performAction`, `screenshot`, `keystroke`, `lifecycle`, `menu` — plus `RespawnBackend` (wraps today's `extractMacOSElements`/`performNativeAction`; returns structured `not-implemented` for the three new methods).
3. **Epic 2 implements `DaemonBackend`** in its own files and fills in the three capabilities. It owns `src/native/**` (TS) + `src/native/swift/ibr-ax-extract/**` (Swift). It never touches `session-controller.ts`, `native-tools.ts`, or `ibr.ts`.
4. **Physical file split (ADR-03):** C0 moves native MCP tool definitions + handlers verbatim into `src/mcp/native-tools.ts` (thin adapters over the controller); `src/mcp/tools.ts` keeps web handlers + a single aggregation import. From Wave 1: Epic 3 owns `tools.ts`, Epic 4 owns `native-tools.ts`. Zero co-owned files anywhere in Wave 1 (ibr.ts is single-writer-SEQUENCED: E4-C then E3-E — see dispatch decision).
5. **Sessions registry (the shared-state seam):** C0 extracts the shared `sessions` Map (tools.ts:92) and the `__test_setSession` test hook (tools.ts:102) into **`src/mcp/sessions.ts`** — owned by C0 at Wave 0, FROZEN afterward (registry shape changes would ripple into both epics). Both `tools.ts` and `native-tools.ts` import it. **Import direction is one-way and explicit: `tools.ts` (web, Epic 3's Wave-1 file) imports native execution + the registry from `native-tools.ts` / `sessions.ts` / `session-controller.ts` — NEVER the reverse.** `native-tools.ts` must not import from `tools.ts` (falsifier: any `from './tools'` import in native-tools.ts or sessions.ts → FAIL).
6. **Frozen delegation signatures:** the web session tools delegate to native execution for native-typed sessions at six verified call sites — `startMacOSSession`/`startSimulatorSession` (tools.ts:1722/1727), `runMacOSSessionAction`/`runSimulatorSessionAction` (1803/1808), `readMacOSSession`/`readSimulatorSession` (1944/1949); definitions at 2151/2174, 2349/2406, 2207/2273. C0 FREEZES these six signatures — or, where C0 replaces a delegation with a controller call, the replacing controller-call signature — because Epic 3's file keeps calling them across the boundary. Rows added to the signature-change table.
7. **`sim_action` disposition:** definition at tools.ts:1116, handler `handleSimAction` at :3828 — **stays in `tools.ts`, web/sim-owned**. It is not part of the native extraction; Epic 3's thread owns it untouched.
8. **Extended MCP schema enums** (exposing `keystroke`/`app`/`menuPath` through `native_session_action`) live in `native-tools.ts` and are written by **E4-B** (Epic 4), matching the C0-frozen types exactly. Until Epic 2 lands, they return the `RespawnBackend`'s structured `not-implemented` — everything converges before release, inside this increment (enforced by the V1 release gate). This is the ONE deliberate cross-epic contract; E4-B carries a named equality falsifier (see acceptance).

**Swift file contention inside Epic 2:** today all Swift logic is one file (`Sources/main.swift`). E2-A modularizes it (Daemon/Extract/Actions/Keyboard/Lifecycle/Menu files) as part of the daemon refactor; E2-B/C/D then each own one Swift module. Because they still share a request-dispatch table, **Epic 2 runs as ONE serialized implementer thread (A→B→C→D)** — no intra-epic parallel dispatch. Called out per plan requirement 1 and recorded in the dispatch decision (`parallel_skipped_reason`).

## Chunk Table (commit per chunk)

| # | Chunk | Commit subject | dispatch_tier + justification | Depends on |
|---|---|---|---|---|
| 1 | C0 | `refactor(native): extract session-controller + sessions registry, freeze v1 contract, split native MCP tools` | `opus` — behavior-preserving extraction + contract design; a wrong boundary ripples into every Wave-1 chunk. `risk_reason: runtime protocol` | — |
| 2 | E3-A | `feat(engine): per-action auto-wait + actionability checks in click/type/fill` | `sonnet` — bounded engine work with a crisp falsifier (T-06) | — |
| 3 | E3-C1 | `fix(engine): pressKey synthesizes real modifier chords (failing test first)` | `sonnet` — surgical bug fix, mutation-proof protocol | — |
| 4 | E4-B | `refactor(mcp): native session tools as thin controller adapters + extended action enums` | `sonnet` — mechanical conversion against a frozen contract. `risk_reason: runtime protocol` | C0 |
| 5 | E4-C | `feat(cli): ibr native:session:{start,read,action,close} --json with exit codes` | `sonnet` — new surface but fully specified by PRD + frozen types | C0 (E4-B for shared test fixtures only — soft) |
| 6 | E2-A | `feat(native): persistent Swift AX daemon + resolved-path cache` | `opus` — protocol/lifecycle design judgment (daemon spawn, cache invalidation, orphan handling); highest-risk execution chunk | C0 |
| 7 | E2-B | `feat(native): keyboard synthesis (chords, Tab/Escape/arrows) to arbitrary macOS apps` | `sonnet` — consumes frozen backend seam | E2-A |
| 8 | E2-C | `feat(native): app lifecycle launch/switch/quit` | `sonnet` | E2-B (serialized thread) |
| 9 | E2-D | `feat(native): AXMenu traversal after AXShowMenu` | `sonnet` | E2-C (serialized thread) |
| 10 | E3-B | `feat(engine): real CDP network awareness — networkidle + waitForResponse` | `sonnet` | E3-A (same owner thread — driver.ts) |
| 11 | E3-C2 | `fix(mcp): flow_form/flow_login honor sessionId (failing test first)` | `sonnet` | C0 (tools.ts split) |
| 12 | E3-E | `feat(mcp+cli): verify-then-proceed web actions — validator + structured failure evidence, no fixed sleeps, truthful CLI success` | `sonnet` | E3-A, E3-C2 (tools.ts serialization), E4-C (ibr.ts single-writer sequence — soft, ibr.ts hunk only) |
| 13 | E3-D | `feat(engine): iframe + dialog handling` | `sonnet` | E3-B (same owner thread) |
| 14 | E4-D | `docs: API/MCP/CLI split, CLI reference, native-testing skill, codex-plugin skills, AGENTS.md, release notes` | `sonnet` — accuracy matters (documents contracts) | E4-B, E4-C |
| 15 | V1 | `test(verify): increment-1 evidence bundle — timing, live-drive transcript, gates, release gate` | `sonnet` — evidence gathering against named falsifiers | all |

## MECE File Ownership (one owner per file per wave)

**C0 (Wave 0)** — NEW: `src/native/session-controller.ts`, `src/native/session-controller.test.ts`, `src/native/backend.ts`, `src/action-outcome.ts` (shared spine-ready `ActionOutcome` type), `src/mcp/native-tools.ts`, `src/mcp/native-tools.test.ts` (receives moved native describe blocks + the golden-shape suite), `src/mcp/sessions.ts` (sessions registry: Map from tools.ts:92 + `__test_setSession` from :102). EDIT: `src/mcp/tools.ts` — remove native tool schemas 980–1086; convert native switch cases 1240–1247 to the aggregation delegation; move the native implementation block **2058–2727** (re-verified: `handleNativeSessionStart` at :2058 through `formatNativeCandidate` closing at :2727; `handleScan` begins :2728; native-only helpers `nativeTargetNotFound` :2512, `nativeActionResponse` :2526, `waitForMacOSPostAction` :2554, `waitForSimulatorPostAction` :2609, `nativeStateSignature` :2693, `safeFilePart` :2708, `sleep` :2712, `formatNativeCandidate` :2716 all grep-verified native-only). **Lines 2000–2057 STAY** — web `session_read` tail (≤2019), `session_close` (2021–2040), `sim_action` dispatch (2042–2043), `design_system` dispatch (2045–2046), `handleToolCall` close. Also EDIT: `src/mcp/native-session-action.test.ts`, `src/mcp/tools.test.ts`, `src/engine/session-tools.test.ts`, `src/mcp/f4-chrome-warning.test.ts` (all four import `handleToolCall`/`TOOLS` and pin moved native behavior — import-path/relocation edits only, **assertions unweakened**; native describe blocks relocate to `src/mcp/native-tools.test.ts`), `src/index.ts`, `src/native/index.ts`.

**Wave-1 split of the C0-touched test files:** native describe blocks (from session-tools.test.ts, f4-chrome-warning.test.ts, tools.test.ts, native-session-action.test.ts) → E4-B via `src/mcp/native-tools.test.ts`; remaining web describe blocks stay with the Epic-3 tools.ts thread (E3-C2→E3-E owns `src/engine/session-tools.test.ts` web blocks + `src/mcp/f4-chrome-warning.test.ts` web blocks + `src/mcp/tools.test.ts`).

**E4-B** — `src/mcp/native-tools.ts`, `src/mcp/native-tools.test.ts`, `src/mcp/native-session-action.test.ts`.
**E4-C** — NEW: `src/bin/native-session-cli.ts` (+ test), `src/native/session-store.ts` (+ test; `.ibr/native-sessions/` file store). EDIT: `src/bin/ibr.ts` (one wiring hunk; ibr.ts is single-writer-SEQUENCED — E3-E's interact-success hunk lands only after this commit).
**E4-D** — `docs/**` (CLI reference), `skills/**` (native-testing), `.codex-plugin/skills/**` + `AGENTS.md` (both document `native_session_*`/`session_action` behavior changed by E4-B/E3-E), `CHANGELOG.md`, root `CLAUDE.md` (tool table row).

**E2 thread (A→B→C→D)** — `src/native/swift/ibr-ax-extract/Package.swift` + `Sources/**` (E2-A modularizes main.swift; B/C/D own their modules within the serialized thread). NEW: `src/native/daemon.ts` (+ test), `src/native/resolved-path-cache.ts` (+ test), `src/native/lifecycle.ts` (+ test). EDIT: `src/native/backend.ts` (DaemonBackend + selection; ownership transferred from C0 at wave boundary), `src/native/extract.ts`, `src/native/macos.ts`, `src/native/actions.ts` (+ their tests), `src/native/index.ts` (Wave-1 owner).

**E3 thread 1 (A→B→D)** — `src/engine/driver.ts`, NEW `src/engine/actionability.ts` (+ test), `src/engine/cdp/network.ts`, `src/engine/cdp/page.ts`, `src/engine/cdp/target.ts`, `src/engine/compat.ts`, `src/engine/engine.test.ts`, `src/engine/compat.test.ts`, new fixture files under `src/engine/fixtures/` (no personal content).
**E3-C1** — `src/engine/cdp/input.ts`, `src/flows/search.ts`, `src/flows/search.test.ts`.
**E3-C2 → E3-E (serialized on tools.ts)** — `src/mcp/tools.ts` (web handler regions: flow_form/flow_login at ~1539/1575; interact ~1284–1315; session_action ~1860–1925), `src/mcp/tools.test.ts` (Wave-1 owner), `src/engine/session-tools.test.ts` (web blocks, Wave-1 owner), `src/mcp/f4-chrome-warning.test.ts` (web blocks, Wave-1 owner), `src/flows/form.ts`, `src/flows/login.ts` (+ tests), plus E3-E only: the `src/bin/ibr.ts` interact-success hunk (~:4779–4780; sequenced behind E4-C).
**V1** — no source files; writes `.build-loop/evidence/increment-1/**` only.

**Orphan check:** every file cited in assessment findings has exactly one Wave-1 owner above; `src/native/scan.ts`, `mobile-ui/**`, Safari engine files are explicitly untouched (out of scope). **Rule for surprises:** if an implementer finds it must edit a file owned by another chunk, it STOPS and reports — the orchestrator serializes or re-splits; it never edits across the boundary.

## Cross-boundary signature changes (for scope-auditor)

| Chunk | Change | Who consumes |
|---|---|---|
| C0 | NEW public exports: `NativeSessionController`, request/response types, `NativeBackend`, `ActionOutcome` via `src/index.ts`. MCP tool names/schemas byte-identical in Wave 0. | E2, E4-B/C, Increment-2 spine |
| C0 | NEW `src/mcp/sessions.ts` module: `sessions` registry + `__test_setSession` (moved verbatim from tools.ts:92/:102). FROZEN after Wave 0. Import direction: tools.ts → sessions.ts/native-tools.ts/controller, never reverse. | tools.ts (web), native-tools.ts (native), tests |
| C0 | Six web→native delegation signatures FROZEN — start/run/read × macOS/simulator (defs tools.ts:2151/2174, 2349/2406, 2207/2273; web call sites 1722/1727, 1803/1808, 1944/1949) — or the controller calls that replace them. | tools.ts web session_start/session_action/session_read on native sessions |
| E4-B | `native_session_action` schema enum EXTENDED (`keystroke`, `app`, `menuPath` + `menuPath`/`appOp` params) — additive only, existing calls unchanged. Wire `required` changes `['sessionId','action','target']` → `['sessionId','action']` (additive-permissive; `target` enforced per-kind in the handler — element kinds still reject a missing target). The moved required-array assertion (originally session-tools.test.ts:197) is updated at E4-B in `native-tools.test.ts`, coherently and explicitly — never silently. | MCP clients (Claude/Codex) |
| E4-C | NEW CLI commands `native:session:*` — additive; no existing command changed. permission tier: LOCAL (see Permission tiers section). | CI, humans, replay scripts |
| E2-A | Swift extractor gains `--daemon` mode; ALL existing one-shot flags preserved (respawn fallback + scan.ts depend on them; live flag-matrix check in acceptance) | RespawnBackend, scan.ts |
| E2-B | Native MCP wire (`native_session_action` response via `nativeActionResponse`) gains `validator` + `evidence` fields from the controller's `ActionOutcome` — additive; first native wire exposure of the C0-internal contract | MCP clients, Increment-2 spine |
| E3-A | `EngineDriver.click/type/fill/check/select` — signatures unchanged, BEHAVIOR now auto-waits (package export; downstream: CLI interact at `ibr.ts:4768`, MCP handlers — both benefit, neither edited by E3-A) | all web callers |
| E3-B | `CompatPage.goto({waitUntil:'networkidle'})` semantics change from AX-stability fake (compat.ts:207–212) to real Network-event quiescence; `waitForResponse`/`waitForNavigation` become real | flows, LiveSession |
| E3-C2 | `flow_form`/`flow_login` behavior aligns to already-advertised schema (`sessionId` honored — schema at tools.ts:815/836 unchanged) | MCP clients |
| E3-E | `interact`/`session_action` responses gain `validator` + `evidence` fields; `success` may now be `false` where it previously lied `true` — **intentional breaking behavior fix**, flagged for release notes (E4-D). CLI `ibr interact` result line keyed to `ActionOutcome.success` (today unconditional at ibr.ts:4780, after a fixed 500ms sleep at :4779 — both replaced). | MCP clients, CLI users |

## Per-chunk acceptance criteria → goal.md criteria

| Chunk | Goal criteria | Acceptance (falsifier named) |
|---|---|---|
| C0 | 1, 3, 10 | T-01: existing native-session MCP tests pass with zero weakened assertions (falsifier: any assertion edit beyond import paths/relocation → FAIL) — includes the four cross-boundary pinning files (native-session-action.test.ts, tools.test.ts, session-tools.test.ts, f4-chrome-warning.test.ts). **T-01g golden-shape snapshot suite, written BEFORE the refactor**, covering: `native_session_start` app/pid/simulator response shapes + error messages; all 4 `native_session_read` modes; `nativeTargetNotFound` + `errorResponse` shapes; AND the three cross-tool routes (web `session_action`/`session_read`/`session_close` operating on native sessions) (falsifier: any post-refactor byte diff vs snapshot → FAIL). T-02: controller unit tests — success action, missing target, wait timeout, screenshot mode; plus type-level test that `target` is optional for `keystroke`/`app` kinds and required for element kinds. Freeze commit exists before any Wave-1 branch (falsifier: `git log` shows Epic-2 commit ancestor-of-or-parallel-to C0). Import-direction check: no `from './tools'` in native-tools.ts/sessions.ts (falsifier: grep hit → FAIL). 3e9375a gains preserved: foreground retry, waitFor, waitTimeoutMs, postAction evidence, screenshot read all exercised by T-01/T-02. ActionOutcome is INTERNAL-ONLY at C0 — native wire byte-identical (T-01g pins it). |
| E4-B | 1, 9, 10 | Adapters contain zero orchestration logic (falsifier: any `extractMacOSElements`/`performNativeAction` import in native-tools.ts). MCP output content-compatible against C0's golden-shape suite. **Enum↔frozen-type equality falsifier:** a unit test asserts the `native_session_action` action-enum set equals the C0-frozen controller action-kind union, and the `appOp`/`menuPath` param schemas match the frozen op types (falsifier: any enum value without a frozen type, or any frozen kind absent from the enum, fails the equality test). Required-array change made explicitly: moved assertion updated from `['sessionId','action','target']` to `['sessionId','action']` + per-kind validation tests (element kinds reject missing target) — silent edit of the moved assertion = FAIL. |
| E4-C | 2, 10 | T-03: each command exits non-zero on failed action / missing session / failed wait / invalid target, and emits structured JSON on `--json`; copy-paste repro from an agent log works cross-process via session-store (terminal transcript in evidence bundle). |
| E2-A | 4, 10 | T-04 (RUNNING-APP): instrumented 5-step flow on a real app — extractor process spawn count ≤ 1 (daemon) vs ≥10 today; before/after wall-time recorded. T-12: cached resolved path invalidated when `nativeStateSignature` changes (falsifier: action on a stale path after UI mutation succeeds against wrong element). Daemon crash → automatic respawn-backend fallback (kill -9 test). **Spike checklist (before E2-B/C/D build on the daemon):** (a) daemon-outlives-Node-parent — real orphan scenario: Node parent exits normally AND via SIGKILL; daemon must follow its reap/exit policy, never linger unsupervised; (b) post-rebuild binary replacement — extract.ts:27–53 rebuilds and copies over the same path on staleness; probe TCC live for "same path ≠ same content" (grant behavior after binary content changes at an unchanged path); (c) ≥1 app-switch mid-daemon-session (AX staleness across switches). The [ASSUMED] TCC-inherits rationale is shaky for an unsigned per-project-copied binary — the spike probes it live, it is not assumed forward. **Live flag-matrix check post-Swift-refactor:** one-shot `extract`, `action`, `--resolve-app`, `--analyze-layout` each run against a real app after modularization (TS tests mock the binary — macos.test.ts:10, actions.test.ts:13 — so a Swift one-shot regression stays npm-test-green; scan.ts depends on these flags; falsifier: any flag's live run diverges from pre-refactor behavior). |
| E2-B | 5, 9 | RUNNING-APP: chord (e.g. ⌘N) + Tab/Escape/arrows delivered to a real non-sim app; ActionOutcome validator confirms expected state change. Native wire gains `validator`/`evidence` here (additive — signature table row); golden-shape suite extended, not weakened. |
| E2-C | 5 | RUNNING-APP: launch → switch → quit of a real app through controller ops; session survives switch. |
| E2-D | 5 | RUNNING-APP: AXShowMenu then walk opened AXMenu, select an item, validator confirms result (falsifier: menu fires but selection unverified). |
| E3-A | 6, 9 | T-06: click/type/fill against fixture with delayed-render / hidden / disabled / moving target waits for present+visible+enabled+stable then acts; zero `setTimeout`-style fixed sleeps on the verified path (falsifier: grep for fixed sleeps in verb path). **Timing falsifier:** engine suite wall time ≤ baseline +20%; ZERO per-test timeout increases (the auto-wait analogue of assertion-weakening — any raised test timeout = FAIL); unit test for stale-elementId re-resolution during auto-wait (driver.ts:580–582 throws on stale backendNodeId today — auto-wait polling on a re-rendering element must re-resolve, never act on the dead node). |
| E3-B | 7, 10 | T-07: networkidle/waitForResponse driven by real CDP Network events against a fetch-driven fixture page (falsifier: test passes with Network domain events disabled → the wait is fake). |
| E3-C1 | 8 | T-08a MUTATION-FIRST: failing test proving `pressKey('Meta+k')` currently types literal chars (input.ts:38–44 fallthrough to `type()` — verified), then fix: modifier-aware chord dispatch; flow_search's ⌘K fallback (search.ts:117–123) becomes live and covered. |
| E3-C2 | 8 | T-08b MUTATION-FIRST: failing test proving `flow_form`/`flow_login` ignore `sessionId` and relaunch (tools.ts:1540/1576 destructure omits it — verified), then fix: reuse sessions-map driver, no `driver.launch()` when sessionId valid, no `driver.close()` on borrowed session. |
| E3-E | 9, 6 | T-09: a click that changes nothing returns `success:false` + evidence `{before/after diff, ranked alternatives, screenshot}` (falsifier: today's session_action returns unconditional `success:true` at tools.ts:1887–1897 — verified); fixed 500ms sleeps at tools.ts:1299/1881 removed; provenance (tier/confidence/autoResolved) preserved and extended, never stripped. **CLI leg:** `ibr interact` result line keyed to `ActionOutcome.success` — the fixed sleep + unconditional `✓ succeeded` at ibr.ts:4779–4780 replaced (~5-line hunk, sequenced behind E4-C's ibr.ts commit); falsifier: a no-op CLI click still printing `✓ … succeeded` → FAIL. |
| E3-D | 6 | T-11: element inside an iframe is observable + clickable; JS dialog (alert/confirm) is captured and answerable instead of hanging (driver.ts:1073 reports iframes as gaps today — verified). |
| E4-D | 2, 9 | Docs show one example each for API/MCP/CLI; release notes name MCP compat + the E3-E success-semantics change; `.codex-plugin/skills/**` and `AGENTS.md` updated to the changed `native_session_*`/`session_action` behavior (falsifier: either surface still documents pre-increment semantics → FAIL). |
| V1 | 4, 5, 10 | T-05 live-drive demo transcript; T-04 timing table; T-10: `npm test`, `npm run typecheck`, `npm run build`, `git diff --check` all green. Native criteria evidence = running app, never compile-green. **Release gate:** no version bump and no GitHub Release before T-05 passes — publish-npm.yml fires on GitHub Release, and E4-D otherwise yields a release-ready repo advertising `keystroke`/`app`/`menuPath` enums while Epic 2 is mid-thread returning structured `not-implemented` (falsifier: any tag/Release in git history preceding the T-05 evidence artifact → FAIL). |

## Feedback-loop contract (criterion 9 — applies to E3 verbs + E4/E2 controller actions)

Frozen in C0 as `src/action-outcome.ts`:

```ts
ActionOutcome = {
  success: boolean                       // true ONLY if validator passed
  validator: { expected: string; observed: string; passed: boolean }
  provenance: { tier; confidence; resolvedPath?; waitFor?; waitResult? }  // extend, never strip
  evidence?: {                           // REQUIRED on failure — spine-ready
    beforeSignature; afterSignature; diff
    alternatives: RankedCandidate[]      // ≤10, ranked
    screenshotB64?: string
  }
}
```

**Adoption timing (resolves the C0/E2-B apparent contradiction):** at C0 the `ActionOutcome` type is INTERNAL-ONLY — the controller returns it, but the native MCP wire stays byte-identical in Wave 0 (T-01 + T-01g pin the wire). The native wire first gains `validator`/`evidence` at **E2-B** (additive — signature-table row); the web wire gains them at **E3-E**. No chunk exposes the type on a wire earlier than its row in the signature table.

Loop shape per action: declared input (target+intent) → deterministic execute → validator (expected-outcome check, not "call didn't throw") → on fail, structured evidence. Native already emits most provenance (verified at tools.ts:2382–2396) — C0 carries it into the controller unchanged; the deficit is the WEB side (E3-A/E3-E close it).

## Path A vs Path B

### 1. Controller boundary (ADR-01) — **Path B chosen**

| | Path A — minimal extract | Path B — typed contract + backend seam |
|---|---|---|
| Shape | Move today's 4 handler bodies into session-controller.ts, current shapes only | Frozen v1 contract: full action surface (incl. keystroke/app/menu types), generic dispatch to `NativeBackend`; web side + Increment-2 spine can implement the same contract later |
| Wave-0 cost | Smaller | +~1 day of type design |
| Epic 2 consequence | Epic 2 must edit controller + MCP handlers to add capabilities → co-ownership or full serialization behind Epic 4 | Epic 2 never touches frozen files; parallel-safe |
| Spine readiness | Re-freeze needed in Increment 2 | The spine consumes this contract as-is |

**Default Path B.** Named future capability justifying B: the **Increment-2 capture→replay→escalate spine** replays typed action scripts against ANY surface — it needs exactly one uniform `ActionOutcome` + session contract, and re-freezing after Epic 2 has fanned out would repeat this increment's hardest coordination problem. Clean-sheet lens: B is what you'd design from scratch. Current-constraints lens: A is tempting because tools.ts logic is entangled with MCP response formatting. Bridge: B's controller returns typed results; thin adapters own MCP formatting — extraction stays behavior-preserving because T-01/T-01g pin the wire shapes. **Gate that forces A:** if C0 discovers the handlers can't be separated from response formatting behavior-preservingly within Wave-0 budget (T-01 keeps failing), fall back to A, keep the file split AND the sessions registry, and serialize Epic 2 behind an added seam chunk — record the failure evidence in the ledger.

### 2. Daemon (ADR-02) — **Path B chosen**

| | Path A — respawn with cache | Path B — long-lived daemon |
|---|---|---|
| Shape | Keep exec-per-call (actions.ts:96, verified); cache resolved paths keyed by tree signature | Swift daemon (`--daemon`, JSON-lines over stdio), in-process AX tree + resolved-path cache, signature-based invalidation |
| Criterion 4 | Partially met — spawn cost (~100+ms/call) and full tree re-walk per settle-poll remain (tools.ts:2569 re-extracts every poll iteration, verified) | Fully met: ≤ daemon-startup + N reads |
| Risk | Low | Daemon lifecycle: orphans, TCC permission, crash recovery |
| Spine readiness | Replay latency dominated by respawn | Replay at interactive speed |

**Default Path B.** Named future capability: the Increment-2 spine replays multi-step scripts where per-step respawn+re-walk is the dominant latency (a 5-step flow today = ≥10 full walks — verified: extract at 2359 + poll-loop extract at 2569 per action). Prior evidence: headless Swift daemon viable (memory: `reference_headless_swift_daemon_viable`). [ASSUMED: TCC accessibility grant applies to the daemon since it is the same binary path as the one-shot extractor — this is shaky for an unsigned, per-project-copied binary, and extract.ts:27–53 REPLACES the binary content at that path on staleness ("same path ≠ same content"); the E2-A spike probes both cases live before anything depends on it]. **Gate that forces A:** if the E2-A spike (first ~day) shows unstable daemon lifetime (orphan processes — including the daemon-outlives-Node-parent scenario, per-launch permission prompts incl. post-rebuild re-prompts, AX staleness across app switches), ship Path A — the resolved-path cache + signature invalidation is designed to work under both backends, so criterion 4's cache half survives the fallback; the timing pass-condition is then renegotiated with evidence. Rollback for both paths: `RespawnBackend` remains fully functional behind the selection switch; env flag `IBR_NATIVE_BACKEND=respawn` restores today's behavior.

### ADR-03 — tools.ts physical split at Wave 0

Alternatives: (a) leave tools.ts shared and coordinate regions — rejected: Epic 3 and Epic 4 would concurrently edit one 2700-line file (merge-conflict certainty, MECE violation); (b) split at Wave 1 — rejected: Wave-1 fan-out needs the boundary already in place. Decision: C0 moves native tool defs + handlers verbatim to `native-tools.ts` (Epic 4's file) and the shared session registry to `sessions.ts`; `tools.ts` (Epic 3's file) keeps web + sim_action + one aggregation import. Rollback: pure file move, reversible by inverse move; tool list/wire behavior byte-identical (T-01 + T-01g golden-shape suite pin it).

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| C0 extraction subtly changes MCP wire shapes | Medium | T-01 unweakened + T-01g golden-shape snapshot suite written BEFORE refactor and owned by C0 (coverage list in C0 acceptance); plan-critic verifies test order |
| C0 removal-boundary error re-deletes web code | Low (was Medium) | Boundary re-verified by code read: native block 2058–2727; 2000–2057 stays (web session_read tail, session_close, sim_action/design_system dispatch) |
| Daemon lifecycle instability (orphans/TCC) | Medium | E2-A spike first (orphan-outlives-parent, post-rebuild TCC probe, app-switch staleness); gated fallback to Path A; kill-9 auto-fallback test; `[CLEANUP]`-style env flag documented, not leaked |
| Swift one-shot flag regression invisible to npm test | Medium | TS tests mock the binary (macos.test.ts:10, actions.test.ts:13) — E2-A live flag-matrix check (extract, action, --resolve-app, --analyze-layout) is the falsifier |
| E4-B extended enums drift from C0 frozen types | Low | Single source: enums asserted equal to controller types in a named unit test (E4-B acceptance falsifier); scope-auditor checks the equality |
| E3-A auto-wait changes timing of existing green tests | Medium | Timing falsifier: suite wall time ≤ baseline +20%, zero per-test timeout increases; actionability defaults tuned against existing engine suite; verified path forbids fixed sleeps but allows bounded polls |
| E3-E success-semantics change breaks agent assumptions (`success:true` lies today) | Certain-by-design | Release notes (E4-D) + validator/evidence fields additive; this is the criterion-9 point, not a regression |
| Release-ready repo ships before Epic 2 converges | Medium | V1 release gate: no version bump / GitHub Release before T-05 passes (publish-npm.yml fires on GitHub Release) |
| Two chunks discover a shared file mid-flight | Medium | Hard rule: stop-and-report, orchestrator serializes; never cross-edit. ibr.ts pre-declared as single-writer-sequenced (E4-C → E3-E) |
| Criterion-5 demo app availability (real non-sim app) | Low | Use TextEdit/Finder (always present); demo transcript is the evidence |

## Spec Object (JSON)

```json
{
  "needs": [
    {"id": "U-01", "p": "P0", "text": "Drive any running macOS app efficiently — no per-action respawn, keyboard/lifecycle/menu reach", "features": ["F-04", "F-05"]},
    {"id": "U-02", "p": "P0", "text": "Flake-free web driving — verbs verify before acting, network waits are real, live bugs fixed", "features": ["F-06", "F-07", "F-08"]},
    {"id": "U-03", "p": "P0", "text": "Typed, replayable native substrate — same lifecycle via API/MCP/CLI, frozen before fan-out", "features": ["F-01", "F-02", "F-03"]}
  ],
  "features": [
    {"id": "F-01", "p": "P0", "crit": 1, "text": "Behavior-preserving controller extraction (incl. sessions registry + golden-shape suite)", "chunks": ["C0", "E4-B"], "tests": ["T-01", "T-01g", "T-02"]},
    {"id": "F-02", "p": "P0", "crit": 2, "text": "CLI parity + JSON replay + exit codes", "chunks": ["E4-C"], "tests": ["T-03"]},
    {"id": "F-03", "p": "P0", "crit": 3, "text": "Interface frozen before native fan-out", "chunks": ["C0"], "tests": ["T-01"], "evidence": "git history: C0 commit precedes all Epic-2 commits"},
    {"id": "F-04", "p": "P0", "crit": 4, "text": "No per-action respawn; resolved-path cache w/ signature invalidation", "chunks": ["E2-A"], "tests": ["T-04", "T-12"]},
    {"id": "F-05", "p": "P0", "crit": 5, "text": "Keyboard synthesis + app lifecycle + menu traversal on real macOS app", "chunks": ["E2-B", "E2-C", "E2-D"], "tests": ["T-05"]},
    {"id": "F-06", "p": "P0", "crit": 6, "text": "Per-action auto-wait + actionability in verbs", "chunks": ["E3-A"], "tests": ["T-06"]},
    {"id": "F-07", "p": "P0", "crit": 7, "text": "Real CDP network awareness", "chunks": ["E3-B"], "tests": ["T-07"]},
    {"id": "F-08", "p": "P0", "crit": 8, "text": "Two live bugs fixed with mutation proof", "chunks": ["E3-C1", "E3-C2"], "tests": ["T-08a", "T-08b"]},
    {"id": "F-09", "p": "P0", "crit": 9, "text": "ActionOutcome feedback-loop contract everywhere (MCP + CLI success semantics)", "chunks": ["C0", "E3-E", "E2-B"], "tests": ["T-09"]},
    {"id": "F-10", "p": "P0", "crit": 10, "text": "Gates green + release gate", "chunks": ["V1"], "tests": ["T-10"]},
    {"id": "F-11", "p": "P1", "crit": 6, "text": "Frames + dialog handling", "chunks": ["E3-D"], "tests": ["T-11"]}
  ],
  "tests": [
    {"id": "T-01", "kind": "regression", "text": "Existing native-session MCP tests pass unweakened after extraction (import-path/relocation edits only) — incl. session-tools.test.ts + f4-chrome-warning.test.ts pinners"},
    {"id": "T-01g", "kind": "golden-shape", "text": "Snapshot suite written pre-refactor: native_session_start app/pid/simulator shapes + errors, 4 native_session_read modes, nativeTargetNotFound/errorResponse shapes, web session_action/read/close on native sessions"},
    {"id": "T-02", "kind": "unit", "text": "Controller: successful action, missing target, wait timeout, screenshot read mode, per-kind target optionality"},
    {"id": "T-03", "kind": "cli", "text": "native:session:* --json shapes + non-zero exits on failed action/missing session/failed wait/invalid target; cross-process session reuse"},
    {"id": "T-04", "kind": "running-app", "text": "5-step macOS flow: extractor spawn count ≤1 with daemon vs ≥10 baseline; before/after wall time"},
    {"id": "T-05", "kind": "running-app", "text": "Live demo transcript: chord + Tab/Escape, launch/switch/quit, menu open+walk+select on real non-sim app"},
    {"id": "T-06", "kind": "integration", "text": "Verbs wait for present+visible+enabled+stable on delayed/hidden/disabled/moving fixtures; no fixed sleeps on verified path; wall time ≤ baseline +20%, zero per-test timeout increases; stale-elementId re-resolution unit test"},
    {"id": "T-07", "kind": "integration", "text": "networkidle/waitForResponse track real Network events on fetch-driven fixture; fail if events disabled"},
    {"id": "T-08a", "kind": "mutation-first", "text": "FAILING FIRST: pressKey('Meta+k') types literal text today; then chord dispatch + live flow_search fallback"},
    {"id": "T-08b", "kind": "mutation-first", "text": "FAILING FIRST: flow_form/flow_login relaunch despite sessionId today; then session reuse, no relaunch, no borrowed-session close"},
    {"id": "T-09", "kind": "integration", "text": "No-op click returns success:false + before/after diff + ranked alternatives + screenshot (MCP); CLI ibr interact result keyed to ActionOutcome.success"},
    {"id": "T-10", "kind": "gates", "text": "npm test, typecheck, build, git diff --check; no tag/GitHub Release before T-05 evidence exists"},
    {"id": "T-11", "kind": "integration", "text": "iframe element observe+click; JS dialog captured and answerable"},
    {"id": "T-12", "kind": "unit+running-app", "text": "Resolved-path cache invalidates on nativeStateSignature change; stale-path action never fires"}
  ],
  "adrs": [
    {"id": "A-01", "text": "Controller boundary Path B: typed contract + NativeBackend seam + full v1 action surface + sessions registry", "reversibility": "low", "rollback": "gated fallback to minimal extract + serialized Epic 2 (file split + registry retained)"},
    {"id": "A-02", "text": "Daemon Path B: long-lived Swift AX daemon", "reversibility": "medium", "rollback": "RespawnBackend behind selection switch; IBR_NATIVE_BACKEND=respawn"},
    {"id": "A-03", "text": "tools.ts physical native/web split at Wave 0", "reversibility": "high", "rollback": "inverse file move; wire shapes pinned by T-01/T-01g"}
  ]
}
```

## Caller Audit (Scope Auditor)

`scope_auditor_status: audited`. Four caller-surface gaps found at the Plan→Execute boundary; all four are resolved in-plan:

1. **Sessions-registry seam (Gap 2 / F1)** — the shared `sessions` Map (tools.ts:92) + `__test_setSession` (:102) had no owner after the split, and the six web→native delegation call sites crossed the new boundary unfrozen. Resolved: C0 owns `src/mcp/sessions.ts`; the six delegation signatures (or their controller replacements) are frozen; import direction is one-way (tools.ts → native side, never reverse); `sim_action` (def :1116, handler :3828) stays web-owned in tools.ts. Signature-table rows added.
2. **Cross-boundary test pinners unowned** — `src/engine/session-tools.test.ts` and `src/mcp/f4-chrome-warning.test.ts` import `handleToolCall`/`TOOLS` and pin behavior C0 moves. Resolved: both added to C0's owned files (import-path/relocation only, assertions unweakened) with an explicit Wave-1 split (native describes → E4-B's native-tools.test.ts; web describes → E3 tools.ts thread).
3. **E4-B enum drift had no named falsifier + `target` requiredness undecided** — resolved: E4-B acceptance carries the enum↔frozen-type equality test as a named falsifier; C0 freezes `target` as per-kind optional; the pinned required-array assertion (session-tools.test.ts:197) is updated at E4-B explicitly, never silently.
4. **E4-D documentation surface incomplete** — `.codex-plugin/skills/**` and `AGENTS.md` document `native_session_*`/`session_action` behavior that E4-B/E3-E change. Resolved: both added to E4-D's owned files with a staleness falsifier.

## Open Questions

None. Three labelled assumptions ([ASSUMED] in ADR-02 and chunk specs) replace what would otherwise be questions; each has a default, a verify-first step in its owning chunk (the TCC assumption now has a concrete three-part spike checklist in E2-A, including the post-rebuild same-path/changed-content probe), and a gated fallback — none is blocking-and-novel (`blocking-test` would be T-04 for the TCC assumption, but the E2-A spike resolves it before any downstream chunk depends on it).

## Out of Scope (mirror)

Increment-2 spine; Playwright; remote API; IDB workflows; extractor rewrite beyond daemon needs; Digital Crown/multi-touch/drag-drop; web implementation of the controller interface; `src/native/scan.ts` respawn path; `mobile-ui/sim-driver` edits. **No UI I/O contract required — no UI surface in this increment.**

## Verification chain after this plan

`plan_verify.py` (deterministic) → `plan-critic` (blocking — high-stakes gating tripped: synthesisDensity > 5 across three epics) → `scope-auditor` at Plan→Execute (modifies_api: true; check the E4-B enum ↔ C0 type equality, the six frozen delegation signatures, and every row of the signature-change table). Prior scope-auditor pass: see `## Caller Audit (Scope Auditor)` — 4 gaps resolved-in-plan.
