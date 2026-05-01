---
name: design
description: Use when planning or implementing UI with IBR.
---

# IBR Design

Use IBR as the design planner before editing non-trivial UI. The output should be a clear design contract, then implementation, then validation evidence.

## Flow

1. Capture user intent: platform, scope, primary user goal, primary action, data needs, references, and constraints.
2. Load `ui-ux-guidance` for current IBR design guidance: Calm Precision, web archetypes, target roles, imagegen gates, states, mobile, and data visualization.
3. Classify the surface: web, mobile web, iOS, macOS, or cross-platform; then choose the product archetype.
4. Decide design mode: scratch, wireframe, hi-fi target, or implementation against an existing design.
5. If visual exploration would help and no approved target exists, use imagegen only for concepts. User approval is required before a generated image becomes a `visual-target`.
6. Write a compact plan before code. For page, flow, app, or dashboard work, create `.ibr/builds/<topic>/design-intent.json`.
7. Implement only after the design intent is concrete enough to test.
8. Validate with IBR MCP tools before calling the work done.

## Design Intent

For substantial UI work, record:

```json
{
  "topic": "...",
  "platform": "web|iOS|macOS|cross-platform",
  "scope": "component|page|flow|app",
  "archetype": "...",
  "primaryUserGoal": "...",
  "primaryAction": "...",
  "layoutTarget": "wireframe-target|none",
  "visualTarget": "visual-target|none",
  "imagegenConcepts": [{"path": "...", "role": "inspiration|visual-target", "approved": false}],
  "validationCriteria": ["..."]
}
```

## Routing Rules

- Web apps: prioritize hierarchy, density, responsive behavior, states, accessibility, and real interaction paths.
- For web detail, use installed references under `references/web-design/`: router, information architecture, interaction states, visual system, voice/content states, and data visualization.
- iOS/macOS: follow platform navigation, safe areas/window chrome, touch or pointer conventions, and native accessibility expectations.
- Dashboards and analytical UI: use charts only when comparison, trend, distribution, relationship, or composition is clearer than text.
- Mockup Gallery references: treat approved wireframes as layout targets and approved hi-fi mockups as visual targets. Do not treat unrated or rejected mockups as binding.
- Imagegen concepts: use for mood, style, hero/product imagery, or hi-fi variants. Never use generated images as wireframes, accessibility evidence, or validation evidence.

## Ask Gates

Ask before implementation when target choice, generated concept approval, platform, primary action, real-data availability, or validation mode is ambiguous. Otherwise make a conservative decision and record the assumption.

## Completion

Implementation is complete only when validation evidence exists or remaining issues are explicitly surfaced.
