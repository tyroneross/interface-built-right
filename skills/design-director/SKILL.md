---
name: design-director
description: Use when starting a UI build, planning a page or flow, choosing design guidance, resolving mockup-gallery or imagegen concept targets, or acting as the primary IBR design agent. Produces design intent, specialist planning passes, target roles, and validation criteria before implementation.
version: 0.1.0
user-invocable: false
---

# Design Director

Primary design-agent layer for IBR. Use before implementation when the work is larger than a small isolated component, when references conflict, or when the user expects IBR to initiate and plan the design.

The Design Director does not replace platform skills, Calm Precision, or component patterns. It chooses which guidance matters for this build, records the design intent, then hands implementation a tighter target.

## Activation

Activate when:

- `/ibr:build` starts a page, flow, app, dashboard, redesign, or design-from-scratch task
- The user asks "what should this UI be", "plan the design", "make design decisions", or "use IBR as the design agent"
- Multiple references exist and IBR must decide which one is layout, visual, inspiration, or data evidence
- A Mockup Gallery selection exists
- An imagegen concept was requested or generated
- The UI includes data visualization, complex state, onboarding, checkout, auth, editor/workbench, or multi-step flow behavior

Skip for a tiny edit with an obvious target, such as changing one label, one color token, or one icon.

## Guidance Selection Order

Resolve guidance in this order. Higher rows override lower rows only when they are explicit and applicable.

1. User-stated requirements and project design system
2. Approved Mockup Gallery targets
3. Explicitly approved imagegen visual target concepts
4. Platform router: iOS, macOS, web, mobile web, or cross-platform
5. Product archetype router: iOS archetype or web archetype
6. Calm Precision 6.4.1 structural rules
7. Component patterns and local templates
8. Data visualization guidance, only when charts or metrics are part of the UI
9. Presentation/deck guidance, only as hierarchy/data-storytelling input for screen design

Do not let a stylistic reference override functional integrity, accessibility, real data constraints, or platform conventions unless the user explicitly chooses that tradeoff.

Generated image concepts are never structural evidence. Use them for mood, visual direction, imagery, and hi-fi target candidates only. They become binding `visual-target` refs only after explicit user approval.

## Required Artifacts

For `/ibr:build`, write these files under `.ibr/builds/<topic>/` when the scope is page, flow, app, or dashboard:

```text
design-intent.json
specialists/flow.md
specialists/visual-system.md
specialists/interaction-states.md
specialists/content-states.md
specialists/validation-plan.md
```

Add these only when relevant:

```text
specialists/mockup-targets.md
specialists/imagegen-concepts.md
specialists/data-viz.md
```

For component-only work, an inline design intent section in `plan.md` is enough unless references conflict.

## Design Intent Schema

`design-intent.json` is the implementation contract:

```json
{
  "topic": "...",
  "platform": "web|iOS|macOS|cross-platform",
  "scope": "component|page|flow|app",
  "designMode": "scratch|wireframe|hifi|implementation",
  "archetype": "...",
  "primaryUserGoal": "...",
  "primaryAction": "...",
  "contentPriority": ["..."],
  "navigationModel": "...",
  "layoutTarget": "wireframe-target|none",
  "visualTarget": "visual-target|none",
  "imagegenConcepts": [{"path": "...", "role": "inspiration|visual-target", "approved": false}],
  "calmPrecisionFocus": ["..."],
  "dataVizNeeded": false,
  "askGates": ["..."],
  "validationCriteria": ["..."]
}
```

## Specialist Passes

Run specialist passes as compact planning sections. Do not create separate micro-agents for buttons, fonts, colors, or shadows. Those are handled by component patterns and tokens.

| Pass | Use when | Output |
|---|---|---|
| Flow Planner | page, flow, app, checkout, onboarding, search, auth | user path, states, step count, navigation model |
| Visual System Planner | any new screen or redesign | hierarchy, density, tokens, surface model, typography roles |
| Interaction Planner | interactive controls, forms, sessions, editors | actions, disabled/loading/error/success states, keyboard/touch behavior |
| Content States Planner | dynamic data, empty/error/loading states | first-time, search-empty, filter-empty, all-done, error copy pattern |
| Mockup Liaison | Mockup Gallery or external references | ref roles, rating guardrails, scratch/hifi target split |
| Imagegen Concept Liaison | generated visual concepts are requested or present | prompt brief, approved/rejected concepts, role assignment, limitations |
| Data Viz Planner | charts, metrics, dashboards, analytical responses | chart-worthiness, chart type, data sufficiency, attribution |
| Validation Critic | always for page/flow/app | scan, match, native scan, interaction test, acceptance gates |

## Mockup Target Roles

Treat references as typed targets:

| Role | Meaning | Validation |
|---|---|---|
| `wireframe-target` | layout, flow, hierarchy, information architecture | semantic/layout scan; compare structure and primary content order |
| `visual-target` | approved hi-fi visual target | `/ibr:match` plus screenshot review |
| `inspiration` | style or idea source, not binding | no match requirement |
| `data-reference` | source for real content or metrics | verify provenance and field mapping |

Never implement an unrated or rejected Mockup Gallery mockup as a target. If only unrated/rejected references exist, ask the user to approve one or proceed scratch-first.

## Imagegen Concept Roles

Treat imagegen outputs as typed references:

| Role | Meaning | Validation |
|---|---|---|
| `inspiration` | generated style, mood, imagery, or composition direction | no match requirement |
| `visual-target` | user-approved generated hi-fi visual target | `/ibr:match` plus screenshot review |

Do not assign `wireframe-target` to imagegen output. For structure, use an explicit wireframe, design intent, component patterns, or semantic layout plan.

## Ask Gates

Ask the user before implementation when:

- There are multiple plausible primary users or primary actions
- The target reference role is ambiguous
- The selected Mockup Gallery item is unrated, rejected, or missing `changeNote`
- A generated image concept would become a binding `visual-target` but has not been approved
- Platform choice affects navigation or interaction model
- A feature would look interactive but lacks a real backend/API
- The UI needs real data and only mock data is available

If none of these gates fire, make a conservative decision and record it in `design-intent.json`.

## Validation Contract

The validation plan must include:

- Calm Precision audit focus: grouping, hierarchy, content-chrome, functional integrity, states, mobile/touch, voice
- Platform-specific scan: web scan, native scan, or both
- Reference-specific check: layout/semantic target, visual target, or no target
- Interaction check for primary action and highest-risk secondary action
- Evidence files written to `iterations/<n>/`

Implementation is not complete until validation either passes or the remaining issues are explicitly surfaced to the user.

*ibr - design director*
