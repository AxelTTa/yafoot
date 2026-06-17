import { supabase } from "./supabase";
import { League, Match, Prediction } from "./types";

export async function fetchMatches(): Promise<Match[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .order("utc_kickoff", { ascending: true });
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

// ----- leagues -----
export async function fetchMyLeagues(): Promise<League[]> {
  const { data, error } = await supabase
    .from("leagues")
    .select("*, league_members!inner(user_id)")
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
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, total_points")
    .ilike("username", `%${q}%`)
    .limit(20);
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

export async function fetchFriends() {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user!.id;
  const { data } = await supabase
    .from("friendships")
    .select(
      "id, status, requester_id, addressee_id, req:profiles!friendships_requester_id_fkey(id,username,display_name,avatar_url,total_points), add:profiles!friendships_addressee_id_fkey(id,username,display_name,avatar_url,total_points)"
    );
  const rows = (data as any[]) ?? [];
  const accepted = rows
    .filter((r) => r.status === "accepted")
    .map((r) => (r.requester_id === uid ? r.add : r.req));
  const incoming = rows.filter((r) => r.status === "pending" && r.addressee_id === uid);
  const outgoing = rows.filter((r) => r.status === "pending" && r.requester_id === uid);
  return { accepted, incoming, outgoing };
}
