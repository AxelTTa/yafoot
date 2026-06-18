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
import { Avatar, Empty, Header, Icon, Loading, QRModal, Screen } from "../../components/ui";
import { inviteBase } from "../../lib/invite";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { notify } from "../../lib/notify";
import { leagueLeaderboard } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { colors, radius, shadow, spacing } from "../../lib/theme";

type Row = { user_id: string; points: number; role: string; profiles: any };
type Msg = { id: number; sender_id: string; body: string; created_at: string };

export default function LeagueDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const leagueId = Number(id);
  const { session } = useAuth();
  const me = session?.user?.id;
  const { t } = useI18n();
  const [tab, setTab] = useState<"standings" | "chat">("standings");
  const [league, setLeague] = useState<{ name: string; code: string; max_matches?: number | null; punishment?: string | null } | null>(null);
  const [showQR, setShowQR] = useState(false);
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
      .select("name, code, max_matches, punishment")
      .eq("id", leagueId)
      .single()
      .then(({ data }) => data && setLeague(data as typeof league));
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
      <Header
        title={league?.name ?? "League"}
        right={
          league ? (
            <Pressable onPress={() => setShowQR(true)} hitSlop={8} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceDark, alignItems: "center", justifyContent: "center" }}>
              <Icon name="qr-code" size={20} color={colors.blanc} />
            </Pressable>
          ) : undefined
        }
      />
      {league ? (
        <QRModal
          visible={showQR}
          onClose={() => setShowQR(false)}
          value={`${inviteBase()}/join/${league.code}`}
          title="League QR"
          subtitle={`Scan to join ${league.name}`}
        />
      ) : null}
      <View style={styles.tabs}>
        {(["standings", "chat"] as const).map((tb) => (
          <Pressable key={tb} onPress={() => setTab(tb)} style={[styles.tab, tab === tb && styles.tabActive]}>
            <Text style={[styles.tabText, tab === tb && styles.tabTextActive]}>
              {tb === "standings" ? t("standings") : t("chat")}
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
              <View style={{ gap: spacing.sm, marginBottom: spacing.xs }}>
                {/* punishment banner */}
                {league.punishment ? (
                  <View style={styles.punBanner}>
                    <Icon name="flame" size={20} color={colors.orange} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.punLabel}>{t("loser_label")}</Text>
                      <Text style={styles.punText}>{league.punishment}</Text>
                    </View>
                  </View>
                ) : null}

                {/* duration chip */}
                {league.max_matches ? (
                  <View style={styles.durBanner}>
                    <Icon name="time-outline" size={16} color={colors.cyan} />
                    <Text style={styles.durBannerTxt}>{league.max_matches} match competition</Text>
                  </View>
                ) : null}

                {/* invite code */}
                <Pressable
                  onPress={() => {
                    if (typeof navigator !== "undefined" && navigator.clipboard) {
                      navigator.clipboard.writeText(league.code).catch(() => {});
                    }
                    notify(t("copy_code"), `Share "${league.code}" so friends can join ${league.name}.`);
                  }}
                  style={styles.invite}
                >
                  <View>
                    <Text style={styles.inviteLabel}>{t("invite_code")}</Text>
                    <Text style={styles.inviteCode}>{league.code}</Text>
                  </View>
                  <Text style={styles.inviteShare}>Share ›</Text>
                </Pressable>
              </View>
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
  punBanner: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: "rgba(251,140,60,0.12)", borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: "rgba(251,140,60,0.3)", ...shadow },
  punLabel: { color: colors.orange, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  punText: { color: colors.ink, fontSize: 14, fontWeight: "800", marginTop: 2, lineHeight: 20 },
  durBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "rgba(34,199,192,0.1)", borderRadius: radius.md, padding: spacing.sm + 2, borderWidth: 1, borderColor: "rgba(34,199,192,0.25)" },
  durBannerTxt: { color: colors.cyan, fontSize: 13, fontWeight: "800" },
  invite: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surfaceDark, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.xs },
  inviteLabel: { color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  inviteCode: { color: colors.blanc, fontSize: 22, fontWeight: "900", letterSpacing: 3 },
  inviteShare: { color: "rgba(255,255,255,0.65)", fontWeight: "800", fontSize: 14 },
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
