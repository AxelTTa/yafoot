import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import MatchCard from "../../components/MatchCard";
import GroupStandings from "../../components/GroupStandings";
import { Empty, Icon, Loading } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { fetchMatches, fetchMyPredictions } from "../../lib/api";
import { computeGroups } from "../../lib/standings";
import { supabase } from "../../lib/supabase";
import { colors, radius, spacing } from "../../lib/theme";
import { Match, Prediction, isFinished, isLive, isUpcoming } from "../../lib/types";

type Filter = "upcoming" | "groups" | "results";

export default function Matches() {
  const router = useRouter();
  const { profile } = useAuth();
  const { t } = useI18n();
  const [matches, setMatches] = useState<Match[]>([]);
  const [preds, setPreds] = useState<Record<number, Prediction>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("upcoming");

  const load = useCallback(async () => {
    const [m, p] = await Promise.all([fetchMatches(), fetchMyPredictions().catch(() => ({}))]);
    setMatches(m); setPreds(p); setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel("matches-live").on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const groups = useMemo(() => computeGroups(matches), [matches]);
  const filtered = useMemo(() => {
    if (filter === "results") return matches.filter((m) => isFinished(m.status)).reverse();
    if (filter === "upcoming") {
      const live = matches
        .filter((m) => isLive(m.status))
        .sort((a, b) => (parseInt(b.minute ?? "0") || 0) - (parseInt(a.minute ?? "0") || 0));
      const upcoming = matches.filter((m) => isUpcoming(m.status));
      return [...live, ...upcoming];
    }
    return [];
  }, [matches, filter]);

  if (loading) return <Loading />;

  const tabs: { key: Filter; label: string; color: string }[] = [
    { key: "upcoming", label: t("filter_upcoming"), color: colors.greenDark },
    { key: "groups", label: t("filter_groups"), color: colors.purple },
    { key: "results", label: t("filter_results"), color: colors.orange },
  ];

  const Filters = (
    <View style={styles.filters}>
      {tabs.map((tab) => {
        const active = filter === tab.key;
        return (
          <Pressable key={tab.key} onPress={() => setFilter(tab.key)} style={[styles.chip, active && { backgroundColor: tab.color }]}>
            <Text style={[styles.chipText, active && { color: colors.blanc }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const refresh = <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.greenDark} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.topbar}>
        <View>
          <Text style={styles.hi}>Hi, @{profile?.username ?? "player"}</Text>
          <Text style={styles.title}>{t("matches_sub")}</Text>
        </View>
        <Pressable onPress={() => router.push("/notifications")} style={styles.bell} hitSlop={8}>
          <Icon name="notifications" size={22} color={colors.ink} />
        </Pressable>
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
          ListEmptyComponent={<Empty icon="podium" title={t("empty_groups")} />}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(m) => String(m.id)}
          ListHeaderComponent={Filters}
          contentContainerStyle={styles.list}
          refreshControl={refresh}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => <MatchCard match={item} prediction={preds[item.id]} onPress={() => router.push(`/match/${item.id}`)} onStats={() => router.push(`/stats/${item.id}`)} />}
          ListEmptyComponent={
            <Empty
              icon={filter === "results" ? "list" : "calendar"}
              color={filter === "results" ? colors.orange : colors.greenDark}
              title={filter === "results" ? t("empty_results") : t("empty_upcoming")}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.sm },
  hi: { color: colors.textDim, fontSize: 14, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 28, fontWeight: "900", letterSpacing: -0.6 },
  bell: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  filters: { flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.md, flexWrap: "wrap" },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.surface },
  chipText: { color: colors.ink, fontWeight: "900", fontSize: 13 },
});
