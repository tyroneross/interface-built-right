#!/usr/bin/env bash
# ibr-pre-change.sh — PreToolUse hook for Write|Edit
# Captures baseline scan + screenshot before UI file edits.
#
# Gates (all must pass or script exits 0 silently):
#   1. File path is a UI extension (.tsx/.jsx/.vue/.svelte/.css/.scss/.html)
#   2. Project has .ibr/config.json with autoVerify: true (explicit opt-in)
#   3. $PWD is under config.projectRoot (project boundary check)
#   4. Last run was > 10s ago (rate limit)
#   5. A dev server is reachable at config.devServerUrl (or detected)
#
# Exit 0 = allow edit (always — this is observational, never blocks)

set -euo pipefail

# --- Read tool arguments from stdin ---
INPUT=""
if [[ ! -t 0 ]]; then
  INPUT=$(cat)
fi

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null || echo "")
[[ -z "$FILE_PATH" ]] && exit 0

# --- Gate 1: UI file extension check ---
case "$FILE_PATH" in
  *.tsx|*.jsx|*.vue|*.svelte|*.css|*.scss|*.html) ;;
  *) exit 0 ;;
esac

# --- Gate 2: opt-in check — .ibr/config.json must have autoVerify: true ---
[[ ! -f ".ibr/config.json" ]] && exit 0
AUTO_VERIFY=$(jq -r '.autoVerify // false' .ibr/config.json 2>/dev/null || echo "false")
[[ "$AUTO_VERIFY" != "true" ]] && exit 0

# --- Gate 3: project boundary check ---
PROJECT_ROOT=$(jq -r '.projectRoot // ""' .ibr/config.json 2>/dev/null || echo "")
if [[ -n "$PROJECT_ROOT" ]]; then
  # Resolve to absolute path and check $PWD is under it
  PROJECT_ROOT_ABS=$(cd "$PROJECT_ROOT" 2>/dev/null && pwd -P || echo "")
  PWD_ABS=$(pwd -P)
  if [[ -z "$PROJECT_ROOT_ABS" ]] || [[ "$PWD_ABS" != "$PROJECT_ROOT_ABS"* ]]; then
    exit 0
  fi
fi

# --- Gate 4: rate limit — 10s minimum between cycles ---
RATE_LIMIT_FILE=".ibr/autoscan-last-run"
if [[ -f "$RATE_LIMIT_FILE" ]]; then
  LAST_RUN=$(cat "$RATE_LIMIT_FILE" 2>/dev/null || echo "0")
  NOW=$(date +%s)
  ELAPSED=$((NOW - LAST_RUN))
  [[ $ELAPSED -lt 10 ]] && exit 0
fi

# --- Gate 5: dev server detection ---
# Prefer configured URL; fall back to parallel port probe
DEV_URL=$(jq -r '.devServerUrl // ""' .ibr/config.json 2>/dev/null || echo "")

if [[ -z "$DEV_URL" ]]; then
  # Parallel port probe — fire all curl probes at once, first responder wins
  TMP_DIR=$(mktemp -d)
  trap 'rm -rf "$TMP_DIR"' EXIT
  for port in 3000 3001 5173 5174 4200 8080 8000; do
    (
      if curl -s -o /dev/null -w '%{http_code}' "http://localhost:$port" --max-time 1 2>/dev/null | grep -q '^[23]'; then
        echo "http://localhost:$port" > "$TMP_DIR/$port"
      fi
    ) &
  done
  # Wait up to 1.5s for any probe to succeed
  for _ in 1 2 3; do
    sleep 0.5
    RESULT=$(find "$TMP_DIR" -type f 2>/dev/null | head -1)
    if [[ -n "$RESULT" ]]; then
      DEV_URL=$(cat "$RESULT" 2>/dev/null || echo "")
      break
    fi
  done
  wait 2>/dev/null || true
fi

[[ -z "$DEV_URL" ]] && exit 0

# --- All gates passed: capture baseline ---
mkdir -p .ibr

# Update rate limit timestamp
date +%s > "$RATE_LIMIT_FILE"

# Save pre-change state
cat > .ibr/pre-change-state.json <<EOF
{
  "url": "$DEV_URL",
  "file": "$FILE_PATH",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

# Spawn background scans — don't block the edit
nohup npx ibr scan "$DEV_URL" --json > .ibr/pre-change-scan.json 2>/dev/null &
disown 2>/dev/null || true

nohup npx ibr snapshot "$DEV_URL" --name "pre-change" > /dev/null 2>&1 &
disown 2>/dev/null || true

exit 0
