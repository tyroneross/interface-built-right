# IBR Plugin Adapters

Transform `universal/tools.yaml` into platform-specific integrations.

## Adapters

| Adapter | Target | Output |
|---------|--------|--------|
| `to-mcp-server.ts` | Cursor, Windsurf, Warp, Codex, Continue | `mcp-server/` |
| `to-cody.ts` | Sourcegraph Cody | `.vscode/cody.json` |
| `to-aider.ts` | Aider | `IBR-CONVENTIONS.md` |

## Usage (Future)

```bash
# Generate all targets
npm run generate:all

# Generate specific target
npm run generate:mcp-server
npm run generate:cody
npm run generate:aider
```

## Status

🔜 **Planned** - Adapters not yet implemented.

Current approach: Claude Code plugin maintained manually as primary.
MCP server and other adapters to be built when demand warrants.

## Implementation Notes

### MCP Server Adapter

```typescript
// Pseudo-code for MCP server generation
import { parse } from 'yaml';
import { tools } from '../universal/tools.yaml';

function generateMcpServer(tools: Tool[]) {
  return {
    name: 'ibr-mcp',
    version: tools.meta.version,
    tools: tools.map(t => ({
      name: t.id,
      description: t.description,
      inputSchema: paramsToJsonSchema(t.params),
      handler: async (input) => {
        const cmd = interpolate(t.cli, input);
        return execSync(cmd);
      }
    }))
  };
}
```

### Cody Adapter

```typescript
// Pseudo-code for Cody commands generation
function generateCodyCommands(tools: Tool[]) {
  return {
    commands: Object.fromEntries(
      tools.map(t => [
        t.id.replace('_', '-'),
        {
          description: t.description,
          prompt: `Run: ${t.cli}`,
          mode: 'ask'
        }
      ])
    )
  };
}
```

### Aider Adapter

```typescript
// Pseudo-code for Aider conventions generation
function generateAiderConventions(tools: Tool[]) {
  return `
# IBR Visual Regression Testing

${tools.map(t => `
## ${t.name}

${t.description}

\`\`\`bash
${t.example || t.cli}
\`\`\`
`).join('\n')}
  `;
}
```
