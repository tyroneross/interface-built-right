---
event: PreToolUse
tools:
  - Edit
  - Write
---

# IBR UI Verification Hook

This hook prompts for IBR verification when editing UI files.

## Check if UI File

```bash
FILE_PATH="$TOOL_PARAM_file_path"

# Check if file is a UI file
if echo "$FILE_PATH" | grep -qE '\.(tsx|jsx|vue|svelte)$'; then
  echo "UI_FILE"
elif echo "$FILE_PATH" | grep -qE 'components/|pages/|app/.*\.(tsx|jsx)$'; then
  echo "UI_FILE"
elif echo "$FILE_PATH" | grep -qE '\.(css|scss|sass)$'; then
  echo "STYLE_FILE"
else
  echo "NOT_UI"
fi
```

## Decision Logic

### If NOT a UI file:

Allow without comment.

```json
{"decision": "allow"}
```

### If UI or style file:

Allow but remind about IBR verification.

```json
{
  "decision": "allow",
  "message": "UI file detected. After completing changes, validate with IBR:\n\n1. Run: npx ibr scan <url> --json\n2. Verify implementation matches user's description (check computedStyles, handlers, a11y)\n3. Fix mismatches and re-scan until validated\n\nDo not mark task complete without IBR validation."
}
```

## Trigger Behavior

This hook:
- Does NOT block edits (allows all changes)
- Adds a reminder message to each UI file edit
- Builds awareness that IBR should be run after changes

For stronger enforcement, use the Stop hook `require-ibr-verification.md`.
