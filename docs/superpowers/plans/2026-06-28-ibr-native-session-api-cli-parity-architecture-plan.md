# IBR Native Session API and CLI Parity Architecture Plan

> **For agentic workers:** Execute this with build-loop task tracking. Keep changes behavior-preserving until the controller is proven through tests. Commit only after validation gates pass.

**Goal:** Promote native session orchestration from MCP handler internals into a shared controller API, then make MCP and CLI thin adapters over the same behavior.

**Spec:** `docs/superpowers/specs/2026-06-28-ibr-native-session-api-cli-parity-prd.md`

**Primary files expected to change:**
- `src/native/session-controller.ts`
- `src/native/session-controller.test.ts`
- `src/mcp/tools.ts`
- `src/bin/ibr.ts`
- `src/index.ts`
- `skills/native-testing/SKILL.md`
- `skills/cli-reference/SKILL.md`
- `.codex-plugin/skills/native/SKILL.md`
- `README.md` or release notes if the repo has a current release-note convention

---

## Architecture

### Target Shape

```text
            package API
                |
                v
      NativeSessionController
        |       |       |
        |       |       +-- macOS Accessibility driver
        |       +---------- iOS/watchOS simulator driver
        +------------------ shared session registry and result envelope

      adapters over controller:
        - MCP tools in src/mcp/tools.ts
        - CLI commands in src/bin/ibr.ts
        - public exports in src/index.ts
```

The controller owns the lifecycle and the adapters own input/output translation.

### Module Contract

Create `src/native/session-controller.ts` with a small, typed API:

```ts
export interface NativeSessionController {
  start(request: NativeSessionStartRequest): Promise<NativeSessionStartResult>;
  read(request: NativeSessionReadRequest): Promise<NativeSessionReadResult>;
  action(request: NativeSessionActionRequest): Promise<NativeSessionActionResult>;
  close(request: NativeSessionCloseRequest): Promise<NativeSessionCloseResult>;
}
```

The first implementation can export standalone functions instead of a class if that fits the existing code better. The important boundary is that MCP and CLI call the same behavior.

### Session Registry

Use an injected registry so tests can run in memory and CLI can later persist sessions if needed:

```ts
export interface NativeSessionRegistry {
  get(id: string): NativeSessionRecord | undefined;
  set(id: string, session: NativeSessionRecord): void;
  delete(id: string): boolean;
  list?(): NativeSessionRecord[];
}
```

Initial implementation may keep process-local sessions if the current native drivers require that. If CLI multi-process persistence is not feasible in the first slice, document it explicitly and provide a single-command `native:session:action --start ... --close` replay path.

### Result Envelope

All surfaces should preserve the same result model:

- `ok`
- `sessionId`
- `app`
- `window`
- `action`
- `target`
- `postAction`
- `wait`
- `screenshot`
- `error`

MCP can still wrap this in content blocks. CLI should print the raw JSON envelope when `--json` is set.

---

## Task 1: Lock Current Behavior With Tests

**Files:**
- Modify or create: `src/mcp/tools.test.ts`
- Create: `src/native/session-controller.test.ts`

- [ ] Add tests around the current `native_session_action` behavior before extraction:
  - press action succeeds
  - wait target found
  - wait timeout returns structured failure
  - screenshot read returns an image artifact path or structured screenshot payload
- [ ] Add fixture or mocked native driver seams so tests do not require a live macOS app.
- [ ] Run targeted tests:

```bash
npm test -- src/mcp/tools.test.ts src/native/session-controller.test.ts
```

**Acceptance:** Tests fail only where the new controller does not exist yet; existing behavior assertions are explicit.

---

## Task 2: Extract Native Session Controller

**Files:**
- Create: `src/native/session-controller.ts`
- Modify: `src/native/macos.ts`
- Modify: `src/native/simulator.ts` if needed

- [ ] Move session lifecycle orchestration out of MCP handler-local code.
- [ ] Keep low-level AX extraction, simulator access, and source bridge code in existing native modules.
- [ ] Add dependency injection for:
  - session registry
  - clock or timeout helper
  - screenshot capture helper
  - driver selection
- [ ] Preserve current result shape.
- [ ] Add typed request/response exports.

**Acceptance:** Controller tests pass without using MCP server setup.

---

## Task 3: Convert MCP to Thin Adapter

**Files:**
- Modify: `src/mcp/tools.ts`

- [ ] Replace native session implementation code in MCP handlers with controller calls.
- [ ] Keep MCP tool names and schemas unchanged unless a documented extension is required.
- [ ] Keep `waitFor`, `waitTimeoutMs`, `postAction`, and screenshot read behavior compatible with commit `3e9375a`.
- [ ] Keep MCP response blocks host-friendly.

**Acceptance:** Existing MCP/native tests pass and serialized output remains compatible.

---

## Task 4: Add CLI Native Session Parity

**Files:**
- Modify: `src/bin/ibr.ts`
- Create or modify: CLI tests under the repo's existing test convention
- Modify: `skills/cli-reference/SKILL.md`

- [ ] Add commands:
  - `native:session:start`
  - `native:session:read`
  - `native:session:action`
  - `native:session:close`
- [ ] Support `--json` on all new commands.
- [ ] Support non-interactive arguments for app, session ID, action, target, `waitFor`, and timeout.
- [ ] Return useful non-zero exit codes:
  - invalid arguments
  - session not found
  - target not found
  - wait timeout
  - driver failure
- [ ] Add at least one single-command replay shortcut if process-local sessions prevent reliable multi-command CLI sessions.

**Acceptance:** A shell user can reproduce a native press-then-wait flow with JSON output and no MCP host.

---

## Task 5: Export and Document API

**Files:**
- Modify: `src/index.ts`
- Modify: `skills/native-testing/SKILL.md`
- Modify: `.codex-plugin/skills/native/SKILL.md`
- Modify: `README.md` or release notes

- [ ] Export the controller and public types.
- [ ] Mark the API as experimental if needed.
- [ ] Document the surface split:
  - API for implementation and embedding
  - CLI for replay and CI
  - MCP for agents
- [ ] Include one example for each surface.

**Acceptance:** Package consumers can import the controller from a documented path.

---

## Validation Gates

Run before commit:

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

For native dogfood when a real app is available:

```bash
ibr native:session:start --app <app> --json
ibr native:session:action --session <id> --action press --target <label-or-id> --wait-for <label-or-id> --json
ibr native:session:read --session <id> --what screenshot --json
ibr native:session:close --session <id> --json
```

If multi-process sessions are not supported in the first release, validate with the documented single-command replay path instead.

---

## Rollout Order

1. Land controller extraction behind existing MCP behavior.
2. Land MCP adapter cleanup.
3. Land CLI parity.
4. Land docs and skill updates.
5. Run native dogfood against a known macOS app.
6. Publish in the next package release after compatibility validation.

## Open Questions

- Should CLI sessions persist across processes or start with a single-command replay mode?
- Should the public API be root-exported immediately or exposed through a native subpath first?
- Should screenshot read return only file paths in CLI JSON, or optionally inline base64 for CI artifacts?

## Backlog Item

Recommended Rally backlog ID: `ibr-native-session-api-cli-parity`.

Recommended intent: Implement a typed native session controller API, convert MCP native session tools into thin adapters, and add CLI parity for deterministic replay and CI validation.
