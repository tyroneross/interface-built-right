# Pattern: Design Token Architecture for SwiftUI

**Source:** FloDoro implementation (2026-04-09), SwiftUI Design System Guide (T3), Apple HIG (T1)
**Confidence:** Verified — production implementation across 3 platforms.

## Overview

Design tokens are named constants that encode design decisions. They replace magic numbers with semantic intent, enabling consistency and bulk updates.

## Token Categories

### 1. Color Tokens

```swift
extension Color {
    // Semantic base colors — adapt to dark/light via system
    static let bgPrimary = Color(UIColor.systemBackground)
    static let textPrimary = Color(UIColor.label)
    static let textSecondary = Color(UIColor.secondaryLabel)
    static let surfaceLight = Color(UIColor.secondarySystemBackground)

    // Mode accents — fixed across color scheme
    static let timerAccent = Color(red: 0.145, green: 0.388, blue: 0.922)
    static let flowAccent = Color(red: 0.031, green: 0.569, blue: 0.698)
}
```

**Rules:**
- Base colors use system semantic colors (auto dark/light)
- Accent colors are fixed RGB — they define brand identity
- Name by purpose, not color: `timerAccent` not `blue`
- Group related colors in structs: `ModeColorSet(accent:, shadow:, bg:)`

### 2. Corner Radius Tokens

```swift
enum CornerRadius {
    static let small: CGFloat = 8    // pills, tags, inline elements
    static let medium: CGFloat = 12  // buttons, cards, list items
    static let large: CGFloat = 16   // modals, sheets, containers
    static let xl: CGFloat = 20      // onboarding, hero cards
}
```

**Rules:**
- Don't tokenize radii < 6 (decorative, not structural)
- Use `medium` as the default — it's the most common
- Buttons and cards ALWAYS use the same radius (visual grouping)

### 3. Elevation Tokens

```swift
enum ElevationLevel {
    case subtle   // radius: 4, y: 2
    case medium   // radius: 8, y: 4
    case high     // radius: 16, y: 8
}
```

**Rules:**
- Shadow adapts to color scheme (weaker in dark mode)
- y-offset > 0 always (light from above)
- Don't stack elevations

### 4. Spacing (not yet tokenized in FloDoro — next step)

Recommended 8pt grid:
```swift
enum Spacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 20
    static let xxl: CGFloat = 24
}
```

### 5. Typography (system stack)

```swift
enum TypeScale {
    static let displayLarge = Font.system(size: 64, weight: .ultraLight)
    static let displayMedium = Font.system(size: 48, weight: .ultraLight)
    static let title = Font.system(size: 15, weight: .semibold)
    static let body = Font.system(size: 13, weight: .regular)
    static let caption = Font.system(size: 11, weight: .regular)
    static let label = Font.system(size: 10, weight: .medium)
}
```

## Platform Guards

```swift
// Pattern: platform-specific defaults, shared token name
#if os(watchOS)
static let bgPrimary = Color.black
#elseif canImport(UIKit)
static let bgPrimary = Color(UIColor.systemBackground)
#else
static let bgPrimary = Color(NSColor.windowBackgroundColor)
#endif
```

## Migration Strategy

When introducing tokens to an existing codebase:
1. Define tokens with values matching the most common existing usage
2. Replace all instances file-by-file (grep for raw values)
3. Leave tiny decorative values (< 6pt radius, < 2pt borders) as raw
4. Verify builds after each file batch

## Future ideas

- Could scan for raw numeric values that should be tokens
- Could recommend token adoption when >3 distinct values found for same property
