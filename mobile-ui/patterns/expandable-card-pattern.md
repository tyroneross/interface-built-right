# Expandable Card Pattern

Lessons learned from building the ExpandableMetricCard component in SpeakSavvy iOS (Build 26).

## The Pattern

A card that shows a summary in collapsed state, and expands inline to reveal detail + trend data on tap. Used across multiple screens (drill results, session detail, home score).

## Why Inline Expansion Beats Sheets/Modals

- **Keeps users in flow** — no navigation break, no modal dismiss to remember
- **Context preservation** — other metrics remain visible above/below
- **Comparison** — can expand two cards simultaneously to compare
- **Lower cognitive load** — tap to see more, tap to hide, that's it

## SwiftUI Implementation

### Generic Component Structure

```swift
struct ExpandableMetricCard<Detail: View>: View {
    let value: String
    let label: String
    let status: String
    let statusColor: Color
    let trendData: [ChartDataPoint]
    let trendLabel: String
    @ViewBuilder let detail: () -> Detail

    @State private var isExpanded = false
```

The `@ViewBuilder` closure pattern lets each call site provide metric-specific content while the card handles expand/collapse, animation, sparkline, and styling.

### Animation Choice

```swift
withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
    isExpanded.toggle()
}
```

Spring with 0.3 response feels snappy. 0.8 damping prevents bounce. Combined with `.transition(.opacity.combined(with: .move(edge: .top)))` on the expanded content.

### Chevron Rotation

```swift
Image(systemName: "chevron.down")
    .rotationEffect(.degrees(isExpanded ? -180 : 0))
```

Rotates smoothly with the spring animation. Provides clear affordance that the card is interactive.

## Layout Considerations

### Grid to Column Transition

When collapsed, metric cards can sit in a 2-column grid (HStack pairs). When expanded, the detail content needs full width. Two approaches:

**Approach A (implemented in DrillResultsView):** Cards stay in HStack pairs. Expanded card grows within its column. Works when detail content is compact.

**Approach B (implemented in SessionDetailView):** Single-column VStack. Every card gets full width. Better when detail content varies significantly in size.

### Edge Cases

| Scenario | Behavior |
|---|---|
| 0 sessions | No trend sparkline shown, card still expandable for detail |
| 1 session | Single dot on sparkline, detail shows current values |
| nil metrics | Card not rendered (guarded by `if let metrics`) |
| All metrics nil except one | Only that one card appears |
| Multiple cards expanded | All stay expanded, scroll view accommodates |

## Detail View Design Rules

Each metric detail view follows these rules:

1. **Rating badge first** — capsule-shaped, colored by status, 12px semibold
2. **Supporting data second** — specific numbers, ranges, counts
3. **Coaching tip last** (if applicable) — actionable advice in textSecondary
4. **No redundancy** — detail shouldn't repeat what the collapsed card already shows

### Example: Filler Detail

```
YOUR FILLER WORDS
Total: 9 fillers
["um" x4] ["like" x3] ["so" x2]  ← capsule chips
```

Groups `fillerWords` array by word, sorts by frequency descending. Uses capsule chips on `surfaceElevated` background.

## Trend Sparkline Integration

Reuse an existing chart component (MiniChartView in SpeakSavvy's case). Color by trend direction:

| Trend | Color | Meaning |
|---|---|---|
| Improving | Teal/accent | Metric moving in desired direction |
| Declining | Red | Metric degrading |
| Volatile | Orange | Inconsistent, jumping around |
| Stable | Muted gray | No significant change |

The trend label sits next to the sparkline in matching color.

## Generic Trend Helper Pattern

Avoid copy-pasting trend methods. One generic extractor:

```swift
static func metricTrend(
    from sessions: [Session],
    last n: Int = 10,
    extract: (SpeechMetrics) -> Double?
) -> [ChartDataPoint]
```

Then each specific metric trend is a one-liner:
```swift
static func pitchTrend(...) -> [ChartDataPoint] {
    metricTrend(from: sessions, last: n) { $0.pitchStdDevST > 0 ? $0.pitchStdDevST : nil }
}
```

The `> 0` guard filters out metrics that weren't measured (default 0 values).

## Tappable Home Score Variant

The same expand/collapse pattern works for the home screen's hero score card, but with different expanded content:

- **Score breakdown** — 7-dimension rubric bars with proportional fill
- **Recent sessions** — last 5 as NavigationLinks to session detail
- **Footer** — "Based on your most recent scored session"

This answers the user's question "how was this score calculated?" without navigating away from home.

## Performance Notes

- `@Query` fetches session data once per view lifecycle, not per expansion
- Trend computation happens at expansion time (lazy) but is fast for 10 sessions
- Spring animation on VStack height change is smooth even with multiple cards
- No measurable impact on scroll performance in production testing
