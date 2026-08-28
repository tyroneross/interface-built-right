# Warm Craft — UI Guidelines

An earthy, artisanal dark interface built on warm neutrals, natural accent colors, and tactile depth. Designed for tools that feel handmade and intentional — where the interface itself communicates care and craftsmanship.

---

## Foundation

### Philosophy

Warm Craft rejects the cold sterility of typical dark modes. Instead of blue-black backgrounds with electric accents, it uses brown-blacks with amber, sage, and clay. Every surface feels like dark wood or worn leather. The result is an interface that feels lived-in and trusted — a workshop, not a laboratory.

**Core tension:** Professional capability with personal warmth. Solve this through material metaphor — surfaces have subtle texture, colors come from natural sources, and spacing is generous enough to breathe without feeling empty.

### When to Use

- Personal productivity tools, note-taking, knowledge management
- Creative tools, writing environments, skill/portfolio management
- Solo developer tools where personality matters
- Products targeting users who spend hours in the interface daily
- Any tool where "I enjoy using this" is a product requirement

### When Not to Use

- Enterprise B2B dashboards (too personal, not neutral enough)
- High-frequency trading or real-time monitoring (warm tones slow perceived urgency)
- Collaborative tools where brand neutrality matters
- Interfaces requiring strict WCAG AAA compliance (warm muted tones are harder to make accessible)

---

## Color System

### Base Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg` | `#12100e` | Page background. Brown-black, never cool-toned. |
| `--surface` | `#1a1714` | Cards, sidebar, input backgrounds. Warm dark wood. |
| `--surface-2` | `#221f1a` | Elevated surfaces, active areas, frontmatter panels. |
| `--surface-3` | `#2a2621` | Highest elevation — rarely used, only for nested surfaces. |

### Text Hierarchy

| Token | Hex | Usage |
|-------|-----|-------|
| `--primary` | `#f2ece3` | Titles, names, active states. Warm white, not blue-white. |
| `--secondary` | `#c4b9a8` | Descriptions, body text. Warm gray-tan. |
| `--muted` | `#7d7265` | Metadata, labels, inactive nav. Warm mid-tone. |
| `--faint` | `#4a4238` | Borders, disabled states, decorative elements. |

**Rule:** The warmth comes from the text tones more than the backgrounds. `--primary` is cream, not white. `--secondary` is tan, not gray. If you swap these for neutral grays, the entire system loses its character.

### Accent Colors

All accents are drawn from natural sources — nothing synthetic or electric.

| Token | Hex | Glow | Source Metaphor | Usage |
|-------|-----|------|----------------|-------|
| `--ember` | `#e8913a` | `rgba(232,145,58,0.08)` | Campfire | Primary CTA, active nav, brand accent |
| `--sage` | `#7cb587` | `rgba(124,181,135,0.08)` | Forest | Success, GitHub source, connected states |
| `--clay` | `#c47357` | `rgba(196,115,87,0.08)` | Terracotta | Plugin source, warning, secondary accent |
| `--sky` | `#6b9ec4` | `rgba(107,158,196,0.08)` | Dusk | Upload source, links, informational |
| `--cream` | `#d4c9b5` | — | Linen | Emphasized secondary text |
| `--sand` | `#a8977e` | — | Beach | Tertiary text, de-emphasized |

**Rule:** Ember is the only accent that gets a gradient or glow treatment. All others appear as flat text color or subtle fills. This maintains ember's primacy as the action color.

### Borders

| Token | Hex | Usage |
|-------|-----|-------|
| `--border` | `#2e2a24` | Default borders. Warm, subtle. |
| `--border-warm` | `#3a342c` | Hover/focus border state. |

**Rule:** Borders in Warm Craft are closer to the background than in cold dark themes. They suggest seams in material rather than drawn lines. If borders feel "sharp," they're too bright.

---

## Typography

### Scale

| Level | Size | Weight | Tracking | Usage |
|-------|------|--------|----------|-------|
| Display | 26px | 700 | -0.03em | Page titles |
| Title | 17px | 600 | -0.02em | Editor title, modal titles |
| Section | 15px | 600 | 0 | Preview headings (in `--ember`) |
| Body | 14px | 400-600 | -0.01em | Card names (600), descriptions (400) |
| Small | 12px | 400-500 | 0 | Metadata, companion files, settings descriptions |
| Micro | 10-11px | 500 | 0.10-0.12em | Section headers (uppercase), source tags, nav labels |

### Font Stack

```css
--font: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--mono: 'DM Mono', 'SF Mono', 'Fira Code', monospace;
```

DM Sans is the character font — its slightly rounded terminals match the warm aesthetic. If DM Sans isn't available, the system stack takes over gracefully.

DM Mono for code — same family, consistent visual tone between prose and code.

---

## Spacing

### Grid

8pt base grid, same values as Calm Precision:

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Inline gaps |
| `sm` | 8px | Card internal spacing |
| `md` | 16px | Standard padding |
| `lg` | 24px | Between sections |
| `xl` | 32px | Page margins |
| `2xl` | 48px | Major breaks |

### Generous Breathing Room

Warm Craft uses slightly more padding than Calm Precision. Cards have 14-16px padding (vs 12-14px). Section gaps are 32px (vs 24px). This extra space is part of the "workshop" feel — tools laid out with room to work, not crammed into a grid.

---

## Components

### Cards — Left Accent Bar

The signature Warm Craft component. Each card has a 3px left accent bar colored by source type:

```
┌───────────────────────────────┐
▌ Name                   [Tag] │  ← 3px left accent, 14px/600 name
▌ Description text that        │  ← 12px, --secondary, 2-line clamp
▌ wraps to two lines...        │
▌ project-name    3 companions │  ← 11px, --muted
└───────────────────────────────┘
```

```css
.card { display: flex; overflow: hidden; border-radius: 10px; }
.card-accent { width: 3px; flex-shrink: 0; }
.card-body { padding: 14px 16px; flex: 1; }
```

Accent colors by source:
- GitHub → `--sage` (green)
- Upload → `--sky` (blue)
- Plugin → `--clay` (terracotta)
- Paste → `--ember` (amber)
- Local → `--muted`

**Rule:** The accent bar is the primary source indicator. Tags are secondary confirmation. If you remove the tags, the bars alone should communicate source type.

**Hover:** border-color `--border-warm`, translateY(-1px), box-shadow `0 6px 20px rgba(0,0,0,0.25)`. The shadow is warm-toned (pure black, not blue-black).

### Source Tags

Small inline badges with tinted borders (not backgrounds):

```css
.tag { font-size: 10px; padding: 2px 8px; border: 1px solid; border-radius: 4px; }
.tag-gh { color: var(--sage); border-color: rgba(124,181,135,0.2); }
.tag-up { color: var(--sky); border-color: rgba(107,158,196,0.2); }
.tag-pl { color: var(--clay); border-color: rgba(196,115,87,0.2); }
```

**Rule:** Tags use border + text color, not background fills. This keeps them lightweight and consistent with the "text color = status" principle from Calm Precision.

### Buttons

| State | Background | Color | Border | Extra |
|-------|-----------|-------|--------|-------|
| Default | `--surface` | `--secondary` | `--border` | — |
| Hover | `--surface-2` | `--primary` | `--border-warm` | — |
| Primary (CTA) | `linear-gradient(135deg, --ember, --ember-dim)` | `--bg` | none | `box-shadow: 0 2px 8px rgba(232,145,58,0.2)` |
| Primary hover | Same | Same | none | Shadow expands, translateY(-1px) |
| Disabled/off | `--surface` | `--faint` | `--border` | cursor: default |
| Quiet/ghost | transparent | `--muted` | none | — |

**Primary CTA uses dark text on ember background** — not white text. This maintains the warm, crafted feel. White-on-amber looks clinical; dark-on-amber looks intentional.

### Navigation — Sectioned Sidebar

```
┌──────────────────────┐
│ [SB] Skill Bank      │  ← Brand icon (ember/clay gradient) + text
│                      │
│ LIBRARY              │  ← Section divider (10px uppercase, --faint)
│ ▌ All Skills   [132] │  ← Active: ember accent bar, ember text, glow bg
│   Import             │  ← Inactive: --muted, no decoration
│                      │
│ ACCOUNT              │
│   Settings           │
│                      │
│ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │
│ [Avatar] Name        │  ← User chip with hover bg
│          Pro Plan    │  ← Plan label in micro text
└──────────────────────┘
```

Active state uses a 3px left accent bar (matching the card accent pattern) plus `--ember-glow` background and `--ember` text. This creates visual continuity between nav and card interactions.

Nav counts (`[132]`) use `--faint` text in a subtle `--surface-2` pill.

### Section Headers with Accent Lines

```
──── GitHub · 8 skills
```

```css
.section-head { display: flex; align-items: center; gap: 10px; }
.section-accent { width: 16px; height: 2px; border-radius: 1px; background: var(--sage); }
```

The short accent line (16px) before the section name matches the source color. This echoes the card accent bars at a smaller scale — visual consistency across hierarchy levels.

### Metric Cards

```
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ 132    │ │ 8      │ │ 94     │ │ 5      │
│ Total  │ │ GitHub │ │ Plugin │ │ Upload │
└────────┘ └────────┘ └────────┘ └────────┘
```

- Surface background with border, radius 10px
- Values: 22px/700 in source accent colors
- Labels: 11px, `--muted`
- Grid: `repeat(4, 1fr)` with 10px gap

### Inputs

```css
input {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--primary);
  font-size: 13px;
}
input:focus { border-color: var(--ember); }
```

Focus uses ember border — no glow ring (unlike Aurora Deep). The warm system is more restrained with light effects.

### Filter Chips (Rounded)

```css
.chip { border-radius: 20px; border: 1px solid var(--border); color: var(--muted); }
.chip.active { color: var(--ember); border-color: var(--ember); background: var(--ember-glow); }
```

Full round radius (20px) distinguishes chips from rectangular buttons. Active chip uses ember tint.

### Toggle Switches

```css
.toggle { background: var(--faint); border-radius: 10px; }
.toggle.on { background: var(--ember); box-shadow: 0 0 10px rgba(232,145,58,0.2); }
```

On-state ember with a warm glow. The glow is gentler than Aurora Deep's — more like a coal than a LED.

### Drop Zones

```
┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
│                                 │
│     [Icon in ember-glow box]    │
│     Drop SKILL.md files here    │
│     or click to browse          │
│                                 │
└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
```

- Dashed border, radius 14px
- Icon in a 48px box with `--ember-glow` background and `rgba(232,145,58,0.15)` border
- Hover: border turns `--ember`, a radial gradient appears from bottom center (like heat rising)
- The radial gradient is applied via `::after` pseudo-element with opacity transition

---

## Editor

### Syntax Highlighting

| Element | Color | Rationale |
|---------|-------|-----------|
| YAML delimiters | `--faint` | Structural, should recede |
| YAML keys | `--sky` | Cool contrast against warm bg |
| YAML values | `--sage` | Natural, readable |
| Headings | `--ember`, weight 600 | Draws the eye to structure |
| Body text | `--secondary` | Warm tan, comfortable for reading |

### Preview Headings

Preview `<h2>` elements render in `--ember` (flat color, not gradient). This is simpler than Aurora Deep's gradient text — matching the overall restrained aesthetic.

### Code in Preview

```css
code { background: var(--surface-2); color: var(--sage); font-family: var(--mono); }
```

Sage-colored code on slightly elevated surface. Warm and readable.

---

## Motion

### Principles

1. **No ambient animation.** Unlike Aurora Deep, Warm Craft is still. The warmth comes from color, not movement.
2. **Interactions are quick and confident** (0.15-0.2s): No lingering transitions.
3. **Hover lifts are subtle** (-1px): Cards barely rise. The shadow does the lifting.
4. **Background texture is static**: The subtle dot texture (`body::before`) never moves.

### Transitions

```css
transition: all 0.2s ease;  /* Default */
transition: border-color 0.15s ease;  /* Inputs */
transition: background 0.15s ease;  /* Nav items */
```

---

## Accessibility

### Contrast Ratios

| Pair | Ratio | WCAG |
|------|-------|------|
| `--primary` (#f2ece3) on `--bg` (#12100e) | 14.8:1 | AAA |
| `--secondary` (#c4b9a8) on `--bg` | 9.2:1 | AAA |
| `--muted` (#7d7265) on `--bg` | 4.1:1 | AA for large text only |
| `--ember` (#e8913a) on `--bg` | 6.4:1 | AA |
| `--sage` (#7cb587) on `--bg` | 5.6:1 | AA |

Warm Craft has better contrast than Aurora Deep because the warm neutrals are naturally brighter than cool grays at the same perceptual lightness.

**`--muted` at 4.1:1** passes AA for large text (18px+ or 14px bold) but fails for body text. Same rule as Aurora Deep: use only for metadata with visual companions.

### Focus States

Ember border on focus (no glow ring). Ensure the border color change is clearly visible — test on the actual warm background, not in isolation.

---

## Texture

The body has a subtle dot texture overlay:

```css
body::before {
  background: url("data:image/svg+xml,..."); /* 1px dots at 0.008 opacity */
  pointer-events: none;
}
```

This adds a tactile, paper-like quality. The dots are nearly invisible but contribute to the "crafted" feel subconsciously. If performance is a concern, remove it — it's enhancement, not structure.

---

## Anti-Patterns

| Don't | Why | Instead |
|-------|-----|---------|
| Use pure white (#fff) for text | Too stark, breaks the warm tone | Use `--primary` (#f2ece3) |
| Use blue (#3b82f6) as accent | Feels cold and clinical in this palette | Use `--ember` or `--sky` |
| Apply backdrop-filter/blur | Glassmorphism is Aurora Deep's language, not Warm Craft's | Use solid `--surface` backgrounds |
| Animated gradients | Warm Craft is still, not alive | Static backgrounds only |
| Thin hairline borders (0.5px) | Too precise, breaks the handmade feel | Use 1px borders minimum |
| Source indicators as background badges | Calm Precision rule: text color only | Use left accent bars + text color tags with subtle borders |
| Rounded avatars with borders | Feels clinical | Gradient fills, no borders |
| More than 2 accent colors in one component | Warm palette is rich — restraint prevents clashing | 1 accent per component, vary across the page |
