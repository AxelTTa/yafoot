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

function timeLabel(match: Match) {
  if (!match.utc_kickoff) return "Time TBD";
  return new Date(match.utc_kickoff).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
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
        <View style={[styles.statusPill, live && styles.statusLive, finished && styles.statusDone]}>
          <Text style={[styles.statusTxt, live && { color: colors.blanc }]}>{live ? (match.minute ? `${match.minute}'` : "LIVE") : finished ? "FT" : scoreLabel(match)}</Text>
        </View>
        <Text style={styles.meta} numberOfLines={1}>{timeLabel(match)}</Text>
      </View>
      <TeamLine name={match.home_team} flag={match.home_flag} />
      <View style={styles.divider} />
      <TeamLine name={match.away_team} flag={match.away_flag} />
      {match.venue ? <Text style={styles.venue} numberOfLines={1}>{match.venue}</Text> : null}
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
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.kicker}>Knockout map</Text>
            <Text style={styles.title}>World Cup tree</Text>
          </View>
          <View style={styles.countPill}>
            <Text style={styles.countNum}>{columns.reduce((sum, col) => sum + col.matches.length, 0)}</Text>
            <Text style={styles.countTxt}>fixtures</Text>
          </View>
        </View>
        <Text style={styles.sub}>Swipe sideways for each round. Scroll inside a round when it has more fixtures than the screen can show.</Text>
        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.greenDark }]} /><Text style={styles.legendTxt}>Live</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.surfaceDark }]} /><Text style={styles.legendTxt}>Finished</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.purple }]} /><Text style={styles.legendTxt}>Upcoming</Text></View>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.scroller}>
        {columns.map((column, index) => (
          <View key={column.stage.key} style={styles.column}>
            <View style={styles.columnHead}>
              <Text style={styles.columnTitle}>{column.stage.title}</Text>
              <Text style={styles.columnCount}>{column.matches.length}</Text>
            </View>
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={styles.columnScroll} contentContainerStyle={styles.columnBody}>
              {column.matches.map((match) => <MatchNode key={match.id} match={match} />)}
            </ScrollView>
            {index < columns.length - 1 ? (
              <View style={styles.connector}>
                <View style={styles.connectorLine} />
                <Text style={styles.connectorTxt}>next</Text>
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  header: { backgroundColor: colors.surfaceDark, borderRadius: radius.xl, padding: spacing.lg, ...shadow },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  kicker: { color: colors.green, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  title: { color: colors.blanc, fontSize: 28, fontWeight: "900" },
  sub: { color: "rgba(255,255,255,0.68)", fontSize: 13, fontWeight: "700", lineHeight: 18, marginTop: 4 },
  countPill: { alignItems: "center", justifyContent: "center", minWidth: 72, borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.12)", padding: spacing.sm },
  countNum: { color: colors.green, fontSize: 24, fontWeight: "900" },
  countTxt: { color: "rgba(255,255,255,0.62)", fontSize: 10, fontWeight: "900" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendTxt: { color: colors.blanc, fontSize: 11, fontWeight: "800" },
  scroller: { gap: spacing.lg, paddingBottom: spacing.sm, paddingRight: spacing.lg },
  column: { width: 286, gap: spacing.sm, position: "relative" },
  columnHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border },
  columnTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  columnCount: { color: colors.purple, fontSize: 13, fontWeight: "900" },
  columnScroll: { maxHeight: 590 },
  columnBody: { gap: spacing.sm, paddingVertical: 2 },
  node: { minHeight: 128, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, padding: spacing.md, ...shadow },
  nodeLive: { borderColor: colors.greenDark, backgroundColor: "rgba(166,230,61,0.14)" },
  nodeDone: { borderColor: "rgba(15,23,42,0.18)" },
  nodeTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  statusPill: { minWidth: 48, alignItems: "center", borderRadius: radius.pill, backgroundColor: "rgba(155,93,229,0.12)", paddingHorizontal: spacing.sm, paddingVertical: 4 },
  statusLive: { backgroundColor: colors.live },
  statusDone: { backgroundColor: colors.surfaceDark },
  statusTxt: { color: colors.purple, fontSize: 11, fontWeight: "900" },
  meta: { flex: 1, color: colors.textFaint, fontSize: 10, fontWeight: "900", textAlign: "right" },
  teamLine: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 26 },
  flag: { width: 24, fontSize: 18, textAlign: "center" },
  teamName: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: "900" },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 5 },
  venue: { color: colors.textFaint, fontSize: 10, fontWeight: "800", marginTop: spacing.sm },
  connector: { position: "absolute", right: -18, top: 68, width: 18, alignItems: "center" },
  connectorLine: { width: 18, height: 2, backgroundColor: colors.surfaceDark, opacity: 0.35 },
  connectorTxt: { color: colors.textFaint, fontSize: 8, fontWeight: "900", marginTop: 2 },
  empty: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, ...shadow },
  emptyTitle: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  emptySub: { color: colors.textDim, fontSize: 13, fontWeight: "700", lineHeight: 18, marginTop: 5 },
});
