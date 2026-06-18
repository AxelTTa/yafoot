import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import MatchCard from "../../components/MatchCard";
import { LogoInline } from "../../components/Brand";
import { Empty, Loading } from "../../components/ui";
import { fetchMatches, fetchMyPredictions } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { colors, spacing } from "../../lib/theme";
import { Match, Prediction, isFinished, isLive, isUpcoming } from "../../lib/types";

type Filter = "live" | "upcoming" | "results";

export default function Matches() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [preds, setPreds] = useState<Record<number, Prediction>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("live");

  const load = useCallback(async () => {
    const [m, p] = await Promise.all([fetchMatches(), fetchMyPredictions().catch(() => ({}))]);
    setMatches(m);
    setPreds(p);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // realtime: live score updates
    const ch = supabase
      .channel("matches-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  // reload predictions/scores whenever the tab regains focus
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // default filter: if there are live matches show live, else upcoming
  useEffect(() => {
    if (!loading && matches.length) {
      const hasLive = matches.some((m) => isLive(m.status));
      setFilter((f) => (f === "live" && !hasLive ? "upcoming" : f));
    }
  }, [loading]);

  const liveCount = matches.filter((m) => isLive(m.status)).length;

  const filtered = useMemo(() => {
    if (filter === "live") return matches.filter((m) => isLive(m.status));
    if (filter === "results")
      return matches.filter((m) => isFinished(m.status)).reverse();
    return matches.filter((m) => isUpcoming(m.status));
  }, [matches, filter]);

  if (loading) return <Loading />;

  const tabs: { key: Filter; label: string; badge?: number }[] = [
    { key: "live", label: "Live", badge: liveCount },
    { key: "upcoming", label: "Upcoming" },
    { key: "results", label: "Results" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.topbar}>
        <LogoInline size={22} />
        <Text style={styles.wc}>World Cup 2026 🇨🇦🇺🇸🇲🇽</Text>
      </View>

      <View style={styles.filters}>
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setFilter(t.key)}
            style={[styles.filterBtn, filter === t.key && styles.filterActive]}
          >
            <Text style={[styles.filterText, filter === t.key && styles.filterTextActive]}>
              {t.label}
            </Text>
            {t.badge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{t.badge}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 40 }}
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
          <MatchCard
            match={item}
            prediction={preds[item.id]}
            onPress={() => router.push(`/match/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <Empty
            title={filter === "live" ? "No live matches" : filter === "results" ? "No results yet" : "No upcoming matches"}
            sub={filter === "live" ? "Check the upcoming tab for the next kickoff." : undefined}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: 56,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  wc: { color: colors.textDim, fontSize: 12, fontWeight: "700" },
  filters: { flexDirection: "row", gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.sm },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterActive: { backgroundColor: colors.bleu, borderColor: colors.bleu },
  filterText: { color: colors.textDim, fontWeight: "700", fontSize: 13 },
  filterTextActive: { color: colors.blanc },
  badge: { backgroundColor: colors.rouge, borderRadius: 999, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { color: colors.blanc, fontSize: 10, fontWeight: "900" },
});
