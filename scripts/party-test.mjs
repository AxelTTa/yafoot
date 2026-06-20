// Party mode 3-user test: host creates soirée, starts game, opens round;
// guests join and bet; host resolves; verify points + punishments.
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const URL = process.env.URL || "https://dist-five-zeta-92i4a6g3xx.vercel.app";
const CHROME = process.env.CHROME || "/usr/bin/google-chrome";
const SHOT = "/tmp/party-test";
mkdirSync(SHOT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0, shotIdx = 0;
const ok = (c, m) => { c ? (pass++, console.log("  ✓", m)) : (fail++, console.log("  ✗ FAIL:", m)); };

async function shot(page, name) {
  const path = `${SHOT}/${String(++shotIdx).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path }).catch(() => {});
  console.log(`    [screenshot] ${path}`);
}

function wire(page) {
  page.on("dialog", async (d) => { await d.accept().catch(() => {}); });
}

async function bodyText(page) {
  return page.evaluate(() => document.body.innerText);
}

// Real mouse click by finding element containing text (smallest matching element)
async function mouseClick(page, text) {
  const rect = await page.evaluate((t) => {
    const candidates = [...document.querySelectorAll("*")].filter((n) => {
      const txt = (n.textContent || "").trim();
      return txt.includes(t) && n.offsetParent !== null && n.offsetHeight > 0;
    });
    candidates.sort((a, b) => (a.offsetWidth * a.offsetHeight) - (b.offsetWidth * b.offsetHeight));
    const el = candidates[0];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, tag: el.tagName, txt: (el.textContent||"").trim().slice(0,40) };
  }, text);
  if (!rect) return false;
  console.log(`    [click] "${text}" → ${rect.tag} "${rect.txt}" at (${Math.round(rect.x)},${Math.round(rect.y)})`);
  await page.mouse.click(rect.x, rect.y);
  return true;
}

// Click by position of the Nth large button on page
async function clickNthBigButton(page, n) {
  const rect = await page.evaluate((nth) => {
    const btns = [...document.querySelectorAll("*")].filter((el) => {
      return el.offsetHeight > 60 && el.offsetHeight < 200 && el.offsetWidth > 200 && el.offsetParent !== null;
    });
    btns.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    const el = btns[nth];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, txt: (el.textContent||"").trim().slice(0,50) };
  }, n);
  if (!rect) return false;
  console.log(`    [bigbtn ${n}] "${rect.txt}" at (${Math.round(rect.x)},${Math.round(rect.y)})`);
  await page.mouse.click(rect.x, rect.y);
  return true;
}

async function fillLast(page, value) {
  return page.evaluate((v) => {
    const el = [...document.querySelectorAll("input")].pop();
    if (!el) return false;
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (!s) return false;
    s.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, value);
}

async function fillPlaceholder(page, ph, value) {
  return page.evaluate((p, v) => {
    const el = [...document.querySelectorAll("input")].reverse().find((i) => (i.placeholder || "").toLowerCase().includes(p.toLowerCase()));
    if (!el) return false;
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (!s) return false;
    s.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, ph, value);
}

async function waitForText(page, text, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const t = await bodyText(page);
    if (t.includes(text)) return true;
    await sleep(500);
  }
  return false;
}

async function onboard(page, username) {
  await page.goto(`${URL}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(3000);

  let t = await bodyText(page);

  // Language picker — pick English
  if (t.includes("language") || t.includes("langue") || t.includes("English")) {
    await mouseClick(page, "English");
    await sleep(2000);
  }

  // Fill username (last input)
  const filled = await fillLast(page, username);
  console.log(`  [onboard:${username.slice(0, 12)}] fill:`, filled);
  await sleep(400);

  // Tap submit button (Let's go! or similar)
  let submitted = false;
  for (const label of ["go!", "Get started", "Continue", "Commencer"]) {
    const clicked = await mouseClick(page, label);
    if (clicked) { submitted = true; break; }
  }
  if (!submitted) {
    // Try clicking the first big button
    await clickNthBigButton(page, 0);
  }

  // Wait for navigation away from welcome
  let i = 0;
  while (i++ < 20) {
    await sleep(500);
    const url = page.url();
    const txt = await bodyText(page);
    if (!url.includes("/welcome") && !txt.includes("YOUR NAME") && !txt.includes("Let's go!")) break;
    if (i === 10) {
      await fillLast(page, username);
      await sleep(200);
      await mouseClick(page, "go!");
    }
  }

  // Skip invite screen
  const t2 = await bodyText(page);
  if (t2.includes("Continue to app") || t2.includes("invite link") || t2.includes("Share invite")) {
    await mouseClick(page, "Continue to app");
    await sleep(2000);
  }

  const finalUrl = page.url();
  console.log(`  [onboard] final URL: ${finalUrl.replace(URL, "")}`);
  return finalUrl;
}

(async () => {
  console.log("\n=== Party Mode 3-User Test ===");
  console.log(`URL: ${URL}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    defaultViewport: { width: 390, height: 844 },
    protocolTimeout: 120000,
  });

  const ctx1 = await browser.createBrowserContext();
  const ctx2 = await browser.createBrowserContext();
  const ctx3 = await browser.createBrowserContext();
  const [p1, p2, p3] = await Promise.all([ctx1.newPage(), ctx2.newPage(), ctx3.newPage()]);
  wire(p1); wire(p2); wire(p3);

  let soireeCode = null;
  let soireeUrl = null;

  // ── USER 1: Onboard + Host ──────────────────────────────────────────────────
  console.log("\n[User 1] Onboarding as PartyHost...");
  try {
    const finalUrl = await onboard(p1, "PartyHost" + Date.now().toString().slice(-4));
    ok(!finalUrl.includes("/welcome"), "User 1 onboarded");
    await shot(p1, "host-onboarded");

    await p1.goto(`${URL}/soiree`, { waitUntil: "networkidle2", timeout: 20000 });
    await sleep(2000);
    await shot(p1, "host-soiree-landing");

    const landingText = await bodyText(p1);
    console.log("  Landing:", landingText.slice(0, 150).replace(/\n/g, " "));
    ok(landingText.includes("Soirée") || landingText.includes("Party"), "Soirée page loaded");

    // Click the HOST button — try specific text, avoid header
    const hostClicked = await mouseClick(p1, "Host a Soirée") || await mouseClick(p1, "Organiser une") || await mouseClick(p1, "Host a");
    console.log("  Host btn clicked:", hostClicked);
    await sleep(2500);
    await shot(p1, "host-modal-open");

    const afterModal = await bodyText(p1);
    // Wait for match list
    await sleep(2500);

    // Click first match row (has "vs" in text)
    const matchRect = await p1.evaluate(() => {
      const els = [...document.querySelectorAll("*")].filter((n) => {
        const t = (n.textContent || "").trim();
        return t.includes("vs") && n.offsetParent !== null && n.offsetHeight > 20 && n.offsetHeight < 100;
      });
      els.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
      const el = els[0];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, txt: (el.textContent||"").trim().slice(0,50) };
    });
    console.log("  Match:", matchRect?.txt);
    if (matchRect) await p1.mouse.click(matchRect.x, matchRect.y);
    await sleep(800);

    // Click create button ("Create Soirée" or "Créer la Soirée")
    const created = await mouseClick(p1, "Create") || await mouseClick(p1, "Créer");
    console.log("  Created:", created);
    await sleep(5000);

    soireeUrl = p1.url();
    ok(soireeUrl !== `${URL}/soiree` && soireeUrl.includes("/soiree/"), "Navigated to soirée room");

    await shot(p1, "host-lobby");
    const lobbyText = await bodyText(p1);
    console.log("  Lobby:", lobbyText.slice(0, 350).replace(/\n/g, " "));

    const codeMatch = lobbyText.match(/Code:\s*([A-Z0-9]{6})/);
    soireeCode = codeMatch?.[1];
    ok(soireeCode?.length === 6, `Join code: ${soireeCode}`);
    ok(lobbyText.includes("Start") || lobbyText.includes("Démarrer") || lobbyText.includes("DANS") || lobbyText.includes("IN THE ROOM"), "Lobby visible");

  } catch (e) {
    console.error("[User 1] Error:", e.message);
    await shot(p1, "host-error").catch(() => {});
    fail++;
  }

  if (!soireeUrl || !soireeCode) {
    console.log("\nAborting — no soirée URL/code.");
    await browser.close();
    console.log(`\nResults: ${pass} passed, ${fail} failed`);
    process.exit(1);
  }

  // ── USERS 2 & 3: Onboard + Join ────────────────────────────────────────────
  console.log("\n[Users 2 & 3] Onboarding + Joining...");
  try {
    const [url2, url3] = await Promise.all([
      onboard(p2, "Guest2_" + Date.now().toString().slice(-4)),
      onboard(p3, "Guest3_" + Date.now().toString().slice(-4)),
    ]);
    ok(!url2.includes("/welcome"), "User 2 onboarded");
    ok(!url3.includes("/welcome"), "User 3 onboarded");

    await Promise.all([
      p2.goto(`${URL}/soiree`, { waitUntil: "networkidle2", timeout: 20000 }),
      p3.goto(`${URL}/soiree`, { waitUntil: "networkidle2", timeout: 20000 }),
    ]);
    await sleep(1500);

    // Click JOIN button — use specific text
    await Promise.all([
      mouseClick(p2, "Join a Soirée").then(c => c || mouseClick(p2, "Rejoindre une")),
      mouseClick(p3, "Join a Soirée").then(c => c || mouseClick(p3, "Rejoindre une")),
    ]);
    await sleep(1500);

    // Fill code input — placeholder is "6-letter code" (EN) or "Code de 6 lettres" (FR)
    const [f2, f3] = await Promise.all([
      fillPlaceholder(p2, "6-letter", soireeCode).then(c => c || fillPlaceholder(p2, "Code de", soireeCode)),
      fillPlaceholder(p3, "6-letter", soireeCode).then(c => c || fillPlaceholder(p3, "Code de", soireeCode)),
    ]);
    console.log("  Code fill p2:", f2, "p3:", f3);
    await sleep(600);

    // Tap join action button (smallest element matching "Join" or "Rejoindre")
    await Promise.all([
      mouseClick(p2, "Rejoindre").then(c => c || mouseClick(p2, "Join")),
      mouseClick(p3, "Rejoindre").then(c => c || mouseClick(p3, "Join")),
    ]);
    await sleep(5000);

    const [u2, u3] = [p2.url(), p3.url()];
    ok(u2.includes("/soiree/") && u2 !== `${URL}/soiree`, `User 2 joined`);
    ok(u3.includes("/soiree/") && u3 !== `${URL}/soiree`, `User 3 joined`);

    await Promise.all([shot(p2, "guest2-lobby"), shot(p3, "guest3-lobby")]);
    const [t2, t3] = await Promise.all([bodyText(p2), bodyText(p3)]);
    ok(t2.includes("Code:") || t2.includes("Soirée") || t2.includes("attente") || t2.includes("Waiting"), "User 2 in lobby");
    ok(t3.includes("Code:") || t3.includes("Soirée") || t3.includes("attente") || t3.includes("Waiting"), "User 3 in lobby");

  } catch (e) {
    console.error("[Users 2&3] Error:", e.message);
    fail++;
  }

  // ── USER 1: Start Game ──────────────────────────────────────────────────────
  console.log("\n[User 1] Starting game...");
  try {
    // Navigate fresh to soiree URL (more reliable than reload in headless Puppeteer)
    await p1.goto(soireeUrl, { waitUntil: "networkidle2", timeout: 20000 });
    await sleep(2000);
    await shot(p1, "host-before-start");

    // "Start the game" (EN) or "Démarrer la partie" (FR)
    const startClicked = await mouseClick(p1, "Start the game") || await mouseClick(p1, "Démarrer");
    console.log("  Start clicked:", startClicked);
    // Wait for idle state (preset grid)
    const idleVisible = await waitForText(p1, "CHALLENGE", 8000) || await waitForText(p1, "DÉFI", 2000);
    const afterStart = await bodyText(p1);
    console.log("  After start:", afterStart.slice(0, 200).replace(/\n/g, " "));
    ok(
      afterStart.includes("CHALLENGE") || afterStart.includes("DÉFI") || afterStart.includes("Next goal") || afterStart.includes("Prochain"),
      "Preset round grid visible"
    );
    await shot(p1, "host-idle-state");

  } catch (e) {
    console.error("[User 1] Start error:", e.message);
    fail++;
  }

  // ── USER 1: Open Round ─────────────────────────────────────────────────────
  console.log("\n[User 1] Opening first round (Next goal / Prochain but)...");
  let firstRoundOption1 = "Home team"; // English default
  let firstRoundOption2 = "Away team";
  const roundOpenedAt = Date.now();
  try {
    // Try English then French
    const opened = await mouseClick(p1, "Next goal") || await mouseClick(p1, "Prochain but");
    console.log("  Round opened:", opened);

    // Wait for host's page to show the round (realtime), fallback: navigate fresh
    let roundVisible = await waitForText(p1, "seconds left", 6000) || await waitForText(p1, "secondes", 2000);
    if (!roundVisible) {
      console.log("  [fallback] Navigating host fresh to see round...");
      await p1.goto(soireeUrl, { waitUntil: "networkidle2", timeout: 15000 });
      await sleep(2000);
      roundVisible = await waitForText(p1, "seconds left", 5000) || await waitForText(p1, "secondes", 2000);
    }

    const roundText = await bodyText(p1);
    console.log("  Round text:", roundText.slice(0, 250).replace(/\n/g, " "));

    // Detect language from round text
    if (roundText.includes("Home team")) {
      firstRoundOption1 = "Home team";
      firstRoundOption2 = "Away team";
    } else if (roundText.includes("Équipe")) {
      firstRoundOption1 = "Équipe dom.";
      firstRoundOption2 = "Équipe ext.";
    }
    console.log("  Options:", firstRoundOption1, "/", firstRoundOption2);

    ok(roundVisible, "Round opened — countdown visible");
    await shot(p1, "host-round-open");

  } catch (e) {
    console.error("[User 1] Open round error:", e.message);
    fail++;
  }

  // ── USERS 2 & 3: Load room + bet ───────────────────────────────────────────
  console.log("\n[Users 2 & 3] Betting...");
  try {
    await Promise.all([
      p2.goto(soireeUrl, { waitUntil: "networkidle2", timeout: 15000 }),
      p3.goto(soireeUrl, { waitUntil: "networkidle2", timeout: 15000 }),
    ]);
    await sleep(3000);

    await Promise.all([shot(p2, "guest2-round-open"), shot(p3, "guest3-round-open")]);
    const [t2, t3] = await Promise.all([bodyText(p2), bodyText(p3)]);
    console.log("  User 2:", t2.slice(0, 150).replace(/\n/g, " "));
    ok(t2.includes("seconds") || t2.includes("secondes") || t2.includes("goal") || t2.includes("but"), "User 2 sees open round");
    ok(t3.includes("seconds") || t3.includes("secondes") || t3.includes("goal") || t3.includes("but"), "User 3 sees open round");

    // User 2 bets option 1
    await mouseClick(p2, firstRoundOption1);
    await sleep(2000);
    const after2 = await bodyText(p2);
    ok(after2.includes("bet") || after2.includes("pari") || after2.includes("Home") || after2.includes("dom"), "User 2 bet placed");
    await shot(p2, "guest2-bet-placed");

    // User 3 bets option 2
    await mouseClick(p3, firstRoundOption2);
    await sleep(2000);
    const after3 = await bodyText(p3);
    ok(after3.includes("bet") || after3.includes("pari") || after3.includes("Away") || after3.includes("ext"), "User 3 bet placed");
    await shot(p3, "guest3-bet-placed");

  } catch (e) {
    console.error("[Users 2&3] Bet error:", e.message);
    fail++;
  }

  // ── USER 1: Wait for lock, then resolve ────────────────────────────────────
  console.log("\n[User 1] Waiting for round to lock (auto at 45s)...");
  try {
    // Wait for "right answer" text — the locked state header
    // Round was opened at roundOpenedAt; give 60s total from then
    const elapsed = Date.now() - roundOpenedAt;
    const remainingWait = Math.max(0, 55000 - elapsed);
    console.log(`  Elapsed since round open: ${Math.round(elapsed/1000)}s, waiting up to ${Math.round(remainingWait/1000)}s more`);

    let locked = await waitForText(p1, "right answer", remainingWait)
      || await waitForText(p1, "bonne réponse", 2000)
      || await waitForText(p1, "What's", 2000);

    if (!locked) {
      // Fallback: navigate host fresh and wait for locked state
      console.log("  [fallback] Navigating host fresh to see locked round...");
      await p1.goto(soireeUrl, { waitUntil: "networkidle2", timeout: 15000 });
      await sleep(2000);
      locked = await waitForText(p1, "right answer", 30000)
        || await waitForText(p1, "bonne réponse", 2000)
        || await waitForText(p1, "What's", 2000);
    }

    ok(locked, "Round locked — resolve UI visible");
    await shot(p1, "host-round-locked");

    const lockText = await bodyText(p1);
    console.log("  Lock text:", lockText.slice(0, 300).replace(/\n/g, " "));

    // Resolve: tap option 1 (the correct answer) — it appears in the resolve buttons
    const resolved = await mouseClick(p1, firstRoundOption1);
    console.log("  Resolve click:", resolved);
    await sleep(5000);

    const resolvedText = await bodyText(p1);
    console.log("  Resolved:", resolvedText.slice(0, 300).replace(/\n/g, " "));
    ok(
      resolvedText.includes("right") || resolvedText.includes("raison") ||
      resolvedText.includes("Punishment") || resolvedText.includes("Punition") ||
      resolvedText.includes("got it"),
      "Round resolved — winner/punishments shown"
    );
    await shot(p1, "host-round-resolved");

  } catch (e) {
    console.error("[User 1] Resolve error:", e.message);
    await shot(p1, "host-resolve-error").catch(() => {});
    fail++;
  }

  // ── Verify ──────────────────────────────────────────────────────────────────
  console.log("\n[All] Verifying points and punishments...");
  try {
    await sleep(2000);
    await Promise.all([
      p2.goto(soireeUrl, { waitUntil: "networkidle2", timeout: 15000 }),
      p3.goto(soireeUrl, { waitUntil: "networkidle2", timeout: 15000 }),
    ]);
    await sleep(3000);
    await Promise.all([shot(p2, "guest2-final"), shot(p3, "guest3-final")]);

    const [t1, t2, t3] = await Promise.all([bodyText(p1), bodyText(p2), bodyText(p3)]);

    ok([t1, t2, t3].some((t) => /\d+\s*pts/.test(t)), "Points (N pts) in leaderboard");
    ok(
      [t1, t2, t3].some((t) =>
        t.includes("Punishment") || t.includes("Punition") || t.includes("shot") ||
        t.includes("pompe") || t.includes("story") || t.includes("Punishments")
      ),
      "Punishments shown"
    );
    ok([t1, t2, t3].some((t) => t.includes("right") || t.includes("raison")), "Winner shown");
    ok([t1, t2, t3].some((t) => /[1-9]\d*\s*pts/.test(t)), "Non-zero points awarded");

  } catch (e) {
    console.error("[Verify] Error:", e.message);
    fail++;
  }

  await Promise.all([
    shot(p1, "final-host"),
    shot(p2, "final-guest2"),
    shot(p3, "final-guest3"),
  ]);

  await browser.close();

  console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
  console.log(`Screenshots: ${SHOT}/`);
  process.exit(fail > 0 ? 1 : 0);
})();
