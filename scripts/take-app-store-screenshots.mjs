#!/usr/bin/env node
// Generate final App Store listing screenshots for YaFoot.
// Output sizes:
// - iPhone 6.7": 1290 x 2796 via 430 x 932 @3x
// - iPad Pro 12.9": 2048 x 2732 via 1024 x 1366 @2x
import puppeteer from "puppeteer-core";
import QRCode from "qrcode";
import { mkdirSync, rmSync } from "node:fs";

const OUT_DIR = process.env.SCREENSHOTS_DIR || "/tmp/screenshots";
const APP_STORE_URL = "https://apps.apple.com/us/app/yafoot/id6782063727";
const IPHONE = { width: 430, height: 932, deviceScaleFactor: 3 };
const IPAD = { width: 1024, height: 1366, deviceScaleFactor: 2 };

const shots = [
  {
    eyebrow: "WORLD CUP 2026",
    title: "Predict every score",
    sub: "Pick exact results, follow live scores, and climb your private leaderboard.",
    accent: "#23C55E",
    type: "matches",
  },
  {
    eyebrow: "MATCH DETAIL",
    title: "Prediction + stats",
    sub: "Set your scoreline, then check model probabilities and World Cup history.",
    accent: "#7C3AED",
    type: "detail",
  },
  {
    eyebrow: "PRIVATE LEAGUES",
    title: "Beat your mates",
    sub: "Create leagues, invite friends, chat, and make last place pay the punishment.",
    accent: "#F97316",
    type: "league",
  },
  {
    eyebrow: "WORLD CUP CONTEXT",
    title: "Know the matchup",
    sub: "Groups, form, results, and head-to-head World Cup history in one place.",
    accent: "#06B6D4",
    type: "history",
  },
  {
    eyebrow: "INVITE FRIENDS",
    title: "Share YaFoot fast",
    sub: "Use codes, QR, and links that guide friends to the App Store when needed.",
    accent: "#EAB308",
    type: "invite",
  },
];

function appShell(body) {
  return `
    <div class="phone">
      <div class="status"><span>9:41</span><span>5G 100%</span></div>
      <div class="top">
        <div>
          <div class="muted">Hi, @axel</div>
          <div class="appTitle">YaFoot</div>
        </div>
        <div class="bell">i</div>
      </div>
      ${body}
      <div class="nav"><span>Matches</span><span>Leagues</span><span>Friends</span><span>Profile</span></div>
    </div>
  `;
}

function matchesView() {
  return appShell(`
    <div class="tabs"><b>Upcoming</b><span>Groups</span><span>Results</span></div>
    <div class="match live">
      <div><b>Brazil</b><small>Group D - 68'</small></div><strong>2 - 1</strong><div><b>Morocco</b><small>Your pick 2-1</small></div>
    </div>
    <div class="match">
      <div><b>France</b><small>Tomorrow 20:00</small></div><strong>VS</strong><div><b>Argentina</b><small>Tap to predict</small></div>
    </div>
    <div class="progress">
      <div class="progressHead"><span>Predictions locked</span><b>18 / 24</b></div>
      <div class="bar"><i style="width:75%"></i></div>
    </div>
    <div class="card purple"><small>Exact score</small><b>+3 points</b><span>Correct result +1 point</span></div>
  `);
}

function detailView() {
  return appShell(`
    <div class="fixture">
      <div><span class="crest">FRA</span><b>France</b></div><strong>2 - 1</strong><div><span class="crest">ARG</span><b>Argentina</b></div>
    </div>
    <div class="predict">
      <h3>Your prediction</h3>
      <div class="steppers"><button>-</button><b>2</b><button>+</button><button>-</button><b>1</b><button>+</button></div>
      <div class="save">Save prediction</div>
    </div>
    <div class="prob"><div><b>47%</b><span>France</span></div><div><b>26%</b><span>Draw</span></div><div><b>27%</b><span>Argentina</span></div></div>
    <div class="history"><b>Head-to-head World Cup history</b><p>4 meetings - France 2, Argentina 1, Draws 1</p></div>
  `);
}

function leagueView() {
  return appShell(`
    <div class="leagueHero"><small>INVITE CODE</small><b>AXEL26</b><span>Friday Final Crew</span></div>
    <div class="table">
      <div><b>1</b><span>Maya</span><strong>27 pts</strong></div>
      <div><b>2</b><span>Axel</span><strong>24 pts</strong></div>
      <div><b>3</b><span>Tom</span><strong>18 pts</strong></div>
    </div>
    <div class="punish"><small>LOSER GETS</small><b>Buy the next round</b><span>Private league punishment</span></div>
    <div class="chat"><b>Maya</b><span>2-1 France. Lock it.</span></div>
  `);
}

function historyView() {
  return appShell(`
    <div class="groups">
      <div><b>Group B</b><span>Pts</span></div>
      <div><span>England</span><b>7</b></div>
      <div><span>USA</span><b>5</b></div>
      <div><span>Ghana</span><b>3</b></div>
    </div>
    <div class="history tall"><b>World Cup history</b><p>Spain 1-0 Netherlands - 2010 Final</p><p>Netherlands 5-1 Spain - 2014 Group Stage</p></div>
    <div class="prob mini"><div><b>39%</b><span>Spain</span></div><div><b>29%</b><span>Draw</span></div><div><b>32%</b><span>Netherlands</span></div></div>
  `);
}

function inviteView(qr) {
  return appShell(`
    <div class="qrWrap"><img src="${qr}" /><b>Scan to open YaFoot</b><span>${APP_STORE_URL.replace("https://", "")}</span></div>
    <div class="inviteCard"><small>FALLBACK</small><b>Opens the App Store if YaFoot is not installed</b></div>
    <div class="friends compact"><span>Invite code AXEL26</span><span>Links open YaFoot first</span></div>
  `);
}

function pageHtml(shot, qr, isPad) {
  const views = {
    matches: matchesView(),
    detail: detailView(),
    league: leagueView(),
    history: historyView(),
    invite: inviteView(qr),
  };
  const padClass = isPad ? "pad" : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box} body{margin:0;font-family:Inter,Arial,sans-serif;background:#C6F24A;color:#102014}
    .canvas{width:100vw;height:100vh;padding:30px 24px 26px;display:flex;flex-direction:column;gap:18px;overflow:hidden}
    .pad.canvas{padding:54px 70px 44px;display:grid;grid-template-columns:.9fr 1.1fr;grid-template-rows:auto 1fr;gap:34px;align-items:center}
    .copy{z-index:2}.eyebrow{font-size:13px;font-weight:900;letter-spacing:1.8px;color:#375213}.title{font-size:54px;line-height:.94;font-weight:950;letter-spacing:0;color:#0D1D12;margin:8px 0 10px}.sub{font-size:17px;line-height:1.32;font-weight:800;color:#2D3A28;max-width:360px}
    .pad .title{font-size:86px}.pad .sub{font-size:27px;max-width:460px}.pad .eyebrow{font-size:18px}
    .frame{flex:1;display:flex;align-items:flex-end;justify-content:center}.pad .frame{grid-column:2;grid-row:1/3;align-items:center}
    .phone{width:100%;max-width:382px;height:650px;background:#F8FAF0;border:5px solid #111827;border-radius:38px;padding:18px 16px;box-shadow:0 28px 0 rgba(17,24,39,.14);position:relative;overflow:hidden}
    .pad .phone{max-width:520px;height:860px;border-radius:48px;padding:26px 24px}
    .status,.top{display:flex;justify-content:space-between;align-items:center}.status{font-size:11px;font-weight:900;color:#111827}.top{margin:18px 0}.muted{font-size:12px;font-weight:800;color:#6B7280}.appTitle{font-size:31px;font-weight:950}.bell{width:38px;height:38px;border-radius:19px;background:#fff;display:grid;place-items:center;font-weight:950}.nav{position:absolute;left:18px;right:18px;bottom:16px;height:58px;border-radius:28px;background:#111827;color:#fff;display:flex;align-items:center;justify-content:space-around;font-size:10px;font-weight:900}.pad .nav{height:70px;font-size:14px}
    .tabs{display:flex;gap:8px;margin-bottom:12px}.tabs span,.tabs b{padding:9px 13px;border-radius:999px;background:#fff;font-size:12px}.tabs b{background:#166534;color:#fff}
    .match,.progress,.predict,.history,.groups,.punish,.chat,.inviteCard,.friends{background:#fff;border:1px solid #E5E7D8;border-radius:18px;padding:15px;margin-bottom:12px}.match{display:flex;align-items:center;justify-content:space-between;gap:10px}.match b{font-size:16px}.match small{display:block;color:#6B7280;font-weight:800;margin-top:4px}.match strong{font-size:27px}.live{border-color:#23C55E}.progressHead{display:flex;align-items:center;justify-content:space-between;gap:10px}.progressHead span,.progressHead b{font-weight:900}
    .bar{height:10px;background:#E5E7EB;border-radius:999px;margin-top:8px;overflow:hidden}.bar i{display:block;height:100%;background:#23C55E}.card{border-radius:20px;padding:18px;color:#fff}.card b{display:block;font-size:32px}.card small,.card span{font-weight:900}.purple{background:#7C3AED}
    .fixture{background:#fff;border-radius:24px;padding:20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:13px}.fixture div{text-align:center}.fixture strong{font-size:38px}.crest{width:48px;height:48px;border-radius:24px;background:#DFF7F9;color:#111827;display:grid;place-items:center;font-size:13px;font-weight:950;margin:0 auto 8px}.predict h3{margin:0 0 12px;text-align:center}.steppers{display:grid;grid-template-columns:36px 1fr 36px 36px 1fr 36px;gap:8px;align-items:center}.steppers button{height:36px;border:0;border-radius:18px;background:#DFF7F9;font-size:20px;font-weight:950}.steppers b{text-align:center;font-size:31px}.save{margin:14px auto 0;background:#23C55E;color:#fff;border-radius:999px;padding:12px 18px;width:max-content;font-weight:950}
    .prob{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px}.prob div{border-radius:18px;padding:14px 6px;text-align:center;color:#fff}.prob div:nth-child(1){background:#23C55E}.prob div:nth-child(2){background:#EAB308;color:#111827}.prob div:nth-child(3){background:#7C3AED}.prob b{display:block;font-size:25px}.prob span{font-size:11px;font-weight:900}.history b{font-size:17px}.history p{font-size:13px;font-weight:800;color:#4B5563;margin:7px 0 0}.leagueHero{background:#111827;color:#fff;border-radius:24px;padding:20px;margin-bottom:12px}.leagueHero small,.punish small,.inviteCard small{font-weight:950;color:#C6F24A}.leagueHero b{display:block;font-size:42px}.leagueHero span{font-weight:900}.table{background:#fff;border-radius:20px;margin-bottom:12px}.table div{display:grid;grid-template-columns:32px 1fr auto;gap:8px;padding:14px;border-bottom:1px solid #EDF0E5;align-items:center}.table strong{color:#166534}.punish{border-color:#F97316}.punish b{display:block;font-size:22px;color:#F97316}.chat{display:flex;gap:10px}.chat b{color:#7C3AED}.groups div{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #EDF0E5}.tall p{font-size:15px}.mini{margin-top:0}.qrWrap{background:#fff;border-radius:24px;padding:18px;text-align:center;margin-bottom:10px}.qrWrap img{width:150px;height:150px}.qrWrap b{display:block;font-size:19px;margin-top:8px}.qrWrap span{display:block;font-size:9px;font-weight:800;color:#6B7280;margin-top:5px}.inviteCard{padding:13px}.inviteCard small{display:block;margin-bottom:5px}.inviteCard b{display:block;font-size:17px;line-height:1.12}.friends.compact{padding:12px}.friends span{display:block;font-weight:900;margin:3px 0}
    .badge{position:absolute;right:20px;top:20px;background:#fff;border-radius:999px;padding:10px 14px;font-weight:950;color:#111827}
    .pad .badge{right:54px;top:54px;font-size:20px}.pad .phone *{transform:none}.pad .match b,.pad .history b{font-size:22px}.pad .match strong{font-size:38px}.pad .appTitle{font-size:42px}.pad .muted{font-size:16px}.pad .status{font-size:15px}.pad .fixture strong{font-size:58px}.pad .crest{width:70px;height:70px;border-radius:35px;font-size:18px}.pad .predict h3{font-size:25px}.pad .prob b{font-size:38px}.pad .prob span{font-size:16px}.pad .history p,.pad .groups div,.pad .friends span{font-size:20px}.pad .leagueHero b{font-size:62px}.pad .qrWrap img{width:230px;height:230px}.pad .qrWrap b{font-size:30px}
  </style></head><body><div class="canvas ${padClass}"><div class="badge">YaFoot</div><div class="copy"><div class="eyebrow" style="color:${shot.accent}">${shot.eyebrow}</div><div class="title">${shot.title}</div><div class="sub">${shot.sub}</div></div><div class="frame">${views[shot.type]}</div></div></body></html>`;
}

async function main() {
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });
  const qr = await QRCode.toDataURL(APP_STORE_URL, { margin: 1, width: 420, color: { dark: "#111827", light: "#FFFFFF" } });
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  for (const [prefix, viewport, isPad] of [["iphone", IPHONE, false], ["ipad", IPAD, true]]) {
    for (let i = 0; i < shots.length; i++) {
      const page = await browser.newPage();
      await page.setViewport(viewport);
      await page.setContent(pageHtml(shots[i], qr, isPad), { waitUntil: "networkidle0" });
      await page.screenshot({ path: `${OUT_DIR}/${prefix}_${String(i + 1).padStart(2, "0")}.png`, type: "png" });
      await page.close();
    }
  }
  await browser.close();
  console.log(`Generated ${shots.length * 2} App Store screenshots in ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
