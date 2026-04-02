---
name: ibr:record-change
description: Record a structured design change specification for later verification
arguments:
  - name: url
    description: URL of the page where the change was made (or leave blank for localhost detection)
    required: false
---

# IBR Record Design Change

Record a structured design change specification so IBR can verify it against the live page later.

Write-time capture (~95% accuracy) is preferred over NLP parsing (~60-85%). Provide explicit checks with known CSS property values rather than relying on description parsing.

## When to Use

- After making a visual or structural UI change and you want to record verifiable expectations
- When you want CI/CD to catch regressions on specific UI properties
- When coordinating cross-platform implementation (web + iOS + macOS) against a shared spec

## How to Run

```bash
# Record a change with explicit checks
npx ibr record-change http://localhost:3000 \
  --element "header" \
  --description "Dark card with rounded corners" \
  --checks '[{"property":"borderRadius","operator":"eq","value":"8px","confidence":1.0},{"property":"backgroundColor","operator":"contains","value":"rgb(30","confidence":0.9}]'

# Record existence check (element must appear in AX tree)
npx ibr record-change http://localhost:3000/dashboard \
  --element "Dashboard" \
  --description "Dashboard heading present" \
  --checks '[{"property":"exists","operator":"exists","value":"true","confidence":1.0}]'

# Record with CSS selector
npx ibr record-change http://localhost:3000 \
  --element ".hero-title" \
  --description "Hero title 48px bold" \
  --checks '[{"property":"fontSize","operator":"eq","value":"48px","confidence":1.0},{"property":"fontWeight","operator":"gte","value":"700","confidence":1.0}]'

# Record for a specific platform
npx ibr record-change http://localhost:3000 \
  --element "Submit" \
  --description "Submit button blue" \
  --checks '[{"property":"backgroundColor","operator":"contains","value":"blue","confidence":0.7}]' \
  --platform web
```

## Options

| Option | Description |
|--------|-------------|
| `--element <name>` | Accessible name or CSS selector of the target element (required) |
| `--description <text>` | Human-readable description of the change (required) |
| `--checks <json>` | JSON array of check objects (see format below) |
| `--platform <web\|ios\|macos>` | Target platform (default: web) |

## Check Object Format

```json
{
  "property": "backgroundColor",
  "operator": "eq | gt | lt | contains | not | exists | truthy",
  "value": "rgb(30, 30, 30)",
  "confidence": 1.0
}
```

| Operator | Meaning |
|----------|---------|
| `eq` | Exact equality |
| `gt` | Numeric greater-than |
| `lt` | Numeric less-than |
| `contains` | Substring or token match |
| `not` | Not equal |
| `exists` | Element is present in AX tree |
| `truthy` | Value is non-empty / non-zero |

**Confidence guidance:**
- `1.0` — You specified the exact CSS value (e.g. `borderRadius: "8px"`)
- `0.7-0.9` — You know the general value but not the exact computed form
- `0.5-0.7` — Approximate or derived from description

## Storage

Changes are appended to `.ibr/design-changes.json`. Each change has a timestamp and source.

## Next Step

After recording changes, verify them:

```bash
npx ibr verify-changes http://localhost:3000
```
