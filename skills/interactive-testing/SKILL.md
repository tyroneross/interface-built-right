---
name: interactive-testing
description: This skill should be used when the user asks to "test my form", "click through the flow", "test search functionality", "test the login", "interact with the page", or when multi-step browser interaction is needed before capturing state.
version: 0.5.0
user-invocable: true
argument-hint: <url>
---

# Interactive Browser Testing with IBR

For pages requiring user interaction — search forms, login flows, dynamic content — use IBR's persistent session mode. Sessions keep a browser alive across multiple CLI commands.

Note: Session commands use the CLI because they require stateful browser connections. Use the `ibr scan` MCP tool for static page validation instead.

## Quick Start

```bash
# Start a persistent browser session
npx ibr session:start http://localhost:3000 --name "search-test"
# Output: live_XYZ123

# Type into a search box
npx ibr session:type live_XYZ123 "input[name=search]" "quantum computing"

# Click submit
npx ibr session:click live_XYZ123 "button[type=submit]"

# Wait for results
npx ibr session:wait live_XYZ123 ".search-results"

# Screenshot the result
npx ibr session:screenshot live_XYZ123

# Done — close session
npx ibr session:close live_XYZ123
```

## Session Commands

| Command | Purpose |
|---------|---------|
| `session:start <url>` | Start browser + session |
| `session:click <id> <selector>` | Click element |
| `session:type <id> <selector> <text>` | Type into element |
| `session:press <id> <key>` | Press keyboard key |
| `session:scroll <id> <direction> [px]` | Scroll page |
| `session:screenshot <id>` | Capture screenshot |
| `session:wait <id> <selector\|ms>` | Wait for selector/time |
| `session:navigate <id> <url>` | Navigate to URL |
| `session:html <id>` | Get page HTML |
| `session:text <id> <selector>` | Extract text content |
| `session:eval <id> <script>` | Run JavaScript |
| `session:modal <id>` | Detect/dismiss modals |
| `session:actions <id>` | Show action history |
| `session:list` | List active sessions |
| `session:close <id\|all>` | Close session(s) |

## Command Options

| Option | Command | Purpose |
|--------|---------|---------|
| `--force` | click | Click through overlays/modals |
| `--append` | type | Append text without clearing |
| `--submit` | type | Press Enter after typing |
| `--selector <css>` | scroll | Scroll inside specific container |
| `--viewport-only` | screenshot | Capture viewport only |
| `--dismiss` | modal | Dismiss detected modal |
| `--json` | eval, screenshot | Output as JSON |
| `--sandbox` | start | Show browser window |
| `--debug` | start | Visible + slow motion + devtools |

## Common Workflows

### Search testing
```bash
npx ibr session:start http://localhost:3000 --name "search-test"
npx ibr session:type <id> "input[name=search]" "test query" --submit
npx ibr session:wait <id> ".search-results"
npx ibr session:screenshot <id>
npx ibr session:close <id>
```

### Login flow
```bash
npx ibr session:start http://localhost:3000/login --name "login-test"
npx ibr session:type <id> "input[name=email]" "user@example.com"
npx ibr session:type <id> "input[name=password]" "password123"
npx ibr session:click <id> "button[type=submit]"
npx ibr session:wait <id> ".dashboard"
npx ibr session:screenshot <id>
npx ibr session:close <id>
```

## When to Use Interactive Sessions

- Testing search functionality
- Testing forms that require input before showing results
- Multi-step user flows (login, checkout, wizards)
- Capturing state after JavaScript interactions

## When to Use `ibr scan` MCP Tool Instead

- Page content loads on initial render
- No user interaction needed
- Just validating static content, CSS, handlers, or accessibility

*ibr — design validation*
