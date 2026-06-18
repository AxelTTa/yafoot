import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button, Card, Empty, Icon, IconTile, Loading, ScreenHeader } from "../../components/ui";
import { createLeague, fetchMyLeagues, joinLeague } from "../../lib/api";
import { notify, confirmAsync } from "../../lib/notify";
import { accentFor, colors, radius, spacing } from "../../lib/theme";
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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function doCreate() {
    if (name.trim().length < 3) return notify("Name too short", "At least 3 characters.");
    setBusy(true);
    try {
      const lg = await createLeague(name.trim());
      setModal(null);
      setName("");
      await load();
      notify("League created!", `Share code "${lg.code}" with friends to invite them.`);
    } catch (e: any) {
      notify("Error", e.message);
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
      notify("Could not join", e.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Leagues" subtitle="Compete with your friends" />

      <FlatList
        data={leagues}
        keyExtractor={(l) => String(l.id)}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.greenDark} />
        }
        ListHeaderComponent={
          <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
            <Button title="Create" icon="add" variant="green" onPress={() => setModal("create")} style={{ flex: 1, height: 48 }} />
            <Button title="Join" icon="enter-outline" variant="purple" onPress={() => setModal("join")} style={{ flex: 1, height: 48 }} />
          </View>
        }
        renderItem={({ item, index }) => (
          <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }} onPress={() => router.push(`/league/${item.id}`)}>
            <IconTile name="trophy" color={accentFor(index)} size={46} />
            <View style={{ flex: 1 }}>
              <Text style={styles.lgName}>{item.name}</Text>
              <Text style={styles.lgCode}>Code {item.code}</Text>
            </View>
            <Icon name="chevron-forward" size={22} color={colors.textFaint} />
          </Card>
        )}
        ListEmptyComponent={
          <Empty icon="trophy-outline" title="No leagues yet" sub="Create a league and invite friends, or join one with a code." />
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
                <Button title="Join League" variant="purple" onPress={doJoin} loading={busy} />
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
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 52,
    color: colors.text,
    fontSize: 16,
  },
});
