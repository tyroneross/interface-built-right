---
name: visual-check
description: Compare the current state of a page against its baseline screenshot. Use this after making UI changes to verify they look correct.
arguments:
  - name: sessionId
    description: Optional session ID to check (defaults to most recent session)
    required: false
  - name: format
    description: Output format - json, text, or minimal
    required: false
    default: json
---

# Visual Check

Compare the current state of a page against its baseline screenshot.

## Usage

```
/visual-check [sessionId] [--format json|text|minimal]
```

## Examples

```
/visual-check
/visual-check sess_abc123
/visual-check --format text
```

## What This Does

1. Retrieves the session (or uses most recent if not specified)
2. Navigates to the session's URL
3. Captures a new screenshot
4. Compares it against the baseline using pixelmatch
5. Generates a diff image highlighting changes
6. Returns a structured comparison report

## Report Format (JSON)

```json
{
  "sessionId": "sess_abc123",
  "comparison": {
    "match": false,
    "diffPercent": 8.2,
    "diffPixels": 6560,
    "threshold": 1.0
  },
  "analysis": {
    "verdict": "EXPECTED_CHANGE",
    "summary": "Header background changed. Layout intact.",
    "unexpectedChanges": []
  }
}
```

## Verdicts

- `MATCH` - No visual changes (screenshots identical)
- `EXPECTED_CHANGE` - Changes detected, appear intentional
- `UNEXPECTED_CHANGE` - Changes in unexpected areas (needs review)
- `LAYOUT_BROKEN` - Significant structural issues detected

## How to Interpret Results

- **MATCH**: No action needed. Screenshots are identical.
- **EXPECTED_CHANGE with low diffPercent (<10%)**: Changes look intentional. Proceed.
- **EXPECTED_CHANGE with high diffPercent (>10%)**: Review the changes are all intended.
- **UNEXPECTED_CHANGE**: Something changed that wasn't expected. Investigate.
- **LAYOUT_BROKEN**: Major issues. Check for JavaScript errors, missing assets.

## Implementation

```bash
npx ibr check ${ARGUMENTS.sessionId || ''} --format ${ARGUMENTS.format || 'json'}
```

Parse the JSON output to determine next steps.
