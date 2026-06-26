#!/usr/bin/env node
// Take App Store screenshots at iPhone 6.5" and iPad Pro 12.9" sizes
import puppeteer from "puppeteer-core";
import { mkdirSync, rmSync } from "fs";

const BASE_URL = process.env.URL || "https://dist-five-zeta-92i4a6g3xx.vercel.app";
const OUT_DIR = "/tmp/screenshots";
rmSync(OUT_DIR, { recursive: true, force: true });
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

async function shoot(browser, viewport, outFile, path) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.on("dialog", async (dialog) => {
    console.log("  Dialog:", dialog.message());
    await dialog.accept().catch(() => {});
  });
  await page.setViewport(viewport);
  console.log("  Loading...");
  await page.goto(BASE_URL, { waitUntil: "networkidle2", timeout: 30000 });
  await doOnboarding(page);

  if (path) {
    const url = `${BASE_URL}${path}`;
    await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
    await delay(2000);
    console.log("  Navigated to:", url);
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
    { label: "Competitions", path: "/leagues" },
    { label: "Create Competition", path: "/create-league" },
    { label: "Friends", path: "/social" },
    { label: "Profile", path: "/profile" },
  ];

  console.log("--- iPhone 6.5\" screenshots ---");
  for (let i = 0; i < TABS.length; i++) {
    console.log(`Shot ${i+1}: ${TABS[i].label}`);
    await shoot(browser, IPHONE, `${OUT_DIR}/iphone_0${i+1}.png`, TABS[i].path);
  }

  console.log("--- iPad Pro 12.9\" screenshots ---");
  for (let i = 0; i < TABS.length; i++) {
    console.log(`Shot ${i+1}: ${TABS[i].label}`);
    await shoot(browser, IPAD, `${OUT_DIR}/ipad_0${i+1}.png`, TABS[i].path);
  }

  await browser.close();
  console.log("\nAll screenshots saved to", OUT_DIR);
}

run().catch(e => { console.error(e); process.exit(1); });
