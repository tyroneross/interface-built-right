# 4. Color, Surface & Typography

Option catalog for accent application, gradients, dark mode, elevation, typography, and numeric display.

**Read first:** `0_Router.md`
**Companion:** CP 6.4.1 Principle 5 (Text Over Decoration), Principle 8 (Rhythm & Alignment)

---

## §1. ACCENT COLOR APPLICATION

### 1.1 Options

| Option | Description | Best For |
|--------|-------------|----------|
| **CTA-Only Restraint** | Accent on single primary CTA + key states only | Utility, Editorial, minimal apps (CP default) |
| **Semantic Accent System** | Accent on CTAs + active states + progress + selection + charts | Productivity, Tool/Pro — multiple functional states |
| **Expressive Accent Spread** | Accent in section bgs, gradients, icon fills, headers | Consumer/Habit, brand-immersive apps |
| **Dual Accent** | Primary accent + secondary accent (one for actions, one for status) | Data-heavy, finance, health |
| **No Accent (Grayscale)** | Entirely neutral palette | Extreme editorial, reading apps |

### 1.2 Rossen Preferred

All three (CTA-Only, Semantic, Expressive) based on archetype and screen context.

### 1.3 Accent Decision Tree

```
Applying accent to a surface?
├── Is this a utility / content / productivity screen?
│   └── CTA-Only Restraint (single accent point)
├── Does this screen need multiple functional states distinguished?
│   ├── Active states, progress, data, selection?
│   └── Semantic System
├── Is this onboarding, celebration, or marketing moment?
│   └── Expressive Spread permitted (document why)
└── Is this a reading / editorial screen?
    └── CTA-Only or No Accent
```

### 1.4 Strict Rules

**CTA-Only Accent NEVER appears on:**
- Section backgrounds
- Card backgrounds (except selected state)
- Icon fills for non-active icons
- Decorative elements

**Expressive Spread is ALLOWED only on:**
- Onboarding screens
- Celebration / achievement moments
- Marketing / hero surfaces
- Splash / launch screens

**Semantic System applies accent to:**
- All CTAs (primary and secondary)
- Active tab / active selection
- Progress bars and indicators
- Chart data series (focal)
- Link text

### 1.5 Per-App Accent Choice

Accent color itself is an ASK — never assume brand palette. See Router §5.

### 1.6 SwiftUI Accent Color

```swift
// App-wide accent
@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .tint(.brandBlue)  // custom color from Assets
        }
    }
}

// Per-view override
.tint(.accentColor)
```

---

## §2. GRADIENT USAGE

### 2.1 Options

| Option | Description | Best For |
|--------|-------------|----------|
| **No Gradient (Flat)** | Solid colors only | Editorial, utility, high-signal apps |
| **Linear Gradient (Subtle)** | 2–3% brightness shift | Buttons, small surfaces needing depth |
| **Mesh / Aurora Gradient** | Multi-point mesh (iOS 18+ MeshGradient) | Hero surfaces, splash, premium moments |
| **Duotone Wash** | Two-color overlay on imagery | Editorial cards, branded blocks |
| **Radial Gradient** | Center-out gradient | Spotlight effects, glows |
| **Conic / Angular Gradient** | Sweep gradient | Rare — decorative moments |

### 2.2 Rossen Preferred

Linear (baseline) + Mesh/Aurora (hero) + Duotone (editorial). Tiered intensity.

### 2.3 Gradient Decision Tree

```
Need depth / visual interest on a surface?
├── Small element (button, metric pill)?
│   └── Linear Gradient (2-3% brightness shift)
├── Hero surface (splash, onboarding hero, premium badge)?
│   ├── One per screen? → Mesh / Aurora Gradient
│   └── Already have one? → Flat (don't stack aurora)
├── Editorial / branded content block?
│   └── Duotone Wash
├── Standard card or content row?
│   └── NO GRADIENT (flat surface)
└── Background of entire screen?
    ├── Default? → Flat system color
    └── Special moment (onboarding, hero)? → Subtle Linear or Aurora
```

### 2.4 Critical Rules

- **Max 1 Aurora/Mesh per screen** — stacking creates visual chaos
- **Utility apps default to Flat** — gradients are decoration
- **Gradient color must derive from accent palette** — random gradients feel arbitrary
- **Test on older devices** — MeshGradient is iOS 18+; blur/performance check on iPhone SE / 11

### 2.5 Mesh Gradient Fallback (iOS 17 and earlier)

```swift
Group {
    if #available(iOS 18.0, *) {
        MeshGradient(
            width: 3, height: 3,
            points: [
                [0.0, 0.0], [0.5, 0.0], [1.0, 0.0],
                [0.0, 0.5], [0.5, 0.5], [1.0, 0.5],
                [0.0, 1.0], [0.5, 1.0], [1.0, 1.0]
            ],
            colors: [
                .blue, .purple, .pink,
                .indigo, .purple, .rose,
                .blue, .indigo, .purple
            ]
        )
    } else {
        LinearGradient(
            colors: [.blue, .purple, .pink],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}
.ignoresSafeArea()
```

---

## §3. DARK MODE TREATMENT

### 3.1 Options

| Option | Description | Best For |
|--------|-------------|----------|
| **System Adaptive** | Respects user's iOS setting automatically | Default — most apps |
| **True Black Base** | `#000` background, `#111-#1C1C1E` cards | OLED-optimized, content apps |
| **Layered Near-Black** | `#111` base, `#1C1C1E` cards, `#2C2C2E` overlays | System-style apps (Apple default) |
| **Glass / Frosted** | Blur + transparency instead of solid fills | iOS 26 Liquid Glass direction |
| **Dark-Only** | Always dark, no light mode | Premium content, entertainment |
| **Light-Only** | Always light, no dark mode | Rarely appropriate — accessibility concern |

### 3.2 Rossen Preferred

True Black (OLED content) + Layered Near-Black (utility) + Glass/Frosted (overlays). Context-mapped.

### 3.3 Dark Mode Decision Tree

```
Designing a surface in Dark Mode?
├── OLED content screen (media, feed, timer, reading)?
│   └── True Black (#000) base
├── Settings / form / utility screen?
│   └── Layered Near-Black (system hierarchy)
├── Overlay / sheet / modal?
│   └── Glass / Frosted (.thinMaterial or .ultraThinMaterial)
├── Default app surfaces?
│   └── System adaptive (Color(.systemBackground))
└── Tab bar / nav bar over content?
    └── Glass / Frosted backdrop
```

### 3.4 Dark Mode Element Palette

| Element | Light | Dark (True Black) | Dark (Layered) |
|---------|-------|-------------------|----------------|
| Background | `.systemBackground` | `#000000` | `#111111` |
| Card / secondary | `.secondarySystemBackground` | `#1C1C1E` | `#1C1C1E` |
| Overlay / tertiary | `.tertiarySystemBackground` | `#2C2C2E` | `#2C2C2E` |
| Primary text | `.label` | `#FFFFFF` | `#F5F5F7` |
| Secondary text | `.secondaryLabel` | `.secondaryLabel` | `.secondaryLabel` |
| Tertiary text | `.tertiaryLabel` | `.tertiaryLabel` | `.tertiaryLabel` |
| Separator | `.separator` | `.opaqueSeparator` | `.separator` |

### 3.5 System Semantic Colors

Prefer semantic colors over hardcoded hex — they adapt correctly:

```swift
// ✓ DO
.background(Color(.systemBackground))
.foregroundStyle(.primary)
.foregroundStyle(.secondary)

// ✗ DON'T (unless True Black is required)
.background(Color(red: 0, green: 0, blue: 0))
.foregroundStyle(Color(hex: "#333"))
```

### 3.6 Contrast Requirements

- **Normal text:** 4.5:1 minimum (WCAG AA)
- **Large text (≥17pt bold or ≥20pt regular):** 3:1 minimum
- **Interactive elements:** 3:1 minimum against adjacent color
- **Focus indicators:** 3:1 against background

Test both modes with Accessibility Inspector.

---

## §4. ELEVATION & SHADOW SYSTEM

### 4.1 Elevation Token Scale

Not yet A/B tested but recommended as starting point:

| Token | Shadow | Use |
|-------|--------|-----|
| `elevation.none` | No shadow | Flat surfaces, editorial |
| `elevation.subtle` | `0 1pt 2pt / black 4%` | Resting on surface |
| `elevation.low` | `0 2pt 8pt / black 8%` | Raised card |
| `elevation.medium` | `0 4pt 16pt / black 12%` | Floating element (toast, tab bar) |
| `elevation.high` | `0 8pt 24pt / black 16%` | Modal, popover, dropdown |
| `elevation.cta` | `0 6pt 20pt / tint 40%` | Primary button (colored shadow) |

### 4.2 Colored vs. Gray Shadows

- **Gray shadows:** Neutral surfaces, cards, elevation hints
- **Colored shadows (tint-matched):** Primary CTAs, accent elements — colored shadow uses the element's tint at 40-50% opacity

### 4.3 Dark Mode Shadow Adjustment

Shadows are less visible in dark mode. Compensate:
- Increase opacity (from 4% to 12% for subtle, etc.)
- OR switch to elevation via brightness steps instead of shadow

```swift
.shadow(
    color: colorScheme == .dark ? .black.opacity(0.5) : .black.opacity(0.1),
    radius: 8,
    y: 2
)
```

### 4.4 Shadow Application SwiftUI

```swift
// Elevation.low (raised card)
.shadow(color: .black.opacity(0.08), radius: 8, x: 0, y: 2)

// Elevation.medium (floating)
.shadow(color: .black.opacity(0.12), radius: 16, x: 0, y: 4)

// Elevation.cta (colored)
.shadow(color: accentColor.opacity(0.45), radius: 20, x: 0, y: 6)
```

---

## §5. TYPOGRAPHY SYSTEM

### 5.1 Font Family Options

| Option | Description | Best For |
|--------|-------------|----------|
| **SF Pro (System)** | iOS system default | Default — all apps |
| **DM Sans** | Calm Precision brand font | RossLabs brand identity |
| **New York** | iOS system serif | Editorial, reading apps |
| **Custom Display + SF Body** | Signature display font + system body | Premium / branded apps |
| **Monospace** | SF Mono or custom mono | Code, technical, data-heavy |

### 5.2 Rossen Preferred

DM Sans for body/UI per Calm Precision memory. DM Serif Display for display. DM Mono for code.

**Cabinet Grotesk is explicitly banned** per CP memory.

### 5.3 Typography Scale (Apple Semantic)

Use Apple's semantic styles — don't invent a custom scale. Dynamic Type support is automatic.

| Style | Default Size | Weight | Use |
|-------|-------------|--------|-----|
| `.largeTitle` | 34pt | Regular/Bold | L1 page anchor |
| `.title` | 28pt | Regular/Bold | Section headers |
| `.title2` | 22pt | Regular/Bold | Important values |
| `.title3` | 20pt | Regular/Semibold | Subsection headers |
| `.headline` | 17pt | Semibold | List row titles, emphasis |
| `.body` | 17pt | Regular | Primary content |
| `.callout` | 16pt | Regular | Secondary content |
| `.subheadline` | 15pt | Regular | Supporting text |
| `.footnote` | 13pt | Regular | Metadata |
| `.caption` | 12pt | Regular | Timestamps |
| `.caption2` | 11pt | Regular | Smallest allowed |

### 5.4 Display & Heading Tracking

| Option | Description | When |
|--------|-------------|------|
| **Tight Tracking on Headings** | -0.03em to -0.05em | Premium craft (Linear, Arc, Stripe signature) |
| **Default Tracking** | System default | Most apps |
| **Wide Tracking on Headings** | +0.02em or more | Uppercase labels, editorial moments |

**Rossen Preferred:** Tight tracking on headings.

### 5.5 Tracking Scale

| Font Size | Tracking (pt) |
|-----------|---------------|
| ≥34pt (largeTitle) | -1.0pt |
| 28pt (title) | -0.8pt |
| 22pt (title2) | -0.5pt |
| 20pt (title3) | -0.3pt |
| 17pt (headline/body) | 0 (system default) |
| <17pt (caption, footnote) | 0 (never negative at small sizes) |

**Never apply negative tracking to body text or smaller — reduces legibility.**

### 5.6 Custom Font Setup (DM Sans)

```swift
extension Font {
    static func dmSans(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .custom("DMSans-Regular", size: size).weight(weight)
    }
    
    static let cpLargeTitle = Font.custom("DMSans-Bold", size: 34)
    static let cpTitle = Font.custom("DMSans-Bold", size: 28)
    // ... etc
}

// Usage
Text("Your Title").font(.cpLargeTitle).tracking(-1.0)
```

Or use `.fontDesign(.default)` + semantic styles to stay flexible:

```swift
Text("Your Title")
    .font(.largeTitle.bold())
    .fontDesign(.default)  // allows DM Sans if set as app default
    .tracking(-1.0)
```

---

## §6. NUMERIC DISPLAY PATTERNS

### 6.1 Options

| Option | Description | Best For |
|--------|-------------|----------|
| **Standard Numeric** | Same font as surrounding text | Default |
| **Hero Number Display** | 48–64pt thin/regular, small muted label below | Dashboard primary metric |
| **Mixed-Weight Numerics** | Bold integer + regular decimal | Financial, precision values |
| **Monospaced Digits** | `.monospacedDigit()` applied | Changing numbers (timers, counters, stats) |
| **Animated Tick-Up** | Number animates from old to new value | Score, achievement, milestone |

### 6.2 Rossen Preferred

Hero Number + Mixed-Weight (context-mapped).

### 6.3 Numeric Decision Tree

```
Displaying a number?
├── Is this the single primary metric on screen?
│   └── Hero Number Display (48-64pt thin)
├── Does the number have significant decimal precision?
│   └── Mixed-Weight Numerics
├── Is it inline with other content (row value, chart annotation)?
│   └── Standard + .monospacedDigit()
├── Is it changing frequently (timer, counter)?
│   └── .monospacedDigit() (always, regardless of style)
└── Is it a score / milestone change?
    └── Animated Tick-Up
```

### 6.4 SwiftUI Patterns

**Hero Number:**
```swift
struct HeroMetric: View {
    let value: String
    let label: String
    
    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.system(size: 56, weight: .thin))
                .monospacedDigit()
                .tracking(-1.5)
                .foregroundStyle(.primary)
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .tracking(0.5)
        }
    }
}
```

**Mixed-Weight:**
```swift
struct MixedWeightNumber: View {
    let integer: String  // "$1,234"
    let decimal: String  // ".56"
    
    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 0) {
            Text(integer)
                .font(.title.weight(.bold))
                .monospacedDigit()
            Text(decimal)
                .font(.title.weight(.regular))
                .monospacedDigit()
                .foregroundStyle(.secondary)
        }
    }
}
```

**Animated Tick-Up:**
```swift
struct AnimatedNumber: View, Animatable {
    var value: Double
    let format: (Double) -> String
    
    var animatableData: Double {
        get { value }
        set { value = newValue }
    }
    
    var body: some View {
        Text(format(value))
            .monospacedDigit()
            .contentTransition(.numericText())
    }
}

// Usage
AnimatedNumber(value: score) { "\(Int($0))" }
    .font(.largeTitle.bold())
    .animation(.easeOut(duration: 0.8), value: score)
```

---

## §7. SPACING SCALE

### 7.1 8pt Grid (CP 6.4.1 Principle 8)

Every spacing value is a multiple of 4pt (half-grid) or 8pt (full grid).

| Token | Value | Use |
|-------|-------|-----|
| `space.xs` | 4pt | Title to subtitle, tight proximity |
| `space.sm` | 8pt | Between related items in group |
| `space.md` | 12pt | Comfortable spacing between groups |
| `space.lg` | 16pt | Card inner padding, section gaps |
| `space.xl` | 20pt | Section separation |
| `space.2xl` | 24pt | Major section breaks |
| `space.3xl` | 32pt | Page margins, hero spacing |
| `space.4xl` | 48pt | Large breaks between unrelated elements |

### 7.2 Component Spacing Defaults

| Component | Internal Padding | External Spacing |
|-----------|------------------|-------------------|
| Card | 16pt | 10pt between cards |
| List row | 12pt vertical, 16pt horizontal | 0 (divider between) |
| Button | 14pt vertical, 20pt horizontal | 12pt between sibling buttons |
| Form field | 12pt vertical, 16pt horizontal | 16pt between fields |
| Section | 24pt between sections | 8pt between header and content |
| Screen | 16–20pt horizontal margins | — |

---

## §8. CORNER RADIUS SCALE

### 8.1 Radius Tokens

| Token | Value | Use |
|-------|-------|-----|
| `radius.none` | 0pt | Hairlines, structural elements |
| `radius.sm` | 6pt | Chips, pills inline, small badges |
| `radius.md` | 10pt | Standard cards, inputs |
| `radius.lg` | 12pt | Primary buttons |
| `radius.xl` | 14pt | Hero buttons, featured cards |
| `radius.2xl` | 20pt | Sheets (iOS system standard) |
| `radius.3xl` | 28pt | Tab bar pill (at 44pt height) |
| `radius.full` | `Capsule()` | Full-pill elements at any height |

### 8.2 Consistency Rule

Within one app, pick ONE radius per component type. Buttons don't suddenly change from 12pt to 8pt mid-flow.

---

## §9. ICONOGRAPHY

### 9.1 Options

| Option | Description | Best For |
|--------|-------------|----------|
| **SF Symbols Only** | Apple's system symbol library | Default — all apps |
| **SF Symbols + Custom** | System as base, custom for brand/unique concepts | Most production apps |
| **Custom Icon Family** | Full custom icon system | Premium brand-forward apps |
| **Mixed Third-Party** | SF Symbols + a third-party set (Phosphor, Heroicons) | Rare — consistency risk |

### 9.2 Recommended

**SF Symbols Only (default)** with Custom Icons ONLY for app-specific concepts that have no SF Symbol equivalent.

### 9.3 SF Symbol Weight Rules

| Context | Weight |
|---------|--------|
| Navigation chevrons, toolbar icons | `.medium` |
| Standard UI icons | `.regular` |
| Emphasis / active states | `.semibold` |
| Display / hero icons | `.light` or `.regular` |
| Never use | `.heavy`, `.black` — too aggressive for iOS |

### 9.4 SF Symbol Rendering Modes

```swift
Image(systemName: "star.fill")
    .symbolRenderingMode(.monochrome)  // default
    .symbolRenderingMode(.hierarchical)  // depth via opacity tiers
    .symbolRenderingMode(.palette)  // multi-color via foregroundStyle
    .symbolRenderingMode(.multicolor)  // preset multi-color
```

Use:
- `.monochrome` — most UI (default)
- `.hierarchical` — when icon has semantic depth (folder with docs inside)
- `.palette` — when matching brand colors precisely
- `.multicolor` — decorative/celebratory moments

### 9.5 Icon Sizing

| Context | Size |
|---------|------|
| Tab bar | 22pt |
| Toolbar | 18pt |
| List row leading | 20pt |
| Inline with text | Match font size (`.font(.body)` for body text) |
| Hero / empty state | 40–56pt |
| Large symbol display | 64pt+ |

---

## §10. COLOR USAGE RULES

### 10.1 Semantic Status Colors

Per CP 6.4.1 — status shown via text color only, no background boxes:

| Status | Color | Use |
|--------|-------|-----|
| Success | `.green` | "Saved", "Completed" |
| Warning | `.orange` | "Expires soon", caution |
| Error | `.red` | "Failed", "Invalid" |
| Info | `.blue` (or accent) | "Updated", general info |
| Neutral | `.secondary` | Inactive, disabled states |

### 10.2 Chart Colors (for chart work, see Charts doc)

Mirrors the CSS chart palette:
```swift
extension Color {
    static let chart1 = Color.blue
    static let chart2 = Color.teal
    static let chart3 = Color.orange
    static let chart4 = Color.purple
    static let chart5 = Color.pink
    static let chart6 = Color.green
    static let chart7 = Color.red
    static let chart8 = Color.yellow
}
```

### 10.3 Color Rules

1. **Status = text color only** — never colored badges/pills for status
2. **Max 2 icon colors per context** — 3+ creates visual noise
3. **Semantic colors over hardcoded hex** — use `.primary`, `.secondary`, `.tertiary`
4. **Accent colors from the palette** — never random hex values
5. **Test in both modes** — colors that work in light often fail in dark

---

## §11. NOT YET IN CATALOG

- **Color blind palette adjustments** — provide patterns/shapes in addition to color
- **High Contrast Mode overrides** — respect `Environment(\.colorSchemeContrast)`
- **Custom color picker for user personalization** — per-user accent
- **Gradient animation timing** — when gradients animate (rare, case-by-case)

---

*Color, Surface & Typography v1.0*
*Companion: CP 6.4.1 Principles 5, 8*
