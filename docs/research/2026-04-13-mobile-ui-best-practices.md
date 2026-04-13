# Mobile UI Best Practices Research — 2026-04-13

## Common Foundations (cross-cutting)

### Visual hierarchy
- F-pattern scanning persists on mobile; first-screen content must earn the tap ([NN/g F-Shape](https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/))
- Hierarchy comes from size, weight, color, proximity — not nested borders ([NN/g Visual Hierarchy](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/))
- Three-tier density: title (14-16px bold) → description (12-14px) → metadata (11-12px muted). Mirrors M3 title/body/label ([M3 Type Scale](https://m3.material.io/styles/typography/type-scale-tokens))

### Contrast (WCAG 2.2)
- Body text ≥ 4.5:1 (SC 1.4.3 AA)
- Large text (≥18pt regular / ≥14pt bold) ≥ 3:1
- Non-text UI components ≥ 3:1 (SC 1.4.11)
- Apple HIG aligns with WCAG AA; no stricter published threshold

### Typography
- iOS body default = 17pt SF Pro; auto-switches Display ≥20pt, Text ≤19pt
- Dynamic Type (iOS 18+): 12 sizes, 5 AX levels up to ~310% scale
- Material 3 type scale: 5 roles × 3 sizes (Display 57/45/36, Headline 32/28/24, Title 22/16/14, Body 16/14/12, Label 14/12/11). Regular or Medium only
- iOS points vs Material dp/px — don't blend; pick one and convert

### Color roles

| Role | Purpose | iOS | Material 3 |
|---|---|---|---|
| Semantic | Meaning-driven, adapts light/dark | label, systemBackground, separator | on-surface, surface, outline, error |
| Accent/Tint | Interactivity signal | tintColor / accent | primary, secondary, tertiary |
| Surface | Grouping, elevation | primary/secondary/tertiary bg | surface-container-lowest → -highest (5) |

Never hardcode hex for anything needing dark mode / high-contrast / theming support.

### Motion
- Always honor Reduce Motion / prefers-reduced-motion (WCAG SC 2.3.3)
- Apple: replace parallax with crossfades, avoid autoplay
- Material 3 Expressive (May 2025) uses motion-physics springs; 46 studies, 18k participants

### Accessibility minimums
- WCAG 2.5.8 (AA): 24×24 CSS px minimum — legal floor, not design target
- WCAG 2.5.5 (AAA): 44×44 CSS px enhanced — working minimum
- Apple: 44×44 pt minimum; visionOS 60×60pt
- Material 3 / Android: 48×48 dp
- Use 44pt/48dp as working floor; 24px is absolute compliance floor
- Focus visible (SC 2.4.7), focus-not-obscured (SC 2.4.11)
- NN/g touch research: natural zone 96% accuracy vs stretch 61%

## Mobile Web UI

### Viewport + touch
- Always `<meta name="viewport" content="width=device-width, initial-scale=1">` — removes iOS 300ms click delay
- Content ≥ 70%, chrome ≤ 30% of viewport

### Thumb zones
- Primary actions in bottom 25-40% of viewport
- Top-left: identity + back; top-right: destructive/exit (avoid accidental taps)
- Full-width CTAs for conversion-critical; compact for secondary

### Touch vs hover
- No primary content behind `:hover` on touch devices
- `@media (hover: hover)` for desktop-only affordances
- iOS Safari emits click without delay when viewport meta is set

### Forms
- inputmode / type=email|tel|number|url for correct mobile keyboard
- autocomplete tokens for autofill
- Labels outside inputs (never placeholder-as-label)
- Error states: color + icon + text (WCAG 1.4.1)
- Field height ≥ 44px

### iOS Safari
- `100dvh` not `100vh` for true viewport
- `env(safe-area-inset-bottom)` for home indicator
- No automatic PWA install — instruct user (Share → Add to Home Screen)
- Push notifications supported since iOS 16.4
- 50 MB Safari cache ceiling on iOS
- No Face ID / Touch ID / BLE / USB / full accelerometer from web

### Performance
- LCP < 2.5s, INP < 200ms, CLS < 0.1
- Chunk main-thread tasks >50ms
- Prefer transform/opacity for animation

## iOS UI

### Navigation
- Tab bar: 3-5 top-level mutually exclusive; never actions
- NavigationStack (not deprecated NavigationView) for drill-down
- Toolbar: contextual actions for current view
- Modal: only for tasks that must complete or cancel
- Large titles collapse inline on scroll

### Colors
- Color.accentColor / tintColor for interactivity
- Color(.systemBackground), Color(.label), Color(.separator) for hierarchy
- 4 label levels: primary/secondary/tertiary/quaternary
- Never hardcode hex for dark-mode-dependent content

### Typography
- .font(.body), .title, .headline — never .system(size: 17)
- Dynamic Type: support xSmall → xxxLarge + AX1-AX5
- Test AX3+ — layouts must reflow not clip

### SF Symbols
- Use for every system icon; auto-scale with Dynamic Type, auto-tint, semantic variants (filled/circle/square/slash)

### Haptics
- UIImpactFeedbackGenerator: light/medium/heavy/soft/rigid — match weight to visual
- UINotificationFeedbackGenerator: success/warning/error — task outcomes only
- UISelectionFeedbackGenerator: discrete value changes
- Don't retain long-term (Taptic Engine idle state)

### Materials
- .ultraThinMaterial → .thickMaterial
- iOS 26 Liquid Glass: new translucent material system (verify SwiftUI API names against live Xcode docs)

### Live Activities
- Three states: compact / minimal / expanded
- Content concentric with pill shape
- Payload ≤ 4 KB
- Use relevance score for competition
- Paused activities: staleDate = .distantFuture (FloDoro lesson)

### Anti-patterns
- Hardcoded font sizes → breaks Dynamic Type
- Hardcoded colors → breaks dark mode
- Missing VoiceOver labels on icon buttons
- Modal sheets for non-interrupting content
- SwiftData @Attribute(.unique) with CloudKit
- Raw audio format to SpeechAnalyzer without negotiation

## macOS UI

### Windows
- Full-size content view default — content under translucent titlebar
- Resizable unless content can't reflow
- Persist size + position
- Support ⌘T tabbing for document/browsable apps

### Toolbars, sidebars, inspectors
- Sidebar: .sidebar material with vibrancy
- Toolbar: primary actions + search; respect user customization
- Inspector: right-side contextual panel, toggleable

### Menus
- Menu bar first-class; every command reachable
- Sacred shortcuts never rebound: ⌘N/O/S/W/Q, ⌘Z/⇧⌘Z, ⌘X/C/V, ⌘F, ⌘,, ⌘?
- Context menus supplement, never replace menu bar

### Keyboard-first
- Every interactive element tab-reachable
- Focus ring visible (WCAG 2.4.7)
- No mouse-only features

### Pointer targets
- Apple doesn't publish single macOS minimum equivalent to iOS 44pt
- Use WCAG 2.5.8 (24×24) as floor; 28-32pt for standalone buttons
- Hover states expected

### Vibrancy + materials
- NSVisualEffectView materials: sidebar, titlebar, menu, popover, HUD
- 4 vibrancy levels: default (highest contrast) → quaternary (lowest)
- macOS 26 Tahoe Liquid Glass: translucent menu bar, Dock, Control Center

### Distribution
- App Store: Xcode Organizer → ASC; sandbox required
- Direct/Sparkle: Developer ID signed + notarized (required since 2019 for silent Gatekeeper)
- Sparkle nested executables: must be signed + timestamped or notarization fails
- Universal: arm64 + x86_64 unless dropping Intel

## Confidence summary

| Section | Confidence | Notes |
|---|---|---|
| WCAG contrast + target sizes | ✅ | WCAG 2.2 normative |
| Dynamic Type sizes | ✅ | HIG + cross-ref |
| iOS 44pt target | ✅ | HIG + UI Design Tips |
| Material 3 type scale | ✅ | m3.material.io tokens |
| M3 surface container roles | ✅ | m3.material.io/styles/color/roles |
| Liquid Glass (iOS/macOS 26) | ✅ broad / ⚠️ specific API names | Apple Newsroom + secondary |
| Apple doc URLs | ✅ | All verified via developer.apple.com |
| iOS Safari PWA limits | ✅ | T2 corroborated |
| macOS pointer minimum | ❓ | Apple silent; using WCAG floor |
| M3 Expressive motion | ✅ | M3 blog + Dezeen coverage |

## Sources

All accessed 2026-04-13.

**T1:** WCAG 2.2, Apple HIG (hub/color/typography/layout/motion/materials/toolbars), Apple UI Design Tips, Apple Fonts, HealthKit docs, ASC, TestFlight, Xcode distribution, Notarizing macOS, Developer ID, NSVisualEffectView, UIImpactFeedbackGenerator, ActivityKit, Material Design 3 (hub/color/typography/elevation/motion), M3 Expressive blog, Apple Newsroom Liquid Glass announcement, WWDC23 Session 10194

**T2:** NN/g (touch targets, F-shape, visual hierarchy, large touchscreens), learnui.design iOS font sizes, MDN prefers-reduced-motion, Apple Support keyboard shortcuts, MacRumors, Dezeen M3 Expressive

## Apple documentation — canonical URLs

### HIG
- https://developer.apple.com/design/human-interface-guidelines
- https://developer.apple.com/design/human-interface-guidelines/color
- https://developer.apple.com/design/human-interface-guidelines/typography
- https://developer.apple.com/design/human-interface-guidelines/layout
- https://developer.apple.com/design/human-interface-guidelines/motion
- https://developer.apple.com/design/human-interface-guidelines/materials
- https://developer.apple.com/design/human-interface-guidelines/toolbars
- https://developer.apple.com/design/tips/
- https://developer.apple.com/fonts/

### HealthKit
- https://developer.apple.com/documentation/healthkit
- https://developer.apple.com/documentation/healthkit/setting-up-healthkit
- https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data
- https://developer.apple.com/documentation/xcode/configuring-healthkit-access
- https://developer.apple.com/documentation/Updates/HealthKit

### Live Activities
- https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities

### TestFlight + distribution
- https://developer.apple.com/app-store-connect/
- https://developer.apple.com/testflight/
- https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/
- https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers
- https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/
- https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices
- https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases
- https://developer.apple.com/documentation/xcode/preparing-your-app-for-distribution/
- https://help.apple.com/xcode/mac/current/en.lproj/dev60b6fbbc7.html

### macOS distribution
- https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution
- https://developer.apple.com/developer-id/
- https://developer.apple.com/documentation/appkit/nsvisualeffectview
- https://support.apple.com/en-us/102650
- https://help.apple.com/xcode/mac/current/en.lproj/dev067853c94.html
