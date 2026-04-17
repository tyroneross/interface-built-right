# Watch Connectivity Deep Dive

## WCSession Lifecycle

### Setup (Both Sides)

Activate early in app lifecycle. Set delegate BEFORE calling activate.

```swift
class SyncManager: NSObject, WCSessionDelegate {
    static let shared = SyncManager()
    
    func setup() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }
    
    // Required delegate methods
    func session(_ session: WCSession,
        activationDidCompleteWith state: WCSessionActivationState,
        error: Error?) {
        if state == .activated {
            // Safe to send data
        }
    }
    
    // iOS only -- required
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) {
        WCSession.default.activate() // Re-activate after watch switch
    }
}
```

## Channel Deep Dive

### sendMessage -- Real-Time Commands

Best for: timer start/stop, immediate state sync, user-initiated actions.

```swift
// Send (check reachability first)
if WCSession.default.isReachable {
    WCSession.default.sendMessage(
        ["command": "start", "mode": "focus"],
        replyHandler: { reply in
            // Counterpart acknowledged
        },
        errorHandler: { error in
            // Fallback to applicationContext
            self.fallbackToContext(["command": "start", "mode": "focus"])
        }
    )
}

// Receive
func session(_ session: WCSession, didReceiveMessage message: [String: Any],
    replyHandler: @escaping ([String: Any]) -> Void) {
    Task { @MainActor in
        handleCommand(message)
        replyHandler(["status": "ok"])
    }
}
```

**Gotchas:**
- Can wake iPhone app from background, but unreliable for waking Watch
- Fails silently if counterpart app not installed
- Message payloads must be property-list compatible (no custom types)

### updateApplicationContext -- Latest State

Best for: preferences, current mode, display state. Only latest value kept.

```swift
// Send (overwrites previous)
try WCSession.default.updateApplicationContext([
    "mode": "focus",
    "theme": "dark",
    "dailyGoal": 120
])

// Receive
func session(_ session: WCSession,
    didReceiveApplicationContext context: [String: Any]) {
    Task { @MainActor in
        updatePreferences(from: context)
    }
}
```

### transferUserInfo -- Guaranteed Records

Best for: completed session records, analytics events. FIFO queue, survives app termination.

```swift
// Send (queues if not reachable)
WCSession.default.transferUserInfo([
    "type": "session_complete",
    "id": session.id.uuidString,
    "duration": session.duration,
    "mode": session.mode
])

// Receive
func session(_ session: WCSession,
    didReceiveUserInfo userInfo: [String: Any]) {
    Task { @MainActor in
        persistSession(from: userInfo)
    }
}

// Monitor queue
let pending = WCSession.default.outstandingUserInfoTransfers
```

### transferCurrentComplicationUserInfo -- Complication Priority

50/day limit. Same as transferUserInfo but higher delivery priority.

```swift
// Only for complication-relevant data
if WCSession.default.remainingComplicationUserInfoTransfers > 0 {
    WCSession.default.transferCurrentComplicationUserInfo([
        "progress": 0.75,
        "minutesRemaining": 15
    ])
}
```

## Mirror Mode Architecture

When Watch displays iPhone's state without running its own logic:

```swift
@MainActor @Observable
class WatchViewModel {
    // Local timer (watch-owned)
    var localEngine = TimerEngine()
    var isLocalMode = false
    
    // Remote state (from iPhone)
    var remoteState: RemoteTimerState?
    
    // Display logic
    var displayTime: TimeInterval {
        if isLocalMode {
            return localEngine.continuousElapsed()
        }
        guard let remote = remoteState, remote.isRunning else { return 0 }
        // Smooth interpolation via date math
        return Date().timeIntervalSince(remote.startDate) - remote.pausedDuration
    }
    
    // Mode switching
    func startLocal() {
        isLocalMode = true
        localEngine.start()
    }
    
    func onRemoteStateReceived(_ state: RemoteTimerState) {
        remoteState = state
        // Don't clobber local mode
        if !isLocalMode {
            // Update display from remote
        }
    }
    
    func onLocalComplete() {
        isLocalMode = false
        // Send completed session to iPhone
        syncManager.sendCompletedSession(localEngine.session)
    }
}

struct RemoteTimerState: Codable {
    let startDate: Date
    let pausedDuration: TimeInterval
    let isRunning: Bool
    let mode: String
    let phase: String
}
```

## Relay Architecture

For 3+ device sync (Mac + iPhone + Watch):

```
Mac <--[Network Framework/Bonjour]--> iPhone <--[WatchConnectivity]--> Watch
```

iPhone bridges all communication. Watch never connects directly to Mac.

```swift
// iPhone receives from Mac (Bonjour)
func onMacMessage(_ message: TimerState) {
    updateLocalState(message)
    // Forward to Watch
    syncManager.sendToWatch(message.toWatchPayload())
}

// iPhone receives from Watch (WCSession)
func onWatchMessage(_ message: [String: Any]) {
    updateLocalState(message)
    // Forward to Mac
    localNetworkSync.broadcast(message.toMacPayload())
}
```

## Debugging Tips

1. **Check `activationState`** before any send operation
2. **Check `isPaired` and `isWatchAppInstalled`** on iOS side
3. **Log all delegate callbacks** -- many failures are silent
4. **Test with real devices** -- simulator WCSession behavior differs significantly
5. **Version both apps together** -- mismatched versions can disable WCSession
6. **Monitor `outstandingUserInfoTransfers`** for queue backup
