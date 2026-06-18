import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar, Card, Icon, ScreenHeader, ScrollView, Tricolor } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { fetchMyForecasts } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { prettyTeam } from "../../lib/teams";
import { colors, radius, spacing } from "../../lib/theme";

export default function Profile() {
  const router = useRouter();
  const { profile, session, refreshProfile } = useAuth();
  const [stats, setStats] = useState({ predictions: 0, exact: 0, leagues: 0, correct: 0 });
  const [forecasts, setForecasts] = useState<any[]>([]);

  const load = useCallback(async () => {
    const uid = session?.user?.id;
    if (!uid) return;
    const [{ count: predictions }, { count: exact }, { count: correct }, { count: leagues }, fc] = await Promise.all([
      supabase.from("predictions").select("id", { count: "exact", head: true }),
      supabase.from("predictions").select("id", { count: "exact", head: true }).eq("points_awarded", 3),
      supabase.from("predictions").select("id", { count: "exact", head: true }).gt("points_awarded", 0),
      supabase.from("league_members").select("league_id", { count: "exact", head: true }),
      fetchMyForecasts().catch(() => []),
    ]);
    setStats({ predictions: predictions ?? 0, exact: exact ?? 0, correct: correct ?? 0, leagues: leagues ?? 0 });
    setForecasts(fc);
    refreshProfile();
  }, [session?.user?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const scored = forecasts.filter((f) => f.scored);
  const accuracy = scored.length ? Math.round((stats.correct / scored.length) * 100) : 0;

  const Stat = ({ label, value, color = colors.text }: { label: string; value: number | string; color?: string }) => (
    <View style={styles.stat}>
      <Text style={[styles.statVal, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 110 }}>
      <ScreenHeader
        title="Profile"
        right={
          <Pressable onPress={() => router.push("/settings")} style={styles.gear} hitSlop={8}>
            <Icon name="settings-outline" size={20} color={colors.ink} />
          </Pressable>
        }
      />

      <View style={{ alignItems: "center", gap: 6, paddingBottom: spacing.lg }}>
        <Avatar name={profile?.display_name || profile?.username} url={profile?.avatar_url} size={96} ring />
        <Text style={styles.name}>{profile?.display_name || profile?.username || "Player"}</Text>
        <Text style={styles.handle}>@{profile?.username}</Text>
        <Tricolor width={56} />
      </View>

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
        <Card variant="hero">
          <Text style={styles.heroLabel}>TOTAL POINTS</Text>
          <Text style={styles.heroPoints}>{profile?.total_points ?? 0}</Text>
          <Text style={styles.heroSub}>Exact score = 3 pts · Correct result = 1 pt</Text>
        </Card>

        <View style={styles.statsRow}>
          <Stat label="Predictions" value={stats.predictions} />
          <Stat label="Exact" value={stats.exact} color={colors.gold} />
          <Stat label="Accuracy" value={`${accuracy}%`} color={colors.live} />
          <Stat label="Leagues" value={stats.leagues} color={colors.bleu} />
        </View>

        <View>
          <Text style={styles.section}>MY FORECASTS</Text>
          {forecasts.length === 0 ? (
            <Card variant="flat"><Text style={{ color: colors.textDim }}>No predictions yet. Head to Predict to make your first one.</Text></Card>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {forecasts.slice(0, 12).map((f, i) => {
                const m = f.matches;
                if (!m) return null;
                return (
                  <Card key={i} variant="flat" style={styles.fc}>
                    <Text style={styles.fcTeams} numberOfLines={1}>
                      {m.home_flag} {prettyTeam(m.home_team)} v {prettyTeam(m.away_team)} {m.away_flag}
                    </Text>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.fcPick}>{f.pred_home}-{f.pred_away}</Text>
                      {f.scored ? (
                        <Text style={[styles.fcPts, { color: f.points_awarded >= 3 ? colors.gold : f.points_awarded > 0 ? colors.live : colors.textFaint }]}>
                          +{f.points_awarded}
                        </Text>
                      ) : (
                        <Text style={styles.fcPending}>pending</Text>
                      )}
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  gear: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  name: { color: colors.text, fontSize: 24, fontWeight: "900", marginTop: spacing.sm },
  handle: { color: colors.textDim, fontSize: 14, fontWeight: "600" },
  heroLabel: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  heroPoints: { color: colors.blanc, fontSize: 52, fontWeight: "900", letterSpacing: -1 },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600" },
  statsRow: { flexDirection: "row", gap: spacing.sm },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, alignItems: "center" },
  statVal: { fontSize: 22, fontWeight: "900" },
  statLabel: { color: colors.textDim, fontSize: 11, fontWeight: "700", marginTop: 2 },
  section: { color: colors.textDim, fontSize: 12, fontWeight: "800", letterSpacing: 1, marginBottom: spacing.sm },
  fc: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.md },
  fcTeams: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "700", marginRight: spacing.md },
  fcPick: { color: colors.text, fontSize: 15, fontWeight: "900" },
  fcPts: { fontSize: 12, fontWeight: "900" },
  fcPending: { color: colors.bleu, fontSize: 11, fontWeight: "700" },
});
