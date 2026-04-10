# Dark Mode Shadow & Depth System

Research synthesized from Material Design 3, Apple HIG, and implementation experience on SpeakSavvy iOS (Build 25).

## Core Insight: Shadows Don't Work on Dark — Use Light Instead

Traditional drop shadows are invisible on dark backgrounds (`#0F1419`). Expert designers flip the paradigm: instead of dark shadows on light surfaces, use **surface luminance shifts** + **faint white borders** + **colored glows**.

## The 4-Level Shadow System

Implemented and verified on SpeakSavvy iOS:

| Level | Use Case | SwiftUI Implementation | Visual Effect |
|---|---|---|---|
| **Card** | Primary content cards | `.shadow(color: .black.opacity(0.25), radius: 8, y: 4)` + `.overlay(RoundedRectangle.stroke(white.opacity(0.04), 1px))` | Subtle depth with edge definition |
| **Elevated** | Nested elements (grid cells) | `.shadow(color: .black.opacity(0.15), radius: 4, y: 2)` | Lighter lift for sub-elements |
| **Glow** | Accent CTA buttons | `.shadow(color: accent.opacity(0.35), radius: 12, y: 6)` + `.shadow(color: accent.opacity(0.15), radius: 24, y: 12)` | Button appears to emit light |
| **Score** | Data badges | `.shadow(color: scoreColor.opacity(0.3), radius: 6, y: 2)` | Badge glows its own semantic color |

## Why Two-Layer Shadows

Material Design 3 uses two shadow layers at every elevation:
- **Ambient**: `rgb(0 0 0 / 30%)` — broad, soft, omnidirectional
- **Key**: `rgb(0 0 0 / 15%)` — tighter, directional

SwiftUI supports this via stacked `.shadow()` modifiers. The Glow level uses this for realistic depth:
```swift
.shadow(color: Theme.accent.opacity(0.35), radius: 12, y: 6)   // tight glow
.shadow(color: Theme.accent.opacity(0.15), radius: 24, y: 12)  // diffuse ambient
```

## Surface Luminance Hierarchy

Minimum 4 levels for a professional dark UI:

```
Background:     #0F1419  (deepest — page background)
Surface:        #1A1F26  (cards, primary containers)
Elevated:       #242B35  (nested elements, grid cells, input fields)
Overlay:        #2E3640  (modals, popovers, tooltips)
```

Material Design 3 overlay system: each elevation gets a semi-transparent white overlay at increasing opacity (0% → 5% → 7% → 8% → 9% → 11%).

## The Faint Border Technique

On dark backgrounds, a 1px border at `white.opacity(0.04-0.06)` provides edge definition without looking like a visible border. Combined with a shadow, this creates the "card floating above surface" effect:

```swift
.overlay(
    RoundedRectangle(cornerRadius: Theme.cornerRadius)
        .stroke(Color.white.opacity(0.04), lineWidth: 1)
)
```

## Accent Color Rules

- **One saturated accent, everything else desaturated.** On dark backgrounds, saturated colors appear 20-30% more vivid.
- Reserve the accent color for: CTAs, active states, positive trends, interactive indicators
- Score/status colors (green, orange, red) only for data — never for decoration
- Use accent at 10-12% opacity for icon container backgrounds: `accent.opacity(0.1)`

## Typography Adjustments for Dark Mode

- Use **slightly heavier font weights** than light mode (dark backgrounds make text appear thinner)
- Increase line spacing slightly for readability
- Primary text: off-white (`#F0F2F5`), not pure white — reduces eye strain
- Secondary: `#8B95A5`, Muted: `#5A6577` — 3-tier text hierarchy

## Inner Shadows (iOS 16+)

For elements that should feel "pressed in" (progress bar tracks, input fields):
```swift
RoundedRectangle(cornerRadius: 8)
    .fill(Theme.surfaceElevated.shadow(.inner(color: .black.opacity(0.5), radius: 3, y: 2)))
```

## CompositingGroup for Clean Button Shadows

Without `.compositingGroup()`, shadow applies to both the button text AND background separately. With it, the entire button is treated as one layer:
```swift
Button { } label: { ... }
    .compositingGroup()
    .shadow(color: Theme.accent.opacity(0.3), radius: 12, y: 4)
```

## Verified Sources

- [Material Design 3 — Elevation](https://m3.material.io/styles/elevation/applying-elevation) — shadow CSS values, overlay system
- [SwiftUI Shadow Techniques — Swift Anytime](https://www.swiftanytime.com/blog/shadow-in-swiftui) — modifier stacking, CompositingGroup
- [Apple shadow() Documentation](https://developer.apple.com/documentation/swiftui/view/shadow(color:radius:x:y:)) — API reference
- [Dark Mode Design Best Practices 2026](https://www.tech-rz.com/blog/dark-mode-design-best-practices-in-2026/) — layered darkness, comfort contrast
- [12 Principles of Dark Mode Design — Uxcel](https://uxcel.com/blog/12-principles-of-dark-mode-design-627) — overlay system, surface layering

## Lessons from Implementation

1. `Color.black.opacity(0.25)` at `radius: 8` is the sweet spot for card shadows on `#0F1419` — visible but not heavy
2. The white border at 0.04 opacity is almost imperceptible individually but the cumulative effect across many cards is significant
3. Teal glow on CTA buttons draws the eye powerfully — use sparingly (one per screen)
4. Score badges glowing their own color (green/orange/red) creates an intuitive visual language without any labels
5. Spring animation (response: 0.3, dampingFraction: 0.8) is the right feel for card expand/collapse
