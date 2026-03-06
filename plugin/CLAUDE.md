# Interface Built Right - Claude Instructions

## Overview

You have access to `interface-built-right` (IBR) — a design validation tool. Use it to verify that UI implementation matches what the user described. IBR extracts structured data from the live page (computed CSS, element bounds, handler wiring, accessibility, page structure) and reports back whether the build matches the intent.

IBR's structured output gives you exact values — instead of guessing "that looks blue" from a screenshot, IBR returns `backgroundColor: "rgb(59, 130, 246)"`. For precise property verification, scan data is ground truth. For holistic visual checks (rendering bugs, visual coherence, canvas/SVG content), screenshots remain valuable as a complement.

## Setup

**Add `.ibr/` to your project's `.gitignore`:**

```bash
echo ".ibr/" >> .gitignore
```

## When to Use IBR

### Primary: Design Validation

Use IBR whenever the user describes how the UI should look or behave, then verify your implementation matches:

- User says "make the buttons blue" → build it → `npx ibr scan` → check `backgroundColor` on buttons
- User says "use 16px Inter font" → build it → scan → check `fontSize`, `fontFamily`
- User says "add a search bar that works" → build it → scan → check element exists, has handler, accepts input
- User says "cards should be in a 3-column grid" → build it → scan → check `gridTemplateColumns`
- User says "the form needs validation" → build it → scan → check form has submit handler

### Secondary: Regression Verification

After making changes, verify nothing else broke:

```bash
npx ibr start <url> --name "before-change"   # capture before
# ... make changes ...
npx ibr check                                  # verify after
```

### Skip for:
- Backend-only changes (APIs, database, server logic)
- Config file updates, documentation, type-only changes

## Default Workflow

### 1. Validate Against User Intent (Primary)

When the user describes what they want:

```bash
# After building what they asked for, scan to validate
npx ibr scan http://localhost:3000/page --json
```

Read the scan output and verify each element of the user's description:

| User said | Check in scan output |
|-----------|---------------------|
| "Blue buttons" | `computedStyles.backgroundColor` on button elements |
| "16px font" | `computedStyles.fontSize` on text elements |
| "3-column grid" | `computedStyles.gridTemplateColumns` on container |
| "44px touch targets" | `bounds.width` and `bounds.height` on interactive elements |
| "Working search" | Button/input with `interactive.hasOnClick: true` |
| "Accessible labels" | `a11y.ariaLabel` or `a11y.role` present |
| "No console errors" | `console.errors` array is empty |

If validation fails, fix the code and scan again. Self-iterate until the scan confirms the implementation matches the intent.

### 2. Store Design Specs as Memory

When the user states design preferences that should persist:

```bash
# Store as enforceable specs
npx ibr memory add "Primary buttons are blue" --property background-color --value "#3b82f6"
npx ibr memory add "Body font is Inter 16px" --property font-family --value "Inter"
npx ibr memory add "Touch targets minimum 44px" --property min-height --value "44px"
```

Memory preferences are checked on every scan automatically. They become validation rules.

### 3. Regression Check (When Modifying Existing UI)

```bash
npx ibr start http://localhost:3000/page --name "feature-name"  # baseline before
# ... make code changes ...
npx ibr check                                                    # compare after
```

Verdicts: `MATCH`, `EXPECTED_CHANGE`, `UNEXPECTED_CHANGE`, `LAYOUT_BROKEN`

## What IBR Scan Returns

The scan provides structured data for precise property verification:

### Element Data (per interactive element)
```
selector:        Unique CSS path
tagName:         button, a, input, etc.
text:            Visible text content
bounds:          { x, y, width, height } — exact position and size
computedStyles:  backgroundColor, color, fontSize, fontFamily, fontWeight,
                 padding, margin, borderRadius, display, gap, flexDirection,
                 alignItems, justifyContent, gridTemplateColumns, etc.
interactive:     { hasOnClick, hasHref, hasReactHandler, isDisabled, cursor }
a11y:            { role, ariaLabel, ariaDescribedBy, ariaHidden }
```

### Page-Level Data
```
pageIntent:      auth | form | listing | detail | dashboard | error | landing
state.auth:      { authenticated, username, confidence }
state.loading:   { loading, type: spinner|skeleton|progress }
state.errors:    { hasErrors, errors[], severity }
console:         { errors[], warnings[] }
verdict:         PASS | ISSUES | FAIL
```

### When Scan Data Is Best
- **Exact CSS values** — `backgroundColor`, `fontSize`, `fontFamily` — no guessing from pixels
- **Handler detection** — knows if a button is wired up (React, Vue, Angular, vanilla)
- **Accessibility audit** — checks ARIA labels, roles, touch target sizes
- **Console errors** — catches JavaScript errors invisible in screenshots
- **Page classification** — understands if it's a dashboard, form, auth page, etc.
- **Machine-readable** — structured data for programmatic verification

### When Screenshots Add Value
- **Visual coherence** — do colors, spacing, and layout *feel* right together?
- **Rendering bugs** — clipped text, z-index overlaps, font rendering issues that computed styles don't reveal
- **Canvas/SVG/WebGL** — content that lives outside the DOM
- **Unexpected artifacts** — things you didn't think to check in the scan
- **Mockup comparison** — matching against a design file or reference image

### Best Practice: Combine Both
1. **Scan first** — verify exact property values against user intent
2. **Screenshot when needed** — visual sanity check after scan confirms properties match
3. **Screenshot always for** — canvas/SVG content, complex animations, visual regression where "looks right" matters

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/ibr:snapshot` | Capture baseline before making UI changes |
| `/ibr:compare` | Compare current state against baseline |
| `/ibr:full-interface-scan` | Scan all pages, test every component |
| `/ibr:build-baseline` | Create baselines for all pages with element catalog |
| `/ibr:ui` | Open web dashboard at localhost:4200 |
| `/ibr:ui-audit` | Full end-to-end workflow audit |

## CLI Quick Reference

```bash
npx ibr scan <url> --json        # Validate UI — primary command
npx ibr start <url>              # Capture baseline for regression
npx ibr check                    # Compare against baseline
npx ibr memory add "<spec>"      # Store design spec
npx ibr memory list              # Show stored specs
npx ibr list                     # List all sessions
npx ibr serve                    # Open web dashboard
```

## Interactive Sessions

For pages requiring interaction before validation:

```bash
# Start persistent browser
npx ibr session:start http://localhost:3000 --name "test"

# Interact
npx ibr session:type <id> "input[name=search]" "test query"
npx ibr session:click <id> "button[type=submit]"
npx ibr session:wait <id> ".results"

# Validate the resulting state
npx ibr session:screenshot <id>

# Extract text or HTML for verification
npx ibr session:text <id> ".result-count"
npx ibr session:html <id> --selector ".results"

# Close
npx ibr session:close <id>
```

## IBR + Playwright: When to Use Each

| Task | Best Tool | Why |
|------|-----------|-----|
| Verify exact CSS values | **IBR scan** | Returns computed properties directly |
| Check handler wiring | **IBR scan** | Detects onClick, React handlers, etc. |
| Accessibility audit | **IBR scan** | ARIA labels, roles, touch targets |
| Console error check | **IBR scan** | Captures JS errors during page load |
| Visual coherence check | **Screenshot** | Does the page *look* right holistically? |
| Canvas/SVG/WebGL content | **Screenshot** | Not in the DOM, scan can't see it |
| Rendering bugs (clipping, overlap) | **Screenshot** | Computed styles can be correct but rendering wrong |
| Complex multi-step flows | **Playwright** | Click, type, navigate, handle dialogs |
| Regression baselines | **IBR start + check** | Managed sessions with verdicts |

**Recommended pattern:**
```bash
# 1. Scan for precise verification
npx ibr scan <url> --json

# 2. Screenshot for visual confirmation (when needed)
# Use Playwright screenshot or IBR session:screenshot
```

**Use Playwright directly for:** multi-tab scenarios, file uploads, dialog handling, complex form flows, JavaScript evaluation

## Authenticated Pages

```bash
npx ibr login http://localhost:3000/login   # Opens browser for manual auth
npx ibr scan http://localhost:3000/dashboard --json  # Validates with auth
npx ibr logout                               # Clear auth
```

## Viewports

Available: `desktop`, `laptop`, `tablet`, `mobile`, `iphone-14`, `iphone-14-pro-max`

```bash
npx ibr scan http://localhost:3000 --viewport mobile --json
```

## Native iOS/watchOS Validation

IBR can validate native iOS and watchOS simulator output using the same pipeline as web validation. Use native tools when working on Swift/SwiftUI projects.

### When to Use Native Tools

| Situation | Tool |
|-----------|------|
| Edited `.swift` files | `native_scan` — validates simulator UI |
| Before changing native UI | `native_snapshot` — capture baseline |
| After changing native UI | `native_compare` — check for regressions |
| Need to find a simulator | `native_devices` — list available devices |

### Native MCP Tools

| Tool | Purpose |
|------|---------|
| `native_scan` | Extract accessibility elements, check touch targets (44pt min), validate watchOS constraints, audit labels |
| `native_snapshot` | Capture baseline screenshot from running simulator |
| `native_compare` | Compare current simulator state against baseline — returns same verdicts as web compare |
| `native_devices` | List available iOS/watchOS simulators with boot status |

### What Native Scan Checks

- **Touch targets**: All interactive elements must be >= 44x44pt (always enforced, not just mobile)
- **Accessibility labels**: Interactive elements need labels for VoiceOver
- **watchOS density**: Max 7 interactive elements per screen (cognitive load on small displays)
- **watchOS overflow**: No elements extending beyond viewport width
- **Element tree**: Full accessibility tree mapped to IBR's standard element format

### Native Workflow

```bash
# 1. List available simulators
npx ibr native:devices

# 2. Scan a running simulator
npx ibr native:scan "Apple Watch"         # by name fragment
npx ibr native:scan                        # uses first booted device

# 3. Baseline + compare for regression testing
npx ibr native:start "iPhone 16 Pro" --name "timer-screen"
# ... make Swift changes, rebuild ...
npx ibr native:check
```

### Web vs Native Decision

| File type | Use |
|-----------|-----|
| `.tsx`, `.jsx`, `.vue`, `.svelte`, `.html`, `.css` | Web tools (`scan`, `snapshot`, `compare`) |
| `.swift` | Native tools (`native_scan`, `native_snapshot`, `native_compare`) |
| Backend-only (`.ts`, `.py`, `.go`) | Skip IBR |

## Best Practices

1. **Scan after building** — validate implementation matches user intent
2. **Use memory for persistent specs** — store design tokens the user cares about
3. **Scan for properties, screenshot for visual** — scan is ground truth for CSS values; screenshots catch rendering issues scan can't see
4. **Self-iterate on failures** — if scan shows mismatches, fix and re-scan
5. **Baseline for regression** — capture before modifying existing UI
6. **Name sessions meaningfully** — `--name "header-redesign"` not `--name "test"`
7. **Combine tools** — IBR scan + screenshot together gives more confidence than either alone
8. **Use native tools for Swift** — when editing `.swift` files, use `native_scan` to validate the simulator output
