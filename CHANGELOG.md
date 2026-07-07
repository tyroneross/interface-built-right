# Changelog

Format loosely follows [Keep a Changelog](https://keepachangelog.com/). Tagged,
per-version release notes for shipped versions live under `docs/releases/`
(e.g. `docs/releases/v1.4.0.md`); this file tracks the current in-progress
increment before it is cut into a release.

## [Unreleased] — Increment 1: native session API/MCP/CLI parity + driving foundation

**This is NOT a released version.** No git tag and no GitHub Release exist for
this content yet — see **Release gate** below. Current shipped version remains
`1.4.0` (`package.json`).

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

**No version bump and no GitHub Release for this content until the
driving-foundation plan's V1 verification chunk passes** (live-drive demo
transcript + timing table + full green `npm test` / `npm run typecheck` /
`npm run build` / `git diff --check`). See
`.build-loop/plans/increment-1-driving-foundation.md` (`Per-chunk acceptance
criteria` → `V1` row) for the exact falsifier.
