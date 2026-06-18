import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Avatar, Button, Card, Header, Screen, ScrollView } from "../components/ui";
import { useAuth } from "../lib/auth";
import { updateProfile } from "../lib/api";
import { pickAndUploadAvatar } from "../lib/avatar";
import { confirmAsync, notify } from "../lib/notify";
import { colors, spacing } from "../lib/theme";

export default function Settings() {
  const router = useRouter();
  const { profile, session, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? profile?.username ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function save() {
    if (name.trim().length < 2) return notify("Name too short");
    setSaving(true);
    try {
      await updateProfile({ display_name: name.trim() });
      await refreshProfile();
      notify("Saved", "Your name has been updated.");
    } catch (e: any) {
      notify("Could not save", e.message);
    } finally {
      setSaving(false);
    }
  }

  async function changeAvatar() {
    if (!session?.user?.id) return;
    setUploading(true);
    const url = await pickAndUploadAvatar(session.user.id);
    if (url) {
      try {
        await updateProfile({ avatar_url: url });
        await refreshProfile();
        notify("Photo updated");
      } catch (e: any) {
        notify("Could not save photo", e.message);
      }
    }
    setUploading(false);
  }

  return (
    <Screen>
      <Header title="Settings" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 60 }}>
        <View style={{ alignItems: "center", gap: spacing.md }}>
          <Pressable onPress={changeAvatar} style={{ alignItems: "center", gap: 8 }}>
            <Avatar name={profile?.display_name || profile?.username} url={profile?.avatar_url} size={96} ring />
            <Text style={styles.changePhoto}>{uploading ? "Uploading…" : "Change photo"}</Text>
          </Pressable>
        </View>

        <Card style={{ gap: spacing.md }}>
          <Text style={styles.label}>DISPLAY NAME</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={colors.textFaint} maxLength={24} />
          <Text style={styles.handle}>@{profile?.username} · username can't be changed</Text>
          <Button title="Save changes" onPress={save} loading={saving} />
        </Card>

        <Button
          title="Sign out"
          variant="outline"
          onPress={async () => {
            const ok = await confirmAsync("Sign out?", "On a username-only account, signing out on this device means starting fresh.");
            if (ok) { await signOut(); router.replace("/(auth)/welcome"); }
          }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  changePhoto: { color: colors.bleu, fontWeight: "800", fontSize: 14 },
  label: { color: colors.textDim, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  input: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: spacing.lg, height: 52, color: colors.text, fontSize: 16, fontWeight: "700" },
  handle: { color: colors.textFaint, fontSize: 12 },
});
