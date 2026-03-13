---
description: Start an IBR iterative refinement loop — repeatedly scan, fix, and verify until criteria pass
allowed_tools: Bash, Read, Write, Edit, Glob, Grep, mcp__ibr__scan, mcp__ibr__snapshot, mcp__ibr__compare, mcp__ibr__screenshot
---

# /ibr:iterate

Start an automated scan-fix-verify loop that keeps running until IBR validation criteria are met.

## Instructions

1. Parse the user's message for:
   - **URL** (required) — must be a localhost or 127.0.0.1 URL
   - **Task prompt** (required) — what to build or fix
   - **--max N** (optional) — max iterations, default 20, range 1-100
   - **--criteria TYPE** (optional) — success criteria, default `scan_pass`

2. Run the setup script:
```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/setup-ibr-loop.sh" <url> [--max N] [--criteria TYPE] <prompt words...>
```

3. If setup succeeds, immediately begin working on the task:
   - Build or modify the UI as described in the prompt
   - Run `ibr scan` on the URL to check progress
   - Fix issues found by the scan
   - When you believe the task is complete, stop — the Stop hook will check criteria and either allow exit or re-feed the prompt

4. If setup fails (non-localhost URL, missing prompt), relay the error to the user.

## Criteria Types

| Type | Passes when | Best for |
|------|-------------|----------|
| `scan_pass` | IBR scan verdict is PASS | General UI tasks |
| `zero_issues` | IBR scan shows Issues (0) | Accessibility hardening |
| `compare_match` | IBR compare shows MATCH or EXPECTED_CHANGE | Targeted changes |
| `custom` | Assistant outputs `<ibr-done/>` tag | Multi-page or subjective goals |

## How the Loop Works

A Stop hook intercepts session exit. After each attempt:
- **Criteria met** — loop ends, exit allowed
- **Max iterations reached** — loop ends with summary
- **Pause point (2, 5, 10, 20)** — progress report, user decides continue/stop
- **Otherwise** — prompt re-fed, next iteration begins

State is tracked in `.ibr/loop-state.json`. Each iteration records verdict, issue count, and timestamp.

## Examples

```
/ibr:iterate http://localhost:3000 Build a login form with email and password fields
/ibr:iterate http://localhost:5173/dashboard --criteria zero_issues Fix all accessibility issues
/ibr:iterate http://localhost:3000 --max 10 --criteria compare_match Refactor the header without visual regressions
```

## Canceling

Use `/ibr:cancel-iterate` to stop the loop at any time.
