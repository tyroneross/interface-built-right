# IBR MCP server — dormant by default, opt-in

IBR ships three surfaces: a CLI (`ibr` / `npx ibr ...`), a programmatic API
(`@tyroneross/interface-built-right`'s `exports` map), and an MCP server. As of
this change, **only the CLI and the API are auto-wired.** The MCP server still
builds, still ships in the npm package, and its tests still run — but Claude
Code (or any other MCP-aware host) no longer discovers it automatically,
because `.mcp.json` no longer lives at the plugin root.

## Why dormant, not deleted

- The CLI and the API cover the tools an agent needs for day-to-day UI work
  (`scan`, `observe`, `interact`, `extract`, `native:scan`, `native:session:*`,
  etc.) without a background process.
- Auto-discovered MCP tools are invisible in any file an agent reads — a
  session that loses them without warning tends to reach for something else
  (e.g. Playwright/Puppeteer) instead of falling back to the CLI. Making MCP
  opt-in removes that ambient dependency; the skills and commands in this repo
  now point at the CLI explicitly.
- Some MCP-only conveniences (notably the ad-hoc `screenshot` tool, the
  `references` design-library manager, and the `design_system` mutators —
  `set_token` / `add_principle` / `set_severity`) do not yet have a CLI
  equivalent. Re-enable MCP if you rely on those; see the workarounds inside
  the relevant `skills/*/SKILL.md` files.
- New capability lands on the CLI and API going forward. The MCP server is
  maintained only in the sense that it keeps building and its existing tests
  keep passing — it is not where new tools get added.

## Re-enabling the MCP server

1. Copy this file's sibling back to the plugin root:
   ```bash
   cp optional-mcp/mcp.json .mcp.json
   ```
2. **Restart Claude Code** (a full restart, not a plugin reload). MCP servers
   are spawned once per session and resolve their launch command
   (`dist/mcp/server.js`) at that time — reloading plugins re-reads
   `.claude-plugin/plugin.json` and skill/command files, but it does not
   re-spawn already-running MCP server processes or notice a newly-restored
   `.mcp.json` until the next session starts fresh.
3. No rebuild is required. `dist/mcp/server.js` is part of the normal
   `build:ts` output and keeps building and shipping whether or not
   `.mcp.json` is wired — re-enabling just points the host at a binary that
   was already there.

To go back to dormant, delete `.mcp.json` at the plugin root and restart again.

## Re-enabling for Codex

Codex is a second host with its own manifest, so it needs its own opt-in. The
Codex config lives beside this file as `codex-mcp.json`, and
`.codex-plugin/plugin.json` no longer declares an `mcpServers` key.

1. Restore the config and point the manifest at it:
   ```bash
   cp optional-mcp/codex-mcp.json .codex-plugin/mcp.json
   ```
   then add back to `.codex-plugin/plugin.json`, beside `"skills"`:
   ```json
   "mcpServers": "./.codex-plugin/mcp.json",
   ```
2. Reinstall the bundle so Codex picks it up:
   ```bash
   npm run plugin:install-codex
   ```
3. Restart Codex.

To go back to dormant, remove the `mcpServers` key and delete
`.codex-plugin/mcp.json`, then reinstall.

**Both hosts must be handled separately.** Making the Claude host dormant does
not make the Codex host dormant — `.mcp.json` and `.codex-plugin/mcp.json` are
read by different processes, and leaving either one wired keeps a background
MCP server discoverable on that host.

## What's in `mcp.json`

Identical to the file that used to live at the plugin root — it launches
`dist/mcp/server.js` with `node`:

```json
{
  "mcpServers": {
    "ibr": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/dist/mcp/server.js"]
    }
  }
}
```
