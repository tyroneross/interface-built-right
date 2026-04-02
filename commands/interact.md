---
name: ibr:interact
description: Run interaction assertions on a live page — click X, verify Y happened
arguments:
  - name: url
    description: URL to interact with (or leave blank for localhost detection)
    required: false
---

# IBR Interact — act→verify→screenshot

Test user interactions on a live page. Executes actions (click, type, fill, etc.) and asserts that expected changes occurred — elements appeared, disappeared, or text is present.

## Usage

```bash
# Click a button and verify a heading appears
npx ibr interact http://localhost:3000 \
  --action "click:button:Submit" \
  --expect "heading:Success"

# Type into a field and verify text appears
npx ibr interact http://localhost:3000 \
  --action "type:textbox:Search:hello" \
  --expect "text:hello"

# Multiple steps — each --action is a separate step
npx ibr interact http://localhost:3000 \
  --action "click:button:Open Modal" \
  --action "click:button:Confirm" \
  --expect "hidden:Modal" \
  --expect "text:Confirmed"

# Capture screenshot after action
npx ibr interact http://localhost:3000 \
  --action "click:button:FlowDoro" \
  --expect-screenshot modal-open

# JSON output
npx ibr interact http://localhost:3000 \
  --action "click:button:Submit" \
  --json
```

## Action Format

`--action "type[:role]:target[:value]"`

| Example | What it does |
|---------|-------------|
| `click:button:Submit` | Click the "Submit" button |
| `click:Login` | Click any element named "Login" |
| `type:textbox:Search:hello` | Type "hello" into the "Search" text box |
| `fill:Email:user@example.com` | Fill the "Email" field with the value |
| `select:dropdown:Country:US` | Select "US" from the "Country" dropdown |
| `check:Remember me` | Toggle the "Remember me" checkbox |
| `hover:Menu` | Hover over the "Menu" element |
| `press:Enter` | Press the Enter key |
| `scroll:500` | Scroll down 500px |
| `doubleClick:item:Row` | Double-click the "Row" item |
| `rightClick:item:File` | Right-click the "File" item |

## Expect Format

`--expect "keyword[:value]"`

| Example | What it asserts |
|---------|----------------|
| `heading:Success` | An element labeled "Success" is visible |
| `visible:Confirm Dialog` | Element "Confirm Dialog" appears in AX tree |
| `hidden:Loading Spinner` | "Loading Spinner" is no longer in AX tree |
| `text:Saved successfully` | Any element contains this text |
| `count:3` | 3 elements match the visible target |

## Options

| Option | Description |
|--------|-------------|
| `--action <spec>` | Action to perform (repeatable, each is a step) |
| `--expect <spec>` | Assertion on the last step (repeatable) |
| `--expect-screenshot <name>` | Save screenshot after last action |
| `--json` | Output as JSON |
| `--sandbox` | Show visible browser window |

## Exit Codes

- `0` — All actions succeeded and all assertions passed
- `1` — Any action failed or any assertion failed

## Example Output

```
[PASS] click "Submit" (243ms)
  Before: 18 elements
  After:  22 elements
  Added:  Success Heading, Close Button
  Visual: 14320 pixels changed
  Assertions:
    [PASS] visible: "Success"
    [PASS] screenshot: "after-submit"

Assertions: 2/2 passed
```

## When to Use

Use `ibr interact` when you want to verify that UI state changes correctly after user actions:
- A button click opens a modal
- Form submission shows a success message
- Toggling a switch hides/shows a panel
- Navigation updates the visible heading

For read-only page inspection, use `ibr scan` instead.
