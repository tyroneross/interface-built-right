# Web Design Router Reference

## Archetypes

| Archetype | Best fit | Default layout |
|---|---|---|
| `saas-dashboard` | recurring product overview and operations | sidebar/top tabs + dense content grid |
| `data-research-tool` | search, evidence review, source comparison | search/filter rail + results/evidence area |
| `editor-workbench` | artifact creation, builder, canvas, IDE-like tool | canvas/document primary + subordinate panels |
| `ai-agent-chat` | task delegation, chat, tool output, artifact generation | conversation + execution/artifact panes |
| `commerce-checkout` | purchase or conversion path | minimal stepper + form + summary |
| `content-publication` | docs, editorial, marketing content | article/doc primary + local nav |
| `internal-admin` | CRUD, queues, moderation, support tooling | table/list primary + detail/filters |

## Selection Test

Choose the archetype that answers: "What screen would the user reopen every day to get work done?"

If the answer is "dashboard" but the main job is inspecting evidence, choose `data-research-tool`. If the answer is "chat" but the main job is editing an artifact, choose `editor-workbench`.

## Default Densities

| Archetype | Density |
|---|---|
| `saas-dashboard` | compact or balanced |
| `data-research-tool` | compact |
| `editor-workbench` | balanced workspace, compact chrome |
| `ai-agent-chat` | balanced |
| `commerce-checkout` | spacious around decisions, compact summary |
| `content-publication` | spacious body, compact nav |
| `internal-admin` | compact |

## Validation Focus

| Archetype | Highest-risk failures |
|---|---|
| `saas-dashboard` | unlabeled metrics, decorative charts, crowded chrome |
| `data-research-tool` | missing provenance, unclear filters, weak empty states |
| `editor-workbench` | panel clutter, fake controls, lost unsaved state |
| `ai-agent-chat` | unclear running/error state, non-functional tool actions |
| `commerce-checkout` | form errors, trust gaps, distraction near primary action |
| `content-publication` | poor heading order, unreadable line length, nav dominance |
| `internal-admin` | unsafe bulk actions, small touch targets, hidden filters |
