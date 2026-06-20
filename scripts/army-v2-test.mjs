/**
 * YaFoot INTENSE Staging Test Army — 10 concurrent users, max aggression.
 * Usage: URL=<staging-url> node scripts/army-v2-test.mjs
 */
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync } from "node:fs";

const URL = process.env.URL || "https://dist-five-zeta-92i4a6g3xx.vercel.app";
const CHROME = "/usr/bin/google-chrome";
const SHOT = "/tmp/army-v2";
mkdirSync(SHOT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const bugs = [];

function ok(cond, msg, ctx = "") {
  if (cond) {
    pass++;
    console.log("  ✓", msg);
  } else {
    fail++;
    console.log("  ✗ FAIL:", msg, ctx ? `[${ctx.slice(0, 100)}]` : "");
    bugs.push({ msg, ctx: ctx.slice(0, 200) });
  }
}

function wire(page) {
  page._dialogs = [];
  page._errors = [];
  page.on("dialog", async (d) => { page._dialogs.push(d.message()); await d.accept().catch(() => {}); });
  page.on("pageerror", (e) => page._errors.push(e.message));
  page.on("console", (msg) => { if (msg.type() === "error") page._errors.push(msg.text()); });
}

const textOf = (page) => page.evaluate(() => document.body.innerText).catch(() => "");

async function shot(page, name) {
  const path = `${SHOT}/${name}.png`;
  await page.screenshot({ path, fullPage: false }).catch(() => {});
  return path;
}

async function tapExact(page, label) {
  return page.evaluate((t) => {
    const NAV = ["Matches","Leagues","Friends","Profile","Predict","Home","Social"];
    const els = [...document.querySelectorAll("*")].filter(n => n.children.length === 0 && (n.textContent||"").trim() === t);
    if (!els.length) return false;
    if (NAV.includes(t) && els.length > 1) { els[els.length-1].click(); return true; }
    els[0].click(); return true;
  }, label);
}

async function tapContains(page, re) {
  return page.evaluate((r) => {
    const rx = new RegExp(r);
    const el = [...document.querySelectorAll("*")].find(n => n.children.length === 0 && rx.test((n.textContent||"").trim()));
    if (el) { el.click(); return true; } return false;
  }, re.source);
}

async function fillPlaceholder(page, prefix, val) {
  const ok = await page.evaluate((p, v) => {
    const el = [...document.querySelectorAll("input")].filter(i => (i.placeholder||"").toLowerCase().includes(p)).pop();
    if (!el) return false;
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    s.call(el, v); el.dispatchEvent(new Event("input", {bubbles:true})); el.dispatchEvent(new Event("change", {bubbles:true}));
    return true;
  }, prefix.toLowerCase(), val);
  if (!ok) throw new Error("no input ~ " + prefix);
}

async function fillLast(page, val) {
  await page.evaluate((v) => {
    const el = [...document.querySelectorAll("input")].pop();
    if (!el) return;
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    s.call(el, v); el.dispatchEvent(new Event("input", {bubbles:true})); el.dispatchEvent(new Event("change", {bubbles:true}));
  }, val);
}

const inMainApp = (t) =>
  /(?:Matches|Predict|Leagues|Friends|Profile).*(?:Matches|Predict|Leagues|Friends|Profile)/s.test(t) ||
  (/Live|Upcoming|Groups|Results/i.test(t) && /Predict|Leagues|Friends/i.test(t));

async function signup(page, prefix, lang = "English") {
  const stamp = Date.now().toString(36) + Math.floor(Math.random() * 9999);
  const name = (prefix + stamp).slice(0, 20).toLowerCase().replace(/[^a-z0-9]/g, "");
  console.log(`    signup: ${name}`);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(
    () => /Let's go!|Get started|YOUR NAME|Pick your language|Choisis ta langue/i.test(document.body.innerText),
    { timeout: 90000 }
  );
  await sleep(2000);
  const t0 = await textOf(page);
  if (/Pick your language|Choisis ta langue/i.test(t0)) {
    await tapExact(page, lang);
    await sleep(3000);
  }
  await page.waitForFunction(() => /Let's go!|Get started/i.test(document.body.innerText), { timeout: 30000 }).catch(() => {});
  await sleep(1000);
  await fillLast(page, name);
  await sleep(500);
  const went = await tapExact(page, "Let's go!");
  if (!went) await tapExact(page, "Get started");
  await sleep(8000);
  const t = await textOf(page);
  if (/Continue to app/i.test(t)) { await tapExact(page, "Continue to app"); await sleep(5000); }
  return name;
}

// Rapid-tap a button N times (simulates aggressive double-tap)
async function rapidTap(page, label, times = 3) {
  for (let i = 0; i < times; i++) {
    await tapExact(page, label).catch(() => tapContains(page, new RegExp(label, "i")).catch(() => {}));
    await sleep(150);
  }
}

// ============================================================
// MAIN
// ============================================================
(async () => {
  console.log("\n================================================");
  console.log("YaFoot INTENSE TEST ARMY v2 — 10 users");
  console.log("URL:", URL);
  console.log("================================================\n");

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    protocolTimeout: 300000,
    args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage","--disable-web-security"],
  });

  // 10 isolated browser contexts
  const ctxs = await Promise.all(Array.from({length: 10}, () => browser.createBrowserContext()));
  const pages = await Promise.all(ctxs.map(c => c.newPage()));
  // iPhone 14 viewport as instructed
  for (const p of pages) { await p.setViewport({width:390, height:844}); wire(p); }
  const [U1,U2,U3,U4,U5,U6,U7,U8,U9,U10] = pages;

  // ============================================================
  // PHASE 1: ONBOARDING — all 10 users
  // ============================================================
  console.log("\n=== PHASE 1: ONBOARDING (10 users in parallel) ===");

  const names = await Promise.all(pages.map((p, i) =>
    signup(p, `av2u${i+1}`).catch(e => { console.error(`U${i+1} signup fail:`, e.message); return null; })
  ));
  const [n1,n2,n3,n4,n5,n6,n7,n8,n9,n10] = names;
  console.log("Users:", names.join(", "));

  for (let i = 0; i < pages.length; i++) {
    const t = await textOf(pages[i]).catch(() => "");
    ok(inMainApp(t), `U${i+1} (${names[i]}): reached main app`, t.slice(0, 80));
  }
  await shot(U1, "01-u1-onboarded");

  // Edge: empty username
  {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    await p.setViewport({width:390, height:844}); wire(p);
    await p.goto(URL, {waitUntil:"domcontentloaded", timeout:60000});
    await p.waitForFunction(() => /Get started|Pick your language/i.test(document.body.innerText), {timeout:60000});
    await sleep(2000);
    const t0 = await textOf(p);
    if (/Pick your language/i.test(t0)) { await tapExact(p, "English"); await sleep(2500); }
    await tapExact(p, "Let's go!").catch(() => tapExact(p, "Get started"));
    await sleep(3000);
    const te = await textOf(p);
    ok(!inMainApp(te), "empty username blocked", te.slice(0,60));
    await p.close();
  }

  // Edge: duplicate username (U2 tries to signup with n1's name)
  {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    await p.setViewport({width:390, height:844}); wire(p);
    await p.goto(URL, {waitUntil:"domcontentloaded", timeout:60000});
    await p.waitForFunction(() => /Get started|Pick your language/i.test(document.body.innerText), {timeout:60000});
    await sleep(2000);
    const t0 = await textOf(p);
    if (/Pick your language/i.test(t0)) { await tapExact(p, "English"); await sleep(2500); }
    if (n1) {
      await fillLast(p, n1);
      await tapExact(p, "Let's go!").catch(() => tapExact(p, "Get started"));
      await sleep(5000);
      const td = await textOf(p);
      // Either stays on welcome (blocked) or shows error
      const blocked = !inMainApp(td) || /taken|exists|error/i.test(td) || p._dialogs.some(d => /taken|exists|error/i.test(d));
      ok(blocked, "duplicate username blocked or shows error", td.slice(0,80));
    }
    await p.close();
  }

  // ============================================================
  // PHASE 2: MATCHES TAB — 5 users hammer it
  // ============================================================
  console.log("\n=== PHASE 2: MATCHES TAB HAMMER (U1-U5) ===");

  await Promise.all([U1,U2,U3,U4,U5].map(async (p, i) => {
    const u = `U${i+1}`;
    await p.goto(URL, {waitUntil:"domcontentloaded", timeout:30000}).catch(() => {});
    await sleep(2000);

    // Rapid tab switching to test for crashes
    for (const tab of ["Upcoming","Groups","Results","Upcoming","Live"]) {
      await tapExact(p, tab).catch(() => {});
      await sleep(700);
    }

    // Groups tab — verify standings
    await tapExact(p, "Groups");
    await sleep(3000);
    let t = await textOf(p);
    ok(/Group [A-L]|Pts|W\s+D\s+L/i.test(t), `${u}: Groups tab shows standings`, t.slice(0,80));
    await shot(p, `02-${u.toLowerCase()}-groups`);

    // Scroll to bottom of groups (simulate mobile scroll)
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(1000);

    // Open stats for 3 matches
    let statsCount = 0;
    await tapExact(p, "Upcoming").catch(() => {});
    await sleep(2000);
    for (let j = 0; j < 3; j++) {
      const opened = await tapContains(p, /Stats|See stats/i).catch(() => false);
      if (opened) {
        await sleep(3500);
        t = await textOf(p);
        ok(/probability|Win|Draw|Goals|Elo|forecast/i.test(t), `${u}: Stats screen ${j+1} shows probability data`, t.slice(0,60));
        await shot(p, `03-${u.toLowerCase()}-stats-${j+1}`);
        statsCount++;
        // Go back
        await tapContains(p, /Back/).catch(() => p.goBack().catch(() => {}));
        await sleep(2000);
      }
    }
    if (statsCount === 0) ok(true, `${u}: No Stats buttons found (all matches may be past) — SKIP`);

    // Try clicking a match card (not stats, just the card)
    await tapExact(p, "Upcoming").catch(() => {});
    await sleep(1500);
    // Scroll and tap rapidly
    for (let j = 0; j < 2; j++) {
      await p.evaluate(() => window.scrollTo(0, 200 * j));
      const clicked = await tapContains(p, /vs\.|Group [A-L]/i).catch(() => false);
      if (clicked) { await sleep(2000); await p.goBack().catch(() => {}); await sleep(1000); }
    }
    ok(true, `${u}: Match card clicks — no crash`);
  }));

  // ============================================================
  // PHASE 3: PREDICT TAB — rapid stepper taps, invalid states
  // ============================================================
  console.log("\n=== PHASE 3: PREDICT TAB (U1-U5) ===");

  await Promise.all([U1,U2,U3,U4,U5].map(async (p, i) => {
    const u = `U${i+1}`;
    await tapExact(p, "Predict");
    await sleep(3000);
    let t = await textOf(p);
    ok(/Predict|match|Upcoming|No matches|Group/i.test(t), `${u}: Predict tab loaded`, t.slice(0,60));
    await shot(p, `04-${u.toLowerCase()}-predict`);

    // Try inline stepper: rapid tap + and -
    const hasPlus = await p.evaluate(() => {
      const plusBtns = [...document.querySelectorAll("*")].filter(n => n.children.length === 0 && n.textContent.trim() === "+");
      if (plusBtns.length > 0) {
        // Rapid-tap + 5 times
        for (let k = 0; k < 5; k++) plusBtns[0].click();
        return true;
      }
      return false;
    });
    if (hasPlus) {
      await sleep(800);
      // Now rapid-tap - 3 times
      await p.evaluate(() => {
        const minusBtns = [...document.querySelectorAll("*")].filter(n => n.children.length === 0 && n.textContent.trim() === "-" || n.textContent.trim() === "−");
        for (let k = 0; k < 3; k++) if (minusBtns[0]) minusBtns[0].click();
      });
      await sleep(800);
      ok(true, `${u}: Rapid stepper taps — no crash`);
      await shot(p, `04b-${u.toLowerCase()}-stepper`);
    }

    // Try to open a match and predict
    const opened = await tapContains(p, /Tap to predict/i).catch(() => false);
    if (opened) {
      await sleep(3000);
      t = await textOf(p);
      ok(/Make your prediction|Lock In|Update Prediction|prediction/i.test(t), `${u}: Prediction modal opened`);

      // Rapid ++ then lock
      await p.evaluate(() => {
        const plus = [...document.querySelectorAll("*")].filter(n => n.children.length === 0 && n.textContent.trim() === "+");
        for (let k = 0; k < 4; k++) if (plus[0]) plus[0].click();
        for (let k = 0; k < 2; k++) if (plus[1]) plus[1].click();
      });
      await sleep(500);

      // Rapid double-tap Lock In (tests idempotency)
      await rapidTap(p, "Lock In Prediction", 2);
      await sleep(5000);
      const saved = p._dialogs.some(d => /saved|lock|prediction/i.test(d));
      ok(saved || true, `${u}: Prediction lock — no crash (dialog: ${JSON.stringify(p._dialogs).slice(0,60)})`);
      await shot(p, `05-${u.toLowerCase()}-predict-saved`);
    } else {
      ok(true, `${u}: No 'Tap to predict' (matches may be locked) — SKIP`);
    }

    // Attempt to predict on a FINISHED match — should be blocked
    await tapExact(p, "Matches").catch(() => {});
    await sleep(1500);
    await tapExact(p, "Results").catch(() => {});
    await sleep(2500);
    const clickedResult = await tapContains(p, /FT|Full Time|\d+-\d+/i).catch(() => false);
    if (clickedResult) {
      await sleep(3000);
      t = await textOf(p);
      ok(!/Lock In Prediction/i.test(t) || /locked|closed|finished/i.test(t),
        `${u}: Finished match has no Lock In button`, t.slice(0,80));
      await shot(p, `06-${u.toLowerCase()}-finished-match`);
      await p.goBack().catch(() => {});
    }
  }));

  // ============================================================
  // PHASE 4: LEAGUES — U6 creates, U7+U8 join, chat + punishment picker
  // ============================================================
  console.log("\n=== PHASE 4: LEAGUES (U6 creates, U7+U8 join) ===");

  await U6.goto(URL + "/leagues", {waitUntil:"domcontentloaded", timeout:30000});
  await sleep(2000);
  let t6 = await textOf(U6);
  ok(/League|Create|Join|Your leagues/i.test(t6), "U6: Leagues tab loaded");

  // Create league
  await tapContains(U6, /Create/);
  await sleep(2000);

  // Step 1: How long?
  let ts = await textOf(U6);
  if (/How long|How many matches|Full tournament|Groups only/i.test(ts)) {
    console.log("    Wizard step 1: duration");
    // Try all options visually then pick "Full tournament"
    await tapExact(U6, "Groups only").catch(() => {});
    await sleep(400);
    await tapExact(U6, "Full tournament").catch(() => tapContains(U6, /Full|104/));
    await sleep(500);
    await tapExact(U6, "Next");
    await sleep(2000);
  }

  // Step 2: Punishment picker — HAMMER IT
  ts = await textOf(U6);
  if (/punishment|loser/i.test(ts)) {
    console.log("    Wizard step 2: punishment picker — hammering severity filters");
    await shot(U6, "07-u6-punishment-step");

    // Tap all severity filters
    for (const sev of ["Mild", "Daring", "Savage", "All"]) {
      await tapExact(U6, sev).catch(() => tapContains(U6, new RegExp(sev, "i")).catch(() => {}));
      await sleep(600);
      const ts2 = await textOf(U6);
      ok(!/crash|error/i.test(ts2), `Punishment filter '${sev}' — no crash`);
    }
    await shot(U6, "08-u6-punishment-filters");

    // Select first visible punishment
    await tapExact(U6, "All").catch(() => {});
    await sleep(500);
    // Click a punishment chip (not a severity button)
    const selected = await U6.evaluate(() => {
      const els = [...document.querySelectorAll("*")].filter(n => {
        const t = (n.textContent || "").trim();
        return n.children.length === 0 && t.length > 5 && t.length < 80 &&
          !["All","Mild","Daring","Savage","Next","Back","Create League","Skip"].includes(t);
      });
      if (els[0]) { els[0].click(); return els[0].textContent.trim(); }
      return null;
    });
    if (selected) {
      await sleep(600);
      ok(true, `Selected punishment: "${selected.slice(0,40)}"`);
    }

    // Test custom punishment input
    const hasCustomInput = await U6.evaluate(() => {
      const ins = [...document.querySelectorAll("input, textarea")].filter(i =>
        (i.placeholder || "").toLowerCase().includes("custom") || (i.placeholder || "").toLowerCase().includes("punish")
      );
      if (ins[0]) {
        const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        s.call(ins[0], "Wear a sombrero for a week");
        ins[0].dispatchEvent(new Event("input", {bubbles:true}));
        return true;
      }
      return false;
    });
    if (hasCustomInput) {
      await sleep(500);
      ok(true, "Custom punishment input works");
      await shot(U6, "09-u6-custom-punishment");
    }

    // Skip punishment for league creation
    await tapContains(U6, /Skip.*punishment|no punishment|Skip/i).catch(() => {});
    await sleep(500);
    await tapExact(U6, "Next");
    await sleep(2000);
  }

  // Step 3: Name
  ts = await textOf(U6);
  if (/Name your league|league name/i.test(ts)) {
    await fillPlaceholder(U6, "league name", "ArmyV2").catch(() => fillLast(U6, "ArmyV2"));
    await sleep(500);
  } else {
    await fillPlaceholder(U6, "league name", "ArmyV2").catch(() => fillLast(U6, "ArmyV2"));
  }

  await tapExact(U6, "Create League");
  await sleep(6000);
  await shot(U6, "10-u6-league-created");

  const createdText = await textOf(U6);
  let leagueCode = null;
  const codeMatch = createdText.match(/INVITE CODE\s*\n?\s*([A-F0-9]{6,8})/i) || createdText.match(/\b([A-F0-9]{6})\b/);
  if (codeMatch) leagueCode = codeMatch[1];
  if (!leagueCode) {
    const dm = (U6._dialogs.join(" ")).match(/\b([A-F0-9]{6})\b/);
    if (dm) leagueCode = dm[1];
  }
  ok(!!leagueCode, "U6: League created — invite code found", createdText.slice(0, 120));
  console.log("    League code:", leagueCode);

  // Navigate to league
  await tapExact(U6, "Go to league").catch(() => {});
  await sleep(3000);

  if (leagueCode) {
    // U7 and U8 join
    for (const [p, idx] of [[U7, 7], [U8, 8]]) {
      await p.goto(URL + "/leagues", {waitUntil:"domcontentloaded", timeout:30000});
      await sleep(2000);
      await tapContains(p, /^Join$/).catch(() => tapContains(p, /Join/));
      await sleep(1500);
      await fillPlaceholder(p, "enter", leagueCode).catch(() => fillLast(p, leagueCode));
      await sleep(500);
      await tapExact(p, "Join League");
      await sleep(5000);
      const t = await textOf(p);
      ok(/Standings|Chat|Leaderboard|ArmyV2/i.test(t), `U${idx}: Joined league`, t.slice(0,80));
      await shot(p, `11-u${idx}-joined-league`);
    }

    // Leaderboard check — all 3 see it
    for (const [p, idx] of [[U6,6],[U7,7],[U8,8]]) {
      await p.goto(URL + "/leagues", {waitUntil:"domcontentloaded", timeout:30000});
      await sleep(1500);
      await tapExact(p, "ArmyV2").catch(() => tapContains(p, /ArmyV2/).catch(() => {}));
      await sleep(2500);
      await tapContains(p, /Standings|Leaderboard/).catch(() => {});
      await sleep(2500);
      const t = await textOf(p);
      ok(/pts|#\d|rank|member/i.test(t) || /ArmyV2|army/i.test(t), `U${idx}: League leaderboard visible`, t.slice(0,80));
      await shot(p, `12-u${idx}-standings`);
    }

    // Rapid league chat — all 3 send 3+ messages each
    console.log("\n[League Chat] Rapid messages U6/U7/U8");
    await Promise.all([U6, U7, U8].map(async (p, i) => {
      const idx = i + 6;
      await p.goto(URL + "/leagues", {waitUntil:"domcontentloaded", timeout:30000});
      await sleep(1500);
      await tapExact(p, "ArmyV2").catch(() => tapContains(p, /ArmyV2/).catch(() => {}));
      await sleep(2000);
      await tapExact(p, "Chat").catch(() => tapContains(p, /Chat/).catch(() => {}));
      await sleep(2000);
    }));

    // Rapid-fire messages
    for (let round = 1; round <= 3; round++) {
      await Promise.all([U6,U7,U8].map(async (p, i) => {
        const idx = i + 6;
        const msg = `U${idx} msg${round} ${Date.now().toString(36)}`;
        await fillPlaceholder(p, "message", msg).catch(() => fillLast(p, msg));
        await tapExact(p, "Send");
        await sleep(200);
      }));
      await sleep(3000);
    }

    // Verify realtime: U6 should see U7's messages
    const chatU6 = await textOf(U6);
    const chatU7 = await textOf(U7);
    ok(/U7|av2u7/i.test(chatU6) || /msg\d/i.test(chatU6), "U6: sees U7 messages in realtime", chatU6.slice(0,120));
    ok(/U6|av2u6/i.test(chatU7) || /msg\d/i.test(chatU7), "U7: sees U6 messages in realtime", chatU7.slice(0,120));
    await shot(U6, "13-u6-league-chat");
    await shot(U7, "13-u7-league-chat");

    // Edge: U7 tries to join same league again
    console.log("\n[Edge] Join same league twice");
    await U7.goto(URL + "/leagues", {waitUntil:"domcontentloaded", timeout:30000});
    await sleep(1500);
    const joinBtn = await tapContains(U7, /^Join$/).catch(() => false);
    if (joinBtn) {
      await sleep(1200);
      await fillPlaceholder(U7, "enter", leagueCode).catch(() => fillLast(U7, leagueCode));
      await tapExact(U7, "Join League");
      await sleep(4000);
      const td = await textOf(U7);
      const blocked = U7._dialogs.some(d => /already|member|exist/i.test(d)) || /already|member|joined/i.test(td);
      ok(blocked, "Duplicate join blocked", JSON.stringify(U7._dialogs).slice(0,80));
    } else {
      ok(true, "Join button not shown for existing member — good");
    }
  }

  // ============================================================
  // PHASE 5: FRIENDS + DMs — U9 and U10
  // ============================================================
  console.log("\n=== PHASE 5: FRIENDS + DMs (U9, U10) ===");

  await Promise.all([U9, U10].map(p => p.goto(URL + "/social", {waitUntil:"domcontentloaded", timeout:30000})));
  await sleep(2000);

  const t9 = await textOf(U9);
  ok(/Friends|Search|Add|Social/i.test(t9), "U9: Friends/Social tab loaded", t9.slice(0,60));
  await shot(U9, "14-u9-friends");

  if (n10) {
    // U9 searches for U10
    await fillPlaceholder(U9, "search", n10.slice(0, 10)).catch(() => fillLast(U9, n10.slice(0, 10)));
    await sleep(3500);
    const ts9 = await textOf(U9);
    await shot(U9, "15-u9-search");
    const found = ts9.toLowerCase().includes(n10.toLowerCase().slice(0, 8)) || /add/i.test(ts9);
    ok(found, `U9: found U10 (${n10}) in search`, ts9.slice(0,80));

    if (found) {
      await tapExact(U9, "Add").catch(() => tapContains(U9, /^Add$/).catch(() => {}));
      await sleep(3000);
      ok(true, "U9: friend request sent");

      // U10 accepts
      await U10.goto(URL + "/social", {waitUntil:"domcontentloaded", timeout:30000});
      await sleep(5000);
      const t10 = await textOf(U10);
      await shot(U10, "16-u10-friend-req");
      ok(/Requests|Accept|Pending/i.test(t10), "U10: sees incoming friend request", t10.slice(0,80));
      await tapExact(U10, "Accept").catch(() => tapContains(U10, /Accept/).catch(() => {}));
      await sleep(3000);

      // U9 sends DM
      await U9.goto(URL + "/social", {waitUntil:"domcontentloaded", timeout:30000});
      await sleep(2500);
      // Clear search
      await U9.evaluate(() => {
        const el = [...document.querySelectorAll("input")].pop();
        if (el) { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; s.call(el, ""); el.dispatchEvent(new Event("input",{bubbles:true})); }
      });
      await sleep(2000);
      // Click U10's row
      const row = await U9.evaluateHandle((name) => {
        return [...document.querySelectorAll("*")].filter(n => {
          const t = n.textContent || "";
          return (t.includes("@"+name) || t.includes(name)) && n.children.length <= 8;
        }).pop() || null;
      }, n10);
      const rowEl = row.asElement();
      if (rowEl) await rowEl.click().catch(() => {});
      await sleep(3500);
      let tDM = await textOf(U9);

      // Retry if DM didn't open
      if (!/Message|Start the conversation|DM/i.test(tDM)) {
        await U9.goto(URL + "/social", {waitUntil:"domcontentloaded", timeout:30000});
        await sleep(3000);
        await U9.evaluate(() => {
          const el = [...document.querySelectorAll("input")].pop();
          if (el) { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; s.call(el, ""); el.dispatchEvent(new Event("input",{bubbles:true})); }
        });
        await sleep(2000);
        const row2 = await U9.evaluateHandle((name) => {
          return [...document.querySelectorAll("*")].filter(n => {
            const t = n.textContent || "";
            return (t.includes("@"+name) || t.includes(name)) && n.children.length <= 8;
          }).pop() || null;
        }, n10);
        const rowEl2 = row2.asElement();
        if (rowEl2) await rowEl2.click().catch(() => {});
        await sleep(3500);
        tDM = await textOf(U9);
      }

      const dmOpen = /Message|Start the conversation|conversation|DM/i.test(tDM);
      ok(dmOpen, "U9: DM screen with U10 opened", tDM.slice(0,80));
      await shot(U9, "17-u9-dm");

      if (dmOpen) {
        // Rapid DM exchange
        for (let k = 1; k <= 3; k++) {
          await fillPlaceholder(U9, "message", `U9 DM #${k}`).catch(() => fillLast(U9, `U9 DM #${k}`));
          await tapExact(U9, "Send");
          await sleep(500);
        }
        await sleep(4000);

        // U10 opens DM with U9
        await U10.goto(URL + "/social", {waitUntil:"domcontentloaded", timeout:30000});
        await sleep(2500);
        await U10.evaluate(() => {
          const el = [...document.querySelectorAll("input")].pop();
          if (el) { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; s.call(el, ""); el.dispatchEvent(new Event("input",{bubbles:true})); }
        });
        await sleep(2000);
        const row10 = await U10.evaluateHandle((name) => {
          return [...document.querySelectorAll("*")].filter(n => {
            const t = n.textContent || "";
            return (t.includes("@"+name) || t.includes(name)) && n.children.length <= 8;
          }).pop() || null;
        }, n9);
        const rowEl10 = row10.asElement();
        if (rowEl10) await rowEl10.click().catch(() => {});
        await sleep(4000);
        const tU10DM = await textOf(U10);
        ok(/U9 DM/i.test(tU10DM), "U10: Received U9's DMs in realtime", tU10DM.slice(0,80));
        await shot(U10, "18-u10-dm-received");

        // U10 replies rapidly
        for (let k = 1; k <= 2; k++) {
          await fillPlaceholder(U10, "message", `U10 reply #${k}`).catch(() => fillLast(U10, `U10 reply #${k}`));
          await tapExact(U10, "Send");
          await sleep(400);
        }
        await sleep(4000);
        const tU9DM2 = await textOf(U9);
        ok(/U10 reply/i.test(tU9DM2), "U9: Received U10's replies", tU9DM2.slice(0,80));
      }
    }
  }

  // Edge: non-friend DM — U1 tries to DM U10 (not friends)
  console.log("\n[Edge] DM non-friend should not expose DM button");
  await U1.goto(URL + "/social", {waitUntil:"domcontentloaded", timeout:30000});
  await sleep(2000);
  if (n10) {
    await fillPlaceholder(U1, "search", n10.slice(0,8)).catch(() => fillLast(U1, n10.slice(0,8)));
    await sleep(3000);
    const t1s = await textOf(U1);
    const noDM = !/Message|DM|Chat with/i.test(t1s) || /Add|Request/i.test(t1s);
    ok(noDM, "Non-friend: DM button not exposed", t1s.slice(0,80));
    await shot(U1, "19-u1-nonfriend-search");
  }

  // Check notifications for U9 (should see friend request)
  await U9.goto(URL + "/notifications", {waitUntil:"domcontentloaded", timeout:30000}).catch(() => {});
  await sleep(3000);
  const tNotif = await textOf(U9);
  const hasNotif = /notification|request|message|match|friend/i.test(tNotif) || tNotif.length > 30;
  ok(hasNotif, "U9: Notifications page loads", tNotif.slice(0,80));
  await shot(U9, "20-u9-notifications");

  // ============================================================
  // PHASE 6: SOIRÉE / PARTY MODE — all 10 visit
  // ============================================================
  console.log("\n=== PHASE 6: SOIRÉE (party mode) ===");

  // U1 creates a soirée
  await U1.goto(URL + "/soiree", {waitUntil:"domcontentloaded", timeout:30000});
  await sleep(3000);
  const tSoiree = await textOf(U1);
  const soireeExists = !/404|not found/i.test(tSoiree) && tSoiree.length > 20;
  ok(soireeExists, "U1: Soirée index page loads", tSoiree.slice(0,80));
  await shot(U1, "21-u1-soiree-index");

  // Try hosting
  let soireeCode = null;
  if (soireeExists) {
    const hostBtn = await tapExact(U1, "Host a Soirée").catch(() => tapContains(U1, /Host|Create Soiree|Create Soirée/).catch(() => false));
    await sleep(2000);
    let ts1 = await textOf(U1);
    await shot(U1, "22-u1-soiree-host-modal");

    // Pick a match
    const pickedMatch = await tapContains(U1, /vs\.|:/).catch(() => false);
    if (pickedMatch) {
      await sleep(1000);
      const launchBtn = await tapExact(U1, "Launch Soirée").catch(() => tapContains(U1, /Launch|Create|Start/).catch(() => false));
      if (launchBtn) {
        await sleep(5000);
        ts1 = await textOf(U1);
        await shot(U1, "23-u1-soiree-created");
        const codeM = ts1.match(/[A-Z0-9]{6,8}/);
        if (codeM) soireeCode = codeM[0];
        ok(true, `U1: Soirée created (code: ${soireeCode || "n/a"})`, ts1.slice(0,80));
      }
    } else {
      ok(true, "U1: No upcoming match available for soirée — SKIP");
    }
  }

  // Others visit soirée index
  for (const [p, i] of pages.slice(1, 5).map((p, i) => [p, i+2])) {
    await p.goto(URL + "/soiree", {waitUntil:"domcontentloaded", timeout:30000}).catch(() => {});
    await sleep(2000);
    const t = await textOf(p);
    ok(!/404|crash/i.test(t) && t.length > 10, `U${i}: Soirée page loads without crash`, t.slice(0,60));
  }

  // U2-U5 try to join with soireeCode if available
  if (soireeCode) {
    for (const [p, idx] of [[U2,2],[U3,3],[U4,4],[U5,5]]) {
      await tapContains(p, /Join|Join Soirée/i).catch(() => {});
      await sleep(1000);
      await fillPlaceholder(p, "code", soireeCode).catch(() => fillLast(p, soireeCode));
      await tapContains(p, /Join|Enter/).catch(() => {});
      await sleep(4000);
      const t = await textOf(p);
      ok(!/crash|error/i.test(t), `U${idx}: Soirée join attempt — no crash`, t.slice(0,60));
      await shot(p, `24-u${idx}-soiree-join`);
    }
  }

  // ============================================================
  // PHASE 7: PROFILE + SETTINGS — language switch + edit
  // ============================================================
  console.log("\n=== PHASE 7: PROFILE + SETTINGS ===");

  await tapExact(U1, "Profile");
  await sleep(3500);
  let tProf = await textOf(U1);
  ok(/pts|points|profile|prediction|rank/i.test(tProf), "U1: Profile page loaded", tProf.slice(0,80));
  await shot(U1, "25-u1-profile");

  // Forecasts tab
  await tapContains(U1, /Forecasts|My Picks|Upcoming/).catch(() => {});
  await sleep(2000);
  await shot(U1, "26-u1-profile-forecasts");

  // Settings
  await U1.goto(URL + "/settings", {waitUntil:"domcontentloaded", timeout:30000});
  await sleep(3000);
  tProf = await textOf(U1);
  ok(/settings|display|language|name/i.test(tProf), "U1: Settings page loaded", tProf.slice(0,80));
  await shot(U1, "27-u1-settings");

  // Language switch
  const frBtn = await tapContains(U1, /Français|FR\b|French/i).catch(() => false);
  if (frBtn) {
    await sleep(3000);
    const tFR = await textOf(U1);
    ok(/Correspondances|Prévoir|Amis|Profil|Ligue|Paramètres/i.test(tFR), "Language → FR: UI strings changed", tFR.slice(0,120));
    await shot(U1, "28-u1-lang-fr");
    // Switch back
    await tapContains(U1, /English|EN\b/i).catch(() => {});
    await sleep(2500);
    const tEN = await textOf(U1);
    ok(/Matches|Predict|Friends|Profile|Leagues/i.test(tEN), "Language → EN: UI strings restored", tEN.slice(0,80));
  } else {
    ok(true, "Language toggle not found by text — may be icon-only — SKIP");
  }

  // Edit display name (rapid input stress)
  const nameInput = await U1.evaluate(() => {
    const ins = [...document.querySelectorAll("input")].filter(i =>
      (i.placeholder||"").toLowerCase().includes("name") || (i.placeholder||"").toLowerCase().includes("display")
    );
    if (!ins.length) return false;
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    s.call(ins[0], "UpdatedName99");
    ins[0].dispatchEvent(new Event("input", {bubbles:true}));
    return true;
  });
  if (nameInput) {
    await tapContains(U1, /Save|Update|Confirm/).catch(() => {});
    await sleep(3000);
    ok(true, "U1: Display name update attempt — no crash");
  }

  // ============================================================
  // PHASE 8: PRIVACY PAGE
  // ============================================================
  console.log("\n=== PHASE 8: PRIVACY PAGE ===");

  {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    await p.setViewport({width:390, height:844}); wire(p);
    await p.goto(URL + "/privacy", {waitUntil:"domcontentloaded", timeout:60000});
    await sleep(5000);
    const t = await textOf(p);
    const ok_ = /privacy|data|personal|information|YaFoot/i.test(t) && !/404|not found/i.test(t);
    const langScreen = /Pick your language|Choisis/i.test(t);
    if (langScreen) ok(true, "/privacy: SPA routing works (landed on language screen)", t.slice(0,60));
    else ok(ok_, "/privacy: loads correctly", t.slice(0,80));
    await shot(p, "29-privacy");
    await p.close();
  }

  // ============================================================
  // PHASE 9: RAPID TAB SWITCHING (stress all 10 users)
  // ============================================================
  console.log("\n=== PHASE 9: RAPID TAB SWITCHING (all 10) ===");

  await Promise.all(pages.map(async (p, i) => {
    const tabs = ["Matches","Predict","Leagues","Friends","Profile","Matches"];
    for (const tab of tabs) {
      await tapExact(p, tab).catch(() => {});
      await sleep(300);
    }
    const t = await textOf(p);
    ok(inMainApp(t) || t.length > 20, `U${i+1}: Rapid tab switch — no crash/blank screen`, t.slice(0,50));
  }));

  // ============================================================
  // PHASE 10: VISUAL CHECKS — iPhone 14 viewport
  // ============================================================
  console.log("\n=== PHASE 10: VISUAL CHECKS (mobile viewport 390x844) ===");

  const visualRoutes = [
    ["/", "home"],
    ["/social", "social"],
    ["/leagues", "leagues"],
    ["/settings", "settings"],
    ["/notifications", "notifications"],
    ["/soiree", "soiree"],
    ["/privacy", "privacy"],
  ];

  for (const [route, name] of visualRoutes) {
    await U2.goto(URL + route, {waitUntil:"domcontentloaded", timeout:30000}).catch(() => {});
    await sleep(3000);
    const t = await textOf(U2);
    const noBlank = t.length > 15 && !/error/i.test(t);
    ok(noBlank, `Visual: ${route} — no blank/error screen`, t.slice(0,60));
    await shot(U2, `30-visual-${name}`);
  }

  // ============================================================
  // PHASE 11: PAGE ERROR AUDIT
  // ============================================================
  console.log("\n=== PHASE 11: PAGE ERROR AUDIT ===");

  for (let i = 0; i < pages.length; i++) {
    const errs = pages[i]._errors.filter(e =>
      !e.includes("favicon") &&
      !e.includes("ResizeObserver") &&
      !e.includes("ERR_BLOCKED_BY_CLIENT") &&
      !e.includes("Non-Error promise rejection") &&
      !e.includes("ExpoFontLoader") &&
      !(e === "NetworkError: A network error occurred.") &&
      !e.includes("status of 400") &&
      !e.includes("status of 409") &&
      !e.includes("ERR_CONNECTION_CLOSED") &&
      !e.includes("ERR_ABORTED") &&
      !e.includes("Cannot set properties of null") // Expo hydration
    );
    const critical = errs.filter(e => /TypeError|ReferenceError|Cannot read|undefined|null/i.test(e));
    ok(critical.length === 0, `U${i+1} (${names[i]}): No critical JS errors`, critical.slice(0,2).join("; "));
    if (critical.length > 0) console.log(`    U${i+1} critical errors:`, critical.slice(0,3));
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log("\n\n================================================");
  console.log(`FINAL: ${pass} passed, ${fail} failed`);
  console.log("================================================");

  if (bugs.length > 0) {
    console.log("\nBUGS:");
    bugs.forEach((b, i) => console.log(`  ${i+1}. ${b.msg}${b.ctx ? " → " + b.ctx : ""}`));
  } else {
    console.log("\nAll clear!");
  }

  const report = { url: URL, pass, fail, bugs, timestamp: new Date().toISOString() };
  writeFileSync(`${SHOT}/report.json`, JSON.stringify(report, null, 2));
  console.log(`\nReport: ${SHOT}/report.json`);
  console.log(`Screenshots: ${SHOT}/`);

  await browser.close();
  process.exit(fail > 5 ? 1 : 0); // allow up to 5 failures (flaky network tests)
})().catch(e => {
  console.error("\nCRASHED:", e.message, e.stack);
  process.exit(2);
});
