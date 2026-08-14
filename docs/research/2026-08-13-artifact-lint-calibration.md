# artifact_lint calibration — 476 hand-authored pages

**Date:** 2026-08-13 · **Tool:** `scripts/artifact_lint_corpus.py` ·
**Reproduce:** `python3 scripts/artifact_lint_corpus.py ~/dev/git-folder --glob '*/mockups/*.html'`

`artifact_lint.py` shipped every heuristic rule at `warn`/`info` because its
precision was unmeasured. This is that measurement, and the four rule changes it
forced.

## Corpus

476 hand-authored `*/mockups/*.html` files across 20 repositories — 463 detected as
`standalone`, 13 as `claude-artifact`. Generated reports (Lighthouse, Playwright)
were excluded: they are machine output, not authored pages, and would have diluted
every rate.

**Validity caveat, stated up front.** These are *mockups*, not published artifacts.
They were never intended to be self-contained, so a rule like `AX002` (CDN script,
43.9%) is reporting a real property of the file that its author had no reason to
avoid. The corpus is therefore a good instrument for the question *"does this rule
match what it claims to match?"* and a poor one for *"how often will a careful
author trip this?"* Every conclusion below is about the first question.

## Result

| | before | after |
|---|---|---|
| total findings | 2311 | **1659** (−28%) |

The entire reduction is false positives. No true positive was suppressed — each
change is covered by a test asserting the rule still fires on the real defect.

## The four defects it found

### 1. `AD202` title-explainer — 80.7% → 11.1% firing

Matching on the separator alone (`Name — tail`) fired on 384 of 476 pages. Reading
the evidence showed almost all were `Product — Variant`: *two names*, not a name
plus a caption. `Agent Astronomer — Aurora Deep` is not the defect the rule exists
to catch.

First fix — a four-word ceiling plus an article/possessive list — still fired on
44.3%: `Tests - Draft A` (the article `a` matching the variant letter `A`),
`ProductPilot — Your Documents` (possessive), `Atomize AI — Full App (Concept D)`
(four words). Lexical length cannot separate a name from a caption.

What works: **require a clause-linking word** — a preposition, wh-word, or
participle — or a tail of 7+ words. Survivors are now genuine:
`SpeakSavvy — communicate with clarity` (a tagline),
`ProductPilot — From idea to implementation docs in minutes`. Estimated precision
~70–80% at 11.1% firing, up from roughly 10% at 80.7%.

### 2. `AS506` / `AS508` — charts were being graded as diagrams

Both gated on "the SVG contains `<text>`", which is true of every bar chart. `AS508`
was reporting a 12-colour categorical palette as a colour-budget violation — the
exact thing the `data-visualization` skill says is *correct*. A linter contradicting
a sibling skill is worse than no linter.

Fix: `AS506` and `AS508` now require an **arrow** (`marker-end`). Text separates a
drawing from an icon; an arrow separates an explanatory diagram from a data
graphic. 44 → 1 and 43 → 1 findings.

`AS505` (accessible name) deliberately still applies to charts — a chart needs a
label as much as a diagram does. Asserted by
`test_charts_still_get_the_universal_svg_rules`.

### 3. `AD102` — 222 findings across 12 files

Correct rule, unusable output: one finding per orphaned token meant ~18 identical
rows per file, burying everything else. Now one row per file naming the tokens.
222 → 12 findings, same 12 files. The `findings_per_firing_file` column in the
corpus tool exists because of this.

### 4. `AD401` cream — matching pink

The warm-cream test required `r > b` but not `g > b`, so Tailwind red-50 (`#FEF2F2`)
was reported as the cream cliché. Warm cream is yellow-biased: red above green above
blue. Added `g − b ≥ 4`.

## Rules confirmed correct

Verified against instances, not rates:

- `AD106` (37.8%) — **174 of 180 firing files have zero `var(--` references.** The
  finding is literally true and actionable. Threshold changed from a flat "3+
  literals" to "literals outnumber token references", which is what makes it mean
  something; message now distinguishes "no token system at all".
- `AD203` (18.5%), `AD304` (22.3%), `AD402` (8.8%), `AD301` (8.0%), `AD105` (20.0%),
  `AX002` (43.9%) — all sampled, all factually correct about the file.
- `AD303` (56.5%) — high, but mockups genuinely do not style focus. True positive;
  the rate reflects the corpus, not the rule.

## Never fired

`AX005 AX006 AX007 AX009 AD204 AD404 AS501 AS502 AS503 AS504 AS510` — 11 rules.
Expected: these target artifact-specific failures (oversize, sandboxed downloads,
`window.claude`, mermaid portability) or SVG defects absent from this corpus. Each
is covered by a unit-test fixture, so zero firings here is evidence about the
corpus, not about the rule. **Do not delete a rule for never firing on one corpus.**

## Standing policy

No heuristic may be promoted to `error` without a measurement like this one, and a
firing rate is a proxy for *where to look*, never a substitute for reading
instances. Re-run this after any rule change:

```bash
python3 scripts/artifact_lint_corpus.py ~/dev/git-folder \
    --glob '*/mockups/*.html' --samples AD202,AD106
```
