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

// Click via real mouse events using element bounding rect
async function mouseClick(page, selector_or_eval) {
  let rect;
  if (typeof selector_or_eval === "string") {
    rect = await page.evaluate((t) => {
      const candidates = [...document.querySelectorAll("*")].filter((n) => {
        const txt = (n.textContent || "").trim();
        return txt.includes(t) && n.offsetParent !== null && n.offsetHeight > 0;
      });
      // Prefer smallest element (leaf-most) that is actually visible
      const sorted = candidates.sort((a, b) => (a.offsetWidth * a.offsetHeight) - (b.offsetWidth * b.offsetHeight));
      const el = sorted[0];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, tag: el.tagName, txt: el.textContent?.trim().slice(0, 40) };
    }, selector_or_eval);
  } else {
    rect = await page.evaluate(selector_or_eval);
  }
  if (!rect) return false;
  console.log(`    [click] "${selector_or_eval}" → ${rect.tag} "${rect.txt}" at (${Math.round(rect.x)},${Math.round(rect.y)})`);
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

  // Language picker
  if (t.includes("language") || t.includes("langue") || t.includes("English")) {
    await mouseClick(page, "English");
    await sleep(2000);
    t = await bodyText(page);
  }

  // Fill username
  const filled = await fillLast(page, username);
  console.log(`  [onboard:${username.slice(0, 12)}] fill:`, filled);
  await sleep(400);

  // Tap "Let's go!" or similar
  let submitted = false;
  for (const label of ["go!", "Get started", "Continue", "Commencer"]) {
    const clicked = await mouseClick(page, label);
    if (clicked) { submitted = true; break; }
  }
  if (!submitted) console.log("  [onboard] WARNING: no submit button found");

  // Wait for navigation away from welcome (up to 10s)
  let i = 0;
  while (i++ < 20) {
    await sleep(500);
    const url = page.url();
    const txt = await bodyText(page);
    if (!url.includes("/welcome") && !txt.includes("YOUR NAME")) break;
    // Retry fill+tap if stuck
    if (i === 10) {
      await fillLast(page, username);
      await sleep(300);
      await mouseClick(page, "go!");
    }
  }

  // Skip invite screen
  const t2 = await bodyText(page);
  if (t2.includes("Continue to app") || t2.includes("invite link")) {
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
    console.log("  Landing text:", landingText.slice(0, 200).replace(/\n/g, " "));
    ok(landingText.includes("Organiser") || landingText.includes("Party"), "Soirée landing loaded");

    // Tap Organiser button (via real mouse click)
    await mouseClick(p1, "Organiser une Soirée");
    await sleep(2500);
    await shot(p1, "host-modal-open");

    // Check modal opened
    const modalText = await bodyText(p1);
    console.log("  After modal tap:", modalText.slice(0, 300).replace(/\n/g, " "));
    const modalOpen = modalText.includes("Choisis le match") || modalText.includes("loading") || modalText.includes("vs");
    console.log("  Modal opened:", modalOpen);

    // Wait for matches to load
    await sleep(2500);
    const withMatches = await bodyText(p1);
    console.log("  With matches:", withMatches.slice(0, 300).replace(/\n/g, " "));

    // Click first "vs" match
    const matchRect = await p1.evaluate(() => {
      const els = [...document.querySelectorAll("*")].filter((n) => {
        const t = (n.textContent || "").trim();
        return t.includes("vs") && n.offsetParent !== null && n.offsetHeight > 20 && n.offsetHeight < 100;
      });
      // Sort by vertical position, take top-most visible match row
      els.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
      const el = els[0];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height, txt: el.textContent?.trim().slice(0, 50) };
    });
    console.log("  Match element:", matchRect);
    if (matchRect) await p1.mouse.click(matchRect.x, matchRect.y);
    await sleep(1000);

    // Click 'Créer la Soirée'
    await mouseClick(p1, "Créer");
    await sleep(5000);

    soireeUrl = p1.url();
    console.log("  URL:", soireeUrl);
    ok(soireeUrl !== `${URL}/soiree` && soireeUrl.includes("/soiree/"), "Navigated to soirée room");

    await shot(p1, "host-lobby");
    const lobbyText = await bodyText(p1);
    console.log("  Lobby text:", lobbyText.slice(0, 400).replace(/\n/g, " "));

    const codeMatch = lobbyText.match(/Code:\s*([A-Z0-9]{6})/);
    soireeCode = codeMatch?.[1];
    console.log("  Join code:", soireeCode);
    ok(soireeCode?.length === 6, `Join code found: ${soireeCode}`);
    ok(lobbyText.includes("Démarrer") || lobbyText.includes("DANS LA SALLE"), "Lobby state visible");

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

    // Open join modals
    await Promise.all([mouseClick(p2, "Rejoindre une Soirée"), mouseClick(p3, "Rejoindre une Soirée")]);
    await sleep(1500);

    // Fill code (the large code input has placeholder "ABC123")
    const [f2, f3] = await Promise.all([
      fillPlaceholder(p2, "ABC", soireeCode),
      fillPlaceholder(p3, "ABC", soireeCode),
    ]);
    console.log("  Code fill p2:", f2, "p3:", f3);
    await sleep(600);

    // Tap join button (the bottom "Rejoindre" button in modal)
    await Promise.all([mouseClick(p2, "Rejoindre"), mouseClick(p3, "Rejoindre")]);
    await sleep(5000);

    const [u2, u3] = [p2.url(), p3.url()];
    ok(u2.includes("/soiree/") && u2 !== `${URL}/soiree`, `User 2 joined (${u2.split("/").pop()})`);
    ok(u3.includes("/soiree/") && u3 !== `${URL}/soiree`, `User 3 joined (${u3.split("/").pop()})`);

    await Promise.all([shot(p2, "guest2-lobby"), shot(p3, "guest3-lobby")]);
    const [t2, t3] = await Promise.all([bodyText(p2), bodyText(p3)]);
    ok(t2.includes("attente") || t2.includes("Code") || t2.includes("Soirée"), "User 2 sees lobby");
    ok(t3.includes("attente") || t3.includes("Code") || t3.includes("Soirée"), "User 3 sees lobby");

  } catch (e) {
    console.error("[Users 2&3] Error:", e.message);
    fail++;
  }

  // ── USER 1: Start Game ──────────────────────────────────────────────────────
  console.log("\n[User 1] Starting game...");
  try {
    await p1.reload({ waitUntil: "networkidle2" });
    await sleep(2000);
    await shot(p1, "host-before-start");

    await mouseClick(p1, "Démarrer la partie");
    await sleep(3500);

    const afterStart = await bodyText(p1);
    console.log("  After start:", afterStart.slice(0, 250).replace(/\n/g, " "));
    ok(afterStart.includes("défi") || afterStart.includes("Prochain") || afterStart.includes("LANCER"), "Preset round grid visible");
    await shot(p1, "host-idle-state");

  } catch (e) {
    console.error("[User 1] Start error:", e.message);
    fail++;
  }

  // ── USER 1: Open Round ─────────────────────────────────────────────────────
  console.log("\n[User 1] Opening round 'Prochain but ?'...");
  try {
    await mouseClick(p1, "Prochain but");
    await sleep(3500);

    const roundText = await bodyText(p1);
    console.log("  Round text:", roundText.slice(0, 250).replace(/\n/g, " "));
    ok(roundText.includes("secondes") || roundText.includes("Prochain but"), "Round opened");
    await shot(p1, "host-round-open");

  } catch (e) {
    console.error("[User 1] Open round error:", e.message);
    fail++;
  }

  // ── USERS 2 & 3: Load + Bet ────────────────────────────────────────────────
  console.log("\n[Users 2 & 3] Joining open round and betting...");
  try {
    await Promise.all([
      p2.goto(soireeUrl, { waitUntil: "networkidle2", timeout: 15000 }),
      p3.goto(soireeUrl, { waitUntil: "networkidle2", timeout: 15000 }),
    ]);
    await sleep(3000);

    await Promise.all([shot(p2, "guest2-round-open"), shot(p3, "guest3-round-open")]);
    const [t2, t3] = await Promise.all([bodyText(p2), bodyText(p3)]);
    console.log("  User 2:", t2.slice(0, 180).replace(/\n/g, " "));
    ok(t2.includes("secondes") || t2.includes("Prochain but"), "User 2 sees open round");
    ok(t3.includes("secondes") || t3.includes("Prochain but"), "User 3 sees open round");

    // User 2 bets "Équipe dom."
    await mouseClick(p2, "Équipe dom.");
    await sleep(2000);
    const after2 = await bodyText(p2);
    ok(after2.includes("pari") || after2.includes("dom") || after2.includes("toi)"), "User 2 bet placed");
    await shot(p2, "guest2-bet-placed");

    // User 3 bets "Équipe ext."
    await mouseClick(p3, "Équipe ext.");
    await sleep(2000);
    const after3 = await bodyText(p3);
    ok(after3.includes("pari") || after3.includes("ext") || after3.includes("toi)"), "User 3 bet placed");
    await shot(p3, "guest3-bet-placed");

  } catch (e) {
    console.error("[Users 2&3] Bet error:", e.message);
    fail++;
  }

  // ── USER 1: Wait for auto-lock then resolve ─────────────────────────────────
  console.log("\n[User 1] Waiting for round auto-lock (45s)...");
  try {
    const locked = await waitForText(p1, "bonne réponse", 55000);
    ok(locked, "Round auto-locked after 45s countdown");
    await shot(p1, "host-round-locked");

    const lockText = await bodyText(p1);
    console.log("  Lock text:", lockText.slice(0, 300).replace(/\n/g, " "));

    // Resolve: tap "Équipe dom." as correct answer
    await mouseClick(p1, "Équipe dom.");
    await sleep(4000);

    const resolvedText = await bodyText(p1);
    console.log("  Resolved text:", resolvedText.slice(0, 300).replace(/\n/g, " "));
    ok(
      resolvedText.includes("raison") || resolvedText.includes("Bonne réponse") || resolvedText.includes("Punition"),
      "Round resolved — winner/punishments visible"
    );
    await shot(p1, "host-round-resolved");

  } catch (e) {
    console.error("[User 1] Resolve error:", e.message);
    await shot(p1, "host-resolve-error").catch(() => {});
    fail++;
  }

  // ── Verify final state ───────────────────────────────────────────────────────
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

    ok([t1, t2, t3].some((t) => /\d+\s*pts/.test(t)), "Points visible in leaderboard");
    ok(
      [t1, t2, t3].some((t) => t.includes("Punition") || t.includes("shot") || t.includes("pompe") || t.includes("story")),
      "Punishment text visible"
    );
    ok([t1, t2, t3].some((t) => t.includes("raison")), "Winner shown");
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
