# SwiftData Patterns

## SwiftData vs Core Data Decision Matrix

| Factor | SwiftData | Core Data |
|--------|-----------|-----------|
| New projects (iOS 17+) | **Recommended** | Legacy |
| Complex migrations | Limited (additive only) | Full support (mapping models) |
| Raw performance (2025) | Slower | Faster |
| CloudKit sync | Works (no #Unique) | Mature, battle-tested |
| Background operations | @ModelActor | NSPersistentContainer |
| Xcode Previews | In-memory container (easy) | More setup |
| SwiftUI integration | Native (@Query, @Model) | Requires wrappers |
| Existing Core Data apps | Migrate incrementally | Keep and maintain |

**Recommendation:** SwiftData for new projects targeting iOS 17+. Keep Core Data for existing apps or if you need complex migrations.

## Model Definition

```swift
@Model class Session {
    // All properties must be optional or have defaults for CloudKit
    var id: UUID = UUID()
    var startDate: Date = Date()
    var duration: Int = 0
    var mode: String = "focus"
    var quality: Int?                    // Optional for CloudKit
    var notes: String = ""               // Default for CloudKit
    var deviceType: String = "iphone"
    
    // Relationships
    @Relationship(deleteRule: .cascade)
    var entries: [Entry] = []
    
    // Computed properties work fine
    var durationMinutes: Double { Double(duration) / 60.0 }
    
    // NO #Unique with CloudKit -- causes silent failures
    // @Attribute(.unique) var externalId: String  // DON'T DO THIS
}
```

## Container Setup

```swift
@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(for: [Session.self, Entry.self])
    }
}

// Custom configuration
let config = ModelConfiguration(
    "MyStore",
    schema: Schema([Session.self, Entry.self]),
    isStoredInMemoryOnly: false,
    cloudKitDatabase: .automatic  // or .private, .none
)
let container = try ModelContainer(
    for: Session.self, Entry.self,
    configurations: config
)
```

## Query Patterns

### Basic @Query in Views

```swift
struct SessionListView: View {
    // View IS the view model -- no separate VM needed
    @Query(sort: \Session.startDate, order: .reverse)
    private var sessions: [Session]
    
    @Environment(\.modelContext) private var context
    
    var body: some View {
        List(sessions) { session in
            SessionRow(session: session)
        }
    }
}
```

### Dynamic Queries

```swift
struct FilteredSessionList: View {
    @Query private var sessions: [Session]
    
    init(mode: String, minDuration: Int) {
        _sessions = Query(
            filter: #Predicate<Session> {
                $0.mode == mode && $0.duration >= minDuration
            },
            sort: [SortDescriptor(\Session.startDate, order: .reverse)]
        )
    }
}
```

### Aggregations

```swift
struct StatsView: View {
    @Query private var sessions: [Session]
    
    var totalMinutes: Int {
        sessions.reduce(0) { $0 + $1.duration } / 60
    }
    
    var averageQuality: Double {
        let rated = sessions.compactMap(\.quality)
        guard !rated.isEmpty else { return 0 }
        return Double(rated.reduce(0, +)) / Double(rated.count)
    }
}
```

## Background Operations

```swift
@ModelActor
actor SessionProcessor {
    func importSessions(_ data: [SessionData]) throws {
        for item in data {
            let session = Session()
            session.duration = item.duration
            session.mode = item.mode
            session.startDate = item.startDate
            modelContext.insert(session)
        }
        try modelContext.save()
    }
    
    func deleteOldSessions(before date: Date) throws {
        let predicate = #Predicate<Session> { $0.startDate < date }
        try modelContext.delete(model: Session.self, where: predicate)
        try modelContext.save()
    }
}

// Usage
let processor = SessionProcessor(modelContainer: container)
try await processor.importSessions(data)
```

## CloudKit Compatibility Rules

1. **All properties optional or defaulted** -- CloudKit can't enforce required fields
2. **No #Unique constraints** -- unsupported, causes silent failures
3. **Additive-only migrations** -- never remove/rename columns in production
4. **Don't access relationships directly** for reactive UI -- use @Query with predicates
5. **Conflict resolution is last-write-wins** -- Apple default, can't customize
6. **No explicit login needed** -- tied to device iCloud account
7. **Test offline behavior** -- CloudKit sync is eventually consistent

## Testing with In-Memory Store

```swift
@Test func sessionPersistence() throws {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try ModelContainer(
        for: Session.self,
        configurations: config
    )
    let context = container.mainContext
    
    let session = Session()
    session.duration = 300
    session.mode = "focus"
    context.insert(session)
    try context.save()
    
    let fetched = try context.fetch(FetchDescriptor<Session>())
    #expect(fetched.count == 1)
    #expect(fetched.first?.duration == 300)
}
```

## Alternative: Direct SQLite

For maximum control and performance (no CloudKit needed):

```swift
// Custom C module wrapper (like FloDoro's CSQLite pattern)
// project.yml or Package.swift:
//   SWIFT_INCLUDE_PATHS: $(SRCROOT)/CSQLite
//   OTHER_LDFLAGS: ["-lsqlite3"]

import CSQLite

class DatabaseManager {
    private var db: OpaquePointer?
    
    func open(path: String) throws {
        guard sqlite3_open_v2(path, &db,
            SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_WAL,
            nil) == SQLITE_OK else {
            throw DatabaseError.openFailed
        }
    }
    
    // WAL mode for crash safety
    func enableWAL() {
        sqlite3_exec(db, "PRAGMA journal_mode=WAL", nil, nil, nil)
    }
}
```

Use direct SQLite when: maximum performance needed, no CloudKit requirement, full migration control desired, watchOS with limited resources.
