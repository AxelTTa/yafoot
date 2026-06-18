import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, Screen, Tricolor } from "../../components/ui";
import { Logo } from "../../components/Brand";
import { supabase } from "../../lib/supabase";
import { consumePendingInvite, getPendingInvite } from "../../lib/invite";
import { useI18n } from "../../lib/i18n";
import { colors, radius, spacing } from "../../lib/theme";

function toHandle(displayName: string) {
  return displayName.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

export default function Welcome() {
  const router = useRouter();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invited, setInvited] = useState(false);

  useEffect(() => {
    getPendingInvite().then((c) => setInvited(!!c));
  }, []);

  const handle = toHandle(name);

  async function start() {
    const displayName = name.trim();
    setError(null);
    if (displayName.length < 2) return setError(t("err_short"));
    if (handle.length < 2) return setError(t("err_short"));
    setLoading(true);
    const { error: e } = await supabase.auth.signInAnonymously({
      options: { data: { username: handle, display_name: displayName } },
    });
    if (e) { setLoading(false); setError(e.message); return; }
    const { data: who } = await supabase.auth.getUser();
    if (who.user?.id) {
      const { error: ue } = await supabase.from("profiles").update({ username: handle, display_name: displayName }).eq("id", who.user.id);
      if (ue?.code === "23505") {
        // unique violation on username
        await supabase.auth.signOut();
        setLoading(false);
        setError(t("err_chars"));
        return;
      }
    }
    // Check pending league join (from scanning a league QR before having an account)
    const pendingJoin = await AsyncStorage.getItem("yafoot.pending_join");
    if (pendingJoin) {
      await AsyncStorage.removeItem("yafoot.pending_join");
      setLoading(false);
      router.replace(`/join/${pendingJoin}`);
      return;
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
          <TextInput
            style={styles.input}
            placeholder={t("username_placeholder")}
            placeholderTextColor={colors.textFaint}
            autoCapitalize="words"
            autoCorrect={false}
            value={name}
            onChangeText={(x) => { setName(x); setError(null); }}
            onSubmitEditing={start}
            maxLength={30}
            returnKeyType="go"
          />
          {name.trim().length > 1 && handle.length > 1 ? (
            <Text style={styles.handleHint}>{t("handle_preview", { h: handle })}</Text>
          ) : null}
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
  input: {
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.lg, paddingHorizontal: spacing.lg, height: 58,
    color: colors.text, fontSize: 18, fontWeight: "700",
  },
  handleHint: { color: colors.greenDark, fontSize: 12, fontWeight: "800", marginTop: spacing.xs, marginLeft: spacing.xs },
  error: { color: colors.rougeSoft, fontWeight: "600", marginTop: spacing.sm, marginLeft: spacing.xs },
  fine: { color: colors.textFaint, fontSize: 12, textAlign: "center", marginTop: spacing.md },
});
