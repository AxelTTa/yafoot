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
import { Button, Card, Empty, Icon, IconTile, Loading } from "../../components/ui";
import { captureError, track } from "../../lib/analytics";
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
      track("competition_joined", { league_id: lid, source: "manual_code" });
      setJoinModal(false); setCode("");
      await load();
      router.push(`/league/${lid}`);
    } catch (e: any) {
      captureError(e, "competition_join", { source: "manual_code" });
      notify("Could not join", e.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  const withPunishment = leagues.filter((l) => l.punishment).length;
  const limited = leagues.filter((l) => l.max_matches).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgLeagues }}>
      <FlatList
        data={leagues}
        keyExtractor={(l) => String(l.id)}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md, paddingTop: 56, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.greenDark} />
        }
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
            <View style={styles.hero}>
              <View style={{ flex: 1 }}>
                <Text style={styles.kicker}>{APP_STORE_SAFE ? "Private contests" : "Private leagues"}</Text>
                <Text style={styles.heroTitle}>{APP_STORE_SAFE ? "Competitions" : t("tab_leagues")}</Text>
                <Text style={styles.heroSub}>{APP_STORE_SAFE ? "Build a fixture run, invite friends, chat, and climb the table." : t("leagues_sub")}</Text>
              </View>
              <View style={styles.heroBubble}>
                <Text style={styles.heroNum}>{leagues.length}</Text>
                <Text style={styles.heroNumLabel}>active</Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statCard}><Text style={styles.statNum}>{leagues.length}</Text><Text style={styles.statLabel}>Leagues</Text></View>
              <View style={styles.statCard}><Text style={[styles.statNum, { color: colors.orange }]}>{withPunishment}</Text><Text style={styles.statLabel}>Punishments</Text></View>
              <View style={styles.statCard}><Text style={[styles.statNum, { color: colors.purple }]}>{limited}</Text><Text style={styles.statLabel}>Sprints</Text></View>
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button title={t("btn_create")} icon="add" variant="green" onPress={() => router.push("/create-league")} style={{ flex: 1, height: 48 }} />
              <Button title={t("btn_join")} icon="enter-outline" variant="purple" onPress={() => setJoinModal(true)} style={{ flex: 1, height: 48 }} />
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <Card style={styles.leagueCard} onPress={() => router.push(`/league/${item.id}`)}>
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
            <View style={styles.goBubble}>
              <Icon name="chevron-forward" size={20} color={colors.blanc} />
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Empty icon={APP_STORE_SAFE ? "podium-outline" : "trophy-outline"} color={colors.purple} title={APP_STORE_SAFE ? "No competitions yet" : t("no_leagues")} sub={APP_STORE_SAFE ? "Create a private competition, add fixtures, then invite friends by code." : t("no_leagues_sub")} />
            <Pressable onPress={() => router.push("/create-league")} style={styles.emptyAction}>
              <Icon name="add-circle" size={18} color={colors.blanc} />
              <Text style={styles.emptyActionTxt}>Create your first league</Text>
            </Pressable>
          </View>
        }
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
  hero: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceDark, borderRadius: radius.xl, padding: spacing.lg },
  kicker: { color: colors.green, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  heroTitle: { color: colors.blanc, fontSize: 31, fontWeight: "900" },
  heroSub: { color: "rgba(255,255,255,0.68)", fontSize: 13, fontWeight: "700", lineHeight: 18, marginTop: 3 },
  heroBubble: { width: 78, height: 78, borderRadius: 39, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },
  heroNum: { color: colors.blanc, fontSize: 28, fontWeight: "900" },
  heroNumLabel: { color: "rgba(255,255,255,0.75)", fontSize: 10, fontWeight: "900" },
  statsRow: { flexDirection: "row", gap: spacing.sm },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  statNum: { color: colors.greenDark, fontSize: 23, fontWeight: "900" },
  statLabel: { color: colors.textDim, fontSize: 11, fontWeight: "900", marginTop: 2 },
  leagueCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1.5, borderColor: "rgba(20,19,14,0.05)" },
  lgName: { color: colors.text, fontSize: 17, fontWeight: "900" },
  lgCode: { color: colors.textDim, fontSize: 12 },
  chip: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(251,140,60,0.1)", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  chipTxt: { fontSize: 10, fontWeight: "800" },
  goBubble: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceDark, alignItems: "center", justifyContent: "center" },
  emptyWrap: { gap: spacing.md },
  emptyAction: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.purple, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, marginTop: -spacing.md },
  emptyActionTxt: { color: colors.blanc, fontSize: 14, fontWeight: "900" },
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
