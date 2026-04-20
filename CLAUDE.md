<!-- Plugin: ibr · Version: 1.0.0 · Source of truth: local (~/Desktop/git-folder/interface-built-right) -->
<!-- Before any commit, version bump, or major change, read ./VERSIONING.md. Update it on version bumps. -->

# IBR — End-to-End Design Tool

IBR reads live UI and returns structured data — computed CSS, bounds, handler wiring, accessibility, page structure. Scan output is ground truth for what is actually rendered. Use this data to inform implementation decisions during the build and confirm results after. Screenshots complement scans for visual coherence, rendering bugs, and canvas/SVG content.

IBR runs on a custom CDP engine — direct Chrome DevTools Protocol over WebSocket. No Playwright dependency. Elements are found by semantic accessibility tree queries (name + role), not fragile CSS selectors.

**Setup:** Add `.ibr/` to `.gitignore`

## When to Use

- **While building UI** — scan to see what is actually rendered and adjust in real time
- **After building UI** — scan to confirm implementation matches user intent
- **Tracking changes** — capture a reference point with `start`, then `check` after changes
- **Skip for** — backend-only changes, config, docs, type-only changes

## MCP Tools (preferred for Claude Code)

| Tool | Use For |
|------|---------|
| `observe` | See all clickable/fillable elements before interacting |
| `interact` | Click, type, fill elements by accessible name (e.g. `interact` → action: click, target: "Submit") |
| `extract` | Read page headings, buttons, inputs, links after interactions |
| `interact_and_verify` | Act + capture before/after element diff (elements added/removed) |
| `scan` | Full page analysis — CSS, handlers, a11y, console errors |
| `snapshot` | Capture visual baseline |
| `compare` | Compare current vs baseline |
| `screenshot` | Capture screenshot of any URL |

## Core Workflow

```bash
npx ibr scan <url> --json                    # read live UI data
npx ibr start <url> --name "feature-name"    # reference point before changes
npx ibr check                                # compare after changes

# Interaction (by accessible name, not CSS selectors)
npx ibr observe <url>                        # see interactive elements
npx ibr interact <url> --action click --target "Submit"
npx ibr interact <url> --action type --target "Search" --value "query"
npx ibr extract <url>                        # verify page state
```

Verdicts: `MATCH`, `EXPECTED_CHANGE`, `UNEXPECTED_CHANGE`, `LAYOUT_BROKEN`

## Scan Output Reference

**Per element:** `selector`, `tagName`, `text`, `bounds {x,y,w,h}`, `computedStyles` (backgroundColor, fontSize, fontFamily, display, gap, grid*, flex*, padding, margin, borderRadius), `interactive` (hasOnClick, hasHref, hasReactHandler, isDisabled), `a11y` (role, ariaLabel, ariaDescribedBy)

**Page-level:** `pageIntent` (auth|form|listing|detail|dashboard|error|landing), `state.auth`, `state.loading`, `state.errors`, `console` (errors[], warnings[]), `verdict` (PASS|ISSUES|FAIL)

## IBR vs Screenshot

| Task | Tool |
|------|------|
| Exact CSS values, handler wiring, a11y audit, console errors | `ibr scan` |
| Visual coherence, rendering bugs, canvas/SVG | Screenshot |
| Track visual changes | `ibr start` + `ibr check` |

Use scan first for property verification, add screenshot when visual confirmation needed.

## Design System (v0.8.0)

IBR now enforces design principles and tokens. When `.ibr/design-system.json` exists, scans check Calm Precision rules and token compliance automatically.

| Tool | Use For |
|------|---------|
| `design_system` (action: init) | Initialize `.ibr/design-system.json` from template |
| `design_system` (action: status) | View active design system config |
| `design_system` (action: validate) | Report active principles and severities |

**Scan output with design system:**
- `designSystem.principleViolations` — Calm Precision rule failures (Gestalt, signal-to-noise, Fitts, Hick, content-chrome, cognitive load)
- `designSystem.tokenViolations` — Off-system values (wrong font size, non-token color, off-scale spacing)
- `designSystem.complianceScore` — 0-100 token compliance percentage

**Core principles** (error): gestalt, signal-noise, content-chrome, cognitive-load
**Stylistic principles** (warn): fitts, hick

Skills: `design-guidance` (pre-build patterns + config management, merged), `component-patterns` (pattern library), `scan-while-building` (auto-activates during UI edits)

## Slash Commands vs MCP Tools

Commands are reserved for multi-step workflows, orchestration, and explicit user intent. Single-function capture/interact operations go through MCP tools directly.

### Slash Commands (24)

`/ibr:scan` `/ibr:interact` `/ibr:match` `/ibr:test` `/ibr:generate-test` `/ibr:record-change` `/ibr:verify-changes` `/ibr:compare-browsers` `/ibr:full-interface-scan` `/ibr:build-baseline` `/ibr:ui` `/ibr:ui-audit` `/ibr:native-scan` `/ibr:iterate` `/ibr:cancel-iterate` `/ibr:replicate` `/ibr:run-script` `/ibr:setup-hooks` `/ibr:prefer-ibr` `/ibr:only-use-ibr` `/ibr:update` `/ibr:build` `/ibr:capture` `/ibr:ui-guidance`

### Retired → use MCP tool

| Was | Now |
|-----|-----|
| `/ibr:snapshot` | `snapshot` MCP tool (or `npx ibr start`) |
| `/ibr:compare` | `compare` MCP tool (or `npx ibr check`) |
| `/ibr:screenshot` | `screenshot` MCP tool |
| `/ibr:test-form` | `flow_form` MCP tool |
| `/ibr:test-login` | `flow_login` MCP tool |
| `/ibr:test-search` | `flow_search` MCP tool |
| `/ibr:design-system` | merged into `design-guidance` skill |
| `/ibr:component-patterns` | now a skill only (no command) |

Use the relevant skill for details on any retained command.

## Skills (v1.1.0 — 18 skills)

### Design flow
| Skill | Purpose |
|-------|---------|
| `design-guidance` | Pre-build pattern selection + design-system configuration (merged) |
| `scan-while-building` | Real-time scan-driven feedback during implementation (renamed from design-implementation) |
| `design-validation` | Post-build audit: accessibility, interactivity, regressions |
| `design-reference` | Capture external/local references for visual guidance |
| `component-patterns` | Opinionated patterns (card, nav, form, dashboard, modal, table, list) |

### Build flow
| Skill | Purpose |
|-------|---------|
| `ui-brainstorm-preamble` | Pre-build UI brainstorming — explore directions before implementing |
| `ui-guidance-library` | Reusable UI guidance patterns and decision aids |
| `mockup-gallery-bridge` | Bridge between mockup gallery reviews and IBR scan verification |
| `iterative-refinement` | Scan → fix → re-scan loop with convergence detection |
| `auto-verify` | Automatic pre/post-edit scans via hooks |

### Testing
| Skill | Purpose |
|-------|---------|
| `interactive-testing` | Web interaction flows (click, type, fill by accessible name) |
| `native-testing` | iOS/watchOS/macOS app scanning |
| `cli-reference` | Full IBR CLI command reference |

### Platform-specific
| Skill | Purpose |
|-------|---------|
| `mobile-web-ui` | Mobile web UI — responsive, touch targets, viewport |
| `ios-design` | iOS HIG rules — SwiftUI conventions, safe areas, haptics |
| `ios-design-router` | Archetype classifier — 6 iOS app archetypes |
| `apple-platform` | Architecture, SwiftData, concurrency, CI/CD, TestFlight |
| `macos-ui` | macOS-specific — AppKit/SwiftUI, menu bar, window chrome |

## iOS Design References

`references/ios-design/` contains 6 domain reference files with comprehensive option catalogs. These are loaded by `ios-design-router` during the Implement phase of `/ibr:build`. Also see `references/apple-platform/` for architecture and deployment patterns.

---
