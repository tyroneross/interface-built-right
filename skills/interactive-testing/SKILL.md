---
name: interactive-testing
description: Use when the user asks to test a form, click through a flow, test search or login, interact with a page, or needs browser interaction testing.
version: 0.8.0
user-invocable: true
argument-hint: <url>
---

# Interactive Browser Testing with IBR

IBR can click, type, fill, and interact with elements on live pages — no Playwright needed. Elements are found by accessible name (not CSS selectors).

## MCP Tools (preferred — works directly in Claude Code)

### `observe` — See what's interactive
```
Use IBR observe tool on http://localhost:3000
```
Returns all clickable buttons, fillable inputs, links with their accessible names.

### `interact` — Click, type, fill
```
Use IBR interact tool: click "Submit" on http://localhost:3000
Use IBR interact tool: type "debug" in "Search" on http://localhost:3000/projects
Use IBR interact tool: fill "Email" with "user@test.com" on http://localhost:3000
```

### `extract` — Read page state
```
Use IBR extract tool on http://localhost:3000
```
Returns headings, buttons, inputs, links as structured data. Use after interactions to verify state changed.

### `interact_and_verify` — Act + verify in one step
```
Use IBR interact_and_verify tool: click "FlowDoro" on http://localhost:3000/projects
```
Captures before/after AX tree snapshots, reports elements added/removed and pixel diff.

## CLI Commands

```bash
# See what's interactive
npx ibr observe http://localhost:3000

# Click a button
npx ibr interact http://localhost:3000 --action click --target "Submit"

# Type in a search box
npx ibr interact http://localhost:3000 --action type --target "Search" --value "debug"

# Fill a form field
npx ibr interact http://localhost:3000 --action fill --target "Email" --value "user@test.com"

# Extract page structure
npx ibr extract http://localhost:3000
```

## Common Flows

### Test search filtering
```bash
npx ibr observe http://localhost:3000        # Find the search input name
npx ibr interact http://localhost:3000 --action fill --target "Search tools" --value "debug"
npx ibr extract http://localhost:3000         # Verify filtered results
```

### Test modal popup
```bash
npx ibr interact http://localhost:3000 --action click --target "FlowDoro"
npx ibr extract http://localhost:3000         # Verify modal content appeared
npx ibr interact http://localhost:3000 --action click --target "Close"  # or press Escape
```

### Test form submission
```bash
npx ibr interact http://localhost:3000 --action fill --target "Name" --value "John"
npx ibr interact http://localhost:3000 --action fill --target "Email" --value "john@test.com"
npx ibr interact http://localhost:3000 --action click --target "Submit"
```

## Element Resolution

IBR finds elements by accessible name using a 4-tier strategy:
1. **Cache** — previously resolved elements (instant)
2. **queryAXTree** — CDP-native semantic search by name+role
3. **Fuzzy matching** — Jaro-Winkler on the full accessibility tree
4. **Vision fallback** — screenshot analysis when AX tree is insufficient

Use `--role` to narrow matches: `--role button`, `--role textbox`, `--role link`.

## Supported Actions

| Action | Description | Needs `--value` |
|--------|-------------|:---:|
| `click` | Click an element | No |
| `type` | Type text (appends) | Yes |
| `fill` | Clear + type text | Yes |
| `hover` | Mouse hover | No |
| `press` | Keyboard key press | Yes (key name) |
| `scroll` | Scroll page | Yes (pixels) |
| `select` | Select dropdown option | Yes |
| `check` | Toggle checkbox | No |
