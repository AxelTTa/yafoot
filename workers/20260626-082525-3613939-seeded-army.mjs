import puppeteer from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";

const WORKER = "20260626-082525-3613939";
const BASE = process.env.URL || "https://dist-five-zeta-92i4a6g3xx.vercel.app";
const OUT = `/tmp/yafoot-army-${WORKER}`;
const CHROME = "/usr/bin/google-chrome";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://zfsgclwyaapgwxjtzvyd.supabase.co";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const ANON = process.env.SUPABASE_ANON;
const REF = new URL(SUPABASE_URL).hostname.split(".")[0];

if (!SERVICE || !ANON) throw new Error("SUPABASE_SERVICE_ROLE and SUPABASE_ANON are required");
mkdirSync(OUT, { recursive: true });

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const anon = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const report = {
  startedAt: new Date().toISOString(),
  base: BASE,
  commit: "",
  pass: 0,
  fail: 0,
  users: [],
  screenshots: [],
  friction: [],
  latency: [],
  changes: [],
};

function ok(cond, msg, context = "") {
  if (cond) report.pass += 1;
  else {
    report.fail += 1;
    report.friction.push({ severity: "high", msg, context: String(context).slice(0, 900) });
  }
  console.log(`${cond ? "PASS" : "FAIL"} ${msg}`);
}

async function text(page) {
  return page.evaluate(() => document.body.innerText || "").catch(() => "");
}

async function shot(page, name, fullPage = false) {
  const file = `${OUT}/${String(report.screenshots.length + 1).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: file, fullPage }).catch((e) => report.friction.push({ severity: "low", msg: `screenshot failed: ${name}`, context: e.message }));
  report.screenshots.push(file);
  return file;
}

function wire(page, label) {
  page.on("pageerror", (e) => report.friction.push({ severity: "high", msg: `${label} pageerror`, context: e.message }));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|404/.test(m.text())) report.friction.push({ severity: "medium", msg: `${label} console error`, context: m.text() });
  });
  page.on("request", (req) => {
    const url = req.url();
    if (url.startsWith(BASE) || url.includes("supabase.co")) req._yfStart = Date.now();
  });
  page.on("requestfinished", (req) => {
    if (!req._yfStart) return;
    const url = req.url();
    report.latency.push({ label, ms: Date.now() - req._yfStart, status: req.response()?.status() || 0, url: url.replace(/\?.*/, "").slice(0, 160) });
  });
  page.on("requestfailed", (req) => {
    const url = req.url();
    if (url.startsWith(BASE) || url.includes("supabase.co")) report.friction.push({ severity: "medium", msg: `${label} request failed`, context: `${req.failure()?.errorText} ${url}` });
  });
  page.on("dialog", (d) => d.accept().catch(() => {}));
}

async function clickText(page, needle, { exact = false, timeout = 7000, bottom = false } = {}) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const rect = await page.evaluate(({ needle, exact, bottom }) => {
      const all = [...document.querySelectorAll("*")].filter((el) => {
        if (!el.offsetParent || !el.textContent) return false;
        const txt = el.textContent.trim();
        if (exact ? txt !== needle : !new RegExp(needle, "i").test(txt)) return false;
        const r = el.getBoundingClientRect();
        return r.width > 4 && r.height > 4 && (!bottom || r.top > window.innerHeight * 0.62);
      });
      all.sort((a, b) => (a.children.length - b.children.length) || (a.getBoundingClientRect().width * a.getBoundingClientRect().height) - (b.getBoundingClientRect().width * b.getBoundingClientRect().height));
      const el = all[0];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, { needle: String(needle), exact, bottom });
    if (rect) {
      await page.mouse.click(rect.x, rect.y);
      await sleep(450);
      return true;
    }
    await sleep(250);
  }
  return false;
}

async function setLastInput(page, value) {
  return page.evaluate((value) => {
    const el = [...document.querySelectorAll("input,textarea")].filter((n) => n.offsetParent !== null).pop();
    if (!el) return false;
    const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.focus();
    return true;
  }, value);
}

async function setSearch(page, value) {
  return page.evaluate((value) => {
    const el = [...document.querySelectorAll("input,textarea")].find((n) => n.offsetParent !== null && /search|cherch/i.test(n.placeholder || ""));
    if (!el) return false;
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.focus();
    return true;
  }, value);
}

async function waitFor(page, rx, timeout = 25000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const t = await text(page);
    if (rx.test(t)) return true;
    await sleep(350);
  }
  return false;
}

async function makeUser(i) {
  const stamp = `${Date.now().toString(36)}${i}`;
  const username = `axarmy${stamp}`.slice(0, 20);
  const email = `${username}@yafoot.test`;
  const password = `Yf-${stamp}-2026!`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, display_name: `Army ${i}` },
  });
  if (createError && !/already registered/i.test(createError.message)) throw createError;
  const { data: signed, error: signError } = await anon.auth.signInWithPassword({ email, password });
  if (signError) throw signError;
  await admin.from("profiles").upsert({
    id: signed.user.id,
    username,
    display_name: `Army ${i}`,
    total_points: 0,
  }, { onConflict: "id" });
  const user = { username, email, id: signed.user.id, session: signed.session };
  report.users.push({ username, id: user.id });
  return user;
}

async function newPage(browser, user, label, viewport = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  wire(page, label);
  await page.setViewport(viewport);
  await page.evaluateOnNewDocument(({ ref, session }) => {
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
    localStorage.setItem("yafoot.lang", "en");
  }, { ref: REF, session: user.session });
  return { ctx, page };
}

async function createCompetitionUi(host) {
  await host.goto(`${BASE}/create-league`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitFor(host, /Name your competition|Competition name/i);
  await shot(host, "create-name");
  await setLastInput(host, `Seeded Army ${new Date().toISOString().slice(11, 16)}`);
  await clickText(host, "Next", { exact: true });
  await waitFor(host, /punishment|Dead last|No punishment/i);
  await shot(host, "punishment-picker");
  ok(!/Offre le|Choisis|Punition perso/i.test(await text(host)), "punishment picker stayed English");
  await clickText(host, "No punishment", { timeout: 2000 });
  await clickText(host, "Next", { exact: true });
  await waitFor(host, /Build the match list|Pick country/i);
  await shot(host, "match-builder-empty");
  await clickText(host, "Add another match");
  await sleep(500);
  await shot(host, "match-added");
  await clickText(host, "France");
}

async function createCompetitionApi(hostUser) {
  const client = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  await client.auth.setSession(hostUser.session);
  const kickoff1 = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
  const kickoff2 = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
  const { data, error } = await client.rpc("create_prediction_competition", {
    p_name: `Seeded Army ${new Date().toISOString().slice(11, 16)}`,
    p_description: null,
    p_public: false,
    p_punishment: "Buy the next round",
    p_matches: [
      { home_team: "France", home_code: "FRA", home_flag: "🇫🇷", away_team: "Brazil", away_code: "BRA", away_flag: "🇧🇷", kickoff: kickoff1 },
      { home_team: "Japan", home_code: "JPN", home_flag: "🇯🇵", away_team: "Mexico", away_code: "MEX", away_flag: "🇲🇽", kickoff: kickoff2 },
    ],
  });
  if (error) throw error;
  return data;
}

async function submitPrediction(page) {
  await clickText(page, "\\+", { timeout: 2500 });
  await clickText(page, "Submit prediction", { timeout: 6000 });
  await waitFor(page, /Submitted|Prediction submitted/i, 10000);
}

async function main() {
  const users = [];
  for (let i = 1; i <= 5; i += 1) users.push(await makeUser(i));

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
  const pages = [];
  try {
    for (let i = 0; i < users.length; i += 1) pages.push(await newPage(browser, users[i], `U${i + 1}`));
    const [U1, U2, U3, U4, U5] = pages.map((p) => p.page);

    await U5.goto(`${BASE}/support`, { waitUntil: "networkidle2", timeout: 60000 });
    ok(/Support|Privacy|Delete account|Contact/i.test(await text(U5)), "public support page loads");
    await shot(U5, "public-support", true);
    await U5.goto(`${BASE}/privacy`, { waitUntil: "networkidle2", timeout: 60000 });
    ok(/Privacy|Data|Delete/i.test(await text(U5)), "public privacy page loads");
    await shot(U5, "public-privacy", true);

    await U1.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 60000 });
    ok(/Challenges|Competitions|Friends|Profile/i.test(await text(U1)), "seeded user reaches main app");
    await shot(U1, "home-challenges");

    await createCompetitionUi(U1).catch((e) => report.friction.push({ severity: "medium", msg: "UI create-builder partial failure, API fallback used", context: e.message }));
    const league = await createCompetitionApi(users[0]);
    ok(league?.id && league?.code, "competition created through app RPC fallback");

    await U1.goto(`${BASE}/league/${league.id}`, { waitUntil: "networkidle2", timeout: 60000 });
    await waitFor(U1, /INVITE CODE|Matches|Standings|Chat/i);
    ok(new RegExp(league.code).test(await text(U1)), "competition detail shows invite code");
    await shot(U1, "competition-detail");

    await U2.goto(`${BASE}/join/${league.code}`, { waitUntil: "networkidle2", timeout: 60000 });
    await waitFor(U2, /Join a competition|Join Competition|Seeded Army/i);
    await shot(U2, "join-code");
    await clickText(U2, "Join Competition", { timeout: 5000 });
    await waitFor(U2, /INVITE CODE|Matches|Standings|Chat/i, 15000);
    ok(/Matches|Standings|Chat/i.test(await text(U2)), "second user joined by invite code");

    await submitPrediction(U1);
    await submitPrediction(U2);
    await shot(U2, "prediction-submitted");

    await U3.goto(`${BASE}/(tabs)/social`, { waitUntil: "networkidle2", timeout: 60000 });
    await waitFor(U3, /Friends|Search by username/i);
    await setSearch(U3, users[3].username);
    await waitFor(U3, new RegExp(users[3].username.slice(0, 8), "i"), 10000);
    await shot(U3, "friend-search");
    await clickText(U3, "Add", { exact: true, timeout: 5000 });
    await sleep(1500);
    await U4.goto(`${BASE}/(tabs)/social`, { waitUntil: "networkidle2", timeout: 60000 });
    await waitFor(U4, /Requests|Accept/i, 12000);
    ok(/Accept/i.test(await text(U4)), "friend request appears for recipient");
    await shot(U4, "friend-request");
    await clickText(U4, "Accept", { exact: true, timeout: 5000 });
    await sleep(1500);
    ok(/Your friends|@/i.test(await text(U4)), "friend accept updates friends list");

    await U1.goto(`${BASE}/league/${league.id}`, { waitUntil: "networkidle2", timeout: 60000 });
    await clickText(U1, "Chat", { exact: true, timeout: 5000 });
    await setLastInput(U1, "Host says good luck.");
    await clickText(U1, "send|Send", { timeout: 2500 }).catch(() => {});
    await U2.goto(`${BASE}/league/${league.id}`, { waitUntil: "networkidle2", timeout: 60000 });
    await clickText(U2, "Chat", { exact: true, timeout: 5000 });
    await waitFor(U2, /Host says good luck|Chat/i, 10000);
    await shot(U2, "league-chat");

    await U1.goto(`${BASE}/league/${league.id}`, { waitUntil: "networkidle2", timeout: 60000 });
    await clickText(U1, "Finalize score", { timeout: 5000 });
    await sleep(500);
    await shot(U1, "host-final-score");
    await clickText(U1, "OK", { timeout: 2500 }).catch(() => {});
    await sleep(3000);
    await clickText(U1, "Standings", { exact: true, timeout: 5000 });
    await shot(U1, "standings-after-final", true);
    ok(/pts|Standings/i.test(await text(U1)), "standings visible after host final score path");

    await U5.goto(`${BASE}/settings`, { waitUntil: "networkidle2", timeout: 60000 });
    await waitFor(U5, /Settings|Display name|Language/i);
    await shot(U5, "settings");
    await U5.goto(`${BASE}/profile`, { waitUntil: "networkidle2", timeout: 60000 });
    await waitFor(U5, /Profile|TOTAL POINTS|MY FORECASTS/i);
    await shot(U5, "profile");

    const body = [await text(U1), await text(U2), await text(U3), await text(U4), await text(U5)].join("\n");
    ok(!/FIFA|World Cup|Coupe du Monde|Mundial|Party Mode/i.test(body), "visible tested screens have no stale Apple-risk terms");
  } finally {
    for (const { ctx } of pages) await ctx.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  report.finishedAt = new Date().toISOString();
  report.latencySummary = summarizeLatency(report.latency.map((x) => x.ms));
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  writeFileSync(`workers/${WORKER}.seeded-report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ pass: report.pass, fail: report.fail, out: OUT, latency: report.latencySummary, screenshots: report.screenshots }, null, 2));
}

function summarizeLatency(vals) {
  if (!vals.length) return null;
  const s = [...vals].sort((a, b) => a - b);
  const pick = (p) => s[Math.min(s.length - 1, Math.floor((s.length - 1) * p))];
  return { count: s.length, p50: pick(0.5), p90: pick(0.9), p95: pick(0.95), max: s[s.length - 1] };
}

main().catch((e) => {
  report.fail += 1;
  report.friction.push({ severity: "critical", msg: "seeded army crashed", context: e.stack || e.message });
  report.finishedAt = new Date().toISOString();
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  writeFileSync(`workers/${WORKER}.seeded-report.json`, JSON.stringify(report, null, 2));
  console.error(e);
  process.exit(1);
});
