#!/usr/bin/env python3
"""YaFoot Telegram <-> claud manager bridge.
Long-polls Telegram; each message runs claud -p in /home/ubuntu/yafoot with full project context
(see CLAUDE.md). Maintains a resumable session per chat. Stdlib only."""
import os, json, time, subprocess, urllib.request, urllib.parse, urllib.error

TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
ALLOWED = str(os.environ["TELEGRAM_ALLOWED_CHAT_ID"]).strip()
CLAUD_BIN = os.environ.get("CLAUD_BIN", "claud")
WORKDIR = os.environ.get("WORKDIR", "/home/ubuntu/yafoot")
API = f"https://api.telegram.org/bot{TOKEN}"
SESS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "yafoot_sessions.json")
AGENT_TIMEOUT = int(os.environ.get("AGENT_TIMEOUT", "600"))

YAFOOT_SYS = """You are the full-time MANAGER + ENGINEER for YaFoot, running headless on axel-pipeline.
Axel talks to you from his phone via Telegram. Project root: /home/ubuntu/yafoot.

FIRST: read /home/ubuntu/yafoot/CLAUDE.md — it has the COMPLETE context (stack, Supabase, data,
features, design system, deploy steps, gotchas). Always act on the live repo.

YaFoot = prediction-first World Cup 2026 social app (MPP clone). Live: https://dist-five-zeta-92i4a6g3xx.vercel.app
Stack: Expo SDK54 + expo-router + Supabase (project ref zfsgclwyaapgwxjtzvyd) + Vercel + football-data.org.

YOUR SECRETS are already in your environment (from yafoot.env): SUPABASE_URL, SUPABASE_SERVICE_ROLE,
SUPABASE_PAT, SUPABASE_ANON, VERCEL_TOKEN, FD_API_KEY. Use them for sync/deploy/migrations.

YOU CAN: edit code, run `npm install`, `npx tsc --noEmit`, build (`npx expo export --platform web`),
deploy to Vercel (see CLAUDE.md deploy block — remember to copy dist/fonts/ionicons.ttf), run the SQL
migrations via the Supabase Management API (PAT + browser User-Agent), run scripts/ tests
(puppeteer-core + /usr/bin/google-chrome; e2e needs the ws polyfill), git commit + push.

WORKFLOW: pull latest (`git pull`) before big work. After changes: typecheck, build, deploy, then
`git add -A && git commit && git push`. Verify with a screenshot test when UI changes.

STYLE: phone-first. Short lines. Lead with the answer. Act then report. Don't ask permission for
routine ops. If a task is large, spin up parallel work but report a crisp summary."""

def api(method, **params):
    data = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None}).encode()
    try:
        with urllib.request.urlopen(urllib.request.Request(f"{API}/{method}", data=data), timeout=70) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"ok": False, "error": e.read().decode()[:300]}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def send_msg(chat_id, text):
    for i in range(0, len(text) or 1, 3800):
        api("sendMessage", chat_id=chat_id, text=text[i:i+3800] or "(empty)")

def load_sessions():
    try: return json.load(open(SESS_FILE))
    except Exception: return {}

def save_sessions(s): json.dump(s, open(SESS_FILE, "w"))

def run_agent(text, chat_id):
    sessions = load_sessions(); sid = sessions.get(str(chat_id))
    cmd = [CLAUD_BIN, "-p", text, "--append-system-prompt", YAFOOT_SYS,
           "--permission-mode", "bypassPermissions",
           "--allowedTools", "Bash", "Read", "Write", "Edit",
           "--output-format", "json", "--max-turns", "60"]
    if sid: cmd += ["--resume", sid]
    try:
        proc = subprocess.run(cmd, cwd=WORKDIR, capture_output=True, text=True,
                              timeout=AGENT_TIMEOUT, env=dict(os.environ), start_new_session=True)
    except subprocess.TimeoutExpired:
        return f"(agent still working; timed out reporting after {AGENT_TIMEOUT}s — it may have continued)"
    if proc.returncode != 0:
        return f"(agent error)\n{(proc.stderr or '')[-700:]}"
    try:
        envj = json.loads(proc.stdout)
        if envj.get("session_id"):
            sessions[str(chat_id)] = envj["session_id"]; save_sessions(sessions)
        return envj.get("result", "(no result)")
    except Exception:
        return (proc.stdout or "(no output)")[-1500:]

def main():
    offset = None
    r = api("getUpdates", timeout=0)
    if r.get("ok") and r["result"]: offset = r["result"][-1]["update_id"] + 1
    print("yafoot-bridge up, polling...", flush=True)
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
                send_msg(chat_id, "YaFoot manager online ⚽ I build/test/deploy YaFoot and answer anything about it.\nLive app: https://dist-five-zeta-92i4a6g3xx.vercel.app\n/new resets the thread."); continue
            if text == "/new":
                s = load_sessions(); s.pop(str(chat_id), None); save_sessions(s)
                send_msg(chat_id, "Fresh thread."); continue
            api("sendChatAction", chat_id=chat_id, action="typing")
            send_msg(chat_id, run_agent(text, chat_id))

if __name__ == "__main__":
    main()
