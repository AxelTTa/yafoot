import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Avatar, Button, Card, Empty, Loading } from "../../components/ui";
import { fetchFriends, respondFriend, searchUsers, sendFriendRequest } from "../../lib/api";
import { notify, confirmAsync } from "../../lib/notify";
import { colors, radius, spacing } from "../../lib/theme";

export default function Social() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [friends, setFriends] = useState<any>({ accepted: [], incoming: [], outgoing: [] });
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    try {
      setFriends(await fetchFriends());
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function doSearch(text: string) {
    setQ(text);
    if (text.trim().length < 2) return setResults([]);
    setSearching(true);
    setResults(await searchUsers(text.trim()));
    setSearching(false);
  }

  async function add(uid: string) {
    try {
      await sendFriendRequest(uid);
      notify("Request sent");
      setResults((r) => r.filter((u) => u.id !== uid));
      load();
    } catch (e: any) {
      notify("Error", e.message);
    }
  }

  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <Text style={styles.title}>👥 Friends</Text>
        <TextInput
          style={styles.search}
          placeholder="Search players by username…"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          value={q}
          onChangeText={doSearch}
        />
      </View>

      <FlatList
        data={q.length >= 2 ? results : friends.accepted}
        keyExtractor={(item, i) => item.id ?? String(i)}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: 110 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.bleu} />
        }
        ListHeaderComponent={
          q.length >= 2 ? (
            <Text style={styles.sectionLabel}>{searching ? "Searching…" : "Search results"}</Text>
          ) : friends.incoming.length ? (
            <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
              <Text style={styles.sectionLabel}>Friend requests</Text>
              {friends.incoming.map((r: any) => (
                <Card key={r.id} style={styles.row}>
                  <Avatar name={r.req?.display_name || r.req?.username} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{r.req?.display_name || r.req?.username}</Text>
                    <Text style={styles.handle}>@{r.req?.username}</Text>
                  </View>
                  <Button title="Accept" onPress={async () => { await respondFriend(r.id, true); load(); }} style={{ height: 38, paddingHorizontal: 14 }} />
                  <Pressable onPress={async () => { await respondFriend(r.id, false); load(); }}>
                    <Text style={{ color: colors.textFaint, fontSize: 22, paddingHorizontal: 4 }}>✕</Text>
                  </Pressable>
                </Card>
              ))}
              <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Your friends</Text>
            </View>
          ) : (
            <Text style={styles.sectionLabel}>Your friends</Text>
          )
        }
        renderItem={({ item }) =>
          q.length >= 2 ? (
            <Card style={styles.row}>
              <Avatar name={item.display_name || item.username} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.display_name || item.username}</Text>
                <Text style={styles.handle}>@{item.username} · {item.total_points} pts</Text>
              </View>
              <Button title="+ Add" onPress={() => add(item.id)} style={{ height: 38, paddingHorizontal: 14 }} />
            </Card>
          ) : (
            <Pressable onPress={() => router.push(`/chat/${item.id}`)}>
              <Card style={styles.row}>
                <Avatar name={item.display_name || item.username} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.display_name || item.username}</Text>
                  <Text style={styles.handle}>@{item.username} · {item.total_points} pts</Text>
                </View>
                <Text style={{ color: colors.bleu, fontWeight: "800" }}>💬</Text>
              </Card>
            </Pressable>
          )
        }
        ListEmptyComponent={
          q.length >= 2 ? (
            <Empty icon="🔍" title="No players found" />
          ) : (
            <Empty icon="👥" title="No friends yet" sub="Search by username to add friends and challenge them." />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: 56,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  title: { color: colors.text, fontSize: 26, fontWeight: "900" },
  search: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    height: 46,
    color: colors.text,
  },
  sectionLabel: { color: colors.textDim, fontWeight: "800", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  name: { color: colors.text, fontWeight: "800", fontSize: 15 },
  handle: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
});
