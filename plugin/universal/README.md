# IBR Universal Plugin Scaffold

Define tools once, generate integrations for multiple AI IDEs.

## Structure

```
universal/
├── tools.yaml          # Tool definitions (source of truth)
├── prompts/            # Shared prompt templates
│   └── ui-audit.md     # UI audit workflow prompt
├── schema.json         # JSON Schema for tools.yaml (TODO)
└── README.md           # This file
```

## Supported Platforms

| Platform | Integration Type | Config Location | Status |
|----------|-----------------|-----------------|--------|
| **Claude Code** | Plugin folder | `.claude-plugin/` | ✅ Primary |
| **Cursor** | MCP server | VS Code MCP settings | 🔜 Planned |
| **Windsurf** | MCP server | `~/.codeium/windsurf/mcp_config.json` | 🔜 Planned |
| **Warp** | MCP server | MCP config | 🔜 Planned |
| **Codex** | MCP server | `~/.codex/config.toml` | 🔜 Planned |
| **Continue.dev** | MCP server | `config.json` mcpServers | 🔜 Planned |
| **Cody** | Custom commands | `.vscode/cody.json` | 🔜 Planned |
| **Aider** | Conventions | `CONVENTIONS.md` | 🔜 Planned |

## Tool Definition Schema

```yaml
tools:
  - id: ibr_start                    # Unique identifier
    name: Capture Baseline           # Human-readable name
    description: Capture baseline... # Description for AI
    category: visual-regression      # Grouping
    params:                          # Input parameters
      - name: url
        type: string
        required: true
        description: URL to capture
    cli: "npx ibr start {url}"       # CLI command template
    returns:                         # Output schema
      - sessionId: string
    example: |                       # Usage example
      npx ibr start http://localhost:3000
```

## Generation Targets

### 1. Claude Code Plugin (Default)

Already exists at `plugin/.claude-plugin/`. Maintained manually as primary.

Generated files:
- `commands/*.md` - Slash commands
- `agents/*.md` - Specialized agents
- `hooks/*.md` - Event hooks

### 2. MCP Server

Single MCP server covers 6 platforms (Cursor, Windsurf, Warp, Codex, Continue, Cody Enterprise).

Generated structure:
```
mcp-server/
├── package.json
├── src/
│   └── index.ts      # MCP server implementation
└── README.md         # Installation instructions
```

MCP tools map directly from `tools.yaml`:
- `id` → tool name
- `params` → input schema
- `cli` → execution command

### 3. Cody Custom Commands

JSON format for Sourcegraph Cody.

Generated file: `.vscode/cody.json`
```json
{
  "commands": {
    "ibr-start": {
      "description": "Capture baseline screenshot",
      "prompt": "Run: npx ibr start {url}",
      "mode": "ask"
    }
  }
}
```

### 4. Aider Conventions

Markdown context for Aider's `--read` flag.

Generated file: `IBR-CONVENTIONS.md`
```markdown
# IBR Visual Regression Testing

When working on UI changes, use IBR:

1. Before changes: `npx ibr start <url>`
2. After changes: `npx ibr check`
...
```

## CI/CD Integration

Future: GitHub Actions workflow to auto-generate all targets on release.

```yaml
# .github/workflows/release.yml
jobs:
  build-plugins:
    steps:
      - run: npm run generate:mcp-server
      - run: npm run generate:cody
      - run: npm run generate:aider
```

## Why Universal Scaffold?

1. **Single source of truth** - Update tools.yaml, all platforms update
2. **Consistent behavior** - Same tool semantics across IDEs
3. **Easier maintenance** - Don't maintain N separate codebases
4. **Future-proof** - Add new platforms by writing one adapter

## Current Status

- ✅ `tools.yaml` defined with all IBR tools
- ✅ Claude Code plugin (manual, primary)
- 🔜 MCP server generator
- 🔜 Cody commands generator
- 🔜 Aider conventions generator
