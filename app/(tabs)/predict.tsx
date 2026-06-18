import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import MatchCard from "../../components/MatchCard";
import { Empty, Loading } from "../../components/ui";
import { fetchMatches, fetchMyPredictions } from "../../lib/api";
import { colors, radius, spacing } from "../../lib/theme";
import { Match, Prediction, isUpcoming } from "../../lib/types";

export default function Predict() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [preds, setPreds] = useState<Record<number, Prediction>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [m, p] = await Promise.all([fetchMatches(), fetchMyPredictions().catch(() => ({}))]);
    setMatches(m);
    setPreds(p);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const upcoming = useMemo(() => matches.filter((m) => isUpcoming(m.status)), [matches]);
  const predictedCount = upcoming.filter((m) => preds[m.id]).length;

  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <Text style={styles.title}>🎯 Predict</Text>
        <Text style={styles.sub}>Predict every match. Earn points. Climb your leagues.</Text>
        <View style={styles.progress}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Predicted</Text>
            <Text style={styles.progressNum}>
              {predictedCount} / {upcoming.length}
            </Text>
          </View>
          <View style={styles.bar}>
            <View
              style={[
                styles.barFill,
                { width: `${upcoming.length ? (predictedCount / upcoming.length) * 100 : 0}%` },
              ]}
            />
          </View>
        </View>
      </View>

      <FlatList
        data={upcoming}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 110 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.bleu}
          />
        }
        renderItem={({ item }) => (
          <MatchCard match={item} prediction={preds[item.id]} onPress={() => router.push(`/match/${item.id}`)} />
        )}
        ListEmptyComponent={<Empty icon="🎯" title="All caught up" sub="No upcoming matches to predict right now." />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: 56,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 4,
  },
  title: { color: colors.text, fontSize: 26, fontWeight: "900" },
  sub: { color: colors.textDim, fontSize: 13, marginBottom: spacing.md },
  progress: { gap: 6 },
  progressRow: { flexDirection: "row", justifyContent: "space-between" },
  progressLabel: { color: colors.textDim, fontWeight: "700", fontSize: 12 },
  progressNum: { color: colors.text, fontWeight: "900", fontSize: 12 },
  bar: { height: 8, backgroundColor: colors.bleuDeep, borderRadius: radius.pill, overflow: "hidden" },
  barFill: { height: 8, backgroundColor: colors.live, borderRadius: radius.pill },
});
