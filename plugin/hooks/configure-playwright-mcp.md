---
event: SessionStart
---

# Configure Playwright MCP for IBR Compatibility

This hook runs at session start to ensure Playwright MCP uses headless Chromium instead of system Chrome, preventing browser conflicts when IBR is in use.

## Problem Solved

When Playwright MCP uses system Chrome and Chrome is already open, macOS hands off to the existing browser session instead of launching isolated. This causes:
- "Opening in existing browser session" errors
- Visible browser windows (distracting)
- Conflicts between IBR and Playwright MCP

## Detection

Check if Playwright MCP is configured:

```bash
# Find Playwright MCP config locations
PLAYWRIGHT_MCP_CONFIGS=(
  "${HOME}/.claude/plugins/cache/claude-plugins-official/playwright/"*"/.mcp.json"
  "${HOME}/.config/claude-code/mcp.json"
  ".mcp.json"
)

FOUND_CONFIG=""
for config_pattern in "${PLAYWRIGHT_MCP_CONFIGS[@]}"; do
  for config in $config_pattern; do
    if [ -f "$config" ]; then
      FOUND_CONFIG="$config"
      break 2
    fi
  done
done

if [ -n "$FOUND_CONFIG" ]; then
  echo "PLAYWRIGHT_MCP_FOUND:$FOUND_CONFIG"
fi
```

## Configuration Check

If Playwright MCP is found, check if it's properly configured for headless Chromium:

```bash
if [ -n "$FOUND_CONFIG" ]; then
  # Check if already configured for chromium and headless
  if grep -q '"chromium"' "$FOUND_CONFIG" && grep -q '"--headless"' "$FOUND_CONFIG"; then
    echo "ALREADY_CONFIGURED"
  else
    echo "NEEDS_CONFIGURATION"
  fi
fi
```

## Auto-Fix

If Playwright MCP needs configuration, update it:

```bash
if [ "$NEEDS_CONFIGURATION" = "true" ] && [ -n "$FOUND_CONFIG" ]; then
  # Backup original
  cp "$FOUND_CONFIG" "${FOUND_CONFIG}.backup"

  # Write optimized config for IBR compatibility
  cat > "$FOUND_CONFIG" << 'EOF'
{
  "playwright": {
    "command": "npx",
    "args": ["@playwright/mcp@latest", "--browser", "chromium", "--headless"]
  }
}
EOF

  echo "CONFIGURED"
fi
```

## Response

### If Playwright MCP was configured:

```json
{
  "decision": "continue",
  "reason": "IBR Browser Configuration\n\nPlaywright MCP has been configured for IBR compatibility:\n• Browser: Chromium (headless)\n• No visible windows\n• Isolated from system Chrome\n\nOriginal config backed up to: ${FOUND_CONFIG}.backup\n\nBoth IBR and Playwright MCP will now run without conflicts."
}
```

### If already configured:

```json
{
  "decision": "continue",
  "reason": "IBR Ready\n\nPlaywright MCP is already configured for headless Chromium.\nNo browser conflicts expected."
}
```

### If Playwright MCP not found:

```json
{
  "decision": "continue",
  "reason": "IBR Ready\n\nNo Playwright MCP detected. IBR will use its own headless browser."
}
```

## What This Ensures

| Before | After |
|--------|-------|
| Playwright MCP uses system Chrome | Uses headless Chromium |
| Browser opens visibly | Runs invisibly |
| Conflicts with existing Chrome | Isolated instance |
| "Opening in existing session" errors | Clean launch every time |

## Manual Override

If you need Playwright MCP to use visible Chrome for debugging:

```bash
# Restore original config
mv "${FOUND_CONFIG}.backup" "$FOUND_CONFIG"
```

Or set mode in `.claude/ibr.local.md`:
```yaml
---
playwright_mcp: visible
---
```
