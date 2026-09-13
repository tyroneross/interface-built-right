# Goal — reliable cross-host computer-use evidence

## Desired outcome

Codex and Claude can both submit a host-neutral external-action envelope to IBR and receive a durable, schema-versioned before/action/after receipt. IBR validates and records the host verifier's outcome without claiming independent truth, and installed plugin CLIs can find and compile the bundled macOS AX extractor.

## Acceptance criteria

1. The package exports one host-neutral receipt API with no Codex, Claude, MCP, or provider SDK types.
2. `ibr evidence:record <file|-> --json` ingests the same strict envelope and writes an exclusive mode-`0600` receipt.
3. Metadata-only mode retains no raw descriptive UI content or artifact paths and exposes only stable, non-sensitive CLI errors.
4. Local artifact reads require an explicit allowlisted root, accept only unchanged regular files, stream a bounded maximum of 64 MiB, and clean temporary receipt evidence on every failure.
5. Local-sensitive mode is explicit; receipt transformation metadata exactly matches the fields actually transformed.
6. Tests simulate Codex sidecar and Claude client-handler inputs through the same contract.
7. Packaged Codex and Claude layouts find the bundled Swift extractor under a stripped GUI-like PATH and scan a live native PID when host state permits.
8. Source typecheck, lint, unit tests, build, package exports, release validation, installed-layout smoke, independent audit, and cross-vendor audit are dispositioned before local-main integration.

## Verification boundary

The caller owns before/after observation and the `validation.passed` assertion. IBR validates schema, chronology, privacy, artifact integrity, and persistence behavior; the receipt does not independently attest that caller-supplied observations are true. Ambient PID proof is state-blocked when the running app exposes no Accessibility window, so a deterministic native app may prove extractor packaging without substituting for Ambient UI acceptance.
