---
description: Capture external design references — screenshot a URL, extract full HTML/CSS, or crawl a sitemap. Unified entry point wrapping existing IBR primitives.
argument-hint: <url> [--mode=screenshot|extract|crawl] [--depth=1] [--max=10]
---

# /ibr:capture

Capture a design reference from an external site and save to the current build's reference set.

## Modes

### screenshot (default)

Calls the `ibr screenshot` MCP tool. Saves to `.ibr/references/<slug>.png`.

### extract

Calls IBR's URL extraction (`src/extract.ts → extractInteractiveElements`). Writes:
- `.ibr/references/<slug>.png`
- `.ibr/references/<slug>.html`
- `.ibr/references/<slug>.json` (elements + computed styles + CSS variables)

### crawl

Calls `src/crawl.ts → discoverPages` with `maxPages` from `--max` (default 10). For each discovered page, captures a screenshot. Writes to `.ibr/references/<slug>/pages/<n>.png` and a `manifest.json` listing pages.

## Side effects

- Appends to `.ibr/builds/<currentTopic>/refs.json` if invoked during an active build
- Otherwise writes to `.ibr/references/` (global reference library)

## Usage examples

```
/ibr:capture https://mobbin.com/apps/something --mode=screenshot
/ibr:capture https://linear.app --mode=extract
/ibr:capture https://stripe.com --mode=crawl --max=8
```

## Errors

- Site blocks headless: report error, ask user to upload an image to IBR's reference session
- Timeout: suggest `--delay` increase or `--wait-for` selector
- Crawl cap hit: list skipped URLs in manifest
