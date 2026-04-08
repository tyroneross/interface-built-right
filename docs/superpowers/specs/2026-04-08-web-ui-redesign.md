# IBR Web-UI Redesign — Aurora Deep + Feature Parity

**Date:** 2026-04-08
**Version target:** IBR v0.8.0
**Design system:** Aurora Deep (Calm Precision)
**Scope:** Full visual redesign + feature parity with CLI/MCP (29 tools)

---

## 1. Problem

The web-ui exposes ~15% of IBR v0.8.0's feature set. It uses a generic light Tailwind theme with no design identity. Key gaps: no design system visualization, no native platform testing, no interactive session management, no flow testing UI. The layout has a dual-header conflict (root layout renders nav that the dashboard overrides).

## 2. Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Theme | Aurora Deep | Developer tool, immersive workspace, dark-first |
| Layout | Full-bleed app shell + sidebar | Comparison canvas needs max viewport. 5 feature domains need persistent nav. |
| Sidebar | 56px collapsed, icon-only | Max content space. Tooltips on hover. |
| Simplification | Content > chrome | Removed: filter pills, thumbnails, section labels, stacked buttons, stats rows, config panels. Every element earns its space. |

## 3. App Shell

### Sidebar (56px)

- Background: `#060611` + `backdrop-filter: blur(20px)`
- Right border: `rgba(255,255,255,0.06)`
- 5 nav items + settings pinned bottom:
  1. Sessions (primary workspace)
  2. Design System
  3. Workflows
  4. Native Testing
  5. Settings (bottom)
- Active: `rgba(129,140,248,0.12)` bg, `#f0f0f5` text, 6px indigo dot with glow
- Inactive: `#5a5a72` text, transparent bg
- Hover: `#9d9db5` text, `rgba(255,255,255,0.025)` bg
- Icons: 20px, stroke-based, single color
- Logo mark: indigo gradient square at top

### Aurora Deep Background

Static ambient gradient on `<body>`, visible through glass surfaces:

```css
background: #060611;
background-image:
  radial-gradient(ellipse at 15% 30%, rgba(99,102,241,0.07) 0%, transparent 50%),
  radial-gradient(ellipse at 75% 15%, rgba(34,211,238,0.05) 0%, transparent 45%),
  radial-gradient(ellipse at 50% 85%, rgba(167,139,250,0.04) 0%, transparent 50%);
```

No animation on gradient. Static ambiance only.

### Root Layout

Replace dual layout with single app shell:
- Remove root `layout.tsx` header/nav and `max-w-7xl` constraint
- App shell: sidebar + full-bleed content area
- Each nav route renders its own internal layout

---

## 4. Sessions View

Three-panel layout: Library (220px) + Canvas (flex-1) + Details (240px).

### Library Panel (220px)

- Glass surface: `rgba(255,255,255,0.025)` + `blur(20px)`, right border
- **Search:** Glass input, 40px height, placeholder "Search...", 300ms debounce
- **Session list:** Single outlined container (`rgba(255,255,255,0.06)` border, 12px radius), thin dividers between items
- **Each row:** Name (13px/500, `#f0f0f5`) + status dot (6px, semantic color) + diff% (`#5a5a72`) — one line
  - No thumbnails, no metadata line, no type badges
  - Selected: 2px indigo left border + `rgba(255,255,255,0.05)` bg
  - Hover: `rgba(255,255,255,0.025)` bg
- **Status dots:** emerald=match, amber=changed, rose=broken, indigo=active, muted=pending
- No filter pills. No "Check All" button. Search handles filtering.

### Canvas (flex-1)

- Transparent bg (aurora shows through), 16px padding
- **View tabs** (top-right): Split | Overlay | Diff — underline text tabs, not pills
  - Active: `#818cf8` text + 2px bottom border
  - Inactive: `#5a5a72` text
- **Comparison container:** `rgba(255,255,255,0.06)` border, 12px radius, glass surface
  - Split: two panes, 1px glass-border divider
  - Overlay: single pane, opacity slider with indigo thumb
  - Diff: red channel diff on dark bg
- **Image loading:** skeleton shimmer
- **Click-to-expand:** zoom cursor, opens fullscreen lightbox
- **Empty state:** centered icon (indigo-glow circle) + "No session selected" + "Create a new one" + primary CTA button

### Details Panel (240px)

- Glass surface + `blur(20px)`, left border
- **Content (no section headers):**
  - Session name: 15px/500, `#f0f0f5`
  - URL: 13px, `#9d9db5`, break-all
  - Verdict line: "MATCH · 0.0%" — verdict in semantic color, diff in primary
  - Analysis: 13px, `#9d9db5`, leading-relaxed, 2-3 lines
  - **Action icons:** horizontal row of 3 icon buttons (36px each)
    - Compare (refresh icon)
    - Accept (check icon)
    - Delete (trash icon, rose on hover). Two-click destructive.
    - Tooltips on hover
  - **Feedback:** textarea (glass input, min-h-16, resize) + compact "Send" button right-aligned
    - Disabled: muted text, no glow
    - Enabled: indigo accent when content present

---

## 5. Design System View

Single-column, max-w-3xl centered. The simplest view.

### Layout

- **L1 Anchor:** Compliance score — 48px bold indigo number (e.g., "87%")
- Below score: "6 violations found" in `#9d9db5`
- **Violations list:** Single outlined container, dividers
  - Each row (one line): severity dot (rose=error, amber=warn) + principle name in `#f0f0f5` + description in `#9d9db5`
  - Principles: gestalt, signal-noise, content-chrome, cognitive-load (error), fitts, hick (warn)
- **Bottom:** "Validate Now" button (indigo CTA) + "Last validated: 2 min ago" muted text

Three elements total: score, list, button.

---

## 6. Workflows View

Single-column, max-w-3xl centered. One unified list.

### Layout

- **Top-right:** "Run Scan" button (indigo, compact)
- **Unified list:** Single outlined container, dividers. All items sorted by time (running first).
  - Each row (one line, 44px): status indicator + name + URL (truncated) + verdict + diff% + timestamp
  - Running: pulsing indigo dot, "running" text, elapsed time. No verdict.
  - Completed: verdict as colored text (MATCH/CHANGED/BROKEN — shortened labels), diff%, relative timestamp
  - Clicking completed row navigates to session detail
- No page title. No section labels. No Quick Actions section.

---

## 7. Native Testing View

Two-column: Devices (240px) + Results (flex-1).

### Devices Panel (240px)

- Outlined container, dividers between items
- Devices grouped by inline platform labels: "iOS", "watchOS", "macOS" — just the word in muted text
- Each device: name + OS version + status dot (emerald=booted, muted=off)
- Selected: indigo left border
- **Bottom:** "Scan" button (indigo, full width)

### Results Panel (flex-1)

- **Empty state:** "Select a device and scan" centered, muted
- **After scan:**
  - Headline: "iPhone 16 Pro · 94/100" — score in emerald
  - Issues list: same pattern as design system violations — severity dot + element + description, one line each
  - **Row drill-down:** Clicking an issue row expands inline to show:
    - Element screenshot/visual with bounds highlighted (bounding box overlay)
    - Computed CSS properties (font-size, color, padding, etc.)
    - Accessibility attributes (role, label, describedBy)
    - Source correlation: Swift file:line link
  - **LLM-readable export:** Each scan auto-saves structured data to `.ibr/native-scans/<device>-<timestamp>.json` containing:
    - Full element tree with bounds, computed styles, a11y attributes
    - Accessibility audit score + issues
    - HTML/CSS snippets per element
    - Source file correlations
    - Format: JSON keyed by element selector. Each entry: `{ selector, tagName, text, bounds: {x,y,w,h}, styles: {fontSize, color, padding, ...}, a11y: {role, label}, issues: [{severity, rule, message}], sourceFile?, sourceLine? }`. One object per element — no recursive nesting. Matches existing IBR scan output shape.

---

## 8. Modals

Two modals only. Minimal inputs.

### New Session

- Width: max-w-sm (384px)
- Title: "New Session" (18px/600)
- Name input (placeholder: "e.g., Homepage")
- URL input (placeholder: "http://localhost:3000")
- Footer: Cancel (ghost) + Create (indigo CTA)
- Viewport defaults to Desktop. Changeable later in session settings.

### Upload Reference

- Width: max-w-sm (384px)
- Title: "Upload Reference" (18px/600)
- Drop zone: dashed border, "Drop image or click to browse", file type hint
- Name input (placeholder: "e.g., Dashboard mockup")
- Footer: Cancel (ghost) + Upload (indigo CTA, disabled until file selected)
- Framework/component library/target path/notes — omitted. Add as optional metadata after upload.

---

## 9. Settings View

Full nav page (not a modal). Replaces the settings gear button.

### Layout

Max-w-2xl centered. Sections with glass-border dividers:

- **Server:** Port input (default 4200), auto-open browser toggle
- **Comparison:** Threshold input (0-100%, default 5%), viewport presets
- **Design System:** Enable/disable toggle, config file path, principle toggles
- **About:** Version, links

---

## 10. Shared Component Patterns

### Glass Surfaces

```css
background: rgba(255,255,255,0.025);
backdrop-filter: blur(12px);
border: 1px solid rgba(255,255,255,0.06);
border-radius: 12px;
```

### Inputs

```css
background: rgba(255,255,255,0.03);
border: 1px solid rgba(255,255,255,0.06);
border-radius: 10px;
color: #f0f0f5;
font-size: 13px;
padding: 10px 16px;
/* Focus: */
border-color: #818cf8;
box-shadow: 0 0 0 3px rgba(129,140,248,0.12);
```

### Buttons

| Type | Background | Text | Border |
|------|-----------|------|--------|
| Primary (CTA) | `linear-gradient(135deg, #818cf8, #6366f1)` | `#fff` | none |
| Glass | `rgba(255,255,255,0.03)` | `#9d9db5` | `rgba(255,255,255,0.06)` |
| Ghost | transparent | `#5a5a72` | none |
| Destructive | transparent | `#fb7185` | none |

- Primary hover: glow shadow `0 4px 20px rgba(99,102,241,0.4)` + translateY(-1px)
- Disabled: muted text color, no opacity change (conflicts with glass)
- Touch targets: min 44px height on mobile, 36px desktop icon buttons

### Status Colors (text-only, no background badges)

| Status | Color | Token |
|--------|-------|-------|
| Match/Pass | `#34d399` | emerald |
| Changed/Warn | `#fbbf24` | amber |
| Broken/Error | `#fb7185` | rose |
| Active/Running | `#818cf8` | indigo |
| Pending/Off | `#5a5a72` | muted |

### Two-Click Destructive

First click: text changes to "Confirm?" in rose. Second click: executes. Click-away resets. No modal dialogs.

### Motion

- Interactive: 0.2s ease (hovers, focus, state changes)
- Cards: 0.25s ease
- No bounce, no spring, no decorative animation
- `prefers-reduced-motion`: all transitions → 0.01ms

---

## 11. Migration from Current UI

### Files to Remove
- `web-ui/app/layout.tsx` — root layout with header/nav (replaced by app shell)
- `web-ui/components/layout/Header.tsx` — top header (replaced by sidebar)

### Files to Rewrite
- `web-ui/app/globals.css` — Aurora Deep tokens + ambient gradient
- `web-ui/app/dashboard/page.tsx` — sessions view within app shell
- `web-ui/app/workflows/page.tsx` — simplified unified list
- `web-ui/components/layout/LibraryPanel.tsx` — simplified session list
- `web-ui/components/layout/DetailsPanel.tsx` — condensed details
- `web-ui/components/comparison/ComparisonCanvas.tsx` — glass surfaces
- `web-ui/components/comparison/ViewTabs.tsx` — underline text tabs
- `web-ui/components/comparison/SplitView.tsx` — dark theme
- `web-ui/components/comparison/OverlayView.tsx` — dark theme
- `web-ui/components/comparison/DiffView.tsx` — dark theme
- `web-ui/components/sessions/NewSessionModal.tsx` — simplified
- `web-ui/components/sessions/UploadReferenceModal.tsx` — simplified
- `web-ui/components/ui/Button.tsx` — Aurora Deep variants
- `web-ui/components/ui/Badge.tsx` — text-only status
- `web-ui/components/ui/Modal.tsx` — glass modal
- All component files in details/ — consolidated into DetailsPanel

### New Files
- `web-ui/app/layout.tsx` — new app shell with sidebar
- `web-ui/components/layout/Sidebar.tsx` — 56px nav sidebar
- `web-ui/app/design-system/page.tsx` — design system view
- `web-ui/app/native/page.tsx` — native testing view
- `web-ui/app/settings/page.tsx` — settings page
- `web-ui/lib/tokens.ts` — Aurora Deep design tokens as constants
- API routes for design system, native scanning if not present

### Dependencies
- No new dependencies. Tailwind CSS 4.0 handles everything.
- `backdrop-filter` browser support: all modern browsers, no polyfill needed.

---

## 12. Wireframe Reference

Approved lo-fi wireframes in `/mockups/`:
- `01-sessions-view.html`
- `02-design-system-view.html`
- `03-workflows-view.html`
- `04-native-testing-view.html`
- `05-modals.html`

---

## 13. Calm Precision Compliance

| Rule | Implementation |
|------|---------------|
| Gestalt (group, don't isolate) | Single container + dividers for lists. No individual borders. |
| Fitts (size = importance) | CTA buttons full-width or prominent. Icon buttons for secondary actions. |
| Three-line hierarchy | Title (14-16px/500-600) → Content (13px) → Metadata (11px muted) |
| Hick (progressive disclosure) | Minimal inputs in modals. Settings in own page. Drill-down on native issues. |
| Signal > noise | Status as text color only. No background badges. No decorative borders. |
| Content > chrome | >=70% content ratio. No section labels unless needed. |
| Functional integrity | No fake buttons. Disabled states use muted color, not opacity. |
| Touch targets | >=44px mobile, >=36px desktop icon buttons |
| Mobile-first | Base styles target mobile. Panels collapse on small viewports. |
| Motion | Fast interactive (0.2s), no decorative animation, respects reduced-motion |
