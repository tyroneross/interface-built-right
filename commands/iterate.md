---
name: ibr:iterate
description: Run one iteration of a test-fix loop and detect convergence (stagnant, oscillating, regressing)
arguments:
  - name: url
    description: URL to scan or test
    required: true
---

# ibr:iterate

Run one iteration of a test-fix loop. Tracks convergence across iterations using SHA-256 hashing of the issue fingerprint set. Detects stagnant, oscillating, and regressing conditions so fix attempts don't spin indefinitely.

**Claude Code makes the actual code changes between iterations.** This command runs one iteration and reports state. Call it repeatedly in a loop or as part of an iterative fix workflow.

## Usage

```bash
# Single iteration using IBR scan
npx ibr iterate http://localhost:3000

# Use a declarative test file instead of scan
npx ibr iterate http://localhost:3000 --test .ibr-test.json

# Cap at 7 iterations
npx ibr iterate http://localhost:3000 --max-iterations 7

# Skip user approval at checkpoint iterations
npx ibr iterate http://localhost:3000 --auto-approve

# JSON output
npx ibr iterate http://localhost:3000 --json

# Reset state and start fresh
npx ibr iterate http://localhost:3000 --reset
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--test <path>` | .ibr-test.json to run (omit to use IBR scan) | none |
| `--max-iterations <n>` | Stop after N iterations | `7` |
| `--output-dir <dir>` | State and results directory | `.ibr/iterate` |
| `--auto-approve` | Skip checkpoint pauses | false |
| `--reset` | Clear iteration state | false |
| `--json` | Output result as JSON | false |

## Convergence Conditions

| State | Meaning | Action |
|-------|---------|--------|
| `resolved` | Zero issues remaining | Done — success |
| `stagnant` | Same issue hash 2 consecutive iterations | Try a different approach |
| `oscillating` | Hash matches 2 iterations ago (A→B→A) | Manual investigation needed |
| `regressing` | Issue count increased 2 consecutive iterations | Revert last change |
| `budget_exceeded` | Reached max iterations | Review remaining issues |

## Checkpoint Iterations

At iterations 3, 7, 15, and 20 (unless `--auto-approve`), the loop pauses and returns current state for user review. The user can then decide whether to continue, change approach, or stop.

## Workflow

Claude Code uses this in a fix-and-iterate loop:

```bash
# 1. Generate test file
npx ibr generate-test http://localhost:3000

# 2. Run first iteration
npx ibr iterate http://localhost:3000 --test .ibr-test.json

# Claude Code fixes failing tests...

# 3. Run next iteration
npx ibr iterate http://localhost:3000 --test .ibr-test.json

# 4. Continue until resolved or budget exceeded
# Use --json to read convergence state programmatically
npx ibr iterate http://localhost:3000 --test .ibr-test.json --json
```

## State Persistence

State is stored in `.ibr/iterate/iterate-state.json`. Each entry records:
- `iteration` — sequence number
- `scanHash` — SHA-256 fingerprint of current issues
- `issueCount` — number of failing tests or scan issues
- `netDelta` — issues resolved minus issues introduced
- `approachHint` — human-readable summary of what was checked

## JSON Output Shape

```json
{
  "iterations": [
    {
      "iteration": 1,
      "scanHash": "a3f2c9d1...",
      "issueCount": 5,
      "netDelta": 0,
      "approachHint": "verdict=ISSUES issues=5",
      "durationMs": 3200,
      "converged": false
    }
  ],
  "finalState": "budget_exceeded",
  "summary": "Reached 1 iteration(s). 5 issue(s) remaining."
}
```
