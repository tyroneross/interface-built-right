// LayoutProbe — drop-in, AX-INDEPENDENT layout capture for any macOS Swift app.
//
// Why: the Accessibility API (and AppleEvents) can be denied (TCC), throttled,
// or wedged. When that happens, external scanners report "no windows" and
// you're blind. This reads the app's OWN NSView hierarchy from inside the
// process, so it ALWAYS works as long as the app is running — and it reports
// the real, ground-truth frames (including hosted NSViewRepresentable views
// like a SwiftTerm terminal, whose width bug is invisible to a screenshot).
//
// It answers exactly: "what is the size and RELATIVE size of every visual
// element, and where is unused space?"
//
// Install (any AppKit or SwiftUI-on-AppKit macOS app):
//   1. Add this file to the target. It uses no third-party deps — pure
//      AppKit + Foundation.
//   2. Trigger a dump any of three ways:
//        • Launch with env  IBR_LAYOUT_DUMP=1     (auto-dumps 2s after launch)
//        • Call  LayoutProbe.dumpKeyWindow()       (from a debug menu / shortcut)
//        • lldb:  e -l swift -- LayoutProbe.dumpKeyWindow()
//   3. Output: ~/Library/Caches/<bundleid>/layoutprobe-<ts>.json + a console
//      tree with sizes, % of window width, and a GAP/FILL report.
//
// The GAP/FILL report is the part that catches the "narrow element, empty
// gutters" class: for every container it computes the largest empty horizontal
// band and flags any ≥ 12% of the container width. Matches the algorithm in
// IBR's TS-side analyzer (src/native/layout-fill.ts) and the Swift extractor's
// --analyze-layout pass, so a finding from this probe is the same shape as one
// from `npx ibr scan-macos`.
//
// Wedge-proof PNG rendering: renderKeyWindowPNG() captures the live window via
// AppKit cacheDisplay (in-process raster), bypassing WindowServer entirely. It
// returns a true PNG of the running app's UI even when `screencapture` returns
// black or AX is wedged.
import AppKit
import Foundation

public enum LayoutProbe {
    /// Minimum empty band (as a fraction of container extent on the analyzed
    /// axis) before a finding is emitted. Lower = noisier, higher = misses
    /// real bugs. Default 0.12 matches IBR's TS-side analyzer.
    public static var gapThreshold: CGFloat = 0.12

    /// Install an auto-dump if IBR_LAYOUT_DUMP is set. Call once from app
    /// launch (e.g. applicationDidFinishLaunching) — no-op unless the env var
    /// is set. Keeps probe code shipped but inert in normal runs.
    public static func installAutoDumpIfRequested() {
        guard ProcessInfo.processInfo.environment["IBR_LAYOUT_DUMP"] != nil else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            dumpKeyWindow()
            renderKeyWindowPNG()
        }
    }

    /// Render the LIVE key window to a real PNG from INSIDE the process via
    /// AppKit `cacheDisplay`. Bypasses WindowServer screen capture entirely,
    /// so it works even when `screencapture` returns black / AX is wedged.
    /// This is how you get a true screenshot of the running app's actual UI
    /// (including hosted SwiftTerm or other NSViewRepresentable views)
    /// through a capture-surface wedge.
    @discardableResult
    public static func renderKeyWindowPNG() -> URL? {
        guard let win = NSApp.keyWindow ?? NSApp.windows.first(where: { $0.isVisible }),
              let root = win.contentView else {
            NSLog("LayoutProbe: no window to render"); return nil
        }
        root.layoutSubtreeIfNeeded(); root.displayIfNeeded()
        guard let rep = root.bitmapImageRepForCachingDisplay(in: root.bounds) else { return nil }
        root.cacheDisplay(in: root.bounds, to: rep)
        guard let data = rep.representation(using: .png, properties: [:]) else { return nil }
        let url = cacheURL().deletingPathExtension().appendingPathExtension("png")
        try? data.write(to: url)
        print("LayoutProbe PNG → \(url.path)")
        return url
    }

    @discardableResult
    public static func dumpKeyWindow() -> URL? {
        guard let win = NSApp.keyWindow ?? NSApp.windows.first(where: { $0.isVisible }),
              let root = win.contentView else {
            NSLog("LayoutProbe: no key/visible window")
            return nil
        }
        let winRect = root.bounds
        let node = capture(root, in: root)
        print("\n==== LAYOUT PROBE — window \(Int(winRect.width))x\(Int(winRect.height)) ====")
        printTree(node, depth: 0, winWidth: winRect.width)
        var findings: [String] = []
        gaps(node, threshold: gapThreshold, into: &findings)
        print("\n---- GAP / FILL (empty band ≥ \(Int(gapThreshold*100))% of container width) ----")
        print(findings.isEmpty ? "  none" : findings.joined(separator: "\n"))
        let url = cacheURL()
        if let data = try? JSONSerialization.data(withJSONObject: json(node), options: [.prettyPrinted]) {
            try? data.write(to: url)
            print("\nLayoutProbe JSON → \(url.path)")
        }
        return url
    }

    // MARK: capture

    final class N {
        let cls: String, id: String, frame: CGRect
        var kids: [N] = []
        init(_ cls: String, _ id: String, _ frame: CGRect) { self.cls = cls; self.id = id; self.frame = frame }
    }

    private static func capture(_ v: NSView, in root: NSView) -> N {
        // frame converted to the window-root coordinate space for
        // apples-to-apples percentages.
        let f = v.convert(v.bounds, to: root)
        let id = v.accessibilityIdentifier()
        let n = N(String(describing: type(of: v)), id, f)
        for s in v.subviews where !s.isHidden && s.alphaValue > 0.01 {
            n.kids.append(capture(s, in: root))
        }
        return n
    }

    // MARK: render

    private static func printTree(_ n: N, depth: Int, winWidth: CGFloat) {
        let pad = String(repeating: "  ", count: depth)
        let pct = winWidth > 0 ? "  \(Int(n.frame.width / winWidth * 100))% win-w" : ""
        let idStr = n.id.isEmpty ? "" : " #\(n.id)"
        print("\(pad)\(n.cls)\(idStr)  \(Int(n.frame.width))x\(Int(n.frame.height)) @\(Int(n.frame.minX)),\(Int(n.frame.minY))\(pct)")
        for k in n.kids { printTree(k, depth: depth + 1, winWidth: winWidth) }
    }

    private static func json(_ n: N) -> [String: Any] {
        ["class": n.cls, "id": n.id,
         "frame": ["x": n.frame.minX, "y": n.frame.minY, "w": n.frame.width, "h": n.frame.height],
         "subviews": n.kids.map { json($0) }]
    }

    // MARK: gap analysis (same algorithm as IBR's TS-side analyzer)

    private static func gaps(_ n: N, threshold: CGFloat, into out: inout [String]) {
        let laid = n.kids.filter { $0.frame.width > 1 && $0.frame.height > 1 }
        if n.frame.width > 1, !laid.isEmpty {
            // Merge child x-spans, find largest empty band leading/among/trailing.
            let spans = laid.map { ($0.frame.minX, $0.frame.maxX) }.sorted { $0.0 < $1.0 }
            var merged: [(CGFloat, CGFloat)] = []
            for s in spans {
                if var last = merged.last, s.0 <= last.1 { last.1 = max(last.1, s.1); merged[merged.count-1] = last }
                else { merged.append(s) }
            }
            var cursor = n.frame.minX, best: (CGFloat, String) = (0, "")
            for (i, m) in merged.enumerated() {
                let g = m.0 - cursor
                if g > best.0 { best = (g, i == 0 ? "leading" : "between") }
                cursor = max(cursor, m.1)
            }
            let trailing = n.frame.maxX - cursor
            if trailing > best.0 { best = (trailing, "trailing") }
            let pct = best.0 / n.frame.width
            if pct >= threshold {
                let idStr = n.id.isEmpty ? "" : " #\(n.id)"
                out.append("  ⚠️ \(n.cls)\(idStr): \(best.1) empty \(Int(best.0))px = \(Int(pct*100))% of \(Int(n.frame.width))px wide container")
            }
        }
        for k in n.kids { gaps(k, threshold: threshold, into: &out) }
    }

    private static func cacheURL() -> URL {
        let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent(Bundle.main.bundleIdentifier ?? "LayoutProbe")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("layoutprobe-\(Int(Date().timeIntervalSince1970)).json")
    }
}
