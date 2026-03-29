---
name: ibr:test-login
description: Test login flow on a page using the IBR login flow
arguments:
  - name: url
    description: URL of the login page to test
    required: false
---

# IBR Test Login

Test the login flow on a live page. Finds the email/username and password fields, fills them, clicks the submit button, and verifies the authentication state after submission.

## Usage

```bash
# Basic login test
npx ibr test-login http://localhost:3000/login --email user@example.com --password secret123

# With a success indicator selector
npx ibr test-login http://localhost:3000/login --email admin@test.com --password pass --success-indicator ".dashboard-header"

# JSON output
npx ibr test-login http://localhost:3000/login --email user@test.com --password pass --json
```

## Options

| Option | Description |
|--------|-------------|
| `--email <email>` | Email or username to log in with (required) |
| `--password <password>` | Password to log in with (required) |
| `--success-indicator <text>` | CSS selector that should be present after successful login |
| `--json` | Output as JSON |

## What It Tests

1. Finds email/username field (by label: email, username, login, user, mail)
2. Fills the email field
3. Finds and fills the password field (`input[type="password"]`)
4. Finds and clicks the submit button (login, sign in, log in, submit, continue)
5. Waits for navigation
6. Detects authentication state via semantic analysis

## Exit Codes

- `0` — Login succeeded and authentication was confirmed
- `1` — Login failed (field not found, submit failed, or not authenticated after submission)

## Example Output

```
Status: SUCCESS
Authenticated: true
Username: user@example.com
Duration: 3271ms
```
