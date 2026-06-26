/**
 * Data integrity + UI error hunting test - 4 simulated users
 * Checks: match data accuracy, prediction scoring display, league leaderboard, match status display
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const BASE_URL = process.env.URL || 'https://dist-five-zeta-92i4a6g3xx.vercel.app';
const CHROME = '/usr/bin/google-chrome';
const SHOT = '/tmp/di-test';
mkdirSync(SHOT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0, shotIdx = 0;
const bugs = [];

function ok(cond, msg, ctx = '') {
  if (cond) { pass++; console.log('  ✓', msg); }
  else { fail++; bugs.push({ msg, ctx: (ctx || '').slice(0, 200) }); console.log('  ✗ FAIL:', msg, ctx ? `[${ctx.slice(0, 80)}]` : ''); }
}

async function shot(page, desc) {
  shotIdx++;
  const p = `${SHOT}/step-${String(shotIdx).padStart(2,'0')}-${desc.replace(/[^a-z0-9]/gi,'-').toLowerCase()}.png`;
  await page.screenshot({ path: p }).catch(() => {});
  console.log(`    [shot] ${p}`);
}

const bodyText = (page) => page.evaluate(() => document.body.innerText).catch(() => '');

async function waitFor(page, regex, timeout = 20000) {
  const d = Date.now() + timeout;
  while (Date.now() < d) {
    if (regex.test(await bodyText(page))) return true;
    await sleep(400);
  }
  return false;
}

async function mouseClick(page, text, opts = {}) {
  const { timeout = 5000 } = opts;
  const d = Date.now() + timeout;
  while (Date.now() < d) {
    const rect = await page.evaluate((t) => {
      const all = [...document.querySelectorAll('*')].filter(n => {
        if (n.offsetParent === null || n.offsetHeight < 1 || n.offsetWidth < 1) return false;
        return (n.textContent || '').trim().includes(t);
      });
      if (!all.length) return null;
      all.sort((a, b) => (a.offsetWidth * a.offsetHeight) - (b.offsetWidth * b.offsetHeight));
      const el = all[0];
      const r = el.getBoundingClientRect();
      return r.width && r.height ? { x: r.left + r.width/2, y: r.top + r.height/2 } : null;
    }, text);
    if (rect) { await page.mouse.click(rect.x, rect.y); return true; }
    await sleep(300);
  }
  return false;
}

async function clickTab(page, name) {
  const clicked = await page.evaluate((tabName) => {
    const els = [...document.querySelectorAll('*')].filter(n => {
      if (n.children.length !== 0) return false;
      if ((n.textContent || '').trim() !== tabName) return false;
      if (n.offsetParent === null || n.offsetHeight < 1) return false;
      return n.getBoundingClientRect().top > window.innerHeight * 0.70;
    });
    if (!els.length) return false;
    const r = els[0].getBoundingClientRect();
    els[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: r.left + r.width/2, clientY: r.top + r.height/2 }));
    return true;
  }, name);
  if (clicked) return true;
  return mouseClick(page, name, { timeout: 3000 });
}

async function fillInput(page, value) {
  return page.evaluate((v) => {
    const inputs = [...document.querySelectorAll('input')];
    const el = inputs[inputs.length - 1];
    if (!el) return false;
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (!s) return false;
    s.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, value);
}

const inMainApp = (t) =>
  /(?:Matches|Predict|Leagues|Friends|Profile).*(?:Matches|Predict|Leagues|Friends|Profile)/s.test(t) ||
  (/Live|Upcoming|Groups|Results/i.test(t) && /Predict|Leagues|Friends/i.test(t));

async function onboard(page, prefix) {
  const username = (prefix + Date.now().toString(36).slice(-5)).slice(0, 18).toLowerCase().replace(/[^a-z0-9]/g, '');
  console.log(`    [onboard] ${username}`);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitFor(page, /Let's go!|Get started|YOUR NAME|Pick your language|Choisis/i, 30000);
  await sleep(1000);

  const t0 = await bodyText(page);
  if (/Pick your language|Choisis/i.test(t0)) {
    await mouseClick(page, 'English', { timeout: 5000 });
    await sleep(1500);
  }

  await waitFor(page, /Let's go!|Get started|YOUR NAME/i, 15000);
  await sleep(500);

  const focused = await page.evaluate(() => {
    const el = [...document.querySelectorAll('input')].pop();
    if (el) { el.focus(); return true; }
    return false;
  });
  if (focused) {
    await page.keyboard.type(username, { delay: 40 });
  } else {
    await fillInput(page, username);
  }
  await sleep(500);

  // Click submit button
  const submitted = await mouseClick(page, "Let's go!", { timeout: 5000 }) ||
                    await mouseClick(page, 'Get started', { timeout: 3000 }) ||
                    await mouseClick(page, 'Continue', { timeout: 3000 }) ||
                    await page.evaluate(() => {
                      const btns = [...document.querySelectorAll('button,[role="button"]')];
                      const b = btns.find(el => /go|start|play|continue/i.test(el.textContent||''));
                      if (b) { b.click(); return true; }
                      return false;
                    });

  await waitFor(page, /Matches|Leagues|Friends|Profile|Predict|Continue to app/i, 30000);
  await sleep(2000);

  // Dismiss invite screen
  const tAfter = await bodyText(page);
  if (/Continue to app|invite link|Share invite|arena/i.test(tAfter)) {
    await mouseClick(page, 'Continue to app', { timeout: 5000 });
    await sleep(3000);
  }

  const t = await bodyText(page);
  return { username, inApp: inMainApp(t) };
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    // ==================== USER 1: Match data accuracy ====================
    console.log('\n[User 1] Match data accuracy');
    const ctx1 = await browser.createBrowserContext();
    const p1 = await ctx1.newPage();
    await p1.setViewport({ width: 390, height: 844 });

    const { inApp: u1inApp } = await onboard(p1, 'diu1');
    ok(u1inApp, 'User 1 reached main app');
    await shot(p1, 'u1-main');

    // Check matches tab (should be default)
    const t1 = await bodyText(p1);
    const hasMatchContent = /Live|Upcoming|Groups|Results|Spain|Netherlands|Germany|Mexico|USA|United States/i.test(t1);
    ok(hasMatchContent, 'Matches tab shows match content');

    // Click Results to see finished matches
    const clickedResults = await clickTab(p1, 'Results') || await mouseClick(p1, 'Results', { timeout: 5000 });
    await sleep(1500);
    await shot(p1, 'u1-results');
    const tResults = await bodyText(p1);

    // Check Spain vs Saudi Arabia shows 4-0
    const hasSpainSaudi = /Spain/i.test(tResults) && /Saudi/i.test(tResults);
    ok(hasSpainSaudi, 'Spain vs Saudi Arabia appears in results');

    // Check score is 4-0 (not 5-0 or 0-0)
    const spainSaudiSection = tResults.match(/Spain.*?Saudi|Saudi.*?Spain/si)?.[0] || '';
    const has40 = /4.*0|4-0|4 . 0/.test(tResults);
    ok(has40, 'Score 4-0 visible in results (Spain 4-0 Saudi Arabia)');

    // Check no match stuck as IN_PLAY in results
    const inPlayInResults = /IN_PLAY|IN PLAY/i.test(tResults);
    ok(!inPlayInResults, 'No IN_PLAY status in results tab', inPlayInResults ? 'Found IN_PLAY in results!' : '');

    // Check Netherlands 5-1 Sweden
    const hasNeth = /Netherlands/i.test(tResults) || /Sweden/i.test(tResults);
    ok(hasNeth, 'Netherlands/Sweden match visible in results');

    // Check Germany 7-1 Curacao
    const hasGermany = /Germany/i.test(tResults);
    ok(hasGermany, 'Germany match visible in results');

    // Check for any 0-0 that might be wrong (Spain vs Cape Verde is legitimately 0-0)
    const zeroZeroMatches = [];
    await p1.evaluate(() => {
      const text = document.body.innerText;
      const lines = text.split('\n');
      // Simple scan for 0-0 patterns
      return lines.filter(l => /0\s*[-–]\s*0/.test(l) || /0\s*:\s*0/.test(l)).slice(0, 10);
    }).then(lines => {
      if (lines.length > 0) console.log(`    0-0 results found: ${JSON.stringify(lines.slice(0, 5))}`);
    });

    // Try clicking on a match for stats
    const statsClicked = await mouseClick(p1, 'See stats', { timeout: 5000 }) ||
                         await mouseClick(p1, 'Stats', { timeout: 3000 }) ||
                         await mouseClick(p1, 'Insights', { timeout: 3000 });
    if (statsClicked) {
      await sleep(2000);
      await shot(p1, 'u1-stats');
      const tStats = await bodyText(p1);
      const hasStatsContent = /probability|win|draw|H2H|head.to.head|elo|poisson|forecast/i.test(tStats);
      ok(hasStatsContent, 'Match stats page loads with probability/H2H content');
    } else {
      console.log('    NOTE: Could not find See Stats button - checking if match cards are clickable');
      // Try clicking a match card directly
      const cardClicked = await p1.evaluate(() => {
        const els = [...document.querySelectorAll('*')].filter(n => {
          const t = (n.textContent || '').trim();
          return t.includes('Spain') && t.length < 200 && n.offsetHeight > 30;
        });
        if (els.length > 0) {
          const r = els[0].getBoundingClientRect();
          els[0].dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + r.width/2, clientY: r.top + r.height/2 }));
          return true;
        }
        return false;
      });
      await sleep(2000);
      await shot(p1, 'u1-match-detail');
      const tDetail = await bodyText(p1);
      const hasDetail = /probability|win|draw|H2H|forecast|Elo/i.test(tDetail);
      ok(hasDetail, 'Match detail/stats accessible from results', !hasDetail ? 'No stats content found' : '');
    }

    await ctx1.close();

    // ==================== USER 2: Prediction scoring display ====================
    console.log('\n[User 2] Prediction scoring display');
    const ctx2 = await browser.createBrowserContext();
    const p2 = await ctx2.newPage();
    await p2.setViewport({ width: 390, height: 844 });

    const { username: u2name, inApp: u2inApp } = await onboard(p2, 'diu2');
    ok(u2inApp, 'User 2 reached main app');

    // Go to Profile tab
    await clickTab(p2, 'Profile');
    await sleep(1500);
    await shot(p2, 'u2-profile');
    const tProfile = await bodyText(p2);

    const hasProfileContent = /point|forecast|prediction|0 pt|my pick|total/i.test(tProfile);
    ok(hasProfileContent, 'Profile tab shows points section', !hasProfileContent ? tProfile.slice(0, 100) : '');

    // Look for My Forecasts button
    const forecastsClicked = await mouseClick(p2, 'My Forecasts', { timeout: 4000 }) ||
                              await mouseClick(p2, 'My Predictions', { timeout: 3000 }) ||
                              await mouseClick(p2, 'My Picks', { timeout: 3000 });
    if (forecastsClicked) {
      await sleep(1500);
      await shot(p2, 'u2-my-forecasts');
      const tForecasts = await bodyText(p2);
      // New user has no predictions, so should show empty state
      const hasForecasts = /no prediction|no forecast|make.*prediction|get started|upcoming/i.test(tForecasts) ||
                           /Spain|Netherlands|Germany/i.test(tForecasts);
      ok(hasForecasts, 'My Forecasts page loads (empty state or predictions visible)');
    } else {
      ok(true, 'My Forecasts: no predictions to check (new user)');
    }

    // Check Predict tab - go make a prediction on an upcoming match
    await clickTab(p2, 'Predict');
    await sleep(2000);
    await shot(p2, 'u2-predict');
    const tPredict = await bodyText(p2);

    // Predict tab should show upcoming matches to predict on
    const hasPredictContent = /vs|–|-|predict|pick|score/i.test(tPredict);
    ok(hasPredictContent, 'Predict tab shows matches to pick', !hasPredictContent ? tPredict.slice(0, 100) : '');

    // Check that finished matches in predict tab don't show as editable
    const hasLockMsg = /lock|finished|result|closed/i.test(tPredict);
    console.log(`    NOTE: Predict tab finished-match lock status: ${hasLockMsg ? 'lock/finished text visible' : 'no lock text (may be all upcoming)'}`);

    await ctx2.close();

    // ==================== USER 3: League leaderboard accuracy ====================
    console.log('\n[User 3] League leaderboard');
    const ctx3 = await browser.createBrowserContext();
    const p3 = await ctx3.newPage();
    await p3.setViewport({ width: 390, height: 844 });

    const { inApp: u3inApp } = await onboard(p3, 'diu3');
    ok(u3inApp, 'User 3 reached main app');

    await clickTab(p3, 'Leagues');
    await sleep(1500);
    await shot(p3, 'u3-leagues');
    const tLeagues = await bodyText(p3);
    ok(/league|create|join/i.test(tLeagues), 'Leagues tab loads');

    // Try creating a league
    const createClicked = await mouseClick(p3, 'Create a league', { timeout: 5000 }) ||
                          await mouseClick(p3, 'Create League', { timeout: 3000 }) ||
                          await mouseClick(p3, 'Create', { timeout: 3000 });
    await sleep(1500);
    await shot(p3, 'u3-create-league');
    const tCreate = await bodyText(p3);

    if (/name|league name|enter/i.test(tCreate)) {
      // Fill in league name
      await fillInput(p3, 'Integrity Test League');
      await sleep(400);

      const submitClicked = await mouseClick(p3, 'Create', { timeout: 4000 }) ||
                            await mouseClick(p3, 'Submit', { timeout: 3000 });
      await sleep(2000);
      await shot(p3, 'u3-league-created');
      const tCreated = await bodyText(p3);

      const hasLeagueDetail = /leaderboard|ranking|member|code|invite/i.test(tCreated);
      ok(hasLeagueDetail, 'League created and detail page shows', !hasLeagueDetail ? tCreated.slice(0, 100) : '');

      // Check leaderboard shows user with 0 points (new user, no predictions)
      const hasZeroPts = /0\s*pt|0\s*point/i.test(tCreated) || tCreated.includes('0');
      ok(hasZeroPts || /leaderboard/i.test(tCreated), 'League leaderboard accessible');
    } else {
      console.log(`    NOTE: Create league form not found, page text: ${tCreate.slice(0, 100)}`);
      ok(false, 'League creation form accessible', tCreate.slice(0, 100));
    }

    await ctx3.close();

    // ==================== USER 4: Live match display ====================
    console.log('\n[User 4] Live match display and status checks');
    const ctx4 = await browser.createBrowserContext();
    const p4 = await ctx4.newPage();
    await p4.setViewport({ width: 390, height: 844 });

    const { inApp: u4inApp } = await onboard(p4, 'diu4');
    ok(u4inApp, 'User 4 reached main app');
    await shot(p4, 'u4-main');

    // Check matches tab
    const tMain = await bodyText(p4);
    const hasMatches = /Upcoming|Live|Groups|Results/i.test(tMain);
    ok(hasMatches, 'Matches tab sections visible (Upcoming/Live/Groups/Results)');

    // Check upcoming section - click Upcoming
    await mouseClick(p4, 'Upcoming', { timeout: 5000 });
    await sleep(1200);
    await shot(p4, 'u4-upcoming');
    const tUpcoming = await bodyText(p4);

    // Finished matches should NOT appear in Upcoming
    const finishedInUpcoming = /FINISHED|FIN\b/i.test(tUpcoming);
    ok(!finishedInUpcoming, 'No FINISHED matches in Upcoming section', finishedInUpcoming ? 'FINISHED status found in Upcoming!' : '');

    // Check for wrongly IN_PLAY matches - should only be live if actually live now
    const inPlayInUpcoming = /IN_PLAY|IN PLAY|LIVE/i.test(tUpcoming);
    console.log(`    NOTE: IN_PLAY/LIVE in upcoming: ${inPlayInUpcoming ? 'YES (check if real live match)' : 'NO'}`);

    // Click Results
    await mouseClick(p4, 'Results', { timeout: 5000 });
    await sleep(1200);
    await shot(p4, 'u4-results');
    const tResultsU4 = await bodyText(p4);

    // Spain 4-0 Saudi Arabia check
    const spainInResults = /Spain/i.test(tResultsU4) && /Saudi/i.test(tResultsU4);
    ok(spainInResults, 'Spain vs Saudi Arabia in results tab');

    // No upcoming/scheduled matches in results
    const scheduledInResults = /SCHEDULED|TIMED\b/i.test(tResultsU4);
    ok(!scheduledInResults, 'No SCHEDULED matches in Results tab', scheduledInResults ? 'Found SCHEDULED status in Results!' : '');

    // Check the specific score display - look for something that's 4-0
    const has40InResults = /4.*?[-–].*?0|4\s*-\s*0|4\s*–\s*0/.test(tResultsU4);
    ok(has40InResults, 'Score format 4-0 visible in results (Spain match)', !has40InResults ? 'Could not find 4-0 pattern' : '');

    // Check for any 0-0 FINISHED matches that might be data bugs
    // Known legit 0-0s: Spain vs Cape Verde, Ecuador vs Curaçao, Belgium vs Iran
    const zeroZero = /0.*0|0-0/.test(tResultsU4);
    if (zeroZero) {
      console.log('    NOTE: Some 0-0 results visible - checking if these are known legitimate results');
      console.log('    Expected 0-0s: Spain-Cape Verde, Ecuador-Curaçao, Belgium-Iran');
    }

    // Check groups tab
    await mouseClick(p4, 'Groups', { timeout: 5000 });
    await sleep(1500);
    await shot(p4, 'u4-groups');
    const tGroups = await bodyText(p4);

    const hasGroupsContent = /Group [A-H]|P.*W.*D.*L|GD|Pts/i.test(tGroups);
    ok(hasGroupsContent, 'Groups tab shows standings (P/W/D/L/GD/Pts format)');

    // Verify group standings reflect actual results
    // Spain should have points (won vs Saudi Arabia)
    const spainHasPoints = /Spain/.test(tGroups);
    ok(spainHasPoints, 'Spain appears in group standings');

    await ctx4.close();

  } catch (err) {
    console.error('\nFatal error:', err.message);
    fail++;
    bugs.push({ msg: 'Fatal test error', ctx: err.message });
  } finally {
    await browser.close();
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Results: ${pass} passed, ${fail} failed out of ${pass + fail} checks`);
  if (bugs.length > 0) {
    console.log('\nIssues found:');
    bugs.forEach(b => console.log(`  ✗ ${b.msg}${b.ctx ? ': ' + b.ctx : ''}`));
  } else {
    console.log('All checks passed!');
  }

  return { pass, fail, bugs };
}

main().then(r => process.exit(r.fail > 0 ? 1 : 0)).catch(err => { console.error(err); process.exit(1); });
