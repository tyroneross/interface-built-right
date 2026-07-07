<!-- Plugin: ibr · Version: 1.4.0 · Source of truth: local (~/dev/git-folder/interface-built-right) -->
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
| `interact` | Click, type, fill elements by accessible name (e.g. `interact` → action: click, target: "Submit"). `success` reflects a real expected-outcome validator — check `validator.passed`, don't assume `success` is always `true` on a no-op |
| `extract` | Read page headings, buttons, inputs, links after interactions |
| `interact_and_verify` | Act + capture before/after element diff (elements added/removed) |
| `scan` | Full page analysis — CSS, handlers, a11y, console errors |
| `ask` | Ask a focused question, get a verdict + evidence (touch-target, signal-noise, token-compliance). Token-minimal alternative to scan |
| `snapshot` | Capture visual baseline |
| `compare` | Compare current vs baseline |
| `screenshot` | Capture screenshot of any URL |
| `native_session_action` | Cursor-free macOS/simulator session action by accessible name — click/fill/focus/etc., plus `keystroke` (live chord synthesis), `app` (live lifecycle launch/switch/quit; `quit` can fail with `osascript -128` on unsaved docs under `NSCloseAlwaysConfirmsChanges=1` — no force-quit fallback), `menuPath` (live AXMenu traversal). Same lifecycle also available as `ibr native:session:{start,read,action,close}` CLI — see `skills/native-testing` |

## Native App Driving (macOS/iOS) — use the CLI, not MCP

**Standard (2026-07-07): drive running native apps with the CLI `ibr native:session:{start,read,action,close}` via Bash, not the `native_session_*` MCP tools.** MCP, CLI, and the library API share one core (`NativeSessionController → performAction → ibr-ax-extract`); the MCP native tools are explicit "CLI parity" — no capability the CLI lacks.

Why CLI wins for native (and only native): native sessions are **driverless** — session state is just `{pid, app}` on disk (`src/native/session-store.ts`, file-backed cross-process by design), so every call re-reads the pid and re-queries the AX tree. There is no live connection to hold open, which is the only thing an MCP server's persistent process buys. The MCP server also runs the **installed** plugin, so a dev-repo fix is invisible until reinstall; the CLI can point at this repo's fresh `dist/`. (Web sessions are the opposite — they hold a live CDP driver, so MCP has real value there.)

Recipe (JSON + Bash; persist reads to files — command substitution truncates at ~64KB):

```bash
BIN=dist/bin/ibr.js
node $BIN native:session:start --pid <PID> --session-id s1 --json
node $BIN native:session:read s1 --what observe --json > /tmp/obs.json   # or extract | screenshot
node $BIN native:session:action s1 --action select --target "<name>" --json
node $BIN native:session:action s1 --action drag --target "<name>" --value "-200,0" --json  # opt-in, see below
node $BIN native:session:close s1 --json
```

- `select` selects SwiftUI List/table/outline rows: dispatches `AXSelected` and climbs the child-index path to the enclosing `AXRow` (name-targeting lands on the leaf `AXStaticText`). A plain `press` is a no-op on such rows.
- `drag` is the one non-cursor-free verb (CGEvent) for split/inspector dividers with no settable `AXValue`. Refused unless `IBR_ALLOW_POINTER_INJECTION=1`; it moves the host cursor and needs the app frontmost (self-activates). Target elements by name; a nameless divider is reachable by path via the `ibr-ax-extract` binary directly.
- `success:true` is not proof of actuation — verify the observable effect (re-read state/frame) after any state-changing action.

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

## Mobile / device emulation (1.1.0)

CDP-direct device emulation. Pre-1.1.0 `--viewport mobile` parsed cleanly but rendered desktop; 1.1.0 fixes the preset and adds `--device`.

```bash
npx ibr scan <url> --viewport mobile          # 390 x 844, DPR 3, mobile UA, touch on
npx ibr scan <url> --device iphone-14         # same, explicit
npx ibr session:start <url> --device pixel-7  # session emulating Android Chrome
```

Precedence: `--device` wins over `--viewport`. Canonical devices: `iphone-14`, `iphone-14-pro-max`, `pixel-7`, `ipad-air`, `ipad-pro-11`, `desktop-1440`. Add more in `src/devices.ts`.

Library entry: `import { resolveDevice, deviceToViewport } from '@tyroneross/interface-built-right'`.

## Scan Output Reference

**Per element:** `selector`, `tagName`, `text`, `bounds {x,y,w,h}`, `computedStyles` (backgroundColor, fontSize, fontFamily, display, gap, grid*, flex*, padding, margin, borderRadius), `interactive` (hasOnClick, hasHref, hasReactHandler, isDisabled), `a11y` (role, ariaLabel, ariaDescribedBy)

**Page-level:** `pageIntent` (auth|form|listing|detail|dashboard|error|landing), `state.auth`, `state.loading`, `state.errors`, `console` (errors[], warnings[]), `verdict` (PASS|ISSUES|FAIL)

**Sensors (`scan.sensors.*`, v1.2.0):** `visualPatterns`, `componentCensus`, `interactionMap`, `contrast`, `navigation`, `typography` (family+size+weight+lineHeight rows aggregated by fingerprint), `breakpoints` (declared `@media` + `@container` queries), `motion` (transitions, keyframes, reduced-motion overrides), `hierarchy` (h1..h6 + landmarks + a11y findings), `interactionStates` (:hover/:focus/:focus-visible/:active/:disabled rules + missing-focus findings).

**Native macOS layout-fill (v1.4.0):** `scanMacOS` returns `layoutFill: LayoutFillFinding[]` and pushes each as a `layout-fill:` WARNING into `issues[]` (category `structure`). Each finding names the container, the axis (`horizontal` / `vertical`), the largest empty band as both pixels and % of the container extent, and the band's position (`leading` / `between` / `trailing`). Threshold defaults to 0.12 of container extent; configure via `MacOSScanOptions.layoutFill = { threshold, minContainerPx }` or disable with `layoutFill: false`. Catches the centered-narrow-content bug class that passes screenshot + a11y + touch-target checks. Same algorithm available via Swift extractor's `--analyze-layout` flag and via the `assets/native/swift-templates/LayoutProbe.swift` drop-in (in-process, AX-independent).

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
