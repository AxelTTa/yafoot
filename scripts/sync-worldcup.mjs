#!/usr/bin/env node
/**
 * YaFoot World Cup sync.
 * PRIMARY: football-data.org (accurate, official-grade, live in-play minute + score). Needs FD_API_KEY.
 * FALLBACK: openfootball/worldcup.json (public domain, no key) when no FD key is set.
 *
 * Seeds/refreshes the `matches` table via the Supabase service_role key.
 * Run: SERVICE_ROLE=... [FD_API_KEY=...] [SEASON=2026] node scripts/sync-worldcup.mjs
 */
const SUPABASE_URL = process.env.SUPABASE_URL || "https://zfsgclwyaapgwxjtzvyd.supabase.co";
const SERVICE_ROLE = process.env.SERVICE_ROLE;
const FD_API_KEY   = process.env.FD_API_KEY || "";
const SEASON       = process.env.SEASON || "2026";
if (!SERVICE_ROLE) { console.error("Missing SERVICE_ROLE"); process.exit(1); }

// football-data tla -> ISO2 (for flag emoji). England/Scotland use subdivision flags.
const TLA2ISO = {
  ALG:"DZ",ARG:"AR",AUS:"AU",AUT:"AT",BEL:"BE",BIH:"BA",BRA:"BR",CAN:"CA",CIV:"CI",COD:"CD",COL:"CO",
  CPV:"CV",CRO:"HR",CUW:"CW",CZE:"CZ",ECU:"EC",EGY:"EG",ESP:"ES",FRA:"FR",GER:"DE",GHA:"GH",HAI:"HT",
  IRN:"IR",IRQ:"IQ",JOR:"JO",JPN:"JP",KOR:"KR",KSA:"SA",MAR:"MA",MEX:"MX",NED:"NL",NOR:"NO",NZL:"NZ",
  PAN:"PA",PAR:"PY",POR:"PT",QAT:"QA",RSA:"ZA",SEN:"SN",SUI:"CH",SWE:"SE",TUN:"TN",TUR:"TR",URY:"UY",
  USA:"US",UZB:"UZ",
};
const SUBDIV = { ENG: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}", SCO: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}", WAL: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}" };
function flagFromTla(tla) {
  if (!tla) return "\u{1F3DF}️"; // stadium marker for TBD
  if (SUBDIV[tla]) return SUBDIV[tla];
  const iso = TLA2ISO[tla];
  if (!iso) return "\u{26BD}";
  return String.fromCodePoint(...[...iso].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
const prettyGroup = (g) => (g && /^GROUP_/.test(g) ? "Group " + g.replace("GROUP_", "") : null);

async function sbUpsert(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/matches?on_conflict=external_id`, {
    method: "POST",
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`upsert ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
async function sbDelete(filter) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/matches?${filter}`, {
    method: "DELETE",
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, Prefer: "return=minimal" },
  });
  if (!res.ok) throw new Error(`delete ${res.status}`);
}

function mapStatus(s) {
  if (s === "IN_PLAY" || s === "PAUSED") return "IN_PLAY";
  if (s === "FINISHED" || s === "AWARDED") return "FINISHED";
  return "SCHEDULED";
}

async function syncFootballData() {
  const r = await fetch("https://api.football-data.org/v4/competitions/WC/matches", { headers: { "X-Auth-Token": FD_API_KEY } });
  if (!r.ok) throw new Error(`football-data ${r.status}`);
  const data = await r.json();
  const rows = (data.matches || []).map((m) => {
    const h = m.homeTeam || {}, a = m.awayTeam || {};
    const ft = m.score?.fullTime || {};
    return {
      external_id: `wc-${m.id}`,
      competition: "FIFA World Cup",
      season: SEASON,
      stage: m.stage || null,
      group_name: prettyGroup(m.group),
      matchday: m.matchday ?? null,
      home_team: h.name || "TBD",
      home_code: h.tla || null,
      home_flag: flagFromTla(h.tla),
      away_team: a.name || "TBD",
      away_code: a.tla || null,
      away_flag: flagFromTla(a.tla),
      home_score: ft.home ?? null,
      away_score: ft.away ?? null,
      status: mapStatus(m.status),
      minute: m.minute ? String(m.minute) : null,
      utc_kickoff: m.utcDate || null,
      venue: m.venue || null,
      last_updated: new Date().toISOString(),
    };
  });
  for (let i = 0; i < rows.length; i += 200) await sbUpsert(rows.slice(i, i + 200));
  await sbDelete("external_id=like.of-*"); // remove legacy openfootball rows
  return rows.length;
}

// ---- openfootball fallback (no key) ----
async function syncOpenFootball() {
  const url = `https://raw.githubusercontent.com/openfootball/worldcup.json/master/${SEASON}/worldcup.json`;
  const r = await fetch(url, { headers: { "User-Agent": "YaFoot/1.0" } });
  if (!r.ok) throw new Error(`openfootball ${r.status}`);
  const data = await r.json();
  const now = Date.now();
  const rows = (data.matches || []).map((mt) => {
    const ft = mt.score && mt.score.ft;
    const finished = Array.isArray(ft) && ft.length === 2;
    const eid = `of-${SEASON}-${mt.date}-${mt.team1}-${mt.team2}`.replace(/\s+/g, "_");
    return {
      external_id: eid, competition: "FIFA World Cup", season: SEASON,
      group_name: mt.group || null,
      home_team: mt.team1, away_team: mt.team2,
      home_score: finished ? ft[0] : null, away_score: finished ? ft[1] : null,
      status: finished ? "FINISHED" : "SCHEDULED",
      utc_kickoff: mt.date ? new Date(`${mt.date}T12:00:00Z`).toISOString() : null,
      last_updated: new Date(now).toISOString(),
    };
  });
  for (let i = 0; i < rows.length; i += 200) await sbUpsert(rows.slice(i, i + 200));
  return rows.length;
}

(async () => {
  try {
    if (FD_API_KEY) {
      const n = await syncFootballData();
      console.log(JSON.stringify({ ok: true, source: "football-data.org", matches: n }));
    } else {
      const n = await syncOpenFootball();
      console.log(JSON.stringify({ ok: true, source: "openfootball (no FD key)", matches: n }));
    }
  } catch (e) {
    console.error("sync failed:", e.message);
    process.exit(1);
  }
})();
