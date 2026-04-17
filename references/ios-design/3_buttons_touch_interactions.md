# 3. Buttons, Touch & Interactions

Option catalog for button styles, depth treatments, tap feedback, haptics, toggles, and form controls.

**Read first:** `0_Router.md`
**Companion:** CP 6.4.1 Principle 2 (Size = Importance), Principle 9 (Functional Integrity)

---

## §1. BUTTON SIZING

### 1.1 CP 6.4.1 Principle 2 — Size = Importance

Button size matches user intent weight. This is non-negotiable.

| Intent | Size | SwiftUI |
|--------|------|---------|
| **Core conversion** (sign up, checkout, submit) | Full-width, tall | `.controlSize(.large)` + `.frame(maxWidth: .infinity)` |
| **Primary action per screen** | Prominent, high-contrast | `.buttonStyle(.borderedProminent)` + `.controlSize(.regular)` |
| **Equal choices** (yes/no, keep/discard) | Side-by-side, equal width | Two buttons in HStack, `.frame(maxWidth: .infinity)` each |
| **Quick action** (save, edit, share) | Compact inline | `.buttonStyle(.bordered)` + `.controlSize(.small)` |
| **Tertiary/destructive** | Text-only, distinct | `.buttonStyle(.plain)` + `.foregroundStyle(.red)` for destructive |
| **Icon-only** | Symbol in 44pt target | `Image(systemName:)` + `.frame(width: 44, height: 44)` |

### 1.2 Touch Target Minimums

| Platform | Minimum | Ideal |
|----------|---------|-------|
| iPhone / iPad (touch) | 44×44pt | 48×48pt for primary |
| iPad with pointer | 24×24pt | 32×32pt for comfort |
| macOS | 24×24pt | 28×28pt typical |
| watchOS | 44×44pt | As large as fits |

### 1.3 SwiftUI Button Sizing Patterns

```swift
// Core conversion (full-width primary)
Button("Sign Up") { signUp() }
    .buttonStyle(.borderedProminent)
    .controlSize(.large)
    .frame(maxWidth: .infinity)

// Two equal choices
HStack(spacing: 12) {
    Button("Cancel") { cancel() }
        .frame(maxWidth: .infinity)
    Button("Save") { save() }
        .buttonStyle(.borderedProminent)
        .frame(maxWidth: .infinity)
}
.controlSize(.large)

// Quick action
Button("Edit") { edit() }
    .buttonStyle(.bordered)

// Icon-only with accessibility
Button { share() } label: {
    Image(systemName: "square.and.arrow.up")
        .font(.title3)
}
.frame(width: 44, height: 44)
.accessibilityLabel("Share")
```

---

## §2. BUTTON DEPTH / STYLE

### 2.1 Options

| Option | Description | Best For |
|--------|-------------|----------|
| **Flat (No Depth)** | Solid fill, no shadow | Editorial, minimal, utility |
| **Soft Drop Shadow** | Colored shadow (4–8pt) in button tint | Standard primary (default) |
| **Inner Highlight Rim** | Top lightens, bottom darkens | Hero/signature CTAs |
| **Glass / Frosted** | Blur + transparency + subtle border | CTAs over media/gradient backgrounds |
| **Outlined / Ghost** | Border only, no fill | Secondary actions |
| **Filled with Border** | Solid + 1pt contrasting border | Hybrid — adds definition on busy backgrounds |

### 2.2 Rossen Preferred

Soft Drop Shadow (default) + Inner Rim (hero) + Glass (over media). **Never stack.**

### 2.3 Button Depth Decision Tree

```
Primary CTA styling?
├── On a solid flat background (light or dark solid)?
│   └── Soft Drop Shadow (default)
├── On media / gradient / mesh background?
│   └── Glass / Frosted
├── Hero / signature moment (onboarding primary, purchase)?
│   └── Inner Highlight Rim
├── Editorial / ultra-minimal aesthetic?
│   └── Flat
└── Secondary action (not primary CTA)?
    └── Outlined / Ghost OR .buttonStyle(.bordered)
```

### 2.4 Critical Rule — Mutual Exclusivity

A single button gets ONE depth treatment. Stacking Drop Shadow + Inner Rim + Glass produces over-decoration that violates CP Signal-to-Noise.

### 2.5 SwiftUI Implementations

**Soft Drop Shadow (default primary):**
```swift
struct PrimaryButtonStyle: ButtonStyle {
    let tint: Color
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(tint, in: RoundedRectangle(cornerRadius: 12))
            .foregroundStyle(.white)
            .font(.headline)
            .shadow(
                color: tint.opacity(configuration.isPressed ? 0.2 : 0.45),
                radius: 20, x: 0, y: 6
            )
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}
```

**Inner Highlight Rim (hero):**
```swift
struct HeroButtonStyle: ButtonStyle {
    let tint: Color
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(
                LinearGradient(
                    colors: [tint.opacity(1.15), tint, tint.opacity(0.9)],
                    startPoint: .top, endPoint: .bottom
                ),
                in: RoundedRectangle(cornerRadius: 14)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .inset(by: 0.5)
                    .stroke(
                        LinearGradient(
                            colors: [.white.opacity(0.25), .clear, .black.opacity(0.15)],
                            startPoint: .top, endPoint: .bottom
                        ),
                        lineWidth: 1
                    )
            )
            .foregroundStyle(.white)
            .font(.headline)
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
    }
}
```

**Glass / Frosted (over media):**
```swift
struct GlassButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                .ultraThinMaterial,
                in: RoundedRectangle(cornerRadius: 12)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(.white.opacity(0.25), lineWidth: 1)
            )
            .foregroundStyle(.white)
            .font(.headline)
            .opacity(configuration.isPressed ? 0.8 : 1.0)
    }
}
```

---

## §3. TAP / PRESS FEEDBACK

### 3.1 Options

| Option | Description | iOS-Native? | Best For |
|--------|-------------|-------------|----------|
| **System Default** | `.buttonStyle(.plain)` or automatic | ✅ | Default |
| **Opacity Dim** | Fade to ~45% on press | ✅ | Text links, ghost buttons, icon-only |
| **Background Highlight** | Row bg flashes to gray | ✅ | List rows, cells, navigation targets |
| **Scale Down** | Scale to 0.98 on press | ✅ | Cards, primary buttons |
| **Contained Ripple** | Circular ripple from tap point | ❌ (Material Design origin) | Signature CTAs only (≤3 per app) |
| **Color Flash** | Brief tint color pulse | ✅ | Confirmation actions |

### 3.2 Rossen Preferred

Opacity Dim + Background Highlight + Contained Ripple (context-gated).

### 3.3 Tap Feedback Decision Tree

```
Element is tappable — what feedback?
├── Is it a text link or icon-only button (no filled background)?
│   └── Opacity Dim (0.45 at 80ms, return 1.0 at 180ms)
├── Is it a list row or navigation target?
│   └── Background Highlight (flash to gray at 50ms, return 150ms)
├── Is it a card (tappable container)?
│   └── Scale Down (0.98, 150ms ease-out)
├── Is it a primary CTA / signature moment?
│   └── Contained Ripple (≤3 per app — reserve for key moments)
├── Is it a standard primary button?
│   └── Scale Down + existing button style
└── Is it a system control (UISwitch, Slider, Stepper)?
    └── System Default — don't override
```

### 3.4 Ripple Cap

Contained Ripple is non-native. Apply sparingly:
- Maximum 3 ripple-enabled buttons per app
- Only on primary CTAs in signature moments (onboarding primary, purchase confirm, hero action)
- If you're adding a 4th ripple button, revisit whether it's actually signature

### 3.5 SwiftUI Feedback Styles

**Opacity Dim:**
```swift
struct OpacityDimStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.45 : 1.0)
            .animation(
                .easeOut(duration: configuration.isPressed ? 0.08 : 0.18),
                value: configuration.isPressed
            )
    }
}
```

**Background Highlight (Row):**
```swift
struct RowHighlightStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(
                configuration.isPressed
                    ? Color(.systemGray5)
                    : Color.clear
            )
            .animation(
                .easeOut(duration: configuration.isPressed ? 0.05 : 0.15),
                value: configuration.isPressed
            )
    }
}
```

**Scale Down:**
```swift
struct ScaleDownStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}
```

---

## §4. HAPTIC FEEDBACK

### 4.1 Options

| Option | Description | API | When |
|--------|-------------|-----|------|
| **Key Moments Only (Restrained)** | Haptic only on destructive/success/error | `UINotificationFeedbackGenerator` | Default for all apps |
| **Standard UI Haptics** | Also haptic on selection, toggle, tap | `UISelectionFeedbackGenerator`, `UIImpactFeedbackGenerator` | Consumer/habit apps |
| **Custom CHHaptic Patterns** | Composed waveforms, textures, patterns | `CHHapticEngine` | Premium/signature moments only |
| **No Haptics** | Silent throughout | — | Rare — meditation apps at user's request |

### 4.2 Rossen Preferred

Key Moments Only (baseline) + Custom CHHaptic (premium moments only).

### 4.3 Haptic Event Catalog

| Event | Haptic | Generator |
|-------|--------|-----------|
| Destructive confirm | `.notification(.warning)` | UINotificationFeedbackGenerator |
| Success completion | `.notification(.success)` | UINotificationFeedbackGenerator |
| Error | `.notification(.error)` | UINotificationFeedbackGenerator |
| Selection change | `.selectionChanged()` | UISelectionFeedbackGenerator |
| Tap (light) | `.impactOccurred()` light | UIImpactFeedbackGenerator (.light) |
| Tap (medium) | `.impactOccurred()` medium | UIImpactFeedbackGenerator (.medium) |
| Milestone / streak | Custom CHHaptic crescendo | CHHapticEngine |
| Audio scrub | Continuous CHHaptic texture | CHHapticEngine |
| Threshold reach | Custom CHHaptic stretch+snap | CHHapticEngine |

### 4.4 Haptic Decision Tree

```
Building an interaction — does it warrant haptic?
├── Is it destructive / success / error?
│   └── YES → Standard UINotificationFeedbackGenerator
├── Is it a selection change in picker / segmented / toggle?
│   └── YES → UISelectionFeedbackGenerator.selectionChanged()
├── Is it a signature moment (completion, milestone, scrub, threshold)?
│   ├── Standard haptic sufficient? → Use standard
│   └── Physical metaphor enhances it? → Custom CHHaptic pattern
└── Is it a standard tap, scroll, or button press?
    └── NO haptic (Key Moments rule)
```

### 4.5 Haptic Spec Rules

- **Pair with visual feedback** — never haptic-only (accessibility)
- **Pre-warm generators:** `generator.prepare()` before expected use
- **Respect `accessibilityReduceMotion`** for non-critical haptics
- **Don't overuse** — haptic fatigue degrades experience
- **watchOS uses WKInterfaceDevice** — different API

### 4.6 SwiftUI Haptic Patterns

```swift
// Standard notification
Button("Save") {
    UINotificationFeedbackGenerator().notificationOccurred(.success)
    save()
}

// Selection change (toggle, picker)
.onChange(of: selectedMode) {
    UISelectionFeedbackGenerator().selectionChanged()
}

// iOS 17+ native haptic modifier
Button("Save") { save() }
    .sensoryFeedback(.success, trigger: saveCompleted)
```

---

## §5. TOGGLE & SWITCH PATTERNS

### 5.1 Options

| Option | Description | Best For |
|--------|-------------|----------|
| **Native UISwitch** | Standard iOS `Toggle` | Settings, preferences, any binary on/off |
| **Spring Stretch Thumb** | Custom toggle, thumb stretches on slide | Signature moment — feature/mode toggle |
| **Segmented Pill Slider** | Pill slides between 2–4 labeled segments | Mode switching, view toggles |
| **Checkbox → Checkmark Morph** | Circle morphs to check with pop | Task completion, to-do lists |
| **Radio Button Group** | Circles with filled-center selection | Multi-exclusive choice (5+ options) |
| **Chip / Tag Selection** | Selectable pills in a row | Multi-select filters, tags |

### 5.2 Rossen Preferred

All four: Native UISwitch (default) + Spring Stretch (signature) + Segmented Pill (modes) + Checkbox Morph (tasks).

### 5.3 Toggle Decision Tree

```
Building a control?
├── Binary (on/off)?
│   ├── Standard setting in a settings list → Native UISwitch
│   └── Feature/mode toggle worth craft investment → Spring Stretch Thumb
├── 2-4 mutually exclusive options?
│   └── Segmented Pill Slider
├── Task completion (done/not done)?
│   └── Checkbox → Checkmark Morph
├── Multi-exclusive 5+ options?
│   └── Radio Button Group OR Picker
└── Multi-select (can pick many)?
    └── Chip / Tag Selection
```

### 5.4 Rule — Signature Toggle Cap

Maximum ONE Spring Stretch Thumb per screen. Standard settings use `Toggle` (UISwitch). Don't pepper custom toggles where users expect system control.

### 5.5 SwiftUI Patterns

**Native:**
```swift
Toggle("Notifications", isOn: $notificationsEnabled)
```

**Segmented:**
```swift
Picker("View", selection: $viewMode) {
    Text("List").tag(ViewMode.list)
    Text("Grid").tag(ViewMode.grid)
    Text("Card").tag(ViewMode.card)
}
.pickerStyle(.segmented)
```

**Checkbox Morph (custom):**
```swift
struct CheckboxToggle: View {
    @Binding var isChecked: Bool
    
    var body: some View {
        Button {
            withAnimation(.spring(duration: 0.3, bounce: 0.3)) {
                isChecked.toggle()
            }
            UISelectionFeedbackGenerator().selectionChanged()
        } label: {
            ZStack {
                Circle()
                    .stroke(isChecked ? Color.accentColor : .secondary, lineWidth: 2)
                    .frame(width: 24, height: 24)
                if isChecked {
                    Circle()
                        .fill(Color.accentColor)
                        .frame(width: 24, height: 24)
                    Image(systemName: "checkmark")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                }
            }
            .scaleEffect(isChecked ? 1.0 : 1.0)
        }
        .buttonStyle(.plain)
    }
}
```

---

## §6. FORM FIELD PATTERNS

### 6.1 Options

| Option | Description | Best For |
|--------|-------------|----------|
| **Rounded Border** | Standard iOS `.textFieldStyle(.roundedBorder)` | Default — any form |
| **Underline** | Bottom line only | Minimal / editorial |
| **Floating Label** | Label starts in-field, floats on focus | Material Design origin, less iOS-native |
| **Label Above** | Label always visible above field | Clear, accessible |
| **Grouped Section** | Fields in `List` with `.insetGrouped` style | iOS Settings-style forms |
| **Inline Placeholder Only** | Placeholder IS the label | Minimal — accessibility risk |

### 6.2 Recommended Defaults (Not Yet A/B Tested)

Until preferences are captured, use these archetype-based defaults:

| Archetype | Field Style | Label Position |
|-----------|-------------|----------------|
| Utility | Rounded Border | Label Above |
| Content/Feed | Rounded Border | Label Above or Placeholder |
| Productivity | Grouped Section (Settings-style) | Label Above |
| Consumer/Habit | Rounded Border (possibly custom) | Floating Label (playful) |
| Editorial | Underline | Label Above |
| Tool/Pro | Grouped Section | Label Above |

### 6.3 Form Field States

Every form field must handle:
- **Default** — empty, no interaction
- **Focus** — user tapped, cursor visible, border emphasis
- **Filled** — has value, validated
- **Error** — inline error below field, red border
- **Disabled** — greyed out, non-interactive
- **Read-only** — value visible but uneditable

### 6.4 Error Display

Per CP 6.4.1 error routing (what → why → fix):

```swift
struct ValidatedField: View {
    @Binding var text: String
    let label: String
    let placeholder: String
    let error: String?
    
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            
            TextField(placeholder, text: $text)
                .textFieldStyle(.roundedBorder)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(error != nil ? Color.red : Color.clear, lineWidth: 1)
                )
            
            if let error {
                HStack(spacing: 4) {
                    Image(systemName: "exclamationmark.circle.fill")
                        .font(.caption2)
                    Text(error)
                        .font(.caption)
                }
                .foregroundStyle(.red)
            }
        }
    }
}
```

### 6.5 Keyboard Behavior

| Setting | Default |
|---------|---------|
| Dismiss on scroll | `.scrollDismissesKeyboard(.interactively)` on all forms |
| Return key label | `.submitLabel(.next)` or `.submitLabel(.done)` — match semantics |
| Numeric inputs | `.keyboardType(.numberPad)` + toolbar Done button |
| Email inputs | `.keyboardType(.emailAddress)` + `.textContentType(.emailAddress)` |
| Password inputs | `SecureField` + `.textContentType(.password)` for autofill |
| Avoid keyboard | `.safeAreaInset(edge: .bottom)` or `.scrollContentBackground(.hidden)` with adjusted padding |

### 6.6 Keyboard Toolbar Accessory

Add a Done button above the keyboard for numeric/decimal inputs (no Return key to dismiss):

```swift
TextField("Amount", value: $amount, format: .currency(code: "USD"))
    .keyboardType(.decimalPad)
    .toolbar {
        ToolbarItemGroup(placement: .keyboard) {
            Spacer()
            Button("Done") { hideKeyboard() }
        }
    }
```

---

## §7. BUTTON LABELS (VOICE CALIBRATION)

### 7.1 CP 6.4.1 Principle 13 — Voice Rules

| Element | Pattern | Max | Example |
|---------|---------|-----|---------|
| Primary CTA | Verb + Object | ≤3 words | "Start Focus" |
| Destructive | Verb + Object + consequence | ≤5 words | "Delete 3 Sessions" |
| Cancel/dismiss | Single word | 1 word | "Cancel" (system expectation) |
| Toolbar action | Single word (icon usually primary) | 1 word | "Done", "Share" |
| Tab label | Single noun | 1 word | "Home", "Library" |

### 7.2 Button Voice Rules

1. **Always Verb + Object** for CTAs — "Save Changes", not "OK"
2. **Destructive buttons name what's destroyed** — "Delete 3 Sessions" not "Delete"
3. **No "Submit", "OK", "Yes"** unless system context (alerts accept OK)
4. **No click/tap references** — "Click Here to Save" → "Save"
5. **Accessibility labels describe the action**, not the icon — `.accessibilityLabel("Share session summary")` not `"Share button"`

### 7.3 Examples

```swift
// ✓ DO
Button("Start Focus", action: start)
Button("Save Changes", action: save)
Button("Delete", role: .destructive, action: delete)

// Destructive with count
Button("Delete \(count) Sessions", role: .destructive, action: delete)

// Icon-only with accessibility
Button(action: share) {
    Image(systemName: "square.and.arrow.up")
}
.accessibilityLabel("Share session summary")

// ✗ DON'T
Button("Click Here to Begin Your Focus Session", action: start)
Button("OK", action: save)
Button("Yes", role: .destructive, action: delete)
```

---

## §8. BUTTON PLACEMENT CONVENTIONS

### 8.1 iOS Placement Rules

| Action | Position |
|--------|----------|
| Primary CTA | Bottom of screen OR inline with relevant content |
| Secondary/tertiary | Below primary, stacked or inline |
| Cancel (destructive flow) | Top-left (toolbar) |
| Save / confirm (modal) | Top-right (toolbar), bolded |
| Back navigation | Top-left (chevron + parent) |
| Close modal | Top-right (X circle) |
| Settings / menu | Top-right (gear icon) |
| Add / compose | Top-right OR bottom-right floating |

### 8.2 Two-Button Patterns

| Pattern | Layout | When |
|---------|--------|------|
| **Cancel / Save** | Cancel top-left, Save top-right | Modal forms |
| **Primary / Secondary** | Primary full-width, secondary below | Onboarding, focused actions |
| **Equal Choice** | Two buttons side-by-side equal width | Yes/no, keep/discard |
| **Destructive + Cancel** | Destructive on top, Cancel below | Confirmation flows |

### 8.3 Three-Button Limit

Avoid 4+ buttons visible at once (Hick's Law). If needed:
- Move secondary actions to a menu (`.menu`)
- Use progressive disclosure (reveal on interaction)
- Use a context menu (long-press)

---

## §9. SPECIFIC CONTROL PATTERNS

### 9.1 Stepper (Numeric Increment)

```swift
Stepper("Duration: \(duration) min", value: $duration, in: 5...60, step: 5)
```

Use for: small numeric changes (5–10 steps). Replace with TextField for larger ranges.

### 9.2 Slider (Continuous Value)

```swift
Slider(value: $brightness, in: 0...1) {
    Text("Brightness")
} minimumValueLabel: {
    Image(systemName: "sun.min")
} maximumValueLabel: {
    Image(systemName: "sun.max")
}
```

Use for: continuous values where exact number is less important than relative position.

### 9.3 Date Picker

```swift
DatePicker("Start Date", selection: $date, displayedComponents: [.date])
    .datePickerStyle(.compact)
```

Styles:
- `.compact` — small field, tap to expand wheel
- `.graphical` — full calendar view (iPad, detail screens)
- `.wheel` — classic wheel picker (rarely best choice)

### 9.4 Picker (Selection from List)

```swift
Picker("Category", selection: $category) {
    ForEach(categories) { cat in
        Text(cat.name).tag(cat)
    }
}
.pickerStyle(.menu)  // or .inline, .wheel, .segmented
```

Pick style by context:
- `.menu` — default, popup list
- `.navigationLink` — push to picker screen
- `.inline` — expanded inline in a Form
- `.wheel` — iOS classic (use sparingly)
- `.segmented` — 2–4 options, all visible

---

## §10. NOT YET IN CATALOG

- **Drag-and-drop reorder handles** — `.onMove(perform:)` with `EditButton`
- **Context menus (long-press)** — `.contextMenu { ... }`
- **Menu buttons (dropdown)** — `Menu { ... } label: { ... }`
- **Custom gestures beyond swipe** — pinch-to-zoom, rotation, magnification
- **Pull-down menus in toolbars** — `Menu` in `ToolbarItem`

---

*Buttons, Touch & Interactions v1.0*
*Companion: CP 6.4.1 Principles 2, 9, 13*
