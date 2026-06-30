import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Icon, QRModal } from "../components/ui";
import { createLeague } from "../lib/api";
import { APP_STORE_URL, joinLink } from "../lib/invite";
import { useI18n, PunishmentSeverity } from "../lib/i18n";
import { notify } from "../lib/notify";
import { supabase } from "../lib/supabase";
import { colors, radius, shadow, spacing } from "../lib/theme";

type DurKey = "full" | "round" | "sprint" | "custom";
const DUR_MATCHES: Record<DurKey, number | null> = { full: null, round: 16, sprint: 4, custom: 0 };

export default function CreateOfficialLeague() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, punishments } = useI18n();
  const [remainingMatches, setRemainingMatches] = useState<number | null>(null);
  const [dur, setDur] = useState<DurKey>("full");
  const [customMatches, setCustomMatches] = useState(8);
  const [severity, setSeverity] = useState<"all" | PunishmentSeverity>("all");
  const [selectedPunishment, setSelectedPunishment] = useState<string | null>(null);
  const [customPunishment, setCustomPunishment] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: number; code: string; name: string } | null>(null);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .in("status", ["SCHEDULED", "TIMED"])
      .then(({ count }) => setRemainingMatches(count ?? null));
  }, []);

  const filteredPunishments = severity === "all" ? punishments : punishments.filter((p) => p.severity === severity);
  const punishment = customPunishment.trim() || selectedPunishment || null;
  const maxMatches = dur === "full"
    ? null
    : dur === "custom"
      ? Math.max(1, customMatches)
      : Math.min(DUR_MATCHES[dur] ?? 1, remainingMatches ?? DUR_MATCHES[dur] ?? 1);
  const bottomPad = Math.max(insets.bottom, 16);

  async function submit() {
    const leagueName = name.trim();
    if (leagueName.length < 2) {
      notify(t("err_name"));
      return;
    }
    setBusy(true);
    try {
      const league = await createLeague(leagueName);
      if (maxMatches !== null || punishment) {
        await supabase.from("leagues").update({ max_matches: maxMatches, punishment }).eq("id", league.id);
      }
      setDone({ id: league.id, code: league.code, name: leagueName });
    } catch (e: any) {
      notify("Error", e.message);
    } finally {
      setBusy(false);
    }
  }

  async function shareLeague() {
    if (!done) return;
    const url = joinLink(done.code);
    const msg = `Join my league "${done.name}" on YaFoot!\nCode: ${done.code}\n${url}\nApp Store: ${APP_STORE_URL}`;
    if (Platform.OS === "web") {
      if (typeof navigator !== "undefined" && navigator.clipboard) await navigator.clipboard.writeText(url).catch(() => {});
      notify(t("league_created"), url);
      return;
    }
    try {
      await Share.share({ message: msg });
    } catch {}
  }

  if (done) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={[styles.done, { paddingTop: Math.max(insets.top, 44) + spacing.xl, paddingBottom: bottomPad + spacing.xl }]}>
        <View style={styles.doneIcon}>
          <Icon name="trophy" size={52} color={colors.green} />
        </View>
        <Text style={styles.title}>{t("league_created")}</Text>
        <Text style={styles.sub}>{done.name}</Text>
        <Pressable onPress={() => setShowQR(true)} style={styles.codeCard}>
          <Text style={styles.codeLabel}>{t("invite_code")}</Text>
          <Text style={styles.code}>{done.code}</Text>
          <View style={styles.qrHint}>
            <Icon name="qr-code" size={14} color="rgba(255,255,255,0.5)" />
            <Text style={styles.qrHintTxt}>{t("create_qr_hint")}</Text>
          </View>
        </Pressable>
        <QRModal visible={showQR} onClose={() => setShowQR(false)} value={joinLink(done.code)} title={t("qr_league")} subtitle={`${t("invite_code")}: ${done.code}`} />
        <Button title={t("create_done_share")} variant="green" icon="share-social" onPress={shareLeague} style={{ marginTop: spacing.md }} />
        <Button title={t("create_done_go")} variant="ghost" icon="arrow-forward" onPress={() => router.replace(`/league/${done.id}`)} style={{ marginTop: spacing.sm }} />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 44) + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Icon name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 110 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.stepHead}>
          <Text style={styles.title}>{t("create_title")}</Text>
          <Text style={styles.sub}>Use the official World Cup fixture feed. Pick the league length and invite friends by code.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{t("name_placeholder").toUpperCase()}</Text>
          <TextInput style={styles.nameInput} placeholder={t("name_placeholder")} placeholderTextColor={colors.textFaint} value={name} onChangeText={setName} maxLength={48} autoCapitalize="words" />
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>{t("dur_section")}</Text>
          <View style={styles.durGrid}>
            {(["full", "round", "sprint", "custom"] as const).map((key) => {
              const active = dur === key;
              const number = key === "full" ? (remainingMatches == null ? "..." : String(remainingMatches)) : key === "round" ? String(Math.min(16, remainingMatches ?? 16)) : key === "sprint" ? String(Math.min(4, remainingMatches ?? 4)) : String(customMatches);
              return (
                <Pressable key={key} onPress={() => setDur(key)} style={[styles.durCard, active && styles.durCardActive]}>
                  <Text style={[styles.durNum, active && styles.durNumActive]}>{number}</Text>
                  <Text style={[styles.durLabel, active && styles.durLabelActive]}>{key === "round" ? "Current round" : key === "sprint" ? "Final sprint" : t(`dur_${key}`)}</Text>
                </Pressable>
              );
            })}
          </View>
          {dur === "custom" ? (
            <View style={styles.stepper}>
              <Pressable onPress={() => setCustomMatches((n) => Math.max(1, n - 1))} style={styles.roundBtn}><Icon name="remove" size={22} color={colors.ink} /></Pressable>
              <Text style={styles.stepperValue}>{customMatches}</Text>
              <Pressable onPress={() => setCustomMatches((n) => Math.min(104, n + 1))} style={styles.roundBtn}><Icon name="add" size={22} color={colors.ink} /></Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>{t("pun_section")}</Text>
          <View style={styles.filterRow}>
            {(["all", "mild", "daring", "savage"] as const).map((key) => (
              <Pressable key={key} onPress={() => setSeverity(key)} style={[styles.filterBtn, severity === key && styles.filterBtnActive]}>
                <Text style={[styles.filterTxt, severity === key && styles.filterTxtActive]}>{t(`sev_${key}`)}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => { setSelectedPunishment(null); setCustomPunishment(""); }} style={[styles.punCard, !punishment && styles.punCardActive]}>
            <Text style={[styles.punText, !punishment && styles.punTextActive]}>{t("pun_skip")}</Text>
          </Pressable>
          {filteredPunishments.slice(0, 12).map((p, i) => {
            const active = selectedPunishment === p.text && !customPunishment.trim();
            return (
              <Pressable key={`${p.severity}-${i}`} onPress={() => { setSelectedPunishment(p.text); setCustomPunishment(""); }} style={[styles.punCard, active && styles.punCardActive]}>
                <Text style={[styles.punText, active && styles.punTextActive]}>{p.text}</Text>
              </Pressable>
            );
          })}
          <TextInput style={styles.customInput} placeholder={t("pun_custom_ph")} placeholderTextColor={colors.textFaint} value={customPunishment} onChangeText={(v) => { setCustomPunishment(v); if (v.trim()) setSelectedPunishment(null); }} multiline maxLength={140} />
        </View>
      </ScrollView>
      <View style={[styles.sticky, { paddingBottom: bottomPad }]}>
        <Button title={t("btn_create_league")} variant="green" icon="checkmark" onPress={submit} loading={busy} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", ...shadow },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  stepHead: { gap: spacing.sm },
  title: { color: colors.ink, fontSize: 30, fontWeight: "900" },
  sub: { color: colors.textDim, fontSize: 14, fontWeight: "700", lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md, ...shadow },
  label: { color: colors.textDim, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  section: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  nameInput: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, minHeight: 58, color: colors.ink, fontSize: 20, fontWeight: "800" },
  durGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  durCard: { width: "48%", backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, padding: spacing.md, alignItems: "center" },
  durCardActive: { borderColor: colors.greenDark, backgroundColor: "rgba(166,230,61,0.16)" },
  durNum: { color: colors.ink, fontSize: 28, fontWeight: "900" },
  durNumActive: { color: colors.greenDark },
  durLabel: { color: colors.textDim, fontSize: 12, fontWeight: "900", marginTop: 2 },
  durLabelActive: { color: colors.greenDark },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.lg },
  roundBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  stepperValue: { minWidth: 44, textAlign: "center", color: colors.ink, fontSize: 26, fontWeight: "900" },
  filterRow: { flexDirection: "row", gap: spacing.xs },
  filterBtn: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingVertical: 8, alignItems: "center" },
  filterBtnActive: { backgroundColor: colors.surfaceDark },
  filterTxt: { color: colors.textDim, fontSize: 11, fontWeight: "900" },
  filterTxtActive: { color: colors.blanc },
  punCard: { borderRadius: radius.md, backgroundColor: colors.surfaceAlt, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  punCardActive: { backgroundColor: colors.surfaceDark, borderColor: colors.surfaceDark },
  punText: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  punTextActive: { color: colors.blanc },
  customInput: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.ink, fontSize: 15, fontWeight: "700", minHeight: 74, textAlignVertical: "top" },
  sticky: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.xl, paddingTop: spacing.md, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
  done: { paddingHorizontal: spacing.xl, alignItems: "center", gap: spacing.md },
  doneIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.surfaceDark, alignItems: "center", justifyContent: "center", ...shadow },
  codeCard: { width: "100%", backgroundColor: colors.surfaceDark, borderRadius: radius.xl, padding: spacing.xl, alignItems: "center", gap: spacing.xs, ...shadow },
  codeLabel: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
  code: { color: colors.blanc, fontSize: 40, fontWeight: "900", letterSpacing: 8 },
  qrHint: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.xs },
  qrHintTxt: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "700" },
});
