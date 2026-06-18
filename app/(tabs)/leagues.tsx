import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button, Card, Empty, Icon, IconTile, Loading, ScreenHeader } from "../../components/ui";
import { fetchMyLeagues, joinLeague } from "../../lib/api";
import { notify } from "../../lib/notify";
import { useI18n } from "../../lib/i18n";
import { accentFor, colors, radius, spacing, shadow } from "../../lib/theme";
import { League } from "../../lib/types";

export default function Leagues() {
  const router = useRouter();
  const { t } = useI18n();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joinModal, setJoinModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");

  const load = useCallback(async () => {
    try { setLeagues(await fetchMyLeagues()); } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function doJoin() {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const lid = await joinLeague(code.trim());
      setJoinModal(false); setCode("");
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
    <View style={{ flex: 1, backgroundColor: colors.bgLeagues }}>
      <ScreenHeader title={t("tab_leagues")} subtitle={t("leagues_sub")} />

      <FlatList
        data={leagues}
        keyExtractor={(l) => String(l.id)}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.greenDark} />
        }
        ListHeaderComponent={
          <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
            <Button title={t("btn_create")} icon="add" variant="green" onPress={() => router.push("/create-league")} style={{ flex: 1, height: 48 }} />
            <Button title={t("btn_join")} icon="enter-outline" variant="purple" onPress={() => setJoinModal(true)} style={{ flex: 1, height: 48 }} />
          </View>
        }
        renderItem={({ item, index }) => (
          <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }} onPress={() => router.push(`/league/${item.id}`)}>
            <IconTile name="trophy" color={accentFor(index)} size={46} />
            <View style={{ flex: 1 }}>
              <Text style={styles.lgName}>{item.name}</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 3, alignItems: "center" }}>
                <Text style={styles.lgCode}>Code {item.code}</Text>
                {item.max_matches ? (
                  <View style={styles.chip}>
                    <Icon name="time" size={10} color={colors.orange} />
                    <Text style={[styles.chipTxt, { color: colors.orange }]}>{item.max_matches} matches</Text>
                  </View>
                ) : null}
                {item.punishment ? (
                  <View style={[styles.chip, { backgroundColor: "rgba(155,93,229,0.1)" }]}>
                    <Icon name="flame" size={10} color={colors.purple} />
                    <Text style={[styles.chipTxt, { color: colors.purple }]}>Punishment</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <Icon name="chevron-forward" size={22} color={colors.textFaint} />
          </Card>
        )}
        ListEmptyComponent={<Empty icon="trophy-outline" title={t("no_leagues")} sub={t("no_leagues_sub")} />}
      />

      {/* ── Join modal ── */}
      <Modal visible={joinModal} transparent animationType="slide" onRequestClose={() => setJoinModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
          <Pressable style={styles.backdrop} onPress={() => setJoinModal(false)}>
            <Pressable style={styles.sheet} onPress={() => {}} >
              <Text style={styles.sheetTitle}>{t("join_title")}</Text>
              <TextInput
                style={styles.input}
                placeholder={t("code_placeholder")}
                placeholderTextColor={colors.textFaint}
                autoCapitalize="characters"
                value={code}
                onChangeText={setCode}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={doJoin}
                maxLength={6}
              />
              <Button title={t("btn_join_league")} variant="purple" onPress={doJoin} loading={busy} />
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  lgName: { color: colors.text, fontSize: 16, fontWeight: "800" },
  lgCode: { color: colors.textDim, fontSize: 12 },
  chip: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(251,140,60,0.1)", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  chipTxt: { fontSize: 10, fontWeight: "800" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.xl, paddingBottom: 40, borderWidth: 1, borderColor: colors.border,
  },
  sheetTitle: { color: colors.text, fontSize: 20, fontWeight: "900", marginBottom: spacing.md },
  input: {
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 52,
    color: colors.text, fontSize: 16, marginBottom: spacing.sm,
  },
});
