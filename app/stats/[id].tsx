import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Card, Empty, Header, Loading, Screen, ScrollView } from "../../components/ui";
import { fetchMatch } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { prettyTeam, teamFlag } from "../../lib/teams";
import { Match } from "../../lib/types";
import { colors, radius, spacing } from "../../lib/theme";

export default function MatchStats() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [s, setS] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [m, st] = await Promise.all([
        fetchMatch(Number(id)),
        supabase.rpc("match_stats", { p_match_id: Number(id) }).then((r) => r.data),
      ]);
      setMatch(m); setS(st); setLoading(false);
    })();
  }, [id]);

  if (loading) return <Screen><Header title="Match Stats" /><Loading /></Screen>;
  if (!match) return <Screen><Header title="Match Stats" /><Empty title="Match not found" /></Screen>;

  const total = s?.total ?? 0;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const hw = pct(s?.home_win ?? 0), dr = pct(s?.draw ?? 0), aw = pct(s?.away_win ?? 0);

  return (
    <Screen>
      <Header title="Match Stats" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 60 }}>
        <Card style={{ alignItems: "center", gap: 6 }}>
          <Text style={styles.fixture}>
            {teamFlag(match.home_team, match.home_flag)} {prettyTeam(match.home_team)}  v  {prettyTeam(match.away_team)} {teamFlag(match.away_team, match.away_flag)}
          </Text>
          <Text style={styles.group}>{match.group_name ?? match.stage?.replace(/_/g, " ")}</Text>
        </Card>

        {total === 0 ? (
          <Empty icon="📊" title="No forecasts yet" sub="Be the first to predict this match — community stats appear here." />
        ) : (
          <>
            <Card style={{ gap: spacing.md }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={styles.cardTitle}>Community forecast</Text>
                <Text style={styles.total}>{total} predictions</Text>
              </View>
              {/* probability bar */}
              <View style={styles.bar}>
                <View style={{ width: `${hw}%`, backgroundColor: colors.bleu }} />
                <View style={{ width: `${dr}%`, backgroundColor: colors.gold }} />
                <View style={{ width: `${aw}%`, backgroundColor: colors.rouge }} />
              </View>
              <View style={styles.legendRow}>
                <Legend color={colors.bleu} label={`${prettyTeam(match.home_team)} win`} val={hw} />
                <Legend color={colors.gold} label="Draw" val={dr} />
                <Legend color={colors.rouge} label={`${prettyTeam(match.away_team)} win`} val={aw} />
              </View>
            </Card>

            <Card style={{ gap: spacing.md }}>
              <Text style={styles.cardTitle}>Predicted scoreline</Text>
              <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.lg }}>
                <Score flag={teamFlag(match.home_team, match.home_flag)} val={s.avg_home} />
                <Text style={styles.dash}>:</Text>
                <Score flag={teamFlag(match.away_team, match.away_flag)} val={s.avg_away} />
              </View>
              <Text style={styles.avgNote}>Average predicted score across all forecasts</Text>
            </Card>

            <Card style={{ gap: spacing.sm }}>
              <Text style={styles.cardTitle}>Most popular scores</Text>
              {(s.popular ?? []).map((p: any, i: number) => {
                const w = total ? Math.round((p.n / total) * 100) : 0;
                return (
                  <View key={i} style={styles.popRow}>
                    <Text style={styles.popScore}>{p.score}</Text>
                    <View style={styles.popBarBg}>
                      <View style={[styles.popBarFill, { width: `${Math.max(w, 4)}%` }]} />
                    </View>
                    <Text style={styles.popPct}>{w}%</Text>
                  </View>
                );
              })}
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const Legend = ({ color, label, val }: { color: string; label: string; val: number }) => (
  <View style={{ alignItems: "center", flex: 1 }}>
    <Text style={{ color, fontSize: 22, fontWeight: "900" }}>{val}%</Text>
    <Text style={{ color: colors.textDim, fontSize: 11, fontWeight: "700", textAlign: "center" }} numberOfLines={1}>{label}</Text>
  </View>
);
const Score = ({ flag, val }: { flag: string; val: number }) => (
  <View style={{ alignItems: "center", gap: 4 }}>
    <Text style={{ fontSize: 34 }}>{flag}</Text>
    <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900" }}>{val}</Text>
  </View>
);

const styles = StyleSheet.create({
  fixture: { color: colors.text, fontSize: 16, fontWeight: "800", textAlign: "center" },
  group: { color: colors.textDim, fontSize: 12, fontWeight: "700" },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  total: { color: colors.textDim, fontSize: 12, fontWeight: "700" },
  bar: { flexDirection: "row", height: 16, borderRadius: 8, overflow: "hidden", backgroundColor: colors.bg },
  legendRow: { flexDirection: "row", gap: spacing.sm },
  dash: { color: colors.textFaint, fontSize: 28, fontWeight: "900" },
  avgNote: { color: colors.textFaint, fontSize: 11, textAlign: "center" },
  popRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  popScore: { color: colors.text, fontWeight: "900", width: 44, fontSize: 15 },
  popBarBg: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.bg, overflow: "hidden" },
  popBarFill: { height: 10, backgroundColor: colors.bleu, borderRadius: 5 },
  popPct: { color: colors.textDim, fontWeight: "800", width: 38, textAlign: "right", fontSize: 13 },
});
