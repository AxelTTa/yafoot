#!/usr/bin/env bash
# delegate.sh "<task>"  — spawn a DETACHED background worker (claud) that does the task end-to-end
# and self-reports to Telegram when done. Survives bridge restarts. Used by the YaFoot manager bot
# so the manager stays free to chat while work runs.
set -euo pipefail
cd /home/ubuntu/yafoot 2>/dev/null || cd "$(dirname "$0")/.."
TASK="${1:?usage: delegate.sh \"<task>\"}"
ENGINE="${2:-claud}"
mkdir -p workers
TS="$(date -u +%Y%m%d-%H%M%S)-$$"
LOG="workers/${TS}.log"

read -r -d '' WSYS <<EOF || true
You are a YaFoot WORKER agent running headless on the server (worker id ${TS}). Project root: /home/ubuntu/yafoot.
FIRST read CLAUDE.md — it has the full context; ALL creds are already in your environment.
Do the assigned task end-to-end and autonomously (never ask questions). If you change the app, SHIP it:
  bash scripts/deploy.sh   (typecheck + build + verify native/Expo-Go + deploy to Vercel + Expo Go OTA + git push)
When finished (or if blocked), send Axel a short Telegram update by running:
  curl -s -X POST "https://api.telegram.org/bot\$TELEGRAM_BOT_TOKEN/sendMessage" \
    --data-urlencode chat_id=\$TELEGRAM_ALLOWED_CHAT_ID \
    --data-urlencode "text=[worker ${TS}] <one-line status + what changed + live URL if deployed>"
Keep going until the task is fully done.
EOF

nohup setsid "$ENGINE" -p "$TASK" \
  --append-system-prompt "$WSYS" \
  --permission-mode bypassPermissions \
  --allowedTools Bash Read Write Edit \
  --output-format json --max-turns 300 \
  > "$LOG" 2>&1 < /dev/null &
echo "WORKER_STARTED id=${TS} pid=$! engine=${ENGINE} log=${LOG}"
