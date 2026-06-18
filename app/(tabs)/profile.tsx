import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Avatar, Button, Card } from "../../components/ui";
import { LogoInline } from "../../components/Brand";
import { notify, confirmAsync } from "../../lib/notify";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { colors, spacing } from "../../lib/theme";

export default function Profile() {
  const { profile, session, signOut, refreshProfile } = useAuth();
  const [stats, setStats] = useState({ predictions: 0, exact: 0, leagues: 0 });

  useEffect(() => {
    (async () => {
      const uid = session?.user?.id;
      if (!uid) return;
      const [{ count: predictions }, { count: exact }, { count: leagues }] = await Promise.all([
        supabase.from("predictions").select("id", { count: "exact", head: true }),
        supabase.from("predictions").select("id", { count: "exact", head: true }).eq("points_awarded", 3),
        supabase.from("league_members").select("league_id", { count: "exact", head: true }),
      ]);
      setStats({ predictions: predictions ?? 0, exact: exact ?? 0, leagues: leagues ?? 0 });
      refreshProfile();
    })();
  }, [session?.user?.id]);

  const stat = (label: string, value: number | string, color = colors.text) => (
    <View style={styles.stat}>
      <Text style={[styles.statVal, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 110 }}>
      <View style={styles.header}>
        <Avatar name={profile?.display_name || profile?.username} size={84} />
        <Text style={styles.name}>{profile?.display_name || profile?.username || "Player"}</Text>
        <Text style={styles.handle}>@{profile?.username}</Text>
      </View>

      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        <Card>
          <Text style={styles.cardTitle}>🏅 Your season</Text>
          <View style={styles.statsRow}>
            {stat("Total points", profile?.total_points ?? 0, colors.gold)}
            {stat("Predictions", stats.predictions)}
            {stat("Exact scores", stats.exact, colors.live)}
            {stat("Leagues", stats.leagues, colors.bleu)}
          </View>
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Scoring rules</Text>
          <Text style={styles.rule}>🎯 Exact score predicted — <Text style={{ color: colors.gold, fontWeight: "900" }}>3 pts</Text></Text>
          <Text style={styles.rule}>✅ Correct result (W/D/L) — <Text style={{ color: colors.live, fontWeight: "900" }}>1 pt</Text></Text>
          <Text style={styles.rule}>❌ Wrong — <Text style={{ color: colors.textFaint, fontWeight: "900" }}>0 pts</Text></Text>
        </Card>

        <View style={{ alignItems: "center", gap: 8, marginTop: spacing.md }}>
          <LogoInline size={18} />
          <Text style={styles.email}>{session?.user?.email}</Text>
        </View>

        <Button title="Sign Out" variant="outline" onPress={async () => {
          const ok = await confirmAsync("Sign out?", "");
          if (ok) signOut();
        }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    paddingTop: 70,
    paddingBottom: spacing.xl,
    gap: 6,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  name: { color: colors.text, fontSize: 22, fontWeight: "900", marginTop: spacing.md },
  handle: { color: colors.textDim, fontSize: 14 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginBottom: spacing.md },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.lg },
  stat: { minWidth: "40%", flex: 1 },
  statVal: { fontSize: 26, fontWeight: "900" },
  statLabel: { color: colors.textDim, fontSize: 12, fontWeight: "600" },
  rule: { color: colors.text, fontSize: 14, marginVertical: 3 },
  email: { color: colors.textFaint, fontSize: 12 },
});
