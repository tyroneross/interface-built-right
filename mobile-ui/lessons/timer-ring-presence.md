# Lesson: Timer Ring Visual Weight

**Source:** FloDoro UX enhancement (2026-04-09), competitor analysis (Focus Keeper, Tide)
**Confidence:** Verified — compiled. Visual comparison pending.

## Problem

A 4pt stroke ring on a 220pt diameter circle feels wispy. The primary visual element of a timer app shouldn't feel fragile — it needs presence.

## Solution

Two changes that compound:

```swift
// Stroke: 4 → 6pt
private let lineWidth: CGFloat = 6

// Glow: opacity 0.4/radius 8 → 0.5/radius 12
.shadow(color: journeyRingColor.opacity(0.5), radius: 12, x: 0, y: 0)
```

### Why these specific values

- **6pt stroke** — substantial without feeling heavy. 8pt would dominate the number display inside. 4pt was barely visible against busy gradient backgrounds
- **0.5 opacity glow** — visible enough to create a halo effect, not so bright it washes out in light mode
- **12pt blur radius** — extends the glow beyond the ring edge, creating a soft atmospheric effect that ties the ring to the gradient background

## The ratio that matters

Ring stroke : Ring diameter = visual presence. At 220pt:
- 4pt = 1.8% — too thin, feels like a loading spinner
- 6pt = 2.7% — confident, feels intentional
- 8pt = 3.6% — heavy, starts to feel like a progress bar

## What NOT to do

- Don't go above 8pt — thick rings compete with the time display
- Don't use sharp shadows (radius < 4) — they look like rendering artifacts
- Don't add inner glow — it muddles the progress reading
- Don't animate the glow independently of the ring — they should feel unified

## Future ideas

- Could validate ring stroke-to-diameter ratio for timer/progress elements
- Could flag shadows with radius < 4 on circular progress indicators
