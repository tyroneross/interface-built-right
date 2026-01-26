# interface-built-right

Visual regression testing for Claude Code. Capture baselines, compare changes, iterate automatically.

## Quick Start

```bash
# 1. Install
npm install github:tyroneross/interface-built-right

# 2. Capture baseline of your app
npx ibr start http://localhost:3000/dashboard --name my-feature

# 3. Make UI changes...

# 4. Compare against baseline
npx ibr check

# 5. View visual diff in browser
npx ibr serve
```

## Installation

**From GitHub:**
```bash
npm install github:tyroneross/interface-built-right
```

**From local path:**
```bash
npm install /path/to/interface-built-right
```

**After install, verify it works:**
```bash
npx ibr --help
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `npx ibr start <url>` | Capture baseline screenshot |
| `npx ibr check [sessionId]` | Compare current state against baseline |
| `npx ibr serve` | Open web UI at localhost:4200 |
| `npx ibr list` | List all sessions |
| `npx ibr update [sessionId]` | Update baseline with current screenshot |
| `npx ibr clean --older-than 7d` | Clean old sessions |
| `npx ibr login <url>` | Save auth state for protected pages |
| `npx ibr logout` | Clear saved auth state |

## Workflow Example

```bash
# 1. Start your app
cd my-app && npm run dev  # → localhost:3000

# 2. Capture baseline before making changes
npx ibr start http://localhost:3000/settings --name settings-redesign
# → Session started: sess_Hk8mN2pQ

# 3. Make your UI changes (edit components, styles, etc.)

# 4. Compare against baseline
npx ibr check
# → Shows diff percentage and verdict

# 5. View in web UI
npx ibr serve
# → Opens http://localhost:4200 with side-by-side comparison

# 6. If changes look good, update baseline
npx ibr update
```

## Authenticated Pages

For pages behind login:

```bash
# 1. Save auth state (opens browser for manual login)
npx ibr login http://localhost:3000/login
# → Log in manually, then close browser

# 2. Now captures will use your auth session
npx ibr start http://localhost:3000/dashboard
# → 🔐 Using saved authentication state

# 3. Clear auth when done
npx ibr logout
```

**Security notes:**
- Auth state is stored per-user (`auth.{username}.json`)
- 7-day expiration with auto-cleanup
- Blocked in CI/CD and deployed environments
- Add `.ibr/` to your `.gitignore`

## Claude Code Plugin

Add to your project's `.claude/settings.json`:

```json
{
  "plugins": [
    "node_modules/interface-built-right/plugin"
  ]
}
```

Then restart Claude Code. You'll have these commands:

| Command | Description |
|---------|-------------|
| `/ibr:ui` | Launch web UI dashboard |
| `/ibr:snapshot` | Capture baseline (prompts for URL) |
| `/ibr:compare` | Compare against baseline |

## Programmatic API

```typescript
import { InterfaceBuiltRight } from 'interface-built-right';

const ibr = new InterfaceBuiltRight({
  baseUrl: 'http://localhost:3000',
  outputDir: './.ibr',
  threshold: 1.0,  // % diff allowed
});

// Capture baseline
const { sessionId } = await ibr.startSession('/dashboard', {
  name: 'dashboard-update',
});

// After making changes, compare
const report = await ibr.check(sessionId);

console.log(report.analysis.verdict);
// → "MATCH" | "EXPECTED_CHANGE" | "UNEXPECTED_CHANGE" | "LAYOUT_BROKEN"

// Cleanup
await ibr.close();
```

## Configuration

Create `.ibrrc.json` in your project root:

```json
{
  "baseUrl": "http://localhost:3000",
  "outputDir": "./.ibr",
  "viewport": "desktop",
  "threshold": 1.0,
  "fullPage": true
}
```

## Comparison Report

Reports are structured for Claude to read and act on:

```json
{
  "sessionId": "sess_abc123",
  "comparison": {
    "match": false,
    "diffPercent": 8.2,
    "diffPixels": 6560
  },
  "analysis": {
    "verdict": "EXPECTED_CHANGE",
    "summary": "Header background changed. Layout intact."
  }
}
```

**Verdicts:**
- `MATCH` - No visual changes (within threshold)
- `EXPECTED_CHANGE` - Changes detected, appear intentional
- `UNEXPECTED_CHANGE` - Changes in unexpected areas
- `LAYOUT_BROKEN` - Significant structural issues

## File Structure

Sessions are stored in `.ibr/sessions/`:

```
.ibr/
├── auth.{username}.json   # Auth state (per-user)
└── sessions/
    └── sess_abc123/
        ├── session.json   # Session metadata
        ├── baseline.png   # Original screenshot
        ├── current.png    # After-changes screenshot
        └── diff.png       # Visual diff
```

## Troubleshooting

**"Command not found: ibr"**
```bash
# Use npx or run from source
npx ibr --help
# OR
npm run ibr -- --help
```

**"Playwright browsers not installed"**
```bash
npx playwright install chromium
```

**"Auth state expired"**
```bash
npx ibr login http://localhost:3000/login
```

**"Session not found"**
```bash
# List available sessions
npx ibr list
```

## Cloud & Memory-Constrained Environments

IBR can run in memory-constrained environments like Replit, Lovable, or other cloud platforms.

### Replit / Lovable Mode (1GB RAM)

For environments with 1GB RAM or less:

```bash
# Use --replit flag for ultra-low memory mode
npx ibr session:start http://localhost:3000 --replit
```

This enables aggressive memory optimizations:
- Single-process browser mode (saves ~100MB)
- Disabled WebGL, GPU compositing, hardware acceleration
- Limited V8 heap to 128MB
- Disabled non-essential browser features

### Low Memory Mode (4GB RAM)

For machines with 4GB RAM:

```bash
npx ibr session:start http://localhost:3000 --low-memory
```

### Dependency Footprint

The core library has minimal dependencies:
- **playwright** (~200MB with browsers) - Required for screenshots
- **commander** - CLI parsing
- **pixelmatch** + **pngjs** - Visual comparison
- **zod** - Config validation

**Note:** `sharp` (30MB native bindings) is NOT required for the core library - only used by the optional web UI.

### Tips for Cloud Environments

1. **Replit**: Use `--replit` flag. Free tier (1GB) will be tight but workable.
2. **Lovable**: Best used as CI tool or external service rather than embedded.
3. **Vercel/Netlify**: Use in CI workflows, not serverless functions.

## Requirements

- Node.js 18+
- Playwright (installed automatically)

## License

MIT
