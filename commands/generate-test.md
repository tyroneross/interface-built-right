---
name: ibr:generate-test
description: Generate a declarative .ibr-test.json test file by observing interactive elements on a page
arguments:
  - name: url
    description: URL to observe (e.g. http://localhost:3000)
    required: true
---

# ibr:generate-test

Generate a declarative `.ibr-test.json` test file from live page observation. IBR launches a browser, discovers all interactive elements via the accessibility tree, and produces a ready-to-run test suite.

## How It Works

1. IBR navigates to the URL
2. `discover({ filter: 'interactive' })` extracts all actionable elements
3. Without `--scenario`: generates a smoke test covering every interactive element
4. With `--scenario`: matches scenario keywords against element labels to produce a targeted test

The output file is valid `.ibr-test.json` that can be run immediately with `npx ibr test`.

## Usage

```bash
# Smoke test — touch every interactive element
npx ibr generate-test http://localhost:3000

# Targeted scenario test
npx ibr generate-test http://localhost:3000 --scenario "search for products"

# Custom output path
npx ibr generate-test http://localhost:3000 --output tests/home.json

# Form scenario
npx ibr generate-test http://localhost:3000/login --scenario "login with email and password"
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--scenario <text>` | Natural language scenario | none (smoke test) |
| `--output <path>` | Output file path | `.ibr-test.json` |

## Output Format

```json
{
  "home": {
    "url": "http://localhost:3000",
    "tests": [
      {
        "name": "smoke test",
        "steps": [
          { "screenshot": "initial-state" },
          { "fill": { "target": "Search", "value": "test query" } },
          { "click": "Submit" },
          { "wait": 500 },
          { "assert": { "visible": "results" } }
        ]
      }
    ]
  }
}
```

## Step Types

| Step | Description |
|------|-------------|
| `{ click: "Button Label" }` | Click element by accessible name |
| `{ fill: { target, value } }` | Fill input field |
| `{ type: { target, value } }` | Type into input (append, no clear) |
| `{ assert: { visible?, hidden?, text?, count? } }` | AX tree assertion |
| `{ screenshot: "name" }` | Save screenshot |
| `{ wait: 500 }` | Wait N milliseconds |
| `{ wait: "Element Name" }` | Wait for element to appear |

## Workflow

```bash
# 1. Generate test
npx ibr generate-test http://localhost:3000

# 2. Review and edit .ibr-test.json as needed

# 3. Run the test
npx ibr test

# 4. Re-generate if the UI changes
npx ibr generate-test http://localhost:3000 --output .ibr-test.json
```
