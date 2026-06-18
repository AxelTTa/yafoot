// Headless-browser smoke test of the YaFoot web app.
// Loads the dev server, captures console/page errors, asserts the login UI renders,
// then drives a full signup -> tabs -> predict flow and screenshots each step.
import puppeteer from "puppeteer-core";

const URL = process.env.URL || "http://localhost:8081";
const CHROME = process.env.CHROME || "/usr/bin/google-chrome";
const SHOT = "/tmp/yafoot-shots";
import { mkdirSync } from "node:fs";
mkdirSync(SHOT, { recursive: true });

const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=420,900"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 420, height: 900 });

  page.on("console", (m) => {
    const t = m.type();
    if (t === "error") errors.push("console.error: " + m.text());
  });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("requestfailed", (r) => {
    const u = r.url();
    if (u.includes("supabase") || u.endsWith(".bundle")) errors.push("reqfailed: " + u + " " + r.failure()?.errorText);
  });

  let step = 0;
  const shot = async (name) => { await page.screenshot({ path: `${SHOT}/${String(++step).padStart(2,"0")}-${name}.png` }); };
  const has = async (text) => (await page.evaluate(() => document.body.innerText)).includes(text);

  console.log("→ loading", URL);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 120000 });
  // wait for React to mount (first compile can be slow)
  await page.waitForFunction(() => document.body && document.body.innerText.length > 0, { timeout: 120000 }).catch(() => {});
  await sleep(6000);
  await shot("loaded");

  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log("→ visible text (first 200):", JSON.stringify(bodyText.slice(0, 200)));

  // ---- Assertion 1: app rendered, not a blank page ----
  const rendered = bodyText.trim().length > 0;
  console.log(rendered ? "✓ page rendered content" : "✗ BLANK PAGE");

  // ---- Assertion 2: login screen present ----
  const loginVisible = (await has("YaFoot")) && ((await has("Sign In")) || (await has("Predict the World Cup")));
  console.log(loginVisible ? "✓ login screen visible (YaFoot + Sign In)" : "✗ login screen NOT found");

  // ---- Drive a signup ----
  let signupOk = false, tabsOk = false, matchesOk = false;
  try {
    // go to signup
    const clicked = await page.evaluate(() => {
      const el = [...document.querySelectorAll("*")].find((n) => n.children.length === 0 && /create one/i.test(n.textContent || ""));
      if (el) { el.click(); return true; } return false;
    });
    await sleep(2500); await shot("signup-screen");

    const stamp = Date.now();
    const inputs = await page.$$("input");
    console.log("→ inputs in DOM:", inputs.length);
    // map each real ElementHandle to its placeholder, then type into the signup ones
    // last occurrence wins: the signup screen is mounted after (on top of) the login screen,
    // and only its inputs are visible/focusable.
    const byPlaceholder = {};
    for (const h of inputs) {
      const ph = (await page.evaluate((el) => el.placeholder || "", h)).toLowerCase();
      if (ph) byPlaceholder[ph] = h;
    }
    console.log("→ placeholders:", Object.keys(byPlaceholder).join(" | "));
    const typeInto = async (prefix, val) => {
      const key = Object.keys(byPlaceholder).reverse().find((k) => k.startsWith(prefix));
      if (!key) throw new Error("no input with placeholder ~ " + prefix);
      const node = byPlaceholder[key];
      await node.click();
      await node.type(val, { delay: 10 });
    };
    {
      await typeInto("username", `WebTester${stamp}`);
      await typeInto("email", `webtest_${stamp}@yafoot.test`);
      await typeInto("password", "test123456");
      await shot("signup-filled");
      // tap Create Account
      await page.evaluate(() => {
        const el = [...document.querySelectorAll("*")].find((n) => n.children.length === 0 && /create account/i.test(n.textContent || ""));
        el && el.click();
      });
      await sleep(7000); await shot("after-signup");
      // an alert dialog may appear in RN web as text; check we left the auth screen -> tabs
      matchesOk = (await has("World Cup")) || (await has("Live")) || (await has("Matches")) || (await has("Upcoming"));
      tabsOk = (await has("Predict")) && (await has("Leagues"));
      signupOk = matchesOk || tabsOk;
      console.log(signupOk ? "✓ signup succeeded, entered app" : "✗ did not enter app after signup");
      await shot("app-home");
    }
  } catch (e) {
    console.log("✗ signup flow error:", e.message);
  }

  // ---- navigate tabs if in app ----
  if (signupOk) {
    for (const tab of ["Predict", "Leagues", "Friends", "Profile"]) {
      try {
        await page.evaluate((t) => {
          const el = [...document.querySelectorAll("*")].find((n) => n.children.length === 0 && (n.textContent || "").trim() === t);
          el && el.click();
        }, tab);
        await sleep(2500); await shot("tab-" + tab.toLowerCase());
      } catch {}
    }
  }

  console.log("\n=== ERRORS (" + errors.length + ") ===");
  // de-dupe + filter noise
  const noisy = (e) => /favicon|sourcemap|DevTools|Download the React|ws:\/\/|hot/i.test(e);
  const real = [...new Set(errors)].filter((e) => !noisy(e));
  real.slice(0, 25).forEach((e) => console.log(" -", e.slice(0, 200)));

  await browser.close();
  console.log("\nScreenshots in", SHOT);
  const fatal = !rendered || !loginVisible;
  process.exit(fatal ? 1 : 0);
})().catch((e) => { console.error("TEST CRASHED:", e.message); process.exit(2); });
