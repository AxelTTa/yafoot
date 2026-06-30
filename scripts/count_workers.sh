#!/usr/bin/env bash
# Count live detached YaFoot workers from pid files.
set -euo pipefail
cd /home/ubuntu/yafoot 2>/dev/null || cd "$(dirname "$0")/.."

SKIP_ID="${1:-}"
count=0
shopt -s nullglob
for pidfile in workers/*.pid; do
  id="$(basename "$pidfile" .pid)"
  if [[ -n "$SKIP_ID" && "$id" == "$SKIP_ID" ]]; then
    continue
  fi
  pid="$(cat "$pidfile" 2>/dev/null || true)"
  if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
    count=$((count + 1))
  else
    rm -f "$pidfile"
  fi
done
printf '%s\n' "$count"
