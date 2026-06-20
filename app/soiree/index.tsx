import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, Header, Icon, IconTile, Loading } from "../../components/ui";
import { notify } from "../../lib/notify";
import { supabase } from "../../lib/supabase";
import { colors, radius, shadow, spacing } from "../../lib/theme";
import { Match } from "../../lib/types";

export default function SoireeIndex() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [showHost, setShowHost] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [soireeName, setSoireeName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (showHost) loadMatches();
  }, [showHost]);

  async function loadMatches() {
    setLoadingMatches(true);
    const { data } = await supabase
      .from("matches")
      .select("*")
      .in("status", ["SCHEDULED", "TIMED", "IN_PLAY", "PAUSED"])
      .order("utc_kickoff", { ascending: true })
      .limit(20);
    setMatches((data as Match[]) ?? []);
    setLoadingMatches(false);
  }

  async function doHost() {
    if (!selectedMatch) { notify("Pick a match first"); return; }
    const name = soireeName.trim() || `Soirée ${selectedMatch.home_team} vs ${selectedMatch.away_team}`;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { notify("Sign in required"); return; }
      const { data, error } = await supabase
        .from("soirees")
        .insert({ match_id: selectedMatch.id, host_id: u.user.id, name })
        .select()
        .single();
      if (error) throw error;
      // auto-join as member
      await supabase.from("soiree_members").insert({ soiree_id: data.id, user_id: u.user.id });
      setShowHost(false);
      setSoireeName("");
      setSelectedMatch(null);
      router.push(`/soiree/${data.id}`);
    } catch (e: any) {
      notify("Error", e.message);
    } finally {
      setBusy(false);
    }
  }

  async function doJoin() {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) { notify("Enter a 6-character code"); return; }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { notify("Sign in required"); return; }
      const { data: soiree, error } = await supabase
        .from("soirees")
        .select("id, name")
        .eq("join_code", code)
        .single();
      if (error || !soiree) { notify("Soirée not found", "Check the code and try again."); return; }
      await supabase
        .from("soiree_members")
        .upsert({ soiree_id: soiree.id, user_id: u.user.id }, { onConflict: "soiree_id,user_id" });
      setShowJoin(false);
      setJoinCode("");
      router.push(`/soiree/${soiree.id}`);
    } catch (e: any) {
      notify("Error", e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#1A0A2E" }}>
      <Header title="Soirée Mode" />

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40, gap: spacing.lg }}>
        {/* Hero */}
        <View style={styles.hero}>
          <IconTile name="football" color={colors.purple} size={64} />
          <Text style={styles.heroTitle}>Party Mode</Text>
          <Text style={styles.heroSub}>
            Watch a match with mates. Between goals, host fires a 30-second challenge —
            wrong answers get dares.
          </Text>
        </View>

        {/* Host button */}
        <Pressable style={[styles.bigBtn, { backgroundColor: colors.orange }]} onPress={() => setShowHost(true)}>
          <IconTile name="mic" color="rgba(255,255,255,0.25)" size={52} />
          <View style={{ flex: 1 }}>
            <Text style={styles.bigBtnTitle}>Host a Soirée</Text>
            <Text style={styles.bigBtnSub}>Pick a match, get a code, invite the gang</Text>
          </View>
          <Icon name="chevron-forward" size={24} color={colors.blanc} />
        </Pressable>

        {/* Join button */}
        <Pressable style={[styles.bigBtn, { backgroundColor: colors.purple }]} onPress={() => setShowJoin(true)}>
          <IconTile name="enter-outline" color="rgba(255,255,255,0.25)" size={52} />
          <View style={{ flex: 1 }}>
            <Text style={styles.bigBtnTitle}>Join a Soirée</Text>
            <Text style={styles.bigBtnSub}>Enter the 6-char code from the host</Text>
          </View>
          <Icon name="chevron-forward" size={24} color={colors.blanc} />
        </Pressable>

        {/* How it works */}
        <View style={styles.howCard}>
          <Text style={styles.howTitle}>How it works</Text>
          {[
            { icon: "trophy", label: "Correct bet = +10 pts, fastest = +15 pts" },
            { icon: "timer-outline", label: "30-second countdown per round" },
            { icon: "flame", label: "Wrong bets = dare/punishment for losers" },
            { icon: "flash", label: "Realtime — all players see updates live" },
          ].map(({ icon, label }) => (
            <View key={label} style={styles.howRow}>
              <Icon name={icon as any} size={18} color={colors.purple} />
              <Text style={styles.howText}>{label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ── Host modal ── */}
      <Modal visible={showHost} transparent animationType="slide" onRequestClose={() => setShowHost(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={styles.backdrop} onPress={() => setShowHost(false)}>
            <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
              <Text style={styles.sheetTitle}>Host a Soirée</Text>
              <Text style={styles.sheetSub}>Pick the match you're watching</Text>

              {loadingMatches ? (
                <Loading />
              ) : (
                <FlatList
                  data={matches}
                  keyExtractor={(m) => String(m.id)}
                  style={{ maxHeight: 220, marginBottom: spacing.md }}
                  renderItem={({ item }) => (
                    <Pressable
                      style={[styles.matchRow, selectedMatch?.id === item.id && styles.matchRowSelected]}
                      onPress={() => setSelectedMatch(item)}
                    >
                      <Text style={styles.matchFlag}>{item.home_flag ?? ""} {item.away_flag ?? ""}</Text>
                      <Text style={[styles.matchName, selectedMatch?.id === item.id && { color: colors.purple }]}>
                        {item.home_team} vs {item.away_team}
                      </Text>
                      {(item.status === "IN_PLAY" || item.status === "PAUSED") && (
                        <View style={styles.liveChip}>
                          <Text style={styles.liveTxt}>LIVE</Text>
                        </View>
                      )}
                    </Pressable>
                  )}
                  ListEmptyComponent={<Text style={{ color: colors.textFaint, textAlign: "center", padding: 16 }}>No upcoming or live matches</Text>}
                />
              )}

              <TextInput
                style={styles.input}
                placeholder="Soirée name (optional)"
                placeholderTextColor={colors.textFaint}
                value={soireeName}
                onChangeText={setSoireeName}
                returnKeyType="done"
              />
              <Button title="Create Soirée" variant="purple" onPress={doHost} loading={busy} />
              <Button title="Cancel" variant="ghost" onPress={() => setShowHost(false)} style={{ marginTop: 4 }} />
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Join modal ── */}
      <Modal visible={showJoin} transparent animationType="slide" onRequestClose={() => setShowJoin(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={styles.backdrop} onPress={() => setShowJoin(false)}>
            <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
              <Text style={styles.sheetTitle}>Join a Soirée</Text>
              <Text style={styles.sheetSub}>Ask the host for the 6-character code</Text>
              <TextInput
                style={styles.input}
                placeholder="6-char code (e.g. ABC123)"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="characters"
                value={joinCode}
                onChangeText={setJoinCode}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={doJoin}
                maxLength={6}
              />
              <Button title="Join Soirée" variant="purple" onPress={doJoin} loading={busy} />
              <Button title="Cancel" variant="ghost" onPress={() => setShowJoin(false)} style={{ marginTop: 4 }} />
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  heroTitle: { color: colors.blanc, fontSize: 32, fontWeight: "900", letterSpacing: -0.6 },
  heroSub: { color: "rgba(255,255,255,0.6)", textAlign: "center", fontSize: 14, fontWeight: "600", lineHeight: 21 },
  bigBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadow,
  },
  bigBtnTitle: { color: colors.blanc, fontSize: 18, fontWeight: "900" },
  bigBtnSub: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600", marginTop: 2 },
  howCard: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  howTitle: { color: colors.blanc, fontSize: 16, fontWeight: "900", marginBottom: spacing.xs },
  howRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  howText: { color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: "600", flex: 1 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  sheetTitle: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  sheetSub: { color: colors.textDim, fontSize: 14, fontWeight: "600", marginBottom: spacing.sm },
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: colors.surfaceAlt,
    marginBottom: 6,
  },
  matchRowSelected: { borderColor: colors.purple, backgroundColor: "rgba(155,93,229,0.1)" },
  matchFlag: { fontSize: 18 },
  matchName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "700" },
  liveChip: { backgroundColor: colors.live, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  liveTxt: { color: colors.blanc, fontSize: 10, fontWeight: "900" },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 52,
    color: colors.text,
    fontSize: 16,
  },
});
