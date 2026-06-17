// End-to-end backend test: simulates the app via the public anon key.
// Exercises auth, profiles (auto-trigger), predictions, leagues (RPC), membership, chat, friends, RLS.
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
globalThis.WebSocket = globalThis.WebSocket || ws; // RN provides this natively; Node 20 needs a polyfill

const URL = "https://zfsgclwyaapgwxjtzvyd.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmc2djbHd5YWFwZ3d4anR6dnlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MjE5OTcsImV4cCI6MjA5NzI5Nzk5N30.t4UyTSN6N0wCcrIdLcH1Nj9oVw7S0XcQ5sNYVKMedtc";

const mk = () => createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
const stamp = process.argv[2] || String(Math.floor(Math.random() * 1e6));
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log("  ✓", m)) : (fail++, console.log("  ✗ FAIL:", m)); };

async function signup(client, name) {
  const email = `e2e_${name}_${stamp}@yafoot.test`;
  const { data, error } = await client.auth.signUp({
    email, password: "test123456",
    options: { data: { username: `${name}_${stamp}`, display_name: name } },
  });
  if (error) throw new Error(`signup ${name}: ${error.message}`);
  return data.user.id;
}

(async () => {
  console.log("YaFoot E2E backend test, stamp:", stamp);
  const A = mk(), B = mk();

  console.log("\n[1] Auth + profile auto-creation");
  const aId = await signup(A, "alice");
  const bId = await signup(B, "bob");
  ok(!!aId && !!bId, "two users signed up + auto-confirmed");
  const { data: ap } = await A.from("profiles").select("*").eq("id", aId).single();
  ok(ap?.username?.startsWith("alice"), "profile auto-created by trigger");

  console.log("\n[2] Matches readable by authed user (RLS)");
  const { data: matches } = await A.from("matches").select("*").order("utc_kickoff").limit(500);
  ok((matches?.length ?? 0) >= 100, `read ${matches?.length} matches`);
  const upcoming = matches.find((m) => ["SCHEDULED", "TIMED"].includes(m.status));
  const finished = matches.find((m) => m.status === "FINISHED");
  ok(!!upcoming, "found an upcoming match to predict");

  console.log("\n[3] Predictions");
  const { error: pe } = await A.from("predictions").upsert(
    { user_id: aId, match_id: upcoming.id, pred_home: 2, pred_away: 1 },
    { onConflict: "user_id,match_id" }
  );
  ok(!pe, "alice saved a prediction" + (pe ? ` (${pe.message})` : ""));
  // RLS: bob cannot read alice's unscored prediction
  const { data: bobSees } = await B.from("predictions").select("*").eq("user_id", aId);
  ok((bobSees?.length ?? 0) === 0, "RLS blocks bob from seeing alice's unscored prediction");

  console.log("\n[4] Leagues via RPC + membership");
  const { data: league, error: le } = await A.rpc("create_league", { p_name: `League ${stamp}`, p_description: "e2e", p_public: false });
  ok(!le && league?.code, "alice created league, code=" + league?.code + (le ? ` (${le.message})` : ""));
  const { data: joinId, error: je } = await B.rpc("join_league_by_code", { p_code: league.code });
  ok(!je && Number(joinId) === league.id, "bob joined by code" + (je ? ` (${je.message})` : ""));
  const { data: members } = await A.from("league_members").select("user_id").eq("league_id", league.id);
  ok((members?.length ?? 0) === 2, `league has ${members?.length} members (owner + bob)`);

  console.log("\n[5] League chat (realtime table)");
  const { error: me1 } = await A.from("league_messages").insert({ league_id: league.id, sender_id: aId, body: "Bonjour league!" });
  const { error: me2 } = await B.from("league_messages").insert({ league_id: league.id, sender_id: bId, body: "Allez!" });
  ok(!me1 && !me2, "both members posted chat messages");
  const { data: chat } = await B.from("league_messages").select("*").eq("league_id", league.id).order("created_at");
  ok((chat?.length ?? 0) === 2, `chat shows ${chat?.length} messages`);

  console.log("\n[6] Friends");
  const { error: fe } = await A.from("friendships").insert({ requester_id: aId, addressee_id: bId });
  ok(!fe, "alice sent friend request" + (fe ? ` (${fe.message})` : ""));
  const { data: incoming } = await B.from("friendships").select("*").eq("addressee_id", bId).eq("status", "pending");
  ok((incoming?.length ?? 0) === 1, "bob sees incoming request");
  const { error: ace } = await B.from("friendships").update({ status: "accepted" }).eq("id", incoming[0].id);
  ok(!ace, "bob accepted");

  console.log("\n[7] Direct messages + RLS");
  const { error: dm1 } = await A.from("direct_messages").insert({ sender_id: aId, recipient_id: bId, body: "gg" });
  ok(!dm1, "alice DM'd bob");
  const { data: bDms } = await B.from("direct_messages").select("*").or(`sender_id.eq.${aId},recipient_id.eq.${bId}`);
  ok((bDms?.length ?? 0) === 1, "bob received the DM");
  // RLS: a third party cannot read
  const C = mk(); await signup(C, "carol");
  const { data: cDms } = await C.from("direct_messages").select("*");
  ok((cDms?.length ?? 0) === 0, "RLS blocks carol from reading others' DMs");

  console.log("\n[8] Scoring engine (service-role sim via finished match check)");
  if (finished) {
    const { data: fp } = await A.from("matches").select("home_score,away_score,status").eq("id", finished.id).single();
    ok(fp.status === "FINISHED" && fp.home_score !== null, `finished match has scores ${fp.home_score}-${fp.away_score}`);
  } else ok(true, "no finished match (skipped)");

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
