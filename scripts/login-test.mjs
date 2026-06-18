// Tests the LOGIN screen: valid creds (should enter app) and invalid creds (should show feedback).
import puppeteer from "puppeteer-core";
const URL = process.env.URL || "http://localhost:8081";
const CHROME = process.env.CHROME || "/usr/bin/google-chrome";
import { mkdirSync } from "node:fs";
const SHOT = "/tmp/yafoot-login"; mkdirSync(SHOT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(email, password, label) {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 420, height: 900 });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => document.body && document.body.innerText.includes("Sign In"), { timeout: 120000 }).catch(() => {});
  await sleep(4000);
  // login screen is the default; fill its inputs (first occurrence = login screen)
  const inputs = await page.$$("input");
  // find email + password by placeholder on the visible login screen (first two)
  const map = {};
  for (const h of inputs) { const ph = (await page.evaluate((el) => el.placeholder || "", h)).toLowerCase(); if (ph && !map[ph]) map[ph] = h; }
  await map["email"].click(); await map["email"].type(email, { delay: 8 });
  await map["password"].click(); await map["password"].type(password, { delay: 8 });
  await page.screenshot({ path: `${SHOT}/${label}-filled.png` });
  await page.evaluate(() => { const el = [...document.querySelectorAll("*")].find((n) => n.children.length === 0 && (n.textContent || "").trim() === "Sign In"); el && el.click(); });
  await sleep(6000);
  const text = await page.evaluate(() => document.body.innerText);
  await page.screenshot({ path: `${SHOT}/${label}-after.png` });
  const inApp = /World Cup|Matches|Upcoming|Live/.test(text) && !/Sign In/.test(text.slice(0, 60));
  const hasError = /failed|invalid|incorrect|wrong|error/i.test(text);
  console.log(`[${label}] enteredApp=${inApp} errorShown=${hasError} pageerrors=${errs.length}`);
  console.log(`   visible: ${JSON.stringify(text.slice(0, 120))}`);
  await browser.close();
  return { inApp, hasError };
}

(async () => {
  console.log("=== valid login ===");
  await run("fan1@yafoot.test", "password123", "valid");
  console.log("=== invalid login (wrong password) ===");
  await run("fan1@yafoot.test", "wrongpass999", "invalid");
  console.log("screenshots in", SHOT);
})();
