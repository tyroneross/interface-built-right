---
name: ui-ux-guidance
description: Use when planning, designing, implementing, or auditing UI/UX with IBR in Codex. Provides the latest compact IBR guidance for Calm Precision, web archetypes, interaction states, mobile, content states, data visualization, Mockup Gallery targets, and imagegen approval gates.
---

# IBR UI/UX Guidance

Use this before implementing non-trivial interface work. The goal is a testable design contract: what the UI is for, how it is structured, which guidance applies, and how it will be validated.

## Guidance Order

Apply guidance in this order:

1. User-stated requirements and existing project design system.
2. Approved Mockup Gallery targets.
3. Explicitly approved imagegen visual concepts.
4. Platform conventions: web, mobile web, iOS, macOS, or cross-platform.
5. Product archetype defaults.
6. Calm Precision structural rules.
7. Component patterns and local templates.
8. Data visualization guidance when charts, KPIs, dashboards, rankings, trends, or analytical search responses are present.

Do not let style references override functional integrity, accessibility, real data constraints, or platform conventions unless the user explicitly chooses that tradeoff.

## Web Archetypes

Classify the web surface before design:

| Archetype | Use for | Default bias |
|---|---|---|
| `saas-dashboard` | recurring product overview and operations | dense content grid, restrained chrome |
| `data-research-tool` | search, evidence review, source comparison | compact filters + provenance-first results |
| `editor-workbench` | artifact creation, builder, canvas, IDE-like tool | primary canvas/document + subordinate panels |
| `ai-agent-chat` | chat, task delegation, tool output, artifacts | conversation + execution/artifact state |
| `commerce-checkout` | purchase or conversion path | minimal steps, high trust, clear errors |
| `content-publication` | docs, editorial, marketing content | readable body, subordinate nav |
| `internal-admin` | CRUD, queues, moderation, support tooling | compact tables/lists, safe bulk actions |

If a screen looks like a dashboard but the main job is inspecting evidence, choose `data-research-tool`. If it looks like chat but the main job is editing an artifact, choose `editor-workbench`.

Detailed installed references live under `references/web-design/` when deeper guidance is needed.

## Calm Precision Core

- Exactly one L1 anchor per page.
- L2 navigation and controls must stay visually subordinate to L1.
- L3 primary content should occupy at least 60% of the mobile viewport.
- L4 support content must hide, collapse, or move below primary content on mobile.
- Related list items share one group border with internal dividers; avoid individual borders when the items are one scannable group.
- Content units use three-line hierarchy: title, description, metadata.
- Content-to-chrome ratio should be about 70/30 or better.
- Touch targets are at least 44px on mobile.
- Button labels are Verb + Object, 3 words or fewer.
- Status should usually be text color plus meaning, not filled badges.
- Non-functional controls must be hidden, disabled, marked as demo/coming soon, or backed by a real endpoint.
- Motion must communicate state or affordance and respect reduced motion.

## Target Roles

| Role | Meaning | Validation |
|---|---|---|
| `wireframe-target` | approved low-fidelity layout, flow, hierarchy | semantic/layout scan; no pixel-perfect match |
| `visual-target` | approved hi-fi visual target | `/ibr:match` plus screenshot review |
| `inspiration` | non-binding direction | no pass/fail |
| `data-reference` | content/data shape to implement | verify real source mapping |

Never implement unrated or rejected mockups as binding targets. Ask the user to approve one or proceed scratch-first.

## Imagegen Concepts

Use imagegen only for mood, style, hero/product imagery, or hi-fi visual variants. Generated images:

- are `inspiration` by default
- become `visual-target` only after explicit user approval
- are never `wireframe-target`
- do not replace text-accurate specs, accessibility semantics, interaction requirements, or validation evidence

## Interaction And State Design

Every interactive element needs a working action, real destination, or clear disabled/demo state.

Loading states:

| Wait | State |
|---|---|
| under 100ms | none |
| 100ms-1s | spinner or subtle pulse |
| 1s-3s | skeleton matching final structure |
| over 3s | progress or step status with specific copy |

Errors use what -> why -> fix. Empty states use context: first-time value + setup CTA, search broadening, filter reset with total count, or all-done next step.

## Mobile

- Start with mobile base styles; breakpoints add complexity.
- Inputs use at least 16px text to avoid iOS zoom.
- Primary actions are reachable and do not cover primary content.
- Tables become cards, pinned-key tables, or horizontal scroll with an overflow hint.
- Sidebars become bottom sheets, disclosures, or below-content sections.

## Data Visualization

Use a chart only when it reveals a pattern, comparison, trend, distribution, correlation, flow, density, balance, or attribution faster than text. Require at least 3 comparable data points unless showing a simple 2-part composition.

| Relationship | Preferred visual |
|---|---|
| single metric | KPI callout |
| trend | line or sparkline |
| ranking | horizontal bar |
| comparison | grouped bar |
| part-to-whole | stacked bar or small donut |
| correlation | scatter |
| attribution | waterfall |
| flow | funnel or ordered steps |
| density | heatmap |
| hierarchy | treemap |

Every chart needs an insight title, context line, visual, focal annotation when useful, and source attribution.

## Validation Contract

Before calling UI work done, choose the narrowest proof:

- `scan` for layout, styles, semantic state, a11y, handlers, and console issues
- `observe` for actionable controls
- `interact` or `interact_and_verify` for specific UI behavior
- `flow_search`, `flow_form`, or `flow_login` for task flows
- `match` for approved `visual-target`
- `native_scan` or `scan_macos` for native surfaces

Report remaining gaps explicitly when a tool cannot run.
