# Lesson: Haptic Feedback Architecture

**Source:** FloDoro UX enhancement (2026-04-09), top iOS productivity apps (T2)
**Confidence:** Verified — compiles. Behavioral validation requires device testing.

## Problem

Visual-only feedback leaves interactions feeling hollow. Tapping a "Start Focus" button that changes color but produces no physical response feels less certain than one that provides a subtle tap.

## Solution

Centralized haptic helper, platform-guarded:

```swift
#if canImport(UIKit) && !os(watchOS)
import UIKit

enum Haptics {
    static func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .light) {
        UIImpactFeedbackGenerator(style: style).impactOccurred()
    }

    static func notification(_ type: UINotificationFeedbackGenerator.FeedbackType) {
        UINotificationFeedbackGenerator().notificationOccurred(type)
    }

    static func selection() {
        UISelectionFeedbackGenerator().selectionChanged()
    }
}
#endif
```

### When to use which

| Haptic | Use case | Example |
|--------|----------|---------|
| `.impact(.light)` | Button press confirmation | Start/Stop timer |
| `.impact(.medium)` | Significant state change | Mode switch, session complete |
| `.notification(.success)` | Completion/achievement | Session rated, streak earned |
| `.notification(.warning)` | Caution | About to reset, break ending |
| `.selection()` | Picker/carousel movement | Mode selector scroll |

### Wiring pattern

```swift
Button("Start Focus") {
    #if canImport(UIKit) && !os(watchOS)
    Haptics.impact(.light)
    #endif
    engine.start()
}
```

## What NOT to do

- Don't haptic on every scroll or swipe — sensory overload kills the effect
- Don't use `.impact(.heavy)` for normal interactions — save for dramatic moments
- Don't pre-warm generators unless you're building a game (overkill for productivity apps)
- Don't add haptics to macOS — no equivalent, and NSHapticFeedbackPerformer is for trackpad only
- Don't haptic during background/inactive state — system will throttle anyway

## Platform guards

- `#if canImport(UIKit)` — excludes macOS
- `!os(watchOS)` — watchOS has WKInterfaceDevice.current().play() instead, different API
- No AppKit equivalent needed — macOS interactions don't expect haptics

## Future ideas

- Could detect primary action buttons without haptic feedback
- Could recommend haptic type based on button semantic role
