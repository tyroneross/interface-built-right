# Native Session — API / MCP / CLI Reference

One typed controller drives cursor-free native (macOS AX / iOS-watchOS simulator)
sessions through three surfaces: the `NativeSessionController` API, the four
`native_session_*` MCP tools, and the `ibr native:session:*` CLI. All three call
the same controller (`src/native/session-controller.ts`), so lifecycle behavior
is identical across surfaces (PRD: `docs/superpowers/specs/2026-06-28-ibr-native-session-api-cli-parity-prd.md`).

| Surface | Role |
|---|---|
| API — `NativeSessionController` | Canonical implementation. Direct package-level tests and Node consumers. |
| MCP — `native_session_start/read/action/close` | Thin agent adapter for Claude Code / Codex. |
| CLI — `ibr native:session:{start,read,action,close}` | Deterministic replay, CI smoke tests, shell repro of an agent-reported failure. |

> **Status note (2026-07-06):** all three capability action kinds are **live** —
> `keystroke` (CGEvent chord synthesis, E2-B), `app` (launch/switch/quit lifecycle,
> E2-C), and `menuPath` (AXMenu traversal, E2-D). No backend returns
> `not-implemented` for them anymore. Known limitation: `app` `quit` can fail with
> `osascript -128` when the machine has `NSCloseAlwaysConfirmsChanges=1` and the app
> has an unsaved document — surfaced honestly as `success:false` with evidence (no
> force-quit, to avoid discarding unsaved work). See `CHANGELOG.md` for the release
> gate: no GitHub Release ships until the Increment-1 final
> verification (V1) passes.

---

## One example per surface

### API

```ts
import { NativeSessionController } from '@tyroneross/interface-built-right';

// SessionEntry is an internal type (not exported from the package root), so
// the store is constructed untyped here — the same pattern the CLI uses
// internally (src/bin/native-session-cli.ts).
const store = new Map();
const controller = new NativeSessionController({ store });

const sessionId = crypto.randomUUID();
await controller.startMacOS(sessionId, 'TextEdit', 'demo');
const entry = store.get(sessionId);

// Element action: resolve by accessible name, wait for a post-action state.
const clickOutcome = await controller.actionMacOS(entry, {
  action: 'click',
  target: 'New Document',
  waitFor: 'Untitled',
  waitTimeoutMs: 2000,
});

await controller.readMacOS(entry, 'observe', 50);
controller.closeNative(sessionId);
```

`controller.actionMacOS`/`actionSimulator` return a `NativeToolResult`
(`{ kind: 'text', text, isError? }` or `{ kind: 'image', base64, metadata }`);
`text` is a JSON string. For the Epic-2 capability kinds (`keystroke`/`app`/
`menuPath`) the JSON body is the frozen `ActionOutcome` shape
(`src/action-outcome.ts`): `{ success, validator: { expected, observed, passed },
provenance, evidence? }`. For element verbs (`click`/`fill`/…) the body is the
older native-wire shape (`success`, `resolved`, `confidence`, `tier`,
`alternatives`, `postAction`) — this element-verb wire has not changed shape in
this increment; only the capability actions carry the new `ActionOutcome`
fields, because `keystroke`/`app`/`menuPath` did not exist on the native wire
before Epic 2.

### MCP — `native_session_action` with a keystroke chord

Request:

```json
{
  "name": "native_session_action",
  "arguments": {
    "sessionId": "3f9c2e21-...",
    "action": "keystroke",
    "chord": "Meta+n"
  }
}
```

Response (`content[0].text`, live via `DaemonBackend`/`RespawnBackend` keystroke — E2-B):

```json
{
  "action": "keystroke",
  "success": true,
  "validator": {
    "expected": "AX state changes after delivering chord \"Meta+n\"",
    "observed": "AX state changed (background): {\"windowId\":7,...} -> {\"windowId\":12,...}",
    "passed": true
  },
  "provenance": { "waitResult": "background" }
}
```

For `keystroke`, omit `target` and focus the intended element in a separate
`focus` action first. Supplying `target` is rejected before delivery. `app`
(`op: launch|switch|quit`) and `menuPath` (an array of menu titles) execute their
lifecycle or menu action and return an `ActionOutcome`. A false result means
failed or unverified effect; it does not prove that no input was delivered.

### CLI — the shell repro

```bash
npx ibr native:session:start --app "TextEdit" --json
# { "ok": true, "exitCode": 0, "sessionId": "3f9c2e21-...", "type": "macos", ... }

npx ibr native:session:action 3f9c2e21-... \
  --action keystroke --chord "Meta+n" --json

npx ibr native:session:read 3f9c2e21-... --what observe --json

npx ibr native:session:close 3f9c2e21-... --json
```

---

## CLI reference — `ibr native:session:{start,read,action,close}`

Source: `src/bin/native-session-cli.ts`, wired in `src/bin/ibr.ts` via
`registerNativeSessionCommands(program)`. Every command supports `--json`
(structured JSON to stdout only — no other stdout noise) and never prompts
interactively. Session state is persisted per-command to
`.ibr/native-sessions/<sessionId>.json` (`src/native/session-store.ts`) because
each CLI invocation is a fresh OS process — this is what makes `start` in one
shell call and `action`/`read`/`close` in later calls work.

### `native:session:start`

```
ibr native:session:start [--app <name> | --pid <n> | --simulator <name>] [--session-id <id>] [--json]
```

Provide exactly one of `--app`, `--pid`, `--simulator`. `--session-id` overrides
the generated UUID for deterministic repros (e.g. re-running a fixed script
against the same session-store file path).

### `native:session:read <sessionId>`

```
ibr native:session:read <sessionId> [--what observe|extract|screenshot|state] [--limit <n>] [--json]
```

`--what` defaults to `observe`. `screenshot` writes a PNG under
`.ibr/native/{macos,simulator}-sessions/` and the `--json` envelope carries
`screenshotBase64Omitted: true` plus the path instead of the raw base64.

### `native:session:action <sessionId>`

```
ibr native:session:action <sessionId> --action <kind> [--target <name>] [--value <text>]
  [--role <role>] [--wait-for <name>] [--wait-timeout-ms <n>]
  [--chord <chord>] [--delivery background|foreground]
  [--width <points>] [--height <points>] [--window-title <exact-title>]
  [--op launch|switch|quit] [--app <name>] [--menu-path <items>] [--json]
```

`--action` is required; one of `click | press | fill | type | focus | showMenu |
increment | decrement | confirm | cancel | scroll | scrollToVisible | check |
select | drag | keystroke | app | menuPath | resizeWindow`. Element verbs require `--target`;
`app`/`menuPath` accept `--target` optionally. For `keystroke`, focus separately; a supplied target is rejected before delivery. `--menu-path` is a
comma-separated list of AXMenu titles (e.g. `"File,New Window"`).

### `native:session:close <sessionId>`

```
ibr native:session:close <sessionId> [--json]
```

Idempotent — closing an already-closed/never-started session ID returns exit
code 2 (session not found), not a crash.

### Exit codes (T-03)

| Code | Constant | Meaning |
|---|---|---|
| `0` | `EXIT_OK` | Command completed; for `action`, the AX call succeeded and (if `--wait-for` was given) the post-action wait settled by finding it. |
| `1` | `EXIT_ACTION_FAILED` | The action was attempted but failed for a reason other than a bad target or a timed-out wait (AX call failed, capability not implemented, bad action/value pairing). |
| `2` | `EXIT_SESSION_NOT_FOUND` | `sessionId` has no entry in `.ibr/native-sessions/`. Run `native:session:start` first. |
| `3` | `EXIT_WAIT_FAILED` | `--wait-for` was supplied and the post-action settle loop timed out without finding it (this can happen even when the underlying AX call itself succeeded). |
| `4` | `EXIT_INVALID_TARGET` | The requested `--app`/`--pid`/`--simulator` (start), `--what` (read), or `--target` (action) could not be resolved. |

### Copy-paste repro example

A minimal end-to-end script — start a macOS session, press a button by
accessible name, wait for the resulting state, read the tree, close:

```bash
set -e
SESSION_ID=$(npx ibr native:session:start --app "TextEdit" --json | jq -r '.sessionId')

npx ibr native:session:action "$SESSION_ID" \
  --action click --target "New Document" \
  --wait-for "Untitled" --wait-timeout-ms 2000 --json
echo "action exit: $?"

npx ibr native:session:read "$SESSION_ID" --what observe --json

npx ibr native:session:close "$SESSION_ID" --json
```

A failed click on a missing target exits `4`; a click that succeeds at the AX
level but whose `--wait-for` target never appears exits `3`; any other action
failure (e.g. an unimplemented capability) exits `1`.

---

## Backward compatibility (MCP)

Existing `native_session_start` / `native_session_read` / `native_session_close`
calls are unaffected. `native_session_action`'s `action` enum gained three
additive values (`keystroke`, `app`, `menuPath`); every value that existed
before this increment (`click`, `press`, `fill`, `type`, `focus`, `showMenu`,
`increment`, `decrement`, `confirm`, `cancel`, `scroll`, `scrollToVisible`,
`check`, `select`) is unchanged. The wire's `required` array changed from
`['sessionId', 'action', 'target']` to `['sessionId', 'action']` — this is
additive-permissive (a client that always sent `target` keeps working
unchanged); `target` is still enforced by the handler for every element verb,
so a client that omits `target` on `click`/`fill`/etc. gets the same
target-required error it always did.

See `CHANGELOG.md` for the web-side (`interact`/`session_action`)
success-semantics change, which is a breaking behavior fix, not additive.

### Exact macOS window resize and one-shot keys

`native:session:action SESSION --action resizeWindow --width 900 --height 650 --json`
sets outer AX window dimensions in points (finite 1..16384). Omission of
`--window-title` requires exactly one AXWindow in the session PID; otherwise
supply an exact unique title, including `--window-title ''` for an untitled
window. The helper retains that window reference through write/readback.
`resizeWindow` returns requested, before, and actual bounds. `validator.passed`
requires measured width and height within 0.5 points; app clamping fails with
actual bounds. Simulator sessions are rejected. No cursor movement or activation.

Keyboard chords use one delivery, `--delivery background` by default or explicit
`--delivery foreground` to activate the exact session PID before posting. Focus
the intended element separately. An unchanged AX tree is an unverified effect,
not permission to repeat: inspect before issuing another key. A lost daemon
response never automatically replays a key or a resize.

## Compact native output and large documents

Use `native:session:read <id> --format compact --json` for agent observations.
It saves the complete observation before output filtering to a unique
`fullReport` file, filters structural scroll/show-menu nodes, and then applies
`--limit` when explicitly supplied (otherwise all controls). Full mode still defaults to 50. The response returns named controls/headings with bounds,
`controlsAvailable`, `omittedStructural` and `truncated`. Disabled and unlabeled
controls remain visible. A truncated response must be expanded with a larger
limit before claiming all controls were checked. Existing full output and
`--what refs` retain their schemas. Compact mode does not assert a visual or
accessibility pass. Screenshot/state reads retain their existing small outputs.

`scan:macos --pid <pid> --format compact --json` saves the complete scan under
`.ibr/reports/` (override with `--report-dir`) and returns every issue, verdict,
console error, semantic error/state, visual coverage limit, layout-fill finding and design-system
result. Full evidence files use mode 0600 and are never overwritten. Keep them
private: native AX trees can contain document text.

Native extraction accepts up to 16 MiB of subprocess output, preserving long
notes while bounding memory. Larger trees fail explicitly. Native session
output and macOS scan JSON drain stdout before normal process exit, including
exit 1 for a FAIL scan; piping a complete JSON response is supported.

### Fused action and validated observation

For macOS element actions, `--observe --format compact` returns the exact
post-action snapshot that satisfied the existing settling check. It avoids a
separate `read` command; it does not skip fresh target resolution or settlement.

```
ibr native:session:action "$SESSION_ID" --action click --target "Edit text" \
  --wait-for "Save changes" --observe --format compact --json
```

The response contains `observation`, `postAction`, and `fullReport`. The report
retains the complete action payload and unabridged snapshot locally. A missing
settled snapshot or failed evidence write produces a nonzero result even if the
action was delivered; inspect the current UI before retrying an action.
`--observe` cannot be combined with `--ref` or non-element actions.

The macOS extractor batches the same accessibility attributes using
`AXUIElementCopyMultipleAttributeValues`, preserving traversal order and fields.
Unsupported attributes remain absent; transient attribute errors fall back to an
individual read. Set `IBR_AX_ATTRIBUTE_MODE=single` for parity diagnosis or rollback.
Action names are still queried separately. No cached snapshot authorizes a later
action, and post-action settling deadlines are unchanged.

### Verification timing and compact failures

macOS settling yields 32 ms between unresolved full-tree observations so the
application has an idle turn to publish asynchronous accessibility updates. The
initial delay, caller timeout, required postcondition, fresh target resolution,
and two-identical-tree requirement for an implicit wait remain unchanged. The
idle interval consumes the existing deadline; no action is replayed.

A failed `--observe --format compact` action also saves its complete original
failure payload and last snapshot in `fullReport`. The short receipt preserves
the nonzero exit status and reports `actionDelivered`, `verificationPassed:
false`, `postAction`, and `evidenceSaved`. Delivery does not prove verification.
If the report cannot be written, `evidenceSaved: false` and `compactFallback:
inline-evidence` explicitly retain the original diagnostic inline; this
exception can be large because silently losing evidence is unacceptable.

### State-preserving refs and bounded capture

Native candidate responses preserve `value`, `enabled`, and optional `selected`.
Numeric AX values use strings (for example checkbox `"0"` / `"1"`); missing values
remain unknown. Compact reads retain control values, including editable text.
Full reports remain private local files. Compact output covers controls rather
than all static text; use `extract` or capture evidence for document content.

Refs match a unique role and identifier (otherwise accessible label) in the same
window. Geometry and state changes produce `~` updates. Ambiguous identities are
retired, and removed ref numbers are not reused, including across persisted empty
reads. Refs are scoped to the stored session generation and revalidated against
the live tree before dispatch. Name-only identity cannot distinguish an app that
replaces a control with an identical accessible name between observations; use
stable app identifiers when possible. Native AX does not offer an atomic
read-and-act transaction. A successful diff means observed change, not proven
completion. Check `postAction` and the requested postcondition.

```sh
node dist/bin/ibr.js native:session:read SESSION --format compact --json
node dist/bin/ibr.js native:session:action SESSION --action click --target Save \
  --wait-for Saved --observe --format compact --json
node dist/bin/ibr.js native:session:capture SESSION --duration-ms 7000 \
  --interval-ms 150 --max-frames 5 \
  --keyframe-on 'Error' 'Cancelled' 'Complete' --json
```

Capture currently supports macOS. It records a baseline and ordered AX deltas to
`events.jsonl`, plus a manifest and selected native screenshots. It uses bounded
polling, not an AX notification or ScreenCaptureKit subscription. Each literal
keyframe trigger fires once; baseline and final frames share the budget (0–20).
AX extraction and screenshots are separate observations. Screenshot cost can
lengthen the actual sample interval, which the manifest reports. States shorter
than that gap can be missed. Neither an idle tree nor the end of the recording
establishes task completion. Capture directories must be new; existing evidence
is not overwritten. Errors preserve a partial recording and return failure.

Capture permits up to 1000 ms of finalization after the sampling duration.
Backend reads and screenshot acquisition have deadline watchdogs. The existing
backend cannot cancel an in-flight read-only operation; it may finish after a
timeout. Local filesystem finalization is best effort because OS writes are not
cancellable. Screenshot receipts retain acquisition times, private immutable PNG
copies, dimensions, byte sizes, and SHA-256 hashes. Images are limited to 16 MiB
and 32 million decoded pixels. A one-frame budget captures the baseline only.
Detected triggers have separate events even when no screenshot budget remains.
Long control-value previews are capped at 256 characters with explicit truncation
and original-length markers; the complete value remains in the full report.
