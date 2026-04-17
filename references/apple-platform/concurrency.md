# Swift Concurrency Guide

## Swift 6 Strict Concurrency

Swift 6 enforces complete concurrency checking at compile time -- all data races are errors.

### Migration Path

```
// Build Settings
SWIFT_STRICT_CONCURRENCY = minimal    // Step 1: start here
SWIFT_STRICT_CONCURRENCY = targeted   // Step 2: warnings become errors for new code
SWIFT_STRICT_CONCURRENCY = complete   // Step 3: full enforcement
```

For third-party libraries not yet updated:
```swift
@preconcurrency import SomeLibrary
```

## Swift 6.2 Approachable Concurrency

### Default Actor Isolation Changes

Swift 6.2 makes `@MainActor` the default isolation for most code:

```swift
// Swift 6.2 -- this is implicitly @MainActor
func updateUI() {
    label.text = "Hello"  // Safe -- on main actor by default
}

// Opt out explicitly for background work
nonisolated func processData(_ data: Data) -> Result {
    // Runs on caller's executor
}

// Explicit parallelism
@concurrent func heavyComputation(_ input: Data) async -> Output {
    // Runs on cooperative thread pool
}
```

### New Defaults
- Code runs on main thread unless explicitly opted out
- `nonisolated(nonsending)` is the new default for async functions
- Use `@concurrent` to opt into parallelism
- New projects get this automatically; existing projects opt in per-feature

## Core Patterns

### @MainActor for UI-Bound Code

```swift
@MainActor @Observable
class ViewModel {
    var items: [Item] = []
    var isLoading = false
    
    func load() async throws {
        isLoading = true
        defer { isLoading = false }
        items = try await api.fetchItems()
        // Already on MainActor -- UI update safe
    }
}
```

### Actor for Shared Mutable State

```swift
actor DataStore {
    private var cache: [String: Data] = [:]
    
    func get(_ key: String) -> Data? {
        cache[key]
    }
    
    func set(_ key: String, data: Data) {
        cache[key] = data
    }
    
    // Nonisolated for Sendable-safe reads
    nonisolated var isEmpty: Bool {
        // Can't access cache here -- use async method instead
        false
    }
}

// Usage -- always await actor methods
let store = DataStore()
await store.set("key", data: someData)
let data = await store.get("key")
```

### TaskGroup for Dynamic Parallel Work

```swift
func loadAllProfiles(ids: [String]) async throws -> [Profile] {
    try await withThrowingTaskGroup(of: Profile.self) { group in
        for id in ids {
            group.addTask {
                try await fetchProfile(id)
            }
        }
        return try await group.reduce(into: []) { $0.append($1) }
    }
}
```

### async let for Static Parallel Decomposition

```swift
func loadDashboard() async throws -> Dashboard {
    async let profile = fetchProfile()
    async let stats = fetchStats()
    async let notifications = fetchNotifications()
    
    return try await Dashboard(
        profile: profile,
        stats: stats,
        notifications: notifications
    )
}
```

### .task Modifier in Views

```swift
struct ItemListView: View {
    @State private var items: [Item] = []
    
    var body: some View {
        List(items) { item in ItemRow(item: item) }
            .task {
                // Auto-cancels on disappear
                do {
                    items = try await loadItems()
                } catch {
                    // Handle error
                }
            }
            .task(id: searchQuery) {
                // Re-runs when searchQuery changes
                // Previous task auto-cancelled
                items = try? await search(searchQuery)
            }
    }
}
```

## Sendable Compliance

```swift
// Value types are naturally Sendable
struct UserData: Sendable {
    let name: String
    let id: UUID
}

// Classes need explicit conformance
final class Config: Sendable {
    let apiKey: String  // All stored properties must be let or Sendable
    let baseURL: URL
    
    init(apiKey: String, baseURL: URL) {
        self.apiKey = apiKey
        self.baseURL = baseURL
    }
}

// Use @unchecked Sendable as last resort
final class LegacyCache: @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [String: Any] = [:]
    
    func get(_ key: String) -> Any? {
        lock.lock()
        defer { lock.unlock() }
        return storage[key]
    }
}
```

## Cancellation

```swift
func processLargeDataset(_ items: [Item]) async throws -> [Result] {
    var results: [Result] = []
    
    for item in items {
        // Check cancellation in loops
        try Task.checkCancellation()
        
        let result = try await process(item)
        results.append(result)
    }
    
    return results
}

// Or check without throwing
func backgroundSync() async {
    while !Task.isCancelled {
        await syncBatch()
        try? await Task.sleep(for: .seconds(30))
    }
}
```

## Rules of Thumb

| Scenario | Pattern |
|----------|---------|
| UI updates | `@MainActor` |
| Heavy CPU work | `nonisolated` or `@concurrent` |
| Network calls | `async/await` |
| Simple parallel (2-3 items) | `async let` |
| Dynamic parallel (N items) | `TaskGroup` |
| Shared mutable state | `actor` |
| View-scoped async | `.task` modifier |
| Long-running work | Check `Task.isCancelled` |
| Structured > Unstructured | Prefer `TaskGroup` over `Task {}` |

## Anti-Patterns

```swift
// BAD -- unstructured tasks scattered everywhere
func viewDidLoad() {
    Task { await loadA() }
    Task { await loadB() }
    Task { await loadC() }
    // No way to cancel all, no error handling
}

// GOOD -- structured concurrency
func viewDidLoad() {
    task = Task {
        async let a = loadA()
        async let b = loadB()
        async let c = loadC()
        let (ra, rb, rc) = try await (a, b, c)
        updateUI(ra, rb, rc)
    }
}

// BAD -- blocking main thread
func loadData() {
    let data = URLSession.shared.data(from: url)  // Synchronous!
}

// GOOD -- async
func loadData() async throws {
    let (data, _) = try await URLSession.shared.data(from: url)
}

// BAD -- Task.detached when not needed
Task.detached { @MainActor in
    self.items = try await self.fetch()
}

// GOOD -- regular Task inherits actor context
Task {
    items = try await fetch()  // Inherits @MainActor from enclosing scope
}
```
