#!/usr/bin/env bash
# delegate.sh "<task>"  — spawn a DETACHED background worker (codx) that does the task end-to-end
# and self-reports to Telegram when done. Survives bridge restarts. Used by the YaFoot manager bot
# so the manager stays free to chat while work runs.
set -euo pipefail
cd /home/ubuntu/yafoot 2>/dev/null || cd "$(dirname "$0")/.."
TASK="${1:?usage: delegate.sh \"<task>\"}"
ENGINE="codx"
CODEX_MODEL="${CODEX_MODEL:-gpt-5.5}"
export PATH="/home/ubuntu/.local/bin:/home/ubuntu/.npm-global/bin:/home/ubuntu/.local/npm-global/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"
mkdir -p workers
TS="$(date -u +%Y%m%d-%H%M%S)-$$"
LOG="workers/${TS}.log"
OUT="workers/${TS}.last.txt"
DOLLAR='$'

read -r -d '' WSYS <<EOF || true
You are a YaFoot WORKER agent running headless on the server (worker id ${TS}). Project root: /home/ubuntu/yafoot.
FIRST read CLAUDE.md — it has the full context; ALL creds are already in your environment.
Do the assigned task end-to-end and autonomously (never ask questions). If you change the app, SHIP it:
  bash scripts/deploy.sh   (typecheck + build + verify native/Expo-Go + deploy to Vercel + Expo Go OTA + git push)
When finished (or if blocked), send Axel a short, phone-friendly Telegram update.
Use this format exactly:
  [worker ${TS}] 🟢 PASS | running: <N>
  - Done: <short result>
  - Next: <next action, or none>

Status line must be one of:
  [worker ${TS}] 🟢 PASS | running: <N>
  [worker ${TS}] 🟠 PARTIAL | running: <N>
  [worker ${TS}] 🔴 BLOCKED | running: <N>

Before the final Telegram, compute running YaFoot worker count if possible:
  RUNNING=${DOLLAR}(pgrep -af 'codx.*YaFoot WORKER agent' 2>/dev/null | wc -l | tr -d ' ') || RUNNING=""
Use " | running: ${DOLLAR}RUNNING" on the status line when available; omit it if unavailable.
Keep it under ~450 characters unless critical. Use max 3 short bullet/lines:
  - Done: <short result>
  - Blocker: <only if any>
  - Next: <next action, or none>
For test workers, add one compact metric line only if useful. Avoid long prose.

Army-run default behavior:
- If the task asks to run an "army", treat it as a fix loop, not a report-only audit.
- Run simulated users/tests and record issues with severity: high, medium, or low.
- Fix high/medium issues when the fix is safe, scoped, and consistent with the task context.
- Do not make risky or product-changing fixes without explicit task context.
- After each safe fix, run: bash scripts/deploy.sh
- Rerun the army/test loop after deploy. Repeat until no high/medium issues remain, or until a clear time/budget cap/blocker is hit.
- Low-only findings can be reported without blocking PASS.
- If the task is explicitly read-only/audit-only, keep it read-only: do not edit, deploy, or fix.

Send it by running:
  curl -s -X POST "https://api.telegram.org/bot\$TELEGRAM_BOT_TOKEN/sendMessage" \
    --data-urlencode chat_id=\$TELEGRAM_ALLOWED_CHAT_ID \
    --data-urlencode "text=<formatted status message>"
Keep going until the task is fully done.
EOF

PROMPT="${WSYS}

TASK:
${TASK}"

nohup setsid "$ENGINE" exec \
  -m "$CODEX_MODEL" \
  --skip-git-repo-check \
  --ignore-user-config \
  --ignore-rules \
  --dangerously-bypass-approvals-and-sandbox \
  -C /home/ubuntu/yafoot \
  -o "$OUT" \
  --color never \
  "$PROMPT" \
  > "$LOG" 2>&1 < /dev/null &
echo "WORKER_STARTED id=${TS} pid=$! engine=${ENGINE} log=${LOG}"
