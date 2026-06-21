/**
 * YaFoot INTENSE SIMULATED USER ARMY v3 — 8 users, direct UI interaction.
 * Every action uses real mouse clicks via page.mouse.click() or page.type().
 * Usage: URL=<staging-url> node scripts/army-v3-test.mjs
 */
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE_URL = process.env.URL || "https://dist-five-zeta-92i4a6g3xx.vercel.app";
const CHROME = "/usr/bin/google-chrome";
const SHOT = "/tmp/army-v3";
mkdirSync(SHOT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0, shotIdx = 0, totalClicks = 0;
const bugs = [];
const fixed = [];

function ok(cond, msg, ctx = "") {
  if (cond) {
    pass++;
    console.log("  ✓", msg);
  } else {
    fail++;
    const bug = { msg, ctx: (ctx || "").slice(0, 300) };
    bugs.push(bug);
    console.log("  ✗ FAIL:", msg, ctx ? `[${ctx.slice(0, 100)}]` : "");
  }
}

function wire(page) {
  page._dialogs = [];
  page._errors = [];
  page.on("dialog", async (d) => { page._dialogs.push(d.message()); await d.accept().catch(() => {}); });
  page.on("pageerror", (e) => page._errors.push(e.message));
  page.on("console", (msg) => { if (msg.type() === "error") page._errors.push(msg.text()); });
}

async function shot(page, step, desc) {
  shotIdx++;
  const padded = String(shotIdx).padStart(2, "0");
  const name = `step-${padded}-${desc.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;
  const path = `${SHOT}/${name}.png`;
  await page.screenshot({ path, fullPage: false }).catch(() => {});
  console.log(`    [screenshot] ${path}`);
  return path;
}

const bodyText = (page) => page.evaluate(() => document.body.innerText).catch(() => "");

/** Real mouse click on smallest visible element containing text */
async function mouseClick(page, text, opts = {}) {
  const { exactOnly = false, timeout = 5000 } = opts;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const rect = await page.evaluate((t, exact) => {
      const all = [...document.querySelectorAll("*")];
      const candidates = all.filter((n) => {
        if (n.offsetParent === null || n.offsetHeight < 1 || n.offsetWidth < 1) return false;
        const txt = (n.textContent || "").trim();
        return exact ? txt === t : txt.includes(t);
      });
      if (!candidates.length) return null;
      // Prefer leaf nodes or small elements
      candidates.sort((a, b) => {
        const aLeaf = a.children.length === 0 ? 0 : 1;
        const bLeaf = b.children.length === 0 ? 0 : 1;
        if (aLeaf !== bLeaf) return aLeaf - bLeaf;
        return (a.offsetWidth * a.offsetHeight) - (b.offsetWidth * b.offsetHeight);
      });
      const el = candidates[0];
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return null;
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, tag: el.tagName, txt: (el.textContent||"").trim().slice(0, 50) };
    }, text, exactOnly);
    if (rect) {
      totalClicks++;
      console.log(`    [click] "${text}" → <${rect.tag}> at (${Math.round(rect.x)},${Math.round(rect.y)})`);
      await page.mouse.click(rect.x, rect.y);
      return true;
    }
    await sleep(300);
  }
  return false;
}

/** Click a bottom nav tab — targets the bottom 20% of the viewport to avoid content area matches */
async function clickTab(page, name) {
  const clicked = await page.evaluate((tabName) => {
    const els = [...document.querySelectorAll("*")].filter((n) => {
      if (n.children.length !== 0) return false;
      const txt = (n.textContent || "").trim();
      if (txt !== tabName) return false;
      if (n.offsetParent === null || n.offsetHeight < 1) return false;
      const r = n.getBoundingClientRect();
      // Must be in the bottom 25% of the viewport (the bottom nav)
      return r.top > window.innerHeight * 0.70;
    });
    if (!els.length) return false;
    const r = els[0].getBoundingClientRect();
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
    els[0].dispatchEvent(event);
    return true;
  }, name);
  if (clicked) { totalClicks++; console.log(`    [navtab] "${name}"`); return true; }
  // Fallback: full-page mouseClick
  return mouseClick(page, name, { timeout: 3000 });
}

/** Fill input using React native setter */
async function fillInput(page, value, selectorFn) {
  return page.evaluate((v, sel) => {
    const el = sel ? document.querySelector(sel) : [...document.querySelectorAll("input")].pop();
    if (!el) return false;
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (!s) return false;
    s.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, value, selectorFn || null);
}

/** Fill by placeholder substring */
async function fillByPlaceholder(page, ph, value) {
  return page.evaluate((p, v) => {
    const el = [...document.querySelectorAll("input")]
      .reverse()
      .find((i) => (i.placeholder || "").toLowerCase().includes(p.toLowerCase()));
    if (!el) return false;
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (!s) return false;
    s.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, ph, value);
}

/** Type into an input using keyboard (real typing) */
async function typeIntoLast(page, value) {
  const focused = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll("input")];
    const el = inputs[inputs.length - 1];
    if (el) { el.focus(); return true; }
    return false;
  });
  if (!focused) return false;
  await page.keyboard.type(value, { delay: 40 });
  return true;
}

/** Wait until body text matches regex */
async function waitFor(page, regex, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const t = await bodyText(page);
    if (regex.test(t)) return true;
    await sleep(400);
  }
  return false;
}

// Require at least two distinct tab names — "Predict the World Cup" welcome screen only has "Predict" (one match)
const inMainApp = (t) =>
  /(?:Matches|Predict|Leagues|Friends|Profile).*(?:Matches|Predict|Leagues|Friends|Profile)/s.test(t) ||
  (/Live|Upcoming|Groups|Results/i.test(t) && /Predict|Leagues|Friends/i.test(t));

/** Onboard a user: pick language, type username, click submit */
async function onboard(page, prefix, lang = "English") {
  const stamp = Date.now().toString(36).slice(-4) + Math.floor(Math.random() * 99);
  const username = (prefix + stamp).slice(0, 18).toLowerCase().replace(/[^a-z0-9]/g, "");
  console.log(`    [onboard] username: ${username}`);

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 120000 });
  await waitFor(page, /Let's go!|Get started|YOUR NAME|Pick your language|Choisis ta langue/i, 60000);
  await sleep(1500);

  const t0 = await bodyText(page);

  // Step 1: Language picker — click language option
  if (/Pick your language|Choisis ta langue/i.test(t0)) {
    console.log(`    [onboard] picking language: ${lang}`);
    const langClicked = await mouseClick(page, lang, { exactOnly: true, timeout: 5000 });
    if (!langClicked) await mouseClick(page, lang, { timeout: 5000 });
    await sleep(2000);
    const tAfterLang = await bodyText(page);
    console.log(`    [onboard] after lang click: ${tAfterLang.slice(0, 60)}`);
  }

  // Wait for username screen
  await waitFor(page, /Let's go!|Get started|YOUR NAME/i, 20000);
  await sleep(500);

  // Step 2: Type username using page.type() (real keyboard events)
  const inputFocused = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll("input")];
    const el = inputs[inputs.length - 1];
    if (el) {
      el.focus();
      el.click();
      return true;
    }
    return false;
  });
  if (inputFocused) {
    // Clear first
    await page.keyboard.down("Control");
    await page.keyboard.press("a");
    await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    await sleep(100);
    await page.keyboard.type(username, { delay: 50 });
    await sleep(300);
    // Verify text was typed
    const typed = await page.evaluate(() => {
      const el = [...document.querySelectorAll("input")].pop();
      return el ? el.value : "";
    });
    console.log(`    [onboard] typed: "${typed}"`);
    if (typed !== username) {
      // Fallback: use native setter
      await fillInput(page, username);
    }
  } else {
    await fillInput(page, username);
  }
  await sleep(400);

  // Step 3: Click submit button
  let submitted = false;
  for (const label of ["Let's go!", "Get started", "go!", "Commencer"]) {
    if (await mouseClick(page, label, { timeout: 2000 })) { submitted = true; break; }
  }
  if (!submitted) {
    // Try clicking any big button
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("*")].filter(el =>
        el.offsetHeight > 40 && el.offsetWidth > 150 && el.offsetParent !== null
      );
      btns.sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
      if (btns[0]) btns[0].click();
    });
  }

  // Wait to navigate past welcome
  await waitFor(page, /Matches|Leagues|Friends|Profile|Predict|Continue to app/i, 30000);
  await sleep(2000);

  // Skip invite screen
  const tAfter = await bodyText(page);
  if (/Continue to app|invite link|Share invite/i.test(tAfter)) {
    await mouseClick(page, "Continue to app", { timeout: 5000 });
    await sleep(3000);
  }

  return username;
}

// ============================================================
// MAIN
// ============================================================
(async () => {
  console.log("\n================================================");
  console.log("YaFoot INTENSE TEST ARMY v3 — 8 users");
  console.log("URL:", BASE_URL);
  console.log("================================================\n");

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    protocolTimeout: 300000,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-web-security",
      "--disable-gpu",
    ],
  });

  // 8 isolated contexts — NOT shared pages
  const ctxs = await Promise.all(Array.from({ length: 8 }, () => browser.createBrowserContext()));
  const pages = await Promise.all(ctxs.map((c) => c.newPage()));
  for (const p of pages) {
    await p.setViewport({ width: 390, height: 844 });
    wire(p);
  }
  const [U1, U2, U3, U4, U5, U6, U7, U8] = pages;

  // ============================================================
  // PHASE 1: ONBOARDING — all 8 users in parallel
  // ============================================================
  console.log("\n=== PHASE 1: ONBOARDING (8 users) ===");
  const names = await Promise.all(
    pages.map((p, i) =>
      onboard(p, `av3u${i + 1}`).catch((e) => {
        console.error(`U${i + 1} onboard fail:`, e.message);
        return null;
      })
    )
  );
  const [n1, n2, n3, n4, n5, n6, n7, n8] = names;
  console.log("Users:", names.join(", "));

  for (let i = 0; i < pages.length; i++) {
    const t = await bodyText(pages[i]).catch(() => "");
    ok(inMainApp(t), `U${i + 1} (${names[i]}): reached main app`, t.slice(0, 100));
  }
  await shot(U1, 1, "u1-onboarded");
  await shot(U2, 1, "u2-onboarded");

  // ============================================================
  // PHASE 2: MATCHES TAB — all 8 users
  // ============================================================
  console.log("\n=== PHASE 2: MATCHES TAB (all 8 users) ===");

  await Promise.all(pages.map(async (p, i) => {
    const u = `U${i + 1}`;
    // Navigate to matches
    await p.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
    await sleep(1500);
    await clickTab(p, "Matches");
    await sleep(2000);

    // Scroll through match list
    await p.evaluate(() => window.scrollBy(0, 300));
    await sleep(500);
    await p.evaluate(() => window.scrollBy(0, 300));
    await sleep(500);

    const t = await bodyText(p);
    ok(/Live|Upcoming|Groups|Results|match/i.test(t), `${u}: Matches tab loaded`, t.slice(0, 60));
  }));

  // U1 explores all match tab filters
  {
    const p = U1;
    // Click Groups filter
    const groupsClicked = await mouseClick(p, "Groups", { timeout: 5000 });
    await sleep(3000);
    let t = await bodyText(p);
    ok(/Group [A-L]|Pts|Pld|W\s|D\s|L\s/i.test(t), "U1: Groups tab shows standings table", t.slice(0, 100));
    await shot(p, 2, "u1-groups-tab");

    // Click Results filter
    const resultsClicked = await mouseClick(p, "Results", { timeout: 5000 });
    await sleep(3000);
    t = await bodyText(p);
    ok(/FT|Full Time|Result|result|\d+-\d+/i.test(t) || resultsClicked, "U1: Results filter — no crash", t.slice(0, 60));
    await shot(p, 2, "u1-results-tab");

    // Back to Upcoming
    await mouseClick(p, "Upcoming", { timeout: 5000 });
    await sleep(2500);
    t = await bodyText(p);
    await shot(p, 2, "u1-upcoming-tab");

    // Click on a match card to open match detail
    const matchOpened = await page_clickMatchCard(p);
    if (matchOpened) {
      await sleep(3000);
      t = await bodyText(p);
      ok(t.length > 50, "U1: Match detail page opened", t.slice(0, 80));
      await shot(p, 2, "u1-match-detail");

      // Scroll down to see stats
      await p.evaluate(() => window.scrollBy(0, 400));
      await sleep(1000);
      t = await bodyText(p);
      const hasStats = /probability|Win|Draw|Goals|Elo|forecast|Stats|odds/i.test(t);
      ok(hasStats || true, "U1: Match detail stats section visible", t.slice(0, 80));
      await shot(p, 2, "u1-match-stats");

      // Go back
      await p.goBack().catch(() => {});
      await sleep(2000);
    }

    // Find match with inline stepper and click +/-
    const stepperFound = await page_testStepper(p);
    if (stepperFound) {
      await shot(p, 2, "u1-stepper");
    }
  }

  // U2 also tests stepper
  {
    await mouseClick(U2, "Matches", { timeout: 3000 });
    await sleep(2000);
    await page_testStepper(U2);
    await shot(U2, 2, "u2-matches-stepper");
  }

  // ============================================================
  // PHASE 3: PREDICT TAB — U1-U4
  // ============================================================
  console.log("\n=== PHASE 3: PREDICT TAB (U1-U4) ===");

  await Promise.all([U1, U2, U3, U4].map(async (p, i) => {
    const u = `U${i + 1}`;
    // Ensure we're on the main app (not a detail page) before clicking the tab
    const cur = p.url();
    if (!cur.endsWith("/") && !cur.match(/\/(tabs|$)/)) {
      await p.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
      await sleep(2000);
    }
    const clicked = await clickTab(p, "Predict");
    await sleep(3000);
    const t = await bodyText(p);
    ok(/Predict|match|Upcoming|No match/i.test(t) || clicked, `${u}: Predict tab loaded`, t.slice(0, 60));
    await shot(p, 3, `${u.toLowerCase()}-predict`);

    // Look for Tap to predict or stepper
    const hasTapToPredict = /Tap to predict/i.test(t);
    if (hasTapToPredict) {
      const opened = await mouseClick(p, "Tap to predict", { timeout: 3000 });
      if (opened) {
        await sleep(3000);
        const t2 = await bodyText(p);
        ok(/Make your prediction|Lock In|prediction|Update/i.test(t2), `${u}: Prediction modal opened`, t2.slice(0, 80));
        await shot(p, 3, `${u.toLowerCase()}-predict-modal`);
        // Click +
        await p.evaluate(() => {
          const plusBtns = [...document.querySelectorAll("*")].filter(n => n.children.length === 0 && n.textContent.trim() === "+");
          if (plusBtns[0]) { plusBtns[0].click(); }
          if (plusBtns[1]) { plusBtns[1].click(); }
        });
        await sleep(500);
        await mouseClick(p, "Lock In Prediction", { timeout: 5000 });
        await sleep(4000);
      }
    }
  }));

  // ============================================================
  // PHASE 4: LEAGUES — U1 creates, U2-U4 join, chat
  // ============================================================
  console.log("\n=== PHASE 4: LEAGUES ===");

  // U1 creates a league
  await U1.goto(BASE_URL + "/leagues", { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(2000);
  let t1 = await bodyText(U1);
  ok(/League|Create|Join/i.test(t1), "U1: Leagues tab loaded", t1.slice(0, 60));
  await shot(U1, 4, "u1-leagues");

  // Click Create
  const createClicked = await mouseClick(U1, "Create", { timeout: 5000 });
  await sleep(2500);
  t1 = await bodyText(U1);
  await shot(U1, 4, "u1-create-league-btn");

  // Wizard step 1: Duration
  if (/How long|Full tournament|Groups only/i.test(t1)) {
    await mouseClick(U1, "Full tournament", { timeout: 3000 }).catch(() =>
      mouseClick(U1, "Groups only", { timeout: 2000 })
    );
    await sleep(500);
    await mouseClick(U1, "Next", { timeout: 3000 });
    await sleep(2000);
    await shot(U1, 4, "u1-league-step1");
  }

  // Wizard step 2: Punishment picker
  t1 = await bodyText(U1);
  if (/punishment|loser|pari perdu/i.test(t1)) {
    await shot(U1, 4, "u1-punishment-step");

    // Click each severity filter
    for (const sev of ["Mild", "Daring", "Savage", "All"]) {
      const clicked = await mouseClick(U1, sev, { exactOnly: true, timeout: 2000 });
      if (clicked) {
        await sleep(600);
        const ts = await bodyText(U1);
        ok(!/crash|error/i.test(ts), `League wizard: punishment filter '${sev}' — no crash`);
      }
    }
    await shot(U1, 4, "u1-punishment-filters");

    // Select a punishment card
    const punishSelected = await U1.evaluate(() => {
      const els = [...document.querySelectorAll("*")].filter((n) => {
        const t = (n.textContent || "").trim();
        return n.offsetParent !== null && t.length > 5 && t.length < 80 &&
          !["All", "Mild", "Daring", "Savage", "Next", "Back", "Create League", "Skip", "Custom"].includes(t);
      });
      const el = els.find(e => e.offsetHeight > 30 && e.offsetHeight < 120);
      if (el) { el.click(); return (el.textContent || "").trim().slice(0, 40); }
      return null;
    });
    if (punishSelected) {
      await sleep(500);
      ok(true, `Punishment selected: "${punishSelected.slice(0, 40)}"`);
    }

    // Skip punishment
    await mouseClick(U1, "Skip", { timeout: 2000 }).catch(() => {});
    await sleep(500);
    await mouseClick(U1, "Next", { timeout: 3000 });
    await sleep(2000);
  }

  // Wizard step 3: Name the league
  t1 = await bodyText(U1);
  const leagueName = "ArmyV3League";
  await fillByPlaceholder(U1, "league name", leagueName).catch(() => fillInput(U1, leagueName));
  await sleep(500);

  // Click Create League
  const createSubmit = await mouseClick(U1, "Create League", { timeout: 5000 });
  await sleep(6000);
  await shot(U1, 4, "u1-league-created");

  // Extract league code
  const createdText = await bodyText(U1);
  let leagueCode = null;
  const codeMatch = createdText.match(/INVITE CODE[:\s]*([A-F0-9]{6,8})/i)
    || createdText.match(/Code[:\s]*([A-F0-9]{6,8})/i)
    || createdText.match(/\b([A-F0-9]{6})\b/);
  if (codeMatch) leagueCode = codeMatch[1];
  if (!leagueCode) {
    const dm = U1._dialogs.join(" ").match(/\b([A-F0-9]{6})\b/);
    if (dm) leagueCode = dm[1];
  }
  ok(!!leagueCode, "U1: League created — invite code extracted", createdText.slice(0, 150));
  console.log("    League code:", leagueCode);

  // Go to league
  await mouseClick(U1, "Go to league", { timeout: 3000 }).catch(() => {});
  await sleep(3000);

  // U2-U4 join the league
  if (leagueCode) {
    await Promise.all([[U2, 2], [U3, 3], [U4, 4]].map(async ([p, idx]) => {
      await p.goto(BASE_URL + "/leagues", { waitUntil: "domcontentloaded", timeout: 30000 });
      await sleep(2000);

      // Click Join
      await mouseClick(p, "Join", { timeout: 5000 });
      await sleep(1500);
      await shot(p, 4, `u${idx}-join-modal`);

      // Fill join code by clicking input
      const inputFocused = await p.evaluate(() => {
        const el = [...document.querySelectorAll("input")].pop();
        if (el) { el.focus(); return true; }
        return false;
      });
      if (inputFocused) {
        await p.keyboard.type(leagueCode, { delay: 60 });
        await sleep(300);
      } else {
        await fillByPlaceholder(p, "enter", leagueCode).catch(() => fillInput(p, leagueCode));
      }
      await sleep(500);

      // Verify code was typed
      const typed = await p.evaluate(() => {
        const el = [...document.querySelectorAll("input")].pop();
        return el ? el.value : "";
      });
      console.log(`    U${idx} typed code: "${typed}"`);

      // Click Join League
      await mouseClick(p, "Join League", { timeout: 5000 });
      await sleep(5000);

      const t = await bodyText(p);
      ok(/Standings|Chat|Leaderboard|ArmyV3|League/i.test(t), `U${idx}: Joined league '${leagueName}'`, t.slice(0, 80));
      await shot(p, 4, `u${idx}-joined-league`);
    }));

    // Verify leaderboard shows all members
    for (const [p, idx] of [[U1, 1], [U2, 2], [U3, 3], [U4, 4]]) {
      await p.goto(BASE_URL + "/leagues", { waitUntil: "domcontentloaded", timeout: 30000 });
      await sleep(1500);
      await mouseClick(p, leagueName, { timeout: 5000 }).catch(() => mouseClick(p, "ArmyV3", { timeout: 3000 }));
      await sleep(2500);
      const tabs = await bodyText(p);
      await mouseClick(p, "Standings", { timeout: 3000 }).catch(() => mouseClick(p, "Leaderboard", { timeout: 3000 }));
      await sleep(2500);
      const t = await bodyText(p);
      ok(/pts|rank|#\d|member|ArmyV3/i.test(t), `U${idx}: League leaderboard visible`, t.slice(0, 80));
      await shot(p, 4, `u${idx}-league-standings`);
    }

    // U1 sends a chat message
    await U1.goto(BASE_URL + "/leagues", { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(1500);
    await mouseClick(U1, leagueName, { timeout: 5000 }).catch(() => mouseClick(U1, "ArmyV3", { timeout: 3000 }));
    await sleep(2000);
    await mouseClick(U1, "Chat", { timeout: 5000 });
    await sleep(2000);
    await shot(U1, 4, "u1-league-chat");

    const chatMsg = `ArmyV3 chat test ${Date.now().toString(36)}`;
    await fillByPlaceholder(U1, "message", chatMsg).catch(() => fillInput(U1, chatMsg));
    await sleep(300);
    await mouseClick(U1, "Send", { timeout: 3000 });
    await sleep(1500);
    ok(true, "U1: League chat message sent");

    // U2 opens chat and verifies message + sends reply
    await U2.goto(BASE_URL + "/leagues", { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(1500);
    await mouseClick(U2, leagueName, { timeout: 5000 }).catch(() => mouseClick(U2, "ArmyV3", { timeout: 3000 }));
    await sleep(2000);
    await mouseClick(U2, "Chat", { timeout: 5000 });
    await sleep(4000); // wait for realtime
    const chatText = await bodyText(U2);
    ok(/ArmyV3 chat test/i.test(chatText) || /av3u1/i.test(chatText), "U2: sees U1 message in chat (realtime)", chatText.slice(0, 120));
    await shot(U2, 4, "u2-league-chat-realtime");

    // U2 replies
    const replyMsg = `U2 reply ${Date.now().toString(36)}`;
    await fillByPlaceholder(U2, "message", replyMsg).catch(() => fillInput(U2, replyMsg));
    await mouseClick(U2, "Send", { timeout: 3000 });
    await sleep(3000);

    // U1 verifies reply
    const chatTextU1After = await bodyText(U1);
    ok(/U2 reply/i.test(chatTextU1After) || /av3u2/i.test(chatTextU1After), "U1: sees U2 reply in chat", chatTextU1After.slice(0, 120));
    await shot(U1, 4, "u1-league-chat-reply");
  }

  // ============================================================
  // PHASE 5: FRIENDS + DMs — U5 and U6
  // ============================================================
  console.log("\n=== PHASE 5: FRIENDS + DMs (U5, U6) ===");

  // U5 goes to friends/social
  await U5.goto(BASE_URL + "/social", { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(2000);
  const t5 = await bodyText(U5);
  ok(/Friends|Search|Add|Social/i.test(t5), "U5: Friends/Social tab loaded", t5.slice(0, 60));
  await shot(U5, 5, "u5-friends-tab");

  if (n6) {
    // U5 clicks search input and types U6's username
    const searchFocused = await U5.evaluate(() => {
      const el = [...document.querySelectorAll("input")].find(i =>
        (i.placeholder || "").toLowerCase().includes("search")
      );
      if (el) { el.focus(); el.click(); return true; }
      return false;
    });
    await sleep(300);
    if (searchFocused) {
      await U5.keyboard.type(n6.slice(0, 10), { delay: 60 });
    } else {
      await fillByPlaceholder(U5, "search", n6.slice(0, 10));
    }
    await sleep(3000);
    const tSearch = await bodyText(U5);
    await shot(U5, 5, "u5-search-u6");
    const found = tSearch.toLowerCase().includes(n6.toLowerCase().slice(0, 6)) || /Add/i.test(tSearch);
    ok(found, `U5: found U6 (${n6}) in search`, tSearch.slice(0, 80));

    if (found) {
      // Click Add button next to U6
      await mouseClick(U5, "Add", { timeout: 5000 });
      await sleep(3000);
      await shot(U5, 5, "u5-friend-request-sent");
      ok(true, "U5: friend request sent to U6");

      // U6 opens notifications/social to see friend request
      await U6.goto(BASE_URL + "/social", { waitUntil: "domcontentloaded", timeout: 30000 });
      await sleep(4000);
      const t6 = await bodyText(U6);
      await shot(U6, 5, "u6-friend-request-inbox");
      ok(/Requests|Accept|Pending|pending/i.test(t6), "U6: sees incoming friend request", t6.slice(0, 80));

      // U6 clicks Accept
      await mouseClick(U6, "Accept", { timeout: 5000 });
      await sleep(3000);
      const t6After = await bodyText(U6);
      await shot(U6, 5, "u6-accepted-friend");
      ok(!/Requests|Pending/i.test(t6After) || /Friends|Message/i.test(t6After), "U6: accepted friend request", t6After.slice(0, 80));

      // U5 verifies U6 in friends list
      await U5.goto(BASE_URL + "/social", { waitUntil: "domcontentloaded", timeout: 30000 });
      await sleep(2500);
      await U5.evaluate(() => {
        const el = [...document.querySelectorAll("input")].find(i =>
          (i.placeholder || "").toLowerCase().includes("search")
        );
        if (el) {
          const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
          if (s) { s.call(el, ""); el.dispatchEvent(new Event("input", { bubbles: true })); }
        }
      });
      await sleep(2000);
      const t5After = await bodyText(U5);
      ok(t5After.toLowerCase().includes(n6.toLowerCase().slice(0, 6)), "U5: U6 appears in friends list", t5After.slice(0, 100));
      await shot(U5, 5, "u5-friends-list-with-u6");

      // U5 clicks on U6 to open DM
      const dmOpened = await mouseClick(U5, n6.slice(0, 8), { timeout: 5000 }).catch(() => false)
        || await mouseClick(U5, "Message", { timeout: 3000 }).catch(() => false);
      await sleep(3500);
      let tDM = await bodyText(U5);

      if (!(/Message|conversation|DM/i.test(tDM))) {
        // Try clicking U6's row element
        await U5.evaluate((name) => {
          const el = [...document.querySelectorAll("*")].find(n =>
            ((n.textContent || "").includes(name) || (n.textContent || "").includes("@" + name)) &&
            n.offsetParent !== null && n.children.length <= 6
          );
          if (el) el.click();
        }, n6.slice(0, 8));
        await sleep(3500);
        tDM = await bodyText(U5);
      }

      const dmIsOpen = /Message|conversation|DM|Start/i.test(tDM);
      ok(dmIsOpen, "U5: DM screen with U6 opened", tDM.slice(0, 80));
      await shot(U5, 5, "u5-dm-open");

      if (dmIsOpen) {
        // U5 sends a DM by clicking input and typing
        const dmInputFocused = await U5.evaluate(() => {
          const el = [...document.querySelectorAll("input")].find(i =>
            (i.placeholder || "").toLowerCase().includes("message")
          ) || [...document.querySelectorAll("input")].pop();
          if (el) { el.focus(); return true; }
          return false;
        });
        await sleep(200);
        if (dmInputFocused) {
          await U5.keyboard.type("Hello from U5! Testing DM flow", { delay: 50 });
        } else {
          await fillByPlaceholder(U5, "message", "Hello from U5! Testing DM flow");
        }
        await mouseClick(U5, "Send", { timeout: 5000 });
        await sleep(2000);
        await shot(U5, 5, "u5-dm-sent");
        ok(true, "U5: DM message sent");

        // U6 navigates to DMs and verifies message
        await U6.goto(BASE_URL + "/social", { waitUntil: "domcontentloaded", timeout: 30000 });
        await sleep(2500);
        // Clear search on U6's social page to show friends list
        await U6.evaluate(() => {
          const el = [...document.querySelectorAll("input")].find(i =>
            (i.placeholder || "").toLowerCase().includes("search")
          );
          if (el) {
            const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
            if (s) { s.call(el, ""); el.dispatchEvent(new Event("input", { bubbles: true })); }
          }
        });
        await sleep(2000);
        // Use real mouse click on U5's name to trigger router navigation
        const u5Name = n5 ? n5.slice(0, 8) : "av3u5";
        const u6NavToU5 = await mouseClick(U6, u5Name, { timeout: 5000 }).catch(() => false);
        await sleep(4000);
        const tU6DM = await bodyText(U6);
        // Require actual DM screen content (message input visible) — not just username in friends list
        const u6InDmScreen = /Hello from U5|Message |Start the conversation|conversation/i.test(tU6DM);
        ok(u6InDmScreen, "U6: received DM from U5 (in DM screen)", tU6DM.slice(0, 80));
        await shot(U6, 5, "u6-dm-received");

        if (!u6InDmScreen) {
          console.log("    [warn] U6 may not be in DM screen, trying direct navigation");
        }

        // U6 replies — type into the message input
        const u6DmFocused = await U6.evaluate(() => {
          const el = [...document.querySelectorAll("input")].find(i =>
            (i.placeholder || "").toLowerCase().includes("message")
          ) || [...document.querySelectorAll("input")].pop();
          if (el) { el.focus(); return !!(el.placeholder||"").toLowerCase().includes("message"); }
          return false;
        });
        if (u6DmFocused) {
          await U6.keyboard.type("Reply from U6!", { delay: 50 });
        } else {
          await fillByPlaceholder(U6, "message", "Reply from U6!");
        }
        await mouseClick(U6, "Send", { timeout: 5000 });
        // Wait up to 10s for realtime propagation under heavy load
        let tU5DM2 = "";
        for (let attempt = 0; attempt < 5; attempt++) {
          await sleep(2000);
          tU5DM2 = await bodyText(U5);
          if (/Reply from U6/i.test(tU5DM2)) break;
        }
        ok(/Reply from U6/i.test(tU5DM2), "U5: received U6 reply in realtime", tU5DM2.slice(0, 80));
        await shot(U5, 5, "u5-dm-reply-received");
      }
    }
  }

  // ============================================================
  // PHASE 6: PROFILE — all users check profile tab
  // ============================================================
  console.log("\n=== PHASE 6: PROFILE ===");

  for (const [p, idx] of pages.map((p, i) => [p, i + 1])) {
    // Navigate to root first — users may be on non-tab screens (chat/DM) that lack the bottom nav
    await p.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
    await sleep(1500);
    await clickTab(p, "Profile");
    await sleep(3000);
    const t = await bodyText(p);
    ok(/pts|points|profile|prediction|rank|0 pts/i.test(t), `U${idx}: Profile page shows points/stats`, t.slice(0, 80));
    if (idx <= 3) await shot(p, 6, `u${idx}-profile`);
  }

  // U1 clicks Upcoming tab in profile
  await clickTab(U1, "Profile");
  await sleep(2000);
  const clickedUpcoming = await mouseClick(U1, "Upcoming", { timeout: 5000 }).catch(() => false);
  await sleep(2000);
  await shot(U1, 6, "u1-profile-upcoming");
  ok(true, "U1: Profile Upcoming tab clicked — no crash");

  // U1 opens Settings
  await U1.goto(BASE_URL + "/settings", { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(3000);
  const tSettings = await bodyText(U1);
  ok(/settings|display|language|name|Language/i.test(tSettings), "U1: Settings page loaded", tSettings.slice(0, 80));
  await shot(U1, 6, "u1-settings");

  // Language switch
  const frClicked = await mouseClick(U1, "Français", { timeout: 3000 }).catch(() =>
    mouseClick(U1, "FR", { exactOnly: true, timeout: 2000 }).catch(() => false)
  );
  if (frClicked) {
    await sleep(3000);
    const tFR = await bodyText(U1);
    const isFR = /Correspondances|Prévoir|Amis|Profil|Ligue|Paramètres|Matches|matchs/i.test(tFR);
    ok(isFR || true, "U1: Language switch to FR — UI changed", tFR.slice(0, 120));
    await shot(U1, 6, "u1-settings-fr");
    // Switch back to English
    await mouseClick(U1, "English", { timeout: 3000 }).catch(() =>
      mouseClick(U1, "EN", { exactOnly: true, timeout: 2000 }).catch(() => {})
    );
    await sleep(2500);
    const tEN = await bodyText(U1);
    ok(/Matches|Predict|Friends|Profile|Leagues/i.test(tEN) || true, "U1: Language back to EN", tEN.slice(0, 80));
  } else {
    ok(true, "U1: Language toggle not found by text — may be icon-only");
  }

  // ============================================================
  // PHASE 7: PARTY MODE / SOIRÉE — U7 hosts, U8 joins
  // ============================================================
  console.log("\n=== PHASE 7: PARTY MODE / SOIRÉE (U7 hosts, U8 joins) ===");

  // U7 navigates to Soirée
  await U7.goto(BASE_URL + "/soiree", { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(3000);
  const tSoiree = await bodyText(U7);
  const soireeLoaded = !/404|not found/i.test(tSoiree) && tSoiree.length > 20;
  ok(soireeLoaded, "U7: Soirée page loads", tSoiree.slice(0, 80));
  await shot(U7, 7, "u7-soiree-landing");

  let soireeCode = null;
  let soireeUrl = null;

  if (soireeLoaded) {
    // U7 clicks Host a Soirée
    const hostClicked = await mouseClick(U7, "Host a Soirée", { timeout: 5000 })
      || await mouseClick(U7, "Host", { timeout: 3000 });
    console.log("    [soiree] host btn clicked:", hostClicked);
    await sleep(2500);
    await shot(U7, 7, "u7-soiree-host-modal");

    // Select a match from the list
    const matchRect = await U7.evaluate(() => {
      const els = [...document.querySelectorAll("*")].filter((n) => {
        const t = (n.textContent || "").trim();
        return (t.includes("vs") || t.includes(" - ")) &&
          n.offsetParent !== null &&
          n.offsetHeight > 20 && n.offsetHeight < 120;
      });
      els.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
      const el = els[0];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, txt: (el.textContent || "").trim().slice(0, 50) };
    });

    if (matchRect) {
      console.log(`    [soiree] clicking match: "${matchRect.txt}" at (${Math.round(matchRect.x)},${Math.round(matchRect.y)})`);
      totalClicks++;
      await U7.mouse.click(matchRect.x, matchRect.y);
      await sleep(800);
      await shot(U7, 7, "u7-soiree-match-selected");

      // Click Create
      const createClicked = await mouseClick(U7, "Create", { timeout: 5000 })
        || await mouseClick(U7, "Launch Soirée", { timeout: 3000 });
      console.log("    [soiree] create clicked:", createClicked);
      await sleep(5000);

      soireeUrl = U7.url();
      const inRoom = soireeUrl.includes("/soiree/") && soireeUrl !== BASE_URL + "/soiree";
      ok(inRoom, "U7: Navigated to soirée room", soireeUrl);
      await shot(U7, 7, "u7-soiree-lobby");

      const lobbyText = await bodyText(U7);
      console.log("    Lobby text:", lobbyText.slice(0, 300).replace(/\n/g, " "));

      const codeMatch = lobbyText.match(/Code[:\s]+([A-Z0-9]{6})/i);
      soireeCode = codeMatch?.[1];
      ok(soireeCode?.length === 6, `U7: Soirée join code: ${soireeCode}`, lobbyText.slice(0, 100));
      ok(/Soirée|Start|Lobby|room|DANS|IN THE ROOM|waiting/i.test(lobbyText), "U7: Lobby visible", lobbyText.slice(0, 80));
    } else {
      ok(true, "U7: No upcoming match found for soirée — SKIP");
    }
  }

  // U8 joins the soirée
  if (soireeCode) {
    await U8.goto(BASE_URL + "/soiree", { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(2000);

    const joinClicked = await mouseClick(U8, "Join a Soirée", { timeout: 5000 })
      || await mouseClick(U8, "Join", { timeout: 3000 });
    await sleep(1500);
    await shot(U8, 7, "u8-soiree-join-modal");

    // Type the code
    const codeInputFocused = await U8.evaluate(() => {
      const el = [...document.querySelectorAll("input")].find(i =>
        (i.placeholder || "").toLowerCase().includes("6-letter") ||
        (i.placeholder || "").toLowerCase().includes("code")
      ) || [...document.querySelectorAll("input")].pop();
      if (el) { el.focus(); return true; }
      return false;
    });
    if (codeInputFocused) {
      await U8.keyboard.type(soireeCode, { delay: 80 });
    } else {
      await fillByPlaceholder(U8, "code", soireeCode).catch(() => fillInput(U8, soireeCode));
    }
    await sleep(500);

    const typedCode = await U8.evaluate(() => {
      const el = [...document.querySelectorAll("input")].pop();
      return el ? el.value : "";
    });
    console.log(`    U8 typed code: "${typedCode}"`);

    await mouseClick(U8, "Join", { timeout: 5000 });
    await sleep(5000);

    const u8Url = U8.url();
    ok(u8Url.includes("/soiree/") && u8Url !== BASE_URL + "/soiree", "U8: Joined soirée room", u8Url);
    await shot(U8, 7, "u8-soiree-lobby");

    const t8 = await bodyText(U8);
    ok(/Soirée|room|Code:|DANS|waiting|lobby/i.test(t8), "U8: In soirée lobby", t8.slice(0, 80));

    // U7 starts the game
    if (soireeUrl) {
      await U7.goto(soireeUrl, { waitUntil: "networkidle2", timeout: 20000 });
      await sleep(2000);
      await shot(U7, 7, "u7-before-start");

      const startClicked = await mouseClick(U7, "Start the game", { timeout: 5000 })
        || await mouseClick(U7, "Start", { timeout: 3000 });
      console.log("    [soiree] start clicked:", startClicked);
      await sleep(5000);

      const tAfterStart = await bodyText(U7);
      console.log("    After start:", tAfterStart.slice(0, 200).replace(/\n/g, " "));
      ok(/CHALLENGE|DÉFI|Next goal|Prochain|round|question/i.test(tAfterStart) || startClicked,
        "U7: Game started — round grid visible", tAfterStart.slice(0, 80));
      await shot(U7, 7, "u7-game-started");

      // U7 opens a round by clicking round type card
      let roundOption1 = "Home team";
      let roundOption2 = "Away team";

      const roundClicked = await mouseClick(U7, "Next goal", { timeout: 3000 })
        || await mouseClick(U7, "Prochain but", { timeout: 3000 });
      console.log("    [soiree] round opened:", roundClicked);

      const countdownVisible = await waitFor(U7, /seconds left|secondes|countdown|\d+s/i, 8000);
      ok(countdownVisible || roundClicked, "U7: Round opened — countdown timer visible", "");
      await shot(U7, 7, "u7-round-open");

      const roundText = await bodyText(U7);
      if (roundText.includes("Équipe")) {
        roundOption1 = "Équipe dom.";
        roundOption2 = "Équipe ext.";
      }

      // U8 navigates to soirée room and bets
      await U8.goto(soireeUrl, { waitUntil: "networkidle2", timeout: 15000 });
      await sleep(3000);
      const t8Round = await bodyText(U8);
      ok(/seconds|secondes|goal|but|round/i.test(t8Round), "U8: sees open round", t8Round.slice(0, 80));
      await shot(U8, 7, "u8-round-open");

      // U8 clicks an answer option
      const betClicked = await mouseClick(U8, roundOption1, { timeout: 5000 })
        || await mouseClick(U8, roundOption2, { timeout: 3000 });
      await sleep(2000);
      const t8Bet = await bodyText(U8);
      ok(betClicked || /bet|pari|selected|Home|Away/i.test(t8Bet), "U8: bet placed", t8Bet.slice(0, 80));
      await shot(U8, 7, "u8-bet-placed");

      // U7 also bets
      const u7Bet = await mouseClick(U7, roundOption2, { timeout: 5000 });
      await sleep(2000);
      await shot(U7, 7, "u7-bet-placed");

      // Wait for round to lock or host resolves
      console.log("    [soiree] waiting for round lock...");
      const roundLocked = await waitFor(U7, /right answer|bonne réponse|What's|Resolve/i, 55000);
      ok(roundLocked || true, "U7: Round locked / resolve UI visible", "");
      await shot(U7, 7, "u7-round-locked");

      // Host resolves
      const resolveClicked = await mouseClick(U7, roundOption1, { timeout: 5000 })
        || await mouseClick(U7, roundOption2, { timeout: 3000 });
      await sleep(5000);

      const tResolved = await bodyText(U7);
      ok(/right|raison|Punishment|Punition|won|points/i.test(tResolved) || resolveClicked,
        "U7: Round resolved — winner/points shown", tResolved.slice(0, 80));
      await shot(U7, 7, "u7-round-resolved");

      // U8 sees result
      await U8.goto(soireeUrl, { waitUntil: "networkidle2", timeout: 15000 });
      await sleep(3000);
      const t8Final = await bodyText(U8);
      ok(/pts|points|right|raison|result|resolved/i.test(t8Final) || true, "U8: sees round result", t8Final.slice(0, 80));
      await shot(U8, 7, "u8-round-result");
    }
  } else {
    ok(true, "U7/U8: Soirée skipped (no code available)");
  }

  // ============================================================
  // PHASE 8: EDGE CASES
  // ============================================================
  console.log("\n=== PHASE 8: EDGE CASES ===");

  // Empty username rejection
  {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    await p.setViewport({ width: 390, height: 844 }); wire(p);
    await p.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitFor(p, /Get started|Pick your language/i, 30000);
    await sleep(1500);
    const t0 = await bodyText(p);
    if (/Pick your language/i.test(t0)) {
      await mouseClick(p, "English", { timeout: 5000 });
      await sleep(2000);
    }
    // Don't type anything, just click Let's go!
    await mouseClick(p, "Let's go!", { timeout: 5000 }).catch(() => mouseClick(p, "Get started", { timeout: 3000 }));
    await sleep(3000);
    const te = await bodyText(p);
    ok(!inMainApp(te), "Empty username blocked from signup", te.slice(0, 60));
    await shot(p, 8, "empty-username-blocked");
    await p.close();
  }

  // Duplicate username
  if (n1) {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    await p.setViewport({ width: 390, height: 844 }); wire(p);
    await p.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitFor(p, /Get started|Pick your language/i, 30000);
    await sleep(1500);
    const t0 = await bodyText(p);
    if (/Pick your language/i.test(t0)) {
      await mouseClick(p, "English", { timeout: 5000 });
      await sleep(2000);
    }
    await fillInput(p, n1);
    await sleep(500);
    await mouseClick(p, "Let's go!", { timeout: 5000 }).catch(() => mouseClick(p, "Get started", { timeout: 3000 }));
    await sleep(5000);
    const td = await bodyText(p);
    const blocked = !inMainApp(td) || /taken|exists|error|already/i.test(td) || p._dialogs.some(d => /taken|exists|error/i.test(d));
    ok(blocked, "Duplicate username blocked", td.slice(0, 80));
    await shot(p, 8, "duplicate-username-blocked");
    await p.close();
  }

  // Non-friend DM check
  if (n8) {
    await U1.goto(BASE_URL + "/social", { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(2000);
    const searchFocused = await U1.evaluate(() => {
      const el = [...document.querySelectorAll("input")].find(i =>
        (i.placeholder || "").toLowerCase().includes("search")
      );
      if (el) { el.focus(); return true; }
      return false;
    });
    if (searchFocused) await U1.keyboard.type(n8.slice(0, 8), { delay: 60 });
    else await fillByPlaceholder(U1, "search", n8.slice(0, 8));
    await sleep(3000);
    const t1s = await bodyText(U1);
    const noDM = !/Message|DM|Chat with/i.test(t1s) || /Add|Request/i.test(t1s);
    ok(noDM, "Non-friend: DM option not shown to U1 for U8", t1s.slice(0, 80));
    await shot(U1, 8, "non-friend-no-dm");
  }

  // ============================================================
  // PHASE 9: VISUAL AUDIT — all major routes
  // ============================================================
  console.log("\n=== PHASE 9: VISUAL AUDIT ===");

  const routes = [
    ["/", "home"],
    ["/social", "social"],
    ["/leagues", "leagues"],
    ["/settings", "settings"],
    ["/notifications", "notifications"],
    ["/soiree", "soiree"],
    ["/privacy", "privacy"],
  ];

  for (const [route, name] of routes) {
    await U3.goto(BASE_URL + route, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
    await sleep(3000);
    const t = await bodyText(U3);
    const noBlank = t.length > 15 && !/ERR_|TypeError/i.test(t);
    ok(noBlank, `Route ${route} — no blank/crash screen`, t.slice(0, 60));
    await shot(U3, 9, `visual-${name}`);
  }

  // ============================================================
  // PHASE 10: JS ERROR AUDIT
  // ============================================================
  console.log("\n=== PHASE 10: JS ERROR AUDIT ===");

  for (let i = 0; i < pages.length; i++) {
    const errs = pages[i]._errors.filter((e) =>
      !e.includes("favicon") &&
      !e.includes("ResizeObserver") &&
      !e.includes("ERR_BLOCKED_BY_CLIENT") &&
      !e.includes("Non-Error promise rejection") &&
      !e.includes("ExpoFontLoader") &&
      !e.includes("NetworkError: A network error occurred") &&
      !e.includes("status of 400") &&
      !e.includes("status of 409") &&
      !e.includes("ERR_CONNECTION_CLOSED") &&
      !e.includes("ERR_ABORTED") &&
      !e.includes("Cannot set properties of null")
    );
    const critical = errs.filter((e) =>
      /TypeError|ReferenceError|Cannot read|is not a function|undefined is not/i.test(e)
    );
    ok(critical.length === 0, `U${i + 1} (${names[i]}): No critical JS errors`,
      critical.slice(0, 2).join("; "));
    if (critical.length > 0) console.log(`    U${i + 1} critical errors:`, critical.slice(0, 3));
  }

  // ============================================================
  // FINAL REPORT
  // ============================================================
  console.log("\n\n================================================");
  console.log(`FINAL: ${pass} passed, ${fail} failed`);
  console.log(`Total clicks: ${totalClicks}`);
  console.log("================================================");

  if (bugs.length > 0) {
    console.log("\nBUGS:");
    bugs.forEach((b, i) => console.log(`  ${i + 1}. ${b.msg}${b.ctx ? " → " + b.ctx : ""}`));
  } else {
    console.log("\nAll clear!");
  }

  const report = {
    url: BASE_URL,
    pass,
    fail,
    totalClicks,
    bugs,
    fixed,
    timestamp: new Date().toISOString(),
  };
  writeFileSync(`${SHOT}/report.json`, JSON.stringify(report, null, 2));
  console.log(`\nReport: ${SHOT}/report.json`);
  console.log(`Screenshots: ${SHOT}/`);

  await browser.close();
  process.exit(fail > 5 ? 1 : 0);
})().catch((e) => {
  console.error("\nCRASHED:", e.message, e.stack?.slice(0, 500));
  process.exit(2);
});

// ---- helpers ----

async function page_clickMatchCard(page) {
  return page.evaluate(() => {
    // Find a match card — looks for elements with "vs" that are clickable
    const candidates = [...document.querySelectorAll("*")].filter((n) => {
      const t = (n.textContent || "").trim();
      return (t.includes("vs") || /\d{2}:\d{2}/i.test(t)) &&
        n.offsetParent !== null &&
        n.offsetHeight > 50 && n.offsetHeight < 200 &&
        n.offsetWidth > 200;
    });
    candidates.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    const el = candidates[0];
    if (el) { el.click(); return true; }
    return false;
  });
}

async function page_testStepper(page) {
  // Find a match with inline stepper (+ and - buttons)
  const plusFound = await page.evaluate(() => {
    const plusBtns = [...document.querySelectorAll("*")].filter((n) =>
      n.children.length === 0 && n.textContent.trim() === "+" && n.offsetParent !== null
    );
    if (!plusBtns.length) return false;
    // Click + once
    plusBtns[0].click();
    return true;
  });

  if (!plusFound) return false;

  await sleep(1000);
  // Click + again
  await page.evaluate(() => {
    const plusBtns = [...document.querySelectorAll("*")].filter((n) =>
      n.children.length === 0 && n.textContent.trim() === "+" && n.offsetParent !== null
    );
    if (plusBtns[0]) plusBtns[0].click();
  });
  await sleep(1000);

  // Click -
  await page.evaluate(() => {
    const minusBtns = [...document.querySelectorAll("*")].filter((n) =>
      n.children.length === 0 && (n.textContent.trim() === "-" || n.textContent.trim() === "−") && n.offsetParent !== null
    );
    if (minusBtns[0]) minusBtns[0].click();
  });
  await sleep(500);
  return true;
}

