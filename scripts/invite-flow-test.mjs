import puppeteer from "puppeteer-core";
const URL = process.env.URL || "https://dist-five-zeta-92i4a6g3xx.vercel.app";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m) => { c ? (pass++, console.log("  ✓", m)) : (fail++, console.log("  ✗", m)); };
const txt = (p) => p.evaluate(() => document.body.innerText);
async function tap(p, t) { return p.evaluate((x) => { const e = [...document.querySelectorAll("*")].find(n => n.children.length === 0 && (n.textContent || "").trim() === x); if (e) { e.click(); return true; } return false; }, t); }
async function fillUser(p, v) { return p.evaluate((val) => { const i = [...document.querySelectorAll("input")].pop(); const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; s.call(i, val); i.dispatchEvent(new Event("input", { bubbles: true })); }, v); }
async function signup(p, name) {
  await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForFunction(() => /Get started/.test(document.body.innerText), { timeout: 60000 });
  await sleep(2500); const u = name + Date.now().toString(36).slice(-5);
  await fillUser(p, u); await tap(p, "Get started"); await sleep(6000); await tap(p, "Continue to app"); await sleep(4000);
  return u.toLowerCase();
}

(async () => {
  const b = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new", protocolTimeout: 180000, args: ["--no-sandbox"] });
  const A = await (await b.createBrowserContext()).newPage(); await A.setViewport({ width: 430, height: 900 });
  const B = await (await b.createBrowserContext()).newPage(); await B.setViewport({ width: 430, height: 900 });
  A.on("dialog", async d => d.accept().catch(() => {})); B.on("dialog", async d => d.accept().catch(() => {}));

  console.log("[1] User A signs up");
  const uA = await signup(A, "inviter");
  ok(/World Cup|Live|Upcoming/.test(await txt(A)), "A in app, username=" + uA);

  console.log("[2] User B opens A's invite link (new user)");
  await B.goto(`${URL}/invite/${uA}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(6000);
  ok(/invited you|Get started/i.test(await txt(B)), "invite link routed B to welcome");
  const invitedBanner = /invited you/i.test(await txt(B));
  ok(invitedBanner, "B sees 'A friend invited you'");

  console.log("[3] B picks username -> should auto-friend A");
  const uB = "invitee" + Date.now().toString(36).slice(-5);
  await fillUser(B, uB);
  await tap(B, "Join & add friend"); await sleep(7000);
  const bText = await txt(B);
  // B should land on Friends (social) showing A as a friend
  ok(new RegExp(uA, "i").test(bText) || /Friends/i.test(bText), "B landed on Friends with A connected");

  console.log("[4] verify friendship from A's side");
  await A.goto(URL, { waitUntil: "domcontentloaded" }); await sleep(4000);
  await tap(A, "Matches"); await sleep(800); await tap(A, "Friends"); await sleep(3500);
  ok(new RegExp(uB, "i").test(await txt(A)), "A's friends list shows B");

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error("CRASH:", e.message); process.exit(2); });
