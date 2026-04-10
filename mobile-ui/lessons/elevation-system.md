# Lesson: Elevation System for Depth Hierarchy

**Source:** FloDoro UX enhancement (2026-04-09), Design+Code (T3), Dark Mode UI Best Practices (T3)
**Confidence:** Verified — compiled. Visual validation pending.

## Problem

iOS apps without a shadow system feel flat. All elements exist on the same visual plane — cards, buttons, modals, and controls compete for attention equally.

## Discovery

Two verified insights from research:

1. **Shadows imply height, not weight** — a card with `shadow(radius: 4, y: 2)` feels like it floats above the surface. A card with `shadow(radius: 16, y: 8)` feels like a modal demanding attention. The y-offset matters more than blur.

2. **Shadows must adapt to color scheme** — dark mode makes traditional shadows invisible. Lighter shadow opacity in dark mode, or switch to borders/subtle gradients for elevation cues.

## Solution

Three-tier elevation system:

```swift
enum ElevationLevel {
    case subtle   // cards, surfaces — barely floating
    case medium   // floating controls, FABs — clearly above content
    case high     // modals, popovers — demands attention

    var radius: CGFloat {
        switch self { case .subtle: 4; case .medium: 8; case .high: 16 }
    }

    var y: CGFloat {
        switch self { case .subtle: 2; case .medium: 4; case .high: 8 }
    }

    func shadowColor(isDark: Bool) -> Color {
        let base: Double = isDark ? 0.3 : 1.0
        switch self {
        case .subtle:  return Color.black.opacity(0.06 * base)
        case .medium:  return Color.black.opacity(0.10 * base)
        case .high:    return Color.black.opacity(0.15 * base)
        }
    }
}
```

Usage:
```swift
CardView()
    .elevation(.subtle)

FloatingActionButton()
    .elevation(.medium)

ModalSheet()
    .elevation(.high)
```

### Dark mode adaptation

The `base` multiplier (0.3 in dark, 1.0 in light) means:
- Light mode `.subtle` = `black.opacity(0.06)` — visible
- Dark mode `.subtle` = `black.opacity(0.018)` — barely there, doesn't fight the dark background

In dark mode, borders and subtle material differences carry elevation better than shadows.

## What NOT to do

- Don't use x-offset shadows — light comes from above, not the side
- Don't use colored shadows on controls (save for accent glows on rings/progress)
- Don't stack elevations — a card inside a modal doesn't get double shadows
- Don't apply elevation to flat content lists — only floating/grouped elements

## Future ideas

- Could detect shadow usage without dark mode adaptation
- Could recommend elevation system when >3 distinct shadow values found
