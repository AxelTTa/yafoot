import { supabase } from "./supabase";
import { APP_STORE_SAFE, SAFE_COMPETITION } from "./mode";
import { CompetitionMatch, CompetitionMatchInput, League, Match, Prediction } from "./types";

function isTransientNetworkError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return /load failed|failed to fetch|networkerror|network request failed|fetch/i.test(msg);
}

async function withNetworkRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (!isTransientNetworkError(error) || i === attempts - 1) break;
      await new Promise((resolve) => setTimeout(resolve, 450 * (i + 1)));
    }
  }
  throw last;
}

export async function fetchMatches(): Promise<Match[]> {
  let query = supabase
    .from("matches")
    .select("*")
    .order("utc_kickoff", { ascending: true });
  query = APP_STORE_SAFE ? query.eq("competition", SAFE_COMPETITION) : query.eq("competition", "FIFA World Cup");
  const { data, error } = await query;
  if (error) throw error;
  return (data as Match[]) ?? [];
}

export async function fetchMatch(id: number): Promise<Match | null> {
  const { data } = await supabase.from("matches").select("*").eq("id", id).single();
  return (data as Match) ?? null;
}

export async function fetchMyPredictions(): Promise<Record<number, Prediction>> {
  const { data, error } = await supabase.from("predictions").select("*");
  if (error) throw error;
  const map: Record<number, Prediction> = {};
  for (const p of (data as Prediction[]) ?? []) map[p.match_id] = p;
  return map;
}

export async function savePrediction(matchId: number, home: number, away: number) {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { error } = await supabase.from("predictions").upsert(
    { user_id: uid, match_id: matchId, pred_home: home, pred_away: away },
    { onConflict: "user_id,match_id" }
  );
  if (error) throw error;
}

export async function createChallengeMatch(input: {
  homeTeam: string;
  awayTeam: string;
  kickoffIso: string;
  challengeName?: string;
}) {
  const { data, error } = await supabase.rpc("create_challenge_match", {
    p_home_team: input.homeTeam.trim(),
    p_away_team: input.awayTeam.trim(),
    p_kickoff: input.kickoffIso,
    p_challenge_name: input.challengeName?.trim() || null,
  });
  if (error) throw error;
  return data as Match;
}

export async function createPredictionCompetition(input: {
  name: string;
  punishment?: string | null;
  matches: CompetitionMatchInput[];
}) {
  const payload = input.matches.map((m) => ({
    home_team: m.homeTeam.trim(),
    home_code: m.homeCode?.trim() || null,
    home_flag: m.homeFlag || null,
    away_team: m.awayTeam.trim(),
    away_code: m.awayCode?.trim() || null,
    away_flag: m.awayFlag || null,
    kickoff: m.kickoffIso,
  }));
  const { data, error } = await withNetworkRetry(() =>
    Promise.resolve(supabase.rpc("create_prediction_competition", {
      p_name: input.name.trim(),
      p_description: null,
      p_public: false,
      p_punishment: input.punishment?.trim() || null,
      p_matches: payload,
    }))
  );
  if (error) throw error;
  return data as League;
}

export async function createOfficialPredictionCompetition(input: {
  name: string;
  punishment?: string | null;
  matchIds: number[];
}) {
  const { data, error } = await withNetworkRetry(() =>
    Promise.resolve(supabase.rpc("create_official_prediction_competition", {
      p_name: input.name.trim(),
      p_description: null,
      p_public: false,
      p_punishment: input.punishment?.trim() || null,
      p_match_ids: input.matchIds,
    }))
  );
  if (error) throw error;
  return data as League;
}

export async function fetchCompetitionMatches(leagueId: number): Promise<CompetitionMatch[]> {
  const { data, error } = await supabase
    .from("league_matches")
    .select("ordinal, match:matches(*)")
    .eq("league_id", leagueId)
    .order("ordinal", { ascending: true });
  if (error) throw error;
  return ((data as any[]) ?? [])
    .map((row) => ({ ordinal: row.ordinal as number, match: row.match as Match }))
    .filter((row) => row.match);
}

export async function fetchMyPredictionsForMatches(matchIds: number[]): Promise<Record<number, Prediction>> {
  if (matchIds.length === 0) return {};
  const { data, error } = await supabase
    .from("predictions")
    .select("*")
    .in("match_id", matchIds);
  if (error) throw error;
  const map: Record<number, Prediction> = {};
  for (const p of (data as Prediction[]) ?? []) map[p.match_id] = p;
  return map;
}

export async function finalizeCompetitionMatch(input: {
  leagueId: number;
  matchId: number;
  homeScore: number;
  awayScore: number;
}) {
  const { error } = await supabase.rpc("finalize_competition_match", {
    p_league_id: input.leagueId,
    p_match_id: input.matchId,
    p_home_score: input.homeScore,
    p_away_score: input.awayScore,
  });
  if (error) throw error;
}

export async function fetchMyForecasts() {
  const { data } = await supabase
    .from("predictions")
    .select("match_id, pred_home, pred_away, points_awarded, scored, matches(id,home_team,home_flag,away_team,away_flag,home_score,away_score,status,utc_kickoff,group_name)")
    .order("created_at", { ascending: false })
    .limit(40);
  return (data as any[]) ?? [];
}

export async function updateProfile(fields: { display_name?: string; avatar_url?: string }) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user?.id) throw new Error("Not signed in");
  const { error } = await supabase.from("profiles").update(fields).eq("id", u.user.id);
  if (error) throw error;
}

// ----- leagues -----
export async function fetchMyLeagues(): Promise<League[]> {
  const { data, error } = await supabase
    .from("leagues")
    .select("id, name, code, owner_id, description, is_public, created_at, max_matches, punishment, league_members!inner(user_id)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as League[]) ?? [];
}

export async function createLeague(name: string, description?: string, isPublic = false) {
  const { data, error } = await supabase.rpc("create_league", {
    p_name: name,
    p_description: description ?? null,
    p_public: isPublic,
  });
  if (error) throw error;
  return data as League;
}

export async function joinLeague(code: string) {
  const { data, error } = await supabase.rpc("join_league_by_code", { p_code: code });
  if (error) throw error;
  return data as number;
}

export async function leagueLeaderboard(leagueId: number) {
  const { data, error } = await supabase
    .from("league_members")
    .select("user_id, points, role, profiles(username, display_name, avatar_url, total_points)")
    .eq("league_id", leagueId)
    .order("points", { ascending: false });
  if (error) throw error;
  return data as any[];
}

// ----- friends -----
export async function searchUsers(q: string) {
  const safe = q.replace(/[%_,*]/g, "").trim();
  if (!safe) return [];
  const { data: u } = await supabase.auth.getUser();
  let query = supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, total_points")
    .ilike("username", `%${safe}%`)
    .limit(20);
  if (u.user?.id) query = query.neq("id", u.user.id); // don't return yourself
  const { data } = await query;
  return data ?? [];
}

export async function sendFriendRequest(addresseeId: string) {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("friendships")
    .insert({ requester_id: u.user!.id, addressee_id: addresseeId });
  if (error) throw error;
}

export async function respondFriend(id: number, accept: boolean) {
  if (accept) {
    const { error } = await supabase.from("friendships").update({ status: "accepted" }).eq("id", id);
    if (error) throw error;
  } else {
    await supabase.from("friendships").delete().eq("id", id);
  }
}

export async function deleteMyAccount() {
  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw error;
}

export async function reportMessage(messageId: number, messageType: "dm" | "league_message", reportedUserId: string) {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from("reports").insert({
    reporter_id: u.user!.id,
    reported_user_id: reportedUserId,
    message_id: messageId,
    message_type: messageType,
  });
  if (error) throw error;
}

export async function blockUser(blockedId: string) {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from("blocks").insert({
    blocker_id: u.user!.id,
    blocked_id: blockedId,
  });
  if (error) throw error;
}

export async function fetchFriends() {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user!.id;
  const { data } = await supabase
    .from("friendships")
    .select(
      "id, status, requester_id, addressee_id, req:profiles!friendships_requester_id_fkey(id,username,display_name,avatar_url,total_points), add:profiles!friendships_addressee_id_fkey(id,username,display_name,avatar_url,total_points)"
    )
    .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`);
  const rows = (data as any[]) ?? [];
  const accepted = rows
    .filter((r) => r.status === "accepted")
    .map((r) => (r.requester_id === uid ? r.add : r.req));
  const incoming = rows.filter((r) => r.status === "pending" && r.addressee_id === uid);
  const outgoing = rows.filter((r) => r.status === "pending" && r.requester_id === uid);
  return { accepted, incoming, outgoing };
}
