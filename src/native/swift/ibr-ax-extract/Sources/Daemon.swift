import AppKit
import Foundation

// MARK: - Persistent AX Daemon (E2-A)
//
// `--daemon` mode: a long-lived process that holds the AX connection in-process
// and serves many extract / action / resolve requests over stdio, eliminating
// the per-call binary respawn (a 5-step flow was ≥10 spawns; with the daemon it
// is ≤1). Protocol is JSON-lines: one request object per stdin line, one
// response object per stdout line.
//
// Request:   {"id": <any>, "op": "extract"|"action"|"resolve"|"ping", ...}
// Response:  {"id": <any>, "ok": true, "result": {...}}  |  {"id": <any>, "ok": false, "error": "..."}
//
// Orphan contract: the daemon reads from stdin and exits when readLine() returns
// nil (EOF). When the Node parent dies — normal exit OR SIGKILL — the write end
// of the stdin pipe closes, EOF fires, and the daemon exits. It never outlives
// its parent. (Verified live in the E2-A spike.)

private let daemonEncoder: JSONEncoder = {
    let e = JSONEncoder()
    e.outputFormatting = [.sortedKeys]
    return e
}()

private func emitLine(_ obj: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: obj, options: []),
       let str = String(data: data, encoding: .utf8) {
        print(str)
    } else {
        print("{\"ok\":false,\"error\":\"response encode failure\"}")
    }
    // Flush so the parent sees each response immediately (line-buffered stdio
    // is not guaranteed when stdout is a pipe).
    fflush(stdout)
}

/// Encode a Codable value to a Foundation JSON object ([Any]/[String:Any]) so it
/// can be nested inside a response dict without double-encoding.
private func encodeToJSONObject<T: Encodable>(_ value: T) -> Any? {
    guard let data = try? daemonEncoder.encode(value) else { return nil }
    return try? JSONSerialization.jsonObject(with: data, options: [])
}

func runDaemon() {
    // Probe AX trust once at startup WITHOUT prompting (prompt:false). Report it
    // in the ready line so the parent can decide whether to fall back. A daemon
    // must never trigger an interactive TCC prompt.
    let opts = [kAXTrustedCheckOptionPrompt.takeUnretainedValue(): false] as CFDictionary
    let trusted = AXIsProcessTrustedWithOptions(opts)
    emitLine([
        "type": "ready",
        "trusted": trusted,
        "pid": Int(ProcessInfo.processInfo.processIdentifier),
    ])

    while let line = readLine(strippingNewline: true) {
        let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { continue }
        emitLine(handleDaemonRequest(trimmed))
    }
    // EOF on stdin → parent gone → exit cleanly.
}

private func handleDaemonRequest(_ line: String) -> [String: Any] {
    guard let data = line.data(using: .utf8),
          let req = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else {
        return ["ok": false, "error": "malformed request (not a JSON object)"]
    }

    let op = req["op"] as? String ?? ""
    var response: [String: Any]
    switch op {
    case "ping":
        response = ["ok": true, "result": ["pong": true]]
    case "resolve":
        response = daemonResolve(req)
    case "extract":
        response = daemonExtract(req)
    case "action":
        response = daemonAction(req)
    case "keystroke":
        response = daemonKeystroke(req)
    default:
        response = ["ok": false, "error": "unknown op: \(op)"]
    }
    // Echo the correlation id back verbatim.
    if let id = req["id"] { response["id"] = id }
    return response
}

/// resolve — return the target's main-window metadata (id/size/title) without a
/// full tree walk. Used for macOS screenshot capture (Node needs the CGWindowID).
private func daemonResolve(_ req: [String: Any]) -> [String: Any] {
    guard let target = req["target"] as? [String: Any] else {
        return ["ok": false, "error": "resolve requires target"]
    }
    guard (target["kind"] as? String) == "macos",
          let pid = (target["pid"] as? NSNumber)?.int32Value else {
        return ["ok": false, "error": "resolve supports macos targets with a pid only"]
    }
    guard let info = findMainWindow(pid: pid) else {
        return ["ok": false, "error": "No windows found for pid \(pid)"]
    }
    return ["ok": true, "result": [
        "window": [
            "windowId": Int(info.id),
            "width": Int(info.size.width),
            "height": Int(info.size.height),
            "title": info.title,
        ],
    ]]
}

private func daemonExtract(_ req: [String: Any]) -> [String: Any] {
    guard let target = req["target"] as? [String: Any], let kind = target["kind"] as? String else {
        return ["ok": false, "error": "extract requires target.kind"]
    }

    if kind == "macos" {
        guard let pid = (target["pid"] as? NSNumber)?.int32Value else {
            return ["ok": false, "error": "macos extract requires target.pid"]
        }
        guard let windowInfo = findMainWindow(pid: pid) else {
            return ["ok": false, "error": "No windows found for pid \(pid)"]
        }
        guard let rootElement = walkElementFull(windowInfo.window, currentPath: []) else {
            return ["ok": false, "error": "Failed to walk accessibility tree"]
        }
        guard let elementsObj = encodeToJSONObject(rootElement.children) else {
            return ["ok": false, "error": "Failed to encode elements"]
        }
        return ["ok": true, "result": [
            "kind": "macos",
            "window": [
                "windowId": Int(windowInfo.id),
                "width": Int(windowInfo.size.width),
                "height": Int(windowInfo.size.height),
                "title": windowInfo.title,
            ],
            "elements": elementsObj,
        ]]
    }

    if kind == "simulator" {
        let deviceName = target["deviceName"] as? String
        guard let simApp = findSimulatorApp() else {
            return ["ok": false, "error": "Simulator.app is not running"]
        }
        guard let window = findSimulatorWindow(app: simApp, deviceName: deviceName) else {
            let msg = deviceName != nil
                ? "No simulator window found for device: \(deviceName!)"
                : "No simulator windows found"
            return ["ok": false, "error": msg]
        }
        let appRoot = findSimulatorAppRoot(window: window)
        guard let rootElement = walkElementLegacy(appRoot, currentPath: []) else {
            return ["ok": false, "error": "Failed to walk accessibility tree"]
        }
        guard let elementsObj = encodeToJSONObject(rootElement.children) else {
            return ["ok": false, "error": "Failed to encode elements"]
        }
        return ["ok": true, "result": ["kind": "simulator", "elements": elementsObj]]
    }

    return ["ok": false, "error": "unknown target kind: \(kind)"]
}

private func daemonAction(_ req: [String: Any]) -> [String: Any] {
    guard let target = req["target"] as? [String: Any], let kind = target["kind"] as? String else {
        return ["ok": false, "error": "action requires target.kind"]
    }
    guard let action = req["action"] as? String else {
        return ["ok": false, "error": "action requires an action name"]
    }
    let value = req["value"] as? String
    let path = (req["elementPath"] as? [Any])?.compactMap { ($0 as? NSNumber)?.intValue } ?? []

    var pid: pid_t
    var deviceName: String? = nil
    if kind == "macos" {
        guard let p = (target["pid"] as? NSNumber)?.int32Value else {
            return ["ok": false, "error": "macos action requires target.pid"]
        }
        pid = p
    } else if kind == "simulator" {
        guard let p = (target["pid"] as? NSNumber)?.int32Value else {
            return ["ok": false, "error": "simulator action requires target.pid"]
        }
        pid = p
        deviceName = target["deviceName"] as? String
    } else {
        return ["ok": false, "error": "unknown target kind: \(kind)"]
    }

    let (success, error) = performAction(
        pid: pid, deviceName: deviceName, elementPath: path, action: action, value: value
    )
    // Mirror the one-shot contract: an AX action that fails is a structured
    // result (success:false), not a protocol error (ok stays true).
    var result: [String: Any] = ["success": success, "action": action]
    if let error = error { result["error"] = error }
    return ["ok": true, "result": result]
}

/// keystroke (E2-B) — deliver a chord to the target pid via CGEvent synthesis.
/// Mirrors `daemonAction`'s contract: a delivery failure (bad chord, no such
/// app) is a structured result (success:false), not a protocol error.
private func daemonKeystroke(_ req: [String: Any]) -> [String: Any] {
    guard let target = req["target"] as? [String: Any] else {
        return ["ok": false, "error": "keystroke requires target"]
    }
    guard let pid = (target["pid"] as? NSNumber)?.int32Value else {
        return ["ok": false, "error": "keystroke requires target.pid"]
    }
    guard let chord = req["chord"] as? String else {
        return ["ok": false, "error": "keystroke requires chord"]
    }
    let foreground = (req["foreground"] as? NSNumber)?.boolValue ?? false

    let (success, error) = deliverKeystroke(pid: pid, chord: chord, foreground: foreground)
    var result: [String: Any] = ["success": success]
    if let error = error { result["error"] = error }
    return ["ok": true, "result": result]
}

