# IBR — Design Implementation Partner

IBR reads live UI and returns structured data — computed CSS, bounds, handler wiring, accessibility, page structure. Scan output is ground truth for what is actually rendered. Use this data to inform implementation decisions during the build and confirm results after. Screenshots complement scans for visual coherence, rendering bugs, and canvas/SVG content.

IBR runs on a custom CDP engine — direct Chrome DevTools Protocol over WebSocket. No Playwright dependency. Elements are found by semantic accessibility tree queries (name + role), not fragile CSS selectors.

**Setup:** Add `.ibr/` to `.gitignore`

## When to Use

- **While building UI** — scan to see what is actually rendered and adjust in real time
- **After building UI** — scan to confirm implementation matches user intent
- **Tracking changes** — capture a reference point with `start`, then `check` after changes
- **Skip for** — backend-only changes, config, docs, type-only changes

## Core Workflow

```bash
npx ibr scan <url> --json                    # read live UI data
npx ibr start <url> --name "feature-name"    # reference point before changes
npx ibr check                                # compare after changes
npx ibr memory add "<spec>" --property X --value Y  # store persistent design spec
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
