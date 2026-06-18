import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
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
    try { await Share.share({ message: `Add me on YaFoot ⚽ ${link}` }); } catch {}
  }

  // playful overlapping friend bubbles
  const bubbleColors = [colors.green, colors.purple, colors.orange, colors.cyan];

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.bubbles}>
          {bubbleColors.map((c, i) => (
            <View key={i} style={[styles.bubble, { backgroundColor: c, marginLeft: i === 0 ? 0 : -16, zIndex: 4 - i }]}>
              <Icon name={i === 1 ? "person" : i === 2 ? "happy" : "football"} size={22} color={colors.blanc} />
            </View>
          ))}
          <View style={[styles.bubble, { backgroundColor: colors.surfaceDark, marginLeft: -16 }]}>
            <Icon name="add" size={22} color={colors.blanc} />
          </View>
        </View>

        <Text style={styles.h}>You're in, @{profile?.username}!</Text>
        <Text style={styles.sub}>YaFoot is way better with friends. Share your link — when they tap it, you're instantly connected.</Text>

        <View style={styles.linkCard}>
          <Text style={styles.linkLabel}>YOUR INVITE LINK</Text>
          <View style={styles.linkPill}>
            <Icon name="link" size={16} color={colors.purple} />
            <Text style={styles.linkText} numberOfLines={1}>{link.replace(/^https?:\/\//, "")}</Text>
          </View>
          <Pressable onPress={copy} style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.9 }]}>
            <Icon name={copied ? "checkmark" : "copy"} size={18} color={colors.blanc} />
            <Text style={styles.copyText}>{copied ? "Copied!" : "Copy link"}</Text>
          </Pressable>
        </View>

        <Pressable onPress={share} style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.9 }]}>
          <Icon name="share-social" size={18} color={colors.ink} />
          <Text style={styles.shareText}>Share with friends</Text>
        </Pressable>

        <Pressable onPress={() => router.replace("/(tabs)")} style={styles.skip} hitSlop={8}>
          <Text style={styles.skipText}>Continue to app  ›</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, justifyContent: "center", gap: spacing.md },
  bubbles: { flexDirection: "row", justifyContent: "center", marginBottom: spacing.sm },
  bubble: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.bg, ...shadow },
  h: { color: colors.ink, fontSize: 28, fontWeight: "900", textAlign: "center", letterSpacing: -0.5 },
  sub: { color: colors.ink, opacity: 0.65, fontSize: 15, textAlign: "center", lineHeight: 21, fontWeight: "600", marginBottom: spacing.sm },
  linkCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md, ...shadow },
  linkLabel: { color: colors.textDim, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  linkPill: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 46 },
  linkText: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: "700" },
  copyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.greenDark, borderRadius: radius.pill, height: 52 },
  copyText: { color: colors.blanc, fontWeight: "900", fontSize: 16 },
  shareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.yellow, borderRadius: radius.pill, height: 52, ...shadow },
  shareText: { color: colors.ink, fontWeight: "900", fontSize: 16 },
  skip: { alignItems: "center", paddingVertical: spacing.md },
  skipText: { color: colors.ink, opacity: 0.7, fontWeight: "800", fontSize: 15 },
});
