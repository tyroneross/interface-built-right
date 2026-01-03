---
description: Compare current page state against baseline screenshot and show visual diff
---

# /ibr:compare

Compare the current state of a page against its baseline screenshot.

## Instructions

1. First, list available sessions:
```bash
npx ibr list
```

2. If multiple sessions exist, ask the user: **"Which session would you like to compare?"** (show session IDs)

3. Run the comparison (uses most recent session if no ID specified):
```bash
npx ibr check
```

Or with specific session:
```bash
npx ibr check <session-id> --format json
```

If no sessions exist, inform the user to capture a snapshot first with `/ibr:snapshot`.

## Timing

Run this AFTER making UI changes. Do NOT run immediately after capturing a baseline - you need to make code changes first, otherwise you're comparing identical states and will always get MATCH.

## What This Does

1. Retrieves the session
2. Captures new screenshot of the URL
3. Compares against baseline using pixelmatch
4. Generates diff image highlighting changes
5. Returns comparison report with verdict

## Verdicts

- **MATCH** - No visual changes detected
- **EXPECTED_CHANGE** - Changes detected, appear intentional
- **UNEXPECTED_CHANGE** - Changes in unexpected areas (needs review)
- **LAYOUT_BROKEN** - Significant structural issues detected (>50% diff)

## Next Steps

Use `/ibr:ui` to view the visual diff in the browser.
