---
description: Capture a baseline of a URL before making UI changes (for regression verification)
---

# /ibr:snapshot

Capture a baseline before making UI changes so you can verify nothing broke afterward.

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
4. Captures baseline screenshot and page state
5. Saves as baseline for comparison
6. Returns session ID (e.g., sess_abc123)

## Timing

Run this BEFORE making UI changes. The baseline captures the current state so you can compare against it after your changes.

## When to Use This vs Scan

| Goal | Command |
|------|---------|
| **Validate implementation matches user description** | `npx ibr scan <url> --json` (primary workflow) |
| **Check nothing broke after changes** | `npx ibr start` → changes → `npx ibr check` (this command) |

## Next Steps

After making UI changes, use `/ibr:compare` to check differences.
