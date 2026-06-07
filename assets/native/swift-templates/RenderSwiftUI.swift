// RenderSwiftUI — render a SwiftUI scene to a PNG OFF-SCREEN, in-process.
//
// Uses NSHostingView + cacheDisplay inside a borderless offscreen window, so
// it never touches the WindowServer screen-capture path. Works even when
// `screencapture` returns black, AX is wedged, or the host process is denied
// screen recording / accessibility permissions.
//
// Build:  swiftc -O RenderSwiftUI.swift -o render-swiftui -framework SwiftUI -framework AppKit
// Run:    ./render-swiftui /tmp/out.png
//
// This is a TEMPLATE — copy it into a tool target and swap `Demo` for the
// SwiftUI view tree you want to render. Useful for:
//   - Rendering a hypothetical "fix" version of a layout side-by-side with
//     the "before" to make a layout bug obvious in a PNG.
//   - Capturing a reference image of a SwiftUI component for visual diffing
//     when the live app's WindowServer surface is unreliable.
//   - Doing CI screenshot generation off a build server where the GUI
//     subsystem is not headfully usable.
import SwiftUI
import AppKit

// MARK: - example view: swap for your own
//
// Demonstrates the bug class IBR's layout-fill analyzer flags: a child that
// renders narrow + centered inside a container with empty gutters.

let paper = Color(red: 0.98, green: 0.965, blue: 0.94)
let surface = Color(red: 0.965, green: 0.945, blue: 0.915)
let canvasBG = Color.white
let ink = Color(red: 0.17, green: 0.13, blue: 0.08)
let hair = Color.black.opacity(0.12)

struct Pane: View {
    let label: String; let fillsCenter: Bool
    var body: some View {
        VStack(spacing: 0) {
            Text(label)
                .font(.system(size: 12, weight: .bold))
                .foregroundColor(ink)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(8)
                .background(paper)
            HStack(spacing: 0) {
                Color(red: 0.965, green: 0.945, blue: 0.915)
                    .frame(width: 200)
                    .overlay(Text("SIDEBAR").font(.caption2), alignment: .topLeading)
                if fillsCenter {
                    canvasBG.overlay(Text("content fills center").padding(), alignment: .topLeading)
                } else {
                    HStack(spacing: 0) {
                        Spacer()
                        canvasBG.frame(width: 300)
                            .overlay(Text("centered, gutters!").padding(), alignment: .topLeading)
                        Spacer()
                    }
                    .background(paper)
                }
                Color(red: 0.965, green: 0.945, blue: 0.915)
                    .frame(width: 230)
                    .overlay(Text("INSPECTOR").font(.caption2), alignment: .topLeading)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(paper)
        .border(hair, width: 1.5)
    }
}

struct Demo: View {
    var body: some View {
        VStack(spacing: 16) {
            Pane(label: "BEFORE — narrow & centered, empty gutters (the bug)", fillsCenter: false)
            Pane(label: "AFTER — content fills the available space", fillsCenter: true)
        }
        .padding(16)
        .frame(width: 1200, height: 760)
        .background(paper)
    }
}

// MARK: - offscreen render

let outPath = CommandLine.arguments.dropFirst().first ?? "/tmp/render-swiftui.png"
let appRef = NSApplication.shared
appRef.setActivationPolicy(.accessory)

let host = NSHostingView(rootView: Demo())
let size = NSSize(width: 1200, height: 760)
host.frame = NSRect(origin: .zero, size: size)

// Park the host view in a borderless offscreen window so SwiftUI has a real
// view hierarchy to lay out into. The window is never ordered front — it
// never uses the screen-capture surface.
let win = NSWindow(contentRect: host.frame, styleMask: [.borderless],
                   backing: .buffered, defer: false)
win.contentView = host
win.orderOut(nil)
host.layoutSubtreeIfNeeded()
host.displayIfNeeded()

guard let rep = host.bitmapImageRepForCachingDisplay(in: host.bounds) else {
    FileHandle.standardError.write("failed to make bitmap rep\n".data(using: .utf8)!); exit(1)
}
host.cacheDisplay(in: host.bounds, to: rep)
guard let data = rep.representation(using: .png, properties: [:]) else {
    FileHandle.standardError.write("failed to encode png\n".data(using: .utf8)!); exit(1)
}
try data.write(to: URL(fileURLWithPath: outPath))
print("rendered SwiftUI -> \(outPath)  (\(Int(size.width))x\(Int(size.height)))")
