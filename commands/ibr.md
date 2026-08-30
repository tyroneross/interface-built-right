---
name: ibr
description: Main ibr entry. Dispatches to a subcommand based on your request, or lists options if unclear. Use `ibr:<subcommand>` to target a specific action directly.
argument-hint: "[what you want to do]"
---

# /ibr — Router

Route this request to the appropriate ibr subcommand or skill based on the user's intent.

**Raw user input**: $ARGUMENTS

## Routing logic

1. If `$ARGUMENTS` is empty or only whitespace: list the available subcommands below and ask the user what they want to do.
2. Otherwise: match the user's natural-language request against the subcommand intents below and invoke the best match.
3. If the request clearly doesn't fit any subcommand but matches a `ibr` skill (listed in your available skills), load the skill and follow its guidance instead.
4. If nothing fits, say so and list the subcommands. Do NOT guess.

## Design skill routing

- If the request is to initiate, plan, or direct a UI build, route to `/ibr:build` or load `design-director` when the user is not asking to implement yet.
- If the request is web-specific design planning, load `web-design-router` with `design-guidance`.
- If the request includes charts, KPIs, metrics, dashboard data, or analytical visuals, load `data-visualization`.
- If the request references Mockup Gallery selections, load `mockup-gallery-bridge` before choosing a validation target.

## Available subcommands

- **`/ibr:build`** — UI-focused build orchestrator. Sequences preamble → Design Director → plan → implement → validate
- **`/ibr:capture`** — Capture external design references — screenshot a URL, extract full HTML/CSS, or crawl a sitemap
- **`/ibr:screenshot`** — Capture a screenshot of any URL and return the image. Optionally save to the design reference library
- **`/ibr:snapshot`** — Capture a baseline of a URL before making UI changes (for regression verification)
- **`/ibr:compare`** — Compare current page state against baseline and show what changed (regression check)
- **`/ibr:match`** — Compare a design mockup PNG against a live rendered page using SSIM and pixel diff
- **`/ibr:iterate`** — Run one iteration of a test-fix loop and detect convergence (stagnant, oscillating, regressing)
- **`/ibr:cancel-iterate`** — Cancel an active IBR iterative refinement loop
- **`/ibr:ui`** — Launch the IBR design validation dashboard to view scan results, comparisons, and element data
- **`/ibr:artifact`** — Author, check, and port single-file self-contained HTML artifacts
- **`/ibr:prefer-ibr`** — Enable soft IBR preference for UI validation, capture, and semantic interaction
- **`/ibr:only-use-ibr`** — Enforce IBR-only for capture and validation. Blocks Playwright screenshot/snapshot tools
- **`/ibr:feedback`** — Report a bug or send feedback about the ibr plugin

## Capability routing — no subcommand, load the skill

These capabilities have no slash command. Load the named skill and follow it.

- **Scan, audit, validate, check accessibility, find regressions, compare browsers** → load `design-validation`
- **Test a form, login, or search; click through a flow; assert an interaction; generate a test file** → load `interactive-testing`
- **Scan a native iOS / watchOS / macOS app; touch targets; a11y labels** → load `native-testing`
- **List, show, or promote UI Guidance templates** → load `ui-guidance-library`
- **Run the IBR CLI directly; baselines; record or verify a design change; run a test script; install or update IBR** → load `cli-reference`
- **Configure the automatic before/after scan on UI file edits** → load `auto-verify`
- **Build UI from a reference image or extracted HTML** → load `design-reference`, then `design-implementation`

## Examples

- User types `/ibr` alone → list subcommands, ask for direction
- User types `/ibr <free-form request>` → match intent, invoke subcommand
- User types `/ibr:<specific>` → bypass this router entirely (direct invocation)

## Rules

- Prefer the most specific subcommand match. If two could fit, ask which.
- Never invent a new subcommand. Only route to ones listed above.
- If the user is describing a workflow that spans multiple subcommands, outline the sequence and ask whether to proceed.
