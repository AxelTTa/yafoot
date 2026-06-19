#!/usr/bin/env python3
"""YaFoot Telegram <-> claud MANAGER bridge (non-blocking, delegating).

- Main thread long-polls Telegram and NEVER blocks (so Axel can always talk).
- A single consumer thread runs MANAGER turns sequentially (safe session --resume).
- The manager DELEGATES heavy work to detached background workers (scripts/delegate.sh).
- Supports bidirectional images/files: Axel can send photos → Claude reads them;
  Claude responses containing image paths → bridge auto-sends the photos back.
Stdlib only."""
import os, json, time, queue, threading, subprocess, urllib.request, urllib.parse, urllib.error
import re, mimetypes, tempfile

TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
ALLOWED = str(os.environ["TELEGRAM_ALLOWED_CHAT_ID"]).strip()
CLAUD_BIN = os.environ.get("CLAUD_BIN", "claud")
WORKDIR = os.environ.get("WORKDIR", "/home/ubuntu/yafoot")
API = f"https://api.telegram.org/bot{TOKEN}"
FILE_API = f"https://api.telegram.org/file/bot{TOKEN}"
SESS_FILE = os.path.join(WORKDIR, "yafoot_sessions.json")

# Image paths in responses that the bridge will auto-send as Telegram photos
IMG_PATTERN = re.compile(
    r'(/tmp/yafoot[-\w/]*\.(?:png|jpg|jpeg|gif)'
    r'|/tmp/tg_upload_\w+\.(?:png|jpg|jpeg|gif)'
    r'|/tmp/yafoot-local/\S+\.(?:png|jpg|jpeg)'
    r'|/tmp/yafoot-sim/shots/\S+\.(?:png|jpg|jpeg))'
)

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

IMAGES: Axel may send you photos or files. When he does, the prompt will contain [IMAGE:/tmp/path.ext].
Use the Read tool to view the image — it supports PNG/JPG. Describe what you see and act on it.
When you reference screenshot paths (e.g. /tmp/yafoot-local/05-matches-tab.png), the bridge
automatically sends them as photos to Axel — no special markup needed, just mention the path.

STYLE: phone-first. Short lines. Lead with the answer. Act then report. Never ask permission for routine ops."""


# ── Telegram API helpers ────────────────────────────────────────────────────────

def api(method, **params):
    data = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None}).encode()
    try:
        with urllib.request.urlopen(
            urllib.request.Request(f"{API}/{method}", data=data), timeout=70
        ) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}


def send_msg(chat_id, text):
    for i in range(0, max(len(text), 1), 3800):
        api("sendMessage", chat_id=chat_id, text=text[i:i+3800] or "(empty)")


def download_telegram_file(file_id):
    """Download a Telegram file by file_id → /tmp/tg_upload_<id>.<ext>. Returns local path or None."""
    r = api("getFile", file_id=file_id)
    if not r.get("ok"):
        return None
    remote_path = r["result"]["file_path"]
    ext = os.path.splitext(remote_path)[1] or ".jpg"
    local_path = f"/tmp/tg_upload_{file_id[:16]}{ext}"
    url = f"{FILE_API}/{remote_path}"
    try:
        urllib.request.urlretrieve(url, local_path)
        return local_path
    except Exception as e:
        print(f"download_telegram_file error: {e}", flush=True)
        return None


def send_photo(chat_id, photo_path, caption=""):
    """Send a local image file to a Telegram chat via multipart/form-data."""
    if not os.path.exists(photo_path):
        return {"ok": False, "error": "file not found"}
    boundary = "YaFootBoundary987654321"
    mime_type = mimetypes.guess_type(photo_path)[0] or "image/png"
    filename = os.path.basename(photo_path)
    try:
        with open(photo_path, "rb") as f:
            file_data = f.read()
    except Exception as e:
        return {"ok": False, "error": str(e)}

    def field(name, value):
        return (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{name}"\r\n\r\n'
            f"{value}\r\n"
        ).encode()

    body = (
        field("chat_id", str(chat_id))
        + (field("caption", caption[:1024]) if caption else b"")
        + (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="photo"; filename="{filename}"\r\n'
            f"Content-Type: {mime_type}\r\n\r\n"
        ).encode()
        + file_data
        + f"\r\n--{boundary}--\r\n".encode()
    )
    req = urllib.request.Request(
        f"{API}/sendPhoto",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}


def send_document(chat_id, file_path, caption=""):
    """Send any file as a Telegram document."""
    if not os.path.exists(file_path):
        return {"ok": False, "error": "file not found"}
    boundary = "YaFootDocBoundary123456"
    mime_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"
    filename = os.path.basename(file_path)
    try:
        with open(file_path, "rb") as f:
            file_data = f.read()
    except Exception as e:
        return {"ok": False, "error": str(e)}

    def field(name, value):
        return (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{name}"\r\n\r\n'
            f"{value}\r\n"
        ).encode()

    body = (
        field("chat_id", str(chat_id))
        + (field("caption", caption[:1024]) if caption else b"")
        + (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="document"; filename="{filename}"\r\n'
            f"Content-Type: {mime_type}\r\n\r\n"
        ).encode()
        + file_data
        + f"\r\n--{boundary}--\r\n".encode()
    )
    req = urllib.request.Request(
        f"{API}/sendDocument",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}


def extract_and_send_images(chat_id, response_text):
    """Scan manager response for image paths and send each as a Telegram photo."""
    sent = set()
    for m in IMG_PATTERN.finditer(response_text):
        path = m.group(0)
        if path not in sent and os.path.exists(path):
            print(f"  auto-sending image: {path}", flush=True)
            send_photo(chat_id, path, caption=os.path.basename(path))
            sent.add(path)
    return sent


# ── Session management ──────────────────────────────────────────────────────────

_lock = threading.Lock()


def load_sessions():
    try:
        return json.load(open(SESS_FILE))
    except Exception:
        return {}


def save_sessions(s):
    with _lock:
        json.dump(s, open(SESS_FILE, "w"))


# ── Manager invocation ──────────────────────────────────────────────────────────

def run_manager(text, chat_id):
    sessions = load_sessions()
    sid = sessions.get(str(chat_id))
    cmd = [
        CLAUD_BIN, "-p", text,
        "--append-system-prompt", MANAGER_SYS,
        "--permission-mode", "bypassPermissions",
        "--allowedTools", "Bash", "Read",
        "--output-format", "json",
        "--max-turns", "24",
    ]
    if sid:
        cmd += ["--resume", sid]
    proc = subprocess.run(
        cmd, cwd=WORKDIR, capture_output=True, text=True,
        env=dict(os.environ), start_new_session=True,
    )
    if proc.returncode != 0:
        return f"(manager error)\n{(proc.stderr or '')[-500:]}"
    try:
        envj = json.loads(proc.stdout)
        if envj.get("session_id"):
            sessions[str(chat_id)] = envj["session_id"]
            save_sessions(sessions)
        return envj.get("result", "(no result)")
    except Exception:
        return (proc.stdout or "(no output)")[-1500:]


# ── Consumer thread ─────────────────────────────────────────────────────────────

WORK_Q: "queue.Queue" = queue.Queue()


def consumer():
    while True:
        chat_id, text = WORK_Q.get()
        try:
            api("sendChatAction", chat_id=chat_id, action="typing")
            response = run_manager(text, chat_id)
            # Auto-send any image paths mentioned in the response
            extract_and_send_images(chat_id, response)
            send_msg(chat_id, response)
        except Exception as e:
            send_msg(chat_id, f"(error: {e})")
        finally:
            WORK_Q.task_done()


# ── Worker status helper ────────────────────────────────────────────────────────

def list_workers():
    d = os.path.join(WORKDIR, "workers")
    try:
        logs = sorted(os.listdir(d), reverse=True)[:8]
    except Exception:
        return "No workers yet."
    out = []
    for f in logs:
        try:
            last = subprocess.run(
                ["tail", "-n", "1", os.path.join(d, f)],
                capture_output=True, text=True, timeout=5,
            ).stdout.strip()
        except Exception:
            last = ""
        out.append(f"• {f[:-4]}: {last[:90]}")
    return "Recent workers:\n" + "\n".join(out)


# ── Main loop ───────────────────────────────────────────────────────────────────

def main():
    threading.Thread(target=consumer, daemon=True).start()
    offset = None
    r = api("getUpdates", timeout=0)
    if r.get("ok") and r["result"]:
        offset = r["result"][-1]["update_id"] + 1
    print("yafoot manager-bridge up (non-blocking, image support), polling...", flush=True)

    while True:
        r = api("getUpdates", timeout=50, offset=offset)
        if not r.get("ok"):
            time.sleep(3)
            continue

        for upd in r.get("result", []):
            offset = upd["update_id"] + 1
            msg = upd.get("message") or upd.get("edited_message")
            if not msg:
                continue

            chat_id = msg["chat"]["id"]
            if str(chat_id) != ALLOWED:
                api("sendMessage", chat_id=chat_id, text="Not authorized.")
                continue

            # ── Special commands (handled immediately, no queue) ──
            text_raw = (msg.get("text") or msg.get("caption") or "").strip()

            if text_raw in ("/start", "/help"):
                send_msg(chat_id,
                    "YaFoot manager I delegate work to background workers and stay free to chat.\n"
                    "Talk to me anytime — even while builds run.\n\n"
                    "/workers — see what's running\n"
                    "/new — fresh conversation thread\n"
                    "/show <path> — send a file/screenshot to you\n\n"
                    "You can also send me photos or files and I'll read them.\n\n"
                    "Live: https://dist-five-zeta-92i4a6g3xx.vercel.app"
                )
                continue

            if text_raw == "/new":
                s = load_sessions()
                s.pop(str(chat_id), None)
                save_sessions(s)
                send_msg(chat_id, "Fresh thread.")
                continue

            if text_raw == "/workers":
                send_msg(chat_id, list_workers())
                continue

            if text_raw.startswith("/show "):
                path = text_raw[6:].strip()
                if os.path.exists(path):
                    ext = os.path.splitext(path)[1].lower()
                    if ext in (".png", ".jpg", ".jpeg", ".gif"):
                        result = send_photo(chat_id, path, caption=os.path.basename(path))
                    else:
                        result = send_document(chat_id, path, caption=os.path.basename(path))
                    if not result.get("ok"):
                        send_msg(chat_id, f"Could not send file: {result.get('error', 'unknown')}")
                else:
                    send_msg(chat_id, f"File not found: {path}")
                continue

            # ── Handle incoming photos ──
            local_image_path = None

            if "photo" in msg:
                # Telegram sends multiple sizes; take the largest
                file_id = msg["photo"][-1]["file_id"]
                local_image_path = download_telegram_file(file_id)
                if local_image_path:
                    print(f"  received photo → {local_image_path}", flush=True)
                else:
                    send_msg(chat_id, "(Could not download your photo — try again.)")
                    continue

            elif "document" in msg:
                doc = msg["document"]
                mime = doc.get("mime_type", "")
                # Accept images and common file types
                if mime.startswith("image/") or mime in (
                    "application/pdf", "text/plain", "application/json",
                ):
                    local_image_path = download_telegram_file(doc["file_id"])
                    if local_image_path:
                        print(f"  received document → {local_image_path}", flush=True)

            # Build the prompt for the manager
            if local_image_path:
                prompt = f"[IMAGE:{local_image_path}]"
                if text_raw:
                    prompt += f"\n{text_raw}"
                else:
                    prompt += "\n(user sent an image — use the Read tool to view it and respond)"
            elif text_raw:
                prompt = text_raw
            else:
                # Nothing useful (sticker, voice note, etc.)
                continue

            WORK_Q.put((chat_id, prompt))


if __name__ == "__main__":
    main()
