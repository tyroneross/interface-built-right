---
description: Capture a baseline screenshot of a URL before making UI changes
---

# /ibr:snapshot

Capture a baseline screenshot before making UI changes.

## Instructions

1. Ask the user: **"What URL would you like to capture?"** (e.g., http://localhost:5000/dashboard)

2. Once the user provides the URL, run:
```bash
npx ibr start "<url>"
```

3. Optionally add a session name for easier reference:
```bash
npx ibr start "<url>" --name "<session-name>"
```

4. To capture a specific component instead of full page:
```bash
npx ibr start "<url>" --selector ".header"
```

## What This Does

1. Launches headless browser (Playwright)
2. Navigates to the URL
3. Waits for network idle
4. Captures full-page screenshot (or element if --selector used)
5. Saves as baseline for comparison
6. Returns session ID (e.g., sess_abc123)

## Timing

Run this BEFORE making any UI changes. The baseline captures the current state so you can compare against it after your changes.

## Next Steps

After making UI changes, use `/ibr:compare` to check differences.
