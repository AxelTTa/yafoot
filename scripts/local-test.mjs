/**
 * local-test.mjs  — serve dist/ locally at iPhone 14 viewport and screenshot key screens.
 * Usage: node scripts/local-test.mjs
 * No Vercel needed — tests the exact build that will be deployed.
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const __dir = fileURLToPath(new URL(".", import.meta.url));
const dist = join(__dir, "../dist");
const SHOT = "/tmp/yafoot-local"; mkdirSync(SHOT, { recursive: true });
const PORT = 3737;

const MIME = {
  ".html": "text/html", ".js": "application/javascript; charset=utf-8",
  ".css": "text/css", ".ttf": "font/ttf", ".png": "image/png",
  ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".json": "application/json",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ico": "image/x-icon",
};

// Simple SPA server: serve static files, fall back to index.html
const server = createServer((req, res) => {
  const raw = req.url.split("?")[0];
  let fp = join(dist, raw);
  if (!existsSync(fp) || raw === "/") fp = join(dist, "index.html");
  try {
    const data = readFileSync(fp);
    res.writeHead(200, { "Content-Type": MIME[extname(fp)] || "application/octet-stream" });
    res.end(data);
  } catch {
    // SPA fallback
    try { res.writeHead(200, { "Content-Type": "text/html" }); res.end(readFileSync(join(dist, "index.html"))); }
    catch { res.writeHead(404); res.end("not found"); }
  }
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  await new Promise(r => server.listen(PORT, r));
  const BASE = `http://localhost:${PORT}`;
  console.log(`\nServing dist/ → ${BASE}`);
  console.log("Viewport: iPhone 14  (390×844 @3x)\n");

  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-web-security"],
    protocolTimeout: 60000,
  });

  let n = 0;
  const shot = async label => {
    const file = `${SHOT}/${String(++n).padStart(2, "0")}-${label}.png`;
    await page.screenshot({ path: file, fullPage: false });
    console.log(`  [${n}] ${label}  →  ${file}`);
    return file;
  };

  const fill = async val => page.evaluate(val => {
    const inputs = [...document.querySelectorAll("input, textarea")];
    const i = inputs.find(i => !i.type || i.type === "text") || inputs[0];
    if (!i) return false;
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(i, val);
    i.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }, val);

  const tap = async text => page.evaluate(text => {
    const el = [...document.querySelectorAll("*")].find(
      n => n.children.length === 0 && n.textContent.trim() === text
    );
    if (el) { el.click(); return true; } return false;
  }, text);

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3 });
  page.on("dialog", d => d.accept().catch(() => {}));
  page.on("pageerror", e => console.error("  JS error:", e.message.slice(0, 120)));

  try {
    // ── language screen ──
    await page.goto(BASE, { waitUntil: "networkidle0", timeout: 30000 });
    await sleep(2000);
    await shot("language");

    // Pick English
    await tap("English"); await sleep(1500);
    await shot("welcome");

    // Enter name → see handle preview
    await fill("Axel Test"); await sleep(600);
    await shot("welcome-filled");

    // Submit
    await tap("Let's go!"); await sleep(6000);
    await shot("invite");

    // Continue to app
    await tap("Continue to app"); await sleep(4000);
    await shot("matches-tab");

    // Leagues tab
    await tap("Leagues"); await sleep(1500);
    await shot("leagues-tab");

    // Open create wizard
    await tap("Create"); await sleep(1500);
    await shot("create-step1-duration");

    // Friends tab
    await page.goBack(); await sleep(800);
    await tap("Friends"); await sleep(1500);
    await shot("friends-tab");

    // Profile tab
    await tap("Profile"); await sleep(1500);
    await shot("profile-tab");

  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\nAll screenshots → ${SHOT}/`);
}

run().catch(e => { console.error("CRASH:", e.message); process.exit(1); });
