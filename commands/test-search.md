---
name: ibr:test-search
description: Test search functionality on a page using the IBR search flow
arguments:
  - name: url
    description: URL to test (or leave blank for localhost detection)
    required: false
---

# IBR Test Search

Test search functionality on a live page. Finds the search input, types a query, submits it, and reports back the number of results found.

For semantic or AI search, prefer `npx ibr search-test` or MCP `flow_search` with `aiValidation: true`. Those paths capture step screenshots, extract result content, and return validation context for relevance review.

## Usage

```bash
# Basic search test
npx ibr test-search http://localhost:3000 --query "product name"

# Assert minimum result count
npx ibr test-search http://localhost:3000 --query "shirt" --expect-count 5

# Custom results selector
npx ibr test-search http://localhost:3000 --query "test" --results-selector ".product-card"

# JSON output for programmatic use
npx ibr test-search http://localhost:3000 --query "test" --json

# Semantic/AI search validation with screenshots and extracted result content
npx ibr search-test http://localhost:3000 --query "pricing plan" --intent "Find the plan page a buyer would choose"
```

## Options

| Option | Description |
|--------|-------------|
| `--query <q>` | Search query to type and submit (default: "test") |
| `--expect-count <n>` | Assert that at least N results are returned |
| `--results-selector <css>` | CSS selector for result elements |
| `--json` | Output as JSON |

## MCP Current-Screen Flow

When an agent already has a browser session open:

```json
{
  "sessionId": "<session id>",
  "query": "pricing plan",
  "userIntent": "Find the plan page a buyer would choose",
  "aiValidation": true
}
```

This keeps the query test anchored to the current screen instead of launching a separate page.

## What It Tests

1. Finds search input (by label, name attribute, placeholder, or role)
2. Types the query and submits (Enter key)
3. Waits for results to load
4. Counts result elements matching the selector
5. Reports success/failure with result count

## Exit Codes

- `0` — Search completed and results were found
- `1` — Search failed (no input found, no results, or error)

## Example Output

```
Status: SUCCESS
Results found: 12
Has results: true
Duration: 1843ms
```
