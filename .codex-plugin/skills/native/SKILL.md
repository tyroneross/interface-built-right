---
name: native
description: Use when validating iOS, watchOS, or macOS UI with IBR.
---

# IBR Native

Use the IBR CLI when the UI runs in a simulator or a macOS app instead of a browser. The MCP server is dormant/opt-in in Codex, so do not assume `native_scan`, `scan_macos`, or `native_session_*` are callable. Prefer runtime accessibility evidence over source-only assumptions.

Resolve `IBR_BIN` from this installed `SKILL.md`: move up three directories to the IBR plugin root, then append `dist/bin/ibr.js`. Verify it once with `node "$IBR_BIN" --version`. Do not use `npx ibr`; that unscoped package name can resolve a different npm package.

## iOS And watchOS

1. Confirm the target simulator is booted with `node "$IBR_BIN" native:devices`.
2. Run `node "$IBR_BIN" native:scan [device] --json` for the visible screen.
3. Use `node "$IBR_BIN" native:session:start ... --json`, `native:session:action <sessionId> ... --json`, and `native:session:read <sessionId> ... --json` for multi-step flows. JSON mode is required when inspecting `postAction` or `validator.passed`. Pass `--wait-for` when an action should open a new screen or async state; read `postAction` before assuming navigation succeeded.
4. Use `node "$IBR_BIN" native:session:read <sessionId> --what screenshot --json` when AX data is not enough and visual evidence is needed.
5. Use coordinate-level simulator interaction only when semantic action is impossible and the command explicitly supports it.
6. `native:session:action` accepts `keystroke`, `app`, and `menuPath`. Known limitation: `app`'s `quit` op can return `success: false` with an `osascript -128` evidence trail when the target machine has `NSCloseAlwaysConfirmsChanges=1` and the app has an unsaved document; it does not force-quit or discard work. Check `validator.passed` on the response, not just that the command returned.
7. Exit codes are `0` ok, `1` action failed, `2` session not found, `3` wait timed out, and `4` invalid target. Full reference: `docs/native-session-cli-reference.md`.

Check for:

- 44pt minimum touch targets.
- Clear accessibility labels on interactive elements.
- Safe-area and viewport fit.
- watchOS screens with restrained interaction density.
- Primary flow success, not just static layout.

For changed text, typography, spacing, or navigation, follow
`references/container-fit.md` from the bundle root. Resize or select the
smallest relevant supported container, seed a realistic long title/body and
large text when relevant, then capture the running screen. Inspect glyphs and
AX bounds together for clipping, unexpected wrapping, overlap, and the last
control's scroll reachability. Record size, content state, and evidence path;
an AX tree without pixels does not prove text fit.

## macOS

Use `node "$IBR_BIN" scan:macos --pid <pid> --json` for a running app and validate the accessibility tree, window structure, menu/action affordances, and keyboard-reachable controls.

## External Computer Use

When Codex Computer Use performs the action, keep it as the single action owner and use IBR to validate and record the host observer's envelope. Submit strict before/action/after JSON with `ibr evidence:record <file|-> --json`. Metadata-only retention is the default; target labels, window titles, URLs, state descriptions, and validation details are digested, while raw artifact paths require `--privacy local-sensitive`. Any local artifact path also requires an allowlisted `--artifact-root`. Correlate native evidence by PID or bundle ID. Do not run an IBR pointer action concurrently with Computer Use. Contract and examples: `docs/external-action-evidence.md`.

## Source Correlation

When native scan output needs a code fix, correlate runtime identifiers and labels with Swift source. If MCP is explicitly enabled, `bridge_to_source` can perform that mapping.

## Reporting

Include the device or app scanned, the failing element, measured bounds or accessibility data, and the exact remaining manual prerequisite when the scan cannot run.
