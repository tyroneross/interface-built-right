# IBR — Design Implementation Partner

IBR reads live UI and returns structured data — computed CSS, bounds, handler wiring, accessibility, page structure. Scan output is ground truth for what is actually rendered. Use this data to inform implementation decisions during the build and confirm results after. Screenshots complement scans for visual coherence, rendering bugs, and canvas/SVG content.

IBR runs on a custom CDP engine — direct Chrome DevTools Protocol over WebSocket. No Playwright dependency. Elements are found by semantic accessibility tree queries (name + role), not fragile CSS selectors.

**Setup:** Add `.ibr/` to `.gitignore`

## When to Use

- **While building UI** — scan to see what is actually rendered and adjust in real time
- **After building UI** — scan to confirm implementation matches user intent
- **Tracking changes** — capture a reference point with `start`, then `check` after changes
- **Skip for** — backend-only changes, config, docs, type-only changes

## MCP Tools (preferred for Claude Code)

| Tool | Use For |
|------|---------|
| `observe` | See all clickable/fillable elements before interacting |
| `interact` | Click, type, fill elements by accessible name (e.g. `interact` → action: click, target: "Submit") |
| `extract` | Read page headings, buttons, inputs, links after interactions |
| `interact_and_verify` | Act + capture before/after element diff (elements added/removed) |
| `scan` | Full page analysis — CSS, handlers, a11y, console errors |
| `snapshot` | Capture visual baseline |
| `compare` | Compare current vs baseline |
| `screenshot` | Capture screenshot of any URL |

## Core Workflow

```bash
npx ibr scan <url> --json                    # read live UI data
npx ibr start <url> --name "feature-name"    # reference point before changes
npx ibr check                                # compare after changes

# Interaction (by accessible name, not CSS selectors)
npx ibr observe <url>                        # see interactive elements
npx ibr interact <url> --action click --target "Submit"
npx ibr interact <url> --action type --target "Search" --value "query"
npx ibr extract <url>                        # verify page state
```

Verdicts: `MATCH`, `EXPECTED_CHANGE`, `UNEXPECTED_CHANGE`, `LAYOUT_BROKEN`

## Scan Output Reference

**Per element:** `selector`, `tagName`, `text`, `bounds {x,y,w,h}`, `computedStyles` (backgroundColor, fontSize, fontFamily, display, gap, grid*, flex*, padding, margin, borderRadius), `interactive` (hasOnClick, hasHref, hasReactHandler, isDisabled), `a11y` (role, ariaLabel, ariaDescribedBy)

**Page-level:** `pageIntent` (auth|form|listing|detail|dashboard|error|landing), `state.auth`, `state.loading`, `state.errors`, `console` (errors[], warnings[]), `verdict` (PASS|ISSUES|FAIL)

## IBR vs Screenshot

| Task | Tool |
|------|------|
| Exact CSS values, handler wiring, a11y audit, console errors | `ibr scan` |
| Visual coherence, rendering bugs, canvas/SVG | Screenshot |
| Track visual changes | `ibr start` + `ibr check` |

Use scan first for property verification, add screenshot when visual confirmation needed.

## Slash Commands

`/ibr:snapshot` `/ibr:compare` `/ibr:interact` `/ibr:match` `/ibr:test` `/ibr:generate-test` `/ibr:record-change` `/ibr:verify-changes` `/ibr:compare-browsers` `/ibr:test-search` `/ibr:test-form` `/ibr:test-login` `/ibr:full-interface-scan` `/ibr:build-baseline` `/ibr:ui` `/ibr:ui-audit`

Use skill for details.

---
