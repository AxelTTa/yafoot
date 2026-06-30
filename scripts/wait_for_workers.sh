#!/usr/bin/env bash
# wait_for_workers.sh <self-worker-id> [max-seconds]
# Wait until no other detached YaFoot workers are live.
set -euo pipefail
cd /home/ubuntu/yafoot 2>/dev/null || cd "$(dirname "$0")/.."

SELF_ID="${1:?usage: wait_for_workers.sh <self-worker-id> [max-seconds]}"
MAX_SECONDS="${2:-3600}"
SLEEP_SECONDS="${SLEEP_SECONDS:-15}"
start="$(date +%s)"

while true; do
  running="$(bash scripts/count_workers.sh "$SELF_ID" 2>/dev/null || printf '0\n')"
  now="$(date +%s)"
  printf 'other_workers=%s elapsed=%ss\n' "$running" "$((now - start))"
  if [[ "$running" == "0" ]]; then
    exit 0
  fi
  if (( now - start >= MAX_SECONDS )); then
    echo "timeout waiting for other workers after ${MAX_SECONDS}s" >&2
    exit 124
  fi
  sleep "$SLEEP_SECONDS"
done
