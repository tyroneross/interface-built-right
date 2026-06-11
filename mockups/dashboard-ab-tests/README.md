# Dashboard A/B/C Mockups

Purpose: quick dashboard variants for IBR scan experiments across layout density, hierarchy, data visualization, interaction states, and design-reference routing.

## Branch and Merge Inventory

- Local `main` and `origin/main` are aligned at `692c941`.
- No local branches are unmerged into `main`.
- No remote branches are unmerged into `main`.
- No additional worktrees exist for this repository.
- Existing local noise before this mockup pass: `.build-loop/state.json` and `.codex/`.

## Guidance Used

- `UI Guidance/skills/web/SKILL.md`: `saas-dashboard` and `data-research-tool` archetype routing, semantic HTML, dashboard layout, responsive behavior.
- `UI Guidance/skills/hierarchy/SKILL.md`: L1/L2/L3 content hierarchy, non-color hierarchy, whitespace as structure.
- `UI Guidance/skills/components/SKILL.md`: one primary action, button states, touch target sizing.
- `UI Guidance/skills/data-viz/SKILL.md`: decision-first chart titles, direct labeling, tabular numbers, status as text color.
- `UI Guidance/skills/states/SKILL.md`: default, hover, focus, selected, disabled, loading, empty, and warning states.
- `UI Guidance/references/modes/glass-workspace.md`: used for Variant B only.
- `UI Guidance/references/modes/data-narrative.md`: used for Variant C only.

## Variants

| Variant | File | Design Question |
|---|---|---|
| A | `dashboard-a-compact-ops.html` | Does IBR prefer dense operational dashboard structure with a stable sidebar, grouped metrics, and a table-first work area? |
| B | `dashboard-b-evidence-workbench.html` | Does IBR catch multi-pane evidence workflow quality, glass styling restraint, action coverage, and inspector hierarchy? |
| C | `dashboard-c-data-narrative.html` | Does IBR reward decision-first chart titles, dark-to-light narrative structure, and bento hierarchy? |

## Open Locally

Open `index.html` directly in a browser. No server is required.

```bash
open mockups/dashboard-ab-tests/index.html
```

For IBR CLI scanning, use file URLs or serve the directory with any static server.
