import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, Screen, Tricolor } from "../../components/ui";
import { Logo } from "../../components/Brand";
import { useAuth } from "../../lib/auth";
import { captureError, track } from "../../lib/analytics";
import { supabase } from "../../lib/supabase";
import { consumePendingInvite, getPendingInvite } from "../../lib/invite";
import { useI18n } from "../../lib/i18n";
import { colors, radius, spacing } from "../../lib/theme";

function toHandle(displayName: string) {
  return displayName.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimit(error: any) {
  const status = error?.status || error?.__isAuthError && error?.status;
  const message = String(error?.message ?? "").toLowerCase();
  return status === 429 || message.includes("rate limit") || message.includes("too many");
}

export default function Welcome() {
  const router = useRouter();
  const { session, refreshProfile } = useAuth();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invited, setInvited] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    getPendingInvite().then((c) => setInvited(!!c));
  }, []);

  const handle = toHandle(name);

  async function start() {
    if (inFlight.current) return;
    const displayName = name.trim();
    setError(null);
    if (displayName.length < 2) return setError(t("err_short"));
    if (handle.length < 2) return setError(t("err_short"));
    track("onboarding_started", { invited, username_length: handle.length });
    inFlight.current = true;
    setLoading(true);
    const delays = [0, 2500, 7000, 15000];
    let authError: any = null;
    for (let attempt = 0; attempt < delays.length; attempt += 1) {
      if (delays[attempt]) await sleep(delays[attempt]);
      const existing = session ?? (await supabase.auth.getSession()).data.session;
      if (existing?.user?.id) {
        authError = null;
        break;
      }
      if (attempt > 0) setError("Still creating your account. Retrying automatically...");
      const { error: e } = await supabase.auth.signInAnonymously({
        options: { data: { username: handle, display_name: displayName } },
      });
      authError = e;
      if (!e) break;
      if (!isRateLimit(e) || attempt === delays.length - 1) break;
    }
    if (authError) {
      setLoading(false);
      inFlight.current = false;
      setError(isRateLimit(authError) ? "Signup is busy right now. Wait a moment, then try again." : authError.message);
      captureError(authError, "onboarding_signup", { invited });
      return;
    }
    const { data: who } = await supabase.auth.getUser();
    if (who.user?.id) {
      const { error: ue } = await supabase.from("profiles").update({ username: handle, display_name: displayName }).eq("id", who.user.id);
      if (ue?.code === "23505") {
        // unique violation on username
        setLoading(false);
        inFlight.current = false;
        setError(t("err_chars"));
        captureError(ue, "onboarding_profile_update", { reason: "username_conflict" });
        return;
      }
      await refreshProfile();
    }
    // Check pending league join (from scanning a league QR before having an account)
    const pendingJoin = await AsyncStorage.getItem("yafoot.pending_join");
    if (pendingJoin) {
      await AsyncStorage.removeItem("yafoot.pending_join");
      setLoading(false);
      inFlight.current = false;
      track("onboarding_completed", { destination: "join", invited });
      router.replace(`/join/${pendingJoin}`);
      return;
    }
    const friended = await consumePendingInvite();
    setLoading(false);
    inFlight.current = false;
    track("onboarding_completed", { destination: friended === "ok" ? "social" : "invite", invited, friended: friended === "ok" });
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
