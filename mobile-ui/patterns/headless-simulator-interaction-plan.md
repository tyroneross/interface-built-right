# Native iOS Simulator Interaction

Plan and implementation notes for making IBR's simulator testing capability meet
or exceed Meta IDB for mobile testing.

## Status (2026-04-25)

**Current branch shipped a native fallback, not IDB parity.** The bundled
`ibr-sim-driver` is now wired into the TypeScript action path, but it is a
`native-window` backend: AppKit locates the visible Simulator.app window and
CoreGraphics posts mouse/keyboard events at host-screen coordinates.

This is useful because it removes the broken `simctl io tap/swipe` fallback and
lets local users tap/type/swipe without installing IDB. It does **not** meet the
IDB bar because it is not headless simulator HID injection.

| Backend | Bundled | Headless | Actions | Status |
|---|---:|---:|---|---|
| `native-hid` | Yes | Yes | tap/type/swipe/buttons/AX target | Planned IDB-parity backend |
| `native-window` | Yes | No | tap/type/swipe | Implemented fallback |
| `idb` | No | Yes | tap/type/swipe/buttons/AX | External fallback |
| `simctl` | No | Yes | openUrl/screenshots | Supported where simctl has APIs |

### Implemented in this branch

- Added `mobile-ui/sim-driver/` Swift package.
- Added `src/native/sim-driver.ts` to find/build/cache the Swift binary.
- Updated `src/native/idb.ts` so tap/type/swipe use:

```text
native-window -> IDB -> clear failure
```

- Removed the non-existent `xcrun simctl io <udid> tap` and
  `xcrun simctl io <udid> swipe` fallbacks.
- Removed the fragile AppleScript typing fallback.
- Added `IBR_SIMULATOR_DRIVER` override:

```text
IBR_SIMULATOR_DRIVER=auto          # default
IBR_SIMULATOR_DRIVER=idb           # force IDB in headless CI
IBR_SIMULATOR_DRIVER=native-window # force bundled visible-window fallback
IBR_SIMULATOR_DRIVER=native-hid    # reserved for IDB-parity backend
```

## Problem

`xcrun simctl io <udid> tap` and `xcrun simctl io <udid> swipe` do not exist.
`simctl io` supports screenshot/video style operations, not touch injection.

That leaves three valid interaction paths:

1. **IDB-class HID injection** through CoreSimulator/SimulatorKit private APIs.
2. **XCUITest-driven interaction** through a prebuilt test runner bundle.
3. **Host-window event posting** through macOS Accessibility and CGEvent.

Only the first two are headless enough for robust CI. The third is a local
developer fallback.

## IDB-Parity Target

The IBR-native target is a capability-aware simulator driver layer:

```text
sim_action
  -> driver selector
    -> native-hid       # bundled, headless, IDB-class
    -> native-window    # bundled, visible Simulator fallback
    -> idb              # external compatibility fallback
    -> clear failure
```

To meet or exceed IDB, `native-hid` must cover:

- Tap, long press, swipe, scroll, and drag gestures.
- Text input without pasteboard/AppleScript dependence.
- Hardware buttons where CoreSimulator exposes a stable path.
- Full accessibility extraction with interactive traits preserved.
- JSON diagnostics that identify backend, coordinate space, and failure cause.
- Xcode-version smoke tests because private framework surfaces move.

## Phase 2: `native-hid` Backend

Implementation target: add a second bundled binary, tentatively
`ibr-sim-hid`, using private CoreSimulator/SimulatorKit APIs with runtime
loading and graceful fallback.

Expected shape:

```text
mobile-ui/sim-driver/
  Package.swift
  Sources/
    NativeWindowDriver/main.swift  # current CGEvent fallback
    NativeHIDDriver/main.swift     # CoreSimulator/SimulatorKit backend
```

Backend steps:

1. Resolve the target `SimDevice` from UDID via `SimServiceContext` and the
   default device set.
2. Load SimulatorKit dynamically and instantiate
   `SimulatorKit.SimDeviceLegacyHIDClient`.
3. Generate Indigo HID payloads for tap, swipe, keyboard text, and buttons.
4. Emit compact JSON results matching the current `IdbActionResult` shape.
5. Keep `native-window` and IDB as fallback paths when private APIs fail.

Key symbols found while auditing IDB and SimulatorKit:

```text
SimServiceContext
SimDeviceSet
SimDevice
SimulatorKit.SimDeviceLegacyHIDClient
IndigoHIDMessageForMouseNSEvent
IndigoHIDMessageForKeyboardArbitrary
IndigoHIDMessageForButton
```

Risk: this is a private API surface. The mitigation is a tiny backend boundary,
runtime symbol checks, precise failure diagnostics, and per-Xcode smoke tests.

## Phase 3: Full-Fidelity Scan Path

For scan fidelity that exceeds IDB's basic accessibility dumps, ship an
optional `IBRScanner.xctest` bundle:

- Launch against the app under test with `xcrun xctest`.
- Extract XCTest accessibility elements and interaction availability.
- Capture performance signals such as launch time, scroll responsiveness, CPU,
  and memory where available.
- Fall back to the current AXUIElement extractor when the bundle is absent.

This path is heavier than HID injection, but it gives IBR a way to exceed IDB on
semantic scan quality and diagnostics.

## Current Driver Constraints

`native-window` constraints:

- macOS only.
- Requires Accessibility permission for the calling process.
- Requires a visible Simulator.app window.
- Coordinates are resolved against the Simulator window, not the simulator HID
  port.

`idb` constraints:

- Requires external installation of `idb_companion` and `fb-idb`.
- Still valuable as a headless compatibility fallback until `native-hid` ships.

`simctl` constraints:

- Good for screenshots and URLs.
- Not an interaction driver for tap/swipe.

## Done Criteria

IBR meets the IDB mobile testing bar when:

- `sim_action tap/type/swipe/home` works headlessly on a booted simulator without
  installing IDB.
- `native_scan` returns interactive SwiftUI controls with useful traits instead
  of `0 interactive` for common apps.
- Driver results identify the backend used and provide actionable failure
  diagnostics.
- Smoke tests cover at least the active Xcode release and the previous major
  release.
