---
name: ios-design-router
description: Use as the entry point for iOS UI design work in IBR. Classifies apps into 6 archetypes (Utility, Content, Productivity, Consumer, Editorial, Tool/Pro) and routes to domain references.
version: 0.1.0
user-invocable: false
---

# iOS Design Router

Entry point for iOS UI design work in IBR. Classifies app archetype, applies defaults, routes to domain reference files for specific components.

**Read this first** on every new app or iteration session. Does NOT contain option catalogs — those live in domain reference files.

## Principle Hierarchy

When rules conflict:
1. Per-app `design-config.md` decisions — highest authority
2. Explicit user instructions in current session
3. Archetype defaults from this router
4. Domain file options (prefer "preferred" options when archetype fits)
5. HIG fundamentals (ios-design skill)

---

## 1. Archetype Classifier

Every iOS app fits one (sometimes two) of six archetypes. Archetype drives ~70% of design choices.

### The Six Archetypes

| Archetype | Core Purpose | Defining Signal | Examples |
|-----------|--------------|-----------------|---------|
| **Utility** | Complete a specific task fast | User comes, does thing, leaves | Calculator, Timer, FloDoro |
| **Content/Feed** | Browse information | Scrollable, frequently refreshed content | News, Social, Atomize News |
| **Productivity** | Manage work/projects | Persistent user workspace, creation tools | Notion, Linear, Things |
| **Consumer/Habit** | Daily engagement loop | Retention-focused, streak/reward mechanics | Duolingo, Headspace |
| **Editorial** | Long-form reading/media | Typography-forward, reading experience | Medium, Arc |
| **Tool/Pro** | Complex workflows | Power-user controls, deep functionality | Figma, dev tools |

### Classification Questions

Ask in order. Stop at first strong match.

```
1. Is the core action completable in <60 seconds per visit?  → UTILITY
2. Is the primary screen a scrollable feed of items the user didn't create?  → CONTENT/FEED
3. Does the user CREATE persistent artifacts (docs, tasks, projects)?  → PRODUCTIVITY
4. Is daily return/retention a core success metric with streaks/rewards?  → CONSUMER/HABIT
5. Is long-form reading or media consumption the primary activity?  → EDITORIAL
6. Does the app target professionals with complex workflows?  → TOOL/PRO
```

### Hybrid Archetypes

Some apps span two archetypes. Identify **primary** (dominant screen, main value) and **secondary** (supporting feature). Primary drives defaults; secondary applies to its specific feature area only.

Examples: Atomize News = Content/Feed (primary) + Tool/Pro (secondary). FloDoro = Utility (primary) + Productivity (secondary).

If archetype is unclear after the 6 questions, ask the user.

---

## 2. Archetype Defaults Table

Starting points before loading domain files. Narrows the option space.

| Category | Utility | Content/Feed | Productivity | Consumer/Habit | Editorial | Tool/Pro |
|----------|---------|--------------|--------------|----------------|-----------|----------|
| **Primary action/screen** | ONE clear, 1-step | ONE + scroll context | ONE primary + contextual secondary | ONE engagement action | ONE reading/nav action | ONE primary + power menu |
| **Task step budget** | 1–2 steps | 2–3 steps | 2–3 steps | 1–2 steps | 1–2 steps | 3–5 steps |
| **Tab bar** | Standard iOS or hidden | Floating pill + auto-hide | Standard iOS | Floating pill | Hidden/minimal | Standard iOS |
| **Accent application** | CTA-Only | Semantic System | Semantic System | Expressive Spread | CTA-Only | Semantic System |
| **Dark mode base** | Layered Near-Black | True Black | Layered Near-Black | True Black or Glass | Layered Near-Black | Layered Near-Black |
| **List pattern** | Inset Hairline | Card Per Row | Card Per Row or Grouped | Card Per Row | Full-Width Line | Inset Hairline |
| **Primary button depth** | Drop Shadow | Drop Shadow | Drop Shadow | Inner Rim | Flat or Drop Shadow | Flat |
| **Tap feedback** | BG Highlight + Opacity | BG Highlight | BG Highlight + Opacity | Ripple on CTAs | Opacity Dim | BG Highlight |
| **Onboarding** | Value-First or None | Value-First | Progressive Disclosure | Interactive Tutorial or Quiz | Value-First | Progressive Disclosure |
| **Skeleton loading** | Pulse Fade | Shimmer | Pulse Fade | Shimmer | Pulse Fade | Pulse Fade |
| **Empty state** | System Icon + Text | System Icon + Text | Text Only | Custom Illustration | Text Only | System Icon + Text |
| **Toast routing** | Bottom Pill | Bottom Pill + Top Banner | All three channels | Bottom Pill + Celebration | Bottom Pill | All three channels |
| **Celebration** | Checkmark Morph | Score Tick | Checkmark Morph | Full treatment | Minimal | Checkmark Morph |
| **Motion density** | Low (2/screen) | Medium (3/screen) | Low (2/screen) | High (4+/screen) | Low (1–2/screen) | Low (2/screen) |
| **Haptic baseline** | Key moments | Key moments | Key moments | Key moments + custom | Key moments | Key moments |
| **Profile header** | Compact card (if any) | Cover + overlap avatar | Compact card | Cover + overlap avatar | Large centered | Compact card |

**Reading the table:**
- Use defaults when no per-app config exists and no explicit user preference overrides
- "or" between options: either is valid — match to secondary archetype
- "All three channels" / "Full treatment": Consumer/Habit apps earn the maximum option set
- Motion density numbers are a ceiling, not a floor

---

## 3. Domain Reference Files

When a design task requires detailed options beyond the defaults table, Read the relevant file from `${CLAUDE_PLUGIN_ROOT}/references/ios-design/`.

| Task Domain | Reference File | When to Load |
|---|---|---|
| Tab bars, back nav, transitions, sheets, page hierarchy, search | `1_navigation_structure.md` | Building navigation or screen structure |
| Lists, cards, feeds, swipe actions, content resilience, grouping | `2_lists_cards_content.md` | Building data display or content views |
| Buttons, tap feedback, haptics, toggles, form fields, placement | `3_buttons_touch_interactions.md` | Building interactive controls or forms |
| Accent color, gradients, dark mode, elevation, typography, spacing, icons | `4_color_surface_typography.md` | Defining visual identity or applying design tokens |
| Loading states, skeletons, empty states, errors, toasts, celebrations, onboarding, profiles | `5_motion_states_identity.md` | Adding state handling, animations, or onboarding |
| Step counting, task flow validation, primary action rules | `6_task_economy.md` | Designing any multi-step flow or validating task efficiency |

---

## 4. Clarification Protocol

**Default behavior: decide using archetype defaults, flag choices in output for review.**

### When to DECIDE (don't ask)

- Archetype is clear and default obviously fits
- Low-impact choice (skeleton style, toast channel, micro-interaction timing)
- User gave strong directional guidance earlier in the session

Flag the decision in output (see §5).

### When to ASK (stop and clarify)

- Archetype is ambiguous or hybrid primary is unclear
- High-impact, disruptive-to-change-later decisions:
  - Tab bar style (affects every screen)
  - Accent application tier (affects entire visual language)
  - Dark mode treatment (affects every surface)
  - Primary navigation pattern
  - Onboarding structure (affects first-run funnel)
- Conflicting signals in the session
- About to ADD an optional element to a screen (Task Economy — see below)

### Task Economy: Validate Before Adding

Before adding any of the following, validate with the user:
- A secondary action to a screen that has a clear primary
- A confirmation dialog (unless action is truly destructive)
- A settings toggle for a behavior
- An option that could be inferred from context
- A step to a flow that was previously one screen
- A "Welcome" screen before a feature is usable

**Exception — just decide:** The addition is required by the task, the user explicitly requested it, or it's a CP-required element (empty state, error handler, accessibility label).

**Validation question format:**
```
I'm about to add [element] to [screen].
Without it: [simpler version]
With it: [what it adds]
Cost: +[N] step(s) / +[N] decision(s) for the user
Should I add it?
```

### Task Economy: Step Counting

For any task flow: define the outcome, count theoretical minimum steps, count current design steps, look for cuts if gap is wider than 1–2, report count in output.

### When NOT to Ask

- Platform fundamentals (how SwiftUI works, HealthKit patterns)
- HIG principles (not preferences)
- Things already answered in earlier turns
- Minor timing/easing values

---

## 5. Output Flagging Format

Every design choice made without asking must be surfaced for audit:

```markdown
## Design Choices Made

**Inferred archetype:** [type]
**Reason:** [one sentence]

**Primary action(s) per screen:**
- [Screen]: [action] — N step(s) to complete

**Step counts for key tasks:**
- [Task]: [N steps] — floor is [theoretical minimum]

**Choices (review before committing):**
- **[Category]:** [option chosen] — [why, one sentence]

**Flagged as tentative:**
- [Choice] — [what to validate]

**Elements NOT added (Task Economy validated):**
- [What was considered] — [why cut]
```

---

## 6. Ask-First Trigger List

Always ask on a new app:
1. Archetype (if unclear after classification questions)
2. Brand accent color
3. Tab bar presence and style
4. Dark mode behavior

Ask conditionally:
5. Onboarding flow existence
6. Login/auth pattern
7. Charts usage
8. Custom vs system design approach
9. Target iOS version
10. App-specific voice/tone
11. Any optional UI element addition (Task Economy — applies throughout)

---

## Related Skills

- **ios-design**: HIG fundamentals — navigation rules, color, typography, SF Symbols, haptics, materials. What the platform requires.
- **apple-platform**: Architecture patterns, SwiftData, concurrency, CI/CD, TestFlight. How to build it.
- This skill (ios-design-router) routes design decisions to the right domain reference and applies archetype defaults.
