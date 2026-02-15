---
description: Capture a screenshot using IBR instead of Playwright MCP. Use for UI capture, reference images, and design validation.
---

# /ibr:screenshot

Capture a screenshot of a URL using IBR's managed session system.

## When to Use

For capturing a visual reference. For **validating** UI implementation, prefer `npx ibr scan <url> --json` instead — it returns structured data (computed CSS, handlers, a11y) that is more precise than pixels.

## Usage

```bash
npx ibr start <url> --name "<descriptive-name>"
```

## Examples

```bash
# Capture a local dev page
npx ibr start http://localhost:3000/dashboard --name "dashboard-capture"

# Capture with specific viewport
npx ibr start http://localhost:3000 --viewport mobile --name "mobile-home"

# Capture external site for reference
npx ibr start https://example.com --name "example-reference"
```

## Output

Screenshots are stored in `.ibr/sessions/<session-id>/`:
- `baseline.png` — The captured screenshot
- `session.json` — Metadata (URL, viewport, timestamp)

## Why Use This Over Playwright MCP

| IBR | Playwright MCP |
|-----|----------------|
| Managed sessions with metadata | Raw screenshots |
| Automatic storage organization | Manual file handling |
| Built-in comparison (`ibr check`) | No comparison |
| Session history and timeline | No history |
| Structured scan data (`ibr scan`) | Pixel-only snapshots |
| Integration with `/ibr:replicate` | Standalone |

## For Reference Images (Design Replication)

If capturing a reference for UI replication, prefer the IBR web UI upload:

1. Open IBR dashboard: `npx ibr serve` or go to `localhost:4200`
2. Click "Upload Reference"
3. Use "From URL" tab for live extraction (gets HTML/CSS too)
4. Or drag-drop an image file

This provides richer data for replication than a simple screenshot.

## After Capturing

- **Validate implementation**: `npx ibr scan <url> --json` (preferred for AI agents)
- View in IBR UI: `npx ibr serve`
- List sessions: `npx ibr list`
- Compare after changes: `npx ibr check`
