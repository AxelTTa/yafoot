import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Avatar, Button, Header, Icon, Screen, ScrollView } from "../components/ui";
import { useAuth } from "../lib/auth";
import { updateProfile } from "../lib/api";
import { pickAndUploadAvatar } from "../lib/avatar";
import { confirmAsync, notify } from "../lib/notify";
import { colors, radius, shadow, spacing } from "../lib/theme";

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
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

        {/* avatar hero */}
        <View style={styles.avatarSection}>
          <Pressable onPress={changeAvatar} style={styles.avatarWrap}>
            <Avatar name={profile?.display_name || profile?.username} url={profile?.avatar_url} size={100} ring color={colors.purple} />
            <View style={styles.cameraChip}>
              <Icon name={uploading ? "hourglass" : "camera"} size={14} color={colors.blanc} />
            </View>
          </Pressable>
          <Text style={styles.avatarName}>{profile?.display_name || profile?.username || "Player"}</Text>
          <Text style={styles.avatarHandle}>@{profile?.username}</Text>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>

          {/* display name card */}
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.iconTile}>
                <Icon name="person" size={18} color={colors.blanc} />
              </View>
              <Text style={styles.sectionTitle}>Display name</Text>
            </View>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.textFaint}
              maxLength={24}
              returnKeyType="done"
              onSubmitEditing={save}
            />
            <Text style={styles.hint}>Username @{profile?.username} cannot be changed</Text>
            <Button title="Save changes" onPress={save} loading={saving} />
          </View>

          {/* account card */}
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={[styles.iconTile, { backgroundColor: colors.orange }]}>
                <Icon name="shield" size={18} color={colors.blanc} />
              </View>
              <Text style={styles.sectionTitle}>Account</Text>
            </View>
            <View style={styles.infoRow}>
              <Icon name="person-circle-outline" size={18} color={colors.textDim} />
              <Text style={styles.infoTxt}>Anonymous account — device-bound</Text>
            </View>
            <View style={styles.infoRow}>
              <Icon name="warning-outline" size={18} color={colors.orange} />
              <Text style={styles.infoTxt}>Signing out on this device means starting fresh — no recovery.</Text>
            </View>
          </View>

          <Button
            title="Sign out"
            variant="outline"
            icon="log-out-outline"
            onPress={async () => {
              const ok = await confirmAsync("Sign out?", "On a username-only account, signing out on this device means starting fresh.");
              if (ok) { await signOut(); router.replace("/(auth)/welcome"); }
            }}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatarSection: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.sm },
  avatarWrap: { position: "relative" },
  cameraChip: { position: "absolute", bottom: 2, right: 2, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceDark, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.bg },
  avatarName: { color: colors.ink, fontSize: 22, fontWeight: "900", marginTop: spacing.xs },
  avatarHandle: { color: colors.textDim, fontSize: 14, fontWeight: "700" },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md, ...shadow },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconTile: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.greenDark, alignItems: "center", justifyContent: "center" },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 52,
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
  },
  hint: { color: colors.textFaint, fontSize: 12, fontWeight: "600" },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  infoTxt: { flex: 1, color: colors.textDim, fontSize: 13, fontWeight: "600", lineHeight: 18 },
});
