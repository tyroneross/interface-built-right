---
name: iterative-refinement
description: This skill should be used when an IBR iterative refinement loop is active (.ibr/loop-state.json exists with active=true), when the Stop hook re-feeds a prompt with iteration context, or when the user asks to "iterate until it passes", "keep fixing until scan is clean", "refine this UI".
version: 0.1.0
user-invocable: false
---

# IBR Iterative Refinement

Guide the scan-fix-verify cycle inside an IBR iterative refinement loop. Each iteration must make measurable progress toward the success criteria defined in `.ibr/loop-state.json`.

## When to Activate

- The `/ibr:iterate` command initializes a loop and begins the first iteration
- The Stop hook re-feeds the prompt with iteration context (contains "IBR iterative refinement — iteration")
- `.ibr/loop-state.json` exists with `active: true` and work is in progress

## Iteration Cycle

### 1. Read State

Read `.ibr/loop-state.json` at the start of each iteration. Extract:

- `iteration` — current iteration number
- `max_iterations` — hard cap
- `url` — target URL to scan
- `criteria.type` — what constitutes success
- `prompt` — the original task description
- `history` — array of previous iteration results

### 2. Review History

Check the `history` array for patterns:

- **Repeated identical verdicts** — the same fix is being attempted. Change approach.
- **Issue count not decreasing** — current strategy is ineffective. Try a different angle.
- **Oscillating verdicts** — one fix breaks another. Address root cause, not symptoms.
- **First iteration (no history)** — proceed normally with the task.

### 3. Work on the Task

Implement changes based on the `prompt` and any feedback from previous iterations. Prioritize:

- Fixes that address the most scan issues at once
- Changes that are unlikely to introduce new issues
- Root cause fixes over symptom patches

### 4. Scan and Verify

Run `ibr scan` on the target URL after making changes. Read the scan output carefully:

- **For `scan_pass` criteria**: Look for `Verdict: PASS`. Any other verdict means more work needed.
- **For `zero_issues` criteria**: Look for `Issues (0)`. Any issue count above zero means more work needed.
- **For `compare_match` criteria**: Run `ibr compare` instead. Look for `Verdict: MATCH` or `EXPECTED_CHANGE`.
- **For `custom` criteria**: When the task is subjectively complete, output `<ibr-done/>` in the response.

### 5. Exit Attempt

After scanning, stop working. The Stop hook handles the decision:

- Criteria met → exit allowed, loop ends
- Criteria not met → prompt re-fed with iteration context, cycle repeats
- Pause point reached → progress report requested, user decides

Do not manually check loop state to decide whether to continue. The hook manages flow control.

## Strategy by Iteration Count

### Iterations 1-2: Direct Implementation

Build or fix the requested UI. Run scan. Standard development workflow.

### Iterations 3-5: Targeted Fixes

Previous attempts have not fully resolved issues. Focus on specific scan findings. Read the scan output line by line and address each issue individually.

### Iterations 6-10: Root Cause Analysis

Multiple iterations without success indicates a systemic issue. Step back and consider:

- Are there conflicting CSS rules?
- Is a framework or library overriding styles?
- Are event handlers not wiring correctly?
- Is the page structure fundamentally wrong for the requirements?

### Iterations 11+: Minimal Viable Fix

At this point, focus on the minimum changes to satisfy the criteria. Avoid refactoring or restructuring. Make the smallest possible change for each remaining issue.

## Pause Point Behavior

At iterations 2, 5, 10, and 20, the hook pauses the loop and asks for a progress report. When this happens:

1. Read `.ibr/loop-state.json` to get the full history
2. Summarize what was attempted and what changed across iterations
3. Report the current verdict and remaining issues
4. Ask the user whether to continue or stop

Do not resume working until the user responds. The hook checks the user's response for continue/stop intent.

## Anti-Patterns

- **Repeating the same fix** — if a change did not work last iteration, it will not work this iteration. Check history and try a different approach.
- **Ignoring scan output** — the scan is the source of truth. Read it fully, do not skim.
- **Making too many changes at once** — large changes make it hard to isolate what helped and what hurt. Prefer focused, incremental changes.
- **Not scanning after changes** — every iteration must end with a scan. The hook needs scan output in the transcript to check criteria.
- **Working after criteria are met** — if the scan shows the criteria are satisfied, stop immediately. Additional changes risk breaking what works.

## State File Reference

```json
{
  "active": true,
  "iteration": 3,
  "max_iterations": 20,
  "url": "http://localhost:3000",
  "criteria": { "type": "scan_pass" },
  "pause_points": [2, 5, 10, 20],
  "paused": false,
  "started_at": "2026-03-11T...",
  "prompt": "Build a login form with validation",
  "history": [
    { "iteration": 1, "verdict": "FAIL", "issues": "5", "timestamp": "...", "criteria_met": false },
    { "iteration": 2, "verdict": "ISSUES", "issues": "2", "timestamp": "...", "criteria_met": false }
  ]
}
```

*ibr — design validation*
