import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Avatar, Empty, Header, Loading, Screen } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { notify } from "../../lib/notify";
import { leagueLeaderboard } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { colors, radius, spacing } from "../../lib/theme";

type Row = { user_id: string; points: number; role: string; profiles: any };
type Msg = { id: number; sender_id: string; body: string; created_at: string };

export default function LeagueDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const leagueId = Number(id);
  const { session } = useAuth();
  const me = session?.user?.id;
  const [tab, setTab] = useState<"standings" | "chat">("standings");
  const [league, setLeague] = useState<{ name: string; code: string } | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const listRef = useRef<FlatList>(null);

  const loadBoard = useCallback(async () => {
    try {
      setRows((await leagueLeaderboard(leagueId)) as Row[]);
    } catch {}
    setLoading(false);
  }, [leagueId]);

  const loadMsgs = useCallback(async () => {
    const { data } = await supabase
      .from("league_messages")
      .select("id, sender_id, body, created_at")
      .eq("league_id", leagueId)
      .order("created_at", { ascending: true })
      .limit(200);
    setMsgs((data as Msg[]) ?? []);
  }, [leagueId]);

  useEffect(() => {
    supabase
      .from("leagues")
      .select("name, code")
      .eq("id", leagueId)
      .single()
      .then(({ data }) => data && setLeague(data as any));
    loadBoard();
    loadMsgs();
    const ch = supabase
      .channel(`league-${leagueId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "league_messages", filter: `league_id=eq.${leagueId}` },
        (payload) => {
          const n = payload.new as Msg;
          setMsgs((m) => (m.some((x) => x.id === n.id) ? m : [...m, n]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [leagueId, loadBoard, loadMsgs]);

  async function send() {
    const body = text.trim();
    if (!body || !me) return;
    setText("");
    const { error } = await supabase.from("league_messages").insert({ league_id: leagueId, sender_id: me, body });
    if (error) {
      setText(body); // restore so the message isn't lost
      notify("Message not sent", error.message);
    }
  }

  if (loading) return <Loading />;

  const rankColor = (i: number) => (i === 0 ? colors.gold : i === 1 ? colors.silver : i === 2 ? colors.bronze : colors.textFaint);

  return (
    <Screen>
      <Header title={league?.name ?? "League"} />
      <View style={styles.tabs}>
        {(["standings", "chat"] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === "standings" ? "Standings" : "Chat"}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === "standings" ? (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.user_id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: 40 }}
          ListHeaderComponent={
            league ? (
              <Pressable
                onPress={() => {
                  if (typeof navigator !== "undefined" && navigator.clipboard) {
                    navigator.clipboard.writeText(league.code).catch(() => {});
                  }
                  notify("Invite code copied", `Share "${league.code}" so friends can join ${league.name}.`);
                }}
                style={styles.invite}
              >
                <View>
                  <Text style={styles.inviteLabel}>INVITE CODE</Text>
                  <Text style={styles.inviteCode}>{league.code}</Text>
                </View>
                <Text style={styles.inviteShare}>Share ›</Text>
              </Pressable>
            ) : null
          }
          renderItem={({ item, index }) => (
            <View style={[styles.rankRow, item.user_id === me && { borderColor: colors.bleu }]}>
              <Text style={[styles.rank, { color: rankColor(index) }]}>{index + 1}</Text>
              <Avatar name={item.profiles?.display_name || item.profiles?.username} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {item.profiles?.display_name || item.profiles?.username}
                  {item.user_id === me ? "  (you)" : ""}
                </Text>
                <Text style={styles.handle}>@{item.profiles?.username}</Text>
              </View>
              <Text style={styles.pts}>{item.points} pts</Text>
            </View>
          )}
          ListEmptyComponent={<Empty icon="trophy-outline" title="No members yet" />}
        />
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={90}
        >
          <FlatList
            ref={listRef}
            data={msgs}
            keyExtractor={(m) => String(m.id)}
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              const mine = item.sender_id === me;
              return (
                <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                  <Text style={[styles.msgText, mine && { color: colors.blanc }]}>{item.body}</Text>
                </View>
              );
            }}
            ListEmptyComponent={<Empty icon="chatbubbles-outline" title="No messages yet" sub="Say hi to your league!" />}
          />
          <View style={styles.composer}>
            <TextInput
              style={styles.composerInput}
              placeholder="Message your league…"
              placeholderTextColor={colors.textFaint}
              value={text}
              onChangeText={setText}
              onSubmitEditing={send}
            />
            <Pressable style={styles.sendBtn} onPress={send}>
              <Text style={{ color: colors.blanc, fontWeight: "900" }}>Send</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", padding: spacing.md, gap: spacing.sm, backgroundColor: colors.bg },
  tab: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center", backgroundColor: colors.surface },
  tabActive: { backgroundColor: colors.greenDark },
  tabText: { color: colors.textDim, fontWeight: "800" },
  tabTextActive: { color: colors.blanc },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  invite: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.bleuSoft, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.bleu, marginBottom: spacing.xs },
  inviteLabel: { color: colors.textDim, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  inviteCode: { color: colors.blanc, fontSize: 22, fontWeight: "900", letterSpacing: 3 },
  inviteShare: { color: colors.bleu, fontWeight: "800", fontSize: 14 },
  rank: { color: colors.text, fontWeight: "900", fontSize: 16, width: 28, textAlign: "center" },
  name: { color: colors.text, fontWeight: "800", fontSize: 14 },
  handle: { color: colors.textFaint, fontSize: 12 },
  pts: { color: colors.gold, fontWeight: "900", fontSize: 15 },
  bubble: { maxWidth: "78%", padding: spacing.md, borderRadius: radius.lg },
  mine: { alignSelf: "flex-end", backgroundColor: colors.bleu, borderBottomRightRadius: 4 },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  msgText: { color: colors.text, fontSize: 15 },
  composer: { flexDirection: "row", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  composerInput: { flex: 1, backgroundColor: colors.bg, borderRadius: radius.pill, paddingHorizontal: spacing.lg, height: 46, color: colors.text, borderWidth: 1, borderColor: colors.border },
  sendBtn: { backgroundColor: colors.bleu, borderRadius: radius.pill, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center" },
});
