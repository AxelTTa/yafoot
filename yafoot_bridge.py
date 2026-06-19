#!/usr/bin/env python3
"""YaFoot Telegram <-> claud MANAGER bridge (non-blocking, delegating).

- Main thread long-polls Telegram and NEVER blocks (so Axel can always talk).
- A single consumer thread runs MANAGER turns sequentially (safe session --resume).
- The manager DELEGATES heavy work to detached background workers (scripts/delegate.sh) that
  self-report to Telegram, so the bot stays free while builds/tests/deploys run.
Stdlib only."""
import os, json, time, queue, threading, subprocess, urllib.request, urllib.parse, urllib.error

TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
ALLOWED = str(os.environ["TELEGRAM_ALLOWED_CHAT_ID"]).strip()
CLAUD_BIN = os.environ.get("CLAUD_BIN", "claud")
WORKDIR = os.environ.get("WORKDIR", "/home/ubuntu/yafoot")
API = f"https://api.telegram.org/bot{TOKEN}"
SESS_FILE = os.path.join(WORKDIR, "yafoot_sessions.json")
MGR_TIMEOUT = int(os.environ.get("MANAGER_TIMEOUT", "220"))

MANAGER_SYS = """You are the YaFoot MANAGER bot (headless, on axel-pipeline). Axel talks to you from his phone.
Project root: /home/ubuntu/yafoot. Live web: https://dist-five-zeta-92i4a6g3xx.vercel.app

YOUR JOB: be a fast, always-available manager. You DELEGATE the actual work and stay free to chat.
You do NOT run builds, edits, tests, deploys, npm install, or long scripts yourself.

HOW TO DELEGATE (do this for anything beyond a quick answer — code changes, builds, deploys, tests,
data syncs, audits, multi-step work):
  Run exactly:  bash scripts/delegate.sh "<full, self-contained task with all context the worker needs>"
  It returns `WORKER_STARTED id=... pid=... log=...`, runs DETACHED in the background, ships changes via
  scripts/deploy.sh, and SELF-REPORTS to this Telegram chat when done. Reply to Axel immediately with what
  you delegated + the worker id. NEVER wait for the worker.

WRITE GOOD TASKS: workers read CLAUDE.md for context, but be specific — what to build/fix, acceptance,
and that they must ship via scripts/deploy.sh. One task per worker; spin up several for parallel work.

QUICK ANSWERS (do directly, keep under ~15s, read-only): status, what's live, explain the app, recent
git log, `ls -t workers/ | head`, `tail -n 25 workers/<id>.log`, `systemctl is-active yafoot-bridge`.

STYLE: phone-first. Short lines. Lead with the answer. Act then report. Never ask permission for routine ops."""

def api(method, **params):
    data = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None}).encode()
    try:
        with urllib.request.urlopen(urllib.request.Request(f"{API}/{method}", data=data), timeout=70) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}

def send_msg(chat_id, text):
    for i in range(0, len(text) or 1, 3800):
        api("sendMessage", chat_id=chat_id, text=text[i:i+3800] or "(empty)")

_lock = threading.Lock()
def load_sessions():
    try: return json.load(open(SESS_FILE))
    except Exception: return {}
def save_sessions(s):
    with _lock: json.dump(s, open(SESS_FILE, "w"))

def run_manager(text, chat_id):
    sessions = load_sessions(); sid = sessions.get(str(chat_id))
    cmd = [CLAUD_BIN, "-p", text, "--append-system-prompt", MANAGER_SYS,
           "--permission-mode", "bypassPermissions",
           "--allowedTools", "Bash", "Read",
           "--output-format", "json", "--max-turns", "24"]
    if sid: cmd += ["--resume", sid]
    try:
        proc = subprocess.run(cmd, cwd=WORKDIR, capture_output=True, text=True,
                              timeout=MGR_TIMEOUT, env=dict(os.environ), start_new_session=True)
    except subprocess.TimeoutExpired:
        return "(I took too long — that smells like real work; tell me to delegate it and I'll fire a worker.)"
    if proc.returncode != 0:
        return f"(manager error)\n{(proc.stderr or '')[-500:]}"
    try:
        envj = json.loads(proc.stdout)
        if envj.get("session_id"):
            sessions[str(chat_id)] = envj["session_id"]; save_sessions(sessions)
        return envj.get("result", "(no result)")
    except Exception:
        return (proc.stdout or "(no output)")[-1500:]

WORK_Q: "queue.Queue" = queue.Queue()
def consumer():
    while True:
        chat_id, text = WORK_Q.get()
        try:
            api("sendChatAction", chat_id=chat_id, action="typing")
            send_msg(chat_id, run_manager(text, chat_id))
        except Exception as e:
            send_msg(chat_id, f"(error: {e})")
        finally:
            WORK_Q.task_done()

def list_workers():
    d = os.path.join(WORKDIR, "workers")
    try:
        logs = sorted(os.listdir(d), reverse=True)[:8]
    except Exception:
        return "No workers yet."
    out = []
    for f in logs:
        try:
            last = subprocess.run(["tail", "-n", "1", os.path.join(d, f)], capture_output=True, text=True, timeout=5).stdout.strip()
        except Exception:
            last = ""
        out.append(f"• {f[:-4]}: {last[:90]}")
    return "Recent workers:\n" + "\n".join(out)

def main():
    threading.Thread(target=consumer, daemon=True).start()
    offset = None
    r = api("getUpdates", timeout=0)
    if r.get("ok") and r["result"]: offset = r["result"][-1]["update_id"] + 1
    print("yafoot manager-bridge up (non-blocking), polling...", flush=True)
    while True:
        r = api("getUpdates", timeout=50, offset=offset)
        if not r.get("ok"): time.sleep(3); continue
        for upd in r.get("result", []):
            offset = upd["update_id"] + 1
            msg = upd.get("message") or upd.get("edited_message")
            if not msg or "text" not in msg: continue
            chat_id = msg["chat"]["id"]
            if str(chat_id) != ALLOWED:
                api("sendMessage", chat_id=chat_id, text="Not authorized."); continue
            text = msg["text"].strip()
            if text in ("/start", "/help"):
                send_msg(chat_id, "YaFoot manager ⚽ I delegate work to background workers and stay free to chat.\nTalk to me anytime — even while builds run.\n/workers = see what's running\n/new = fresh thread\nLive: https://dist-five-zeta-92i4a6g3xx.vercel.app"); continue
            if text == "/new":
                s = load_sessions(); s.pop(str(chat_id), None); save_sessions(s)
                send_msg(chat_id, "Fresh thread."); continue
            if text == "/workers":
                send_msg(chat_id, list_workers()); continue
            WORK_Q.put((chat_id, text))  # enqueue; never blocks receiving

if __name__ == "__main__":
    main()
