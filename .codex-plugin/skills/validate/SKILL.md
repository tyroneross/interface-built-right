---
name: validate
description: Use when scanning, auditing, comparing, or testing UI with IBR.
---

# IBR Validate

Use IBR's bundle-local CLI as the default evidence surface. The MCP server is dormant/opt-in in Codex, so never assume `scan`, `compare`, or the other MCP tools are callable. If MCP tools are visibly available, they may replace the equivalent CLI command; otherwise run the CLI directly. Validate the rendered interface against user intent, design intent, accessibility, interaction behavior, and console health.

Resolve `IBR_BIN` from this installed `SKILL.md`: move up three directories to the IBR plugin root, then append `dist/bin/ibr.js`. Verify it once with `node "$IBR_BIN" --version`. Do not use `npx ibr`; that unscoped package name can resolve a different npm package.

## Tool Choice

- `node "$IBR_BIN" scan <url> --json`: full web page scan for layout, styles, semantic state, accessibility, handlers, and console issues.
- `node "$IBR_BIN" start <url>`: capture a before state before risky UI edits.
- `node "$IBR_BIN" check [sessionId]`: verify whether current UI changes are expected or regressions.
- `node "$IBR_BIN" observe <url>`: list actionable elements by accessible role and name.
- `node "$IBR_BIN" interact <url> --action <action> --target <accessible-name>`: click, type, fill, select, and verify state changes. Exit `0` means the expected change occurred; exit `1` reports a no-op or failure with human-readable `expected` and `observed` evidence.
- `node "$IBR_BIN" extract <url>`: read headings, links, controls, and page state after an interaction.
- `node "$IBR_BIN" flow search <url>`, `flow form <url>`, or `flow login <url>`: validate common task flows.
- `node "$IBR_BIN" match <mockup.png> <url>`: compare an approved visual target against a live page.
- Pixel evidence: `node "$IBR_BIN" start <url>` writes a baseline screenshot. The ad-hoc `screenshot` tool remains MCP-only; use it only when MCP is explicitly enabled.

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
