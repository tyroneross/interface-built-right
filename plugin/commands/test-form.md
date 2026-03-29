---
name: ibr:test-form
description: Test form submission on a page using the IBR form flow
arguments:
  - name: url
    description: URL of the page with the form to test
    required: false
---

# IBR Test Form

Test form submission on a live page. Finds and fills form fields by label or name, clicks the submit button, and reports whether the submission succeeded.

## Usage

```bash
# Fill a contact form
npx ibr test-form http://localhost:3000/contact --fill '{"name":"Jane Doe","email":"jane@example.com","message":"Hello"}'

# Specify the submit button text
npx ibr test-form http://localhost:3000/signup --fill '{"email":"user@test.com"}' --submit-button "Create Account"

# JSON output
npx ibr test-form http://localhost:3000/contact --fill '{"name":"Test"}' --json
```

## Options

| Option | Description |
|--------|-------------|
| `--fill <json>` | JSON object mapping field name/label to value, e.g. `'{"email":"user@example.com"}'` |
| `--submit-button <text>` | Text of the submit button (auto-detected if omitted) |
| `--json` | Output as JSON |

## What It Tests

1. Finds each field by label, name attribute, or placeholder
2. Fills text inputs, textareas, selects, checkboxes, and radio buttons
3. Finds and clicks the submit button
4. Waits for navigation or response
5. Checks for error indicators on the page

## Exit Codes

- `0` — Form submitted successfully with no errors detected
- `1` — Form submission failed (field not found, submit button not found, or errors on page)

## Example Output

```
Status: SUCCESS
Fields filled: name, email, message
Duration: 2104ms
```
