import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Card, Chip, Header, Loading, Screen, ScrollView } from "../../components/ui";
import { fetchMatch } from "../../lib/api";
import { matchProbabilities } from "../../lib/odds";
import { supabase } from "../../lib/supabase";
import { prettyTeam, teamFlag } from "../../lib/teams";
import { Match } from "../../lib/types";
import { colors, radius, spacing } from "../../lib/theme";

export default function MatchStats() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [crowd, setCrowd] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [m, st] = await Promise.all([
        fetchMatch(Number(id)),
        supabase.rpc("match_stats", { p_match_id: Number(id) }).then((r) => r.data),
      ]);
      setMatch(m); setCrowd(st); setLoading(false);
    })();
  }, [id]);

  if (loading) return <Screen><Header title="Match Stats" /><Loading /></Screen>;
  if (!match) return <Screen><Header title="Match Stats" /></Screen>;

  const model = matchProbabilities(match.home_code, match.away_code);
  const hw = Math.round(model.homeWin * 100), dr = Math.round(model.draw * 100), aw = Math.round(model.awayWin * 100);
  const cTotal = crowd?.total ?? 0;
  const cpct = (n: number) => (cTotal ? Math.round((n / cTotal) * 100) : 0);

  return (
    <Screen>
      <Header title="Match Stats" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 60 }}>
        <Card variant="hero" style={{ alignItems: "center", gap: 10 }}>
          <Text style={styles.group}>{match.group_name ?? match.stage?.replace(/_/g, " ")}</Text>
          <View style={styles.fixtureRow}>
            <View style={styles.side}><Text style={styles.bigFlag}>{teamFlag(match.home_team, match.home_flag)}</Text><Text style={styles.sideName}>{prettyTeam(match.home_team)}</Text></View>
            <Text style={styles.vs}>vs</Text>
            <View style={styles.side}><Text style={styles.bigFlag}>{teamFlag(match.away_team, match.away_flag)}</Text><Text style={styles.sideName}>{prettyTeam(match.away_team)}</Text></View>
          </View>
        </Card>

        {/* Win probability (model) */}
        <Card style={{ gap: spacing.md }}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Win probability</Text>
            <Chip label="YaFoot model" color={colors.purple} bg="rgba(155,93,229,0.12)" />
          </View>
          <View style={styles.bar}>
            <View style={{ width: `${hw}%`, backgroundColor: colors.green }} />
            <View style={{ width: `${dr}%`, backgroundColor: colors.yellow }} />
            <View style={{ width: `${aw}%`, backgroundColor: colors.purple }} />
          </View>
          <View style={styles.legendRow}>
            <Legend color={colors.green} label={prettyTeam(match.home_team)} val={hw} />
            <Legend color={colors.yellow} label="Draw" val={dr} />
            <Legend color={colors.purple} label={prettyTeam(match.away_team)} val={aw} />
          </View>
        </Card>

        {/* Projected score */}
        <Card style={{ gap: spacing.md }}>
          <Text style={styles.cardTitle}>Projected score</Text>
          <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.lg }}>
            <Score flag={teamFlag(match.home_team, match.home_flag)} val={model.expHome} />
            <Text style={styles.dash}>:</Text>
            <Score flag={teamFlag(match.away_team, match.away_flag)} val={model.expAway} />
          </View>
          <Text style={styles.note}>Most likely scorelines</Text>
          {model.topScores.map((s, i) => (
            <View key={i} style={styles.popRow}>
              <Text style={styles.popScore}>{s.score}</Text>
              <View style={styles.popBarBg}><View style={[styles.popBarFill, { width: `${Math.max(Math.round(s.p * 100), 4)}%` }]} /></View>
              <Text style={styles.popPct}>{Math.round(s.p * 100)}%</Text>
            </View>
          ))}
        </Card>

        {/* Community forecast (if any) */}
        <Card style={{ gap: spacing.sm }}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Community forecast</Text>
            <Chip label={`${cTotal} ${cTotal === 1 ? "pick" : "picks"}`} color={colors.greenDark} bg={colors.bleuSoft} />
          </View>
          {cTotal === 0 ? (
            <Text style={styles.note}>No fan predictions yet — be the first to predict this match.</Text>
          ) : (
            <View style={styles.legendRow}>
              <Legend color={colors.green} label="Home" val={cpct(crowd.home_win)} />
              <Legend color={colors.yellow} label="Draw" val={cpct(crowd.draw)} />
              <Legend color={colors.purple} label="Away" val={cpct(crowd.away_win)} />
            </View>
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const Legend = ({ color, label, val }: { color: string; label: string; val: number }) => (
  <View style={{ alignItems: "center", flex: 1 }}>
    <Text style={{ color, fontSize: 24, fontWeight: "900" }}>{val}%</Text>
    <Text style={{ color: colors.textDim, fontSize: 11, fontWeight: "800", textAlign: "center" }} numberOfLines={1}>{label}</Text>
  </View>
);
const Score = ({ flag, val }: { flag: string; val: number }) => (
  <View style={{ alignItems: "center", gap: 4 }}>
    <Text style={{ fontSize: 36 }}>{flag}</Text>
    <Text style={{ color: colors.ink, fontSize: 32, fontWeight: "900" }}>{val}</Text>
  </View>
);

const styles = StyleSheet.create({
  group: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  fixtureRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" },
  side: { flex: 1, alignItems: "center", gap: 6 },
  bigFlag: { fontSize: 46 },
  sideName: { color: colors.blanc, fontSize: 14, fontWeight: "800", textAlign: "center" },
  vs: { color: "rgba(255,255,255,0.6)", fontSize: 16, fontWeight: "900", paddingHorizontal: 8 },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  bar: { flexDirection: "row", height: 18, borderRadius: 9, overflow: "hidden", backgroundColor: colors.surfaceAlt },
  legendRow: { flexDirection: "row", gap: spacing.sm },
  dash: { color: colors.textFaint, fontSize: 28, fontWeight: "900" },
  note: { color: colors.textDim, fontSize: 12, textAlign: "center", fontWeight: "600" },
  popRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  popScore: { color: colors.ink, fontWeight: "900", width: 40, fontSize: 15 },
  popBarBg: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.surfaceAlt, overflow: "hidden" },
  popBarFill: { height: 10, backgroundColor: colors.green, borderRadius: 5 },
  popPct: { color: colors.textDim, fontWeight: "800", width: 38, textAlign: "right", fontSize: 13 },
});
