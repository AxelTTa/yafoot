#!/usr/bin/env bash
# notify_all_done.sh <worker-id> <exit-code>
# Sends one Telegram all-clear when the last detached YaFoot worker has exited.
set -euo pipefail
cd /home/ubuntu/yafoot 2>/dev/null || cd "$(dirname "$0")/.."

WORKER_ID="${1:-unknown}"
EXIT_CODE="${2:-0}"
LOCK="workers/.all-done.lock"
STAMP="workers/.all-done.last"
mkdir -p workers

count_running() {
  bash scripts/count_workers.sh "${WORKER_ID}" 2>/dev/null || printf '0\n'
}

send_telegram() {
  local text="$1"
  if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_ALLOWED_CHAT_ID:-}" ]]; then
    echo "notify_all_done: Telegram env missing, skipped"
    return 0
  fi
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_ALLOWED_CHAT_ID}" \
    --data-urlencode "text=${text}" >/dev/null || true
}

(
  flock -x 9

  running="$(count_running)"
  if [[ "${running}" != "0" ]]; then
    echo "notify_all_done: ${running} worker(s) still running"
    exit 0
  fi

  now="$(date +%s)"
  last="0"
  [[ -f "${STAMP}" ]] && last="$(cat "${STAMP}" 2>/dev/null || echo 0)"
  if [[ $((now - last)) -lt 45 ]]; then
    echo "notify_all_done: recent all-clear already sent"
    exit 0
  fi
  echo "${now}" > "${STAMP}"

  if [[ "${EXIT_CODE}" == "0" ]]; then
    send_telegram $'✅ YaFoot all delegated work is done.\nLast worker: '"${WORKER_ID}"$'\nUse /workers for summaries.'
  else
    send_telegram $'⚠️ YaFoot all delegated workers have stopped, but the last worker exited nonzero.\nLast worker: '"${WORKER_ID}"$'\nUse /workers and logs to inspect.'
  fi
) 9>"${LOCK}"
