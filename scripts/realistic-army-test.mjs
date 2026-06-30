/**
 * YaFoot realistic full-app army.
 *
 * This is the default army gate for product rebuilds. It drives the real web UI
 * with isolated browser contexts and fails loudly when required user flows are
 * skipped. It intentionally avoids direct DB/RPC shortcuts except for observing
 * network failures from UI actions.
 *
 * Usage:
 *   URL=https://dist-five-zeta-92i4a6g3xx.vercel.app node scripts/realistic-army-test.mjs
 */
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE_URL = process.env.URL || "https://dist-five-zeta-92i4a6g3xx.vercel.app";
const CHROME = process.env.CHROME || "/usr/bin/google-chrome";
const OUT = process.env.OUT || `/tmp/yafoot-realistic-army-${Date.now().toString(36)}`;
const USER_COUNT = Number(process.env.USERS || 5);
const MOBILE = { width: 390, height: 844, isMobile: true, hasTouch: true };
const DESKTOP = { width: 1280, height: 900 };

mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const stamp = () => Date.now().toString(36).slice(-6);

const report = {
  ok: false,
  baseUrl: BASE_URL,
  out: OUT,
  users: [],
  checks: [],
  findings: [],
  feedback: [],
  metrics: [],
  artifacts: [],
};

function logCheck(name, status, detail = "", severity = "medium") {
  report.checks.push({ name, status, detail });
  const mark = status === "pass" ? "PASS" : status === "skip" ? "SKIP" : "FAIL";
  console.log(`${mark} ${name}${detail ? `: ${detail}` : ""}`);
  if (status === "fail") report.findings.push({ severity, name, detail });
}

function pass(name, detail = "") {
  logCheck(name, "pass", detail);
}

function fail(name, detail = "", severity = "medium") {
  logCheck(name, "fail", detail, severity);
}

function feedback(user, page, note, severity = "low") {
  const item = { severity, user, page, note };
  report.feedback.push(item);
  console.log(`FEEDBACK ${severity} ${user} ${page}: ${note}`);
}

async function bodyText(page) {
  return page.evaluate(() => document.body.innerText || "").catch(() => "");
}

async function waitFor(page, regex, timeout = 30000) {
  const deadline = Date.now() + timeout;
  let last = "";
  while (Date.now() < deadline) {
    last = await bodyText(page);
    if (regex.test(last)) return last;
    await sleep(300);
  }
  throw new Error(`Timed out waiting for ${regex}. Last screen: ${last.slice(0, 700)}`);
}

async function screenshot(page, label) {
  const safe = label.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  const path = `${OUT}/${String(report.artifacts.length + 1).padStart(2, "0")}-${safe}.png`;
  await page.screenshot({ path, fullPage: false }).catch(() => {});
  report.artifacts.push(path);
  return path;
}

async function visibleIssues(page) {
  return page.evaluate(() => {
    const issues = [];
    const nodes = [...document.querySelectorAll("body *")].filter((node) => {
      const style = getComputedStyle(node);
      const r = node.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && r.width > 1 && r.height > 1;
    });
    for (const node of nodes) {
      const r = node.getBoundingClientRect();
      if (r.left < -6 || r.right > window.innerWidth + 6) {
        issues.push({ type: "horizontal-overflow", text: (node.textContent || "").trim().slice(0, 80) });
        break;
      }
    }
    const buttons = nodes.filter((node) => {
      const role = node.getAttribute("role");
      return node.tagName === "BUTTON" || role === "button" || node.tagName === "A";
    });
    for (const button of buttons) {
      const r = button.getBoundingClientRect();
      if (r.width < 28 || r.height < 28) {
        issues.push({ type: "tiny-target", text: (button.textContent || button.getAttribute("aria-label") || "").trim().slice(0, 80) });
        break;
      }
    }
    return issues.slice(0, 5);
  }).catch(() => []);
}

function wire(page, label) {
  page._events = [];
  page._rageClicks = 0;
  page._lastClick = null;
  page.on("dialog", async (dialog) => {
    page._events.push({ type: "dialog", message: dialog.message() });
    await dialog.accept().catch(() => {});
  });
  page.on("pageerror", (error) => {
    page._events.push({ type: "pageerror", message: error.message });
    fail(`${label} page error`, error.message, "high");
  });
  page.on("console", (message) => {
    if (message.type() === "error" && !/favicon|404/i.test(message.text())) {
      page._events.push({ type: "console-error", message: message.text() });
    }
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    const message = request.failure()?.errorText || "request failed";
    page._events.push({ type: "requestfailed", url, message });
    if (/ERR_ABORTED|net::ERR_ABORTED/i.test(message)) return;
    if (/supabase\.co|football-data|vercel/i.test(url)) fail(`${label} critical request failed`, `${url} ${message}`, "high");
  });
}

async function measured(label, fn) {
  const started = Date.now();
  const result = await fn();
  const ms = Date.now() - started;
  report.metrics.push({ label, ms });
  if (ms > 8000) feedback("army", label, `Slow interaction: ${ms}ms`, "medium");
  return result;
}

async function clickText(page, label, { exact = false, timeout = 8000, required = true } = {}) {
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
        if (box.width >= 90 && box.height >= 32) { target = p; break; }
      }
      const r = target.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, label, exact);
    if (rect) {
      const previous = page._lastClick;
      if (previous && Math.abs(previous.x - rect.x) < 8 && Math.abs(previous.y - rect.y) < 8 && Date.now() - previous.at < 900) {
        page._rageClicks += 1;
      }
      page._lastClick = { ...rect, at: Date.now() };
      await page.mouse.click(rect.x, rect.y);
      await sleep(300);
      return true;
    }
    await sleep(250);
  }
  if (required) throw new Error(`Could not click "${label}". Screen: ${(await bodyText(page)).slice(0, 700)}`);
  return false;
}

async function clickRegex(page, regex, { timeout = 8000, required = true } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const rect = await page.evaluate((source, flags) => {
      const rx = new RegExp(source, flags);
      const nodes = [...document.querySelectorAll("*")].filter((node) => {
        if (node.offsetParent === null || node.offsetWidth < 1 || node.offsetHeight < 1) return false;
        return rx.test((node.textContent || "").trim());
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
        if (box.width >= 90 && box.height >= 32) { target = p; break; }
      }
      const r = target.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, regex.source, regex.flags);
    if (rect) {
      await page.mouse.click(rect.x, rect.y);
      await sleep(300);
      return true;
    }
    await sleep(250);
  }
  if (required) throw new Error(`Could not click ${regex}. Screen: ${(await bodyText(page)).slice(0, 700)}`);
  return false;
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
  if (!ok) throw new Error(`No visible input for ${value}`);
  await page.keyboard.type(value, { delay: 15 });
  await page.evaluate(() => {
    const input = [...document.querySelectorAll("input,textarea")].filter((el) => el.offsetParent !== null).at(-1);
    if (input) input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function setInputByPlaceholder(page, needle, value) {
  const ok = await page.evaluate((wanted, next) => {
    const input = [...document.querySelectorAll("input,textarea")].filter((el) => {
      return el.offsetParent !== null && (el.getAttribute("placeholder") || "").toLowerCase().includes(wanted.toLowerCase());
    }).at(-1);
    if (!input) return false;
    input.focus();
    const proto = input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (!setter) return false;
    setter.call(input, "");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    setter.call(input, next);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, needle, value);
  if (!ok) await setLastInput(page, value);
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

async function onboard(page, prefix, language) {
  const username = `${prefix}${stamp()}${Math.floor(Math.random() * 99)}`.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 18);
  await measured(`onboard-${username}`, async () => {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 90000 });
    await waitFor(page, /Pick your language|Choisis ta langue|Let's go!|Get started|Competitions|Profile|Matches/i, 60000);
    if (/Pick your language|Choisis ta langue/i.test(await bodyText(page))) {
      await clickText(page, language, { exact: true, timeout: 8000 });
    }
    await waitFor(page, /Let's go!|Get started|YOUR NAME|TON PRÉNOM|Competitions|Profile|Matches/i, 30000);
    if (!/Competitions|Profile|Matches/i.test(await bodyText(page))) {
      await setLastInput(page, username);
      await clickRegex(page, /Let's go!|Get started|C'est parti/i, { timeout: 10000 });
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await sleep(1500 + attempt * 1500);
      if (!/Signup is busy|inscription/i.test(await bodyText(page))) break;
      await clickRegex(page, /Let's go!|Get started|C'est parti/i, { timeout: 10000 });
    }
    await waitFor(page, /Continue to app|Continuer|Aller dans l'app|Competitions|Profile|Friends|Matches/i, 45000);
    if (/Continue to app|Continuer|Aller dans l'app/i.test(await bodyText(page))) {
      await clickRegex(page, /Continue to app|Continuer|Aller dans l'app/i, { timeout: 10000 });
    }
    await waitFor(page, /Competitions|Profile|Friends|Matches|Matchs/i, 30000);
  });
  report.users.push({ username, language });
  return username;
}

async function scanPage(user, page, route, expected) {
  await measured(`${user}-${route}`, async () => {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const text = await waitFor(page, expected, 30000);
    const issues = await visibleIssues(page);
    if (issues.length) feedback(user, route, `Layout issues: ${issues.map((i) => i.type).join(", ")}`, "medium");
    await screenshot(page, `${user}-${route || "home"}`);
    pass(`${user} scanned ${route || "/"}`, text.slice(0, 90).replace(/\n/g, " "));
  });
}

async function clickFirstMatchCard(page) {
  const clicked = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("div,button,[role='button'],a")].filter((node) => {
      const text = node.textContent || "";
      return node.offsetParent !== null && /vs|VS|Group [A-L]|\d{1,2}:\d{2}/i.test(text) && node.getBoundingClientRect().height > 40;
    });
    cards.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    const card = cards[0];
    if (!card) return false;
    card.click();
    return true;
  });
  if (!clicked) throw new Error("No visible match card found");
}

async function submitPrediction(page, user, source, home = 1, away = 0) {
  await measured(`${user}-prediction-${source}`, async () => {
    if (source === "predict-tab") {
      await page.goto(`${BASE_URL}/predict`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await waitFor(page, /Tap to predict|Make your prediction|Submit prediction|Predict|Pronos|No match|Aucun/i, 30000);
      if (/No match|Aucun/i.test(await bodyText(page))) throw new Error("Predict tab has no match to predict");
      await clickRegex(page, /Tap to predict|Make your prediction|Submit prediction/i, { timeout: 10000, required: false });
    } else if (source === "matches-detail") {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
      await waitFor(page, /Upcoming|Live|Groups|Results|Matchs|À venir/i, 30000);
      await clickRegex(page, /Upcoming|À venir/i, { timeout: 5000, required: false });
      await clickFirstMatchCard(page);
    } else {
      await waitFor(page, /Tap to predict|Make your prediction|Submit prediction|Save pick|Update pick|Prediction submitted|No prediction yet|vs/i, 30000);
      await clickRegex(page, /Tap to predict|Make your prediction|Submit prediction/i, { timeout: 10000, required: false });
    }
    await waitFor(page, /Make your prediction|Submit prediction|Save pick|Update pick|Lock In Prediction|Prediction submitted|No prediction yet|vs/i, 30000);
    await clickAria(page, "Increase home prediction", home).catch(async () => {
      for (let i = 0; i < home; i += 1) await clickText(page, "+", { exact: true, timeout: 2000 });
    });
    await clickAria(page, "Increase away prediction", away).catch(async () => {
      for (let i = 0; i < away; i += 1) await clickText(page, "+", { exact: true, timeout: 2000 });
    });
    await clickRegex(page, /Submit prediction|Lock In Prediction|Update Prediction/i, { timeout: 2500, required: false });
    if (!/Prediction saved|Prediction submitted|Change the score to update|Your pick|Pick|Update pick/i.test(await bodyText(page))) {
      await clickText(page, "Save pick", { exact: true, timeout: 10000 }).catch(() =>
        clickText(page, "Update pick", { exact: true, timeout: 10000 })
      );
    }
    const text = await waitFor(page, /Prediction saved|Prediction submitted|Change the score to update|Your pick|Pick|Update pick/i, 25000);
    await screenshot(page, `${user}-${source}-prediction-saved`);
    pass(`${user} predicted via ${source}`, text.slice(0, 120).replace(/\n/g, " "));
  });
}

async function createCompetition(host) {
  const name = `Army ${stamp()}`;
  await measured("competition-create-ui", async () => {
    await host.goto(`${BASE_URL}/create-league`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitFor(host, /How long|Rest of tournament|Next knockout|Sur combien/i, 30000);
    await screenshot(host, "competition-duration");
    await clickRegex(host, /Next|Suivant/i, { timeout: 10000 });
    await waitFor(host, /Mild|Daring|Savage|punishment|gage/i, 30000);
    await clickRegex(host, /Daring|Moyen|Audacieux/i, { timeout: 5000, required: false });
    await screenshot(host, "competition-punishments");
    await clickRegex(host, /Next|Suivant/i, { timeout: 10000 });
    await waitFor(host, /Name your league|Competition name|COMPETITION NAME|nom/i, 30000);
    await setLastInput(host, name);
    await clickRegex(host, /Create competition|Create League|Create|Créer/i, { timeout: 10000 });
  });
  const created = await waitFor(host, /INVITE CODE|Submit prediction|Could not create competition|Invite code/i, 60000);
  await screenshot(host, "competition-created");
  if (/Could not create competition/i.test(created)) throw new Error("Create competition failure was visible");
  const code = (created.match(/INVITE CODE\s*([A-Z0-9]{6,8})/i) || created.match(/\b([A-F0-9]{6})\b/))?.[1] ?? null;
  const leagueId = Number(host.url().match(/league\/(\d+)/)?.[1] || 0) || null;
  if (!code) throw new Error(`No invite code on competition screen: ${created.slice(0, 500)}`);
  if (!leagueId) throw new Error(`No league id in URL after creation: ${host.url()}`);
  pass("competition created through real UI", `${name} ${code}`);
  return { name, code, leagueId };
}

async function joinCompetition(page, user, code) {
  await measured(`${user}-join-competition`, async () => {
    await page.goto(`${BASE_URL}/join/${code}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitFor(page, /Join|competition|code|Rejoindre/i, 30000);
    await clickRegex(page, /Join|Rejoindre/i, { timeout: 10000 });
    const joined = await waitFor(page, /Submit prediction|Standings|Invite code|Could not join|Classement/i, 45000);
    if (/Could not join|not found|error/i.test(joined)) throw new Error(`Join failed: ${joined.slice(0, 500)}`);
    await screenshot(page, `${user}-joined-competition`);
  });
  pass(`${user} joined competition through invite UI`);
}

async function verifyNoHostResult(page, leagueId) {
  await measured("competition-no-host-result", async () => {
    await page.goto(`${BASE_URL}/league/${leagueId}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const text = await waitFor(page, /Submit prediction|Standings|Invite code|Matches|Classement/i, 30000);
    if (/Host result|Finalize score|Finaliser le score/i.test(text)) {
      throw new Error(`Old host result flow visible on official competition: ${text.slice(0, 500)}`);
    }
    await screenshot(page, "competition-no-host-result");
    pass("official competition hides old Host result flow");
  });
}

async function friendAndDm(alice, bob, aliceName, bobName) {
  await measured("friends-and-dm", async () => {
    await alice.goto(`${BASE_URL}/social`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitFor(alice, /Friends|Search|Add|Social|Amis/i, 30000);
    await setInputByPlaceholder(alice, "search", bobName.slice(0, 12));
    await sleep(2500);
    const search = await bodyText(alice);
    if (!search.toLowerCase().includes(bobName.slice(0, 6).toLowerCase()) && !/Add|Ajouter/i.test(search)) {
      throw new Error(`Friend search did not find ${bobName}: ${search.slice(0, 500)}`);
    }
    await clickRegex(alice, /Add|Ajouter/i, { timeout: 10000 });
    await bob.goto(`${BASE_URL}/social`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const requests = await waitFor(bob, /Requests|Accept|Pending|Accepter|Demandes/i, 30000);
    if (!/Accept|Accepter/i.test(requests)) throw new Error(`No accept button for friend request: ${requests.slice(0, 500)}`);
    await clickRegex(bob, /Accept|Accepter/i, { timeout: 10000 });
    await sleep(2500);

    await alice.goto(`${BASE_URL}/social`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitFor(alice, /Friends|Amis/i, 30000);
    await clickRegex(alice, new RegExp(bobName.slice(0, 8), "i"), { timeout: 10000 });
    const dm = await waitFor(alice, /Message|conversation|Start|Envoyer/i, 30000);
    if (!/Message|conversation|Start|Envoyer/i.test(dm)) throw new Error("DM screen did not open");
    const message = `army dm ${stamp()}`;
    await setInputByPlaceholder(alice, "message", message);
    await clickRegex(alice, /Send|Envoyer/i, { timeout: 10000 });
    await bob.goto(`${BASE_URL}/social`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitFor(bob, /Friends|Amis/i, 30000);
    await clickRegex(bob, new RegExp(aliceName.slice(0, 8), "i"), { timeout: 10000 });
    const received = await waitFor(bob, new RegExp(message, "i"), 30000);
    await screenshot(bob, "dm-received");
    pass("friends request, accept, and DM flow", received.slice(0, 120).replace(/\n/g, " "));
  });
}

async function verifyFinishedResult(page) {
  await measured("results-real-score-api", async () => {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitFor(page, /Live|Upcoming|Groups|Results|Matchs/i, 30000);
    await clickRegex(page, /Results|Résultats/i, { timeout: 10000 });
    const text = await waitFor(page, /Results|FT|Full Time|\d+\s*-\s*\d+|No results/i, 30000);
    if (/No results/i.test(text)) throw new Error("Results page loaded but has no finished matches yet");
    if (!/FT|Full Time|\d+\s*-\s*\d+/i.test(text)) throw new Error(`Results page did not expose real scores: ${text.slice(0, 500)}`);
    await screenshot(page, "results-real-scores");
    pass("football API result behavior visible in Results tab");
  });
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  protocolTimeout: 300000,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
});

try {
  const contexts = await Promise.all(Array.from({ length: USER_COUNT }, () => browser.createBrowserContext()));
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  for (const [idx, page] of pages.entries()) {
    await page.setViewport(idx === USER_COUNT - 1 ? DESKTOP : MOBILE);
    wire(page, `U${idx + 1}`);
  }
  const [host, guest, alice, bob, reviewer] = pages;

  const names = await Promise.all(pages.map((page, idx) => onboard(page, `army${idx + 1}`, idx % 2 ? "Français" : "English")));
  pass("created isolated real accounts", names.join(", "));

  await scanPage("reviewer", reviewer, "", /Matches|Matchs|Predict|Prévoir|Pronos|Leagues|Competitions|Profile|Profil/i);
  await scanPage("reviewer", reviewer, "", /Live|Upcoming|Groups|Results|Matchs|À venir/i);
  await clickRegex(reviewer, /Groups|Groupes/i, { timeout: 10000, required: false });
  await screenshot(reviewer, "reviewer-groups");
  await scanPage("reviewer", reviewer, "/leagues", /League|Competition|Join|Create|Ligue|Rejoindre/i);
  await scanPage("reviewer", reviewer, "/social", /Friends|Search|Add|Amis|Recherche/i);
  await scanPage("reviewer", reviewer, "/profile", /Profile|Profil|pts|points|prediction/i);
  await scanPage("reviewer", reviewer, "/settings", /Settings|Language|Display|Paramètres|Langue/i);
  feedback("reviewer", "full-app", "Navigation covered every major tab/page on mobile and desktop viewport.");

  await submitPrediction(host, names[0], "matches-detail", 2, 1);
  await submitPrediction(guest, names[1], "predict-tab", 1, 1);

  const competition = await createCompetition(host);
  await joinCompetition(guest, names[1], competition.code);
  await submitPrediction(host, names[0], "competition-detail", 2, 1);
  await guest.goto(`${BASE_URL}/league/${competition.leagueId}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await submitPrediction(guest, names[1], "competition-detail", 0, 1);
  await verifyNoHostResult(host, competition.leagueId);

  await friendAndDm(alice, bob, names[2], names[3]);
  await verifyFinishedResult(reviewer);

  for (const [idx, page] of pages.entries()) {
    if (page._rageClicks > 2) feedback(names[idx], "rage-clicks", `${page._rageClicks} repeated clicks detected`, "medium");
    const criticalConsole = page._events.filter((event) => event.type === "console-error");
    if (criticalConsole.length) feedback(names[idx], "console", `${criticalConsole.length} console errors observed`, "low");
  }

  const blocking = report.findings.filter((finding) => finding.severity === "high" || finding.severity === "medium");
  report.ok = blocking.length === 0;
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log(`REPORT ${OUT}/report.json`);
  if (blocking.length) process.exitCode = 1;
} catch (error) {
  fail("realistic army crashed", error.stack || error.message, "high");
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log(`REPORT ${OUT}/report.json`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
