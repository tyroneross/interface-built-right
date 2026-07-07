import AppKit
import Foundation

// MARK: - Entry point
//
// Argument parsing + one-shot mode dispatch. All AX element models, helpers,
// walkers, finders and action execution live in AXCore.swift; the layout-fill
// analysis in LayoutFill.swift; the persistent daemon loop in Daemon.swift. Only
// this file holds top-level executable statements (a Swift executable-target
// requirement). Every one-shot flag below is preserved unchanged — the E2-A live
// flag-matrix check pins extract / action / --resolve-app / --analyze-layout.

let args = CommandLine.arguments

// Parse arguments
var deviceName: String? = nil
var targetPid: pid_t? = nil
var targetApp: String? = nil
var resolveApp: String? = nil
var outputMode: String = "auto" // "auto", "legacy", "full"
var actionName: String? = nil
var elementPathStr: String? = nil
var actionValue: String? = nil
var analyzeLayout: Bool = false
var layoutThreshold: Double = 0.12
var daemonMode: Bool = false
var keystrokeChord: String? = nil
var keystrokeForeground: Bool = false

var i = 1
while i < args.count {
    switch args[i] {
    case "--device-name":
        i += 1
        if i < args.count { deviceName = args[i] }
    case "--pid":
        i += 1
        if i < args.count { targetPid = pid_t(args[i]) }
    case "--app":
        i += 1
        if i < args.count { targetApp = args[i] }
    case "--resolve-app":
        i += 1
        if i < args.count { resolveApp = args[i] }
    case "--format":
        i += 1
        if i < args.count { outputMode = args[i] }
    case "--action":
        i += 1
        if i < args.count { actionName = args[i] }
    case "--element-path":
        i += 1
        if i < args.count { elementPathStr = args[i] }  // comma-separated: "0,2,1"
    case "--value":
        i += 1
        if i < args.count { actionValue = args[i] }
    case "--analyze-layout":
        analyzeLayout = true
    case "--layout-threshold":
        i += 1
        if i < args.count, let t = Double(args[i]) { layoutThreshold = t }
    case "--daemon":
        daemonMode = true
    case "--keystroke":
        i += 1
        if i < args.count { keystrokeChord = args[i] }
    case "--foreground":
        keystrokeForeground = true
    default:
        break
    }
    i += 1
}

// --- Mode: Persistent AX daemon (--daemon) ---
// Long-lived JSON-lines server. Handles its own AX-trust probe and exits on EOF.
if daemonMode {
    runDaemon()
    exit(0)
}

// --- Mode: Resolve a running macOS app without AX permission ---
if let appName = resolveApp {
    guard let app = findAppByName(appName) else {
        fputs("Error: No running app found matching \"\(appName)\"\n", stderr)
        exit(1)
    }

    let payload: [String: Any] = [
        "pid": Int(app.processIdentifier),
        "name": app.localizedName ?? "",
        "bundleIdentifier": app.bundleIdentifier ?? ""
    ]
    if let data = try? JSONSerialization.data(withJSONObject: payload),
       let str = String(data: data, encoding: .utf8) {
        print(str)
        exit(0)
    }
    fputs("Error: Failed to encode app resolution JSON\n", stderr)
    exit(1)
}

// Check accessibility permission
let checkOpts = [kAXTrustedCheckOptionPrompt.takeUnretainedValue(): true] as CFDictionary
guard AXIsProcessTrustedWithOptions(checkOpts) else {
    fputs("Error: Accessibility permission required. Grant access in System Settings > Privacy & Security > Accessibility\n", stderr)
    exit(1)
}

let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]

// --- Mode: Keyboard synthesis (--keystroke --pid [--foreground]) ---
// Delivers a chord (e.g. "Meta+n", "Tab", "Escape") to an arbitrary macOS app
// via CGEvent. No --element-path — the chord goes to whatever is focused
// (background: CGEventPostToPid) or frontmost (--foreground: activate + post
// via the global HID tap). See Keyboard.swift for the delivery mechanism.
if let chord = keystrokeChord {
    guard let pid = targetPid else {
        fputs("{\"error\":\"--pid is required for keystroke mode\"}\n", stderr)
        exit(1)
    }
    let (success, error) = deliverKeystroke(pid: pid, chord: chord, foreground: keystrokeForeground)
    var result: [String: Any] = ["success": success, "chord": chord]
    if let error = error {
        result["error"] = error
    }
    if let data = try? JSONSerialization.data(withJSONObject: result),
       let str = String(data: data, encoding: .utf8) {
        print(str)
    }
    exit(success ? 0 : 1)
}

// --- Mode: Action execution (--action --pid --element-path) ---
if let actionName = actionName, let pathStr = elementPathStr {
    guard let pid = targetPid else {
        fputs("{\"error\":\"--pid is required for action mode\"}\n", stderr)
        exit(1)
    }
    let path = pathStr.split(separator: ",").compactMap { Int($0) }
    let (success, error) = performAction(pid: pid, deviceName: deviceName, elementPath: path, action: actionName, value: actionValue)
    var result: [String: Any] = ["success": success, "action": actionName]
    if let error = error {
        result["error"] = error
    }
    if let data = try? JSONSerialization.data(withJSONObject: result),
       let str = String(data: data, encoding: .utf8) {
        print(str)
    }
    exit(success ? 0 : 1)
}

// --- Mode 1: macOS app scanning (--pid or --app) ---
if targetPid != nil || targetApp != nil {
    let pid: pid_t
    if let p = targetPid {
        pid = p
    } else if let appName = targetApp {
        guard let app = findAppByName(appName) else {
            fputs("Error: No running app found matching \"\(appName)\"\n", stderr)
            fputs("Running apps:\n", stderr)
            for app in NSWorkspace.shared.runningApplications where app.activationPolicy == .regular {
                let name = app.localizedName ?? "Unknown"
                let bundle = app.bundleIdentifier ?? "unknown"
                fputs("  \(name) (\(bundle)) pid=\(app.processIdentifier)\n", stderr)
            }
            exit(1)
        }
        pid = app.processIdentifier
    } else {
        fputs("Error: No target specified\n", stderr)
        exit(1)
    }

    guard let windowInfo = findMainWindow(pid: pid) else {
        fputs("Error: No windows found for pid \(pid)\n", stderr)
        exit(1)
    }

    // Print window info header
    let widthInt = Int(windowInfo.size.width)
    let heightInt = Int(windowInfo.size.height)
    print("WINDOW:\(windowInfo.id):\(widthInt)x\(heightInt):\(windowInfo.title)")

    // Walk the accessibility tree with full format, tracking paths from the window root
    guard let rootElement = walkElementFull(windowInfo.window, currentPath: []) else {
        fputs("Error: Failed to walk accessibility tree\n", stderr)
        exit(1)
    }

    // Output children (each child already has its path embedded)
    let output = rootElement.children
    let data = try encoder.encode(output)
    if let json = String(data: data, encoding: .utf8) {
        print(json)
    } else {
        fputs("Error: Failed to encode JSON\n", stderr)
        exit(1)
    }

    // Optional layout-fill / gap analysis. Emitted on stderr as
    // LAYOUT_FINDINGS:<json> so it never corrupts the stdout JSON contract.
    if analyzeLayout {
        let findings = analyzeLayoutFillSwift(output, threshold: layoutThreshold)
        if let fData = try? encoder.encode(findings),
            let fJson = String(data: fData, encoding: .utf8)
        {
            fputs("LAYOUT_FINDINGS:\(fJson)\n", stderr)
        }
    }

    exit(0)
}

// --- Mode 2: Simulator scanning (--device-name or default) ---
guard let simApp = findSimulatorApp() else {
    fputs("Error: Simulator.app is not running\n", stderr)
    exit(1)
}

guard let window = findSimulatorWindow(app: simApp, deviceName: deviceName) else {
    let msg = deviceName != nil
        ? "Error: No simulator window found for device: \(deviceName!)"
        : "Error: No simulator windows found"
    fputs("\(msg)\n", stderr)
    exit(1)
}

// R4: descend past Simulator chrome (Home / Save Screen / Rotate buttons)
// to the embedded iOS app subtree. Without this, the walker returned
// chrome-tree children — the "sim_action reads simulator-chrome AX tree,
// not app content" failure mode from the transcript audit.
let appRoot = findSimulatorAppRoot(window: window)

// Walk the accessibility tree with legacy format
guard let rootElement = walkElementLegacy(appRoot, currentPath: []) else {
    fputs("Error: Failed to walk accessibility tree\n", stderr)
    exit(1)
}

// Output as JSON array (children of the window are the actual UI elements)
let output = rootElement.children
let data = try encoder.encode(output)

if let json = String(data: data, encoding: .utf8) {
    print(json)
} else {
    fputs("Error: Failed to encode JSON\n", stderr)
    exit(1)
}
