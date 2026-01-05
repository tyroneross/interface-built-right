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
  "reason": "IBR Reminder: For screenshot/capture tasks, consider using IBR instead:\n• npx ibr session:start <url> --name \"description\"\n• npx ibr session:screenshot <id>\n\nIBR provides session tracking, comparison verdicts, and design framework validation.\n\nTo enforce IBR-only: run /only-use-ibr"
}
```

### If mode is "only":

Block the capture tool and provide IBR alternatives.

```json
{
  "decision": "block",
  "reason": "IBR-only mode is enabled for capture tasks.\n\nUse IBR instead:\n• Screenshot: npx ibr start <url> --name \"description\"\n• HTML extraction: IBR web UI → Upload Reference → From URL\n• Or use /ibr:screenshot command\n\nPlaywright interaction tools (click, type, navigate for flows) remain available.\n\nTo disable: /prefer-ibr"
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
