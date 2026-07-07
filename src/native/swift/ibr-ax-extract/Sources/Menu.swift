import AppKit
import Foundation

// MARK: - AXMenu Traversal (E2-D)
//
// Walk an app's menu structure by an ordered list of item titles (e.g.
// ["File", "New Window"]) and AXPress the final item. Two traversal modes,
// tried in order:
//
//   1. Menu-bar path: the first segment matches a top-level AXMenuBarItem
//      title (case/ellipsis-insensitive). The AX tree for a static menu bar
//      is normally fully populated without opening it (this is how System
//      Events' "click menu item X of menu Y of menu bar item Z" AppleScript
//      works without ever visually opening a menu) — `menuItemsOf` reads
//      children directly and only falls back to an AXPress-to-populate retry
//      for menus that lazily build their contents (Recent Documents, etc).
//   2. Context-menu path: when no menu-bar item matches the first segment,
//      look for an AXMenu-role element already present among the
//      application's direct children — the shape a floating context menu
//      takes once a prior `showMenu` (AXShowMenu) action has opened it — and
//      walk the given path inside it.
//
// This file only exposes the traversal primitive (`walkMenuPath`); the
// before/after AX-diff validator that turns a raw walk+press into a
// validated `ActionOutcome` lives in Node (`menu.ts`), mirroring how
// Keyboard.swift stays a raw delivery primitive and `keyboard.ts` owns the
// validator.

/// Result of one traversal attempt. `failedSegment` names which index of the
/// input `menuPath` could not be resolved, so the Node caller's structured
/// evidence can point at the exact broken hop.
struct MenuWalkResult {
    let success: Bool
    let error: String?
    let failedSegment: Int?
    /// "menu-bar" | "context-menu" — which traversal mode matched, for provenance.
    let matchedVia: String?
}

/// Normalize a menu title for comparison: trim whitespace and a trailing
/// ellipsis (real "…" or literal "...") so callers do not need to guess
/// whether a given item's title carries one (e.g. "Save As…").
private func normalizeMenuTitle(_ title: String) -> String {
    var t = title.trimmingCharacters(in: .whitespaces)
    if t.hasSuffix("…") {
        t.removeLast()
    } else if t.hasSuffix("...") {
        t.removeLast(3)
    }
    return t.trimmingCharacters(in: .whitespaces).lowercased()
}

private func findChildByTitle(_ children: [AXUIElement], title: String) -> AXUIElement? {
    let target = normalizeMenuTitle(title)
    return children.first { child in
        guard let childTitle = getStringAttribute(child, kAXTitleAttribute) else { return false }
        return normalizeMenuTitle(childTitle) == target
    }
}

/// Read `element`'s children, opening it (AXPress) once and re-reading if it
/// reports no children — a static menu bar/menu is usually fully populated
/// already; a lazily-built one (Recent Documents-style) only appears after
/// its `AXPress`/open action has fired.
private func childrenOpeningIfNeeded(_ element: AXUIElement) -> [AXUIElement] {
    var children = getChildren(element)
    if children.isEmpty {
        _ = AXUIElementPerformAction(element, kAXPressAction as CFString)
        usleep(150_000)
        children = getChildren(element)
    }
    return children
}

/// The menu-item rows reachable from a menu-bar item or a submenu-bearing
/// menu item. Both typically expose a single AXMenu container as their only
/// child, which itself holds the AXMenuItem rows — unwrap that container
/// transparently so callers walk item titles, not AX role plumbing.
private func menuItemsOf(_ element: AXUIElement) -> [AXUIElement] {
    let kids = childrenOpeningIfNeeded(element)
    if kids.count == 1, getStringAttribute(kids[0], kAXRoleAttribute) == "AXMenu" {
        return getChildren(kids[0])
    }
    return kids
}

/// Walk `remaining` menu-item titles starting from `items`, AXPress-ing the
/// final match. `segmentOffset` is the index of `remaining[0]` within the
/// caller's original `menuPath`, so failures report the correct absolute index.
private func walkItems(
    _ items: [AXUIElement],
    remaining: [String],
    segmentOffset: Int,
    matchedVia: String
) -> MenuWalkResult {
    var currentItems = items
    for (i, title) in remaining.enumerated() {
        guard let match = findChildByTitle(currentItems, title: title) else {
            return MenuWalkResult(
                success: false,
                error: "menu item not found: \"\(title)\"",
                failedSegment: segmentOffset + i,
                matchedVia: matchedVia
            )
        }
        let isLast = i == remaining.count - 1
        if isLast {
            let ok = AXUIElementPerformAction(match, kAXPressAction as CFString) == .success
            return MenuWalkResult(
                success: ok,
                error: ok ? nil : "AXPress failed on \"\(title)\"",
                failedSegment: ok ? nil : segmentOffset + i,
                matchedVia: matchedVia
            )
        }
        currentItems = menuItemsOf(match)
    }
    // Unreachable: `remaining` is non-empty on every call site.
    return MenuWalkResult(success: false, error: "internal traversal error", failedSegment: nil, matchedVia: matchedVia)
}

/// Walk `menuPath` against `pid`'s menu bar, or an already-open context menu.
/// Never throws — every failure mode (no such menu-bar item, item not found,
/// AXPress failure) folds into a structured `MenuWalkResult`.
func walkMenuPath(pid: pid_t, menuPath: [String]) -> MenuWalkResult {
    guard let firstTitle = menuPath.first, !firstTitle.isEmpty else {
        return MenuWalkResult(success: false, error: "menuPath must have at least one segment", failedSegment: nil, matchedVia: nil)
    }

    let appElement = AXUIElementCreateApplication(pid)

    // Mode 1: menu-bar traversal.
    var menuBarValue: AnyObject?
    if AXUIElementCopyAttributeValue(appElement, kAXMenuBarAttribute as CFString, &menuBarValue) == .success,
       let menuBarRef = menuBarValue {
        let menuBar = menuBarRef as! AXUIElement
        let menuBarItems = getChildren(menuBar)
        if let firstItem = findChildByTitle(menuBarItems, title: firstTitle) {
            let remaining = Array(menuPath.dropFirst())
            if remaining.isEmpty {
                // Single-segment path against a menu-bar item: open it. There is
                // nothing further to select, so "success" means the open itself
                // worked — an unusual but valid caller intent.
                let ok = AXUIElementPerformAction(firstItem, kAXPressAction as CFString) == .success
                return MenuWalkResult(
                    success: ok,
                    error: ok ? nil : "AXPress failed on \"\(firstTitle)\"",
                    failedSegment: ok ? nil : 0,
                    matchedVia: "menu-bar"
                )
            }
            let items = menuItemsOf(firstItem)
            return walkItems(items, remaining: remaining, segmentOffset: 1, matchedVia: "menu-bar")
        }
    }

    // Mode 2: an already-open context menu — a floating AXMenu that appears
    // as a direct child of the application element once a prior `showMenu`
    // (AXShowMenu) action has opened it.
    let appChildren = getChildren(appElement)
    if let openMenu = appChildren.first(where: { getStringAttribute($0, kAXRoleAttribute) == "AXMenu" }) {
        let items = getChildren(openMenu)
        return walkItems(items, remaining: menuPath, segmentOffset: 0, matchedVia: "context-menu")
    }

    return MenuWalkResult(
        success: false,
        error: "no menu bar item or open context menu matched \"\(firstTitle)\"",
        failedSegment: 0,
        matchedVia: nil
    )
}
