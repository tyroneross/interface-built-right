# IBR — Design Implementation Partner

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

## IBR Engine Capabilities

The CDP engine provides LLM-native features beyond basic scanning:

| Feature | Use When |
|---------|----------|
| `discover({ filter: 'interactive', serialize: true })` | Need compact element list for context window |
| `find('Submit', { role: 'button' })` | Find element by intent, not CSS selector |
| `observe()` | Preview available actions before executing |
| `extract({ field: { role, label, extract } })` | Pull structured data from accessibility tree |
| `assessUnderstanding()` | Decide whether screenshot is needed (adaptive modality) |
| `captureState({ computedStyles, includeAXTree, includeScreenshot })` | One-call full page state |

## IBR vs Screenshot

| Task | Tool |
|------|------|
| Exact CSS values, handler wiring, a11y audit, console errors | `ibr scan` |
| Visual coherence, rendering bugs, canvas/SVG | Screenshot |
| Track visual changes | `ibr start` + `ibr check` |

Use scan first for property verification, add screenshot when visual confirmation needed.

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/ibr:snapshot` | Capture reference point before UI changes |
| `/ibr:compare` | Compare current state against reference point |
| `/ibr:interact` | Click, type, verify — interaction assertions |
| `/ibr:match` | Compare mockup PNG against live page (SSIM) |
| `/ibr:test` | Run declarative .ibr-test.json tests |
| `/ibr:generate-test` | Auto-generate tests from page observation |
| `/ibr:record-change` | Record a design change for later verification |
| `/ibr:verify-changes` | Verify all recorded design changes |
| `/ibr:compare-browsers` | Side-by-side Chrome vs Safari diff |
| `/ibr:test-search` | Test search flow on a page |
| `/ibr:test-form` | Test form submission flow |
| `/ibr:test-login` | Test login flow |
| `/ibr:full-interface-scan` | Scan all pages, inspect every component |
| `/ibr:build-baseline` | Create reference points for all pages |
| `/ibr:ui` | Open web dashboard at localhost:4200 |
| `/ibr:ui-audit` | Full end-to-end workflow audit |

## CLI Reference

```bash
# Core scanning
npx ibr scan <url> --json           # read live UI data
npx ibr start <url> --name "name"   # capture reference point
npx ibr check                       # compare against reference point

# Interaction testing
npx ibr interact <url> --action 'click:button:Submit' --expect 'visible:Success'
npx ibr test-search <url> --query "debug" --expect-count 1
npx ibr test-form <url> --fill '{"name":"Test","email":"a@b.com"}'
npx ibr test-login <url> --email user@test.com --password secret

# Mockup matching
npx ibr match mockup.png <url>                        # full page SSIM comparison
npx ibr match mockup.png <url> --selector '.hero'     # region comparison
npx ibr match mockup.png <url> --mask-dynamic          # auto-mask timestamps

# Design verification
npx ibr record-change <url> --element "header" --description "Blue 48px bold" --checks '[...]'
npx ibr verify-changes <url>                           # verify all recorded changes

# Test generation & execution
npx ibr generate-test <url>                            # auto-generate .ibr-test.json
npx ibr generate-test <url> --scenario "search for X"  # scenario-targeted
npx ibr test                                           # run .ibr-test.json
npx ibr run-script tests/e2e.py                        # execute Python test script

# Fix-and-iterate
npx ibr iterate <url> --test .ibr-test.json            # run one iteration, track convergence

# Cross-browser
npx ibr compare-browsers <url>                         # Chrome vs Safari side-by-side

# Other
npx ibr memory add "<spec>"         # store design spec
npx ibr list                        # list sessions
npx ibr serve                       # open web dashboard
```

**Viewports:** `desktop`, `laptop`, `tablet`, `mobile`, `iphone-14`, `iphone-14-pro-max`
Use: `npx ibr scan <url> --viewport mobile --json`

**Safari:** Add `--browser safari` to commands that support it. Requires one-time `sudo safaridriver --enable`.

## Interactive Sessions

```bash
npx ibr session:start <url> --name "test"           # persistent browser
npx ibr session:click <id> "button[type=submit]"    # interact
npx ibr session:type <id> "input[name=q]" "query"
npx ibr session:wait <id> ".results"
npx ibr session:screenshot <id>                      # capture state
npx ibr session:text <id> ".result-count"            # extract text
npx ibr session:close <id>
```

## Native iOS/watchOS/macOS

Use native tools when working on `.swift` files. Web tools for `.tsx/.jsx/.vue/.svelte/.html/.css`. Skip IBR for backend-only files.

| Tool | Purpose |
|------|---------|
| `native_scan` | Extract a11y elements, check touch targets (44pt), watchOS constraints |
| `native_snapshot` | Capture reference point from running simulator |
| `native_compare` | Compare simulator state against reference point |
| `native_devices` | List available simulators with boot status |
| `scan_macos` | Scan a running macOS app via accessibility tree |

```bash
npx ibr native:devices                                    # list simulators
npx ibr native:scan "Apple Watch"                         # scan by name
npx ibr native:start "iPhone 16 Pro" --name "screen"      # reference point
npx ibr native:check                                      # compare
npx ibr scan:macos --app "Terminal"                        # macOS app
```

**Native checks:** 44pt touch targets (always), a11y labels, watchOS max 7 interactive elements/screen, watchOS no horizontal overflow.

## Fix Guide (v0.5.0+)

`ibr native:scan --fix-guide` generates actionable fix instructions for Claude Code:

```bash
ibr native:scan --fix-guide              # formatted text output
ibr native:scan --fix-guide --json       # structured JSON for programmatic use
```

**What it produces:**
- **SoM-annotated screenshot** — numbered red labels on each problematic element
- **Per-issue fix instructions** — what's wrong, where (screen region + pixel bounds), which source file, and suggested SwiftUI code fix
- **Source mapping** — uses NavGator bridge to correlate AX elements to Swift source files with confidence scores

**Output saved to:** `.ibr/native/fix-guide.json`

**Example output:**
```
① [error] Touch target too small (bottom-left)
   Element: [role="AXButton"][label=""] — 16×16pt (need ≥44×44pt)
   Source:  Shared/Views/ContentView.swift:142 (0.8)
   Search:  Button { Image(systemName: "play.fill") }
   Fix:     Add .frame(minWidth: 44, minHeight: 44)
```

**For best source mapping:** Run NavGator first (`navgator scan`) to populate `.navgator/architecture/file_map.json`. IBR reads this for higher-confidence file correlations.

---

## Development

Visual testing platform for Claude Code. Scans live pages via CDP (Chrome DevTools Protocol), runs interaction assertions, compares mockups against live UI (SSIM), verifies design descriptions, generates tests from page observation, and supports Chrome + Safari.

**Engine:** Custom CDP browser engine (`src/engine/`) with LLM-native features:
- **4-tier element resolution**: cache → queryAXTree → Jaro-Winkler → vision fallback
- **DOM chunking**: filter to interactive elements, chunk for context windows
- **Adaptive modality**: AX tree quality scoring, screenshot when needed
- **observe/extract**: preview actions, pull structured data from AX tree
- **BrowserDriver interface**: Chrome (CDP) and Safari (WebDriver + macOS AX API)

**Node.js 22+** required (built-in WebSocket for CDP).

```bash
npm run dev          # watch mode
npm run build        # tsup build
npm run test         # vitest
npm run typecheck    # tsc --noEmit
npm run ui           # web dashboard at :4200
```

### Testing

```bash
npx vitest run src/engine/engine.test.ts              # 52 unit tests
npx vitest run src/engine/compat.test.ts              # 18 compat tests
npx vitest run src/engine/engine.integration.test.ts  # 28 integration tests (needs Chrome)
```

### Key Directories

```
src/
├── engine/              # Browser engines
│   ├── cdp/             # 14 CDP domain implementations (Chrome)
│   ├── safari/          # SafariDriver (WebDriver + macOS AX API)
│   ├── driver.ts        # EngineDriver — Chrome high-level API
│   ├── types.ts         # BrowserDriver interface (Chrome + Safari)
│   ├── compat.ts        # CompatPage — Playwright-compatible adapter
│   ├── shadow-dom.ts    # Shadow DOM piercing via Runtime.evaluate
│   ├── observe.ts       # Preview available actions
│   ├── extract.ts       # Structured data extraction
│   ├── cache.ts         # Resolution auto-caching
│   └── modality.ts      # Understanding Score (adaptive modality)
├── interaction-test.ts  # act→verify→screenshot assertion pipeline
├── ssim.ts              # SSIM algorithm (pure TypeScript, ~200 LOC)
├── mockup-match.ts      # Mockup-to-reality comparison pipeline
├── design-verifier.ts   # Design description capture + verification
├── test-generator.ts    # Auto-generate .ibr-test.json from page observation
├── test-runner.ts       # Declarative test executor
├── script-runner.ts     # Safe Python script execution (~100 LOC harness)
├── iterate.ts           # Fix-and-iterate loop with convergence detection
├── scan.ts              # Page scanning and analysis (+ AX tree coverage)
├── capture.ts           # Screenshot capture with masking
├── compare.ts           # Visual comparison (pixelmatch)
├── live-session.ts      # Interactive session management
├── semantic/            # Page intent, landmarks, state detection
├── flows/               # Login, search, form automation
├── native/              # iOS/watchOS/macOS native scanning
├── mcp/                 # MCP server and tools
└── bin/                 # CLI entry point
```

### Plugin Layout

```
interface-built-right/
├── .claude-plugin/
│   ├── marketplace.json
│   └── plugin.json
├── .mcp.json
├── commands/            # 28 slash commands
├── agents/              # 1 agent
├── hooks/               # hooks.json + scripts
├── skills/              # 6 skill dirs
├── adapters/
├── universal/
└── src/, dist/, etc.
```

### Debugging Memory

This project uses @tyroneross/claude-code-debugger for debugging memory.

**Commands:**
- `/debugger "symptom"` - Search past bugs for similar issues
- `/debugger` - Show recent bugs, pick one to debug
- `/debugger-status` - Show memory statistics
- `/debugger-scan` - Scan recent sessions for debugging work
