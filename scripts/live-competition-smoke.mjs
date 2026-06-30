import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE_URL = process.env.URL || "https://dist-five-zeta-92i4a6g3xx.vercel.app";
const CHROME = process.env.CHROME || "/usr/bin/google-chrome";
const OUT = process.env.OUT || `/tmp/yafoot-live-competition-smoke-${Date.now().toString(36)}`;

mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const stamp = () => Date.now().toString(36).slice(-6);

const failures = [];
const artifacts = [];

function fail(message, context = "") {
  const entry = context ? `${message}: ${context}` : message;
  failures.push(entry);
  console.error("FAIL", entry);
}

function assert(condition, message, context = "") {
  if (!condition) fail(message, context);
  else console.log("PASS", message);
}

async function bodyText(page) {
  return page.evaluate(() => document.body.innerText).catch(() => "");
}

async function waitFor(page, regex, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const text = await bodyText(page);
    if (regex.test(text)) return text;
    await sleep(350);
  }
  throw new Error(`Timed out waiting for ${regex}. Last screen: ${(await bodyText(page)).slice(0, 500)}`);
}

async function screenshot(page, label) {
  const path = `${OUT}/${String(artifacts.length + 1).padStart(2, "0")}-${label}.png`;
  await page.screenshot({ path, fullPage: false }).catch(() => {});
  artifacts.push(path);
  return path;
}

async function clickText(page, label, { exact = false, timeout = 8000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const rect = await page.evaluate((wanted, exactMatch) => {
      const nodes = [...document.querySelectorAll("*")].filter((node) => {
        if (node.offsetParent === null || node.offsetWidth < 1 || node.offsetHeight < 1) return false;
        const text = (node.textContent || "").trim();
        return exactMatch ? text === wanted : text.includes(wanted);
      });
      nodes.sort((a, b) => {
        const leaf = a.children.length - b.children.length;
        if (leaf !== 0) return leaf;
        return a.offsetWidth * a.offsetHeight - b.offsetWidth * b.offsetHeight;
      });
      const node = nodes[0];
      if (!node) return null;
      let target = node.closest('[role="button"],button,a') || node;
      for (let p = node.parentElement; p && p !== document.body; p = p.parentElement) {
        const box = p.getBoundingClientRect();
        if (box.width >= 120 && box.height >= 36) { target = p; break; }
      }
      const r = target.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, label, exact);
    if (rect) {
      await page.mouse.click(rect.x, rect.y);
      await sleep(450);
      return true;
    }
    await sleep(250);
  }
  throw new Error(`Could not click "${label}". Screen: ${(await bodyText(page)).slice(0, 500)}`);
}

async function setLastInput(page, value) {
  const ok = await page.evaluate((next) => {
    const input = [...document.querySelectorAll("input,textarea")].filter((el) => el.offsetParent !== null).at(-1);
    if (!input) return false;
    input.focus();
    const proto = input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (!setter) return false;
    setter.call(input, "");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }, value);
  if (!ok) throw new Error(`Could not set input to ${value}`);
  await page.keyboard.type(value, { delay: 15 });
  await page.evaluate(() => {
    const input = [...document.querySelectorAll("input,textarea")].filter((el) => el.offsetParent !== null).at(-1);
    if (input) input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function clickVisibleExact(page, text, occurrence = 0) {
  const ok = await page.evaluate((wanted, index) => {
    const nodes = [...document.querySelectorAll("*")].filter((node) => {
      if (node.offsetParent === null || node.offsetWidth < 1 || node.offsetHeight < 1) return false;
      return (node.textContent || "").trim() === wanted;
    });
    nodes.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    const node = nodes[index];
    if (!node) return false;
    node.click();
    return true;
  }, text, occurrence);
  if (!ok) throw new Error(`Could not click exact text ${text}`);
  await sleep(500);
}

async function selectCountry(page, country, occurrence = 0) {
  await clickVisibleExact(page, "Pick country", occurrence);
  await waitFor(page, /Search country|Choose country/i, 10000);
  await setLastInput(page, country);
  await sleep(700);
  await clickText(page, country, { timeout: 10000 });
}

async function clickAria(page, label, count = 1) {
  for (let i = 0; i < count; i += 1) {
    const ok = await page.evaluate((name) => {
      const el = document.querySelector(`[aria-label="${name}"]`);
      if (!el) return false;
      el.click();
      return true;
    }, label);
    if (!ok) throw new Error(`Could not click aria ${label}`);
    await sleep(150);
  }
}

async function clickVisibleTextAt(page, label, index, count = 1) {
  for (let i = 0; i < count; i += 1) {
    const ok = await page.evaluate((wanted, occurrence) => {
      const nodes = [...document.querySelectorAll("*")].filter((node) => {
        if (node.offsetParent === null || node.offsetWidth < 1 || node.offsetHeight < 1) return false;
        return (node.textContent || "").trim() === wanted;
      });
      nodes.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left);
      const node = nodes[occurrence];
      if (!node) return false;
      node.click();
      return true;
    }, label, index);
    if (!ok) throw new Error(`Could not click ${label} at index ${index}`);
    await sleep(150);
  }
}

function wire(page, label) {
  page._events = [];
  page.on("dialog", async (dialog) => {
    page._events.push({ type: "dialog", message: dialog.message() });
    await dialog.accept().catch(() => {});
  });
  page.on("pageerror", (error) => {
    page._events.push({ type: "pageerror", message: error.message });
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    const message = request.failure()?.errorText || "request failed";
    page._events.push({ type: "requestfailed", url, message });
    if (url.includes("supabase.co")) fail(`${label} Supabase request failed`, `${url} ${message}`);
  });
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("supabase.co/rest/v1/rpc/create_prediction_competition") && response.status() < 400) return;
    let body = "";
    try {
      body = (await response.text()).slice(0, 800);
    } catch {}
    page._events.push({ type: "response", status: response.status(), url, body });
    if (url.includes("create_prediction_competition") && response.status() >= 400) {
      fail(`${label} create competition RPC failed`, `${response.status()} ${body}`);
    }
  });
}

async function onboard(page, prefix) {
  const username = `${prefix}${stamp()}`.toLowerCase();
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitFor(page, /Pick your language|Let's go!|Get started|Competitions|Profile/i, 60000);
  if (/Pick your language/i.test(await bodyText(page))) await clickText(page, "English", { exact: true });
  await waitFor(page, /Let's go!|Get started|YOUR NAME|Competitions|Profile/i, 30000);
  if (!/Competitions|Profile/i.test(await bodyText(page))) {
    await setLastInput(page, username);
    await clickText(page, "Let's go!", { exact: true }).catch(() => clickText(page, "Get started", { exact: true }));
  }
  await waitFor(page, /Continue to app|Competitions|Profile|Friends/i, 45000);
  if (/Continue to app/i.test(await bodyText(page))) await clickText(page, "Continue to app", { exact: true });
  await waitFor(page, /Competitions|Profile|Friends/i, 30000);
  return username;
}

async function createCompetition(host) {
  const name = `Smoke ${stamp()}`;
  await host.goto(`${BASE_URL}/create-league`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitFor(host, /How long|Rest of tournament|Next knockout|Sur combien/i, 30000);
  await screenshot(host, "host-length");
  await clickText(host, "Next", { exact: true });
  await waitFor(host, /Mild|Daring|Savage|punishment/i, 30000);
  await screenshot(host, "host-punishment");
  await clickText(host, "Next", { exact: true });
  await waitFor(host, /Name your league|Competition name|COMPETITION NAME/i, 30000);
  await screenshot(host, "host-name");
  await setLastInput(host, name);
  await clickText(host, "Create competition", { timeout: 10000 }).catch(() => clickText(host, "Create", { timeout: 10000 }));
  let created = await waitFor(host, /INVITE CODE|Submit prediction|Host result|Could not create competition/i, 60000);
  await screenshot(host, "host-created");
  assert(!/Could not create competition/i.test(created), "create competition did not show failure alert", created.slice(0, 500));
  const code = (created.match(/INVITE CODE\s*([A-Z0-9]{6,8})/i) || created.match(/\b([A-F0-9]{6})\b/))?.[1] ?? null;
  assert(!!code, "invite code extracted from real UI", created.slice(0, 700));
  if (!/Submit prediction|Host result|Matches/i.test(created)) {
    await clickText(host, "Open competition", { timeout: 10000 }).catch(() => clickText(host, "View competition", { timeout: 5000 }));
    created = await waitFor(host, /Submit prediction|Host result|Matches|Invite code/i, 30000);
  }
  assert(/Submit prediction|Host result|Matches/i.test(created), "host landed on usable competition detail", created.slice(0, 500));
  let leagueId = Number(host.url().match(/league\/(\d+)/)?.[1] || 0) || null;
  if (!leagueId) {
    const href = await host.evaluate(() => location.href).catch(() => "");
    leagueId = Number(href.match(/league\/(\d+)/)?.[1] || 0) || null;
  }
  assert(!!leagueId, "league id visible in routed URL", host.url());
  return { code, leagueId, name };
}

async function joinCompetition(guest, code) {
  await guest.goto(`${BASE_URL}/join/${code}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitFor(guest, /Join|competition|code/i, 30000);
  await screenshot(guest, "guest-join");
  await clickText(guest, "Join", { timeout: 10000 });
  const joined = await waitFor(guest, /Submit prediction|Host result|Standings|Invite code|Could not join/i, 45000);
  assert(!/Could not join|not found|error/i.test(joined), "guest joined through invite link", joined.slice(0, 500));
  await screenshot(guest, "guest-joined");
}

async function submitPrediction(page, label, homeClicks, awayClicks) {
  const startedUrl = page.url();
  await waitFor(page, /Tap to predict|Submit prediction|Save pick|Update pick|Prediction submitted|vs/i, 30000);
  const before = await bodyText(page);
  if (/Tap to predict/i.test(before) && !/Submit prediction|Save pick|Update pick/i.test(before)) {
    await clickText(page, "Tap to predict", { exact: true, timeout: 10000 });
    await waitFor(page, /Make your prediction|Submit prediction|Save pick|Update pick|No prediction yet/i, 30000);
  }
  await clickAria(page, "Increase home prediction", homeClicks).catch(async () => {
    for (let i = 0; i < homeClicks; i += 1) await clickText(page, "+", { exact: true, timeout: 2000 });
  });
  await clickAria(page, "Increase away prediction", awayClicks).catch(async () => {
    for (let i = 0; i < awayClicks; i += 1) await clickText(page, "+", { exact: true, timeout: 2000 });
  });
  await clickText(page, "Submit prediction", { exact: true, timeout: 2500 }).catch(() =>
    clickText(page, "Save pick", { exact: true, timeout: 10000 }).catch(() =>
      clickText(page, "Update pick", { exact: true, timeout: 10000 })
    )
  );
  const text = await waitFor(page, /Prediction saved|Prediction submitted|Change the score to update|Pick\s+\d/i, 20000);
  assert(/Prediction saved|Prediction submitted|Change the score to update|Pick\s+\d/i.test(text), `${label} prediction submitted`, text.slice(0, 400));
  await screenshot(page, `${label}-prediction`);
  if (/\/match\/\d+/.test(page.url()) && /\/league\/\d+/.test(startedUrl)) {
    await page.goBack({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
    await waitFor(page, /Standings|Invite code|Matches/i, 30000);
  }
}

async function verifyNoHostResult(host) {
  const text = await waitFor(host, /Standings|Invite code|Matches/i, 30000);
  assert(!/Host result|Finalize score/i.test(text), "official competition hides old host result flow", text.slice(0, 600));
  await screenshot(host, "host-no-host-result");
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  protocolTimeout: 240000,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});

try {
  const hostCtx = await browser.createBrowserContext();
  const guestCtx = await browser.createBrowserContext();
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();
  for (const page of [host, guest]) await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  wire(host, "host");
  wire(guest, "guest");

  const hostName = await onboard(host, "smokehost");
  const guestName = await onboard(guest, "smokeguest");
  const { code, leagueId, name } = await createCompetition(host);
  await joinCompetition(guest, code);
  await submitPrediction(host, "host", 2, 1);
  await guest.goto(`${BASE_URL}/league/${leagueId}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await submitPrediction(guest, "guest", 1, 0);
  await host.goto(`${BASE_URL}/league/${leagueId}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await verifyNoHostResult(host);

  const report = { ok: failures.length === 0, baseUrl: BASE_URL, hostName, guestName, leagueId, code, name, artifacts, hostEvents: host._events, guestEvents: guest._events, failures };
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log(`REPORT ${OUT}/report.json`);
  if (failures.length) process.exitCode = 1;
} catch (error) {
  fail("smoke crashed", error.stack || error.message);
  writeFileSync(`${OUT}/report.json`, JSON.stringify({ ok: false, baseUrl: BASE_URL, artifacts, failures }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
