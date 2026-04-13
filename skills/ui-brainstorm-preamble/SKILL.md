---
name: ui-brainstorm-preamble
description: Capture UI-specific context (platform, scope, template, references, gallery selection, density) before delegating to superpowers:brainstorming. Use at the start of `/ibr:build`. Writes preamble.json to `.ibr/builds/<topic>/preamble.json`.
version: 0.1.0
user-invocable: false
---

# UI Brainstorm Preamble

Six-question UI-context capture. Pre-fills superpowers:brainstorming so the open-ended dialogue starts from locked-in UI axes.

## When to Activate

- `/ibr:build <topic>` starts (not in subordinate mode)
- User wants to set up a new UI build and hasn't answered these axes yet

## Questions (ask one at a time, multi-choice where possible)

1. **Platform** — web / iOS / macOS / cross-platform
2. **Scope** — component / page / flow / app
3. **UI Guidance template** — list via `ui-guidance-library` skill; user picks one by name, or "new"
4. **External references** — any URLs/images to capture now? If yes, run `/ibr:capture` per URL
5. **Mockup-gallery selection** — if `mockup-gallery-bridge` reports `present: true`, show gallery selections for the scope. User picks one or "none"
6. **Density/intent** — compact-dense / balanced / spacious-marketing

## Outputs

Write `.ibr/builds/<topic>/preamble.json`:
```json
{
  "topic": "...",
  "platform": "...",
  "scope": "...",
  "template": {"name": "...", "source": "central|project|new"},
  "references": [{"id": "...", "source": "...", "tags": [...], "path": "..."}],
  "mockupSelection": null,
  "density": "...",
  "capturedAt": "ISO8601"
}
```

## Handoff

After capturing, invoke `superpowers:brainstorming` with the preamble as context block:

> "Here's what's locked in for this UI build: [preamble summary]. What's still open about goals, edge cases, or architecture?"

Superpowers runs its normal dialogue from there. Redirect spec output to `.ibr/builds/<topic>/spec.md`.
