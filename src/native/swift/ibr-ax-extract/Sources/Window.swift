import AppKit
import Foundation

struct WindowResizeSpec: Decodable {
    let width: Double
    let height: Double
    let windowTitle: String?
    var isValid: Bool { width.isFinite && height.isFinite && width >= 1 && height >= 1 && width <= 16384 && height <= 16384 }
}

// Exact title matching includes the empty title. Omission requires one window.
func resizeWindowMatches(titles: [String], title: String?) -> [Int] {
    titles.indices.filter { title == nil || titles[$0] == title! }
}

private func resizeFrame(_ window: AXUIElement) -> [String: Double]? {
    var posRaw: CFTypeRef?
    var sizeRaw: CFTypeRef?
    guard AXUIElementCopyAttributeValue(window, kAXPositionAttribute as CFString, &posRaw) == .success,
          AXUIElementCopyAttributeValue(window, kAXSizeAttribute as CFString, &sizeRaw) == .success,
          let posRaw, let sizeRaw,
          CFGetTypeID(posRaw) == AXValueGetTypeID(), CFGetTypeID(sizeRaw) == AXValueGetTypeID() else { return nil }
    let pos = posRaw as! AXValue
    let size = sizeRaw as! AXValue
    guard AXValueGetType(pos) == .cgPoint, AXValueGetType(size) == .cgSize else { return nil }
    var point = CGPoint.zero
    var dimensions = CGSize.zero
    guard AXValueGetValue(pos, .cgPoint, &point), AXValueGetValue(size, .cgSize, &dimensions),
          point.x.isFinite, point.y.isFinite, dimensions.width.isFinite, dimensions.height.isFinite,
          dimensions.width > 0, dimensions.height > 0 else { return nil }
    return ["x": point.x, "y": point.y, "width": dimensions.width, "height": dimensions.height]
}

/// Retains one AX reference through the write and bounded readback. Never activates or moves the cursor.
func resizeNativeWindow(pid: pid_t, value: String?) -> [String: Any] {
    var result: [String: Any] = ["success": false, "action": "resizeWindow"]
    func failure(_ message: String) -> [String: Any] {
        result["error"] = message
        return result
    }
    guard pid > 0, let value, let data = value.data(using: .utf8),
          let spec = try? JSONDecoder().decode(WindowResizeSpec.self, from: data), spec.isValid else {
        return failure("resizeWindow requires finite width/height in 1...16384 outer window points")
    }
    let app = AXUIElementCreateApplication(pid)
    var raw: CFTypeRef?
    guard AXUIElementCopyAttributeValue(app, kAXWindowsAttribute as CFString, &raw) == .success,
          let all = raw as? [AXUIElement] else { return failure("Cannot enumerate windows for exact PID \(pid)") }
    var windows: [AXUIElement] = []
    for candidate in all {
        guard let role = getStringAttribute(candidate, kAXRoleAttribute) else {
            return failure("A window role is unavailable; cannot establish unique selection")
        }
        if role == kAXWindowRole { windows.append(candidate) }
    }
    var titles: [String] = []
    for candidate in windows {
        guard let title = getStringAttribute(candidate, kAXTitleAttribute) else {
            return failure("A window title is unavailable; cannot safely select an exact window")
        }
        titles.append(title)
    }
    let matches = resizeWindowMatches(titles: titles, title: spec.windowTitle)
    guard matches.count == 1 else { return failure("Expected exactly one matching AXWindow; found \(matches.count). Supply an exact unique windowTitle.") }
    let window = windows[matches[0]]
    let title = titles[matches[0]]
    var selectedPid: pid_t = 0
    guard AXUIElementGetPid(window, &selectedPid) == .success, selectedPid == pid else {
        return failure("Selected AXWindow PID does not match the exact session PID; no resize sent")
    }
    guard let before = resizeFrame(window) else { return failure("Cannot read selected window bounds; no resize sent") }
    var evidence: [String: Any] = ["pid": Int(selectedPid), "windowTitle": title,
                                 "requested": ["width": spec.width, "height": spec.height],
                                 "before": before, "tolerance": 0.5]
    result["resizeWindow"] = evidence
    var settable: DarwinBoolean = false
    guard AXUIElementIsAttributeSettable(window, kAXSizeAttribute as CFString, &settable) == .success, settable.boolValue else {
        return failure("Selected window does not expose settable AXSize")
    }
    var requested = CGSize(width: spec.width, height: spec.height)
    guard let size = AXValueCreate(.cgSize, &requested) else { return failure("Cannot encode requested AXSize") }
    let write = AXUIElementSetAttributeValue(window, kAXSizeAttribute as CFString, size)
    // A failed write can still have an uncertain effect. Always report the same reference's readback.
    for _ in 0..<12 {
        guard let actual = resizeFrame(window) else { return failure("Selected window disappeared or readback failed after resize; do not replay blindly") }
        evidence["actual"] = actual
        result["resizeWindow"] = evidence
        if write == .success && abs(actual["width"]! - spec.width) <= 0.5 && abs(actual["height"]! - spec.height) <= 0.5 {
            result["success"] = true
            return result
        }
        Thread.sleep(forTimeInterval: 0.05)
    }
    return failure("Requested size was not observed (AX error \(write.rawValue)); app constraints or clamping may apply")
}
