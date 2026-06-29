import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
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
import { CountryOption, COUNTRIES } from "../lib/countries";
import { createPredictionCompetition } from "../lib/api";
import { useI18n, PunishmentSeverity } from "../lib/i18n";
import { APP_STORE_URL, joinLink } from "../lib/invite";
import { notify } from "../lib/notify";
import { colors, radius, shadow, spacing } from "../lib/theme";

type Step = 1 | 2 | 3 | 4;
type SideKey = "home" | "away";
type DraftMatch = {
  id: string;
  home: CountryOption | null;
  away: CountryOption | null;
  date: string;
  hour: number;
  minute: number;
};

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
function pad(n: number) {
  return String(n).padStart(2, "0");
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function defaultDate(offsetHours = 2) {
  return new Date(Date.now() + offsetHours * 60 * 60 * 1000);
}

function newDraft(offsetHours = 2): DraftMatch {
  const d = defaultDate(offsetHours);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    home: null,
    away: null,
    date: dateKey(d),
    hour: d.getHours(),
    minute: Math.floor(d.getMinutes() / 5) * 5,
  };
}

function kickoffDate(match: DraftMatch) {
  const [y, m, d] = match.date.split("-").map(Number);
  const dt = new Date(y, m - 1, d, match.hour, match.minute);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function validateMatch(match: DraftMatch, index: number, t: ReturnType<typeof useI18n>["t"]) {
  const n = String(index + 1);
  if (!match.home) return t("create_err_country_a", { n });
  if (!match.away) return t("create_err_country_b", { n });
  if (match.home.code === match.away.code) return t("create_err_country_same", { n });
  const kickoff = kickoffDate(match);
  if (!kickoff) return t("create_err_time_valid", { n });
  if (kickoff.getTime() <= Date.now() + 60 * 1000) return t("create_err_time_future", { n });
  return null;
}

function dateOptions(t: ReturnType<typeof useI18n>["t"]) {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      key: dateKey(d),
      label: i === 0 ? t("today") : i === 1 ? t("tomorrow") : d.toLocaleDateString([], { weekday: "short" }),
      sub: d.toLocaleDateString([], { month: "short", day: "numeric" }),
    };
  });
}

function CountryPicker({
  visible,
  selected,
  blockedCode,
  onClose,
  onSelect,
  title,
  searchPlaceholder,
}: {
  visible: boolean;
  selected?: CountryOption | null;
  blockedCode?: string | null;
  onClose: () => void;
  onSelect: (country: CountryOption) => void;
  title: string;
  searchPlaceholder: string;
}) {
  const [q, setQ] = useState("");
  const countries = useMemo(() => {
    const query = q.trim().toLowerCase();
    return COUNTRIES.filter((c) => !query || c.name.toLowerCase().includes(query) || c.code.toLowerCase().includes(query));
  }, [q]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalShade} onPress={onClose}>
        <Pressable style={styles.countrySheet} onPress={() => {}}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Icon name="close" size={20} color={colors.ink} />
            </Pressable>
          </View>
          <TextInput
            style={styles.searchInput}
            value={q}
            onChangeText={setQ}
            placeholder={searchPlaceholder}
            placeholderTextColor={colors.textFaint}
            autoCapitalize="words"
          />
          <FlatList
            data={countries}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 420 }}
            renderItem={({ item }) => {
              const disabled = item.code === blockedCode;
              const active = item.code === selected?.code;
              return (
                <Pressable
                  disabled={disabled}
                  onPress={() => { onSelect(item); onClose(); }}
                  style={[styles.countryRow, active && styles.countryRowActive, disabled && { opacity: 0.35 }]}
                >
                  <Text style={styles.countryFlag}>{item.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.countryName}>{item.name}</Text>
                    <Text style={styles.countryCode}>{item.code}</Text>
                  </View>
                  {active ? <Icon name="checkmark-circle" size={20} color={colors.greenDark} /> : null}
                </Pressable>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CountryButton({ label, country, emptyLabel, onPress }: { label: string; country: CountryOption | null; emptyLabel: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.countryBtn, country && styles.countryBtnPicked]}>
      <Text style={styles.countryBtnLabel}>{label}</Text>
      <View style={styles.countryBtnMain}>
        <Text style={styles.countryBtnFlag}>{country?.flag ?? "🏳️"}</Text>
        <Text style={[styles.countryBtnName, !country && { color: colors.textFaint }]} numberOfLines={1}>
          {country?.name ?? emptyLabel}
        </Text>
      </View>
    </Pressable>
  );
}

function TimeStepper({ value, max, step = 1, onChange }: { value: number; max: number; step?: number; onChange: (n: number) => void }) {
  return (
    <View style={styles.timeStepper}>
      <Pressable onPress={() => onChange((value - step + max + 1) % (max + 1))} style={styles.timeBtn}>
        <Icon name="remove" size={18} color={colors.ink} />
      </Pressable>
      <Text style={styles.timeVal}>{pad(value)}</Text>
      <Pressable onPress={() => onChange((value + step) % (max + 1))} style={styles.timeBtn}>
        <Icon name="add" size={18} color={colors.ink} />
      </Pressable>
    </View>
  );
}

export default function CreateCompetitionWizard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, punishments } = useI18n();
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [selectedPunishment, setSelectedPunishment] = useState<string | null>(null);
  const [customPunishment, setCustomPunishment] = useState("");
  const [severityFilter, setSeverityFilter] = useState<"all" | PunishmentSeverity>("all");
  const [matches, setMatches] = useState<DraftMatch[]>([newDraft()]);
  const [picker, setPicker] = useState<{ matchId: string; side: SideKey } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: number; code: string; name: string } | null>(null);
  const [showQR, setShowQR] = useState(false);

  const filteredPunishments = severityFilter === "all"
    ? punishments
    : punishments.filter((p) => p.severity === severityFilter);
  const activePunishment = customPunishment.trim() || selectedPunishment;
  const severityLabel: Record<"all" | PunishmentSeverity, string> = {
    all: t("sev_all"),
    mild: t("sev_mild"),
    daring: t("sev_daring"),
    savage: t("sev_savage"),
  };

  const firstError = useMemo(() => {
    if (name.trim().length < 2) return t("create_err_name");
    if (matches.length < 1) return t("create_err_add_match");
    for (let i = 0; i < matches.length; i += 1) {
      const error = validateMatch(matches[i], i, t);
      if (error) return error;
    }
    return null;
  }, [matches, name, t]);

  function updateMatch(id: string, patch: Partial<DraftMatch>) {
    setMatches((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function setCountry(country: CountryOption) {
    if (!picker) return;
    updateMatch(picker.matchId, { [picker.side]: country } as Partial<DraftMatch>);
  }

  function removeMatch(id: string) {
    setMatches((items) => (items.length <= 1 ? items : items.filter((item) => item.id !== id)));
  }

  function back() {
    if (done) {
      router.replace(`/league/${done.id}`);
    } else if (step === 1) {
      router.back();
    } else {
      setStep((s) => (s - 1) as Step);
    }
  }

  async function submit() {
    if (firstError) {
      notify(t("create_check_competition"), firstError);
      return;
    }
    setBusy(true);
    try {
      const league = await createPredictionCompetition({
        name,
        punishment: activePunishment,
        matches: matches.map((match) => ({
          homeTeam: match.home!.name,
          homeCode: match.home!.code,
          homeFlag: match.home!.flag,
          awayTeam: match.away!.name,
          awayCode: match.away!.code,
          awayFlag: match.away!.flag,
          kickoffIso: kickoffDate(match)!.toISOString(),
        })),
      });
      setDone({ id: league.id, code: league.code, name: league.name });
      setStep(4);
    } catch (e: any) {
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
      notify("Invite link copied", url);
      return;
    }
    try {
      await Share.share({ message: msg });
    } catch {}
  }

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => router.replace(`/league/${done.id}`), 3500);
    return () => clearTimeout(timer);
  }, [done, router]);

  const bottomPad = Math.max(insets.bottom, 16);
  const stepAccent: Record<Step, string> = { 1: colors.purple, 2: colors.orange, 3: colors.cyan, 4: colors.green };
  const selectedMatch = picker ? matches.find((m) => m.id === picker.matchId) : null;

  return (
    <View style={styles.root}>
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

      {step === 1 ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 90 }]} keyboardShouldPersistTaps="handled">
            <View style={styles.stepHead}>
              <Text style={styles.stepTitle}>{t("create_intro_title")}</Text>
              <Text style={styles.stepSub}>{t("create_intro_sub")}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>{t("create_name_label")}</Text>
              <TextInput
                style={[styles.input, styles.nameInput]}
                placeholder={t("create_name_ph")}
                placeholderTextColor={colors.textFaint}
                value={name}
                onChangeText={setName}
                maxLength={48}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
          </ScrollView>
          <View style={[styles.stickyBottom, { paddingBottom: bottomPad }]}>
            <Button title={t("btn_next")} variant="green" icon="arrow-forward" onPress={() => {
              if (name.trim().length < 2) notify(t("create_check_name"), t("create_err_name"));
              else setStep(2);
            }} />
          </View>
        </KeyboardAvoidingView>
      ) : null}

      {step === 2 ? (
        <View style={{ flex: 1 }}>
          <View style={styles.stepHead}>
            <Text style={styles.stepTitle}>{t("create_step2_title")}</Text>
            <View style={styles.contextBanner}>
              <Icon name="person" size={16} color={colors.blanc} />
              <Text style={styles.contextTxt}>{t("pun_context")}</Text>
            </View>
          </View>

          <View style={styles.sevFilterRow}>
            {(["all", "mild", "daring", "savage"] as const).map((sev) => {
              const active = severityFilter === sev;
              return (
                <Pressable key={sev} onPress={() => setSeverityFilter(sev)} style={[styles.sevFilterBtn, active && { backgroundColor: SEV_FILTER_BG[sev] }]}>
                  <Text style={[styles.sevFilterTxt, active && styles.sevFilterTxtActive]}>{severityLabel[sev]}</Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: bottomPad + 90, gap: 10 }} keyboardShouldPersistTaps="handled">
            <Pressable
              onPress={() => { setSelectedPunishment(null); setCustomPunishment(""); }}
              style={[styles.punCard, styles.punCardSkip, !activePunishment && styles.punCardSkipActive]}
            >
              <Text style={[styles.punCardText, styles.punCardTextSkip, !activePunishment && styles.punCardTextSkipActive]}>{t("pun_skip")}</Text>
              {!activePunishment ? <Icon name="checkmark-circle" size={22} color={colors.orange} /> : null}
            </Pressable>

            {filteredPunishments.map((p, i) => {
              const active = selectedPunishment === p.text && !customPunishment.trim();
              return (
                <Pressable key={`${p.severity}-${i}`} onPress={() => { setSelectedPunishment(p.text); setCustomPunishment(""); }} style={[styles.punCard, active && styles.punCardActive]}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={[styles.sevChip, { backgroundColor: SEV_CHIP_BG[p.severity] }]}>
                      <Text style={[styles.sevChipTxt, { color: SEV_CHIP_TEXT[p.severity] }]}>{severityLabel[p.severity].toUpperCase()}</Text>
                    </View>
                    <Text style={[styles.punCardText, active && styles.punCardTextActive]}>{p.text}</Text>
                    <Text style={[styles.punCardSub, active && styles.punCardSubActive]}>{p.subtitle}</Text>
                  </View>
                  {active ? <Icon name="checkmark-circle" size={22} color={colors.orange} /> : null}
                </Pressable>
              );
            })}

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
                maxLength={140}
              />
              {customPunishment.trim() ? (
                <View style={styles.customActiveChip}>
                  <Icon name="checkmark-circle" size={15} color={colors.green} />
                  <Text style={styles.customActiveTxt}>{t("pun_custom_set")}</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>

          <View style={[styles.stickyBottom, { paddingBottom: bottomPad }]}>
            <Button title={t("btn_next")} variant="green" icon="arrow-forward" onPress={() => setStep(3)} />
          </View>
        </View>
      ) : null}

      {step === 3 ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 100 }]} keyboardShouldPersistTaps="handled">
          <View style={styles.stepHead}>
            <Text style={styles.stepTitle}>{t("create_match_title")}</Text>
            <Text style={styles.stepSub}>{t("create_match_sub")}</Text>
          </View>

          {matches.map((match, index) => {
            const error = validateMatch(match, index, t);
            const dates = dateOptions(t);
            return (
              <View key={match.id} style={styles.matchCard}>
                <View style={styles.matchHeader}>
                  <Text style={styles.matchTitle}>{t("create_match_label", { n: String(index + 1) })}</Text>
                  <Pressable onPress={() => removeMatch(match.id)} disabled={matches.length <= 1} style={[styles.removeBtn, matches.length <= 1 && { opacity: 0.35 }]}>
                    <Icon name="trash-outline" size={18} color={colors.rouge} />
                  </Pressable>
                </View>

                <View style={styles.sideRow}>
                  <CountryButton label={t("create_country_a")} country={match.home} emptyLabel={t("create_pick_country")} onPress={() => setPicker({ matchId: match.id, side: "home" })} />
                  <CountryButton label={t("create_country_b")} country={match.away} emptyLabel={t("create_pick_country")} onPress={() => setPicker({ matchId: match.id, side: "away" })} />
                </View>

                <Text style={styles.label}>{t("create_date_label")}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
                  {dates.map((d) => {
                    const active = match.date === d.key;
                    return (
                      <Pressable key={d.key} onPress={() => updateMatch(match.id, { date: d.key })} style={[styles.dateChip, active && styles.dateChipActive]}>
                        <Text style={[styles.dateLabel, active && styles.dateLabelActive]}>{d.label}</Text>
                        <Text style={[styles.dateSub, active && styles.dateSubActive]}>{d.sub}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Text style={styles.label}>{t("create_start_time")}</Text>
                <View style={styles.timeRow}>
                  <View style={styles.timeBlock}>
                    <Text style={styles.timeLabel}>{t("create_hour")}</Text>
                    <TimeStepper value={match.hour} max={23} onChange={(hour) => updateMatch(match.id, { hour })} />
                  </View>
                  <Text style={styles.timeColon}>:</Text>
                  <View style={styles.timeBlock}>
                    <Text style={styles.timeLabel}>{t("create_minutes")}</Text>
                    <TimeStepper value={match.minute} max={55} step={5} onChange={(minute) => updateMatch(match.id, { minute })} />
                  </View>
                </View>
                <Text style={styles.hint}>{t("create_local_time")}</Text>
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </View>
            );
          })}

          <Pressable onPress={() => setMatches((items) => [...items, newDraft(2 + items.length)])} style={styles.addMatchBtn}>
            <Icon name="add-circle" size={22} color={colors.greenDark} />
            <Text style={styles.addMatchText}>{t("create_add_match")}</Text>
          </Pressable>
        </ScrollView>
      ) : null}

      {step === 3 ? (
        <View style={[styles.stickyBottom, { paddingBottom: bottomPad }]}>
          <Text style={styles.summary}>{matches.length === 1 ? t("create_summary_one") : t("create_summary_many", { n: String(matches.length) })}</Text>
          <Button title={t("create_submit")} variant="green" icon="checkmark" onPress={submit} loading={busy} disabled={!!firstError} />
        </View>
      ) : null}

      {step === 4 && done ? (
        <ScrollView contentContainerStyle={[styles.doneScroll, { paddingBottom: bottomPad + spacing.xl }]} showsVerticalScrollIndicator={false}>
          <View style={styles.doneIcon}>
            <Icon name="people" size={52} color={colors.green} />
          </View>
          <Text style={[styles.stepTitle, { textAlign: "center" }]}>{t("create_done_title")}</Text>
          <Text style={[styles.stepSub, { textAlign: "center" }]}>{done.name}</Text>

          <Pressable onPress={() => setShowQR(true)} style={styles.codeCard}>
            <Text style={styles.codeLabel}>INVITE CODE</Text>
            <Text style={styles.code}>{done.code}</Text>
            <View style={styles.qrHint}>
              <Icon name="qr-code" size={14} color={colors.textDim} />
              <Text style={styles.qrHintTxt}>{t("create_qr_hint")}</Text>
            </View>
          </Pressable>

          <QRModal visible={showQR} onClose={() => setShowQR(false)} value={joinLink(done.code)} title="Competition QR" subtitle={`Invite code: ${done.code}`} />

          <Button title={t("create_share_invite")} variant="green" icon="share-social" onPress={shareCompetition} style={{ marginTop: spacing.md }} />
          <Button title={t("create_done_go")} variant="ghost" icon="arrow-forward" onPress={() => router.replace(`/league/${done.id}`)} style={{ marginTop: spacing.sm }} />
        </ScrollView>
      ) : null}

      <CountryPicker
        visible={!!picker}
        selected={picker?.side === "home" ? selectedMatch?.home : selectedMatch?.away}
        blockedCode={picker?.side === "home" ? selectedMatch?.away?.code : selectedMatch?.home?.code}
        onClose={() => setPicker(null)}
        onSelect={setCountry}
        title={t("create_choose_country")}
        searchPlaceholder={t("create_search_country")}
      />
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
  stepTitle: { color: colors.ink, fontSize: 30, fontWeight: "900" },
  stepSub: { color: colors.textDim, fontSize: 14, fontWeight: "700", lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, ...shadow },
  label: { color: colors.textDim, fontSize: 11, fontWeight: "900", letterSpacing: 1, marginTop: spacing.sm },
  input: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, minHeight: 52, color: colors.ink, fontSize: 16, fontWeight: "800" },
  nameInput: { fontSize: 22, minHeight: 64 },
  stickyBottom: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm },
  contextBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.orange, borderRadius: radius.md, padding: 12 },
  contextTxt: { flex: 1, color: colors.blanc, fontSize: 14, fontWeight: "900", lineHeight: 20 },
  sevFilterRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  sevFilterBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, ...shadow },
  sevFilterTxt: { fontSize: 12, fontWeight: "800", color: colors.textDim, letterSpacing: 0.2 },
  sevFilterTxtActive: { color: colors.blanc },
  punCard: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", backgroundColor: colors.surface, borderRadius: radius.xl, paddingVertical: 16, paddingHorizontal: 18, ...shadow, gap: spacing.sm },
  punCardActive: { backgroundColor: colors.surfaceDark },
  punCardSkip: { borderStyle: "dashed", borderWidth: 1.5, borderColor: colors.border, backgroundColor: "transparent", shadowOpacity: 0, elevation: 0 },
  punCardSkipActive: { backgroundColor: colors.surface, borderStyle: "solid" },
  punCardText: { fontSize: 15, fontWeight: "800", color: colors.ink },
  punCardTextActive: { color: colors.blanc },
  punCardTextSkip: { color: colors.textDim, fontStyle: "italic" },
  punCardTextSkipActive: { color: colors.ink, fontStyle: "normal" },
  punCardSub: { fontSize: 12, fontWeight: "600", color: colors.textFaint },
  punCardSubActive: { color: "rgba(255,255,255,0.55)" },
  sevChip: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, marginBottom: 2 },
  sevChipTxt: { fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  customCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md, marginTop: spacing.md, ...shadow, borderWidth: 2, borderColor: colors.purple + "33" },
  customCardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  customCardTitle: { color: colors.purple, fontSize: 14, fontWeight: "900", letterSpacing: 0.2 },
  customInput: { backgroundColor: colors.surfaceAlt, borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, color: colors.text, fontSize: 17, fontWeight: "700", minHeight: 80, textAlignVertical: "top" },
  customInputActive: { borderColor: colors.purple },
  customActiveChip: { flexDirection: "row", alignItems: "center", gap: 6 },
  customActiveTxt: { color: colors.green, fontSize: 12, fontWeight: "800" },
  matchCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border, ...shadow },
  matchHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  matchTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  removeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(239,68,68,0.1)", alignItems: "center", justifyContent: "center" },
  sideRow: { flexDirection: "row", gap: spacing.sm },
  countryBtn: { flex: 1, minHeight: 86, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt, borderWidth: 1.5, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  countryBtnPicked: { borderColor: colors.greenDark, backgroundColor: "rgba(166,230,61,0.16)" },
  countryBtnLabel: { color: colors.textDim, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  countryBtnMain: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  countryBtnFlag: { fontSize: 24 },
  countryBtnName: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: "900" },
  dateRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  dateChip: { minWidth: 86, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, alignItems: "center" },
  dateChipActive: { backgroundColor: colors.surfaceDark, borderColor: colors.surfaceDark },
  dateLabel: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  dateLabelActive: { color: colors.blanc },
  dateSub: { color: colors.textFaint, fontSize: 11, fontWeight: "800", marginTop: 2 },
  dateSubActive: { color: "rgba(255,255,255,0.65)" },
  timeRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md, backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, padding: spacing.md },
  timeBlock: { alignItems: "center", gap: spacing.xs },
  timeLabel: { color: colors.textDim, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  timeStepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  timeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  timeVal: { color: colors.ink, fontSize: 28, fontWeight: "900", minWidth: 42, textAlign: "center" },
  timeColon: { color: colors.ink, fontSize: 30, fontWeight: "900", paddingTop: 14 },
  hint: { color: colors.textFaint, fontSize: 12, fontWeight: "700" },
  error: { color: colors.rouge, fontSize: 12, fontWeight: "800", lineHeight: 17 },
  addMatchBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderRadius: radius.pill, borderWidth: 2, borderStyle: "dashed", borderColor: colors.greenDark, padding: spacing.lg },
  addMatchText: { color: colors.greenDark, fontSize: 15, fontWeight: "900" },
  summary: { color: colors.textDim, fontSize: 13, fontWeight: "800", textAlign: "center" },
  doneScroll: { padding: spacing.xl, alignItems: "center", gap: spacing.md },
  doneIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.surfaceDark, alignItems: "center", justifyContent: "center", ...shadow },
  codeCard: { backgroundColor: colors.surfaceDark, borderRadius: radius.xl, padding: spacing.xl, alignItems: "center", gap: spacing.xs, width: "100%", ...shadow },
  codeLabel: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
  code: { color: colors.blanc, fontSize: 40, fontWeight: "900", letterSpacing: 8 },
  qrHint: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.xs },
  qrHintTxt: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "700" },
  modalShade: { flex: 1, backgroundColor: "rgba(15,23,42,0.36)", justifyContent: "flex-end" },
  countrySheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: spacing.md, maxHeight: "86%" },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  closeBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  searchInput: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, minHeight: 46, paddingHorizontal: spacing.lg, color: colors.ink, fontSize: 15, fontWeight: "800" },
  countryRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: radius.md },
  countryRowActive: { backgroundColor: "rgba(166,230,61,0.16)" },
  countryFlag: { fontSize: 26, width: 34, textAlign: "center" },
  countryName: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  countryCode: { color: colors.textFaint, fontSize: 11, fontWeight: "900", marginTop: 2 },
});
