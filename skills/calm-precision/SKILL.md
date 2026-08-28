---
name: calm-precision
description: |
  UI/UX implementation guide for building cognitively predictable interfaces.
  WHAT: Decision trees, component patterns, code examples, anti-patterns, and audit checklists grounded in perceptual science (Gestalt, Fitts, Hick, Cognitive Load, Signal-to-Noise, Affordance, Temporal Gestalt, Dual-Coding, Pragmatic Inference, Attentional Cascade).
  WHEN: Building or modifying frontend components, pages, layouts, navigation, forms, dashboards, or lists. Reviewing UI for design compliance. Any frontend design or implementation task.
  Triggers: "build a component", "create a page", "add UI", "frontend design", "design review", "UI audit", "navigation", "form layout", "dashboard", "list view", "card component", "build the frontend", "style this", "make it look good", "chart", "graph", "data visualization", "KPI", "sparkline", "timeline chart", "table design"
user-invocable: false
---

# Calm Precision 6.6.0

Interfaces that think as clearly as their users. Every rule traces to perceptual science.

## Core Principles

1. **Group, Don't Isolate** (Gestalt) [S1] — Single border around related items, dividers between. Individual borders imply separation.
2. **Size = Importance** (Fitts) [S2] — Button size matches intent weight. Critical conversions = large, quick actions = compact.
3. **Three-Line Hierarchy + Page-Level Cascade** (Cognitive Load + Attentional Cascade) [S3] — Within components: Title (body size, **weight 600**) → Description (body size, weight 400) → Metadata (one step down, **muted color**). The three lines separate by weight and color, not by three font sizes. Across pages: L1 Anchor (one per page, largest) → L2 Orient (nav/controls) → L3 Primary Content (≥60% viewport) → L4 Supporting (hideable on mobile). Sizes come from the generated scale — see `references/type-scale.md`.
4. **Progressive Disclosure** (Hick) [S4] — Show less, reveal on demand. Fewer choices = faster decisions.
5. **Text Over Decoration** (Signal-to-Noise) [S5] — Color and weight create hierarchy, not boxes.
6. **Content Over Chrome** (Information Density) [S6] — ≥70% content-chrome ratio.
7. **Natural Language** (Mental Models) [S7] — Readable phrases over jargon.
8. **Rhythm & Alignment** (Continuity) [S8] — 8pt grid, consistent spacing, aligned baselines.
9. **Functional Integrity** (Affordance + Data Integrity) [S9] — Interactive only if backend exists AND action works. No fake buttons, no mock-data-as-real.
10. **Content Resilience + Error Strategy** (Fault Tolerance + Dual-Coding + Cooperative Principle) [S10] — Handle string, object, markdown, null. Numbers need semantic labels. Errors: what → why → fix. Empty states: context-matched CTA.
11. **Mobile-First Structure** (Responsive Design) [S11] — Base styles target mobile. Breakpoints add complexity.
12. **Purposeful Motion** (Temporal Gestalt) [S12] — Lift = interactive. Stagger = group. Press-in = confirmed. Never decorative. Respect `prefers-reduced-motion`.
13. **Voice Calibration** (Pragmatic Inference) [S13] — Button: Verb+Object ≤3 words. Error: what→why→fix. Loading: state what's happening. Tooltip: ≤8 words.
14. **Provenance & Authority** (Epistemic Integrity) [S14] — A surface that projects canonical state is a view, not an authority: it never becomes a second source of truth. Verified-vs-asserted is a decision, not a detail — show provenance beside the assertion it supports ("Calendar verified", "User-stated · not in calendar", "Draft — not sent"). Saturated chip fill is reserved exclusively for verification/provenance state; priority and other metadata never get saturated fill, so a filled chip always means one thing. Read-only projections may replace checkboxes with ordinals; interactive surfaces never may — a completable task keeps its checkbox.

## Decision Trees

### Border Usage
```
Need visual grouping?
├── No → Use whitespace only
└── Yes → Items share type?
    ├── Yes → Single border around ALL, dividers between
    └── No → Category headers, separate groups
```

### Button Sizing
```
Core conversion (login, checkout) → Full width
Equal choices (yes/no) → Side-by-side equal
Quick action (save, edit) → Compact inline
```

### Functional Integrity
```
Building interactive element?
├── Has backend API implemented? → Build with real data
├── API not implemented, demo OK? → Mark clearly as demo
└── No API → STOP — Don't build yet
```

### Element State
```
Has working action? → Make interactive
Coming soon? → Mark or hide
Needs upgrade? → Badge "Pro", link upgrade
Permanent no access? → HIDE (don't render)
```

### Loading State
```
<100ms → None | 100ms-1s → Spinner | 1s-3s → Skeleton | >3s → Progress bar
```

### Touch Targets
```
Primary action → h-12 (48px), full-width mobile
Secondary → h-10 or h-11 (40-44px)
Icon button → w-11 h-11 (44px)
Form input → h-11 minimum
```

### Card Interactivity
```
Not interactive → No lift, no shadow, no cursor change
Navigates to detail → Full lift: -translate-y-0.5 + shadow-lg + pointer
Has inline actions → Subtle lift: -translate-y-px + shadow-md
Card IS the action → Full lift + border accent
```

### Staggered Transitions
```
1 item → No stagger
2-5 items → 40-80ms per item (60ms sweet spot)
6+ items → Stagger first 5, batch rest
Total ≤400ms. Exit: simultaneous or reverse-faster.
```

### Error & Empty States
```
Error? → User error: inline fix near input | System error: retry + "not your fault" | Permission: upgrade CTA | Data error: fallback + retry
Empty? → First time: value promise + CTA (encouraging) | Search: broaden query (neutral) | Filter: reset CTA + count (neutral) | All done: celebration + next (celebratory)
Pattern: What happened → Why → What to do (each ≤1 sentence)
```

### Page Hierarchy
```
Exactly one L1 Anchor (largest, highest contrast)
L2 visually smaller than L1
L3 ≥60% of mobile viewport
L4 can hide on mobile without breaking page
```

### UI Copy Voice
```
Button → Verb + Object ≤3 words ("Add Source")
Placeholder → Instruction ("Search sources...")
Loading → State action ("Analyzing 3 sources...")
Confirmation → What + delta ("Source added to research")
Tooltip → ≤8 words ("Filter by document type")
```

## Auto-Apply Rules (30)

1. Three-line pattern (title → description → metadata)
2. Single border + dividers for groups
3. Button sizing by intent (full/equal/compact)
4. Category headers: smallest step, uppercase, +0.06em tracking, muted (never below the medium floor)
5. Search debounce: 300ms
6. Touch targets: ≥44px mobile, ≥24px desktop
7. Loading matches wait time
8. Empty states: value-driven CTA, tone matched
9. Status: text color, or soft tint ≤12% mix in dense rows — saturated fill reserved for verification/provenance state
10. Icons: max 2 colors per context
11. Accept string OR object input
12. Try field name alternatives (title/headline/name)
13. Support markdown: `#` `**` `-` paragraphs
14. Only build with real backend endpoints
15. Verify API exists before building UI
16. Mobile-first: base = mobile, breakpoints add
17. Input font ≥16px mobile (prevents iOS zoom)
18. line-clamp-2 on mobile, expand on demand
19. Tags: 2-3 visible + count
20. Actions: primary full-width, secondary row on mobile
21. Safe area: pb-6 for home indicator
22. All tappable need active: feedback
23. Overflow: fade gradient for horizontal scroll
24. Scroll margin with sticky headers
25. Numeric KPIs include semantic label
26. Interactive cards: lift (desktop) or press-in (mobile)
27. Multi-element changes: stagger 40-80ms, ≤400ms total
28. Button labels: Verb + Object ≤3 words
29. Errors: what → why → fix, route by type
30. One L1 anchor per page, L3 ≥60% viewport
31. Reuse patterns structure-only: inherit hierarchy, tokens, interaction patterns — never another surface's content, claims, or labels
32. Provenance labels sit beside the assertion they support; drafts state their unsent/unscheduled state prominently

## Always Ask Before

1. Individual borders on list items
2. Full-width buttons for non-critical actions
3. Saturated background fill on status or metadata (soft ≤12% tints exempt; saturated fill belongs to provenance alone)
4. >2 icon colors in same context
5. Technical jargon
6. Non-functional elements that look interactive
7. UI without real data source
8. Forms without backend handler
9. Mock data that looks real
10. Desktop-first class ordering
11. Touch targets under 44px mobile
12. All items visible when list >3-5 on mobile
13. Numeric values without semantic labels
14. Hover lift on non-interactive cards
15. Simultaneous state change on 3+ elements
16. Generic error copy without three-part structure
17. Empty states without actionable CTA
18. Multiple L1 anchors
19. Button labels >3 words or missing verb
20. "Loading..." without context

## Quick Self-Audit (26 Questions)

**Core:** 1. Borders group or isolate? 2. Button size = intent? 3. Three-line hierarchy? 4. Only needed info visible? 5. Status text-color or ≤12% tint; saturated fill = provenance only? 6. Icons ≤2 colors? 7. Natural language? 8. Chrome ≤30%? 9. Loading matches wait? 10. Click does something? 11. Handles string AND object? 12. Tries alt field names? 13. Left-aligned, top-aligned? 14. Real backend? 15. API exists?

**Mobile:** 16. Targets ≥44px? 17. Base class = mobile? 18. Content clamped? 19. Items limited + count? 20. Actions stacked?

**Interaction:** 21. Metrics have labels? 22. Interactive cards signal it? 23. Multi-element changes stagger?

**Content Strategy:** 24. Errors: what→why→fix? 25. Empty states: CTA + tone? 26. One L1, L3 ≥60%?

**North Star:** Cognitive predictability? Quiet intelligence or ornament? Connected to real data? Works on 320px? Motion communicates? User knows what to do on error? Copy scannable in <1s?

## Tailwind Quick Reference

```
Touch: w-11 h-11 (44px) | h-12 (primary) | min-h-[44px]
Mobile-First: flex-col md:flex-row | grid-cols-1 md:grid-cols-2
Truncation: truncate | line-clamp-2 | line-clamp-none
Safe: pb-6 | Active: active:bg-gray-200
Card Lift: hover:-translate-y-0.5 (full) | hover:-translate-y-px (subtle) | active:scale-[0.98]
Stagger: style={{ transitionDelay: `${index * 60}ms` }}
Type: 14/16/20/24/32 only (web_app scale) — text-sm text-base text-xl text-2xl; nothing below text-sm
Metrics: text-2xl font-bold (value) | text-sm text-gray-400 mt-0.5 (label)
L1: text-2xl md:text-3xl font-bold | L2: text-sm font-medium sticky top-0
L3: flex-1 min-w-0 | L4: hidden lg:block w-72
```

## Design Systems

Calm Precision defines structure. Design systems define surface treatment. Apply CP rules within the chosen system.

### Mode Selection
```
What kind of interface?
├── Developer tool, AI dashboard, data-heavy
│   ├── Primary workspace (immersive) → Aurora Deep
│   └── One of many tools (refined) → Aurora Glass
├── Personal tool, creative work, solo dev → Warm Craft
└── Multi-mode or cross-project → see references/cross-platform-patterns.md
```

### Quick Token Reference

| Token | Aurora Deep | Aurora Glass | Warm Craft |
|-------|-----------|-------------|------------|
| Background | `#060611` | `#09090b` | `#110f0d` |
| Surface | `rgba(255,255,255,0.025)` | `rgba(255,255,255,0.03)` | `rgba(255,255,255,0.03)` |
| Border | `rgba(255,255,255,0.06)` | `rgba(255,255,255,0.08)` | `rgba(200,180,160,0.08)` |
| Text primary | `#f0f0f5` | `#fafafa` | `#f5f0eb` |
| Text secondary | `#9d9db5` | `#a1a1aa` | `#a89a8c` |
| Text muted | `#5a5a72` | `#52525b` | `#6b5d52` |
| Accent | `#818cf8` indigo | `#818cf8` indigo | `#f0b65e` amber |

For full color systems, ambient gradients, component patterns: `references/design-systems/`

### Cross-Platform Foundational Rules
Complement CP's 14 principles. Apply to every mode: luminance hierarchy, left-border accent signals, frosted glass pill selectors, decision-first data, sequenced reveal, circadian-aware color, 80% content-to-chrome.
See `references/cross-platform-patterns.md`

### Typography
Body is the anchor; every other size is a multiple of it. The anchor follows viewing distance and task, not screen size. Line height is `size + constant gap`. Near ranks separate by weight and color, not size.
See `references/type-scale.md`

### Data Visualization
For charts, graphs, tables, KPIs, timelines, sparklines: decision-first titling, figure-ground contrast, ruthless decluttering, direct labeling, progressive disclosure, tabular numbers.
See `references/data-visualization-patterns.md`

## Additional Resources

For detailed reference material, consult:
- **`references/SOURCES.md`** — the citation behind every principle name: Fitts 1954, Hick 1952, Wertheimer 1923, Sweller 1988, Grice 1975, Paivio 1986, Gibson/Norman, Tufte, Duarte, Apple HIG, WCAG 2.2. Also names the three principle labels that are **coined, not literature** (Attentional Cascade, Temporal Gestalt, Epistemic Integrity)
- **`references/type-scale.md`** — Font sizes, line heights, and heading hierarchy. Body-anchored multiples, per-medium presets (web / reading / marketing / mobile / iOS / deck / TV), constant leading gap, floors. Generated from `~/dev/docs/standards/typography/scale.yaml` — never hand-pick sizes
- **`references/implementation-patterns.md`** — Full code examples, mobile patterns, voice calibration tables, error/empty state components
- **`references/audit-framework.md`** — Deep audit checklists by principle, anti-patterns table, strict vs flexible zones, semantic tokens, accessibility checks
- **`references/native-apple-platforms.md`** — iOS/macOS/watchOS native guide: SwiftUI patterns, system integration (HealthKit, CloudKit, WatchConnectivity, Live Activity), platform architecture, circadian-safe design, accessibility, 20 auto-apply rules, 30-point native audit
- **`references/cross-platform-patterns.md`** — Foundational rules F1-F10, mode selection, anti-patterns (from 67 rated mockups)
- **`references/data-visualization-patterns.md`** — Chart/graph/table design: decision-first titles, decluttering, direct labeling
- **`references/design-systems/`** — Visual design systems: Aurora Deep (glassmorphism), Aurora Glass (lighter), Warm Craft (earthy)

---

*Version 6.6.0 — 14 principles, 32 rules, 26 audit questions, 26 anti-patterns + 3 design systems + data viz patterns + generated type scale*
