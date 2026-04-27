---
name: mockup-gallery-bridge
description: Bridge IBR builds to Mockup Gallery design candidates. Read ratings/selections, create or read design requests, map selected artifacts into IBR refs, and write implementation completion. Never spawns the gallery server — filesystem only.
version: 0.1.0
user-invocable: false
---

# Mockup Gallery Bridge

Read/write contract between IBR and the mockup-gallery plugin's project data. This skill keeps Mockup Gallery responsible for design exploration while IBR remains responsible for implementation and validation.

## Primitives

- `src/mockup-gallery/reader.ts` → `readGallery({ projectDir })`
- `src/mockup-gallery/writer.ts` → `recordImplementation({ projectDir, topic, mockup, commit, passed })`

Current TypeScript primitives cover ratings, selections, and implementation completion. Until dedicated request helpers exist, agents may write/read the request and candidate files directly using the contract below.

## When to Activate

- `/ibr:build` needs a design target before implementation
- `/ibr:build` preamble detects `.mockup-gallery/` or `mockups/` in the project
- User mentions a mockup selection during brainstorm
- `/ibr:match` needs a visual-target PNG from gallery selections
- IBR iteration completes cleanly and has a matched gallery mockup

## Ownership

| System | Owns |
|---|---|
| Mockup Gallery | wireframe/high-fidelity candidates, ratings, selected design artifacts |
| IBR | `brief.json`, `refs.json`, implementation, scan/match validation |
| Build Loop | outer engineering plan and completion criteria |

## Read behavior

- Returns `{present, ratings, selected, warnings}`
- Malformed JSON is recovered with a warning, never throws
- If gallery dir missing, returns `present: false` silently
- `selected` maps topic/scope to selected artifact id or path
- If only `mockups/` exists, treat it as candidate input but not as gallery memory

## Write behavior

- `recordImplementation` appends to `implemented.json` with `{topic, mockup, commit, passed, at}`
- Creates file if absent, preserves prior entries
- Only called on clean build completion with a matched gallery mockup

## Design request contract

IBR writes one request per build topic when no suitable selection exists:

```text
.mockup-gallery/requests/<topic>.json
```

Minimum shape:

```json
{
  "topic": "checkout-flow",
  "platform": "web|iOS|macOS|cross-platform",
  "scope": "component|page|flow|app",
  "goal": "user outcome",
  "density": "compact-dense|balanced|spacious-marketing",
  "requestedFidelity": "wireframe|wireframe+hifi",
  "references": [],
  "constraints": [],
  "questions": []
}
```

Mockup Gallery writes candidates under:

```text
.mockup-gallery/candidates/<topic>/<candidate-id>/
  wireframe.png
  wireframe.html
  wireframe.json
  hifi.png
  hifi.html
  hifi.json
```

High-fidelity files are optional. Wireframe files are expected first.

## Mapping to IBR refs

Add selected artifacts to `.ibr/builds/<topic>/refs.json` with explicit roles:

| Ref role | Fidelity | Validation method |
|---|---|---|
| `wireframe-target` | `wireframe` | `semantic-layout` |
| `visual-target` | `hifi` | `ssim-match` |
| `inspiration` | any | none |
| `data-reference` | any | none |

Only refs with `role: "visual-target"` and a PNG image should trigger `/ibr:match`.

Wireframe targets are validated by scan evidence: landmarks, layout regions, heading hierarchy, action availability, state coverage, and responsive behavior.

## Question gates

Ask the user when:
- there are multiple selected candidates for the same topic
- no selection exists and the next implementation step depends on layout direction
- high fidelity is needed but only wireframes exist
- the selected artifact lacks the file needed by its validation method
- gallery ratings conflict with the selected artifact

Do not ask when a single selected candidate matches the topic and scope.

## Integration notes

- Never spawns `npx mockup-gallery`. User runs gallery separately.
- Session-scoped data (`.mockup-gallery/sessions/<current>/`) is not read by the current TypeScript primitive. If needed, read it explicitly and include a warning in handoff notes.
