# 1. Navigation & Structure

Option catalog for navigation patterns, screen transitions, modals/sheets, and page-level hierarchy.

**Read first:** `0_Router.md` — classify archetype before using this file
**Companion:** `Calm_Precision_iOS_v1.1_Patch.md` §C (Page Hierarchy fundamentals)

---

## §0. TASK ECONOMY (FOUNDATION)

Before any nav structure decision, apply CP 6.4.2 Principle 14: Task Economy.

### 0.1 One Clear Action Per Screen

**Every screen has exactly one primary action** that accomplishes its key task.

Checklist for every screen:
- [ ] What is the single primary task this screen enables?
- [ ] Is the primary action visually dominant?
- [ ] Would a user know what to do in <3 seconds of looking?

If any answer is "no" or "it depends," redesign before building.

### 0.2 Step-Counting Before Building

For every task flow, count steps BEFORE designing:

1. **Define the outcome** — what is the user trying to accomplish?
2. **Count the theoretical minimum** — what's the floor?
3. **Count the current design** — what does it actually take?
4. **Look for cuts** — smart defaults, combined actions, inference
5. **Document in output** — report counts per §4 of Router

Budgets (from CP 6.4.2 §14.4):

| Task Type | Step Budget |
|-----------|-------------|
| Start a core feature | 1 step |
| Create a simple item | 2–3 steps |
| Edit existing item | 2 steps |
| Complete a task | 1 step |
| Delete an item | 2 steps |
| Share | 2–3 steps |
| Change a setting | 2 steps |
| Search | 2 steps |
| Sign in (returning) | 1 step (biometric) |
| Sign in (new) | 2–3 steps |

### 0.3 Validate Before Adding

Before adding ANY optional element to a navigation or screen:
- Describe what the screen looks like WITHOUT it
- Describe the case FOR adding it
- Ask the user

**Especially validate when adding:**
- Secondary/tertiary actions to screens with clear primary
- Confirmation dialogs on non-destructive actions
- Settings screens (can this be inferred instead?)
- "Welcome" or explainer screens before the feature
- Extra navigation tiers (can this flatten?)

### 0.4 Common Nav Step-Bloat Patterns

| Anti-Pattern | Fix |
|--------------|-----|
| Hamburger drawer → menu → screen → feature | Flatten to tab bar; put common features one tap away |
| Required login before trying the app | Value-first: let users try, ask for auth only when required |
| Confirmation on every navigation (leave page?) | Save state automatically; only confirm truly destructive |
| "Choose a mode" screen before action | Use last-used default; allow override inline |
| Separate screens for related settings | Group under one screen with sections |
| Deep navigation trees (5+ levels) | Flatten; use sheets for drill-downs from feeds |
| Modal → modal → modal | Redesign flow; stacked modals signal wrong nav model |

### 0.5 Apply These Throughout This File

Every option in this file should be evaluated against Task Economy. When the domain file offers multiple valid options, tiebreak with: **which option supports fewer steps to task completion?**

---

## §1. TAB BAR STYLE

### 1.1 Options

| Option | Description | Best For |
|--------|-------------|----------|
| **Standard iOS Tab Bar** | Native `TabView`, bottom edge-attached, labels + icons, system blur | Utility, Productivity, Tool/Pro — when users expect platform-native behavior |
| **Floating Pill Bar** | Detached pill floating 12pt above bottom, blur background, rounded | Consumer/Habit, Content/Feed — when design expressiveness matters |
| **Auto-Hiding on Scroll** | Hides on scroll-down, reappears on scroll-up (can combine with any other style) | Content/Feed, Editorial — maximize content area |
| **Icon Only (Minimal)** | No labels, active state uses fill variant + color | Editorial, minimal apps, ≤4 tabs |
| **Hidden / No Tab Bar** | Single-view app or drawer-based nav | Utility (single-function), some Editorial |
| **Pill Segmented (Top)** | Top-anchored segmented control instead of bottom tabs | Rare — only when the app has <4 modes and they're viewed at-a-glance |

### 1.2 Rossen Preferred

You selected Floating Pill + Auto-Hide + Icon Only as a combined system. Use when archetype fits and ≤4 top-level sections exist.

### 1.3 When to Combine vs. Pick One

- Standard iOS + Auto-Hide: ✅ valid combination (Medium, YouTube pattern)
- Floating Pill + Auto-Hide + Icon Only: ✅ valid (your preferred combo)
- Floating Pill + Labels: ✅ valid (reduces icon-literacy demand)
- Standard iOS + Icon Only: ❌ avoid (breaks iOS user expectation of labels)

### 1.4 Active Tab Indicator

| Option | Description |
|--------|-------------|
| **Color Fill + Label Color** | SF Symbol `.fill` variant + accent color on label. Native iOS expectation. |
| **Underline** | Thin bar under active icon. Less common on iOS, common on Android |
| **Background Pill** | Accent-tinted rounded background behind active icon. Works with icon-only |
| **Dot Above Icon** | Small dot indicator. Minimalist signature |
| **Bold Weight Swap** | Weight change on active (regular → semibold). Subtle |

**Preferred:** Color Fill + Label Color. If using Icon-Only tabs, combine with subtle Background Pill (accent at 12% opacity).

### 1.5 Tab Bar Decision Tree

```
How many top-level sections?
├── 5+ → Standard iOS with labels (icon-only unreadable at 5+)
├── 4 or fewer
│   ├── Consumer/Habit or Content/Feed archetype?
│   │   └── Floating Pill + Icon Only (+ Auto-Hide for content apps)
│   ├── Utility or Productivity?
│   │   └── Standard iOS with labels
│   └── Editorial or minimal?
│       └── Floating Pill + Icon Only OR Hidden
└── 1 → No tab bar (single-view app)
```

### 1.6 Implementation Notes

Floating Pill Bar needs:
- `.safeAreaInset(edge: .bottom) { Color.clear.frame(height: 70) }` on scroll content to prevent content hiding behind bar
- Blur backdrop via `.ultraThinMaterial` or `.thinMaterial` in `Capsule()`
- Thin `.white.opacity(0.1)` stroke for edge definition on dark backgrounds
- Accessibility labels mandatory (no visible labels means VoiceOver needs them)

Auto-Hide behavior:
- Track scroll offset with threshold (30pt movement) to prevent jitter
- Always show when tab switches (don't reuse last scroll state)
- Disable when modal/sheet is presented (tab bar hidden anyway)

---

## §2. BACK NAVIGATION PATTERNS

### 2.1 Options

| Option | Description | Best For |
|--------|-------------|----------|
| **Back + Parent Title** | `← Settings` — chevron + parent screen name | Hierarchical push (iOS HIG default) |
| **X Close Button** | `×` top-right, circular background | Modal, sheet, full-screen cover |
| **Text Back ("Cancel")** | Text button "Cancel" top-left | Form editing, destructive flows |
| **Gesture Only (no UI)** | Swipe-back only, no visible button | Minimal apps (rare — discoverability risk) |
| **Custom Icon Back** | Brand-specific back icon | Signature apps with strong visual identity |

### 2.2 Rossen Preferred

Context-split: Back + Parent Title for hierarchical push; X Close for modal/sheet.

### 2.3 Why the Split

`←` and `×` signal different things:
- `←` = "going back to where I came from in a sequence"
- `×` = "closing this overlay, returning to base context"

Using both consistently teaches users to predict outcomes. Never use `×` for hierarchical back or `←` for modal close.

### 2.4 Back Navigation Decision Tree

```
Screen is being dismissed — which affordance?
├── Part of a NavigationStack (pushed)?
│   └── Back + Parent Title (top-left) + swipe-from-edge
├── Presented as .sheet, .fullScreenCover, or .popover?
│   ├── Standard modal → X Close (top-right)
│   ├── Form with unsaved changes → "Cancel" text + confirmation
│   └── Destructive flow → disable swipe-dismiss, explicit X
├── Single root view (no stack, no modal)?
│   └── No back button (nothing to go back to)
└── Custom context (custom transition app)?
    └── Match the transition's spatial metaphor
```

### 2.5 Spec Details

**Back + Parent Title:**
- `chevron.backward` SF Symbol
- Parent title from `.navigationTitle()` on root
- Truncate at 80pt — longer titles show leading characters + ellipsis
- Always enable swipe-right-from-edge (never `.navigationBarBackButtonHidden(true)` without replacement)

**X Close:**
- `xmark` or `xmark.circle.fill` (with background for visibility)
- 28×28pt target with `Color(.tertiarySystemFill)` background
- `.accessibilityLabel("Close")`

---

## §3. SCREEN TRANSITION STYLES

### 3.1 Options

| Option | Description | Best For |
|--------|-------------|----------|
| **Slide Push** | New screen slides in from right, previous slides left | Hierarchical drill-down (default NavigationStack) |
| **Slide Up (Modal)** | Screen slides up from bottom, swipe-down dismisses | Modal layers, sheets |
| **Hero Expansion** | Tapped card/element expands to fill screen (shared element transition) | When tapped element visually anchors the next screen |
| **Cross-Fade** | Screens dissolve, no directional implication | Tab switches, non-hierarchical swaps, auth state changes |
| **Flip / 3D** | Screen flips on axis to reveal next | Rare — card flip metaphor only |
| **Instant Swap** | No animation, immediate replacement | Power-user contexts, debugging |
| **Zoom Fade** | Scale + fade combination | Onboarding, hero moments |

### 3.2 Rossen Preferred

All four primary options (Slide Push, Slide Up, Hero Expansion, Cross-Fade) based on context.

### 3.3 Transition Decision Tree

```
Presenting a new screen?
├── Tab bar selection changed?
│   └── Cross-Fade (200ms ease-in-out)
├── Auth state / app root changed?
│   └── Cross-Fade
├── Tapped element has a defining image anchoring next screen?
│   └── Hero Expansion (matchedGeometryEffect / .zoom navigation transition)
├── Temporary layer (modal, sheet, overlay)?
│   └── Slide Up
└── Drilling deeper in navigation stack?
    └── Slide Push (default, 300ms ease-out)
```

### 3.4 Timing Standards

| Transition | Duration | Easing |
|------------|----------|--------|
| Slide Push | 300ms | ease-out |
| Slide Up | 350ms | spring (0.7 damping) |
| Hero Expansion | 350ms | spring (0.8 damping) |
| Cross-Fade | 200ms | ease-in-out |
| Instant Swap | 0ms | — |

Consistency across an app matters more than exact values. Pick timings once and reuse.

### 3.5 iOS Version Notes

- `matchedTransitionSource` + `.navigationTransition(.zoom)` requires iOS 18+
- iOS 17 fallback: `matchedGeometryEffect` + custom `AnyTransition`
- Cross-Fade: `.transition(.opacity)` works on all versions

---

## §4. SHEETS, MODALS & OVERLAYS

### 4.1 Sheet Detent Behavior

| Option | Description | Best For |
|--------|-------------|----------|
| **Single Detent (Medium)** | Opens to ~50%, no drag between sizes | Focused single action |
| **Single Detent (Large)** | Opens full-screen with rounded top corners | Form/edit flows |
| **Two-Stop Snap (30%/85%)** | Snaps between compact and expanded | Browse + act (Maps pattern) |
| **Three-Stop (Small/Medium/Large)** | Multiple levels | Dense info apps — rare |
| **Free Drag (No Snap)** | Continuous resize | Rare — disorienting |
| **Adaptive Height** | Sheet sizes to content | Short menus, action sheets |

### 4.2 Rossen Preferred

Two-Stop Snap (~30% / ~85%).

### 4.3 Sheet Handle Style

| Option | Description | Best For |
|--------|-------------|----------|
| **No Handle (Invisible Drag)** | Draggable but no visual affordance | Minimal apps |
| **Light Pill (Standard)** | 36pt × 5pt pill, `.secondary` color | Light mode sheets |
| **Dark Pill on Card** | Same pill, lighter opacity on dark sheets | Dark sheets, media apps |
| **Full Top Bar with Handle** | Pill + title + close button header | Complex task sheets (forms, multi-step) |
| **Grabber + Title Bar** | Smaller grabber above a title | Balance between minimal and labeled |

### 4.4 Rossen Preferred

Context-split: Dark Pill for simple sheets; Full Top Bar for complex sheets.

### 4.5 Sheet Decision Tree

```
What's inside the sheet?
├── Single focused action (confirm, select)?
│   └── Single Detent Medium + Dark Pill handle
├── Short list / menu (5-8 items)?
│   └── Adaptive height + Dark Pill handle
├── Form / multi-step flow?
│   └── Large detent + Full Top Bar (title + close + handle)
├── Browse/search + primary action (Maps pattern)?
│   └── Two-Stop Snap + Dark Pill
└── Media preview (photo, video detail)?
    └── Large or Full-screen + Dark Pill
```

### 4.6 Sheet Spec Details

```swift
.sheet(isPresented: $isPresented) {
    SheetContent()
        .presentationDetents([.fraction(0.30), .fraction(0.85)])
        .presentationDragIndicator(.visible)
        .presentationBackgroundInteraction(.enabled(upThrough: .fraction(0.30)))
}
```

**Rules:**
- Always include `.presentationDragIndicator(.visible)` unless using Full Top Bar pattern
- `.presentationBackgroundInteraction(.enabled)` at compact detent only — disable at expanded
- Disable swipe-to-dismiss for destructive flows via `.interactiveDismissDisabled()`

### 4.7 Full-Screen Cover vs. Sheet

| Use | Pattern |
|-----|---------|
| Focused flow that takes over | `.fullScreenCover` — no background peek |
| Modal that preserves base context | `.sheet` — base content visible |
| Onboarding first-run | `.fullScreenCover` — commit user to flow |
| Edit form, reply, compose | `.sheet` — user can reference origin |

### 4.8 Confirmation Dialogs & Alerts

| Option | Description | When |
|--------|-------------|------|
| **System Alert** | Native UIAlertController, title + message + buttons | Standard confirmations, iOS-expected |
| **System Confirmation Dialog** | Action sheet style, from bottom on iPhone | Destructive choice from button tap |
| **Custom Modal Dialog** | Custom sheet/popover with rich content | When system alert lacks needed expressiveness |
| **Inline Confirmation** | Confirmation bar appears near action | Power-user pattern for destructive list actions |

**Default:** Use system alerts/confirmations for standard iOS experiences. Custom only when system capabilities are insufficient.

---

## §5. PAGE-LEVEL HIERARCHY

### 5.1 The Four Attention Levels

Extends CP 6.4.1 Principle 3. Every screen has four levels of visual attention:

| Level | Role | iOS Implementation |
|-------|------|-------------------|
| **L1 Anchor** | One per screen. First thing eye hits. | `.font(.largeTitle.bold())` or `.font(.title.bold())` |
| **L2 Orient** | Navigation, controls. Where am I? | Toolbar, segmented controls, tab bar |
| **L3 Primary Content** | Reason user came. ≥60% viewport. | List, ScrollView, main content area |
| **L4 Supporting** | Aids L3. Hideable on mobile. | Sidebar (iPad), metadata, footer |

### 5.2 Platform Variants

**iPhone (compact):**
- L1 explicit at top, below safe area
- L2 as toolbar + optional segmented control
- L3 fills remaining vertical space
- L4 hidden or collapsed into disclosure

**iPad (regular):**
- L1 explicit or sidebar-based
- L2 as toolbar + sidebar navigation
- L3 as primary column (≥60% width)
- L4 as inspector column (visible)

**watchOS:**
- L1 compressed to `.headline` (not largeTitle)
- L2 mostly implicit (page within TabView)
- L3 fills available space
- L4 typically omitted

### 5.3 Hierarchy Rules

1. **Exactly one L1 per screen.** Multiple L1s = no anchor.
2. **L2 must be visually subordinate to L1.** If nav dominates page title, hierarchy broken.
3. **L3 gets ≥60% of viewport on iPhone.** If L2+L4 > 40%, content suffocated.
4. **L4 must hide gracefully on compact width.** If it breaks without L4, it's actually L3 — promote it.

### 5.4 Common Violations

| Violation | Fix |
|-----------|-----|
| NavigationTitle + custom H1 both large | Hide `.navigationTitle("")`, keep only custom L1 |
| 5+ tab bar items competing with page title | Reduce to 4, or convert some to drill-down |
| Inspector sidebar on iPhone | Hide on compact, show in sheet instead |
| Three metric cards same size at top | Elevate one as L1, others become L3 |
| Toolbar buttons same visual weight as nav title | Tone down toolbar tint |

### 5.5 SwiftUI Pattern

```swift
NavigationStack {
    ScrollView {
        // L1 Anchor — one per screen
        VStack(alignment: .leading, spacing: 4) {
            Text("This Week").font(.largeTitle.bold())
            Text("March 10 – March 16").font(.subheadline).foregroundStyle(.secondary)
        }
        .padding(.horizontal)
        .frame(maxWidth: .infinity, alignment: .leading)
        
        // L3 Primary Content
        LazyVStack(spacing: 12) {
            ForEach(items) { item in ItemRow(item: item) }
        }
        .padding(.horizontal)
    }
    .navigationTitle("")  // Hide — we have our own L1
    .toolbar {
        // L2 Orient
        ToolbarItem(placement: .topBarTrailing) {
            Button(action: {}) { Image(systemName: "gearshape") }
        }
    }
}
```

---

## §6. SEARCH PLACEMENT

### 6.1 Options

| Option | Description | Best For |
|--------|-------------|----------|
| **In Nav Bar (Scrolls Away)** | Below large title, scrolls off. Pull-down to reveal. | iOS HIG default. Secondary search. |
| **Sticky Top Bar** | Fixed top, always visible. 44–56pt permanent. | Primary search. Library/list-heavy apps. |
| **Dedicated Search Tab** | Tab bar slot for full search experience | Discovery-primary apps (Pinterest, X) |
| **Inline Search Field** | Search field within content, context-specific | Filter within a list |
| **Hidden Behind Icon** | Magnifying glass in toolbar, expands on tap | When search is rare |

### 6.2 Search Decision Tree

```
Where does search live?
├── Primary way users find content?
│   └── Dedicated Search Tab
├── Always needed on this screen (library, list)?
│   └── Sticky Top Bar
├── Useful but secondary (contacts, settings)?
│   └── In Nav Bar, Scrolls Away
├── Filter within a visible list?
│   └── Inline Search Field
└── Rarely needed?
    └── Hidden Behind Icon in toolbar
```

### 6.3 Mixed Usage

One app can use multiple patterns across tabs — "Discover" tab uses Dedicated Search, "Library" tab uses In Nav Bar. Consistency within a tab matters more than across tabs.

---

## §7. NAVIGATION STYLE BY APP TYPE

### 7.1 Single-Focus Apps (Timer, Meditation, Camera)

**Pattern:** No `NavigationStack` in main view
- Bottom quick-access strip for secondary screens
- `.sheet()` with detents for all overlays
- Mode switching via horizontal carousel or segmented control

### 7.2 Content-Browser Apps (Feed, Email, Messages)

**Pattern:** `NavigationStack` with drill-down
- `NavigationStack` + `.navigationDestination(for:)`
- `NavigationSplitView` for iPad/Mac
- Stack depth ≤ 3 levels ideal

### 7.3 Multi-Section Apps (Social, Productivity)

**Pattern:** Tab bar + per-tab NavigationStack
- Each tab has its own stack
- State preserved per tab
- Root screen of each tab is self-contained

### 7.4 Workflow Apps (Creation, Editing)

**Pattern:** Modal-dominant
- Main screen shows artifacts
- Creation/editing happens in `.sheet` or `.fullScreenCover`
- Save/cancel explicit in modal toolbar

---

## §8. OPTIONS NOT YET IN ANY CATALOG

These are common iOS navigation patterns that haven't been A/B tested but are worth considering per-app:

- **Drawer/Hamburger menu** — generally discouraged on iOS (hides primary nav); valid for very-deep-nav apps
- **Bottom action sheet as primary nav** — rare, sometimes used for action-first apps (photo editors)
- **Toolbar + floating action button** — Android-native pattern, occasionally adapted on iOS
- **Breadcrumb navigation** — rare on mobile, more iPad/Mac
- **Section index (A-Z sidebar)** — Contacts-style, contextual to alphabetical lists

If one of these fits a specific app, escalate to clarification (Router §3).

---

*Navigation & Structure v1.0*
*Companion: CP Native v1.1 Patch §C (Page Hierarchy)*
