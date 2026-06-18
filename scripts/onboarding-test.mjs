import puppeteer from "puppeteer-core";
const URL = process.env.URL || "https://dist-five-zeta-92i4a6g3xx.vercel.app";
const CHROME = "/usr/bin/google-chrome";
import { mkdirSync } from "node:fs";
const SHOT = "/tmp/yafoot-onb"; mkdirSync(SHOT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m) => { c ? (pass++, console.log("  ✓", m)) : (fail++, console.log("  ✗", m)); };
const txt = (p) => p.evaluate(() => document.body.innerText);
async function tap(p, label) { return p.evaluate((t) => { const e = [...document.querySelectorAll("*")].find(n => n.children.length === 0 && (n.textContent || "").trim() === t); if (e) { e.click(); return true; } return false; }, label); }
async function fill(p, val) { return p.evaluate((v) => { const i = [...document.querySelectorAll("input")].pop(); if (!i) return false; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; s.call(i, v); i.dispatchEvent(new Event("input", { bubbles: true })); return true; }, val); }

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", protocolTimeout: 180000, args: ["--no-sandbox"] });
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage(); await p.setViewport({ width: 430, height: 920 });
  p.on("dialog", async d => { await d.accept().catch(() => {}); });
  const errs = []; p.on("pageerror", e => errs.push(e.message));

  console.log("[1] welcome (username-only)");
  await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await sleep(6000); await p.screenshot({ path: `${SHOT}/1-welcome.png` });
  const t1 = await txt(p);
  ok(/Get started|username|Welcome/i.test(t1) && !/password/i.test(t1), "welcome shows username-only (no password)");

  const uname = "tester" + Date.now().toString(36).slice(-5);
  await fill(p, uname); await sleep(500);
  await tap(p, "Get started"); await sleep(7000);
  await p.screenshot({ path: `${SHOT}/2-invite.png` });
  const t2 = await txt(p);
  ok(/invite|link|friend|You're in/i.test(t2), "post-signup shows invite-link screen");
  ok(/\/invite\//.test(t2) || /Copy/i.test(t2), "invite link present");

  console.log("[2] continue to app");
  await tap(p, "Continue to app"); await sleep(5000);
  await p.screenshot({ path: `${SHOT}/3-matches.png` });
  ok(/World Cup|Live|Upcoming|Groups/i.test(await txt(p)), "entered Matches");

  console.log("[3] Groups tab");
  await tap(p, "Groups"); await sleep(3000);
  await p.screenshot({ path: `${SHOT}/4-groups.png` });
  ok(/Group [A-L]|Pts/i.test(await txt(p)), "groups standings render");

  console.log(`\n=== ${pass} passed, ${fail} failed ===  pageerrors: ${errs.length}`);
  errs.slice(0, 5).forEach(e => console.log("  err:", e.slice(0, 120)));
  await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error("CRASH:", e.message); process.exit(2); });
