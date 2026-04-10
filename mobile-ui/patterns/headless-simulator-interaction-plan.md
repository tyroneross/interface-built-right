# Headless iOS Simulator Interaction

Research and implementation plan for enabling IBR to tap/type/swipe in iOS simulators without a visible window.

## Problem

`xcrun simctl io <udid> tap` does NOT exist. The `simctl io` subcommand only supports: `enumerate`, `poll`, `recordVideo`, `screenshot`. This means IBR's `sim_action` tool cannot interact with simulators headlessly.

**What works headless:**
- `xcrun simctl io <udid> screenshot` — captures without visible window
- `ibr-ax-extract` — reads accessibility tree without visible window
- `native_scan`, `native_snapshot`, `native_compare` — all headless

**What requires visible window:**
- Tap, type, swipe, scroll — all interaction

## Root Cause

The simulator's touch input is injected via **IndigoHID** (Apple's private HID event system). The current fallback chain in IBR:

```
IDB CLI (not installed) → xcrun simctl io tap (doesn't exist) → AppleScript (needs visible window) → FAIL
```

## Recommended Solution: `ibr-sim-touch` Swift CLI

A ~200-line Swift CLI that uses CoreSimulator's private `IndigoHID` API — the same API Simulator.app uses internally.

### Architecture

```
ibr-sim-touch --tap 200 400 --udid <udid>
    │
    ├─ dlopen("/Library/Developer/PrivateFrameworks/CoreSimulator.framework")
    ├─ NSClassFromString("SimServiceContext") → get default service
    ├─ SimDeviceSet.defaultSet → find device by UDID
    ├─ SimDeviceLegacyHIDClient(device:) → get HID client
    └─ Send IndigoHID digitizer message (touch-down → 50ms delay → touch-up)
```

### Commands

| Command | Action |
|---|---|
| `--tap <x> <y> --udid <udid>` | Touch-down + touch-up at (x,y) in point coordinates |
| `--type <text> --udid <udid>` | Keyboard HID events for each character |
| `--swipe <x1> <y1> <x2> <y2> --duration <ms> --udid <udid>` | Interpolated touch-move sequence |
| `--button <HOME\|LOCK> --udid <udid>` | Hardware button press |

### Swift Package Structure

```
src/native/swift/ibr-sim-touch/
├── Package.swift          # Links CoreSimulator via unsafeFlags
└── Sources/
    └── main.swift         # dlopen, HID client, touch injection
```

### Integration into IBR

New fallback chain:
```
ibr-sim-touch → IDB CLI → (fail with install hint)
```

Modify `src/native/idb.ts`:
- `idbTap()` — try `ibr-sim-touch --tap` first
- `idbType()` — try `ibr-sim-touch --type` first
- `idbSwipe()` — try `ibr-sim-touch --swipe` first

Add `ensureSimTouch()` to compile on first use (same pattern as `ensureExtractor()` for `ibr-ax-extract`).

### Key Symbols Found in SimulatorKit

```
SimDeviceLegacyHIDClient
  - send(message:)
IndigoHIDMessageForButton
IndigoHIDMessageForKeyboardNSEvent
SimDigitizerInputView.TouchEvent
IndigoHIDMessageForHIDArbitrary
```

These are stable since Xcode 11 and used by IDB, Appium, and Detox internally.

### Risks

1. **Private framework** — Apple could change API. Mitigation: `dlopen` with graceful fallback.
2. **Message format** — IndigoHID struct layout not publicly documented. Stable since Xcode 11.
3. **Coordinate space** — AX coordinates are in host window space, not guest point space. Verify with display scale factor.
4. **Xcode dependency** — Requires Command Line Tools. Same as existing `ibr-ax-extract`.

### Files to Create/Modify

| File | Change |
|---|---|
| **NEW** `src/native/swift/ibr-sim-touch/Package.swift` | Swift package linking CoreSimulator |
| **NEW** `src/native/swift/ibr-sim-touch/Sources/main.swift` | CoreSimulator dlopen, HID injection |
| **MODIFY** `src/native/idb.ts` | Add ibr-sim-touch as primary fallback |
| **NEW/MODIFY** `src/native/sim-touch.ts` | `ensureSimTouch()` compilation/caching |
| **MODIFY** `src/mcp/tools.ts` | Better error diagnostics in handleSimAction |

### Alternative: XCUITest Bridge

If IndigoHID proves unreliable, fallback is a minimal XCUITest runner app:
- Install a test runner on the simulator
- Accept commands via local socket
- Execute XCUITest actions (tap, type, swipe)
- Heavier setup but more robust long-term

## Status

Research complete. Implementation not yet started. This is planned as an IBR enhancement, not a SpeakSavvy-specific feature.
