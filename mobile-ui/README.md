# Mobile UI Research & Lessons Learned

Synthesized design intelligence for building expert-level iOS apps. Captured from real implementation experience (FloDoro) and authoritative design research. Intended for eventual integration into IBR's validation and guidance systems.

## Structure

- `lessons/` — Hard-won implementation lessons from real builds
- `patterns/` — Verified design patterns with SwiftUI code
- `references/` — Distilled guidance from authoritative sources

## Status

**Reference material only.** These are observations, patterns, and lessons — not enforced rules. IBR should know this directory exists for context when validating mobile UI, but nothing here overrides project-specific decisions or IBR's own rule system.

## How to Use

1. **Design reference** — Consult before building new iOS UI
2. **IBR context** — Available as supplementary knowledge, not validation rules

## Recent Additions (SpeakSavvy iOS, April 2026)

- `references/dark-mode-shadow-system.md` — 4-level shadow system for dark backgrounds, Material Design 3 elevation, verified SwiftUI implementations
- `references/mockup-to-swiftui-translation.md` — HTML/Tailwind to SwiftUI mapping: colors, typography, layout, components, gotchas
- `patterns/expandable-card-pattern.md` — Inline expand/collapse cards with trend sparklines, generic @ViewBuilder pattern
- `patterns/headless-simulator-interaction-plan.md` — IBR enhancement plan: headless tap/type via CoreSimulator IndigoHID API
- `lessons/home-screen-simplification.md` — Reducing 8 sections to 5, one hero CTA rule, information pyramid

## Sources

All findings cite source tier (T1-T4) per the standard credibility framework.
