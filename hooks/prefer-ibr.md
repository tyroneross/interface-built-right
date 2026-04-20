---
event: PreToolUse
tools:
  - mcp__plugin_playwright_playwright__browser_take_screenshot
  - mcp__plugin_playwright_playwright__browser_snapshot
---

# IBR Capture Enforcement Hook

This hook only blocks Playwright **capture** tools when "only" mode is enabled.
Playwright **interaction** tools are never blocked.

## Check Mode

```bash
if [ -f "${CLAUDE_PLUGIN_ROOT}/.claude/ibr.local.md" ]; then
  grep -q "mode: only" "${CLAUDE_PLUGIN_ROOT}/.claude/ibr.local.md" && echo "ONLY_MODE"
fi
```

## Decision Logic

### If mode is "prefer" or file missing:

Allow the tool but remind about IBR. Provides visible suggestion without blocking.

```json
{
  "decision": "continue",
  "reason": "IBR Tip: For precise property verification, also run an IBR scan alongside this screenshot:\n• npx ibr scan <url> --json (exact CSS values, handler detection, a11y)\n\nScreenshots show visual coherence; scans verify exact properties. Together = most complete validation.\n\nTo enforce IBR-only capture: run /only-use-ibr"
}
```

### If mode is "only":

Block the capture tool and provide IBR alternatives.

```json
{
  "decision": "block",
  "reason": "IBR-only mode is enabled for capture and validation tasks.\n\nUse IBR instead:\n• Design validation: npx ibr scan <url> --json\n• Screenshot: use the `screenshot` MCP tool (or npx ibr start <url> --name \"description\")\n• HTML extraction: IBR web UI → Upload Reference → From URL\n\nPlaywright interaction tools (click, type, navigate for flows) remain available.\n\nTo disable: /prefer-ibr"
}
```

## What This Hook Does NOT Block

These Playwright tools are **never blocked**:

**IBR has equivalents (prefer IBR):**
- `browser_navigate` — Use `session:navigate`
- `browser_click` — Use `session:click`
- `browser_type` — Use `session:type`
- `browser_press_key` — Use `session:press`
- `browser_wait_for` — Use `session:wait`

**Playwright-only (no IBR equivalent):**
- `browser_fill_form` — Complex form filling
- `browser_select_option` — Dropdown selection
- `browser_hover` — Hover interactions
- `browser_drag` — Drag and drop
- `browser_handle_dialog` — Alert/confirm dialogs
- `browser_evaluate` — Execute JavaScript
- `browser_file_upload` — File uploads
- `browser_tabs` — Tab management
- `browser_console_messages` — Console inspection
- `browser_network_requests` — Network inspection

## Summary

| Tool | Blocked in "only" mode? |
|------|------------------------|
| browser_take_screenshot | Yes — use IBR |
| browser_snapshot | Yes — use IBR |
| All other Playwright tools | No — IBR can't do these |
