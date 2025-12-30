---
description: Compare current page state against baseline screenshot
---

# /ibr-compare

Compare the current state of a page against its baseline screenshot.

## Instructions

When this command is invoked:

1. First, list available sessions:
```bash
cd ${CLAUDE_PLUGIN_ROOT}/.. && npm run sessions
```

2. If there are multiple sessions, ask the user which one to compare:
   "Which session would you like to compare? (Enter session ID or press Enter for most recent)"

3. Run the comparison:
```bash
cd ${CLAUDE_PLUGIN_ROOT}/.. && npm run compare -- <session-id> --format json
```

If no sessions exist, prompt the user to capture a snapshot first with `/ibr-snapshot`.

## What This Does

1. Retrieves the session (or most recent)
2. Captures new screenshot of the URL
3. Compares against baseline using pixelmatch
4. Generates diff image
5. Returns comparison report

## Verdicts

- `MATCH` - No visual changes
- `EXPECTED_CHANGE` - Changes detected, appear intentional
- `UNEXPECTED_CHANGE` - Changes in unexpected areas
- `LAYOUT_BROKEN` - Significant structural issues

Use `/ibr-ui` to view the visual diff in the browser.
