---
description: UI-focused build orchestrator. Sequences preamble → design target → spec/plan → implement → validate/iterate. Runs standalone or subordinate to /build-loop. Uses UI Guidance and Mockup Gallery as first-class inputs.
argument-hint: <topic> [--from=build-loop]
---

# /ibr:build

## Purpose

Guided UI build flow. Composes existing IBR skills with UI Guidance, Mockup Gallery, superpowers brainstorming, and writing-plans. See `docs/strategy/mockup-gallery-integration.md` for the current operating model and `docs/superpowers/specs/2026-04-13-ibr-build-design.md` for the original build design.

## Modes

### Standalone (default)

Runs all six phases.

### Subordinate (`--from=build-loop` or env `BUILD_LOOP_CONTEXT=1`)

Uses `.build-loop/goal.md`, `.build-loop/state.json`, and `.build-loop/specs/<topic>.md` as engineering context. Still runs the IBR preamble/design-target checks unless `.ibr/builds/<topic>/refs.json` already has one required target. Skips standalone Spec and Plan phases, then jumps to Implement.

## Ownership

| Layer | Owns in this workflow |
|---|---|
| Build Loop | Outer engineering context, dependency order, validation scoring |
| IBR | UI orchestration, implementation guidance, scan/match/native validation |
| Mockup Gallery | Wireframe/high-fidelity candidates, ratings, final mockup selection |
| UI Guidance | Reusable visual direction, density, token guidance |

## Phases

### Phase 1 — Preamble

Invoke `ui-brainstorm-preamble` skill. Writes `.ibr/builds/<topic>/preamble.json`.

Ask the user only when platform, scope, product outcome, design target, or validation method is unclear and cannot be inferred from local files.

### Phase 2 — Design Target

Create `.ibr/builds/<topic>/brief.json` from the preamble, existing app context, and any external references.

Use `mockup-gallery-bridge`:

1. If `.mockup-gallery/selected.json` already has a selection for the topic or scope, add it to `.ibr/builds/<topic>/refs.json`.
2. If no selection exists and this is new UI or the layout direction is ambiguous, write/read a gallery request and ask the user to review candidates in Mockup Gallery.
3. Prefer wireframe candidates first. Request or use high fidelity only when visual styling affects implementation.

Reference roles decide validation:

| Role | Meaning | Validation |
|---|---|---|
| `inspiration` | Directional reference only | no pass/fail |
| `wireframe-target` | Selected structure/layout target | semantic-layout scan |
| `visual-target` | Selected high-fidelity target | `ibr match` against PNG plus scan |
| `data-reference` | Extracted HTML/CSS/token source | implementation guidance |

Do not run `ibr match` against HTML, JSON, or wireframe-only references.

### Phase 3 — Spec

Invoke `superpowers:brainstorming` with preamble as pre-filled context. When superpowers writes its spec, save to `.ibr/builds/<topic>/spec.md` (override default path).

The selected design target and `refs.json` must be included in the brainstorm context.

### Phase 4 — Plan

Invoke `superpowers:writing-plans` with spec path `.ibr/builds/<topic>/spec.md`. Save plan to `.ibr/builds/<topic>/plan.md`.

### Phase 5 — Implement

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
4. Invoke `ibr:component-patterns` + `ibr:design-implementation` as guidance in scope
5. If `refs.json` has a `wireframe-target` or `visual-target` with structured HTML/JSON, optionally call `/ibr:replicate` to seed markup
6. Write code

### Phase 6 — Validate & Iterate

After Implement completes:

1. Run `/ibr:scan` — write result to `iterations/<n>/scan.json`
2. If `refs.json` has a `wireframe-target` — validate layout regions, hierarchy, states, and available actions from scan output
3. If `refs.json` has a `visual-target` with a PNG — run `/ibr:match` — write to `iterations/<n>/match.json`
4. If platform is iOS/macOS — run `/ibr:native-scan` — write to `iterations/<n>/native.json`
5. Merge into `iterations/<n>/report.json`
6. Decide: pass / iterate / surface-to-user
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
brief.json
spec.md
plan.md
refs.json
references/
iterations/<n>/report.json
```

## Errors

- Spec missing in subordinate mode → error with path pointer, do not fall through to brainstorming
- No gallery selection and multiple plausible designs → ask user to pick or run Mockup Gallery
- Visual-target missing PNG → ask for a PNG or downgrade to wireframe semantic validation
- Iteration cap hit → print failing items + SSIM diff if present, ask user: continue / accept / abort
- UI Guidance library missing → warn, fall back to Calm Precision defaults

## Examples

```
/ibr:build dashboard
/ibr:build checkout-flow --from=build-loop
```
