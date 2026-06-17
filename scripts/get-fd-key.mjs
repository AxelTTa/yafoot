// Registers a free football-data.org API key using a disposable mail.tm inbox,
// then polls for the token email and prints the key.
import { randomBytes } from "node:crypto";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/146 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = randomBytes(5).toString("hex");

async function j(url, opts) {
  const r = await fetch(url, opts);
  const t = await r.text();
  try { return { status: r.status, body: JSON.parse(t) }; } catch { return { status: r.status, body: t }; }
}

(async () => {
  // 1. temp inbox
  const dom = (await j("https://api.mail.tm/domains")).body["hydra:member"][0].domain;
  const address = `yf${Date.now()}${rnd}@${dom}`;
  const password = "Abcd1234!" + rnd;
  let res = await j("https://api.mail.tm/accounts", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, password }),
  });
  console.error("inbox:", address, "create status", res.status);
  let jwt = null;
  for (let i = 0; i < 6 && !jwt; i++) {
    await sleep(2500);
    const tok = await j("https://api.mail.tm/token", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, password }),
    });
    jwt = tok.body.token;
  }
  if (!jwt) throw new Error("mail.tm token failed after retries");

  // 2. submit football-data registration form
  const form = new URLSearchParams({
    name: "Axel",
    email: address,
    codingLang: "JavaScript",
    acceptTerms: "on",
  });
  const reg = await fetch("https://www.football-data.org/client/register", {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded", Referer: "https://www.football-data.org/client/register" },
    body: form.toString(),
    redirect: "manual",
  });
  console.error("football-data register status:", reg.status);

  // 3. poll inbox for the token email
  const authH = { Authorization: `Bearer ${jwt}` };
  let apiKey = null;
  for (let i = 0; i < 75 && !apiKey; i++) {
    await sleep(5000);
    const msgs = await j("https://api.mail.tm/messages", { headers: authH });
    const list = msgs.body["hydra:member"] || [];
    if (i % 3 === 0) console.error(`poll ${i}: ${list.length} msgs`);
    for (const m of list) {
      const full = await j(`https://api.mail.tm/messages/${m.id}`, { headers: authH });
      const text = (full.body.text || "") + " " + (full.body.html || []).join(" ");
      // football-data tokens are 32-char hex
      const match = text.match(/\b[a-f0-9]{32}\b/);
      if (match) { apiKey = match[0]; break; }
    }
  }
  if (!apiKey) throw new Error("No token email received in time (inbox: " + address + ")");
  console.log(apiKey);
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
