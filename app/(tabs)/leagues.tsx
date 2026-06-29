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
import { APP_STORE_SAFE } from "../../lib/mode";
import { accentFor, colors, radius, spacing } from "../../lib/theme";
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
      <ScreenHeader title={APP_STORE_SAFE ? "Competitions" : t("tab_leagues")} subtitle={APP_STORE_SAFE ? "Private prediction groups with your own matches." : t("leagues_sub")} />

      <FlatList
        data={leagues}
        keyExtractor={(l) => String(l.id)}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.greenDark} />
        }
        ListHeaderComponent={
          <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
            {!APP_STORE_SAFE ? (
              <Pressable style={styles.soireeBtn} onPress={() => router.push("/soiree")}>
                <IconTile name="mic" color={colors.purple} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.soireeBtnTitle}>Soirée Mode</Text>
                  <Text style={styles.soireeBtnSub}>Party micro-challenges en live</Text>
                </View>
                <Icon name="chevron-forward" size={20} color={colors.blanc} />
              </Pressable>
            ) : null}
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button title={t("btn_create")} icon="add" variant="green" onPress={() => router.push(APP_STORE_SAFE ? "/create-league" : "/create-official-league")} style={{ flex: 1, height: 48 }} />
              <Button title={t("btn_join")} icon="enter-outline" variant="purple" onPress={() => setJoinModal(true)} style={{ flex: 1, height: 48 }} />
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }} onPress={() => router.push(`/league/${item.id}`)}>
            <IconTile name={APP_STORE_SAFE ? "podium" : "trophy"} color={accentFor(index)} size={46} />
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
        ListEmptyComponent={<Empty icon={APP_STORE_SAFE ? "podium-outline" : "trophy-outline"} title={APP_STORE_SAFE ? "No competitions yet" : t("no_leagues")} sub={APP_STORE_SAFE ? "Create a private competition, add custom matches, then invite friends by code." : t("no_leagues_sub")} />}
      />

      {/* ── Join modal ── */}
      <Modal visible={joinModal} transparent animationType="slide" onRequestClose={() => setJoinModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
          <Pressable style={styles.backdrop} onPress={() => setJoinModal(false)}>
            <Pressable style={styles.sheet} onPress={() => {}} >
              <Text style={styles.sheetTitle}>{APP_STORE_SAFE ? "Join a competition" : t("join_title")}</Text>
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
              <Button title={APP_STORE_SAFE ? "Join competition" : t("btn_join_league")} variant="purple" onPress={doJoin} loading={busy} />
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  soireeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceDark,
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  soireeBtnTitle: { color: colors.blanc, fontSize: 16, fontWeight: "900" },
  soireeBtnSub: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "600" },
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
