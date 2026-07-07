// Pointer-injection drag (E-DRAG, opt-in only).
//
// The native session surface is cursor-free by default: AX actions do not move
// the host cursor. Some interactions — dragging a split/inspector divider — have
// no AX equivalent (the divider exposes no settable AXValue and no
// increment/decrement action). This module provides a CGEvent-synthesized left
// drag for exactly those cases. It is NOT cursor-free: it activates the target
// app and posts via the global HID tap, so the real cursor moves.
//
// The Node caller gates this behind IBR_ALLOW_POINTER_INJECTION so the default
// stance (hover/doubleClick/rightClick are refused as pointer-style injection)
// holds for unflagged callers. See session-controller.ts mapSessionActionToNative.

import Foundation
import CoreGraphics
import AppKit

/// Synthesize a left-button drag from `start` to `end` in global screen
/// coordinates (top-left origin — matches kAXPosition and CGEvent cursor
/// coordinates). Foreground delivery: activates the target app and posts via the
/// global HID tap, so the real cursor moves. Returns (success, error); success
/// means the events were constructed and posted, not that the app reacted — the
/// Node caller verifies the observable effect via an AX before/after diff.
func performMouseDrag(pid: pid_t, from start: CGPoint, to end: CGPoint, steps: Int = 20) -> (Bool, String?) {
    guard let app = findAppByPid(pid) else { return (false, "no running app for pid \(pid)") }
    app.activate(options: [.activateIgnoringOtherApps])
    usleep(150_000)

    let source = CGEventSource(stateID: .hidSystemState)
    func post(_ type: CGEventType, _ p: CGPoint) {
        guard let event = CGEvent(mouseEventSource: source, mouseType: type,
                                  mouseCursorPosition: p, mouseButton: .left) else { return }
        event.post(tap: .cghidEventTap)
    }

    post(.mouseMoved, start)
    usleep(20_000)
    post(.leftMouseDown, start)
    usleep(20_000)

    let n = max(1, steps)
    for i in 1...n {
        let t = Double(i) / Double(n)
        let p = CGPoint(x: start.x + (end.x - start.x) * t,
                        y: start.y + (end.y - start.y) * t)
        post(.leftMouseDragged, p)
        usleep(8_000)
    }

    post(.leftMouseUp, end)
    return (true, nil)
}
