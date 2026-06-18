import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Avatar, Button, Header, Icon, Screen, ScrollView } from "../components/ui";
import { useAuth } from "../lib/auth";
import { useI18n, Lang } from "../lib/i18n";
import { updateProfile } from "../lib/api";
import { pickAndUploadAvatar } from "../lib/avatar";
import { confirmAsync, notify } from "../lib/notify";
import { colors, radius, shadow, spacing } from "../lib/theme";

export default function Settings() {
  const router = useRouter();
  const { profile, session, refreshProfile, signOut } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [name, setName] = useState(profile?.display_name ?? profile?.username ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function save() {
    if (name.trim().length < 2) return notify(t("err_name_short"));
    setSaving(true);
    try {
      await updateProfile({ display_name: name.trim() });
      await refreshProfile();
      notify(t("saved"), t("saved_sub"));
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
        notify(t("change_photo"));
      } catch (e: any) {
        notify("Could not save photo", e.message);
      }
    }
    setUploading(false);
  }

  const langs: { key: Lang; label: string; flag: string }[] = [
    { key: "en", label: "English", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
    { key: "fr", label: "Français", flag: "🇫🇷" },
  ];

  return (
    <Screen>
      <Header title={t("settings_sub")} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

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

          {/* display name */}
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.iconTile}><Icon name="person" size={18} color={colors.blanc} /></View>
              <Text style={styles.sectionTitle}>{t("sec_name")}</Text>
            </View>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t("name_ph")}
              placeholderTextColor={colors.textFaint}
              maxLength={24}
              returnKeyType="done"
              onSubmitEditing={save}
            />
            <Text style={styles.hint}>{t("username_locked", { u: profile?.username ?? "" })}</Text>
            <Button title={t("btn_save")} onPress={save} loading={saving} />
          </View>

          {/* language */}
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={[styles.iconTile, { backgroundColor: colors.cyan }]}><Icon name="language" size={18} color={colors.blanc} /></View>
              <Text style={styles.sectionTitle}>{t("sec_lang")}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {langs.map((l) => (
                <Pressable
                  key={l.key}
                  onPress={() => setLang(l.key)}
                  style={({ pressed }) => [styles.langBtn, lang === l.key && styles.langBtnActive, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.langFlag}>{l.flag}</Text>
                  <Text style={[styles.langLabel, lang === l.key && { color: colors.greenDark, fontWeight: "900" }]}>{l.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* account */}
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={[styles.iconTile, { backgroundColor: colors.orange }]}><Icon name="shield" size={18} color={colors.blanc} /></View>
              <Text style={styles.sectionTitle}>{t("sec_account")}</Text>
            </View>
            <View style={styles.infoRow}>
              <Icon name="person-circle-outline" size={18} color={colors.textDim} />
              <Text style={styles.infoTxt}>{t("account_type")}</Text>
            </View>
            <View style={styles.infoRow}>
              <Icon name="warning-outline" size={18} color={colors.orange} />
              <Text style={styles.infoTxt}>{t("account_warn")}</Text>
            </View>
          </View>

          <Button
            title={t("btn_signout")}
            variant="outline"
            icon="log-out-outline"
            onPress={async () => {
              const ok = await confirmAsync(t("signout_title"), t("signout_msg"));
              if (ok) { await signOut(); router.replace("/(auth)/welcome"); }
            }}
          />
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
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
  input: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 52, color: colors.ink, fontSize: 16, fontWeight: "700" },
  hint: { color: colors.textFaint, fontSize: 12, fontWeight: "600" },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  infoTxt: { flex: 1, color: colors.textDim, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  langBtn: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1.5, borderColor: "transparent" },
  langBtnActive: { borderColor: colors.greenDark, backgroundColor: colors.bleuSoft },
  langFlag: { fontSize: 20 },
  langLabel: { color: colors.textDim, fontSize: 14, fontWeight: "700" },
});
