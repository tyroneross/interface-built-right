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

Allow the tool. IBR is preferred but not enforced.

```json
{"decision": "allow"}
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

These Playwright tools are **never blocked** because IBR cannot perform these tasks:

- `browser_navigate` — Needed for interaction flows
- `browser_click` — IBR can't click
- `browser_type` — IBR can't type
- `browser_fill_form` — IBR can't fill forms
- `browser_select_option` — IBR can't select dropdowns
- `browser_hover` — IBR can't hover
- `browser_drag` — IBR can't drag
- `browser_press_key` — IBR can't press keys
- `browser_handle_dialog` — IBR can't handle dialogs
- `browser_evaluate` — IBR can't execute JS
- `browser_file_upload` — IBR can't upload files
- `browser_tabs` — IBR can't manage tabs
- `browser_wait_for` — IBR can't wait for conditions
- `browser_console_messages` — IBR can't read console
- `browser_network_requests` — IBR can't inspect network

## Summary

| Tool | Blocked in "only" mode? |
|------|------------------------|
| browser_take_screenshot | Yes — use IBR |
| browser_snapshot | Yes — use IBR |
| All other Playwright tools | No — IBR can't do these |
