# Calm Precision iOS — Design Router

**Entry point for any LLM building iOS apps for RossLabs.ai.** Read this file first on every new app or iteration session.

**Role:** Routes tasks to domain files. Classifies app archetype. Defines clarification protocol. Does NOT contain option catalogs — those live in domain files.

**Reads with:** CP Native v1.1 + CP 6.4.1 baseline + iOS Charts (where applicable)

---

## 0. HOW TO USE THIS SYSTEM

### 0.1 Task → File Routing

| Task | File |
|------|------|
| Starting a new app from scratch | §1 (classify archetype) → §2 (defaults) → then domain files as needed |
| Building navigation (tab bar, screens, sheets) | `1_Navigation_Structure.md` |
| Building lists, feeds, cards | `2_Lists_Cards_Content.md` |
| Building buttons, toggles, form fields, interactions | `3_Buttons_Touch_Interactions.md` |
| Color work, dark mode, typography, numeric displays | `4_Color_Surface_Typography.md` |
| Animations, loading, onboarding, celebrations, profiles, empty states | `5_Motion_States_Identity.md` |
| Charts and data visualization | `Calm_Precision_iOS_Charts.md` |
| Platform fundamentals (SwiftUI patterns, HealthKit, CloudKit, watchOS) | `Calm_Precision_iOS_Mac.md` + v1.1 Patch |

### 0.2 Before Starting Any Task

1. **Check for app config.** If the repo has `<app-name>.config.md`, read it first — it records prior decisions
2. **If no config exists**, classify the archetype (§1) and apply defaults (§2)
3. **When you hit a choice point**, use the clarification protocol (§3)
4. **Flag your choices in output** using the review format (§4)

### 0.3 Principle Hierarchy

When two rules conflict:
1. Per-app config decisions (if they exist) — **highest authority**
2. User explicit instructions in the current session
3. Archetype defaults from this router
4. Domain file options (prefer flagged "preferred" options when archetype fits)
5. CP Native platform fundamentals
6. CP 6.4.1 core principles — **lowest priority but never violated**

CP 6.4.1 principles are never *enforced* as strict rules on preferences — but they should inform the choice whenever two options are equally valid for an archetype.

---

## 1. ARCHETYPE CLASSIFIER

Every iOS app fits one (sometimes two) of six archetypes. Archetype drives ~70% of design choices before any explicit preference applies.

### 1.1 The Six Archetypes

| Archetype | Core Purpose | Defining Signal | Example Apps |
|-----------|--------------|-----------------|--------------|
| **Utility** | Complete a specific task fast | User comes, does thing, leaves | Calculator, Timer, Password Manager, FloDoro |
| **Content / Feed** | Browse information | Scrollable, frequently refreshed content | News, Social, Atomize News |
| **Productivity** | Manage work/projects | Persistent user workspace, creation tools | Notion, Linear, Things |
| **Consumer / Habit** | Daily engagement loop | Retention-focused, streak/reward mechanics | Duolingo, Headspace |
| **Editorial** | Long-form reading/media | Typography-forward, reading experience | Medium, Arc, Stripe Press |
| **Tool / Pro** | Complex workflows | Power-user controls, deep functionality | Figma, dev tools, research tools |

### 1.2 Classification Questions

Ask these in order. Stop at the first strong match.

```
1. Is the app's core action completable in <60 seconds per visit?
   → YES: UTILITY
   
2. Is the primary screen a scrollable feed of items the user didn't create?
   → YES: CONTENT/FEED
   
3. Does the user CREATE persistent artifacts (docs, tasks, projects)?
   → YES: PRODUCTIVITY
   
4. Is daily return/retention a core success metric with streaks/rewards?
   → YES: CONSUMER/HABIT
   
5. Is long-form reading or media consumption the primary activity?
   → YES: EDITORIAL
   
6. Does the app target professionals with complex workflows and power features?
   → YES: TOOL/PRO
```

### 1.3 Hybrid Archetypes

Some apps span two archetypes. Handle by identifying **primary** (dominant screen, main value) and **secondary** (supporting feature).

Common hybrids:
- **Atomize News** = Content/Feed (primary) + Tool/Pro (secondary — research features)
- **FloDoro** = Utility (primary — timer) + Productivity (secondary — session history)
- **A meditation app** = Consumer/Habit (primary) + Editorial (secondary — articles)

**Rule:** Primary archetype drives defaults. Secondary archetype applies to its specific feature area only.

### 1.4 When Archetype Is Unclear

If you can't confidently classify after the 6 questions, **ask the user**. Use the clarification format in §3.

---

## 2. ARCHETYPE → DEFAULTS TABLE

These are starting points. Each domain file has full options — this table narrows the search before you load the domain file.

| Category | Utility | Content/Feed | Productivity | Consumer/Habit | Editorial | Tool/Pro |
|----------|---------|--------------|--------------|----------------|-----------|----------|
| **Primary action per screen** | ONE clear action, 1-step completion | ONE action + scroll/swipe context | ONE primary + contextual secondary | ONE engagement action (streak-driven) | ONE reading/navigation action | ONE primary + power-user menu |
| **Task step budget (key task)** | 1–2 steps | 2–3 steps | 2–3 steps | 1–2 steps | 1–2 steps | 3–5 steps (complex workflows) |
| **Tab bar** | Standard iOS or hidden | Floating pill + auto-hide | Standard iOS | Floating pill | Hidden/minimal | Standard iOS |
| **Accent application** | CTA-Only | Semantic System | Semantic System | Expressive Spread | CTA-Only | Semantic System |
| **Dark mode base** | Layered Near-Black | True Black | Layered Near-Black | True Black or Glass | Layered Near-Black | Layered Near-Black |
| **List pattern** | Inset Hairline | Card Per Row | Card Per Row or Grouped | Card Per Row | Full-Width Line | Inset Hairline |
| **Primary button depth** | Drop Shadow | Drop Shadow | Drop Shadow | Inner Rim | Flat or Drop Shadow | Flat |
| **Tap feedback** | BG Highlight + Opacity | BG Highlight | BG Highlight + Opacity | Ripple on CTAs | Opacity Dim | BG Highlight |
| **Onboarding structure** | Value-First or None | Value-First | Progressive Disclosure | Interactive Tutorial or Quiz | Value-First | Progressive Disclosure |
| **Skeleton loading** | Pulse Fade | Shimmer | Pulse Fade | Shimmer | Pulse Fade | Pulse Fade |
| **Empty state style** | System Icon + Text | System Icon + Text | Text Only | Custom Illustration | Text Only | System Icon + Text |
| **Toast routing** | Bottom Pill | Bottom Pill + Top Banner | All three channels | Bottom Pill + Celebration | Bottom Pill | All three channels |
| **Celebration** | Checkmark Morph | Score Tick | Checkmark Morph | Full treatment (all options) | Minimal | Checkmark Morph |
| **Motion density** | Low (2 per screen) | Medium (3 per screen) | Low (2 per screen) | High (4+ per screen) | Low (1–2 per screen) | Low (2 per screen) |
| **Haptic baseline** | Key moments | Key moments | Key moments | Key moments + custom patterns | Key moments | Key moments |
| **Profile header** | Compact card (if any) | Cover + overlap avatar | Compact card | Cover + overlap avatar | Large centered | Compact card |
| **Typography tracking** | Tight on headings | Tight on headings | Tight on headings | Tight on headings | Tight on headings | Tight on headings |

### 2.1 Reading the Defaults Table

- Use these defaults when no per-app config exists and no explicit user preference overrides
- If a row has "or" between options, either is valid — use the one that matches any secondary archetype
- "All three channels" / "Full treatment" means the archetype warrants the maximum preference set (Consumer/Habit apps earn this)
- Motion density numbers are a ceiling — a utility app can have 0 animations, but not 5

### 2.2 What This Table Does NOT Cover

The defaults table is a fast starting point. These decisions still need domain file lookups:
- Specific button label copy (voice calibration) — always needed per component
- Specific gradient placement — needs the actual screen context
- Specific onboarding content — requires app-specific goals
- Swipe action mapping — requires list-specific action inventory

---

## 3. CLARIFICATION PROTOCOL

Your default behavior: **Use inferred archetype to decide. Flag choices in output for review.**

But some decisions are high-enough impact to warrant asking upfront. Use this protocol to decide when.

### 3.1 When to DECIDE (don't ask)

Decide without asking when:
- The archetype is clear
- The default from §2 is obviously right for this specific screen
- The choice is low-impact (skeleton style, toast channel, micro-interaction timing)
- The user gave strong directional guidance earlier in the session

When you decide, **flag it in output** using §4 format.

### 3.2 When to ASK (stop and clarify)

Ask when any of these are true:
- Archetype is ambiguous or the app is hybrid with unclear primary
- Decision is high-impact and would be disruptive to change later:
  - Tab bar style (affects every screen)
  - Accent application tier (affects entire visual language)
  - Dark mode treatment (affects every surface)
  - Primary navigation pattern (push vs tab vs drawer)
  - Onboarding structure (affects first-run funnel)
- User has given conflicting signals in the session
- The choice would violate a CP 6.4.1 principle without clear justification
- The user has explicitly said "ask me about X"
- **Any time you're about to ADD an optional element to a screen** (Task Economy validation — see §3.2a)

### 3.2a Task Economy: Validate Before Adding

CP 6.4.2 Principle 14 (Task Economy) requires explicit justification for added elements. Before adding any of the following, validate with the user:

- A secondary action to a screen that has a clear primary
- A confirmation dialog (unless the action is truly destructive)
- A settings toggle for a behavior
- An option that could instead be inferred from context
- A step to a flow that was previously one screen
- A "Welcome" or explanation screen before a feature is usable

**Exception — don't validate, just decide:**
- The addition is clearly required by the task (form submit button, etc.)
- The user explicitly requested it
- It's a CP-required element (empty state, error handler, accessibility label)

**Validation question format:**

```
I'm about to add [element] to [screen].

Without it: [describe the simpler version]
With it: [describe what it adds]
Cost: +[N] step(s) / +[N] decision(s) for the user

Should I add it? Or is there a way to handle [use case] without it?
```

### 3.2b Task Economy: Step Counting

For any task flow being designed, count steps explicitly and report in output.

Before building a flow:
1. Define the outcome (what is the user trying to accomplish?)
2. Count the theoretical minimum steps
3. Count the current design's steps
4. If the gap is wider than 1–2 steps, look for cuts before proceeding
5. Report step count in output (§4)

See CP 6.4.2 §14.4 for step budgets by task type.

### 3.3 How to Ask

Use `ask_user_input_v0` tool when available. Format the question like this:

```
Building [specific screen/component].
I can see this as [archetype].

Three viable options:
- [Option A] — [one-line trade-off]
- [Option B] — [one-line trade-off]  
- [Option C] — [one-line trade-off]

Which fits [app name]?
```

Keep questions to 2–4 options. Never 6+ — too cognitively expensive.

If `ask_user_input_v0` isn't available, use a short prose question with clear options.

### 3.4 When NOT to Ask

Do not ask about:
- Platform fundamentals (how SwiftUI works, HealthKit patterns, etc.)
- CP 6.4.1 core principles (these are principles, not preferences)
- Things the user has already answered in earlier turns
- Minor timing/easing values (use sensible defaults)

---

## 4. OUTPUT-FLAGGING FORMAT

Every time you make a design choice without asking, surface it so the user can audit. Use this format at the end of any design output:

```markdown
## Design Choices Made

**Inferred archetype:** [Utility / Content / Productivity / Consumer / Editorial / Tool]
**Reason:** [one sentence]

**Primary action(s) per screen:**
- [Screen 1]: [primary action] — 1 step to complete
- [Screen 2]: [primary action] — N steps to complete

**Step counts for key tasks:**
- [Task]: [current N steps] — floor is [theoretical minimum N]
  - Gap closed by: [smart defaults / inference / combining screens / etc.]

**Choices (review before committing):**
- **[Category]:** [option chosen] — [why, in 1 sentence]
- **[Category]:** [option chosen] — [why]

**Flagged as tentative (confirm if building for production):**
- [Choice] — [what to validate]

**Elements NOT added (Task Economy validated):**
- [What was considered] — [why it was cut]
```

### 4.1 Example

```markdown
## Design Choices Made

**Inferred archetype:** Productivity (FloDoro is task/workspace-creation)
**Reason:** User creates and manages focus sessions as persistent artifacts.

**Choices:**
**Primary action(s) per screen:**
- Home: "Start Focus" — 1 step to start a session
- Session Detail: "End Session" — 1 step to stop
- Session Log: Tap row to view detail — 1 step to drill in

**Step counts for key tasks:**
- Start a focus session: 1 step (home → tap Start) — floor is 1 step ✓
- Review past sessions: 2 steps (tap Log tab → tap session) — floor is 2 steps ✓
- Change session duration: 2 steps (long-press Start → adjust) — floor is 2 steps ✓

**Choices:**
- **Tab bar:** Standard iOS tab bar — Productivity apps benefit from always-visible nav
- **Accent:** Semantic System — multiple functional states need distinction (active session, paused, completed)
- **List pattern:** Card Per Row — sessions are independent entities
- **Onboarding:** Progressive Disclosure — focus/breathing concepts need explanation

**Flagged as tentative:**
- Tab bar icon animation (Outline → Fill Morph) — validate against your preference for restraint
- Default accent color (system blue) — no brand color committed yet

**Elements NOT added (Task Economy validated):**
- Confirmation dialog on "End Session" — non-destructive (session auto-saves), would add +1 step
- "Choose Mode" screen before starting — smart default (last-used mode), inline customization instead
- Welcome screen before first session — value-first; show the timer immediately
```

### 4.2 Why This Matters

The flag format serves three purposes:
1. **Auditability** — you can scan it in 20 seconds and catch misfires
2. **Config generation** — when you're ready, these flagged choices become the per-app config
3. **LLM continuity** — a future session reading the output understands what was decided and why

---

## 5. ASK-FIRST TRIGGER LIST

Concrete list of decisions that warrant asking before building:

1. **Archetype** — if not clear after §1.2 questions
2. **Brand accent color** — never assume the brand palette
3. **Tab bar presence and style** — one-time structural decision
4. **Dark mode behavior** — light-only / dark-only / system-adaptive
5. **Onboarding flow existence** — some apps skip it entirely
6. **Login/auth pattern** — gates everything else
7. **Charts usage** — some apps never need them, some are chart-first
8. **Custom vs system everything** — how much platform-native vs custom design
9. **Target iOS version** — affects which APIs are available (SectorMark, MeshGradient, Observable macro)
10. **App-specific voice/tone** — the UI copy feel
11. **Any addition of optional UI elements** — per Task Economy (§3.2a)

Items 1–4 are essentially always worth asking on a new app. Items 5–10 are conditional. Item 11 applies throughout the build.

---

## 6. PER-APP CONFIG (FUTURE)

The per-app config artifact is **scope-deferred** — the user will decide granularity later. Until then:

- **Continue using the output-flag format (§4)** after every build session
- **Accumulate choices in the repo's README or a design journal** for continuity
- When the user commits to a scope, those accumulated choices become the config

### 6.1 Placeholder Structure

When a per-app config is eventually spec'd, it will likely sit at:
```
/<project-root>/design-config.md
```

And will contain a subset of the §4 flag format, locked for the life of the app.

---

## 7. FILE INDEX

### 7.1 Option Catalog Files (this system)

| File | Domain |
|------|--------|
| `0_Router.md` | This file |
| `1_Navigation_Structure.md` | Tab bar, back nav, screen transitions, page hierarchy, sheets, modals |
| `2_Lists_Cards_Content.md` | Row separators, card patterns, swipe actions, three-line hierarchy, content resilience |
| `3_Buttons_Touch_Interactions.md` | Button styles, depth, tap feedback, haptics, toggles, form controls |
| `4_Color_Surface_Typography.md` | Accent, gradients, dark mode, elevation, typography, numeric display |
| `5_Motion_States_Identity.md` | Transitions, loading, celebrations, onboarding, profiles, empty states, voice |

### 7.2 Platform Fundamentals (not preferences)

| File | Role |
|------|------|
| `Calm_Precision_iOS_Mac.md` | SwiftUI patterns, HealthKit, CloudKit, watchOS, platform code sharing |
| `Calm_Precision_iOS_v1.1_Patch.md` | CP 6.4.1 content strategy additions (voice, error routing, page hierarchy) |
| `Calm_Precision_iOS_Charts.md` | Swift Charts implementation for data viz |

### 7.3 Core Design Language (baseline)

| File | Role |
|------|------|
| `Calm_Precision_6.4.1.md` | Foundational principles (Gestalt, Fitts, Hick, etc.) — never overridden |

### 7.4 Deprecated

| File | Status |
|------|--------|
| `Calm_Precision_iOS_Preferences.md` | DEPRECATED — replaced by catalog files |
| `Calm_Precision_iOS_Preferences_v2_Addendum.md` | DEPRECATED — replaced by catalog files |

These remain in the repo as historical record of A/B test outcomes but are NOT authoritative.

---

## 8. QUICK REFERENCE

**Starting a new app:**
1. Classify archetype (§1)
2. Pull defaults from §2 table
3. Ask about items 1–4 in §5
4. **Map primary task per screen + count steps (CP 6.4.2)**
5. Load domain files as needed for specific components

**Before building any screen:**
1. Identify the ONE primary action for this screen
2. Count steps for the main task this screen supports
3. List what you're NOT adding (Task Economy — §3.2a)
4. Validate any additions with user (§3.2a)

**Iterating an existing app:**
1. Read app config if it exists
2. Read prior output flags in the repo
3. Maintain consistency with prior choices
4. Only change locked choices if user explicitly requests

**Hitting a choice point:**
1. Check if the archetype default covers it (§2)
2. If yes: decide, flag in output (§4)
3. If no or ambiguous: ask (§3.3)
4. Never silently violate CP 6.4.1 — justify or ask

**About to add something optional?**
1. STOP — this triggers Task Economy validation (§3.2a)
2. Describe what the screen looks like without it
3. Describe the case for adding it
4. Ask the user — don't assume

**When stuck between two options:**
1. Pick the one closer to the archetype default
2. Pick the one with fewer steps to task completion (CP 6.4.2 tiebreaker)
3. Pick the one with less decoration (CP signal-to-noise tiebreaker)
4. Pick the one with more platform-native behavior (iOS users expect it)
5. If all four tiebreakers still tie: ask

---

*Calm Precision iOS Router v1.1*
*Updated for CP 6.4.2 Task Economy*
*Entry point for LLM-driven iOS app design*
*Replaces: iOS Preferences v1 + v2 preference enforcement model*
