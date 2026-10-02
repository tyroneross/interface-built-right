# Design decisions and audit lessons

Read this when choosing a design direction or auditing an implemented surface.
These IBR adaptations of reviewed lessons are bundled; the source archive is optional.
Current user requirements, accepted project decisions, accessibility, and
platform conventions govern their application.

## 1. Audit design quality alongside functionality

A working flow and a clean scan do not establish design quality. Inspect the
rendered change and representative peers within its impact surface:

- **Sibling controls:** dimensions, alignment, typography, and action weight
  follow the established pattern. Use equal widths where that pattern requires
  them; content-sized tabs are not automatically defects.
- **Across screens:** the same semantic role uses consistent type and treatment,
  unless the context supplies a deliberate reason for a difference.
- **Element purpose:** each visible element helps the user understand content,
  state, navigation, or an action. Flag unexplained badges, decoration that
  obscures meaning, and controls with unclear value.
- **Control patterns:** filters, sorts, toggles, and navigation follow the
  project's accepted patterns, or document the reason for a new one.

Report functional evidence and the design-quality judgment separately. Name
findings and accepted exceptions; use `unverified` when rendered inspection
could not run. A scan's `PASS` applies only to what that scan checks.

## 2. Verify the actual narrow container

Follow [container fit](container-fit.md). For mobile-capable surfaces, capture
the real parent at a limiting supported size with realistic long content and
inspect wrapping, clipping, overlap, and scroll reachability. Include variable
numbers and labels, not just short fixture text. Desktop tests alone cannot
establish mobile font metrics or native behavior.

State the measured size, platform, evidence path, and any relevant device gap.
Distinguish a narrow browser capture, a simulator capture, and physical-device
proof. Do not claim device verification from a responsive browser fixture.

## 3. Expose material design assumptions

In the existing design intent or build plan, distinguish **requirements**,
**agent-chosen defaults**, and **tentative choices**. For a material choice,
record the choice, its reason, and how it can be revisited. Do not repeat every
routine token choice or introduce a separate dashboard or decision register.

Proceed with reversible defaults within the authorized task. A tentative choice
is not user approval; ask only when missing information materially affects the
result or the action needs authorization.

## 4. Make preference comparisons comparable

When a real style or layout choice remains, offer concise alternatives for the
same task, content, state, and viewport. Name what changes, its tradeoff, and the
recommended default. Separate structural differences from visual treatment so
the user can understand what they are comparing.

For preference calibration, use a **most fitting / least fitting** comparison
when useful. Do not force a ranking for a demonstration or when an accepted
direction already exists. Label the review explicitly: **example; no decision
needed**, **optional preference feedback**, or **decision needed**, with the
specific choice and its consequence. Inspiration becomes a binding visual
target only through explicit approval.

## Sources and broader guidance

Reviewed on 2026-09-30. The summaries adapt source ideas to IBR's existing design
intent and audit workflow; they do not reproduce the upstream implementations.
The four source records are historical lessons or
decisions, marked `cross_repo_validated: false`; these summaries do not claim
universal validation, automatic enforcement, or current platform standards.
Links pin the reviewed Build Loop Memory revision; IBR does not need that
checkout or network access to apply the summaries above.

| Summary | Source record |
|---|---|
| Design-quality audit | [2026-06-26 audit lesson](https://github.com/tyroneross/build-loop-memory/blob/062e120723b31d1045d0e67204c2276e4423de49/lessons/2026-06-26-lesson-feedback-audit-design-quality.md) |
| Narrow-container evidence | [2026-07-17 mobile lesson](https://github.com/tyroneross/build-loop-memory/blob/062e120723b31d1045d0e67204c2276e4423de49/lessons/2026-07-17-lesson-mobile-rendering-escapes-desktop-verification.md) |
| Visible assumptions | [2026-09-01 assumptions decision](https://github.com/tyroneross/build-loop-memory/blob/062e120723b31d1045d0e67204c2276e4423de49/lessons/2026-09-01-decision-silent-assumptions-design.md) |
| Most/least comparisons | [2026-07-15 preference lesson](https://github.com/tyroneross/build-loop-memory/blob/062e120723b31d1045d0e67204c2276e4423de49/lessons/2026-07-15-design-guidance-best-worst-most-least-preference-elicitation.md) |

Optional deeper references:

- [Design approaches and source map](https://github.com/tyroneross/build-loop-memory/blob/062e120723b31d1045d0e67204c2276e4423de49/design/approaches.md): start with the task and project evidence, apply structural guidance, select a fitting layout, then add optional visual treatment and validate the render.
- [UI Guidance corpus](https://github.com/tyroneross/build-loop-memory/blob/062e120723b31d1045d0e67204c2276e4423de49/design/ui-guidance/README.md) and [mockup review catalog](https://github.com/tyroneross/build-loop-memory/blob/062e120723b31d1045d0e67204c2276e4423de49/design/ui-guidance/mockup-review-catalog.md): preserved June 2026 modes, platform patterns, screenshots, and mixed-quality mockups. Historical ratings are preference evidence, not approval for the current build. Check provenance and current project fit before borrowing.
