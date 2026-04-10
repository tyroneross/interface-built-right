# Mockup-to-SwiftUI Translation Guide

Patterns discovered translating HTML/Tailwind mockups to native SwiftUI in SpeakSavvy iOS.

## Color System Mapping

| Token | Hex | SwiftUI |
|---|---|---|
| `bg-background` | `#0F1419` | `Theme.background` |
| `bg-surface` | `#1A1F26` | `Theme.surfacePrimary` |
| `bg-elevated` | `#242B35` | `Theme.surfaceElevated` |
| `text-primary` | `#F0F2F5` | `Theme.textPrimary` |
| `text-secondary` | `#8B95A5` | `Theme.textSecondary` |
| `text-muted` | `#5A6577` | `Theme.textMuted` |
| `text-accent` | `#2EC4B6` | `Theme.accent` |

## Layout Translation

| HTML/Tailwind | SwiftUI |
|---|---|
| `max-w-[390px] mx-auto` | Screen width is natural on iOS |
| `px-5 py-6` | `.padding(.horizontal, 20).padding(.vertical, 24)` |
| `flex flex-col gap-3` | `VStack(spacing: 12)` |
| `grid grid-cols-2 gap-4` | `LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16)` |
| `flex items-center justify-between` | `HStack { ... Spacer() ... }` |
| `rounded-[16px]` | `.clipShape(RoundedRectangle(cornerRadius: 16))` |
| `rounded-full` | `.clipShape(Circle())` or `.clipShape(Capsule())` |
| `p-4` | `.padding(16)` or `.padding(Theme.cardPadding)` |

## Typography Translation

| Mockup | SwiftUI |
|---|---|
| `text-[56px] font-bold` (score) | `.font(.system(size: 56, weight: .bold, design: .rounded))` |
| `text-xl font-semibold` (title) | `.font(.system(size: 20, weight: .semibold))` |
| `text-sm` (body) | `.font(.system(size: 14))` |
| `text-xs` (caption) | `.font(.system(size: 12))` |
| `text-[11px] uppercase tracking-wide font-medium` | `.font(.system(size: 11, weight: .medium)).tracking(1)` |
| `font-bold design: rounded` | `.font(.system(size: N, weight: .bold, design: .rounded))` |

## Component Patterns

### Left Accent Border (Coach Assessment)

HTML: `border-l-2 border-accent`

SwiftUI:
```swift
HStack(spacing: 0) {
    Rectangle()
        .fill(Theme.accent)
        .frame(width: 2)
    VStack(alignment: .leading) { ... }
        .padding(Theme.cardPadding)
}
.background(Theme.surfacePrimary)
.clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius))
```

### Underline Tab Selector

HTML: `border-b-2 border-accent` (active) / `border-transparent` (inactive)

SwiftUI:
```swift
VStack(spacing: 6) {
    Text(option.rawValue)
        .foregroundStyle(isActive ? Theme.accent : Theme.textMuted)
    Rectangle()
        .frame(height: 2)
        .foregroundStyle(isActive ? Theme.accent : .clear)
}
```

### Icon in Tinted Circle

HTML: `w-9 h-9 rounded-lg bg-accent/10`

SwiftUI:
```swift
Image(systemName: "lightbulb.fill")
    .foregroundStyle(Theme.accent)
    .frame(width: 36, height: 36)
    .background(Theme.accent.opacity(0.1))
    .clipShape(RoundedRectangle(cornerRadius: 8))
```

### Status Badge (Capsule)

HTML: pill-shaped badge with colored background

SwiftUI:
```swift
Text("Improving")
    .font(.system(size: 12, weight: .semibold))
    .foregroundStyle(statusColor)
    .padding(.horizontal, 8)
    .padding(.vertical, 3)
    .background(statusColor.opacity(0.12))
    .clipShape(Capsule())
```

### Sparkline with Gradient Fill

HTML: SVG polyline + linearGradient (15% → 2% opacity)

SwiftUI Charts:
```swift
AreaMark(...)
    .foregroundStyle(.linearGradient(
        colors: [color.opacity(0.15), color.opacity(0.02)],
        startPoint: .top, endPoint: .bottom
    ))
```

### Center-Zero Delta Bar

HTML: bar extends from center, positive right (green), negative left (orange)

SwiftUI:
```swift
GeometryReader { geo in
    let center = geo.size.width / 2
    let barWidth = abs(delta) / maxDelta * center
    RoundedRectangle(cornerRadius: 3)
        .fill(delta > 0 ? Theme.scoreGood : Theme.scoreWeak)
        .frame(width: barWidth, height: 6)
        .offset(x: delta > 0 ? center : center - barWidth)
}
```

## What Doesn't Translate

| HTML/CSS | iOS Reality |
|---|---|
| `hover:brightness-110` | No hover on iOS — use tap states or `.onTapGesture` |
| `transition-all` | Use `.animation(.spring())` or `withAnimation` |
| `overflow: hidden` | `.clipped()` or `.clipShape()` |
| `box-shadow` | `.shadow()` modifier (see dark-mode-shadow-system.md) |
| JavaScript-generated SVGs | Use SwiftUI Charts `LineMark`/`AreaMark` |
| CSS Grid with auto-flow | `LazyVGrid` is close but not identical — use explicit column definitions |

## Gotchas

1. **Divider color** — SwiftUI's `Divider()` uses system color by default. Override with `.background(Theme.dividerColor)` for dark theme consistency.
2. **Text line height** — `leading-relaxed` (1.625) in Tailwind → `.lineSpacing(4)` in SwiftUI (approximate).
3. **Fixed-width labels** — `.frame(width: 90, alignment: .leading)` is the SwiftUI equivalent of Tailwind's `w-[90px]`.
4. **NavigationLink inside Button** — causes issues. Use `.buttonStyle(.plain)` on NavigationLink or restructure.
5. **GeometryReader in ScrollView** — can cause layout issues. Constrain with `.frame(height:)` on the GeometryReader.
