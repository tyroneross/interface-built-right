#!/usr/bin/env bash
# setup-ibr-loop.sh — Initialize an IBR iterative refinement loop
# Usage: setup-ibr-loop.sh <url> [--max <n>] [--criteria <type>] <prompt...>

set -euo pipefail

# --- Defaults ---
MAX_ITERATIONS=20
CRITERIA_TYPE="scan_pass"
URL=""
PROMPT_PARTS=()

# --- Parse args ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --max)
      shift
      if [[ $# -eq 0 ]] || ! [[ "$1" =~ ^[0-9]+$ ]]; then
        echo "ERROR: --max requires a number (1-100)" >&2
        exit 1
      fi
      MAX_ITERATIONS="$1"
      shift
      ;;
    --criteria)
      shift
      if [[ $# -eq 0 ]]; then
        echo "ERROR: --criteria requires a type (scan_pass|zero_issues|compare_match|custom)" >&2
        exit 1
      fi
      case "$1" in
        scan_pass|zero_issues|compare_match|custom)
          CRITERIA_TYPE="$1"
          ;;
        *)
          echo "ERROR: Unknown criteria type '$1'. Use: scan_pass, zero_issues, compare_match, custom" >&2
          exit 1
          ;;
      esac
      shift
      ;;
    *)
      if [[ -z "$URL" ]]; then
        URL="$1"
      else
        PROMPT_PARTS+=("$1")
      fi
      shift
      ;;
  esac
done

# --- Validate URL ---
if [[ -z "$URL" ]]; then
  echo "ERROR: URL is required. Usage: setup-ibr-loop.sh <url> [--max <n>] [--criteria <type>] <prompt...>" >&2
  exit 1
fi

# Must be localhost/127.0.0.1
if ! echo "$URL" | perl -ne 'exit 0 if /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/; exit 1'; then
  echo "ERROR: URL must be localhost or 127.0.0.1. Got: $URL" >&2
  echo "IBR iterative refinement only works with local dev servers." >&2
  exit 1
fi

# --- Validate prompt ---
PROMPT="${PROMPT_PARTS[*]:-}"
if [[ -z "$PROMPT" ]]; then
  echo "ERROR: A task prompt is required after the URL." >&2
  echo "Usage: setup-ibr-loop.sh <url> [--max <n>] [--criteria <type>] <prompt...>" >&2
  exit 1
fi

# --- Validate max iterations ---
if [[ "$MAX_ITERATIONS" -lt 1 ]] || [[ "$MAX_ITERATIONS" -gt 100 ]]; then
  echo "ERROR: --max must be between 1 and 100. Got: $MAX_ITERATIONS" >&2
  exit 1
fi

# --- Create state directory ---
mkdir -p .ibr

# --- Check for existing loop ---
if [[ -f .ibr/loop-state.json ]]; then
  EXISTING_ACTIVE=$(jq -r '.active // false' .ibr/loop-state.json 2>/dev/null || echo "false")
  if [[ "$EXISTING_ACTIVE" == "true" ]]; then
    echo "WARNING: An active loop already exists. Overwriting." >&2
  fi
fi

# --- Build pause points based on max ---
PAUSE_POINTS="[]"
for p in 2 5 10 20; do
  if [[ $p -le $MAX_ITERATIONS ]]; then
    PAUSE_POINTS=$(echo "$PAUSE_POINTS" | jq ". + [$p]")
  fi
done

# --- Write state file ---
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

jq -n \
  --argjson active true \
  --argjson iteration 0 \
  --argjson max "$MAX_ITERATIONS" \
  --arg url "$URL" \
  --arg criteria_type "$CRITERIA_TYPE" \
  --argjson pause_points "$PAUSE_POINTS" \
  --argjson paused false \
  --arg started_at "$TIMESTAMP" \
  --arg prompt "$PROMPT" \
  '{
    active: $active,
    iteration: $iteration,
    max_iterations: $max,
    url: $url,
    criteria: { type: $criteria_type },
    pause_points: $pause_points,
    paused: $paused,
    started_at: $started_at,
    prompt: $prompt,
    history: []
  }' > .ibr/loop-state.json

echo "IBR iterative refinement loop initialized."
echo "  URL: $URL"
echo "  Criteria: $CRITERIA_TYPE"
echo "  Max iterations: $MAX_ITERATIONS"
echo "  Pause points: $(echo "$PAUSE_POINTS" | jq -c '.')"
echo "  Prompt: $PROMPT"
echo ""
echo "The loop will run when Claude attempts to exit. Use /ibr:cancel-iterate to stop."
