# IBR Native Swift Templates — drop-in helpers

Two AX-independent, dependency-free Swift files you can copy into a macOS
Swift app target when you need ground-truth layout data that the
Accessibility / screencapture pipeline can't deliver.

| File | Use |
|------|-----|
| `LayoutProbe.swift` | Read the app's own NSView hierarchy from inside the process; emit a console tree + GAP/FILL report + JSON artifact + a wedge-proof in-process PNG. |
| `RenderSwiftUI.swift` | Render a SwiftUI scene to a PNG OFF-SCREEN, in-process (no WindowServer). Useful for "before vs after" layout diffs or CI screenshot generation. |

Neither template adds third-party dependencies. Both use only AppKit /
Foundation / SwiftUI. Drop in, build, run.

---

## When to use which

| Symptom | Reach for |
|---------|-----------|
| `npx ibr scan-macos` returns nothing / "no windows" — AX/AppleEvent is wedged | `LayoutProbe.swift` (runs INSIDE your process) |
| Your screenshot looks fine but elements are clearly narrow/empty — you need numbers, not eyeballs | `LayoutProbe.swift` (gap report names the empty band as a %) |
| `screencapture` returns black / TCC denied / WindowServer is wedged | `LayoutProbe.swift`'s `renderKeyWindowPNG()` (in-process cacheDisplay) |
| You want a PNG of a hypothetical SwiftUI "fix" version next to the buggy version, without shipping anything | `RenderSwiftUI.swift` (offscreen NSHostingView raster) |
| You need bug-class detection in CI without a running app | TS analyzer (`analyzeLayoutFill` from `@tyroneross/interface-built-right`) reading a recorded element tree |

---

## LayoutProbe.swift — in-process layout dump + wedge-proof PNG

**Install:**

```text
1. Add LayoutProbe.swift to your macOS app target.
2. (Optional) From your AppDelegate's applicationDidFinishLaunching, call:
       LayoutProbe.installAutoDumpIfRequested()
   This only fires if the IBR_LAYOUT_DUMP env var is set at launch.
3. Or trigger manually any time:
       LayoutProbe.dumpKeyWindow()        // tree + gap report + JSON
       LayoutProbe.renderKeyWindowPNG()   // wedge-proof PNG
4. lldb (no recompile): e -l swift -- LayoutProbe.dumpKeyWindow()
```

**Output:**

- Console: indented element tree with `Wx H @x,y N% win-w` per node, followed
  by `GAP / FILL` lines for any container with an empty band ≥ threshold.
- JSON artifact at `~/Library/Caches/<bundleid>/layoutprobe-<ts>.json`.
- PNG artifact at `~/Library/Caches/<bundleid>/layoutprobe-<ts>.png`
  (from `renderKeyWindowPNG()`).

**Configure threshold:**

```swift
LayoutProbe.gapThreshold = 0.20   // emit only ≥ 20% empty bands
```

The default `0.12` matches IBR's TS-side analyzer
(`src/native/layout-fill.ts`) and the Swift extractor's `--analyze-layout`
pass, so a finding from any of the three is the same shape.

**What the gap report catches:**

> A content element rendered narrow and CENTERED inside its container,
> leaving large empty gutters — invisible to a screenshot, but obvious from
> element frames.

The bug class that motivated this tool: a SwiftTerm canvas rendered at
~47 columns (~440px) centered in a ~1074px container with ~317px gutters
on each side. Visible in screenshots but missed by judging width by eye +
a column count instead of extracting frames and comparing to the container.

---

## RenderSwiftUI.swift — off-screen SwiftUI → PNG

**Build:**

```bash
swiftc -O RenderSwiftUI.swift -o render-swiftui \
    -framework SwiftUI -framework AppKit
./render-swiftui /tmp/out.png
```

The included `Demo` view is a placeholder showing a BEFORE/AFTER layout-fill
illustration. Swap it for the SwiftUI scene you want to capture.

**Mechanics:**

`NSHostingView` hosts your SwiftUI tree → parked in a borderless offscreen
`NSWindow` (never `orderFront`ed) → `cacheDisplay(in:to:)` renders to a
bitmap rep → encoded as PNG. The window never touches the WindowServer
capture surface, so it works when `screencapture` returns black.

---

## Relationship to the rest of IBR

These templates ship under `assets/native/swift-templates/` and are
**source files**, not compiled binaries. They are NOT injected into
arbitrary apps — you copy them into your own app target. The IBR CLI does
not interact with them at runtime.

The same gap/fill algorithm runs in three places:

1. **TS analyzer** (`src/native/layout-fill.ts`) — what `scanMacOS` calls.
   Reads the AX tree the Swift extractor emits.
2. **Swift extractor** (`src/native/swift/ibr-ax-extract/Sources/main.swift`)
   with `--analyze-layout` — same algorithm, in-Swift, emits findings on
   stderr as `LAYOUT_FINDINGS:<json>` for parity with non-TS callers.
3. **LayoutProbe.swift** (this template) — same algorithm, in-process,
   reads the live NSView hierarchy directly. Use when AX is wedged or you
   want ground-truth frames including hosted `NSViewRepresentable` views.

All three emit the same shape: `containerRole`, `containerLabel`, `axis`,
`emptyPx`, `emptyPct`, `position` (`leading`/`between`/`trailing`),
`containerWidth`, `containerHeight`, `detail`.
