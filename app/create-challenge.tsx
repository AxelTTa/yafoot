import { Redirect, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, Header, Icon, Screen, ScrollView } from "../components/ui";
import { createChallengeMatch } from "../lib/api";
import { APP_STORE_SAFE } from "../lib/mode";
import { notify } from "../lib/notify";
import { colors, radius, shadow, spacing } from "../lib/theme";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function defaultStart() {
  const d = new Date(Date.now() + 2 * 60 * 60 * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseLocalDateTime(value: string) {
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function CreateChallenge() {
  const router = useRouter();
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [challengeName, setChallengeName] = useState("");
  const [startTime, setStartTime] = useState(defaultStart());
  const [saving, setSaving] = useState(false);

  if (APP_STORE_SAFE) {
    return <Redirect href="/create-league" />;
  }

  const valid = useMemo(() => {
    return homeTeam.trim().length >= 2 && awayTeam.trim().length >= 2 && !!parseLocalDateTime(startTime);
  }, [homeTeam, awayTeam, startTime]);

  async function submit() {
    const kickoff = parseLocalDateTime(startTime);
    if (!kickoff) {
      notify("Check start time", "Use YYYY-MM-DD HH:mm, for example 2026-07-01 20:00.");
      return;
    }
    if (homeTeam.trim().toLowerCase() === awayTeam.trim().toLowerCase()) {
      notify("Choose two sides", "Team or country names must be different.");
      return;
    }
    setSaving(true);
    try {
      const match = await createChallengeMatch({
        homeTeam,
        awayTeam,
        kickoffIso: kickoff.toISOString(),
        challengeName,
      });
      notify("Challenge created", "Invite friends, then everyone can make a prediction.");
      router.replace(`/match/${match.id}`);
    } catch (e: any) {
      notify("Could not create challenge", e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Header title="Create challenge" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.iconBubble}>
              <Icon name="football" size={28} color={colors.blanc} />
            </View>
            <Text style={styles.heroTitle}>Set up a match for your friends</Text>
            <Text style={styles.heroText}>Add two teams or countries, choose a start time, then share your league code.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>TEAM OR COUNTRY A</Text>
            <TextInput
              style={styles.input}
              value={homeTeam}
              onChangeText={setHomeTeam}
              placeholder="e.g. Paris"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="words"
              maxLength={40}
              returnKeyType="next"
            />

            <Text style={styles.label}>TEAM OR COUNTRY B</Text>
            <TextInput
              style={styles.input}
              value={awayTeam}
              onChangeText={setAwayTeam}
              placeholder="e.g. Madrid"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="words"
              maxLength={40}
              returnKeyType="next"
            />

            <Text style={styles.label}>START TIME</Text>
            <TextInput
              style={styles.input}
              value={startTime}
              onChangeText={setStartTime}
              placeholder="YYYY-MM-DD HH:mm"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
            <Text style={styles.hint}>Local time on this device. Predictions stay open until the match begins.</Text>

            <Text style={styles.label}>CHALLENGE NAME</Text>
            <TextInput
              style={styles.input}
              value={challengeName}
              onChangeText={setChallengeName}
              placeholder="Optional, e.g. Friday night league"
              placeholderTextColor={colors.textFaint}
              maxLength={50}
              returnKeyType="done"
              onSubmitEditing={submit}
            />
          </View>

          <Button title="Create challenge" icon="add-circle" onPress={submit} loading={saving} disabled={!valid} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 60, gap: spacing.lg },
  hero: { backgroundColor: colors.surfaceDark, borderRadius: radius.xl, padding: spacing.xl, gap: spacing.sm, ...shadow },
  iconBubble: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.greenDark, alignItems: "center", justifyContent: "center" },
  heroTitle: { color: colors.blanc, fontSize: 24, fontWeight: "900", lineHeight: 29 },
  heroText: { color: "rgba(255,255,255,0.72)", fontSize: 14, fontWeight: "700", lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, ...shadow },
  label: { color: colors.textDim, fontSize: 11, fontWeight: "900", letterSpacing: 1, marginTop: spacing.sm },
  input: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 52, color: colors.ink, fontSize: 16, fontWeight: "800" },
  hint: { color: colors.textFaint, fontSize: 12, fontWeight: "700", lineHeight: 17 },
});
