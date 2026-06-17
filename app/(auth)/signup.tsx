import { Link } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, Screen } from "../../components/ui";
import { Logo } from "../../components/Brand";
import { supabase } from "../../lib/supabase";
import { colors, radius, spacing } from "../../lib/theme";

export default function Signup() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function signUp() {
    if (username.trim().length < 3) return Alert.alert("Pick a username", "At least 3 characters.");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: username.trim().toLowerCase(), display_name: username.trim() } },
    });
    setLoading(false);
    if (error) Alert.alert("Sign up failed", error.message);
    else Alert.alert("Welcome to YaFoot!", "Your account is ready. Start predicting!");
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: "center", padding: spacing.xl }}
      >
        <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
          <Logo size={40} />
          <Text style={styles.tag}>Join the tournament</Text>
        </View>

        <View style={{ gap: spacing.md }}>
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />
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
            placeholder="Password (min 6 chars)"
            placeholderTextColor={colors.textFaint}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Button title="Create Account" variant="red" onPress={signUp} loading={loading} />
        </View>

        <View style={styles.footer}>
          <Text style={{ color: colors.textDim }}>Have an account? </Text>
          <Link href="/(auth)/login" style={{ color: colors.bleu, fontWeight: "800" }}>
            Sign in
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
});
