// Two-user multiplayer test in the real UI: User A creates a league, User B joins by code,
// they chat in real time, both predict, and we verify the leaderboard shows both.
import puppeteer from "puppeteer-core";
const URL = process.env.URL || "http://localhost:8081";
const CHROME = process.env.CHROME || "/usr/bin/google-chrome";
import { mkdirSync } from "node:fs";
const SHOT = "/tmp/yafoot-mp"; mkdirSync(SHOT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log("  ✓", m)) : (fail++, console.log("  ✗ FAIL:", m)); };

function wire(page) {
  page._dialogs = [];
  page.on("dialog", async (d) => { page._dialogs.push(d.message()); await d.accept().catch(() => {}); });
}
const textOf = (page) => page.evaluate(() => document.body.innerText);
async function tapExact(page, label) {
  return page.evaluate((t) => {
    const el = [...document.querySelectorAll("*")].find((n) => n.children.length === 0 && (n.textContent || "").trim() === t);
    if (el) { el.click(); return true; } return false;
  }, label);
}
async function tapContains(page, re) {
  return page.evaluate((r) => {
    const rx = new RegExp(r);
    const el = [...document.querySelectorAll("*")].find((n) => n.children.length === 0 && rx.test((n.textContent || "").trim()));
    if (el) { el.click(); return true; } return false;
  }, re.source);
}
// Set a React-controlled input by placeholder (last match = the visible screen on top),
// using the native value setter + input event so React's onChangeText fires. One round-trip.
async function fillPlaceholder(page, prefix, val) {
  const okSet = await page.evaluate((p, v) => {
    const ins = [...document.querySelectorAll("input")].filter((i) => (i.placeholder || "").toLowerCase().startsWith(p));
    const el = ins[ins.length - 1];
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, prefix, val);
  if (!okSet) throw new Error("no input ~ " + prefix);
}
async function signup(page, name) {
  process.stdout.write(`   ${name}: goto…`);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => /Get started/.test(document.body.innerText), { timeout: 90000 });
  process.stdout.write(" loaded…");
  await sleep(2500);
  const stamp = Date.now().toString(36) + Math.floor(Math.random() * 1000);
  await fillPlaceholder(page, "username", name + stamp);
  process.stdout.write(" submit…");
  await tapExact(page, "Get started");
  await sleep(6000);
  await tapExact(page, "Continue to app");
  await sleep(4000);
  console.log(" done");
  return name + stamp;
}

(async () => {
  console.log("Multiplayer test against", URL);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", protocolTimeout: 240000, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  // separate browser contexts so each user has isolated localStorage (own Supabase session)
  const ctxA = await browser.createBrowserContext();
  const ctxB = await browser.createBrowserContext();
  const A = await ctxA.newPage(); await A.setViewport({ width: 420, height: 900 }); wire(A);
  const B = await ctxB.newPage(); await B.setViewport({ width: 420, height: 900 }); wire(B);

  console.log("\n[1] Two users sign up");
  const ua = await signup(A, "alice");
  const ub = await signup(B, "bob");
  ok(/World Cup|Matches|Live|Upcoming/.test(await textOf(A)), "user A entered app");
  ok(/World Cup|Matches|Live|Upcoming/.test(await textOf(B)), "user B entered app");

  console.log("\n[2] A creates a league");
  await tapExact(A, "Leagues"); await sleep(1500);
  await tapContains(A, /Create/); await sleep(1200);
  await fillPlaceholder(A, "league name", "Mega League");
  await tapExact(A, "Create League"); await sleep(4000);
  await A.screenshot({ path: `${SHOT}/A-created.png` });
  const dlg = (A._dialogs.join(" ") || "");
  const codeMatch = dlg.match(/\b([A-F0-9]{6})\b/);
  const code = codeMatch ? codeMatch[1] : null;
  ok(!!code, "league created, code captured from dialog: " + code);

  console.log("\n[3] B joins by code");
  await tapExact(B, "Leagues"); await sleep(1500);
  await tapContains(B, /^Join$/); await sleep(1200);
  await fillPlaceholder(B, "enter", code);
  await tapExact(B, "Join League"); await sleep(4000);
  await B.screenshot({ path: `${SHOT}/B-joined.png` });
  ok(/Standings|Chat/.test(await textOf(B)), "B joined and is in league detail");

  console.log("\n[4] Realtime chat A <-> B");
  // A is on Leagues list; open the league
  await tapExact(A, "Mega League"); await sleep(2500);
  await tapContains(A, /Chat/); await sleep(1500);
  await tapContains(B, /Chat/); await sleep(1500);
  // A sends
  await fillPlaceholder(A, "message", "Bonjour Bob!"); await tapExact(A, "Send"); await sleep(3500);
  const bSees = /Bonjour Bob!/.test(await textOf(B));
  ok(bSees, "B sees A's message in realtime");
  await B.screenshot({ path: `${SHOT}/B-chat.png` });
  // B replies
  await fillPlaceholder(B, "message", "Salut Alice!"); await tapExact(B, "Send"); await sleep(3500);
  const aSees = /Salut Alice!/.test(await textOf(A));
  ok(aSees, "A sees B's reply in realtime");
  await A.screenshot({ path: `${SHOT}/A-chat.png` });

  console.log("\n[5] Standings shows both members");
  await tapContains(A, /Standings/); await sleep(2500);
  const stand = await textOf(A);
  ok(/alice/i.test(stand) && /bob/i.test(stand), "leaderboard lists both alice and bob");
  await A.screenshot({ path: `${SHOT}/A-standings.png` });

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  console.log("dialogs A:", JSON.stringify(A._dialogs).slice(0, 200));
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("CRASHED:", e.message); process.exit(2); });
