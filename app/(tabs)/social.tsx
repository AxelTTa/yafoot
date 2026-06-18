import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { Avatar, Button, Card, Empty, Icon, IconTile, Loading, QRModal, ScreenHeader } from "../../components/ui";
import { fetchFriends, respondFriend, searchUsers, sendFriendRequest } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { notify } from "../../lib/notify";
import { inviteLink } from "../../lib/invite";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { accentFor, colors, radius, spacing } from "../../lib/theme";

export default function Social() {
  const router = useRouter();
  const { profile } = useAuth();
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
    const ch = supabase.channel("friends-rt").on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  async function doSearch(text: string) {
    setQ(text);
    if (text.trim().length < 2) return setResults([]);
    setSearching(true);
    setResults(await searchUsers(text.trim()));
    setSearching(false);
  }
  async function add(uid: string) {
    try { await sendFriendRequest(uid); notify(t("req_sent")); setResults((r) => r.filter((u) => u.id !== uid)); load(); }
    catch (e: any) { notify(t("req_sent"), e.message); }
  }

  if (loading) return <Loading />;
  const showing = q.length >= 2 ? results : friends.accepted;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgFriends }}>
      <ScreenHeader
        title={t("tab_friends")}
        subtitle={t("friends_sub")}
        right={
          <Pressable onPress={() => setShowQR(true)} style={styles.qrBtn} hitSlop={8}>
            <Icon name="qr-code" size={20} color={colors.ink} />
          </Pressable>
        }
      />
      <QRModal
        visible={showQR}
        onClose={() => setShowQR(false)}
        value={profile?.username ? inviteLink(profile.username) : ""}
        title={t("qr_friend_title")}
        subtitle={t("qr_friend_sub")}
      />
      <View style={styles.searchWrap}>
        <Icon name="search" size={18} color={colors.textFaint} />
        <TextInput style={styles.search} placeholder={t("search_ph")} placeholderTextColor={colors.textFaint} autoCapitalize="none" value={q} onChangeText={doSearch} />
      </View>

      <FlatList
        data={showing}
        keyExtractor={(item, i) => item.id ?? String(i)}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.greenDark} />}
        ListHeaderComponent={
          q.length >= 2 ? (
            <Text style={styles.sectionLabel}>{searching ? t("searching") : "Search results"}</Text>
          ) : friends.incoming.length ? (
            <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
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
          )
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
            <Card style={styles.row} onPress={() => router.push(`/chat/${item.id}`)}>
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
            : <Empty icon="people-outline" color={colors.purple} title={t("no_friends")} sub={t("no_friends_sub")} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  qrBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: spacing.lg, marginBottom: spacing.md, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.lg, height: 50 },
  search: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: "600" },
  sectionLabel: { color: colors.textDim, fontWeight: "900", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  name: { color: colors.ink, fontWeight: "800", fontSize: 15 },
  handle: { color: colors.textFaint, fontSize: 12, marginTop: 2, fontWeight: "600" },
});
