import puppeteer from "puppeteer-core";
const URL = process.env.URL || "https://dist-five-zeta-92i4a6g3xx.vercel.app";
import { mkdirSync } from "node:fs";
const SHOT = "/tmp/yafoot-tour"; mkdirSync(SHOT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const txt = (p) => p.evaluate(() => document.body.innerText);
async function tap(p, t) { return p.evaluate((x) => { const e = [...document.querySelectorAll("*")].find(n => n.children.length === 0 && (n.textContent || "").trim() === x); if (e) { e.click(); return true; } return false; }, t); }
async function tapHas(p, re) { return p.evaluate((r) => { const rx = new RegExp(r); const e = [...document.querySelectorAll("*")].find(n => n.children.length === 0 && rx.test((n.textContent || "").trim())); if (e) { e.click(); return true; } return false; }, re.source); }
async function fill(p, v) { return p.evaluate((val) => { const i = [...document.querySelectorAll("input")].pop(); if (!i) return; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; s.call(i, val); i.dispatchEvent(new Event("input", { bubbles: true })); }, v); }

(async () => {
  const b = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new", protocolTimeout: 180000, args: ["--no-sandbox"] });
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage(); await p.setViewport({ width: 430, height: 932 });
  p.on("dialog", async d => { await d.accept().catch(() => {}); });
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  let n = 0; const shot = async (name) => { await p.screenshot({ path: `${SHOT}/${String(++n).padStart(2, "0")}-${name}.png` }); console.log("  shot", name); };

  await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 }); await sleep(6000);
  await fill(p, "tourist" + Date.now().toString(36).slice(-4)); await sleep(400);
  await tap(p, "Get started"); await sleep(7000); await shot("invite");
  await tap(p, "Continue to app"); await sleep(5000); await shot("matches");
  await tap(p, "Groups"); await sleep(3000); await shot("groups");
  await tap(p, "Upcoming"); await sleep(2500);
  // open stats from a card
  await tapHas(p, /Stats/); await sleep(4000); await shot("stats-empty");
  // make a prediction: back, open a match, set score, save
  await tapHas(p, /‹|Back/); await sleep(2000);
  await tap(p, "Predict"); await sleep(3000);
  await tapHas(p, /Tap to predict/); await sleep(3000); await shot("match-detail");
  await p.evaluate(() => { const plus = [...document.querySelectorAll("*")].filter(n => n.children.length === 0 && n.textContent.trim() === "+"); plus[0] && plus[0].click(); plus[0] && plus[0].click(); });
  await sleep(500);
  await tapHas(p, /Lock In|Update Prediction/); await sleep(3500);
  // profile
  await tap(p, "Profile"); await sleep(3500); await shot("profile");
  await tap(p, "⚙️"); await sleep(2500); await shot("settings");
  // notifications via back then bell
  await tapHas(p, /‹/); await sleep(1500);
  await tap(p, "Matches"); await sleep(2000);
  await tap(p, "🔔"); await sleep(3000); await shot("notifications");

  console.log(`\npageerrors: ${errs.length}`); errs.slice(0, 6).forEach(e => console.log("  err:", e.slice(0, 140)));
  await b.close();
})().catch(e => { console.error("CRASH:", e.message); process.exit(1); });
