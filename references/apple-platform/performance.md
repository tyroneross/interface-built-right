# Performance Guide

## SwiftUI Performance Pitfalls

### 1. @State with Reference Types

**Problem:** Causes instance recreation on every render. 40-60% memory improvement by fixing.

```swift
// BAD -- reference type with @State
@State private var viewModel = ViewModel()  // ViewModel is a class

// GOOD -- @State for value types only
@State private var count = 0
@State private var items: [Item] = []

// GOOD -- @Observable class via @State (iOS 17+)
// This works because @Observable uses a different observation mechanism
@State private var vm = ViewModel()  // where ViewModel has @Observable
```

### 2. Expensive Computed Properties in View Body

**Problem:** Run every render cycle.

```swift
// BAD -- recomputes on every render
var body: some View {
    let sorted = items.sorted { $0.score > $1.score }  // O(n log n) per render
    List(sorted) { ... }
}

// GOOD -- cache in model
@Observable class Model {
    var items: [Item] = [] {
        didSet { sortedItems = items.sorted { $0.score > $1.score } }
    }
    private(set) var sortedItems: [Item] = []
}
```

### 3. Index-Based ForEach

**Problem:** O(n^2) diffing, broken animations, identity confusion.

```swift
// BAD
ForEach(0..<items.count, id: \.self) { i in ItemRow(items[i]) }

// GOOD
ForEach(items) { item in ItemRow(item) }  // Item: Identifiable with stable ID
```

### 4. ViewModels Created in NavigationLink

**Problem:** 5-10MB memory growth per navigation push.

```swift
// BAD -- new VM created every time view appears in list
NavigationLink { DetailView(vm: DetailViewModel(item: item)) }

// GOOD -- create once, pass data
NavigationLink(value: item) { ItemRow(item) }
.navigationDestination(for: Item.self) { item in
    DetailView(item: item)  // View creates its own state internally
}
```

### 5. Missing Environment in Sheets

**Problem:** Crashes, missing data. Environment doesn't auto-propagate to sheets/popovers.

```swift
// BAD -- sheet loses environment
.sheet(isPresented: $showSettings) {
    SettingsView()  // Missing environment objects
}

// GOOD
.sheet(isPresented: $showSettings) {
    SettingsView()
        .environment(appState)
        .modelContainer(container)
}
```

### 6. GeometryReader Overuse

**Problem:** Recalculates every layout pass, consumes all available space.

```swift
// BAD -- GeometryReader for simple sizing
GeometryReader { geo in
    Text("Hello").frame(width: geo.size.width * 0.8)
}

// GOOD -- use relative sizing
Text("Hello").frame(maxWidth: .infinity).padding(.horizontal)
```

## watchOS Battery Optimization

### Luminance Reduction

```swift
@Environment(\.isLuminanceReduced) var isLuminanceReduced

var body: some View {
    if isLuminanceReduced {
        // Minimal updates -- static content, dim colors
        StaticTimerView(time: displayTime)
    } else {
        // Full animation, color, updates
        AnimatedTimerView(time: displayTime)
    }
}
```

### Adaptive Refresh

```swift
// Use TimelineView for controlled refresh rates
TimelineView(.animation(minimumInterval: isActive ? 1.0 : 20.0)) { timeline in
    TimerDisplay(time: computeTime(at: timeline.date))
}
```

### Memory Leak Prevention

watchOS freezes apps rather than terminating. Leaks accumulate silently.

```swift
// BAD -- nested TabView leaks memory
TabView {
    TabView { ... }  // NEVER nest on watchOS
}

// BAD -- strong reference cycles in closures
timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
    self.update()  // Strong capture
}

// GOOD
timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
    self?.update()
}
```

### Battery Budget

- Target 12+ hours battery life
- Reduce computation when `isLuminanceReduced`
- Use event-driven updates, not polling
- Minimize WCSession transfers to essential data
- Extended runtime sessions: ~1 hour budget, save state before expiry

## Instruments Profiling

### Key Instruments for SwiftUI

1. **SwiftUI Instrument** (Xcode 26): View body evaluation count, identity tracking
2. **Time Profiler**: CPU-heavy view bodies
3. **Allocations**: Memory leaks from retained views/VMs
4. **Memory Graph Debugger**: Reference cycle detection
5. **Energy Log**: Battery impact (especially watchOS)

### What to Measure

- View body evaluation count (should be minimal)
- Time in `.body` getter (should be <16ms for 60fps)
- Memory growth during navigation (should stabilize)
- Energy impact during idle states (should be near-zero)
