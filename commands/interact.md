---
name: ibr:interact
description: Perform one semantic interaction on a live page by accessible name
arguments:
  - name: url
    description: URL to interact with (or leave blank for localhost detection)
    required: false
---

# IBR Interact

Perform one semantic interaction on a live page. `ibr interact` resolves the target by accessible name, optionally constrained by ARIA role, then clicks, types, fills, hovers, presses, scrolls, selects, or checks it.

For act -> verify -> screenshot assertions, use `ibr test-interact`.

## Usage

```bash
# Click a button by accessible name
npx ibr interact http://localhost:3000 \
  --action click \
  --target "Submit" \
  --role button

# Type into a text box
npx ibr interact http://localhost:3000 \
  --action type \
  --target "Search" \
  --role textbox \
  --value "hello"

# Fill an email field without capturing a screenshot
npx ibr interact http://localhost:3000 \
  --action fill \
  --target "Email" \
  --value "user@example.com" \
  --no-screenshot

# Assertion workflow
npx ibr test-interact http://localhost:3000 \
  --action "click:button:Submit" \
  --expect "visible:Success" \
  --expect-screenshot after-submit
```

## Command Format

```bash
npx ibr interact http://localhost:3000 \
  --action <action> \
  --target <accessible-name> \
  [--role <aria-role>] \
  [--value <text>] \
  [--no-screenshot]
```

## Actions

`--action <action>`

| Action | Required fields | What it does |
|--------|-----------------|-------------|
| `click` | `--target`, optional `--role` | Click the resolved element |
| `type` | `--target`, `--value`, optional `--role` | Type text into the resolved element |
| `fill` | `--target`, `--value`, optional `--role` | Replace field contents with the value |
| `hover` | `--target`, optional `--role` | Hover the resolved element |
| `press` | `--target`, `--value` | Press a key, defaulting to Enter |
| `scroll` | `--target`, optional `--value` | Scroll by the numeric value, defaulting to 300 |
| `select` | `--target`, `--value`, optional `--role` | Select an option value |
| `check` | `--target`, optional `--role` | Check or toggle the resolved control |

## Options

| Option | Description |
|--------|-------------|
| `--action <action>` | Required action: `click`, `type`, `fill`, `hover`, `press`, `scroll`, `select`, `check` |
| `--target <name>` | Required accessible name to resolve |
| `--role <role>` | Optional ARIA role filter |
| `--value <text>` | Value for type/fill/press/select, or scroll distance |
| `--no-screenshot` | Skip the post-action screenshot |

Screenshots are saved to `.ibr/` by default after a successful interaction.

## Assertion Workflow

Use `ibr test-interact` when you need multiple steps, expectations, JSON output, or named screenshots:

```bash
npx ibr test-interact http://localhost:3000 \
  --action "type:textbox:Search:hello" \
  --action "click:button:Submit" \
  --expect "text:hello" \
  --json
```

`test-interact` action format:

`--action "type[:role]:target[:value]"`

`test-interact` expectation format:

`--expect "visible|hidden|text|count:value"`

## Exit Codes

- `0` — The action succeeded
- `1` — The action failed or the element was not found

## Example Output

```
✓ click on "Submit" succeeded
Screenshot saved: .ibr/interact-1780000000000.png
```

## When to Use

Use `ibr interact` for quick semantic actions during UI validation:
- Click a button and inspect the resulting page
- Fill a field before running `ibr scan`
- Toggle a control before capturing a screenshot
- Confirm an accessible name resolves to the intended element

For read-only page inspection, use `ibr scan` instead.
