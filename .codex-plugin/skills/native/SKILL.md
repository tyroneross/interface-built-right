---
name: native
description: Use when validating iOS, watchOS, or macOS UI with IBR.
---

# IBR Native

Use IBR native tools when the UI runs in a simulator or a macOS app instead of a browser. Prefer runtime accessibility evidence over source-only assumptions.

## iOS And watchOS

1. Confirm the target simulator is booted with `native_devices`.
2. Run `native_scan` for the visible screen.
3. Use `native_session_start`, `native_session_action`, and `native_session_read` for multi-step flows.
4. Use `sim_action` only when coordinate-level simulator interaction is needed.

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
