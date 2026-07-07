import AppKit
import Foundation

// MARK: - Keyboard Synthesis (E2-B)
//
// CGEvent-based keyboard delivery to arbitrary macOS apps: chords (Cmd/Ctrl/Opt/
// Shift + key) and named keys (Tab, Escape, Return, arrows, ...). Two delivery
// modes, selected by the caller (Node `backend.ts` / `keyboard.ts`):
//   - background (`foreground: false`): `CGEventPostToPid` — targets a specific
//     pid without stealing focus. `CGEventPostToPid` has no return value (like
//     `CGEvent.post`, it is fire-and-forget — see the sim-driver's
//     `ensureVisible` comment on the same limitation for mouse events), and
//     Apple's own developer forums document apps that ignore or misroute
//     events posted this way. This file does not attempt to verify delivery —
//     the Node caller verifies the observable AX effect and retries in
//     foreground mode when background delivery produces no change.
//   - foreground (`foreground: true`): activate the target app (mirrors the
//     sim-driver's `activateSimulator()`, generalized here from a hardcoded
//     `com.apple.iphonesimulator` bundle id to an arbitrary pid), then post via
//     the global HID event tap (`.cghidEventTap`) — the same mechanism the
//     sim-driver's `postKey`/`typeText` already use for the simulator.
//
// This file only exposes the raw delivery primitive (`deliverKeystroke`) plus
// chord parsing; retry policy and effect validation live in Node (E2-B's
// feedback-loop contract is a TypeScript type — `ActionOutcome` — so it is
// built there, not here).

struct ChordSpec {
    let keyCode: CGKeyCode
    let flags: CGEventFlags
}

/// Named-key -> virtual keycode table. Values are Apple's stable ANSI-US
/// HIToolbox/Carbon `kVK_*` constants (unchanged across macOS releases).
private let namedKeyCodes: [String: CGKeyCode] = [
    "tab": 0x30,
    "escape": 0x35, "esc": 0x35,
    "return": 0x24, "enter": 0x24,
    "space": 0x31,
    "delete": 0x33, "backspace": 0x33,
    "forwarddelete": 0x75,
    "up": 0x7E, "arrowup": 0x7E,
    "down": 0x7D, "arrowdown": 0x7D,
    "left": 0x7B, "arrowleft": 0x7B,
    "right": 0x7C, "arrowright": 0x7C,
    "home": 0x73, "end": 0x77,
    "pageup": 0x74, "pagedown": 0x79,
    "f1": 0x7A, "f2": 0x78, "f3": 0x63, "f4": 0x76, "f5": 0x60, "f6": 0x61,
    "f7": 0x62, "f8": 0x64, "f9": 0x65, "f10": 0x6D, "f11": 0x67, "f12": 0x6F,
]

/// Single-character -> virtual keycode table (ANSI-US layout: letters, digits,
/// common punctuation). Same `kVK_*` constant family as `namedKeyCodes`.
private let characterKeyCodes: [Character: CGKeyCode] = [
    "a": 0x00, "s": 0x01, "d": 0x02, "f": 0x03, "h": 0x04, "g": 0x05,
    "z": 0x06, "x": 0x07, "c": 0x08, "v": 0x09, "b": 0x0B, "q": 0x0C,
    "w": 0x0D, "e": 0x0E, "r": 0x0F, "y": 0x10, "t": 0x11,
    "1": 0x12, "2": 0x13, "3": 0x14, "4": 0x15, "6": 0x16, "5": 0x17,
    "=": 0x18, "9": 0x19, "7": 0x1A, "-": 0x1B, "8": 0x1C, "0": 0x1D,
    "]": 0x1E, "o": 0x1F, "u": 0x20, "[": 0x21, "i": 0x22, "p": 0x23,
    "l": 0x25, "j": 0x26, "'": 0x27, "k": 0x28, ";": 0x29, "\\": 0x2A,
    ",": 0x2B, "/": 0x2C, "n": 0x2D, "m": 0x2E, ".": 0x2F, "`": 0x32,
]

/// Parse a chord string in `Modifier+Modifier+Key` form (e.g. "Meta+n",
/// "Ctrl+Shift+p", "Tab", "Escape") into a keycode + `CGEventFlags`.
/// Case-insensitive on both modifier and key tokens. Returns `nil` for an
/// unrecognized modifier or key token rather than guessing.
func parseChord(_ chord: String) -> ChordSpec? {
    let tokens = chord.split(separator: "+").map { $0.trimmingCharacters(in: .whitespaces) }
    guard let keyToken = tokens.last, !keyToken.isEmpty else { return nil }
    let modifierTokens = tokens.dropLast()

    var flags: CGEventFlags = []
    for token in modifierTokens {
        switch token.lowercased() {
        case "cmd", "command", "meta": flags.insert(.maskCommand)
        case "ctrl", "control": flags.insert(.maskControl)
        case "opt", "option", "alt": flags.insert(.maskAlternate)
        case "shift": flags.insert(.maskShift)
        case "fn", "function": flags.insert(.maskSecondaryFn)
        default: return nil
        }
    }

    let keyLower = keyToken.lowercased()
    if let named = namedKeyCodes[keyLower] {
        return ChordSpec(keyCode: named, flags: flags)
    }
    if keyToken.count == 1, let ch = keyLower.first, let code = characterKeyCodes[ch] {
        return ChordSpec(keyCode: code, flags: flags)
    }
    return nil
}

/// Post a single key event (down or up) with the given flags directly to
/// `pid` — background delivery, does not steal focus.
private func postKeyToPid(_ pid: pid_t, keyCode: CGKeyCode, flags: CGEventFlags, down: Bool) -> Bool {
    let source = CGEventSource(stateID: .hidSystemState)
    guard let event = CGEvent(keyboardEventSource: source, virtualKey: keyCode, keyDown: down) else {
        return false
    }
    event.flags = flags
    event.postToPid(pid)
    return true
}

/// Post a single key event (down or up) with the given flags via the global
/// HID tap — foreground delivery, lands on whichever app is frontmost.
private func postKeyGlobal(keyCode: CGKeyCode, flags: CGEventFlags, down: Bool) -> Bool {
    let source = CGEventSource(stateID: .hidSystemState)
    guard let event = CGEvent(keyboardEventSource: source, virtualKey: keyCode, keyDown: down) else {
        return false
    }
    event.flags = flags
    event.post(tap: .cghidEventTap)
    return true
}

/// Activate (foreground) the app owning `pid`. Mirrors the sim-driver's
/// `activateSimulator()`, generalized from a hardcoded bundle id to any pid.
private func activateApp(pid: pid_t) -> Bool {
    guard let app = findAppByPid(pid) else { return false }
    let ok = app.activate(options: [.activateIgnoringOtherApps])
    usleep(150_000)
    return ok
}

/// Deliver a chord to `pid`. `foreground` selects the delivery mode:
///   - `false` (default): `CGEventPostToPid` — background, no focus steal.
///   - `true`: activate the target app, then post via the global HID tap.
///
/// Returns `(success, error)`. `success` means "the key-down/key-up events
/// were constructed and posted" — it does NOT assert the target app reacted.
/// The Node caller verifies the observable effect via an AX before/after diff
/// and re-invokes this with `foreground: true` when the first attempt
/// produces no observable change.
func deliverKeystroke(pid: pid_t, chord: String, foreground: Bool) -> (Bool, String?) {
    guard let spec = parseChord(chord) else {
        return (false, "Unable to parse chord: \(chord)")
    }

    if foreground {
        guard activateApp(pid: pid) else {
            return (false, "No running application found for pid \(pid)")
        }
        guard postKeyGlobal(keyCode: spec.keyCode, flags: spec.flags, down: true) else {
            return (false, "Failed to create keyboard event for chord: \(chord)")
        }
        usleep(20_000)
        guard postKeyGlobal(keyCode: spec.keyCode, flags: spec.flags, down: false) else {
            return (false, "Failed to create key-up event for chord: \(chord)")
        }
        return (true, nil)
    }

    guard postKeyToPid(pid, keyCode: spec.keyCode, flags: spec.flags, down: true) else {
        return (false, "Failed to create keyboard event for chord: \(chord)")
    }
    usleep(20_000)
    guard postKeyToPid(pid, keyCode: spec.keyCode, flags: spec.flags, down: false) else {
        return (false, "Failed to create key-up event for chord: \(chord)")
    }
    return (true, nil)
}
