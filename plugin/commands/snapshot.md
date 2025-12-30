---
description: Capture a baseline screenshot of a URL before making UI changes
---

# /ibr-snapshot

Capture a baseline screenshot before making UI changes.

## Instructions

1. Ask the user: **"What URL would you like to capture?"** (e.g., http://localhost:3000/dashboard)

2. Once the user provides the URL, run:
```bash
cd ${CLAUDE_PLUGIN_ROOT}/.. && npm run snapshot -- "<url>"
```

3. Optionally ask if they want to name this session:
```bash
cd ${CLAUDE_PLUGIN_ROOT}/.. && npm run snapshot -- "<url>" --name "<session-name>"
```

## What This Does

1. Launches headless browser (Playwright)
2. Navigates to the URL
3. Waits for network idle
4. Captures full-page screenshot
5. Saves as baseline for comparison
6. Returns session ID (e.g., sess_abc123)

## Next Steps

After making UI changes, use `/ibr-compare` to check differences.
