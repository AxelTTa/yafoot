import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, Icon, Screen } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { joinLeague } from "../../lib/api";
import { notify } from "../../lib/notify";
import { colors, spacing } from "../../lib/theme";

export default function JoinLeague() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { t } = useI18n();
  const [joining, setJoining] = useState(false);

  async function doJoin() {
    if (!code) return;
    setJoining(true);
    try {
      const lid = await joinLeague(code.toUpperCase());
      router.replace(`/league/${lid}`);
    } catch (e: any) {
      notify(t("error_join") ?? "Could not join", e.message);
      setJoining(false);
    }
  }

  if (!session) {
    return (
      <Screen>
        <View style={styles.center}>
          <Icon name="lock-closed" size={48} color={colors.purple} />
          <Text style={styles.h}>{t("join_signin_title")}</Text>
          <Text style={styles.sub}>{t("join_signin_sub")}</Text>
          <Button title={t("join_go_to_app")} onPress={() => router.replace("/(auth)/welcome")} style={{ marginTop: spacing.lg }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <Icon name="trophy" size={40} color={colors.yellow} />
        </View>
        <Text style={styles.h}>{t("join_title")}</Text>
        <Text style={styles.code}>{code?.toUpperCase()}</Text>
        <Text style={styles.sub}>{t("join_sub")}</Text>
        <Button title={t("btn_join_league")} variant="green" icon="enter-outline" onPress={doJoin} loading={joining} style={{ marginTop: spacing.lg, width: "100%" }} />
        <Button title={t("btn_close")} variant="ghost" onPress={() => router.replace("/(tabs)/leagues")} style={{ marginTop: spacing.sm }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  iconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surfaceDark, alignItems: "center", justifyContent: "center" },
  h: { color: colors.ink, fontSize: 26, fontWeight: "900" },
  code: { color: colors.greenDark, fontSize: 32, fontWeight: "900", letterSpacing: 4 },
  sub: { color: colors.textDim, fontSize: 14, fontWeight: "600", textAlign: "center" },
});
