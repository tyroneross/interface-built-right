# IBR + Mockup Gallery Operating Model

## Governing Decision

Mockup Gallery owns pre-code design exploration. IBR owns build orchestration, implementation, and validation. Build Loop owns outer engineering orchestration when the UI work is part of a larger multi-step change.

The integration should produce one agent experience without collapsing responsibilities into one folder or one tool.

## Responsibility Map

| Layer | Owns | Does not own | State |
|---|---|---|---|
| Build Loop | Multi-step engineering loop, scoring criteria, dependency order, validation gate | UI design candidate generation, pixel matching details | `.build-loop/` |
| IBR | UI build workflow, design brief, references manifest, implementation guidance, scan/match/native validation | Candidate ranking UI, gallery server, durable gallery memory | `.ibr/builds/<topic>/` |
| Mockup Gallery | Wireframe/high-fidelity candidates, ratings, selection, design memory | App implementation, IBR scan interpretation, Build Loop planning | `.mockup-gallery/` |
| UI Guidance | Reusable style/tone/token guidance | Candidate storage, implementation status | `.ibr/ui-guidance/` |
| Consumer app | Product code and app-specific design system | Tool runtime state | normal project files |

## Workflow

1. Build Loop routes significant UI work to `/ibr:build --from=build-loop`. Standalone UI work starts at `/ibr:build`.
2. IBR captures the minimum context needed to write a design brief: platform, scope, target user outcome, density, template, references, and uncertainty.
3. IBR writes `.ibr/builds/<topic>/brief.json` and `.ibr/builds/<topic>/refs.json`.
4. If the work is a new component/page/flow/app or the visual direction is unclear, IBR creates or reads a Mockup Gallery request.
5. Mockup Gallery produces wireframe candidates first. High-fidelity candidates are optional and only used when visual treatment affects implementation.
6. The selected gallery candidate is added to `refs.json` with an explicit role and validation method.
7. IBR plans and implements against the selected target.
8. IBR validates with the correct method:
   - wireframe target: semantic/layout scan, step count, hierarchy, and interaction availability
   - high-fidelity visual target: `ibr match` against a PNG plus normal scan
   - external inspiration: guidance only unless explicitly marked as a validation target
9. On clean completion, IBR records implementation status back to `.mockup-gallery/implemented.json`.

In subordinate mode, Build Loop supplies engineering context and may skip standalone spec/plan work, but it should not bypass the IBR design-target check unless a required target already exists in `refs.json`.

## Question Gates

Agents should ask the user before proceeding when any of these are true:

- Platform, scope, or target user outcome is unclear.
- No selected mockup exists and there are multiple plausible layout directions.
- A high-fidelity mockup would determine implementation choices, but only wireframes exist.
- A selected mockup conflicts with project UI guidance or an existing design system.
- A reference is marked as a visual target but lacks a PNG for SSIM matching.
- The requested change may overwrite existing prompt, design, or gallery memory.
- The user asks for subjective polish and there is no measurable acceptance target.

Agents should not ask when the answer is recoverable from repository files, existing `refs.json`, or `.mockup-gallery/selected.json`.

## MECE File Structure

IBR build state:

```text
.ibr/builds/<topic>/
  preamble.json          # captured UI axes and question answers
  brief.json             # design brief sent to or derived from Mockup Gallery
  refs.json              # all references with explicit roles and validation methods
  spec.md                # implementation spec
  plan.md                # implementation task plan
  references/            # local copies of external references and selected artifacts
  iterations/<n>/
    scan.json
    match.json
    native.json
    report.json
```

Mockup Gallery state:

```text
.mockup-gallery/
  requests/<topic>.json
  candidates/<topic>/<candidate-id>/
    wireframe.png
    wireframe.html
    wireframe.json
    hifi.png
    hifi.html
    hifi.json
  selected.json
  ratings.json
  implemented.json
```

Reference manifest shape:

```json
{
  "refs": [
    {
      "id": "checkout-wireframe-a",
      "source": "mockup-gallery",
      "role": "wireframe-target",
      "fidelity": "wireframe",
      "artifact": {
        "image": "references/mockups/checkout-wireframe-a.png",
        "html": "references/mockups/checkout-wireframe-a.html",
        "json": "references/mockups/checkout-wireframe-a.json"
      },
      "validation": {
        "method": "semantic-layout",
        "required": true
      }
    },
    {
      "id": "checkout-hifi-a",
      "source": "mockup-gallery",
      "role": "visual-target",
      "fidelity": "hifi",
      "artifact": {
        "image": "references/mockups/checkout-hifi-a.png",
        "html": "references/mockups/checkout-hifi-a.html",
        "json": "references/mockups/checkout-hifi-a.json"
      },
      "validation": {
        "method": "ssim-match",
        "required": true,
        "threshold": 0.85
      }
    }
  ]
}
```

## Agent Rules

- Do not treat every gallery artifact as a pixel target. Only `role: "visual-target"` with `validation.method: "ssim-match"` should invoke `ibr match`.
- Do not use SSIM for wireframes. Validate wireframes through layout regions, hierarchy, action presence, state coverage, and responsive behavior.
- Do not spawn or manage the Mockup Gallery server from IBR. Write/read filesystem artifacts and ask the user to run the gallery when candidate review is needed.
- Do not move Mockup Gallery memory into `.ibr/`. Link to it through `refs.json`.
- Do not let Build Loop bypass IBR for UI work once `/ibr:build --from=build-loop` is selected. Build Loop supplies engineering context; IBR supplies UI workflow.
- Do not silently choose between multiple plausible gallery candidates unless ratings or `selected.json` already make the choice.
