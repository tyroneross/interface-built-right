---
name: ios-ui
description: iOS native UI best practices — HIG navigation, colors (semantic vs tint), SF Symbols, Dynamic Type, haptics, Live Activities, materials/vibrancy, Liquid Glass (iOS 26). Includes Apple documentation entry points for HealthKit, TestFlight, App Store Connect, device deployment. Use when building SwiftUI/UIKit apps for iPhone/iPad, or when `/ibr:build` preamble returns platform=iOS.
version: 0.1.0
user-invocable: false
---

# iOS UI

HIG-derived rules plus lessons from real apps (FloDoro, SpeakSavvy-iOS). Research context: `docs/research/2026-04-13-mobile-ui-best-practices.md`.

## Navigation

- **Tab bar**: 3–5 mutually exclusive top-level areas; never actions. iOS 26 tab bars float as Liquid Glass capsules
- **NavigationStack** (not deprecated NavigationView) for hierarchical drill-down
- **Toolbar**: contextual actions for current view; distinct from tab bar
- **Modal** (`.sheet`, `.fullScreenCover`): only for tasks that must complete or cancel
- Large titles (`.navigationBarTitleDisplayMode(.large)`) collapse inline on scroll — standard for top-level screens

## Colors

- Use `Color.accentColor` / `tintColor` for interactivity — never hardcoded blue
- `Color(.systemBackground)`, `Color(.label)`, `Color(.secondaryLabel)`, `Color(.separator)` for hierarchy
- Four label levels: primary / secondary / tertiary / quaternary — match to hierarchy tier
- Fill colors: `.systemFill` → `.quaternarySystemFill` for overlays
- Never hardcode hex that needs to survive dark mode or accessibility contrast

## Typography

- `.font(.body)`, `.title`, `.headline` — not `.system(size: 17)`
- Body default = 17pt SF Pro; SF Pro auto-switches Display ≥20pt, Text ≤19pt
- **Dynamic Type**: support xSmall → xxxLarge (7 standard) + AX1–AX5 (5 accessibility, up to ~310% scale). Test AX3+ — layouts must reflow, not clip
- `@Environment(\.dynamicTypeSize)` to react

## SF Symbols

Use SF Symbols for every system icon. They auto-scale with Dynamic Type, auto-tint with accent, have filled/circle/square/slash variants, and ship with the OS — no image assets needed.

## Touch targets

**44×44 pt minimum** for every interactive element. Applies even on curved watch edges and under Live Activities.

## Haptics

- `UIImpactFeedbackGenerator`: `.light` / `.medium` / `.heavy` / `.soft` / `.rigid` — match weight to visual weight
- `UINotificationFeedbackGenerator`: `.success` / `.warning` / `.error` — only for task outcomes
- `UISelectionFeedbackGenerator`: discrete value changes (pickers)
- Don't overuse; don't retain generators long-term (Taptic Engine idle state affects battery)

## Dark mode + materials

- Semantic colors adapt automatically — test both appearances
- SwiftUI materials: `.ultraThinMaterial` → `.thickMaterial`
- **iOS 26 Liquid Glass**: new translucent material system with real-time reflection/refraction. Verify exact SwiftUI modifier names against live Xcode docs before quoting

## Dynamic Island + Live Activities

- Three states: compact / minimal / expanded
- Content must be concentric with the pill shape (rounded inner margins)
- Dynamic payload ≤ **4 KB**
- Use relevance score when multiple activities compete
- **Lesson from FloDoro**: paused activities set `staleDate` to `.distantFuture` so they don't disappear

## Dynamic Type + VoiceOver

- Every interactive element: `accessibilityLabel` + `accessibilityHint` when purpose isn't obvious
- Test with VoiceOver on — trap focus is a bug
- Rotor support where appropriate

## SwiftData + CloudKit lessons (from FloDoro)

- **Do NOT** use `@Attribute(.unique)` — CloudKit fails silently
- **Do NOT** require non-optional properties without defaults — CloudKit fails silently
- Lightweight migration only; append-only session records for timer/workout state
- Raw runtime state stays device-local — only sync persistent records
- iCloud "Data on iCloud" toggle-off can delete local data — warn user + keep local backup

## WatchConnectivity (if watchOS target)

Three-layer sync pattern (from FloDoro):
- `sendMessage` — real-time, reachable peer
- `updateApplicationContext` — eventual delivery
- `transferUserInfo` — background FIFO
- `transferCurrentComplicationUserInfo` — complications
iPhone acts as bridge. No direct Mac ↔ Watch.

## Speech API (iOS 26+) — lessons from SpeakSavvy-iOS

- Prefer `SpeechAnalyzer` if asset installed — check via `AssetInventory.status(forModules:) == .installed`
- Fall back to `SFSpeechRecognizer` if model unavailable
- **CRITICAL**: enable `.transcriptionConfidence` in `SpeechTranscriber.attributeOptions` to populate per-word confidence — without it, segmentConfidences is empty (incident INC_DEPENDENCY_20260407)
- **Never** feed raw `audioEngine.inputNode.outputFormat` to SpeechAnalyzer without format negotiation — causes SIGTRAP in preRunRecognition

## HealthKit essentials (from FloDoro)

- Parallel fetches with `async let` task groups
- Baseline cache (HR, HRV) pre-session; aggregate queries post-session
- Register `HKWorkoutSession` during focus/workout sessions
- macOS compiles as empty (no HealthKit) — isolate with `#if os(iOS)` or `#if !os(macOS)`

## Apple documentation — canonical entry points

Link to these in code comments and design docs; Apple keeps them current.

**HIG:**
- [HIG hub](https://developer.apple.com/design/human-interface-guidelines)
- [HIG Color](https://developer.apple.com/design/human-interface-guidelines/color)
- [HIG Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- [HIG Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [HIG Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
- [HIG Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [UI Design Dos and Don'ts](https://developer.apple.com/design/tips/)
- [SF Symbols / Fonts](https://developer.apple.com/fonts/)

**HealthKit:**
- [HealthKit (main)](https://developer.apple.com/documentation/healthkit)
- [Setting up HealthKit](https://developer.apple.com/documentation/healthkit/setting-up-healthkit)
- [Authorizing access to health data](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)
- [Configuring HealthKit access in Xcode](https://developer.apple.com/documentation/xcode/configuring-healthkit-access)
- [HealthKit updates feed](https://developer.apple.com/documentation/Updates/HealthKit)

**Live Activities:**
- [ActivityKit — Displaying live data](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities)

**TestFlight + distribution:**
- [App Store Connect (hub)](https://developer.apple.com/app-store-connect/)
- [TestFlight (hub)](https://developer.apple.com/testflight/)
- [TestFlight Overview (ASC Help)](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)
- [Invite external testers](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers)
- [ASC — Upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/)

**Device deployment:**
- [Distributing to registered devices](https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices)
- [Distributing for beta testing and releases](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases)
- [Preparing your app for distribution](https://developer.apple.com/documentation/xcode/preparing-your-app-for-distribution/)
- [Signing & Capabilities workflow](https://help.apple.com/xcode/mac/current/en.lproj/dev60b6fbbc7.html)

**Lesson (from SpeakSavvy-iOS):** Use xcodebuild with `authenticationKeyPath`, `keyID`, `issuerID` for automated signing — no interactive Xcode GUI needed. Xcode 26.0+ required for iOS 26 features; check `SpeechAnalyzer` availability at runtime to gracefully degrade on older devices.

## Anti-patterns

- Hardcoded font sizes → breaks Dynamic Type
- Hardcoded colors → breaks dark mode + accessibility
- Missing VoiceOver labels on icon buttons
- Modal sheets for non-interrupting content
- Retaining haptic generators long-term
- SwiftData `@Attribute(.unique)` with CloudKit
- Feeding raw audio format to SpeechAnalyzer without negotiation
