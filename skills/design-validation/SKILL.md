---
name: design-validation
description: This skill activates when the user builds UI, edits .tsx/.jsx/.vue/.svelte/.css files, asks to "check my UI", "audit accessibility", "validate design", "verify implementation", "scan for UI issues", "compare against baseline", "visual regression", "check handlers", "find broken buttons", "review UX", or when any frontend work is in progress. Covers scanning, baseline capture, comparison, native validation, and design spec storage via IBR MCP tools.
version: 0.5.0
user-invocable: false
---

# Design Validation with IBR

Validate that UI implementation matches user intent using structured data — computed CSS, handler wiring, accessibility, and page structure. This skill covers scanning, visual regression, native validation, and design spec auditing.

## When to Activate

- After building or modifying UI components
- User asks to check, audit, or validate frontend work
- Before PR review on frontend changes
- When users report broken interactions
- After editing .tsx, .jsx, .vue, .svelte, .css, .scss files
- When working on Swift/SwiftUI files (native validation)

## Primary Workflow: Scan & Validate

Use the `ibr scan` MCP tool to validate live pages.

**Input:** `url` (required), `format` (optional: "json"), `viewport` (optional), `waitFor` (optional CSS selector)

**Returns:**
- Verdict: **PASS**, **ISSUES**, or **FAIL**
- Per-element data: selector, tagName, bounds, computedStyles, interactive status, a11y attributes
- Interactivity audit: buttons with/without handlers, links with real/placeholder hrefs, form submit handlers
- Semantic state: pageIntent, auth/loading/error states, available actions
- Console errors and warnings
- Issue list with severity, category, description, and selector

### Validation Against User Intent

After scanning, cross-reference results with what the user described:
- User said "blue buttons" -> check `computedStyles.backgroundColor` on buttons
- User said "16px font" -> check `computedStyles.fontSize`
- User said "working search" -> check `interactive.hasOnClick: true`
- User said "accessible" -> check `a11y.ariaLabel` present

Fix mismatches and re-scan until implementation matches intent.

## Visual Regression Workflow

Capture baseline BEFORE changes, compare AFTER.

### 1. Capture baseline

Use the `ibr snapshot` MCP tool before making UI changes.

**Input:** `url` (required), `name` (required — descriptive label like "header-redesign")

### 2. Make code changes

Edit components, styling, layout as needed.

### 3. Compare against baseline

Use the `ibr compare` MCP tool to detect regressions.

**Returns verdicts:**

| Verdict | Meaning | Action |
|---------|---------|--------|
| `MATCH` | No visual changes | Done |
| `EXPECTED_CHANGE` | Changes look intentional | Review and continue |
| `UNEXPECTED_CHANGE` | Something changed that shouldn't have | Investigate |
| `LAYOUT_BROKEN` | Major structural issues | Fix before continuing |

If unexpected changes found, fix and re-compare until resolved.

### 4. List sessions

Use the `ibr list_sessions` MCP tool to browse active baseline sessions.

## Native iOS/watchOS/macOS Validation

For Swift/SwiftUI projects, use native IBR tools to validate simulator output.

### Native scan

Use the `ibr native_scan` MCP tool to extract accessibility elements and check constraints.

**Input:** `device` (optional — simulator name like "Apple Watch" or "iPhone 16 Pro")

**Checks:**
- Touch targets (44pt minimum, always enforced)
- Accessibility labels on interactive elements
- watchOS: max 7 interactive elements per screen
- watchOS: no horizontal overflow beyond viewport

### Native regression

Use the `ibr native_snapshot` MCP tool for baseline, `ibr native_compare` for comparison.

### List simulators

Use the `ibr native_devices` MCP tool to see available simulators with boot status.

### macOS apps

Use the `ibr scan_macos` MCP tool to scan running macOS apps via accessibility tree.

## Issue Categories

| Category | Examples |
|----------|---------|
| `interactivity` | Button without handler, form without submit, placeholder link |
| `accessibility` | Missing aria-label, small touch target, no keyboard access |
| `semantic` | Page in error state, loading stuck, unknown intent |
| `console` | JavaScript errors during page load |
| `structure` | Orphan elements, disabled without visual cues |

## Decision Tree

| User Intent | MCP Tool | Notes |
|-------------|----------|-------|
| "Check my UI" | `ibr scan` | Primary validation |
| "Capture baseline" | `ibr snapshot` | Before changes |
| "Compare changes" | `ibr compare` | After changes |
| "List baselines" | `ibr list_sessions` | Browse sessions |
| "Scan simulator" | `ibr native_scan` | iOS/watchOS |
| "Scan macOS app" | `ibr scan_macos` | macOS accessibility |
| "List simulators" | `ibr native_devices` | Available devices |

## IBR vs Screenshot vs Playwright

| Task | Tool |
|------|------|
| Exact CSS values, handler wiring, a11y audit, console errors | `ibr scan` |
| Visual coherence, rendering bugs, canvas/SVG | Screenshot |
| Multi-step flows, file uploads, dialogs | Playwright or `/ibr:interactive-testing` |
| Regression baselines | `ibr snapshot` + `ibr compare` |

*ibr — design validation*
