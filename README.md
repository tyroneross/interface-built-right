<p align="center">
  <strong>╦╔╗ ╦═╗</strong><br>
  <strong>║╠╩╗╠╦╝</strong><br>
  <strong>╩╚═╝╩╚═</strong>
</p>

<h1 align="center">Interface Built Right</h1>

<p align="center">
  Visual eyes for Claude Code.<br>
  Catch what changed, keep what works.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@tyroneross/interface-built-right"><img src="https://img.shields.io/npm/v/@tyroneross/interface-built-right" alt="npm"></a>
  <a href="https://github.com/tyroneross/interface-built-right/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@tyroneross/interface-built-right" alt="license"></a>
  <img src="https://img.shields.io/node/v/@tyroneross/interface-built-right" alt="node">
</p>

---

IBR is a Claude Code plugin that screenshots your UI before and after changes, diffs them pixel-by-pixel, and tells you exactly what moved. No more "does this look right?" — you get a verdict: `MATCH`, `EXPECTED_CHANGE`, `UNEXPECTED_CHANGE`, or `LAYOUT_BROKEN`.

It works from the terminal, from Claude Code slash commands, or from code. Two commands to learn. Zero config required.

## How It Works

<table>
<tr>
<td width="33%"><strong>1. Baseline</strong><br><code>npx ibr start &lt;url&gt;</code></td>
<td width="33%"><strong>2. Make changes</strong><br>Edit your components</td>
<td width="33%"><strong>3. Compare</strong><br><code>npx ibr check</code></td>
</tr>
<tr>
<td><img src="https://raw.githubusercontent.com/tyroneross/interface-built-right/main/docs/images/demo-baseline.png" alt="Baseline screenshot"></td>
<td><img src="https://raw.githubusercontent.com/tyroneross/interface-built-right/main/docs/images/demo-current.png" alt="After changes"></td>
<td><img src="https://raw.githubusercontent.com/tyroneross/interface-built-right/main/docs/images/demo-diff.png" alt="Visual diff"></td>
</tr>
</table>

<p align="center"><em>Header changed to dark, button turned purple — IBR highlights every pixel that moved.</em></p>

<details>
<summary>See terminal output</summary>
<br>
<img src="https://raw.githubusercontent.com/tyroneross/interface-built-right/main/docs/images/demo-terminal.png" alt="IBR terminal output" width="700">
</details>

## Quick Start

```bash
npm install @tyroneross/interface-built-right
```

That's it. `.ibr/` is auto-added to your `.gitignore` on install.

### Two commands:

```bash
npx ibr start http://localhost:3000    # screenshot your app
# ... edit your code ...
npx ibr check                          # see what changed
```

## Setup as Claude Code Plugin

IBR works standalone, but it's built for Claude Code. As a plugin, it automatically nudges Claude to verify UI changes and suggests IBR over manual screenshots.

**1. Add to your project's `.claude/settings.json`:**

```json
{
  "plugins": ["node_modules/@tyroneross/interface-built-right/plugin"]
}
```

**2. Restart Claude Code. You now have:**

| Command | What it does |
|---------|-------------|
| `/ibr:snapshot` | Capture baseline before making changes |
| `/ibr:compare` | Compare current state against baseline |
| `/ibr:ui` | Open the web dashboard at localhost:4200 |

**3. Use in conversation:**

> "Redesign the header" → Claude captures baseline → makes changes → runs `ibr check` → iterates if `LAYOUT_BROKEN`

The plugin hooks handle the rest — reminding Claude to capture baselines before UI work and verify after.

## What IBR Does For You (Plugin Hooks)

When installed as a Claude Code plugin, IBR silently provides:

- **Bash safety** — blocks destructive commands (`rm -rf /`, `git push --force`, `DROP TABLE`, etc.)
- **Sensitive path protection** — prevents writes to `~/.ssh`, `~/.aws`, `/etc/`
- **UI change detection** — detects when `.tsx`, `.jsx`, `.vue`, `.svelte`, `.css` files are edited
- **Verification reminders** — nudges to run `npx ibr check` after UI changes
- **Session end check** — reminds if UI work was done but IBR wasn't run

All hooks use prompt-based evaluation (not shell scripts), so they never crash or show error messages.

## CLI Reference

### Core Commands

| Command | Description |
|---------|-------------|
| `npx ibr start <url>` | Capture baseline screenshot |
| `npx ibr check` | Compare current state against baseline |
| `npx ibr serve` | Open web UI at localhost:4200 |
| `npx ibr list` | List all sessions |
| `npx ibr update` | Accept current as new baseline |
| `npx ibr clean --older-than 7d` | Clean old sessions |

### Interactive Sessions

For pages that need clicks, typing, or navigation before capturing:

```bash
# Start a persistent browser session
npx ibr session:start http://localhost:3000 --name "search-test"

# Interact with it
npx ibr session:type <id> "input[name=search]" "quantum computing"
npx ibr session:click <id> "button[type=submit]"
npx ibr session:wait <id> ".search-results"
npx ibr session:screenshot <id>
```

<details>
<summary>All interactive commands</summary>

| Command | Description |
|---------|-------------|
| `session:start <url>` | Start browser session |
| `session:click <id> <selector>` | Click an element |
| `session:type <id> <selector> <text>` | Type into an element |
| `session:press <id> <key>` | Press keyboard key |
| `session:scroll <id> <direction>` | Scroll page |
| `session:screenshot <id>` | Capture screenshot |
| `session:wait <id> <selector>` | Wait for element |
| `session:navigate <id> <url>` | Navigate to URL |
| `session:html <id>` | Get page HTML |
| `session:text <id> <selector>` | Extract text content |
| `session:close <id\|all>` | Close session |

</details>

### Memory (UI Preferences)

Store UI expectations that IBR enforces during scans:

```bash
# Remember that buttons should be blue
npx ibr memory add "Primary buttons are blue" --category color --property background-color --value "#3b82f6"

# List stored preferences
npx ibr memory list

# IBR checks these during every scan
```

### Authenticated Pages

```bash
npx ibr login http://localhost:3000/login   # opens browser, log in manually
npx ibr start http://localhost:3000/dashboard  # captures with your auth
npx ibr logout                                 # clear saved auth
```

## Verdicts

After `ibr check`, you get one of four results:

| Verdict | Meaning | Action |
|---------|---------|--------|
| `MATCH` | Nothing changed | You're done |
| `EXPECTED_CHANGE` | Changes look intentional | Review and continue |
| `UNEXPECTED_CHANGE` | Something changed that shouldn't have | Investigate |
| `LAYOUT_BROKEN` | Major structural issues | Fix before continuing |

## Programmatic API

```typescript
import { compare } from '@tyroneross/interface-built-right';

const result = await compare({
  url: 'http://localhost:3000/dashboard',
  baselinePath: './baselines/dashboard.png',
});

console.log(result.verdict);     // "MATCH" | "EXPECTED_CHANGE" | ...
console.log(result.diffPercent); // 2.5
console.log(result.summary);    // "Header background changed. Layout intact."
```

<details>
<summary>Session-based workflow</summary>

```typescript
import { InterfaceBuiltRight } from '@tyroneross/interface-built-right';

const ibr = new InterfaceBuiltRight({
  baseUrl: 'http://localhost:3000',
  outputDir: './.ibr',
  threshold: 1.0,
});

const { sessionId } = await ibr.startSession('/dashboard', {
  name: 'dashboard-update',
});

// After changes
const report = await ibr.check(sessionId);
console.log(report.analysis.verdict);

await ibr.close();
```

</details>

## Configuration

Optional — create `.ibrrc.json` in your project root:

```json
{
  "baseUrl": "http://localhost:3000",
  "outputDir": "./.ibr",
  "viewport": "desktop",
  "threshold": 1.0,
  "fullPage": true
}
```

Available viewports: `desktop`, `laptop`, `tablet`, `mobile`, `iphone-14`, `iphone-14-pro-max`

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Command not found: ibr` | Use `npx ibr --help` |
| Playwright browsers not installed | `npx playwright install chromium` |
| Auth state expired | `npx ibr login <url>` |
| Session not found | `npx ibr list` to see available sessions |

## Requirements

- Node.js 18+
- Playwright (installed automatically with IBR)

## License

MIT
