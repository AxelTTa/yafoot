import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, Screen, Tricolor } from "../../components/ui";
import { Logo } from "../../components/Brand";
import { supabase } from "../../lib/supabase";
import { consumePendingInvite, getPendingInvite } from "../../lib/invite";
import { useI18n } from "../../lib/i18n";
import { colors, radius, spacing } from "../../lib/theme";

export default function Welcome() {
  const router = useRouter();
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invited, setInvited] = useState(false);

  useEffect(() => {
    getPendingInvite().then((c) => setInvited(!!c));
  }, []);

  async function start() {
    const u = username.trim();
    setError(null);
    if (u.length < 3) return setError(t("err_short"));
    if (!/^[a-zA-Z0-9_]+$/.test(u)) return setError(t("err_chars"));
    setLoading(true);
    const { error: e } = await supabase.auth.signInAnonymously({
      options: { data: { username: u.toLowerCase(), display_name: u } },
    });
    if (e) { setLoading(false); setError(e.message); return; }
    const { data: who } = await supabase.auth.getUser();
    if (who.user?.id) {
      await supabase.from("profiles").update({ username: u.toLowerCase(), display_name: u }).eq("id", who.user.id);
    }
    const friended = await consumePendingInvite();
    setLoading(false);
    if (friended === "ok") router.replace("/(tabs)/social");
    else router.replace("/onboarding/invite");
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: spacing.xl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
            <Logo size={48} />
            <Text style={styles.tag}>{invited ? t("welcome_invited") : t("welcome_tagline")}</Text>
          </View>

          <Text style={styles.label}>{t("username_label")}</Text>
          <View style={styles.inputRow}>
            <Text style={styles.at}>@</Text>
            <TextInput
              style={styles.input}
              placeholder={t("username_placeholder")}
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={(x) => { setUsername(x); setError(null); }}
              onSubmitEditing={start}
              maxLength={20}
              returnKeyType="go"
            />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            title={invited ? t("btn_join_friend") : t("btn_start")}
            onPress={start}
            loading={loading}
            style={{ marginTop: spacing.lg }}
          />
          <Text style={styles.fine}>{t("welcome_fine")}</Text>
          <View style={{ alignItems: "center", marginTop: spacing.lg }}><Tricolor width={70} /></View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tag: { color: colors.textDim, marginTop: spacing.md, fontSize: 15, fontWeight: "600", textAlign: "center" },
  label: { color: colors.textDim, fontSize: 11, fontWeight: "800", letterSpacing: 1.2, marginBottom: spacing.sm, marginLeft: spacing.xs },
  inputRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.surface,
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.lg, height: 58,
  },
  at: { color: colors.textFaint, fontSize: 20, fontWeight: "800", marginRight: 4 },
  input: { flex: 1, color: colors.text, fontSize: 18, fontWeight: "700" },
  error: { color: colors.rougeSoft, fontWeight: "600", marginTop: spacing.sm, marginLeft: spacing.xs },
  fine: { color: colors.textFaint, fontSize: 12, textAlign: "center", marginTop: spacing.md },
});
