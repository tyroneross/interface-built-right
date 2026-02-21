---
name: interactive-testing
description: Interactive browser testing with persistent sessions. Use when testing search forms, multi-step flows, login sequences, dynamic content, or any page requiring clicks/typing before capturing state. Keeps a browser alive across multiple commands.
metadata:
  author: tyroneross
  version: "0.4.9"
  argument-hint: <url>
---

# Interactive Browser Testing with IBR

For pages requiring user interaction — search forms, login flows, dynamic content — use IBR's persistent session mode. This keeps a browser alive across multiple CLI commands.

## Prerequisites

```bash
npm install @tyroneross/interface-built-right
```

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

| Command | Purpose | Example |
|---------|---------|---------|
| `session:start <url>` | Start browser + session | `npx ibr session:start http://localhost:3000` |
| `session:click <id> <selector>` | Click element | `npx ibr session:click live_XYZ "button.submit"` |
| `session:type <id> <selector> <text>` | Type into element | `npx ibr session:type live_XYZ "input" "hello"` |
| `session:press <id> <key>` | Press keyboard key | `npx ibr session:press live_XYZ Enter` |
| `session:scroll <id> <direction> [px]` | Scroll page | `npx ibr session:scroll live_XYZ down 500` |
| `session:screenshot <id>` | Capture screenshot | `npx ibr session:screenshot live_XYZ` |
| `session:wait <id> <selector\|ms>` | Wait for selector/time | `npx ibr session:wait live_XYZ ".results"` |
| `session:navigate <id> <url>` | Navigate to URL | `npx ibr session:navigate live_XYZ /page2` |
| `session:html <id>` | Get page HTML | `npx ibr session:html live_XYZ --selector ".content"` |
| `session:text <id> <selector>` | Extract text | `npx ibr session:text live_XYZ ".message"` |
| `session:eval <id> <script>` | Run JavaScript | `npx ibr session:eval live_XYZ "document.title"` |
| `session:modal <id>` | Detect/dismiss modals | `npx ibr session:modal live_XYZ --dismiss` |
| `session:actions <id>` | Show action history | `npx ibr session:actions live_XYZ` |
| `session:list` | List active sessions | `npx ibr session:list` |
| `session:close <id\|all>` | Close session(s) | `npx ibr session:close all` |

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

## Common Workflows

### Search testing

```bash
npx ibr session:start http://localhost:3000 --name "search-test"
npx ibr session:type <id> "input[name=search]" "test query" --submit
npx ibr session:wait <id> ".search-results"
npx ibr session:screenshot <id> --name "search-results"
npx ibr session:close <id>
```

### Login flow

```bash
npx ibr session:start http://localhost:3000/login --name "login-test"
npx ibr session:type <id> "input[name=email]" "user@example.com"
npx ibr session:type <id> "input[name=password]" "password123"
npx ibr session:click <id> "button[type=submit]"
npx ibr session:wait <id> ".dashboard"
npx ibr session:screenshot <id> --name "after-login"
npx ibr session:close <id>
```

### Form submission

```bash
npx ibr session:start http://localhost:3000/contact --name "form-test"
npx ibr session:type <id> "input[name=name]" "John Doe"
npx ibr session:type <id> "input[name=email]" "john@example.com"
npx ibr session:type <id> "textarea[name=message]" "Hello world"
npx ibr session:click <id> "button[type=submit]"
npx ibr session:wait <id> ".success-message"
npx ibr session:screenshot <id> --name "form-submitted"
npx ibr session:close <id>
```

## DOM and Text Extraction

```bash
# Get full page HTML
npx ibr session:html <id>

# Get HTML of specific element
npx ibr session:html <id> --selector ".chat-container"

# Get text from element
npx ibr session:text <id> ".ai-response"

# Get text from all matching elements
npx ibr session:text <id> ".message" --all
```

## Browser Modes

```bash
# Headless (default)
npx ibr session:start http://localhost:3000

# Show browser window
npx ibr session:start http://localhost:3000 --sandbox

# Debug mode (visible + slow motion + devtools)
npx ibr session:start http://localhost:3000 --debug
```

## Keyboard Keys

For `session:press`: Enter, Tab, Escape, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Backspace, Delete, Space, PageUp, PageDown

## When to Use Interactive Sessions

- Testing search functionality
- Testing forms that require input before showing content
- Capturing state after JavaScript interactions
- Multi-step user flows
- Login/authentication testing

## When to Use Regular `ibr start` Instead

- Page content loads on initial render
- No user interaction needed
- Just capturing static content
