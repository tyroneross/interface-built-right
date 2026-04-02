---
description: Capture a screenshot of any URL and return the image for Claude to see. Optionally save to the design reference library.
argument-hint: <url>
---

# /ibr:screenshot

Capture a screenshot using IBR's `screenshot` MCP tool. Returns a base64 image content block that Claude can see directly.

## Usage

Call the `ibr screenshot` MCP tool with the provided URL.

**Default behavior:**
- Desktop viewport (1920x1080)
- Viewport-only capture (not full page)
- 2000ms delay for external sites, 500ms for localhost

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `url` | (required) | URL to capture |
| `viewport` | desktop | desktop, mobile, or tablet |
| `selector` | — | CSS selector to capture specific element |
| `full_page` | false | Capture full scrollable page |
| `wait_for` | — | CSS selector to wait for before capture |
| `delay` | auto | Extra ms to wait (2000 external, 500 localhost) |
| `save_as` | — | Save to reference library with this name |

## Examples

```
# Capture a local dev page
ibr screenshot with url: "http://localhost:3000/dashboard"

# Capture external design and save as reference
ibr screenshot with url: "https://mobbin.com/screens/...", save_as: "mobbin-login"

# Mobile viewport capture
ibr screenshot with url: "http://localhost:3000", viewport: "mobile"

# Capture specific element
ibr screenshot with url: "http://localhost:3000", selector: ".hero-section"
```

## After Capturing

- **Validate implementation**: Use `ibr scan` MCP tool for structured CSS/handler/a11y data
- **Save for later**: Add `save_as` parameter to store in reference library
- **List saved references**: Use `ibr references` MCP tool
- **View saved reference**: Use `ibr references` with `action: "show"` and `name`

## Screenshot vs Scan

| Need | Tool |
|------|------|
| See what a page looks like (image) | `ibr screenshot` |
| Exact CSS values, handlers, a11y audit | `ibr scan` |
| Visual regression baseline | `ibr snapshot` |
