# AGENTS.md — Interface Built Right (IBR)

Universal AI agent guidance for Claude Code, Codex, Cursor, Copilot, Gemini CLI, and any other coding agent working in this repository.

> **Just need the commands?** Read [`docs/AGENTS-QUICKSTART.md`](docs/AGENTS-QUICKSTART.md) —
> exact invocations, the real response shape, and the field names that are easy to
> guess wrong. This page is orientation; that page is what to type.

---

## What IBR Is

IBR is an end-to-end design tool for AI coding agents, with first-class Claude Code and Codex packaging. It guides UI builds with Design Director planning, archetype-based design routing, Calm Precision rules, and platform-specific best practices, then validates implementations with visual scanning and interaction testing.

- **Package:** `@tyroneross/interface-built-right` v1.5.0 (unreleased)
- **Runtime:** Node.js >= 22, TypeScript
- **Dual distribution:** npm package + Claude Code plugin (`.claude-plugin/plugin.json`) + Codex plugin (`.codex-plugin/plugin.json`)
- **License:** Apache-2.0

---

## Architecture

### Browser Engine

IBR uses a custom CDP engine — direct Chrome DevTools Protocol over WebSocket. There is no Playwright dependency. The engine is implemented across:

- `src/engine/cdp/` — Chrome DevTools Protocol modules: `connection.ts`, `browser.ts`, `page.ts`, `dom.ts`, `css.ts`, `input.ts`, `accessibility.ts`, `runtime.ts`, `network.ts`, `console.ts`, `snapshot.ts`, `target.ts`, `emulation.ts`, `wait.ts`
- `src/engine/safari/` — Safari/WebDriver protocol driver
- `src/engine/driver.ts` — unified `EngineDriver` (Chrome + Safari)
- `src/engine/compat.ts` — `CompatPage` abstraction layer

### Element Resolution

Elements are found by semantic accessibility tree queries (name + role), not CSS selectors. Core resolution logic lives in:

- `src/engine/resolve.ts` — name + role matching
- `src/engine/observe.ts` — interactive element enumeration
- `src/engine/extract.ts` — structured page data extraction
- `src/semantic/` — semantic layer: `landmarks.ts`, `page-intent.ts`, `state-detector.ts`, `output.ts`

### Native Platform Support

- `src/native/` — iOS/watchOS simulator scanning via `simctl` and IDB, macOS app scanning via Accessibility API
  - `src/native/scan.ts` — native scan entry point
  - `src/native/macos.ts` — macOS accessibility scanning
  - `src/native/simulator.ts` — iOS/watchOS simulator integration
  - `src/native/idb.ts` — IDB CLI integration (tap, type, swipe)
  - `src/native/actions.ts` — element resolution + coordinate mapping
  - `src/native/bridge.ts` — correlates runtime AX elements to Swift source
  - `src/native/swift/` — Swift helper

### MCP Server

- `src/mcp/server.ts` — JSON-RPC 2.0 over stdio
- `src/mcp/tools.ts` — all tool definitions and handlers

### Scan Output Structure

Per-element fields: `selector`, `tagName`, `text`, `bounds {x,y,w,h}`, `computedStyles` (backgroundColor, fontSize, fontFamily, display, gap, grid*, flex*, padding, margin, borderRadius), `interactive` (hasOnClick, hasHref, hasReactHandler, isDisabled), `a11y` (role, ariaLabel, ariaDescribedBy, ariaCurrent), and optional page-level `breadcrumb` facts on detected trails

Page-level fields: `pageIntent` (auth|form|listing|detail|dashboard|error|landing), `state.auth`, `state.loading`, `state.errors`, `console.errors[]`, `console.warnings[]`, `verdict` (PASS|ISSUES|FAIL)

Sensors (`scan.sensors.*`, v1.2.0):

| Field | Description |
|---|---|
| `visualPatterns` | Detected layout/visual patterns across the page |
| `componentCensus` | Component counts, top components, orphan interactive elements |
| `interactionMap` | Interactive element coverage — total vs. handler-wired |
| `contrast` | WCAG AA pass/fail counts for text elements |
| `navigation` | Nav regions, link counts, depth |
| `typography` | Aggregated font fingerprints (family, size, weight, lineHeight) |
| `breakpoints` | Declared `@media` and `@container` queries |
| `motion` | Transitions, keyframes, reduced-motion overrides |
| `hierarchy` | h1–h6 counts, landmark structure, a11y findings, level-skips |
| `interactionStates` | :hover/:focus/:focus-visible/:active/:disabled rules; missing-focus findings |

### Verdicts

`MATCH` | `EXPECTED_CHANGE` | `UNEXPECTED_CHANGE` | `LAYOUT_BROKEN`

---

## Plugin Structure

| Path | Purpose |
|---|---|
| `.claude-plugin/plugin.json` | Claude Code plugin manifest metadata |
| `.codex-plugin/plugin.json` | Codex plugin manifest metadata, compact Codex skills path, and Codex MCP path |
| `.mcp.json` | Claude-shaped MCP server configuration |
| `.codex-plugin/mcp.json` | Codex-shaped MCP server configuration |
| `skills/` | 25 detailed skill definitions (markdown guidance loaded by Claude Code and source workflows) |
| `.codex-plugin/skills/` | 5 compact Codex routing skills for lower token activation cost |
| `commands/` | 32 slash command definitions |
| `scripts/artifact_lint.py` | Stdlib-only artifact rule contract (39 rules). Host-neutral: any agent, hook, or CI runs it |
| `scripts/artifact_build.py` | Stdlib-only artifact profile converter — `new` / `wrap` / `unwrap` / `info` |
| `scripts/artifact_lint_corpus.py` | Measures rule firing rates across a corpus; the gate on promoting any heuristic to `error` |
| `scripts/dashboard_lint.py` | Stdlib-only dashboard rule contract (8 graded `DB…` rules) — `check` / `rules` / `corpus` |
| `scripts/dashboard_build.py` | Stdlib-only dashboard scaffold — `new` / `build`; `--check` grades and never exits 0 ungraded |
| `scripts/dashboard_record.py` | Append-only event record backing a dashboard's captured actions (DB301–DB306) |
| `hooks/hooks.json` | Hook configuration |
| `hooks/ibr-pre-change.sh` | PreToolUse handler |
| `hooks/ibr-post-change.sh` | PostToolUse handler |
| `hooks/ibr-loop-hook.sh` | Stop handler |
| `agents/visual-iterator.md` | Design validator agent definition |
| `references/` | iOS/macOS/web design reference files (domain option catalogs) |

### Skills (25)

| Directory | Purpose |
|---|---|
| `skills/design-director/` | Primary design-agent planner — design intent, specialist passes, target roles, validation criteria |
| `skills/artifact-design/` | Single-file self-contained HTML pages — treatment calibration, three-state theme contract, page naming, profile choice |
| `skills/artifact-diagramming/` | Inline-SVG diagrams inside artifacts — what earns a picture, and the mechanics that stay legible in both themes |
| `skills/web-design-router/` | Web archetype classifier — dashboards, research tools, workbenches, AI chat, checkout, content, admin |
| `skills/data-visualization/` | Chart-worthiness, chart routing, metrics, data storytelling, source attribution |
| `skills/design-guidance/` | Pre-build design direction, Calm Precision rules, token and pattern selection |
| `skills/component-patterns/` | Reusable component blueprints for cards, nav, forms, dashboards, modals, tables, lists |
| `skills/design-system/` | Design token extraction, validation, and design system compliance |
| `skills/design-implementation/` | Building UI from user descriptions |
| `skills/design-validation/` | Verifying implementation matches intent |
| `skills/design-reference/` | Capturing and comparing design references |
| `skills/iterative-refinement/` | Scan → fix → re-scan iteration loops |
| `skills/cli-reference/` | CLI command reference |
| `skills/interactive-testing/` | Click/fill/observe interaction flows |
| `skills/native-testing/` | iOS/watchOS/macOS native app scanning |
| `skills/auto-verify/` | Automatic post-change verification |
| `skills/ui-brainstorm-preamble/` | Pre-build UI brainstorming — explore directions before implementing |
| `skills/ui-guidance-library/` | Reusable UI guidance patterns and decision aids |
| `skills/mockup-gallery-bridge/` | Bridge between mockup gallery reviews and IBR scan verification |
| `skills/mobile-web-ui/` | Mobile web UI patterns — responsive design, touch targets, viewport handling |
| `skills/ios-design/` | iOS HIG rules — what to build: SwiftUI conventions, safe areas, haptics |
| `skills/ios-design-router/` | Archetype classifier — routes to defaults for 6 iOS app archetypes |
| `skills/apple-platform/` | How to build: architecture patterns, SwiftData, concurrency, CI/CD, TestFlight |
| `skills/macos-ui/` | macOS-specific UI patterns — AppKit/SwiftUI, menu bar, window chrome |
| `skills/obsidian-plugin-ui/` | Obsidian plugin UI patterns — view containers, theme variables, settings tabs |

### Hooks (3)

| Event | Matcher | Script | Timeout |
|---|---|---|---|
| `PreToolUse` | `Write\|Edit` | `ibr-pre-change.sh` | 5000ms |
| `PostToolUse` | `Write\|Edit` | `ibr-post-change.sh` | 30000ms |
| `Stop` | (all) | `ibr-loop-hook.sh` | — |

### Agent Approach

Claude Code has one bundled Claude-style subagent:

`agents/visual-iterator.md` — `design-validator`: scans live page, compares against user intent, fixes mismatches, re-scans. Max 5 iterations. Invoked for "check my UI", "verify the design", post-component builds.

Codex uses compact `.codex-plugin/skills/` routing guidance plus MCP/session tools. The larger `skills/` library remains the detailed Claude/source guidance surface. Do not assume Claude-style agent frontmatter is loaded by Codex; use Codex-native subagents only as the host orchestration layer, with IBR skills and MCP tools as the shared contract.

### MCP Tools

`scan` | `snapshot` | `compare` | `list_sessions` | `screenshot` | `references` | `native_scan` | `native_snapshot` | `native_compare` | `scan_macos` | `native_devices` | `native_session_start` | `native_session_read` | `native_session_action` | `native_session_close` | `validate_tokens` | `scan_static` | `scan_obsidian` | `bridge_to_source` | `interact` | `observe` | `extract` | `interact_and_verify` | `flow_search` | `flow_form` | `flow_login` | `plan_test` | `session_start` | `session_action` | `session_read` | `session_close` | `design_system` | `sim_action`

### Slash Commands (32)

`/ibr:ibr` `/ibr:artifact` `/ibr:snapshot` `/ibr:compare` `/ibr:interact` `/ibr:match` `/ibr:test` `/ibr:generate-test` `/ibr:record-change` `/ibr:verify-changes` `/ibr:compare-browsers` `/ibr:test-search` `/ibr:test-form` `/ibr:test-login` `/ibr:full-interface-scan` `/ibr:build-baseline` `/ibr:ui` `/ibr:ui-audit` `/ibr:scan` `/ibr:screenshot` `/ibr:native-scan` `/ibr:iterate` `/ibr:cancel-iterate` `/ibr:replicate` `/ibr:run-script` `/ibr:setup-hooks` `/ibr:prefer-ibr` `/ibr:only-use-ibr` `/ibr:update` `/ibr:build` `/ibr:capture` `/ibr:ui-guidance`

### Storage

All runtime data is written to `.ibr/` in the consuming project. Add `.ibr/` to `.gitignore`.

### Artifact Lane (host-neutral)

Single-file self-contained HTML pages — openable from `file://`, publishable through Claude's Artifact tool, checkable by any agent. Unlike the rest of IBR this lane needs no browser, no MCP server, and no Node: two stdlib-only Python 3 scripts, no network, no install.

```bash
python3 scripts/artifact_lint.py  rules --json                  # the contract (39 rules)
python3 scripts/artifact_lint.py  check page.html --json        # verdict
python3 scripts/artifact_build.py new --title T -o page.html    # correct scaffold
python3 scripts/artifact_build.py wrap frag.html -o page.html   # fragment → document
python3 scripts/artifact_build.py unwrap page.html -o frag.html # document → fragment
```

Exit codes: `0` clean · `1` findings at or above `--fail-on` (default `error`) · `2` usage error.

`artifact_lint.py rules --json` is the **single source of truth** for rule IDs, severities, and profile scope. Skills cite IDs; they never restate rules. If you change a rule, change it in `RULES` — the prose does not need editing and must not be allowed to drift into a second copy.

Only mechanically unambiguous rules carry `error`. Every heuristic rule is flagged `heuristic: true` and ships `warn`/`info` so it can never hard-block. `scripts/test_artifact_lint.py` enforces both invariants (`test_heuristic_rules_never_error`, `test_every_rule_is_reachable`).

**No heuristic is promoted to `error` without a corpus measurement.** The tool is `scripts/artifact_lint_corpus.py`; the standing record is `docs/research/2026-08-13-artifact-lint-calibration.md` (476 hand-authored pages). Re-run it after any rule change:

```bash
python3 scripts/artifact_lint_corpus.py ~/dev/git-folder --glob '*/mockups/*.html' --samples AD202,AD106
```

Firing rate is a proxy for *where to look*, never a substitute for reading instances. The first calibration cut 2311 findings to 1659 — all of it false positives — by catching four defects rates alone would not have explained: `AD202` matching `Product — Variant` names as captions, `AS506`/`AS508` grading bar charts as diagrams (contradicting `data-visualization`), `AD102` emitting ~18 duplicate rows per file, and the `AD401` cream test matching pink.

Surfaces: `skills/artifact-design/`, `skills/artifact-diagramming/`, `commands/artifact.md` (Claude); `.codex-plugin/skills/artifact/` (Codex); the CLIs directly (everything else).

**Automatic checking is opt-in per project.** `hooks/ibr-post-change.sh` runs the linter on `.html` writes only when `.ibrrc.json` sets `artifactLint` (boolean, or an object with `enabled`/`minSeverity`/`profile`/`disable`). It stays silent otherwise, because this hook fires on `Write|Edit` in every project that installs IBR and most `.html` files are templates or SSR output, not artifacts — `AX004` and `AD105` are correct about an artifact and meaningless about a Jinja template. The arm is advisory: it never blocks a write, and a clean page prints nothing. `scripts/test_artifact_hook.py` executes the hook in both directions (silent without config, firing with it) rather than reading it and concluding it is gated.

### Dashboard Lane (host-neutral)

A dashboard surfaces current state so someone can act. Same stdlib-only, no-browser, no-install shape as the artifact lane, with its own `DB…` rule contract.

```bash
python3 scripts/dashboard_lint.py  rules --json                              # the contract (8 graded rules)
python3 scripts/dashboard_lint.py  check dashboard.html --json               # verdict
python3 scripts/dashboard_lint.py  corpus mockups --glob '**/*.html'         # firing rates
python3 scripts/dashboard_build.py new --archetype queue --title T -o s.json # correct scaffold
python3 scripts/dashboard_build.py build s.json -o dashboard.html --check    # render + grade
```

Exit codes match the artifact lane, with one addition: **`2` also means a grade that was asked for and did not run.** `--check` with no `-o`, no linter beside the script, or a linter that raised prints `NOT GRADED` and exits 2. A `--check` that cannot grade must never exit 0, because that reports a pass the page never earned. Without `--check`, `build` still prints `NOT GRADED — --check was not passed` and names the grading command, so a clean exit never doubles as a clean bill of health.

Eight rules are graded because eight are decidable from the file: `DB402` `DB403` `DB401a` `DB401b` `DB501` `DB502` `DB503` `DB507`. The judgement rules are deliberately absent — DB101 (one archetype), DB102-DB104, DB201-DB203, DB504, DB505, DB506 need a reader or a browser, and a linter that pretends to grade them is worse than one that admits it cannot. DB507 is one-directional: it fires on a fixed width that forces a scrollbar and cannot certify that a flex layout fits.

`DB502` delegates to `artifact_lint.check_contrast` rather than reimplementing it — one contrast implementation, not two sets of bugs.

**No rule fails a build without a corpus measurement.** The tool is `dashboard_lint.py corpus`; the standing record is `docs/research/2026-08-18-dashboard-lint-calibration.md` (16 hand-authored pages). That pass caught DB503 matching `.tab-icon { height: 16px }` and calling a decorative glyph an undersized tab. Rules that reason from a vocabulary (`DB402`, `DB401a`, `DB501`) are flagged `heuristic: true`, ship `warn`, and can never hard-block — `DB402` fires on 100% of the repo's existing dashboards, and at `error` the first thing anyone would do is disable it.

`scripts/test_dashboard_lint.py` proves each rule by mutation: one clean dashboard, one edit that breaks exactly one rule, and an assertion that the rule fires **and nothing else does**. A checker whose tests only exercise the passing path certifies the hole it was written to close.

---

## Development Commands

```bash
npm install          # install dependencies
npm run build        # compile TypeScript via tsup → dist/
npm test             # run test suite via vitest
npm run typecheck    # tsc --noEmit
npm run mcp          # run MCP server (node dist/mcp/server.js)
```

---

## Change Guidance

### CDP Engine — `src/engine/cdp/`

The core browser communication layer. Each file maps to a CDP domain. Changes here affect all web scanning, interaction, and screenshot functionality. Scan-facing skills depend on scan output structure — any field renames or removals in `src/scan.ts` must be reflected in skill docs and in downstream consumers (`src/compare.ts`, `src/report.ts`).

### Scan Logic — `src/scan.ts`

Central scan pipeline. Output structure is consumed by scan-facing skills, the `compare` tool, `design-validator` agent, and test generation. Validate output shape changes against `src/scan.test.ts` and confirm skill docs still match.

### Interaction — `src/engine/observe.ts`, `src/engine/resolve.ts`

Element resolution by accessible name. Changes affect `interact`, `observe`, `interact_and_verify`, `session_action`, `native_session_action`, and `sim_action`. The resolution strategy is tiered — exact name match, partial match, role fallback — document any tier changes.

### Native Scanning — `src/native/`

iOS/watchOS/macOS specific code. Simulator scanning requires a booted device and `simctl` in PATH. IDB (`idb-companion` + `fb-idb`) is required for `type` and `swipe` actions but optional — tap falls back to `simctl`. macOS scanning uses the Accessibility API and requires accessibility permissions.

**Native session controller (API/MCP/CLI split):** `native_session_start/read/action/close` are thin MCP adapters (`src/mcp/native-tools.ts`) over a typed `NativeSessionController` (`src/native/session-controller.ts`, exported from the package root). The same controller backs `ibr native:session:{start,read,action,close}` (`src/bin/native-session-cli.ts`), so API, MCP, and CLI behave identically — see `docs/native-session-cli-reference.md` for one example per surface. `native_session_action`'s action enum is additive: existing element verbs (`click`/`fill`/`type`/`focus`/`showMenu`/`increment`/`decrement`/`confirm`/`cancel`/`scroll`/`scrollToVisible`/`check`/`select`) are unchanged, and it gains `keystroke` (live — real chord synthesis, both backends), `app` (live — lifecycle launch/switch/quit via OS-level process control), and `menuPath` (live — AXMenu traversal). All three are fully implemented; no backend returns `not-implemented` for them anymore. Known limitation on `app`'s `quit` op: if the target machine has `NSCloseAlwaysConfirmsChanges=1` and the app has an unsaved document, `osascript` can fail with exit `-128`, surfaced as `success: false` with an evidence trail — there is intentionally no force-quit fallback, so it will not discard unsaved work. Every `keystroke`/`app`/`menuPath` response carries `{ success, validator: { expected, observed, passed }, provenance, evidence? }`; `success` is `true` only when the validator passed, not merely because the call didn't throw.

**Web success-semantics change (`interact`/`session_action`):** these two MCP tools (and CLI `ibr interact`) now return `success` reflecting the same real expected-outcome validator instead of an unconditional `true`. A no-op action (target resolved, nothing changed) returns `success: false` with `validator`/`evidence`. Any integration that assumed `success` was always `true` needs to check `validator.passed` explicitly. See `CHANGELOG.md` for the full before/after and the release gate this increment is under (`keystroke`/`app`/`menuPath` are all live now; the gate is the increment's pending V1 verification pass, not dormant capabilities → no GitHub Release yet).

### Skills — `skills/*.md`

Each skill has different auto-trigger patterns defined in the skill frontmatter. When updating scan output fields or adding tools, update the relevant skill docs. Skills are loaded by supported agent runtimes as markdown guidance, not compiled code — keep them concise.

### Hook Matchers — `hooks/hooks.json`

`PreToolUse` and `PostToolUse` match on `Write|Edit`. Extending to other tools (e.g., `Bash`) requires updating both the matcher regex and the shell scripts to handle the new tool's environment variables.

### Safari Support — `src/engine/safari/`

WebDriver-based Safari driver. Requires `safaridriver --enable` once per machine. Session management is handled via `session_start` with `browser: "safari"`.

---

## Key Constraints

- No Playwright. The entire browser communication stack is custom CDP over WebSocket.
- Element targeting is always by accessible name + role, never by CSS selector. This is intentional — CSS selectors break; accessibility names reflect what users see.
- The MCP server communicates over stdio (JSON-RPC 2.0). Do not change the transport.
- Node.js >= 22 is required. The codebase uses modern ES module syntax throughout.
- Skills are markdown files loaded by supported plugin runtimes. They are not compiled.
