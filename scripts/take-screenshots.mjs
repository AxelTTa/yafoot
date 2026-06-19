#!/usr/bin/env node
// Take App Store screenshots at iPhone 6.5" and iPad Pro 12.9" sizes
import puppeteer from "puppeteer-core";
import { mkdirSync } from "fs";

const BASE_URL = "https://dist-five-zeta-92i4a6g3xx.vercel.app";
const OUT_DIR = "/tmp/screenshots";
mkdirSync(OUT_DIR, { recursive: true });

const IPHONE = { width: 430, height: 932, deviceScaleFactor: 3 };   // 1290×2796 saved
const IPAD   = { width: 1024, height: 1366, deviceScaleFactor: 2 }; // 2048×2732 saved

async function shoot(browser, viewport, outFile, action) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.goto(BASE_URL, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  // Try to do onboarding if needed (username prompt may appear)
  try {
    // If there's an onboarding/auth screen, just skip past it by filling username
    const usernameInput = await page.$('input[placeholder*="username" i], input[placeholder*="Username" i]');
    if (usernameInput) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      await page.evaluate((el, val) => {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, val);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }, usernameInput, `screenshotter_${Date.now()}`);
      // click Continue
      await page.click('button, [role="button"]');
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (_) {}

  if (action) await action(page);

  await page.screenshot({ path: outFile, type: "png" });
  await page.close();
  console.log("Saved:", outFile);
}

async function clickTab(page, label) {
  // Try clicking tab by text content
  const clicked = await page.evaluate((text) => {
    const els = [...document.querySelectorAll("*")];
    for (const el of els) {
      if (el.children.length === 0 && el.textContent?.trim() === text) {
        el.click();
        return true;
      }
    }
    return false;
  }, label);
  if (!clicked) console.warn("Tab not found:", label);
  await new Promise(r => setTimeout(r, 2500));
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  // iPhone screenshots
  console.log("--- iPhone 6.5\" screenshots ---");
  await shoot(browser, IPHONE, `${OUT_DIR}/iphone_01.png`, null);
  await shoot(browser, IPHONE, `${OUT_DIR}/iphone_02.png`, p => clickTab(p, "Predict"));
  await shoot(browser, IPHONE, `${OUT_DIR}/iphone_03.png`, p => clickTab(p, "Leagues"));
  await shoot(browser, IPHONE, `${OUT_DIR}/iphone_04.png`, p => clickTab(p, "Profile"));

  // iPad screenshots
  console.log("--- iPad Pro 12.9\" screenshots ---");
  await shoot(browser, IPAD, `${OUT_DIR}/ipad_01.png`, null);
  await shoot(browser, IPAD, `${OUT_DIR}/ipad_02.png`, p => clickTab(p, "Predict"));
  await shoot(browser, IPAD, `${OUT_DIR}/ipad_03.png`, p => clickTab(p, "Leagues"));
  await shoot(browser, IPAD, `${OUT_DIR}/ipad_04.png`, p => clickTab(p, "Profile"));

  await browser.close();
  console.log("All screenshots saved to", OUT_DIR);
}

run().catch(e => { console.error(e); process.exit(1); });
