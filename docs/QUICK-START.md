# IBR Quick Start

## Install

```bash
npm install -g @tyroneross/interface-built-right
```

Or use directly with npx:
```bash
npx ibr scan http://localhost:3000
```

## Setup

Add `.ibr/` to your project's `.gitignore`.

## Core Commands

### Scan a page
```bash
npx ibr scan <url> --json
```
Returns: elements, computed CSS, handlers, accessibility, page intent, console errors, AX tree coverage.

### Visual regression
```bash
npx ibr start <url> --name "before-changes"   # capture baseline
# ... make changes ...
npx ibr check                                  # compare against baseline
```

### Interaction testing
```bash
# Click a button, verify something appeared
npx ibr interact <url> --action 'click:button:Submit' --expect 'visible:Success'

# Type in a search, verify results
npx ibr interact <url> --action 'type:textbox:Search:debug' --expect 'count:1'

# Capture screenshot after action
npx ibr interact <url> --action 'click:button:Show Details' --expect-screenshot modal-open
```

### Test flows
```bash
npx ibr test-search <url> --query "debug" --expect-count 1
npx ibr test-form <url> --fill '{"name":"Test","email":"a@b.com"}'
npx ibr test-login <url> --email user@test.com --password secret
```

### Mockup matching
```bash
# Compare a design mockup PNG against the live page
npx ibr match mockup.png <url>

# Compare a specific section
npx ibr match hero-mockup.png <url> --selector '.hero-section'

# Auto-mask dynamic content (timestamps, ads)
npx ibr match mockup.png <url> --mask-dynamic

# Save the diff image
npx ibr match mockup.png <url> --save-diff diff.png
```

Scoring: >0.85 PASS, 0.70-0.85 REVIEW, <0.70 FAIL (SSIM).

### Design verification
```bash
# Record what you changed
npx ibr record-change <url> \
  --element "header" \
  --description "Blue header, 48px bold" \
  --checks '[{"property":"fontSize","operator":"eq","value":"48px","confidence":1.0}]'

# Verify all recorded changes
npx ibr verify-changes <url>
```

### Auto-generate tests
```bash
# Generate a smoke test from page observation
npx ibr generate-test <url>

# Generate a scenario-targeted test
npx ibr generate-test <url> --scenario "user searches for debug, sees one result"

# Run the generated tests
npx ibr test
```

### Python test scripts
```bash
# Run a Python script with sandboxed resource limits
npx ibr run-script tests/e2e.py --url http://localhost:3000 --timeout 30000
```

Scripts receive `IBR_URL` and `IBR_SESSION_DIR` as environment variables.

### Fix-and-iterate loop
```bash
# Run one iteration, track convergence
npx ibr iterate <url> --test .ibr-test.json --max-iterations 7
```

Detects: stagnation (no change), oscillation (A→B→A), regression (getting worse).

### Cross-browser (Chrome + Safari)
```bash
# Compare Chrome vs Safari rendering
npx ibr compare-browsers <url>

# Run any command in Safari
npx ibr interact <url> --browser safari --action 'click:button:Submit'
```

**Safari setup (one-time):**
1. Run `sudo safaridriver --enable`
2. Open Safari → Settings → Advanced → enable "Allow remote automation"

Safari runs hidden (off-screen window) — won't interfere with your browsing.

### Native (iOS/macOS)
```bash
npx ibr native:devices                          # list simulators
npx ibr native:scan "iPhone 16 Pro"              # scan simulator
npx ibr scan:macos --app "Terminal"              # scan macOS app
npx ibr match mockup.png --native "iPhone 16 Pro" # mockup vs simulator
```

## Action Format

For `--action` flag: `action[:role]:target[:value]`

| Example | Meaning |
|---------|---------|
| `click:button:Submit` | Click button named "Submit" |
| `type:textbox:Search:debug` | Type "debug" into Search textbox |
| `fill:textbox:Email:a@b.com` | Fill Email field with value |
| `press:Enter` | Press Enter key |
| `scroll:500` | Scroll down 500px |

## Expect Format

For `--expect` flag:

| Example | Meaning |
|---------|---------|
| `visible:Success` | Element "Success" should appear |
| `hidden:Loading` | Element "Loading" should disappear |
| `text:Saved` | Page should contain text "Saved" |
| `count:3` | 3 interactive elements should exist |

## Viewports

`desktop` (1920x1080), `laptop` (1366x768), `tablet` (768x1024), `mobile` (375x667), `iphone-14`, `iphone-14-pro-max`

```bash
npx ibr scan <url> --viewport mobile --json
```

## Plugin (Claude Code)

IBR is also a Claude Code plugin. When installed, use slash commands:

| Command | Purpose |
|---------|---------|
| `/ibr:scan` | Scan a page |
| `/ibr:interact` | Interaction assertions |
| `/ibr:match` | Mockup comparison |
| `/ibr:test` | Run .ibr-test.json |
| `/ibr:verify-changes` | Verify design changes |
| `/ibr:compare-browsers` | Chrome vs Safari |
| `/ibr:build <topic>` | Guided UI build — brainstorm, plan, implement, verify |
| `/ibr:capture <url>` | Capture a named baseline snapshot for any URL |
| `/ibr:ui-guidance` | On-demand design guidance using IBR scan data |

Full list: see `CLAUDE.md`

### `/ibr:build` — Guided UI build

```
/ibr:build dashboard header with nav and user menu
```

Triggers a structured build flow: brainstorm options → plan implementation → build → scan to verify → iterate if needed. Uses the `ui-brainstorm-preamble` skill to explore directions before writing any code.

### `/ibr:capture` — Baseline snapshot

```
/ibr:capture http://localhost:3000/dashboard
/ibr:capture http://localhost:3000 --name "before-nav-redesign"
```

Captures a named IBR baseline. Equivalent to `npx ibr start <url>` but integrated into the plugin workflow with session tracking.
