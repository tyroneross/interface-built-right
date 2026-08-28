# Cross-Platform Design Patterns — Unified UI Guidance

A multi-style design system with shared foundational principles. Four distinct design modes united by common rules about readability, hierarchy, and restraint. Built so an LLM or human designer can read a mode brief and produce a new mockup for any app — not just the ones these patterns were derived from.

*Updated 2026-03-24 — Based on all 67 rated mockups across 6 projects (23 YAY, 17 OK, 23 NAY, 4 removed).*

---

## How to Use This Document

**If you're building a new app:** Pick the mode that matches your app's purpose (see Mode Selection below). Read that mode's brief. It contains everything you need — color, typography, layout, and platform-specific patterns for web, iOS, Mac, and Watch.

**If you're reviewing or rating a design:** Check it against the Foundational Rules (F1–F10). If it violates those, it's wrong regardless of mode. Then check mode-specific guidance for fit.

**If you're an LLM generating a mockup:** Read the foundational rules, then read the relevant mode brief. Produce HTML that follows both. The anti-patterns section tells you what to avoid.

---

## Foundational Rules (Apply to Every Mode, Every Platform)

These are non-negotiable. A mockup can follow mode-specific guidance perfectly and still fail if it breaks these.

**F1. Luminance hierarchy over decoration.** Important content is brighter. Context is dimmer. Structure is nearly invisible. Three opacity tiers for text: primary (`0.87`), secondary (`0.55`), tertiary (`0.35`) in dark mode. Equivalent gray scale in light mode (`#111827` → `#4b5563` → `#9ca3af`). This is the primary hierarchy tool — not font size, not color, not bold weight.

**F2. Left-border accent as categorical signal.** The single most consistent UI signature across all four modes. A 2-3px left border on cards, list items, and callouts signals category, mode, or status. Color varies by mode and context but the pattern is universal.

**F3. Frosted glass pill selectors.** For choosing between modes or categories, use frosted glass pills with a color-dot active indicator. Not bottom-border tabs (too generic), not filled-background pills (too heavy) — specifically the glass-pill-with-dot pattern.

**F4. Typography as design.** Font weight, spacing, and numeric rendering are design decisions, not afterthoughts. SF Pro at thin weights (100-300) for display numerics, `font-variant-numeric: tabular-nums` for data alignment, tight-not-cramped letter-spacing. Monospace for timestamps and durations.

**F5. Decision-first data presentation.** Chart titles are conclusions, not topics ("OpenAI leads funding" not "AI Funding Breakdown"). Insight line under the title. Source attribution at the bottom. The Pyramid Principle applied to data visualization.

**F6. Semantic color coding.** Color communicates meaning, not just decoration. Each mode/category/source gets a unique color that propagates across all surfaces — borders, glows, dots, text. Users should decode meaning from color alone.

**F7. Sequenced reveal.** Cascading fade-in-up animations with 60-400ms staggered delays guide the eye through content hierarchy. This is a functional pattern (reduces cognitive load) — distinct from the rejected "decorative animation" anti-pattern.

**F8. Circadian-aware color.** For apps used at night or during focus periods, warm palettes (>560nm wavelengths) replace cool blues. Amber (#D4943A), copper (#C47850), rose (#B8607A), sage (#8B9A4B).

**F9. Content-to-chrome ratio minimum 80%.** Navigation, toolbars, and status bars are the remaining 20%. If chrome exceeds that, something needs to collapse or hide.

**F10. Dark mode default.** Light-mode mockups were consistently rated lower. Dark mode is the primary design target across all platforms. Light mode is an accessibility option, not the default.

**F11. Reduced motion respect.** All animations and transitions must be wrapped in a `prefers-reduced-motion` check. When the user has reduced motion enabled, disable all transitions, sequenced reveals, hover lifts, and ambient animations. The interface must be fully usable without any motion. CSS: `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }`

### Responsive Breakpoints (All Sidebar Modes)

For modes with a sidebar layout (Glass Workspace, Warm Craft, Data Narrative on desktop):

| Breakpoint | Sidebar | Content | Notes |
|-----------|---------|---------|-------|
| ≥1280px | Full width (220-250px) | `flex: 1`, max-width ~1040px, padding 32px | Sidebar always visible |
| 1024–1279px | Icon-only collapse (56px) | Expands to fill, padding 24px | Sidebar shows icons + tooltips |
| <1024px | Off-canvas drawer (hidden) | Full-width, padding 16px | Hamburger toggle in header |

Card grids switch from `auto-fill minmax(300px, 1fr)` to single-column below 768px. KPI clusters stack vertically below 480px.

### Status Colors (All Modes)

| Status | Dark Mode | Light Mode |
|--------|-----------|------------|
| Success / Active | `#34d399` | `#059669` |
| Warning / Caution | `#fbbf24` | `#d97706` |
| Error / Destructive | `#fb7185` | `#dc2626` |
| Info / Primary | `#60a5fa` | `#2563eb` |
| Neutral / Inactive | `rgba(255,255,255,0.35)` | `#9ca3af` |

Status is communicated through text color + optional small dot (6-8px). Never through colored background badges.

### Motion Philosophy (All Modes)

| Context | Duration | Easing | Rule |
|---------|----------|--------|------|
| Ambient (gradients, backgrounds) | 15-20s or none | ease-in-out | Slow or still. Never distracting. |
| Interactive (hover, focus, tap) | 0.15-0.25s | ease | Fast, confident, no bounce. |
| Navigation transitions | 0.3-0.4s | ease-in-out | Match platform conventions. |
| Loading states | N/A | N/A | Skeleton screens, never spinners. |
| Sequenced reveal | 60-400ms stagger | ease-out | Content appears top-to-bottom, left-to-right. |

**Never:** spring/elastic easing, bounce, overshoot, animated backdrop-filter, breathing/pulsing decorative effects.

### Icon Design

Icon quality matters at the detail level. Consistency across an icon set is more important than any individual icon being clever. Stroke weight, corner radius, and optical sizing must be uniform.

---

## Mode Selection

| App Purpose | Primary Mode | Why |
|-------------|-------------|-----|
| Focus / timer / wellness / meditation | Atmospheric Immersion | Immersive, single-task, circadian-aware |
| Developer tools / dashboards / workspace | Glass Workspace | Structured, data-rich, professional with personality |
| Personal / creative / journaling / crafts | Warm Craft | Handmade feel, warm, inviting |
| News / intel / research / visualization | Data Narrative | Decision-first, dense, hybrid dark+light |

---

## Mode 1: Atmospheric Immersion

*For apps where the user enters a focused state. The interface creates a sense of place — like stepping into a room designed for concentration. Mobile-first, watch-native.*

### Philosophy

The atmospheric quality is functional, not decorative. Gradient backgrounds signal which mode the user is in. Glow effects on borders signal session state. Thin-weight typography at large sizes creates calm. Everything is in service of: "What am I doing, how far along am I, what should I do next?"

### Color Palette

| Context | Background | Accent | Glow |
|---------|-----------|--------|------|
| Focus / Pomodoro | `#0e1225` → `#252d55` gradient | `#3a4878` (steel indigo) | `rgba(58,72,120,0.3)` |
| Flow | `#0c1214` → `#1e2848` | `#2d5560` (deep teal) | `rgba(45,85,96,0.3)` |
| Adaptive | `#100c14` → `#1a1428` | `#4a3560` (purple) | `rgba(74,53,96,0.3)` |
| Break / Rest | `#0c140e` → `#1a2820` | `#059669` (green) | `rgba(5,150,105,0.3)` |
| Insights (data overlay) | `#000000` flat | `#2563eb` (blue) | None |
| Circadian / Night | `#0a0a0a` | `#D4943A` (amber) | `rgba(212,148,58,0.2)` |

Warm circadian variants for each mode: amber (#D4943A), copper (#C47850), rose (#B8607A), sage (#8B9A4B). Apply these when the app is used in evening or the user has enabled a "night" preference.

### Typography

| Role | Font | Size | Weight | Notes |
|------|------|------|--------|-------|
| Hero number (timer) | SF Pro / SF Mono | 44-48pt | 200-300 | `tabular-nums`, ultralight |
| Screen title | SF Pro Display | 28px | 700 | One per screen |
| Card title | SF Pro Text | 15px | 600 | |
| Body / description | SF Pro Text | 12-13px | 400 | Secondary opacity |
| Timestamp / metadata | SF Mono | 11px | 400 | Tertiary opacity, monospace |
| Section header | SF Pro Text | 11px | 600 | Uppercase, `letter-spacing: 1.5px` |

### Key Components

**Frosted Glass Card** — The primary content container. `background: rgba(255,255,255,0.08)`, `backdrop-filter: blur(20px)`, `border: 1px solid rgba(255,255,255,0.08)`, `border-left: 2px solid [mode-color]`, `border-radius: 10-12px`, `box-shadow: 0 0 6px rgba([mode-color], 0.3)`. Padding 12-14px.

**Progress Ring** — SVG circle, stroke-width 3-5px, `stroke-linecap: round`, background track at 8% opacity, progress arc in mode color. On watch: this is the primary visual. On phone: secondary to the hero number.

**Thin Progress Bar** — Alternative to ring. 3px height, full width, rounded ends. Simpler for glance use.

**Quality Dots** — 5 filled/empty circles (6px), color matches category. Use for 1-5 ratings, quality scores.

**Insight Callout** — `background: rgba(accent, 0.05)`, `border: 1px solid rgba(accent, 0.1)`, `border-left: 2px solid accent`, border-radius 12px. Contains title (12px/600) + body (12px/400). Placed inline in content flow.

**Atmospheric Background** — Two radial gradient blobs positioned off-screen edges (top-left and bottom-right). Low opacity (15-18%). Blurred at 35px. They create mood without competing with content.

### Platform: iOS (iPhone)

This is the primary platform for Atmospheric Immersion. Most YAY mockups target this form factor.

**Screen structure:** True black or gradient mesh background. Content starts at 50px below top to clear the notch. 20px horizontal padding. Scrollable vertical flow with hidden scrollbar.

**Navigation:** Title (28px/700) left-aligned + action button right-aligned in a fixed header. For multi-section apps: bottom tab bar (system native) for top-level navigation, glass pill segmented control for in-page filtering.

**Content flow:** Vertical timeline/list with date-based section headers (11px uppercase, 1.5px letter-spacing). 28px spacing between sections. Cards stack vertically with 6-8px gaps. Infinite scroll, no pagination.

**Touch targets:** Text-based interaction — tap the card row, not a tiny button. Glass cards are the tap target. Minimum 44pt per Apple HIG.

**KPI display — compact style:** Large value (28px/700), label below (12px, secondary), delta below that (11px, green/red). No container — values float directly on background.

**KPI display — glass style:** Frosted glass card with thin-weight values (36px/200), internal dividers, streak/summary row at bottom.

**Key consideration:** The atmospheric background gradient must be subtle enough that text at 0.55 opacity is still readable. Test on actual OLED screens — gradients can introduce banding.

### Platform: Apple Watch (watchOS)

Atmospheric Immersion was designed for watch-native interaction. The watch versions are the most essential expression of this mode.

**Core rule:** One metric per screen. No dashboards. The hero number IS the interface.

**Navigation:** Digital Crown drives vertical tab switching (watchOS TabView). Tab 1: timer display. Tab 2: daily stats. Tab 3: session history. No scrolling within a tab — everything fits one screen.

**Timer display:** Hero number (44-48pt, center) dominates. Thin progress bar (3px) or ring (120px) is secondary. One pause/resume button below. Nothing else.

**Mode selection (idle state):** Crown carousel — one mode at a time, name large (28-32px), duration hint below, dot indicators for position. Tap to start. This is more watch-native than a scrollable list.

**Colors:** Maximum 3 accent colors on watch — more becomes indistinguishable. Use mode color for primary metric, green for positive delta, amber for caution. Apply circadian warm palette for evening use.

**Touch targets:** Minimum 38pt (Apple HIG). Buttons are 28-30px diameter circles or full-width pill shapes.

**Complications:** Circular (single number + label), Rectangular (number + 7-day sparkline), Corner (icon + streak count), Inline (text summary).

**Text hierarchy compresses to two tiers.** Primary (value) and secondary (label). No tertiary — there's no room.

**Background:** Always true black `#000000`. No gradients, no glass, no blur. OLED power budget is critical.

**Key consideration:** Design for 1-2 second glance at arm's length. Color + number + progress indicator should communicate state without reading.

### Platform: macOS

Atmospheric Immersion has limited use on Mac — menu bar popovers and focus timers only. Don't build a full Mac app in this mode.

**Menu bar extra:** 280px wide glass popover. Show the timer, current mode, and one "start/stop" action. Use the same frosted glass and accent colors as iOS but at Mac density (13px body, 12px labels).

**Focus timer window:** A small floating window (320x400px) with the timer display. Transparent title bar, traffic lights inset. No sidebar. The atmospheric gradient background works at this size.

### Platform: Web

Limited to hero sections, onboarding flows, or single-purpose focus web apps. For full web dashboards, use Glass Workspace instead.

**Single-purpose web app (e.g., Pomodoro timer):** Full-viewport, centered layout. Same patterns as iOS but at desktop sizes — hero number at 72px, progress ring at 200px. No sidebar.

---

## Mode 2: Glass Workspace

*For apps where the user manages, organizes, and navigates structured information. The interface is a tool — professional but with personality. The glass and glow effects say "this is crafted software, not a generic dashboard." Desktop-first.*

### Philosophy

Glass Workspace is the anti-SaaS-gray. It uses the same sidebar+content layout as every productivity tool, but the frosted glass surfaces, ambient aurora glows, and translucent layering give it a distinctive feel. The glass is always subtle — you notice the content, not the container. The ambient glow is mood, not decoration.

### Color Palette

| Variant | Background | Surface | Accent | Glow |
|---------|-----------|---------|--------|------|
| Aurora Glass | `#09090b` | `rgba(255,255,255,0.03-0.06)` | `#818cf8` (indigo) | Multi-color ambient radials |
| Aurora Deep | `#060611` | `rgba(255,255,255,0.03)` | `#818cf8` | Single indigo radial + drift animation (20s) |
| Neon Terminal | `#0a0a0a` | `rgba(255,255,255,0.03)` | `#22d3ee` (cyan) | Cyan ambient |

Semantic colors for categorization: emerald (#34d399) for source/connected, indigo (#818cf8) for primary/upload, violet (#a78bfa) for plugin/extension, cyan (#22d3ee) for utility/system.

### Typography

| Role | Font | Size | Weight | Notes |
|------|------|------|--------|-------|
| Page title | SF Pro / Inter | 28px | 700 | |
| Card title | SF Pro / Inter | 14-15px | 600 | |
| Body / description | SF Pro / Inter | 12-13px | 400 | Secondary opacity |
| Code / paths | SF Mono / Monaco | 12px | 400 | |
| Section label | SF Pro / Inter | 11px | 600 | Uppercase, `letter-spacing: 0.08-0.12em` |
| Nav item | SF Pro / Inter | 13px | 500 | |
| Stat value | SF Mono | 14px | 600 | Color-coded by category |

### Key Components

**Glass Card** — `background: rgba(255,255,255,0.03-0.06)`, `backdrop-filter: blur(12-24px)`, `border: 0.5px solid rgba(255,255,255,0.06)`, `border-radius: 10-12px`. On hover: `translateY(-1px)` + gradient line appears at top edge (opacity 0→1). Padding: 14-16px.

**Sidebar** — Fixed 220-250px. Glass background matching the variant. Nav items have left-border active indicator (2px solid accent, transparent when inactive). Sections divided by uppercase labels. User chip at bottom.

**Pill Filter** — Frosted glass pills in a row. Active pill gets accent-color glow background + text color. Inactive pills are near-invisible (`rgba(255,255,255,0.03)`).

**Stats Bar** — Horizontal row of stat items above content area. Each stat: value (14px/600, colored) + label (11px, tertiary). Color-coded by meaning.

**Source Badge** — Small colored dot (6px) next to a label. Emerald for GitHub/connected, indigo for upload, violet for plugin. Used in card headers and list items.

**Ambient Background** — Body::before with radial gradients at low opacity. Aurora Deep adds a `drift` animation (translate + scale, 20s infinite) for gentle movement. Aurora Glass uses multiple static radials for multi-color glow.

### Platform: Web (Primary)

This is the primary platform for Glass Workspace.

**Layout grid:**
```
≥1280px: Sidebar (240px) + Content (flex:1, max-width 1040px, padding 32px)
1024-1279px: Sidebar collapses to icons (56px), content expands
<1024px: Sidebar becomes off-canvas drawer, content full-width with 16px padding
```

**Sidebar pattern:** Brand mark + name at top. Section labels (11px uppercase). Nav items with 2px left-border active indicator. Hover: subtle background shift. Active: accent glow background + border color. User chip at bottom with avatar.

**Card grid:** `repeat(auto-fill, minmax(300-320px, 1fr))` with 12px gaps. Cards contain: header (source dot + title), description (2-line clamp), footer (metadata + count).

**Multi-pane editor:** 3-column split (code/preview/companions) for editor-style layouts. Line numbers column at 40px.

**Search/command palette:** Glass overlay centered on screen. Input at top with focus ring glow. Results below as a list with keyboard navigation.

### Platform: macOS (Full Implementation)

Glass Workspace translates directly to native Mac apps.

**Window chrome:** Transparent title bar with traffic lights inset into the sidebar area. Drag region on the sidebar title. No traditional toolbar.

**Sidebar:** Use `NSVisualEffectView` with `.sidebar` material. Left-border accent indicators translate directly. System accent colors (blue/indigo) for active states.

**Glass surfaces:** `NSVisualEffectView` with `.hudWindow` or `.light` material approximates the CSS blur. For cards, use custom CALayer with blur + border.

**Ambient glow:** CAEmitterLayer for subtle particle effects, or Metal view for continuous gradient animation (Aurora Deep's drift effect).

**Density adjustment:** Mac gets ~15% tighter spacing than web: card padding 12-14px, section gap 20-24px, page padding 24px, body text 13px, sidebar 220px.

**Key patterns:** Command palette (cmd+K), detail pane (optional third column at 280-320px), preferences as grouped cards with dividers.

### Platform: iOS

Glass Workspace is not the primary iOS mode — use it for overlay panels, settings views, and detail sheets only.

**Settings panel:** Grouped card layout with dividers between rows. Each group is a glass card. Same border-radius (12px) and glass treatment as web cards but at iOS density.

**Detail sheet:** Presented as a modal sheet. Glass background with content blocks. Left-border accents on items.

### Platform: Watch

Not applicable. Glass effects are too expensive on watch hardware and illegible at that size.

---

## Mode 3: Warm Craft

*For apps where the experience should feel personal, made by hand, inviting. Like a well-organized notebook or a woodworker's shop — everything has a place, and the materials themselves are beautiful. Works across all platforms.*

### Philosophy

Warm Craft rejects the cold precision of most software. It uses warm blacks and browns instead of blue-blacks, DM Sans instead of system fonts (where possible), amber instead of blue. The subtle dot-texture overlay on backgrounds says "this was made, not generated." Every surface has a material quality.

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#1a1714` | Base surface |
| Surface | `#211e19` / `#2a2620` | Cards, sidebar |
| Primary accent | `#e8a23d` (amber) | Active states, CTA, left-border accents |
| Secondary accents | `#7cb587` (sage), `#cf6b54` (rust), `#6ba3cf` (sky), `#9b7ec8` (plum) | Category colors |
| Text: warm white | `#f5f0e8` | Primary text (0.87 equivalent) |
| Text: warm dim | `#b8af8a` | Secondary text (0.55 equivalent) |
| Text: warm muted | `#7d7468` | Tertiary text (0.35 equivalent) |
| Border | `#302c26` / `#3d3830` | Dividers, card edges |

### Typography

| Role | Font | Size | Weight | Notes |
|------|------|------|--------|-------|
| Page title | DM Sans | 28px | 700 | Warm white |
| Card title | DM Sans | 14-15px | 600 | |
| Body / description | DM Sans | 13-14px | 400 | Warm dim |
| Code / paths | DM Mono | 12px | 400 | |
| Section label | DM Sans | 11px | 600 | Uppercase |
| Filter chip | DM Sans | 12px | 500 | In pill chips |

When DM Sans is unavailable (iOS, Watch): fall back to SF Pro but keep the warm color palette. The warmth comes more from color than from font.

### Key Components

**Warm Card** — `background: #211e19`, `border: 1px solid #302c26`, `border-left: 3px solid #e8a23d` (amber), `border-radius: 10px`. On hover: `translateY(-1px)` + border color brightens to `#3d3830`. Padding: 14-16px. Header has colored source dot (8px) + title.

**Dot-Texture Background** — Subtle repeating dot pattern (1px dots at 3% opacity, 16px grid) overlaid on the base background via `position: fixed` pseudo-element. Creates a "paper" material quality. CSS: `background-image: radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px); background-size: 16px 16px;`

**Chip Pills** — Rounded pill shapes (`border-radius: 20px`) for filters and tags. Active: amber border + amber text + warm glow background. Inactive: muted border + muted text.

**Source Label** — Colored underline bar (12x2px) as a pseudo-element before the source name. Each source gets a category color.

**Sidebar** — 230px, same warm surface color. Brand icon (28x28 gradient square) + app name. Nav items with 3px left border (transparent → amber on active). Rounded right corners (8px).

### Platform: Web (Full Implementation)

**Layout:** Sidebar (230px) + Content (padding 32-36px). Card grid: `repeat(auto-fill, minmax(300px, 1fr))` with 10px gaps.

**Editor layout:** 3-column split (source/preview/companions at 190px) for editing interfaces. Line numbers in DM Mono.

**Hover states:** Subtle — `translateY(-1px)`, border color shift, shadow lift. No scale transforms. Opacity 0.9 on button hover. The warm aesthetic is quiet.

### Platform: macOS

Warm Craft works well on Mac with some adaptation.

**Window chrome:** Standard Mac window frame with warm-tinted sidebar. Use custom `NSAppearance` with warm tint colors.

**Typography:** DM Sans can be bundled as a custom font. If system font is required, SF Pro with the warm color palette retains 80% of the feel.

**Sidebar:** Standard sidebar with custom tint. Left-border amber indicators.

**Texture overlay:** Use a subtle repeating pattern image rendered in a background NSView. Keep it at 3-5% opacity.

**Key difference from Glass Workspace on Mac:** No glass/blur effects. Warm Craft uses solid surfaces with visible borders. The Mac version should feel more like a Craft-style app than a system utility.

### Platform: iOS

Warm Craft on iOS: warm black background (#1a1714 or equivalent), amber accent, no texture overlay (too subtle at phone DPI).

**Navigation:** Standard iOS tab bar + navigation controller, but with warm tinting. Custom tab bar appearance with warm colors.

**Cards:** Same warm card pattern but with iOS padding (12-14px). Left-border amber accents.

**Typography:** Fall back to SF Pro on iOS. Use the warm white text color (#f5f0e8) to maintain the warm feel.

**Touch targets:** 44pt minimum. Chip pills should be at least 44pt tall when used as tap targets.

### Platform: Watch

Simplified: true black background, ember accent (#e8a23d) for active states, warm white text. No texture, no cards with visible borders. Just the warm color palette on black.

**List items:** Left-border amber accent at 2px. Warm white text. Ember-colored status dots.

---

## Mode 4: Data Narrative

*For apps that present research, news, trends, and dense information. The interface tells a story — dark atmospheric hero sections draw the user in, light content areas present the data clearly, and decision-first charts make the information actionable. Desktop-first, responsive.*

### Philosophy

Data Narrative is a hybrid mode. It breaks the "dark mode everywhere" rule by using dark hero sections for atmosphere and light content areas for readability of dense data. The dark-to-light transition creates a natural reading flow: you're drawn into the hero, then settle into the content. Network graph visualizations in the hero section signal "this is connected information." Decision-first chart titles tell the user what matters before they even read the data.

### Color Palette

| Zone | Background | Text | Accent |
|------|-----------|------|--------|
| Hero (dark) | `#0c1222` | `rgba(255,255,255,0.87-0.55)` | `#3B82F6` (blue), `#6366F1` (indigo), `#8B5CF6` (purple) |
| Content (light) | `#F9FAFB` | `#111827` / `#4b5563` / `#9ca3af` | `#3B82F6` (blue), `#059669` (green), `#DC2626` (red) |
| Cards | `#FFFFFF` | Standard light-mode tiers | Subtle shadow: `0 1px 3px rgba(0,0,0,0.1)` |

Status in charts: blue for highlighted/key finding, gray for context. Green for positive, red for negative. No decorative color.

### Typography

| Role | Font | Size | Weight | Notes |
|------|------|------|--------|-------|
| Hero headline | Inter / system | 28-48px | 700-800 | Dark zone |
| Page title | Inter / system | 24px | 600 | Light zone |
| Feature card title | Inter / system | 16px | 600 | |
| Chart title | Inter / system | 14px | 500 | Decision-first: conclusion not topic |
| Chart insight | Inter / system | 12px | 400 | `color: #6b7280` |
| Body / description | Inter / system | 14px | 400 | |
| Source attribution | Inter / system | 11px | 400 | `color: #9ca3af` |
| Tag / label | Inter / system | 11px | 500 | Uppercase, `letter-spacing: 0.5px` |

### Key Components

**Dark Hero Section** — Full-width, `#0c1222` background, 56-80px vertical padding. Contains: headline, search bar (glass effect), and optional network graph visualization (SVG with animated dashed lines + floating nodes at 10-30% opacity).

**Bento Grid** — 6-column grid with irregular card spans. Feature cards at 4-col wide for primary, 2-col wide for secondary. Creates visual hierarchy through size, not just content. `gap: 16-24px`.

**Decision-First Chart** — Title is a conclusion (14px/500). Insight line below (12px, gray-500). Chart body: bar/line/table. Source attribution at bottom (11px, gray-400). Key finding highlighted in blue, context in gray.

**Trending/Velocity Indicator** — Pulsing green dot ("live") + percentage with arrow ("+340%"). Signals temporal urgency. Pulse animation: opacity 1→0.4→1, 2s cycle.

**Skeleton Loader** — Shimmer animation for loading states. Gray rectangles with a sweeping gradient highlight. Never use spinners.

**Network Graph Background** — Decorative SVG: dashed connection lines with `dash-flow` animation, floating circles (3-6px) with gentle float animation (8-12s). Low opacity (10-30%). Signals "connected information" without being interactive.

**Rotating Text Carousel** — In headlines, a single word rotates through options ("Track [AI · Climate · Markets · Health]"). Fade-up animation per word. Use sparingly — one per page maximum.

### Platform: Web (Primary)

**Layout:**
```
Header: Sticky dark bar (56px, z-40) with horizontal nav tabs
Hero: Full-width dark section with network viz, search, headline
Content: Light background, max-width 1200px, centered
Sections: Alternating white/gray-50 backgrounds for visual rhythm
```

**Navigation:** Horizontal tabs in the sticky header. Active tab gets 2px bottom border in blue-500. Underline alignment trick: `padding-bottom: 4px; margin-bottom: -17px`.

**Bento grid:** `grid-template-columns: repeat(6, 1fr)` at desktop. Cards span 2-4 columns. At tablet: 2-column grid. At mobile: single column.

**Card hover:** `translateY(-2px)` + `shadow-lg` + border color brightens. Active state: `scale(0.98)` for tactile feedback.

**Staggered reveal:** Content sections fade-in-up with 60-300ms stagger delays (`.d1` through `.d5`). Each section begins animation as it enters viewport.

**Multi-page architecture:** Each major section (Search, Feed, Trends, Graph) is a full page. Page transitions use fade-in-up at 0.3-0.6s.

### Platform: macOS

Data Narrative works well on Mac with native rendering.

**Window chrome:** Standard title bar. Horizontal tab bar below it (segmented control or custom).

**Hero section:** Dark background in the toolbar/header area. Network graph visualization rendered with Core Graphics or Metal. Translucent title bar over the dark hero.

**Content area:** Light background with native NSTableView for data tables, SwiftUI Charts for visualizations.

**Skeleton loaders:** Animate custom NSView layers with shimmer gradient.

**Key difference from Glass Workspace:** Data Narrative uses a light content background. This means the overall feel is brighter than Glass Workspace, with the dark hero as contrast.

### Platform: iOS

Simplified version: dark navigation bar/header with the app's network graph motif, light scrollable content below.

**Navigation:** Standard iOS navigation controller with a custom dark appearance on the navigation bar.

**Content flow:** Light background cards in a scrollable feed. Decision-first titles on each card. Bento grid simplifies to single-column on phone.

**Charts:** Use iOS Charts framework or custom Core Graphics. Same decision-first title pattern.

**Search:** Full-screen search with dark background (matching the hero zone aesthetic).

### Platform: Watch

Not applicable. Data Narrative is too information-dense for watch screens.

---

## Anti-Patterns (Universal — All Modes, All Platforms)

| Anti-Pattern | Why It Fails |
|-------------|-------------|
| Gamification (XP, levels, badges, leaderboards) | Infantilizes the interface, wrong engagement model |
| Decorative animation (breathing rings, color-shifting gradients) | Gimmicky, not functional. Distinct from sequenced reveal (F7) which serves hierarchy. |
| Purple gradient hero backgrounds (`#667eea → #764ba2`) | Dated, generic SaaS-landing-page aesthetic |
| Light-mode settings UIs (gray-50 card stacks) | Generic, no personality, could be any app |
| Over-simplified "minimalist" views | Strips away data density. Minimalism ≠ emptiness. |
| Generic split-view / drawer layouts | Standard UI patterns without personality or craft |
| Mobile-first bottom-sheet patterns on desktop | Wrong affordance for the platform |
| "Unified" kitchen-sink layouts | Trying to show everything at once loses hierarchy |
| Timeline data without visual structure | Needs cards, dots, or vertical connectors |
| Widget-grid dashboards (many small cards) | Too segmented, competes for attention |
| Thumb-zone-only mobile layouts | Over-optimizing for reach kills readability |
| Overlay-heavy interfaces | Too many modals/overlays fragment the experience |
| Pure white (#fff) text on dark backgrounds | Too stark, eye-straining. Use off-white or warm white. |
| Completion/done screens with no content | A screen that says "done" isn't a design |

---

## Cross-Platform Component Quick Reference

These patterns adapt to every mode. Apply the mode's colors and typography.

**Content Block:** Left-border accent (2-3px) + title + description + metadata. Padding: 14-16px web, 12-14px iOS/Mac, 8-10px Watch.

**Section Header:** 11px, weight 600, uppercase, letter-spacing 0.08-0.12em. Optional subtitle below at 12px tertiary.

**Labeled Progress Bar:** `Label ████████░░░░ Value`. Height: 28px web, 24px iOS, 20px Mac, 12px Watch. Full track with rounded ends, label column 70-80px right-aligned.

**Thin Progress Bar (inline):** No label, no value — just the bar. Height: 3-4px web/iOS/Mac, 2px Watch. Full-width inside a card or list item. Rounded ends. Fill color = category/mode accent. Track at 6% white opacity. Use for reading progress, upload progress, or any inline completion indicator where the context makes the meaning clear.

**Quality Dots:** `●●●●○` (6px circles, filled/empty, category color). Works at every scale.

**Inline Insight Callout:** Tinted background (accent 5%), border (accent 10%), left border (accent 100% at 2px). Contains title + body.

**KPI Cluster:** Works in every mode — apply the mode's accent for deltas, the mode's text tiers for value/label/delta. Horizontal at ≥320px (value | value | value with labels below). Vertical on Watch. Max 4 metrics; 3 is ideal. Value: 28-32px thin weight (200-300), `tabular-nums`. Label: 11px tertiary. Delta: 11px, green/positive or red/negative (use mode-specific green/red — e.g., sage/rust in Warm Craft, `#34d399`/`#fb7185` in Glass Workspace).

**Completed/Archived Card State:** Apply `opacity: 0.65` to the entire card. Progress bar fills to 100%. Left-border accent stays (signals category even when dimmed). Metadata line updates to "Completed" + date/duration. Do not gray out the accent color — the dimmed opacity is sufficient and preserves category recognition.

**Empty State:** Centered within the content area that would contain data. Dashed border container (`1px dashed` at border color, border-radius matching cards). Inside: one line of tertiary text explaining what will appear ("No books in progress" not "Nothing here"). Optional: single action link in accent color ("Add a book"). No illustrations, no icons, no emoji. Height: match the minimum height of one card row (~120px) so the layout doesn't collapse.

---

## Implementation Priority

When building a new app in any mode, implement in this order:

1. **Typography and text hierarchy** — gets 60% of the feel right
2. **Color tokens** — background, surfaces, text tiers, one accent
3. **Content blocks with left-border accents** — your signature
4. **Section headers** — establishes information architecture
5. **Data visualization** (if applicable) — see `data-visualization-patterns.md`
6. **Surface treatment** (glass/texture/shadow) — enhancement, not structure
7. **Motion** — final polish, always optional

---

## File Reference

| Document | Purpose |
|----------|---------|
| `cross-platform-design-patterns.md` | This document — modes, platforms, foundational rules |
| `data-visualization-patterns.md` | Charts, graphs, tables, KPIs, timelines — all data display patterns |
| `mockup-gallery-reviewer.html` | Interactive tool to rate all existing mockups |
| `mockups/` | Curated gallery of 24 YAY-rated mockup files (visual reference) |
| `archive/aurora-deep.md` | Legacy Aurora Deep detailed token spec |
| `archive/aurora-glass.md` | Legacy Aurora Glass detailed token spec |
| `archive/warm-craft.md` | Legacy Warm Craft detailed token spec |

---

## Rating Data Snapshot (2026-03-24) — COMPLETE

All 67 mockups rated across 6 projects.

**YAY (23):** FloDoro calm-precision, liquid-gradient, timeline, timeline-liquid-gradient, timer-directions, timer-display, navigation-approach, color-warmth, idle-mode-picker, five-palettes, four-directions, typography-progress, mode-selector, full-composite, icon-refined, icon-concepts · Atomize chart-visualization-mockups, concept-b-atlas, concept-d-combined, concept-d-full-app · Skill Bank aurora-glass, warm-craft, aurora-deep

**OK (17):** FloDoro insights-dashboard, liquid-expanded, light-mode · Atomize v4-command-palette, v6-settings, v7b-timeline-left, v7d-trends, atomize-alternatives, concept-a-pulse, concept-c-signal, entity-relationship-editor, graph-integration · Skill Bank calm-precision, neon-terminal, ember-forge · Interface Built Right minimal-tabs, design-3-updated

**NAY (23):** FloDoro thumb-zone-timer, better-overlays · Atomize v1-timeline-drawer, v2-bottom-sheet-mobile, v3-split-view-desktop, v5-dashboard-widgets, v6-simple-split, v6-trends, v7a-ultra-minimal, v7c-inline-timeline, v7d-search-final, atomize-unified-v2, atomize-v3-complete, cp62-design-exploration, desktop-executive-intel-layout, ai-trends-base, calm-precision-mockup · Atomize News desktop-executive-intel, mobile-cp61-before-after · Prompt Test Lab ab-test-draft-a, tests-draft-a · Interface Built Right compact-vertical, dashboard-panel

**Removed (4):** FloDoro waiting, waiting-1, color-palettes · Atomize mobile-cp61-before-after

---

*Derived from 67 mockups across FloDoro, Atomize AI/News, Skill Bank, Prompt Test Lab, and Interface Built Right. Curated YAY gallery: `mockups/` (24 files).*
