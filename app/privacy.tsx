import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, font, radius, spacing } from "../lib/theme";

export default function PrivacyPolicy() {
  if (Platform.OS !== "web") return null;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.subtitle}>YaFoot — World Cup 2026 Predictions</Text>
        <Text style={styles.date}>Last updated: June 2026</Text>

        <Section title="1. What We Collect">
          <Paragraph>
            YaFoot collects only what is strictly necessary to run the app:
          </Paragraph>
          <Bullet>A username you choose (no real name, email, or phone number required)</Bullet>
          <Bullet>Your match predictions and league activity</Bullet>
          <Bullet>An optional profile photo you upload</Bullet>
          <Bullet>Anonymous device authentication tokens (no personal identifiers)</Bullet>
        </Section>

        <Section title="2. How We Use It">
          <Paragraph>
            Your data is used solely to operate the YaFoot prediction game:
          </Paragraph>
          <Bullet>Display your username and predictions to league members you invite</Bullet>
          <Bullet>Calculate scores and leaderboard rankings</Bullet>
          <Bullet>Enable real-time league chat and direct messages with friends you add</Bullet>
        </Section>

        <Section title="3. Data Storage">
          <Paragraph>
            All data is stored on Supabase (US-East region), a Postgres-based cloud platform with
            row-level security. Your data is not stored on our servers beyond what Supabase holds.
            Supabase is SOC 2 compliant and encrypts data in transit (TLS) and at rest.
          </Paragraph>
        </Section>

        <Section title="4. Anonymous Authentication">
          <Paragraph>
            YaFoot uses anonymous sign-in. No email, phone number, or real identity is linked to
            your account. Your account is tied to your device. If you uninstall the app, your
            account cannot be recovered (no external identity is linked).
          </Paragraph>
        </Section>

        <Section title="5. Data Sharing">
          <Paragraph>
            We do not sell, rent, or share your data with third parties. No advertising networks,
            analytics providers, or data brokers receive your information.
          </Paragraph>
          <Paragraph>
            Your username and prediction activity are visible to other members of leagues you join
            or create. Direct messages are visible only to you and the recipient.
          </Paragraph>
        </Section>

        <Section title="6. Profile Photos">
          <Paragraph>
            If you upload a profile photo, it is stored in Supabase Storage (US region) and is
            visible to other YaFoot users. You can change or remove your photo at any time from
            the Profile screen.
          </Paragraph>
        </Section>

        <Section title="7. Your Rights">
          <Paragraph>
            You can delete your account and all associated data by contacting us. Since accounts
            are anonymous, we will need your username to locate your data.
          </Paragraph>
          <Paragraph>
            To request data deletion, contact us at the support URL below.
          </Paragraph>
        </Section>

        <Section title="8. Children">
          <Paragraph>
            YaFoot is rated 4+ and does not knowingly collect data from children under 13 beyond
            what is described above. There is no mechanism to verify age at sign-up.
          </Paragraph>
        </Section>

        <Section title="9. Changes to This Policy">
          <Paragraph>
            If we materially change this policy, we will update the date at the top of this page.
            Continued use of the app after changes constitutes acceptance.
          </Paragraph>
        </Section>

        <Section title="10. Contact">
          <Paragraph>
            Questions about this policy? Reach us at:{"\n"}
            https://dist-five-zeta-92i4a6g3xx.vercel.app
          </Paragraph>
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
  scroll: {
    flex: 1,
    backgroundColor: "#f5f5f0",
  },
  container: {
    padding: spacing.lg,
    paddingBottom: 60,
    maxWidth: 760,
    alignSelf: "center" as const,
    width: "100%",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  title: {
    ...font.h1,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...font.body,
    color: colors.textDim,
    marginBottom: spacing.xs,
  },
  date: {
    ...font.dim,
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...font.h3,
    marginBottom: spacing.sm,
    color: colors.ink,
  },
  paragraph: {
    ...font.body,
    color: colors.textDim,
    lineHeight: 24,
    marginBottom: spacing.sm,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: spacing.xs,
    paddingLeft: spacing.sm,
  },
  bulletDot: {
    ...font.body,
    color: colors.green,
    marginRight: spacing.sm,
    lineHeight: 24,
  },
  bulletText: {
    ...font.body,
    color: colors.textDim,
    lineHeight: 24,
    flex: 1,
  },
});
