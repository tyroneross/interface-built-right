---
name: ui-brainstorm-preamble
description: Capture UI-specific context (platform, scope, template, references, mockup workflow, density, and open questions) before `/ibr:build` creates a design target. Writes preamble.json to `.ibr/builds/<topic>/preamble.json`.
version: 0.1.0
user-invocable: false
---

# UI Brainstorm Preamble

UI-context capture. It gathers only the information needed to create a design brief and decide whether Mockup Gallery should provide a wireframe or high-fidelity target.

## When to Activate

- `/ibr:build <topic>` starts (not in subordinate mode)
- User wants to set up a new UI build and hasn't answered these axes yet

## Questions (ask one at a time, multi-choice where possible)

1. **Platform** — web / iOS / macOS / cross-platform
2. **Scope** — component / page / flow / app
3. **UI Guidance template** — list via `ui-guidance-library` skill; user picks one by name, or "new"
4. **External references** — any URLs/images to capture now? If yes, run `/ibr:capture` per URL
5. **Mockup workflow** — off / use existing selection / create wireframes / create wireframes plus high fidelity / auto
6. **Mockup-gallery selection** — if `mockup-gallery-bridge` reports selections for the scope, show them. User picks one or "none"
7. **Density/intent** — compact-dense / balanced / spacious-marketing

## Ask-When-Unsure Rule

Ask the user when the answer changes layout, flow, fidelity, or validation method. Do not ask when repository state already answers the question.

Ask when:
- platform or scope is unclear
- the target user outcome is not stated
- `mockupWorkflow` is `auto` but there are multiple plausible wireframe directions
- high fidelity may affect implementation and no visual target exists
- a selected mockup conflicts with UI Guidance or the existing design system
- a validation target lacks the artifact needed by its validation method

Do not ask when:
- `.mockup-gallery/selected.json` has one clear selection for the topic
- `refs.json` already tags one required target
- the change is a small edit to an existing component with stable design conventions

## Platform skill routing

After Question 1 (Platform) is answered, load the matching platform skill to bring its rules into scope for the brainstorm and downstream phases:

| Platform | Skill to load |
|---|---|
| web (mobile) | `mobile-web-ui` |
| iOS | `ios-design` + `ios-design-router` + `apple-platform` |
| macOS | `macos-ui` + `apple-platform` |
| cross-platform | load all applicable, pick dominant for tokens |

This ensures the superpowers brainstorming dialogue starts with platform-correct rules already in context.

### Question 1b (iOS only) — App archetype

When Platform = iOS and Scope = app or flow, load `ios-design-router` skill and run the archetype classifier:

"What kind of app is this?"
- **Utility** — task completes in <60s, minimal chrome
- **Content/Feed** — scrollable items, discovery-oriented
- **Productivity** — create and manage artifacts
- **Consumer/Habit** — daily engagement, gamification
- **Editorial** — long-form reading, curated content
- **Tool/Pro** — complex workflows, power users

Store the classified archetype and its defaults from the router's defaults table.

## Outputs

Write `.ibr/builds/<topic>/preamble.json`:
```json
{
  "topic": "...",
  "platform": "...",
  "scope": "...",
  "iosArchetype": "utility|content|productivity|consumer|editorial|tool",
  "iosDefaults": {},
  "template": {"name": "...", "source": "central|project|new"},
  "references": [],
  "mockupWorkflow": "off|existing|wireframe|wireframe+hifi|auto",
  "mockupSelection": null,
  "openQuestions": [],
  "density": "...",
  "capturedAt": "ISO8601"
}
```

`iosArchetype` and `iosDefaults` are only present when platform=iOS.

## Handoff

After capturing, `/ibr:build` creates `brief.json` and resolves the design target before invoking `superpowers:brainstorming`.

When handing off, include the preamble, selected references, Mockup Gallery status, and unresolved questions:

> "Here's what's locked in for this UI build: [preamble summary]. What's still open about goals, edge cases, or architecture?"

Superpowers runs its normal dialogue from there. Redirect spec output to `.ibr/builds/<topic>/spec.md`.
