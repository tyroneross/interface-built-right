---
name: design-guidance
description: Pre-build design creation guidance using Calm Precision principles and active design tokens. Use when building UI components, pages, or layouts — provides aesthetic direction and pattern selection before implementation.
---

# Design Guidance

Activate this skill before building any UI component, page, or layout. It provides design direction, selects the right component pattern, and applies the active design system — so implementation starts aligned, not corrected after.

## When This Activates

This skill is relevant when the user says things like:

- "build a component", "create a page", "design a form"
- "what should this look like", "how should I structure this"
- "add a card", "build a dashboard", "create a nav"
- "make this look good", "give me a layout for..."

Load this skill first, before writing any code. Design direction up front prevents accumulated mismatches.

## Design System Check

Before providing guidance, check for a project-level design system config:

1. Look for `.ibr/design-system.json` in the project root
2. If present — use its `tokens` and `principles` for all guidance in this session
3. If absent — fall back to Calm Precision defaults (documented below) and recommend running `design_system` tool to initialize one

When a config is active, reference its token values by name (e.g. `spacing.lg`, `colors.primary`) rather than raw values. This ensures implementation stays on-system and passes token compliance checks during scan.

## Component Selection

Map user intent to the appropriate pattern before building:

| User says | Pattern file | Notes |
|-----------|-------------|-------|
| "card", "tile", "item card" | `templates/patterns/card.md` | Use for any contained content unit |
| "nav", "sidebar", "menu", "navigation" | `templates/patterns/nav.md` | Load when adding navigation structure |
| "form", "input", "fields" | `templates/patterns/form.md` | Covers layout, validation states, submit |
| "dashboard", "overview page" | `templates/patterns/dashboard.md` | Grid layout, stat cards, data areas |
| "modal", "dialog", "overlay" | `templates/patterns/modal.md` | Focus trap, backdrop, close behavior |
| "table", "data grid", "list of records" | `templates/patterns/table.md` | Column structure, row states, sorting |
| "list", "feed", "items" | `templates/patterns/list.md` | Spacing rules, dividers, empty states |

Read the relevant pattern file before implementing. Patterns include spacing rules, typography hierarchy, accessibility requirements, and anti-patterns to avoid.

Note: Only `templates/patterns/card.md` exists today. Reference the component-patterns skill for the full pattern index as more are added.

## Calm Precision Quick Reference

Six principles that govern all IBR-validated UI. Apply them during design, not after.

**Gestalt — Grouping**
Single border around a related group. Dividers between items. Never individual borders on list items. Related elements must share a visual container.

**Fitts — Target Size**
Button size signals intent weight. Primary/conversion actions: full-width or minimum 120px. Secondary/quick actions: compact. Do not make all buttons the same size.

**Hick — Progressive Disclosure**
Show the minimum. Reveal on demand. Advanced options go behind expand or action triggers. Max 5-7 visible choices before disclosure is required.

**Signal-to-Noise — Status Display**
Status is communicated through text color only — no background badges, no heavy color fills for state. Color and weight hierarchy replace boxes. A success state is green text, not a green pill.

**Content >= Chrome**
Content area must be at least 70% of the visible viewport. Navigation, sidebars, headers, and decorative chrome occupy the remaining 30% or less.

**Cognitive Load**
5-7 items maximum per visual group. When a group exceeds 7, split it or use progressive disclosure. Keep decision points minimal per screen.

## Token Application

When `.ibr/design-system.json` is active, resolve values from these token paths:

| Design decision | Token path |
|----------------|-----------|
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

Use these token names in implementation code (as CSS variables or design token references). The scan pipeline checks rendered computed values against these token definitions and reports `tokenViolations` for off-system values.

## After Building

Run `ibr scan` on the rendered component to verify implementation matches design intent. The scan will:

- Check Calm Precision principle compliance when a design system config is active
- Report `designSystem.principleViolations` for rule failures
- Report `designSystem.tokenViolations` for off-system values
- Output a `designSystem.complianceScore` (0-100)

Load the design-validation skill for a structured post-build audit workflow. Load the component-patterns skill to reference the full pattern library.

*ibr — design guidance*
