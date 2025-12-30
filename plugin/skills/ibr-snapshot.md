---
description: Capture a baseline screenshot before making UI changes
arguments:
  - name: url
    description: The URL to capture (e.g., http://localhost:3000/dashboard)
    required: true
  - name: name
    description: Optional name for this session
    required: false
---

# /ibr-snapshot

Capture a baseline screenshot before making UI changes.

## Usage

```
/ibr-snapshot <url> [--name <session-name>]
```

## Examples

```
/ibr-snapshot http://localhost:3000/dashboard
/ibr-snapshot http://localhost:3000/settings --name settings-redesign
```

## What This Does

1. Launches headless browser (Playwright)
2. Navigates to the URL
3. Waits for network idle
4. Captures full-page screenshot
5. Saves as baseline for comparison
6. Returns session ID

## Implementation

```bash
cd ${CLAUDE_PLUGIN_ROOT}/.. && npm run snapshot -- "${url}" ${name ? `--name "${name}"` : ''}
```

After making UI changes, use `/ibr-compare` to check differences.
