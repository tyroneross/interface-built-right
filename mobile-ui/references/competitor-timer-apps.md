# Competitor Timer App Analysis

**Source:** App Store research (T3), feature comparison (2026-04-09)
**Confidence:** Based on App Store descriptions and reviews, not hands-on audit.

## Top-Tier Design Benchmarks

### Tide
- **Strength:** Immersive ambient backgrounds, minimal chrome
- **Approach:** Full-screen nature scenes as backgrounds, timer overlaid with frosted controls
- **Lesson:** The background IS the experience — not decorative, atmospheric
- **FloDoro comparison:** FloDoro's liquid gradient system already achieves this well

### Forest
- **Strength:** Gamified visual reward — tree grows during focus session
- **Approach:** Visual metaphor that makes "staying focused" tangible
- **Lesson:** Session completion should feel rewarding — not just "timer done"
- **FloDoro gap:** End-of-session could be richer (animation, haptic burst, visual celebration)

### Focus Keeper
- **Strength:** Physical tomato timer metaphor, tangible feel
- **Approach:** Skeuomorphic timer that mimics a real kitchen timer
- **Lesson:** Timer elements need visual weight/presence to feel real
- **FloDoro improvement:** Ring stroke 4→6pt, enhanced glow addresses this

### Tide (Focus Timer variant)
- **Strength:** Beautifully designed minimal UI with ambient sound integration
- **Approach:** Sound scenes (rain, forest, ocean) paired with clean timer
- **Lesson:** Multi-sensory engagement (visual + audio + haptic) > visual alone

### FocusList
- **Strength:** Stats/analytics integration with timer
- **Approach:** Calendar view of past activities, productivity tracking
- **FloDoro comparison:** FloDoro has session logs, heatmaps, trend lines — competitive here

## Design Patterns Across Top Apps

| Pattern | Frequency | FloDoro Status |
|---------|-----------|----------------|
| Immersive backgrounds | 4/5 apps | Done (liquid gradients) |
| Circular progress | 4/5 apps | Done (timer ring) |
| Minimal chrome | 5/5 apps | Done (frosted glass buttons) |
| Session stats | 3/5 apps | Done (charts, heatmaps) |
| Haptic feedback | 2/5 apps | Ready (Haptics helper defined) |
| Gamification/reward | 2/5 apps | Gap — session completion UX |
| Sound integration | 3/5 apps | Partial (audio service exists) |
| Watch companion | 2/5 apps | Done (standalone watchOS) |

## FloDoro's Unique Advantages

1. **Triple platform** (iOS + macOS + watchOS) — most competitors are iOS-only
2. **Circadian-safe watch palette** — no competitor does this
3. **Liquid gradient color journey** — gradients shift with session progress, unique
4. **Focus Intelligence engine** — AI-powered session recommendations
5. **Bonjour local sync** — multi-device presence without cloud dependency

## Gaps to Address

1. Session completion celebration (animation + haptic + sound)
2. Liquid Glass adoption (iOS 26 differentiator)
3. Richer break experience (currently minimal)
