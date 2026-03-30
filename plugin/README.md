# IBR - Interface Built Right Plugin

Visual testing and interaction platform for Claude Code. Scans live pages, clicks/types/fills elements by accessible name, verifies UI implementation, captures design intent, runs mockup matching. Built on custom CDP engine — no Playwright.

## MCP Tools

| Tool | Description |
|------|-------------|
| `observe` | Preview all clickable/fillable elements before interacting |
| `interact` | Click, type, fill elements by accessible name |
| `extract` | Read page headings, buttons, inputs, links as structured data |
| `interact_and_verify` | Act + capture before/after state diff |
| `scan` | Full page analysis — elements, CSS, handlers, a11y, console |
| `snapshot` | Capture visual baseline before changes |
| `compare` | Compare current state against baseline |
| `screenshot` | Capture screenshot of any URL |

## Slash Commands

| Command | Description |
|---------|-------------|
| `/ibr:snapshot` | Capture baseline before UI changes |
| `/ibr:compare` | Compare current state against baseline |
| `/ibr:interact` | Click, type, verify — interaction assertions |
| `/ibr:test` | Run .ibr-test.json declarative tests |
| `/ibr:match` | Compare mockup PNG against live page (SSIM) |
| `/ibr:full-interface-scan` | Scan all pages, test every component |
| `/ibr:ui` | Launch the web UI dashboard |
| `/ibr:ui-audit` | Full end-to-end workflow audit |

## Quick Start

```bash
# See what's interactive on a page
npx ibr observe http://localhost:3000

# Click a button
npx ibr interact http://localhost:3000 --action click --target "Submit"

# Type in a search box
npx ibr interact http://localhost:3000 --action type --target "Search" --value "query"

# Extract page structure
npx ibr extract http://localhost:3000

# Visual regression
npx ibr start http://localhost:3000 --name "before-change"
# ... make changes ...
npx ibr check

# Diagnose page issues
npx ibr diagnose http://localhost:3000
```

## Requirements

- Node.js 22+
- Chrome (auto-detected, no manual install needed)
