import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { Avatar, Button, Card, Empty, Icon, IconTile, Loading, QRModal } from "../../components/ui";
import { fetchFriends, respondFriend, searchUsers, sendFriendRequest, blockUser } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { notify, confirmAsync } from "../../lib/notify";
import { inviteLink } from "../../lib/invite";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { accentFor, colors, radius, spacing } from "../../lib/theme";

export default function Social() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const me = session?.user?.id;
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [friends, setFriends] = useState<any>({ accepted: [], incoming: [], outgoing: [] });
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const load = useCallback(async () => {
    try { setFriends(await fetchFriends()); } catch {}
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => {
    if (!me) return;
    const outgoing = supabase.channel(`friends-rt-out-${me}`).on("postgres_changes", { event: "*", schema: "public", table: "friendships", filter: `requester_id=eq.${me}` }, () => load()).subscribe();
    const incoming = supabase.channel(`friends-rt-in-${me}`).on("postgres_changes", { event: "*", schema: "public", table: "friendships", filter: `addressee_id=eq.${me}` }, () => load()).subscribe();
    return () => { supabase.removeChannel(outgoing); supabase.removeChannel(incoming); };
  }, [load, me]);

  async function doSearch(text: string) {
    setQ(text);
    if (text.trim().length < 2) return setResults([]);
    setSearching(true);
    setResults(await searchUsers(text.trim()));
    setSearching(false);
  }
  async function handleBlock(uid: string, name: string) {
    const ok = await confirmAsync(t("block_confirm_title"), t("block_confirm_msg"));
    if (!ok) return;
    try {
      await blockUser(uid);
      notify(t("block_done"));
      load();
    } catch (e: any) {
      notify("Could not block", e.message);
    }
  }

  async function add(uid: string) {
    try {
      await sendFriendRequest(uid);
      notify(t("req_sent"));
      // Clear search so the friends list is visible — when the request is accepted,
      // the realtime subscription updates friends.accepted and the friend appears.
      setQ("");
      setResults([]);
      load();
    } catch (e: any) { notify(t("req_sent"), e.message); }
  }

  if (loading) return <Loading />;
  const showing = q.length >= 2 ? results : friends.accepted;
  const totalFriends = friends.accepted.length;
  const pending = friends.incoming.length + friends.outgoing.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgFriends }}>
      <QRModal
        visible={showQR}
        onClose={() => setShowQR(false)}
        value={profile?.username ? inviteLink(profile.username) : ""}
        title={t("qr_friend_title")}
        subtitle={t("qr_friend_sub")}
      />

      <FlatList
        data={showing}
        keyExtractor={(item, i) => item.id ?? String(i)}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingTop: 56, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.greenDark} />}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
            <View style={styles.hero}>
              <View style={{ flex: 1 }}>
                <Text style={styles.kicker}>Social picks</Text>
                <Text style={styles.heroTitle}>{t("tab_friends")}</Text>
                <Text style={styles.heroSub}>{t("friends_sub")}</Text>
              </View>
              <Pressable onPress={() => setShowQR(true)} style={styles.qrBtn} hitSlop={8}>
                <Icon name="qr-code" size={22} color={colors.blanc} />
              </Pressable>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statCard}><Text style={styles.statNum}>{totalFriends}</Text><Text style={styles.statLabel}>Friends</Text></View>
              <View style={styles.statCard}><Text style={[styles.statNum, { color: colors.orange }]}>{friends.incoming.length}</Text><Text style={styles.statLabel}>Requests</Text></View>
              <View style={styles.statCard}><Text style={[styles.statNum, { color: colors.purple }]}>{pending}</Text><Text style={styles.statLabel}>Pending</Text></View>
            </View>
            <View style={styles.searchWrap}>
              <Icon name="search" size={18} color={colors.textFaint} />
              <TextInput style={styles.search} placeholder={t("search_ph")} placeholderTextColor={colors.textFaint} autoCapitalize="none" value={q} onChangeText={doSearch} />
            </View>
            {q.length >= 2 ? (
              <Text style={styles.sectionLabel}>{searching ? t("searching") : "Search results"}</Text>
            ) : friends.incoming.length ? (
              <View style={{ gap: spacing.sm }}>
              <Text style={styles.sectionLabel}>{t("requests")}</Text>
              {friends.incoming.map((r: any) => (
                <Card key={r.id} style={styles.row}>
                  <Avatar name={r.req?.display_name || r.req?.username} url={r.req?.avatar_url} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{r.req?.display_name || r.req?.username}</Text>
                    <Text style={styles.handle}>@{r.req?.username}</Text>
                  </View>
                  <Button title={t("btn_accept")} variant="green" onPress={async () => { await respondFriend(r.id, true); load(); }} style={{ height: 40, paddingHorizontal: 16 }} />
                  <Pressable onPress={async () => { await respondFriend(r.id, false); load(); }} hitSlop={8}>
                    <Icon name="close" size={22} color={colors.textFaint} />
                  </Pressable>
                </Card>
              ))}
              <Text style={[styles.sectionLabel, { marginTop: spacing.sm }]}>{t("your_friends")}</Text>
              </View>
            ) : (
              <Text style={styles.sectionLabel}>{t("your_friends")}</Text>
            )}
          </View>
        }
        renderItem={({ item, index }) =>
          q.length >= 2 ? (
            <Card style={styles.row}>
              <Avatar name={item.display_name || item.username} url={item.avatar_url} size={44} color={accentFor(index)} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.display_name || item.username}</Text>
                <Text style={styles.handle}>@{item.username} · {item.total_points} pts</Text>
              </View>
              <Button title={t("btn_add")} variant="green" icon="person-add" onPress={() => add(item.id)} style={{ height: 40, paddingHorizontal: 16 }} />
            </Card>
          ) : (
            <Card style={styles.row} onPress={() => router.push(`/chat/${item.id}`)} onLongPress={() => handleBlock(item.id, item.display_name || item.username)}>
              <Avatar name={item.display_name || item.username} url={item.avatar_url} size={44} color={accentFor(index)} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.display_name || item.username}</Text>
                <Text style={styles.handle}>@{item.username} · {item.total_points} pts</Text>
              </View>
              <IconTile name="chatbubble" color={colors.purple} size={40} />
            </Card>
          )
        }
        ListEmptyComponent={
          q.length >= 2
            ? <Empty icon="search" color={colors.orange} title={t("no_players")} />
            : (
              <View style={styles.emptyWrap}>
                <Empty icon="people-outline" color={colors.purple} title={t("no_friends")} sub={t("no_friends_sub")} />
                <Pressable onPress={() => setShowQR(true)} style={styles.emptyAction}>
                  <Icon name="qr-code" size={18} color={colors.blanc} />
                  <Text style={styles.emptyActionTxt}>Show invite QR</Text>
                </Pressable>
              </View>
            )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceDark, borderRadius: radius.xl, padding: spacing.lg },
  kicker: { color: colors.green, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  heroTitle: { color: colors.blanc, fontSize: 31, fontWeight: "900" },
  heroSub: { color: "rgba(255,255,255,0.68)", fontSize: 13, fontWeight: "700", lineHeight: 18, marginTop: 3 },
  qrBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.purple, alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", gap: spacing.sm },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  statNum: { color: colors.greenDark, fontSize: 23, fontWeight: "900" },
  statLabel: { color: colors.textDim, fontSize: 11, fontWeight: "900", marginTop: 2 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.lg, height: 52, borderWidth: 1, borderColor: colors.border },
  search: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: "600" },
  sectionLabel: { color: colors.textDim, fontWeight: "900", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  name: { color: colors.ink, fontWeight: "900", fontSize: 16 },
  handle: { color: colors.textFaint, fontSize: 12, marginTop: 2, fontWeight: "600" },
  emptyWrap: { gap: spacing.md },
  emptyAction: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.purple, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, marginTop: -spacing.md },
  emptyActionTxt: { color: colors.blanc, fontSize: 14, fontWeight: "900" },
});
