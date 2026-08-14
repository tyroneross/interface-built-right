---
name: artifact-diagramming
description: Use when a page needs a diagram — architecture, data flow, sequence, state machine, before/after comparison — or when asked to draw, sketch, or illustrate a mechanism inside an artifact, report, or self-contained HTML page. Covers whether a diagram earns its place, what to depict, and the inline SVG mechanics that stay legible in both themes.
version: 0.1.0
user-invocable: false
---

# Artifact Diagramming

Draw as the engineer who has to live with the decision, not as a decorator.

A diagram earns its place when it lets a cold reader see a mechanism they would
otherwise have to assemble from prose: where data flows, which components talk,
what changes between two options, what state a request moves through. **If a
sentence says it faster, write the sentence.**

## What to draw

**Depict the mechanism, not its name.** A box labeled "cache" says less than the
prose. The path a request takes through it, the two stores it sits between, and
the arrow that disappears when the cache is removed say what words cannot. Show
the parts the argument hinges on — the boundary being crossed, the hop being
added, the data that moves. Leave out the rest.

**Comparing options? Draw the difference.** Two architectures side by side, a
before and an after, the one edge each option adds or removes. The reader should
be able to point at what they are choosing between. A labeled box per option with
nothing connecting them to the system is a restated option list, not a comparison.

**Match complexity to the stakes.** A one-hop question is a three-box diagram. A
migration that reroutes writes through a queue needs the queue, the writer, the
reader, and the ordering arrow. No forced minimalism; no inventory of the whole
system either.

**Label the arrows.** An unlabeled arrow means "related somehow". `writes`,
`invalidates`, `polls every 30s` is information. `AS509` flags straight edges whose
midpoint has no nearby label. A legend earns its space only when the same encoding
(dashed, colored, doubled) repeats; otherwise put the meaning on the mark.

## Which renderer

| Destination | Use | Why |
|---|---|---|
| `claude-artifact` fragment | inline SVG, or a `mermaid` block | the viewer renders mermaid natively |
| `standalone` HTML file | **inline SVG only** | no mermaid renderer exists off-viewer (`AX009`) |
| `markdown` publish | ` ```mermaid ` fence | rendered by the markdown lane |

Inline SVG is the portable answer and the only one that survives every profile.
Reach for it by default; mermaid is a convenience that costs you portability.

For diagrams **generated from source** — repository architecture, dependency
graphs, call maps — do not hand-author. Use the `diagram-intelligence` plugin,
which discovers a typed graph from authorized source and renders Mermaid, DOT,
HTML, or SVG from it. Hand-authoring is for the diagram that argues a point;
generation is for the diagram that reports a structure.

## Inline SVG mechanics

Hand-author `<svg>` with native shapes (`rect`, `circle`, `line`, `polyline`,
`path`) and `<text>`. No libraries, no runtime, no external images.

**Size by `viewBox`.** Set `viewBox="0 0 W H"` and let CSS scale it
(`max-width: 100%; height: auto`). Choose W and H for the content, not a preset.
Wide flows read left to right; layered stacks read top to bottom.
(`AS501`, `AS502`.)

**Theme with `currentColor`.** Strokes, text, and arrowheads in `currentColor`
inherit the page foreground in both themes. Reserve a literal hue for the one
element that carries meaning — the option leaned toward, the hop under discussion —
and check it reads on both grounds. (`AS508` — one accent is the budget.)

**Arrowheads are markers or polygons**, referenced by a fragment-internal id —
never an image (`AS510`):

```html
<defs>
  <marker id="tip" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
    <polygon points="0,0 8,4 0,8" fill="currentColor"/>
  </marker>
</defs>
<line x1="86" y1="45" x2="126" y2="45" stroke="currentColor" marker-end="url(#tip)"/>
```

**Keep text legible.** Roughly 11–13px at the drawn scale (`AS507`), `text-anchor`
for alignment, labels of a word or three. Explanatory sentences go in the caption,
not the drawing.

**Align to a grid.** Shared baselines and even gaps are most of what makes a hand
diagram read as deliberate. Eyeballed offsets read as noise. Pick a step (say 40
units), place everything on it, and keep arrow midpoints where labels can sit.

**One figure, one claim.** Wrap the `<svg>` in `<figure>` with a `<figcaption>`
stating what the picture shows (`AS506`), and give the `<svg>` `role="img"` plus an
`aria-label` carrying the same claim for readers who cannot see it (`AS505`).

**Stay self-contained.** No `<script>`, `<style>`, or `<foreignObject>` inside the
SVG (`AS503`); gradients, patterns, and `<use>` reference ids in the same fragment
(`AS504`). Long decorative path data means the drawing wants a real graphics
tool — simplify instead.

## Worked shape

```html
<figure>
  <svg viewBox="0 0 320 90" role="img"
       aria-label="The gauge writes to the ledger, which the reconciler reads hourly.">
    <defs>
      <marker id="tip" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
        <polygon points="0,0 8,4 0,8" fill="currentColor"/>
      </marker>
    </defs>
    <rect x="4" y="26" width="80" height="38" fill="none" stroke="currentColor"/>
    <text x="44" y="50" text-anchor="middle" font-size="12" fill="currentColor">gauge</text>
    <line x1="86" y1="45" x2="126" y2="45" stroke="currentColor" marker-end="url(#tip)"/>
    <text x="106" y="38" text-anchor="middle" font-size="11" fill="currentColor">writes</text>
    <rect x="128" y="26" width="80" height="38" fill="none" stroke="currentColor"/>
    <text x="168" y="50" text-anchor="middle" font-size="12" fill="currentColor">ledger</text>
    <line x1="210" y1="45" x2="250" y2="45" stroke="currentColor" marker-end="url(#tip)"/>
    <text x="230" y="38" text-anchor="middle" font-size="11" fill="currentColor">reads</text>
    <rect x="252" y="26" width="64" height="38" fill="none" stroke="currentColor"/>
    <text x="284" y="50" text-anchor="middle" font-size="12" fill="currentColor">almanac</text>
  </svg>
  <figcaption>The reconciler reads the ledger; it never touches the gauge.</figcaption>
</figure>
```

Everything on a 40-unit vertical centre, boxes on a shared baseline, every arrow
labeled with its verb, one colour token for the whole drawing.

## Verify

```bash
R="${CLAUDE_PLUGIN_ROOT:-$PWD}"
python3 "$R/scripts/artifact_lint.py" check page.html --min-severity info
python3 "$R/scripts/artifact_lint.py" rules --profile standalone   # AS5xx section
```

The `AS5xx` rules judge only *diagram-like* SVGs — those containing at least one
`<text>` node. Plain icons are exempt, so a decorative glyph will not be graded as
a failed diagram.

`AS507`, `AS508`, `AS509`, and `AS506` are heuristics at `info`/`warn`; they point
you at something to look at, they do not render a verdict. `AS503` and `AS504` are
errors because a script or an external href inside the SVG is broken in every
profile, with no judgment involved.
