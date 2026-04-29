# Codex Plugin Setup

IBR is viable as a Codex plugin when Codex can discover the plugin root, load `.codex-plugin/plugin.json`, expose compact Codex routing skills, and start the IBR MCP server from `.codex-plugin/mcp.json`.

## What Codex Loads

Codex uses:

- `.codex-plugin/plugin.json` for plugin identity, marketplace metadata, skills, and MCP config.
- `.codex-plugin/skills/` for the agent-facing design, validation, and native routing guidance.
- `.codex-plugin/mcp.json` for the `ibr` MCP server.

Codex does not load Claude slash-command routing from `commands/`, Claude hooks from `hooks/`, or Claude-style agent frontmatter from `agents/`. The larger shared `skills/` directory remains the source library for Claude/source workflows; the Codex manifest intentionally points at the compact `.codex-plugin/skills/` layer to keep activation costs low.

## Install This Checkout Locally

Run from the repository root:

```bash
npm run build
npm run plugin:install-codex
```

The installer creates:

- `~/plugins/ibr` as a slim local plugin bundle generated from this checkout.
- `~/.agents/plugins/marketplace.json` with a local marketplace entry:

```json
{
  "name": "ibr",
  "source": {
    "source": "local",
    "path": "./plugins/ibr"
  },
  "policy": {
    "installation": "AVAILABLE",
    "authentication": "ON_INSTALL"
  },
  "category": "Coding"
}
```

Restart Codex after installing so it reloads the local marketplace.

If `~/plugins/ibr` or the marketplace entry already points somewhere else, re-run intentionally with:

```bash
npm run plugin:install-codex -- --force
```

## Validate

Use local checks before relying on the plugin:

```bash
python3 -m json.tool .codex-plugin/plugin.json
python3 -m json.tool .codex-plugin/mcp.json
npm run build
```

For a static Codex-plugin quality pass, run Plugin Eval when available:

```bash
node /path/to/plugin-eval/scripts/plugin-eval.js analyze ~/plugins/ibr --format markdown
```

Evaluate the generated bundle, not the source checkout. The source repo includes Claude commands, long-form skills, docs, and development artifacts that are intentionally not part of the slim Codex plugin runtime.

Expected hard requirements:

- Manifest has `interface.websiteURL`, `privacyPolicyURL`, `termsOfServiceURL`, and `defaultPrompt`.
- `skills` points to `./.codex-plugin/skills`.
- `mcpServers` points to `./.codex-plugin/mcp.json`.
- The MCP server command resolves to `dist/mcp/server.js` after build.

## Use From Codex

Use the plugin by naming the installed plugin or one of its skills:

```text
$ibr Plan this UI with IBR.
$ibr Scan this UI with IBR.
$ibr Validate this design intent.
```

The primary Codex path is skills plus MCP tools:

- Start design and implementation work with `design`.
- Validate web UI with `validate`.
- Validate simulator or macOS UI with `native`.
- Use MCP tools such as `scan`, `snapshot`, `compare`, `observe`, `interact`, `flow_search`, `flow_form`, `native_scan`, and `scan_macos` for live evidence.
