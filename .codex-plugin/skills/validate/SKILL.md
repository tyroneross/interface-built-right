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
- `interact` or `interact_and_verify`: click, type, select, and verify state changes.
- `flow_search`, `flow_form`, `flow_login`: validate common task flows.
- `match`: compare an approved visual target against a live page.

## Audit Order

1. Read the user request and any `.ibr/builds/<topic>/design-intent.json`.
2. Run the narrowest scan or flow that can prove the claim.
3. Sort failures by severity: console errors, broken handlers, inaccessible controls, semantic/state errors, then visual polish.
4. Fix high-severity issues before treating a design as complete.
5. Re-scan or re-run the interaction to prove the issue moved.

## Evidence Standard

Report the actual issue and the file or UI area it affects. Do not treat an `ISSUES` verdict as acceptable without reading the issue list. If the tool cannot run, state the exact blocker and the fallback evidence used.

## Common Acceptance Gates

- No JavaScript errors during the tested route or flow.
- Primary actions have real handlers or real destinations.
- Interactive elements have accessible names and adequate target size.
- Loading, empty, error, disabled, and success states are visible when expected.
- Snapshot comparison has no unexpected layout break.
