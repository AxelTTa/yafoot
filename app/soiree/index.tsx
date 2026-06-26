import { Redirect, useRouter } from "expo-router";
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
import { fetchMatches } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { APP_STORE_SAFE } from "../../lib/mode";
import { notify } from "../../lib/notify";
import { supabase } from "../../lib/supabase";
import { colors, radius, shadow, spacing } from "../../lib/theme";
import { Match } from "../../lib/types";

export default function SoireeIndex() {
  if (APP_STORE_SAFE) {
    return <Redirect href="/(tabs)/leagues" />;
  }

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
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
    const data = await fetchMatches();
    setMatches(data.filter((m) => ["SCHEDULED", "TIMED", "IN_PLAY", "PAUSED"].includes(m.status)).slice(0, 20));
    setLoadingMatches(false);
  }

  async function doHost() {
    if (!selectedMatch) { notify(t("soiree_sign_in_req")); return; }
    const name = soireeName.trim() || `Soirée ${selectedMatch.home_team} vs ${selectedMatch.away_team}`;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { notify(t("soiree_sign_in_req")); return; }
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
      notify(t("soiree_err_generic"), e.message);
    } finally {
      setBusy(false);
    }
  }

  async function doJoin() {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) { notify(t("soiree_code_ph")); return; }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { notify(t("soiree_sign_in_req")); return; }
      const { data: soiree, error } = await supabase
        .from("soirees")
        .select("id, name")
        .eq("join_code", code)
        .single();
      if (error || !soiree) { notify(t("soiree_not_found")); return; }
      await supabase
        .from("soiree_members")
        .upsert({ soiree_id: soiree.id, user_id: u.user.id }, { onConflict: "soiree_id,user_id" });
      setShowJoin(false);
      setJoinCode("");
      router.push(`/soiree/${soiree.id}`);
    } catch (e: any) {
      notify(t("soiree_err_generic"), e.message);
    } finally {
      setBusy(false);
    }
  }

  const joinReady = joinCode.trim().length === 6;

  return (
    <View style={{ flex: 1, backgroundColor: "#1A0A2E" }}>
      <Header title={t("soiree_title")} />

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40, gap: spacing.lg }}>
        {/* Hero */}
        <View style={S.hero}>
          <IconTile name="football" color={colors.purple} size={72} />
          <Text style={S.heroTitle}>{t("soiree_title")}</Text>
          <Text style={S.heroSub}>{t("soiree_hero_sub")}</Text>
        </View>

        {/* Host button */}
        <Pressable style={[S.bigBtn, { backgroundColor: colors.orange }]} onPress={() => setShowHost(true)}>
          <IconTile name="mic" color="rgba(255,255,255,0.25)" size={52} />
          <View style={{ flex: 1 }}>
            <Text style={S.bigBtnTitle}>{t("soiree_host_btn")}</Text>
            <Text style={S.bigBtnSub}>{t("soiree_host_sub")}</Text>
          </View>
          <Icon name="chevron-forward" size={24} color={colors.blanc} />
        </Pressable>

        {/* Join button */}
        <Pressable style={[S.bigBtn, { backgroundColor: colors.purple }]} onPress={() => setShowJoin(true)}>
          <IconTile name="enter-outline" color="rgba(255,255,255,0.25)" size={52} />
          <View style={{ flex: 1 }}>
            <Text style={S.bigBtnTitle}>{t("soiree_join_btn")}</Text>
            <Text style={S.bigBtnSub}>{t("soiree_join_sub")}</Text>
          </View>
          <Icon name="chevron-forward" size={24} color={colors.blanc} />
        </Pressable>

        {/* How it works */}
        <View style={S.howCard}>
          <Text style={S.howTitle}>{t("soiree_how_title")}</Text>
          {([
            { icon: "star", key: "soiree_how_1" },
            { icon: "timer-outline", key: "soiree_how_2" },
            { icon: "flame", key: "soiree_how_3" },
            { icon: "flash", key: "soiree_how_4" },
          ] as const).map(({ icon, key }) => (
            <View key={key} style={S.howRow}>
              <Icon name={icon} size={18} color={colors.purple} />
              <Text style={S.howText}>{t(key)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Host modal */}
      <Modal visible={showHost} transparent animationType="slide" onRequestClose={() => setShowHost(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={S.backdrop} onPress={() => setShowHost(false)}>
            <Pressable style={[S.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
              <Text style={S.sheetTitle}>{t("soiree_host_btn")}</Text>
              <Text style={S.sheetSub}>{t("soiree_host_sub")}</Text>

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
                      {t("soiree_no_matches")}
                    </Text>
                  }
                />
              )}

              <TextInput
                style={S.input}
                placeholder={t("soiree_name_ph")}
                placeholderTextColor={colors.textFaint}
                value={soireeName}
                onChangeText={setSoireeName}
                returnKeyType="done"
              />
              <Button
                title={t("soiree_create_btn")}
                variant="purple"
                onPress={doHost}
                loading={busy}
                disabled={!selectedMatch}
              />
              <Button title={t("soiree_cancel")} variant="ghost" onPress={() => setShowHost(false)} style={{ marginTop: 4 }} />
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Join modal */}
      <Modal visible={showJoin} transparent animationType="slide" onRequestClose={() => setShowJoin(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={S.backdrop} onPress={() => setShowJoin(false)}>
            <Pressable style={[S.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
              <Text style={S.sheetTitle}>{t("soiree_join_modal_title")}</Text>
              <Text style={S.sheetSub}>{t("soiree_join_sub")}</Text>
              <TextInput
                style={[S.input, S.codeInput]}
                placeholder={t("soiree_code_ph")}
                placeholderTextColor={colors.textFaint}
                autoCapitalize="characters"
                value={joinCode}
                onChangeText={(v) => setJoinCode(v.toUpperCase())}
                autoFocus
                returnKeyType="go"
                onSubmitEditing={doJoin}
                maxLength={6}
              />
              <Button
                title={t("soiree_join_action")}
                variant="purple"
                onPress={doJoin}
                loading={busy}
                disabled={!joinReady}
              />
              <Button title={t("soiree_cancel")} variant="ghost" onPress={() => setShowJoin(false)} style={{ marginTop: 4 }} />
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
