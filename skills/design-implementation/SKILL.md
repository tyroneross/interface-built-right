---
name: design-implementation
description: Use when the user asks to build UI, implement a design, match a mockup, or when frontend files (.tsx/.jsx/.vue/.svelte/.css/.swift) are being edited and implementation must align with intent.
version: 0.5.0
user-invocable: false
---

# Design Implementation with IBR

Use IBR as a planning partner during the build — scan live pages to confirm implementation matches user intent, catch mismatches early, and track changes incrementally. Ground truth is what is actually rendered, not what the code is supposed to do.

## IBR as Planning Partner

IBR does not replace judgment during implementation — it informs it. Scan early and often to close the gap between intent and output. When the user describes what they want, map those descriptions to measurable properties in the scan output. Address gaps immediately rather than accumulating them.

### Validating Against User Intent

Every description the user provides is a testable assertion. Extract the claim and find the corresponding scan field:

| User said | Check this scan field |
|-----------|----------------------|
| "blue buttons" | `computedStyles.backgroundColor` on button elements |
| "16px font" | `computedStyles.fontSize` |
| "working search" | `interactive.hasOnClick: true` on the search trigger |
| "accessible" | `a11y.ariaLabel` present on interactive elements |
| "cards with rounded corners" | `computedStyles.borderRadius` on card elements |
| "full-width layout" | `bounds.width` relative to viewport |
| "disabled submit until form is valid" | `interactive.isDisabled: true` on submit before input |
| "error message on invalid email" | scan for error element visibility after bad input |

If a user assertion does not match the scan output, fix the mismatch before continuing. Do not defer — mismatches compound.

## Scan While Building

Do not wait until the build is complete to scan. Scan at each meaningful checkpoint:

1. After scaffolding the component structure
2. After applying layout and spacing
3. After wiring interactions and handlers
4. After adding accessibility attributes
5. After the user says "check my progress" or "does this look right"

Each scan should produce fewer issues than the previous. If issue count is not decreasing, stop and diagnose before continuing.

## Primary Tool: `ibr scan`

Call the `ibr scan` MCP tool to read the live page state.

**Input:** `url` (required), `format` (optional: "json"), `viewport` (optional), `waitFor` (optional CSS selector)

**Returns:**
- Verdict: `PASS`, `ISSUES`, or `FAIL`
- Per-element data: selector, tagName, bounds, computedStyles, interactive status, a11y attributes
- Interactivity audit: buttons with/without handlers, links with real/placeholder hrefs, form submit handlers
- Semantic state: pageIntent, auth/loading/error states, available actions
- Console errors and warnings
- Issue list with severity, category, description, and selector

### Reading Scan Output

Read the full scan output, not just the verdict. A `PASS` verdict with console errors is not clean. An `ISSUES` verdict with only low-severity items may be acceptable at an early build stage. Make a judgment based on the actual issue list, not just the top-line verdict.

Priorities during implementation:

1. **Console errors** — these indicate broken code and must be resolved
2. **Missing handlers** — buttons with `interactive.hasOnClick: false` are non-functional
3. **Missing a11y attributes** — accessibility gaps are harder to retrofit later
4. **CSS mismatches** — style values that contradict user intent

## Change Tracking Workflow

Capture a reference point before making changes, compare after to understand what moved.

### 1. Capture baseline

Call `ibr snapshot` before starting a new feature or refactor.

**Input:** `url` (required), `name` (required — descriptive label like "before-nav-redesign")

Take the snapshot after the page is in a stable, known-good state. Do not snapshot in the middle of partial work.

### 2. Make code changes

Edit components, styling, and layout. Make focused changes — avoid changing multiple unrelated things in a single edit cycle, as it makes the comparison harder to interpret.

### 3. Compare against baseline

Call `ibr compare` after changes to understand what moved.

**Returns verdicts:**

| Verdict | Meaning | Action |
|---------|---------|--------|
| `MATCH` | No changes detected | Confirm this is expected — baseline may not have updated |
| `EXPECTED_CHANGE` | Changes look intentional | Review diff regions and continue |
| `UNEXPECTED_CHANGE` | Something changed that shouldn't have | Investigate before continuing |
| `LAYOUT_BROKEN` | Major structural displacement | Fix immediately, do not continue building on top of broken layout |

If unexpected changes appear, trace them to a specific edit. Revert if needed. Fix layout breaks before layering any additional work.

### 4. Browse sessions

Call `ibr list_sessions` to see all active baseline sessions. Use when picking up work after a break or switching between features.

## Decision Tree: Which Tool to Use

| User intent | Tool | Notes |
|-------------|------|-------|
| "Check my UI" or "does this look right" | `ibr scan` | Primary validation |
| "I'm about to change the nav" | `ibr snapshot` | Capture before changes |
| "Did my refactor break anything" | `ibr compare` | After changes |
| "Show me saved baselines" | `ibr list_sessions` | Browse sessions |
| "Scan the simulator" | `ibr native_scan` | iOS/watchOS |
| "Scan the macOS app" | `ibr scan_macos` | macOS accessibility |
| "List simulators" | `ibr native_devices` | Available devices |

## Native iOS/watchOS/macOS Validation

For Swift/SwiftUI projects, use native IBR tools against the running simulator.

### Scan the simulator

Call `ibr native_scan` to extract accessibility elements and check layout constraints.

**Input:** `device` (optional — simulator name like "Apple Watch" or "iPhone 16 Pro")

**Checks performed:**
- Touch targets: 44pt minimum, always enforced
- Accessibility labels on all interactive elements
- watchOS: max 7 interactive elements per screen
- watchOS: no horizontal overflow beyond viewport bounds

### Native regression

Call `ibr native_snapshot` before changes and `ibr native_compare` after to track simulator-level layout changes.

### List simulators

Call `ibr native_devices` to see available simulators with their current boot status. Boot the target device before scanning.

### macOS apps

Call `ibr scan_macos` to scan a running macOS application via its accessibility tree. Pass the app name as the target.

## IBR vs Screenshot vs Interactive Session

| Task | Tool |
|------|------|
| Exact CSS values, handler wiring, a11y audit, console errors | `ibr scan` |
| Visual coherence, rendering bugs, canvas/SVG, external design reference | Screenshot |
| Multi-step flows requiring clicks and input before validation | `ibr session` (interactive-testing skill) |
| Track what changed across edits | `ibr snapshot` + `ibr compare` |

Use scan first. Add a screenshot when the user needs to see how something looks, not just what it measures. Use interactive sessions only when interaction is required before state is meaningful — form validation, search results, login-gated content.

## Workflow: Scan-While-Building

The canonical loop during active frontend work:

1. User describes intent ("I want a login form with email/password and a disabled submit")
2. Scaffold the component and render it
3. Call `ibr scan` — read the issue list
4. Fix all issues that contradict user intent
5. Re-scan — confirm issue count decreased
6. Continue to next feature when scan is clean or remaining issues are acceptable

Repeat for each distinct UI requirement. Do not accumulate debt by skipping scans.

## Workflow: Implementing Against a Reference Design

When the user provides a reference design (via `ibr screenshot` or an external URL):

1. Capture the reference with `ibr screenshot` (save_as if it should persist)
2. Identify measurable properties: colors, spacing, font sizes, layout structure
3. Implement the component targeting those properties
4. Scan with `ibr scan` and compare computed values against the reference
5. Fix gaps and re-scan
6. Take a screenshot of the implementation and compare visually

## Design System Integration

When a project has `.ibr/design-system.json`, the design system is active during implementation:

1. **Before building** — Load the design-guidance skill for aesthetic direction and component pattern selection
2. **Token reference** — Use token values from the config instead of arbitrary values. Check `tokens.colors` for palette, `tokens.typography` for font scale, `tokens.spacing` for gaps/padding.
3. **Principle enforcement** — The scan pipeline automatically checks Calm Precision principles when the design system is active. Core principles (Gestalt, signal-to-noise) surface as errors. Stylistic (Fitts, Hick) surface as warnings.
4. **During scan** — The `designSystem` field in scan output reports:
   - `principleViolations` — Calm Precision rule failures
   - `tokenViolations` — Off-system values (wrong font size, non-token color)
   - `complianceScore` — 0-100 score
5. **Component patterns** — Load the component-patterns skill for opinionated blueprints

If no design system config exists, scans work exactly as before — no design system checks run.

*ibr — design implementation*
