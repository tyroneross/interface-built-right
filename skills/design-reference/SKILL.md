---
name: design-reference
description: This skill should be used when the user asks to "screenshot this page", "capture this design", "use this as reference", "look at this UI", "show me this page", "save this design", shares a design URL (Mobbin, Dribbble, Figma screenshots, Behance, Awwwards, or any design site), or when visual inspection of a web page is needed to guide UI implementation.
version: 0.1.0
user-invocable: false
---

# Design Reference Capture with IBR

Capture screenshots of any web page — local or external — and return the image directly for visual inspection. Save captured designs to a persistent reference library for later retrieval. Complements the `design-validation` skill which returns structured data; this skill returns actual images.

## When to Activate

- User shares a URL from a design site (Mobbin, Dribbble, Behance, Awwwards, Figma screenshots)
- User says "screenshot this", "capture this design", "use this as reference", "show me this page"
- Visual inspection of a page is needed to guide implementation
- User wants to save a design for later reference
- Replicating an external UI requires seeing the target design

## Primary Workflow: Capture & View

Call the `ibr screenshot` MCP tool to navigate to any URL and return the captured image.

**Input:** `url` (required), plus optional `viewport`, `selector`, `full_page`, `wait_for`, `delay`, `save_as`

**Returns:** Base64 image content block (visible in context) + metadata text

### Basic capture

Call `ibr screenshot` with just the URL. The returned image enables describing visual patterns, identifying UI components, extracting design details, and guiding implementation decisions.

### External site tips

External sites (Mobbin, Dribbble, etc.) are JS-heavy. The tool auto-applies a 2000ms delay for non-localhost URLs. For sites needing more time:

- Increase `delay` (e.g., `delay: 5000` for slow-loading galleries)
- Set `wait_for` to a CSS selector for specific content (e.g., `wait_for: ".design-image"`)
- Set `selector` to capture just the design element, excluding page chrome

### Viewport options

- `desktop` (default): 1920x1080 — full desktop view
- `mobile`: 375x667 — mobile design patterns
- `tablet`: 768x1024 — tablet layouts

### Element capture

To capture a specific component rather than the full page, pass a `selector`:

```
selector: ".card-component"
selector: "#hero-section"
selector: "[data-design-id='abc123']"
```

## Saving to Reference Library

To persist a captured design for later retrieval, include `save_as` with a descriptive name:

```
save_as: "mobbin-login-screen"
save_as: "dribbble-dashboard-card"
save_as: "competitor-pricing-page"
```

References are stored in `.ibr/references/` with an `index.json` manifest tracking name, URL, viewport, capture date, and file size.

## Managing References

Call the `ibr references` MCP tool to manage saved designs.

### List all references

Call with `action: "list"` (or no arguments — list is the default). Returns a text summary of all saved references with metadata.

### Show a reference image

Call with `action: "show"` and `name: "reference-name"`. Returns the image as a base64 content block — useful when implementing a design captured in a previous session.

### Delete a reference

Call with `action: "delete"` and `name: "reference-name"`. Removes both the PNG file and the index entry.

## Decision Tree: Which IBR Tool to Use

| Need | Tool | Returns |
|------|------|---------|
| See what a page looks like | `ibr screenshot` | Image (visible in context) |
| Exact CSS values, handlers, a11y | `ibr scan` | Structured text data |
| Save a design for later | `ibr screenshot` with `save_as` | Image + saves to library |
| Retrieve a saved design | `ibr references` with `show` | Image from library |
| Visual regression baseline | `ibr snapshot` | Session-managed baseline |
| Compare after changes | `ibr compare` | Diff verdict + regions |

### Screenshot vs scan

- **Screenshot** — see the page: design inspiration, visual bugs, canvas/SVG content, external reference sites
- **Scan** — validate the page: check CSS values, handler wiring, accessibility attributes, console errors

Both tools complement each other. Capture a screenshot for visual context, then scan for precise validation.

## Workflow: Replicate an External Design

1. Capture the target design: call `ibr screenshot` with `save_as`
2. Implement the UI based on the captured reference image
3. Validate the implementation: call `ibr scan` to check CSS, handlers, a11y
4. Compare visually: call `ibr screenshot` on the local implementation
5. Iterate until the implementation matches the reference

## Workflow: Design Review

1. Capture the current state: call `ibr screenshot` on the live page
2. Inspect the image and identify issues
3. Fix issues in code
4. Re-capture to verify visual changes
5. Optionally save as reference: `save_as: "approved-state"`

*ibr — design validation*
