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
```

## Options

| Option | Description |
|--------|-------------|
| `--query <q>` | Search query to type and submit (default: "test") |
| `--expect-count <n>` | Assert that at least N results are returned |
| `--results-selector <css>` | CSS selector for result elements |
| `--json` | Output as JSON |

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
