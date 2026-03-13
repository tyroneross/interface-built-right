# IBR Native Support: iOS + watchOS

## The Opportunity

IBR's core value is **structured data extraction** — turning a live interface into machine-readable records (element bounds, computed styles, handler wiring, accessibility, page intent). Today this runs through Playwright + Chromium. The schemas and comparison system are platform-agnostic; only the extraction layer is web-specific.

Native iOS/watchOS apps have the same validation needs:
- Are buttons wired to real actions?
- Do touch targets meet minimums (44pt)?
- Is the view hierarchy what we expect?
- Did a code change break the layout?
- How smooth is the interaction? (frame drops, hitches)

Plus native-only concerns IBR doesn't cover today:
- Digital Crown responsiveness
- Haptic feedback verification
- Animation frame rate
- SwiftUI view body re-evaluation count

---

## Architecture: Extraction Contexts

IBR's pipeline today:

```
Playwright page.evaluate()  →  EnhancedElement[]  →  AuditResult  →  ScanResult  →  Verdict
```

Generalize to:

```
ExtractionContext<T>  →  UIElement[]  →  AuditResult  →  ScanResult  →  Verdict
     ↑                        ↑
  Platform-specific     Shared schema
```

Three extraction contexts:

| Context | Backing | Captures |
|---------|---------|----------|
| `WebContext` | Playwright page.evaluate() | DOM elements, CSS, React/Vue handlers |
| `SimulatorContext` | xcrun simctl + Accessibility Inspector | UIKit/SwiftUI view tree, accessibility, bounds |
| `XCUITestContext` | XCUITest framework | Live element queries, interaction verification |

The `UIElement` schema stays the same across all three. Only the extraction method changes.

---

## Phase 1: Simulator Extraction (lowest friction)

### How It Works

The iOS/watchOS Simulator exposes the full accessibility tree via `xcrun simctl`. Combined with Accessibility Inspector's underlying APIs, we can extract:

```
xcrun simctl io <device> screenshot capture.png
xcrun simctl spawn <device> accessibility_audit
```

**Extraction pipeline:**

1. **Boot simulator** with target app installed
2. **Capture screenshot** via `xcrun simctl io booted screenshot`
3. **Extract accessibility tree** via `XCAXClient` (private framework) or `AXUIElement` queries
4. **Map to UIElement schema:**

```typescript
// Native element → IBR UIElement mapping
interface NativeElement {
  // From accessibility tree
  identifier: string;          // accessibilityIdentifier → selector
  label: string;               // accessibilityLabel → semantics.label
  traits: string[];            // .button, .link, .header → semantics.role
  frame: CGRect;               // → geometry { x, y, width, height }
  isEnabled: boolean;          // → interaction.state
  value: string | null;        // → current value for inputs

  // From view hierarchy (debug only)
  viewType: string;            // "Button", "Text", "ScrollView"
  modifiers: string[];         // .font, .foregroundColor, .padding
  children: NativeElement[];
}
```

### Swift Helper Binary

A small Swift CLI (`ibr-native-extract`) that runs inside the simulator:

```swift
// Walks the accessibility tree and outputs IBR-compatible JSON
import UIKit
import ObjectiveC

struct IBRElement: Codable {
    let selector: String
    let tagName: String
    let text: String
    let bounds: IBRBounds
    let interactive: IBRInteractive
    let semantics: IBRSemantics
}

// Query the running app's key window
let window = UIApplication.shared.connectedScenes
    .compactMap { $0 as? UIWindowScene }
    .first?.windows.first

// Walk the view hierarchy
func extract(view: UIView, path: String) -> [IBRElement] {
    var elements: [IBRElement] = []

    let frame = view.convert(view.bounds, to: nil)
    let traits = view.accessibilityTraits
    let isInteractive = traits.contains(.button) ||
                        traits.contains(.link) ||
                        view is UIControl

    if isInteractive || view.accessibilityLabel != nil {
        elements.append(IBRElement(
            selector: view.accessibilityIdentifier ?? path,
            tagName: String(describing: type(of: view)),
            text: view.accessibilityLabel ?? "",
            bounds: IBRBounds(
                x: frame.origin.x,
                y: frame.origin.y,
                width: frame.size.width,
                height: frame.size.height
            ),
            interactive: IBRInteractive(
                hasHandler: isInteractive,
                isDisabled: !view.isUserInteractionEnabled,
                traits: traitNames(traits)
            ),
            semantics: IBRSemantics(
                role: primaryRole(traits),
                label: view.accessibilityLabel,
                hint: view.accessibilityHint
            )
        ))
    }

    for (i, child) in view.subviews.enumerated() {
        elements += extract(view: child, path: "\(path)/\(type(of: child))[\(i)]")
    }

    return elements
}
```

This outputs the same `EnhancedElement`-shaped JSON that IBR's web pipeline produces. The rest of the pipeline (audit, comparison, verdict) works unchanged.

### watchOS Specifics

watchOS Simulator doesn't support `simctl spawn`, so extraction requires a different approach:

1. **Screenshot**: `xcrun simctl io booted screenshot` works for watchOS simulator
2. **View hierarchy**: Use Xcode's Debug View Hierarchy (captures as `.viewhierarchy` file) — parse the XML
3. **Accessibility**: Set `accessibilityIdentifier` on all interactive elements in SwiftUI, then query via XCUITest

```swift
// In watchOS SwiftUI views — add identifiers for IBR extraction
Button("Start") { engine.handleStart() }
    .accessibilityIdentifier("ibr-start-button")
    .accessibilityLabel("Start timer")

WatchModePicker(selectedIndex: $index)
    .accessibilityIdentifier("ibr-mode-picker")
```

---

## Phase 2: XCUITest Integration

### How It Works

XCUITest already provides element queries, bounds, and interaction verification — exactly what IBR needs. Build an XCUITest target that:

1. Launches the app
2. Extracts all elements to IBR JSON format
3. Verifies interactivity (tap handlers work, not just exist)
4. Captures performance metrics via `XCTMetric`
5. Outputs IBR-compatible `ScanResult`

```swift
// IBRNativeTests.swift — XCUITest target
import XCTest

class IBRScanTests: XCTestCase {

    func testExtractElements() {
        let app = XCUIApplication()
        app.launch()

        var elements: [[String: Any]] = []

        // Extract all buttons
        for i in 0..<app.buttons.count {
            let btn = app.buttons.element(boundBy: i)
            elements.append([
                "selector": btn.identifier.isEmpty ? "button[\(i)]" : btn.identifier,
                "tagName": "Button",
                "text": btn.label,
                "bounds": [
                    "x": btn.frame.origin.x,
                    "y": btn.frame.origin.y,
                    "width": btn.frame.size.width,
                    "height": btn.frame.size.height
                ],
                "interactive": [
                    "hasHandler": btn.isHittable,
                    "isDisabled": !btn.isEnabled
                ],
                "semantics": [
                    "role": "button",
                    "label": btn.label
                ]
            ])
        }

        // Same for staticTexts, switches, sliders, etc.
        // ...

        // Write IBR-compatible JSON
        let scanResult: [String: Any] = [
            "url": "flodoro://watch/idle",
            "timestamp": ISO8601DateFormatter().string(from: Date()),
            "viewport": ["width": 198, "height": 242], // Watch 45mm
            "elements": ["all": elements],
            "platform": "watchOS"
        ]

        let data = try! JSONSerialization.data(withJSONObject: scanResult, options: .prettyPrinted)
        let path = FileManager.default.temporaryDirectory.appendingPathComponent("ibr-scan.json")
        try! data.write(to: path)

        // IBR CLI reads this file
        print("IBR_OUTPUT: \(path.path)")
    }

    func testInteractivity() {
        let app = XCUIApplication()
        app.launch()

        // Verify mode picker responds to Digital Crown
        let picker = app.otherElements["ibr-mode-picker"]
        XCTAssertTrue(picker.exists, "Mode picker should exist")

        // Verify Start button is tappable
        let startBtn = app.buttons["ibr-start-button"]
        XCTAssertTrue(startBtn.isEnabled, "Start should be enabled")
        XCTAssertTrue(startBtn.isHittable, "Start should be tappable")
    }
}
```

### Performance Metrics (Smoothness)

XCUITest can capture performance metrics that IBR's web pipeline can't:

```swift
func testScrollSmoothness() {
    let app = XCUIApplication()

    let metrics: [XCTMetric] = [
        XCTOSSignpostMetric.scrollDecelerationMetric,  // Scroll smoothness
        XCTClockMetric(),                               // Wall clock time
        XCTCPUMetric(application: app),                 // CPU usage
        XCTMemoryMetric(application: app),              // Memory usage
    ]

    measure(metrics: metrics) {
        // Rotate Digital Crown through all modes
        app.otherElements["ibr-mode-picker"].swipeUp()
        app.otherElements["ibr-mode-picker"].swipeDown()
    }
}

func testAnimationHitches() {
    let app = XCUIApplication()

    let hitchMetric = XCTOSSignpostMetric.applicationLaunch

    measure(metrics: [XCTOSSignpostMetric.scrollDecelerationMetric]) {
        // Navigate through timer states
        app.buttons["ibr-start-button"].tap()
        Thread.sleep(forTimeInterval: 2)
        // Tap timer ring to pause
        app.otherElements["ibr-timer-ring"].tap()
    }
}
```

**New IBR output fields for native:**

```typescript
interface NativePerformance {
  // Frame rate
  fps: { average: number; minimum: number; dropped: number };
  // Hitch metrics (time spent > 16.6ms per frame)
  hitches: { count: number; totalDuration: number; ratio: number };
  // Resource usage
  cpu: { average: number; peak: number };
  memory: { baseline: number; peak: number; delta: number };
  // Responsiveness
  scrollDeceleration: { duration: number; isSmooth: boolean };
  crownResponseTime?: number;  // watchOS only
}
```

---

## Phase 3: CLI Integration

### New Commands

```bash
# Scan a running simulator
npx ibr scan:native --simulator "Apple Watch Series 10 - 46mm" --scheme FloDoro-watchOS

# Scan a running iOS simulator
npx ibr scan:native --simulator "iPhone 16 Pro" --scheme FloDoro-iOS

# Compare native baseline
npx ibr start:native --simulator "Apple Watch Series 10 - 46mm"
npx ibr check:native

# Performance profile
npx ibr perf:native --simulator "Apple Watch Series 10 - 46mm" --test IBRScanTests

# Full pipeline: build → launch → extract → audit → compare
npx ibr scan:native --project /path/to/FloDoro --scheme FloDoro-watchOS --full
```

### Implementation

```typescript
// src/native/context.ts
import { execSync } from 'child_process';

export class SimulatorContext implements ExtractionContext {
  constructor(
    private simulatorId: string,
    private bundleId: string
  ) {}

  async screenshot(path: string): Promise<void> {
    execSync(`xcrun simctl io ${this.simulatorId} screenshot "${path}"`);
  }

  async extractElements(): Promise<UIElement[]> {
    // Run the Swift extraction helper inside the simulator
    const output = execSync(
      `xcrun simctl spawn ${this.simulatorId} ibr-native-extract --bundle ${this.bundleId}`
    );
    return JSON.parse(output.toString());
  }

  async runXCUITest(testName: string): Promise<NativePerformance> {
    const result = execSync(
      `xcodebuild test -scheme IBRTests -destination 'id=${this.simulatorId}' -only-testing:${testName}`,
      { timeout: 60000 }
    );
    // Parse xcresult bundle for metrics
    return parseXCResult(result);
  }
}
```

---

## Phase 4: watchOS-Specific Analysis

### Digital Crown Validation

```typescript
interface CrownAnalysis {
  // Does the focused view respond to crown rotation?
  crownResponsive: boolean;
  // How many detents (stops) does the crown have?
  detentCount: number;
  // Does rotation change selection/value?
  changesSelection: boolean;
  // Haptic feedback enabled?
  hapticEnabled: boolean;
  // Response latency (ms from rotation to UI update)
  responseLatency: number;
}
```

Capture via XCUITest:
```swift
func testCrownInteraction() {
    let app = XCUIApplication()
    app.launch()

    let picker = app.otherElements["ibr-mode-picker"]
    let initialValue = picker.value as? String

    // Simulate crown rotation
    picker.adjust(toNormalizedSliderPosition: 0.5)

    let newValue = picker.value as? String
    XCTAssertNotEqual(initialValue, newValue, "Crown should change selection")
}
```

### Complication Validation

```typescript
interface ComplicationAnalysis {
  family: string;              // circular, rectangular, etc.
  hasContent: boolean;
  textReadable: boolean;       // Text fits within bounds
  updateFrequency: number;     // How often data refreshes
  tapAction: boolean;          // Opens app on tap
}
```

### Watch Layout Audit

```typescript
interface WatchAuditRules {
  // Touch targets: 44pt minimum (Apple HIG)
  minTouchTarget: 44;
  // Font sizes: minimum 11pt for readability
  minFontSize: 11;
  // Max interactive elements per screen (cognitive load)
  maxElementsPerScreen: 7;
  // Crown focus: at most 1 focusable element per screen
  maxCrownFocusable: 1;
  // Content should not overflow screen
  noHorizontalScroll: true;
}
```

---

## Phase 5: Shared Comparison Pipeline

The existing comparison system works for native with minimal changes:

### Screenshot Comparison (already works)

```
Simulator screenshot (PNG)  →  pixelmatch  →  Verdict
```

No changes needed. `xcrun simctl io booted screenshot` produces PNGs identical to what IBR already consumes.

### Structural Comparison (new)

```typescript
// Compare element trees instead of pixels
function compareStructures(
  baseline: UIElement[],
  current: UIElement[],
): StructuralDiff {
  const added = current.filter(c => !baseline.find(b => b.selector === c.selector));
  const removed = baseline.filter(b => !current.find(c => c.selector === b.selector));
  const modified = current
    .filter(c => baseline.find(b => b.selector === c.selector))
    .filter(c => {
      const b = baseline.find(b => b.selector === c.selector)!;
      return JSON.stringify(b.bounds) !== JSON.stringify(c.bounds) ||
             JSON.stringify(b.appearance) !== JSON.stringify(c.appearance);
    });

  return { added, removed, modified, verdict: deriveVerdict(added, removed, modified) };
}
```

This catches issues screenshots miss: a button that moved 2px (invisible to eye, but structural change) or a handler that was removed (visually identical, functionally broken).

---

## Implementation Order

| Phase | Effort | Value | Dependency |
|-------|--------|-------|------------|
| 1. Simulator screenshot capture | Small | Medium | None — just `xcrun simctl` |
| 2. Accessibility tree extraction | Medium | High | Accessibility identifiers in SwiftUI views |
| 3. XCUITest element extraction | Medium | High | XCUITest target in project |
| 4. Performance metrics | Medium | High | XCTMetric + xcresult parsing |
| 5. watchOS-specific analysis | Large | Medium | Phases 2-4 |
| 6. CLI commands (`scan:native`) | Medium | High | Phase 2 |
| 7. Structural comparison | Small | High | Phase 2 |
| 8. Plugin integration | Small | Medium | Phase 6 |

**Recommended start:** Phase 1 + 2 together — screenshot + accessibility extraction gives immediate value with the existing comparison pipeline.

---

## File Structure

```
src/
├── native/
│   ├── context.ts              # SimulatorContext, XCUITestContext
│   ├── extract.ts              # Accessibility tree → UIElement mapping
│   ├── simulator.ts            # xcrun simctl wrapper
│   ├── xcresult.ts             # Parse xcresult bundles for metrics
│   ├── performance.ts          # NativePerformance extraction
│   └── watch/
│       ├── crown.ts            # Digital Crown analysis
│       ├── complication.ts     # Complication validation
│       └── audit.ts            # Watch-specific HIG rules
├── swift/
│   ├── IBRExtract.swift        # Swift helper binary (runs in simulator)
│   └── Package.swift           # Swift package for the helper
```

---

## What This Enables

After implementation, the workflow for FloDoro would be:

```bash
# 1. Capture baseline of watch idle screen
npx ibr start:native --simulator "Apple Watch Series 10 - 46mm"

# 2. Make code changes (e.g., update WatchModePicker)
# ... edit SwiftUI views ...

# 3. Rebuild and check
xcodebuild -scheme FloDoro-watchOS build
npx ibr check:native

# Output:
# EXPECTED_CHANGE: Mode picker layout updated
#   - Button padding: 8pt → 6pt (5 elements)
#   - New modifier: .digitalCrownRotation (1 element)
#   - Touch targets: ALL PASS (min 44pt)
#   - Crown responsiveness: 12ms average latency
#   - Frame rate: 60fps average, 0 hitches
#   Verdict: PASS

# 4. Profile smoothness
npx ibr perf:native --test testScrollSmoothness
# FPS: avg 60, min 58, dropped 0
# Hitches: 0 (ratio: 0.000)
# Crown response: 11ms
# Verdict: SMOOTH
```

The same structured data, comparison verdicts, and AI-friendly output — just for native interfaces instead of web pages.
