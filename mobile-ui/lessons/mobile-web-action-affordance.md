# Lesson: Action Affordance on Mobile Web

**Platform: Mobile Web App** (not iOS native — CSS/Tailwind, not SwiftUI)
**Source:** Atomize AI user testing + post-test UX fixes (2026-04-09)
**Confidence:** Verified — implemented, compiled, review-passed

---

## Problem

User testing on a mobile web news app revealed three categories of failure, all rooted in the same issue: **interactive elements lacked sufficient visual affordance for touch users**.

1. **Invisible actions** — A hamburger menu rendered as a bare SVG icon (`p-2 text-gray-400`) with no background, border, or shadow. Users didn't recognize it as tappable.
2. **Text-only buttons** — "Go deeper" and "Source" were styled as plain colored text (`text-xs text-[#818cf8] bg-transparent border-none p-0`). On mobile, these read as labels, not actions.
3. **Wrong interaction model** — Tapping an article opened an iframe viewer (blank white screen for most sites). Users expected tapping to reveal content inline, not navigate away.
4. **Close buttons as afterthoughts** — X/close buttons were `rounded-xs opacity-70` with no background — hard to find, hard to tap.

## Discovery

The core insight: **on mobile web, every touchable element needs a visible container**. Desktop users have hover states and cursor changes to discover interactivity. Mobile users have nothing — the resting visual state IS the affordance.

Research from building iOS apps (FloDoro, SpeakSavvy) confirmed this independently:
- Button physics (scale+spring) solves the *feedback* problem on native
- But mobile web can't rely on press animations alone — the *discovery* problem must be solved visually at rest

### What works on mobile web

| Technique | When to use | CSS pattern |
|-----------|-------------|-------------|
| **Pill button** | Primary/secondary actions inline with content | `bg-[color]/[0.08] hover:bg-[color]/[0.14] px-3 py-1.5 rounded-full min-h-[32px]` |
| **Circular icon button** | Navigation, close/dismiss, toolbar actions | `w-[44px] h-[44px] rounded-full bg-white/[0.08] hover:bg-white/[0.14]` |
| **Subtle glow shadow** | Critical navigation (hamburger, FAB) | `shadow-[0_0_8px_rgba(129,140,248,0.1)]` |
| **Frosted glass container** | Overlays, drawer headers, floating controls | `bg-white/[0.06] backdrop-blur-sm border border-white/[0.08]` |

### What doesn't work on mobile web

| Anti-pattern | Why it fails |
|--------------|-------------|
| Text-only buttons (`bg-transparent p-0`) | Indistinguishable from labels. No tap target visible |
| Opacity-only hover (`opacity-70 hover:opacity-100`) | No hover on touch. Resting state looks disabled |
| Bare SVG icons without container | Users don't recognize as tappable — looks decorative |
| `cursor-pointer` as affordance | No cursor on touch devices |
| Iframe article viewers | Most sites block embedding (X-Frame-Options). Shows blank white screen |

## Solution

### 1. Pill buttons for inline actions

Before:
```css
/* Invisible on mobile — looks like a label */
.go-deeper {
  font-size: 12px;
  color: #818cf8;
  background: transparent;
  border: none;
  padding: 0;
}
```

After:
```css
/* Visible container, clear tap target */
.go-deeper {
  font-size: 12px;
  font-weight: 500;
  color: #818cf8;
  background: rgba(129, 140, 248, 0.08);
  padding: 6px 12px;
  border-radius: 9999px;
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.go-deeper:hover {
  background: rgba(129, 140, 248, 0.14);
}
```

Tailwind equivalent:
```
text-xs font-medium text-[#818cf8] bg-[#818cf8]/[0.08] hover:bg-[#818cf8]/[0.14]
px-3 py-1.5 rounded-full min-h-[32px] inline-flex items-center gap-1
```

Secondary variant (Source, Hide):
```
text-xs font-medium text-[#7a7a92] bg-white/[0.04] hover:bg-white/[0.08]
px-3 py-1.5 rounded-full min-h-[32px] inline-flex items-center gap-1
```

### 2. Circular icon buttons (hamburger, close)

```
w-[44px] h-[44px] rounded-full
bg-white/[0.08] hover:bg-white/[0.14]
text-[#9d9db5] hover:text-white
transition-all
shadow-[0_0_8px_rgba(129,140,248,0.1)]
```

The 44px size meets WCAG 2.2 AA touch target minimum. The shadow uses the app's accent color at very low opacity — enough to create a subtle glow that draws the eye without being garish.

For close/dismiss buttons (less prominent):
```
w-[36px] h-[36px] rounded-full
bg-white/[0.08] hover:bg-white/[0.14]
text-[#a0a0b8] hover:text-[#f0f0f5]
```

### 3. Card-as-button for inline expansion

Instead of opening a modal/iframe on article tap, expand content inline:

```tsx
<article
  onClick={() => expandSummary(article.id)}
  role="button"
  tabIndex={0}
  className="cursor-pointer hover:bg-white/[0.03]"
>
  {/* Article content */}
  {isExpanded && <AISummaryPanel />}
</article>
```

Key: the card body click triggers expansion. Dedicated pill buttons for "Go Deeper" and "Source" sit below the metadata with `e.stopPropagation()` so they don't double-fire.

### 4. Action row spacing for thumb reach

Before: `gap-3 mt-1` (12px gap, 4px top margin)
After: `gap-4 mt-3 mb-2` (16px gap, 12px top margin, 8px bottom margin)

On mobile, cramped action rows cause mis-taps. The extra vertical breathing room separates the action zone from the content zone.

## Dark Mode Specifics (Mobile Web)

Dark backgrounds make traditional shadows invisible. Two adaptations:

1. **Use `bg-white/[0.08]` not `shadow-sm`** for element containers — the semi-transparent white reads as elevation on dark surfaces
2. **Accent-colored glow** (`shadow-[0_0_8px_rgba(accent,0.1)]`) works where standard box-shadow fails — the color makes the shadow visible even on `#060611` backgrounds
3. **Text contrast** — `#5a5a72` on `#060611` is only ~3.5:1 contrast (fails AA). Use `#7a7a92` (~4.5:1) for body text, `#f0f0f5` for titles

### Settings page dark mode trap

Using Tailwind light-mode classes (`text-gray-900`, `border-gray-200`) inside a hardcoded dark layout (`bg-[#060611]`) makes text invisible. When the app forces dark mode via `next-themes` with `enableSystem={false}`, every page component must use dark-compatible colors explicitly — Tailwind's `dark:` prefix only helps if the theme is class-toggled.

| Light class (broken) | Dark replacement (working) |
|----------------------|---------------------------|
| `text-gray-900` | `text-[#f0f0f5]` |
| `text-gray-500` | `text-[#7a7a92]` |
| `border-gray-200` | `border-white/[0.06]` |
| `divide-gray-100` | `divide-white/[0.04]` |
| `hover:bg-gray-50` | `hover:bg-white/[0.04]` |

## Differences from iOS Native

| Concern | iOS Native (SwiftUI) | Mobile Web (CSS/Tailwind) |
|---------|----------------------|--------------------------|
| Press feedback | Scale transform + spring animation (0.96, 0.3s, 0.6 damping) | `active:scale-[0.97]` + `transition-transform` (less precise) |
| Elevation | `shadow(radius:y:)` with dark mode `base` multiplier | `bg-white/[opacity]` containers (shadows fail on dark bg) |
| Touch target | System enforces 44pt | Must manually set `min-h-[44px] min-w-[44px]` |
| Haptic feedback | `UIImpactFeedbackGenerator` | Not available (some browsers support Vibration API) |
| Button discovery | System button styles provide affordance by default | No default — must add visible container to every action |
| Dark mode | `@Environment(\.colorScheme)` auto-adapts | Must use explicit dark-compatible colors or `dark:` prefix |
| Scroll behavior | Native momentum, rubber-banding | `-webkit-overflow-scrolling: touch` (inconsistent) |

## Key Takeaway

**Mobile web needs MORE visual affordance than native, not less.** Native platforms provide system-level feedback (haptics, springs, cursor changes). Mobile web has none of that — the visual design must compensate by making every interactive element self-evidently tappable through visible containers, backgrounds, and spacing.

## What NOT to do

- Don't rely on `cursor-pointer` for mobile discoverability — there is no cursor
- Don't use opacity as the only interactive state — `opacity-70` looks disabled, not interactive
- Don't open iframes on article tap — most news sites block embedding
- Don't use light-mode Tailwind classes in a forced-dark layout
- Don't put action buttons closer than 16px apart on mobile — thumb mis-taps
- Don't skip `e.stopPropagation()` when nesting clickable buttons inside clickable cards

## Applies to

All mobile web apps with dark themes, especially content-heavy apps (news feeds, dashboards, settings pages) where inline actions compete with content for attention.
