---
description: Compare current page state against baseline screenshot and show visual diff
---

# /ibr-compare

Compare the current state of a page against its baseline screenshot.

## Instructions

1. First, list available sessions:
```bash
cd ${CLAUDE_PLUGIN_ROOT}/.. && npm run sessions
```

2. If multiple sessions exist, ask the user: **"Which session would you like to compare?"** (show session IDs)

3. Run the comparison:
```bash
cd ${CLAUDE_PLUGIN_ROOT}/.. && npm run compare -- <session-id> --format json
```

If no sessions exist, inform the user to capture a snapshot first with `/ibr-snapshot`.

## What This Does

1. Retrieves the session
2. Captures new screenshot of the URL
3. Compares against baseline using pixelmatch
4. Generates diff image
5. Returns comparison report

## Verdicts

- **MATCH** - No visual changes detected
- **EXPECTED_CHANGE** - Changes detected, appear intentional
- **UNEXPECTED_CHANGE** - Changes in unexpected areas (needs review)
- **LAYOUT_BROKEN** - Significant structural issues detected

## Next Steps

Use `/ibr-ui` to view the visual diff in the browser.
