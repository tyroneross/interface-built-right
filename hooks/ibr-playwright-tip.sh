#!/usr/bin/env bash
# ibr-playwright-tip.sh — PreToolUse hook for Write|Edit|Bash
#
# Advisory ONLY. Detects Playwright usage being introduced (require/import of
# playwright or @playwright/test, or chromium.launch) in a Write/Edit's new
# content or a Bash command, and returns a non-blocking tip naming the IBR
# CLI equivalents. Never blocks or denies the tool call.
#
# Output: `{}` (no-op) unless a Playwright pattern matches, in which case a
# hookSpecificOutput.additionalContext + top-level systemMessage tip is
# returned, per Claude Code's PreToolUse hook JSON output contract.
#
# Fail-open: any missing input, unparseable JSON, or missing `jq` results in
# `{}` and exit 0. This hook never fails the calling tool call.

set -uo pipefail
trap 'printf "{}"; exit 0' ERR

# --- Read tool call JSON from stdin ---
INPUT=""
if [[ ! -t 0 ]]; then
  INPUT=$(cat 2>/dev/null) || INPUT=""
fi
[[ -z "$INPUT" ]] && { printf '{}'; exit 0; }

command -v jq >/dev/null 2>&1 || { printf '{}'; exit 0; }

TOOL_NAME=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null) || TOOL_NAME=""

# --- Pull the text that could contain a Playwright reference ---
# Write: new file content. Edit: the replacement text. Bash: the command
# being run. Any other tool is out of scope for this hook.
TEXT=""
case "$TOOL_NAME" in
  Bash)
    TEXT=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null) || TEXT=""
    ;;
  Write)
    TEXT=$(printf '%s' "$INPUT" | jq -r '.tool_input.content // ""' 2>/dev/null) || TEXT=""
    ;;
  Edit)
    TEXT=$(printf '%s' "$INPUT" | jq -r '.tool_input.new_string // ""' 2>/dev/null) || TEXT=""
    ;;
  *)
    printf '{}'
    exit 0
    ;;
esac

[[ -z "$TEXT" ]] && { printf '{}'; exit 0; }

# require('playwright') / from 'playwright' / from "@playwright/test" /
# bare "@playwright/test" mention / chromium.launch(...)
PATTERN="require\\(['\"]playwright['\"]\\)|from ['\"]playwright['\"]|@playwright/test|chromium\\.launch"

if printf '%s' "$TEXT" | grep -Eq "$PATTERN" 2>/dev/null; then
  TIP="IBR tip: this looks like Playwright. IBR may already cover it without adding the dependency. Stateful multi-step interaction: 'session:start --detach' then 'session:click/type/eval/screenshot -s <css>', then 'session:close'. Viewport checks: 'scan -v mobile' / 'scan -v desktop' (or --device <name>). Multi-URL runs: a shell loop calling 'session:navigate' per URL. See skills/interactive-testing and skills/cli-reference for the full command reference. Playwright still has a real edge for native browser dialogs (alert/confirm/prompt) and truly open-ended scripts IBR has no runner for."
  jq -n --arg tip "$TIP" \
    '{systemMessage: $tip, hookSpecificOutput: {hookEventName: "PreToolUse", additionalContext: $tip}}' \
    2>/dev/null || printf '{}'
  exit 0
fi

printf '{}'
exit 0
