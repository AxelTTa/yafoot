#!/usr/bin/env node
// Take App Store screenshots at iPhone 6.5" and iPad Pro 12.9" sizes
import puppeteer from "puppeteer-core";
import { mkdirSync } from "fs";

const BASE_URL = "https://dist-five-zeta-92i4a6g3xx.vercel.app";
const OUT_DIR = "/tmp/screenshots";
mkdirSync(OUT_DIR, { recursive: true });

const IPHONE = { width: 430, height: 932, deviceScaleFactor: 3 };
const IPAD   = { width: 1024, height: 1366, deviceScaleFactor: 2 };

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function clickTabIndex(page, text) {
  return page.evaluate((t) => {
    const el = [...document.querySelectorAll('[tabindex="0"]')].find(e => e.textContent?.trim().includes(t));
    if (el) { el.click(); return el.textContent?.slice(0, 40); }
    return null;
  }, text);
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
    await page.evaluate((el, val) => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, input, username);
    await delay(300);
    const btn = await clickTabIndex(page, "go");
    console.log("  Submit:", btn);
    await delay(5000); // wait for auth + navigation to invite screen
  }

  // Invite screen: click "Continue to app"
  const cont = await clickTabIndex(page, "Continue");
  if (cont) { console.log("  Continue:", cont); await delay(2000); }

  // Wait for tabs to appear
  await delay(1500);
  console.log("  URL:", await page.evaluate(() => location.href));
}

async function clickTabByText(page, label) {
  // In the tab bar, items have specific text labels (Matches/Leagues/Friends/Profile)
  // Try navigating directly to the URL as fallback
  const result = await page.evaluate((lbl) => {
    const all = [...document.querySelectorAll('*')];
    // look for tab-bar-like elements (non-nested text match)
    for (const el of all) {
      if (el.children.length <= 2 && el.textContent?.trim() === lbl) {
        el.click();
        return "clicked:" + lbl;
      }
    }
    return null;
  }, label);
  if (result) { console.log("  Tab:", result); await delay(2000); return; }

  // Fallback: navigate via URL
  const paths = { Leagues: "/(tabs)/leagues", Friends: "/(tabs)/social", Profile: "/(tabs)/profile" };
  const path = paths[label];
  if (path) {
    await page.evaluate((p) => {
      // use expo-router's navigation
      window.__expo_router_navigate?.(p);
    }, path);
    // Fallback to hash/pushState
    const url = `${BASE_URL}${path}`;
    await page.goto(url, { waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
    await delay(2000);
  }
}

async function setInputValue(page, index, value) {
  await page.evaluate((idx, val) => {
    const el = document.querySelectorAll('input')[idx];
    if (!el) throw new Error(`input ${idx} not found`);
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, index, value);
}

async function createSafeChallenge(page) {
  await page.goto(`${BASE_URL}/create-challenge`, { waitUntil: "networkidle2", timeout: 20000 });
  await delay(1500);
  await setInputValue(page, 0, "Riverside");
  await setInputValue(page, 1, "Hilltown");
  const d = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  await setInputValue(page, 2, start);
  await setInputValue(page, 3, "Friends Friday");
  await delay(300);
  const created = await clickTabIndex(page, "Create challenge");
  console.log("  Safe challenge:", created);
  await delay(3500);
}

async function shoot(browser, viewport, outFile, tabUrl) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport(viewport);
  console.log("  Loading...");
  await page.goto(BASE_URL, { waitUntil: "networkidle2", timeout: 30000 });
  await doOnboarding(page);
  await createSafeChallenge(page);

  if (tabUrl) {
    // Navigate to the specific tab URL directly
    await page.goto(tabUrl, { waitUntil: "networkidle2", timeout: 20000 });
    await delay(2000);
    console.log("  Navigated to:", tabUrl);
  }

  await page.screenshot({ path: outFile, type: "png" });
  await page.close();
  await ctx.close();
  console.log("  Saved:", outFile);
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const TABS = [
    { label: "Matches", url: null },                                           // home tab
    { label: "Leagues", url: `${BASE_URL}/leagues` },
    { label: "Friends", url: `${BASE_URL}/social` },
    { label: "Profile", url: `${BASE_URL}/profile` },
  ];

  console.log("--- iPhone 6.5\" screenshots ---");
  for (let i = 0; i < TABS.length; i++) {
    console.log(`Shot ${i+1}: ${TABS[i].label}`);
    await shoot(browser, IPHONE, `${OUT_DIR}/iphone_0${i+1}.png`, TABS[i].url);
  }

  console.log("--- iPad Pro 12.9\" screenshots ---");
  for (let i = 0; i < TABS.length; i++) {
    console.log(`Shot ${i+1}: ${TABS[i].label}`);
    await shoot(browser, IPAD, `${OUT_DIR}/ipad_0${i+1}.png`, TABS[i].url);
  }

  await browser.close();
  console.log("\nAll screenshots saved to", OUT_DIR);
}

run().catch(e => { console.error(e); process.exit(1); });
