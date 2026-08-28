# Type Scale

Load when setting or auditing font sizes, line heights, or heading hierarchy.

Canonical source: `~/dev/docs/standards/typography/scale.yaml`.
Generate real values — never hand-pick them:

```bash
cd ~/dev/docs/standards/typography
python3 generate.py --emit css   --media web_app     # CSS custom properties
python3 generate.py --emit md    --media web_app     # role table
python3 generate.py --check                          # invariant conformance
python3 generate.py --audit <path> --media web_app   # grade existing code
```

## The model

**Body is the anchor. Everything else is a multiple of it.** The anchor is set by
viewing distance and task, never by screen size — a phone and a laptop land near
the same body size because distance differs proportionally. What screen width
controls is how far the ladder reaches *above* body.

| Medium | Anchor | Gap | Top | Floor | Measure |
|---|---|---|---|---|---|
| `web_app` | 16px | 8 | 2xl (32) | **14** | 45–75ch |
| `reading_doc` | 19px | 10 | 2xl (38) | 14 | 60–75ch |
| `marketing_web` | 18px | 9 | 3xl (45) | 14 | 45–70ch |
| `mobile_app` | 16sp | 8 | 2xl | 12 | 30–40ch |
| `ios_app` | 17pt | 5 | 2xl | 11 | 30–40ch |
| `presentation` | 20pt | 8 | 2xl | 16 | 30–45ch |
| `tv` | 29pt | 10 | 2xl | 24 | 30–45ch |

## Step ladder (multiples of body)

`3xs .6875 · 2xs .75 · xs .8125 · sm .875 · md 1.0 · lg 1.25 · xl 1.5 · 2xl 2.0 · 3xl 2.5`

Names are strictly monotonic — `md` is always the anchor. At a 16px anchor with a
14px floor, `web_app` exposes exactly five sizes: **14 / 16 / 20 / 24 / 32**.

Steps compress near body (~1.08–1.14) and expand above it (~1.20–1.33). This is
deliberate and matches Material 3 and Apple HIG. A pure geometric scale from one
ratio has no step between 12 and 16 — precisely where dense UI needs the most
resolution.

## What each multiple communicates

| × body | Reader infers | Roles |
|---|---|---|
| 2.5–4.0 | a statement, not a label | hero, KPI number |
| 1.6–2.0 | the title of the whole thing | page title |
| 1.3–1.5 | a heading over the content below | section title |
| 1.15–1.25 | one rank up, same family | subsection |
| **1.05–1.12** | ⚠️ **reads as a mistake** | — use weight instead |
| 1.0 | this is the content | body, card title |
| 0.85–0.9 | same topic, supporting | secondary body |
| 0.75–0.8 | context, not content | caption, metadata |

**Below ~1.15×, stop using size.** Apple's Headline and Body are both 17pt,
separated only by weight — that one decision is why iOS needs so few steps.
Size is expensive (consumes layout space); weight and color are free.

## Leading — constant gap, not constant ratio

```
line_height = font_size + leading_gap        # gap ≈ 0.3–0.5 × body
```

Derived from the platform data: Material 3 holds a 6–8px gap from 14sp to 57sp;
Apple holds 4–7pt from Caption to Large Title. The familiar "1.5 at body, 1.12 at
display" curve is just what a constant gap looks like expressed as a ratio. Set
one number, derive every line height.

Exception: body text on long measures needs more than the constant gap — leading
rises with line length so the eye can find the next line start.

## Hard rules

- **Nothing below the medium's floor.** No carve-out for legal, captions, or fine
  print. Human vision does not exempt fine print.
- **Body weight ≥ 400.** Weights under 400 only at ≥24px with strong contrast.
- **Measure 45–75 characters.** Cap it on the text container, not the page.
- **Scalable units** — `rem` (web), `sp` (Android), Dynamic Type (Apple). Fluid
  `clamp()` uses `rem` for min AND max and mixes a `rem` term into the preferred
  value; a pure `vw` preferred value fails WCAG 1.4.4 zoom.
- **WCAG large text is 18pt / 14pt bold ≈ 24px / 18.5px** — not 18px/14px. Below
  those thresholds normal text needs 4.5:1, not 3:1.
- **Heading level ≠ visual size.** Choose the semantic level for the document
  outline, then apply a size class. An `h2` may legitimately look small.
- **All-caps only for short isolated labels.** Continuous caps read 13–20% slower.
  Caps need positive tracking (+0.05em or more) and are exempt from the
  "headings track tighter than body" rule.

## Consequence of a 14px floor

At `web_app`, caption / eyebrow / legal / body_small all land on 14. The metadata
tier can no longer be signalled by **size** — carry it with **color and weight**
instead (three levels of muting at one size). This is the intended cost of the
floor, not a bug. Where a surface genuinely needs a rank below 14, set
`floor_size: 12` for that surface explicitly rather than sprinkling sub-floor
values.

## Typeface

Serif vs sans is a settled non-question — no reliable legibility difference.
Individual matching, however, moves reading speed up to 35% with comprehension
held, so **the lever is user-adjustable size and spacing, not a house font.**

- Native platform → system font (free Dynamic Type / `sp` scaling, zero load cost).
- Cross-surface brand consistency → one variable font with an `opsz` axis.
- Verify `I`/`l`/`1` and `0`/`O` are disambiguated; use tabular numerals in columns.

⚠️ Sizes here are absolute multiples of the anchor with **no optical
normalization**. x-height varies substantially between typefaces, so swapping the
primary family shifts apparent hierarchy everywhere. Supporting more than one
primary family requires per-family normalization (USWDS normalizes each size token
against SF Pro and Roboto).

## Applying the scale to existing code

**Do not run a nearest-px snapper over a codebase.** Current size is *evidence* of
intent, not intent. A rule at 20.8px might be a section title that drifted down or
a subsection that drifted up; only the markup around it says which. Snapping by
arithmetic alone silently rewrites hierarchy.

Work in three tiers. Escalate rather than guess.

### Tier 1 — deterministic (script it, no judgment)

- Any size **below the medium's floor** → the floor. Not a judgment call.
- A size within **0.5px of an allowed step** → that step. Rounding noise.
- `line_height` → `size + leading_gap` once the size is settled.
- Duplicate rules that already agree → leave alone.

A script may write these directly. Everything else it should *queue*, not apply.

### Tier 2 — assessed (agent judgment, one call per selector)

For each queued rule, decide the **role** first, then take that role's step. Read
the element, not the number:

| Signal | Reads as |
|---|---|
| `h1`–`h6` tag, or first text in a container | heading — rank by nesting depth |
| Short noun phrase, no verb | title (`card_title` / `section_title`) |
| Full sentence or paragraph | `body` or `body_small` |
| Date, count, author, tag, breadcrumb | `caption` |
| Repeated once per list item | component role, not a global one |
| All-caps, short, above a heading | `eyebrow` |
| Inside a `<pre>`/`<code>` | `code` — mono, one step below body max |

Use the current size **only to break a tie** between two adjacent candidate roles.

Then check the local effect: does the new size still sit below its container's
title and above its own metadata? If a role inverts against its neighbour, the
role assignment is wrong — not the scale.

### Tier 3 — escalate to the human

Stop and ask when:

- **A rank disappears.** Two selectors that were visually distinct now land on the
  same step *inside the same container*. Options: carry it with color/weight, set a
  lower `floor_size` for that surface, or accept that the rank was never real.
  This is a design decision, not a cleanup.
- **A file's own scale is at stake.** If >30% of one file's rules would change, the
  file has its own internal system — assess it whole rather than rule-by-rule.
- **The L1 anchor moves.** Changing the largest element on a page changes what the
  eye lands on first.
- **A brand or marketing surface.** The hero multiplier is a positioning decision.

### Carve-outs that need recognition, not regex

Never snap these by pattern match — identify them first:

- **Chart internals** — see below.
- **`:root` / token definitions** — change the token, then let usages inherit.
  Snapping both the token and its usages double-applies.
- **`@media` overrides** — must land on the same step as their base rule, or the
  breakpoint introduces a size that exists nowhere else.
- **Vendor / third-party CSS** — out of scope, leave it.

### Output contract

An application pass reports: rules changed deterministically · roles assigned with
their reasoning · ranks collapsed · items escalated. A pass that reports only a
count of changed rules has not done tier 2.

## Known carve-out — chart internals

Axis tick labels, sparkline annotations, and heatmap cell labels in
`references/data-visualization-patterns.md` sit at 9–12px. Charts are not prose:
labels are read against a positional encoding, and forcing them to 14px breaks
the plot geometry. This carve-out is **scoped to marks inside a chart frame** —
chart titles, legends, axis *titles*, and any surrounding copy follow the floor.
Recorded as a deliberate exception, not an oversight.
