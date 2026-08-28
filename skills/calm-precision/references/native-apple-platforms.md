# Calm Precision — iOS / macOS / watchOS Native

Comprehensive design and implementation guide for Apple-native apps built with SwiftUI.
Extends the core Calm Precision principles to platform-specific patterns, system integration,
and lessons learned from cross-platform development.

---

## 1. Core Principles (Native Translation)

The 13 Calm Precision principles remain the foundation. This section maps each to native equivalents.

| # | Principle | Web Implementation | Native Implementation |
|---|-----------|-------------------|----------------------|
| 1 | Group, Don't Isolate | Single border + dividers | `Section { }` in `List`/`Form`. Never individual `.overlay(RoundedRectangle)` on list rows |
| 2 | Size = Importance | `w-full` vs `compact` | `.controlSize(.large)` for primary, `.controlSize(.small)` for secondary. Full-width via `.frame(maxWidth: .infinity)` |
| 3 | Three-Line Hierarchy | Font size + weight | `.font(.headline)` → `.font(.subheadline)` → `.font(.caption).foregroundStyle(.secondary)` |
| 4 | Progressive Disclosure | Show less, expand | `.disclosureGroup`, `.sheet`, `.popover`. watchOS: NavigationLink to detail |
| 5 | Text Over Decoration | Color + weight, not boxes | `.foregroundStyle(.primary/.secondary/.tertiary)` + `.fontWeight()`. Status = text color only |
| 6 | Content Over Chrome | ≥70% content ratio | Minimize toolbar items. Use `.toolbar` sparingly. Content fills `.frame(maxWidth/Height: .infinity)` |
| 7 | Natural Language | Readable phrases | System-provided labels. `Text("25 minutes")` not `Text("25m")` for primary display |
| 8 | Rhythm & Alignment | 8pt grid | SwiftUI spacing defaults are already 8pt-aligned. Use `spacing:` parameter on stacks |
| 9 | Functional Integrity | Interactive iff backend exists | No `.onTapGesture {}` with empty body. No buttons that do nothing. No mock data as real |
| 10 | Content Resilience | Handle null/string/object | Optionals with `if let`. `Text(value ?? "—")`. Never force-unwrap for display |
| 11 | Mobile-First Structure | Base = mobile, breakpoints add | Base = iPhone. `#if os(macOS)` adds complexity. watchOS = further simplification |
| 12 | Purposeful Motion | Lift = interactive | `.animation(.easeInOut, value:)` only when state changes matter. Respect `accessibilityReduceMotion` |
| 13 | Voice Calibration | Button ≤3 words | `Button("Start Focus")` not `Button("Click Here to Begin Your Focus Session")` |

---

## 2. Platform Architecture

### 2a. Code Sharing Strategy

```
Shared/          ← 70% of code lives here
├── Engine/      ← Core logic (TimerEngine, state machines)
├── Models/      ← Data types, Codable structs
├── Theme/       ← Semantic colors, platform-branched tokens
├── Services/    ← HealthKit, permissions, background tasks
├── Sync/        ← CloudKit, WatchConnectivity, local network
├── Views/       ← Cross-platform views (SessionLog, Settings, Charts)
└── Data/        ← Local persistence (SQLite, SwiftData)

iOS/             ← iOS-specific (Live Activity, interruption tracking, UIKit bridges)
macOS/           ← macOS-specific (menu bar, NSWorkspace, visual alerts)
watchOS/         ← watchOS-specific (complications, warm palette, haptics)
```

### 2b. Platform Branching Patterns

**Compile-time branching** (preferred — zero runtime cost):
```swift
#if os(watchOS)
    Color(red: 1.0, green: 0.6, blue: 0.2)  // warm amber
#elseif canImport(UIKit)
    Color(UIColor.systemBlue)
#else
    Color(NSColor.controlAccentColor)
#endif
```

**Delegate pattern** (for behavioral differences):
```swift
protocol TimerEngineDelegate: AnyObject {
    func persistSession(_ entry: SessionEntry)
    func syncSession(_ entry: SessionEntry, healthData: HealthSessionData?)
    func playChime()
    func playHaptic(_ type: HapticType)
    func broadcastTimerState(_ state: TimerStateMessage)
}
// Each platform provides its own conformance
```

**When to use which:**
| Technique | Use When |
|-----------|----------|
| `#if os()` | Visual differences (colors, layout, sizes) |
| `#if canImport()` | Framework availability (UIKit vs AppKit) |
| Protocol/Delegate | Behavioral differences (audio, haptics, sync) |
| Environment/Injection | Runtime differences (settings, capabilities) |

### 2c. Stub Pattern for Unavailable Services

When a service exists on one platform but not others, provide a no-op stub:
```swift
#if os(iOS) || os(watchOS)
// Full HealthKitService implementation
#else
@MainActor
final class HealthKitService: ObservableObject {
    static let shared = HealthKitService()
    var isEnabled: Bool { false }
    func requestAuthorization() async -> Bool { false }
    func startSessionCapture(startDate: Date) { }
    func stopSessionCapture() -> HealthSessionData? { nil }
}
#endif
```

This allows shared views to reference `HealthKitService.shared` without `#if` guards everywhere.

---

## 3. Typography

### System Fonts

| Platform | Font | Text ≤19pt | Text ≥20pt |
|----------|------|------------|------------|
| iOS/macOS | SF Pro | SF Pro Text | SF Pro Display |
| watchOS | SF Compact | SF Compact Text | SF Compact Display |

The variable font transitions smoothly between 17–28pt. No manual switching needed with SwiftUI `.font()` modifiers.

### Minimum Sizes

| Platform | Minimum | Practical Floor |
|----------|---------|-----------------|
| iOS | 11pt (Caption2) | 13pt for body content |
| macOS | No hard min | 11pt for metadata |
| watchOS | No hard min | 14pt for readability on small screens |

### Dynamic Type Support

**Required for all text.** Use semantic styles, not hardcoded sizes:
```swift
// DO
Text("Focus Complete").font(.headline)
Text("25 minutes").font(.title2)

// DON'T
Text("Focus Complete").font(.system(size: 17, weight: .semibold))
```

Exception: Timer displays use fixed sizes for visual stability:
```swift
Text("25:00")
    .font(.system(size: 46, weight: .light, design: .monospaced))
    .monospacedDigit()
```

### Monospaced Digits

**Always use for changing numbers** — timers, counters, statistics:
```swift
.monospacedDigit()  // prevents layout jitter as digits change
```

### Text Style Reference

| Style | iOS Size | Use For |
|-------|----------|---------|
| `.largeTitle` | 34pt | Page anchors (L1) |
| `.title` | 28pt | Section headers |
| `.title2` | 22pt | Important values |
| `.title3` | 20pt | Subsection headers |
| `.headline` | 17pt bold | List row titles |
| `.body` | 17pt | Primary content |
| `.callout` | 16pt | Secondary content |
| `.subheadline` | 15pt | Supporting text |
| `.footnote` | 13pt | Metadata |
| `.caption` | 12pt | Timestamps |
| `.caption2` | 11pt | Floor — smallest allowed |

---

## 4. Touch Targets & Interaction

### Minimum Sizes

| Platform | Minimum | Implementation |
|----------|---------|----------------|
| iOS | 44 x 44pt | `.frame(minWidth: 44, minHeight: 44)` |
| watchOS | 44 x 44pt | Same — critical on small screens |
| macOS | 24 x 24pt (mouse) | `.frame(minWidth: 24, minHeight: 24)` |

### Button Sizing by Intent (Native)

```
Core conversion (Start Focus) → .controlSize(.large) + .frame(maxWidth: .infinity)
Equal choices (Keep Going / Take Break) → Side-by-side, equal width
Quick action (Pause, Reset) → .controlSize(.regular) or icon-only with 44pt frame
Destructive (Delete Session) → .tint(.red) + confirmation dialog
```

### watchOS Touch Zones

```
┌─────────────────────┐
│   Status / Info     │  ← Read-only zone (top 25%)
│                     │
│   Primary Action    │  ← Thumb-reachable center
│   [  START  ]       │
│                     │
│   Secondary         │  ← Bottom actions
│   [Change Mode ›]   │
└─────────────────────┘
```

Place primary actions in the center 50% of the screen. Secondary actions at bottom where the thumb naturally rests.

### Haptic Feedback Patterns

| Event | iOS | watchOS | macOS |
|-------|-----|---------|-------|
| Button tap | `.impact(.light)` | `.click` | N/A (trackpad) |
| Timer complete | `.notification(.success)` | `.success` | `NSSound` |
| Warning | `.notification(.warning)` | `.notification` | `NSHapticFeedbackManager` |
| Selection change | `.selection()` | `.directionUp` | N/A |
| Error | `.notification(.error)` | `.failure` | N/A |

**Rules:**
- Pair haptics with visual feedback (never haptics alone)
- Pre-warm generators: `generator.prepare()` before expected use
- Respect `accessibilityReduceMotion` for non-critical haptics
- watchOS haptics are simpler — use `WKInterfaceDevice.current().play(_:)`
- Don't overuse — haptic fatigue degrades the experience

---

## 5. Navigation Patterns

### iOS Navigation

**Single-screen focus apps** (timers, media players):
- No NavigationStack in main view
- Bottom quick-access strip for secondary screens
- `.sheet()` with `presentationDetents([.medium, .large])` for all overlays
- Mode switching via horizontal `ScrollView` carousel

```swift
// Quick-access strip (not a TabBar — custom, lighter)
HStack {
    QuickAccessButton(icon: "list.bullet", label: "Sessions") { showLog = true }
    QuickAccessButton(icon: "gearshape", label: "Settings") { showSettings = true }
    QuickAccessButton(icon: "antenna.radiowaves.left.and.right", label: "Nearby") { showNearby = true }
}
```

**Content-driven apps** (lists, feeds, settings):
- `NavigationStack` with `navigationDestination(for:)`
- `NavigationSplitView` for iPad/Mac with sidebar + detail
- Keep stack depth ≤ 3 levels

**Modal presentation:**
```swift
.sheet(isPresented: $showDetail) {
    DetailView()
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
}
```

### macOS Navigation

**Toolbar-based** (no bottom tab bars):
```swift
// Header toolbar — not NavigationStack toolbar
HStack(spacing: 16) {
    ToolbarButton("Settings", icon: "gearshape") { showSettings.toggle() }
    ToolbarButton("Sessions", icon: "list.bullet") { showLog.toggle() }
    Spacer()
    if engine.isRunning { Button("Reset") { showResetConfirm = true } }
}
```

**Menu bar extra** (persistent utility):
```swift
MenuBarExtra("FlowDoro", systemImage: "timer") {
    CompactTimerView(engine: engine)
}
.menuBarExtraStyle(.window)
```

**Window management:**
```swift
.windowStyle(.hiddenTitleBar)
.defaultSize(width: 400, height: 620)
```

### watchOS Navigation

**Vertical TabView** (primary navigation):
```swift
NavigationStack {
    TabView {
        TimerView(viewModel: viewModel)
        StatsView(viewModel: viewModel)
    }
    .tabViewStyle(.verticalPage)
}
```

**Rules:**
- Maximum 2–4 tabs in vertical pager
- Place scrollable content in the last tab only (prevents accidental tab switches)
- Use `NavigationLink` for sub-screens (mode picker, settings)
- Digital Crown drives tab switching — don't fight it with scroll views in non-last tabs

### Navigation Decision Tree

```
What kind of app?
├── Single-screen focus (timer, player, camera)
│   ├── iOS → No NavStack. Quick-access strip + sheets
│   ├── macOS → Toolbar buttons + sheets/popovers
│   └── watchOS → Vertical TabView (timer + stats)
├── Content browser (lists, feeds)
│   ├── iOS → NavigationStack, depth ≤ 3
│   ├── macOS → NavigationSplitView (sidebar + detail)
│   └── watchOS → List → NavigationLink → detail
└── Settings/Configuration
    ├── iOS → Form in .sheet or NavigationStack
    ├── macOS → Settings scene or .sheet
    └── watchOS → List with NavigationLinks
```

---

## 6. Color System

### Semantic Color Architecture

```swift
struct Theme {
    // Neutral palette — adapt per platform
    static let bgPrimary: Color = {
        #if os(watchOS)
        return .black
        #elseif canImport(UIKit)
        return Color(UIColor.systemBackground)
        #else
        return Color(NSColor.windowBackgroundColor)
        #endif
    }()

    // Mode-specific accents
    static func accentColor(for mode: String) -> Color {
        switch mode {
        case "timer": return .timerAccent    // blue
        case "flow": return .flowAccent      // teal
        case "f1": return .f1Accent          // purple
        default: return .accentColor
        }
    }
}
```

### Color Rules

1. **Use semantic system colors** (`Color.primary`, `.secondary`, `.accentColor`) as defaults
2. **Custom palette only for brand identity** (mode accents, feature-specific colors)
3. **Test both appearances** — Light and Dark Mode
4. **Avoid pure white/black** — use system backgrounds that adapt
5. **Status = text color only** — no background badges
6. **4.5:1 minimum contrast** for all text (7:1 preferred)

### Circadian-Safe watchOS Palette

Research shows 460–495nm blue light suppresses melatonin by up to 3.7x. For apps used at night (timers, sleep trackers, health apps):

```swift
#if os(watchOS)
extension Color {
    // All >560nm wavelength — circadian safe
    static let watchTimerAccent = Color(red: 1.0, green: 0.6, blue: 0.2)   // warm amber
    static let watchFlowAccent  = Color(red: 0.9, green: 0.65, blue: 0.3)  // golden
    static let watchBreakAccent = Color(red: 0.4, green: 0.75, blue: 0.5)  // sage green
    static let watchTextPrimary = Color(red: 1.0, green: 0.95, blue: 0.85) // warm white
    static let watchTextSecondary = Color(red: 0.7, green: 0.65, blue: 0.55) // warm gray
}
#endif
```

**Why watchOS specifically:** Watch is worn at night (sleep tracking, bedtime timers), viewed in dark rooms at close range. Blue light impact is amplified by proximity and pupil dilation.

**Color blending for dynamic warmth:**
```swift
extension Color {
    func blend(toward target: Color, amount: Double) -> Color {
        // Extract RGB via platform-specific API, interpolate
        let r = selfR + (targetR - selfR) * amount
        // ... for G, B channels
        return Color(red: r, green: g, blue: b)
    }
}
```

### Dark Mode Guidelines

| Element | Light | Dark | Native API |
|---------|-------|------|------------|
| Background | `.systemBackground` | `.systemBackground` (auto) | `Color(UIColor.systemBackground)` |
| Elevated surface | `.secondarySystemBackground` | `.secondarySystemBackground` | Same |
| Primary text | `.label` | `.label` | `Color.primary` |
| Secondary text | `.secondaryLabel` | `.secondaryLabel` | `Color.secondary` |
| Borders | `.separator` | `.separator` | `.foregroundStyle(.separator)` |

---

## 7. Layout Patterns

### Three-Line Content Structure (Native)

```swift
VStack(alignment: .leading, spacing: 4) {
    // Title — headline weight, primary color
    Text(session.modeLabel)
        .font(.headline)
        .foregroundStyle(.primary)

    // Description — regular weight, secondary
    Text("\(session.focusMinutes)m focus")
        .font(.subheadline)
        .foregroundStyle(.secondary)

    // Metadata — caption, tertiary
    Text(session.timestamp, style: .relative)
        .font(.caption)
        .foregroundStyle(.tertiary)
}
```

### Page Hierarchy (Native)

| Level | SwiftUI | Example |
|-------|---------|---------|
| L1 Anchor | `.font(.largeTitle).bold()` | "Session Log" |
| L2 Orient | `.font(.headline)` in `.toolbar` | Segmented picker, filters |
| L3 Content | `List { }` or `ScrollView { LazyVStack }` | Session rows |
| L4 Supporting | `.font(.caption).foregroundStyle(.tertiary)` | Sync status, device info |

### Spacing System

SwiftUI defaults to 8pt-aligned spacing. Use explicit values when overriding:

| Gap | Points | Use |
|-----|--------|-----|
| Tight | 4 | Between title and subtitle |
| Standard | 8 | Between related items in a group |
| Comfortable | 12 | Between groups within a section |
| Section | 16–20 | Between major sections |
| Page | 24+ | Top/bottom page margins |

### List Row Layout

```swift
HStack(spacing: 12) {
    // Leading indicator (mode color dot, icon)
    Circle()
        .fill(modeColor)
        .frame(width: 8, height: 8)

    // Content (three-line)
    VStack(alignment: .leading, spacing: 2) {
        Text(title).font(.headline)
        Text(subtitle).font(.subheadline).foregroundStyle(.secondary)
    }

    Spacer()

    // Trailing value
    Text(value)
        .font(.subheadline)
        .monospacedDigit()
        .foregroundStyle(.secondary)
}
.padding(.vertical, 4)
```

### Adaptive Layout

```swift
// iPhone: single column. iPad/Mac: side-by-side
ViewThatFits {
    HStack(spacing: 20) { leadingContent; trailingContent }  // wide
    VStack(spacing: 12) { leadingContent; trailingContent }   // narrow
}

// Or explicit size class
@Environment(\.horizontalSizeClass) var sizeClass
// sizeClass == .compact → iPhone portrait
// sizeClass == .regular → iPad, Mac, iPhone landscape
```

---

## 8. Modal & Overlay Patterns

### Sheet Presentation

```swift
// iOS — half-sheet + drag indicator
.sheet(isPresented: $showDetail) {
    DetailView()
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
}

// macOS — standard sheet (no detents)
.sheet(isPresented: $showDetail) {
    DetailView()
        .frame(minWidth: 400, minHeight: 300)
}

// watchOS — NavigationLink or .sheet (full screen)
.sheet(isPresented: $showDetail) {
    DetailView()
}
```

### Confirmation Dialogs

```swift
.confirmationDialog("End Session?", isPresented: $showEndConfirm) {
    Button("End & Save", role: .destructive) { engine.stop() }
    Button("Cancel", role: .cancel) { }
} message: {
    Text("Your progress will be saved.")
}
```

### Alert Pattern

```swift
.alert("Session Complete", isPresented: $showComplete) {
    Button("OK") { }
} message: {
    Text("Great work! 25 minutes of focus.")
}
```

### Overlay Decision Tree

```
Need user input/decision?
├── Binary (yes/no, confirm/cancel) → .confirmationDialog or .alert
├── Selection from list → .sheet with List
├── Form/configuration → .sheet with Form
└── Quick info (no interaction) → .overlay or .popover

Platform-specific:
├── iOS → .sheet with detents (.medium, .large)
├── macOS → .sheet (fixed frame) or .popover for small content
└── watchOS → .sheet (fullscreen) or NavigationLink
```

---

## 9. watchOS-Specific Design

### Design Philosophy

The Apple Watch is a **glance-and-go** device. Users interact for 2–5 seconds. Design for:
- **One primary action per screen** (Start, Pause, Resume)
- **Glanceable information** (large timer, status dot)
- **Minimal text** — icons + numbers over sentences
- **Thumb-zone awareness** — primary actions in center/bottom

### Timer Display Pattern

```swift
// System-rendered countdown — smooth, battery-efficient
if let interval = timerInterval {
    Text(timerInterval: interval, countsDown: true)
        .font(.system(size: 46, weight: .light, design: .monospaced))
        .monospacedDigit()
}

// Fallback for idle/paused states
Text(displayTime)
    .font(.system(size: 34, weight: .light, design: .monospaced))
```

**Why `Text(timerInterval:)`:** watchOS throttles `Timer.scheduledTimer` callbacks to conserve battery. System-rendered timers update smoothly at display refresh rate with zero app CPU cost.

### Always-On Display

```swift
@Environment(\.isLuminanceReduced) var isLuminanceReduced

var body: some View {
    VStack {
        timerDisplay
            .opacity(isLuminanceReduced ? 0.6 : 1.0)

        if !isLuminanceReduced {
            // Only show controls when wrist is raised
            actionButtons
        }
    }
}
```

**Rules:**
- Keep layout stable between active and AOD states (no reorganization)
- Reduce brightness of accent colors
- Hide interactive controls
- Lower update frequency
- Never show animations in AOD

### watchOS Layout Template

```swift
VStack(spacing: 4) {
    // Status line (phase + mode)
    HStack {
        Image(systemName: phaseIcon)
        Text(phaseLabel)
    }
    .font(.caption2)
    .foregroundStyle(.secondary)

    // Hero display (timer)
    TimerDisplay(...)

    // Primary action
    Button(action: primaryAction) {
        Text(actionLabel)
            .frame(maxWidth: .infinity)
    }
    .controlSize(.large)

    // Secondary action (if needed)
    NavigationLink("Change Mode") { ModePicker() }
        .font(.caption)
}
```

### Complications / Widgets

Timeline-based — provide entries for the system to render:
```swift
struct Provider: TimelineProvider {
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        // Current state entry
        let entry = TimerEntry(date: .now, phase: currentPhase, timeRemaining: remaining)
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}
```

**Budget management:**
- Complication updates: ~50/day
- Check `remainingComplicationUserInfoTransfers` before sending
- Use `transferCurrentComplicationUserInfo` for priority delivery
- Regular data via `transferUserInfo` (guaranteed but lower priority)

---

## 10. System Integration

### 10a. HealthKit

**Authorization — request only what you need, when you need it:**
```swift
let readTypes: Set<HKObjectType> = [
    HKQuantityType(.heartRate),
    HKQuantityType(.heartRateVariabilitySDNN),
    HKQuantityType(.stepCount),
    HKQuantityType(.activeEnergyBurned),
    HKCategoryType(.sleepAnalysis),     // only if showing sleep context
    HKCategoryType(.mindfulSession),    // only if showing meditation context
    HKObjectType.workoutType()          // only if tracking workouts
]
```

**Session capture pattern** (collect during focus, aggregate at end):
```
Session Start → startSessionCapture(startDate:)
    ├── iOS: Start HR observer query + cache pre-session context
    └── watchOS: Start HR observer query + start HKWorkoutSession

Session End → stopSessionCapture() → HealthSessionData
    ├── Aggregate: avg/min/max HR, HRV, steps, calories
    ├── Compute: flow indicator (HR stability 30%, HRV 30%, HR elevation 20%, low movement 20%)
    └── Combine: cached pre-session context (sleep, exercise, meditation, pre-session HR)
```

**Synchronous queries for session-end aggregation:**
```swift
// HealthKit queries are async, but session end is synchronous
// Use DispatchSemaphore with timeout
private func fetchSync<T>(_ query: HKQuery, timeout: TimeInterval = 5) -> T? {
    let semaphore = DispatchSemaphore(value: 0)
    var result: T?
    // ... execute query, signal semaphore in completion
    _ = semaphore.wait(timeout: .now() + timeout)
    return result
}
```

**watchOS workout session** (enables background HR collection):
```swift
let config = HKWorkoutConfiguration()
config.activityType = .mindAndBody
config.locationType = .indoor
let session = try HKWorkoutSession(healthStore: store, configuration: config)
session.startActivity(with: Date())
```

**Platform availability:**
| Feature | iOS | watchOS | macOS |
|---------|-----|---------|-------|
| Heart rate | via Apple Watch | native | no |
| HRV | via Apple Watch | native | no |
| Steps | native | native | no |
| Sleep analysis | native | native | no |
| Workout sessions | iOS 19+ | native | no |
| All HealthKit | yes | yes | **no** — use stub pattern |

### 10b. CloudKit + SwiftData

**Zero-code sync via ModelConfiguration:**
```swift
let config = ModelConfiguration(
    "AppName",
    schema: schema,
    cloudKitDatabase: .automatic  // iCloud private database
)
let container = try ModelContainer(for: schema, configurations: [config])
```

**CloudKit-compatible schema rules:**
- All properties must be optional or have defaults
- No unique constraints
- No `.deny` delete rules
- String-based identifiers (UUID → String)
- Lightweight migration only (add columns with defaults)

**Graceful degradation (3-tier fallback):**
```swift
do {
    container = try ModelContainer(for: schema, configurations: [cloudConfig])
} catch {
    // Tier 2: Local-only
    do {
        container = try ModelContainer(for: schema, configurations: [localConfig])
    } catch {
        // Tier 3: In-memory (last resort — data won't persist)
        container = try! ModelContainer(for: schema, configurations: [memoryConfig])
    }
}
```

**Published sync state for UI:**
```swift
@Published private(set) var iCloudSyncEnabled: Bool = false
@Published private(set) var lastSyncDate: Date?
@Published private(set) var syncError: String?
```

### 10c. WatchConnectivity

**Three communication channels:**

| Method | Delivery | Use For |
|--------|----------|---------|
| `sendMessage(_:)` | Instant, requires counterpart foreground | Timer state (start/pause/stop) |
| `updateApplicationContext(_:)` | Next wake, latest-only | Preferences, current mode |
| `transferUserInfo(_:)` | Guaranteed FIFO, background | Completed session records |

**Decision tree:**
```
Data must arrive immediately?
├── Yes → sendMessage (check isReachable first)
│   └── Fallback → updateApplicationContext
├── Only latest matters → updateApplicationContext
└── Every message matters → transferUserInfo
```

**Activation pattern:**
```swift
if WCSession.isSupported() {
    let session = WCSession.default
    session.delegate = self
    session.activate()
}
```

**No direct Mac ↔ Watch path:**
```
Mac ──[Network Framework/Bonjour]──► iPhone ──[WatchConnectivity]──► Watch
```

### 10d. Live Activity / Dynamic Island (iOS)

**Attributes + ContentState:**
```swift
struct TimerActivityAttributes: ActivityAttributes {
    let modeLabel: String
    struct ContentState: Codable, Hashable {
        let phase: String
        let endDate: Date
        let isPaused: Bool
        let cycleNumber: Int
        let totalCycles: Int
    }
}
```

**Timer rendering in widgets:**
```swift
// System-rendered countdown (smooth, battery-efficient)
if !state.isPaused {
    Text(timerInterval: Date.now...state.endDate, countsDown: true)
} else {
    Text(formatRemaining(state))  // static when paused
}
```

**Dynamic Island regions:**
| Region | Content | Size |
|--------|---------|------|
| Expanded leading | Mode icon + label | —  |
| Expanded trailing | Countdown timer | —  |
| Expanded bottom | Progress bar + cycle counter | —  |
| Compact leading | Phase icon | 16pt |
| Compact trailing | Timer | 52pt width |
| Minimal | Phase icon | smallest |

**Lifecycle:**
```swift
// Start
let activity = try Activity.request(attributes: attrs, content: state)

// Update
await activity.update(ActivityContent(state: newState, staleDate: staleDate))

// End
await activity.end(ActivityContent(state: finalState, staleDate: .now), dismissalPolicy: .immediate)
```

### 10e. Local Network Sync (Bonjour / Network Framework)

**For same-WiFi real-time sync between Mac and iPhone:**
```swift
// Advertise
let listener = try NWListener(using: .tcp)
listener.service = NWListener.Service(name: "FlowDoro-\(deviceName)", type: "_flowdoro._tcp")

// Browse
let browser = NWBrowser(for: .bonjour(type: "_flowdoro._tcp", domain: nil), using: .tcp)
```

**Use cases:**
- Real-time timer state between Mac and iPhone (<1s latency)
- Peer discovery for "Nearby Devices" feature
- Complement to CloudKit (which has ~15s latency)

---

## 11. State Management

### SwiftUI Reactivity

```swift
@MainActor
final class TimerEngine: ObservableObject {
    @Published var phase: TimerPhase = .idle
    @Published var timeLeft: Int = 0
    @Published var isRunning: Bool = false
    @Published var showCheckIn: Bool = false
}

// In views
@StateObject private var engine = TimerEngine()
// or
@EnvironmentObject var engine: TimerEngine
```

### Date-Based Time Anchors

**Never rely on Timer tick counts for display.** Use date math:
```swift
private(set) var phaseStartDate: Date?
private var pauseAccumulatedDuration: TimeInterval = 0

func continuousElapsed(at now: Date = Date()) -> TimeInterval {
    guard let start = phaseStartDate else { return 0 }
    return now.timeIntervalSince(start) - pauseAccumulatedDuration
}

// For watchOS system timer
var systemTimerInterval: ClosedRange<Date>? {
    guard isRunning, let start = phaseStartDate else { return nil }
    let effectiveStart = start.addingTimeInterval(pauseAccumulatedDuration)
    let end = effectiveStart.addingTimeInterval(TimeInterval(totalTime))
    return effectiveStart...end
}
```

**Why:** Timer callbacks can be delayed (background, throttling, system load). Date math gives accurate elapsed time regardless of callback timing. watchOS specifically throttles Timer to conserve battery.

### Persistence Layers

| Layer | Technology | Speed | Reliability | Use For |
|-------|-----------|-------|-------------|---------|
| @AppStorage | UserDefaults | Instant | Per-device | Settings, toggles, small prefs |
| SQLite | Direct C API | <1ms | Per-device | Session history, app usage |
| SwiftData + CloudKit | ModelContainer | ~15s sync | Cross-device | Synced records |
| JSON files | Codable | Fast | Per-device | watchOS session backup |
| Keychain | Security framework | Fast | Per-device | Secrets, API keys |

---

## 12. Accessibility

### VoiceOver

**Every interactive element needs a label:**
```swift
Button(action: pause) {
    Image(systemName: "pause.fill")
}
.accessibilityLabel("Pause timer")

// For complex custom views
.accessibilityElement(children: .ignore)
.accessibilityLabel("Timer: 15 minutes remaining")
.accessibilityValue("60 percent complete")
```

**Announcement order:** Label → Value → Trait → Hint (system-defined, can't change)

**Custom actions** (for multi-action rows):
```swift
.accessibilityAction(named: "Delete session") { deleteSession() }
.accessibilityAction(named: "Rate session") { showRating() }
```

### Dynamic Type Scaling

```swift
// Spacing that scales with text
@ScaledMetric(relativeTo: .body) var spacing: CGFloat = 8

// Fixed items that shouldn't scale
.frame(width: 44, height: 44)  // touch targets stay fixed
```

### Reduced Motion

```swift
@Environment(\.accessibilityReduceMotion) var reduceMotion

.animation(reduceMotion ? nil : .easeInOut(duration: 0.3), value: progress)
```

**Replace with crossfade when motion is reduced:**
```swift
.transition(reduceMotion ? .opacity : .move(edge: .bottom).combined(with: .opacity))
```

### Accessibility Checklist

- [ ] All icon-only buttons have `.accessibilityLabel`
- [ ] All text uses Dynamic Type (`.font(.headline)` not `.font(.system(size: 17))`)
- [ ] Touch targets ≥ 44pt on iOS/watchOS
- [ ] Color contrast ≥ 4.5:1 (verify with Accessibility Inspector)
- [ ] No information conveyed by color alone
- [ ] `accessibilityReduceMotion` respected for all animations
- [ ] `isLuminanceReduced` handled for watchOS AOD
- [ ] Custom views have `.accessibilityElement` + labels
- [ ] VoiceOver navigation follows logical reading order
- [ ] Actionable items have correct `.accessibilityTraits`

---

## 13. Error & Empty States

### Error Pattern

```swift
// What → Why → What to do
struct ErrorView: View {
    let title: String      // What: "Couldn't load sessions"
    let reason: String     // Why: "iCloud is unavailable"
    let action: String     // Fix: "Check your internet connection"
    let retry: (() -> Void)?

    var body: some View {
        VStack(spacing: 12) {
            Text(title).font(.headline)
            Text(reason).font(.subheadline).foregroundStyle(.secondary)
            if let retry {
                Button(action) { retry() }
                    .buttonStyle(.bordered)
            }
        }
        .padding()
    }
}
```

### Empty State Pattern

```swift
// Context-matched CTA
ContentUnavailableView {
    Label("No Sessions Yet", systemImage: "clock")
} description: {
    Text("Complete your first focus session to see it here.")
} actions: {
    Button("Start Focusing") { startSession() }
        .buttonStyle(.borderedProminent)
}
```

**Tone matching:**
| Context | Tone | Example |
|---------|------|---------|
| First use | Encouraging | "Start your first session to build your focus history" |
| No search results | Neutral | "No sessions match your search" |
| All filtered out | Helpful | "Try adjusting your filters" + reset button |
| All complete | Celebratory | "All caught up!" |

### Graceful Degradation

```
Full data available → Rich display
Partial data → Show what we have + subtle "limited data" indicator
No data → Empty state with CTA
Error → Error view with retry
Service unavailable → Fallback to local + status indicator
```

---

## 14. Performance Patterns

### Lazy Loading

```swift
// For long lists
ScrollView {
    LazyVStack(spacing: 0) {
        ForEach(sessions) { session in
            SessionRow(session: session)
        }
    }
}

// NOT
VStack {
    ForEach(sessions) { ... }  // loads all at once
}
```

### Image Optimization

```swift
// System symbols — always vector, always sharp
Image(systemName: "timer")
    .symbolRenderingMode(.hierarchical)  // subtle depth
    .foregroundStyle(.accent)

// For custom images
AsyncImage(url: imageURL) { image in
    image.resizable().scaledToFit()
} placeholder: {
    ProgressView()
}
```

### Database Performance

```swift
// SQL-filtered queries (good) — use indexes
let sql = "SELECT * FROM sessions WHERE date = ? ORDER BY created_at ASC"

// NOT: fetch all, filter in Swift (bad for large datasets)
let all = fetchAllSessions().filter { $0.date == today }  // loads everything into memory
```

**Index important columns:**
```sql
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
```

### Background Task Patterns

**iOS:**
```swift
// Background refresh
BGTaskScheduler.shared.register(forTaskWithIdentifier: id, using: nil) { task in
    // Quick work only
}

// Extended runtime (for active timer sessions)
// Use BGProcessingTaskRequest for long-running work
```

**watchOS:**
```swift
// Extended runtime session (keeps app running during focus)
let session = WKExtendedRuntimeSession()
session.start()
```

---

## 15. Approaches Explored But Not Used

Documenting patterns researched for FlowDoro that were ultimately not adopted, with rationale.
These remain valid options for other apps.

### SwiftUI Charts for Session History

**What:** Using Apple's Charts framework for session trend visualization.
**Why not used:** Session data is sparse (a few sessions/day). Charts added visual complexity without proportional insight. Simple stat numbers + colored dots communicate the same information with less cognitive load.
**When to use:** Apps with dense time-series data (fitness tracking, financial data, weather). Minimum ~20 data points before a chart adds value over a number.

### Core Data Instead of SwiftData

**What:** Using Core Data for persistence and sync.
**Why not used:** SwiftData provides the same CloudKit integration with less boilerplate. For new projects targeting iOS 17+, SwiftData is the right choice.
**When to use:** Apps that need iOS 15/16 support, complex Core Data migration paths, or advanced fetch request predicates not yet available in SwiftData.

### NavigationSplitView for iPad

**What:** Two-column navigation with session list + detail.
**Why not used:** FlowDoro is a single-focus-point app. Split view adds navigation complexity without clear benefit — users interact with the timer, not browse a list.
**When to use:** Content-browsing apps (email, notes, file managers) where users frequently switch between items in a list.

### WidgetKit Interactive Widgets

**What:** Buttons in Lock Screen widgets (iOS 17+) for quick start/pause.
**Why not used:** Timer control requires nuanced state (which mode? which phase? confirmation?). A button that sometimes works and sometimes needs clarification is worse than consistently opening the app.
**When to use:** Simple toggle actions (toggle light, start/stop recording), binary state changes where the action is always unambiguous.

### CloudKit Subscriptions for Push Sync

**What:** CKSubscription to get push notifications when another device saves data.
**Why not used:** SwiftData's automatic CloudKit sync handles this transparently. Manual subscriptions add complexity for minimal latency improvement over the ~15s automatic sync.
**When to use:** When you need to trigger specific actions on data changes (e.g., send a notification, update a badge), not just sync data.

### Multipeer Connectivity Instead of Network Framework

**What:** Using MultipeerConnectivity.framework for local device discovery and sync.
**Why not used:** Network Framework (Bonjour/NWBrowser) provides more control, works without user-facing browser UI, and integrates better with modern concurrency.
**When to use:** When you want Apple's built-in peer browser UI, or need simple file transfer between devices without custom protocol work.

### Core Haptics Patterns (Complex)

**What:** Choreographed haptic sequences using CHHapticPattern for session milestones.
**Why not used:** Simple haptics (`.notification(.success)`) communicate completion effectively. Complex patterns require Taptic Engine capabilities that vary by device and don't improve the user experience proportionally.
**When to use:** Music/rhythm apps, games, fitness apps with tempo-based feedback where haptic patterns carry meaning beyond "something happened."

### WKApplicationDelegateAdaptor for watchOS

**What:** Using the full application delegate pattern on watchOS.
**Why not used:** SwiftUI lifecycle (`@main struct App: App`) handles all needed lifecycle events. The adaptor adds ceremony without benefit for apps that don't need UIKit/WatchKit delegate callbacks.
**When to use:** When you need handleRemoteNotification, handle workout route builder, or other delegate-only callbacks not available in SwiftUI lifecycle.

### StoreKit for Premium Features

**What:** In-app purchases or subscriptions for advanced analytics.
**Why not used:** Current feature set doesn't warrant a paywall. Adding StoreKit complexity before validating demand is premature optimization.
**When to use:** When you have validated that users want features beyond the free tier and have a clear value proposition for what's behind the paywall.

### App Intents for Siri/Shortcuts

**What:** Exposing timer actions to Siri and Shortcuts via AppIntents framework.
**Why not used:** Timer sessions are intentional, focused activities. Voice-starting a focus session contradicts the deliberate-action design philosophy. The physical act of tapping "Start" creates commitment.
**When to use:** Utility actions (check status, read data, toggle settings) that don't require user attention or commitment to complete.

---

## 16. Decision Trees (Native-Specific)

### Data Persistence

```
Data type?
├── User preference / toggle → @AppStorage (UserDefaults)
├── Session records (must sync) → SwiftData + CloudKit
├── Session records (local backup) → SQLite (direct)
├── Real-time state (timer) → @Published in ObservableObject
├── Temporary cache → private property on manager class
└── Secrets / tokens → Keychain
```

### Platform Feature Availability

```
Feature needed?
├── Available on all platforms → Shared/ directory
├── iOS + watchOS only → #if os(iOS) || os(watchOS) or stub pattern
├── iOS only → iOS/ directory or #if os(iOS)
├── macOS only → macOS/ directory or #if os(macOS)
├── watchOS only → watchOS/ directory or #if os(watchOS)
└── Unclear → Implement in Shared/ with compile-time guards
```

### Animation Decisions

```
What changed?
├── Progress value → .animation(.linear, value:)
├── Show/hide element → .transition(.opacity) with withAnimation
├── State change (idle→running) → .animation(.easeInOut(duration: 0.3), value:)
├── Warning/urgency → Slow pulse (1.5s easeInOut, repeat)
├── List appearance → Stagger 40-80ms per item, max 400ms total
└── Nothing meaningful → No animation
```

### Sheet vs NavigationLink

```
Where does the content go?
├── New context (settings, detail, log) → .sheet (modal)
├── Drill-down in hierarchy → NavigationLink
├── Quick info overlay → .popover (macOS) or .sheet(.medium) (iOS)
├── Confirmation → .confirmationDialog or .alert
└── watchOS sub-screen → NavigationLink (always)
```

---

## 17. Auto-Apply Rules (Native)

1. Use semantic text styles (`.headline`, `.body`, `.caption`) — never hardcoded sizes except timers
2. All icon-only buttons get `.accessibilityLabel`
3. Touch targets ≥ 44pt on iOS/watchOS, ≥ 24pt on macOS
4. `#if os()` for platform-specific views, delegate for platform-specific behavior
5. `.monospacedDigit()` on all changing numbers
6. Stub pattern for services unavailable on a platform
7. Date-based time anchors for all timer displays
8. `Text(timerInterval:countsDown:)` on watchOS — never `Timer.scheduledTimer` for display
9. 3-tier fallback for CloudKit (cloud → local → memory)
10. `.animation()` with explicit `value:` parameter — never bare `.animation()`
11. `@Environment(\.accessibilityReduceMotion)` checked before animations
12. `@Environment(\.isLuminanceReduced)` for watchOS AOD
13. `.sheet()` with `.presentationDetents` on iOS — not custom bottom sheets
14. `LazyVStack` in `ScrollView` for lists > 20 items
15. SQL-filtered queries with indexes — not fetch-all-then-filter
16. Graceful degradation: show what you have, indicate what's missing
17. Status = text color + label only — no colored badges or backgrounds
18. One `@Published` property per piece of reactive state — no derived `@Published`
19. `@MainActor` on all `ObservableObject` classes
20. `Codable` on all data transfer types — never manual serialization

---

## 18. Quick Self-Audit (Native)

### Architecture
1. Is shared code in `Shared/`, platform code in `iOS/`/`macOS/`/`watchOS/`?
2. Does the engine use delegate pattern for platform differences?
3. Are unavailable services stubbed (not `#if` guarded in every view)?
4. Is `@MainActor` on all `ObservableObject` classes?

### Typography
5. All text uses semantic styles (`.headline`, not `.system(size:)`)?
6. Timer displays use `.monospacedDigit()`?
7. Dynamic Type supported (no fixed font sizes except timers)?

### Touch & Interaction
8. All touch targets ≥ 44pt on iOS/watchOS?
9. Haptics paired with visual feedback?
10. `accessibilityReduceMotion` checked?

### Navigation
11. Does the nav pattern match the app type (focus vs content)?
12. iOS modals use `.presentationDetents`?
13. watchOS uses vertical `TabView`?
14. macOS uses toolbar-based navigation (no bottom tabs)?

### Data
15. CloudKit schema uses defaults (no unique constraints)?
16. Graceful degradation on sync failure?
17. Date-based time anchors (not tick counting)?
18. `Text(timerInterval:)` on watchOS for timers?

### Color
19. Semantic system colors where possible?
20. watchOS uses circadian-safe warm palette?
21. 4.5:1+ contrast verified in both appearances?
22. Status conveyed by text color, not background?

### Accessibility
23. All icon-only buttons labeled?
24. VoiceOver reads logical order?
25. No information by color alone?
26. `isLuminanceReduced` handled for AOD?

### Performance
27. Long lists use `LazyVStack`?
28. Database queries use WHERE + indexes?
29. Background tasks follow platform patterns?
30. Images use SF Symbols (vector) over raster?

---

*Calm Precision — Native Apple Platforms v1.0*
*Companion to Calm Precision 6.6.0 (Web/Tailwind)*
*Derived from FlowDoro cross-platform development + Apple HIG 2026*
