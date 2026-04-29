---
name: ui-brainstorm-preamble
description: Use at the start of /ibr:build to capture UI context before Design Director and brainstorming. Captures platform, scope, design mode, archetype, references, optional imagegen concept need, gallery target roles, density, and ask gates. Writes preamble.json.
version: 0.2.0
user-invocable: false
---

# UI Brainstorm Preamble

Capture the minimum UI context needed before Design Director planning. The preamble should narrow the design problem without pretending the design is already solved.

## When To Activate

- `/ibr:build <topic>` starts in standalone mode
- User wants a new UI build, redesign, page, flow, app, or design-from-scratch plan
- The build has references, Mockup Gallery selections, or platform choices that need target roles

## Questions

Ask one at a time. Use choices where possible.

1. **Platform** — web / iOS / macOS / cross-platform
2. **Scope** — component / page / flow / app
3. **Design mode** — scratch / wireframe / hi-fi / implementation-only
4. **Primary user goal** — what should the user accomplish first?
5. **UI guidance template** — list via `ui-guidance-library`; user picks one by name, or "new"
6. **External references** — URLs/images/files to capture now? If yes, run `/ibr:capture` per URL
7. **Imagegen concept need** — if no approved visual target exists, ask whether generated visual concepts would help: none / inspiration / visual-target candidate
8. **Mockup Gallery selection** — if `mockup-gallery-bridge` reports `present: true`, show approved/selected candidates and target roles
9. **Density/intent** — compact-dense / balanced / spacious-marketing

Do not ask all nine when the user already supplied the answer. Capture known values and ask only for missing decisions that affect navigation, target role, generated concept use, or validation.

## Platform Routing

After platform is known, load the matching platform skill:

| Platform | Skill to load |
|---|---|
| web | `web-design-router` plus `mobile-web-ui` when responsive behavior matters |
| iOS | `ios-design` + `ios-design-router` + `apple-platform` |
| macOS | `macos-ui` + `apple-platform` |
| cross-platform | load dominant runtime first; record secondary constraints |

## Archetype Capture

### Web

When Platform = web and Scope = page / flow / app, load `web-design-router` and classify:

- `saas-dashboard`
- `data-research-tool`
- `editor-workbench`
- `ai-agent-chat`
- `commerce-checkout`
- `content-publication`
- `internal-admin`

Store the classified archetype and defaults from `web-design-router`.

### iOS

When Platform = iOS and Scope = app / flow, load `ios-design-router` and classify:

- Utility
- Content/Feed
- Productivity
- Consumer/Habit
- Editorial
- Tool/Pro

Store the classified archetype and defaults from the router.

## Mockup Gallery Capture

Use `mockup-gallery-bridge` when `.mockup-gallery/` exists. Capture:

- approved selected mockup, if present
- rating status
- `changeNote`, if present
- target role: `wireframe-target`, `visual-target`, `inspiration`, or `data-reference`

If the selected item is unrated or rejected, do not make it binding. Record an ask gate for Design Director.

## Imagegen Concept Capture

Use imagegen only as an optional upstream concept source. It is useful for mood, visual style, hero/product imagery, and hi-fi direction variants. It is not a substitute for wireframes, text-accurate UI specs, accessibility semantics, or scan validation.

Capture:

- `requested`: whether the user wants concepts
- `purpose`: `inspiration` or `visual-target-candidate`
- `promptBrief`: concise visual brief derived from user intent
- `destination`: `.ibr/builds/<topic>/references/imagegen/` for project-bound concepts
- `approvalRequired`: always `true` before any generated image becomes a binding `visual-target`

If the user has not approved a generated concept, record it as `inspiration` and add an ask gate for Design Director.

## Output

Write `.ibr/builds/<topic>/preamble.json`:

```json
{
  "topic": "...",
  "platform": "web|iOS|macOS|cross-platform",
  "scope": "component|page|flow|app",
  "designMode": "scratch|wireframe|hifi|implementation",
  "primaryUserGoal": "...",
  "webArchetype": "saas-dashboard|data-research-tool|editor-workbench|ai-agent-chat|commerce-checkout|content-publication|internal-admin",
  "webDefaults": {},
  "iosArchetype": "utility|content|productivity|consumer|editorial|tool",
  "iosDefaults": {},
  "template": {"name": "...", "source": "central|project|new"},
  "references": [],
  "imagegenConcepts": {"requested": false, "purpose": "none|inspiration|visual-target-candidate", "approved": []},
  "mockupSelection": null,
  "targetRoles": [],
  "density": "compact-dense|balanced|spacious-marketing",
  "askGates": [],
  "capturedAt": "ISO8601"
}
```

Only include platform-specific archetype fields when they apply.

## Handoff

After capturing, invoke `design-director` first. Then invoke `superpowers:brainstorming` with the preamble and design intent as locked context:

```text
Here is the UI context already locked for this build: [preamble summary].
Here is IBR's design intent contract: [design-intent summary].
What is still open about goals, edge cases, content, architecture, or validation?
```

Redirect spec output to `.ibr/builds/<topic>/spec.md`.
