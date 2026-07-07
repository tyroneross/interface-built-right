---
name: native
description: Use when validating iOS, watchOS, or macOS UI with IBR.
---

# IBR Native

Use IBR native tools when the UI runs in a simulator or a macOS app instead of a browser. Prefer runtime accessibility evidence over source-only assumptions.

## iOS And watchOS

1. Confirm the target simulator is booted with `native_devices`.
2. Run `native_scan` for the visible screen.
3. Use `native_session_start`, `native_session_action`, and `native_session_read` for multi-step flows. Pass `waitFor` on `native_session_action` when the action should open a new screen or async state; read `postAction` before assuming navigation succeeded.
4. Use `native_session_read` with `what: "screenshot"` when AX data is not enough and visual evidence is needed.
5. Use `sim_action` only when coordinate-level simulator interaction is needed.
6. `native_session_action` also accepts `keystroke` (chord to the focused element, e.g. `chord: "Meta+n"`, `target` optional), `app` (lifecycle: `op: "launch"|"switch"|"quit"`), and `menuPath` (AXMenu traversal) — all three are live and fully implemented. Known limitation: `app`'s `quit` op can return `success: false` with an `osascript -128` evidence trail when the target machine has `NSCloseAlwaysConfirmsChanges=1` and the app has an unsaved document (no force-quit fallback — it will not discard unsaved work). Check `validator.passed` on the response, not just that the call returned — `success` is only `true` when the AX-state validator passed.
7. The same lifecycle is available outside a session as `ibr native:session:{start,read,action,close}` for a shell-reproducible repro of anything `native_session_*` did (exit codes: `0` ok, `1` action failed, `2` session not found, `3` wait timed out, `4` invalid target). Full reference: `docs/native-session-cli-reference.md`.

Check for:

- 44pt minimum touch targets.
- Clear accessibility labels on interactive elements.
- Safe-area and viewport fit.
- watchOS screens with restrained interaction density.
- Primary flow success, not just static layout.

## macOS

Use `scan_macos` for a running app and validate the accessibility tree, window structure, menu/action affordances, and keyboard-reachable controls.

## Source Correlation

When native scan output needs a code fix, use `bridge_to_source` to map runtime accessibility elements back to Swift source where possible.

## Reporting

Include the device or app scanned, the failing element, measured bounds or accessibility data, and the exact remaining manual prerequisite when the scan cannot run.
