import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, Icon, Loading, Screen } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { joinLeague } from "../../lib/api";
import { notify } from "../../lib/notify";
import { colors, radius, spacing } from "../../lib/theme";

export default function JoinLeague() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [joining, setJoining] = useState(false);
  const [done, setDone] = useState(false);

  async function doJoin() {
    if (!code) return;
    setJoining(true);
    try {
      const lid = await joinLeague(code.toUpperCase());
      setDone(true);
      setTimeout(() => router.replace(`/league/${lid}`), 800);
    } catch (e: any) {
      notify("Could not join", e.message);
      setJoining(false);
    }
  }

  if (!session) {
    return (
      <Screen>
        <View style={styles.center}>
          <Icon name="lock-closed" size={48} color={colors.purple} />
          <Text style={styles.h}>Sign in first</Text>
          <Text style={styles.sub}>You need an account to join a league.</Text>
          <Button title="Go to app" onPress={() => router.replace("/(auth)/welcome")} style={{ marginTop: spacing.lg }} />
        </View>
      </Screen>
    );
  }

  if (done) return <Loading />;

  return (
    <Screen>
      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <Icon name="trophy" size={40} color={colors.yellow} />
        </View>
        <Text style={styles.h}>Join league</Text>
        <Text style={styles.code}>{code?.toUpperCase()}</Text>
        <Text style={styles.sub}>Tap below to join this league and start competing!</Text>
        <Button title="Join League" variant="green" icon="enter-outline" onPress={doJoin} loading={joining} style={{ marginTop: spacing.lg, width: "100%" }} />
        <Button title="Cancel" variant="ghost" onPress={() => router.replace("/(tabs)/leagues")} style={{ marginTop: spacing.sm }} />
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
