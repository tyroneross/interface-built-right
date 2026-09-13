# External computer-use evidence

IBR can record a structured before/action/after receipt for observations and a verifier outcome supplied around an action executed by another computer-use system. The contract is host-neutral: Codex can call the CLI as a sidecar, and a Claude computer-use client handler can call the package API around its action implementation.

IBR validates the envelope, applies its privacy policy, and records the supplied outcome; it does not independently prove that the caller's `passed` value or descriptive details are true. The host adapter owns observation and validation, while the host computer-use system remains the action authority. Do not let IBR and the host both drive the pointer or focus concurrently.

## Privacy boundary

`metadata-only` is the default. It keeps bounded action codes, timing, counts, geometry, PID/bundle correlation and the validation result. It transforms target IDs, URLs, window titles, target labels, state descriptions and validation details into field-domain HMAC-SHA-256 digests. The per-receipt HMAC key is random and is not persisted. Local artifact paths are omitted; artifact contents receive an ordinary SHA-256 integrity digest.

Low-entropy UI text must still be treated as sensitive before it enters a host log. IBR's default receipt prevents plaintext retention in the receipt; it does not control logging performed by the caller before ingestion.

`local-sensitive` is explicit. It retains only the schema-defined descriptive fields and local artifact paths. Artifact contents still receive integrity digests. Target, window, action-label, and validation details remain raw instead of being duplicated as HMAC digests; observation state is retained alongside its comparison digest. Use this mode only when local review needs the raw evidence and the consuming project's retention policy permits it.

Both modes reject unknown keys instead of silently storing an opaque host payload. A receipt contains no screenshot bytes, AX tree, DOM dump, model prompt, credential, or hidden model state.

## Input envelope

```json
{
  "schemaVersion": 1,
  "correlationId": "ambient-drag-1",
  "host": {
    "family": "codex",
    "executor": "unified-computer-use",
    "version": "1"
  },
  "surface": {
    "kind": "native",
    "pid": 11473,
    "bundleId": "com.rosslabs.ambient-agent"
  },
  "action": {
    "kind": "drag",
    "target": {
      "role": "AXGroup",
      "label": "Ambient header",
      "coordinates": { "x": 400, "y": 80, "unit": "points" }
    },
    "startedAt": "2026-09-13T19:00:01.000Z",
    "completedAt": "2026-09-13T19:00:01.250Z"
  },
  "before": {
    "capturedAt": "2026-09-13T19:00:00.900Z",
    "state": "window x=200 y=100",
    "elementCount": 23,
    "interactiveElementCount": 7
  },
  "after": {
    "capturedAt": "2026-09-13T19:00:01.300Z",
    "state": "window x=480 y=100",
    "elementCount": 23,
    "interactiveElementCount": 7
  },
  "validation": {
    "expectedCode": "window-anchor-changed",
    "observedCode": "window-anchor-changed",
    "passed": true,
    "expectedDetail": "Header drag changes the window anchor",
    "observedDetail": "Window moved 280 points"
  }
}
```

Native inputs require `pid` or `bundleId`. Web inputs require `targetId` or `url`. Codes and host metadata accept safe tokens only; descriptive text belongs only in fields that the privacy policy transforms.

An observation accepts exactly one of:

- `state`: a description that IBR transforms into an HMAC digest; or
- `stateDigest`: an existing `sha256:<64 lowercase hex>` digest produced by the observer.

Artifacts accept a local `path`, an existing `sha256` digest, or both. A path is read only when `artifactRoot` (API) or `--artifact-root` (CLI) explicitly allowlists its containing tree. IBR resolves the real path, rejects symlinks and non-regular files, verifies the file did not change between inspection and open, and reads at most 64 MiB through a bounded streaming hash. Each receipt artifact records whether its path was not supplied, transformed, or retained so the transformation manifest can be revalidated at the persistence boundary. Larger evidence should be reduced or hashed by the observer before ingestion.

## Codex sidecar

Write the envelope to a file after Computer Use has completed the action and IBR has captured the postcondition, then run:

```bash
ibr evidence:record /tmp/ambient-drag.json --json
```

For a pipe that avoids an intermediate envelope file:

```bash
generate_receipt_json | ibr evidence:record - --json
```

Add `--artifact-root /allowed/evidence/root` when the envelope contains a local artifact path; omit it for precomputed artifact digests or no artifacts. The default destination is `.ibr/evidence/<receipt-id>.json`. IBR writes mode `0600`, fsyncs the temporary file, and publishes it with an exclusive same-directory link so a duplicate receipt ID cannot replace prior evidence. A failed write, fsync, link, or temporary-file removal returns failure and triggers another cleanup attempt.

Codex's Computer Use session/tab identifiers remain outside this contract. Map any useful identifier to the opaque `surface.targetId` field; metadata-only mode digests it.

## Claude client handler

The API uses the same builder and writer as the CLI:

```ts
import { recordExternalActionEvidence } from '@tyroneross/interface-built-right';

const before = await observeTarget();
const result = await executeClaudeComputerUseAction(action);
const after = await observeTarget();

const recorded = await recordExternalActionEvidence({
  schemaVersion: 1,
  correlationId: requestId,
  host: { family: 'claude', executor: 'computer-use-client-handler' },
  surface: { kind: 'web', targetId: browserTargetId },
  action: {
    kind: action.type,
    startedAt: result.startedAt,
    completedAt: result.completedAt
  },
  before,
  after,
  validation: validateExpectedOutcome(result, after)
});
```

Return the compact receipt or its local path to Claude. Do not return full screenshots, AX trees, DOM text, or other private source content unless a separate authorization and retention policy allows it.

When `before` or `after` includes an artifact `path`, pass `{ artifactRoot: '/allowed/evidence/root' }` as the API's second argument.

Claude Code does not need a built-in computer-use interception API for this contract. It can invoke the same CLI from Bash after an external executor acts.

## Action ordering

1. Identify one action owner.
2. Capture the before observation.
3. Execute the host action.
4. Wait for the target to settle.
5. Capture the after observation.
6. Have the host-side verifier validate the expected outcome.
7. Record the IBR receipt.

For Retina-native actions, label coordinates as `points` or `pixels` and provide `scale` when the executor's screenshot coordinate system differs from Accessibility geometry.
