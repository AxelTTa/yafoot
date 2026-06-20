// Party mode 3-user test: host creates soirée, starts game, opens round;
// guests join and bet; host resolves; verify points + punishments.
import puppeteer from "puppeteer-core";
import { mkdirSync, existsSync } from "node:fs";

const URL = process.env.URL || "https://dist-five-zeta-92i4a6g3xx.vercel.app";
const CHROME = process.env.CHROME || "/usr/bin/google-chrome";
const SHOT = "/tmp/party-test";
mkdirSync(SHOT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0, shotIdx = 0;
const ok = (c, m) => { c ? (pass++, console.log("  ✓", m)) : (fail++, console.log("  ✗ FAIL:", m)); };

async function shot(page, name) {
  const path = `${SHOT}/${String(++shotIdx).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`    [screenshot] ${path}`);
}

function wire(page) {
  page._dialogs = [];
  page.on("dialog", async (d) => { page._dialogs.push(d.message()); await d.accept().catch(() => {}); });
  page.on("console", (m) => { if (m.type() === "error") console.log("  [console error]", m.text()); });
}

async function fill(page, placeholder, value) {
  return page.evaluate((p, v) => {
    const inputs = [...document.querySelectorAll("input,textarea")];
    const el = inputs.reverse().find((i) => (i.placeholder || "").toLowerCase().includes(p.toLowerCase()));
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set
      || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    if (!setter) return false;
    setter.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, placeholder, value);
}

async function tapText(page, text, exact = false) {
  return page.evaluate((t, ex) => {
    const els = [...document.querySelectorAll("*")].filter((n) => {
      const txt = (n.textContent || "").trim();
      return ex ? txt === t : txt.includes(t);
    });
    // prefer leaf nodes
    const leaf = els.find((n) => n.children.length === 0);
    const el = leaf || els[els.length - 1];
    if (!el) return false;
    el.click();
    return true;
  }, text, exact);
}

async function bodyText(page) {
  return page.evaluate(() => document.body.innerText);
}

async function waitForText(page, text, timeout = 8000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const t = await bodyText(page);
    if (t.includes(text)) return true;
    await sleep(400);
  }
  return false;
}

async function onboard(page, username) {
  await page.goto(`${URL}/`, { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(1500);
  // If already on home, skip onboarding
  const txt = await bodyText(page);
  if (txt.includes("Groupe") || txt.includes("League") || txt.includes("Matchs")) return;
  // Fill username
  const ok1 = await fill(page, "username", username);
  if (!ok1) {
    // Try clicking on input and typing
    await page.click("input").catch(() => {});
    await page.type("input", username);
  }
  await sleep(500);
  // Tap Next / Continue / Create
  for (const label of ["Continue", "Next", "Créer", "Commencer", "C'est parti"]) {
    const found = await tapText(page, label, false);
    if (found) break;
  }
  await sleep(2000);
}

async function goToSoiree(page) {
  await page.goto(`${URL}/soiree`, { waitUntil: "networkidle2", timeout: 20000 });
  await sleep(1000);
}

(async () => {
  console.log("\n=== Party Mode 3-User Test ===");
  console.log(`URL: ${URL}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--window-size=390,844"],
    defaultViewport: { width: 390, height: 844 },
  });

  // Three isolated browser contexts = three separate localStorage
  const ctx1 = await browser.createBrowserContext();
  const ctx2 = await browser.createBrowserContext();
  const ctx3 = await browser.createBrowserContext();

  const [p1, p2, p3] = await Promise.all([
    ctx1.newPage(), ctx2.newPage(), ctx3.newPage(),
  ]);
  wire(p1); wire(p2); wire(p3);

  let soireeCode = null;
  let soireeUrl = null;

  // ── USER 1: Onboard + Host soirée ──────────────────────────────────────────
  console.log("\n[User 1] Onboarding...");
  try {
    await p1.goto(`${URL}/`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(2000);
    const t1 = await bodyText(p1);
    console.log("  Page text snippet:", t1.slice(0, 120).replace(/\n/g, " "));

    // Onboard
    await onboard(p1, "PartyHost" + Date.now().toString().slice(-4));
    await sleep(1500);

    // Navigate to soirée
    console.log("[User 1] Going to Soirée...");
    await goToSoiree(p1);
    await shot(p1, "host-soiree-landing");

    const txt = await bodyText(p1);
    ok(txt.includes("Soirée") || txt.includes("Party"), "Soirée page loaded");

    // Tap 'Organiser une Soirée'
    await tapText(p1, "Organiser");
    await sleep(1500);
    await shot(p1, "host-modal-open");

    // Wait for match list to load
    await sleep(2000);
    const afterModal = await bodyText(p1);
    console.log("  Modal text:", afterModal.slice(0, 200).replace(/\n/g, " "));

    // Try to select first match
    const matchSelected = await p1.evaluate(() => {
      // Find rows in the match list
      const items = [...document.querySelectorAll("[data-testid], [role='button']")];
      const matchRows = [...document.querySelectorAll("*")].filter((el) => {
        const txt = (el.textContent || "").trim();
        return txt.includes("vs") && el.children.length <= 5;
      });
      if (matchRows.length > 0) { matchRows[0].click(); return true; }
      return false;
    });
    console.log("  Match selected:", matchSelected);
    await sleep(800);

    // Try to create soirée
    await tapText(p1, "Créer");
    await sleep(3000);

    soireeUrl = p1.url();
    console.log("  URL after create:", soireeUrl);
    ok(soireeUrl.includes("/soiree/"), "Navigated to soirée room");

    // Capture the join code
    await shot(p1, "host-lobby");
    const lobbyText = await bodyText(p1);
    console.log("  Lobby text snippet:", lobbyText.slice(0, 300).replace(/\n/g, " "));

    const codeMatch = lobbyText.match(/Code:\s*([A-Z0-9]{6})/);
    soireeCode = codeMatch?.[1] ?? null;
    console.log("  Join code:", soireeCode);
    ok(soireeCode && soireeCode.length === 6, `Join code visible: ${soireeCode}`);

  } catch (e) {
    console.error("[User 1] Error:", e.message);
    await shot(p1, "host-error");
    fail++;
  }

  if (!soireeUrl || !soireeCode) {
    console.log("\nCannot continue without soirée URL/code. Aborting.");
    await browser.close();
    console.log(`\nResults: ${pass} passed, ${fail} failed`);
    process.exit(fail > 0 ? 1 : 0);
  }

  // ── USERS 2 & 3: Onboard + Join ────────────────────────────────────────────
  console.log("\n[Users 2 & 3] Onboarding + Joining...");
  try {
    await Promise.all([
      onboard(p2, "Guest2" + Date.now().toString().slice(-4)),
      onboard(p3, "Guest3" + Date.now().toString().slice(-4)),
    ]);

    // Go to soirée index
    await Promise.all([goToSoiree(p2), goToSoiree(p3)]);
    await sleep(1000);

    // Tap 'Rejoindre une Soirée' for both
    await Promise.all([tapText(p2, "Rejoindre"), tapText(p3, "Rejoindre")]);
    await sleep(1200);

    // Fill the 6-char code
    await Promise.all([
      fill(p2, "ABC", soireeCode),
      fill(p3, "ABC", soireeCode),
    ]);
    await sleep(600);

    // Tap 'Rejoindre' (join button)
    await Promise.all([tapText(p2, "Rejoindre"), tapText(p3, "Rejoindre")]);
    await sleep(3000);

    const [url2, url3] = [p2.url(), p3.url()];
    ok(url2.includes("/soiree/"), `User 2 joined soirée: ${url2}`);
    ok(url3.includes("/soiree/"), `User 3 joined soirée: ${url3}`);

    await shot(p2, "guest2-lobby");
    await shot(p3, "guest3-lobby");

  } catch (e) {
    console.error("[Users 2&3] Error:", e.message);
    fail++;
  }

  // ── USER 1: Start Game ──────────────────────────────────────────────────────
  console.log("\n[User 1] Starting game...");
  try {
    // Navigate back to room if needed
    await p1.goto(soireeUrl, { waitUntil: "networkidle2", timeout: 15000 });
    await sleep(1500);
    await shot(p1, "host-before-start");

    await tapText(p1, "Démarrer la partie");
    await sleep(2500);

    const activeText = await bodyText(p1);
    console.log("  After start:", activeText.slice(0, 200).replace(/\n/g, " "));
    ok(activeText.includes("LANCER") || activeText.includes("défi") || activeText.includes("Prochain"), "Game started — preset grid visible");
    await shot(p1, "host-idle-state");

  } catch (e) {
    console.error("[User 1] Start game error:", e.message);
    fail++;
  }

  // ── USER 1: Open Round 'Prochain but?' ─────────────────────────────────────
  console.log("\n[User 1] Opening round 'Prochain but?'...");
  try {
    const opened = await tapText(p1, "Prochain but ?");
    await sleep(2500);

    const roundText = await bodyText(p1);
    console.log("  Round text:", roundText.slice(0, 250).replace(/\n/g, " "));
    ok(roundText.includes("Prochain but") || roundText.includes("secondes"), "Round opened with countdown");
    await shot(p1, "host-round-open");

  } catch (e) {
    console.error("[User 1] Open round error:", e.message);
    fail++;
  }

  // ── USERS 2 & 3: Refresh + Bet ─────────────────────────────────────────────
  console.log("\n[Users 2 & 3] Loading room + betting...");
  try {
    // Reload to get latest state via realtime
    await Promise.all([
      p2.goto(soireeUrl, { waitUntil: "networkidle2", timeout: 15000 }),
      p3.goto(soireeUrl, { waitUntil: "networkidle2", timeout: 15000 }),
    ]);
    await sleep(2500);

    await Promise.all([shot(p2, "guest2-round-open"), shot(p3, "guest3-round-open")]);

    const [t2, t3] = await Promise.all([bodyText(p2), bodyText(p3)]);
    console.log("  User 2 sees:", t2.slice(0, 200).replace(/\n/g, " "));
    console.log("  User 3 sees:", t3.slice(0, 200).replace(/\n/g, " "));

    ok(t2.includes("Prochain but") || t2.includes("secondes"), "User 2 sees open round");
    ok(t3.includes("Prochain but") || t3.includes("secondes"), "User 3 sees open round");

    // User 2 bets "Équipe dom."
    await tapText(p2, "Équipe dom.");
    await sleep(1000);
    const after2 = await bodyText(p2);
    ok(after2.includes("Équipe dom.") || after2.includes("pari"), "User 2 placed bet");
    await shot(p2, "guest2-bet-placed");

    // User 3 bets "Équipe ext."
    await tapText(p3, "Équipe ext.");
    await sleep(1000);
    const after3 = await bodyText(p3);
    ok(after3.includes("Équipe ext.") || after3.includes("pari"), "User 3 placed bet");
    await shot(p3, "guest3-bet-placed");

  } catch (e) {
    console.error("[Users 2&3] Bet error:", e.message);
    fail++;
  }

  // ── USER 1: Wait for lock (countdown or manual) then resolve ───────────────
  console.log("\n[User 1] Waiting for round to lock (up to 50s)...");
  try {
    // Wait for locked state
    const locked = await waitForText(p1, "bonne réponse", 55000);
    ok(locked, "Round locked — resolve UI appeared");

    await p1.reload({ waitUntil: "networkidle2" });
    await sleep(1500);
    const lockText = await bodyText(p1);
    console.log("  After lock:", lockText.slice(0, 250).replace(/\n/g, " "));
    await shot(p1, "host-round-locked");

    // Tap "Équipe dom." as the correct answer
    await tapText(p1, "Équipe dom.", true);
    await sleep(3000);

    const resolvedText = await bodyText(p1);
    console.log("  After resolve:", resolvedText.slice(0, 300).replace(/\n/g, " "));
    ok(resolvedText.includes("raison") || resolvedText.includes("Bonne réponse") || resolvedText.includes("pts"), "Round resolved");
    await shot(p1, "host-round-resolved");

  } catch (e) {
    console.error("[User 1] Resolve error:", e.message);
    await shot(p1, "host-resolve-error");
    fail++;
  }

  // ── Verify: points + punishments visible ───────────────────────────────────
  console.log("\n[All] Verifying points and punishments...");
  try {
    await sleep(2000);
    // Reload guests
    await Promise.all([
      p2.goto(soireeUrl, { waitUntil: "networkidle2", timeout: 15000 }),
      p3.goto(soireeUrl, { waitUntil: "networkidle2", timeout: 15000 }),
    ]);
    await sleep(2500);

    await Promise.all([shot(p2, "guest2-after-resolve"), shot(p3, "guest3-after-resolve")]);

    const [t1, t2, t3] = await Promise.all([bodyText(p1), bodyText(p2), bodyText(p3)]);

    // Check leaderboard shows points
    const hasPoints = [t1, t2, t3].some((t) => t.includes("pts") || /\d+\s*pts/.test(t));
    ok(hasPoints, "Points visible in leaderboard");

    const hasPunishment = [t1, t2, t3].some((t) =>
      t.includes("Punition") || t.includes("shot") || t.includes("pompe") || t.includes("doit")
    );
    ok(hasPunishment, "Punishments displayed for losers");

    // Check winner message
    const hasWinner = [t1, t2, t3].some((t) => t.includes("raison"));
    ok(hasWinner, "Winner celebration displayed");

  } catch (e) {
    console.error("[Verify] Error:", e.message);
    fail++;
  }

  // ── Final screenshots ───────────────────────────────────────────────────────
  await Promise.all([
    shot(p1, "final-host"),
    shot(p2, "final-guest2"),
    shot(p3, "final-guest3"),
  ]);

  await browser.close();

  console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
  console.log(`Screenshots in ${SHOT}/`);
  process.exit(fail > 0 ? 1 : 0);
})();
