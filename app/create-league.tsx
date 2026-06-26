import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
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
import { createPredictionCompetition } from "../lib/api";
import { inviteBase } from "../lib/invite";
import { notify } from "../lib/notify";
import { colors, radius, shadow, spacing } from "../lib/theme";

type Step = 1 | 2 | 3;
type DraftMatch = { id: string; homeTeam: string; awayTeam: string; startTime: string };

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatLocalInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultStart(offsetHours = 2) {
  return formatLocalInput(new Date(Date.now() + offsetHours * 60 * 60 * 1000));
}

function newDraft(offsetHours = 2): DraftMatch {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, homeTeam: "", awayTeam: "", startTime: defaultStart(offsetHours) };
}

function parseLocalDateTime(value: string) {
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  return Number.isNaN(date.getTime()) ? null : date;
}

function validateMatch(match: DraftMatch, index: number) {
  const a = match.homeTeam.trim();
  const b = match.awayTeam.trim();
  if (a.length < 2) return `Match ${index + 1}: side A needs at least 2 characters.`;
  if (b.length < 2) return `Match ${index + 1}: side B needs at least 2 characters.`;
  if (a.toLowerCase() === b.toLowerCase()) return `Match ${index + 1}: choose two different sides.`;
  if (!parseLocalDateTime(match.startTime)) return `Match ${index + 1}: use YYYY-MM-DD HH:mm for the start time.`;
  return null;
}

export default function CreateCompetitionWizard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [punishment, setPunishment] = useState("");
  const [matches, setMatches] = useState<DraftMatch[]>([newDraft()]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: number; code: string; name: string } | null>(null);
  const [showQR, setShowQR] = useState(false);

  const firstError = useMemo(() => {
    if (name.trim().length < 2) return "Competition name needs at least 2 characters.";
    if (matches.length < 1) return "Add at least one match.";
    for (let i = 0; i < matches.length; i += 1) {
      const error = validateMatch(matches[i], i);
      if (error) return error;
    }
    return null;
  }, [matches, name]);

  function updateMatch(id: string, patch: Partial<DraftMatch>) {
    setMatches((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
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
      notify("Check competition", firstError);
      return;
    }
    setBusy(true);
    try {
      const league = await createPredictionCompetition({
        name,
        punishment,
        matches: matches.map((match) => ({
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          kickoffIso: parseLocalDateTime(match.startTime)!.toISOString(),
        })),
      });
      setDone({ id: league.id, code: league.code, name: league.name });
      setStep(3);
    } catch (e: any) {
      notify("Could not create competition", e.message);
    } finally {
      setBusy(false);
    }
  }

  async function shareCompetition() {
    if (!done) return;
    const url = `${inviteBase()}/join/${done.code}`;
    const msg = `Join my YaFoot competition "${done.name}".\nCode: ${done.code}\n${url}`;
    if (Platform.OS === "web") {
      if (typeof navigator !== "undefined" && navigator.clipboard) await navigator.clipboard.writeText(url).catch(() => {});
      notify("Invite link copied", url);
      return;
    }
    try {
      await Share.share({ message: msg });
    } catch {}
  }

  const bottomPad = Math.max(insets.bottom, 16);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 44) + 12 }]}>
        <Pressable onPress={back} style={styles.backBtn} hitSlop={10}>
          <Icon name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        {step < 3 ? (
          <View style={styles.progressWrap}>
            {[1, 2].map((s) => (
              <View key={s} style={[styles.dot, step >= s && { backgroundColor: step === s ? colors.greenDark : colors.green, width: step === s ? 24 : 10 }]} />
            ))}
          </View>
        ) : null}
        <View style={{ width: 40 }} />
      </View>

      {step === 1 ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 90 }]} keyboardShouldPersistTaps="handled">
            <View style={styles.stepHead}>
              <Text style={styles.stepTitle}>Create a competition</Text>
              <Text style={styles.stepSub}>Private score predictions for your friends. You choose the matches.</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>COMPETITION NAME</Text>
              <TextInput
                style={[styles.input, styles.nameInput]}
                placeholder="e.g. Friday five-a-side"
                placeholderTextColor={colors.textFaint}
                value={name}
                onChangeText={setName}
                maxLength={48}
                autoCapitalize="words"
              />

              <Text style={styles.label}>OPTIONAL STAKES</Text>
              <TextInput
                style={[styles.input, styles.multiInput]}
                placeholder="e.g. Last place buys snacks"
                placeholderTextColor={colors.textFaint}
                value={punishment}
                onChangeText={setPunishment}
                maxLength={120}
                multiline
              />
            </View>
          </ScrollView>
          <View style={[styles.stickyBottom, { paddingBottom: bottomPad }]}>
            <Button title="Add matches" variant="green" icon="arrow-forward" onPress={() => {
              if (name.trim().length < 2) notify("Check name", "Competition name needs at least 2 characters.");
              else setStep(2);
            }} />
          </View>
        </KeyboardAvoidingView>
      ) : null}

      {step === 2 ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 100 }]} keyboardShouldPersistTaps="handled">
            <View style={styles.stepHead}>
              <Text style={styles.stepTitle}>Build the match list</Text>
              <Text style={styles.stepSub}>Each match needs side A, side B, and a start time. Predictions lock when that match starts.</Text>
            </View>

            {matches.map((match, index) => {
              const error = validateMatch(match, index);
              return (
                <View key={match.id} style={styles.matchCard}>
                  <View style={styles.matchHeader}>
                    <Text style={styles.matchTitle}>Match {index + 1}</Text>
                    <Pressable onPress={() => removeMatch(match.id)} disabled={matches.length <= 1} style={[styles.removeBtn, matches.length <= 1 && { opacity: 0.35 }]}>
                      <Icon name="trash-outline" size={18} color={colors.rouge} />
                    </Pressable>
                  </View>

                  <View style={styles.sideRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>SIDE A</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Blues"
                        placeholderTextColor={colors.textFaint}
                        value={match.homeTeam}
                        onChangeText={(value) => updateMatch(match.id, { homeTeam: value })}
                        maxLength={40}
                        autoCapitalize="words"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>SIDE B</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Reds"
                        placeholderTextColor={colors.textFaint}
                        value={match.awayTeam}
                        onChangeText={(value) => updateMatch(match.id, { awayTeam: value })}
                        maxLength={40}
                        autoCapitalize="words"
                      />
                    </View>
                  </View>

                  <Text style={styles.label}>START TIME</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD HH:mm"
                    placeholderTextColor={colors.textFaint}
                    value={match.startTime}
                    onChangeText={(value) => updateMatch(match.id, { startTime: value })}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Text style={styles.hint}>Local time on this device.</Text>
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                </View>
              );
            })}

            <Pressable onPress={() => setMatches((items) => [...items, newDraft(2 + items.length)])} style={styles.addMatchBtn}>
              <Icon name="add-circle" size={22} color={colors.greenDark} />
              <Text style={styles.addMatchText}>Add another match</Text>
            </Pressable>
          </ScrollView>
          <View style={[styles.stickyBottom, { paddingBottom: bottomPad }]}>
            <Text style={styles.summary}>{matches.length} match{matches.length === 1 ? "" : "es"} in this competition</Text>
            <Button title="Create competition" variant="green" icon="checkmark" onPress={submit} loading={busy} disabled={!!firstError} />
          </View>
        </KeyboardAvoidingView>
      ) : null}

      {step === 3 && done ? (
        <ScrollView contentContainerStyle={[styles.doneScroll, { paddingBottom: bottomPad + spacing.xl }]} showsVerticalScrollIndicator={false}>
          <View style={styles.doneIcon}>
            <Icon name="people" size={52} color={colors.green} />
          </View>
          <Text style={[styles.stepTitle, { textAlign: "center" }]}>Competition created</Text>
          <Text style={[styles.stepSub, { textAlign: "center" }]}>{done.name}</Text>

          <Pressable onPress={() => setShowQR(true)} style={styles.codeCard}>
            <Text style={styles.codeLabel}>INVITE CODE</Text>
            <Text style={styles.code}>{done.code}</Text>
            <View style={styles.qrHint}>
              <Icon name="qr-code" size={14} color={colors.textDim} />
              <Text style={styles.qrHintTxt}>Tap for QR code</Text>
            </View>
          </Pressable>

          <QRModal visible={showQR} onClose={() => setShowQR(false)} value={`${inviteBase()}/join/${done.code}`} title="Competition QR" subtitle={`Invite code: ${done.code}`} />

          <Button title="Share invite" variant="green" icon="share-social" onPress={shareCompetition} style={{ marginTop: spacing.md }} />
          <Button title="Open competition" variant="ghost" icon="arrow-forward" onPress={() => router.replace(`/league/${done.id}`)} style={{ marginTop: spacing.sm }} />
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
  stepTitle: { color: colors.ink, fontSize: 30, fontWeight: "900" },
  stepSub: { color: colors.textDim, fontSize: 14, fontWeight: "700", lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, ...shadow },
  label: { color: colors.textDim, fontSize: 11, fontWeight: "900", letterSpacing: 1, marginTop: spacing.sm },
  input: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, minHeight: 52, color: colors.ink, fontSize: 16, fontWeight: "800" },
  nameInput: { fontSize: 22, minHeight: 64 },
  multiInput: { minHeight: 86, paddingTop: spacing.md, textAlignVertical: "top" },
  stickyBottom: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm },
  matchCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border, ...shadow },
  matchHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  matchTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  removeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(239,68,68,0.1)", alignItems: "center", justifyContent: "center" },
  sideRow: { flexDirection: "row", gap: spacing.sm },
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
});
