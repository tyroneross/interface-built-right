---
name: validate
description: Use when scanning, auditing, comparing, or testing UI with IBR.
---

# IBR Validate

Use IBR MCP tools as evidence, not decoration. Validate the rendered interface against user intent, design intent, accessibility, interaction behavior, and console health.

## Tool Choice

- `scan`: full web page scan for layout, styles, semantic state, accessibility, handlers, and console issues.
- `snapshot`: capture a before state before risky UI edits.
- `compare`: verify whether current UI changes are expected or regressions.
- `screenshot`: capture visual evidence when layout, canvas, media, or design-match judgment needs pixels.
- `observe`: list actionable elements by accessible role and name.
- `interact` or `interact_and_verify`: click, type, select, and verify state changes. `success` on the response reflects a real expected-outcome validator, not just that the call didn't throw — a no-op click (target resolved, nothing changed) returns `success: false` with `validator`/`evidence` explaining what was expected vs. observed. Read `validator.passed`, don't assume `success` is always `true`.
- `flow_search`, `flow_form`, `flow_login`: validate common task flows.
- `match`: compare an approved visual target against a live page.

## Audit Order

1. Read the user request and any `.ibr/builds/<topic>/design-intent.json`.
2. Map the specified change to affected components, routes, states, and shared dependencies.
3. Select the smallest set of scans, flows, viewports, and regression checks that covers that impact surface. Do not run every route or every test by default.
4. Expand scope only when a shared dependency changed, the impact map is uncertain, or a targeted check exposes broader breakage.
5. Sort failures by severity: console errors, broken handlers, inaccessible controls, semantic/state errors, then visual polish.
6. Fix high-severity issues before treating a design as complete.
7. Re-scan or re-run the selected interaction to prove the issue moved.

## Evidence Standard

Report the actual issue and the file or UI area it affects. Do not treat an `ISSUES` verdict as acceptable without reading the issue list. If the tool cannot run, state the exact blocker and the fallback evidence used.

Report why each route or flow was selected and identify any impact area that could not be verified. “All tests passed” is not useful evidence when most tests are unrelated to the change.

## Common Acceptance Gates

- No JavaScript errors during the tested route or flow.
- Primary actions have real handlers or real destinations.
- Interactive elements have accessible names and adequate target size.
- Breadcrumb trails use a labelled navigation landmark and list structure; a linked current page uses `aria-current="page"` on the final item.
- Loading, empty, error, disabled, and success states are visible when expected.
- Snapshot comparison has no unexpected layout break.
