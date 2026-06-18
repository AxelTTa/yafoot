import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar, Icon, ScreenHeader, ScrollView } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { fetchMyForecasts } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { prettyTeam } from "../../lib/teams";
import { colors, radius, shadow, spacing } from "../../lib/theme";

export default function Profile() {
  const router = useRouter();
  const { profile, session, refreshProfile } = useAuth();
  const { t } = useI18n();
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

  const StatTile = ({ label, value, color }: { label: string; value: number | string; color: string }) => (
    <View style={styles.stat}>
      <Text style={[styles.statVal, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 130 }}>
      <ScreenHeader
        title={t("tab_profile")}
        subtitle={t("profile_sub")}
        right={
          <Pressable onPress={() => router.push("/settings")} style={styles.gear} hitSlop={8}>
            <Icon name="settings-sharp" size={20} color={colors.ink} />
          </Pressable>
        }
      />

      <View style={{ alignItems: "center", gap: 6, paddingBottom: spacing.lg }}>
        <Avatar name={profile?.display_name || profile?.username} url={profile?.avatar_url} size={104} ring color={colors.purple} />
        <Text style={styles.name}>{profile?.display_name || profile?.username || "Player"}</Text>
        <Text style={styles.handle}>@{profile?.username}</Text>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}><Icon name="trophy" size={26} color={colors.yellow} /></View>
          <View>
            <Text style={styles.heroLabel}>{t("total_points")}</Text>
            <Text style={styles.heroPoints}>{profile?.total_points ?? 0}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatTile label={t("stat_pred")} value={stats.predictions} color={colors.greenDark} />
          <StatTile label={t("stat_exact")} value={stats.exact} color={colors.orange} />
          <StatTile label={t("stat_acc")} value={`${accuracy}%`} color={colors.purple} />
          <StatTile label={t("stat_leagues")} value={stats.leagues} color={colors.cyan} />
        </View>

        <Text style={styles.section}>{t("my_forecasts")}</Text>
        {forecasts.length === 0 ? (
          <View style={styles.emptyFc}>
            <Icon name="create-outline" size={20} color={colors.textDim} />
            <Text style={styles.emptyTxt}>{t("no_forecasts")}</Text>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {forecasts.slice(0, 15).map((f, i) => {
              const m = f.matches;
              if (!m) return null;
              return (
                <View key={i} style={styles.fc}>
                  <Text style={styles.fcTeams} numberOfLines={1}>
                    {m.home_flag} {prettyTeam(m.home_team)} v {prettyTeam(m.away_team)} {m.away_flag}
                  </Text>
                  <View style={styles.fcRight}>
                    <Text style={styles.fcPick}>{f.pred_home}-{f.pred_away}</Text>
                    {f.scored ? (
                      <View style={[styles.fcBadge, { backgroundColor: f.points_awarded >= 3 ? colors.green : f.points_awarded > 0 ? colors.yellow : colors.surfaceAlt }]}>
                        <Text style={[styles.fcBadgeTxt, { color: f.points_awarded > 0 ? colors.blanc : colors.textFaint }]}>+{f.points_awarded}</Text>
                      </View>
                    ) : (
                      <Text style={styles.fcPending}>•••</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  gear: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", ...shadow },
  name: { color: colors.ink, fontSize: 24, fontWeight: "900", marginTop: spacing.sm },
  handle: { color: colors.textDim, fontSize: 14, fontWeight: "700" },
  hero: { flexDirection: "row", alignItems: "center", gap: spacing.lg, backgroundColor: colors.purple, borderRadius: radius.xl, padding: spacing.xl, ...shadow },
  heroIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  heroLabel: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  heroPoints: { color: colors.blanc, fontSize: 44, fontWeight: "900", letterSpacing: -1, marginTop: -2 },
  statsRow: { flexDirection: "row", gap: spacing.sm },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, alignItems: "center", ...shadow },
  statVal: { fontSize: 22, fontWeight: "900" },
  statLabel: { color: colors.textDim, fontSize: 10, fontWeight: "800", marginTop: 2 },
  section: { color: colors.textDim, fontSize: 12, fontWeight: "900", letterSpacing: 1, marginTop: spacing.sm },
  emptyFc: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  emptyTxt: { color: colors.textDim, fontSize: 13, fontWeight: "600", flex: 1 },
  fc: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, ...shadow },
  fcTeams: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: "800", marginRight: spacing.md },
  fcRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  fcPick: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  fcBadge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, minWidth: 28, alignItems: "center" },
  fcBadgeTxt: { fontSize: 12, fontWeight: "900" },
  fcPending: { color: colors.textFaint, fontSize: 14, fontWeight: "900" },
});
