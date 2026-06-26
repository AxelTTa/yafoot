import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, font, radius, spacing } from "../lib/theme";

const SUPPORT_EMAIL = "support@yafoot.app";

export default function Support() {
  if (Platform.OS !== "web") return null;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>YaFoot Support</Text>
        <Text style={styles.subtitle}>Help for private football prediction competitions with friends</Text>
        <Text style={styles.date}>Last updated: June 2026</Text>

        <Section title="Contact">
          <Paragraph>Email: {SUPPORT_EMAIL}</Paragraph>
          <Paragraph>We usually reply within 2 business days. Include your YaFoot username so we can find your account.</Paragraph>
        </Section>

        <Section title="Using YaFoot">
          <Bullet>Create a private competition, then add your own matches with two sides and a start time.</Bullet>
          <Bullet>Invite friends through your friend link or a competition invite code.</Bullet>
          <Bullet>Pick exact scores inside the competition before each match starts.</Bullet>
          <Bullet>Compare open predictions, previous picks, chat, and leaderboard results with invited members.</Bullet>
        </Section>

        <Section title="Account And Data">
          <Paragraph>YaFoot uses username-only anonymous accounts. No email or phone number is required to play.</Paragraph>
          <Paragraph>
            To delete your account in the app, open Profile, go to settings, and use Delete my account. If you cannot access
            the app, email {SUPPORT_EMAIL} with your username and request deletion.
          </Paragraph>
        </Section>

        <Section title="Privacy">
          <Paragraph>Privacy policy: https://dist-five-zeta-92i4a6g3xx.vercel.app/privacy</Paragraph>
          <Paragraph>Support URL: https://dist-five-zeta-92i4a6g3xx.vercel.app/support</Paragraph>
        </Section>
      </View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>{"•"}</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#f5f5f0" },
  container: { padding: spacing.lg, paddingBottom: 60, maxWidth: 760, alignSelf: "center" as const, width: "100%" },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl },
  title: { ...font.h1, marginBottom: spacing.xs },
  subtitle: { ...font.body, color: colors.textDim, marginBottom: spacing.xs },
  date: { ...font.dim, marginBottom: spacing.xl },
  section: { marginBottom: spacing.xl },
  sectionTitle: { ...font.h3, marginBottom: spacing.sm, color: colors.ink },
  paragraph: { ...font.body, color: colors.textDim, lineHeight: 24, marginBottom: spacing.sm },
  bulletRow: { flexDirection: "row", marginBottom: spacing.xs, paddingLeft: spacing.sm },
  bulletDot: { ...font.body, color: colors.green, marginRight: spacing.sm, lineHeight: 24 },
  bulletText: { ...font.body, color: colors.textDim, lineHeight: 24, flex: 1 },
});
