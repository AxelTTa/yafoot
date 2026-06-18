import { Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, Screen } from "../../components/ui";
import { Logo } from "../../components/Brand";
import { supabase } from "../../lib/supabase";
import { colors, radius, spacing } from "../../lib/theme";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      setError(
        /invalid login/i.test(error.message)
          ? "Incorrect email or password."
          : error.message
      );
    }
    // on success, the auth listener navigates automatically
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: "center", padding: spacing.xl }}
      >
        <View style={{ alignItems: "center", marginBottom: spacing.xxl }}>
          <Logo size={44} />
          <Text style={styles.tag}>Predict the World Cup. Beat your friends.</Text>
        </View>

        <View style={{ gap: spacing.md }}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textFaint}
            secureTextEntry
            value={password}
            onChangeText={(t) => { setPassword(t); setError(null); }}
            onSubmitEditing={signIn}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Sign In" onPress={signIn} loading={loading} />
        </View>

        <View style={styles.footer}>
          <Text style={{ color: colors.textDim }}>No account? </Text>
          <Link href="/(auth)/signup" style={{ color: colors.bleu, fontWeight: "800" }}>
            Create one
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tag: { color: colors.textDim, marginTop: spacing.md, fontSize: 14, fontWeight: "600" },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 52,
    color: colors.text,
    fontSize: 16,
  },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl },
  error: { color: colors.rougeSoft, fontWeight: "600", textAlign: "center", marginTop: -4 },
});
