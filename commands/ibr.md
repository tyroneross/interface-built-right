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

## Available subcommands

- **`/ibr:build-baseline`** — Create baselines for all pages and identify key UI elements across the app
- **`/ibr:build`** — UI-focused build orchestrator. Sequences preamble → superpowers brainstorming → 
- **`/ibr:cancel-iterate`** — Cancel an active IBR iterative refinement loop
- **`/ibr:capture`** — Capture external design references — screenshot a URL, extract full HTML/CSS, or
- **`/ibr:compare-browsers`** — Scan a URL in both Chrome and Safari, then diff screenshots and element counts t
- **`/ibr:full-interface-scan`** — Fully scan all UI pages and test every component for functionality, accessibilit
- **`/ibr:generate-test`** — Generate a declarative .ibr-test.json test file by observing interactive element
- **`/ibr:interact`** — Run interaction assertions on a live page — click X, verify Y happened
- **`/ibr:iterate`** — Run one iteration of a test-fix loop and detect convergence (stagnant, oscillati
- **`/ibr:match`** — Compare a design mockup PNG against a live rendered web page using SSIM and pixe
- **`/ibr:native-scan`**
- **`/ibr:only-use-ibr`** — Enforce IBR-only for capture and validation tasks. Blocks Playwright screenshot/
- **`/ibr:prefer-ibr`** — Enable soft IBR preference. Claude will prefer IBR for UI validation and capture
- **`/ibr:record-change`** — Record a structured design change specification for later verification
- **`/ibr:replicate`** — Build UI from an uploaded reference image or extracted HTML. Use when user has u
- **`/ibr:run-script`** — Execute a Python test script with sandboxed CPU and memory limits
- **`/ibr:scan`** — Run a comprehensive end-to-end UI scan on a URL
- **`/ibr:setup-hooks`** — Configure Claude Code hooks for better IBR experience
- **`/ibr:test`** — Run a declarative .ibr-test.json test file against a live URL
- **`/ibr:ui-audit`** — Run a comprehensive end-to-end UI audit on an app's workflows
- **`/ibr:ui-guidance`** — List, show, or promote IBR UI Guidance templates. Central library at `/Users/tyr
- **`/ibr:ui`** — Launch the IBR design validation dashboard to view scan results, comparisons, an
- **`/ibr:update`** — Update IBR to the latest version
- **`/ibr:verify-changes`** — Verify all recorded design changes against the live page


## Examples

- User types `/ibr` alone → list subcommands, ask for direction
- User types `/ibr <free-form request>` → match intent, invoke subcommand
- User types `/ibr:<specific>` → bypass this router entirely (direct invocation)

## Rules

- Prefer the most specific subcommand match. If two could fit, ask which.
- Never invent a new subcommand. Only route to ones listed above.
- If the user is describing a workflow that spans multiple subcommands, outline the sequence and ask whether to proceed.
