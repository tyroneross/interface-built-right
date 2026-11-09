# Default process-diagram owner

Use `diagram-intelligence:diagram-intelligence` by default for process-flow,
workflow, data-flow, and sequence diagrams created through IBR. This includes
both observed systems and proposed processes. Apply the same route on Claude,
Codex, and other hosts; the user can request another tool or format.

Resolve the skill from the host's available catalog and read its `SKILL.md`.
Use its source discovery, canonical graph, view planning, rendering, and
semantic QA workflow. Preserve source evidence, edge IDs and direction; label
proposed or inferred behavior and distinguish user triggers, explicit host
calls, automatic processing, and external systems. Split a dense graph into
an overview and focused views rather than placing every connection in one view.

IBR owns artifact integration, accessibility, theme/portability checks, and
rendered review. Follow `skills/artifact-diagramming/SKILL.md` for inline SVG
mechanics; run artifact lint and inspect the rendered result with IBR. Check
clipped text, edge/label collisions, arrow direction, duplicate SVG IDs, and
narrow-view readability. Graph validation alone does not establish visual fit.

For standalone HTML, use a self-contained renderer or inline SVG; a bare Mermaid
block has no renderer outside a supporting viewer. For Markdown, Mermaid is a
valid output format. Choosing a format does not bypass the graph mapping step.

If Diagram Intelligence is unavailable, state that limitation and use an
evidence-backed Mermaid or HTML/SVG fallback. Do not claim it ran or install a
dependency automatically. If rendering or IBR review is unavailable, preserve
the graph and state the checks that remain unverified. No model change or
additional vendor API key is required by this route.
