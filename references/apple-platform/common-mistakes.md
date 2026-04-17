# Common Mistakes in iOS/watchOS Development

## Architecture Mistakes

### 1. Treating Watch as a Shrunken iPhone
Watch is a glanceable device. Design for 2-5 second interactions, not full app experiences. Simplify navigation, reduce data density, prioritize the single most important piece of information.

### 2. Over-Engineering with ViewModels
In SwiftUI with `@Query` and `@Observable`, views often ARE the view model. Don't create wrapper VMs that just proxy data. Reserve VMs for complex business logic that doesn't belong in the view.

### 3. Not Sharing Code via Swift Package
Duplicating logic across iOS and watchOS targets leads to drift. Extract shared models, services, and utilities into a local Swift Package with both targets as dependents.

### 4. No Platform Abstraction
Embedding `#if os()` throughout business logic. Use the delegate pattern -- core engine has zero platform imports, platform-specific behavior injected through delegates.

## SwiftUI Mistakes

### 5. @State with Reference Types
Causes instance recreation every render. 40-60% memory improvement by using @State only with value types. Use @Observable for reference types.

### 6. Index-Based ForEach
`ForEach(0..<items.count, id: \.self)` causes O(n^2) diffing and broken animations. Use `Identifiable` conformance with stable IDs.

### 7. Missing Environment in Sheets/Popovers
Environment doesn't auto-propagate. Explicitly pass `.environment()` and `.modelContainer()` to presented views.

### 8. onAppear Firing Multiple Times
Don't assume `onAppear` fires once. Use `.task` for async work -- it auto-cancels on disappear and handles the lifecycle correctly.

### 9. Creating ViewModels in NavigationLink
Each navigation push creates a new VM. 5-10MB memory growth per push. Create once, inject via environment or pass data, not VMs.

## watchOS-Specific Mistakes

### 10. Nesting TabView
Causes memory leaks on watchOS. Use flat navigation only.

### 11. Ignoring isLuminanceReduced
Drains battery when wrist is down. Check `@Environment(\.isLuminanceReduced)` and reduce update frequency.

### 12. Not Handling Workout/Session Recovery
`handleActiveWorkoutRecovery` doesn't fire after reboot. Check in `applicationDidFinishLaunching` for orphaned sessions.

### 13. Relying on Xcode Crash Reports
Only 5-10% of watchOS crashes appear. Implement local logging sent to iPhone via `transferUserInfo()`.

### 14. Ignoring Complication Update Limits
Only 50 `transferCurrentComplicationUserInfo` calls per day. Budget carefully and use applicationContext for non-critical updates.

### 15. Assuming Apps Restart Cleanly
watchOS freezes apps rather than terminating. Memory leaks accumulate silently across sessions. Use Instruments to profile long-running state.

## Concurrency Mistakes

### 16. Not Migrating to Swift 6 Strict Concurrency
Data races are now compile-time errors. Migrate incrementally: `StrictConcurrency` from `minimal` -> `targeted` -> `complete`.

### 17. Unstructured Task Everywhere
`Task {}` scattered throughout code creates unmanageable concurrency. Prefer `TaskGroup` for parallel work, `.task` modifier for view-scoped async.

### 18. Forgetting @MainActor on UI Code
Swift 6.2 defaults help, but explicit `@MainActor` annotation on Observable classes and view models makes intent clear and prevents regressions.

## Data Mistakes

### 19. #Unique Constraints with CloudKit
Unsupported. Causes silent failures. Remove all `#Unique` from models synced via CloudKit.

### 20. Direct Relationship Access in CloudKit Apps
SwiftData relationships don't refresh on CloudKit silent push. Use `@Query` with predicates for reactive updates instead of `model.relationship`.

### 21. Background ModelContext Without @ModelActor
Accessing `ModelContext` from multiple threads without `@ModelActor` causes crashes or data corruption.

### 22. Non-Additive Schema Migrations
CloudKit requires additive-only schema changes. All new properties must be optional or have defaults. Never remove or rename columns in production.
