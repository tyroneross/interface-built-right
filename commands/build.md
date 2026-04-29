---
description: UI-focused build orchestrator. Sequences preamble -> optional imagegen concepts -> design director -> brainstorm/plan -> implement -> validate/iterate. Uses Calm Precision, platform routers, web archetypes, data-viz guidance, Mockup Gallery targets, and approved generated concepts as first-class inputs.
argument-hint: <topic> [--from=build-loop]
---

# /ibr:build

## Purpose

Guided UI build flow. IBR acts as the design planner first, then the implementation validator. The command turns user intent, platform rules, Mockup Gallery targets, optional imagegen concepts, and Calm Precision guidance into a concrete design contract before code is written.

## Modes

### Standalone (default)

Runs all phases.

### Subordinate (`--from=build-loop` or env `BUILD_LOOP_CONTEXT=1`)

Skips open-ended brainstorming when `.build-loop/specs/<topic>.md` already exists. Still runs Design Director target resolution before implementation, because target roles and validation gates are IBR-owned.

## Phases

### Phase 1 — Preamble

Invoke `ui-brainstorm-preamble` skill. Writes `.ibr/builds/<topic>/preamble.json`.

Capture platform, scope, design mode, target fidelity, archetype hints, references, Mockup Gallery selection, optional imagegen concept need, and density.

### Phase 2 — Optional Imagegen Concept Pass

Run only when the user wants visual exploration, a hi-fi visual direction, product/hero imagery, or style variants and no approved visual target already exists.

1. Load the `imagegen` skill.
2. Generate bitmap concepts as preview-only assets unless the user named a project destination.
3. Save selected project-bound concepts under `.ibr/builds/<topic>/references/imagegen/`.
4. Ask the user to approve one concept before it becomes a binding `visual-target`.
5. Record rejected or unapproved concepts as `inspiration` only.

Do not use imagegen for deterministic wireframes, exact text-heavy UI, accessibility semantics, or validation. Generated imagery cannot replace `scan`, `interact`, `match`, or native validation.

### Phase 3 — Design Director

Invoke `design-director`. Writes:

```text
.ibr/builds/<topic>/design-intent.json
.ibr/builds/<topic>/specialists/flow.md
.ibr/builds/<topic>/specialists/visual-system.md
.ibr/builds/<topic>/specialists/interaction-states.md
.ibr/builds/<topic>/specialists/content-states.md
.ibr/builds/<topic>/specialists/validation-plan.md
```

Add optional specialist files when relevant:

```text
.ibr/builds/<topic>/specialists/mockup-targets.md
.ibr/builds/<topic>/specialists/imagegen-concepts.md
.ibr/builds/<topic>/specialists/data-viz.md
```

Design Director resolves:

- primary user goal and primary action
- platform and archetype guidance
- reference roles: `wireframe-target`, `visual-target`, `inspiration`, `data-reference`
- imagegen concept roles: approved concept as `visual-target`, unapproved concept as `inspiration`
- Calm Precision focus areas
- ask gates and validation criteria

If a target choice is ambiguous, ask before implementation. Otherwise record the assumption in `design-intent.json`.

### Phase 4 — Brainstorm & Plan

If standalone:

1. Invoke `superpowers:brainstorming` with `preamble.json` and `design-intent.json` as locked context.
2. Save spec to `.ibr/builds/<topic>/spec.md`.
3. Invoke `superpowers:writing-plans` and save plan to `.ibr/builds/<topic>/plan.md`.

If subordinate:

1. Read `.build-loop/specs/<topic>.md`.
2. Convert or reference it from `.ibr/builds/<topic>/plan.md`.
3. Preserve `design-intent.json` as the UI contract.

### Phase 5 — Implement

For each task in `plan.md`:

1. Read `design-intent.json` and relevant specialist files first.
2. Load UI guidance from `.ibr/ui-guidance/active.md` when present.
3. Load `design-guidance` and `component-patterns`.
4. Route platform guidance:
   - Web: load `web-design-router`; load `mobile-web-ui` for responsive/mobile surfaces.
   - iOS: load `ios-design`, `ios-design-router`, and `apple-platform`; read `references/ios-design/` domain files as needed.
   - macOS: load `macos-ui` and `apple-platform`.
   - Cross-platform: choose the dominant runtime, then validate platform-specific deviations explicitly.
5. If charts, KPIs, dashboards, or analytical responses are present, load `data-visualization`.
6. Apply Mockup Gallery target roles:
   - `wireframe-target`: implement layout, hierarchy, and semantic structure.
   - `visual-target`: implement visual match after approved hi-fi selection.
   - `inspiration`: use as non-binding direction.
   - `data-reference`: verify real data mapping.
7. Apply imagegen concept roles:
   - approved concept: use as a `visual-target` only after explicit approval.
   - unapproved concept: use as `inspiration` only.
8. Write code.

Do not implement unrated or rejected mockups as binding targets. Do not implement generated concepts as binding targets without explicit user approval.

### Phase 6 — Validate & Iterate

After implementation:

1. Run `/ibr:scan` and write result to `iterations/<n>/scan.json`.
2. If `wireframe-target` exists, run semantic/layout comparison and write `iterations/<n>/wireframe-match.json`.
3. If `visual-target` exists, run `/ibr:match` and write `iterations/<n>/visual-match.json`.
4. If platform is iOS/macOS, run `/ibr:native-scan` and write `iterations/<n>/native.json`.
5. If primary flow exists, run an interaction test or session and write `iterations/<n>/interaction.json`.
6. Merge into `iterations/<n>/report.json`.
7. Decide: pass / iterate / surface-to-user.
   - Pass: continue to capture learnings.
   - Iterate: invoke `ibr:iterate` to fix; loop hard cap = 5.
   - Surface-to-user: print failing items and ask.

## Capture Learnings

On clean pass, summarize rules the user enforced during iteration. Ask for opt-in before appending project overrides to `.ibr/ui-guidance/active.md`. No auto-append.

If the build matched a Mockup Gallery selection, call `mockup-gallery-bridge` `recordImplementation`.

## State

All under `.ibr/builds/<topic>/`:

```text
preamble.json
design-intent.json
spec.md
plan.md
refs.json
references/
specialists/
iterations/<n>/report.json
```

## Errors

- Spec missing in subordinate mode -> error with path pointer; do not fall through silently.
- Iteration cap hit -> print failing items and ask user: continue / accept / abort.
- UI Guidance library missing -> warn and fall back to Calm Precision defaults.
- Mockup target unrated/rejected -> ask user for approval or proceed scratch-first.
- Imagegen concept unapproved -> keep as inspiration or ask user to approve a visual target.
- UI wants real data but only mock data exists -> mark demo/prototype or stop.

## Examples

```text
/ibr:build dashboard
/ibr:build checkout-flow --from=build-loop
```
