import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar, Button, Card, Chip, Empty, Header, Loading, Screen, ScrollView } from "../components/ui";
import { useAuth } from "../lib/auth";
import { fetchFriends, respondFriend } from "../lib/api";
import { supabase } from "../lib/supabase";
import { prettyTeam, teamFlag } from "../lib/teams";
import { colors, spacing } from "../lib/theme";

export default function Notifications() {
  const router = useRouter();
  const { session } = useAuth();
  const me = session?.user?.id;
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [live, setLive] = useState<any[]>([]);
  const [dms, setDms] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!me) return;
    const [fr, lv, msg] = await Promise.all([
      fetchFriends().then((f) => f.incoming).catch(() => []),
      supabase.from("matches").select("*").in("status", ["IN_PLAY"]).order("utc_kickoff").then((r) => r.data ?? []),
      supabase
        .from("direct_messages")
        .select("id, body, created_at, sender_id, profiles:profiles!direct_messages_sender_id_fkey(username,display_name,avatar_url)")
        .eq("recipient_id", me)
        .order("created_at", { ascending: false })
        .limit(12)
        .then((r) => r.data ?? []),
    ]);
    setRequests(fr); setLive(lv); setDms(msg);
    setLoading(false);
  }, [me]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("notif-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  if (loading) return <Screen><Header title="Notifications" /><Loading /></Screen>;

  const empty = !requests.length && !live.length && !dms.length;

  return (
    <Screen>
      <Header title="Notifications" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 60 }}>
        {empty ? <Empty icon="notifications-outline" title="You're all caught up" sub="Friend requests, live matches and messages show up here." /> : null}

        {requests.length ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.section}>FRIEND REQUESTS</Text>
            {requests.map((r) => (
              <Card key={r.id} style={styles.row}>
                <Avatar name={r.req?.display_name || r.req?.username} url={r.req?.avatar_url} size={42} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{r.req?.display_name || r.req?.username}</Text>
                  <Text style={styles.sub}>wants to be friends</Text>
                </View>
                <Button title="Accept" onPress={async () => { await respondFriend(r.id, true); load(); }} style={{ height: 40, paddingHorizontal: 16 }} />
              </Card>
            ))}
          </View>
        ) : null}

        {live.length ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.section}>LIVE NOW</Text>
            {live.map((m) => (
              <Card key={m.id} onPress={() => router.push(`/match/${m.id}`)} style={styles.row}>
                <Chip label={m.minute ? `${m.minute}'` : "LIVE"} color={colors.live} bg={colors.liveBg} dot />
                <Text style={styles.live} numberOfLines={1}>
                  {teamFlag(m.home_team, m.home_flag)} {prettyTeam(m.home_team)} {m.home_score ?? 0}-{m.away_score ?? 0} {prettyTeam(m.away_team)} {teamFlag(m.away_team, m.away_flag)}
                </Text>
              </Card>
            ))}
          </View>
        ) : null}

        {dms.length ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.section}>MESSAGES</Text>
            {dms.map((d) => (
              <Card key={d.id} onPress={() => router.push(`/chat/${d.sender_id}`)} style={styles.row}>
                <Avatar name={d.profiles?.display_name || d.profiles?.username} url={d.profiles?.avatar_url} size={42} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{d.profiles?.display_name || d.profiles?.username}</Text>
                  <Text style={styles.sub} numberOfLines={1}>{d.body}</Text>
                </View>
              </Card>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { color: colors.textDim, fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  name: { color: colors.text, fontSize: 15, fontWeight: "800" },
  sub: { color: colors.textDim, fontSize: 13, marginTop: 1 },
  live: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "700" },
});
