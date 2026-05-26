# Goal: ibr-mobile-viewport-fix

**Worktree:** `interface-built-right-worktrees/mobile-viewport-fix`
**Branch:** `fix/mobile-viewport-cdp` (off `origin/main`)
**Parent in-flight (separate goal):** `rfc/ibr-core-library-export` — DO NOT TOUCH.
**Dispatched from:** atomize-ai UI audit (2026-05-25)
**Scoping note:** This file lives under `.build-loop/goals/` (not the repo-tracked `.build-loop/goal.md`) so a second concurrent build-loop on a different goal does not lose its scope when this branch lands.

## Bug

`npx ibr scan <url> --viewport mobile --json` parses cleanly (exit 0) but the page renders at desktop 1920×1080. JSON's `viewport` field reflects whatever name was passed, but Chrome was never told to emulate mobile: no UA override, no touch, and the `mobile` preset was 375×667 with `mobile: false`.

There is no `--device <name>` flag for canonical device profiles.

## Scope

A. Honor `--viewport mobile|tablet|desktop` end-to-end via CDP:
   - `Emulation.setDeviceMetricsOverride` populated with `{deviceScaleFactor, mobile}`
   - `Emulation.setUserAgentOverride` with a mobile UA when applicable
   - `Emulation.setTouchEmulationEnabled` when applicable
   - All set BEFORE `Page.navigate`
   - Realigned baselines: mobile → 390×844 iPhone 14, tablet → 820×1180 iPad

B. Add `--device <name>` to `ibr scan` and `ibr session:start`:
   - Initial set: `iphone-14`, `iphone-14-pro-max`, `pixel-7`, `ipad-air`, `ipad-pro-11`, `desktop-1440`
   - `--device` wins over `--viewport` when both supplied
   - CDP-direct (no Playwright dependency)

C. Real test asserting CDP override calls fire before navigate.

D. Docs in README + CLAUDE.md + `--help`.

## Success Criteria

| ID | Criterion | How verified |
|----|-----------|--------------|
| C1 | `scan(url, {viewport:'mobile'})` returns viewport `{name:"mobile", width:390, height:844, mobile:true}` | Unit |
| C2 | `Emulation.setDeviceMetricsOverride`, `setUserAgentOverride`, `setTouchEmulationEnabled` all fire for mobile/tablet | Vitest CDP-call recorder |
| C3 | `--device iphone-14` works on scan AND session:start | Unit + help output |
| C4 | `--device` overrides `--viewport` when both given | Unit |
| C5 | `npm test` passes (no regressions) | CI |
| C6 | `npm run typecheck` passes | CI |

## Out of Scope

- Pixel-perfect parity with Playwright's device list (we're CDP-direct)
- WatchOS / Apple Watch viewports (already present, not touched)
- Geo/locale emulation, throttling profiles

## Commit Strategy

C1: scope goal | C2: --viewport via CDP | C3: --device flag | C4: tests | C5: docs

## Constraints

- No push
- No Playwright dependency
- No touch to parent `.build-loop/` (state.json, goal.md, plan.md, evals/)
- Real tests, not stubs
