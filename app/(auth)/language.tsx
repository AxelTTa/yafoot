import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Logo } from "../../components/Brand";
import { Screen } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { colors, radius, shadow, spacing } from "../../lib/theme";

export default function LanguageScreen() {
  const router = useRouter();
  const { setLang } = useI18n();

  async function pick(l: "en" | "fr") {
    await setLang(l);
    router.replace("/(auth)/welcome");
  }

  return (
    <Screen>
      <View style={styles.container}>
        <Logo size={52} />
        <Text style={styles.title}>YaFoot</Text>
        <Text style={styles.sub}>Pick your language / Choisis ta langue</Text>

        <View style={styles.cards}>
          <Pressable onPress={() => pick("en")} style={({ pressed }) => [styles.card, pressed && { opacity: 0.88 }]}>
            <Text style={styles.flag}>🏴󠁧󠁢󠁥󠁮󠁧󠁿</Text>
            <Text style={styles.cardLabel}>English</Text>
            <Text style={styles.cardSub}>Casual & fun</Text>
          </Pressable>

          <Pressable onPress={() => pick("fr")} style={({ pressed }) => [styles.card, pressed && { opacity: 0.88 }]}>
            <Text style={styles.flag}>🇫🇷</Text>
            <Text style={styles.cardLabel}>Français</Text>
            <Text style={styles.cardSub}>Décontracté & goofy</Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>You can change this later in Settings</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.lg },
  title: { color: colors.ink, fontSize: 36, fontWeight: "900", letterSpacing: -1, marginTop: -spacing.sm },
  sub: { color: colors.textDim, fontSize: 15, fontWeight: "700", textAlign: "center" },
  cards: { flexDirection: "row", gap: spacing.md, width: "100%" },
  card: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl,
    alignItems: "center", gap: spacing.sm, ...shadow,
  },
  flag: { fontSize: 40 },
  cardLabel: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  cardSub: { color: colors.textDim, fontSize: 12, fontWeight: "700", textAlign: "center" },
  hint: { color: colors.textFaint, fontSize: 12, fontWeight: "700" },
});
