import { ScrollView, StyleSheet, Text, View } from "react-native";
import { prettyTeam, teamFlag } from "../lib/teams";
import { colors, radius, shadow, spacing } from "../lib/theme";
import { Match, isFinished, isLive } from "../lib/types";

type StageDef = { key: string; title: string; match: (stage: string) => boolean };

const STAGES: StageDef[] = [
  { key: "last32", title: "Last 32", match: (s) => /LAST.?32|ROUND.?OF.?32|R32/i.test(s) },
  { key: "last16", title: "Last 16", match: (s) => /LAST.?16|ROUND.?OF.?16|R16/i.test(s) },
  { key: "quarters", title: "Quarter-finals", match: (s) => /QUARTER/i.test(s) },
  { key: "semis", title: "Semi-finals", match: (s) => /SEMI/i.test(s) && !/THIRD/i.test(s) },
  { key: "finals", title: "Finals", match: (s) => /FINAL/i.test(s) && !/SEMI/i.test(s) },
];

function stageMatches(matches: Match[], def: StageDef) {
  return matches
    .filter((m) => def.match(String(m.stage ?? "")))
    .sort((a, b) => {
      const ta = a.utc_kickoff ?? "";
      const tb = b.utc_kickoff ?? "";
      if (ta !== tb) return ta < tb ? -1 : 1;
      return a.id - b.id;
    });
}

function scoreLabel(match: Match) {
  if (match.home_score != null && match.away_score != null) return `${match.home_score}-${match.away_score}`;
  if (isLive(match.status)) return "Live";
  if (!match.utc_kickoff) return "TBD";
  return new Date(match.utc_kickoff).toLocaleDateString([], { month: "short", day: "numeric" });
}

function TeamLine({ name, flag }: { name: string; flag?: string | null }) {
  return (
    <View style={styles.teamLine}>
      <Text style={styles.flag}>{teamFlag(name, flag)}</Text>
      <Text style={styles.teamName} numberOfLines={1}>{prettyTeam(name)}</Text>
    </View>
  );
}

function MatchNode({ match }: { match: Match }) {
  const live = isLive(match.status);
  const finished = isFinished(match.status);
  return (
    <View style={[styles.node, live && styles.nodeLive, finished && styles.nodeDone]}>
      <View style={styles.nodeTop}>
        <Text style={styles.meta} numberOfLines={1}>{String(match.stage ?? "Knockout").replace(/_/g, " ")}</Text>
        <Text style={[styles.score, live && { color: colors.greenDark }]}>{scoreLabel(match)}</Text>
      </View>
      <TeamLine name={match.home_team} flag={match.home_flag} />
      <View style={styles.divider} />
      <TeamLine name={match.away_team} flag={match.away_flag} />
    </View>
  );
}

export default function WorldCupBracket({ matches }: { matches: Match[] }) {
  const columns = STAGES.map((stage) => ({ stage, matches: stageMatches(matches, stage) })).filter((c) => c.matches.length > 0);

  if (columns.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>World Cup bracket</Text>
        <Text style={styles.emptySub}>Knockout fixtures will appear here as soon as the feed publishes them.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>World Cup bracket</Text>
        <Text style={styles.sub}>Scroll sideways to view the full tree. Future slots stay clear until teams are confirmed.</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.scroller}>
        {columns.map((column) => (
          <View key={column.stage.key} style={styles.column}>
            <Text style={styles.columnTitle}>{column.stage.title}</Text>
            <View style={styles.columnBody}>
              {column.matches.map((match) => <MatchNode key={match.id} match={match} />)}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  header: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, ...shadow },
  title: { color: colors.ink, fontSize: 24, fontWeight: "900" },
  sub: { color: colors.textDim, fontSize: 13, fontWeight: "700", lineHeight: 18, marginTop: 4 },
  scroller: { gap: spacing.md, paddingBottom: spacing.sm },
  column: { width: 250, gap: spacing.sm },
  columnTitle: { color: colors.ink, fontSize: 15, fontWeight: "900", paddingHorizontal: 4 },
  columnBody: { gap: spacing.sm },
  node: { minHeight: 112, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, ...shadow },
  nodeLive: { borderColor: colors.greenDark, backgroundColor: "rgba(166,230,61,0.14)" },
  nodeDone: { borderColor: "rgba(15,23,42,0.18)" },
  nodeTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  meta: { flex: 1, color: colors.textFaint, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 },
  score: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  teamLine: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 26 },
  flag: { width: 24, fontSize: 18, textAlign: "center" },
  teamName: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: "900" },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 5 },
  empty: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, ...shadow },
  emptyTitle: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  emptySub: { color: colors.textDim, fontSize: 13, fontWeight: "700", lineHeight: 18, marginTop: 5 },
});
