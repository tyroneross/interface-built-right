# Pattern: Liquid Glass Button Styles (iOS 26+)

**Source:** Apple Developer Docs (T1), Liquid Glass Reference (T2)
**Confidence:** Verified — compiles on Xcode 26.3. Runtime validation pending.

## Overview

iOS 26 introduced Liquid Glass — translucent, dynamic material that refracts surrounding content. This is the new standard for navigation-layer controls (toolbars, FABs, action buttons). Content-layer elements (lists, cards, media) should NOT use glass.

## Availability-Gated Button Styles

### Standard Glass (secondary actions)

```swift
struct GlassActionButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        if #available(iOS 26.0, macOS 26.0, *) {
            configuration.label
                .font(.system(size: 13, weight: .medium))
                .foregroundColor(.primary.opacity(0.8))
                .padding(.horizontal, 14)
                .frame(height: 36)
                .glassEffect(.regular.interactive(), in: RoundedRectangle(cornerRadius: 12))
                .scaleEffect(configuration.isPressed ? 0.96 : 1.0)
                .animation(.spring(response: 0.3, dampingFraction: 0.6), value: configuration.isPressed)
        } else {
            // Fallback: frosted material
            configuration.label
                .font(.system(size: 13, weight: .medium))
                .foregroundColor(.primary.opacity(0.8))
                .padding(.horizontal, 14)
                .frame(height: 36)
                .background(.ultraThinMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.primary.opacity(0.08), lineWidth: 1))
                .scaleEffect(configuration.isPressed ? 0.96 : 1.0)
                .animation(.spring(response: 0.3, dampingFraction: 0.6), value: configuration.isPressed)
        }
    }
}
```

### Prominent Glass (primary actions, CTAs)

```swift
struct GlassProminentButtonStyle: ButtonStyle {
    var tint: Color = .accentColor

    func makeBody(configuration: Configuration) -> some View {
        if #available(iOS 26.0, macOS 26.0, *) {
            configuration.label
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.white)
                .padding(.horizontal, 20)
                .frame(height: 44)
                .glassEffect(.regular.tint(tint).interactive(), in: RoundedRectangle(cornerRadius: 12))
                .scaleEffect(configuration.isPressed ? 0.96 : 1.0)
                .animation(.spring(response: 0.3, dampingFraction: 0.6), value: configuration.isPressed)
        } else {
            // Fallback: solid tint
            configuration.label
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.white)
                .padding(.horizontal, 20)
                .frame(height: 44)
                .background(tint)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .scaleEffect(configuration.isPressed ? 0.96 : 1.0)
                .animation(.spring(response: 0.3, dampingFraction: 0.6), value: configuration.isPressed)
        }
    }
}
```

## Glass API Quick Reference

### Variants
| Variant | Transparency | Use case |
|---------|-------------|----------|
| `.regular` | Medium | Default — toolbars, buttons |
| `.clear` | High | Media-rich backgrounds with bold foreground |
| `.identity` | None | Conditional disable |

### Modifiers
```swift
.glassEffect(.regular.tint(.blue))           // Semantic tint (CTA only)
.glassEffect(.regular.interactive())           // Press scale, bounce, shimmer
.glassEffect(.regular.tint(.blue).interactive()) // Combined
```

### Container (required for multiple glass elements)
```swift
GlassEffectContainer {
    HStack {
        Button("A") { }.glassEffect(.regular.interactive())
        Button("B") { }.glassEffect(.regular.interactive())
    }
}
```

## Critical Rules

1. **Glass is navigation layer only** — never on content (lists, tables, media)
2. **Tint = semantic meaning** — use for CTA/state, never decoration
3. **Always use GlassEffectContainer** when grouping glass elements (prevents glass-on-glass sampling)
4. **Guard with `#if !os(watchOS)`** — watchOS has limited glass support
5. **Performance** — 13% battery impact reported vs 1% on iOS 18 (single benchmark, unverified)

## Accessibility

System handles automatically:
- Reduce Transparency → increases frosting
- Increase Contrast → stark colors/borders
- Reduce Motion → tones down animations

Wire in Reduce Transparency checks early — if you add it later, half your UI may depend on translucency for contrast.

## Anti-Patterns

- Glass-on-glass stacking (confusing hierarchy)
- Tinting every element (loses semantic meaning)
- Glass on scrollable content (performance + readability)
- Custom opacity overriding accessibility settings
- Multiple glass effects without GlassEffectContainer
