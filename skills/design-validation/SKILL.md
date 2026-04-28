---
name: design-validation
description: Use when the user asks to audit UI, validate the build, check accessibility, find regressions, compare before/after, or run a full scan — post-build verification pass across the interface.
version: 0.5.0
user-invocable: false
---

# Design Validation with IBR

Run structured post-build audits against live pages and native simulators. Validation is distinct from implementation — it is a deliberate verification pass after work is complete, not an inline check during building. The goal is to surface issues that implementation scanning may have missed and confirm the build matches spec.

## Scope of Validation

A full validation pass covers:

- **Interactivity** — all buttons, links, and forms have wired handlers and real targets
- **Accessibility** — all interactive elements have labels, touch targets meet size minimums, keyboard access works
- **Semantic state** — page intent is correct, no stuck loading or error states, available actions match expectations
- **Console health** — no JavaScript errors or warnings during page load
- **Structure** — no orphaned elements, disabled states are visually distinct, layout is intact

Run a complete pass, not a spot check. Issue categories compound — an inaccessible button that also lacks a handler is two separate failures, not one.

## Primary Tool: `ibr scan`

Call `ibr scan` to read the full state of a live page.

**Input:** `url` (required), `format` (optional: "json"), `viewport` (optional), `waitFor` (optional CSS selector)

**Returns:**
- Verdict: `PASS`, `ISSUES`, or `FAIL`
- Per-element data: selector, tagName, bounds, computedStyles, interactive status, a11y attributes
- Interactivity audit: buttons with/without handlers, links with real vs placeholder hrefs, form submit handlers
- Semantic state: pageIntent, auth/loading/error states, available actions
- Console errors and warnings
- Issue list with severity, category, description, and selector

### Reading Verdicts

| Verdict | Meaning |
|---------|---------|
| `PASS` | No issues found — implementation is clean |
| `ISSUES` | Issues detected — review by severity and decide whether to fix or accept |
| `FAIL` | Critical issues — broken handlers, console errors, inaccessible elements — must fix |

Do not treat `ISSUES` as acceptable without reading the issue list. Severity matters: low-severity structural notes may be acceptable in context; missing handlers are not.

## Issue Categories

| Category | Examples | Severity |
|----------|---------|---------|
| `interactivity` | Button without handler, form without submit action, placeholder `href="#"` | High |
| `accessibility` | Missing aria-label, touch target below 44px/44pt, no keyboard focus indicator | High |
| `semantic` | Page stuck in loading state, wrong pageIntent, actions missing from expected set | Medium |
| `console` | JavaScript errors or unhandled promise rejections on page load | High |
| `structure` | Orphaned elements, disabled without visual differentiation, invisible interactive elements | Low–Medium |

Address high-severity issues before closing the audit. Document accepted medium/low items with rationale.

## Accessibility Audit

Accessibility validation is a first-class concern, not an afterthought. Check every interactive element:

- `a11y.ariaLabel` is present and descriptive (not generic like "button" or "click here")
- `a11y.role` is appropriate for the element type
- `bounds` meet minimum touch target size: 44px for web, 44pt for native iOS/watchOS
- Focusable elements are reachable via keyboard (Tab order)
- Error messages are associated with their inputs via `a11y.ariaDescribedBy`
- Icons without visible text have an accessible label

Report each accessibility failure with its selector, the missing attribute, and the expected value.

## Regression Checking

Use `ibr compare` to verify that changes did not introduce unintended side effects.

### Setup: Capture a baseline

Before any change that may affect layout or visual state, call `ibr snapshot`.

**Input:** `url` (required), `name` (required — use a descriptive label like "pre-nav-refactor")

The snapshot records computed element state at that point in time.

### After changes: Run comparison

Call `ibr compare` to diff the current page against the baseline.

**Returns verdicts:**

| Verdict | Meaning | Action |
|---------|---------|--------|
| `MATCH` | No changes detected | Confirm expected — if changes were made, baseline may be stale |
| `EXPECTED_CHANGE` | Changes detected, appear intentional | Review diff regions and sign off |
| `UNEXPECTED_CHANGE` | Elements moved or changed outside the intended scope | Investigate and fix |
| `LAYOUT_BROKEN` | Major structural displacement | Treat as a blocker — do not ship |

Report the diff regions for any non-MATCH verdict. For `UNEXPECTED_CHANGE`, identify which edit introduced the regression and revert or fix it.

### Managing sessions

Call `ibr list_sessions` to see all active baseline sessions. Use when auditing across multiple features or returning to work after a pause.

## Native iOS/watchOS/macOS Validation

For Swift/SwiftUI projects, validate against the running simulator rather than the browser.

### Scan the simulator

Call `ibr native_scan` to extract the accessibility element tree and validate layout constraints.

**Input:** `device` (optional — simulator name like "Apple Watch Series 9" or "iPhone 16 Pro")

**Checks performed:**
- Touch targets: 44pt minimum on all interactive elements
- Accessibility labels on all tappable elements
- watchOS: no more than 7 interactive elements per screen
- watchOS: no horizontal content overflow beyond the device viewport

Report each violation with the element identifier and the measured vs expected value.

### Native regression

Call `ibr native_snapshot` before simulator changes, then `ibr native_compare` after. The same verdict table applies as web comparison.

### List simulators

Call `ibr native_devices` to see all simulators and their boot status. Confirm the target device is booted before scanning. A scan against an unbooted device will return no elements.

### macOS apps

Call `ibr scan_macos` to audit a running macOS application via its accessibility tree. Pass the app name as the target identifier.

## Audit Workflow

A complete post-build validation pass:

1. **Scan all routes** — call `ibr scan` on each page in the application, not just the primary route
2. **Triage the issue list** — sort by severity; address all high-severity issues before moving to medium
3. **Accessibility pass** — verify every interactive element has a label, role, and adequate touch target
4. **Interactivity pass** — confirm every button, link, and form has a working handler and real target
5. **Console pass** — confirm zero JavaScript errors on page load for every route
6. **Regression check** — call `ibr compare` if baselines exist; verify no unexpected changes

Do not close the audit until all high-severity issues are resolved or explicitly accepted with documented rationale.

## Principle Enforcement

When `.ibr/design-system.json` is active, the scan automatically enforces Calm Precision principles:

| Principle | What it checks | Default severity |
|-----------|---------------|-----------------|
| Gestalt | Individual borders on list items, ungrouped related elements | error |
| Signal-to-Noise | Status elements with heavy background colors instead of text color | error |
| Content-Chrome | Content area ratio below 70% | warn |
| Cognitive Load | More than 7 interactive elements in a visual group | warn |
| Fitts | Primary action buttons below 120px width | warn |
| Hick | More than 5 visible choices without progressive disclosure | warn |

Principle violations appear in the `designSystem.principleViolations` array of the scan result. Each violation includes the rule ID, element selector, and a fix suggestion.

To adjust severity: edit `.ibr/design-system.json` → `principles.calmPrecision.severity`. Set any principle to `"off"` to disable it.

## Token Compliance

When design tokens are configured, the scan checks all rendered elements against the token specification:

- **Colors**: text color and background-color against `tokens.colors`
- **Font sizes**: computed font-size against `tokens.typography.fontSizes`
- **Font weights**: computed font-weight against `tokens.typography.fontWeights`
- **Spacing**: gap, padding, margin against `tokens.spacing` array
- **Border radius**: computed border-radius against `tokens.borderRadius`
- **Touch targets**: interactive element size against `tokens.touchTargets.min`

Token violations appear in `designSystem.tokenViolations`. Each reports the element, property, expected token value, and actual value.

The `designSystem.complianceScore` (0-100) reflects the percentage of checked properties that match tokens. A score of 100 means every rendered value matches the design system.

## Change Tracking in CI Context

When auditing after a PR or deployment:

1. Ensure a pre-change baseline exists (`ibr list_sessions` to confirm)
2. Run `ibr compare` to surface any layout regressions
3. Run `ibr scan` on all affected routes
4. Report: verdict per route, issue count by severity, regression status (MATCH/UNEXPECTED_CHANGE)

If no baseline exists, create one now and note that regression comparison is not available for this cycle.

## Audit Verdict Summary Format

When reporting audit results, use this structure:

```
Route: /example
  Scan verdict: PASS | ISSUES | FAIL
  Issues: [count] ([high] high, [med] medium, [low] low)
  Regression: MATCH | EXPECTED_CHANGE | UNEXPECTED_CHANGE | LAYOUT_BROKEN | no baseline
  Blockers: [list high-severity issues or "none"]
```

Provide one block per route. Summarize total blocker count at the end. A build is ready to ship when all routes return `PASS` or `ISSUES` with zero high-severity items and regression status is `MATCH` or `EXPECTED_CHANGE`.

## IBR vs Screenshot vs Interactive Session

| Task | Tool |
|------|------|
| Full accessibility and handler audit | `ibr scan` |
| Visual regression and rendering defects | Screenshot |
| Multi-step flow validation (login, checkout) | `ibr session` (interactive-testing skill) |
| Layout change tracking | `ibr snapshot` + `ibr compare` |
| Native touch target and a11y audit | `ibr native_scan` |

*ibr — design validation*
