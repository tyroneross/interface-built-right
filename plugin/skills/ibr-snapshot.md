---
description: Capture a baseline screenshot before making UI changes
---

# /ibr-snapshot

Capture a baseline screenshot before making UI changes.

## Instructions

When this command is invoked, ask the user for the URL they want to capture:

**Ask the user:**
"What URL would you like to capture? (e.g., http://localhost:3000/dashboard)"

Once the user provides the URL, run:

```bash
cd ${CLAUDE_PLUGIN_ROOT}/.. && npm run snapshot -- "<user-provided-url>"
```

Optionally ask if they want to name this session for easier reference.

## What This Does

1. Launches headless browser (Playwright)
2. Navigates to the URL
3. Waits for network idle
4. Captures full-page screenshot
5. Saves as baseline for comparison
6. Returns session ID

After making UI changes, use `/ibr-compare` to check differences.
