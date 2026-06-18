import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, Screen, Tricolor } from "../../components/ui";
import { Logo } from "../../components/Brand";
import { supabase } from "../../lib/supabase";
import { consumePendingInvite, getPendingInvite } from "../../lib/invite";
import { colors, radius, spacing } from "../../lib/theme";

export default function Welcome() {
  const router = useRouter();
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
    if (u.length < 3) return setError("Pick a username (at least 3 characters).");
    if (!/^[a-zA-Z0-9_]+$/.test(u)) return setError("Letters, numbers and underscores only.");
    setLoading(true);
    // username-only: anonymous account, username carried in metadata for the profile trigger
    const { error: e } = await supabase.auth.signInAnonymously({
      options: { data: { username: u.toLowerCase(), display_name: u } },
    });
    if (e) {
      setLoading(false);
      setError(e.message);
      return;
    }
    // ensure the profile has the chosen username (trigger may have used a default)
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
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: "center", padding: spacing.xl }}
      >
        <View style={{ alignItems: "center", marginBottom: spacing.xxl }}>
          <Logo size={48} />
          <Text style={styles.tag}>
            {invited ? "A friend invited you" : "Predict the World Cup. Beat your friends."}
          </Text>
        </View>

        <Text style={styles.label}>CHOOSE YOUR USERNAME</Text>
        <View style={styles.inputRow}>
          <Text style={styles.at}>@</Text>
          <TextInput
            style={styles.input}
            placeholder="username"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={(t) => { setUsername(t); setError(null); }}
            onSubmitEditing={start}
            maxLength={20}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title={invited ? "Join & add friend" : "Get started"} onPress={start} loading={loading} style={{ marginTop: spacing.lg }} />
        <Text style={styles.fine}>No email, no password. Just pick a name and play.</Text>
        <View style={{ alignItems: "center", marginTop: spacing.xl }}><Tricolor width={70} /></View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tag: { color: colors.textDim, marginTop: spacing.lg, fontSize: 15, fontWeight: "600", textAlign: "center" },
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
