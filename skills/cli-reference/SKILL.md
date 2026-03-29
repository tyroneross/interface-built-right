---
name: cli-reference
description: IBR CLI command reference for UI validation, scanning, sessions, native testing, and design memory. Use when you need to inspect, test, validate, or audit any UI — web or native.
user_invocable: true
---

# IBR CLI Reference

Use these commands via Bash. IBR runs in the project directory — all state is stored in `.ibr/`.

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npx ibr scan <url>` | Scan page: elements, handlers, a11y, console errors |
| `npx ibr scan <url> --json` | Same but structured JSON (for programmatic use) |
| `npx ibr audit <url>` | Full audit: functional + visual + semantic |
| `npx ibr start <url>` | Capture baseline screenshot |
| `npx ibr check` | Compare current state vs baseline |
| `npx ibr auto` | Zero-config: detect server, scan all pages |

---

## Page Scanning

```bash
# Full scan — elements, interactivity, semantics, console errors
npx ibr scan http://localhost:3000

# JSON output for parsing
npx ibr scan http://localhost:3000 --json

# Full audit — functional checks + visual + semantic
npx ibr audit http://localhost:3000

# Discover all pages from a starting URL
npx ibr discover http://localhost:3000

# Check UI consistency across pages
npx ibr consistency http://localhost:3000

# Diagnose page load issues
npx ibr diagnose http://localhost:3000
```

### Scan output includes:
- Page intent (auth, form, listing, detail, dashboard, error, landing)
- All interactive elements with handler wiring
- Accessibility audit (roles, labels, touch targets)
- Console errors and warnings
- Verdict: PASS / ISSUES / FAIL

---

## Baseline & Comparison

```bash
# Capture baseline (auto-detects dev server if no URL)
npx ibr start http://localhost:3000
npx ibr start http://localhost:3000 --name "feature-x"

# Compare current vs baseline
npx ibr check
npx ibr check sess_abc123

# List all sessions
npx ibr list
npx ibr list --format json

# Show sessions awaiting comparison
npx ibr status

# Update baseline with current state (accept changes)
npx ibr update sess_abc123
# or: npx ibr approve sess_abc123

# Delete a session
npx ibr delete sess_abc123

# Clean old sessions
npx ibr clean
npx ibr clean --older-than 7d
```

### Comparison verdicts:
- `MATCH` — no visual changes detected
- `EXPECTED_CHANGE` — changes within threshold
- `UNEXPECTED_CHANGE` — visual differences found
- `LAYOUT_BROKEN` — significant structural changes

---

## Interactive Sessions

For multi-step flows (forms, login, navigation). Browser persists across commands.

```bash
# Start session (browser stays open)
npx ibr session:start http://localhost:3000
npx ibr session:start http://localhost:3000 --name "login-test"
# Returns: live_abc123

# Interact
npx ibr session:click live_abc123 "button.submit"
npx ibr session:type live_abc123 "input[name=email]" "user@example.com"
npx ibr session:press live_abc123 Enter
npx ibr session:scroll live_abc123 down 500
npx ibr session:wait live_abc123 ".results"      # wait for selector
npx ibr session:wait live_abc123 2000             # wait 2 seconds
npx ibr session:navigate live_abc123 http://localhost:3000/dashboard

# Capture state
npx ibr session:screenshot live_abc123            # visual capture
npx ibr session:scan live_abc123                  # full IBR scan
npx ibr session:capture live_abc123               # screenshot + scan combined

# Inspect
npx ibr session:html live_abc123                  # full DOM
npx ibr session:text live_abc123 "h1"             # text of element
npx ibr session:eval live_abc123 "document.title" # run JS
npx ibr session:actions live_abc123               # action history
npx ibr session:modal live_abc123                 # detect modals
npx ibr session:modal live_abc123 --dismiss       # dismiss active modal

# Manage
npx ibr session:list                              # list active sessions
npx ibr session:pending                           # pending operations
npx ibr session:close live_abc123                 # close one session
npx ibr session:close all                         # close all + stop browser
```

### Session workflow example:
```bash
npx ibr session:start http://localhost:3000/login --name "login-flow"
# → live_xyz789

npx ibr session:type live_xyz789 "#email" "test@example.com"
npx ibr session:type live_xyz789 "#password" "password123"
npx ibr session:click live_xyz789 "button[type=submit]"
npx ibr session:wait live_xyz789 ".dashboard"
npx ibr session:screenshot live_xyz789
npx ibr session:scan live_xyz789
npx ibr session:close live_xyz789
```

---

## Native Apps (iOS/watchOS/macOS)

```bash
# List simulator devices
npx ibr native:devices
npx ibr native:devices --platform ios
npx ibr native:devices --platform watchos

# Scan running simulator
npx ibr native:scan                              # auto-detect booted device
npx ibr native:scan "iPhone 16 Pro"              # specific device

# Baseline + compare for native
npx ibr native:start                             # capture baseline
npx ibr native:start --name "home-screen"
npx ibr native:check                             # compare vs baseline

# Scan macOS native app
npx ibr scan:macos                               # scans frontmost app
npx ibr scan:macos --app "Local Smartz"           # specific app
```

---

## Design Memory

Persistent UI/UX preferences the agent can reference across sessions.

```bash
# Add a memory
npx ibr memory add "Primary button uses gradient teal-to-indigo"

# List all memories
npx ibr memory list

# Show specific memory
npx ibr memory show mem_abc123

# Remove a memory
npx ibr memory remove mem_abc123

# Summary of all memories
npx ibr memory summary

# View auto-learned patterns
npx ibr memory learned

# Promote a learned pattern to permanent memory
npx ibr memory promote learn_abc123
```

---

## Scan-While-Building

Continuous validation during development. Captures baselines for all discovered pages, then checks for regressions.

```bash
# Step 1: Discover pages + capture baselines
npx ibr scan-start http://localhost:3000

# Step 2: Make code changes...

# Step 3: Check all pages for regressions
npx ibr scan-check
```

---

## Screenshots

```bash
npx ibr screenshots:list                          # all screenshots
npx ibr screenshots:list sess_abc123              # for specific session
npx ibr screenshots:cleanup                       # remove old screenshots
npx ibr screenshots:cleanup --older-than 30d
npx ibr screenshots:view .ibr/screenshots/abc.png # view with metadata
```

---

## Search Testing

AI-powered search testing with validation context.

```bash
npx ibr search-test http://localhost:3000
npx ibr search-test http://localhost:3000 --query "login"
```

---

## Configuration & Setup

```bash
# Initialize IBR in current project
npx ibr init
npx ibr init --register-plugin    # also register as Claude Code plugin

# Auth for protected pages
npx ibr login http://localhost:3000   # opens browser for manual login
npx ibr logout                        # clear saved auth

# Web UI dashboard
npx ibr serve                        # opens at localhost:4200
npx ibr serve --port 4300
```

---

## Global Options

All commands accept these:
- `--viewport <name>` — `desktop` (default), `mobile`, `tablet`
- `--output <dir>` — output directory (default: `.ibr/`)
- `--threshold <percent>` — diff threshold (default: `1.0`)
- `--json` — JSON output (where supported)
- `--format <type>` — `text` (default), `json`, `minimal`

---

## Common Workflows

### Validate after editing UI
```bash
npx ibr scan http://localhost:3000/page-i-edited
# Review issues → fix → re-scan
```

### Regression check before shipping
```bash
npx ibr start http://localhost:3000    # baseline
# Make changes...
npx ibr check                          # compare
# If UNEXPECTED_CHANGE → investigate
# If MATCH or EXPECTED_CHANGE → ship
```

### Test a form flow
```bash
npx ibr session:start http://localhost:3000/form --name "form-test"
npx ibr session:type live_XYZ "input[name=email]" "test@test.com"
npx ibr session:click live_XYZ "button[type=submit]"
npx ibr session:wait live_XYZ ".success-message"
npx ibr session:screenshot live_XYZ
npx ibr session:close live_XYZ
```

### Full audit before release
```bash
npx ibr audit http://localhost:3000
# Fix any FAIL issues → re-audit until PASS
```
