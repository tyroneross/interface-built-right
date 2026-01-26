---
description: Configure Claude Code hooks for better IBR experience
---

# IBR Hook Setup

This command helps you configure Claude Code hooks to make IBR easier, faster, and more efficient.

## Recommended Hooks

### 1. Auto-Approve Safe IBR Commands

Add these patterns to your `~/.claude/settings.json` PreToolUse hook to auto-approve safe IBR commands:

```python
# Add to safe_patterns in your PreToolUse hook:
ibr_safe = [
    'npx ibr start', 'npx ibr check', 'npx ibr list', 'npx ibr serve',
    'npx ibr audit', 'npx ibr session:', 'npx ibr status',
]
```

**Commands that should still require approval** (potentially destructive):
- `npx ibr update` - Overwrites baseline images
- `npx ibr clean` - Deletes old sessions

### 2. Check Current Settings

First, read your current settings:

```bash
cat ~/.claude/settings.json
```

### 3. Update Settings

If you have a PreToolUse hook with safe patterns, add IBR commands to it.

If you don't have hooks configured yet, here's a complete example:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python3 << 'EOF'\nimport json, sys, re\ndata = json.load(sys.stdin)\ncmd = data.get('tool_input', {}).get('command', '')\n\n# IBR safe commands - auto-approve\nibr_safe = [\n    r'^npx\\s+ibr\\s+(start|check|list|serve|audit|status)',\n    r'^npx\\s+ibr\\s+session:',\n]\n\nfor pattern in ibr_safe:\n    if re.search(pattern, cmd):\n        print(json.dumps({\n            'hookSpecificOutput': {\n                'hookEventName': 'PreToolUse',\n                'permissionDecision': 'allow',\n                'permissionDecisionReason': 'Auto-approved safe IBR command'\n            }\n        }))\n        sys.exit(0)\nEOF"
          }
        ]
      }
    ]
  }
}
```

## Benefits After Setup

| Before | After |
|--------|-------|
| Permission prompt for every `npx ibr` command | Auto-approved for safe commands |
| Manual tracking of IBR results | Automatic logging (optional) |
| Can forget to run `ibr check` | Warning on task completion (optional) |

## Optional: Result Logging Hook

Add a PostToolUse hook to log IBR verdicts:

```json
{
  "matcher": "Bash",
  "hooks": [{
    "type": "command",
    "command": "python3 << 'EOF'\nimport json, sys, re, os\nfrom datetime import datetime\n\ndata = json.load(sys.stdin)\nresult = data.get('tool_result', {}).get('stdout', '') + data.get('tool_result', {}).get('stderr', '')\ncmd = data.get('tool_input', {}).get('command', '')\n\nif 'npx ibr' not in cmd:\n    sys.exit(0)\n\nverdicts = re.findall(r'(MATCH|EXPECTED_CHANGE|UNEXPECTED_CHANGE|LAYOUT_BROKEN)', result)\n\nif verdicts:\n    project = os.environ.get('CLAUDE_PROJECT_DIR', '.')\n    log_path = f'{project}/.ibr/audit.log'\n    os.makedirs(os.path.dirname(log_path), exist_ok=True)\n    \n    with open(log_path, 'a') as f:\n        f.write(f'\\n--- {datetime.now().isoformat()} ---\\n')\n        f.write(f'Command: {cmd}\\n')\n        f.write(f'Verdict: {verdicts[-1]}\\n')\nEOF",
    "timeout": 5000
  }]
}
```

## Verification

After setting up hooks, test them:

```bash
# This should auto-approve (no prompt):
npx ibr list

# This should still require approval:
npx ibr update
```
