---
name: ibr:compare-browsers
description: Scan a URL in both Chrome and Safari, then diff screenshots and element counts to surface cross-browser divergence
arguments:
  - name: url
    description: URL to compare across browsers (or leave blank for localhost detection)
    required: false
---

# IBR Cross-Browser Comparison

Run the same page through Chrome (CDP) and Safari (safaridriver) and diff the results:
- Pixel-level visual diff between the two screenshots
- Element count comparison (interactive elements via AX tree)
- Elements present in one browser but missing in the other

## Prerequisites

Safari requires a one-time setup (needs admin):

```bash
sudo safaridriver --enable
```

## How to Run

```bash
# Compare Chrome vs Safari for a URL
npx ibr compare-browsers http://localhost:3000

# Save the pixel diff image
npx ibr compare-browsers http://localhost:3000 --save-diff .ibr/browser-diff.png

# JSON output for programmatic use
npx ibr compare-browsers http://localhost:3000 --json

# Use a specific viewport
npx ibr --viewport mobile compare-browsers http://localhost:3000
```

## What It Checks

| Check | How |
|-------|-----|
| Visual diff | pixelmatch on both screenshots |
| Element coverage | Interactive elements via AX tree (Chrome: CDP, Safari: macOS AX API) |
| Missing elements | Labels present in Chrome but absent in Safari, and vice versa |

## Reading the Results

```
Chrome: 24 elements
Safari: 21 elements
Visual diff: 3.2% (8450 pixels)
Only in Chrome: submit button, dropdown menu
Only in Safari: (none)
```

- **Visual diff > 5%** — likely rendering differences worth investigating
- **Elements only in Chrome** — elements with AX labels Chrome exposes but Safari doesn't
- **Elements only in Safari** — often native browser UI elements (address bar, etc.)

## Use Cases

### Verify cross-browser consistency during development

```bash
# After implementing a component
npx ibr compare-browsers http://localhost:3000/components/button

# Save diff for review
npx ibr compare-browsers http://localhost:3000 --save-diff .ibr/diff-$(date +%Y%m%d).png
```

### CI cross-browser gate

```bash
npx ibr compare-browsers $STAGING_URL --json | jq '.diff.diffPercent < 5'
```

## Notes

- Safari always runs in visible mode (no headless support)
- If safaridriver is not enabled, Safari scan is skipped and only Chrome results are shown
- Element comparison uses AX labels; elements without labels are not compared
- Pixel diff uses a 0.1 threshold (anti-aliasing tolerance)
