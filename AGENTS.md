# AGENTS.md — Interface Built Right (IBR)

Universal AI agent guidance for Claude Code, Codex, Cursor, Copilot, Gemini CLI, and any other coding agent working in this repository.

---

## What IBR Is

IBR is an end-to-end design tool for AI coding agents, with first-class Claude Code and Codex packaging. It guides UI builds with Design Director planning, archetype-based design routing, Calm Precision rules, and platform-specific best practices, then validates implementations with visual scanning and interaction testing.

- **Package:** `@tyroneross/interface-built-right` v1.4.0
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

Per-element fields: `selector`, `tagName`, `text`, `bounds {x,y,w,h}`, `computedStyles` (backgroundColor, fontSize, fontFamily, display, gap, grid*, flex*, padding, margin, borderRadius), `interactive` (hasOnClick, hasHref, hasReactHandler, isDisabled), `a11y` (role, ariaLabel, ariaDescribedBy)

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
| `skills/` | 22 detailed skill definitions (markdown guidance loaded by Claude Code and source workflows) |
| `.codex-plugin/skills/` | Compact Codex routing skills for lower token activation cost |
| `commands/` | 27 slash command definitions |
| `hooks/hooks.json` | Hook configuration |
| `hooks/ibr-pre-change.sh` | PreToolUse handler |
| `hooks/ibr-post-change.sh` | PostToolUse handler |
| `hooks/ibr-loop-hook.sh` | Stop handler |
| `agents/visual-iterator.md` | Design validator agent definition |
| `references/` | iOS/macOS/web design reference files (domain option catalogs) |

### Skills (22)

| Directory | Purpose |
|---|---|
| `skills/design-director/` | Primary design-agent planner — design intent, specialist passes, target roles, validation criteria |
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

`scan` | `snapshot` | `compare` | `list_sessions` | `screenshot` | `references` | `native_scan` | `native_snapshot` | `native_compare` | `scan_macos` | `native_devices` | `native_session_start` | `native_session_read` | `native_session_action` | `native_session_close` | `validate_tokens` | `scan_static` | `bridge_to_source` | `interact` | `observe` | `extract` | `interact_and_verify` | `flow_search` | `flow_form` | `flow_login` | `plan_test` | `session_start` | `session_action` | `session_read` | `session_close` | `design_system` | `sim_action`

### Slash Commands (30)

`/ibr:snapshot` `/ibr:compare` `/ibr:interact` `/ibr:match` `/ibr:test` `/ibr:generate-test` `/ibr:record-change` `/ibr:verify-changes` `/ibr:compare-browsers` `/ibr:test-search` `/ibr:test-form` `/ibr:test-login` `/ibr:full-interface-scan` `/ibr:build-baseline` `/ibr:ui` `/ibr:ui-audit` `/ibr:scan` `/ibr:screenshot` `/ibr:native-scan` `/ibr:iterate` `/ibr:cancel-iterate` `/ibr:replicate` `/ibr:run-script` `/ibr:setup-hooks` `/ibr:prefer-ibr` `/ibr:only-use-ibr` `/ibr:update` `/ibr:build` `/ibr:capture` `/ibr:ui-guidance`

### Storage

All runtime data is written to `.ibr/` in the consuming project. Add `.ibr/` to `.gitignore`.

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

**Native session controller (API/MCP/CLI split):** `native_session_start/read/action/close` are thin MCP adapters (`src/mcp/native-tools.ts`) over a typed `NativeSessionController` (`src/native/session-controller.ts`, exported from the package root). The same controller backs `ibr native:session:{start,read,action,close}` (`src/bin/native-session-cli.ts`), so API, MCP, and CLI behave identically — see `docs/native-session-cli-reference.md` for one example per surface. `native_session_action`'s action enum is additive: existing element verbs (`click`/`fill`/`type`/`focus`/`showMenu`/`increment`/`decrement`/`confirm`/`cancel`/`scroll`/`scrollToVisible`/`check`/`select`) are unchanged, and it gains `keystroke` (live — real chord synthesis, both backends), `app` (lifecycle launch/switch/quit), and `menuPath` (AXMenu traversal). `app`/`menuPath` are exposed on the schema and CLI flags but currently return a structured `not-implemented` outcome (`success: false`) until their backend capability lands — do not report them as working. Every `keystroke`/`app`/`menuPath` response carries `{ success, validator: { expected, observed, passed }, provenance, evidence? }`; `success` is `true` only when the validator passed, not merely because the call didn't throw.

**Web success-semantics change (`interact`/`session_action`):** these two MCP tools (and CLI `ibr interact`) now return `success` reflecting the same real expected-outcome validator instead of an unconditional `true`. A no-op action (target resolved, nothing changed) returns `success: false` with `validator`/`evidence`. Any integration that assumed `success` was always `true` needs to check `validator.passed` explicitly. See `CHANGELOG.md` for the full before/after and the release gate this increment is under (`app`/`menuPath` dormant → no version bump/GitHub Release yet).

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
