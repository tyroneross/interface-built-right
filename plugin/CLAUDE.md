# Interface Built Right - Claude Instructions

## Overview

You have access to `interface-built-right` for visual regression testing. Use it to capture UI screenshots, compare changes, and verify your frontend work is correct.

## Setup

**Add `.ibr/` to your project's `.gitignore`:**

```bash
echo ".ibr/" >> .gitignore
```

IBR stores sessions, screenshots, and browser state in `.ibr/`. This folder should not be committed to version control.

## UI Capture Preference

**Always use IBR instead of Playwright MCP for UI capture tasks:**

| Task | Use IBR | NOT Playwright MCP |
|------|---------|-------------------|
| Screenshot a URL | `npx ibr start <url>` | ~~browser_navigate + screenshot~~ |
| Extract HTML/CSS | IBR web UI or `/api/sessions/extract` | ~~browser_snapshot~~ |
| Visual comparison | `npx ibr check` | ~~manual comparison~~ |
| Capture for replication | `/ibr:screenshot` | ~~browser_take_screenshot~~ |

**Why IBR over Playwright MCP:**
- Consistent storage in `.ibr/sessions/` with metadata
- Automatic comparison verdicts (MATCH, EXPECTED_CHANGE, etc.)
- Session history and timeline tracking
- Integration with `/ibr:replicate` workflow
- Extracted HTML/CSS for higher fidelity replication

**When Playwright MCP is still appropriate:**
- Complex multi-tab scenarios
- Handling dialogs and file uploads
- Advanced browser DevTools integration
- When you need MCP's snapshot accessibility tree

**For interactive testing, IBR now supports persistent sessions (see below).**

**Mode commands:**
- `/prefer-ibr` — Soft preference (default). IBR recommended, Playwright allowed.
- `/only-use-ibr` — Enforce IBR for capture. Blocks Playwright screenshot/snapshot, allows interaction tools.

## When to Use IBR

**Use for:**
- Modifying UI components (*.tsx, *.jsx, *.vue, *.svelte)
- Changing CSS/styling
- Updating layouts or page structure
- Before PR review on frontend changes

**Skip for:**
- Backend-only changes (APIs, database, server logic)
- Config file updates
- Documentation changes
- Type-only changes

## Workflow

**The key is: baseline BEFORE changes, check AFTER changes.**

1. BEFORE making UI changes: `npx ibr start <url> --name "feature-name"`
2. Make your code changes
3. AFTER changes are complete: `npx ibr check`
4. Review verdict and iterate if needed

## Default Workflow

When working on UI/frontend files (`.tsx`, `.jsx`, `.vue`, `.svelte`, `.css`, `.scss`):

1. **Before making changes**: Capture a baseline
   ```bash
   npx ibr start http://localhost:5000/page-you-will-edit --name "feature-name"
   ```

2. **After making changes**: Compare against baseline
   ```bash
   npx ibr check
   ```

3. **Interpret the verdict**:
   - `MATCH` - No visual changes (you're done)
   - `EXPECTED_CHANGE` - Changes detected, appear intentional (verify with user if significant)
   - `UNEXPECTED_CHANGE` - Something changed that shouldn't have (investigate and fix)
   - `LAYOUT_BROKEN` - Major structural issue detected (fix before continuing)

4. **Self-iterate on issues**: If `UNEXPECTED_CHANGE` or `LAYOUT_BROKEN`:
   - Analyze the diff report to understand what broke
   - Make corrections
   - Run `npx ibr check` again
   - Repeat until `MATCH` or `EXPECTED_CHANGE`

**Important timing:** Do NOT run `ibr check` immediately after `ibr start`. You need to make code changes first - otherwise you're comparing identical states.

## Slash Commands

- `/ibr:snapshot` - Capture baseline BEFORE making UI changes
- `/ibr:compare` - Compare AFTER making UI changes
- `/ibr:ui` - Open web UI at localhost:4200

## CLI Quick Reference

```bash
npx ibr status              # Show pending baselines awaiting check
npx ibr start <url>         # Capture baseline
npx ibr check               # Compare against baseline
npx ibr list                # List all sessions
```

## Programmatic API

For more control, use the API directly:

```typescript
import { InterfaceBuiltRight } from 'interface-built-right';

const ibr = new InterfaceBuiltRight({
  baseUrl: 'http://localhost:5000',
  outputDir: './.ibr',
  threshold: 1.0, // % diff allowed
});

// Capture baseline
const { sessionId } = await ibr.startSession('/dashboard', {
  name: 'dashboard-update',
});

// After changes, compare
const report = await ibr.check(sessionId);

// Act on verdict
if (report.analysis.verdict === 'LAYOUT_BROKEN') {
  // Fix the issue
}

// Query sessions
const sessions = await ibr.find({ route: '/dashboard', status: 'compared' });

// Cleanup
await ibr.close();
```

## Key API Methods

| Method | Purpose |
|--------|---------|
| `startSession(url, options)` | Capture baseline screenshot |
| `check(sessionId?)` | Compare current vs baseline |
| `find(query)` | Search sessions by criteria |
| `getTimeline(route)` | Get history for a route |
| `updateBaseline(sessionId?)` | Accept current as new baseline |
| `listSessions()` | List all sessions |
| `getStats()` | Get statistics by status/viewport/verdict |

## Simpler API (IBR 2.0)

For AI-native workflows, use the simpler semantic API:

```typescript
import { InterfaceBuiltRight } from 'interface-built-right';

const ibr = new InterfaceBuiltRight();

// One line to start a session
const session = await ibr.start('http://localhost:3000');

// Get semantic understanding of the page
const understanding = await session.understand();
// Returns: { verdict, pageIntent, state, availableActions, issues, recovery }

// Use built-in flows
const loginResult = await session.flow.login({
  email: 'test@test.com',
  password: 'secret'
});

const searchResult = await session.flow.search({
  query: 'test query'
});

// Mock network requests
await session.mock('/api/users', {
  status: 200,
  body: { users: [] }
});

// Clean up
await session.close();
```

## Semantic Output

The `session.understand()` method returns AI-friendly output:

```typescript
{
  verdict: 'PASS' | 'ISSUES' | 'FAIL' | 'LOADING' | 'ERROR',
  confidence: 0.85,
  pageIntent: {
    intent: 'auth' | 'form' | 'listing' | 'detail' | 'dashboard' | 'error',
    signals: ['password field present', 'login-related text']
  },
  state: {
    auth: { authenticated: true, username: 'john' },
    loading: { loading: false, type: 'none' },
    errors: { hasErrors: false, errors: [] },
    ready: true
  },
  availableActions: [
    { action: 'login', selector: 'form', description: 'Submit login credentials' }
  ],
  issues: [],
  recovery: null,
  summary: 'auth page, not authenticated, ready for interaction'
}
```

## Built-in Flows

| Flow | Usage | Returns |
|------|-------|---------|
| `session.flow.login({ email, password })` | Authenticate with credentials | `{ success, authenticated, steps }` |
| `session.flow.search({ query })` | Search and verify results | `{ success, resultCount, hasResults }` |
| `session.flow.form({ fields })` | Fill and submit form | `{ success, filledFields, failedFields }` |

## Comparison Report Structure

```typescript
{
  sessionId: "sess_abc123",
  comparison: {
    match: false,
    diffPercent: 8.2,
    diffPixels: 6560,
    threshold: 1.0
  },
  analysis: {
    verdict: "EXPECTED_CHANGE",
    summary: "Header background changed. Layout intact.",
    changedRegions: [...],
    recommendation: null
  },
  files: {
    baseline: ".ibr/sessions/sess_abc123/baseline.png",
    current: ".ibr/sessions/sess_abc123/current.png",
    diff: ".ibr/sessions/sess_abc123/diff.png"
  }
}
```

## Best Practices

1. **Always capture before editing** - Don't skip baselines
2. **Use meaningful names** - `--name "header-redesign"` not `--name "test"`
3. **Check after every significant change** - Catch issues early
4. **Self-iterate on LAYOUT_BROKEN** - Don't report broken UI to user
5. **Update baseline when intentional** - After user confirms, run `npx ibr update`

## Authenticated Pages

If the page requires login:
```bash
npx ibr login http://localhost:5000/login  # Opens browser for manual auth
npx ibr start http://localhost:5000/dashboard  # Now uses saved auth
```

## Viewports

Available presets: `desktop`, `desktop-lg`, `desktop-sm`, `laptop`, `tablet`, `tablet-landscape`, `mobile`, `mobile-lg`, `iphone-14`, `iphone-14-pro-max`

```bash
npx ibr start http://localhost:5000 --viewport mobile
```

## Interactive Sessions (Browser Server Mode)

For pages requiring user interaction (search forms, dynamic content, multi-step flows), use IBR's persistent session mode. This keeps a browser alive across multiple CLI commands.

### Key Concept

The first `session:start` launches a **browser server** that persists. Run interaction commands from a **separate terminal**. The browser stays alive until you close it.

### Starting an Interactive Session

```bash
# Terminal 1: Start browser server (keeps running)
npx ibr session:start http://localhost:3000 --name "search-test"

# Output shows session ID: live_XYZ123
# Browser server running. Press Ctrl+C to stop.
```

### Interacting with the Session

```bash
# Terminal 2: Run commands against the session

# Type into a search box
npx ibr session:type live_XYZ123 "input[name=search]" "quantum computing"

# Click the submit button
npx ibr session:click live_XYZ123 "button[type=submit]"

# Wait for results to appear
npx ibr session:wait live_XYZ123 ".search-results"

# Take a screenshot of the results
npx ibr session:screenshot live_XYZ123 --name "search-results"
```

### Session Commands Reference

| Command | Purpose | Example |
|---------|---------|---------|
| `session:start <url>` | Start browser server + session | `npx ibr session:start http://localhost:3000` |
| `session:click <id> <selector>` | Click an element | `npx ibr session:click live_XYZ "button.submit"` |
| `session:type <id> <selector> <text>` | Type text into element | `npx ibr session:type live_XYZ "input" "hello"` |
| `session:press <id> <key>` | Press keyboard key | `npx ibr session:press live_XYZ Enter` |
| `session:scroll <id> <direction> [px]` | Scroll page or container | `npx ibr session:scroll live_XYZ down 500` |
| `session:screenshot <id>` | Capture screenshot + element audit | `npx ibr session:screenshot live_XYZ` |
| `session:wait <id> <selector\|ms>` | Wait for selector or duration | `npx ibr session:wait live_XYZ ".results"` |
| `session:navigate <id> <url>` | Navigate to a new URL | `npx ibr session:navigate live_XYZ /page2` |
| `session:html <id>` | Get page HTML | `npx ibr session:html live_XYZ --selector ".content"` |
| `session:text <id> <selector>` | Extract text content | `npx ibr session:text live_XYZ ".message"` |
| `session:eval <id> <script>` | Execute JavaScript | `npx ibr session:eval live_XYZ "document.title"` |
| `session:modal <id>` | Detect/dismiss modals | `npx ibr session:modal live_XYZ --dismiss` |
| `session:actions <id>` | Show action history | `npx ibr session:actions live_XYZ` |
| `session:list` | List active sessions | `npx ibr session:list` |
| `session:close <id\|all>` | Close session(s) or stop server | `npx ibr session:close all` |

**Keyboard keys for `session:press`:** Enter, Tab, Escape, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Backspace, Delete, Space, PageUp, PageDown

### Command Options

| Option | Command | Purpose |
|--------|---------|---------|
| `--force` | click | Click through overlays/modals |
| `--append` | type | Append text without clearing field |
| `--selector <css>` | scroll | Scroll inside specific container |
| `--viewport-only` | screenshot | Capture viewport only (not full page) |
| `--dismiss` | modal | Dismiss detected modal |
| `--json` | eval, screenshot | Output as JSON |

### Options Examples

```bash
# Click through modal overlay
npx ibr session:click live_XYZ "input[type='search']" --force

# Append to existing input (don't clear)
npx ibr session:type live_XYZ "input" " additional text" --append

# Scroll inside a modal
npx ibr session:scroll live_XYZ down 500 --selector ".modal-body"

# Capture viewport only (not full scrollable page)
npx ibr session:screenshot live_XYZ --viewport-only

# Execute JavaScript
npx ibr session:eval live_XYZ "document.querySelector('.modal').scrollTop = 500"

# Detect and dismiss modal
npx ibr session:modal live_XYZ --dismiss

# Type and submit (press Enter after typing)
npx ibr session:type live_XYZ "input" "query" --submit

# Navigate and wait for content
npx ibr session:navigate live_XYZ http://localhost:3000/results --wait-for ".results"
```

### When to Use Interactive Sessions

Use `session:*` commands when:
- Testing search functionality (type query → submit → verify results)
- Testing forms that require input before showing content
- Capturing state after JavaScript interactions
- Multi-step user flows

Use regular `ibr start` when:
- Page content loads on initial page load
- No user interaction needed
- Just capturing static content

### Browser Mode

Sessions are **headless by default** (no visible browser). Use flags for debugging:

```bash
# Show browser window
npx ibr session:start http://localhost:3000 --sandbox

# Show browser + slow motion + devtools
npx ibr session:start http://localhost:3000 --debug
```

### Browser Isolation

IBR uses an isolated browser profile to avoid conflicts with Playwright MCP. Both can run simultaneously without interference.

## Wait-For Pattern

For dynamic content that loads after initial page render, use `--wait-for`:

```bash
# Wait for search results before capturing
npx ibr start http://localhost:3000/?q=test --wait-for ".search-results"

# Wait for lazy-loaded images
npx ibr start http://localhost:3000/gallery --wait-for "img[data-loaded='true']"

# Wait for skeleton to be replaced
npx ibr start http://localhost:3000/dashboard --wait-for ":not(.skeleton)"
```

This ensures the screenshot captures the fully-loaded state, not loading spinners or empty containers.

## DOM and Text Extraction

For inspecting page structure or extracting text content:

```bash
# Get full page HTML
npx ibr session:html <id>

# Get HTML of specific element
npx ibr session:html <id> --selector ".chat-container"

# Get text from specific element
npx ibr session:text <id> ".ai-response"

# Get text from all matching elements
npx ibr session:text <id> ".message" --all
```

### Priority Order — Use the Right Tool

| Situation | Use | Why |
|-----------|-----|-----|
| Visual comparison | Screenshot | Default, handles 90% of cases |
| "Does it look right?" | Screenshot | Visual is the answer |
| "What did the AI respond?" | Screenshot + Vision | You can read the image |
| Verify specific element exists | `session:html --selector` | Check structure |
| Extract exact text for assertion | `session:text` | Precise matching |
| Find the right selector | `session:html` | Inspect DOM structure |
| Compare text across versions | `session:text` | Text diff, not pixel diff |

**Default to screenshots.** Only use `session:html` or `session:text` when:
- You need exact text (not visual approximation)
- You need to inspect DOM structure
- You're building automation that requires selectors
- Vision can't reliably read the content

## Reference Image Workflow

For building UI from design mockups or existing websites, IBR supports a reference upload workflow.

### When to Use

- User uploads a design mockup and wants you to recreate it
- User shares a URL and asks you to build something similar
- User mentions "replicate", "recreate", "build from image", or similar

### Input Types

| Type | What You Get |
|------|-------------|
| **Static Image** (PNG, JPG, WebP, SVG) | Screenshot + your vision analysis |
| **Live URL** | Screenshot + extracted HTML + computed CSS + layout data |

Live URL extraction provides **much higher fidelity** because you get structured data, not just pixels.

### Workflow

1. **User uploads via IBR web UI** (drag-drop or button at `localhost:4200`)
2. **Use `/ibr:replicate`** to find and build from the reference
3. **Read reference image** at `.ibr/sessions/<id>/reference.png`
4. **Check metadata** for framework/library/targetPath hints in `session.json`
5. **Auto-detect** from `package.json` if metadata is blank

### Reference Session Structure

```
.ibr/sessions/<session-id>/
├── session.json         # Session metadata including referenceMetadata
├── reference.png        # Screenshot (always present)
├── reference.html       # Full HTML (URL extraction only)
└── reference.json       # Elements with computed styles (URL extraction only)
```

### Session Metadata

Reference sessions have `type: "reference"` and include:

```json
{
  "id": "sess_abc123",
  "name": "Header Design",
  "type": "reference",
  "referenceMetadata": {
    "framework": "React",
    "componentLibrary": "Tailwind",
    "targetPath": "src/components/Header.tsx",
    "notes": "User wants exact color match",
    "originalUrl": "https://example.com",
    "dimensions": { "width": 1920, "height": 1080 }
  }
}
```

### Using Extracted Data

For URL extractions, `reference.json` contains rich data:

```json
{
  "url": "https://example.com",
  "elements": [
    {
      "selector": "header",
      "tagName": "header",
      "bounds": { "x": 0, "y": 0, "width": 1920, "height": 80 },
      "computedStyles": {
        "backgroundColor": "rgb(255, 255, 255)",
        "padding": "16px",
        "display": "flex"
      }
    }
  ],
  "cssVariables": {
    "--primary-color": "#3b82f6",
    "--spacing-unit": "8px"
  }
}
```

Use this for:
- Exact color values from `computedStyles`
- Design tokens from `cssVariables`
- Element dimensions from `bounds`
- Starting HTML structure from `reference.html`

### Slash Commands for Reference

- `/ibr:replicate` - Build UI from an uploaded reference design
- `/ibr:ui` - Open web UI to upload references

### Tips for Better Replication

1. **Extracted HTML is gold** - If from URL, use HTML/CSS as starting point
2. **Check CSS variables** - Design tokens in `cssVariables` contain colors, spacing
3. **Element bounds matter** - Use exact positions and dimensions
4. **Iterate if needed** - Visual replication often requires 2-3 iterations
5. **Auto-detect framework** - If metadata blank, check `package.json`:
   ```bash
   cat package.json | grep -E '"react"|"vue"|"svelte"|"tailwindcss"|"@mui"'
   ```

### Comparison After Building

After building from a reference, optionally verify:

1. Start dev server if not running
2. Capture the built component:
   ```bash
   npx ibr start http://localhost:<port>/<route> --name "replicate-verify"
   ```
3. Compare visually or use IBR's comparison features
