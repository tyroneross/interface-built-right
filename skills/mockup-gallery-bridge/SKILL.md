---
name: mockup-gallery-bridge
description: Use when /ibr:build detects .mockup-gallery/ or IBR needs to tie a build to gallery-selected mockups. Reads ratings/selections, enforces approved target roles, preserves scratch-first workflow, and writes implementation completion. Filesystem only.
version: 0.2.0
user-invocable: false
---

# Mockup Gallery Bridge

Read/write contract between IBR and the Mockup Gallery plugin's project data. Mockup Gallery is the upstream design-target stage. IBR owns implementation and validation against the selected target roles.

Imagegen may create upstream bitmap concepts for IBR, but it does not replace Mockup Gallery review. Generated concepts are local IBR references unless the user explicitly imports or approves them through the gallery workflow.

## Primitives

- `src/mockup-gallery/reader.ts` -> `readGallery({ projectDir })`
- `src/mockup-gallery/writer.ts` -> `recordImplementation({ projectDir, topic, mockup, commit, passed })`

## When To Activate

- `/ibr:build` detects `.mockup-gallery/`
- User mentions a gallery selection or review batch
- Design Director needs to resolve reference roles
- `/ibr:match` needs an approved visual target
- IBR iteration completes cleanly and has a matched gallery mockup

## Read Behavior

- Returns `{present, ratings, selected, warnings}`
- Malformed JSON is recovered with a warning, never throws
- Missing gallery dir returns `present: false`
- Session-scoped data may be absent; treat missing session data as non-blocking

## Rating Guardrails

| Gallery state | IBR behavior |
|---|---|
| approved/selected | eligible as target |
| rated positive but not selected | eligible as inspiration; ask before binding |
| unrated | not binding; ask user before implementation |
| rejected | never implement as target unless user explicitly overrides |
| missing `changeNote` for iteration | ask what changed before treating it as a new target |

Never implement unrated or rejected mockups as binding targets by default.

## Target Roles

Assign one role per reference:

| Role | Meaning | IBR validation |
|---|---|---|
| `wireframe-target` | low-fidelity structure, layout, flow, hierarchy | semantic/layout scan; no pixel-perfect requirement |
| `visual-target` | approved hi-fi visual target | `/ibr:match` and screenshot review |
| `inspiration` | optional style or idea source | no match requirement |
| `data-reference` | evidence for real content, values, or labels | provenance and field mapping |

Scratch/wireframe mockups should be used before hi-fi variants for new batches. IBR should prefer filenames such as `00-scratch-*`, `01-scratch-*`, `lo-fi-*`, or `wireframe-*` as `wireframe-target` candidates when available.

Imagegen outputs cannot be `wireframe-target`. If a generated image is explicitly approved, it may become a `visual-target`; otherwise keep it as `inspiration`.

## Design Director Handoff

Write the resolved target summary into `.ibr/builds/<topic>/specialists/mockup-targets.md`:

```text
Selected target:
- mockup:
- rating:
- role:
- changeNote:
- validation:
- askGate:
```

Add target role IDs to `design-intent.json`:

```json
{
  "layoutTarget": "wireframe-target|none",
  "visualTarget": "visual-target|none",
  "references": [
    {"path": "...", "role": "wireframe-target", "rating": "approved"}
  ]
}
```

## Write Behavior

`recordImplementation` appends to `implemented.json` with `{topic, mockup, commit, passed, at}`.

Call only when:

- implementation validation passed or accepted
- target mockup was approved/selected or explicitly approved by the user
- the implementation topic and mockup identity are known

## Integration Notes

- Never spawn `npx mockup-gallery`; user runs gallery separately.
- Do not rewrite gallery ratings or selections.
- IBR can read gallery state and record implementation completion, but review decisions remain in Mockup Gallery.
- Do not write imagegen outputs into Mockup Gallery state unless a separate user-approved gallery import workflow exists.

*ibr - mockup gallery bridge*
