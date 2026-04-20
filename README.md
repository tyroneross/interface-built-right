<p align="center">
  <strong>╦╔╗ ╦═╗</strong><br>
  <strong>║╠╩╗╠╦╝</strong><br>
  <strong>╩╚═╝╩╚═</strong>
</p>

<h1 align="center">Interface Built Right</h1>

<p align="center">
  End-to-end design tool for AI coding agents.<br>
  Design, build, and validate interfaces — iOS, macOS, and web. Guided builds, deterministic rules, sensor-driven scans.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@tyroneross/interface-built-right"><img src="https://img.shields.io/npm/v/@tyroneross/interface-built-right" alt="npm"></a>
  <a href="https://github.com/tyroneross/interface-built-right/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@tyroneross/interface-built-right" alt="license"></a>
  <img src="https://img.shields.io/node/v/@tyroneross/interface-built-right" alt="node">
</p>

---

IBR is an end-to-end design tool for AI coding agents. It guides UI builds with archetype-based iOS design routing, Calm Precision principles, and platform-specific best practices. Built-in visual validation scans live pages, runs interaction assertions, matches mockups, and verifies design intent — Chrome and Safari.

Built on a custom CDP engine — no Playwright. Works from terminal, Codex, Claude Code slash commands, or code. Zero config.

## Design Workflow

`/ibr:build <topic>` orchestrates the full design-to-validation flow:

1. **Preamble** — Platform, scope, app archetype (iOS: Utility/Content/Productivity/Consumer/Editorial/Tool), UI template, density
2. **Brainstorm** — Guided exploration with platform-specific design rules
3. **Plan** — Implementation plan with component sequence
4. **Implement** — Build with design guidance: HIG rules (`ios-design`), architecture patterns (`apple-platform`), domain-specific option catalogs (`references/ios-design/`)
5. **Validate** — Scan, match mockups, test interactions, iterate until passing

### iOS Design System

The `ios-design-router` skill classifies apps into 6 archetypes, each with pre-set defaults for navigation, color, typography, motion, and more. Domain reference files provide comprehensive option catalogs:

| Domain | Reference | Covers |
|--------|-----------|--------|
| Navigation | `1_navigation_structure.md` | Tab bars, transitions, sheets, page hierarchy |
| Content | `2_lists_cards_content.md` | Lists, cards, swipe actions, content resilience |
| Interactions | `3_buttons_touch_interactions.md` | Buttons, haptics, toggles, forms |
| Visual | `4_color_surface_typography.md` | Color, gradients, dark mode, typography |
| Motion & States | `5_motion_states_identity.md` | Loading, onboarding, celebrations, profiles |
| Task Economy | `6_task_economy.md` | Step counting, flow validation |

## Two-Tier Architecture

IBR scans return structured data, not just raw element dumps. Two layers run on every scan:

### Tier 1 — Deterministic Rule Engine (no LLM)

Runs pure algorithms against the runtime data. Zero tokens. Returns structured verdicts with evidence.

| Rule Preset | What It Checks | Algorithm |
|-------------|---------------|-----------|
| `wcag-contrast` | Text contrast ratios, AA and AAA | WCAG 2.1 relative luminance |
| `touch-targets` | Interactive element sizing | 44px mobile (WCAG 2.5.5), 24px desktop (WCAG 2.5.8) |
| `calm-precision` | Gestalt, Signal-to-Noise, Fitts, Hick, Content-Chrome, Cognitive Load | Principle-based checks |

Enable via `.ibr/rules.json`:

```json
{
  "extends": ["wcag-contrast", "touch-targets", "calm-precision"]
}
```

Or one-off via CLI:

```bash
ibr scan http://localhost:3000 --rules wcag-contrast,touch-targets
```

Output in `scanResult.issues` with `ruleId`, `severity`, `message`, `element`, and `fix` fields.

### Tier 2 — Sensor Layer (structured summaries)

Pre-computed summaries that let the model focus on judgment instead of re-discovering patterns:

| Sensor | What It Produces | Token Saving |
|--------|------------------|--------------|
| `visualPatterns` | Groups elements by style fingerprint per category (button, link, input, heading) | Replaces N element dumps with M pattern groups |
| `componentCensus` | Tag/role counts + orphan cursor:pointer elements with no handler | Replaces grep across pages |
| `interactionMap` | Handler coverage — which interactive-looking elements actually have handlers | Pre-computed from handler detection |
| `contrast` | WCAG pass/fail grouped, only failures listed | Model skips passing elements |
| `navigation` | Link structure with depth and counts | Replaces reading Sidebar.tsx |
| `semanticState` | Wraps existing semantic classifier: page intent, states, available actions | Summary form |
| `oneLiners` | 5-second scannable summary lines | Read first, then drill down |

Access in `scanResult.sensors`. Get summaries-only (cuts ~60% tokens):

```bash
ibr scan http://localhost:3000 --output summary
```

## Hydration Waiting

SPAs (Next.js, React, Vue) often render after `networkidle` fires. IBR's `waitForHydration()` runs after network idle:

1. Fast-path marker detection: `window.__NEXT_DATA__`, React DevTools hook, `#__next` / `#root` population
2. AX tree fingerprint polling until stable for 500ms with at least one interactive element
3. Settle time (200ms default) to absorb async effects

This eliminates the common "0 elements" result on modern SPAs.

## Live Sessions with Auto-Capture

Sessions now auto-capture pre/post interaction by default:

```bash
ibr session start http://localhost:3000
ibr session interact --action click --target "Submit"
# Automatically: pre-scan baseline -> action -> URL change detection -> hydration wait -> post-scan -> surface console errors
ibr session close
```

Each `ActionRecord` includes:
- `navigated: boolean` — did the click cause a URL change?
- `urlBefore` / `urlAfter`
- `actionErrors: string[]` — console errors that appeared during this action

Opt out with `--no-auto-capture` on `session start`.

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
| **Interact (MCP + CLI)** | `ibr interact` / MCP `interact` | Click, type, fill elements by accessible name. LLM-native interaction |
| **Observe (MCP + CLI)** | `ibr observe` / MCP `observe` | Preview all clickable/fillable elements before interacting |
| **Extract (MCP + CLI)** | `ibr extract` / MCP `extract` | Read page headings, buttons, inputs, links as structured data |
| **Interact & Verify (MCP)** | MCP `interact_and_verify` | Act + capture before/after state diff (elements added/removed) |
| **Interaction assertions** | `ibr test-interact` | Click, type, verify — act→verify→screenshot pipeline |
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

## What's New in v1.0.0

| Feature | Command / Usage | What it does |
|---------|----------------|-------------|
| **End-to-end design tool** | Positioning update | From "visual testing platform" to design + build + validate |
| **iOS design system** | `/ibr:build` with platform=iOS | 6-archetype router, 7 domain reference files covering navigation, lists, buttons, color, motion, task economy |
| **apple-platform skill** | Loaded during iOS builds | Architecture, SwiftData, concurrency, CI/CD, TestFlight — integrated from standalone apple-dev |
| **Deterministic rule engine** | `ibr scan --rules wcag-contrast,touch-targets` | WCAG AA/AAA contrast, touch target sizes. No LLM tokens |
| **Sensor layer** | `scanResult.sensors` | Visual patterns, component census, interaction map, contrast report, navigation, one-liners |
| **Summary output mode** | `ibr scan --output summary` | Returns sensors + verdict, cuts ~60% of tokens |
| **Hydration wait** | Built into `ibr scan` | Fixes "0 elements" on SPAs; polls AX tree stability + detects Next.js/React markers |
| **Auto-capture sessions** | Default on | Pre/post scan with URL-change detection and console error surfacing |

## What's New in v0.9.0-alpha

| Feature | Command / Skill | What it does |
|---------|----------------|-------------|
| **Build command** | `/ibr:build <topic>` | Guided UI build — brainstorm, plan, implement, verify in one flow |
| **Capture command** | `/ibr:capture <url>` | Capture a named baseline snapshot for any URL |
| **UI guidance** | `/ibr:ui-guidance` | On-demand design guidance using IBR scan data |
| **UI brainstorm preamble** | skill: `ui-brainstorm-preamble` | Pre-build exploration — explore directions before implementing |
| **UI guidance library** | skill: `ui-guidance-library` | Reusable UI guidance patterns and decision aids |
| **Mockup gallery bridge** | skill: `mockup-gallery-bridge` | Bridge mockup gallery reviews to IBR scan verification |
| **Mobile web UI** | skill: `mobile-web-ui` | Mobile web patterns — responsive design, touch targets, viewport handling |
| **iOS Design** | skill: `ios-design` | iOS-specific patterns — SwiftUI conventions, safe areas, haptics |
| **macOS UI** | skill: `macos-ui` | macOS-specific patterns — AppKit/SwiftUI, menu bar, window chrome |

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

### Sandbox-friendly browser attach

Use `connect` mode when the agent can reach a Chrome DevTools endpoint but should not spawn Chrome itself.

```bash
npx ibr scan http://localhost:3000 \
  --browser-mode connect \
  --cdp-url http://127.0.0.1:9222
```

You can also provide a browser WebSocket directly:

```bash
npx ibr scan http://localhost:3000 \
  --browser-mode connect \
  --ws-endpoint ws://127.0.0.1:9222/devtools/browser/<id>
```

Environment variables are supported for sandboxed agents and wrappers:

```bash
IBR_BROWSER_MODE=connect
IBR_CDP_URL=http://127.0.0.1:9222
IBR_WS_ENDPOINT=ws://127.0.0.1:9222/devtools/browser/<id>
IBR_CHROME_PATH=/path/to/chrome
```

`--headed` is now the preferred flag for a visible browser window. `--sandbox` remains as a deprecated alias for backwards compatibility.

## Setup as Claude Code Plugin

IBR works standalone, but it's built for Claude Code. As a plugin, it guides UI builds with archetype-based routing and validates implementations automatically.

**1. Add the marketplace (one-time):**

```
/plugin marketplace add tyroneross/interface-built-right
```

**2. Install the plugin:**

```
/plugin install ibr@interface-built-right
```

**3. Use in conversation:**

| Command | What it does |
|---------|-------------|
| `/ibr:build <topic>` | Guided UI build: preamble → brainstorm → plan → implement → validate |
| `/ibr:scan <url>` | Full page scan with sensor summaries and optional rule checks |
| `snapshot` / `compare` MCP tools | Before/after regression check (also `npx ibr start` / `npx ibr check`) |
| `/ibr:interact` | Click, type, fill by accessible name |
| `/ibr:match` | Compare rendered UI against a mockup (SSIM) |
| `/ibr:native-scan` | Scan iOS/watchOS/macOS apps |
| `/ibr:ui` | Open the web dashboard at localhost:4200 |

**Example:**

> "Build a daily focus timer for iOS" -> `/ibr:build` classifies it as a Utility archetype -> routes to iOS design references -> implements with apple-platform patterns -> scans the result, reports any WCAG / touch target / hydration issues.

The plugin hooks run automatic pre/post scans around UI file edits and surface console errors immediately when interactions trigger them.

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

## Codex

This package now ships an additive Codex plugin surface alongside the existing Claude Code package. The Claude package remains authoritative for Claude behavior; the Codex package adds a parallel `.codex-plugin/plugin.json` install surface without changing the Claude runtime.

Package root for Codex installs:
- the repository root (`.`)

Primary Codex surface:
- skills from `./skills` when present
- MCP config from `./.mcp.json` when present

Install the package from this package root using your current Codex plugin install flow. The Codex package is additive only: Claude-specific hooks, slash commands, and agent wiring remain unchanged for Claude Code.

