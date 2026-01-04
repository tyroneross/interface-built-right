---
event: Stop
---

# IBR Verification Required Before Completion

This hook checks if UI work was done and requires IBR verification before task completion.

## Analyze Conversation Context

Check if the conversation involved UI work by looking for indicators:

```bash
# Check if any UI files were edited in this session
UI_PATTERNS="\.tsx|\.jsx|\.vue|\.svelte|components/|pages/|app/"

# Check conversation summary for UI keywords
UI_KEYWORDS="button|form|component|layout|UI|interface|interactive|click|modal|dialog|sidebar|header|footer|navigation"

# If context contains UI work indicators, require verification
if echo "$CONVERSATION_SUMMARY" | grep -qiE "$UI_KEYWORDS"; then
  echo "UI_WORK_DETECTED"
else
  echo "NO_UI_WORK"
fi
```

## Decision Logic

### If no UI work detected:

Allow completion without IBR check.

```json
{"decision": "allow"}
```

### If UI work detected:

Check if IBR was already run in this session.

```bash
# Look for IBR output in conversation
if echo "$CONVERSATION_SUMMARY" | grep -qE "npx ibr|Element Audit|NO_HANDLER|PLACEHOLDER_LINK|session:screenshot"; then
  echo "IBR_VERIFIED"
else
  echo "IBR_NOT_RUN"
fi
```

### If UI work done but IBR not run:

Block completion and require verification.

```json
{
  "decision": "block",
  "reason": "UI work detected but IBR verification not found.\n\nBefore completing this task, run:\n\n```bash\nnpx ibr audit <url>\n```\n\nOr for interactive pages:\n```bash\nnpx ibr session:screenshot <session_id>\n```\n\nCheck for:\n- NO_HANDLER errors (buttons without click handlers)\n- PLACEHOLDER_LINK errors (links with href=\"#\")\n- TOUCH_TARGET_SMALL warnings\n\nAfter verification, you may complete the task."
}
```

### If IBR was already run:

Allow completion.

```json
{"decision": "allow"}
```

## What This Hook Enforces

| Scenario | Behavior |
|----------|----------|
| Backend-only work | Allow completion |
| UI work + IBR verified | Allow completion |
| UI work + IBR NOT run | Block, require verification |

## Customization

To disable this hook temporarily, users can:
1. Remove or rename this file
2. Add to `.claude/settings.json`: `"hooks.disabled": ["require-ibr-verification"]`

## Keywords That Trigger UI Detection

The hook looks for these patterns in conversation context:
- File patterns: `.tsx`, `.jsx`, `.vue`, `.svelte`, `components/`, `pages/`
- Task keywords: button, form, component, layout, UI, interface, modal, dialog
- Action keywords: click, interactive, navigation, sidebar, header, footer
