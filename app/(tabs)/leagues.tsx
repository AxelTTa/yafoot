import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button, Card, Empty, Icon, IconTile, Loading, ScreenHeader } from "../../components/ui";
import { createLeague, fetchMyLeagues, joinLeague } from "../../lib/api";
import { notify, confirmAsync } from "../../lib/notify";
import { supabase } from "../../lib/supabase";
import { useI18n } from "../../lib/i18n";
import { accentFor, colors, radius, spacing, shadow } from "../../lib/theme";
import { League } from "../../lib/types";

type DurKey = "full" | "groups" | "weekend" | "custom";
const DUR_MATCHES: Record<DurKey, number | null> = { full: null, groups: 48, weekend: 8, custom: 0 };

export default function Leagues() {
  const router = useRouter();
  const { t, punishments } = useI18n();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState<null | "create" | "join">(null);
  const [busy, setBusy] = useState(false);

  // create form state
  const [name, setName] = useState("");
  const [dur, setDur] = useState<DurKey>("full");
  const [customMatches, setCustomMatches] = useState("20");
  const [selectedPunishment, setSelectedPunishment] = useState<string | null>(null);
  const [customPunishment, setCustomPunishment] = useState("");

  // join form state
  const [code, setCode] = useState("");

  const load = useCallback(async () => {
    try { setLeagues(await fetchMyLeagues()); } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function resetCreate() {
    setName(""); setDur("full"); setCustomMatches("20");
    setSelectedPunishment(null); setCustomPunishment("");
  }

  async function doCreate() {
    if (name.trim().length < 3) return notify(t("err_name"));
    setBusy(true);
    try {
      const lg = await createLeague(name.trim());
      // Save duration + punishment meta
      const maxMatches = dur === "full" ? null : dur === "custom" ? (parseInt(customMatches) || 20) : DUR_MATCHES[dur];
      const punishment = customPunishment.trim() || selectedPunishment || null;
      if (maxMatches !== null || punishment) {
        await supabase.from("leagues").update({ max_matches: maxMatches, punishment }).eq("id", lg.id);
      }
      setModal(null);
      resetCreate();
      await load();
      notify(t("league_created"), t("league_created_sub").replace("{code}", lg.code));
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
      setModal(null); setCode("");
      await load();
      router.push(`/league/${lid}`);
    } catch (e: any) {
      notify("Could not join", e.message);
    } finally {
      setBusy(false);
    }
  }

  const durOptions: { key: DurKey; icon: string; color: string }[] = [
    { key: "full", icon: "globe", color: colors.purple },
    { key: "groups", icon: "layers", color: colors.cyan },
    { key: "weekend", icon: "calendar", color: colors.orange },
    { key: "custom", icon: "settings", color: colors.pink },
  ];

  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
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
            <Button title={t("btn_create")} icon="add" variant="green" onPress={() => setModal("create")} style={{ flex: 1, height: 48 }} />
            <Button title={t("btn_join")} icon="enter-outline" variant="purple" onPress={() => setModal("join")} style={{ flex: 1, height: 48 }} />
          </View>
        }
        renderItem={({ item, index }) => (
          <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }} onPress={() => router.push(`/league/${item.id}`)}>
            <IconTile name="trophy" color={accentFor(index)} size={46} />
            <View style={{ flex: 1 }}>
              <Text style={styles.lgName}>{item.name}</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 3, alignItems: "center" }}>
                <Text style={styles.lgCode}>Code {item.code}</Text>
                {(item as any).max_matches ? (
                  <View style={styles.durChip}>
                    <Icon name="time" size={10} color={colors.orange} />
                    <Text style={[styles.durChipTxt, { color: colors.orange }]}>{(item as any).max_matches} matches</Text>
                  </View>
                ) : null}
                {(item as any).punishment ? (
                  <View style={[styles.durChip, { backgroundColor: "rgba(155,93,229,0.1)" }]}>
                    <Icon name="flame" size={10} color={colors.purple} />
                    <Text style={[styles.durChipTxt, { color: colors.purple }]}>Punishment</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <Icon name="chevron-forward" size={22} color={colors.textFaint} />
          </Card>
        )}
        ListEmptyComponent={<Empty icon="trophy-outline" title={t("no_leagues")} sub={t("no_leagues_sub")} />}
      />

      {/* ── Create modal ── */}
      <Modal visible={modal === "create"} transparent animationType="slide" onRequestClose={() => { setModal(null); resetCreate(); }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={styles.backdrop} onPress={() => { setModal(null); resetCreate(); }}>
            <Pressable style={styles.sheet} onPress={() => {}}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                <Text style={styles.sheetTitle}>{t("create_title")}</Text>

                {/* Name */}
                <TextInput
                  style={styles.input}
                  placeholder={t("name_placeholder")}
                  placeholderTextColor={colors.textFaint}
                  value={name}
                  onChangeText={setName}
                  autoFocus
                  maxLength={40}
                />

                {/* Duration */}
                <Text style={styles.sectionLabel}>{t("dur_section")}</Text>
                <View style={styles.durGrid}>
                  {durOptions.map((o) => {
                    const active = dur === o.key;
                    return (
                      <Pressable key={o.key} onPress={() => setDur(o.key)} style={[styles.durCard, active && { borderColor: o.color, borderWidth: 2 }]}>
                        <IconTile name={o.icon} color={active ? o.color : colors.surfaceAlt} size={36} icon={active ? colors.blanc : colors.textFaint} />
                        <Text style={[styles.durLabel, active && { color: o.color }]}>{t(`dur_${o.key}` as any)}</Text>
                        <Text style={styles.durSub}>{t(`dur_${o.key}_sub` as any)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {dur === "custom" ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md }}>
                    <Text style={styles.durSub}>{t("dur_label")}</Text>
                    <TextInput
                      style={[styles.input, { flex: 0, width: 80, textAlign: "center", marginBottom: 0 }]}
                      value={customMatches}
                      onChangeText={setCustomMatches}
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                  </View>
                ) : null}

                {/* Punishment */}
                <Text style={styles.sectionLabel}>{t("pun_section")}</Text>

                {/* No punishment */}
                <Pressable
                  onPress={() => { setSelectedPunishment(null); setCustomPunishment(""); }}
                  style={[styles.punRow, !selectedPunishment && !customPunishment.trim() && styles.punRowActive]}
                >
                  <Icon name="close-circle" size={18} color={!selectedPunishment && !customPunishment.trim() ? colors.greenDark : colors.textFaint} />
                  <Text style={[styles.punTxt, !selectedPunishment && !customPunishment.trim() && { color: colors.greenDark, fontWeight: "900" }]}>
                    {t("pun_none")}
                  </Text>
                </Pressable>

                {/* Preset list */}
                {punishments.map((p, i) => (
                  <Pressable
                    key={i}
                    onPress={() => { setSelectedPunishment(p); setCustomPunishment(""); }}
                    style={[styles.punRow, selectedPunishment === p && styles.punRowActive]}
                  >
                    <Icon name="flame" size={18} color={selectedPunishment === p ? colors.orange : colors.textFaint} />
                    <Text style={[styles.punTxt, selectedPunishment === p && { color: colors.orange, fontWeight: "900" }]}>{p}</Text>
                  </Pressable>
                ))}

                {/* Custom */}
                <Text style={[styles.durSub, { marginTop: spacing.sm, marginBottom: spacing.xs }]}>{t("pun_or_custom")}</Text>
                <TextInput
                  style={[styles.input, { marginBottom: spacing.sm }]}
                  placeholder={t("pun_custom_ph")}
                  placeholderTextColor={colors.textFaint}
                  value={customPunishment}
                  onChangeText={(v) => { setCustomPunishment(v); if (v.trim()) setSelectedPunishment(null); }}
                  multiline
                  numberOfLines={2}
                />

                <Button title={t("btn_create_league")} onPress={doCreate} loading={busy} />
                <View style={{ height: spacing.md }} />
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Join modal ── */}
      <Modal visible={modal === "join"} transparent animationType="slide" onRequestClose={() => setModal(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={styles.backdrop} onPress={() => setModal(null)}>
            <Pressable style={styles.sheet} onPress={() => {}}>
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
  durChip: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(251,140,60,0.1)", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  durChipTxt: { fontSize: 10, fontWeight: "800" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: 40,
    maxHeight: "90%",
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetTitle: { color: colors.text, fontSize: 20, fontWeight: "900", marginBottom: spacing.md },
  sectionLabel: { color: colors.textDim, fontSize: 11, fontWeight: "800", letterSpacing: 1.2, marginTop: spacing.lg, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
    color: colors.text,
    fontSize: 16,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
  },
  durGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.xs },
  durCard: {
    width: "47%", backgroundColor: colors.surfaceAlt, borderRadius: radius.lg,
    padding: spacing.md, alignItems: "center", gap: spacing.xs,
    borderWidth: 1.5, borderColor: "transparent",
  },
  durLabel: { color: colors.ink, fontSize: 13, fontWeight: "900", textAlign: "center" },
  durSub: { color: colors.textFaint, fontSize: 11, fontWeight: "600", textAlign: "center" },
  punRow: {
    flexDirection: "row", alignItems: "flex-start", gap: spacing.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderRadius: radius.md, marginBottom: 2,
  },
  punRowActive: { backgroundColor: colors.surfaceAlt },
  punTxt: { flex: 1, color: colors.textDim, fontSize: 14, fontWeight: "700", lineHeight: 20 },
});
