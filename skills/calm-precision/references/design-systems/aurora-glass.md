# Aurora Glass — UI Guidelines

A translucent glassmorphism system with ambient light. This is the foundational variant from which Aurora Deep evolved. Use Aurora Glass for lighter-touch applications where depth is desirable but the full deep-space treatment of Aurora Deep would be too heavy.

---

## Relationship to Aurora Deep

Aurora Glass and Aurora Deep share DNA but serve different intensities:

| Aspect | Aurora Glass | Aurora Deep |
|--------|-------------|-------------|
| Background | `#09090b` (near-black, neutral) | `#060611` (midnight navy) |
| Ambient gradient | Subtle, no animation | Stronger colors, slow drift animation |
| Sidebar | Frosted glass | Frosted + branded mark with glow |
| Nav active state | Glow background pill | Glow bg + dot indicator |
| Card hover | Lift + brighter border | Lift + top accent line + deeper shadow |
| Stats bar | Not included | Colored metric cards |
| Section headers | Simple text + count | Line divider + count pill |
| Overall mood | Clean glass office | Deep space command center |

**Use Aurora Glass** when the interface is one of many tools the user switches between — it should feel refined but not immersive.

**Use Aurora Deep** when the interface is the user's primary workspace — it should feel like a place to inhabit.

Both follow the same component patterns, spacing, and typography. The difference is in surface treatment, ambient effects, and density of visual flourish.

---

## Color System

### Base Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg` | `#09090b` | Page background. Neutral near-black (vs Deep's blue-black). |
| `--surface` | `rgba(255,255,255,0.03)` | Card and container fill. |
| `--surface-hover` | `rgba(255,255,255,0.06)` | Interactive hover. |
| `--glass` | `rgba(255,255,255,0.04)` | Inputs, dropdowns, secondary surfaces. |
| `--glass-border` | `rgba(255,255,255,0.08)` | Default borders. |

### Text

| Token | Hex | Usage |
|-------|-----|-------|
| `--primary` | `#fafafa` | Pure near-white. Slightly cooler than Deep's `#f0f0f5`. |
| `--secondary` | `#a1a1aa` | Body text, descriptions. Neutral gray. |
| `--muted` | `#52525b` | Metadata, placeholders, inactive. |

### Accents

Same accent palette as Aurora Deep:

| Token | Hex | Usage |
|-------|-----|-------|
| `--accent` | `#818cf8` | Primary actions, focus, active states |
| `--accent-glow` | `rgba(129,140,248,0.15)` | Active backgrounds, focus rings |
| `--green` | `#34d399` | Success, GitHub, connected |
| `--amber` | `#fbbf24` | Warning states |
| `--rose` | `#fb7185` | Errors, destructive |
| `--cyan` | `#22d3ee` | Syntax highlighting, tertiary accent |

---

## Key Differences from Aurora Deep

### 1. Ambient Background

Aurora Glass uses a static, subtle gradient — no animation:

```css
body::before {
  background:
    radial-gradient(ellipse at 20% 50%, rgba(129,140,248,0.06) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, rgba(34,211,238,0.04) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 80%, rgba(251,191,36,0.03) 0%, transparent 50%);
  /* No animation */
}
```

Maximum opacity at any point: 0.06 (vs Deep's 0.07). The gradient is perceptible but never draws attention.

### 2. Sidebar

Glass sidebar without a branded mark:

```
┌──────────────────────┐
│ Skill Bank           │  ← Text-only title (gradient optional)
│                      │
│   Skills             │  ← Simpler nav — no dots, no section labels
│   Import             │
│   Settings           │
│                      │
│ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │
│ [Avatar] Name        │  ← Avatar + name, no email
└──────────────────────┘
```

Active nav: accent-glow background + primary text. No dot indicators, no section dividers. Cleaner, faster to scan.

### 3. Cards — Simpler Grid

Cards use a flat grid without source section dividers:

```
┌──────────────────┐  ┌──────────────────┐
│ skill-name       │  │ skill-name       │
│ description...   │  │ description...   │
│ source · project │  │ source · project │
└──────────────────┘  └──────────────────┘
```

Source type shown as colored dot + text in the metadata row — not a separate badge or tag component.

```css
.source-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; margin-right: 4px; }
.dot-github { background: var(--green); }
.dot-upload { background: var(--accent); }
```

### 4. No Stats Bar

Aurora Glass omits the metrics row. The skill count appears next to the page title as muted text: "Skills 132 skills". This is less visually rich but keeps the page cleaner.

### 5. Filter Pills — Same Pattern

Both use the glass pill bar:

```css
.pill-bar { background: var(--glass); border: 1px solid var(--glass-border); border-radius: 10px; padding: 3px; }
.pill.active { background: var(--accent-glow); color: var(--accent); }
```

This is a shared Aurora-family pattern.

---

## Component Reference

All components follow the same specifications as Aurora Deep with these simplifications:

### Cards
- No top accent line on hover
- Shadow on hover: `0 4px 12px rgba(0,0,0,0.2)` (lighter than Deep's 24px spread)
- TranslateY: -1px (vs Deep's -2px)

### Buttons
- Same button styles as Aurora Deep
- CTA shadow: `0 2px 8px rgba(99,102,241,0.25)` (slightly softer)

### Inputs
- Same glass input style
- Focus: `border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow);`

### Editor
- Same split-view layout
- Same syntax highlighting
- Preview headings: solid `--accent` color (not gradient text — that's Deep only)

### Drop Zone
- Same dashed border pattern
- Hover radial gradient is optional (simpler = just border color change)

---

## Typography

Identical to Aurora Deep. Same scale, same font stack, same tracking rules.

---

## Spacing

Identical to Aurora Deep. 8pt grid, same tokens.

---

## Motion

### Key Difference: No Ambient Animation

Aurora Glass's background gradient is static. Everything else follows the same motion rules as Aurora Deep:
- 0.2s ease for interactions
- translateY for hover elevation
- No bounce or spring

---

## When to Choose Glass vs Deep

| Signal | Choose Glass | Choose Deep |
|--------|-------------|-------------|
| Primary workspace | | x |
| Secondary/utility tool | x | |
| Dense data (100+ items) | | x (stats bar helps) |
| Clean, minimal feel | x | |
| Brand-forward product | | x (branded sidebar) |
| Marketing/landing adjacent | x | |
| Developer tool | Either works | |

---

## Combining with Calm Precision

Aurora Glass is the closest Aurora variant to Calm Precision. To create a transition path:

1. Start with Calm Precision's solid surfaces
2. Replace solid `--surface` with `rgba(255,255,255,0.03)` + `backdrop-filter: blur(12px)`
3. Replace bottom-border nav active state with glow-bg pill
4. Add ambient gradient to body
5. Replace source text-color indicators with dot + text

Each step is independently reversible. A user preference toggle could switch between Calm Precision (solid, no blur) and Aurora Glass (translucent, blurred) using the same layout and components.

---

## Anti-Patterns

Same as Aurora Deep, plus:

| Don't | Why | Instead |
|-------|-----|---------|
| Add the drift animation | That's Aurora Deep's signature, not Glass's | Static gradient only |
| Use branded sidebar mark | Glass is intentionally simpler | Text title, optionally gradient-colored |
| Add stats bar | Glass is leaner | Skill count next to page title |
| Gradient text in preview | Deep's flourish, not Glass's | Solid accent color for headings |

---

## Accessibility

Same contrast ratios and focus management as Aurora Deep. The neutral `--bg` (#09090b) provides marginally better contrast than Deep's blue-tinted `--bg` (#060611) for warm accent colors.
