# watchOS Design Considerations

**Source:** FloDoro watchOS implementation (2026-04-09), Apple HIG (T1)
**Confidence:** Verified — production watchOS app on TestFlight.

## Circadian-Safe Color Palette

watchOS is worn during evening wind-down. Blue light (< 560nm wavelength) disrupts melatonin. FloDoro's watch palette uses only warm colors:

| Token | Color | Hex | Wavelength |
|-------|-------|-----|------------|
| watchTimerAccent | Amber | #D4943A | > 590nm |
| watchFlowAccent | Copper | #C47850 | > 600nm |
| watchAdaptiveAccent | Dusty rose | #B8607A | > 580nm |
| watchBreakAccent | Warm sage | #8B9A4B | > 560nm |
| watchTextPrimary | Warm white | #F0E6D6 | Broadband warm |
| watchSurface | Warm dark | #1A1816 | n/a |

## API Differences from iOS

| Feature | iOS | watchOS |
|---------|-----|---------|
| Materials | `.ultraThinMaterial` | Not available |
| Glass | `.glassEffect()` | Limited (watchOS 26+) |
| Haptics | `UIImpactFeedbackGenerator` | `WKInterfaceDevice.current().play()` |
| Background | System adaptive | Always `.black` |
| Timer display | `Text` with custom formatting | Prefer `Text(timerInterval:countsDown:)` |
| Navigation | NavigationStack + .sheet | NavigationStack (compact) |

## Layout Constraints

- Screen: 41mm (184x224), 45mm (198x242), 49mm Ultra (205x251)
- Touch target: 38pt minimum (smaller than iOS 44pt)
- Content area extremely limited — show 1-2 pieces of info max
- No landscape orientation
- Always-On Display: reduce updates, dim colors

## Timer-Specific Patterns

```swift
// Use system timer rendering to avoid jitter from throttled callbacks
Text(timerInterval: startDate...endDate, countsDown: true)
```

watchOS throttles `Timer.publish` callbacks when the screen is off. The system `Text(timerInterval:)` renders independently of app code, eliminating jitter.

## Background Execution

```swift
// WKExtendedRuntimeSession for background timer
let session = WKExtendedRuntimeSession()
session.start()
// Timer continues when wrist is lowered
```

## What NOT to Do on watchOS

- Don't use full-screen gradients (battery drain, OLED burn-in risk)
- Don't use thin strokes (< 2pt barely visible on small screens)
- Don't use small text (< 14pt unreadable at arm distance)
- Don't use blue-dominant colors for evening-use apps
- Don't animate continuously — watchOS aggressively throttles
