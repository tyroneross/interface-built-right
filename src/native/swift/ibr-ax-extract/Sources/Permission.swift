import ApplicationServices
import Foundation

// MARK: - Accessibility permission: never prompt implicitly, always on request
//
// macOS shows the "Open System Settings" Accessibility dialog every time a
// process calls AXIsProcessTrustedWithOptions with prompt=true while untrusted.
// The one-shot extractor used to do that on every call, and the daemon's
// not-trusted fallback re-spawns the one-shot binary per request, so an
// untrusted host terminal saw the dialog over and over.
//
// Policy:
//   - Every implicit trust check uses prompt=false, so scans never pop dialogs.
//   - An explicit `--request-permission` (only `ibr native:request-permission`
//     passes it) prompts whenever the process is untrusted, and also opens
//     System Settings > Privacy & Security > Accessibility. macOS does not
//     re-show its dialog for an app already listed there but switched off, so
//     the Settings pane is what guarantees the user sees somewhere to act.
//   - ~/.ibr/permissions.json records when the prompt was last shown. It is
//     informational only and never suppresses an explicit request.
//   - Untrusted runs exit with `accessibilityUntrustedExitCode` and a stderr
//     message naming the System Settings path and the request command.

/// Distinct exit code for "Accessibility not granted" (EX_NOPERM).
let accessibilityUntrustedExitCode: Int32 = 77

let requestPermissionCommand = "ibr native:request-permission"

enum AccessibilityPromptDecision: Equatable {
    /// Process is already trusted; proceed.
    case trusted
    /// Show the macOS dialog and open the Accessibility settings pane.
    case prompt
    /// Untrusted; exit without showing any dialog.
    case failWithoutPrompt
}

/// Pure decision: prompt only when untrusted and explicitly requested.
func accessibilityPromptDecision(trusted: Bool, promptRequested: Bool) -> AccessibilityPromptDecision {
    if trusted { return .trusted }
    return promptRequested ? .prompt : .failWithoutPrompt
}

/// System Settings > Privacy & Security > Accessibility.
let accessibilitySettingsURL = "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"

func defaultPermissionRecordURL() -> URL {
    let home = ProcessInfo.processInfo.environment["HOME"].map { URL(fileURLWithPath: $0) }
        ?? FileManager.default.homeDirectoryForCurrentUser
    return home.appendingPathComponent(".ibr").appendingPathComponent("permissions.json")
}

/// The `accessibility.askedAt` timestamp, or nil when no record exists.
/// An unreadable or malformed file counts as "no record".
func accessibilityAskedAt(recordURL: URL) -> String? {
    guard let data = try? Data(contentsOf: recordURL),
          let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
          let entry = root["accessibility"] as? [String: Any],
          let askedAt = entry["askedAt"] as? String else {
        return nil
    }
    return askedAt
}

/// Write `accessibility.askedAt`, preserving any other keys already in the file.
func recordAccessibilityPrompt(recordURL: URL, now: Date = Date()) throws {
    var root: [String: Any] = [:]
    if let data = try? Data(contentsOf: recordURL),
       let existing = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
        root = existing
    }
    let formatter = ISO8601DateFormatter()
    root["accessibility"] = ["askedAt": formatter.string(from: now)]
    try FileManager.default.createDirectory(
        at: recordURL.deletingLastPathComponent(), withIntermediateDirectories: true)
    let data = try JSONSerialization.data(withJSONObject: root, options: [.prettyPrinted, .sortedKeys])
    try data.write(to: recordURL, options: .atomic)
}

private let grantInstruction =
    "Grant Accessibility to the app that launched this command (your terminal or IDE) in " +
    "System Settings > Privacy & Security > Accessibility, then quit and reopen that app and re-run."

func accessibilityUntrustedMessage(askedAt: String?, recordURL: URL) -> String {
    let last = askedAt.map { " IBR last showed the permission prompt at \($0)." } ?? ""
    return "Error: Accessibility permission required.\(last) IBR does not open the macOS permission " +
        "prompt during scans. \(grantInstruction) To open the prompt and the Accessibility settings " +
        "pane: \(requestPermissionCommand)"
}

func accessibilityPromptedMessage(recordURL: URL) -> String {
    return "Accessibility permission required. IBR showed the macOS permission prompt and opened " +
        "System Settings > Privacy & Security > Accessibility. \(grantInstruction)"
}

/// Side-effecting gate used by the one-shot entry point. Returns only when trusted;
/// otherwise writes the stderr message and exits with `accessibilityUntrustedExitCode`.
func requireAccessibilityTrust(
    promptRequested: Bool,
    recordURL: URL = defaultPermissionRecordURL(),
    openSettings: () -> Void = openAccessibilitySettings
) {
    let noPrompt = [kAXTrustedCheckOptionPrompt.takeUnretainedValue(): false] as CFDictionary
    let trusted = AXIsProcessTrustedWithOptions(noPrompt)

    switch accessibilityPromptDecision(trusted: trusted, promptRequested: promptRequested) {
    case .trusted:
        return
    case .failWithoutPrompt:
        fputs(accessibilityUntrustedMessage(askedAt: accessibilityAskedAt(recordURL: recordURL), recordURL: recordURL) + "\n", stderr)
        exit(accessibilityUntrustedExitCode)
    case .prompt:
        do {
            try recordAccessibilityPrompt(recordURL: recordURL)
        } catch {
            fputs("Warning: could not write \(recordURL.path): \(error.localizedDescription)\n", stderr)
        }
        let prompt = [kAXTrustedCheckOptionPrompt.takeUnretainedValue(): true] as CFDictionary
        if AXIsProcessTrustedWithOptions(prompt) { return }
        openSettings()
        fputs(accessibilityPromptedMessage(recordURL: recordURL) + "\n", stderr)
        exit(accessibilityUntrustedExitCode)
    }
}

/// Opens the Accessibility pane of System Settings. Failure is non-fatal: the
/// stderr message still names the path.
func openAccessibilitySettings() {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/open")
    process.arguments = [accessibilitySettingsURL]
    try? process.run()
}
