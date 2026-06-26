import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import MatchCard from "../../components/MatchCard";
import { Card, Empty, Loading, ScreenHeader } from "../../components/ui";
import { fetchMatches, fetchMyPredictions } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { APP_STORE_SAFE } from "../../lib/mode";
import { colors, radius, spacing } from "../../lib/theme";
import { Match, Prediction, isUpcoming } from "../../lib/types";

export default function Predict() {
  const router = useRouter();
  const { t } = useI18n();
  const [matches, setMatches] = useState<Match[]>([]);
  const [preds, setPreds] = useState<Record<number, Prediction>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [m, p] = await Promise.all([fetchMatches(), fetchMyPredictions().catch(() => ({}))]);
    setMatches(m); setPreds(p); setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const upcoming = useMemo(() => matches.filter((m) => isUpcoming(m.status)), [matches]);
  const predictedCount = upcoming.filter((m) => preds[m.id]).length;

  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t("tab_predict")} subtitle={APP_STORE_SAFE ? "Pick scores for friend-created challenges." : t("predict_sub")} />

      <FlatList
        data={upcoming}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: 120 }}
        ListHeaderComponent={
          <Card style={styles.progressCard}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>{APP_STORE_SAFE ? "Your challenge picks" : t("predict_round")}</Text>
              <Text style={styles.progressNum}>{predictedCount} / {upcoming.length}</Text>
            </View>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${upcoming.length ? (predictedCount / upcoming.length) * 100 : 0}%` }]} />
            </View>
          </Card>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.bleu} />
        }
        renderItem={({ item }) => (
          <MatchCard match={item} prediction={preds[item.id]} onPress={() => router.push(`/match/${item.id}`)} onStats={APP_STORE_SAFE ? undefined : () => router.push(`/stats/${item.id}`)} />
        )}
        ListEmptyComponent={<Empty icon="create-outline" title={t("predict_empty_title")} sub={APP_STORE_SAFE ? "Create a challenge first, then come back to track your picks." : t("predict_empty")} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  progressCard: { marginBottom: spacing.md, gap: spacing.sm },
  progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressLabel: { color: colors.textDim, fontWeight: "800", fontSize: 13 },
  progressNum: { color: colors.ink, fontWeight: "900", fontSize: 16 },
  bar: { height: 10, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, overflow: "hidden" },
  barFill: { height: 10, backgroundColor: colors.green, borderRadius: radius.pill },
});
