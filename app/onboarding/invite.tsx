import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { Icon, Screen } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { inviteLink } from "../../lib/invite";
import { notify } from "../../lib/notify";
import { colors, radius, shadow, spacing } from "../../lib/theme";

export default function OnboardingInvite() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const [copied, setCopied] = useState(false);

  useEffect(() => { refreshProfile(); }, []);
  const link = profile?.username ? inviteLink(profile.username) : "";

  async function copy() {
    if (!link) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) await navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    notify("Link copied!", "Send it to friends so they can add you on YaFoot.");
  }
  async function share() {
    if (!link) return;
    if (Platform.OS === "web") return copy();
    try { await Share.share({ message: `Add me on YaFoot! ${link}` }); } catch {}
  }

  const bubbleColors = [colors.green, colors.purple, colors.orange, colors.cyan];

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.bubbles}>
          {bubbleColors.map((c, i) => (
            <View key={i} style={[styles.bubble, { backgroundColor: c, marginLeft: i === 0 ? 0 : -14, zIndex: 4 - i }]}>
              <Icon name={i === 1 ? "person" : i === 2 ? "happy" : "football"} size={20} color={colors.blanc} />
            </View>
          ))}
          <View style={[styles.bubble, { backgroundColor: colors.surfaceDark, marginLeft: -14 }]}>
            <Icon name="add" size={20} color={colors.blanc} />
          </View>
        </View>

        <Text style={styles.h}>You're in, @{profile?.username}!</Text>
        <Text style={styles.sub}>YaFoot is better with friends. Share your link — when they tap it, you're instantly connected.</Text>

        <View style={styles.linkCard}>
          <Text style={styles.linkLabel}>YOUR INVITE LINK</Text>
          <View style={styles.linkPill}>
            <Icon name="link" size={15} color={colors.purple} />
            <Text style={styles.linkText} numberOfLines={1}>{link.replace(/^https?:\/\//, "")}</Text>
          </View>
          <View style={styles.btnRow}>
            <Pressable onPress={copy} style={({ pressed }) => [styles.actionBtn, { flex: 1, backgroundColor: colors.greenDark }, pressed && { opacity: 0.88 }]}>
              <Icon name={copied ? "checkmark" : "copy"} size={16} color={colors.blanc} />
              <Text style={styles.actionTxt}>{copied ? "Copied!" : "Copy"}</Text>
            </Pressable>
            <Pressable onPress={share} style={({ pressed }) => [styles.actionBtn, { flex: 1, backgroundColor: colors.yellow }, pressed && { opacity: 0.88 }]}>
              <Icon name="share-social" size={16} color={colors.ink} />
              <Text style={[styles.actionTxt, { color: colors.ink }]}>Share</Text>
            </Pressable>
          </View>
        </View>

        <Pressable onPress={() => router.replace("/(tabs)")} style={({ pressed }) => [styles.skip, pressed && { opacity: 0.7 }]}>
          <Text style={styles.skipText}>Continue to app</Text>
          <Icon name="arrow-forward" size={16} color={colors.ink} />
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.xl, justifyContent: "center", gap: spacing.md },
  bubbles: { flexDirection: "row", justifyContent: "center", marginBottom: spacing.xs },
  bubble: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.bg, ...shadow },
  h: { color: colors.ink, fontSize: 26, fontWeight: "900", textAlign: "center", letterSpacing: -0.5 },
  sub: { color: colors.ink, opacity: 0.65, fontSize: 14, textAlign: "center", lineHeight: 20, fontWeight: "600" },
  linkCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md, ...shadow },
  linkLabel: { color: colors.textDim, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  linkPill: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 42 },
  linkText: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: "700" },
  btnRow: { flexDirection: "row", gap: spacing.sm },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: radius.pill, height: 44 },
  actionTxt: { color: colors.blanc, fontWeight: "900", fontSize: 15 },
  skip: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: spacing.md },
  skipText: { color: colors.ink, opacity: 0.7, fontWeight: "800", fontSize: 15 },
});
