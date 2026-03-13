# IBR — Design Implementation Partner

IBR reads live UI and returns structured data — computed CSS, bounds, handler wiring, accessibility, page structure. Scan output is ground truth for what is actually rendered. Use this data to inform implementation decisions during the build and confirm results after. Screenshots complement scans for visual coherence, rendering bugs, and canvas/SVG content.

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

## IBR vs Screenshot vs Playwright

| Task | Tool |
|------|------|
| Exact CSS values, handler wiring, a11y audit, console errors | `ibr scan` |
| Visual coherence, rendering bugs, canvas/SVG | Screenshot |
| Multi-step flows, file uploads, dialogs | Playwright |
| Track visual changes | `ibr start` + `ibr check` |

Use scan first for property verification, add screenshot when visual confirmation needed.

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/ibr:snapshot` | Capture reference point before UI changes |
| `/ibr:compare` | Compare current state against reference point |
| `/ibr:full-interface-scan` | Scan all pages, inspect every component |
| `/ibr:build-baseline` | Create reference points for all pages |
| `/ibr:ui` | Open web dashboard at localhost:4200 |
| `/ibr:ui-audit` | Full end-to-end workflow audit |

## CLI Reference

```bash
npx ibr scan <url> --json           # read live UI data
npx ibr start <url> --name "name"   # capture reference point
npx ibr check                       # compare against reference point
npx ibr memory add "<spec>"         # store design spec
npx ibr memory list                 # show stored specs
npx ibr list                        # list sessions
npx ibr login <url>                 # authenticate for protected pages
npx ibr logout                      # clear auth
npx ibr serve                       # open web dashboard
```

**Viewports:** `desktop`, `laptop`, `tablet`, `mobile`, `iphone-14`, `iphone-14-pro-max`
Use: `npx ibr scan <url> --viewport mobile --json`

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
