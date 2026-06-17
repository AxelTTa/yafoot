import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button, Card, Empty, Loading } from "../../components/ui";
import { createLeague, fetchMyLeagues, joinLeague } from "../../lib/api";
import { colors, radius, spacing } from "../../lib/theme";
import { League } from "../../lib/types";

export default function Leagues() {
  const router = useRouter();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState<null | "create" | "join">(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLeagues(await fetchMyLeagues());
    } catch (e: any) {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function doCreate() {
    if (name.trim().length < 3) return Alert.alert("Name too short", "At least 3 characters.");
    setBusy(true);
    try {
      const lg = await createLeague(name.trim());
      setModal(null);
      setName("");
      await load();
      Alert.alert("League created!", `Share code "${lg.code}" with friends to invite them.`);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setBusy(false);
    }
  }

  async function doJoin() {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const lid = await joinLeague(code.trim());
      setModal(null);
      setCode("");
      await load();
      router.push(`/league/${lid}`);
    } catch (e: any) {
      Alert.alert("Could not join", e.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <Text style={styles.title}>🏆 Leagues</Text>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Button title="+ Create" onPress={() => setModal("create")} style={{ flex: 1, height: 44 }} />
          <Button title="Join" variant="outline" onPress={() => setModal("join")} style={{ flex: 1, height: 44 }} />
        </View>
      </View>

      <FlatList
        data={leagues}
        keyExtractor={(l) => String(l.id)}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.bleu} />
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/league/${item.id}`)}>
            <Card style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lgName}>{item.name}</Text>
                <Text style={styles.lgCode}>Code: {item.code}</Text>
              </View>
              <Text style={{ color: colors.textFaint, fontSize: 20 }}>›</Text>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={
          <Empty icon="🏆" title="No leagues yet" sub="Create a league and invite friends, or join one with a code." />
        }
      />

      <Modal visible={modal !== null} transparent animationType="slide" onRequestClose={() => setModal(null)}>
        <Pressable style={styles.backdrop} onPress={() => setModal(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{modal === "create" ? "Create a league" : "Join a league"}</Text>
            {modal === "create" ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="League name (e.g. Office Cup)"
                  placeholderTextColor={colors.textFaint}
                  value={name}
                  onChangeText={setName}
                />
                <Button title="Create League" onPress={doCreate} loading={busy} />
              </>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Enter 6-char code"
                  placeholderTextColor={colors.textFaint}
                  autoCapitalize="characters"
                  value={code}
                  onChangeText={setCode}
                />
                <Button title="Join League" variant="red" onPress={doJoin} loading={busy} />
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
  lgName: { color: colors.text, fontSize: 16, fontWeight: "800" },
  lgCode: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: 40,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetTitle: { color: colors.text, fontSize: 20, fontWeight: "900" },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 52,
    color: colors.text,
    fontSize: 16,
  },
});
