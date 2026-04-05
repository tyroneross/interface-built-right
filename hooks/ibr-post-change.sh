#!/usr/bin/env bash
# ibr-post-change.sh — PostToolUse hook for Write|Edit
# After UI file edit: wait for HMR, re-scan, diff against baseline, output verdict.
# Only fires when a pre-change baseline exists (gated by the pre-change hook).
#
# Output modes:
#   PASS + 0 issues  → one line (silent-ish)
#   PASS + issues    → condensed review block
#   FAIL/ISSUES      → full verdict block with recommendations

set -euo pipefail

# --- Gate: pre-change state must exist (pre-hook passed all gates) ---
[[ ! -f ".ibr/pre-change-state.json" ]] && exit 0

# --- Read tool arguments from stdin ---
INPUT=""
if [[ ! -t 0 ]]; then
  INPUT=$(cat)
fi

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null || echo "")

# Same UI file filter as pre-hook
case "$FILE_PATH" in
  *.tsx|*.jsx|*.vue|*.svelte|*.css|*.scss|*.html) ;;
  *) exit 0 ;;
esac

# --- Read pre-change state ---
DEV_URL=$(jq -r '.url' .ibr/pre-change-state.json 2>/dev/null || echo "")
if [[ -z "$DEV_URL" ]]; then
  rm -f .ibr/pre-change-state.json
  exit 0
fi

# --- Wait for HMR to settle ---
# Poll dev server up to 10s, then brief settle delay
MAX_WAIT=10
WAITED=0
while [[ $WAITED -lt $MAX_WAIT ]]; do
  if curl -s -o /dev/null -w '%{http_code}' "$DEV_URL" --max-time 2 2>/dev/null | grep -q '^[23]'; then
    break
  fi
  sleep 1
  WAITED=$((WAITED + 1))
done
sleep 2  # HMR settle

# --- Run post-change scan ---
if ! npx ibr scan "$DEV_URL" --json > .ibr/post-change-scan.json 2>/dev/null; then
  echo "IBR: Post-change scan failed — dev server may be down."
  rm -f .ibr/pre-change-state.json
  exit 0
fi

PRE=".ibr/pre-change-scan.json"
POST=".ibr/post-change-scan.json"

# --- Extract metrics from both scans ---
if [[ ! -f "$PRE" ]] || [[ ! -s "$PRE" ]]; then
  # Pre-scan didn't complete in time
  echo "IBR: Post-scan complete (baseline unavailable — pre-scan did not finish in time)"
  rm -f .ibr/pre-change-state.json
  exit 0
fi

PRE_VERDICT=$(jq -r '.verdict // "UNKNOWN"' "$PRE" 2>/dev/null || echo "UNKNOWN")
POST_VERDICT=$(jq -r '.verdict // "UNKNOWN"' "$POST" 2>/dev/null || echo "UNKNOWN")
PRE_ELEMENTS=$(jq '.elements.all | length' "$PRE" 2>/dev/null || echo 0)
POST_ELEMENTS=$(jq '.elements.all | length' "$POST" 2>/dev/null || echo 0)
PRE_ISSUES=$(jq '.issues | length' "$PRE" 2>/dev/null || echo 0)
POST_ISSUES=$(jq '.issues | length' "$POST" 2>/dev/null || echo 0)
ELEM_DIFF=$((POST_ELEMENTS - PRE_ELEMENTS))

# --- Condensed output mode for clean passes ---
if [[ "$POST_VERDICT" == "PASS" ]] && [[ "$POST_ISSUES" -eq 0 ]]; then
  # One-line output — minimal context cost
  DIFF_SUFFIX=""
  if [[ $ELEM_DIFF -gt 0 ]]; then
    DIFF_SUFFIX=" (+$ELEM_DIFF elements)"
  elif [[ $ELEM_DIFF -lt 0 ]]; then
    DIFF_SUFFIX=" ($ELEM_DIFF elements)"
  fi
  echo "IBR: ✓ PASS$DIFF_SUFFIX"
  rm -f .ibr/pre-change-state.json
  exit 0
fi

# --- Full verdict block for REVIEW / NEEDS_FIX ---
{
  echo "IBR Post-Change Verification"
  echo "File: $FILE_PATH"
  echo "URL:  $DEV_URL"
  echo ""
  echo "Before: $PRE_VERDICT ($PRE_ELEMENTS elements, $PRE_ISSUES issues)"
  echo "After:  $POST_VERDICT ($POST_ELEMENTS elements, $POST_ISSUES issues)"

  if [[ $ELEM_DIFF -gt 0 ]]; then
    echo "Elements: +$ELEM_DIFF added"
  elif [[ $ELEM_DIFF -lt 0 ]]; then
    echo "Elements: $ELEM_DIFF removed"
  fi

  if [[ "$POST_ISSUES" -gt 0 ]]; then
    echo ""
    echo "Issues:"
    jq -r '.issues[] | "  [\(.severity)] \(.description)"' "$POST" 2>/dev/null | head -5
  fi

  POST_ERRORS=$(jq -r '.console.errors[]?' "$POST" 2>/dev/null | head -3)
  if [[ -n "$POST_ERRORS" ]]; then
    echo ""
    echo "Console errors:"
    echo "$POST_ERRORS" | sed 's/^/  /'
  fi

  echo ""
  if [[ "$POST_VERDICT" == "PASS" ]]; then
    echo "Verdict: REVIEW — scan passed but $POST_ISSUES issue(s) found."
  else
    echo "Verdict: NEEDS_FIX — address issues above before proceeding."
  fi
}

rm -f .ibr/pre-change-state.json
exit 0
