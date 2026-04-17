# 5. Motion, States & Identity

Option catalog for motion systems, loading states, celebrations, splash, onboarding flow, profile/avatar, empty/error states, and voice calibration.

**Read first:** `0_Router.md`
**Companion:** CP 6.4.1 Principle 12 (Purposeful Motion), Principle 10 (Content Resilience + Error Strategy), Principle 13 (Voice Calibration)

---

## §1. MOTION PHILOSOPHY

### 1.1 CP 6.4.1 Principle 12

Every animation must answer: **"What is this telling the user?"**

If the answer is "nothing" or "it looks nice," remove it.

### 1.2 Motion Purposes

| Purpose | Example |
|---------|---------|
| Signal hierarchy | Slide push shows deeper nav |
| Signal state change | Toggle morph shows on/off |
| Signal relationship | Staggered entry shows group |
| Signal interactivity | Press-in confirms tap registered |
| Signal progress | Skeleton shimmer shows loading |
| Signal completion | Checkmark morph shows success |
| Signal continuity | Hero expansion shows card→detail link |

### 1.3 Motion Density Ceiling

**Max 3 animated elements in active state per screen.** Entry/exit transitions don't count toward the ceiling.

Exceptions:
- Consumer/Habit archetype can push to 4
- Loading states can stack (skeleton + pulse + progress)
- Celebration moments are exempt briefly

### 1.4 Respect Reduce Motion

```swift
@Environment(\.accessibilityReduceMotion) var reduceMotion

.animation(reduceMotion ? nil : .easeOut(duration: 0.3), value: state)

// Transitions
.transition(reduceMotion ? .opacity : .move(edge: .bottom).combined(with: .opacity))
```

---

## §2. SCREEN TRANSITIONS

See `1_Navigation_Structure.md` §3 for the full catalog. Summary:

| Transition | Timing | Purpose |
|-----------|--------|---------|
| Slide Push | 300ms ease-out | Hierarchical drill-down |
| Slide Up | 350ms spring | Modal, sheet |
| Hero Expansion | 350ms spring | Connected element |
| Cross-Fade | 200ms ease-in-out | Tab switch, auth change |

---

## §3. LOADING STATES

### 3.1 Options by Wait Time

| Expected Wait | Pattern |
|---------------|---------|
| <100ms | No indicator |
| 100ms–1s | Spinner or pulse |
| 1s–3s | Skeleton screen |
| >3s | Progress bar + status text |

### 3.2 Skeleton Style Options

| Option | Description | Best For |
|--------|-------------|----------|
| **Shimmer Left-to-Right** | Gradient sweeps across placeholder | Content/Feed, social apps (familiar) |
| **Pulse Fade** | Opacity pulses 1 → 0.4 → 1 | Productivity, focus, meditation (calmer) |
| **Sequential Reveal** | Skeleton items fade in staggered | Onboarding list reveal |
| **No Skeleton (Spinner)** | Centered spinner only | Short loads, rare |

### 3.3 Rossen Preferred

Shimmer (content/social apps) + Pulse Fade (productivity/focus apps). Archetype-matched.

### 3.4 Skeleton Decision Tree

```
Building a loading state?
├── Is this a productivity / focus / meditation app?
│   └── Pulse Fade (calmer)
├── Is this a content / feed / social app?
│   └── Shimmer Left-to-Right (familiar)
├── Is this a single brief load (<1s expected)?
│   └── No skeleton — brief spinner or nothing
└── Is this a long process (>3s)?
    └── Progress bar + status text (what's happening, not just "loading")
```

### 3.5 Skeleton Rules

- **Match real layout exactly** — skeleton should be the same shape as final content
- **Use `.redacted(reason: .placeholder)`** on iOS 14+ for automatic skeletons
- **Max 5 skeleton items** — don't show 20 skeleton rows, show 5 and let content fill in
- **Respect reduce motion** — shimmer becomes static placeholder

### 3.6 Loading Copy (Voice Calibration)

Per CP 6.4.1 Principle 13:

```swift
// ✓ DO — specific action + count
ProgressView("Syncing 47 sessions…")
ProgressView("Analyzing this week's data")

// ✗ DON'T — generic
ProgressView("Loading...")
ProgressView()  // silent, user doesn't know what's happening
```

### 3.7 SwiftUI Skeleton Patterns

**Shimmer:**
```swift
struct ShimmerView: View {
    @State private var phase: CGFloat = 0
    
    var body: some View {
        GeometryReader { geo in
            LinearGradient(
                colors: [.gray.opacity(0.3), .gray.opacity(0.1), .gray.opacity(0.3)],
                startPoint: .leading,
                endPoint: .trailing
            )
            .offset(x: phase * geo.size.width * 2 - geo.size.width)
        }
        .onAppear {
            withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                phase = 1.0
            }
        }
    }
}
```

**Pulse Fade:**
```swift
struct PulseFadeView: View {
    @State private var opacity: Double = 1.0
    
    var body: some View {
        Rectangle()
            .fill(Color.gray.opacity(0.3))
            .opacity(opacity)
            .onAppear {
                withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
                    opacity = 0.4
                }
            }
    }
}
```

**Native Redaction (iOS 14+):**
```swift
ItemRow(item: placeholder)
    .redacted(reason: isLoading ? .placeholder : [])
```

### 3.8 Pull-to-Refresh Animations

See `2_Lists_Cards_Content.md` §8.

---

## §4. EMPTY STATES

### 4.1 Options

| Option | Description | Best For |
|--------|-------------|----------|
| **Text Only (Ultra Minimal)** | No icon, just title + CTA | Editorial, minimal apps |
| **System Icon + Text** | SF Symbol 56pt + title + description + CTA | Default fallback (works anywhere) |
| **Custom Illustration** | Branded illustration + text | Consumer, playful apps |
| **Native `ContentUnavailableView`** | iOS 17+ standard component | Recommended default |
| **Animated Empty State** | Lottie or similar | Premium consumer apps |

### 4.2 Rossen Preferred

System Icon + Text (default) + Text Only (editorial apps) + Custom Illustration (consumer apps).

### 4.3 Empty State Decision Tree

```
Designing empty state?
├── Is the app minimal / editorial (Linear, Things, Arc-style)?
│   └── Text Only (20pt title, sub, CTA)
├── Is the app consumer / playful / brand-expressive?
│   └── Custom Illustration + CTA
├── Is this a filtered-empty state (not first-time)?
│   └── Text Only (never illustration for "no search results")
├── Is this a first-time onboarding empty state?
│   ├── Consumer app? → Custom Illustration
│   └── Utility app? → System Icon + Text
└── Default fallback?
    └── ContentUnavailableView (native iOS 17+)
```

### 4.4 Empty State Context Matching (CP 6.4.1 Principle 10)

Copy must match context:

| Context | Tone | Example Copy | CTA |
|---------|------|--------------|-----|
| First time | Encouraging | "Your focus journey starts here." | "Start First Session" |
| Search | Neutral | "No sessions match 'morining'. Check spelling?" | "Clear Search" |
| Filter | Neutral | "No sessions match these filters." | "Clear Filters" (shows total count) |
| All done | Celebratory | "All caught up! Take a break." | "Start Next Session" |
| Permission not granted | Neutral | "Health data hidden. Grant access for trends." | "Enable in Settings" |

### 4.5 SwiftUI Empty State Patterns

**System Icon + Text (default):**
```swift
ContentUnavailableView {
    Label("No Sessions Yet", systemImage: "timer")
} description: {
    Text("Complete your first focus session to start your history.")
} actions: {
    Button("Start Focus", action: start)
        .buttonStyle(.borderedProminent)
}
```

**Search:**
```swift
ContentUnavailableView.search(text: query)
```

**Filter:**
```swift
ContentUnavailableView {
    Label("No Matches", systemImage: "line.3.horizontal.decrease.circle")
} description: {
    Text("No sessions match these filters. \(totalCount) sessions exist in total.")
} actions: {
    Button("Clear Filters", action: clearFilters)
}
```

**Celebration (all done):**
```swift
ContentUnavailableView {
    Label("All Caught Up", systemImage: "checkmark.circle.fill")
        .foregroundStyle(.green)
} description: {
    Text("You've reviewed everything for today. Take a well-earned break.")
} actions: {
    Button("Plan Tomorrow", action: plan)
        .buttonStyle(.bordered)
}
```

---

## §5. ERROR STATES

### 5.1 CP 6.4.1 Error Routing (Principle 10 Extension)

Route errors by type:

| Error Type | Pattern | Tone |
|------------|---------|------|
| User error (typo, wrong format) | Inline correction near input | Neutral |
| System error (timeout, server) | Full view + retry, "not your fault" | Neutral/encouraging |
| Permission error (auth, capability) | Upgrade/login CTA | Neutral |
| Data error (empty API, malformed) | Graceful fallback + retry | Neutral |

### 5.2 Error Message Pattern (what → why → fix)

Every error:
1. **What happened:** One sentence, no jargon
2. **Why:** Brief, honest cause
3. **What to do:** Actionable CTA

```
"Your file couldn't be uploaded.    ← What
 Files over 25MB aren't supported.  ← Why
 [Compress file] [Try smaller]       ← Fix"
```

### 5.3 Error Voice Examples

| ✗ Don't | ✓ Do |
|---------|------|
| "Something went wrong." | "Couldn't load sessions. Check connection and retry." |
| "Error 500" | "Our servers hiccupped. Try again in a moment." |
| "Invalid input" | "Email needs an @ symbol." |
| "Access denied" | "This requires a Pro plan. Upgrade to unlock." |

### 5.4 SwiftUI Error Patterns

**Inline (user error):**
```swift
struct ValidatedField: View {
    @Binding var text: String
    let label: String
    let error: String?
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            TextField(label, text: $text)
                .textFieldStyle(.roundedBorder)
            if let error {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
            }
        }
    }
}
```

**Full view (system error):**
```swift
struct SystemErrorView: View {
    let what: String
    let why: String?
    let retry: () -> Void
    
    var body: some View {
        ContentUnavailableView {
            Label(what, systemImage: "wifi.slash")
        } description: {
            if let why { Text(why) }
        } actions: {
            Button("Try Again", action: retry)
                .buttonStyle(.borderedProminent)
        }
    }
}
```

---

## §6. TOAST / NOTIFICATION

### 6.1 Options

| Option | Description | Best For |
|--------|-------------|----------|
| **Bottom Pill / Snackbar** | Floating pill above tab bar | Success, info, confirmations |
| **Inline Context Toast** | Appears near triggering element | Field-specific feedback |
| **Top Banner** | Full-width banner from top | Errors, critical alerts |
| **Full-Screen Overlay** | Temporary full-screen message | Onboarding moments, major success |
| **Silent (Haptic Only)** | No visual, haptic feedback only | Micro-confirmations (rare) |

### 6.2 Rossen Preferred

Bottom Pill + Inline Context + Top Banner (routed by type).

### 6.3 Toast Routing Decision Tree

```
What kind of feedback?
├── Success / info / confirmation?
│   └── Bottom Pill (3s auto-dismiss)
├── Error / critical warning / connectivity?
│   └── Top Banner (4s auto-dismiss, tappable)
├── Inline validation (field, specific element)?
│   └── Inline Context Toast (2s)
├── Major success (completion milestone)?
│   └── Full-Screen Overlay (see §7 Celebrations)
└── Just a micro-confirmation (save, toggle)?
    └── Haptic only (no visual)
```

### 6.4 Toast Specs

**Bottom Pill:**
- Max 80% screen width, 36–40pt tall pill
- 16pt above tab bar / safe area
- Slide up + fade in, 250ms
- Auto-dismiss 2.5–3s
- Swipe down to dismiss early

**Top Banner:**
- Full-width, 48pt tall
- Slides from below status bar
- Red tint for errors, orange for warnings
- Auto-dismiss 3–4s
- Tappable for detail

**Inline Context:**
- Near triggering element
- 28–32pt tall
- 2s dismissal
- No swipe needed — just fades out

### 6.5 SwiftUI Toast Overlay Pattern

```swift
struct ToastOverlay: ViewModifier {
    @Binding var message: String?
    let tone: ToastTone
    
    enum ToastTone {
        case success, error, info
    }
    
    func body(content: Content) -> some View {
        content.overlay(alignment: .bottom) {
            if let message {
                HStack {
                    Image(systemName: tone == .success ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
                    Text(message)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(.regularMaterial, in: Capsule())
                .padding(.bottom, 80)  // above tab bar
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
    }
}
```

---

## §7. CELEBRATIONS & ACHIEVEMENTS

### 7.1 Options

| Option | Description | Best For |
|--------|-------------|----------|
| **Checkmark Morph + Ripple** | Circle → checkmark with spring, ripple radiates | Standard completion (task done, session saved) |
| **Score Tick + Glow** | Number counts up with soft glow pulse | Score/points increment, XP gain |
| **Confetti / Particle Burst** | Particles explode from anchor point | Major milestone, level up |
| **Full-Screen Takeover** | Temporary full-screen celebration | Rare milestones (streak 100, big unlock) |
| **Haptic Only** | Physical feedback, no visual | Micro-moments |
| **Badge Unlock Animation** | Badge drops in + glows | Achievement systems |

### 7.2 Rossen Preferred

Checkmark Morph (standard) + Score Tick (increments). Full-Screen Takeover permitted for major milestones only (refined, not confetti storm).

### 7.3 Celebration Decision Tree

```
Achievement level?
├── Standard completion (task done, session saved)?
│   └── Checkmark Morph + Ripple
├── Progress increment (XP, score, points)?
│   └── Score Tick + Glow
├── Minor success (saved, added)?
│   └── Haptic only OR Bottom Pill toast
├── Major milestone (rare, user-worked-toward)?
│   └── Refined Full-Screen Takeover (one hero element + one supporting, NOT confetti storm)
└── Streak / unlock?
    └── Badge Unlock Animation
```

### 7.4 Major Milestone Criteria

A full-screen celebration is warranted ONLY when:
1. The moment is rare (≤1/month for typical user)
2. The user explicitly worked toward it
3. The celebration is restrained (refined, not chaotic)

### 7.5 SwiftUI Celebration Pattern

**Checkmark Morph:**
```swift
struct CelebrationCheckmark: View {
    @State private var drawn = false
    @State private var rippled = false
    
    var body: some View {
        ZStack {
            // Ripple
            Circle()
                .stroke(Color.accentColor, lineWidth: 2)
                .scaleEffect(rippled ? 2.0 : 0.5)
                .opacity(rippled ? 0 : 1)
            
            // Filled circle
            Circle()
                .fill(Color.accentColor)
                .frame(width: 64, height: 64)
            
            // Checkmark
            Image(systemName: "checkmark")
                .font(.system(size: 32, weight: .bold))
                .foregroundStyle(.white)
                .scaleEffect(drawn ? 1.0 : 0)
        }
        .onAppear {
            withAnimation(.spring(duration: 0.5, bounce: 0.3)) {
                drawn = true
            }
            withAnimation(.easeOut(duration: 0.8).delay(0.1)) {
                rippled = true
            }
        }
    }
}
```

---

## §8. SPLASH SCREEN

### 8.1 Options

| Option | Description | Best For |
|--------|-------------|----------|
| **Logo Fade In/Out** | Logo fades in on brand color, fades to first screen | Utility apps, default |
| **Logo Draw / Assemble** | Logo draws itself (SVG stroke) or assembles | Craft-signaling apps |
| **Splash Morphs Into UI** | Launch shape expands/morphs into first screen | Signature apps (Pitch, Linear) |
| **Ambient Particle / Mesh** | Background animation, logo static | Premium, atmospheric apps |
| **Instant (No Splash)** | System launch screen → app | Utility, no investment |
| **Video Splash** | Video intro | Rare — use with restraint |

### 8.2 Rossen Preferred

All four (Logo Fade, Logo Draw, Splash Morph, Ambient Particle) — chosen by craft tier.

### 8.3 Splash Decision Tree

```
Designing splash?
├── Utility or productivity app?
│   └── Logo Fade In/Out (default, fast)
├── Brand cares about craft perception?
│   └── Logo Draw / Assemble
├── App launch IS part of identity (premium, editorial, content)?
│   └── Splash Morphs Into UI OR Ambient Particle
└── When in doubt?
    └── Logo Fade In/Out
```

### 8.4 Splash Rules

- **Max 1.5s** — users want to get to the app
- **Set up during launch** — data preloading happens behind splash
- **iOS system launch screen is required** — splash animation plays AFTER system launch
- **Dark mode aware** — splash should respect appearance

---

## §9. ONBOARDING

### 9.1 Flow Structure Options

| Option | Description | Best For |
|--------|-------------|----------|
| **Value-First (Show Don't Tell)** | Drop user in, pre-filled state, features explained in context | Productivity, utility (Linear, Arc) |
| **Progressive Disclosure Steps** | 3–5 screens, one concept per screen, progress visible | Complex workflows |
| **Interactive Tutorial** | First session IS onboarding, real actions | Consumer/habit (Duolingo) |
| **Personalization Quiz** | 3–7 questions tailor the experience | Fitness, meditation, habit |
| **Login Only** | Just account creation, no explanation | Utility apps, technical users |
| **Hybrid (Quiz + Value)** | Quiz → personalized value demo | Consumer apps with personalization |

### 9.2 Rossen Preferred

All four by use case.

### 9.3 Onboarding Decision Tree

```
Designing onboarding?
├── Is the app's value obvious from using it?
│   └── Value-First (skip, pre-fill, go)
├── Does the app require user goals / preferences to function well?
│   └── Personalization Quiz (3-7 questions)
├── Is there a specific first action that creates delight?
│   └── Interactive Tutorial (first-win onboarding)
├── Does the app have non-obvious concepts needing explanation?
│   └── Progressive Disclosure (3-5 screens)
└── Is the app utility-focused for technical users?
    └── Login Only
```

### 9.4 Progress Indicator Options

| Option | Description | Best For |
|--------|-------------|----------|
| **Linear Progress Bar** | Thin bar fills left-to-right | In-app flows, lessons |
| **Step Counter Text** | "Step 2 of 5" | Setup / onboarding flows (5+ steps) |
| **Dots** | Filled/empty dot series | Short flows (3–4 steps) |
| **No Indicator** | No progress shown | Very short flows (1–2 screens) |
| **Percentage Text** | "40% complete" | Rarely — too specific |

### 9.5 Rossen Preferred

Step Counter (setup) + Linear Progress Bar (in-app flow) + No Indicator (short flows).

### 9.6 Onboarding Animation Options

| Option | Description | Best For |
|--------|-------------|----------|
| **Morphing Shape Transitions** | Central illustration morphs between screens | Signature flagship apps |
| **Staggered Element Entry** | Elements enter sequentially (80–100ms stagger) | Default polished onboarding |
| **Lottie Scene Animations** | Unique Lottie per screen | Style-forward but restrained apps |
| **Slide + Parallax** | Horizontal slide, background parallax | Depth without complexity |
| **Fade Only** | Simple fade between screens | Minimal, utility |
| **Static (No Animation)** | No transition between screens | Ultra-minimal |

### 9.7 Onboarding Animation Rules

- **Staggered entry:** 80–100ms per element (slower than default 60ms), smooth `.easeOut`
- **Morphing shape:** Reserve for flagship/signature product launches
- **Lottie:** Only when app intentionally minimizes distraction but wants style
- **Slide + Parallax:** Validate in build before committing (hard to evaluate abstractly)

### 9.8 Onboarding Copy Rules

- **First screen headline:** Describe the outcome, not the feature
  - ✓ "Read faster, remember more"
  - ✗ "AI-powered summarization"
- **CTA labels:** Active and specific
  - ✓ "Start Reading"
  - ✗ "Continue"
- **Skip always visible** — never force completion
- **Max 7 words per headline**

---

## §10. PROFILE & IDENTITY

### 10.1 Profile Header Options

| Option | Description | Best For |
|--------|-------------|----------|
| **Cover Photo + Overlapping Avatar** | Full-width cover + circular avatar overlap | Social, community, default |
| **Large Centered Avatar** | 100–120pt avatar centered on gradient/plain bg | Identity-first apps |
| **Compact Card Header** | Small avatar + name + stats in card | In-app settings/profile |
| **Dynamic Gradient Background** | Auto-generated gradient from avatar/brand colors | Fallback when no cover photo |
| **No Header (Minimal)** | Just name + content | Anonymous apps, extreme minimal |

### 10.2 Rossen Preferred

Cover + Overlap (default) + Large Centered (identity-first) + Compact Card (settings) + Dynamic Gradient (fallback).

### 10.3 Avatar Options

| Option | Description | Use |
|--------|-------------|-----|
| **Tap to Edit (Camera Badge)** | Camera/pencil badge bottom-right | Standard edit affordance |
| **Generated Default** | Auto-initials in brand color or gradient | When no photo |
| **Animated Status Ring** | Gradient ring signals status (story, active, premium) | Social layer |
| **Shape Morph (Circle/Squircle)** | Avatar shape changes with context | Rare, signature apps |

### 10.4 Profile Stats Options

| Option | Description | Best For |
|--------|-------------|----------|
| **Activity Heatmap Grid** | GitHub-style contribution grid | Streak-driven apps |
| **Single Progress Ring** | ONE Apple Activity-style ring | Timer apps only |
| **Compact Stats Row** | 3 metrics max in a row | When stats matter |
| **Multiple Progress Rings** | Apple Activity full treatment | Explicitly rejected per Rossen preference |
| **No Stats** | Hide stats entirely | Default when stats don't clearly help |

### 10.5 Rossen Preferred

Activity Heatmap (streak) + Single Ring (timer only). Multi-ring explicitly rejected.

### 10.6 Profile Decision Tree

```
Profile screen?
├── Full-screen dedicated profile view?
│   ├── User has cover photo? → Cover Photo + Overlapping Avatar
│   └── No cover available? → Dynamic Gradient from avatar colors
├── In-app utility profile (within settings)?
│   └── Compact Card Header
├── Personal dashboard, single-user focus?
│   └── Large Centered Avatar
└── Stats needed?
    ├── Activity history → Activity Heatmap
    ├── Timer-only context → Single Progress Ring
    ├── Compact metrics → Compact Stats Row (3 max)
    └── Don't clearly help → No stats
```

---

## §11. MICRO-INTERACTIONS

### 11.1 Tab Bar Icon Animations

| Option | Description | When |
|--------|-------------|------|
| **Instant State Swap** | No animation, immediate swap | Default, utility apps |
| **Outline to Fill Morph** | Smooth morph from outline to filled | Standard craft (most tabs) |
| **Spring Bounce** | Icon scales 1.2x briefly, spring back | Signature playful tabs (1–2 per app) |
| **Lottie / Rive Animated Icon** | Custom per-tab animation | Signature brand moment (1 tab per app) |

### 11.2 Tab Animation Caps

- **Max 1 Lottie tab per app**
- **Max 1 Spring Bounce tab per app**
- **Rest are Morph or Instant**

### 11.3 Toggle Animations

See `3_Buttons_Touch_Interactions.md` §5.

### 11.4 Scroll Physics Options

| Option | Description | Best For |
|--------|-------------|----------|
| **Standard Scroll** | iOS default | Default |
| **Snap-to-Card Paging** | Snaps to each card | Horizontal carousels (App Store, Tinder) |
| **Sticky Section Headers** | Headers stick as content scrolls | Long sectioned lists |
| **Parallax Background** | Background scrolls at 40–60% content speed | Hero sections, profile headers |
| **Rubber Band Over-Scroll** | Elastic bounce at edges | iOS default behavior |

### 11.5 Rossen Preferred

Snap-to-Card + Sticky Headers + Parallax Background (validate in build).

---

## §12. VOICE CALIBRATION

### 12.1 CP 6.4.1 Principle 13 Recap

| Element | Pattern | Max |
|---------|---------|-----|
| Button label | Verb + Object | ≤3 words |
| Destructive button | Verb + Object + consequence | ≤5 words |
| Placeholder | Instruction + context | ≤4 words |
| Tooltip | "What does this do?" | ≤8 words |
| Loading message | Action + count | ≤5 words |
| Success message | What + delta | ≤8 words |
| Error (inline) | Wrong + fix | ≤12 words |

### 12.2 Tone Ladder

| Tone | When | Example |
|------|------|---------|
| Neutral | Default, forms, data display | "No sessions this week." |
| Encouraging | First-time, onboarding | "Your focus journey starts here." |
| Urgent | Errors, destructive, time limits | "Delete 3 sessions? This can't be undone." |
| Celebratory | Completion, milestones | "25 minutes focused. Nice work." |

### 12.3 Per-App Voice Commitments

Beyond rules, each app should commit to:
- **Point of view:** First person ("I saved your session") vs. second person ("You saved 47 sessions") vs. neutral ("Session saved")
- **Contractions:** "Can't" vs. "Cannot" — determines formality
- **Emoji use:** Zero / sparing / expressive
- **Humor level:** None / subtle / playful

Default for CP: second person + contractions + zero emoji + subtle humor only where warranted.

### 12.4 Common Voice Failures

| ✗ Don't | ✓ Do |
|---------|------|
| "Click here to save" | "Save" |
| "OK" | "Save" / "Got it" / specific verb |
| "Something went wrong" | "Couldn't connect. Check your WiFi." |
| "Loading..." | "Syncing 12 sessions…" |
| "Success!" | "Session added to research" |
| "Invalid" | "Email needs an @ symbol" |
| "Are you sure?" | "Delete 3 sessions?" |

---

## §13. NOT YET IN CATALOG

- **Onboarding personalization depth** — how many preferences to ask up front
- **Celebration frequency tuning** — how often is "too often" for standard celebrations
- **Retention mechanics** (streaks, reminders, push notifications) — per-app strategy
- **Tutorial reappearance** — when to re-show help after initial onboarding
- **Error recovery queues** — handling multiple consecutive errors

---

*Motion, States & Identity v1.0*
*Companion: CP 6.4.1 Principles 10, 12, 13*
