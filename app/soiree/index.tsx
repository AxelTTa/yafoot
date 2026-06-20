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
import { Button, Header, Icon, IconTile, Loading } from "../../components/ui";
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
    if (!selectedMatch) { notify("Sélectionne un match"); return; }
    const name = soireeName.trim() || `Soirée ${selectedMatch.home_team} vs ${selectedMatch.away_team}`;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { notify("Connexion requise"); return; }
      const { data, error } = await supabase
        .from("soirees")
        .insert({ match_id: selectedMatch.id, host_id: u.user.id, name })
        .select()
        .single();
      if (error) throw error;
      await supabase.from("soiree_members").insert({ soiree_id: data.id, user_id: u.user.id });
      setShowHost(false);
      setSoireeName("");
      setSelectedMatch(null);
      router.push(`/soiree/${data.id}`);
    } catch (e: any) {
      notify("Erreur création", e.message);
    } finally {
      setBusy(false);
    }
  }

  async function doJoin() {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) { notify("Entrez un code de 6 caractères"); return; }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { notify("Connexion requise"); return; }
      const { data: soiree, error } = await supabase
        .from("soirees")
        .select("id, name")
        .eq("join_code", code)
        .single();
      if (error || !soiree) { notify("Soirée introuvable", "Vérifie le code et réessaie."); return; }
      await supabase
        .from("soiree_members")
        .upsert({ soiree_id: soiree.id, user_id: u.user.id }, { onConflict: "soiree_id,user_id" });
      setShowJoin(false);
      setJoinCode("");
      router.push(`/soiree/${soiree.id}`);
    } catch (e: any) {
      notify("Erreur", e.message);
    } finally {
      setBusy(false);
    }
  }

  const joinReady = joinCode.trim().length === 6;

  return (
    <View style={{ flex: 1, backgroundColor: "#1A0A2E" }}>
      <Header title="Soirée Mode" />

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40, gap: spacing.lg }}>
        {/* Hero */}
        <View style={S.hero}>
          <IconTile name="football" color={colors.purple} size={72} />
          <Text style={S.heroTitle}>Party Mode</Text>
          <Text style={S.heroSub}>
            Regardez un match ensemble. L'hôte lance des défis entre les buts.
            Les perdants trinquent.
          </Text>
        </View>

        {/* Host button */}
        <Pressable style={[S.bigBtn, { backgroundColor: colors.orange }]} onPress={() => setShowHost(true)}>
          <IconTile name="mic" color="rgba(255,255,255,0.25)" size={52} />
          <View style={{ flex: 1 }}>
            <Text style={S.bigBtnTitle}>Organiser une Soirée</Text>
            <Text style={S.bigBtnSub}>Choisis un match, partage le code</Text>
          </View>
          <Icon name="chevron-forward" size={24} color={colors.blanc} />
        </Pressable>

        {/* Join button */}
        <Pressable style={[S.bigBtn, { backgroundColor: colors.purple }]} onPress={() => setShowJoin(true)}>
          <IconTile name="enter-outline" color="rgba(255,255,255,0.25)" size={52} />
          <View style={{ flex: 1 }}>
            <Text style={S.bigBtnTitle}>Rejoindre une Soirée</Text>
            <Text style={S.bigBtnSub}>Entre le code de 6 lettres de l'hôte</Text>
          </View>
          <Icon name="chevron-forward" size={24} color={colors.blanc} />
        </Pressable>

        {/* How it works */}
        <View style={S.howCard}>
          <Text style={S.howTitle}>Comment ça marche</Text>
          {[
            { icon: "trophy", label: "Bonne réponse = +10 pts, le plus rapide = +15 pts" },
            { icon: "timer-outline", label: "45 secondes pour parier par round" },
            { icon: "flame", label: "Mauvaise réponse = punition pour le perdant" },
            { icon: "flash", label: "Tout en temps réel — tout le monde voit les mises à jour" },
          ].map(({ icon, label }) => (
            <View key={label} style={S.howRow}>
              <Icon name={icon as any} size={18} color={colors.purple} />
              <Text style={S.howText}>{label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Host modal */}
      <Modal visible={showHost} transparent animationType="slide" onRequestClose={() => setShowHost(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={S.backdrop} onPress={() => setShowHost(false)}>
            <Pressable style={[S.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
              <Text style={S.sheetTitle}>Organiser une Soirée</Text>
              <Text style={S.sheetSub}>Choisis le match que vous regardez</Text>

              {loadingMatches ? (
                <Loading />
              ) : (
                <FlatList
                  data={matches}
                  keyExtractor={(m) => String(m.id)}
                  style={{ maxHeight: 240, marginBottom: spacing.md }}
                  renderItem={({ item }) => (
                    <Pressable
                      style={[S.matchRow, selectedMatch?.id === item.id && S.matchRowSelected]}
                      onPress={() => setSelectedMatch(item)}
                    >
                      <Text style={S.matchFlag}>{item.home_flag ?? ""} {item.away_flag ?? ""}</Text>
                      <Text style={[S.matchName, selectedMatch?.id === item.id && { color: colors.purple }]}>
                        {item.home_team} vs {item.away_team}
                      </Text>
                      {(item.status === "IN_PLAY" || item.status === "PAUSED") && (
                        <View style={S.liveChip}><Text style={S.liveTxt}>LIVE</Text></View>
                      )}
                    </Pressable>
                  )}
                  ListEmptyComponent={
                    <Text style={{ color: colors.textFaint, textAlign: "center", padding: 16 }}>
                      Aucun match disponible
                    </Text>
                  }
                />
              )}

              <TextInput
                style={S.input}
                placeholder="Nom de la soirée (optionnel)"
                placeholderTextColor={colors.textFaint}
                value={soireeName}
                onChangeText={setSoireeName}
                returnKeyType="done"
              />
              <Button
                title="Créer la Soirée"
                variant="purple"
                onPress={doHost}
                loading={busy}
                disabled={!selectedMatch}
              />
              <Button title="Annuler" variant="ghost" onPress={() => setShowHost(false)} style={{ marginTop: 4 }} />
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Join modal */}
      <Modal visible={showJoin} transparent animationType="slide" onRequestClose={() => setShowJoin(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={S.backdrop} onPress={() => setShowJoin(false)}>
            <Pressable style={[S.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
              <Text style={S.sheetTitle}>Rejoindre une Soirée</Text>
              <Text style={S.sheetSub}>Demande le code de 6 caractères à l'hôte</Text>
              <TextInput
                style={[S.input, S.codeInput]}
                placeholder="ABC123"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="characters"
                value={joinCode}
                onChangeText={(t) => setJoinCode(t.toUpperCase())}
                autoFocus
                returnKeyType="go"
                onSubmitEditing={doJoin}
                maxLength={6}
              />
              <Button
                title="Rejoindre"
                variant="purple"
                onPress={doJoin}
                loading={busy}
                disabled={!joinReady}
              />
              <Button title="Annuler" variant="ghost" onPress={() => setShowJoin(false)} style={{ marginTop: 4 }} />
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  hero: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  heroTitle: { color: colors.blanc, fontSize: 34, fontWeight: "900", letterSpacing: -0.6 },
  heroSub: { color: "rgba(255,255,255,0.6)", textAlign: "center", fontSize: 14, fontWeight: "600", lineHeight: 22 },
  bigBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    borderRadius: radius.xl, padding: spacing.lg, ...shadow,
  },
  bigBtnTitle: { color: colors.blanc, fontSize: 18, fontWeight: "900" },
  bigBtnSub: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600", marginTop: 2 },
  howCard: {
    backgroundColor: "rgba(255,255,255,0.07)", borderRadius: radius.xl,
    padding: spacing.lg, gap: spacing.sm,
  },
  howTitle: { color: colors.blanc, fontSize: 16, fontWeight: "900", marginBottom: spacing.xs },
  howRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  howText: { color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: "600", flex: 1 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl, padding: spacing.xl, gap: spacing.sm,
  },
  sheetTitle: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  sheetSub: { color: colors.textDim, fontSize: 14, fontWeight: "600", marginBottom: spacing.sm },
  matchRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderRadius: radius.md, borderWidth: 2, borderColor: "transparent",
    backgroundColor: colors.surfaceAlt, marginBottom: 6,
  },
  matchRowSelected: { borderColor: colors.purple, backgroundColor: "rgba(155,93,229,0.1)" },
  matchFlag: { fontSize: 18 },
  matchName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "700" },
  liveChip: { backgroundColor: colors.live, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  liveTxt: { color: colors.blanc, fontSize: 10, fontWeight: "900" },
  input: {
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 52,
    color: colors.text, fontSize: 16,
  },
  codeInput: { fontSize: 28, fontWeight: "900", textAlign: "center", letterSpacing: 8, height: 70 },
});
