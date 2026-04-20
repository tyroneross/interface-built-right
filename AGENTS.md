# AGENTS.md — Interface Built Right (IBR)

Universal AI agent guidance for Claude Code, Codex, Cursor, Copilot, Gemini CLI, and any other coding agent working in this repository.

---

## What IBR Is

IBR is an end-to-end design tool for Claude Code. It guides UI builds with archetype-based design routing and platform-specific best practices, then validates implementations with visual scanning and interaction testing.

- **Package:** `@tyroneross/interface-built-right` v1.0.0
- **Runtime:** Node.js >= 22, TypeScript
- **Dual distribution:** npm package + Claude Code plugin (`.claude-plugin/plugin.json`)
- **License:** MIT

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

### Verdicts

`MATCH` | `EXPECTED_CHANGE` | `UNEXPECTED_CHANGE` | `LAYOUT_BROKEN`

---

## Plugin Structure

| Path | Purpose |
|---|---|
| `.claude-plugin/plugin.json` | Plugin manifest (name, version, hooks, mcpServers, skills refs) |
| `.mcp.json` | MCP server configuration |
| `skills/` | 8 skill definitions (markdown, auto-triggered by Claude) |
| `commands/` | 27 slash command definitions |
| `hooks/hooks.json` | Hook configuration |
| `hooks/ibr-pre-change.sh` | PreToolUse handler |
| `hooks/ibr-post-change.sh` | PostToolUse handler |
| `hooks/ibr-loop-hook.sh` | Stop handler |
| `agents/visual-iterator.md` | Design validator agent definition |
| `references/` | iOS/macOS design reference files (domain option catalogs) |

### Skills (18)

| Directory | Purpose |
|---|---|
| `skills/scan-while-building/` | Building UI from user descriptions (scan-driven feedback loop) |
| `skills/design-guidance/` | Pre-build design guidance + design-system configuration (merged) |
| `skills/design-validation/` | Verifying implementation matches intent |
| `skills/design-reference/` | Capturing and comparing design references |
| `skills/component-patterns/` | Opinionated component patterns with Calm Precision rules |
| `skills/iterative-refinement/` | Scan → fix → re-scan iteration loops |
| `skills/cli-reference/` | CLI command reference |
| `skills/interactive-testing/` | Click/fill/observe interaction flows |
| `skills/native-testing/` | iOS/watchOS/macOS native app scanning |
| `skills/auto-verify/` | Automatic post-change verification |
| `skills/ui-brainstorm-preamble/` | Pre-build UI brainstorming — explore directions before implementing |
| `skills/ui-guidance-library/` | Reusable UI guidance patterns and decision aids |
| `skills/mockup-gallery-bridge/` | Bridge between mockup gallery and IBR scan verification |
| `skills/mobile-web-ui/` | Mobile web UI patterns |
| `skills/ios-design/` | iOS HIG rules |
| `skills/ios-design-router/` | Archetype classifier for 6 iOS archetypes |
| `skills/apple-platform/` | Architecture/deployment patterns for Apple platforms |
| `skills/macos-ui/` | macOS-specific UI patterns |
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

### Agents (1)

`agents/visual-iterator.md` — `design-validator`: scans live page, compares against user intent, fixes mismatches, re-scans. Max 5 iterations. Invoked for "check my UI", "verify the design", post-component builds.

### MCP Tools

`scan` | `snapshot` | `compare` | `list_sessions` | `screenshot` | `references` | `native_scan` | `native_snapshot` | `native_compare` | `scan_macos` | `native_devices` | `validate_tokens` | `scan_static` | `bridge_to_source` | `interact` | `observe` | `extract` | `interact_and_verify` | `flow_search` | `flow_form` | `flow_login` | `plan_test` | `session_start` | `session_action` | `session_read` | `session_close` | `sim_action`

### Slash Commands (24)

Commands are reserved for multi-step workflows, orchestration, and config. Single-function capture/interact operations use MCP tools directly (see §MCP Tools above).

`/ibr:scan` `/ibr:interact` `/ibr:match` `/ibr:test` `/ibr:generate-test` `/ibr:record-change` `/ibr:verify-changes` `/ibr:compare-browsers` `/ibr:full-interface-scan` `/ibr:build-baseline` `/ibr:ui` `/ibr:ui-audit` `/ibr:native-scan` `/ibr:iterate` `/ibr:cancel-iterate` `/ibr:replicate` `/ibr:run-script` `/ibr:setup-hooks` `/ibr:prefer-ibr` `/ibr:only-use-ibr` `/ibr:update` `/ibr:build` `/ibr:capture` `/ibr:ui-guidance`

Retired (use MCP tool or CLI): `/ibr:snapshot` → `snapshot` MCP tool, `/ibr:compare` → `compare` MCP tool, `/ibr:screenshot` → `screenshot` MCP tool, `/ibr:test-form`/`test-login`/`test-search` → `flow_form`/`flow_login`/`flow_search` MCP tools.

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

The core browser communication layer. Each file maps to a CDP domain. Changes here affect all web scanning, interaction, and screenshot functionality. The 8 skills depend on scan output structure — any field renames or removals in `src/scan.ts` must be reflected in skill docs and in downstream consumers (`src/compare.ts`, `src/report.ts`).

### Scan Logic — `src/scan.ts`

Central scan pipeline. Output structure is consumed by all 8 skills, the `compare` tool, `design-validator` agent, and test generation. Validate output shape changes against `src/scan.test.ts` and confirm skill docs still match.

### Interaction — `src/engine/observe.ts`, `src/engine/resolve.ts`

Element resolution by accessible name. Changes affect `interact`, `observe`, `interact_and_verify`, `session_action`, and `sim_action`. The resolution strategy is tiered — exact name match, partial match, role fallback — document any tier changes.

### Native Scanning — `src/native/`

iOS/watchOS/macOS specific code. Simulator scanning requires a booted device and `simctl` in PATH. IDB (`idb-companion` + `fb-idb`) is required for `type` and `swipe` actions but optional — tap falls back to `simctl`. macOS scanning uses the Accessibility API and requires accessibility permissions.

### Skills — `skills/*.md`

Each skill has different auto-trigger patterns defined in the skill frontmatter. When updating scan output fields or adding tools, update the relevant skill docs. Skills are injected into Claude's context at load time — keep them concise.

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
- Skills are markdown files loaded by the Claude Code plugin runtime. They are not compiled.
