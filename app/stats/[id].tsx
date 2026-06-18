import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Header, Loading, Screen, ScrollView } from "../../components/ui";
import { fetchMatch } from "../../lib/api";
import { matchProbabilities } from "../../lib/odds";
import { supabase } from "../../lib/supabase";
import { prettyTeam, teamFlag } from "../../lib/teams";
import { Match } from "../../lib/types";
import { colors, radius, shadow, spacing } from "../../lib/theme";

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
  const fav = hw >= dr && hw >= aw ? "home" : aw >= dr ? "away" : "draw";
  const homeN = prettyTeam(match.home_team), awayN = prettyTeam(match.away_team);
  const cTotal = crowd?.total ?? 0;

  return (
    <Screen>
      <Header title="Match Insights" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 60 }}>
        {/* fixture hero */}
        <View style={styles.hero}>
          <View style={styles.heroSide}>
            <Text style={styles.heroFlag}>{teamFlag(match.home_team, match.home_flag)}</Text>
            <Text style={styles.heroName} numberOfLines={1}>{homeN}</Text>
          </View>
          <View style={styles.vsWrap}><Text style={styles.vs}>VS</Text></View>
          <View style={styles.heroSide}>
            <Text style={styles.heroFlag}>{teamFlag(match.away_team, match.away_flag)}</Text>
            <Text style={styles.heroName} numberOfLines={1}>{awayN}</Text>
          </View>
        </View>

        {/* win probability — three bold colored blocks */}
        <Text style={styles.sectionTitle}>Win probability</Text>
        <View style={styles.probRow}>
          <ProbBlock color={colors.green} flag={teamFlag(match.home_team, match.home_flag)} label={homeN} pct={hw} fav={fav === "home"} />
          <ProbBlock color={colors.yellow} dark label="Draw" pct={dr} fav={fav === "draw"} icon="remove" />
          <ProbBlock color={colors.purple} flag={teamFlag(match.away_team, match.away_flag)} label={awayN} pct={aw} fav={fav === "away"} />
        </View>
        <View style={styles.segBar}>
          <View style={{ flex: hw, backgroundColor: colors.green }} />
          <View style={{ flex: dr, backgroundColor: colors.yellow }} />
          <View style={{ flex: aw, backgroundColor: colors.purple }} />
        </View>

        {/* projected score */}
        <View style={styles.scoreCard}>
          <Text style={styles.cardLabel}>PROJECTED SCORE</Text>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreFlag}>{teamFlag(match.home_team, match.home_flag)}</Text>
            <Text style={styles.scoreNum}>{model.expHome}</Text>
            <Text style={styles.scoreDash}>–</Text>
            <Text style={styles.scoreNum}>{model.expAway}</Text>
            <Text style={styles.scoreFlag}>{teamFlag(match.away_team, match.away_flag)}</Text>
          </View>
        </View>

        {/* likely scorelines */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>MOST LIKELY SCORELINES</Text>
          {model.topScores.map((s, i) => {
            const pct = Math.round(s.p * 100);
            const c = [colors.green, colors.purple, colors.orange, colors.cyan, colors.greenDark][i];
            return (
              <View key={i} style={styles.popRow}>
                <View style={[styles.scorePill, { backgroundColor: c }]}><Text style={styles.scorePillTxt}>{s.score}</Text></View>
                <View style={styles.popBarBg}><View style={[styles.popBarFill, { width: `${Math.max(pct, 5)}%`, backgroundColor: c }]} /></View>
                <Text style={styles.popPct}>{pct}%</Text>
              </View>
            );
          })}
        </View>

        {/* community */}
        <View style={[styles.card, styles.communityCard]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={styles.peopleDot}><Text style={{ fontSize: 16 }}>👥</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.commTitle}>Community</Text>
              <Text style={styles.commSub}>
                {cTotal === 0 ? "Be the first fan to predict this match" : `${cTotal} ${cTotal === 1 ? "fan has" : "fans have"} predicted this match`}
              </Text>
            </View>
            {cTotal > 0 ? (
              <Text style={styles.commPct}>{Math.round(((crowd.home_win || 0) / cTotal) * 100)}% / {Math.round(((crowd.draw || 0) / cTotal) * 100)}% / {Math.round(((crowd.away_win || 0) / cTotal) * 100)}%</Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function ProbBlock({ color, flag, label, pct, fav, dark, icon }: { color: string; flag?: string; label: string; pct: number; fav?: boolean; dark?: boolean; icon?: string }) {
  const txt = dark ? colors.ink : colors.blanc;
  return (
    <View style={[styles.probBlock, { backgroundColor: color }, fav && styles.favBlock]}>
      {fav ? <View style={styles.favBadge}><Text style={styles.favTxt}>FAV</Text></View> : null}
      <Text style={{ fontSize: 22 }}>{flag ?? "🤝"}</Text>
      <Text style={[styles.probPct, { color: txt }]}>{pct}%</Text>
      <Text style={[styles.probLabel, { color: txt }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceDark, borderRadius: radius.xl, padding: spacing.xl, ...shadow },
  heroSide: { flex: 1, alignItems: "center", gap: 8 },
  heroFlag: { fontSize: 52 },
  heroName: { color: colors.blanc, fontSize: 15, fontWeight: "900", textAlign: "center" },
  vsWrap: { paddingHorizontal: spacing.sm },
  vs: { color: "rgba(255,255,255,0.5)", fontSize: 18, fontWeight: "900" },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: "900", letterSpacing: -0.3, marginBottom: -spacing.sm },
  probRow: { flexDirection: "row", gap: spacing.sm },
  probBlock: { flex: 1, borderRadius: radius.lg, paddingVertical: spacing.lg, alignItems: "center", gap: 4, ...shadow },
  favBlock: { transform: [{ scale: 1.04 }] },
  favBadge: { position: "absolute", top: 6, right: 6, backgroundColor: "rgba(0,0,0,0.25)", borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1 },
  favTxt: { color: colors.blanc, fontSize: 9, fontWeight: "900" },
  probPct: { fontSize: 28, fontWeight: "900", letterSpacing: -1 },
  probLabel: { fontSize: 11, fontWeight: "800", paddingHorizontal: 4 },
  segBar: { flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden" },
  scoreCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, alignItems: "center", gap: spacing.sm, ...shadow },
  cardLabel: { color: colors.textDim, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  scoreFlag: { fontSize: 32 },
  scoreNum: { color: colors.ink, fontSize: 40, fontWeight: "900", letterSpacing: -1 },
  scoreDash: { color: colors.textFaint, fontSize: 30, fontWeight: "900" },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, ...shadow },
  popRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  scorePill: { width: 50, borderRadius: radius.pill, paddingVertical: 5, alignItems: "center" },
  scorePillTxt: { color: colors.blanc, fontWeight: "900", fontSize: 14 },
  popBarBg: { flex: 1, height: 12, borderRadius: 6, backgroundColor: colors.surfaceAlt, overflow: "hidden" },
  popBarFill: { height: 12, borderRadius: 6 },
  popPct: { color: colors.ink, fontWeight: "900", width: 40, textAlign: "right", fontSize: 14 },
  communityCard: { backgroundColor: colors.bleuSoft },
  peopleDot: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  commTitle: { color: colors.ink, fontWeight: "900", fontSize: 15 },
  commSub: { color: colors.textDim, fontWeight: "600", fontSize: 12 },
  commPct: { color: colors.greenDark, fontWeight: "900", fontSize: 12 },
});
