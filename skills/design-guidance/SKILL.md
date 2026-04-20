---
name: design-guidance
description: Pre-build design guidance and design-system configuration. Use when building UI components, pages, or layouts (pattern selection, token application, Calm Precision principles) — or when setting up / editing the project's design-system config (tokens, principles, custom rules).
user-invocable: true
---

# Design Guidance

One skill, two related jobs:

1. **Build-time guidance** — pattern selection, token application, Calm Precision principles applied *before* you write code.
2. **Design-system configuration** — initialize and edit `.ibr/design-system.json` tokens, principles, and custom rules that the scan pipeline validates against.

The two jobs share the same underlying system, so they live in one skill. Use Part 1 when building UI, Part 2 when setting up or tuning the system.

---

## PART 1 — Build-time Guidance

Activate this part before building any UI component, page, or layout. It provides design direction, selects the right component pattern, and applies the active design system — so implementation starts aligned, not corrected after.

### When Part 1 activates

- "build a component", "create a page", "design a form"
- "what should this look like", "how should I structure this"
- "add a card", "build a dashboard", "create a nav"
- "make this look good", "give me a layout for..."

Load Part 1 first, before writing any code. Design direction up front prevents accumulated mismatches.

### Design System Check

Before providing guidance, check for a project-level design system config:

1. Look for `.ibr/design-system.json` in the project root
2. If present — use its `tokens` and `principles` for all guidance in this session
3. If absent — fall back to Calm Precision defaults below and recommend running the `design_system` MCP tool (`action: init`) to initialize one

When a config is active, reference its token values by name (e.g. `spacing.lg`, `colors.primary`) rather than raw values. This keeps implementation on-system and passes token compliance checks during scan.

### Component Selection

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

### Calm Precision Quick Reference

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

### Token Application

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

### After Building

Run `ibr scan` on the rendered component to verify implementation matches design intent. The scan will:

- Check Calm Precision principle compliance when a design system config is active
- Report `designSystem.principleViolations` for rule failures
- Report `designSystem.tokenViolations` for off-system values
- Output a `designSystem.complianceScore` (0-100)

Load the design-validation skill for a structured post-build audit workflow. Load the component-patterns skill for the full pattern library.

---

## PART 2 — Design-System Configuration

Activate this part when setting up a project's design system or tuning rules. This is admin-style work: initializing `.ibr/design-system.json`, editing tokens, adding custom principles, changing severities.

### When Part 2 activates

- "initialize design system", "set up design tokens"
- "update the token values", "change the brand color"
- "add a custom principle", "enforce a new rule"
- "why is gestalt firing", "change this severity"

### Initialize

Copy the template to the project's IBR config directory:

```bash
cp templates/design-system.json .ibr/design-system.json
```

Then customize tokens for the project — colors, type scale, spacing, radii. The template contains sensible defaults for a Calm Precision-compliant interface.

To manage config programmatically, use the `design_system` MCP tool.

### Configuration Format

The JSON structure has three top-level sections:

```json
{
  "version": "1.0.0",
  "name": "Project name",
  "principles": { ... },
  "tokens": { ... }
}
```

#### Principles

```json
"principles": {
  "calmPrecision": {
    "core": {
      "gestalt": { "enabled": true, "severity": "error" },
      "signal-noise": { "enabled": true, "severity": "error" },
      "content-chrome": { "enabled": true, "severity": "warn" },
      "cognitive-load": { "enabled": true, "severity": "warn" }
    },
    "stylistic": {
      "fitts": { "enabled": true, "severity": "warn" },
      "hick": { "enabled": true, "severity": "warn" }
    }
  },
  "custom": []
}
```

#### Tokens

```json
"tokens": {
  "colors": {
    "primary": "#...",
    "secondary": "#...",
    "text": { "primary": "#...", "secondary": "#...", "muted": "#..." },
    "background": { "default": "#...", "surface": "#...", "elevated": "#..." },
    "status": { "error": "#...", "warn": "#...", "success": "#...", "info": "#..." }
  },
  "typography": {
    "fontSizes": { "xs": "11px", "sm": "12px", "base": "14px", "lg": "16px", "xl": "20px", "2xl": "24px" },
    "fontWeights": { "regular": "400", "medium": "500", "semibold": "600", "bold": "700" },
    "fontFamily": { "sans": "...", "mono": "..." }
  },
  "spacing": ["4px", "8px", "12px", "16px", "24px", "32px", "48px", "64px"],
  "borderRadius": { "sm": "4px", "md": "8px", "lg": "12px", "full": "9999px" },
  "shadows": { "sm": "...", "md": "...", "lg": "..." },
  "transitions": { "fast": "100ms ease", "base": "200ms ease", "slow": "300ms ease" },
  "touchTargets": { "min": "44px", "recommended": "48px" }
}
```

### Core vs Stylistic Principles

**Core principles** — default `"error"` severity. Structural and perceptual correctness; rarely relaxed.

| ID | Principle | What it enforces |
|----|-----------|-----------------|
| `gestalt` | Grouping | Single border for groups; no individual borders on list items |
| `signal-noise` | Status display | Text color only for status; no background badges |
| `content-chrome` | Content ratio | Content area >= 70% of viewport |
| `cognitive-load` | Complexity | Max 7 interactive elements per visual group |

**Stylistic principles** — default `"warn"` severity. Strong conventions with legitimate exceptions.

| ID | Principle | What it enforces |
|----|-----------|-----------------|
| `fitts` | Target sizing | Primary action buttons >= 120px width |
| `hick` | Progressive disclosure | Max 5 visible choices before disclosure required |

Any principle can be overridden. Set `"severity": "off"` to disable entirely.

### Custom Principles

Add brand-specific or project-specific rules in the `principles.custom` array:

```json
"custom": [
  {
    "id": "brand-font-only",
    "name": "Brand font enforcement",
    "description": "All text must use the approved brand font family",
    "category": "typography",
    "severity": "error",
    "checks": [
      {
        "property": "fontFamily",
        "operator": "includes",
        "values": ["Inter", "Inter var"]
      }
    ]
  }
]
```

Check format:

| Field | Type | Description |
|-------|------|-------------|
| `property` | string | Computed CSS property name (camelCase) |
| `operator` | string | `"equals"`, `"includes"`, `"matches"`, `"minValue"`, `"maxValue"` |
| `values` | array | Accepted values for this property |

### Token Categories

Each token category maps to what the scan validates:

| Token | Validates against |
|-------|------------------|
| `colors` | Computed `color`, `backgroundColor` on all elements |
| `typography.fontSizes` | Computed `fontSize` on text elements |
| `typography.fontWeights` | Computed `fontWeight` on text elements |
| `typography.fontFamily` | Computed `fontFamily` on text elements |
| `spacing` | Computed `gap`, `padding`, `margin` values |
| `borderRadius` | Computed `borderRadius` on containers and interactive elements |
| `touchTargets.min` | `bounds.width` and `bounds.height` on interactive elements |

Values are compared as computed pixel values. Set tokens to exact resolved values you expect (e.g. `"14px"` not `"0.875rem"` — the scan reads computed values post-resolution).

### MCP Tool — `design_system`

Manage config without editing JSON directly:

| Action | Description |
|--------|-------------|
| `get` | Return the active design system config |
| `init` | Copy template to `.ibr/design-system.json` |
| `set_token` | Update a specific token value |
| `add_principle` | Add a custom principle rule |
| `set_severity` | Change severity for a built-in principle |
| `validate` | Check the config file for structural errors |

### Viewing the Active System

```bash
# CLI
cat .ibr/design-system.json

# MCP tool
design_system action: "get"
```

The scan output's `designSystem` field always reports which config was used, including the config version and name. If no config is present, `designSystem` will be `null` and no principle or token checks will run.

*ibr — design guidance (build-time + configuration)*
