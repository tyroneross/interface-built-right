# Home Screen Simplification

Lessons learned from redesigning SpeakSavvy's home screen (Build 25) — reducing from 8 sections to 5 with a single hero CTA.

## Before: Cluttered and Redundant

The original home screen had:
1. OverallScoreCard (4-cell grid)
2. CoachAssessmentCard
3. GainsConstraintsCard
4. Micro-drill NavigationLink
5. DrillRecommendationCard
6. MomentumSparkline
7. "Practice Now" button
8. Recent Sessions list

**Problems:**
- Three ways to start practicing (micro-drill, recommendation, Practice Now)
- Recent Sessions duplicated the History tab
- 4-cell score grid was dense and hard to parse
- No clear visual hierarchy — everything competed for attention

## After: Focused and Scannable

1. OverallScoreCard (hero score)
2. CoachAssessmentCard
3. GainsConstraintsCard
4. DrillRecommendationCard (with single "Start Drill" hero CTA)
5. MomentumSparkline

**Key decisions:**
- **One hero button** — "Start Drill" in the recommendation card. Teal glow shadow makes it the dominant interactive element.
- **Hero score** — Single large number (56px) replaces 4-cell grid. "+0.4 vs last 5" and "Intermediate" provide context without clutter.
- **Section labels** — 11px uppercase tracking-wide labels (OVERALL SCORE, COACH ASSESSMENT, etc.) create visual rhythm.
- **12px spacing** — Tighter than the original 20px, matching the mockup's `gap-3`. Creates a more cohesive card stack.

## Design Principles Applied

### One Hero CTA Rule
A home screen should have exactly one primary action. Multiple CTAs create decision paralysis. The "Start Drill" button has:
- Full width
- Teal accent background
- 12px corner radius (slightly less than cards — intentional differentiation)
- Two-layer glow shadow (button emits light)
- `.compositingGroup()` for clean shadow rendering

### Information Pyramid
Most important → least important, top → bottom:
1. Score (how am I doing?)
2. Coach assessment (what does the AI think?)
3. Gains & constraints (what's improving/declining?)
4. Recommendation (what should I do next?) ← action lives here
5. Momentum trend (how's my trajectory?)

### Progressive Disclosure
The home screen shows summaries. Tapping the score card reveals the full rubric breakdown (Build 26). History tab has full session details. The home screen's job is orientation, not deep analysis.

## Section Labels as Visual Rhythm

```swift
Text("OVERALL SCORE")
    .font(Theme.fontSectionLabel)  // 11px medium
    .foregroundStyle(Theme.textMuted)
    .tracking(1)  // letter spacing
```

These labels:
- Break the card stack into scannable sections
- Match the mockup's `text-[11px] uppercase tracking-wide` pattern
- Use textMuted so they don't compete with card content
- Create vertical rhythm between cards

## What Got Removed and Why

| Removed | Why |
|---|---|
| Micro-drill NavigationLink | Redundant with DrillRecommendationCard — same function, different wrapper |
| "Practice Now" button | Redundant — DrillRecommendationCard's "Start Drill" does the same thing |
| Recent Sessions list | Belongs in History tab, not home. Home is for status, not browsing |
| `drillView(for:)` helper | Only used by micro-drill NavigationLink |
| 4-cell score grid (ScoreCell) | Replaced by hero score layout — one big number is more impactful than four small ones |

## Dead Code Cleanup

After removing sections, found orphaned code:
- `scoredSessions`, `avgScore`, `avgFillers` computed properties — never referenced in body
- `momentum` and `momentumColor` in OverallScoreCard — momentum display moved to CoachAssessmentCard

Lesson: when simplifying UI, always grep for unused computed properties. SwiftUI won't warn about unused `private var` properties.

## Mockup Alignment Approach

The mockup HTML files (01-coach-home.html) defined the target. Key translation rules from HTML/Tailwind → SwiftUI:

| HTML/Tailwind | SwiftUI |
|---|---|
| `gap-3` (12px) | `VStack(spacing: Theme.sectionSpacing)` |
| `rounded-[16px]` | `.clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius))` |
| `text-[11px] uppercase tracking-wide` | `.font(Theme.fontSectionLabel).tracking(1)` |
| `border-l-2 border-accent` | `HStack { Rectangle().fill(Theme.accent).frame(width: 2) ... }` |
| `bg-surface` | `.background(Theme.surfacePrimary)` |
| `hover:brightness-110` | Not applicable on iOS — no hover states |
