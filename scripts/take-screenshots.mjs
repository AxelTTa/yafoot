#!/usr/bin/env node
// Take App Store screenshots at iPhone 6.5" and iPad Pro 12.9" sizes
import puppeteer from "puppeteer-core";
import { mkdirSync, rmSync } from "fs";

const BASE_URL = process.env.URL || "https://dist-five-zeta-92i4a6g3xx.vercel.app";
const OUT_DIR = "/tmp/screenshots";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://zfsgclwyaapgwxjtzvyd.supabase.co";
const SUPABASE_REF = SUPABASE_URL.match(/https:\/\/([^.]+)\./)?.[1] || "zfsgclwyaapgwxjtzvyd";
const SUPABASE_ANON = process.env.SUPABASE_ANON || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const IPHONE = { width: 430, height: 932, deviceScaleFactor: 3 };
const IPAD   = { width: 1024, height: 1366, deviceScaleFactor: 2 };

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function jsonFetch(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  if (!res.ok) throw new Error(`${options.method || "GET"} ${url} ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function bootstrapSession() {
  if (!SUPABASE_ANON || !SUPABASE_SERVICE_ROLE) return null;
  const stamp = Date.now();
  const username = `shot${String(stamp).slice(-8)}`;
  const email = `${username}@screenshots.yafoot.app`;
  const password = `Shot-${stamp}-YaFoot`;

  const created = await jsonFetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, display_name: "Reviewer" },
    }),
  });

  const session = await jsonFetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  await jsonFetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      id: created.id,
      username,
      display_name: "Reviewer",
      total_points: 0,
    }),
  });

  return {
    storageKey: `sb-${SUPABASE_REF}-auth-token`,
    value: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      expires_at: Math.floor(Date.now() / 1000) + session.expires_in,
      token_type: session.token_type,
      user: session.user,
    },
  };
}

function clickTabIndex(page, text) {
  return page.evaluate((t) => {
    const el = [...document.querySelectorAll('[tabindex="0"]')].find(e => e.textContent?.trim().includes(t));
    if (el) { el.click(); return el.textContent?.slice(0, 40); }
    return null;
  }, text);
}

async function waitForNotWelcome(page) {
  for (let i = 0; i < 40; i++) {
    const url = await page.evaluate(() => location.href);
    const text = await page.evaluate(() => document.body.innerText || "");
    if (!url.includes("/welcome") && !/YOUR NAME|TON PRÉNOM|Let's go!|C'est parti/i.test(text)) return true;
    await delay(500);
  }
  return false;
}

async function doOnboarding(page) {
  await delay(2500);

  // Language screen: click English
  const lang = await clickTabIndex(page, "English");
  if (lang) { console.log("  Lang:", lang); await delay(1500); }

  // Username screen: fill + submit
  const input = await page.$('input');
  if (input) {
    const username = `shot${Date.now().toString().slice(-5)}`;
    await input.click({ clickCount: 3 });
    await page.keyboard.type(username, { delay: 20 });
    await page.evaluate((el, val) => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, input, username);
    await delay(300);
    const btn = await clickTabIndex(page, "go");
    console.log("  Submit:", btn);
    await waitForNotWelcome(page); // wait for auth + navigation to invite screen
  }

  // Invite screen: click "Continue to app"
  const cont = await clickTabIndex(page, "Continue");
  if (cont) { console.log("  Continue:", cont); await delay(2000); }

  // Wait for tabs to appear
  await delay(1500);
  console.log("  URL:", await page.evaluate(() => location.href));
}

async function shoot(browser, viewport, outFile, path, sessionSeed) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  if (sessionSeed) {
    await page.evaluateOnNewDocument((seed) => {
      localStorage.setItem(seed.storageKey, JSON.stringify(seed.value));
      localStorage.setItem("yafoot.lang", "en");
    }, sessionSeed);
  }
  page.on("dialog", async (dialog) => {
    console.log("  Dialog:", dialog.message());
    await dialog.accept().catch(() => {});
  });
  await page.setViewport(viewport);
  console.log("  Loading...");
  await page.goto(BASE_URL, { waitUntil: "networkidle2", timeout: 30000 });
  if (sessionSeed) await delay(2500);
  else await doOnboarding(page);

  if (path) {
    const url = `${BASE_URL}${path}`;
    await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
    await delay(2000);
    console.log("  Navigated to:", url);
  }

  const bodyText = await page.evaluate(() => document.body.innerText || "");
  if (/YOUR NAME|TON PRÉNOM|Let's go!|C'est parti/i.test(bodyText)) {
    throw new Error(`Refusing to save onboarding screenshot for ${outFile}`);
  }

  await page.screenshot({ path: outFile, type: "png" });
  await page.close();
  await ctx.close();
  console.log("  Saved:", outFile);
}

async function run() {
  let sessionSeed = null;
  try {
    sessionSeed = await bootstrapSession();
    if (sessionSeed) console.log("Using injected screenshot session.");
  } catch (e) {
    console.warn("Could not create injected screenshot session; falling back to UI onboarding:", e.message);
  }

  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const TABS = [
    { label: "Competitions", path: "/leagues" },
    { label: "Create Competition", path: "/create-league" },
    { label: "Friends", path: "/social" },
    { label: "Profile", path: "/profile" },
  ];

  console.log("--- iPhone 6.5\" screenshots ---");
  for (let i = 0; i < TABS.length; i++) {
    console.log(`Shot ${i+1}: ${TABS[i].label}`);
    await shoot(browser, IPHONE, `${OUT_DIR}/iphone_0${i+1}.png`, TABS[i].path, sessionSeed);
  }

  console.log("--- iPad Pro 12.9\" screenshots ---");
  for (let i = 0; i < TABS.length; i++) {
    console.log(`Shot ${i+1}: ${TABS[i].label}`);
    await shoot(browser, IPAD, `${OUT_DIR}/ipad_0${i+1}.png`, TABS[i].path, sessionSeed);
  }

  await browser.close();
  console.log("\nAll screenshots saved to", OUT_DIR);
}

run().catch(e => { console.error(e); process.exit(1); });
