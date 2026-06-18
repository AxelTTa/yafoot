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
import { Button, Icon, QRModal } from "../components/ui";
import { createLeague } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { inviteBase } from "../lib/invite";
import { notify } from "../lib/notify";
import { supabase } from "../lib/supabase";
import { colors, radius, shadow, spacing } from "../lib/theme";

type Step = 1 | 2 | 3 | 4;
type DurKey = "full" | "groups" | "weekend" | "custom";
const DUR_MATCHES: Record<DurKey, number | null> = { full: null, groups: 48, weekend: 8, custom: 0 };

export default function CreateLeagueWizard() {
  const router = useRouter();
  const { t, punishments } = useI18n();

  const [step, setStep] = useState<Step>(1);
  const [dur, setDur] = useState<DurKey>("full");
  const [customMatches, setCustomMatches] = useState(20);
  const [selectedPunishment, setSelectedPunishment] = useState<string | null>(null);
  const [customPunishment, setCustomPunishment] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [doneLeague, setDoneLeague] = useState<{ id: number; code: string; name: string } | null>(null);
  const [showQR, setShowQR] = useState(false);

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
      const maxMatches = dur === "full" ? null : dur === "custom" ? (customMatches || 20) : DUR_MATCHES[dur];
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

  const durOptions: { key: DurKey; icon: string; label: string; sub: string }[] = [
    { key: "full", icon: "globe", label: t("dur_full"), sub: t("dur_full_sub") },
    { key: "groups", icon: "layers", label: t("dur_groups"), sub: t("dur_groups_sub") },
    { key: "weekend", icon: "calendar", label: t("dur_weekend"), sub: t("dur_weekend_sub") },
    { key: "custom", icon: "settings", label: t("dur_custom"), sub: t("dur_custom_sub") },
  ];

  const stepColors: Record<Step, string> = { 1: colors.cyan, 2: colors.orange, 3: colors.purple, 4: colors.green };
  const activePunishment = customPunishment.trim() || selectedPunishment;

  return (
    <View style={styles.root}>
      {/* Header bar */}
      <View style={styles.header}>
        <Pressable onPress={back} style={styles.backBtn} hitSlop={10}>
          <Icon name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        {step < 4 ? (
          <View style={styles.progressWrap}>
            {([1, 2, 3] as const).map((s) => (
              <View key={s} style={[styles.dot, step >= s && { backgroundColor: stepColors[step] }]} />
            ))}
          </View>
        ) : null}
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── STEP 1: Duration ── */}
          {step === 1 && (
            <View style={styles.stepWrap}>
              <Text style={styles.stepTitle}>{t("create_step1_title")}</Text>
              <Text style={styles.stepSub}>{t("create_step1_sub")}</Text>

              <View style={styles.durGrid}>
                {durOptions.map((o) => {
                  const active = dur === o.key;
                  return (
                    <Pressable
                      key={o.key}
                      onPress={() => setDur(o.key)}
                      style={[styles.durCard, active && { borderColor: stepColors[1], borderWidth: 2.5 }]}
                    >
                      <Icon name={o.icon as any} size={28} color={active ? stepColors[1] : colors.textFaint} />
                      <Text style={[styles.durLabel, active && { color: stepColors[1] }]}>{o.label}</Text>
                      <Text style={styles.durSub}>{o.sub}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {dur === "custom" ? (
                <View style={styles.stepper}>
                  <Pressable
                    onPress={() => setCustomMatches((n) => Math.max(2, n - 1))}
                    style={styles.stepperBtn}
                  >
                    <Icon name="remove" size={22} color={colors.ink} />
                  </Pressable>
                  <Text style={styles.stepperVal}>{customMatches}</Text>
                  <Pressable
                    onPress={() => setCustomMatches((n) => Math.min(104, n + 1))}
                    style={styles.stepperBtn}
                  >
                    <Icon name="add" size={22} color={colors.ink} />
                  </Pressable>
                </View>
              ) : null}

              <Button
                title={t("btn_next")}
                variant="green"
                icon="arrow-forward"
                onPress={() => setStep(2)}
                style={styles.cta}
              />
            </View>
          )}

          {/* ── STEP 2: Punishment ── */}
          {step === 2 && (
            <View style={styles.stepWrap}>
              <Text style={styles.stepTitle}>{t("create_step2_title")}</Text>
              <Text style={styles.stepSub}>{t("create_step2_sub")}</Text>

              {/* No punishment row */}
              <Pressable
                onPress={() => { setSelectedPunishment(null); setCustomPunishment(""); }}
                style={[styles.punRow, !activePunishment && styles.punRowActive]}
              >
                <View style={[styles.radio, !activePunishment && { backgroundColor: colors.greenDark, borderColor: colors.greenDark }]}>
                  {!activePunishment ? <View style={styles.radioDot} /> : null}
                </View>
                <Text style={[styles.punTxt, !activePunishment && { color: colors.greenDark, fontWeight: "900" }]}>
                  {t("pun_skip")}
                </Text>
              </Pressable>

              {/* Presets */}
              {punishments.map((p, i) => {
                const active = selectedPunishment === p && !customPunishment.trim();
                return (
                  <Pressable
                    key={i}
                    onPress={() => { setSelectedPunishment(p); setCustomPunishment(""); }}
                    style={[styles.punRow, active && styles.punRowActive]}
                  >
                    <View style={[styles.radio, active && { backgroundColor: colors.orange, borderColor: colors.orange }]}>
                      {active ? <View style={styles.radioDot} /> : null}
                    </View>
                    <Text style={[styles.punTxt, active && { color: colors.orange, fontWeight: "900" }]}>{p}</Text>
                  </Pressable>
                );
              })}

              {/* Custom */}
              <TextInput
                style={styles.input}
                placeholder={t("pun_custom_ph")}
                placeholderTextColor={colors.textFaint}
                value={customPunishment}
                onChangeText={(v) => { setCustomPunishment(v); if (v.trim()) setSelectedPunishment(null); }}
                multiline
                numberOfLines={2}
              />

              <Button
                title={t("btn_next")}
                variant="green"
                icon="arrow-forward"
                onPress={() => setStep(3)}
                style={styles.cta}
              />
            </View>
          )}

          {/* ── STEP 3: Name ── */}
          {step === 3 && (
            <View style={[styles.stepWrap, { paddingTop: spacing.xl }]}>
              <Text style={styles.stepTitle}>{t("create_step3_title")}</Text>

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

              <Button
                title={t("btn_create_league")}
                variant="green"
                icon="checkmark"
                onPress={doCreate}
                loading={busy}
                style={styles.cta}
              />
            </View>
          )}

          {/* ── STEP 4: Done ── */}
          {step === 4 && doneLeague && (
            <View style={[styles.stepWrap, { alignItems: "center" }]}>
              <View style={styles.doneIcon}>
                <Icon name="trophy" size={48} color={colors.yellow} />
              </View>
              <Text style={styles.stepTitle}>{t("league_created")}</Text>
              <Text style={styles.stepSub}>{doneLeague.name}</Text>

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

              <Button
                title={t("create_done_share")}
                variant="green"
                icon="share-social"
                onPress={shareLeague}
                style={styles.cta}
              />
              <Button
                title={t("create_done_go")}
                variant="ghost"
                icon="arrow-forward"
                onPress={() => router.replace(`/league/${doneLeague.id}`)}
                style={{ marginTop: spacing.sm }}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
    ...shadow,
  },
  progressWrap: { flexDirection: "row", gap: 8, alignItems: "center" },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  scroll: { padding: spacing.xl, paddingTop: spacing.md, paddingBottom: 80 },
  stepWrap: { gap: spacing.lg },
  stepTitle: { color: colors.ink, fontSize: 30, fontWeight: "900", letterSpacing: -0.5 },
  stepSub: { color: colors.textDim, fontSize: 14, fontWeight: "700", marginTop: -spacing.sm },

  durGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  durCard: {
    width: "47.5%", backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: spacing.lg, alignItems: "center", gap: spacing.xs,
    borderWidth: 1.5, borderColor: colors.border, ...shadow,
  },
  durLabel: { color: colors.ink, fontSize: 14, fontWeight: "900", textAlign: "center" },
  durSub: { color: colors.textFaint, fontSize: 11, fontWeight: "600", textAlign: "center" },

  stepper: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xl,
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, ...shadow,
  },
  stepperBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center",
  },
  stepperVal: { color: colors.ink, fontSize: 36, fontWeight: "900", minWidth: 60, textAlign: "center" },

  punRow: {
    flexDirection: "row", alignItems: "flex-start", gap: spacing.md,
    paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  punRowActive: { backgroundColor: colors.surface },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", marginTop: 2, flexShrink: 0,
  },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.blanc },
  punTxt: { flex: 1, color: colors.textDim, fontSize: 14, fontWeight: "700", lineHeight: 20 },

  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    color: colors.text, fontSize: 15, minHeight: 52,
  },
  nameInput: { fontSize: 20, fontWeight: "700", height: 64 },

  cta: { marginTop: spacing.sm },

  doneIcon: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: colors.surfaceDark, alignItems: "center", justifyContent: "center", ...shadow,
  },
  codeCard: {
    backgroundColor: colors.surfaceDark, borderRadius: radius.xl, padding: spacing.xl,
    alignItems: "center", gap: spacing.xs, width: "100%", ...shadow,
  },
  codeLabel: { color: colors.textDim, fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
  code: { color: colors.blanc, fontSize: 36, fontWeight: "900", letterSpacing: 6 },
  qrHint: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.xs },
  qrHintTxt: { color: colors.textDim, fontSize: 12, fontWeight: "700" },
});
