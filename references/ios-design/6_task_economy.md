# Calm Precision 6.4.2 — Task Economy Patch

Single-principle addition to CP 6.4.1. Adds **Principle 14: Task Economy** — making task completion fast, intuitive, and step-minimal the foundational design constraint.

**Version:** 6.4.2
**Supersedes:** 6.4.1 (additive only — no changes to existing principles)
**Status:** Additive patch. Apply alongside 6.4.1.

---

## WHY THIS PATCH EXISTS

CP 6.4.1 covers cognitive predictability through structure (Gestalt, Fitts, Hick, Cognitive Load). What it doesn't operationalize: **the total step count to accomplish a task**.

An app can score 100% on every CP principle and still make the user tap 7 times to do something that should take 2. Structure is necessary but not sufficient. Task Economy closes the gap.

**The problem it solves:** LLMs and designers often add options because they're available, not because they're needed. Every extra button, screen, or choice costs the user cognitive load and time. Task Economy forces explicit justification for each addition.

---

## PRINCIPLE 14: TASK ECONOMY

**Hick's Law + Cognitive Load Theory + Fitts' Law (applied to flow, not just individual controls)**

Every screen has ONE primary task. Every task has a minimum step count. Design to approach that minimum.

### 14.1 The Three Commitments

**Commitment 1 — One clear action per screen.**
Every screen has one primary action that accomplishes its key task. Secondary actions exist only when justified.

**Commitment 2 — Don't add unnecessary options.**
Every interactive element must justify its presence. If an option isn't frequently needed OR critical, it doesn't belong on the primary surface. Validate with the user before adding.

**Commitment 3 — Minimize steps to task completion.**
When building any flow, count the steps. Look for ways to make it shorter, faster, more intuitive.

### 14.2 Step Counting (The Core Discipline)

Before building any task flow:

1. **Define the task outcome** — what is the user trying to accomplish?
2. **Count the minimum possible steps** — what's the theoretical floor?
3. **Count the current design's steps** — what does it actually take?
4. **Identify where steps can be cut** — smart defaults, combined actions, inference
5. **Validate the result** — does the gap close? If not, why?

### 14.3 Step-Counting Rules

A "step" is any user action that requires a decision OR an input:
- A tap = 1 step (if it requires the user to decide/locate)
- A text entry = 1 step (no matter how many characters)
- A scroll = 0 steps (not a decision, not an input)
- A passive screen view = 0 steps
- A required screen with only a "Continue" button = 1 step (counts as decision friction even if obvious)

Steps NOT to count:
- System confirmations the user didn't choose (OS prompts)
- Animations
- Waiting for load

### 14.4 Step Budget by Task Type

Rough ceilings for common mobile task types. Aim below these, never above without justification.

| Task Type | Step Budget | Example |
|-----------|-------------|---------|
| Start a core feature | 1 step | Tap "Start" on home → timer starts |
| Create a simple item | 2–3 steps | Tap "+" → enter text → tap "Save" |
| Create a complex item | 4–6 steps | Multi-field form with required categorization |
| Edit existing item | 2 steps | Tap item → edit → auto-save (tap elsewhere) |
| Complete a task | 1 step | Tap checkbox |
| Delete an item | 2 steps | Swipe → confirm (OR tap → swipe, etc.) |
| Share something | 2–3 steps | Tap share → select destination → send |
| Change a setting | 2 steps | Navigate to settings → tap toggle |
| Search | 2 steps | Tap search → type (results appear progressively) |
| Sign in (returning user) | 1 step | Face ID / biometric |
| Sign in (new user) | 2–3 steps | Tap "Sign in" → auth provider → confirm |

### 14.5 Common Sources of Step Bloat

Watch for these anti-patterns:

| Anti-Pattern | Step Cost | Fix |
|--------------|-----------|-----|
| "Are you sure?" on non-destructive actions | +1 step | Remove — only confirm truly destructive |
| Multiple confirmations for same action | +1–3 steps | Consolidate to one |
| Options screen before action screen | +1 step | Set smart default, allow override inline |
| Multi-step wizard when one form would work | +2–5 steps | Combine screens when no state-dependency |
| Required onboarding before app is usable | +3–10 steps | Value-first — let user try before asking |
| Login required for features that don't need it | +2–5 steps | Defer login until required |
| "Welcome" screens that teach vs. do | +1 per screen | Let users learn by doing, not reading |
| Repeated navigation (drill down, back, drill again) | +4+ steps | Show related items in context |
| Permissions requested upfront | +1 per permission | Ask when capability is used |
| Multiple taps for single action | +1 each | Combine into one interaction |

### 14.6 The "Validate Before Adding" Rule

When a decision is being made to ADD something to a screen (button, option, toggle, step, confirmation):

**Ask the user first unless:**
- The addition is clearly required by the task (e.g., a form needs a submit button)
- The user explicitly requested it
- It's a CP-required element (e.g., empty state, error handler)

**Especially validate when:**
- Adding a secondary/tertiary action to a screen that has a clear primary
- Adding an option that could instead be inferred from context
- Adding a confirmation dialog
- Adding a step to a flow that was previously one screen
- Adding a settings toggle for a behavior

The question to ask: *"Is this necessary? Here's what the screen would look like without it: [X]. Here's the case for adding it: [Y]. Should I add it?"*

### 14.7 Primary Action Rules

Every screen has ONE primary action. This action:

1. **Is visually dominant** — larger, higher contrast, or centered compared to secondary actions
2. **Is reachable** — within thumb zone on mobile, positioned for the dominant hand
3. **Is predictable** — same verb/position across similar screens in the app
4. **Has one label** — not "Save / Continue / Next" combined
5. **Triggers the screen's reason for existing** — if the user doesn't know what the primary action is, the screen has failed

### 14.8 When Multiple Actions Are Justified

A screen can have multiple visible actions when:
- **They're equal alternatives** (Accept / Decline — not hierarchical)
- **They're sequential in a workflow** (Back / Continue in onboarding)
- **One is destructive** (Save / Discard)
- **Context demands a secondary** (Share button on a detail screen with primary "Edit")

A screen CANNOT have multiple actions when:
- The user would be unclear which is primary
- One action is rare enough it could live in a menu
- The "additional" action is really an edge case

### 14.9 Auto-Apply Rules (Add to CP 6.4.1's list)

| # | Rule |
|---|------|
| 31 | Every screen has exactly one primary action that accomplishes its key task |
| 32 | Count steps for every task flow; document the count in output |
| 33 | Validate with user before adding any optional element to a screen |
| 34 | Never confirm non-destructive actions |
| 35 | Defer required actions (login, permissions, onboarding) until the feature needs them |
| 36 | Combine sequential screens when they have no state-dependency |
| 37 | Use smart defaults instead of choice screens where possible |
| 38 | Primary action is visually dominant, reachable, predictable, single-labeled |

### 14.10 Audit Questions (Add to Quick Audit §23)

25. Does every screen have exactly one clear primary action?
26. Is the minimum step count for the main task documented?
27. Has every optional element been justified vs. simpler alternatives?
28. Are there any "Are you sure?" on non-destructive actions? (Remove.)

### 14.11 Foundational Science

Task Economy extends three existing foundations:

**Hick's Law (extended):**
Choice time increases logarithmically with number of choices. CP 6.4.1 applied this to individual screens; Task Economy applies it to *flows* — the sum of choices across a task.

**Cognitive Load Theory (extended):**
Working memory is limited. Each step in a task consumes working memory for the current step + remembering the goal. Fewer steps = more memory available for the actual goal.

**Fitts' Law (extended):**
Time to reach a target is a function of distance and size. In flows, "distance" becomes the depth of navigation. Each screen traversed is travel time. Each decision is aiming time.

---

## HOW THIS INTEGRATES WITH THE OPTION CATALOG

The catalog system (Router + 5 domain files) already respects Task Economy in several ways, but this principle now makes the discipline explicit:

### Router Updates
- **§3 Clarification Protocol:** Add "Validate Before Adding" as a default behavior
- **§2 Defaults Table:** Add "Primary action per screen" column
- **§4 Output Flagging:** Require step count in every flow output

### Domain File Impact
- **File 1 (Navigation):** Step-count budget for nav flows, "one primary action" rule on every screen
- **File 2 (Lists/Cards):** Card actions — primary vs. swipe vs. menu — determined by frequency
- **File 3 (Buttons):** CTA sizing enforces visual dominance of primary action
- **File 5 (Motion/States):** Onboarding step count explicit, value-first prefers shorter flows

All updates applied in parallel with this patch.

---

## WORKED EXAMPLE

Task: "User wants to start a 25-minute focus session."

### Version A (Step-Bloated)
1. Open app → splash screen
2. Tap "Start new session"
3. Choose mode (Focus / Break / Flow)
4. Set duration (slider)
5. Tap "Confirm"
6. "Ready to start?" confirmation dialog
7. Tap "Start"

**Step count: 6** (splash is passive, doesn't count)

### Version B (Task-Economic)
1. Open app → home screen shows "Start 25-min Focus" button (smart default, recent choice)
2. Tap → session starts

**Step count: 1**

What changed:
- No confirmation dialog (non-destructive — no need)
- Smart default for mode (uses last-used) and duration (25m default, but inline customizable)
- No separate "choose" screen — options revealed on long-press or small settings affordance, not blocking
- Value-first — app opens ready to do the thing it's for

Output flag would include:
```
## Step Count
Primary task (start focus session): 1 step
Floor: 1 step (can't be lower)
Result: at minimum ✓
```

---

*Calm Precision 6.4.2 — Task Economy Patch*
*Adds: Principle 14 (Task Economy), Auto-apply rules 31–38, Audit questions 24–27*
*Applies: To CP 6.4.1 baseline, all iOS catalog files, all platform fundamentals*
