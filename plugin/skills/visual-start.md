---
name: visual-start
description: Start a visual regression session by capturing a baseline screenshot before making UI changes. Use this before modifying any frontend code.
arguments:
  - name: url
    description: The URL to capture (e.g., http://localhost:3000/dashboard or just /dashboard if base URL is configured)
    required: true
  - name: name
    description: Optional name for this session (defaults to path-based name)
    required: false
---

# Visual Start

Capture a baseline screenshot before making UI changes.

## Usage

```
/visual-start <url> [--name <session-name>]
```

## Examples

```
/visual-start http://localhost:3000/dashboard
/visual-start /dashboard --name header-update
/visual-start https://myapp.com/settings
```

## What This Does

1. Launches a headless browser (Chromium via Playwright)
2. Navigates to the specified URL
3. Waits for network activity to settle
4. Captures a full-page screenshot
5. Saves it as the baseline for comparison
6. Returns a session ID for later reference

## After Running This

After making UI changes, use `/visual-check` to compare the new state against this baseline.

## Implementation

```bash
npx ibr start "${ARGUMENTS.url}" ${ARGUMENTS.name ? `--name "${ARGUMENTS.name}"` : ''}
```

The command outputs:
- Session ID (e.g., `sess_abc123`)
- Path to baseline screenshot
- URL that was captured

Store the session ID to use with `/visual-check` later.
