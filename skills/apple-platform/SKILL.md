---
name: apple-platform
description: Use when building iOS, watchOS, or macOS apps — architecture, SwiftData, Swift concurrency, CI/CD, TestFlight. How to build. For HIG design rules see ios-design.
version: 0.1.0
user-invocable: true
argument-hint: "[ios|watchos|macos|multiplatform] [feature description]"
---

# Apple Platform

Build production-grade iOS, watchOS, and macOS apps with SwiftUI. Covers architecture, platform abstraction, Watch connectivity, state management, concurrency, testing, and deployment.

## When to Use

- New iOS or watchOS app from scratch
- Adding Apple Watch companion to existing iOS app
- Multiplatform Swift app (iOS + watchOS + macOS)
- SwiftUI architecture decisions
- Watch connectivity and data sync
- SwiftData/persistence setup
- Live Activities, complications, widgets
- CI/CD and TestFlight deployment

## Pre-Implementation Protocol (MANDATORY for Major Changes)

Before writing any code for a major change (see triggers below), dispatch two parallel subagents:

**Trigger conditions** -- any ONE of:
- Change touches `Shared/` code (cross-platform impact)
- New framework, capability, or entitlement being added
- Data model or schema modification
- New target or extension (widget, complication, Live Activity)
- Refactoring navigation, state management, or architecture patterns
- Adding or modifying Watch connectivity

**Skip for:** typos, single-view additions within one platform folder, comments, running builds/tests.

### Parallel Subagent Dispatch

Launch both simultaneously using the Agent tool:

**Subagent 1 — Architecture Research** (subagent_type: Explore)
```
Explore the iOS/watchOS project at [PROJECT_PATH].
Assess impact of [PROPOSED CHANGE]:
1. Read project config (project.yml or *.xcodeproj)
2. Read Shared/Protocols/ and Shared/Models/
3. Read the specific files to be modified
4. Map which platforms and delegates are affected
5. Check for existing tests covering affected code
Produce: affected files, platform impact, data model changes,
risks, and recommended implementation order.
```

**Subagent 2 — Version & Compatibility Check** (subagent_type: general-purpose)
```
Run: bash ${CLAUDE_PLUGIN_ROOT}/scripts/apple-platform/apple-version-check.sh [PROJECT_PATH]
Then verify: are the APIs needed for [PROPOSED CHANGE] available
at the project's current deployment targets?
Flag any deprecations, minimum version requirements, or Swift
feature availability issues.
```

### After Both Complete

Synthesize findings into a brief implementation plan before writing code:
1. What files change, in what order
2. Which platforms are affected
3. Any version/compatibility blockers
4. What to test after each step

See `${CLAUDE_PLUGIN_ROOT}/references/apple-platform/pre-implementation-research.md` for full protocol details.

## Core Principles

1. **Platform abstraction via delegates** -- core logic has zero platform imports. Platform-specific behavior injected through protocol delegates.
2. **Local-first persistence** -- write locally (SQLite/SwiftData), sync async (CloudKit). Never block on network.
3. **Date-based timing** -- for any timer/countdown, use `Date` math (`start.timeIntervalSince(now) - pausedDuration`), never integer decrement. Eliminates jitter across all platforms.
4. **Graceful degradation** -- partial results over hard failure. Missing HealthKit permission? Skip health data, don't crash. CloudKit offline? Queue and retry.
5. **Shared code target** -- extract models, services, and utilities into a shared Swift Package or folder with dual target membership. Target 70%+ code sharing.

## Project Structure

For multiplatform apps (iOS + watchOS), use this structure:

```
MyApp/
  project.yml              # XcodeGen (or .xcodeproj)
  Shared/                  # Both targets -- models, services, utilities
    Models/
    Services/
    Extensions/
    Protocols/
  iOS/                     # iOS-only
    App/                   # Entry point, AppDelegate
    Features/              # Feature modules
    Views/                 # iOS-specific UI
    Widgets/               # Live Activities, WidgetKit
    Resources/
  watchOS/                 # watchOS-only
    App/
    Features/
    Views/
    Complications/
    Resources/
  macOS/                   # macOS-only (if applicable)
    App/
    Features/
    Views/
  Tests/
    UnitTests/             # Shared logic tests (macOS host)
    UITests/               # iOS UI tests
  Packages/                # Local Swift Packages (optional)
    SharedKit/
```

### Build Configuration

- Swift 5.9+ / Xcode 16+
- iOS 17.0+ / watchOS 10.0+ / macOS 14.0+ (minimum for @Observable, SwiftData)
- Automatic code signing for dev, manual for CI
- Bundle IDs: `com.example.app` (iOS), `com.example.app.watchkitapp` (watchOS)
- watchOS target embeds inside iOS app archive

## Architecture Pattern: Platform Delegate

The highest-value pattern for multiplatform apps. Core engine owns all business logic; delegates handle platform concerns.

```swift
// Shared/Protocols/EngineDelegate.swift
protocol AppEngineDelegate: AnyObject {
    func didUpdateState(_ state: AppState)
    func scheduleNotification(title: String, body: String, delay: TimeInterval)
    func playHaptic(pattern: HapticPattern)
    func persistSession(_ session: Session)
    func handlePlatformTransition()
}

// Shared/Services/AppEngine.swift
@MainActor @Observable
class AppEngine {
    weak var delegate: AppEngineDelegate?
    var state: AppState = .idle

    func start() {
        state = .running
        delegate?.didUpdateState(state)
    }
}

// iOS/Services/IOSEngineDelegate.swift
@MainActor
class IOSEngineDelegate: AppEngineDelegate {
    func playHaptic(pattern: HapticPattern) {
        // CoreHaptics implementation
    }
    func handlePlatformTransition() {
        // Live Activity updates, HealthKit capture
    }
}

// watchOS/Services/WatchEngineDelegate.swift
@MainActor
class WatchEngineDelegate: AppEngineDelegate {
    func playHaptic(pattern: HapticPattern) {
        WKInterfaceDevice.current().play(.click)
    }
    func handlePlatformTransition() {
        // Extended runtime session, complication update
    }
}
```

**Why this works**: Engine is testable without simulators. New platforms (visionOS, tvOS) require only a new delegate. Platform bugs are isolated.

## State Management

### @Observable (iOS 17+ / watchOS 10+)

Prefer `@Observable` over `ObservableObject` + `@Published` for new code:

```swift
@Observable class ViewModel {
    var items: [Item] = []       // Automatically tracked
    var isLoading = false        // No @Published needed
}

// In views:
@State private var vm = ViewModel()          // View owns it
@Environment(ViewModel.self) var vm          // Injected
@Bindable var vm: ViewModel                  // For bindings
```

### SwiftData

For persistence targeting iOS 17+:

```swift
@Model class Session {
    var startDate: Date = Date()
    var duration: Int = 0
    var mode: String = "focus"
    // All properties optional or defaulted for CloudKit compat
    // NO #Unique constraints with CloudKit
    @Relationship(deleteRule: .cascade) var entries: [Entry] = []
}

// View is the view model -- no separate VM wrapping @Query
struct SessionListView: View {
    @Query(sort: \Session.startDate, order: .reverse) var sessions: [Session]
    @Environment(\.modelContext) private var context

    var body: some View {
        List(sessions) { session in ... }
    }
}

// Background work requires @ModelActor
@ModelActor actor BackgroundProcessor {
    func importSessions(_ data: [SessionData]) throws {
        for item in data {
            let session = Session(...)
            modelContext.insert(session)
        }
        try modelContext.save()
    }
}
```

### Anti-Patterns

- Don't create ViewModels that just wrap `@Query` -- the view IS the view model
- Don't use `@State` with reference types -- causes recreation every render
- Don't access SwiftData relationships directly in CloudKit apps -- use `@Query` with predicates
- Don't use `#Unique` constraints with CloudKit -- causes silent failures

## Watch Connectivity

### Channel Selection

| Method | Use Case | Delivery | Limit |
|--------|----------|----------|-------|
| `sendMessage()` | Real-time commands | Instant (both active) | None |
| `updateApplicationContext()` | Latest-state sync | Background, last-wins | 1 pending |
| `transferUserInfo()` | Guaranteed records | Background, FIFO queue | None |
| `transferCurrentComplicationUserInfo()` | Complication data | High priority | 50/day |

### Implementation Pattern

```swift
// Shared/Services/SyncManager.swift
@MainActor @Observable
class SyncManager: NSObject, WCSessionDelegate {
    var isReachable = false
    private var session: WCSession?

    func activate() {
        guard WCSession.isSupported() else { return }
        session = WCSession.default
        session?.delegate = self
        session?.activate()
    }

    func sendCommand(_ command: [String: Any]) {
        guard let session, session.isReachable else {
            try? session?.updateApplicationContext(command)
            return
        }
        session.sendMessage(command, replyHandler: nil)
    }

    nonisolated func session(_ session: WCSession,
        didReceiveMessage message: [String: Any]) {
        Task { @MainActor in
            handleReceived(message)
        }
    }
}
```

### Critical Gotchas

- **App Groups NOT supported** between iOS and watchOS -- use WCSession, CloudKit, or iCloud KV store
- **Version mismatches** between iOS/watchOS app versions can disable WCSession entirely
- **Privacy permission changes** on iPhone immediately SIGKILL the Watch app
- `sendMessage` can wake iPhone app but is unreliable for waking Watch app
- Use `HKHealthStore.startWatchApp(with:)` to launch Watch from iPhone (health apps only)

### Mirror Mode Pattern

When Watch displays iPhone state (not running its own logic):

```swift
var remoteState: RemoteTimerState?
var isLocalMode = false

var displayTime: TimeInterval {
    if isLocalMode { return localEngine.elapsed }
    guard let remote = remoteState else { return 0 }
    return Date().timeIntervalSince(remote.startDate) - remote.pausedDuration
}
```

## watchOS-Specific Patterns

### Extended Runtime Sessions

Background timer budget is ~1 hour:

```swift
class BackgroundManager {
    var extendedSession: WKExtendedRuntimeSession?

    func startExtendedSession() {
        extendedSession = WKExtendedRuntimeSession()
        extendedSession?.delegate = self
        extendedSession?.start()
    }

    func extendedRuntimeSessionWillExpire(_ session: WKExtendedRuntimeSession) {
        saveState()
        scheduleLocalNotification()
    }
}
```

### Battery Optimization

- Check `isLuminanceReduced` -- reduce update frequency when wrist is down
- Use `TimelineSchedule` for adaptive refresh (1Hz active, 10-20s idle)
- Never nest `TabView` on watchOS (memory leaks)
- watchOS freezes apps, doesn't terminate -- memory leaks accumulate across sessions
- Target: glanceable 2-5 second interactions

### Crash Logging

Only 5-10% of watchOS crashes appear in Xcode. Implement local logging sent via `transferUserInfo()` to iPhone.

## Swift Concurrency

### Swift 6 Patterns

```swift
// UI-bound classes: @MainActor
@MainActor @Observable class ViewModel {
    var items: [Item] = []
    func load() async throws {
        items = try await api.fetchItems()
    }
}

// Shared mutable state: actor
actor DataStore {
    private var cache: [String: Data] = [:]
    func get(_ key: String) -> Data? { cache[key] }
    func set(_ key: String, data: Data) { cache[key] = data }
}

// Parallel work: async let
async let profile = fetchProfile()
async let posts = fetchPosts()
let (p, ps) = try await (profile, posts)

// Background processing
nonisolated func processData(_ data: Data) -> Result {
    // Runs off main actor
}
```

### Rules

- All UI code: `@MainActor`
- Heavy CPU: `nonisolated` or `Task.detached`
- Network: `async/await`
- Parallel fetches: `async let` (simple) or `TaskGroup` (dynamic)
- Shared state: `actor`
- Always check `Task.isCancelled` in long work
- Structured concurrency (`TaskGroup`) preferred over unstructured (`Task {}`)
- Use `.task` modifier in views -- auto-cancels on disappear

## iOS-Specific Features

### Live Activities

```swift
struct MyActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var progress: Double
        var label: String
    }
    var name: String
}

// Start
let attributes = MyActivityAttributes(name: "Timer")
let state = MyActivityAttributes.ContentState(progress: 0.5, label: "Working")
let activity = try Activity.request(
    attributes: attributes,
    content: .init(state: state, staleDate: nil)
)

// Update
await activity.update(.init(state: newState, staleDate: nil))

// End
await activity.end(.init(state: finalState, staleDate: nil), dismissalPolicy: .default)
```

### HealthKit Integration

- Request permissions contextually (pre-prompt per Apple HIG)
- Store permission state in UserDefaults
- Graceful degradation if denied
- Use `HKHealthStore` for heart rate, sleep, exercise, meditation

## Navigation

Use `NavigationStack` with type-safe routing:

```swift
enum Route: Hashable {
    case detail(Item)
    case settings
    case profile(userId: String)
}

@Observable class Router {
    var path = NavigationPath()
    func navigate(to route: Route) { path.append(route) }
    func popToRoot() { path = NavigationPath() }
}

struct ContentView: View {
    @State private var router = Router()
    var body: some View {
        NavigationStack(path: $router.path) {
            HomeView()
                .navigationDestination(for: Route.self) { route in
                    switch route {
                    case .detail(let item): DetailView(item: item)
                    case .settings: SettingsView()
                    case .profile(let id): ProfileView(userId: id)
                    }
                }
        }
        .environment(router)
    }
}
```

## Testing Strategy

90% unit tests (milliseconds) / 10% UI tests (critical flows only):

```swift
// Test @Observable model logic
@Test func calculatesCorrectly() {
    let model = BudgetModel(limit: 500)
    model.addExpense(100)
    model.addExpense(200)
    #expect(model.spent == 300)
    #expect(model.remaining == 200)
}

// SwiftData with in-memory container
@Test func persistsSession() throws {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try ModelContainer(for: Session.self, configurations: config)
    let context = container.mainContext
    context.insert(Session(duration: 300))
    try context.save()
    let fetched = try context.fetch(FetchDescriptor<Session>())
    #expect(fetched.count == 1)
}

// Async testing
@Test func loadsItems() async throws {
    let vm = ViewModel(service: MockService())
    await vm.load()
    #expect(vm.items.count == 3)
}
```

### Watch Testing

- Unit test shared logic in Shared package (runs on macOS -- fast)
- XCUITest works for watchOS simulator but is slow/flaky
- Test Watch-specific logic through models, not UI
- Factory helpers for test data: `makeSession(mode: .focus, duration: 300)`

## Performance Checklist

| Issue | Fix |
|-------|-----|
| `@State` with reference types | Use only with value types |
| Expensive computed properties in body | Cache in init or memoize |
| Index-based `ForEach` | Use `Identifiable` with stable IDs |
| ViewModels created in NavigationLink | Create once, inject via environment |
| Missing environment in sheets | Explicitly pass `.environmentObject()` |
| `GeometryReader` overuse | Constrain with `.frame()`, use sparingly |
| watchOS nested TabView | Flat navigation only |
| Ignoring `isLuminanceReduced` | Reduce updates when wrist down |

## Accessibility

- 44pt touch targets (iOS), 38pt (watchOS)
- 4.5:1 contrast ratio minimum
- Dynamic Type support (automatic with `Text`)
- `.accessibilityLabel()` on all non-text interactive elements
- `.accessibilityElement(children: .combine)` for grouped content
- Test with VoiceOver on device (simulator VoiceOver is limited)

## CI/CD & Deployment

### Xcode Cloud (recommended)

Set up via Product > Xcode Cloud > Create Workflow. Handles code signing, certificates, notarization automatically. Custom scripts in `ci_scripts/`.

### Fastlane (alternative)

```ruby
lane :beta do
  match(type: "appstore")
  build_app(scheme: "MyApp", export_method: "app-store")
  upload_to_testflight
end
```

### Code Signing

- Development: Automatic signing
- CI/CD: Manual signing with match-managed profiles, or Xcode Cloud auto
- Single upload deploys both iOS and watchOS to TestFlight
- 90-day TestFlight expiration

## Session Recovery Pattern

For apps with long-running state (timers, workouts):

```swift
func saveActiveSession() {
    UserDefaults.standard.set(session.id.uuidString, forKey: "activeSession_id")
    UserDefaults.standard.set(Date(), forKey: "activeSession_date")
    UserDefaults.standard.set(elapsed, forKey: "activeSession_elapsed")
}

func checkForRecovery() -> RecoverableSession? {
    guard let dateStr = UserDefaults.standard.object(forKey: "activeSession_date") as? Date,
          Date().timeIntervalSince(dateStr) < 5400 // 90min staleness
    else {
        clearRecoveryData()
        return nil
    }
    return RecoverableSession(...)
}
```

## Local Network Sync (Bonjour)

For real-time sync between devices on same WiFi (Mac <-> iPhone):

```swift
// Advertise
let listener = try NWListener(using: .tcp)
listener.service = NWListener.Service(name: "MyApp", type: "_myapp._tcp")
listener.newConnectionHandler = { connection in ... }
listener.start(queue: .main)

// Discover
let browser = NWBrowser(for: .bonjour(type: "_myapp._tcp", domain: nil), using: .tcp)
browser.browseResultsChangedHandler = { results, changes in ... }
browser.start(queue: .main)
```

**Relay architecture**: Mac <-> iPhone (Network Framework) <-> Watch (WCSession). Watch never connects directly to Mac.

## CloudKit + SwiftData

- All `@Model` properties must be optional or have defaults (CloudKit requirement)
- No `#Unique` constraints (unsupported with CloudKit)
- Schema changes must be additive only (lightweight migration)
- Conflict resolution: last-write-wins (Apple default)
- No explicit login needed -- tied to device iCloud account

## Important

- Verify all Apple API signatures against current docs before coding -- APIs change between OS versions
- Check entitlements and Info.plist keys for every capability (HealthKit, Local Network, Live Activities)
- watchOS is NOT a shrunken iPhone -- design for glanceable, 2-5 second interactions
- Test on physical devices for Watch connectivity, HealthKit, and haptics -- simulator is unreliable for these
- Use `#if os(iOS)` / `#if os(watchOS)` / `#if os(macOS)` for platform-specific code, not runtime checks

## Auto-Deploy on Major Commits

For apps in active development, configure auto-push + Xcode Cloud deploy on significant changes.

**Major change triggers:**
- Commit message contains `[deploy]`, `[release]`, or `[major]`
- More than 5 Swift files changed
- Any `Shared/` code changed (affects all platforms)
- Build config changed (`project.yml`, `Info.plist`, `.entitlements`)

**Setup:**
1. Install git post-commit hook (see `${CLAUDE_PLUGIN_ROOT}/references/apple-platform/build-automation.md`)
2. Configure Xcode Cloud workflow: Product > Xcode Cloud > Create Workflow
3. Set trigger: Push to branch (main, develop, feature/*)
4. Actions: Build all schemes > Test > Archive > Deploy to TestFlight (main only)

For Claude Code integration, add a PostToolUse hook to auto-push after `git commit` when major change detected. See `${CLAUDE_PLUGIN_ROOT}/references/apple-platform/build-automation.md` for full configuration.

**Quick validation before deploy:**
```bash
${CLAUDE_PLUGIN_ROOT}/scripts/apple-platform/xcode-validate.sh .
```

## Additional Resources

For detailed patterns and reference material, consult:
- **`${CLAUDE_PLUGIN_ROOT}/references/apple-platform/watch-connectivity.md`** -- WCSession deep dive, channel selection, mirror mode, gotchas
- **`${CLAUDE_PLUGIN_ROOT}/references/apple-platform/performance.md`** -- SwiftUI performance pitfalls, watchOS battery optimization, Instruments usage
- **`${CLAUDE_PLUGIN_ROOT}/references/apple-platform/common-mistakes.md`** -- 22 categorized mistakes with fixes (architecture, SwiftUI, watchOS, concurrency, data)
- **`${CLAUDE_PLUGIN_ROOT}/references/apple-platform/swiftdata-patterns.md`** -- SwiftData vs CoreData decision matrix, CloudKit compatibility, background operations
- **`${CLAUDE_PLUGIN_ROOT}/references/apple-platform/concurrency.md`** -- Swift 6 strict concurrency migration, approachable concurrency (6.2), actor patterns
- **`${CLAUDE_PLUGIN_ROOT}/references/apple-platform/build-automation.md`** -- Auto-deploy on major commits, Xcode Cloud CI scripts, Fastlane lanes, GitHub Actions workflow
- **`${CLAUDE_PLUGIN_ROOT}/references/apple-platform/context-management.md`** -- Context engineering for long iOS dev sessions

Validation and tooling in `${CLAUDE_PLUGIN_ROOT}/scripts/apple-platform/`:
- **`xcode-validate.sh`** -- Project structure validator (directories, plists, entitlements, bundle IDs, anti-patterns)
- **`apple-version-check.sh`** -- Platform version checker (Xcode, Swift, iOS/watchOS/macOS SDK versions, deployment target comparison, feature availability audit)
- **`deploy-testflight.sh`** -- Full deploy pipeline: version bump → xcodegen → build → commit → push → archive → upload to TestFlight

## TestFlight Deploy Pipeline

When the user asks to "deploy", "push to TestFlight", "upload build", or "commit push deploy", run the deploy script:

```bash
# From project root (must have project.yml)
${CLAUDE_PLUGIN_ROOT}/scripts/apple-platform/deploy-testflight.sh [patch|minor|major] ["commit message"]
```

**What it does (6 steps):**
1. Bumps build number (+1) and version (patch/minor/major) in project.yml
2. Runs `xcodegen generate`
3. Builds for simulator to verify (fails fast on errors)
4. Commits all changes + pushes to main
5. Archives for App Store distribution
6. Uploads to TestFlight via ASC API key

**Prerequisites:** project.yml with CURRENT_PROJECT_VERSION and MARKETING_VERSION, xcodegen installed, ASC API key at `~/.private_keys/AuthKey_NTNAA84KU6.p8`.

**For build-loop integration:** Call this script in Phase 8 (Report) or after Phase 5 (Validate) passes for iOS projects. Detect iOS projects by checking for `project.yml` with `platform: iOS`.

## Related Skills

- **ios-design**: HIG fundamentals (navigation, colors, typography, SF Symbols, haptics, materials). What to build — the design rules.
- **ios-design-router**: Archetype classifier and design option catalogs. Routes to domain-specific references for navigation, lists, buttons, color, motion, task economy.
