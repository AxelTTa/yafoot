import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { Button, Card, Screen, Tricolor } from "../../components/ui";
import { Logo } from "../../components/Brand";
import { useAuth } from "../../lib/auth";
import { inviteLink } from "../../lib/invite";
import { notify } from "../../lib/notify";
import { colors, radius, spacing } from "../../lib/theme";

export default function OnboardingInvite() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const [copied, setCopied] = useState(false);

  useEffect(() => { refreshProfile(); }, []);

  const link = profile?.username ? inviteLink(profile.username) : "";

  async function copy() {
    if (!link) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(link).catch(() => {});
    }
    setCopied(true);
    notify("Link copied!", "Send it to your friends so they can add you on YaFoot.");
  }
  async function share() {
    if (!link) return;
    if (Platform.OS === "web") return copy();
    try { await Share.share({ message: `Add me on YaFoot ⚽ ${link}` }); } catch {}
  }

  return (
    <Screen>
      <View style={{ flex: 1, padding: spacing.xl, justifyContent: "center" }}>
        <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
          <Logo size={40} />
        </View>
        <Text style={styles.h}>You're in, @{profile?.username}! 🎉</Text>
        <Text style={styles.sub}>YaFoot is better with friends. Send them your link — when they open it, you're instantly connected.</Text>

        <Card variant="hero" style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <Text style={styles.cardLabel}>YOUR INVITE LINK</Text>
          <Text style={styles.link} numberOfLines={2}>{link}</Text>
          <Pressable onPress={copy} style={styles.copyBtn}>
            <Text style={styles.copyText}>{copied ? "✓ Copied" : "Copy link"}</Text>
          </Pressable>
        </Card>

        <Button title="Share with friends" variant="light" onPress={share} style={{ marginTop: spacing.lg }} />
        <Button title="Continue to app" variant="ghost" onPress={() => router.replace("/(tabs)")} style={{ marginTop: spacing.xs }} />
        <View style={{ alignItems: "center", marginTop: spacing.lg }}><Tricolor width={70} /></View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h: { color: colors.text, fontSize: 26, fontWeight: "900", textAlign: "center", letterSpacing: -0.4 },
  sub: { color: colors.textDim, fontSize: 15, textAlign: "center", marginTop: spacing.sm, lineHeight: 21 },
  cardLabel: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  link: { color: colors.blanc, fontSize: 15, fontWeight: "700" },
  copyBtn: { backgroundColor: "rgba(255,255,255,0.18)", borderRadius: radius.md, height: 46, alignItems: "center", justifyContent: "center" },
  copyText: { color: colors.blanc, fontWeight: "800", fontSize: 15 },
});
