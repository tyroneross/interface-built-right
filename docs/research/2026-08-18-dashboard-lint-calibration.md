# dashboard_lint calibration — 16 pages, one rule rewritten

**Date:** 2026-08-18 · **Tool:** `scripts/dashboard_lint.py corpus` ·
**Reproduce:**
`python3 scripts/dashboard_lint.py corpus mockups web-ui/designs web-ui/public/mockups --glob '**/*.html'`

`dashboard_lint.py` ships eight rules and three of them can fail a build. This is
the measurement that decided which three, taken before any rule was allowed to
carry `error` — because a gate that cries wolf gets switched off, and is then worse
than no gate at all.

## Corpus

Every hand-authored `.html` in the repository: 16 files across `mockups/`,
`web-ui/designs/`, and `web-ui/public/mockups/`. Engine fixtures under
`src/engine/fixtures/` were excluded — they are two-line parser inputs, not pages,
and would have diluted every rate toward zero.

**Validity caveat, stated up front.** Only five of the sixteen are dashboards; the
rest are product mockups and design-system pages. They were never written against
this contract, so a rule like DB403 is reporting a real property of a file whose
author had no reason to avoid it. The corpus answers *"does this rule match what it
claims to match?"* well and *"how often will a careful author trip it?"* poorly.
Every judgement below is about the first question, and the dashboard-only cut is
reported separately where the two diverge.

## Result

| rule | sev | H | files | rate (16) | rate (5 dashboards) | findings | precision |
|---|---|---|---|---|---|---|---|
| DB402 no-freshness-label | warn | H | 15 | 93.8% | 100% | 15 | 15/15 |
| DB403 external-request | error | | 10 | 62.5% | 20% | 19 | 19/19 |
| DB401a server-dependent-data | warn | H | 0 | 0% | 0% | 0 | — |
| DB401b absolute-data-path | error | | 0 | 0% | 0% | 0 | — |
| DB501 state-by-colour-alone | warn | H | 1 | 6.2% | 0% | 1 | 1/1 |
| DB502 contrast-below-aa | warn | | 2 | 12.5% | 0% | 2 | 2/2 |
| DB503 target-below-floor | error | | 0 | 0% | 0% | 0 | 2 FP, fixed |
| DB507 fixed-width-overflow | error | | 0 | 0% | 0% | 0 | — |

Precision is by reading every instance, not by sampling — at 39 findings there was
no reason to sample.

## The defect it found

### DB503 measured decoration and called it a control — 2 findings → 0

Both of DB503's findings were `.tab-icon { height: 16px; width: 16px }` in
`web-ui/public/mockups/github-repo.html`. The selector matched because `tab-icon`
contains `tab`, and the rule then reported a 16px tab.

The 16px glyph inside a 40px tab is decoration. The tab is the target. A rule that
cannot tell a control from its parts is measuring the wrong box, and at `error` it
would have failed a build over an icon that is exactly the size it should be.

Fixed by excluding selectors that name a part rather than a control — `icon`,
`glyph`, `dot`, `indicator`, `badge`, `caret`, `chevron`, `spinner`, `avatar`,
`swatch`, bare `svg`/`img`/`path`, and the `::before`/`::after` pseudo-elements.
That took DB503 to zero findings on the corpus with no true positive suppressed:
`test_a_touch_media_query_raises_the_floor_to_44` still fires the rule on a real
32px control under coarse input, and
`test_an_icon_inside_a_control_is_not_the_target` pins the fix.

## Severity decisions

**`error` — DB403, DB401b, DB503, DB507.** Each decides on a literal in the file:
a URL with a host, a path with a leading slash, a px length, a px width. None
infers intent. DB403 is the only one with firings to judge and all 19 are true —
`cdn.tailwindcss.com` script tags and `placehold.co` images, every one a real
request to a real third party.

DB401b, DB503, and DB507 fired zero times across all 16 files. **That is the
measurement, not the absence of one:** a rule that never fires on the existing
corpus cannot cry wolf on it, which is precisely what the gate needed to establish.
Their behaviour on the defect is proved by mutation instead —
`scripts/test_dashboard_lint.py` breaks each and asserts it fires, and fires alone.

**`warn` + heuristic — DB402, DB401a, DB501.** Each reasons from a vocabulary: a
freshness phrase, a state word in a class name, an inferred fallback. A vocabulary
is a guess about intent, and a guess must never fail a build.

DB402 is the clearest case for keeping it advisory. Its 15 findings are all true —
none of those pages carries a freshness label — but a rule firing on 93.8% of the
corpus (100% of the actual dashboards) cannot be the thing that turns a build red on
day one. The first response would be `--disable DB402`, and the rule would be dead
rather than advisory. It stays `warn`, gets fixed page by page, and can be revisited
once the rate falls.

**`warn`, not heuristic — DB502.** It measures rather than guesses, so it is not
flagged heuristic, but it inherits `warn` from `artifact_lint`'s AD108 for the same
reason: WCAG gives large text and non-text UI a 3:1 floor, and this pass judges
everything at 4.5:1. Both findings are genuine (`.btn-run` at 3.0:1, `.btn-danger`
at 4.4:1) — but a rule that grades a 24px heading by the body-text floor would
sometimes be wrong at `error`.

## The one judged instance

DB501's single firing is `<div class="nav-icon active">` in
`mockups/01-sessions-view.html`: an icon-only nav item whose selected state is a
background tint and a border, with no text and no `aria-label`. Counted true — the
selected state really is carried by colour alone — but marked marginal, because the
icon's *shape* still says which item it is. It is the reason DB501 stays advisory
rather than blocking.

## Re-run this after any rule change

```bash
python3 scripts/dashboard_lint.py corpus mockups web-ui/designs web-ui/public/mockups \
  --glob '**/*.html' --samples DB402,DB403
```

Firing rate is a proxy for *where to look*, never a substitute for reading
instances. DB503's two findings looked like a 6.2% rate worth ignoring; reading them
showed the rule was measuring icons.
