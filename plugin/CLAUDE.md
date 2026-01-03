# Interface Built Right - Claude Instructions

## Overview

You have access to `interface-built-right` for visual regression testing. Use it to capture UI screenshots, compare changes, and verify your frontend work is correct.

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

**When Playwright MCP is appropriate (IBR can't do these):**
- Interactive testing (clicking buttons, filling forms)
- Multi-step user flow simulation
- Testing JavaScript interactions
- Hovering, dragging, keyboard input
- Handling dialogs and file uploads
- Any task requiring page interaction

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
