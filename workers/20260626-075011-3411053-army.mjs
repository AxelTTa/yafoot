import puppeteer from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";

const WORKER = "20260626-075011-3411053";
const BASE = process.env.URL || "https://dist-five-zeta-92i4a6g3xx.vercel.app";
const CHROME = process.env.CHROME || "/usr/bin/google-chrome";
const OUT = `/tmp/yafoot-army-${WORKER}`;
const DURATION_MS = Number(process.env.DURATION_MS || 20 * 60 * 1000);
const CORE_ONLY = process.env.CORE_ONLY === "1";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://zfsgclwyaapgwxjtzvyd.supabase.co";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const sb = SERVICE_ROLE ? createClient(SUPABASE_URL, SERVICE_ROLE) : null;

mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const startedAt = Date.now();
const deadline = startedAt + DURATION_MS;
const events = [];
const friction = [];
const shots = [];
const latency = [];
const users = [];
let pass = 0;
let fail = 0;

function inMainApp(t) {
  return /Competitions/i.test(t) && /Friends/i.test(t) && /Profile/i.test(t);
}

function log(msg, data = {}) {
  const row = { t: new Date().toISOString(), msg, ...data };
  events.push(row);
  console.log(`[${row.t}] ${msg}`, Object.keys(data).length ? JSON.stringify(data) : "");
}

function ok(cond, msg, context = "") {
  if (cond) {
    pass += 1;
    log(`PASS ${msg}`);
  } else {
    fail += 1;
    const item = { severity: "high", msg, context: String(context).slice(0, 1000) };
    friction.push(item);
    log(`FAIL ${msg}`, { context: item.context });
  }
}

async function text(page) {
  return page.evaluate(() => document.body.innerText).catch(() => "");
}

async function shot(page, name, fullPage = false) {
  const file = `${OUT}/${String(shots.length + 1).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: file, fullPage }).catch((e) => friction.push({ severity: "low", msg: `Screenshot failed: ${name}`, context: e.message }));
  shots.push(file);
  log(`screenshot ${file}`);
  return file;
}

function wire(page, label) {
  page._errors = [];
  page._dialogs = [];
  page._rageClicks = [];
  page.on("dialog", async (d) => {
    page._dialogs.push(d.message());
    await d.accept().catch(() => {});
  });
  page.on("pageerror", (e) => {
    page._errors.push(e.message);
    const genericNetworkAbort = e.message === "NetworkError: A network error occurred.";
    friction.push({ severity: genericNetworkAbort ? "low" : "high", msg: `${label} pageerror`, context: e.message });
  });
  page.on("console", (m) => {
    if (m.type() === "error") {
      const txt = m.text();
      page._errors.push(txt);
      if (!/favicon|Failed to load resource.*404/i.test(txt)) friction.push({ severity: "medium", msg: `${label} console error`, context: txt });
    }
  });
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("supabase.co") || url.startsWith(BASE)) req._ts = Date.now();
  });
  page.on("requestfinished", async (req) => {
    if (!req._ts) return;
    const ms = Date.now() - req._ts;
    const url = req.url();
    if (url.includes("supabase.co/rest") || url.includes("supabase.co/auth") || url.includes("supabase.co/realtime") || url.startsWith(BASE)) {
      latency.push({ label, ms, status: req.response()?.status(), url: url.replace(/\?.*/, "").slice(0, 140) });
    }
  });
  page.on("requestfailed", (req) => {
    const url = req.url();
    if (url.includes("supabase.co") || url.startsWith(BASE)) friction.push({ severity: "medium", msg: `${label} request failed`, context: `${req.failure()?.errorText} ${url}` });
  });
}

async function clickText(page, needle, opts = {}) {
  const { exact = false, timeout = 7000, bottomNav = false } = opts;
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const rect = await page.evaluate(({ needle, exact, bottomNav }) => {
      const rx = exact ? null : new RegExp(needle, "i");
      const candidates = [...document.querySelectorAll("*")].filter((n) => {
        if (!n.textContent || n.offsetParent === null) return false;
        const txt = n.textContent.trim();
        if (!txt) return false;
        if (exact ? txt !== needle : !rx.test(txt)) return false;
        const r = n.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return false;
        if (bottomNav && r.top < window.innerHeight * 0.65) return false;
        return true;
      });
      candidates.sort((a, b) => {
        const leaf = (el) => el.children.length === 0 ? 0 : 1;
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return leaf(a) - leaf(b) || (ar.width * ar.height) - (br.width * br.height);
      });
      const el = candidates[0];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, txt: el.textContent.trim().slice(0, 80) };
    }, { needle: String(needle), exact, bottomNav });
    if (rect) {
      await page.mouse.click(rect.x, rect.y);
      log(`click ${rect.txt}`);
      return true;
    }
    await sleep(250);
  }
  return false;
}

async function clickVisibleIndex(page, regex, index = 0) {
  const rect = await page.evaluate(({ regex, index }) => {
    const rx = new RegExp(regex, "i");
    const nodes = [...document.querySelectorAll("*")].filter((n) => {
      if (!rx.test((n.textContent || "").trim())) return false;
      if (n.offsetParent === null) return false;
      const r = n.getBoundingClientRect();
      return r.width > 4 && r.height > 4;
    });
    nodes.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      const leaf = (el) => el.children.length === 0 ? 0 : 1;
      return leaf(a) - leaf(b) || ar.top - br.top || ar.left - br.left || (ar.width * ar.height) - (br.width * br.height);
    });
    const el = nodes[index];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, txt: el.textContent.trim().slice(0, 80) };
  }, { regex: regex.source ?? String(regex), index });
  if (!rect) return false;
  await page.mouse.click(rect.x, rect.y);
  log(`click-index ${rect.txt}`);
  return true;
}

async function clickAria(page, label, times = 1) {
  for (let i = 0; i < times; i += 1) {
    const clicked = await page.evaluate((x) => {
      const el = document.querySelector(`[aria-label="${x}"]`);
      if (!el) return false;
      el.click();
      return true;
    }, label);
    if (!clicked) throw new Error(`Could not click aria ${label}`);
    log(`click aria ${label}`);
    await sleep(120);
  }
}

async function setLastInput(page, value) {
  return page.evaluate((value) => {
    const el = [...document.querySelectorAll("input,textarea")].filter((i) => i.offsetParent !== null).pop();
    if (!el) return false;
    const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.focus();
    return true;
  }, value);
}

async function setInputByPlaceholder(page, ph, value) {
  return page.evaluate(({ ph, value }) => {
    const el = [...document.querySelectorAll("input,textarea")]
      .filter((i) => i.offsetParent !== null && (i.placeholder || "").toLowerCase().includes(ph.toLowerCase()))
      .pop();
    if (!el) return false;
    const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.focus();
    return true;
  }, { ph, value });
}

async function waitFor(page, rx, timeout = 25000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const t = await text(page);
    if (rx.test(t)) return true;
    await sleep(400);
  }
  return false;
}

async function goto(page, pathOrUrl, wait = "domcontentloaded") {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${BASE}${pathOrUrl}`;
  const t0 = Date.now();
  await page.goto(url, { waitUntil: wait, timeout: 90000 });
  latency.push({ label: "nav", ms: Date.now() - t0, status: 0, url });
  log(`goto ${url}`);
}

async function onboard(page, prefix) {
  let lastText = "";
  for (let attempt = 1; Date.now() < deadline - 30000; attempt += 1) {
    const username = `${prefix}${Date.now().toString(36).slice(-5)}${Math.floor(Math.random() * 90 + 10)}`.toLowerCase();
    await goto(page, "/");
    await waitFor(page, /Pick your language|Choisis ta langue|Let's go|Get started/i, 60000);
    let t = await text(page);
    if (/Pick your language|Choisis ta langue/i.test(t)) {
      await clickText(page, "English", { exact: true, timeout: 8000 });
      await clickText(page, "Let's play", { exact: true, timeout: 3000 }).catch(() => {});
      await sleep(1500);
    }
    await waitFor(page, /Let's go|Get started|YOUR NAME|name/i, 30000);
    const focused = await page.evaluate(() => {
      const inputs = [...document.querySelectorAll("input,textarea")].filter((i) => i.offsetParent !== null);
      const el = inputs[inputs.length - 1];
      if (!el) return false;
      el.focus();
      el.click();
      return true;
    });
    if (!focused) throw new Error("username input not found");
    await page.keyboard.down("Control");
    await page.keyboard.press("a");
    await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    await page.keyboard.type(username, { delay: 20 });
    await setLastInput(page, username);
    await sleep(300);
    await clickText(page, "Let's go!", { exact: true, timeout: 3000 }) || await clickText(page, "Get started", { exact: true, timeout: 3000 });
    await waitFor(page, /Continue to app|Competitions|Friends|Profile|rate limit|Request rate/i, 45000);
    t = await text(page);
    lastText = t;
    if (/Request rate limit|rate limit reached|429/i.test(t)) {
      friction.push({ severity: "high", msg: `${username} anonymous auth rate-limited`, context: `attempt ${attempt}` });
      log("auth rate limit; retrying", { username, attempt });
      await sleep(Math.min(90000, Math.max(10000, deadline - Date.now() - 30000)));
      continue;
    }
    if (/Continue to app/i.test(t)) {
      await clickText(page, "Continue to app", { exact: true, timeout: 8000 });
      await sleep(2500);
    }
    t = await text(page);
    ok(inMainApp(t), `${username} reached app`, t.slice(0, 500));
    if (!inMainApp(t)) {
      lastText = t;
      await sleep(5000);
      continue;
    }
    users.push(username);
    return username;
  }
  throw new Error(`Could not onboard ${prefix}; last screen: ${lastText.slice(0, 400)}`);
}

async function selectCountry(page, country, occurrence = 0) {
  const clicked = await clickVisibleIndex(page, /^Pick country$/, occurrence);
  if (!clicked) throw new Error(`could not open country picker ${occurrence}`);
  await sleep(800);
  await setInputByPlaceholder(page, "Search", country);
  await sleep(800);
  if (!(await clickText(page, country, { exact: false, timeout: 8000 }))) throw new Error(`could not select country ${country}`);
  await sleep(600);
}

async function createCompetition(host) {
  await goto(host, "/create-league");
  await waitFor(host, /Name your competition|competition name|Create/i, 30000);
  await shot(host, "host-create-step1");
  await setLastInput(host, `Army ${new Date().toISOString().slice(11, 16)}`);
  await clickText(host, "Next", { exact: true });
  await waitFor(host, /punishment|loser|Mild|Daring|Savage/i, 20000);
  const punText = await text(host);
  ok(/Mild|Daring|Savage|Buy|Voice|wallpaper|winner/i.test(punText), "English punishment catalog visible", punText.slice(0, 700));
  ok(!/Offre|verre|Punition|Chaud|Sauvage|potes|prochain but|Cul sec/i.test(punText), "No French punishment text in English UI", punText.slice(0, 1000));
  await shot(host, "host-punishments-english");
  await clickText(host, "Daring", { exact: true, timeout: 3000 }).catch(() => {});
  await sleep(500);
  await clickVisibleIndex(host, /phone|wallpaper|shot|winner|group|Buy|voice|screen/i, 0);
  await clickText(host, "Next", { exact: true });
  await waitFor(host, /Country A|Pick country|Start time|Add another/i, 25000);
  await shot(host, "host-match-builder-empty");
  await selectCountry(host, "France", 0);
  await selectCountry(host, "Brazil", 0);
  await shot(host, "host-match-builder-flags");
  ok(/🇫🇷|France/i.test(await text(host)) && /🇧🇷|Brazil/i.test(await text(host)), "Country-vs-country match shows flags/names");
  await clickText(host, "Create", { exact: false, timeout: 10000 });
  await waitFor(host, /INVITE CODE|Competition created|Compet created|View competition/i, 60000);
  await shot(host, "host-competition-created");
  const created = await text(host);
  const codeCandidates = created.match(/\b[A-Z0-9]{6,8}\b/g) ?? [];
  const code = codeCandidates.find((c) => !["INVITE", "CODE", "YAFOOT"].includes(c)) ?? null;
  ok(!!code, "Invite code extracted", created.slice(0, 500));
  let leagueId = null;
  const href = await host.evaluate(() => location.href).catch(() => "");
  const fromHref = href.match(/league\/(\d+)/)?.[1];
  if (fromHref) leagueId = Number(fromHref);
  if (!leagueId && sb && code) {
    const { data } = await sb.from("leagues").select("id").eq("code", code).single();
    leagueId = data?.id ?? null;
  }
  await clickText(host, "View competition", { exact: true, timeout: 5000 }).catch(async () => {
    await clickText(host, "Voir la compet", { exact: true, timeout: 1000 }).catch(() => {});
  });
  await waitFor(host, /Host result|Submit prediction|Invite code|Matches/i, 30000);
  await shot(host, "host-league-matches");
  if (!leagueId) {
    const href2 = await host.evaluate(() => location.href).catch(() => "");
    leagueId = Number(href2.match(/league\/(\d+)/)?.[1] || 0) || null;
  }
  return { code, leagueId };
}

async function joinCompetition(page, code, username) {
  await goto(page, `/join/${code}`);
  await waitFor(page, /Join|Enter|competition|code/i, 30000);
  await shot(page, `${username}-join-link`);
  await clickText(page, "Join", { exact: false, timeout: 12000 });
  await waitFor(page, /Submit prediction|Matches|Invite code|Host result|Standings/i, 45000);
  ok(/Submit prediction|Matches|Invite code|Standings/i.test(await text(page)), `${username} joined competition through invite link`);
}

async function makePrediction(page, username, homeClicks, awayClicks) {
  await waitFor(page, /Submit prediction|Prediction submitted|vs/i, 30000);
  for (let i = 0; i < homeClicks; i += 1) await clickVisibleIndex(page, /\+/, 0);
  for (let i = 0; i < awayClicks; i += 1) await clickVisibleIndex(page, /\+/, 1);
  await clickText(page, "Submit prediction", { exact: true, timeout: 10000 });
  await waitFor(page, /Submitted|Prediction submitted/i, 20000);
  ok(/Submitted|Prediction submitted/i.test(await text(page)), `${username} made clear prediction`);
  await shot(page, `${username}-prediction`);
}

async function addFriend(a, b, aName, bName) {
  await goto(a, "/social");
  await waitFor(a, /Friends|Search|Your friends/i, 30000);
  await setInputByPlaceholder(a, "Search", bName);
  await sleep(2500);
  await shot(a, "friend-search-results");
  await clickText(a, "Add", { exact: true, timeout: 12000 });
  await sleep(1500);
  await goto(b, "/social");
  await waitFor(b, /Requests|Accept|Friends/i, 30000);
  await shot(b, "friend-request-incoming");
  await clickText(b, "Accept", { exact: true, timeout: 12000 });
  await sleep(3000);
  await goto(a, "/social");
  await sleep(2000);
  ok(new RegExp(bName, "i").test(await text(a)), `${aName} sees ${bName} as friend`);
}

async function chatRound(host, guest, code, leagueId) {
  const leaguePath = leagueId ? `/league/${leagueId}` : `/join/${code}`;
  await goto(host, leaguePath);
  await waitFor(host, /Matches|Standings|Chat|Invite code/i, 30000);
  await clickText(host, "Chat", { exact: true, timeout: 8000 });
  await waitFor(host, /Message your competition|No messages/i, 15000);
  await setInputByPlaceholder(host, "Message", `Host says ready ${Date.now().toString(36)}`);
  await clickText(host, "Send", { exact: true, timeout: 5000 });
  await sleep(2500);
  await goto(guest, leaguePath);
  await waitFor(guest, /Matches|Standings|Chat|Invite code/i, 30000);
  await clickText(guest, "Chat", { exact: true, timeout: 8000 });
  await waitFor(guest, /Host says ready|Message your competition/i, 20000);
  ok(/Host says ready/i.test(await text(guest)), "Guest sees league chat message");
  await shot(guest, "guest-chat-realtime");
}

async function finalizeAndVerify(host, guest, leagueId) {
  await clickText(host, "Matches", { exact: true, timeout: 8000 });
  await waitFor(host, /Host result|Finalize score/i, 20000);
  await clickAria(host, "Increase home final score", 2);
  await clickAria(host, "Increase away final score", 1);
  await shot(host, "host-before-finalize");
  await clickText(host, "Finalize score", { exact: true, timeout: 10000 });
  await sleep(600);
  await clickText(host, "OK", { exact: true, timeout: 3000 }).catch(() => {});
  await waitFor(host, /FT|Pick|Final score set|previous|0 pts|1 pts|3 pts/i, 40000);
  await shot(host, "host-after-finalize");
  await clickText(host, "Standings", { exact: true, timeout: 10000 });
  await waitFor(host, /pts|you|@/i, 25000);
  await shot(host, "standings-after-score");
  const standingsText = await text(host);
  ok(/pts/i.test(standingsText), "Standings show points after final score", standingsText.slice(0, 500));
  await guest.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  await waitFor(guest, /FT|Pick|pts|Matches/i, 40000);
  ok(/FT|Pick|pts/i.test(await text(guest)), "Guest sees scored/history state after host final score");
  if (sb && leagueId) {
    const { data } = await sb
      .from("league_members")
      .select("points, profiles(username)")
      .eq("league_id", leagueId);
    ok((data ?? []).length >= 2, "DB has multiple league members after joins", JSON.stringify(data));
    const { data: leagueMatches } = await sb.from("league_matches").select("match_id").eq("league_id", leagueId);
    const matchIds = (leagueMatches ?? []).map((row) => row.match_id);
    const { data: preds } = await sb
      .from("predictions")
      .select("points_awarded, scored, profiles(username), matches(home_score,away_score)")
      .in("match_id", matchIds)
      .eq("points_awarded", 3)
      .eq("scored", true);
    const hostExact = (preds ?? []).some((p) => p.profiles?.username?.startsWith("armyhost"));
    ok(hostExact, "DB has a 3-point exact prediction for the host", JSON.stringify((preds ?? []).slice(-5)));
  }
  await goto(host, "/profile");
  await waitFor(host, /Exact|Forecasts|Total points/i, 25000);
  await shot(host, "profile-exact-stat");
  const profileText = await text(host);
  ok(/Exact/i.test(profileText) && /\b1\b/.test(profileText), "Profile Exact stat visible after 3-point exact score", profileText.slice(0, 700));
}

async function publicLinks(browser) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  wire(page, "public");
  for (const path of ["/support", "/privacy", "/invite/someone", "/join/ABC123"]) {
    await goto(page, path);
    await sleep(2500);
    const t = await text(page);
    await shot(page, `public-${path.replace(/\W+/g, "-")}`, true);
    if (path === "/support") ok(/Support|Contact|help|YaFoot/i.test(t) && !/404|not found/i.test(t), "Support URL public");
    if (path === "/privacy") ok(/Privacy|data|information|contact/i.test(t) && !/404|not found/i.test(t), "Privacy URL public");
    if (path.startsWith("/invite")) ok(!/404|not found/i.test(t), "Invite link route loads");
    if (path.startsWith("/join")) ok(!/404|not found/i.test(t), "Join link route loads");
  }
  await ctx.close();
}

async function visualAudit(pages) {
  for (const [label, page] of pages) {
    const issues = await page.evaluate(() => {
      const out = [];
      for (const el of [...document.querySelectorAll("*")]) {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0 || r.top > window.innerHeight || r.bottom < 0) continue;
        const s = getComputedStyle(el);
        if (el.scrollWidth > el.clientWidth + 3 && /hidden|clip/.test(s.overflowX || "")) {
          out.push({ txt: (el.textContent || "").trim().slice(0, 80), w: el.clientWidth, sw: el.scrollWidth });
        }
      }
      return out.slice(0, 20);
    }).catch(() => []);
    if (issues.length) friction.push({ severity: "medium", msg: `${label} possible text overflow`, context: JSON.stringify(issues.slice(0, 5)) });
  }
}

async function fillerRun(pages) {
  let round = 0;
  while (Date.now() < deadline) {
    round += 1;
    for (const [label, page] of pages) {
      const choice = round % 4;
      if (choice === 0) await clickText(page, "Matches", { exact: true, timeout: 2000 }).catch(() => {});
      if (choice === 1) await clickText(page, "Standings", { exact: true, timeout: 2000 }).catch(() => {});
      if (choice === 2) await clickText(page, "Chat", { exact: true, timeout: 2000 }).catch(() => {});
      if (choice === 3) await goto(page, "/profile").catch(() => {});
      await sleep(1200);
    }
    await visualAudit(pages);
    await sleep(8000);
  }
}

function summarizeLatency() {
  const vals = latency.map((l) => l.ms).filter(Number.isFinite).sort((a, b) => a - b);
  const pct = (p) => vals.length ? vals[Math.min(vals.length - 1, Math.floor(vals.length * p))] : null;
  const slow = latency.filter((l) => l.ms > 2000).sort((a, b) => b.ms - a.ms).slice(0, 10);
  return { count: vals.length, p50: pct(0.5), p90: pct(0.9), p95: pct(0.95), max: vals.at(-1) ?? null, slow };
}

(async () => {
  log("army start", { BASE, OUT, DURATION_MS });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    protocolTimeout: 300000,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  const contexts = await Promise.all(Array.from({ length: 5 }, () => browser.createBrowserContext()));
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  for (let i = 0; i < pages.length; i += 1) {
    await pages[i].setViewport({ width: 390, height: 844, isMobile: true });
    wire(pages[i], `U${i + 1}`);
  }
  const [host, guest, friend, lurker, extra] = pages;
  let status = "PASS";
  let code = null;
  let leagueId = null;
  try {
    const hostName = await onboard(host, "armyhost");
    await sleep(1200);
    const guestName = await onboard(guest, "armyguest");
    await sleep(1200);
    const friendName = await onboard(friend, "armypal");
    await sleep(1200);
    await onboard(lurker, "armylurk");
    await sleep(1200);
    await onboard(extra, "armyextra");
    await publicLinks(browser);
    ({ code, leagueId } = await createCompetition(host));
    await joinCompetition(guest, code, guestName);
    await joinCompetition(friend, code, friendName);
    await makePrediction(host, hostName, 2, 1);
    await makePrediction(guest, guestName, 1, 1);
    await makePrediction(friend, friendName, 0, 2);
    await addFriend(host, guest, hostName, guestName).catch((e) => {
      friction.push({ severity: "medium", msg: "Friend add/accept friction", context: e.message });
    });
    await chatRound(host, guest, code, leagueId).catch((e) => {
      friction.push({ severity: "medium", msg: "League chat friction", context: e.message });
    });
    await finalizeAndVerify(host, guest, leagueId);
    if (!CORE_ONLY) await fillerRun([["host", host], ["guest", guest], ["friend", friend], ["lurker", lurker], ["extra", extra]]);
  } catch (e) {
    status = "BLOCKED";
    friction.push({ severity: "critical", msg: "Army run crashed/blocked", context: e.stack || e.message });
    log("BLOCKED", { error: e.message });
    for (let i = 0; i < pages.length; i += 1) await shot(pages[i], `blocked-u${i + 1}`).catch(() => {});
    if (Date.now() < deadline) {
      const remaining = deadline - Date.now();
      log("holding until 20-minute window ends", { remainingMs: remaining });
      await sleep(remaining);
    }
  } finally {
    await visualAudit([["host", host], ["guest", guest], ["friend", friend], ["lurker", lurker], ["extra", extra]]).catch(() => {});
    await browser.close().catch(() => {});
  }
  const latencySummary = summarizeLatency();
  const critical = friction.filter((f) => f.severity === "critical" || f.severity === "high");
  if (critical.length || fail > 0) status = "BLOCKED";
  const report = {
    worker: WORKER,
    status,
    readyForAppleResubmission: status === "PASS" && !friction.some((f) => ["critical", "high"].includes(f.severity)),
    url: BASE,
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    pass,
    fail,
    users,
    code,
    leagueId,
    friction,
    latency: latencySummary,
    screenshots: shots,
    events,
  };
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  writeFileSync(`workers/${WORKER}.army-report.json`, JSON.stringify(report, null, 2));
  const top = friction.slice().sort((a, b) => {
    const rank = { critical: 0, high: 1, medium: 2, low: 3 };
    return (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9);
  }).slice(0, 10);
  const textReport = [
    `${status}: 20-minute simulated user army against ${BASE}`,
    `Apple resubmission ready: ${report.readyForAppleResubmission ? "YES" : "NO"}`,
    `Pass/fail checks: ${pass}/${fail}`,
    `Users: ${users.join(", ")}`,
    `Competition: code=${code ?? "n/a"} leagueId=${leagueId ?? "n/a"}`,
    `Latency: count=${latencySummary.count}, p50=${latencySummary.p50}ms, p90=${latencySummary.p90}ms, p95=${latencySummary.p95}ms, max=${latencySummary.max}ms`,
    `Top friction: ${top.length ? top.map((f, i) => `${i + 1}. [${f.severity}] ${f.msg}: ${f.context}`).join(" | ") : "none"}`,
    `Screenshots: ${shots.join(", ")}`,
    `Full JSON: ${OUT}/report.json and workers/${WORKER}.army-report.json`,
  ].join("\n");
  writeFileSync(`workers/${WORKER}.last.txt`, textReport);
  console.log(textReport);
  process.exit(status === "PASS" ? 0 : 2);
})();
