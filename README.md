# interface-built-right

Visual regression testing for Claude Code. Capture baselines, compare changes, iterate automatically.

## The Problem

When Claude makes UI changes, you currently have to:
1. Manually take screenshots
2. Copy/paste images back to Claude Code
3. Explain what's wrong
4. Repeat until correct

**This is tedious and breaks flow.**

## The Solution

Claude captures its own snapshots before/after changes and iterates on obvious issues automatically:

1. **Before changes**: Claude captures baseline of current UI state
2. **During work**: Claude makes frontend changes
3. **After changes**: Claude captures new snapshot
4. **Auto-compare**: Claude compares both, identifies obvious issues
5. **Self-iterate**: Claude fixes obvious problems without user intervention
6. **Manual review** (optional): User views comparison UI, provides additional instructions

## Installation

```bash
npm install interface-built-right
```

## CLI Usage

```bash
# Start visual session (capture baseline)
npx ibr start http://localhost:3000/dashboard --name dashboard-update
# Output: Session started: sess_abc123

# Check current state against baseline
npx ibr check sess_abc123
# Output: Comparison report (JSON or summary)

# Open comparison UI
npx ibr serve
# Opens http://localhost:4200

# List sessions
npx ibr list

# Clean old sessions
npx ibr clean --older-than 7d
```

## Programmatic API

```typescript
import { InterfaceBuiltRight } from 'interface-built-right';

const ibr = new InterfaceBuiltRight({
  baseUrl: 'http://localhost:3000',
  outputDir: './.ibr',
  viewports: ['desktop'],
});

// Start a visual session (capture baseline)
const session = await ibr.startSession('/dashboard', 'dashboard-update');

// After making changes, check against baseline
const result = await ibr.check(session.sessionId);

// Open comparison UI
await ibr.serve();
```

## Claude Code Plugin

Install the plugin to get these skills:

- `/visual-start <url>` - Capture baseline before UI work
- `/visual-check` - Compare current state against baseline
- `/visual-view` - Open comparison UI in browser

### Automatic Mode

```
User: "Update the dashboard header to use a darker background"

Claude (automatically):
1. Captures baseline screenshot
2. Makes UI changes
3. Captures new screenshot & compares
4. If issues detected → fixes and re-checks
5. Reports success when done
```

### Manual Mode (Default)

```
User: "Update the dashboard header"

Claude:
1. Makes UI changes
2. Prompts: "Run /visual-view to see the changes"

User: /visual-view
→ Opens comparison UI at http://localhost:4200
→ User reviews before/after/diff
→ User provides feedback in FeedbackPanel
```

## Comparison Report Format

Reports are structured for Claude to read and act on:

```json
{
  "sessionId": "sess_abc123",
  "comparison": {
    "match": false,
    "diffPercent": 8.2,
    "diffPixels": 6560,
    "threshold": 1.0
  },
  "analysis": {
    "verdict": "EXPECTED_CHANGE",
    "summary": "Header background changed. Layout intact.",
    "unexpectedChanges": []
  }
}
```

**Verdict Types:**
- `MATCH` - No visual changes
- `EXPECTED_CHANGE` - Changes detected, appear intentional
- `UNEXPECTED_CHANGE` - Changes in unexpected areas (needs review)
- `LAYOUT_BROKEN` - Significant structural issues

## Configuration

Create `.ibrrc.json` in your project root:

```json
{
  "baseUrl": "http://localhost:3000",
  "outputDir": "./.ibr",
  "viewport": "desktop",
  "threshold": 1.0
}
```

## Session Storage

Sessions are stored locally in `.ibr/sessions/`:

```
.ibr/
├── config.json
└── sessions/
    └── sess_abc123/
        ├── session.json
        ├── baseline.png
        ├── current.png
        └── diff.png
```

## License

MIT
