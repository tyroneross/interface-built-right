import AppKit
import ApplicationServices
import Foundation

// MARK: - Accessibility stress (--stress-steps --pid)
//
// Reads the target's whole AX tree several times per UI state and reports
// whether the app survived. Used to reproduce crashes that only happen when an
// outside client reads labels, e.g. a SwiftUI/AppKit label override that calls
// itself until the main thread's stack overflows.
//
// Unlike the extract walk this has no depth cap (a deep SwiftUI subtree is where
// such loops live) and it also reads AXHelp. Each step is either "walk" (read
// only) or an AXIdentifier to AXPress before reading. Destructive by design:
// it can crash the target, so it only takes an explicit --pid.

/// True while `pid` exists. kill(pid, 0) works without a run loop, unlike
/// NSRunningApplication.isTerminated, which only updates through KVO.
func stressProcessAlive(_ pid: pid_t) -> Bool {
    kill(pid, 0) == 0 || errno == EPERM
}

/// True while the login session's screen is locked. macOS then hides every
/// app's windows from accessibility clients, so a walk reads only menu bars
/// and a "survived" result would prove nothing.
func stressScreenLocked() -> Bool {
    let session = CGSessionCopyCurrentDictionary() as? [String: Any]
    return (session?["CGSSessionScreenIsLocked"] as? Bool) == true
}

/// Number of windows the target exposes to accessibility clients right now.
func stressWindowCount(_ root: AXUIElement) -> Int {
    var windows: CFTypeRef?
    guard AXUIElementCopyAttributeValue(root, kAXWindowsAttribute as CFString, &windows) == .success,
          let list = windows as? [AXUIElement] else { return 0 }
    var role: CFTypeRef?
    return list.filter {
        AXUIElementCopyAttributeValue($0, kAXRoleAttribute as CFString, &role) == .success
            && (role as? String) == kAXWindowRole
    }.count
}

private let stressAttributes: [String] = [
    kAXRoleAttribute, kAXSubroleAttribute, kAXTitleAttribute, kAXDescriptionAttribute,
    kAXHelpAttribute, kAXValueAttribute as String, "AXIdentifier", "AXPlaceholderValue",
]

struct StressWalk {
    var nodes = 0
    var reads = 0
    var failedReads = 0
    var truncated = false
    var found: AXUIElement? = nil
}

/// One full read of the tree. Stops early only at `maxNodes` (reported as truncated).
func stressWalk(root: AXUIElement, findIdentifier: String? = nil, maxNodes: Int) -> StressWalk {
    var walk = StressWalk()
    var pending = [root]
    var seen: [CFHashCode: [AXUIElement]] = [:]
    while let element = pending.popLast() {
        let hash = CFHash(element)
        if seen[hash, default: []].contains(where: { CFEqual($0, element) }) { continue }
        seen[hash, default: []].append(element)
        walk.nodes += 1
        if walk.nodes > maxNodes { walk.truncated = true; break }
        for attribute in stressAttributes {
            var value: CFTypeRef?
            let result = AXUIElementCopyAttributeValue(element, attribute as CFString, &value)
            walk.reads += 1
            // Unsupported/no-value are normal; anything else means the read failed.
            if result != .success && result != .attributeUnsupported && result != .noValue {
                walk.failedReads += 1
            }
            if let findIdentifier, walk.found == nil, attribute == "AXIdentifier",
               result == .success, (value as? String) == findIdentifier {
                walk.found = element
            }
        }
        var children: CFTypeRef?
        if AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &children) == .success,
           let list = children as? [AXUIElement] {
            pending.append(contentsOf: list)
        }
    }
    return walk
}

/// Runs every step and returns a JSON-ready report. `crashed` is set as soon as
/// the target disappears, naming the step and walk that were running.
func runStress(pid: pid_t, steps: [String], walksPerStep: Int, maxNodes: Int, settleSeconds: Double) -> [String: Any] {
    let root = AXUIElementCreateApplication(pid)
    AXUIElementSetMessagingTimeout(root, 2.0)
    var stepReports: [[String: Any]] = []
    var crash: [String: Any]? = nil

    stepLoop: for (index, step) in steps.enumerated() {
        var report: [String: Any] = ["index": index + 1, "step": step]
        guard stressProcessAlive(pid) else {
            crash = ["step": step, "index": index + 1, "phase": "before-step"]
            break
        }
        if step != "walk" {
            let search = stressWalk(root: root, findIdentifier: step, maxNodes: maxNodes)
            if let element = search.found {
                let result = AXUIElementPerformAction(element, kAXPressAction as CFString)
                report["pressed"] = result == .success
                if result != .success { report["pressError"] = Int(result.rawValue) }
            } else {
                report["pressed"] = false
                report["pressError"] = "identifier not found"
            }
            Thread.sleep(forTimeInterval: settleSeconds)
        }
        var walks: [[String: Any]] = []
        for walkIndex in 1...walksPerStep {
            guard stressProcessAlive(pid) else {
                crash = ["step": step, "index": index + 1, "walk": walkIndex, "phase": "walk"]
                report["walks"] = walks
                stepReports.append(report)
                break stepLoop
            }
            let walk = stressWalk(root: root, maxNodes: maxNodes)
            walks.append(["nodes": walk.nodes, "reads": walk.reads,
                          "failedReads": walk.failedReads, "truncated": walk.truncated,
                          "windows": stressWindowCount(root), "screenLocked": stressScreenLocked()])
            Thread.sleep(forTimeInterval: 0.2)
        }
        report["walks"] = walks
        stepReports.append(report)
    }
    if crash == nil, !stressProcessAlive(pid) { crash = ["phase": "after-last-step"] }

    var result: [String: Any] = ["pid": Int(pid), "survived": crash == nil, "steps": stepReports]
    if let crash { result["crash"] = crash }
    return result
}
