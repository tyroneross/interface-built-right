# IBR — Versioning & Source of Truth

## Current

- **Version:** 1.4.0
- **Source of truth:** Local dev (`~/dev/git-folder/interface-built-right`)
- **Also available at:**
  - GitHub: https://github.com/tyroneross/interface-built-right
  - npm: `@tyroneross/interface-built-right`
- **Claude Code cache mirror:** `~/.claude/plugins/cache/interface-built-right/ibr/1.4.0/`

## Key changes in 1.4.0

### Native macOS layout-fill / gap analysis (2026-06-06)

Catches the bug class that screenshot + a11y + touch-target checks all miss: a
content element rendered narrow and CENTERED inside its container, leaving
large empty gutters. Motivating case: Easy Terminal rendered its terminal
canvas at ~440px wide, centered inside a ~1074px container, with ~317px
gutters on both sides — visible in screenshots, missed by every existing
check because nothing computed the relative band-vs-container percentage.

- **`scanMacOS` now returns `layoutFill: LayoutFillFinding[]`** — per-container
  findings of the largest empty horizontal AND vertical band as pixels + % of
  the container extent, with position (`leading` / `between` / `trailing`).
  Also pushed into the existing `issues[]` as `severity: warning`,
  `category: structure`, prefixed `layout-fill:` so it surfaces alongside
  touch-target warnings.
- **TS analyzer** (`src/native/layout-fill.ts`) — pure function over the
  `MacOSAXElement` tree. AX-independent, unit-testable against fixture trees
  (the AX subsystem can be wedged; the algorithm doesn't depend on it). 15
  vitest cases including the ET regression (440px in 1074px ⇒ 317px = 29.5%
  leading band) and a negative (970px in 1000px → silent).
- **Swift extractor `--analyze-layout` flag** — same algorithm in-Swift, emits
  `LAYOUT_FINDINGS:<json>` on stderr for callers running the binary directly
  without the TS layer. Stdout JSON contract unchanged.
- **Drop-in Swift templates** under `assets/native/swift-templates/`:
  - `LayoutProbe.swift` — in-process layout dump (reads the app's own NSView
    hierarchy) + wedge-proof `cacheDisplay`-based PNG. Same algorithm, same
    threshold. Use when AX is wedged or you want ground-truth frames for
    hosted `NSViewRepresentable` views.
  - `RenderSwiftUI.swift` — render a SwiftUI scene off-screen to PNG via
    `NSHostingView` + offscreen `NSWindow` + `cacheDisplay`. Bypasses
    WindowServer entirely.
- **Threshold + scope are configurable** via `MacOSScanOptions.layoutFill`
  (`threshold` default 0.12; `minContainerPx` default 50). Opt out with
  `layoutFill: false`.

All three implementations (TS analyzer, Swift `--analyze-layout`, LayoutProbe
template) emit the same finding shape so findings from any source are
interchangeable.

Tests: 15 new vitest cases (analyzer fixture). Full repo suite: 758 pass
under fresh load. Typecheck clean. `swift build -c release` clean on macOS 25.

⚠️ What compile + fixtures cannot prove: behavior against a LIVE running app
through the real AX subsystem. AX/AppleEvent/screencapture has been wedged
system-wide on this dev machine since 2026-06-06; the fixtures verify the
algorithm against synthetic trees that match the Swift extractor's JSON
shape exactly. The wiring (scan_macos call site, threshold plumbing,
backwards compatibility) is verified by typecheck + test. End-to-end
verification against a real running macOS app is deferred to the next
session where AX is reachable.

## Key changes in 1.3.0

### Reliability fixes from a 16-day transcript audit (2026-05-29)

Surfaced by mining 640 Claude Code sessions (607 real IBR tool calls, ~5% strict failure rate). Each fix is grounded in a verified failure class.

- **`session_action` auto-resolve (R1)** — tier-4 element resolution now promotes the top fuzzy (jaroWinkler) alternative to a real resolution when `score ≥ 0.8` AND margin-to-#2 `≥ 0.15`, cutting the 11% "element not found" failure class. Surfaces `autoResolved {requested, chosen, role, score, margin}` for auditability. Respects the caller's `role` hint (no longer silently resolves a same-label link when a button was requested).
- **Destructive-label guard** — auto-resolve requires a near-exact match (`score ≥ 0.95`) when the label matches destructive intent (delete/remove/erase/wipe/purge/revoke/deactivate/disable/discard/destroy/reset/clear/unsubscribe/confirm), regardless of candidate count. Prevents a typo from auto-clicking a "Delete" button.
- **`session_read` / `native_session_read` default mode (R2)** — `what` defaults to `observe` (and is dropped from `required`); inputs are case-folded, so `"Observe"` no longer errors.
- **`scan` auth + intent noise (R3)** — accepts `sessionId`/`cookies` to thread an authed session; suppresses the `Intent:` line when `intent === 'unknown' && confidence < 0.3`.
- **Native env preflight (R5)** — `native_session_start` / `sim_action` return one-line fix instructions (xcode-select install, swift build, simctl, AX permission) instead of raw tracebacks.
- **iOS `sim_action` (R4)** — server-side `findSimulatorAppRoot` descends past Simulator chrome plus a client-side chrome-only warning. ⚠️ **Known limitation:** the iOS-simulator element path does not resolve app content on Xcode 26 / iOS 26.x — the macOS AX tree of Simulator.app surfaces only Simulator's own chrome, and `idb ui describe-all` returns an empty tree on iOS 26. Tracked for a dedicated fix; macOS-app (AppKit) native scanning is unaffected and works.

Tests: 697 passing (684 → 697, +13 across R1–R5 + audit corrections + destructive guard). Typecheck steady at 23 pre-existing errors.

## Key changes in 1.2.0

### Five new sensors close URL-capture gaps (2026-05-27)

Surfaced by the 2026-05-27 linear.app smoke test of `Skill("ui-guidance:ingest-url")`. Pre-1.2.0 the URL → 7-section capture pipeline had Typography / Hierarchy / Motion / Breakpoints / Interaction-states sections that read `(not detectable in ibr-scan)` for most fields. The data existed in DOM/cssRules but the sensor layer didn't bubble it up.

- **`typography` sensor** — fingerprints text-bearing elements by family + size + weight + lineHeight, aggregates duplicates into one row with a frequency count. Resolves font-weight keywords (`bold`→700) to numbers. Preserves full font-family fallback chains. Returns `line_height: "normal"` as a sentinel string (no false-precision guesses). Resolves `1.25rem` → `size_px: 20` against `documentMeta.rootFontSizePx`. Flags `font_loading_pending: true` when `document.fonts.status === "loading"`.
- **`breakpoints` sensor** — enumerates declared `@media` and `@container` queries from `document.styleSheets`. Types: `min-width`, `max-width`, `range`, `container-*`, `print`, `other`. Dedupes identical conditions across stylesheets and sums `rule_count`.
- **`motion` sensor** — parses declared `transition` shorthand (multi-property comma-split into separate entries), `@keyframes` (with `step_count` + `used_by_selectors`), and `prefers-reduced-motion: reduce` overrides routed to a separate `reduced_motion_overrides` field. Sensor reads the page's DECLARED motion, independent of IBR's scan-time animation disable.
- **`hierarchy` sensor** — per-level `h1..h6` counts + `first_text` + `all_texts`, ARIA landmarks (`nav`, `main`, `aside`, `header`, `footer`, `section`, `form`). `role="heading"` counted separately under `aria_headings`. Findings: `no_h1_on_page`, `multiple_h1s_on_page`, `level_skips` (h1 → h3).
- **`interaction-states` sensor** — enumerates declared `:hover`, `:focus`, `:focus-visible`, `:active`, `:disabled`, `:focus-within` rules. Flags interactive selectors with `:hover` but no `:focus` indicator (a11y). Marks rules nested inside `@media (hover: hover)` with `conditional_hover: true`.

### Sensor layer plumbing

- **`SensorContext` extended (additive)** with `cssRules?: ExtractedCSSRule[]` (discriminated union: style/media/keyframes/container/supports) and `documentMeta?: DocumentMeta` (rootFontSizePx, fontsStatus, rawSpecValues). Backward compatible — existing sensors don't read them; new sensors degrade gracefully when absent.
- **`src/sensors/css-extract.ts`** — single live-page extractor walks `document.styleSheets` (silently skips cross-origin) and pulls `document.fonts.status`. Runs once per scan, feeds all five new sensors.
- **`SensorReport`** now carries `typography`, `breakpoints`, `motion`, `hierarchy`, `interactionStates`. New one-liners surface in `oneLiners[]`.

### Tests

+33 new vitest cases (8 typography + 6 breakpoints + 6 motion + 6 hierarchy + 6 interaction-states + 1 fixture validation). Baseline 622 still pass; total 655.

## Key changes in 1.1.0

### Mobile / device emulation fix (CDP-direct)

- **`--viewport mobile|tablet|desktop` honored end-to-end via CDP.** Pre-1.1.0 the flag parsed cleanly but Chrome rendered the page at desktop because `EngineDriver.launch` only called `Emulation.setDeviceMetricsOverride` (without UA or touch), and the `mobile` / `tablet` presets were 375x667 / 768x1024 with no `mobile` flag. Surfaced via an atomize-ai UI audit 2026-05-25.
- **Realigned baselines:** `mobile` -> 390x844 iPhone 14 (DPR 3, mobile:true); `tablet` -> 820x1180 iPad Air (DPR 2, mobile:true).
- **New `EmulationDomain.applyDeviceProfile()`** wraps `setUserAgentOverride` -> `setDeviceMetricsOverride` -> `setTouchEmulationEnabled` and is invoked from `EngineDriver.launch()` BEFORE the first navigate so the initial document request sees the mobile UA.
- **New `-d, --device <name>` flag** on `ibr scan` and `ibr session:start`. Canonical set: `iphone-14`, `iphone-14-pro-max`, `pixel-7`, `ipad-air`, `ipad-pro-11`, `desktop-1440`. `--device` wins over `--viewport` when both supplied; unknown names throw with the known list.
- **`src/devices.ts`** module is the single source for canonical UA strings and profile shape. `viewportToConfig()` helper replaces 10 call sites that stripped viewport down to `{width, height}` and dropped the emulation metadata on the floor.
- **Library exports:** `DEVICES`, `DEVICE_NAMES`, `resolveDevice`, `deviceToViewport`, `viewportToConfig`, `MOBILE_SAFARI_UA`, `TABLET_SAFARI_UA`, `ANDROID_CHROME_UA`, `DeviceProfile`, `DeviceName`, `ViewportConfig` from the package root.
- **Tests:** +21 vitest cases (8 emulation CDP-call-recorder, 16 devices module, 1 live-Chrome integration asserting `navigator.userAgent` matches `/iPhone/` and `window.innerWidth === 390` after `applyDeviceProfile`).

## Key changes in 1.0.0

### Positioning & iOS design

- **Repositioned as end-to-end design tool** — from "visual testing platform" to design, build, and validate
- **iOS design system** — archetype-based router (6 app archetypes), 6 domain reference files (navigation, lists, buttons, color, motion, task economy), Task Economy patch (CP 6.4.2)
- **apple-platform skill** — integrated from standalone apple-dev: architecture, SwiftData, concurrency, CI/CD, TestFlight
- **ios-ui renamed to ios-design** — clarifies scope: HIG rules (what to build) vs. apple-platform (how to build)
- **Updated /ibr:build** — archetype classification in preamble, domain-specific reference loading in implement phase
- 3 new skills (ios-design-router, apple-platform, ios-design), 15 new reference files

### Scan engine upgrades

- **`waitForHydration()` in scan pipeline** — fixes "0 elements" on SPAs. Fast-path detects Next.js/React markers + root population, then polls AX tree fingerprint until stable + minElements threshold. Replaces naive `networkidle` wait that fires before hydration completes
- **Automatic pre/post interaction scanning** — `autoCapture` defaults to `true` in live sessions. Post-action captures wait for hydration before scanning
- **Deterministic rule presets (no LLM)** — `wcag-contrast` (AA + AAA ratios via relative luminance) and `touch-targets` (44pt mobile WCAG 2.5.5, 24pt desktop WCAG 2.5.8). Register via `.ibr/rules.json` with `"extends": ["wcag-contrast", "touch-targets"]`
- **Sensor layer (`src/sensors/`)** — structured summaries pre-computed from runtime data, cuts tokens the model spends re-discovering patterns:
  - `visualPatterns` — groups elements by style fingerprint (e.g. "14 buttons match, 2 don't")
  - `componentCensus` — tag/role counts + cursor:pointer orphan detection
  - `interactionMap` — handler coverage, missing-handler list
  - `contrast` — WCAG pass/fail grouped, only failures listed
  - `navigation` — link structure and depth
  - `semanticState` — wraps existing semantic classifier
  - `oneLiners` — 5-second scannable summary the model reads first

## Key changes in 0.8.0

- **Design system extension:** Full front-end design workflow — Calm Precision principle enforcement, configurable design tokens, component patterns
- 6 Calm Precision rules (gestalt, signal-noise, fitts, hick, content-chrome, cognitive-load) with core/stylistic severity split
- Extended token validation (fontWeights, lineHeights, spacing arrays) via validator registry
- `design_system` MCP tool (init/status/validate) + `.ibr/design-system.json` config
- 3 new skills (design-guidance, design-system, component-patterns) + 2 modified (design-implementation, design-validation)
- 7 component pattern templates (card, nav, form, dashboard, modal, table, list)
- Refactored `aggregateIssues()` → IssueCollector, `tokens.ts` → validator registry
- Global memory: `promoteToGlobal()` / `seedFromGlobal()` for cross-project preference flow
- All 421 tests pass (39 new); typecheck clean

See commit `80653a6` for full diff.

## Where to look for the latest version

| Source | Location | Notes |
|---|---|---|
| **Authoritative** | `~/Desktop/git-folder/interface-built-right/.claude-plugin/plugin.json` | Local dev — canonical, always newest |
| GitHub | github.com/tyroneross/interface-built-right | Public mirror, tracks local |
| npm | `@tyroneross/interface-built-right` | Published releases (may lag) |
| Cache mirror | `~/.claude/plugins/cache/interface-built-right/ibr/<version>/` | What Claude Code actually loads at runtime — cross-check against registry |

When "latest" is ambiguous, trust **local dev** first, then cross-check the registry at `~/.claude/plugins/installed_plugins.json`.

## Release discipline (enforce before committing a version bump)

1. Bump `version` in `.claude-plugin/plugin.json`
2. Update the version stamp in `CLAUDE.md` (line 1 HTML comment)
3. Update this file's `Current` section + add an entry to `Version history` below
4. Delete older cache entries: `rm -rf ~/.claude/plugins/cache/interface-built-right/ibr/<old-version>/`
5. Back up, then update `~/.claude/plugins/installed_plugins.json` → `installPath` + `version` for every entry of this plugin
6. Run `/reload-plugins` in Claude Code
7. Commit `plugin.json`, `CLAUDE.md`, `VERSIONING.md` together in a single commit

**Never leave two cached versions side-by-side** — Claude Code's resolver is not guaranteed to pick the newest. This bit us on 2026-04-04 when cached `0.4.9` kept loading despite `0.7.0` being the intended version; the loader picked whichever was alphabetically/mtime-first, not the one the registry recorded.

## Version history

- **1.4.0** (2026-06-06): Native macOS layout-fill / gap analysis. `scanMacOS` reports per-container empty bands ≥ threshold as numeric findings. New TS analyzer (`analyzeLayoutFill`), Swift extractor `--analyze-layout` flag, drop-in `LayoutProbe.swift` + `RenderSwiftUI.swift` templates under `assets/native/swift-templates/`.
- **1.3.0** (2026-05-29): Reliability fixes from 16-day transcript audit (R1–R5).
- **1.1.0** (2026-05-25): CDP-direct mobile/device emulation. `--viewport mobile` now actually emulates mobile (UA + metrics + touch via Emulation domain BEFORE navigate). New `--device` flag with canonical profiles (iphone-14, pixel-7, ipad-air, ...). Mobile and tablet baselines realigned to iPhone 14 / iPad Air.
- **1.0.0** (2026-04-17): Repositioned as end-to-end design tool. iOS archetype router, 6 domain references, apple-platform skill, ios-ui → ios-design rename.
- **0.8.0** (2026-04-07): Design system extension — Calm Precision enforcement, tokens, patterns, global memory. Commit `80653a6`.
- **0.7.0** (2026-04-04): Context optimization, auto-verify hooks, patience mode, new skills. Commit `07e0a82`.
- **0.4.9** (prior): Pre-optimization baseline. Cached directory deleted 2026-04-04 during drift cleanup.
