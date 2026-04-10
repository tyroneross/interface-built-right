# iOS Design Principles — Synthesized Reference

Distilled from Apple HIG (T1), Lux Camera analysis (T2), top iOS app patterns (T2/T3).
Research date: 2026-04-09.

## The Four Pillars (Apple HIG)

1. **Clarity** — interface is easily understood at a glance
2. **Deference** — content is the star, not UI chrome
3. **Depth** — visual layers communicate hierarchy
4. **Consistency** — familiar patterns across all Apple platforms

## Button Design

### Touch targets
- 44pt minimum on iOS (Apple HIG, T1)
- 24pt minimum on macOS desktop
- Smaller targets = tap errors + user frustration

### Visual weight = intent weight (Fitts' Law)
- Primary CTA: largest, boldest, most prominent
- Secondary: recedes — lighter weight, less saturation
- Tertiary: minimal — text-only or icon-only

### Press feedback
- Scale + spring is the modern standard (0.96 scale, 0.3s spring, 0.6 damping)
- Opacity-only is outdated — feels like web, not native
- Color change on press is acceptable but less satisfying than scale

### Accent color discipline
- Reserve brand/accent color for interactive elements ONLY
- Non-interactive text in accent color = false affordance
- Status = text color only, no background badges (Signal-to-Noise principle)

## Color System

### Semantic naming
- Name by purpose: `timerAccent`, `breakAccent`, `surfaceLight`
- Never by color: `blue`, `lightGray`
- Group related: `ModeColorSet(accent:, shadow:, bg:)`

### Dark mode adaptation
- System semantic colors auto-adapt (`.label`, `.systemBackground`)
- Custom colors need explicit dark variants
- Shadows weaker in dark mode (multiply by 0.3)
- Dark mode elevation: borders/gradients carry better than shadows

### Contrast requirements
- 4.5:1 for body text (WCAG AA)
- 3:1 for large text (18pt+)
- Never convey information through color alone

## Depth & Shadows

### Modern philosophy (post-iOS 7)
- Shadows imply height, not weight
- Dynamic/contextual, not static
- Y-offset > 0 (light from above)
- Blur radius proportional to perceived height

### Progressive depth hierarchy
- Primary controls: full treatment (glass, glow, shadow)
- Secondary controls: subtle frosted effect
- Background/content: minimal, clean

### Materials
- `.ultraThinMaterial` — standard frosted glass
- `.thinMaterial` / `.regularMaterial` — increasing frosting
- Liquid Glass (iOS 26) — refractive, dynamic, system-rendered

## Typography

### System font (San Francisco)
- Don't fight it — SF is optimized for iOS readability
- Use `.monospacedDigit()` for any changing numbers (timers, counts)
- Dynamic Type support = `.font(.system(size:))` scales with accessibility

### Hierarchy
- Display: 48-64pt ultraLight (timers, hero numbers)
- Title: 14-16pt bold
- Body: 12-14pt regular
- Caption: 11-12pt, muted color
- Label: 10pt medium, uppercase + tracking for category labels

## Animation & Motion

### Principles
- Purpose over decoration — every animation communicates something
- Spring > easing — springs feel organic, easing feels mechanical
- Duration: 0.2-0.5s for UI transitions, longer for atmospheric
- Match system conventions — users expect familiar motion curves

### Micro-interactions
- Button press: immediate (< 16ms to first frame)
- State transitions: 0.3s easeInOut
- Modal presentation: system default or 0.3-0.5s
- Background atmosphere: 10-20s gentle loops (not distracting)

### Haptics (iOS only)
- `.impact(.light)` — button confirmation
- `.impact(.medium)` — state change
- `.notification(.success)` — completion
- `.selection()` — picker/carousel movement

## Liquid Glass (iOS 26)

### Use for
- Navigation bars, toolbars, tab bars
- Floating action buttons
- Sheets, popovers, menus

### Never use for
- Content (lists, tables, media)
- Full-screen backgrounds
- Stacked glass-on-glass

### Key APIs
```swift
.glassEffect(.regular)                    // Standard
.glassEffect(.regular.tint(.blue))        // Semantic tint
.glassEffect(.regular.interactive())      // Press response
.buttonStyle(.glass)                      // System glass button
.buttonStyle(.glassProminent)             // Bold glass button
GlassEffectContainer { }                  // Group glass elements
```

## Sources

- [Apple HIG](https://developer.apple.com/design/human-interface-guidelines) (T1)
- [Apple HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color) (T1)
- [Applying Liquid Glass to Custom Views](https://developer.apple.com/documentation/SwiftUI/Applying-Liquid-Glass-to-custom-views) (T1)
- [Lux Camera: Physicality — The New Age of UI](https://www.lux.camera/physicality-the-new-age-of-ui/) (T2)
- [Liquid Glass SwiftUI Reference](https://github.com/conorluddy/LiquidGlassReference) (T2)
- [iOS 26 Liquid Glass Overview](https://medium.com/@madebyluddy/overview-37b3685227aa) (T2)
- [SwiftUI Design System Guide 2025](https://dev.to/swift_pal/swiftui-design-system-a-complete-guide-to-building-consistent-ui-components-2025-299k) (T3)
- [Design+Code: Shadows & Color Opacity](https://designcode.io/swiftui-handbook-shadows-and-color-opacity/) (T3)
- [Dark Mode UI Best Practices 2025](https://www.graphiceagle.com/dark-mode-ui/) (T3)
