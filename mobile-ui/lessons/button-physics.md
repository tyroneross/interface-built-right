# Lesson: Button Physics Transform Feel

**Source:** FloDoro UX enhancement (2026-04-09)
**Confidence:** Verified — built, compiled, shipped

## Problem

Buttons using only `opacity: 0.7` on press feel flat and unresponsive. Users can't tell if their tap registered. The interface feels like a web wrapper, not a native app.

## Discovery

Top iOS designers (Lux Camera analysis, Apple HIG) emphasize *behavioral physicality* — buttons should feel like they have mass. Not textural skeuomorphism, but dynamic response: scale on press, spring on release.

## Solution

Replace opacity-only press states with scale + spring animation:

```swift
// Before — flat, ambiguous
.opacity(configuration.isPressed ? 0.7 : 1)

// After — physical, satisfying
.scaleEffect(configuration.isPressed ? 0.96 : 1.0)
.animation(.spring(response: 0.3, dampingFraction: 0.6), value: configuration.isPressed)
```

### Parameters that matter

| Parameter | Value | Why |
|-----------|-------|-----|
| Scale factor | 0.96 | Subtle enough to feel native, not cartoonish. 0.95 is too much, 0.98 too subtle |
| Spring response | 0.3s | Fast enough to feel instant, slow enough to perceive |
| Damping fraction | 0.6 | Slight bounce on release — feels alive without being bouncy |

## What NOT to do

- Don't combine opacity AND scale — pick one. Double feedback feels broken
- Don't use different scale values for different button types — consistency is the point
- Don't add delay — press feedback must be instant (< 16ms)
- Don't use `.easeInOut` — springs feel organic, easing feels mechanical

## Applies to

All interactive controls: buttons, toggles, tappable cards, mode selectors. Not sliders or continuous controls.

## Future ideas

- Could flag `ButtonStyle` that uses only `.opacity` for press state
- Could suggest scale+spring pattern when opacity-only press detected
