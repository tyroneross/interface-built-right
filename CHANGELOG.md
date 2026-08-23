# Changelog

Format loosely follows [Keep a Changelog](https://keepachangelog.com/). Tagged,
per-version release notes for shipped versions live under `docs/releases/`
(e.g. `docs/releases/v1.4.0.md`); this file tracks the current in-progress
increment before it is cut into a release.

## Unreleased

### Added

- **General breadcrumb auditing in every web scan.** IBR now recognizes
  breadcrumb trails by accessible name or conventional component markers and
  checks the WAI-ARIA APG contract: a labelled navigation landmark, semantic
  list structure, and exactly one final `aria-current="page"` when the current
  item remains a link. A plain-text current item is accepted without
  `aria-current`, matching the pattern's explicit exception. Existing mobile
  target-size rules continue to grade every breadcrumb link independently.

- **Impact-targeted validation guidance.** IBR now selects checks from the
  specified change and its affected components, routes, states, viewports, and
  shared dependencies. It expands beyond that set only when impact is uncertain,
  a shared dependency changed, or a targeted failure indicates wider breakage;
  running every route or every test is no longer the default validation pattern.

- **Artifact lane — author, check, and port single-file self-contained HTML pages.**
  A page that carries its own styles, scripts, fonts, and images: openable from
  `file://`, publishable through Claude's Artifact tool, and checkable by any agent.
  Unlike the rest of IBR this lane needs no browser, no MCP server, and no Node.

  - `scripts/artifact_lint.py` — 39-rule contract across six families: `AX*`
    portability and self-containment, `AD1xx` the three-state theme contract,
    `AD2xx` page identity, `AD3xx` layout and robustness, `AD4xx` AI-cliché
    detection, `AS5xx` inline-SVG diagrams. Stdlib-only Python 3, no network.
    `rules --json` is the machine-readable contract — the single source of truth
    for IDs, severities, and profile scope.
  - `scripts/artifact_build.py` — `new` scaffolds a page that already satisfies the
    theme contract and lints clean; `wrap`/`unwrap` convert losslessly between the
    Claude publish fragment and an openable document; `info` reports profile, title,
    injected nodes, and external URLs. Everything injected carries
    `data-artifact-build` and is removed on the way out, so round-trip is lossless.
  - `skills/artifact-design/` + `skills/artifact-diagramming/` — the judgment layer
    a linter cannot grade: treatment calibration, palette and type direction, page
    naming, copy, and what earns a diagram. They cite rule IDs rather than restating
    rules, so prose cannot drift from code.
  - `commands/artifact.md` (`/ibr:artifact`) and `.codex-plugin/skills/artifact/` —
    equal access from Claude, Codex, and any host that can run `python3`.

  **Severity policy:** only mechanically unambiguous rules carry `error`. Every
  heuristic is flagged `heuristic: true` and ships `warn`/`info` so it can never
  hard-block. Rule precision is unmeasured; `test_heuristic_rules_never_error` and
  `test_every_rule_is_reachable` enforce both invariants.

  96 tests across `scripts/test_artifact_lint.py` and `scripts/test_artifact_build.py`;
  every rule is asserted in both directions — it fires on a defect fixture and stays
  silent on the clean one.

### Fixed

- **Touch-target rules graded the wrong box, and graded targets WCAG exempts.**
  With viewport emulation fixed in 1.5.0 the rules measured the right layout, but
  two finding classes remained false by construction. On `rosslabs.ai` at both
  viewports they were **every** surviving finding on some pages — a gate whose
  output is entirely unactionable teaches the reader to ignore it, which is the
  failure mode the pooled-viewport bug already caused once.

  - **Inline prose links.** An `<a>` inside a sentence measured its text box
    (91x18px) and was flagged. WCAG 2.5.8 exempts a target "in a sentence or
    whose size is otherwise constrained by the line-height of non-target text";
    growing one to 44px would reflow the paragraph.
  - **Label-overlay controls.** An `sr-only` `<input>` whose hit area is supplied
    by an associated visible `<label>` measured at its own size (1x1px for the
    CSS-only nav-toggle pattern) while the label — the thing a finger lands on —
    measured 44x44. Above the label's breakpoint, where the label is
    `display: none`, the 1x1 stub has no pointer affordance at all to size.

  Fixed by measuring the real activation rect and applying the standard's own
  exception, in one shared policy module (`src/rules/target-sizing.ts`) used by
  every touch-target grading site: `ask`, the `touch-targets` preset (including
  its `error`-severity mobile rule), the `minimal` preset, and `scan`'s
  `analyzeElements`. `src/extract.ts` measures the two DOM inputs the policy
  needs — surrounding non-target text, and associated-label bounds.

  **Precision measured before any change to severity**, over 8 page x viewport
  combinations on `rosslabs.ai`: **33% before (7 genuine of 21 findings) → 100%
  after (7 of 7)**, with all 7 genuine findings preserved. Severity is unchanged.
  Counterexamples are asserted, not assumed: an `inline-block`/`inline-flex`
  control in prose, a `|`-separated inline nav, a paragraph whose only content is
  a link, an undersized `<label>` (the finding now reports the label's bounds so
  the fix targets the right element), and any control large enough to point at
  all stay flagged.

  Nothing is dropped silently — `ask` reports what it skipped under
  `meta.exempted`, keyed by reason (`wcag-inline`, `label-hit-area`).

  46 new tests: policy unit tests against handmade payloads, plus a real-Chrome
  integration test (`src/rules/target-sizing.integration.test.ts`) covering both
  viewports, because `HTMLInputElement.labels` and a real cascade cannot be
  proven by a fixture object.

- `AGENTS.md` counts and inventories had drifted from the tree: skills listed 22
  against 23 on disk (`obsidian-plugin-ui` undocumented), commands listed 27/30
  against 31 (`/ibr:ibr` undocumented). Both corrected alongside the new entries.

## [1.5.0] — 2026-07-06 — Increment 1: native session API/MCP/CLI parity + driving foundation

**Version bumped to `1.5.0` in `package.json`; awaiting release cut.** The git tag
and GitHub Release (which trigger `npm publish` via `publish-npm.yml`) have NOT been
created yet — the maintainer cuts those. Semver note: `1.5.0` (minor) is a pragmatic
choice given the MCP consumers are LLM agents reading text; the `interact` /
`session_action` `success`-semantics change (now a real validator, not always-true)
is the one technically-breaking behavior — see **Behavior changes** — and would be
`2.0.0` under strict semver.

### Added

- **Native session controller API** — `NativeSessionController`
  (`src/native/session-controller.ts`), exported from the package root, is now
  the canonical implementation for native (macOS AX / iOS-watchOS simulator)
  session start/read/action/close. `native_session_*` MCP tools and the new
  CLI both delegate to it, so all three surfaces behave identically. See
  `docs/native-session-cli-reference.md` for one example per surface.
- **CLI parity** — `ibr native:session:{start,read,action,close}`, with
  `--json` output and non-zero exit codes for failed actions, missing
  sessions, failed waits, and invalid targets. Session state persists
  cross-process to `.ibr/native-sessions/<sessionId>.json` (each CLI
  invocation is a separate OS process). Full flag/exit-code reference:
  `docs/native-session-cli-reference.md`.
- **`native_session_action` capability kinds** — the MCP action enum gains
  `keystroke`, `app`, and `menuPath`, additive over the existing element verbs
  (`click`, `press`, `fill`, `type`, `focus`, `showMenu`, `increment`,
  `decrement`, `confirm`, `cancel`, `scroll`, `scrollToVisible`, `check`,
  `select` — all unchanged). `target` is optional for the three new kinds,
  required for element verbs (enforced in the handler, not just the schema).
  All three are now **live** — every backend returns a real, validated
  `ActionOutcome`, not a structured `not-implemented` stub:
  - `keystroke` (E2-B): both the default respawn backend and the opt-in
    daemon backend deliver a real keyboard chord (e.g. `Meta+n`, `Tab`,
    `Escape`) and validate the result against an AX state diff.
  - `app` (E2-C, lifecycle: `launch`/`switch`/`quit`): OS-level process
    control (`open -a`/`osascript`), validated against an absolute end-state
    (running+frontmost for launch/switch, exited for quit) rather than a
    before/after diff. **Known limitation:** `quit` can return
    `success: false` with an `osascript -128` evidence trail when the target
    machine has `NSCloseAlwaysConfirmsChanges=1` and the app has an unsaved
    document — there is intentionally no force-quit fallback, so this
    capability will not discard a user's unsaved work.
  - `menuPath` (E2-D): AXMenu traversal (menu-bar or an already-open context
    menu) by an ordered list of item titles, AXPress on the final item,
    validated against a before/after AX-state diff.
- **`IBR_NATIVE_BACKEND=daemon`** (opt-in, default remains respawn) — a
  persistent Swift AX daemon that holds one long-lived process instead of
  spawning a fresh extractor per call, plus a resolved-path cache invalidated
  on tree-signature change. Falls back to the respawn backend automatically
  on any daemon fault (crash, timeout). `IBR_NATIVE_BACKEND=respawn` (or
  unset) keeps today's behavior unchanged — this is the documented rollback.

### Changed — MCP backward compatibility

- Existing `native_session_start`, `native_session_read`, and
  `native_session_close` calls are **unaffected**.
- `native_session_action`'s wire `required` array changed from
  `['sessionId', 'action', 'target']` to `['sessionId', 'action']`. This is
  **additive-permissive**: a client that always sends `target` keeps working
  unchanged, and every element verb still rejects a missing `target` at the
  handler level with the same error as before.
- The native-wire response for the new capability kinds
  (`keystroke`/`app`/`menuPath`) carries the frozen `ActionOutcome` shape
  (`validator`, `provenance`, and `evidence` on failure) — this is new wire
  content for kinds that did not exist on the wire before this increment, not
  a change to any existing response shape. Element-verb (`click`/`fill`/…)
  native responses are unchanged.

### Changed — web success-semantics fix (breaking behavior, MCP + CLI)

**`interact` (MCP), `session_action` (MCP), and `ibr interact` (CLI) — `success`
now reflects the real outcome instead of always being `true`.**

- Before: a click/fill/etc. that resolved a target but produced no visible
  change still reported `success: true` (MCP: unconditional response at the
  old `tools.ts` handler; CLI: unconditional `✓ ... succeeded` after a fixed
  500ms sleep, `src/bin/ibr.ts` around the old `interact` handler).
- After: `success` is `true` only when an expected-outcome validator passes.
  Responses gain `validator: { expected, observed, passed }` and
  `provenance` (resolution tier, confidence, wait behavior) on every action,
  plus structured `evidence` (before/after signature, diff, ranked
  alternatives, optional screenshot) when the action fails or the validator
  does not pass.
- **Action required for existing MCP/CLI clients:** any integration that
  branched only on "the call didn't throw" or always treated the response as
  successful should now check `validator.passed` / the `success` field
  directly — a `success: false` response is expected behavior for a no-op
  action, not a regression. `provenance`/`evidence` are additive fields; no
  existing field is removed or renamed.
- Tracked by the driving-foundation plan's E3-E chunk
  (`.build-loop/plans/increment-1-driving-foundation.md`, acceptance
  criterion 9). At the time of writing this change is landing as part of the
  same increment as the rest of this entry; if you observe `success: true`
  on a no-op action against a build that predates this entry, you have the
  pre-fix behavior described above.

### Fixed

- **`pressKey('Meta+k')` (and other modifier chords) now synthesize a real
  keyboard chord** instead of typing the literal characters `M`, `e`, `t`,
  `a`, `+`, `k`. This makes `flow_search`'s ⌘K command-palette fallback
  live. Mutation-first fix: a failing test proving the literal-character
  bug was written before the fix (`src/engine/cdp/input.ts`).
- **`flow_form` / `flow_login` now honor an existing `sessionId`** instead of
  always launching a fresh browser and closing it on exit, even when a valid
  session was passed. The handlers now reuse the session's driver and skip
  `launch()`/`close()` for a borrowed session. Mutation-first fix: a failing
  test proving the always-relaunch bug was written before the fix
  (`src/mcp/tools.ts`). Function signatures and the `FlowResult` shape are
  unchanged.

---

### Release gate — do not cut a version or GitHub Release yet

`keystroke`, `app` (lifecycle: launch/switch/quit), and `menuPath` (AXMenu
traversal) are all now **live** — every backend implements them and returns a
real, validated `ActionOutcome`, not a structured `not-implemented` stub. That
no longer blocks a release on its own; the gate below still applies because
`.github/workflows/publish-npm.yml` fires on GitHub Release and this
increment hasn't completed its V1 verification pass yet:

**No GitHub Release for this content until the
driving-foundation plan's V1 verification chunk passes** (live-drive demo
transcript + timing table + full green `npm test` / `npm run typecheck` /
`npm run build` / `git diff --check`). See
`.build-loop/plans/increment-1-driving-foundation.md` (`Per-chunk acceptance
criteria` → `V1` row) for the exact falsifier.
