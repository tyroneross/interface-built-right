---
name: dashboard-design
description: Use when building a dashboard — any view that surfaces the current state of work, data, or decisions so someone can orient and act. Covers archetype selection, MECE data separation, the append-only record contract for dashboards that capture actions, progressive disclosure, and navigation. Triggers on "build a dashboard", "status page", "work queue", "scorecard", "tracker", "show me the state of", "aggregate across projects", "check off tasks in a dashboard".
version: 0.1.0
user-invocable: false
---

# Dashboard Design

A dashboard surfaces **current state so someone can act**. That is the whole test. A
page that presents data without a decision behind it is a report; build that with
`artifact-design` instead.

Rules here carry stable IDs (`DB…`) and are graded by `scripts/dashboard_lint.py`.
Prose cites IDs so prose and code cannot drift.

## 1 · Pick the archetype first

Eight archetypes, derived from a corpus of real dashboards. Pick one — a dashboard
that is two archetypes at once is two dashboards (**DB101**).

| Archetype | The job | Ordering principle | Interaction |
|---|---|---|---|
| `queue` | What is waiting on me | Priority, then age | filter, act |
| `control` | Is governed state healthy and fresh | Identity → freshness → counts | filter |
| `scorecard` | How do these compare on a rubric | Score, then disagreement | filter, sort |
| `status` | What shipped, what is open | Shipped vs open | filter |
| `brief` | Should we do X — argument + evidence | Argument order | disclosure |
| `gallery` | Which option do I choose | Option order | select |
| `tracker` | Where is each entity in its pipeline | Stage, then next action | act, persist |
| `ambient` | At-a-glance, low density, personal | Most-actionable first | none |

**DB102 — Priorities above the fold.** The first screen answers "what needs me now,"
not "here is everything." Counts are not priorities: `4 open` is a fact, `2 blocked on
you` is a priority.

**DB103 — Progressive disclosure.** Level 1 is the priority set. Level 2 is the full
list. Level 3 is one item's detail and provenance. Never render level 3 for every row.

**DB104 — Round-trip navigation.** Every drill-in has a labeled way back to where the
reader came from. A dashboard you can only leave with the browser Back button fails.

## 2 · MECE data separation

**DB201 — One scope, one record.** Each project/entity owns its own record directory.
Records are never merged into a shared store.

**DB202 — Aggregate by replay, never by merge.** A multi-project view replays N record
directories side by side and keeps `scope_id` on every row. Two projects' tasks never
land in one list without their scope visible.

**DB203 — Nest, don't flatten.** Tasks belong under their scope. A flat task list
across scopes loses the ownership that makes the dashboard actionable.

## 3 · The record contract

A dashboard that captures anything — a check-off, a note, a decision — **must not store
it in the dashboard**. The HTML is disposable and regenerated; the record is canonical.

**DB301 — Append-only events.** Actions append; nothing is edited or deleted in place.

**DB302 — One writer per file.** Each device/agent appends only to its own segment:

```
<scope>/record/events-<writer-id>.jsonl
```

`writer-id` is a UUID the writer **mints on first use** and caches locally
(`.dashboard/writer-id`). There is no roster and no registration: a new machine, a new
person, or a new agent simply starts a new segment. This is what makes the dashboard
machine-independent and sync-agnostic — git, iCloud, Dropbox, or a copied folder all
converge, because no two writers ever touch the same file.

**DB303 — Event shape.**

```json
{"event_id":"ev_01J…","ts":"2026-08-15T19:40:00Z","writer":"w_9f2c…","actor":"tyrone",
 "scope_id":"active-ai-working-group","entity_id":"awg-004","op":"check",
 "field":"done","value":true,"note":null,"evidence":"tracker v1 line 12"}
```

Ops: `check` · `uncheck` · `set` · `note` · `decide` · `defer`.

**DB304 — Deterministic replay.** State is derived by replaying every segment ordered by
`(ts, writer)`, last-write-wins per `(entity_id, field)`, duplicate `event_id` ignored.
Same events in any file order produce the same state.

**DB305 — Show the derivation.** The rendered view names its record source and content
hash, so a reader can tell which events produced what they see.

**DB306 — Never invent authority.** An event records what a person did. It does not
promote a candidate, mark something sent or scheduled, or infer ownership.

## 4 · Binding and lifespan

**DB401 — Separate data from presentation; default to fetched.** The HTML shell is
expensive to author and cheap to keep; the data is cheap to regenerate and changes
constantly. Never rebuild the shell to change a number. Emit data as a sibling file and
let the page read it, so a deterministic script — not an LLM — refreshes the numbers.

The page reads that file through a **binding ladder**, because a bare `fetch()` does not
work from a file. Measured in headless Chrome, 2026-08-15:

| Approach from `file://` | Result |
|---|---|
| `fetch('./data.json')` | **fails** — `TypeError: Failed to fetch` (origin restriction) |
| `<script src="./data.js">` setting `window.DASHBOARD_DATA` | **works**, no server |
| injected `<script src="./data.js?t=…">` | **works and refreshes live**, no reload |

So a dashboard emits **both** `data.json` (canonical, what tools and agents read) and
`data.js` (the same object wrapped as an assignment, what a browser reads offline), and
tries `fetch()` first, falling back to the script tag. Over `http://` the fetch wins; from
a double-clicked file the fallback wins. Same file, both contexts, no daemon.

**DB401a — A dashboard must open with no server running.** Requiring a background
process is the single most common way a local dashboard rots: the page loads, the data
does not, and the reader sees an error instead of their work. Reserve `live` for data that
genuinely cannot be materialised to a file (streaming, per-request auth), and say so.

**DB401b — Absolute data paths are a defect.** `fetch('/api/items')` binds the page to one
host and one running service. Reference data relatively (`./data.js`) so the dashboard
survives being copied, synced, or emailed.

**DB402 — Date what is frozen.** A point-in-time dashboard carries its date in the
filename and a visible snapshot label. A living dashboard carries an as-of timestamp.
A stale snapshot that looks live is the failure this prevents.

**DB403 — Self-contained by default.** No remote scripts, fonts, styles, analytics, or
chart services. Inline everything; embed images as data URIs. An LLM handing a
dashboard to someone else cannot assume their network.

## 5 · Visual and accessible floor

Load `data-visualization` before adding any chart — the chart-worthiness gate applies:
show a chart only when the visual reveals a pattern faster than the text would.
Load `design-guidance` for tokens, layout, and component selection.

**DB501 — Text plus colour for every state.** Colour alone never carries meaning.
**DB502 — 4.5:1 contrast** on every foreground/background pair; measure, do not eyeball.
**DB503 — 44px touch targets** on mobile, 24px on pointer devices.
**DB504 — Content ratio ≥70%.** Chrome, borders, and padding do not outweigh data.
**DB505 — Reduced motion respected**; visible keyboard focus on every control.
**DB506 — Real controls only.** A control that looks interactive does something. No
placeholder buttons, no fake mutation — that is `integrity` in the design foundations.

## 6 · Build it

```bash
python3 scripts/dashboard_build.py new --archetype queue --title "…" -o spec.json
python3 scripts/dashboard_build.py build spec.json -o dashboard.html --check
python3 scripts/dashboard_lint.py dashboard.html --json
python3 scripts/dashboard_record.py append --scope <dir> --entity <id> --op check
python3 scripts/dashboard_record.py replay --scope <dir> --json
```

Verify the result in a browser before calling it done — `design-validation` owns that
pass. A dashboard that lints clean and renders wrong is not done.
