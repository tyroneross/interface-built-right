---
description: UI-focused build orchestrator. Sequences preamble → superpowers brainstorming → writing-plans → implement → validate/iterate. Runs standalone or subordinate to /build-loop. Uses the UI Guidance library and mockup-gallery selections as first-class inputs.
argument-hint: <topic> [--from=build-loop]
---

# /ibr:build

## Purpose

Guided UI build flow. Composes existing IBR skills with superpowers brainstorming and writing-plans. See `docs/superpowers/specs/2026-04-13-ibr-build-design.md` for full design.

## Modes

### Standalone (default)

Runs all five phases.

### Subordinate (`--from=build-loop` or env `BUILD_LOOP_CONTEXT=1`)

Skips phases 1–3. Reads spec from `.build-loop/specs/<topic>.md`. Jumps to Implement.

## Phases

### Phase 1 — Preamble

Invoke `ui-brainstorm-preamble` skill. Writes `.ibr/builds/<topic>/preamble.json`.

### Phase 2 — Brainstorm

Invoke `superpowers:brainstorming` with preamble as pre-filled context. When superpowers writes its spec, save to `.ibr/builds/<topic>/spec.md` (override default path).

### Phase 3 — Plan

Invoke `superpowers:writing-plans` with spec path `.ibr/builds/<topic>/spec.md`. Save plan to `.ibr/builds/<topic>/plan.md`.

### Phase 4 — Implement

For each task in `plan.md`:

1. Load UI guidance: read `.ibr/ui-guidance/active.md`
2. **iOS design routing** (when `preamble.platform === "iOS"`):
   - Load `ios-design` skill (HIG rules)
   - Load `apple-platform` skill (architecture patterns)
   - Based on the current component type being built, Read the appropriate reference from `${CLAUDE_PLUGIN_ROOT}/references/ios-design/` per the router's domain reference routing table:
     - Navigation work → `1_navigation_structure.md`
     - List/card/content work → `2_lists_cards_content.md`
     - Button/form/interaction work → `3_buttons_touch_interactions.md`
     - Color/typography/visual work → `4_color_surface_typography.md`
     - Loading/states/animation/onboarding work → `5_motion_states_identity.md`
     - Any multi-step flow → `6_task_economy.md` (always validate step count)
   - Apply archetype defaults from `preamble.iosDefaults`
3. **macOS design routing** (when `preamble.platform === "macOS"`):
   - Load `macos-ui` skill
   - Load `apple-platform` skill (architecture patterns)
4. Invoke `ibr:component-patterns` + `ibr:scan-while-building` as guidance in scope
5. If a `validation-target` ref exists in `refs.json`, optionally call `/ibr:replicate` to seed markup
6. Write code

### Phase 5 — Validate & Iterate

After Implement completes:

1. Run `/ibr:scan` — write result to `iterations/<n>/scan.json`
2. If `refs.json` has validation-target — run `/ibr:match` — write to `iterations/<n>/match.json`
3. If platform is iOS/macOS — run `/ibr:native-scan` — write to `iterations/<n>/native.json`
4. Merge into `iterations/<n>/report.json`
5. Decide: pass / iterate / surface-to-user
   - Pass: continue to capture-learnings
   - Iterate: invoke `ibr:iterate` to fix; loop (hard cap = 5)
   - Surface-to-user: print failing items, ask

### Capture learnings (on clean pass)

Summarize any rules the user enforced during iteration. Ask user for opt-in to append them as project overrides in `.ibr/ui-guidance/active.md`. No auto-append.

If the build matched a mockup-gallery selection, call `mockup-gallery-bridge` `recordImplementation`.

## State

All under `.ibr/builds/<topic>/`:
```
preamble.json
spec.md
plan.md
refs.json
references/
iterations/<n>/report.json
```

## Errors

- Spec missing in subordinate mode → error with path pointer, do not fall through to brainstorming
- Iteration cap hit → print failing items + SSIM diff, ask user: continue / accept / abort
- UI Guidance library missing → warn, fall back to Calm Precision defaults

## Examples

```
/ibr:build dashboard
/ibr:build checkout-flow --from=build-loop
```
