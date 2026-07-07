---
name: native-testing
description: Use when working on iOS, watchOS, or macOS apps — .swift files, SwiftUI views, simulators. IBR's native scan workflow for touch targets, a11y labels, watchOS constraints, Fix Guide.
---

# IBR Native Testing (iOS / watchOS / macOS)

IBR scans native Apple UI via the accessibility tree — iOS/watchOS through simulator AX API, macOS through the system AX API on running apps. Use this skill when working on `.swift` files or when the user asks to test a native app.

## When to Use

- User is editing `.swift` files (SwiftUI, UIKit, AppKit)
- User asks to scan a running iOS/watchOS simulator
- User asks to audit a macOS app (Terminal, Safari, their own app, etc.)
- Checking touch target sizes, accessibility labels, watchOS screen constraints
- Generating actionable fix instructions with source file mapping

## MCP Tools

| Tool | Purpose |
|------|---------|
| `native_scan` | Extract a11y elements, check touch targets (44pt), watchOS constraints |
| `native_snapshot` | Capture reference point from running simulator |
| `native_compare` | Compare simulator state against reference point |
| `native_devices` | List available simulators with boot status |
| `scan_macos` | Scan a running macOS app via accessibility tree |
| `native_session_start` | Start a cursor-free native session for a macOS app or simulator |
| `native_session_read` | Observe/extract native AX elements from an active native session |
| `native_session_action` | Press, fill, focus, show menus, and scroll via AX without moving the user's cursor; also `keystroke` (live), `app`/`menuPath` (dormant — see below) |
| `native_session_close` | Close the native session record without quitting the app |

## CLI Reference

```bash
# Simulator discovery
npx ibr native:devices                            # list all simulators
npx ibr native:devices --platform ios             # iOS only
npx ibr native:devices --platform watchos         # watchOS only

# Scan running simulator
npx ibr native:scan                               # auto-detect booted device
npx ibr native:scan "iPhone 16 Pro"               # specific device by name
npx ibr native:scan "Apple Watch"                 # watchOS device

# Baseline + compare
npx ibr native:start --name "home-screen"         # capture reference point
npx ibr native:check                              # compare current vs reference

# macOS apps (no simulator needed)
npx ibr scan:macos --app "Terminal"               # scan by app name
npx ibr scan:macos --app "MyApp"                  # scan your own app
```

## Cursor-Free Native Sessions

Use `native_session_*` MCP tools when the agent needs to navigate a running macOS app without taking over the user's mouse cursor. The same lifecycle is also available as a typed `NativeSessionController` API and as `ibr native:session:*` CLI commands — one controller drives all three surfaces. See `docs/native-session-cli-reference.md` for one example per surface and the full CLI flag/exit-code reference.

1. `native_session_start` with `app: "MyApp"`, `pid: 12345`, or `simulator: "iPhone 16 Pro"`
2. `native_session_read` with `what: "observe"` to list actionable AX elements, or `what: "screenshot"` when pixel evidence is needed
3. `native_session_action` with accessible `target` and action:
   - Element verbs (`target` required): `click`, `fill`, `type`, `focus`, `showMenu`, `increment`, `decrement`, `confirm`, `cancel`, `scroll`, `scrollToVisible`, `check`, `select`
   - `keystroke` (`target` optional — chord goes to the focused element if omitted): send a chord via `chord`, e.g. `"Meta+n"`, `"Tab"`, `"Escape"`. **Live** — both the default respawn backend and the opt-in daemon backend deliver the chord and validate the result against an AX state diff.
   - `app` (`target` optional): app lifecycle op via `op: "launch"|"switch"|"quit"` and `app`. **Dormant** — every backend currently returns a structured not-implemented outcome until the app-lifecycle capability lands.
   - `menuPath` (`target` optional): AXMenu traversal via `menuPath: ["File", "New Window"]`. **Dormant** — same as above, pending the menu-traversal capability.
   - For navigation or async UI, pass `waitFor: "<expected next label or identifier>"` and optionally `waitTimeoutMs` so the tool polls AX state until the next screen appears.
   - If `waitFor` is omitted, the tool still performs a short post-action settle poll and returns `postAction` evidence.
4. `native_session_close` when done

These actions use Accessibility APIs (`AXPress`, `AXSetValue`, focus/menu actions, and — for `keystroke` — `CGEventPostToPid` chord synthesis) rather than pointer movement. They require macOS Accessibility permission for the terminal/IDE running IBR. Custom canvas controls or simulator guest controls that do not expose AX actions may still require the simulator HID/IDB path.

Use direct `pid` targeting when a sandboxed agent can learn the process ID from a desktop host but cannot enumerate processes with `pgrep` or `NSWorkspace`.

Responses for `keystroke`/`app`/`menuPath` carry the structured
`{ success, validator: { expected, observed, passed }, provenance, evidence? }`
outcome shape — check `validator.passed`, not just that the call didn't throw,
before assuming the action worked. Element-verb responses (`click`/`fill`/…)
keep their existing shape (`success`, `resolved`, `confidence`, `tier`,
`alternatives`, `postAction`).

### CLI parity

```bash
npx ibr native:session:start --app "TextEdit" --json
npx ibr native:session:action <sessionId> --action keystroke --chord "Meta+n" --json
npx ibr native:session:read <sessionId> --what observe --json
npx ibr native:session:close <sessionId> --json
```

Exit codes: `0` ok, `1` action failed, `2` session not found, `3` `--wait-for` timed out, `4` invalid target. Session state persists to `.ibr/native-sessions/<sessionId>.json` between commands (each invocation is a separate process). Full reference: `docs/native-session-cli-reference.md`.

## Automated Native Checks

IBR runs these checks on every native scan automatically:

- **44pt touch targets** — any interactive element smaller than 44×44pt is flagged (Apple HIG minimum)
- **A11y labels** — buttons, images, and interactive elements without labels are flagged
- **watchOS screen limits** — max 7 interactive elements per screen (Apple HIG)
- **watchOS horizontal overflow** — detects content wider than the watch screen

## Fix Guide (v0.5.0+)

`ibr native:scan --fix-guide` generates actionable fix instructions that Claude Code can act on directly:

```bash
ibr native:scan --fix-guide              # formatted text output
ibr native:scan --fix-guide --json       # structured JSON for programmatic use
```

**What it produces:**

- **SoM-annotated screenshot** — numbered red labels on each problematic element
- **Per-issue fix instructions** — what's wrong, where (screen region + pixel bounds), which source file, and suggested SwiftUI code fix
- **Source mapping** — uses NavGator bridge to correlate AX elements to Swift source files with confidence scores

**Output location:** `.ibr/native/fix-guide.json`

**Example output:**

```
① [error] Touch target too small (bottom-left)
   Element: [role="AXButton"][label=""] — 16×16pt (need ≥44×44pt)
   Source:  Shared/Views/ContentView.swift:142 (0.8 confidence)
   Search:  Button { Image(systemName: "play.fill") }
   Fix:     Add .frame(minWidth: 44, minHeight: 44)
```

**For best source mapping:** Run NavGator first (`navgator scan`) to populate `.navgator/architecture/file_map.json`. IBR reads this file for higher-confidence correlations between AX tree elements and Swift source lines.

## Workflow

1. **Boot the simulator** — `xcrun simctl list | grep Booted` to verify, or boot via Xcode
2. **Scan** — `npx ibr native:scan` to see current state and any violations
3. **Capture baseline** — `npx ibr native:start --name "feature-x"` before making changes
4. **Make changes** — edit `.swift` files, rebuild, reload simulator
5. **Check** — `npx ibr native:check` to compare and see what moved or regressed
6. **Fix guide** — if issues found, `npx ibr native:scan --fix-guide` to get actionable instructions with source mapping

## When NOT to Use

- Web UI (use `scan` / `snapshot` / `compare` instead — see design-validation skill)
- Backend-only Swift code (server APIs, not UI)
- Xcode project configuration or build system issues
