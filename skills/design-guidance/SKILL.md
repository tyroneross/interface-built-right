---
name: design-guidance
description: Use when building UI components, pages, flows, or layouts. Provides pre-build design direction, guidance selection, Calm Precision 6.4.1 rules, component pattern selection, active design tokens, and validation handoff.
---

# Design Guidance

Activate before building UI. This skill turns intent into design constraints so implementation starts aligned instead of relying on visual cleanup afterward.

## When This Activates

Use for:

- "build a component", "create a page", "design a form"
- "what should this look like", "how should I structure this"
- "add a card", "build a dashboard", "create a nav"
- "make this look good", "give me a layout for"
- frontend files that affect visible structure, interaction, or state

For page, flow, app, dashboard, or reference-heavy work, load `design-director` first. For a small isolated component, use this skill directly.

## Guidance Selection

Resolve guidance in this order:

1. User-stated requirements
2. `.ibr/design-system.json` tokens and project overrides
3. `design-intent.json` from Design Director, when present
4. Mockup Gallery target roles, when present
5. Platform router: `web-design-router`, `ios-design-router`, `macos-ui`, `mobile-web-ui`
6. Calm Precision 6.4.1 structural defaults
7. Component pattern files in `templates/patterns/`
8. Data visualization guidance, only when metrics/charts are in scope

If two rules conflict, preserve functional integrity, accessibility, real data constraints, and platform conventions unless the user explicitly chooses a different tradeoff.

## Design System Check

Before guidance:

1. Look for `.ibr/design-system.json` in the project root.
2. If present, use its `tokens` and `principles`.
3. If absent, fall back to Calm Precision defaults and recommend initializing a design system only when repeated off-system choices are likely.

Reference token names, not raw values, where the project supports tokens. Rendered computed values are what IBR scan validates.

## Component Selection

Map user intent to the relevant pattern:

| User says | Pattern file | Notes |
|---|---|---|
| "card", "tile", "item card" | `templates/patterns/card.md` | Contained content unit |
| "nav", "sidebar", "menu", "navigation" | `templates/patterns/nav.md` | Navigation structure |
| "form", "input", "fields" | `templates/patterns/form.md` | Layout, validation states, submit |
| "dashboard", "overview page" | `templates/patterns/dashboard.md` | Grid, metrics, data areas |
| "modal", "dialog", "overlay" | `templates/patterns/modal.md` | Focus trap, backdrop, close behavior |
| "table", "data grid", "list of records" | `templates/patterns/table.md` | Columns, row states, sorting |
| "list", "feed", "items" | `templates/patterns/list.md` | Spacing, dividers, empty states |

Read the relevant pattern file before implementing.

## Calm Precision 6.4.1 Quick Reference

Apply these during design, not after:

1. **Group, Don't Isolate** — one border around related groups, dividers inside.
2. **Size = Importance** — button size matches user intent weight.
3. **Three-Line Hierarchy + Page Cascade** — title, description, metadata inside components; L1/L2/L3/L4 across pages.
4. **Progressive Disclosure** — show essentials, reveal secondary choices on demand.
5. **Text Over Decoration** — color and weight create hierarchy before boxes.
6. **Content Over Chrome** — aim for at least 70% content and no more than 30% chrome.
7. **Natural Language** — labels match user vocabulary, not implementation jargon.
8. **Rhythm & Alignment** — 8pt rhythm, aligned baselines, stable dimensions.
9. **Functional Integrity** — interactive UI needs a real action, destination, or explicit demo/disabled state.
10. **Content Resilience + Error Strategy** — handle variable content and use what -> why -> fix errors.
11. **Mobile-First Structure** — base styles target mobile; breakpoints add complexity.
12. **Purposeful Motion** — motion communicates state/interactivity and respects reduced motion.
13. **Voice Calibration** — buttons use Verb + Object, tooltips are short, loading says what is happening.

## Token Application

When `.ibr/design-system.json` is active:

| Design decision | Token path |
|---|---|
| Text colors | `tokens.colors.text.*` |
| Background colors | `tokens.colors.background.*` |
| Brand/accent colors | `tokens.colors.primary`, `tokens.colors.secondary` |
| Body font size | `tokens.typography.fontSizes.base` |
| Heading sizes | `tokens.typography.fontSizes.lg`, `.xl`, `.2xl` |
| Small/label text | `tokens.typography.fontSizes.sm`, `.xs` |
| Component spacing | `tokens.spacing.md`, `.lg` |
| Page section gaps | `tokens.spacing.xl`, `.2xl` |
| Card/container radius | `tokens.borderRadius.md`, `.lg` |
| Button radius | `tokens.borderRadius.sm`, `.md` |
| Minimum touch target | `tokens.touchTargets.min` |

## After Building

Run `ibr scan` on the rendered component or page. Check:

- Calm Precision principle violations
- Token violations
- Accessible names and roles
- Handler/destination coverage
- Mobile/touch sizing
- Layout and content hierarchy against `design-intent.json`, when present

Load `design-validation` for a full post-build audit.

*ibr - design guidance*
