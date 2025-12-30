---
description: Compare current page state against baseline screenshot
arguments:
  - name: sessionId
    description: Session ID to check (defaults to most recent)
    required: false
---

# /ibr-compare

Compare the current state of a page against its baseline screenshot.

## Usage

```
/ibr-compare [sessionId]
```

## Examples

```
/ibr-compare
/ibr-compare sess_abc123
```

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

## Implementation

```bash
cd ${CLAUDE_PLUGIN_ROOT}/.. && npm run compare -- ${sessionId || ''} --format json
```

Use `/ibr-ui` to view the visual diff in the browser.
