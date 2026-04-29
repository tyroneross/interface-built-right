---
name: web-design-router
description: Use when planning or building web UI, web apps, dashboards, SaaS tools, AI chat interfaces, editors, content sites, checkout flows, or internal admin screens. Classifies the web archetype and loads default layout, hierarchy, state, and validation rules.
version: 0.1.0
user-invocable: false
---

# Web Design Router

Classify the web interface before implementation. The archetype determines density, navigation, state design, content priority, and validation focus. Use this with `design-director`, `design-guidance`, `component-patterns`, and `mobile-web-ui`.

## Archetype Classifier

Ask "What is the user trying to do most often on this screen?" Then choose one primary archetype.

| Archetype | Use for | Primary design bias |
|---|---|---|
| `saas-dashboard` | product dashboards, operations, account overview | dense, scannable, action-adjacent metrics |
| `data-research-tool` | search, analysis, evidence review, intelligence tools | source-first, filters visible, provenance clear |
| `editor-workbench` | builders, canvases, IDE-like tools, creative editors | workspace-first, panels subordinate to artifact |
| `ai-agent-chat` | chat, agent console, task delegation, tool output | conversation + artifacts, clear execution state |
| `commerce-checkout` | shopping, pricing, checkout, conversion flows | trust, step clarity, low distraction |
| `content-publication` | docs, blogs, editorial, marketing content | reading hierarchy, navigation scent, restrained chrome |
| `internal-admin` | CRUD, support tooling, review queues | tables, filters, bulk actions, speed over decoration |

If two archetypes apply, choose the one tied to the user's primary recurring task. Record the secondary as a constraint, not the main route.

## Defaults By Archetype

| Archetype | Navigation | L1 anchor | L3 primary content | Validation focus |
|---|---|---|---|---|
| `saas-dashboard` | sidebar or top tabs | page title + key metric | metric groups, tables, alert lists | content-chrome, metric labels, empty states |
| `data-research-tool` | search-first with filters | query/result context | results, sources, evidence panels | provenance, filter reset, source attribution |
| `editor-workbench` | persistent toolbars/panels | artifact title or active mode | canvas/document/work area | panel overflow, keyboard actions, unsaved state |
| `ai-agent-chat` | conversation scoped nav | task or thread title | transcript, tool cards, artifacts | running/done/error states, non-fake actions |
| `commerce-checkout` | minimal step nav | checkout/product action | form, summary, trust signals | form errors, disabled state, step economy |
| `content-publication` | top nav + local TOC | article/doc title | body content | readability, focus, heading order |
| `internal-admin` | sidebar + table controls | queue/entity title | table or record detail | bulk action safety, filters, dense scanning |

## Web Defaults

Apply these unless the project design system overrides them:

- One L1 anchor per page.
- L2 navigation and controls must be visually subordinate to L1.
- L3 primary content gets at least 60% of mobile viewport and at least 70% content-chrome ratio overall.
- L4 supporting panels hide, collapse, or move below content on mobile.
- Touch targets are at least 44px on mobile and 24px desktop minimum.
- Inputs use at least 16px font on mobile.
- Tables become cards, pinned key columns, or horizontal scroll with clear overflow affordance on narrow screens.
- Button labels use Verb + Object and stay at 3 words or fewer.
- Motion communicates state or interactivity; decorative motion is removed.

## Reference Routing

When more detail is needed, read:

- `references/web-design/0_router.md` for archetype defaults and routing
- `references/web-design/1_information_architecture.md` for page hierarchy, navigation, and content-chrome
- `references/web-design/2_interaction_states.md` for buttons, forms, loading, error, and empty states
- `references/web-design/3_visual_system.md` for typography, spacing, grouping, and surface rules
- `references/web-design/4_content_states_voice.md` for UI copy, status, error, and empty-state voice
- `references/web-design/5_data_visualization.md` when charts, metrics, or dashboards are present

## Output

Add to `design-intent.json`:

```json
{
  "webArchetype": "...",
  "webDefaults": {
    "navigation": "...",
    "primaryContent": "...",
    "density": "compact|balanced|spacious",
    "mobileStrategy": "stack|bottom-sheet|table-scroll|card-list",
    "validationFocus": ["..."]
  }
}
```

If classification is uncertain and the choice changes navigation or information architecture, ask the user. Otherwise choose the safest archetype and record the assumption.

*ibr - web design router*
