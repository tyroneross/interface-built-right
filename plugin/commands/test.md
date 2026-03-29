---
name: ibr:test
description: Run a declarative .ibr-test.json test file against a live URL
---

# ibr:test

Execute a `.ibr-test.json` test file. IBR launches a browser, navigates to each page in the suite, and runs every test step — clicks, fills, asserts, screenshots — via the accessibility tree.

Exit code: `0` if all tests pass, `1` if any fail.

## Usage

```bash
# Run default .ibr-test.json
npx ibr test

# Run a specific file
npx ibr test --file tests/checkout.json

# JSON output for programmatic use
npx ibr test --json

# Custom results directory
npx ibr test --output-dir .ibr/my-results
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--file <path>` | Path to test file | `.ibr-test.json` |
| `--output-dir <dir>` | Screenshot + results directory | `.ibr/test-results` |
| `--json` | Output full results as JSON | false |

## Step Types

| Step | Behavior |
|------|----------|
| `{ click: "Label" }` | Find element by accessible name, click |
| `{ fill: { target, value } }` | Clear field and fill with value |
| `{ type: { target, value } }` | Type into field (appends) |
| `{ assert: { visible } }` | AX tree must contain element with this label |
| `{ assert: { hidden } }` | AX tree must NOT contain element with this label |
| `{ assert: { text } }` | Any element label/value must contain this text |
| `{ assert: { count } }` | Number of interactive elements must match |
| `{ screenshot: "name" }` | Save screenshot to output directory |
| `{ wait: 500 }` | Pause for 500ms |
| `{ wait: "Element" }` | Wait up to 10s for element to appear |

## Output

```
[PASS] http://localhost:3000  (2 tests, 2 passed, 0 failed, 1240ms)
  [PASS] smoke test (612ms)
  [PASS] login scenario (628ms)

Summary: 2 passed, 0 failed
```

## JSON Output Shape

```json
[
  {
    "url": "http://localhost:3000",
    "total": 2,
    "passed": 2,
    "failed": 0,
    "tests": [
      {
        "name": "smoke test",
        "passed": true,
        "steps": [
          { "step": "screenshot \"initial-state\"", "passed": true, "duration": 120, "screenshot": ".ibr/test-results/initial-state.png" }
        ],
        "duration": 612
      }
    ],
    "duration": 1240
  }
]
```

## Workflow

```bash
# Generate a test file first
npx ibr generate-test http://localhost:3000

# Run tests
npx ibr test

# Fix failures, re-run
npx ibr test --json | jq '[.[] | select(.failed > 0)]'
```
