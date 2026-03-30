<p align="center">
  <strong>╦╔╗ ╦═╗</strong><br>
  <strong>║╠╩╗╠╦╝</strong><br>
  <strong>╩╚═╝╩╚═</strong>
</p>

<h1 align="center">Interface Built Right</h1>

<p align="center">
  Visual testing platform for AI coding agents.<br>
  Scan, interact, match mockups, verify design intent, generate tests — Chrome + Safari.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@tyroneross/interface-built-right"><img src="https://img.shields.io/npm/v/@tyroneross/interface-built-right" alt="npm"></a>
  <a href="https://github.com/tyroneross/interface-built-right/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@tyroneross/interface-built-right" alt="license"></a>
  <img src="https://img.shields.io/node/v/@tyroneross/interface-built-right" alt="node">
</p>

---

IBR is a visual testing platform for AI coding agents. It scans live pages, runs interaction assertions (click X → verify Y), matches mockups against reality (SSIM), captures design intent and verifies it, auto-generates tests from page observation, and works across Chrome and Safari.

Built on a custom CDP engine — no Playwright. Works from terminal, Claude Code slash commands, or code. Zero config.

## Architecture

IBR runs on a custom **CDP browser engine** — direct Chrome DevTools Protocol over WebSocket. No Playwright, no Puppeteer, no heavyweight browser automation dependencies.

**LLM-native features** built into the engine:

| Feature | What it does |
|---------|-------------|
| **queryAXTree-first resolution** | Find elements by semantic name+role (not fragile CSS selectors). 4-tier: CDP-native search → Jaro-Winkler fuzzy → vision fallback |
| **DOM chunking** | Filter to interactive/leaf elements, chunk for LLM context windows. 60-70% fewer tokens |
| **Adaptive modality** | Scores AX tree quality. High → use text data. Low → include screenshot. Vision only when needed |
| **Resolution cache** | Caches intent→element mappings. Same query twice = instant. Clears on navigation |
| **observe()** | Preview available actions without executing. Returns serializable descriptors |
| **extract()** | Pull structured data from AX tree using schemas |

## What's New in v0.7.0

| Feature | Command | What it does |
|---------|---------|-------------|
| **Interaction assertions** | `ibr interact` | Click, type, verify — act→verify→screenshot pipeline |
| **Mockup matching** | `ibr match` | Compare design mockup PNG against live page (SSIM) |
| **Design verification** | `ibr record-change` / `ibr verify-changes` | Capture design intent, verify against reality |
| **Test generation** | `ibr generate-test` | Auto-generate .ibr-test.json from page observation |
| **Test runner** | `ibr test` | Run declarative test files |
| **Python scripting** | `ibr run-script` | Execute Python test scripts with sandboxed resources |
| **Fix-and-iterate** | `ibr iterate` | Convergence detection for test-fix cycles |
| **Safari support** | `--browser safari` | Cross-browser via safaridriver + macOS AX API |
| **Cross-browser diff** | `ibr compare-browsers` | Side-by-side Chrome vs Safari comparison |
| **AX tree coverage** | Built into `ibr scan` | Reports AX tree capture %, shadow DOM piercing |
| **Flow testing** | `ibr test-search/form/login` | Built-in flows exposed as CLI commands |
| **Playwright removed** | -- | Zero Playwright dependency, custom CDP engine only |

See [docs/QUICK-START.md](docs/QUICK-START.md) for full usage guide.

## The Problem

User says "make the buttons blue with 16px Inter font." You build it. But did it work?

- **Screenshots** — you're guessing hex codes from pixels
- **Manual inspection** — slow, error-prone, not automatable
- **IBR scan** — returns `backgroundColor: "rgb(59, 130, 246)"`, `fontSize: "16px"`, `fontFamily: "Inter"`. Done.

## How It Works

```bash
# User describes what they want -> you build it -> validate with IBR
npx ibr scan http://localhost:3000/page --json
```

IBR returns structured data per element:
- **computedStyles** — backgroundColor, fontSize, fontFamily, padding, grid, flexbox, etc.
- **bounds** — exact x, y, width, height
- **interactive** — hasOnClick, hasHref, hasReactHandler, isDisabled
- **a11y** — role, ariaLabel, ariaDescribedBy
- **page-level** — pageIntent, auth state, loading state, console errors

**For regression**, capture before and compare after:

```bash
npx ibr start http://localhost:3000    # baseline before changes
# ... edit your code ...
npx ibr check                          # see what changed
```

Verdicts: `MATCH`, `EXPECTED_CHANGE`, `UNEXPECTED_CHANGE`, `LAYOUT_BROKEN`

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

### Validate UI (primary workflow):

```bash
npx ibr scan http://localhost:3000 --json    # get structured data
```

### Regression check:

```bash
npx ibr start http://localhost:3000    # capture baseline
# ... make changes ...
npx ibr check                          # compare
```

## Setup as Claude Code Plugin

IBR works standalone, but it's built for Claude Code. As a plugin, it automatically validates UI changes against what the user described and guides you to combine scan data with visual checks for complete coverage.

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
| `/ibr:full-interface-scan` | Scan all pages, test every component |
| `/ibr:build-baseline` | Create baselines with element catalog |
| `/ibr:ui` | Open the web dashboard at localhost:4200 |

**3. Use in conversation:**

> "Make the header dark with a purple CTA" -> Claude builds it -> runs `npx ibr scan` -> checks `backgroundColor` on header and button -> confirms match or iterates

The plugin hooks handle the rest — nudging Claude to validate after UI work and suggesting scan data alongside visual checks for thorough coverage.

## What IBR Does For You (Plugin Hooks)

When installed as a Claude Code plugin, IBR provides:

- **Design validation reminders** — after UI file edits, nudges to run `npx ibr scan` to verify against user intent
- **Scan + screenshot guidance** — suggests also running IBR scan for precise property data alongside visual checks
- **Session end check** — reminds if UI work was done but not validated
- **Bash safety** — blocks destructive commands (`rm -rf /`, `git push --force`, etc.)
- **Sensitive path protection** — prevents writes to `~/.ssh`, `~/.aws`, `/etc/`

All hooks use prompt-based evaluation (not shell scripts), so they never crash or show error messages.

## What IBR Scan Returns

### Element Data (per interactive element)
```
selector:        Unique CSS path
tagName:         button, a, input, etc.
text:            Visible text content
bounds:          { x, y, width, height } — exact position and size
computedStyles:  backgroundColor, color, fontSize, fontFamily, fontWeight,
                 padding, margin, borderRadius, display, gap, flexDirection,
                 alignItems, justifyContent, gridTemplateColumns, etc.
interactive:     { hasOnClick, hasHref, hasReactHandler, isDisabled, cursor }
a11y:            { role, ariaLabel, ariaDescribedBy, ariaHidden }
```

### Page-Level Data
```
pageIntent:      auth | form | listing | detail | dashboard | error | landing
state.auth:      { authenticated, username, confidence }
state.loading:   { loading, type: spinner|skeleton|progress }
state.errors:    { hasErrors, errors[], severity }
console:         { errors[], warnings[] }
verdict:         PASS | ISSUES | FAIL
```

## Scan Data vs Screenshots

Each approach catches things the other misses. The best validation uses both.

### Where IBR scan wins

| Question | Screenshot | IBR Scan |
|----------|-----------|----------|
| Is this exactly #3b82f6? | Guess from pixels | `backgroundColor: "rgb(59, 130, 246)"` |
| Is the font 16px Inter? | "Looks about right" | `fontSize: "16px"`, `fontFamily: "Inter"` |
| Is the button wired up? | Can't tell | `hasOnClick: true`, `hasReactHandler: true` |
| Are ARIA labels present? | Can't see | `ariaLabel: "Submit form"`, `role: "button"` |
| Any console errors? | Can't see | `console.errors: []` |

### Where screenshots win

| Question | IBR Scan | Screenshot |
|----------|---------|-----------|
| Does the page *look* right? | Can't judge | Visual coherence at a glance |
| Any rendering glitches? | Computed styles can be correct but render wrong | Sees clipping, overlap, z-index issues |
| Canvas/SVG/WebGL content? | Not in the DOM | Sees everything rendered |
| Font rendering quality? | Reports font-family, not rendering | Sees anti-aliasing, kerning |
| Unexpected visual artifacts? | Only checks what you ask | Catches things you didn't think to check |

### Best practice: combine both

```bash
npx ibr scan http://localhost:3000 --json    # precise property verification
# + screenshot for visual confirmation when needed
```

For AI agents, scan data is best for precise verification (exact values, handler detection, a11y). Screenshots are best for holistic visual checks. Together they give more confidence than either alone.

## CLI Reference

### Core Commands

| Command | Description |
|---------|-------------|
| `npx ibr scan <url> --json` | Validate UI — returns structured data |
| `npx ibr start <url>` | Capture baseline for regression |
| `npx ibr check` | Compare current state against baseline |
| `npx ibr serve` | Open web UI at localhost:4200 |
| `npx ibr list` | List all sessions |
| `npx ibr update` | Accept current as new baseline |
| `npx ibr clean --older-than 7d` | Clean old sessions |

### Interactive Sessions

For pages that need clicks, typing, or navigation before validating:

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

### Memory (Design Specs)

Store design preferences that IBR enforces during every scan:

```bash
# Remember that buttons should be blue
npx ibr memory add "Primary buttons are blue" --category color --property background-color --value "#3b82f6"

# Store font preference
npx ibr memory add "Body font is Inter 16px" --property font-family --value "Inter"

# List stored specs
npx ibr memory list

# IBR checks these during every scan automatically
```

### Authenticated Pages

```bash
npx ibr login http://localhost:3000/login   # opens browser, log in manually
npx ibr scan http://localhost:3000/dashboard --json  # validates with your auth
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
<summary>Engine API (advanced)</summary>

```typescript
import { EngineDriver, CompatPage } from '@tyroneross/interface-built-right/engine';

// Direct CDP engine access
const driver = new EngineDriver();
await driver.launch({ headless: true, viewport: { width: 1920, height: 1080 } });

// Navigate with stability detection
await driver.navigate('http://localhost:3000', { waitFor: 'stable' });

// Discover interactive elements (LLM-optimized)
const elements = await driver.discover({
  filter: 'interactive',
  serialize: true,        // compact format for context windows
  maxTokens: 4000,
});

// Find elements by intent (not CSS selectors)
const button = await driver.find('Submit', { role: 'button' });

// Assess page understanding quality
const understanding = await driver.assessUnderstanding();
if (understanding.needsScreenshot) {
  const screenshot = await driver.screenshot({ fullPage: true });
}

// Extract structured data
const data = await driver.extract({
  title: { role: 'heading', extract: 'text' },
  isLoggedIn: { role: 'button', label: 'logout', extract: 'exists' },
});

await driver.close();
```

</details>

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
| Chrome not found | Install Google Chrome, or pass `chromePath` option |
| Auth state expired | `npx ibr login <url>` |
| Session not found | `npx ibr list` to see available sessions |

## Requirements

- Node.js 22+ (uses built-in WebSocket for CDP)
- Google Chrome installed (uses system Chrome, no downloads needed)

## License

MIT
