#!/usr/bin/env bash
# ibr-loop-hook.sh — Stop hook that drives the IBR iterative refinement loop
# Reads .ibr/loop-state.json, checks criteria against transcript, manages iterations.
#
# Exit codes:
#   0 = allow exit (no loop active, criteria met, max reached)
#   2 = block exit with message on stdout (re-feed prompt or pause)

set -euo pipefail

STATE_FILE=".ibr/loop-state.json"

# --- No state file = no loop, allow exit ---
if [[ ! -f "$STATE_FILE" ]]; then
  exit 0
fi

# --- Read state ---
ACTIVE=$(jq -r '.active // false' "$STATE_FILE")
if [[ "$ACTIVE" != "true" ]]; then
  exit 0
fi

ITERATION=$(jq -r '.iteration // 0' "$STATE_FILE")
MAX_ITERATIONS=$(jq -r '.max_iterations // 20' "$STATE_FILE")
URL=$(jq -r '.url // ""' "$STATE_FILE")
CRITERIA_TYPE=$(jq -r '.criteria.type // "scan_pass"' "$STATE_FILE")
PAUSED=$(jq -r '.paused // false' "$STATE_FILE")
PROMPT=$(jq -r '.prompt // ""' "$STATE_FILE")
PAUSE_POINTS=$(jq -c '.pause_points // []' "$STATE_FILE")

# --- Get transcript from stdin (Stop hook receives it) ---
TRANSCRIPT=""
if [[ -t 0 ]]; then
  : # No stdin available
else
  TRANSCRIPT=$(cat)
fi

# --- Handle paused state: check if user said continue or stop ---
if [[ "$PAUSED" == "true" ]]; then
  # Look for user intent in the transcript
  USER_STOP=$(echo "$TRANSCRIPT" | perl -ne 'print "yes" if /\b(stop|cancel|quit|end|abort|done|no more)\b/i' | head -1)
  USER_CONTINUE=$(echo "$TRANSCRIPT" | perl -ne 'print "yes" if /\b(continue|go|proceed|keep going|yes|more|next)\b/i' | head -1)

  if [[ -n "$USER_STOP" ]] && [[ -z "$USER_CONTINUE" ]]; then
    # User wants to stop
    jq '.active = false | .paused = false' "$STATE_FILE" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
    exit 0
  fi

  # User continues (or ambiguous — default to continue)
  jq '.paused = false' "$STATE_FILE" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
  # Fall through to normal loop logic
fi

# --- Increment iteration ---
ITERATION=$((ITERATION + 1))

# --- Check criteria against transcript ---
CRITERIA_MET=false
VERDICT=""
ISSUES=""

case "$CRITERIA_TYPE" in
  scan_pass)
    if echo "$TRANSCRIPT" | perl -ne '$f=1 if /Verdict:\s*PASS/i; END { exit($f ? 0 : 1) }'; then
      CRITERIA_MET=true
      VERDICT="PASS"
    else
      VERDICT=$(echo "$TRANSCRIPT" | perl -nle 'print $1 if /Verdict:\s*(\w+)/i' | tail -1)
      VERDICT="${VERDICT:-NO_SCAN}"
    fi
    ;;
  zero_issues)
    if echo "$TRANSCRIPT" | perl -ne '$f=1 if /Issues\s*\(0\)/i; END { exit($f ? 0 : 1) }'; then
      CRITERIA_MET=true
      VERDICT="ZERO_ISSUES"
      ISSUES="0"
    else
      ISSUES=$(echo "$TRANSCRIPT" | perl -nle 'print $1 if /Issues\s*\((\d+)\)/i' | tail -1)
      ISSUES="${ISSUES:-unknown}"
      VERDICT="HAS_ISSUES"
    fi
    ;;
  compare_match)
    if echo "$TRANSCRIPT" | perl -ne '$f=1 if /Verdict:\s*(MATCH|EXPECTED_CHANGE)/i; END { exit($f ? 0 : 1) }'; then
      CRITERIA_MET=true
      VERDICT=$(echo "$TRANSCRIPT" | perl -nle 'print $1 if /Verdict:\s*(MATCH|EXPECTED_CHANGE)/i' | tail -1)
    else
      VERDICT=$(echo "$TRANSCRIPT" | perl -nle 'print $1 if /Verdict:\s*(\w+)/i' | tail -1)
      VERDICT="${VERDICT:-NO_COMPARE}"
    fi
    ;;
  custom)
    if echo "$TRANSCRIPT" | perl -ne '$f=1 if /<ibr-done\s*\/?>/; END { exit($f ? 0 : 1) }'; then
      CRITERIA_MET=true
      VERDICT="CUSTOM_DONE"
    else
      VERDICT="IN_PROGRESS"
    fi
    ;;
esac

# --- Record history entry ---
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
HISTORY_ENTRY=$(jq -n \
  --argjson iteration "$ITERATION" \
  --arg verdict "$VERDICT" \
  --arg issues "${ISSUES:-}" \
  --arg timestamp "$TIMESTAMP" \
  --argjson criteria_met "$CRITERIA_MET" \
  '{iteration: $iteration, verdict: $verdict, issues: $issues, timestamp: $timestamp, criteria_met: $criteria_met}')

# Update state file with new iteration and history
jq --argjson iter "$ITERATION" --argjson entry "$HISTORY_ENTRY" \
  '.iteration = $iter | .history += [$entry]' "$STATE_FILE" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"

# --- Criteria met: allow exit ---
if [[ "$CRITERIA_MET" == "true" ]]; then
  jq '.active = false' "$STATE_FILE" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
  exit 0
fi

# --- Max iterations reached: allow exit ---
if [[ "$ITERATION" -ge "$MAX_ITERATIONS" ]]; then
  jq '.active = false' "$STATE_FILE" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
  cat <<EOF
IBR iterative refinement reached maximum iterations ($MAX_ITERATIONS) without meeting criteria ($CRITERIA_TYPE).

Last verdict: $VERDICT
Review .ibr/loop-state.json history for the full iteration log.
EOF
  exit 2
fi

# --- Check pause point ---
IS_PAUSE=$(echo "$PAUSE_POINTS" | jq --argjson i "$ITERATION" 'map(select(. == $i)) | length > 0')
if [[ "$IS_PAUSE" == "true" ]]; then
  jq '.paused = true' "$STATE_FILE" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
  cat <<EOF
IBR iterative refinement — pause at iteration $ITERATION/$MAX_ITERATIONS.

Read .ibr/loop-state.json and summarize progress so far:
- How many iterations completed
- What the last verdict was ($VERDICT)
- Key changes made across iterations
- Remaining issues if any

Then ask the user: **Continue iterating or stop here?**

If the user says stop, output "Stopping IBR loop." and exit.
If the user says continue, resume working on the task.
EOF
  exit 2
fi

# --- Continue loop: re-feed the prompt ---
cat <<EOF
IBR iterative refinement — iteration $((ITERATION + 1))/$MAX_ITERATIONS (last verdict: $VERDICT).

Continue working on the task. The URL is $URL.
The goal: $PROMPT

Read .ibr/loop-state.json for full iteration history. Review what was tried in previous iterations to avoid repeating the same fixes.

After making changes, run \`ibr scan\` on $URL to check progress. The loop ends when criteria ($CRITERIA_TYPE) are met.
EOF
exit 2
