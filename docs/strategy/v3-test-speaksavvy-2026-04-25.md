# v3 Field Test — IBR vs SpeakSavvy iOS

> Date: 2026-04-25. Setup: booted iPhone 17 Pro sim
> (`EF9575B8-18A4-45A0-AE8A-D1CFD36765FA`), SpeakSavvy 1.0 launched
> (`com.speaksavvy.app`), Simulator window at host (1087, 90) size 402×926.

## Bottom line

The "new IBR" (custom CDP engine + bundled sim-driver) ran end-to-end against
a real native iOS app for the first time. It exposed **three real bugs** and
incidentally validated the v3 thesis from a single test session. The bugs
are concrete enough to file as Phase 1.5 work; the thesis validation is
useful framing for the roadmap.

## What worked ✅

| Capability | Result |
|---|---|
| App launch via simctl | `xcrun simctl launch ... com.speaksavvy.app` returned PID 97437 |
| Screenshot capture (headless) | `simctl io screenshot` worked with no visible window prereq |
| sim-driver CLI invocation | Compiled binary returned `{"success":true,"action":"tap"}` for all attempts |
| Window discovery | `CGWindowListCopyWindowInfo` correctly located the simulator at host (1087, 90) 402×926 |

## What broke ⚠️

### Bug 1 — native:scan targets the wrong process

```
$ ibr native:scan "iPhone 17 Pro" --json
elements.all: 35
elements.interactive: 0
labels found: Apple, File, Edit, Device, View, Window, Simulator
SpeakSavvy elements: 0
```

The 35 elements returned are all **Simulator.app menu bar items**. The AX
extractor (`ibr-ax-extract`) reads from the macOS host process tree, not
the iOS guest app's accessibility tree. This is the same root cause as the
"0 interactive elements" finding from the prior IBR audit.

**Fix path:** the Phase 2 plan in `NATIVE_SUPPORT_PROPOSAL.md` —
`XCAXClient` queries against the booted simulator runtime, or
`xcrun simctl spawn <udid> accessibility_audit`. Filed as task #7.

### Bug 2 — sim-driver lies about success when the window is hidden

Six tap and swipe attempts all returned `{"success": true}`. None
propagated to iOS. The Simulator window was either obscured by Claude
Code's terminal, or was on a Space the click target couldn't reach. The
driver checks "did CGEvent.post return without error" — which is trivially
true, even when the click goes to nowhere. Filed as task #8.

**Diagnostic:** `osascript ... count of windows = 0` even though
CGWindowList saw the window. Modern Simulator.app uses a non-standard
NSWindow class that AppleScript can't enumerate, but CG can. Need a
visibility check that treats CG window list as truth and verifies the
target host coordinate is occupied by that window's pixels (not occluded).

### Bug 3 — sim-driver coord translation is fragile

Default mode treats input as iOS-logical when inside window bounds, else
window-relative. That couples callers to a 52px chrome offset they
shouldn't need to know about.

**Verified:** window total = 402×926, iOS screen logical = 402×874,
chrome top inset = 52px.

**Fix:** accept iOS logical points (e.g. 200, 760 for "Start Practicing")
and have the driver compute host coords via known chrome offset or
runtime NSWindow contentView introspection. Filed as task #9.

## v3 thesis validation

This test inadvertently demonstrated three of the five shifts in
`docs/strategy/v3-thesis.md`:

**Shift 1 — Q-DSL over scan-dump.** The scan returned 35 elements of
host chrome. The agent had to read all of it to discover that 0 were
SpeakSavvy. A `ibr ask "what's the page intent"` against the iOS app
would have either returned an answer or correctly errored "cannot reach
guest accessibility tree" — both of which are more useful than 35
irrelevant elements.

**Shift 2 — judgement at the engine.** No scan rule fired "this output
is the host process, not the guest" — the engine returned data without
sanity-checking it against the request. A verdict-shaped engine would
have flagged the mismatch.

**Shift 3 — fail-fast over silent success.** sim-driver's "success"
return is the agent equivalent of a unit test passing because it never
asserted anything. An LLM consuming this output has no way to know the
tap missed. Verdicts must include "did the action have an observable
effect" as a first-class field.

## Action items

- [✅ #7] `native:scan` no longer claims to see the iOS guest. Filters host chrome (application/menubaritem/nav) by `tagName`. When the filtered count is zero on an iOS target, sets verdict=ISSUES and emits a clear error pointing at IDB / the planned XCUITest path. Verified: scan payload 19KB → 1.2KB; verdict PASS (false positive) → ISSUES (honest).
- [✅ #8] sim-driver fail-fast on occlusion. Added `ensureVisible()` + `topmostWindow(at:)` — verifies the target host pixel is owned by the Simulator process, otherwise returns `{success:false, reason:"window_occluded", error:"...by 'X'..."}` and exits 1. Tested live: tap of obscured window now errors instead of lying success.
- [#9] Sim-driver coord translation: pending. UX nicety, not a correctness bug.

## What broke v2 → v3 confidence

The most useful thing this test produced isn't the bug fixes — it's evidence that the v3 thesis names real failure modes. Today's IBR returned a 19KB scan with verdict PASS while seeing zero of the SUT. A verdict-shaped engine would have refused to return that. We just ported one of those refusals into the legacy scan code path.

## Outputs from this session

- `/tmp/ibr-speaksavvy/01-launch.png` — SpeakSavvy home screen, ground truth
- `/tmp/ibr-speaksavvy/02-after-tap.png` through `06-tap-settings.png` — tap attempts (no observable iOS effect; clock changed only)
- `/tmp/ibr-speaksavvy/scan.json` — 19KB scan payload, 0% relevant content
