# Interface Built Right - Claude Instructions

## Overview

You have access to `interface-built-right` for visual regression testing. Use it to capture UI screenshots, compare changes, and verify your frontend work is correct.

## Default Workflow

When working on UI/frontend files (`.tsx`, `.jsx`, `.vue`, `.svelte`, `.css`, `.scss`):

1. **Before making changes**: Capture a baseline
   ```bash
   npx ibr start http://localhost:3000/page-you-will-edit --name "feature-name"
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

## Slash Commands

- `/ibr:snapshot` - Capture baseline (prompts for URL)
- `/ibr:compare` - Compare current state against baseline
- `/ibr:ui` - Open web UI at localhost:4242

## Programmatic API

For more control, use the API directly:

```typescript
import { InterfaceBuiltRight } from 'interface-built-right';

const ibr = new InterfaceBuiltRight({
  baseUrl: 'http://localhost:3000',
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
npx ibr login http://localhost:3000/login  # Opens browser for manual auth
npx ibr start http://localhost:3000/dashboard  # Now uses saved auth
```

## Viewports

Available presets: `desktop`, `desktop-lg`, `desktop-sm`, `laptop`, `tablet`, `tablet-landscape`, `mobile`, `mobile-lg`, `iphone-14`, `iphone-14-pro-max`

```bash
npx ibr start http://localhost:3000 --viewport mobile
```
