# Scorecard: Claude Code And Codex Compatibility Check

| Area | Status | Evidence |
|---|---|---|
| Claude Code plugin surface | Pass with source/cache caveat | `.claude-plugin/plugin.json`, `.mcp.json`, `hooks/hooks.json`, `commands/`, `skills/`, and `agents/visual-iterator.md` are present. Installed Claude cache found at `~/.claude/plugins/cache/rosslabs-ai-toolkit/ibr/1.0.0`, so cache may need refresh to pick up source changes. |
| Codex plugin surface | Fixed | `.codex-plugin/plugin.json` now points to `.codex-plugin/mcp.json`; `package.json` now publishes `.codex-plugin`. |
| Agent/subagent approach | Pass | Claude has `agents/visual-iterator.md`. Codex should use skills plus MCP/session tools; Design Director specialist passes are planning artifacts, not per-button subagents. |
| Scanning/navigation daemons | Pass with runtime caveat | CLI browser server exists in `src/browser-server.ts`; MCP persistent sessions exist in `src/mcp/tools.ts` via `session_start`, `session_action`, `session_read`, `session_close`, plus native session tools. End-to-end browser integration needs a reachable Chrome debugger in sandboxed environments. |
| Semantic AI search testing | Fixed | MCP `flow_search` now supports current Chrome sessions via `sessionId` and `aiValidation: true`, returning screenshots, extracted results, timing, and relevance-validation context. |
| Validation | Partial pass | `npm run typecheck` and `npm run build` passed. Focused tests passed: 8 files, 88 tests. Full `npm test -- --run` passes 35 files and fails 2 Chrome integration suites because the sandbox cannot launch/connect to Chrome debugger within 5s. |

## Commands

```text
node JSON manifest validation
node package files validation
npm run typecheck
npm test -- --run src/engine/session-tools.test.ts src/flows/types.test.ts src/mockup-gallery/reader.test.ts src/mockup-gallery/writer.test.ts src/ui-guidance/library.test.ts src/design-system/principles/principles.test.ts src/rules/rules.test.ts src/schemas.test.ts
npm run build
npm test -- --run
```

## Remaining Runtime Proof

Run browser integration with a host Chrome debugger when available:

```text
IBR_BROWSER_MODE=connect IBR_CDP_URL=http://127.0.0.1:9222 npm test -- --run src/engine/compat.test.ts src/engine/engine.integration.test.ts
```
