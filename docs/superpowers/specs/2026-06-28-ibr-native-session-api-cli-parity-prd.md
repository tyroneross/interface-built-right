# IBR Native Session API and CLI Parity PRD

**Status:** Draft - backlog-ready
**Owner:** IBR
**Date:** 2026-06-28
**Planning authority:** build-loop
**Related research:** `/Users/tyroneross/dev/research/topics/tools/tools.ibr-cli-api-mcp-decision.md`
**Related implementation note:** `3e9375a fix(native): stabilize AX session navigation`

---

## Product Thesis

IBR should make the native session controller API the canonical implementation boundary, keep MCP as the agent-facing adapter, and add CLI parity for deterministic replay, local debugging, and CI smoke tests.

The recent native AX stabilization improved MCP behavior, but the core session orchestration still lives behind the MCP tool handler. That makes the most reliability-sensitive behavior harder to test directly, harder to replay outside Codex or Claude, and harder to expose as a stable package API.

Planning for this work should run through build-loop. The `docs/superpowers/` location is only the existing repository storage convention for spec and plan artifacts; it is not a decision to use superpowers as the planning workflow.

## Problem

Native UI validation now depends on multi-step session flows:

- start a native session
- observe or extract the accessibility tree
- press or type against an accessible target
- wait for a target state after the action
- capture post-action evidence
- optionally capture a screenshot
- close the session

Today, the complete flow is available through MCP tools, but not as a first-class API or CLI workflow. This creates three product gaps:

1. **Testability gap:** core behavior is difficult to unit test without entering MCP handler code.
2. **Replay gap:** failures seen by an agent cannot be reproduced cleanly from a shell command.
3. **Packaging gap:** downstream Node tools cannot depend on a typed native session controller without reaching into implementation details.

## Users

| User | Need |
|---|---|
| Coding agents using IBR through Claude Code or Codex | Stable MCP tools that remain easy to discover and invoke |
| IBR maintainers | A direct API surface for tests, refactors, and package consumers |
| CI and release workflows | JSON CLI commands with deterministic output and useful exit codes |
| Humans debugging native UI automation | A replayable shell command path for failures reported by agents |

## Goals

- Extract native session orchestration into a typed core API.
- Keep `native_session_start`, `native_session_read`, `native_session_action`, and `native_session_close` behavior compatible for MCP clients.
- Add CLI parity for native session start/read/action/close flows.
- Preserve the post-action reliability gains from commit `3e9375a`: foreground retry, `waitFor`, `waitTimeoutMs`, post-action read evidence, and screenshot read mode.
- Make the same controller usable by API, MCP, and CLI.
- Add tests at the controller, MCP adapter, and CLI JSON boundary.
- Document the surface clearly enough for future Claude, Codex, and CI users.

## Non-goals

- Do not replace MCP. MCP remains the primary agent integration surface.
- Do not change MCP transport. IBR continues JSON-RPC over stdio.
- Do not add Playwright.
- Do not rewrite the macOS AX extractor unless the controller extraction exposes a blocker.
- Do not add a remote hosted API.
- Do not require IDB for macOS workflows.

## Decision

| Surface | Decision | Rationale |
|---|---|---|
| API | Canonical implementation boundary | Best for typed contracts, direct tests, package consumers, and shared behavior |
| MCP | Thin agent adapter | Best for Codex/Claude discovery and conversational tool use |
| CLI | Deterministic replay and CI surface | Best for shell logs, support reproduction, and automation outside an MCP host |

## Functional Requirements

### Core API

- Provide a typed native session controller module, proposed as `src/native/session-controller.ts`.
- Support session start, read, action, and close operations.
- Support app identifiers by bundle ID, app name, or PID where current MCP behavior already supports them.
- Preserve existing native read modes: observe, extract, screenshot.
- Preserve action target resolution by accessibility name, identifier, role, or current native target shape.
- Preserve action types currently exposed through MCP.
- Support `waitFor` and `waitTimeoutMs` on actions.
- Return structured post-action evidence when requested or when a wait target is supplied.
- Expose stable TypeScript types for requests and responses.

### MCP Adapter

- Keep existing MCP tool names and schemas unless a schema extension is required for CLI/API parity.
- Delegate native session behavior to the controller.
- Keep MCP output content-compatible for existing Claude and Codex plugin users.
- Keep stdout clean for JSON-RPC protocol traffic.

### CLI

- Add JSON-first commands for the same lifecycle:
  - `ibr native:session:start`
  - `ibr native:session:read`
  - `ibr native:session:action`
  - `ibr native:session:close`
- Commands must support `--json`.
- Commands must return non-zero exit codes for failed actions, missing sessions, failed waits, or invalid targets.
- Commands must be usable in copy/paste repro scripts from agent logs.
- Commands must avoid interactive prompts.

### Package Exports

- Export the controller API from `src/index.ts` or a documented subpath.
- Keep internal-only helpers internal.
- Document the public API stability level as initial or experimental if the team is not ready for semver guarantees.

### Documentation

- Update CLI reference docs after implementation.
- Update native testing skill docs after implementation.
- Add one example for MCP, one for CLI, and one for API usage.

## Success Metrics

- The same native action flow can run through API, MCP, and CLI with equivalent structured results.
- `native_session_action` remains backward-compatible for current MCP users.
- A CLI repro can perform press-then-wait for a target state without a mouse.
- Controller unit tests cover successful action, missing target, wait timeout, and screenshot read mode.
- CLI tests cover JSON output and exit code behavior.
- `npm test`, `npm run typecheck`, `npm run build`, and `git diff --check` pass.

## Constraints

- Node.js >= 22.
- No Playwright dependency.
- Native macOS validation depends on Accessibility permissions and foreground window availability.
- MCP server remains stdio JSON-RPC.
- Runtime data stays under `.ibr/` in consuming projects.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Controller extraction changes MCP behavior | Existing Claude/Codex workflows regress | Add adapter-level tests before refactor and compare current result shapes |
| CLI session persistence becomes confusing | Multi-command workflows fail outside one process | Prefer explicit session IDs backed by `.ibr/native-sessions/` or document process-scoped limitations |
| Public API freezes too early | Refactor cost increases | Mark API experimental until one release cycle validates usage |
| macOS foreground behavior remains flaky | CLI and MCP both inherit user-environment issues | Keep foreground retry and expose evidence in action results |

## Acceptance Criteria

- A public native session controller exists and is used by MCP native session tools.
- CLI commands provide lifecycle parity for native sessions.
- Existing native session MCP tests pass without weakening assertions.
- New controller and CLI tests pass.
- Docs and skills name the API/MCP/CLI split consistently.
- Release notes mention MCP compatibility and new CLI replay path.

## Backlog Shape

This PRD should be implemented through build-loop as one feature epic with four implementation slices:

1. Extract controller API with behavior-preserving tests.
2. Convert MCP native session handlers to thin adapters.
3. Add CLI lifecycle parity and JSON replay examples.
4. Update docs, skills, and release notes.
