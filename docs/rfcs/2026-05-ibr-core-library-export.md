# RFC — Export `engine/` + `analyzers/` as `@tyroneross/ibr-core`

| Field | Value |
|---|---|
| Status | Draft |
| Authors | tyroneross |
| Created | 2026-05-12 |
| Cross-ref | tyroneross/build-loop: RFC — `ui-validator` agent + Phase 3 spot-check trigger |

## Summary

Extract IBR's CDP-driven scanning primitives into a vendorable Node library so external tools (notably the `tyroneross/build-loop` plugin) can import the engine directly instead of shelling out to `npx ibr`. The CLI, viewer, and session daemon stay where they are. The library exposes a stable API for: launching a CDP-controlled browser, signing in, running structured scans, and returning typed results.

## Motivation

External callers shelling out to `npx ibr` pay three costs every call:

1. A fresh Chrome launch (~3–5 s per invocation)
2. A fresh auth setup that currently doesn't apply — `loadAuthState()` is called at `dist/index.mjs:5949` but the result is never passed to `EngineDriver.launch()`. Result: protected routes redirect to `/sign-in` on every scan.
3. Process-boundary marshaling — JSON in/out, leading status-line stripping, exit-code parsing.

The dominant external consumer is `build-loop`, which scans up to 10 routes per build during Phase 4 Review. Today that's roughly 50 s of overhead across a build. A long-lived in-process session drops it to ~5 s.

The fix that addresses the auth bug *and* the cost problem is to let external callers manage the browser lifecycle themselves via a typed library API. The CLI then becomes one consumer of that library among several.

## Proposed API surface

```ts
import { EngineDriver, scan, audit, check, login } from "@tyroneross/ibr-core";

const driver = new EngineDriver();
await driver.launch({ headless: true, viewport: { width: 1920, height: 1080 } });

// One auth, many scans
await login(driver, {
  url: "http://localhost:3006/sign-in",
  method: "form",
  credentials: { email: "audit@example.test", password: "..." },
});

const r1 = await scan(driver, "http://localhost:3006/app/library");
const r2 = await scan(driver, "http://localhost:3006/app/ask");

const visualRegression = await check(driver, "app-library", { ssimThreshold: 0.98 });

await driver.close();
```

Return types match the current JSON shape emitted by `npx ibr scan --json`, so existing parsers continue to work. The CLI becomes a thin wrapper around these calls.

## Boundary — what's in, what's out

| In (lib export) | Out (stays in CLI / viewer / daemon) |
|---|---|
| `EngineDriver` (CDP launcher) | `cli/` (arg parsing, output formatting) |
| `scan()` (element + computed-style + AX-tree capture) | `viewer/` (web UI for comparing baselines) |
| `audit()` (semantic + functional + visual composed verdict) | `daemon/` (long-running session manager) |
| `check()` (visual regression vs baseline, SSIM math) | Interactive form-driver heuristics (the auto-guess login UI stays in CLI) |
| `analyzers/` (layout-collision, touch-target, console, hydration) | Storage paths (`.ibr/auth.<user>.json`, `.ibr/sessions/`) |
| Pure types (`ScanResult`, `AuditResult`, `IssueRecord`) | — |

## Auth bug fix as part of extraction

Current behavior at `dist/index.mjs:5949`:

```js
const authState = await loadAuthState(outputDir);
if (authState) console.log("🔐 Using saved authentication state");
// authState is dropped here — never passed to driverInstance.launch(...)
```

In the library, auth is the **caller's** responsibility. The library exposes `login(driver, opts)` for callers who want IBR to drive the form, and `driver.setStorageState(state)` for callers who already have cookies. The `auth.<user>.json` file becomes a CLI-only concern, and the CLI's auto-load gets the same fix as part of the extraction.

## Migration plan

1. (this PR) RFC + API sketch + boundary
2. Extract `engine/` + `analyzers/` into `packages/core/` inside the same repo under a single `pnpm-workspace`. Publish as `@tyroneross/ibr-core`.
3. CLI re-imports from `@tyroneross/ibr-core`. Behavior preserved.
4. Fix the auth-state bug as part of the extraction — both library callers (manual) and CLI consumers (via the CLI's auto-load path) get correct behavior.
5. Publish `@tyroneross/ibr-core@0.1.0`.

## Open questions

- Should `login()` support magic link as a method? Probably not for the library — magic link needs email infra outside IBR's scope.
- SSR-driven probes — should a `request()` helper for cookie-based fetch be in scope? Proposal: yes. Build-loop's SSR-grep audits would consume it directly.
- Versioning — IBR is on `1.0.x`. Library starts at `0.1.0` to signal pre-stability.

## Out of scope

- Implementing the package extraction. This PR is RFC only.
- Deprecating the CLI. The CLI remains the primary user-facing entry point.
- Replacing the `ibr session:*` daemon. Out of scope for the library; the daemon's job is different.

## Cross-reference

Build-loop's consumer-side RFC lives on the `tyroneross/build-loop` repo. The two PRs reference each other; either side can land first as a statement of intent. Implementation depends on this side shipping first.
