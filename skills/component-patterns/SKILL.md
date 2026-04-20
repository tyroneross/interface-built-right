---
name: component-patterns
description: Opinionated component patterns with Calm Precision principles built in. Use when building cards, navs, forms, dashboards, modals, tables, or lists — provides structure, spacing rules, accessibility requirements, and anti-patterns.
user-invocable: true
---

# Component Patterns

Opinionated blueprints for common UI components. Each pattern has Calm Precision principles embedded — structure, spacing, typography hierarchy, accessibility requirements, and anti-patterns are defined up front so implementation starts correct.

## Pattern Index

| User says | Pattern file | Status |
|-----------|-------------|--------|
| "card", "tile", "item card" | `templates/patterns/card.md` | Available |
| "nav", "sidebar", "menu", "navigation" | `templates/patterns/nav.md` | Available |
| "form", "input fields", "field group" | `templates/patterns/form.md` | Available |
| "dashboard", "overview page", "stats page" | `templates/patterns/dashboard.md` | Available |
| "modal", "dialog", "overlay", "popup" | `templates/patterns/modal.md` | Available |
| "table", "data grid", "records list" | `templates/patterns/table.md` | Available |
| "list", "feed", "item list" | `templates/patterns/list.md` | Available |

Read the pattern file before implementing. Apply the pattern's structure, spacing, and Calm Precision rules to the implementation.

## How Patterns Work

Patterns are opinionated blueprints, not optional guidelines. They reference token variable names — `spacing.lg`, `fontSizes.base`, `borderRadius.md` — that resolve against the active design system config in `.ibr/design-system.json`.

Resolution order:
1. Active design system config (`tokens.*`) — use these values
2. Calm Precision defaults — used when no config is present

This means a pattern described as "padding: `spacing.md`" renders as the project's `tokens.spacing.md` value when a config exists, or falls back to a sensible default (typically 16px) without one. The rendered values are what `ibr scan` validates against — not the token names.

## Pattern Structure

Every pattern file follows the same structure:

**Structure** — The semantic HTML/component hierarchy. What elements are required, what is optional, nesting order.

**Calm Precision Rules** — Which of the six principles apply to this component and how. Specific, measurable — "do not add a border to each list item, use a divider instead."

**Spacing** — Token-referenced padding, gap, and margin values. Includes responsive breakpoints when relevant.

**Typography Hierarchy** — Font size, weight, and color for each text role: title, description, metadata, label, action.

**Accessibility** — Required aria attributes, keyboard interaction model, focus order, minimum touch target sizes.

**Anti-Patterns** — Common mistakes to avoid. These map directly to issues the scan will flag.

**IBR Validation** — Which scan fields to check to confirm the pattern is implemented correctly. Maps user intent to scan output fields, same format as the scan-while-building skill.

## Extending Patterns

To add a custom pattern:

1. Create a new file in `templates/patterns/` following the structure above
2. Name it after the component type (e.g. `stat-card.md`, `empty-state.md`)
3. Reference token names for all size and color values
4. Add it to the pattern index in this skill file

Custom patterns are picked up by the design-guidance skill automatically once they exist in `templates/patterns/`.

## Validation After Building

After implementing a component from a pattern:

1. Run `ibr scan` on the rendered component
2. Check the pattern's IBR Validation section — those are the specific scan fields to verify
3. If a design system config is active, check `designSystem.principleViolations` for Calm Precision failures
4. Check `designSystem.tokenViolations` for off-system values
5. Review `designSystem.complianceScore` — a fully pattern-compliant component should score high

Load the design-validation skill for the full post-build audit workflow, including accessibility and regression checking.

*ibr — component patterns*
