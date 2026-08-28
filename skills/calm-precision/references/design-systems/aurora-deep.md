# Aurora Deep — UI Guidelines

A deep-space glassmorphism system built on layered translucency, ambient light, and restrained color. Designed for developer tools, dashboards, and data-rich interfaces where information density meets visual calm.

---

## Foundation

### Philosophy

Aurora Deep treats the interface as a window into depth. Surfaces are translucent layers floating over a dark field lit by distant, shifting color. Every element communicates its layer through opacity and blur — not drop shadows or borders. The result is an interface that feels dimensional without being decorative.

**Core tension:** Maximum information density with minimum visual noise. Solve this through luminance hierarchy (bright = important, dim = contextual, invisible = structural) rather than size or weight alone.

### When to Use

- Developer tools, CLIs with visual interfaces, code editors
- Dashboards with mixed data types (metrics, lists, detail views)
- AI/ML interfaces, model management, pipeline monitors
- Any dark-mode-first product where depth aids comprehension

### When Not to Use

- Content-first reading experiences (blogs, documentation)
- E-commerce or marketing pages
- Accessibility-critical interfaces where contrast ratios are hard to maintain through translucency
- Print or light-mode-required contexts

---

## Color System

### Base Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg` | `#060611` | Page background. Near-black with a blue undertone — never pure black. |
| `--surface` | `rgba(255,255,255,0.025)` | Default card/container fill. Barely visible — the blur does the work. |
| `--surface-hover` | `rgba(255,255,255,0.05)` | Interactive hover state. Doubles the opacity of surface. |
| `--glass` | `rgba(255,255,255,0.03)` | Input fields, dropdowns, secondary containers. |
| `--glass-border` | `rgba(255,255,255,0.06)` | Default borders. Visible but not dominant. |
| `--glass-lit` | `rgba(255,255,255,0.09)` | Hover/focus border state. 50% brighter than default. |

### Text Hierarchy

| Token | Hex | Usage |
|-------|-----|-------|
| `--primary` | `#f0f0f5` | Titles, skill names, active nav, primary content |
| `--secondary` | `#9d9db5` | Descriptions, body text, card content |
| `--muted` | `#5a5a72` | Metadata, timestamps, labels, inactive nav, placeholders |

**Rule:** Three tiers only. If you need a fourth, you're overcomplicating the hierarchy. Combine elements or remove one.

### Accent Colors

| Token | Hex | Glow | Semantic Use |
|-------|-----|------|-------------|
| `--indigo` | `#818cf8` | `rgba(129,140,248,0.12)` | Primary accent. Actions, focus states, active indicators, brand. |
| `--violet` | `#a78bfa` | `rgba(167,139,250,0.10)` | Secondary accent. Headings in preview, plugin source, gradients. |
| `--cyan` | `#22d3ee` | `rgba(34,211,238,0.08)` | Syntax highlighting (keys), tertiary accent, brand gradient partner. |
| `--emerald` | `#34d399` | — | Success, connected states, GitHub source. |
| `--rose` | `#fb7185` | — | Error, destructive actions, warning text. |
| `--amber` | `#fbbf24` | — | Warning, caution states. |

**Rule:** Accents appear as text color or glow backgrounds — never as solid fills on large surfaces. The only exception is the primary CTA button, which uses an indigo gradient.

### Ambient Gradient

The background features a slow-drifting radial gradient that creates the "aurora" effect:

```css
background:
  radial-gradient(ellipse at 15% 30%, rgba(99,102,241,0.07) 0%, transparent 50%),
  radial-gradient(ellipse at 75% 15%, rgba(34,211,238,0.05) 0%, transparent 45%),
  radial-gradient(ellipse at 50% 85%, rgba(167,139,250,0.04) 0%, transparent 50%),
  radial-gradient(ellipse at 85% 70%, rgba(251,191,36,0.02) 0%, transparent 40%);
animation: drift 20s ease-in-out infinite alternate;
```

**Rule:** The gradient is decorative ambiance only. It must never interfere with text readability. If a gradient hotspot lands under content, reduce its opacity or shift its position. Maximum combined opacity at any point: 0.07.

---

## Typography

### Scale

| Level | Size | Weight | Tracking | Usage |
|-------|------|--------|----------|-------|
| Display | 28px | 700 | -0.04em | Page titles only |
| Title | 18px | 600 | -0.02em | Editor skill name, modal titles |
| Section | 16px | 600 | -0.02em | Preview headings, panel titles |
| Body | 13-14px | 400-500 | 0 | Card names (600), descriptions, form labels |
| Small | 12px | 400-500 | 0 | Frontmatter values, companion files, metadata |
| Micro | 10-11px | 500 | 0.10-0.12em | Section headers (uppercase), nav labels, source tags |

### Font Stack

```css
--font: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
--mono: 'SF Mono', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace;
```

Use monospace for: source editor, code blocks in preview, frontmatter keys, file paths, content hashes.

### Negative Tracking on Titles

Titles at 18px+ use negative letter-spacing (-0.02em to -0.04em). This tightens large text for a modern, editorial feel. Never apply negative tracking below 16px.

---

## Spacing

### Grid

8pt base grid. All spacing values are multiples of 4:

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Icon-to-text gap, inline spacing |
| `sm` | 8px | Card internal gaps, list item spacing |
| `md` | 16px | Section padding, card padding |
| `lg` | 24px | Between sections, toolbar-to-content |
| `xl` | 32px | Page padding, major section breaks |
| `2xl` | 40-48px | Page top padding, hero spacing |

### Content Ratio

Minimum 70% content area. The sidebar is 250px fixed; on a 1440px screen, content gets 1190px (83%). On 1280px, content gets 1030px (80%). Below 1024px, sidebar should collapse.

---

## Components

### Glassmorphism Surfaces

Every container uses the glass pattern:

```css
.glass-surface {
  background: var(--glass);
  backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
}
```

**Blur values by depth:**
- Cards, inputs: `blur(12px)`
- Sidebar, modals: `blur(20-24px)`
- Tooltips, popovers: `blur(8px)`

**Rule:** `backdrop-filter` is the primary depth cue. If you remove the blur, the hierarchy should still work via opacity alone — blur is enhancement, not structure.

### Cards

```
┌─────────────────────────────┐
│ Name                 [Tag]  │  ← 14px/600 name, 10px tag with subtle bg
│ Description text that       │  ← 12px, --secondary, 2-line clamp
│ wraps to two lines max...   │
│ project-name    3 companions│  ← 11px, --muted
└─────────────────────────────┘
```

- Border: 1px `--glass-border`, radius 12px
- Hover: `--surface-hover` bg, border `--glass-lit`, translateY(-2px), box-shadow `0 8px 24px rgba(0,0,0,0.3)`
- Top accent line on hover: 2px gradient (transparent → accent → transparent), opacity 0→1

**Source tags on cards** use subtle tinted backgrounds:
- GitHub: `color: --emerald; background: rgba(34,211,153,0.08)`
- Upload: `color: --indigo; background: --indigo-glow`
- Plugin: `color: --violet; background: --violet-glow`
- Paste: `color: --muted; background: --surface`

### Buttons

| State | Background | Color | Border |
|-------|-----------|-------|--------|
| Default | `--glass` | `--secondary` | `--glass-border` |
| Hover | `--surface-hover` | `--primary` | `--glass-lit` |
| Primary (CTA) | `linear-gradient(135deg, --indigo, #6366f1)` | `#fff` | none |
| Primary hover | Same + glow shadow | Same | none |
| Disabled/muted | `--glass` | `--muted` | `--glass-border` |
| Ghost | `transparent` | `--muted` | none |
| Destructive | `transparent` | `--rose` | `--glass-border` |

**Primary CTA** gets a box-shadow glow: `0 2px 12px rgba(99,102,241,0.3)`. On hover, expand to `0 4px 20px rgba(99,102,241,0.4)` + translateY(-1px).

**Disabled buttons:** cursor `default`, no hover effect. The muted color (not opacity) signals non-interactivity. Never use `opacity: 0.5` — it conflicts with the glass translucency.

**Two-click destructive:** First click changes text to "Confirm [Action]?" in `--rose`. Second click executes. Blur/click-away resets. No modal confirmation dialogs.

### Navigation (Sidebar)

```
┌──────────────────────┐
│ [Brand Mark] Title   │  ← Gradient icon + 18px/700 text
│                      │
│ WORKSPACE            │  ← 10px uppercase label, --muted
│ ● Skills             │  ← Active: --primary, indigo glow bg, dot lit
│   Import             │  ← Inactive: --muted, no bg
│   Settings           │
│                      │
│ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │  ← Border separator
│ [Avatar] Name        │  ← User section at bottom
│          email       │
└──────────────────────┘
```

- Active state: `--primary` text, `--indigo-glow` background, font-weight 500
- Active dot: 6px circle, `--indigo` fill with `box-shadow: 0 0 8px rgba(129,140,248,0.4)`
- Inactive: `--muted` text, transparent background, invisible dot
- Hover: `--secondary` text, `--surface` background
- Items have 8px border-radius, 9px vertical padding

### Source Section Headers

```
GitHub ─────────── [8]
```

The section name, a horizontal line (1px `--glass-border`), and a count pill:

```css
.source-bar { display: flex; align-items: center; gap: 10px; }
.source-line { flex: 1; height: 1px; background: var(--glass-border); }
.source-count { font-size: 11px; background: var(--glass); border: 1px solid var(--glass-border); border-radius: 10px; padding: 2px 8px; }
```

### Stats Bar

Horizontal row of metric cards above the skill list:

```
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ 132    │ │ 8      │ │ 94     │ │ 5      │
│ Total  │ │ GitHub │ │ Plugin │ │ Upload │
└────────┘ └────────┘ └────────┘ └────────┘
```

- Values: 20px/700, each in its accent color (indigo, emerald, violet, cyan)
- Labels: 11px, `--muted`
- No borders or backgrounds — values stand on the dark bg

### Inputs

```css
input {
  background: var(--glass);
  backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  color: var(--primary);
  font-size: 13px;
  padding: 10px 16px;
}
input:focus {
  border-color: var(--indigo);
  box-shadow: 0 0 0 3px var(--indigo-glow);
}
```

Focus ring is a 3px spread `--indigo-glow` — not a browser default outline. This is the only place a glow extends beyond the element boundary.

### Filter Pills

```css
.pill-bar { background: var(--glass); border: 1px solid var(--glass-border); border-radius: 10px; padding: 3px; }
.pill { padding: 6px 14px; border-radius: 7px; color: var(--muted); }
.pill.active { background: var(--indigo-glow); color: var(--indigo); font-weight: 500; }
```

Contained in a glass bar. Active pill gets the glow background — not a border or underline. This differs from Calm Precision's bottom-border approach.

### Toggle Switches

```css
.toggle { width: 42px; height: 24px; background: var(--muted); border-radius: 12px; }
.toggle.on { background: var(--indigo); box-shadow: 0 0 12px rgba(129,140,248,0.3); }
.toggle::after { /* 20px white circle thumb */ }
```

On-state gets a subtle glow matching the accent. The glow is the "lit" indicator — no additional checkmarks or labels needed.

### Drop Zones (Import)

```
┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
│                                 │
│        [Icon in glow box]       │
│     Drop SKILL.md files here    │
│     or click to browse          │
│                                 │
└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
```

- Dashed border (2px), `--glass-border`, radius 16px
- Icon sits in a 48px rounded box with `--indigo-glow` background
- Hover: border turns `--indigo`, a radial gradient appears from bottom center
- Drag-over: same as hover but immediate (no transition delay)

---

## Editor Layout

### Split View Grid

```
┌─────────────────┬─────────────────┬──────────┐
│  Source Editor   │  Preview Pane   │ Companion│
│  (monospace)     │  (rendered md)  │ Browser  │
│                  │                 │          │
│  45-50%          │  35-40%         │  15-20%  │
└─────────────────┴─────────────────┴──────────┘
```

- Container: 1px `--glass-border`, radius 12px, glass bg with `blur(20px)`
- Panes separated by 1px `--glass-border` vertical lines
- No resize handles in v1 (fixed proportions)

### Syntax Highlighting (Source Pane)

| Element | Color |
|---------|-------|
| YAML delimiters (`---`) | `--muted` |
| YAML keys | `--cyan` |
| YAML values | `--emerald` |
| Markdown headings | `--violet`, weight 600 |
| Body text | `--secondary` |

### Preview Pane

Headings use gradient text:
```css
h2 { background: linear-gradient(135deg, var(--violet), var(--indigo)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
```

Code blocks: `rgba(255,255,255,0.05)` background, `--cyan` text, `--mono` font.

### Companion Pane

- Group titles with colored dots (references = indigo, examples = amber)
- Files listed with icon + name, hover highlights

---

## Motion

### Principles

1. **Ambient motion is slow** (15-20s): The background gradient drifts. Nothing else moves on its own.
2. **Interactive motion is fast** (0.15-0.25s): Hovers, focus, state changes.
3. **Elevation changes use translateY** (-1px to -2px on hover): Cards lift slightly. Buttons lift on press.
4. **No bounce, no overshoot**: ease-in-out or ease. Never spring/elastic.

### Transitions

```css
/* Default for interactive elements */
transition: all 0.2s ease;

/* Cards — slightly longer for the shadow spread */
transition: all 0.25s ease;

/* Opacity reveals (hover accents, top lines) */
transition: opacity 0.3s ease;
```

---

## Accessibility

### Contrast Ratios

| Pair | Ratio | WCAG |
|------|-------|------|
| `--primary` on `--bg` | 17.3:1 | AAA |
| `--secondary` on `--bg` | 6.8:1 | AA |
| `--muted` on `--bg` | 3.5:1 | Fails AA for body text |
| `--indigo` on `--bg` | 5.2:1 | AA |

**`--muted` text is below AA contrast.** Use it only for labels, metadata, and decorative text that has a visible companion (icon, colored indicator, or primary-colored label nearby). Never use `--muted` as the sole identifier of important information.

### Focus Management

- All interactive elements get the indigo focus ring (`0 0 0 3px --indigo-glow`)
- Focus ring is always visible — never `outline: none` without a replacement
- Tab order follows visual order (sidebar → filters → cards → pagination)

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  body::before { animation: none; }
  * { transition-duration: 0.01ms !important; }
}
```

---

## Anti-Patterns

| Don't | Why | Instead |
|-------|-----|---------|
| Solid colored backgrounds on containers | Destroys the glass depth | Use `--glass` with `backdrop-filter` |
| Multiple border radiuses on a page | Visual noise | Standardize: 12px containers, 10px inputs, 8px nav items, 6px inline tags |
| Colored badges with backgrounds for status | Calm Precision rule: status = text color only | Use text color + optional dot indicator |
| White or light borders | Breaks the dark atmosphere | Use `rgba(255,255,255, 0.06-0.09)` |
| Gradient text below 16px | Illegible at small sizes, especially on glass | Reserve for preview headings only |
| More than 3 accent colors in one view | Circus effect | Pick 1 primary (indigo), 1 semantic per context |
| Blur > 24px | Performance cost, diminishing returns | 12px for cards, 20px for sidebar, max 24px |
| Animating backdrop-filter | Severe performance issues | Animate opacity of a pre-blurred layer instead |
