#!/bin/bash

set -e

# ── ink-board orchestration script ────────────────────────────────────────────
# Runs fetch.js and render.js in an endless loop for systemd-based deployment.
#
# Flow:
#   1. Print intro message
#   2. Sleep 5 seconds (warm-up)
#   3. Enter endless loop:
#      - Run fetch.js
#      - If fetch succeeds (exit 0), run render.js
#      - On any error, log and continue
#      - Sleep 5 minutes before next iteration

INITIAL_SLEEP=5
LOOP_SLEEP=300  # 5 minutes
ITERATION=0

echo "=========================================================================="
echo "ink-board orchestration service started"
echo "Initial sleep: ${INITIAL_SLEEP}s | Loop interval: $((LOOP_SLEEP / 60))m"
echo "=========================================================================="

sleep "$INITIAL_SLEEP"

while true; do
  ITERATION=$((ITERATION + 1))
  echo ""
  echo "──────────────────────────────────────────────────────────────────────────"
  echo "Iteration #$ITERATION — $(date '+%Y-%m-%d %H:%M:%S')"
  echo "──────────────────────────────────────────────────────────────────────────"

  # Run fetch.js
  if node fetch.js; then
    echo "[orchestration] fetch.js succeeded, running render.js…"
    # Render only if fetch succeeded
    if ! node render.js; then
      echo "[orchestration] ERROR: render.js failed (exit code: $?)"
    fi
  else
    echo "[orchestration] ERROR: fetch.js failed (exit code: $?)"
  fi

  echo "[orchestration] sleeping for $((LOOP_SLEEP / 60)) minute(s)…"
  sleep "$LOOP_SLEEP"
done
