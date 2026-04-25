import AppKit
import Foundation

enum DriverError: Error, CustomStringConvertible {
    case usage(String)
    case simulatorNotRunning
    case accessibilityPermission
    case windowNotFound(String)
    case windowOccluded(point: CGPoint, occludingApp: String)
    case windowOffScreen(CGRect)
    case eventCreationFailed
    case commandFailed(String)

    var description: String {
        switch self {
        case .usage(let message):
            return message
        case .simulatorNotRunning:
            return "Simulator.app is not running"
        case .accessibilityPermission:
            return "Accessibility permission required. Grant access in System Settings > Privacy & Security > Accessibility."
        case .windowNotFound(let target):
            return "No Simulator window found for \(target)"
        case .windowOccluded(let point, let occludingApp):
            return "Simulator window is occluded at host point (\(Int(point.x)),\(Int(point.y))) by '\(occludingApp)'. Bring Simulator to the front and uncover the target area."
        case .windowOffScreen(let frame):
            return "Simulator window is off-screen or zero-sized: \(frame)"
        case .eventCreationFailed:
            return "Failed to create native input event"
        case .commandFailed(let message):
            return message
        }
    }
}

struct SimctlDevices: Decodable {
    let devices: [String: [SimctlDevice]]
}

struct SimctlDevice: Decodable {
    let udid: String
    let name: String
}

struct WindowInfo {
    let title: String
    let bounds: CGRect
}

struct Command {
    let name: String
    let udid: String
    let values: [String]
    let duration: Double?
}

let version = "1.0.0"
let simulatorBundleIdentifier = "com.apple.iphonesimulator"

func usage() -> String {
    """
    Usage:
      ibr-sim-driver --version
      ibr-sim-driver tap --udid <UDID> <x> <y>
      ibr-sim-driver swipe --udid <UDID> <x1> <y1> <x2> <y2> [--duration <seconds>]
      ibr-sim-driver type --udid <UDID> <text>

    Coordinates are auto-detected:
      - absolute screen points when inside the Simulator window bounds
      - Simulator-window-relative points otherwise
    """
}

func parseCommand(_ args: [String]) throws -> Command {
    guard args.count >= 2 else { throw DriverError.usage(usage()) }

    if args[1] == "--version" {
        print(version)
        exit(0)
    }
    if args[1] == "--help" || args[1] == "-h" || args[1] == "help" {
        throw DriverError.usage(usage())
    }

    let name = args[1]
    var udid: String?
    var values: [String] = []
    var duration: Double?

    var index = 2
    while index < args.count {
        let arg = args[index]
        switch arg {
        case "--udid":
            index += 1
            guard index < args.count else { throw DriverError.usage("--udid requires a value") }
            udid = args[index]
        case "--duration":
            index += 1
            guard index < args.count, let parsed = Double(args[index]) else {
                throw DriverError.usage("--duration requires a numeric value")
            }
            duration = parsed
        default:
            values.append(arg)
        }
        index += 1
    }

    guard let udid else { throw DriverError.usage("--udid is required") }
    return Command(name: name, udid: udid, values: values, duration: duration)
}

func runProcess(_ launchPath: String, _ arguments: [String]) throws -> Data {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: launchPath)
    process.arguments = arguments

    let output = Pipe()
    let error = Pipe()
    process.standardOutput = output
    process.standardError = error

    try process.run()
    process.waitUntilExit()

    let data = output.fileHandleForReading.readDataToEndOfFile()
    if process.terminationStatus != 0 {
        let stderr = String(data: error.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        throw DriverError.commandFailed(stderr?.isEmpty == false ? stderr! : "Command failed: \(launchPath)")
    }
    return data
}

func deviceName(for udid: String) -> String? {
    guard let data = try? runProcess("/usr/bin/xcrun", ["simctl", "list", "devices", "--json"]),
          let decoded = try? JSONDecoder().decode(SimctlDevices.self, from: data) else {
        return nil
    }

    let needle = udid.lowercased()
    for devices in decoded.devices.values {
        if let match = devices.first(where: { $0.udid.lowercased() == needle }) {
            return match.name
        }
    }
    return nil
}

func checkAccessibilityPermission() throws {
    let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
    guard AXIsProcessTrustedWithOptions(options) else {
        throw DriverError.accessibilityPermission
    }
}

func activateSimulator() throws -> NSRunningApplication {
    let apps = NSWorkspace.shared.runningApplications.filter {
        $0.bundleIdentifier == simulatorBundleIdentifier
    }
    guard let app = apps.first else { throw DriverError.simulatorNotRunning }
    _ = app.activate(options: [.activateIgnoringOtherApps, .activateAllWindows])
    usleep(120_000)
    return app
}

func simulatorWindows(for app: NSRunningApplication) -> [WindowInfo] {
    let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
    guard let list = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
        return []
    }

    return list.compactMap { info -> WindowInfo? in
        guard let ownerPid = info[kCGWindowOwnerPID as String] as? pid_t,
              ownerPid == app.processIdentifier,
              let boundsDict = info[kCGWindowBounds as String] as? [String: Any],
              let bounds = CGRect(dictionaryRepresentation: boundsDict as CFDictionary) else {
            return nil
        }
        let title = (info[kCGWindowName as String] as? String) ?? ""
        return WindowInfo(title: title, bounds: bounds)
    }
}

func findSimulatorWindow(app: NSRunningApplication, udid: String) throws -> WindowInfo {
    let windows = simulatorWindows(for: app)
    let name = deviceName(for: udid)

    if let name,
       let exact = windows.first(where: { $0.title.localizedCaseInsensitiveContains(name) }) {
        return exact
    }

    if windows.count == 1, let only = windows.first {
        return only
    }

    if let first = windows.first {
        return first
    }

    throw DriverError.windowNotFound(name ?? udid)
}

func parseDouble(_ value: String, label: String) throws -> Double {
    guard let parsed = Double(value) else {
        throw DriverError.usage("\(label) must be numeric")
    }
    return parsed
}

func resolvePoint(x: Double, y: Double, in window: WindowInfo) -> CGPoint {
    let point = CGPoint(x: x, y: y)
    if window.bounds.contains(point) {
        return point
    }
    return CGPoint(x: window.bounds.minX + x, y: window.bounds.minY + y)
}

/// Returns (ownerPID, ownerName) of the topmost on-screen window covering the point,
/// or nil if no window covers it.
func topmostWindow(at point: CGPoint) -> (pid: pid_t, name: String)? {
    let opts: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
    guard let list = CGWindowListCopyWindowInfo(opts, kCGNullWindowID) as? [[String: Any]] else {
        return nil
    }
    // Front-to-back order. The first window whose bounds contain the point owns that pixel.
    for info in list {
        guard let boundsDict = info[kCGWindowBounds as String] as? [String: Any],
              let bounds = CGRect(dictionaryRepresentation: boundsDict as CFDictionary),
              bounds.contains(point) else { continue }
        let pid = (info[kCGWindowOwnerPID as String] as? pid_t) ?? -1
        let name = (info[kCGWindowOwnerName as String] as? String) ?? "(unknown)"
        return (pid, name)
    }
    return nil
}

/// Verify the simulator window is actually showing at the target point. CGEvent.post
/// always succeeds — we have to verify visibility ourselves to avoid lying to callers.
func ensureVisible(window: WindowInfo, at point: CGPoint, simulatorPid: pid_t) throws {
    if window.bounds.width <= 0 || window.bounds.height <= 0 {
        throw DriverError.windowOffScreen(window.bounds)
    }
    // Window must be on at least one screen.
    let onAnyScreen = NSScreen.screens.contains { $0.frame.intersects(window.bounds) }
    guard onAnyScreen else { throw DriverError.windowOffScreen(window.bounds) }
    // The pixel under the target must belong to the simulator process.
    guard let owner = topmostWindow(at: point) else {
        throw DriverError.windowOccluded(point: point, occludingApp: "(no window)")
    }
    if owner.pid != simulatorPid {
        throw DriverError.windowOccluded(point: point, occludingApp: owner.name)
    }
}

func postMouse(_ type: CGEventType, at point: CGPoint) throws {
    let source = CGEventSource(stateID: .hidSystemState)
    guard let event = CGEvent(mouseEventSource: source, mouseType: type, mouseCursorPosition: point, mouseButton: .left) else {
        throw DriverError.eventCreationFailed
    }
    event.post(tap: .cghidEventTap)
}

func tap(window: WindowInfo, x: Double, y: Double, simulatorPid: pid_t) throws {
    let point = resolvePoint(x: x, y: y, in: window)
    try ensureVisible(window: window, at: point, simulatorPid: simulatorPid)
    try postMouse(.leftMouseDown, at: point)
    usleep(45_000)
    try postMouse(.leftMouseUp, at: point)
}

func swipe(window: WindowInfo, x1: Double, y1: Double, x2: Double, y2: Double, duration: Double, simulatorPid: pid_t) throws {
    let start = resolvePoint(x: x1, y: y1, in: window)
    let end = resolvePoint(x: x2, y: y2, in: window)
    // Verify both endpoints. A swipe whose start is occluded won't register at all.
    try ensureVisible(window: window, at: start, simulatorPid: simulatorPid)
    try ensureVisible(window: window, at: end, simulatorPid: simulatorPid)
    let source = CGEventSource(stateID: .hidSystemState)
    let steps = max(4, min(60, Int(duration * 60)))
    let delay = useconds_t(max(0.005, duration / Double(steps)) * 1_000_000)

    guard let down = CGEvent(mouseEventSource: source, mouseType: .leftMouseDown, mouseCursorPosition: start, mouseButton: .left) else {
        throw DriverError.eventCreationFailed
    }
    down.post(tap: .cghidEventTap)

    for step in 1...steps {
        let progress = Double(step) / Double(steps)
        let point = CGPoint(
            x: start.x + (end.x - start.x) * progress,
            y: start.y + (end.y - start.y) * progress
        )
        guard let drag = CGEvent(mouseEventSource: source, mouseType: .leftMouseDragged, mouseCursorPosition: point, mouseButton: .left) else {
            throw DriverError.eventCreationFailed
        }
        drag.post(tap: .cghidEventTap)
        usleep(delay)
    }

    guard let up = CGEvent(mouseEventSource: source, mouseType: .leftMouseUp, mouseCursorPosition: end, mouseButton: .left) else {
        throw DriverError.eventCreationFailed
    }
    up.post(tap: .cghidEventTap)
}

func postKey(keyCode: CGKeyCode, flags: CGEventFlags = [], down: Bool) throws {
    let source = CGEventSource(stateID: .hidSystemState)
    guard let event = CGEvent(keyboardEventSource: source, virtualKey: keyCode, keyDown: down) else {
        throw DriverError.eventCreationFailed
    }
    event.flags = flags
    event.post(tap: .cghidEventTap)
}

func typeText(_ text: String) throws {
    let pasteboard = NSPasteboard.general
    let previous = pasteboard.string(forType: .string)

    pasteboard.clearContents()
    pasteboard.setString(text, forType: .string)

    // Virtual key 9 is "v" on the Apple ANSI keyboard layout.
    try postKey(keyCode: 9, flags: .maskCommand, down: true)
    try postKey(keyCode: 9, flags: .maskCommand, down: false)
    usleep(250_000)

    pasteboard.clearContents()
    if let previous {
        pasteboard.setString(previous, forType: .string)
    }
}

func printSuccess(action: String) {
    print("{\"success\":true,\"action\":\"\(action)\"}")
}

do {
    let command = try parseCommand(CommandLine.arguments)
    try checkAccessibilityPermission()
    let app = try activateSimulator()
    let window = try findSimulatorWindow(app: app, udid: command.udid)

    switch command.name {
    case "tap":
        guard command.values.count == 2 else { throw DriverError.usage("tap requires <x> <y>") }
        let x = try parseDouble(command.values[0], label: "x")
        let y = try parseDouble(command.values[1], label: "y")
        try tap(window: window, x: x, y: y, simulatorPid: app.processIdentifier)
        printSuccess(action: "tap")

    case "swipe":
        guard command.values.count == 4 else { throw DriverError.usage("swipe requires <x1> <y1> <x2> <y2>") }
        let x1 = try parseDouble(command.values[0], label: "x1")
        let y1 = try parseDouble(command.values[1], label: "y1")
        let x2 = try parseDouble(command.values[2], label: "x2")
        let y2 = try parseDouble(command.values[3], label: "y2")
        try swipe(window: window, x1: x1, y1: y1, x2: x2, y2: y2, duration: command.duration ?? 0.3, simulatorPid: app.processIdentifier)
        printSuccess(action: "swipe")

    case "type":
        guard !command.values.isEmpty else { throw DriverError.usage("type requires <text>") }
        try typeText(command.values.joined(separator: " "))
        printSuccess(action: "type")

    default:
        throw DriverError.usage("Unknown command: \(command.name)\n\(usage())")
    }
} catch DriverError.usage(let message) {
    fputs("\(message)\n", stderr)
    exit(message == usage() ? 0 : 2)
} catch let error as DriverError {
    let reason: String = {
        switch error {
        case .windowOccluded: return "window_occluded"
        case .windowOffScreen: return "window_off_screen"
        case .windowNotFound: return "window_not_found"
        case .accessibilityPermission: return "accessibility_permission"
        case .simulatorNotRunning: return "simulator_not_running"
        case .eventCreationFailed: return "event_creation_failed"
        case .commandFailed: return "command_failed"
        case .usage: return "usage"
        }
    }()
    let escaped = String(describing: error).replacingOccurrences(of: "\"", with: "\\\"")
    print("{\"success\":false,\"reason\":\"\(reason)\",\"error\":\"\(escaped)\"}")
    fputs("\(error)\n", stderr)
    exit(1)
} catch {
    fputs("\(error)\n", stderr)
    exit(1)
}
