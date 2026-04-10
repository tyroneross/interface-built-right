# Lesson: Corner Radius Token System

**Source:** FloDoro UX enhancement (2026-04-09)
**Confidence:** Verified — 31+ replacements across 8 files, all compiled clean

## Problem

Hardcoded corner radii (8, 10, 11, 12) scattered across views create visual discord. Subtle inconsistency — users feel "something is off" without identifying why. Cards next to buttons have mismatched rounding. Elements that should feel grouped look unrelated.

## Discovery

The mix was organic — different developers, different sessions, each picking "close enough." No one value was wrong individually, but the system lacked coherence.

## Solution

Define corner radius tokens and use them everywhere:

```swift
enum CornerRadius {
    static let small: CGFloat = 8    // pills, tags, small inline elements
    static let medium: CGFloat = 12  // buttons, cards, list items
    static let large: CGFloat = 16   // modals, sheets, large containers
    static let xl: CGFloat = 20      // full-screen cards, onboarding
}
```

### Migration mapping

| Old value | New token | Rationale |
|-----------|-----------|-----------|
| 8 | `.small` | Correct — small elements stay small |
| 10 | `.medium` | Round up — 10 was trying to be 12 |
| 11 | `.medium` | Round up — 11 was an oddball |
| 12 | `.medium` | Already correct |
| 3-4 | Leave as-is | Tiny decorative radii (progress bars, dots) don't need tokens |

## Key insight

**Don't standardize to the most common value — standardize to the correct design intent.** Most 10s and 11s in FloDoro were *meant* to be 12 (button/card level). The fix isn't picking a compromise; it's choosing the right semantic level.

## What NOT to do

- Don't use a single radius for everything — hierarchy requires variation
- Don't tokenize radii under 6 — those are decorative, not structural
- Don't mix raw values and tokens — once you have tokens, use them exclusively

## Future ideas

- Could scan for hardcoded cornerRadius values and flag inconsistencies
- Could show histogram of radius values to reveal inconsistency
