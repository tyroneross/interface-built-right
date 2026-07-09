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

`target` is optional for `keystroke` — omit it to send the chord to the
currently focused element, or pass an accessible name to focus first. `app`
(`op: launch|switch|quit`) and `menuPath` (an array of menu titles) accept the
same request shape and are **live**: they execute the lifecycle / menu action and
return a real `ActionOutcome` with a validator confirming the observed state
change (`success: false` only when the action genuinely did not take effect).

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
  [--chord <chord>] [--op launch|switch|quit] [--app <name>] [--menu-path <items>] [--json]
```

`--action` is required; one of `click | press | fill | type | focus | showMenu |
increment | decrement | confirm | cancel | scroll | scrollToVisible | check |
select | keystroke | app | menuPath`. Element verbs require `--target`;
`keystroke`/`app`/`menuPath` accept `--target` optionally. `--menu-path` is a
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
