---
name: design-system
description: Use when setting up a project's design system or modifying design constraints. Initialize design tokens, view active principles, add custom rules, update token values.
user-invocable: true
---

# Design System Configuration

IBR's design system ties Calm Precision principles and project-specific design tokens to the scan pipeline. When `.ibr/design-system.json` exists in a project, every `ibr scan` run checks rendered output against those constraints and reports violations.

## Initialize

Copy the template to the project's IBR config directory:

```bash
cp templates/design-system.json .ibr/design-system.json
```

Then customize tokens for the project — colors, type scale, spacing, radii. The template contains sensible defaults for a Calm Precision-compliant interface.

To manage config programmatically, use the `design_system` MCP tool.

## Configuration Format

The JSON structure has three top-level sections:

```json
{
  "version": "1.0.0",
  "name": "Project name",
  "principles": { ... },
  "tokens": { ... }
}
```

### Principles

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

### Tokens

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

## Core vs Stylistic Principles

**Core principles** — default to `"error"` severity. These reflect structural and perceptual correctness that is rarely acceptable to relax:

| ID | Principle | What it enforces |
|----|-----------|-----------------|
| `gestalt` | Grouping | Single border for groups; no individual borders on list items |
| `signal-noise` | Status display | Text color only for status; no background badges |
| `content-chrome` | Content ratio | Content area >= 70% of viewport |
| `cognitive-load` | Complexity | Max 7 interactive elements per visual group |

**Stylistic principles** — default to `"warn"` severity. These are strong conventions that may have intentional exceptions:

| ID | Principle | What it enforces |
|----|-----------|-----------------|
| `fitts` | Target sizing | Primary action buttons >= 120px width |
| `hick` | Progressive disclosure | Max 5 visible choices before disclosure required |

Any principle can be overridden. Set `"severity": "off"` to disable entirely.

## Custom Principles

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

## Token Categories

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

Values are compared as computed pixel values. Set tokens to the exact resolved values you expect (e.g. `"14px"` not `"0.875rem"` — the scan reads computed values post-resolution).

## MCP Tool

Use the `design_system` MCP tool to manage config without editing JSON directly:

| Action | Description |
|--------|-------------|
| `get` | Return the active design system config |
| `init` | Copy template to `.ibr/design-system.json` |
| `set_token` | Update a specific token value |
| `add_principle` | Add a custom principle rule |
| `set_severity` | Change severity for a built-in principle |
| `validate` | Check the config file for structural errors |

## Viewing the Active System

To see what design system is currently configured for a project:

```bash
# CLI
cat .ibr/design-system.json

# MCP tool
design_system action: "get"
```

The scan output's `designSystem` field always reports which config was used, including the config version and name. If no config is present, `designSystem` will be `null` and no principle or token checks will run.

*ibr — design system*
