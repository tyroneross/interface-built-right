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

# --- Read tool arguments from stdin ---
# Read before any gate: the artifact check below needs FILE_PATH and does not
# depend on the dev-server baseline the rest of this hook is gated on.
INPUT=""
if [[ ! -t 0 ]]; then
  INPUT=$(cat)
fi

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null || echo "")

# --- Artifact lint (opt-in, static, no dev server) ------------------------
# OFF unless the project opts in, because this hook fires on Write|Edit in every
# project that installs IBR and most .html files are not artifacts. Enable with
# either shape in .ibrrc.json:
#   "artifactLint": true
#   "artifactLint": { "enabled": true, "minSeverity": "warn", "profile": "auto",
#                     "disable": "AD204,AD304" }
artifact_lint_check() {
  [[ -f ".ibrrc.json" ]] || return 0
  case "$FILE_PATH" in
    *.html|*.htm) ;;
    *) return 0 ;;
  esac
  [[ -f "$FILE_PATH" ]] || return 0
  command -v python3 >/dev/null 2>&1 || return 0

  local cfg enabled
  cfg=$(jq -c '.artifactLint // empty' .ibrrc.json 2>/dev/null || echo "")
  [[ -n "$cfg" ]] || return 0
  if [[ "$cfg" == "true" ]]; then
    enabled="true"
  else
    enabled=$(printf '%s' "$cfg" | jq -r 'if type=="object" then (.enabled // false) else false end' 2>/dev/null || echo false)
  fi
  [[ "$enabled" == "true" ]] || return 0

  local linter min_sev profile disable
  linter="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/scripts/artifact_lint.py"
  [[ -f "$linter" ]] || return 0

  min_sev="warn"; profile="auto"; disable=""
  if [[ "$cfg" != "true" ]]; then
    min_sev=$(printf '%s' "$cfg" | jq -r '.minSeverity // "warn"' 2>/dev/null || echo warn)
    profile=$(printf '%s' "$cfg" | jq -r '.profile // "auto"' 2>/dev/null || echo auto)
    disable=$(printf '%s' "$cfg" | jq -r '.disable // ""' 2>/dev/null || echo "")
  fi

  local out
  # --fail-on never: advisory only. This hook informs, it never blocks a write.
  out=$(python3 "$linter" check "$FILE_PATH" \
          --profile "$profile" --min-severity "$min_sev" --fail-on never \
          ${disable:+--disable "$disable"} 2>/dev/null) || return 0
  grep -q "no findings" <<<"$out" && return 0
  printf 'IBR artifact lint — %s\n' "$FILE_PATH"
  printf '%s\n' "$out" | sed '1d'
}
artifact_lint_check || true

# --- Gate: pre-change state must exist (pre-hook passed all gates) ---
[[ ! -f ".ibr/pre-change-state.json" ]] && exit 0

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
