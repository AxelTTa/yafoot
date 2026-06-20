import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Icon, QRModal } from "../components/ui";
import { createLeague } from "../lib/api";
import { useI18n, PunishmentSeverity } from "../lib/i18n";
import { inviteBase } from "../lib/invite";
import { notify } from "../lib/notify";
import { supabase } from "../lib/supabase";
import { colors, radius, shadow, spacing } from "../lib/theme";

type Step = 1 | 2 | 3 | 4;
type DurKey = "full" | "groups" | "weekend" | "custom";
const DUR_MATCHES: Record<DurKey, number | null> = { full: null, groups: 48, weekend: 8, custom: 0 };
const DUR_NUM: Record<DurKey, string> = { full: "104", groups: "48", weekend: "8", custom: "?" };

const SEV_CHIP_BG: Record<PunishmentSeverity, string> = {
  mild: "rgba(34,197,94,0.13)",
  daring: "rgba(251,140,60,0.13)",
  savage: colors.surfaceDark,
};
const SEV_CHIP_TEXT: Record<PunishmentSeverity, string> = {
  mild: colors.green,
  daring: colors.orange,
  savage: colors.blanc,
};
const SEV_FILTER_BG: Record<"all" | PunishmentSeverity, string> = {
  all: colors.ink,
  mild: colors.green,
  daring: colors.orange,
  savage: colors.surfaceDark,
};
const SEV_LABEL: Record<"all" | PunishmentSeverity, string> = {
  all: "All",
  mild: "Mild",
  daring: "Daring",
  savage: "Savage",
};

export default function CreateLeagueWizard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, punishments } = useI18n();

  const [step, setStep] = useState<Step>(1);
  const [dur, setDur] = useState<DurKey>("full");
  const [customMatches, setCustomMatches] = useState(1);
  const [selectedPunishment, setSelectedPunishment] = useState<string | null>(null);
  const [customPunishment, setCustomPunishment] = useState("");
  const [severityFilter, setSeverityFilter] = useState<"all" | PunishmentSeverity>("all");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [doneLeague, setDoneLeague] = useState<{ id: number; code: string; name: string } | null>(null);
  const [showQR, setShowQR] = useState(false);

  const stepAccent: Record<Step, string> = { 1: colors.cyan, 2: colors.orange, 3: colors.purple, 4: colors.green };

  const filteredPunishments = severityFilter === "all"
    ? punishments
    : punishments.filter((p) => p.severity === severityFilter);

  function back() {
    if (step === 1) router.back();
    else setStep((s) => (s - 1) as Step);
  }

  async function doCreate() {
    const n = name.trim();
    if (n.length < 2) { notify(t("err_name")); return; }
    setBusy(true);
    try {
      const lg = await createLeague(n);
      const maxMatches = dur === "full" ? null : dur === "custom" ? (customMatches || 1) : DUR_MATCHES[dur];
      const punishment = customPunishment.trim() || selectedPunishment || null;
      if (maxMatches !== null || punishment) {
        await supabase.from("leagues").update({ max_matches: maxMatches, punishment }).eq("id", lg.id);
      }
      setDoneLeague({ id: lg.id, code: lg.code, name: n });
      setStep(4);
    } catch (e: any) {
      notify("Error", e.message);
    } finally {
      setBusy(false);
    }
  }

  async function shareLeague() {
    if (!doneLeague) return;
    const url = `${inviteBase()}/join/${doneLeague.code}`;
    const msg = `Join my league "${doneLeague.name}" on YaFoot!\nCode: ${doneLeague.code}\n${url}`;
    if (Platform.OS === "web") {
      if (typeof navigator !== "undefined" && navigator.clipboard) await navigator.clipboard.writeText(url).catch(() => {});
      notify(t("league_created"), url);
    } else {
      try { await Share.share({ message: msg }); } catch {}
    }
  }

  const durOptions: { key: DurKey; label: string }[] = [
    { key: "full", label: t("dur_full") },
    { key: "groups", label: t("dur_groups") },
    { key: "weekend", label: t("dur_weekend") },
    { key: "custom", label: t("dur_custom") },
  ];

  const activePunishment = customPunishment.trim() || selectedPunishment;
  const bottomPad = Math.max(insets.bottom, 16);

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 44) + 12 }]}>
        <Pressable onPress={back} style={styles.backBtn} hitSlop={10}>
          <Icon name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        {step < 4 ? (
          <View style={styles.progressWrap}>
            {([1, 2, 3] as const).map((s) => (
              <View key={s} style={[styles.dot, step >= s && { backgroundColor: stepAccent[step], width: step === s ? 24 : 10 }]} />
            ))}
          </View>
        ) : null}
        <View style={{ width: 40 }} />
      </View>

      {/* ══════════════════ STEP 1: Duration ══════════════════ */}
      {step === 1 && (
        <View style={{ flex: 1 }}>
          <View style={styles.stepHead}>
            <Text style={styles.stepTitle}>{t("create_step1_title")}</Text>
            <Text style={styles.stepSub}>{t("create_step1_sub")}</Text>
          </View>

          <View style={styles.durGrid}>
            {durOptions.map((o) => {
              const active = dur === o.key;
              const numDisplay = o.key === "custom" && dur === "custom" ? String(customMatches) : DUR_NUM[o.key];
              return (
                <Pressable
                  key={o.key}
                  onPress={() => setDur(o.key)}
                  style={[styles.durCard, active && { borderColor: stepAccent[1], borderWidth: 3, backgroundColor: "rgba(34,199,192,0.06)" }]}
                >
                  <Text style={[styles.durBigNum, active && { color: stepAccent[1] }]}>{numDisplay}</Text>
                  {o.key !== "custom" && <Text style={styles.durMatchesLabel}>matches</Text>}
                  <Text style={[styles.durOptionLabel, active && { color: stepAccent[1] }]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {dur === "custom" ? (
            <View style={styles.stepper}>
              <Pressable onPress={() => setCustomMatches((n) => Math.max(1, n - 1))} style={styles.stepperBtn}>
                <Icon name="remove" size={28} color={colors.ink} />
              </Pressable>
              <View style={{ alignItems: "center" }}>
                <Text style={styles.stepperVal}>{customMatches}</Text>
                <Text style={styles.stepperLabel}>matches</Text>
              </View>
              <Pressable onPress={() => setCustomMatches((n) => Math.min(104, n + 1))} style={styles.stepperBtn}>
                <Icon name="add" size={28} color={colors.ink} />
              </Pressable>
            </View>
          ) : null}

          <View style={[styles.stickyBottom, { paddingBottom: bottomPad }]}>
            <Button title={t("btn_next")} variant="green" icon="arrow-forward" onPress={() => setStep(2)} />
          </View>
        </View>
      )}

      {/* ══════════════════ STEP 2: Punishment ══════════════════ */}
      {step === 2 && (
        <View style={{ flex: 1 }}>
          <View style={styles.stepHead}>
            <Text style={styles.stepTitle}>{t("create_step2_title")}</Text>
            <View style={styles.contextBanner}>
              <Icon name="person" size={16} color={colors.blanc} />
              <Text style={styles.contextTxt}>{t("pun_context")}</Text>
            </View>
          </View>

          {/* Severity filter pills */}
          <View style={styles.sevFilterRow}>
            {(["all", "mild", "daring", "savage"] as const).map((sev) => {
              const active = severityFilter === sev;
              return (
                <Pressable
                  key={sev}
                  onPress={() => setSeverityFilter(sev)}
                  style={[styles.sevFilterBtn, active && { backgroundColor: SEV_FILTER_BG[sev] }]}
                >
                  <Text style={[styles.sevFilterTxt, active && styles.sevFilterTxtActive]}>
                    {SEV_LABEL[sev]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: 10 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* No punishment card */}
            <Pressable
              onPress={() => { setSelectedPunishment(null); setCustomPunishment(""); }}
              style={[styles.punCard, styles.punCardSkip, !activePunishment && styles.punCardSkipActive]}
            >
              <Text style={[styles.punCardText, styles.punCardTextSkip, !activePunishment && styles.punCardTextSkipActive]}>
                {t("pun_skip")}
              </Text>
              {!activePunishment ? <Icon name="checkmark-circle" size={22} color={colors.orange} /> : null}
            </Pressable>

            {/* Punishment cards with severity chips */}
            {filteredPunishments.map((p, i) => {
              const active = selectedPunishment === p.text && !customPunishment.trim();
              return (
                <Pressable
                  key={i}
                  onPress={() => { setSelectedPunishment(p.text); setCustomPunishment(""); }}
                  style={[styles.punCard, active && styles.punCardActive]}
                >
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={[styles.sevChip, { backgroundColor: SEV_CHIP_BG[p.severity] }]}>
                      <Text style={[styles.sevChipTxt, { color: SEV_CHIP_TEXT[p.severity] }]}>
                        {p.severity.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.punCardText, active && styles.punCardTextActive]}>{p.text}</Text>
                    <Text style={[styles.punCardSub, active && styles.punCardSubActive]}>{p.subtitle}</Text>
                  </View>
                  {active ? <Icon name="checkmark-circle" size={22} color={colors.orange} /> : null}
                </Pressable>
              );
            })}

            {/* Prominent custom punishment */}
            <View style={styles.customCard}>
              <View style={styles.customCardHeader}>
                <Icon name="create-outline" size={20} color={colors.purple} />
                <Text style={styles.customCardTitle}>{t("pun_or_custom")}</Text>
              </View>
              <TextInput
                style={[styles.customInput, customPunishment.trim() && styles.customInputActive]}
                placeholder={t("pun_custom_ph")}
                placeholderTextColor={colors.textFaint}
                value={customPunishment}
                onChangeText={(v) => { setCustomPunishment(v); if (v.trim()) setSelectedPunishment(null); }}
                multiline
                numberOfLines={3}
              />
              {customPunishment.trim() ? (
                <View style={styles.customActiveChip}>
                  <Icon name="checkmark-circle" size={15} color={colors.green} />
                  <Text style={styles.customActiveTxt}>Custom punishment set</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>

          <View style={[styles.stickyBottom, { paddingBottom: bottomPad }]}>
            <Button title={t("btn_next")} variant="green" icon="arrow-forward" onPress={() => setStep(3)} />
          </View>
        </View>
      )}

      {/* ══════════════════ STEP 3: Name ══════════════════ */}
      {step === 3 && (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={[styles.stepHead, { paddingTop: spacing.xl }]}>
            <Text style={styles.stepTitle}>{t("create_step3_title")}</Text>
          </View>
          <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
            <TextInput
              style={[styles.input, styles.nameInput]}
              placeholder={t("name_placeholder")}
              placeholderTextColor={colors.textFaint}
              value={name}
              onChangeText={setName}
              autoFocus
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={doCreate}
            />
            <Button title={t("btn_create_league")} variant="green" icon="checkmark" onPress={doCreate} loading={busy} />
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ══════════════════ STEP 4: Done ══════════════════ */}
      {step === 4 && doneLeague && (
        <ScrollView contentContainerStyle={[styles.doneScroll, { paddingBottom: bottomPad + spacing.xl }]} showsVerticalScrollIndicator={false}>
          <View style={styles.doneIcon}>
            <Icon name="trophy" size={52} color={colors.yellow} />
          </View>
          <Text style={[styles.stepTitle, { textAlign: "center" }]}>{t("league_created")}</Text>
          <Text style={[styles.stepSub, { textAlign: "center" }]}>{doneLeague.name}</Text>

          <Pressable onPress={() => setShowQR(true)} style={styles.codeCard}>
            <Text style={styles.codeLabel}>{t("invite_code")}</Text>
            <Text style={styles.code}>{doneLeague.code}</Text>
            <View style={styles.qrHint}>
              <Icon name="qr-code" size={14} color={colors.textDim} />
              <Text style={styles.qrHintTxt}>Tap for QR code</Text>
            </View>
          </Pressable>

          <QRModal
            visible={showQR}
            onClose={() => setShowQR(false)}
            value={`${inviteBase()}/join/${doneLeague.code}`}
            title={t("qr_league")}
            subtitle={`${t("invite_code")}: ${doneLeague.code}`}
          />

          <Button title={t("create_done_share")} variant="green" icon="share-social" onPress={shareLeague} style={{ marginTop: spacing.md }} />
          <Button title={t("create_done_go")} variant="ghost" icon="arrow-forward" onPress={() => router.replace(`/league/${doneLeague.id}`)} style={{ marginTop: spacing.sm }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", ...shadow },
  progressWrap: { flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { width: 10, height: 10, borderRadius: 6, backgroundColor: colors.border },

  stepHead: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.sm },
  stepTitle: { color: colors.ink, fontSize: 30, fontWeight: "900", letterSpacing: -0.5 },
  stepSub: { color: colors.textDim, fontSize: 14, fontWeight: "700" },

  // ── Step 1 ──
  durGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.lg },
  durCard: {
    width: "47.5%", backgroundColor: colors.surface, borderRadius: radius.xl,
    paddingVertical: spacing.xl, paddingHorizontal: spacing.md,
    alignItems: "center", gap: 4,
    borderWidth: 1.5, borderColor: colors.border, ...shadow,
  },
  durBigNum: { color: colors.ink, fontSize: 56, fontWeight: "900", lineHeight: 60, letterSpacing: -2 },
  durMatchesLabel: { color: colors.textFaint, fontSize: 12, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  durOptionLabel: { color: colors.textDim, fontSize: 13, fontWeight: "800", marginTop: 4, textAlign: "center" },

  stepper: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xl,
    backgroundColor: colors.surface, borderRadius: radius.xl, margin: spacing.lg,
    padding: spacing.xl, ...shadow,
  },
  stepperBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  stepperVal: { color: colors.ink, fontSize: 64, fontWeight: "900", lineHeight: 68, letterSpacing: -2 },
  stepperLabel: { color: colors.textFaint, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },

  // ── Step 2 ──
  contextBanner: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.orange, borderRadius: radius.md, padding: 12,
  },
  contextTxt: { flex: 1, color: colors.blanc, fontSize: 14, fontWeight: "900", lineHeight: 20 },

  // severity filter
  sevFilterRow: {
    flexDirection: "row", gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
  },
  sevFilterBtn: {
    flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: radius.pill,
    backgroundColor: colors.surface, ...shadow,
  },
  sevFilterTxt: { fontSize: 12, fontWeight: "800", color: colors.textDim, letterSpacing: 0.2 },
  sevFilterTxtActive: { color: colors.blanc },

  // punishment cards
  punCard: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
    backgroundColor: colors.surface, borderRadius: radius.xl,
    paddingVertical: 16, paddingHorizontal: 18, ...shadow, gap: spacing.sm,
  },
  punCardActive: { backgroundColor: colors.surfaceDark },
  punCardSkip: {
    borderStyle: "dashed" as const, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: "transparent", shadowOpacity: 0, elevation: 0,
  },
  punCardSkipActive: { backgroundColor: colors.surface, borderStyle: "solid" as const },
  punCardText: { fontSize: 15, fontWeight: "800" as const, color: colors.ink },
  punCardTextActive: { color: colors.blanc },
  punCardTextSkip: { color: colors.textDim, fontStyle: "italic" as const },
  punCardTextSkipActive: { color: colors.ink, fontStyle: "normal" as const },
  punCardSub: { fontSize: 12, fontWeight: "600" as const, color: colors.textFaint },
  punCardSubActive: { color: "rgba(255,255,255,0.55)" },

  // severity chip inside card
  sevChip: {
    alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill, marginBottom: 2,
  },
  sevChipTxt: { fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },

  // custom punishment area
  customCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg,
    gap: spacing.md, marginTop: spacing.md, ...shadow,
    borderWidth: 2, borderColor: colors.purple + "33",
  },
  customCardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  customCardTitle: { color: colors.purple, fontSize: 14, fontWeight: "900", letterSpacing: 0.2 },
  customInput: {
    backgroundColor: colors.surfaceAlt, borderWidth: 2, borderColor: colors.border,
    borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    color: colors.text, fontSize: 17, fontWeight: "700", minHeight: 80, textAlignVertical: "top",
  },
  customInputActive: { borderColor: colors.purple },
  customActiveChip: { flexDirection: "row", alignItems: "center", gap: 6 },
  customActiveTxt: { color: colors.green, fontSize: 12, fontWeight: "800" },

  // ── Step 3 ──
  input: {
    backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border,
    borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    color: colors.text, fontSize: 15, minHeight: 52,
  },
  nameInput: { fontSize: 22, fontWeight: "800", height: 66 },

  // ── Sticky bottom ──
  stickyBottom: {
    paddingHorizontal: spacing.xl, paddingTop: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: 1, borderTopColor: colors.border,
  },

  // ── Step 4 ──
  doneScroll: { padding: spacing.xl, alignItems: "center", gap: spacing.md },
  doneIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.surfaceDark, alignItems: "center", justifyContent: "center", ...shadow },
  codeCard: { backgroundColor: colors.surfaceDark, borderRadius: radius.xl, padding: spacing.xl, alignItems: "center", gap: spacing.xs, width: "100%", ...shadow },
  codeLabel: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
  code: { color: colors.blanc, fontSize: 40, fontWeight: "900", letterSpacing: 8 },
  qrHint: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.xs },
  qrHintTxt: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "700" },
});
