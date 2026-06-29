import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Icon, QRModal } from "../components/ui";
import { captureError, track } from "../lib/analytics";
import { createPredictionCompetition, fetchMatches } from "../lib/api";
import { APP_STORE_URL, joinLink } from "../lib/invite";
import { PunishmentSeverity, useI18n } from "../lib/i18n";
import { notify } from "../lib/notify";
import { prettyTeam, teamFlag } from "../lib/teams";
import { colors, radius, shadow, spacing } from "../lib/theme";
import { Match, isUpcoming } from "../lib/types";

type Step = 1 | 2 | 3 | 4;
type LengthKey = "rest" | "wave" | "finals" | "custom";

const LEVEL_COLOR: Record<PunishmentSeverity, string> = {
  mild: colors.greenDark,
  daring: colors.orange,
  savage: colors.purple,
};
const LEVEL_NUM: Record<PunishmentSeverity, string> = { mild: "1", daring: "2", savage: "3" };

function matchTime(match: Match) {
  if (!match.utc_kickoff) return "TBD";
  const d = new Date(match.utc_kickoff);
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function fixturePayload(match: Match) {
  return {
    homeTeam: prettyTeam(match.home_team),
    homeCode: match.home_code,
    homeFlag: teamFlag(match.home_team, match.home_flag),
    awayTeam: prettyTeam(match.away_team),
    awayCode: match.away_code,
    awayFlag: teamFlag(match.away_team, match.away_flag),
    kickoffIso: match.utc_kickoff || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}

function isPredictionReadyFixture(match: Match) {
  const home = prettyTeam(match.home_team);
  const away = prettyTeam(match.away_team);
  return home !== "TBD" && away !== "TBD" && home !== away;
}

export default function CreateCompetitionWizard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lang, t, punishments } = useI18n();
  const [step, setStep] = useState<Step>(1);
  const [fixtures, setFixtures] = useState<Match[]>([]);
  const [loadingFixtures, setLoadingFixtures] = useState(true);
  const [length, setLength] = useState<LengthKey>("rest");
  const [customCount, setCustomCount] = useState(8);
  const [severityFilter, setSeverityFilter] = useState<"all" | PunishmentSeverity>("all");
  const [selectedPunishment, setSelectedPunishment] = useState<string | null>(null);
  const [customPunishment, setCustomPunishment] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: number; code: string; name: string } | null>(null);
  const [showQR, setShowQR] = useState(false);

  const loadFixtures = useCallback(async () => {
    setLoadingFixtures(true);
    try {
      const all = await fetchMatches();
      const remaining = all
        .filter((m) => isUpcoming(m.status))
        .filter((m) => !/GROUP/i.test(String(m.stage ?? "")))
        .filter(isPredictionReadyFixture)
        .sort((a, b) => {
          const ta = a.utc_kickoff ?? "";
          const tb = b.utc_kickoff ?? "";
          if (ta !== tb) return ta < tb ? -1 : 1;
          return a.id - b.id;
        });
      setFixtures(remaining);
      setCustomCount(Math.min(8, Math.max(1, remaining.length || 1)));
    } catch {
      setFixtures([]);
    } finally {
      setLoadingFixtures(false);
    }
  }, []);

  useEffect(() => { loadFixtures(); }, [loadFixtures]);

  const remainingCount = fixtures.length;
  const waveCount = Math.min(16, Math.max(1, remainingCount));
  const finalsCount = Math.min(8, Math.max(1, remainingCount));
  const selectedCount = length === "rest" ? remainingCount : length === "wave" ? waveCount : length === "finals" ? finalsCount : Math.min(customCount, Math.max(1, remainingCount));
  const selectedFixtures = fixtures.slice(0, selectedCount || 0);
  const activePunishment = customPunishment.trim() || selectedPunishment;
  const filteredPunishments = severityFilter === "all" ? punishments : punishments.filter((p) => p.severity === severityFilter);
  const bottomPad = Math.max(insets.bottom, 16);

  const copy = {
    lengthTitle: lang === "fr" ? "Sur combien de matchs ?" : "How long?",
    lengthSub: lang === "fr"
      ? "La phase de groupes est terminee. Choisis une duree basee sur les matchs restants."
      : "The group stage is done. Pick a length based on the remaining knockout matches.",
    rest: lang === "fr" ? "Tout le reste" : "Rest of tournament",
    wave: lang === "fr" ? "Prochaine vague" : "Next knockout wave",
    finals: lang === "fr" ? "Sprint final" : "Final stretch",
    custom: lang === "fr" ? "Personnalise" : "Custom",
    restSub: lang === "fr" ? "Tous les matchs restants" : "Every remaining match",
    waveSub: lang === "fr" ? "Les prochains matchs a pronostiquer" : "The next matches to predict",
    finalsSub: lang === "fr" ? "Pour une ligue courte et intense" : "For a short, tense league",
    customSub: lang === "fr" ? "Choisis ton nombre" : "Choose the count",
    preview: lang === "fr" ? "Apercu des matchs" : "Fixture preview",
    nameSub: lang === "fr" ? "Derniere etape. Donne un nom a ta ligue." : "Final step. Give your league a name.",
    empty: lang === "fr" ? "Aucun match restant dans le flux pour l'instant." : "No remaining fixtures are in the feed yet.",
  };

  const lengthOptions = [
    { key: "rest" as const, label: copy.rest, sub: copy.restSub, count: remainingCount, icon: "trophy-outline" },
    { key: "wave" as const, label: copy.wave, sub: copy.waveSub, count: waveCount, icon: "git-branch-outline" },
    { key: "finals" as const, label: copy.finals, sub: copy.finalsSub, count: finalsCount, icon: "flash-outline" },
    { key: "custom" as const, label: copy.custom, sub: copy.customSub, count: Math.min(customCount, Math.max(1, remainingCount)), icon: "options-outline" },
  ].filter((option) => remainingCount > 0 || option.key === "custom");

  const canContinueLength = selectedFixtures.length > 0;
  const canSubmit = name.trim().length >= 2 && selectedFixtures.length > 0;

  function back() {
    if (done) router.replace(`/league/${done.id}`);
    else if (step === 1) router.back();
    else setStep((s) => (s - 1) as Step);
  }

  async function submit() {
    if (!canSubmit) {
      notify(t("create_check_competition"), name.trim().length < 2 ? t("create_err_name") : t("create_err_add_match"));
      return;
    }
    setBusy(true);
    try {
      const league = await createPredictionCompetition({
        name: name.trim(),
        punishment: activePunishment,
        matches: selectedFixtures.map(fixturePayload),
      });
      track("competition_created", {
        league_id: league.id,
        match_count: selectedFixtures.length,
        length,
        has_punishment: Boolean(activePunishment),
      });
      setDone({ id: league.id, code: league.code, name: league.name });
      setStep(4);
    } catch (e: any) {
      captureError(e, "competition_create", { match_count: selectedFixtures.length, length });
      notify("Could not create competition", e.message);
    } finally {
      setBusy(false);
    }
  }

  async function shareCompetition() {
    if (!done) return;
    const url = joinLink(done.code);
    const msg = `Join my YaFoot competition "${done.name}".\nCode: ${done.code}\n${url}\nApp Store: ${APP_STORE_URL}`;
    if (Platform.OS === "web") {
      if (typeof navigator !== "undefined" && navigator.clipboard) await navigator.clipboard.writeText(url).catch(() => {});
      track("invite_shared", { method: "copy", source: "competition", league_id: done.id });
      notify("Invite link copied", url);
      return;
    }
    try {
      await Share.share({ message: msg });
      track("invite_shared", { method: "native_share", source: "competition", league_id: done.id });
    } catch {}
  }

  const StepDots = (
    <View style={styles.progressWrap}>
      {([1, 2, 3] as const).map((s) => (
        <View key={s} style={[styles.dot, step >= s && { backgroundColor: step === s ? colors.purple : colors.greenDark, width: step === s ? 24 : 10 }]} />
      ))}
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 44) + 12 }]}>
        <Pressable onPress={back} style={styles.backBtn} hitSlop={10}>
          <Icon name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        {step < 4 ? StepDots : null}
        <View style={{ width: 40 }} />
      </View>

      {step === 1 ? (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 104 }]} showsVerticalScrollIndicator={false}>
            <View style={styles.stepHead}>
              <Text style={styles.stepKicker}>STEP 1/3</Text>
              <Text style={styles.stepTitle}>{copy.lengthTitle}</Text>
              <Text style={styles.stepSub}>{copy.lengthSub}</Text>
            </View>
            <View style={styles.lengthGrid}>
              {lengthOptions.map((option) => {
                const active = length === option.key;
                const disabled = loadingFixtures || option.count <= 0;
                return (
                  <Pressable
                    key={option.key}
                    disabled={disabled}
                    onPress={() => setLength(option.key)}
                    style={[styles.lengthCard, active && styles.lengthCardActive, disabled && { opacity: 0.45 }]}
                  >
                    <View style={[styles.lengthIcon, active && { backgroundColor: colors.surfaceDark }]}>
                      <Icon name={option.icon as any} size={20} color={active ? colors.blanc : colors.purple} />
                    </View>
                    <Text style={[styles.lengthCount, active && { color: colors.greenDark }]}>{loadingFixtures ? "..." : option.count}</Text>
                    <Text style={styles.lengthLabel}>{option.label}</Text>
                    <Text style={styles.lengthSub}>{option.sub}</Text>
                  </Pressable>
                );
              })}
            </View>
            {length === "custom" ? (
              <View style={styles.stepperCard}>
                <Pressable onPress={() => setCustomCount((n) => Math.max(1, n - 1))} style={styles.roundBtn}>
                  <Icon name="remove" size={22} color={colors.ink} />
                </Pressable>
                <Text style={styles.stepperValue}>{Math.min(customCount, Math.max(1, remainingCount))}</Text>
                <Pressable onPress={() => setCustomCount((n) => Math.min(Math.max(1, remainingCount), n + 1))} style={styles.roundBtn}>
                  <Icon name="add" size={22} color={colors.ink} />
                </Pressable>
              </View>
            ) : null}
            <View style={styles.previewCard}>
              <Text style={styles.section}>{copy.preview}</Text>
              {selectedFixtures.length === 0 ? <Text style={styles.emptyText}>{copy.empty}</Text> : null}
              {selectedFixtures.slice(0, 4).map((match) => (
                <View key={match.id} style={styles.fixtureRow}>
                  <Text style={styles.fixtureTeams} numberOfLines={1}>
                    {teamFlag(match.home_team, match.home_flag)} {prettyTeam(match.home_team)} v {prettyTeam(match.away_team)} {teamFlag(match.away_team, match.away_flag)}
                  </Text>
                  <Text style={styles.fixtureTime}>{matchTime(match)}</Text>
                </View>
              ))}
              {selectedFixtures.length > 4 ? <Text style={styles.moreText}>+{selectedFixtures.length - 4} more</Text> : null}
            </View>
          </ScrollView>
          <View style={[styles.stickyBottom, { paddingBottom: bottomPad }]}>
            <Button title={t("btn_next")} variant="green" icon="arrow-forward" onPress={() => setStep(2)} disabled={!canContinueLength} />
          </View>
        </View>
      ) : null}

      {step === 2 ? (
        <View style={{ flex: 1 }}>
          <View style={styles.inlineHead}>
            <Text style={styles.stepKicker}>STEP 2/3</Text>
            <Text style={styles.stepTitle}>{t("create_step2_title")}</Text>
            <View style={styles.contextBanner}>
              <Icon name="flame" size={16} color={colors.blanc} />
              <Text style={styles.contextTxt}>{t("pun_context")}</Text>
            </View>
          </View>
          <View style={styles.sevFilterRow}>
            {(["all", "mild", "daring", "savage"] as const).map((sev) => {
              const active = severityFilter === sev;
              return (
                <Pressable key={sev} onPress={() => setSeverityFilter(sev)} style={[styles.sevFilterBtn, active && { backgroundColor: sev === "all" ? colors.ink : LEVEL_COLOR[sev] }]}>
                  <Text style={[styles.sevFilterTxt, active && styles.sevFilterTxtActive]}>{t(`sev_${sev}`)}</Text>
                </Pressable>
              );
            })}
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: bottomPad + 96, gap: 10 }} showsVerticalScrollIndicator={false}>
            <Pressable onPress={() => { setSelectedPunishment(null); setCustomPunishment(""); }} style={[styles.skipCard, !activePunishment && styles.skipCardActive]}>
              <Text style={[styles.skipText, !activePunishment && { color: colors.ink }]}>{t("pun_skip")}</Text>
              {!activePunishment ? <Icon name="checkmark-circle" size={22} color={colors.orange} /> : null}
            </Pressable>
            {filteredPunishments.map((p, i) => {
              const active = selectedPunishment === p.text && !customPunishment.trim();
              return (
                <Pressable key={`${p.severity}-${i}`} onPress={() => { setSelectedPunishment(p.text); setCustomPunishment(""); }} style={[styles.punCard, active && styles.punCardActive]}>
                  <View style={[styles.levelBadge, { backgroundColor: LEVEL_COLOR[p.severity] }]}>
                    <Text style={styles.levelNum}>{LEVEL_NUM[p.severity]}</Text>
                    <Text style={styles.levelText}>LEVEL</Text>
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[styles.punTitle, active && { color: colors.blanc }]}>{p.text}</Text>
                    <Text style={[styles.punSub, active && { color: "rgba(255,255,255,0.62)" }]}>{p.subtitle}</Text>
                  </View>
                  {active ? <Icon name="checkmark-circle" size={22} color={colors.orange} /> : null}
                </Pressable>
              );
            })}
            <View style={styles.customCard}>
              <Text style={styles.customTitle}>{t("pun_or_custom")}</Text>
              <TextInput
                style={[styles.customInput, customPunishment.trim() && { borderColor: colors.purple }]}
                placeholder={t("pun_custom_ph")}
                placeholderTextColor={colors.textFaint}
                value={customPunishment}
                onChangeText={(v) => { setCustomPunishment(v); if (v.trim()) setSelectedPunishment(null); }}
                multiline
                maxLength={140}
              />
            </View>
          </ScrollView>
          <View style={[styles.stickyBottom, { paddingBottom: bottomPad }]}>
            <Button title={t("btn_next")} variant="green" icon="arrow-forward" onPress={() => setStep(3)} />
          </View>
        </View>
      ) : null}

      {step === 3 ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 104 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.stepHead}>
              <Text style={styles.stepKicker}>STEP 3/3</Text>
              <Text style={styles.stepTitle}>{t("create_step3_title")}</Text>
              <Text style={styles.stepSub}>{copy.nameSub}</Text>
            </View>
            <View style={styles.nameCard}>
              <Text style={styles.label}>{t("create_name_label")}</Text>
              <TextInput
                style={styles.nameInput}
                placeholder={t("name_placeholder")}
                placeholderTextColor={colors.textFaint}
                value={name}
                onChangeText={setName}
                maxLength={48}
                autoCapitalize="words"
                returnKeyType="done"
              />
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryNum}>{selectedFixtures.length}</Text>
              <Text style={styles.summaryTxt}>{selectedFixtures.length === 1 ? t("create_summary_one") : t("create_summary_many", { n: String(selectedFixtures.length) })}</Text>
              {activePunishment ? <Text style={styles.summaryPun}>{activePunishment}</Text> : null}
            </View>
          </ScrollView>
          <View style={[styles.stickyBottom, { paddingBottom: bottomPad }]}>
            <Button title={t("create_submit")} variant="green" icon="checkmark" onPress={submit} loading={busy} disabled={!canSubmit} />
          </View>
        </KeyboardAvoidingView>
      ) : null}

      {step === 4 && done ? (
        <ScrollView contentContainerStyle={[styles.doneScroll, { paddingBottom: bottomPad + spacing.xl }]} showsVerticalScrollIndicator={false}>
          <View style={styles.doneIcon}>
            <Icon name="people" size={52} color={colors.green} />
          </View>
          <Text style={[styles.stepTitle, { textAlign: "center" }]}>{t("create_done_title")}</Text>
          <Text style={[styles.stepSub, { textAlign: "center" }]}>{done.name}</Text>
          <Pressable onPress={() => setShowQR(true)} style={styles.codeCard}>
            <Text style={styles.codeLabel}>{t("invite_code")}</Text>
            <Text style={styles.code}>{done.code}</Text>
            <View style={styles.qrHint}>
              <Icon name="qr-code" size={14} color="rgba(255,255,255,0.5)" />
              <Text style={styles.qrHintTxt}>{t("create_qr_hint")}</Text>
            </View>
          </Pressable>
          <QRModal visible={showQR} onClose={() => setShowQR(false)} value={joinLink(done.code)} title={t("qr_league")} subtitle={`${t("invite_code")}: ${done.code}`} />
          <Button title={t("create_share_invite")} variant="green" icon="share-social" onPress={shareCompetition} style={{ marginTop: spacing.md }} />
          <Button title={t("create_done_go")} variant="ghost" icon="arrow-forward" onPress={() => router.replace(`/league/${done.id}`)} style={{ marginTop: spacing.sm }} />
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", ...shadow },
  progressWrap: { flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { width: 10, height: 10, borderRadius: 6, backgroundColor: colors.border },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  stepHead: { gap: spacing.sm, paddingTop: spacing.sm },
  inlineHead: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  stepKicker: { color: colors.purple, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  stepTitle: { color: colors.ink, fontSize: 30, fontWeight: "900" },
  stepSub: { color: colors.textDim, fontSize: 14, fontWeight: "700", lineHeight: 20 },
  lengthGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  lengthCard: { width: "48%", minHeight: 176, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 2, borderColor: colors.border, padding: spacing.md, gap: 7, ...shadow },
  lengthCardActive: { borderColor: colors.greenDark, backgroundColor: "rgba(166,230,61,0.16)" },
  lengthIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(155,93,229,0.12)", alignItems: "center", justifyContent: "center" },
  lengthCount: { color: colors.ink, fontSize: 33, fontWeight: "900", marginTop: 2 },
  lengthLabel: { color: colors.ink, fontSize: 14, fontWeight: "900", lineHeight: 18 },
  lengthSub: { color: colors.textDim, fontSize: 12, fontWeight: "700", lineHeight: 16 },
  stepperCard: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, ...shadow },
  roundBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  stepperValue: { minWidth: 50, textAlign: "center", color: colors.ink, fontSize: 28, fontWeight: "900" },
  previewCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, ...shadow },
  section: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  fixtureRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: 2 },
  fixtureTeams: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  fixtureTime: { color: colors.textFaint, fontSize: 11, fontWeight: "800" },
  moreText: { color: colors.purple, fontSize: 12, fontWeight: "900" },
  emptyText: { color: colors.textDim, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  stickyBottom: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm },
  contextBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.orange, borderRadius: radius.md, padding: 12 },
  contextTxt: { flex: 1, color: colors.blanc, fontSize: 14, fontWeight: "900", lineHeight: 20 },
  sevFilterRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  sevFilterBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, ...shadow },
  sevFilterTxt: { fontSize: 12, fontWeight: "800", color: colors.textDim },
  sevFilterTxtActive: { color: colors.blanc },
  skipCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderStyle: "dashed", borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.lg },
  skipCardActive: { backgroundColor: colors.surface, borderStyle: "solid", ...shadow },
  skipText: { color: colors.textDim, fontSize: 15, fontWeight: "900" },
  punCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.md, ...shadow },
  punCardActive: { backgroundColor: colors.surfaceDark },
  levelBadge: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  levelNum: { color: colors.blanc, fontSize: 20, fontWeight: "900", lineHeight: 22 },
  levelText: { color: "rgba(255,255,255,0.75)", fontSize: 8, fontWeight: "900", letterSpacing: 0.6 },
  punTitle: { color: colors.ink, fontSize: 14, fontWeight: "900", lineHeight: 18 },
  punSub: { color: colors.textFaint, fontSize: 12, fontWeight: "700", lineHeight: 16 },
  customCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, marginTop: spacing.sm, ...shadow },
  customTitle: { color: colors.purple, fontSize: 14, fontWeight: "900" },
  customInput: { backgroundColor: colors.surfaceAlt, borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, color: colors.text, fontSize: 16, fontWeight: "700", minHeight: 80, textAlignVertical: "top" },
  nameCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, ...shadow },
  label: { color: colors.textDim, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  nameInput: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, minHeight: 64, color: colors.ink, fontSize: 22, fontWeight: "800" },
  summaryCard: { alignItems: "center", backgroundColor: colors.surfaceDark, borderRadius: radius.xl, padding: spacing.xl, gap: spacing.xs, ...shadow },
  summaryNum: { color: colors.green, fontSize: 44, fontWeight: "900" },
  summaryTxt: { color: colors.blanc, fontSize: 15, fontWeight: "900", textAlign: "center" },
  summaryPun: { color: "rgba(255,255,255,0.68)", fontSize: 12, fontWeight: "800", textAlign: "center", marginTop: spacing.xs },
  doneScroll: { padding: spacing.xl, alignItems: "center", gap: spacing.md },
  doneIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.surfaceDark, alignItems: "center", justifyContent: "center", ...shadow },
  codeCard: { backgroundColor: colors.surfaceDark, borderRadius: radius.xl, padding: spacing.xl, alignItems: "center", gap: spacing.xs, width: "100%", ...shadow },
  codeLabel: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
  code: { color: colors.blanc, fontSize: 40, fontWeight: "900", letterSpacing: 8 },
  qrHint: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.xs },
  qrHintTxt: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "700" },
});
