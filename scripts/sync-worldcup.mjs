#!/usr/bin/env node
/**
 * YaFoot World Cup sync.
 * Primary source: openfootball/worldcup.json (public domain, no key) — fixtures + results.
 * Optional live layer: football-data.org (set FD_API_KEY) — in-play status + minute + live score.
 *
 * Upserts into Supabase `matches` via the service_role key (bypasses RLS).
 * Run: SUPABASE_URL=... SERVICE_ROLE=... [FD_API_KEY=...] [SEASON=2026] node scripts/sync-worldcup.mjs
 */

const SUPABASE_URL = process.env.SUPABASE_URL || "https://zfsgclwyaapgwxjtzvyd.supabase.co";
const SERVICE_ROLE = process.env.SERVICE_ROLE; // required
const FD_API_KEY   = process.env.FD_API_KEY || "";
const SEASON       = process.env.SEASON || "2026";

if (!SERVICE_ROLE) { console.error("Missing SERVICE_ROLE env"); process.exit(1); }

// --- country -> ISO2 (for flag emoji + 3-letter code display) ---
const ISO2 = {
  "Argentina":"AR","Australia":"AU","Austria":"AT","Belgium":"BE","Brazil":"BR","Cameroon":"CM",
  "Canada":"CA","Colombia":"CO","Costa Rica":"CR","Croatia":"HR","Czech Republic":"CZ","Czechia":"CZ",
  "Denmark":"DK","Ecuador":"EC","Egypt":"EG","England":"GB","France":"FR","Germany":"DE","Ghana":"GH",
  "Greece":"GR","Iran":"IR","Italy":"IT","Ivory Coast":"CI","Jamaica":"JM","Japan":"JP","Mexico":"MX",
  "Morocco":"MA","Netherlands":"NL","New Zealand":"NZ","Nigeria":"NG","Norway":"NO","Panama":"PA",
  "Paraguay":"PY","Peru":"PE","Poland":"PL","Portugal":"PT","Qatar":"QA","Saudi Arabia":"SA","Scotland":"GB",
  "Senegal":"SN","Serbia":"RS","Slovakia":"SK","Slovenia":"SI","South Africa":"ZA","South Korea":"KR",
  "Korea Republic":"KR","Spain":"ES","Sweden":"SE","Switzerland":"CH","Tunisia":"TN","Turkey":"TR",
  "Ukraine":"UA","United States":"US","USA":"US","Uruguay":"UY","Wales":"GB","Algeria":"DZ","Chile":"CL",
  "Honduras":"HN","Uzbekistan":"UZ","Jordan":"JO","Cape Verde":"CV","Curacao":"CW","Haiti":"HT",
  "New Caledonia":"NC","Bolivia":"BO","Iraq":"IQ","Congo DR":"CD","DR Congo":"CD",
};
const code3 = {
  AR:"ARG",AU:"AUS",AT:"AUT",BE:"BEL",BR:"BRA",CM:"CMR",CA:"CAN",CO:"COL",CR:"CRC",HR:"CRO",CZ:"CZE",
  DK:"DEN",EC:"ECU",EG:"EGY",GB:"ENG",FR:"FRA",DE:"GER",GH:"GHA",GR:"GRE",IR:"IRN",IT:"ITA",CI:"CIV",
  JM:"JAM",JP:"JPN",MX:"MEX",MA:"MAR",NL:"NED",NZ:"NZL",NG:"NGA",NO:"NOR",PA:"PAN",PY:"PAR",PE:"PER",
  PL:"POL",PT:"POR",QA:"QAT",SA:"KSA",SN:"SEN",RS:"SRB",SK:"SVK",SI:"SVN",ZA:"RSA",KR:"KOR",ES:"ESP",
  SE:"SWE",CH:"SUI",TN:"TUN",TR:"TUR",UA:"UKR",US:"USA",UY:"URU",DZ:"ALG",CL:"CHI",HN:"HON",UZ:"UZB",
  JO:"JOR",CV:"CPV",CW:"CUW",HT:"HAI",NC:"NCL",BO:"BOL",IQ:"IRQ",CD:"COD",
};
function flagEmoji(iso2) {
  if (!iso2 || iso2.length !== 2) return "\u{1F3F3}"; // white flag fallback
  return String.fromCodePoint(...[...iso2.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}
function teamMeta(name) {
  const iso = ISO2[name] || "";
  return { code: code3[iso] || name.slice(0,3).toUpperCase(), flag: flagEmoji(iso) };
}
function parseKickoff(date, time) {
  // time like "13:00 UTC-6" or "20:00 UTC-4"
  if (!date) return null;
  const m = /^(\d{1,2}):(\d{2})\s*UTC([+-]\d{1,2})?/.exec(time || "");
  if (!m) return new Date(`${date}T12:00:00Z`).toISOString();
  const hh = m[1].padStart(2,"0"), mm = m[2];
  const off = parseInt(m[3] || "0", 10);
  // local = date hh:mm at offset; convert to UTC
  const localMs = Date.parse(`${date}T${hh}:${mm}:00Z`);
  return new Date(localMs - off * 3600 * 1000).toISOString();
}

async function sbUpsert(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/matches?on_conflict=external_id`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`upsert ${res.status}: ${(await res.text()).slice(0,400)}`);
}

async function syncOpenFootball() {
  const url = `https://raw.githubusercontent.com/openfootball/worldcup.json/master/${SEASON}/worldcup.json`;
  const r = await fetch(url, { headers: { "User-Agent": "YaFoot/1.0" } });
  if (!r.ok) throw new Error(`openfootball ${r.status}`);
  const data = await r.json();
  const matches = data.matches || [];
  const now = Date.now();
  const rows = matches.map((mt, i) => {
    const home = teamMeta(mt.team1), away = teamMeta(mt.team2);
    const kickoff = parseKickoff(mt.date, mt.time);
    const ft = mt.score && mt.score.ft;
    const finished = Array.isArray(ft) && ft.length === 2;
    let status = "SCHEDULED";
    if (finished) status = "FINISHED";
    else if (kickoff && Date.parse(kickoff) <= now) status = "IN_PLAY";
    const eid = `of-${SEASON}-${(mt.date||"")}-${mt.team1}-${mt.team2}`.replace(/\s+/g,"_");
    return {
      external_id: eid,
      competition: "FIFA World Cup",
      season: SEASON,
      stage: (mt.round || "").toLowerCase().includes("final") ? "KNOCKOUT" : "GROUP_STAGE",
      group_name: mt.group || null,
      matchday: /Matchday\s+(\d+)/.exec(mt.round || "")?.[1] ? parseInt(/Matchday\s+(\d+)/.exec(mt.round)[1],10) : null,
      home_team: mt.team1, home_code: home.code, home_flag: home.flag,
      away_team: mt.team2, away_code: away.code, away_flag: away.flag,
      home_score: finished ? ft[0] : null,
      away_score: finished ? ft[1] : null,
      status,
      venue: mt.ground || mt.city || null,
      utc_kickoff: kickoff,
      last_updated: new Date(now).toISOString(),
    };
  });
  // upsert in chunks of 200
  for (let i = 0; i < rows.length; i += 200) await sbUpsert(rows.slice(i, i+200));
  return rows.length;
}

// Optional: enrich live matches from football-data.org (status + minute + live score)
async function enrichFootballData() {
  if (!FD_API_KEY) return 0;
  const r = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
    headers: { "X-Auth-Token": FD_API_KEY },
  });
  if (!r.ok) { console.warn("football-data:", r.status); return 0; }
  const data = await r.json();
  let n = 0;
  for (const mt of data.matches || []) {
    const st = mt.status; // SCHEDULED, TIMED, IN_PLAY, PAUSED, FINISHED
    if (!["IN_PLAY","PAUSED","FINISHED"].includes(st)) continue;
    // match by team names + date is fragile; we update by external_id mirror keyed on fd id
    const eid = `fd-${mt.id}`;
    const home = teamMeta(mt.homeTeam?.name || ""), away = teamMeta(mt.awayTeam?.name || "");
    await sbUpsert([{
      external_id: eid, competition: "FIFA World Cup", season: SEASON,
      stage: mt.stage, group_name: mt.group, matchday: mt.matchday,
      home_team: mt.homeTeam?.name, home_code: home.code, home_flag: home.flag,
      away_team: mt.awayTeam?.name, away_code: away.code, away_flag: away.flag,
      home_score: mt.score?.fullTime?.home, away_score: mt.score?.fullTime?.away,
      status: st === "PAUSED" ? "IN_PLAY" : st, minute: mt.minute ? String(mt.minute) : null,
      utc_kickoff: mt.utcDate, venue: mt.venue, last_updated: new Date().toISOString(),
    }]);
    n++;
  }
  return n;
}

(async () => {
  try {
    const a = await syncOpenFootball();
    const b = await enrichFootballData();
    console.log(JSON.stringify({ ok: true, openfootball: a, footballData: b }));
  } catch (e) {
    console.error("sync failed:", e.message);
    process.exit(1);
  }
})();
