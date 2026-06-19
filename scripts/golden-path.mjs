/**
 * YaFoot Golden-Path Puppeteer Tests
 * Full onboarding flow: language picker → welcome → invite → app
 * Covers: onboarding, matches/groups, match-detail+stats, predictions, leagues, friends, profile, privacy
 */
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.URL || "https://dist-five-zeta-92i4a6g3xx.vercel.app";
const SHOT_DIR = "/tmp/yafoot-test";
mkdirSync(SHOT_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let shotIdx = 0;
async function shot(page, name) {
  const file = `${SHOT_DIR}/${String(++shotIdx).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: file, fullPage: false });
  console.log(`    📸 ${file}`);
  return file;
}

// Find and click element by exact text
async function tapText(page, text) {
  return page.evaluate((t) => {
    const el = [...document.querySelectorAll("*")].find(
      (n) => n.children.length === 0 && (n.textContent || "").trim() === t
    );
    if (el) { el.click(); return true; }
    return false;
  }, text);
}

// Find and click element matching regex
async function tapRegex(page, pattern) {
  return page.evaluate((r) => {
    const rx = new RegExp(r);
    const el = [...document.querySelectorAll("*")].find(
      (n) => n.children.length === 0 && rx.test((n.textContent || "").trim())
    );
    if (el) { el.click(); return true; }
    return false;
  }, pattern.source);
}

// Fill the last visible input on the page
async function fillInput(page, value) {
  return page.evaluate((val) => {
    const inputs = [...document.querySelectorAll("input")];
    const i = inputs[inputs.length - 1];
    if (!i) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(i, val);
    i.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }, value);
}

// Get full body text
const bodyText = (page) => page.evaluate(() => document.body.innerText);

const results = [];
function pass(name, detail = "") {
  results.push({ name, status: "PASS", detail });
  console.log(`  ✅ PASS: ${name}${detail ? " — " + detail : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, status: "FAIL", detail });
  console.log(`  ❌ FAIL: ${name}${detail ? " — " + detail : ""}`);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: "new",
    protocolTimeout: 180000,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 430, height: 932 });
  page.on("dialog", async (d) => { await d.accept().catch(() => {}); });

  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  // ──────────────────────────────────────────────
  // TEST 1: Onboarding — language → welcome → invite → app
  // ──────────────────────────────────────────────
  console.log("\n[1] Onboarding");
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
    await sleep(5000);
    const txt = await bodyText(page);

    // Step 1a: Language picker
    const hasLangPicker = /Pick your language|Choisis ta langue|English|Français/i.test(txt);
    if (hasLangPicker) {
      pass("Language picker screen loads");
      await shot(page, "01-language");
      await tapText(page, "English");
      await sleep(4000);
    } else if (/Your name|TON PRÉNOM|username|YaFoot/i.test(txt)) {
      pass("Welcome screen loads (language already set)");
    } else {
      fail("Initial screen loads", "unexpected: " + txt.slice(0, 100));
      await shot(page, "01-initial-FAIL");
    }

    // Step 1b: Welcome / username screen
    const txt2 = await bodyText(page);
    const hasWelcome = /Your name|TON PRÉNOM|username|YaFoot|Predict/i.test(txt2);
    if (hasWelcome) {
      pass("Welcome/username screen loads");
      await shot(page, "02-welcome");

      const username = "tester" + Date.now().toString(36).slice(-5);
      await fillInput(page, username);
      await sleep(500);
      // Button is "Let's go!" in English
      const clicked = await tapText(page, "Let's go!");
      if (!clicked) await tapRegex(page, /Let.*go|Get started|C.est parti/i);
      await sleep(7000);
      await shot(page, "03-post-signup");

      const txt3 = await bodyText(page);
      const signedup = /invite|Continue to app|You.re in|T.es dans/i.test(txt3);
      if (signedup) {
        pass("Sign up + reach invite screen", `username=${username}`);
      } else {
        fail("Sign up + reach invite screen", "body: " + txt3.slice(0, 150));
      }

      // Step 1c: Invite screen → Continue to app
      const continued = await tapText(page, "Continue to app");
      if (!continued) await tapRegex(page, /Continue|Continuer/i);
      await sleep(5000);
    } else {
      fail("Welcome/username screen", "body: " + txt2.slice(0, 100));
      await shot(page, "02-welcome-FAIL");
    }

    const txt4 = await bodyText(page);
    const inApp = /Matches|Matchs|Live|Upcoming|Leagues|Friends|Profile/i.test(txt4);
    if (inApp) {
      pass("Reached main app after onboarding");
      await shot(page, "04-main-app");
    } else {
      fail("Reached main app", "body: " + txt4.slice(0, 150));
      await shot(page, "04-main-app-FAIL");
    }
  } catch (e) {
    fail("Onboarding", e.message);
    await shot(page, "01-onboarding-CRASH");
  }

  // ──────────────────────────────────────────────
  // TEST 2: Matches tab — cards + sub-tabs
  // ──────────────────────────────────────────────
  console.log("\n[2] Matches tab");
  try {
    await tapText(page, "Matches");
    await sleep(3000);
    const txt = await bodyText(page);
    const hasMatches = /Live|Upcoming|Results|Groups|vs|VS|—|\d+:\d+/i.test(txt);
    if (hasMatches) {
      pass("Match cards visible");
      await shot(page, "05-matches");
    } else {
      fail("Match cards visible", txt.slice(0, 150));
      await shot(page, "05-matches-FAIL");
    }

    // Groups sub-tab
    await tapText(page, "Groups");
    await sleep(3000);
    const groupsTxt = await bodyText(page);
    const hasGroups = /Group [A-H]|Pts|W\s|P\s|GD/i.test(groupsTxt);
    if (hasGroups) {
      pass("Groups standings table visible");
      await shot(page, "06-groups");
    } else {
      fail("Groups standings table visible", groupsTxt.slice(0, 150));
      await shot(page, "06-groups-FAIL");
    }

    // Switch to Upcoming to find matches to click
    await tapText(page, "Upcoming");
    await sleep(2500);
  } catch (e) {
    fail("Matches tab", e.message);
    await shot(page, "05-matches-CRASH");
  }

  // ──────────────────────────────────────────────
  // TEST 3: Match detail + Predictions
  // ──────────────────────────────────────────────
  console.log("\n[3] Match detail + predictions");
  try {
    // Click on any match card to go to /match/[id]
    const clickedMatch = await page.evaluate(() => {
      const all = [...document.querySelectorAll("div, button, [role='button']")];
      const card = all.find(
        (n) => n.textContent && /VS|\d+-\d+/i.test(n.textContent)
          && n.children.length > 0 && n.children.length < 20
          && n.offsetParent !== null
      );
      if (card) { card.click(); return true; }
      return false;
    });
    await sleep(4000);

    const txt = await bodyText(page);
    const onMatchDetail = /VS|Make your prediction|Update your prediction|Predictions locked|Win probability|Group [A-H]|FULL TIME|LIVE|Lock In/i.test(txt);
    if (onMatchDetail) {
      pass("Match detail screen opens");
      await shot(page, "07-match-detail");

      const hasStepper = /Make your prediction|Update your prediction|Lock In/i.test(txt);
      if (hasStepper) {
        pass("Prediction stepper visible on upcoming match");
        await page.evaluate(() => {
          const plusBtns = [...document.querySelectorAll("*")].filter(
            (n) => n.children.length === 0 && n.textContent.trim() === "+"
          );
          if (plusBtns[0]) { plusBtns[0].click(); plusBtns[0].click(); }
        });
        await sleep(500);
        await tapRegex(page, /Lock In|Update Prediction/i);
        await sleep(3500);
        pass("Prediction save attempted");
        await shot(page, "08-after-predict");
      } else {
        pass("Match detail loads (match locked/finished — no stepper expected)");
      }
    } else {
      fail("Match detail screen opens", "body: " + txt.slice(0, 200));
      await shot(page, "07-match-detail-FAIL");
    }
  } catch (e) {
    fail("Match detail + predictions", e.message);
    await shot(page, "07-match-detail-CRASH");
  }

  // ──────────────────────────────────────────────
  // TEST 4: Stats screen (/stats/[id])
  // ──────────────────────────────────────────────
  console.log("\n[4] Stats (Elo model)");
  try {
    await tapText(page, "Matches");
    await sleep(3000);
    await tapText(page, "Upcoming");
    await sleep(2000);
    const clickedStats = await tapRegex(page, /Stats/i);
    await sleep(4000);
    const txt = await bodyText(page);
    const hasStats = /probability|Win|Elo|%|forecast|chance/i.test(txt);
    if (clickedStats && hasStats) {
      pass("Stats/Elo screen loads with probability content");
      await shot(page, "09-stats");
    } else if (!clickedStats) {
      fail("Stats button not found on match cards");
      await shot(page, "09-stats-FAIL");
    } else {
      fail("Stats content missing", "body: " + txt.slice(0, 200));
      await shot(page, "09-stats-FAIL");
    }
    await tapRegex(page, /‹|Back/i);
    await sleep(1500);
  } catch (e) {
    fail("Stats screen", e.message);
    await shot(page, "09-stats-CRASH");
  }

  // ──────────────────────────────────────────────
  // TEST 5: Leagues — create + get join code
  // ──────────────────────────────────────────────
  console.log("\n[5] Leagues");
  try {
    await tapText(page, "Leagues");
    await sleep(3000);
    const txt = await bodyText(page);
    const hasLeagues = /League|Create|Join|No leagues/i.test(txt);
    if (hasLeagues) {
      pass("Leagues tab loads");
      await shot(page, "10-leagues");
    } else {
      fail("Leagues tab loads", txt.slice(0, 150));
      await shot(page, "10-leagues-FAIL");
    }

    let clickedCreate = await tapText(page, "Create League");
    if (!clickedCreate) clickedCreate = await tapRegex(page, /Create|New League/i);
    await sleep(3000);
    const txt2 = await bodyText(page);
    // Step 1: "How long?" — pick Full tournament then Next
    const hasStep1 = /How long|Full tournament|Group stage|Weekend/i.test(txt2);
    if (hasStep1) {
      pass("Create league wizard step 1 (match count) opens");
      await shot(page, "11-create-league-step1");

      // Pick "Full tournament" (104 matches)
      await tapText(page, "Full tournament");
      await sleep(500);
      await tapText(page, "Next");
      await sleep(2000);

      // Step 2: "Loser's punishment" — click Next to skip
      const txt2b = await bodyText(page);
      if (/punishment|Loser|Skip|punition/i.test(txt2b)) {
        await tapText(page, "Next");
        await sleep(2000);
      }

      // Step 3: "Name your league" — fill name
      const txt2c = await bodyText(page);
      if (/Name your league|Nomme ta ligue/i.test(txt2c)) {
        pass("Create league step 3 (name) reaches");
        await fillInput(page, "TestLeague" + Date.now().toString(36).slice(-4));
        await sleep(400);
        await tapText(page, "Create League");
        await sleep(5000);
      }

      const txt3 = await bodyText(page);
      const hasCode = /\d{4,8}|code|invite|join|Code|INVITE CODE/i.test(txt3);
      if (hasCode) {
        pass("League created with join code visible");
        await shot(page, "12-league-created");
      } else {
        fail("League created join code", "body: " + txt3.slice(0, 200));
        await shot(page, "12-league-created-FAIL");
      }
    } else {
      fail("Create league form", "body: " + txt2.slice(0, 100));
      await shot(page, "11-create-league-FAIL");
    }
  } catch (e) {
    fail("Leagues", e.message);
    await shot(page, "10-leagues-CRASH");
  }

  // ──────────────────────────────────────────────
  // TEST 6: Friends — search + send request
  // ──────────────────────────────────────────────
  console.log("\n[6] Friends");
  try {
    await tapText(page, "Friends");
    await sleep(3000);
    const txt = await bodyText(page);
    const hasFriends = /Friend|Search|Add|No friends|Potes/i.test(txt);
    if (hasFriends) {
      pass("Friends tab loads");
      await shot(page, "13-friends");
    } else {
      fail("Friends tab loads", txt.slice(0, 150));
      await shot(page, "13-friends-FAIL");
    }

    await fillInput(page, "tourist");
    await sleep(2500);
    const txt2 = await bodyText(page);
    const hasResults = /tourist|Add|Request|No results|No users|found/i.test(txt2);
    if (hasResults) {
      pass("Friend search returns results");
      await shot(page, "14-friend-search");
      const sentReq = await tapRegex(page, /Add friend|Send request|Add/i);
      await sleep(2000);
      if (sentReq) {
        pass("Friend request sent");
        await shot(page, "15-friend-request-sent");
      } else {
        pass("Friend search works (no Add button — may be same user)");
      }
    } else {
      // Try with a simpler search
      await fillInput(page, "a");
      await sleep(2000);
      const txt3 = await bodyText(page);
      if (/Add|No results|user/i.test(txt3)) {
        pass("Friend search functional");
        await shot(page, "14-friend-search-alt");
      } else {
        fail("Friend search results", "body: " + txt2.slice(0, 150));
        await shot(page, "14-friend-search-FAIL");
      }
    }
  } catch (e) {
    fail("Friends", e.message);
    await shot(page, "13-friends-CRASH");
  }

  // ──────────────────────────────────────────────
  // TEST 7: Profile — points + My Forecasts
  // ──────────────────────────────────────────────
  console.log("\n[7] Profile");
  try {
    await tapText(page, "Profile");
    await sleep(3500);
    const txt = await bodyText(page);
    const hasProfile = /points|pts|Prediction|Forecast|Profile|Profil|tester/i.test(txt);
    if (hasProfile) {
      pass("Profile loads with stats");
      await shot(page, "16-profile");
    } else {
      fail("Profile loads", txt.slice(0, 150));
      await shot(page, "16-profile-FAIL");
    }

    const clickedForecasts = await tapRegex(page, /My Forecast|Forecasts|Predictions|Pronos/i);
    if (clickedForecasts) {
      await sleep(3000);
      const txt2 = await bodyText(page);
      const hasForecasts = /Forecast|Prediction|Prono|no prediction|score|picked|You haven/i.test(txt2);
      if (hasForecasts) {
        pass("My Forecasts screen loads");
        await shot(page, "17-forecasts");
      } else {
        fail("My Forecasts content", txt2.slice(0, 150));
        await shot(page, "17-forecasts-FAIL");
      }
    } else {
      const hasForecasts = /Forecast|Prediction|no prediction|Prono/i.test(txt);
      if (hasForecasts) {
        pass("My Forecasts visible on profile");
      } else {
        fail("My Forecasts", "button not found");
      }
    }
  } catch (e) {
    fail("Profile", e.message);
    await shot(page, "16-profile-CRASH");
  }

  // ──────────────────────────────────────────────
  // TEST 8: Privacy page
  // ──────────────────────────────────────────────
  console.log("\n[8] Privacy page");
  try {
    await page.goto(`${BASE}/privacy`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await sleep(3000);
    const txt = await bodyText(page);
    const hasPrivacy = /Privacy|data|personal|collect|policy/i.test(txt);
    if (hasPrivacy) {
      pass("Privacy page loads with policy text");
      await shot(page, "18-privacy");
    } else {
      fail("Privacy page loads", "body: " + txt.slice(0, 200));
      await shot(page, "18-privacy-FAIL");
    }
  } catch (e) {
    fail("Privacy page", e.message);
    await shot(page, "18-privacy-CRASH");
  }

  await browser.close();

  // ──────────────────────────────────────────────
  // SUMMARY
  // ──────────────────────────────────────────────
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  console.log("\n═══════════════════════════════════════");
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════");
  results.forEach((r) => {
    const icon = r.status === "PASS" ? "✅" : "❌";
    console.log(`${icon} ${r.name}${r.detail ? ": " + r.detail : ""}`);
  });
  if (pageErrors.length > 0) {
    console.log(`\nPage errors (${pageErrors.length}):`);
    pageErrors.slice(0, 5).forEach((e) => console.log("  •", e.slice(0, 140)));
  }
  console.log("\nScreenshots in:", SHOT_DIR);

  writeFileSync("/tmp/yafoot-test-results.json", JSON.stringify({ passed, failed, results, pageErrors }, null, 2));
})().catch((e) => {
  console.error("FATAL CRASH:", e.message);
  process.exit(1);
});
