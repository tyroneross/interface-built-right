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

Skills: `/ibr:design-system` (config management), `/ibr:component-patterns` (pattern library), design-guidance (auto-activates when building UI)

## Slash Commands

`/ibr:snapshot` `/ibr:compare` `/ibr:interact` `/ibr:match` `/ibr:test` `/ibr:generate-test` `/ibr:record-change` `/ibr:verify-changes` `/ibr:compare-browsers` `/ibr:test-search` `/ibr:test-form` `/ibr:test-login` `/ibr:full-interface-scan` `/ibr:build-baseline` `/ibr:ui` `/ibr:ui-audit` `/ibr:design-system` `/ibr:component-patterns` `/ibr:build` `/ibr:capture` `/ibr:ui-guidance`

Use skill for details.

## Skills (v1.0.0)

| Skill | Purpose |
|-------|---------|
| `ui-brainstorm-preamble` | Pre-build UI brainstorming — explore directions before implementing |
| `ui-guidance-library` | Reusable UI guidance patterns and decision aids |
| `mockup-gallery-bridge` | Bridge between mockup gallery reviews and IBR scan verification |
| `mobile-web-ui` | Mobile web UI patterns — responsive design, touch targets, viewport handling |
| `ios-design` | iOS HIG rules — what to build: SwiftUI conventions, safe areas, haptics |
| `ios-design-router` | Archetype classifier — routes to defaults for 6 iOS app archetypes |
| `apple-platform` | How to build: architecture patterns, SwiftData, concurrency, CI/CD, TestFlight |
| `macos-ui` | macOS-specific UI patterns — AppKit/SwiftUI, menu bar, window chrome |

## iOS Design References

`references/ios-design/` contains 6 domain reference files with comprehensive option catalogs. These are loaded by `ios-design-router` during the Implement phase of `/ibr:build`. Also see `references/apple-platform/` for architecture and deployment patterns.

---
