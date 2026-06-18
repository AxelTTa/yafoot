import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import MatchCard from "../../components/MatchCard";
import GroupStandings from "../../components/GroupStandings";
import { LogoInline } from "../../components/Brand";
import { Empty, Loading } from "../../components/ui";
import { fetchMatches, fetchMyPredictions } from "../../lib/api";
import { computeGroups } from "../../lib/standings";
import { supabase } from "../../lib/supabase";
import { colors, radius, spacing } from "../../lib/theme";
import { Match, Prediction, isFinished, isLive, isUpcoming } from "../../lib/types";

type Filter = "live" | "upcoming" | "groups" | "results";

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
    const ch = supabase
      .channel("matches-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!loading && matches.length) {
      const hasLive = matches.some((m) => isLive(m.status));
      setFilter((f) => (f === "live" && !hasLive ? "upcoming" : f));
    }
  }, [loading]);

  const liveCount = matches.filter((m) => isLive(m.status)).length;
  const groups = useMemo(() => computeGroups(matches), [matches]);

  const filtered = useMemo(() => {
    if (filter === "live") return matches.filter((m) => isLive(m.status));
    if (filter === "results") return matches.filter((m) => isFinished(m.status)).reverse();
    if (filter === "upcoming") return matches.filter((m) => isUpcoming(m.status));
    return [];
  }, [matches, filter]);

  if (loading) return <Loading />;

  const tabs: { key: Filter; label: string; badge?: number }[] = [
    { key: "live", label: "Live", badge: liveCount },
    { key: "upcoming", label: "Upcoming" },
    { key: "groups", label: "Groups" },
    { key: "results", label: "Results" },
  ];

  const Filters = (
    <View style={styles.filters}>
      {tabs.map((t) => (
        <Pressable key={t.key} onPress={() => setFilter(t.key)} style={[styles.filterBtn, filter === t.key && styles.filterActive]}>
          {filter === t.key && t.key === "live" && t.badge ? <View style={styles.liveDot} /> : null}
          <Text style={[styles.filterText, filter === t.key && styles.filterTextActive]}>{t.label}</Text>
          {t.badge ? (
            <View style={[styles.badge, filter === t.key && { backgroundColor: "rgba(255,255,255,0.25)" }]}>
              <Text style={styles.badgeText}>{t.badge}</Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );

  const refresh = (
    <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.bleu} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.topbar}>
        <LogoInline size={24} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View style={styles.wcPill}><Text style={styles.wc}>WC 2026 🇨🇦🇺🇸🇲🇽</Text></View>
          <Pressable onPress={() => router.push("/notifications")} style={styles.bell} hitSlop={8}>
            <Text style={{ fontSize: 18 }}>🔔</Text>
          </Pressable>
        </View>
      </View>

      {filter === "groups" ? (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.group}
          ListHeaderComponent={Filters}
          contentContainerStyle={styles.list}
          refreshControl={refresh}
          renderItem={({ item }) => <GroupStandings group={item.group} rows={item.rows} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListEmptyComponent={<Empty icon="📊" title="No group data yet" />}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(m) => String(m.id)}
          ListHeaderComponent={Filters}
          contentContainerStyle={styles.list}
          refreshControl={refresh}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => (
            <MatchCard match={item} prediction={preds[item.id]} onPress={() => router.push(`/match/${item.id}`)} onStats={() => router.push(`/stats/${item.id}`)} />
          )}
          ListEmptyComponent={
            <Empty
              icon={filter === "live" ? "📡" : filter === "results" ? "📋" : "🗓️"}
              title={filter === "live" ? "No live matches" : filter === "results" ? "No results yet" : "No upcoming matches"}
              sub={filter === "live" ? "Check Upcoming for the next kickoff." : undefined}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.lg, paddingTop: 58, paddingBottom: spacing.md,
  },
  wcPill: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
  wc: { color: colors.textDim, fontSize: 12, fontWeight: "700" },
  bell: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 110 },
  filters: { flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.md, flexWrap: "wrap" },
  filterBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.lg, paddingVertical: 9,
    borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  filterActive: { backgroundColor: colors.bleu, borderColor: colors.bleu },
  filterText: { color: colors.textDim, fontWeight: "800", fontSize: 13 },
  filterTextActive: { color: colors.blanc },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.blanc },
  badge: { backgroundColor: colors.rouge, borderRadius: 999, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  badgeText: { color: colors.blanc, fontSize: 10, fontWeight: "900" },
});
