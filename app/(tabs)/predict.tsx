import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import MatchCard from "../../components/MatchCard";
import { Empty, Icon, Loading } from "../../components/ui";
import { fetchMatches, fetchMyForecasts, fetchMyPredictions } from "../../lib/api";
import { matchProbabilities } from "../../lib/odds";
import { prettyTeam, teamFlag } from "../../lib/teams";
import { colors, radius, spacing } from "../../lib/theme";
import { Match, Prediction, isFinished, isUpcoming } from "../../lib/types";

type ForecastRow = {
  match_id: number;
  pred_home: number;
  pred_away: number;
  points_awarded: number;
  scored: boolean;
  matches: Match | null;
};

export default function Predict() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [preds, setPreds] = useState<Record<number, Prediction>>({});
  const [history, setHistory] = useState<ForecastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [m, p, h] = await Promise.all([
      fetchMatches(),
      fetchMyPredictions().catch(() => ({} as Record<number, Prediction>)),
      fetchMyForecasts().catch(() => []),
    ]);
    setMatches(m);
    setPreds(p);
    setHistory(h as ForecastRow[]);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openMatches = useMemo(() => matches.filter((m) => isUpcoming(m.status)).slice(0, 8), [matches]);
  const next = openMatches[0];
  const model = next ? matchProbabilities(next.home_code, next.away_code) : null;
  const predictedCount = Object.keys(preds).length;
  const scored = history.filter((h) => h.scored);
  const points = scored.reduce((sum, h) => sum + (h.points_awarded ?? 0), 0);

  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={openMatches}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: 56, gap: spacing.md, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.greenDark} />}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
            <View style={styles.hero}>
              <View style={{ flex: 1 }}>
                <Text style={styles.kicker}>Prediction room</Text>
                <Text style={styles.title}>Predict</Text>
                <Text style={styles.sub}>Open fixtures, model probabilities, likely scorelines, and your recent picks.</Text>
              </View>
              <View style={styles.heroBubble}>
                <Text style={styles.heroNum}>{openMatches.length}</Text>
                <Text style={styles.heroLabel}>open</Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statCard}><Text style={styles.statNum}>{predictedCount}</Text><Text style={styles.statLabel}>Picks</Text></View>
              <View style={styles.statCard}><Text style={[styles.statNum, { color: colors.orange }]}>{points}</Text><Text style={styles.statLabel}>Points</Text></View>
              <View style={styles.statCard}><Text style={[styles.statNum, { color: colors.purple }]}>{scored.length}</Text><Text style={styles.statLabel}>Scored</Text></View>
            </View>
            {next && model ? (
              <Pressable onPress={() => router.push(`/match/${next.id}`)} style={styles.insightCard}>
                <View style={styles.insightHead}>
                  <Text style={styles.section}>Next insight</Text>
                  <Text style={styles.detailLink}>Details</Text>
                </View>
                <Text style={styles.fixture} numberOfLines={1}>
                  {teamFlag(next.home_team, next.home_flag)} {prettyTeam(next.home_team)} vs {prettyTeam(next.away_team)} {teamFlag(next.away_team, next.away_flag)}
                </Text>
                <View style={styles.probs}>
                  <View style={styles.prob}><Text style={styles.probNum}>{Math.round(model.homeWin * 100)}%</Text><Text style={styles.probTxt}>Home</Text></View>
                  <View style={styles.prob}><Text style={[styles.probNum, { color: colors.orange }]}>{Math.round(model.draw * 100)}%</Text><Text style={styles.probTxt}>Draw</Text></View>
                  <View style={styles.prob}><Text style={[styles.probNum, { color: colors.purple }]}>{Math.round(model.awayWin * 100)}%</Text><Text style={styles.probTxt}>Away</Text></View>
                </View>
                <View style={styles.scorelineRow}>
                  {model.topScores.slice(0, 3).map((s) => (
                    <View key={s.score} style={styles.scoreline}>
                      <Text style={styles.scorelineScore}>{s.score}</Text>
                      <Text style={styles.scorelinePct}>{Math.round(s.p * 100)}%</Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            ) : null}
            <Text style={styles.section}>Open predictions</Text>
          </View>
        }
        renderItem={({ item }) => (
          <MatchCard
            match={item}
            prediction={preds[item.id]}
            onPress={() => router.push(`/match/${item.id}`)}
            onPredictionSaved={load}
          />
        )}
        ListEmptyComponent={<Empty icon="checkmark-done" color={colors.greenDark} title="No open predictions" sub="Every available match is locked or finished. Check results and history below." />}
        ListFooterComponent={
          <View style={styles.historyCard}>
            <Text style={styles.section}>Prediction history</Text>
            {history.length === 0 ? (
              <Text style={styles.emptyTxt}>Your saved picks will appear here.</Text>
            ) : (
              history.slice(0, 8).map((row) => {
                const m = row.matches;
                if (!m) return null;
                return (
                  <Pressable key={`${row.match_id}-${row.pred_home}-${row.pred_away}`} onPress={() => router.push(`/match/${row.match_id}`)} style={styles.historyRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyTeams} numberOfLines={1}>{prettyTeam(m.home_team)} vs {prettyTeam(m.away_team)}</Text>
                      <Text style={styles.historyMeta}>{m.group_name ?? m.stage?.replace(/_/g, " ") ?? "World Cup"} · Pick {row.pred_home}-{row.pred_away}</Text>
                    </View>
                    {isFinished(m.status) ? <Text style={styles.points}>+{row.points_awarded}</Text> : <Text style={styles.pending}>Open</Text>}
                  </Pressable>
                );
              })
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceDark, borderRadius: radius.xl, padding: spacing.lg },
  kicker: { color: colors.green, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  title: { color: colors.blanc, fontSize: 31, fontWeight: "900" },
  sub: { color: "rgba(255,255,255,0.68)", fontSize: 13, fontWeight: "700", lineHeight: 18, marginTop: 3 },
  heroBubble: { width: 78, height: 78, borderRadius: 39, backgroundColor: colors.purple, alignItems: "center", justifyContent: "center" },
  heroNum: { color: colors.blanc, fontSize: 28, fontWeight: "900" },
  heroLabel: { color: "rgba(255,255,255,0.75)", fontSize: 10, fontWeight: "900" },
  statsRow: { flexDirection: "row", gap: spacing.sm },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  statNum: { color: colors.greenDark, fontSize: 23, fontWeight: "900" },
  statLabel: { color: colors.textDim, fontSize: 11, fontWeight: "900", marginTop: 2 },
  insightCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: colors.border },
  insightHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  section: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  detailLink: { color: colors.purple, fontSize: 13, fontWeight: "900" },
  fixture: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  probs: { flexDirection: "row", gap: spacing.sm },
  prob: { flex: 1, alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, padding: spacing.sm },
  probNum: { color: colors.greenDark, fontSize: 22, fontWeight: "900" },
  probTxt: { color: colors.textDim, fontSize: 11, fontWeight: "900" },
  scorelineRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  scoreline: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(155,93,229,0.1)", borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 7 },
  scorelineScore: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  scorelinePct: { color: colors.purple, fontSize: 12, fontWeight: "900" },
  historyCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, marginTop: spacing.md, borderWidth: 1, borderColor: colors.border },
  historyRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: spacing.sm },
  historyTeams: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  historyMeta: { color: colors.textFaint, fontSize: 12, fontWeight: "700", marginTop: 2 },
  points: { color: colors.greenDark, fontSize: 16, fontWeight: "900" },
  pending: { color: colors.purple, fontSize: 12, fontWeight: "900" },
  emptyTxt: { color: colors.textDim, fontSize: 13, fontWeight: "700", lineHeight: 18 },
});
