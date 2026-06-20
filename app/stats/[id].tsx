import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Header, Loading, Screen, ScrollView } from "../../components/ui";
import { fetchMatch } from "../../lib/api";
import { matchProbabilities } from "../../lib/odds";
import { supabase } from "../../lib/supabase";
import { prettyTeam, teamFlag } from "../../lib/teams";
import { Match } from "../../lib/types";
import { colors, radius, shadow, spacing } from "../../lib/theme";

type FormResult = "W" | "D" | "L";

function matchResult(m: Match, team: string): FormResult {
  const isHome = m.home_team === team;
  const scored = isHome ? (m.home_score ?? 0) : (m.away_score ?? 0);
  const conceded = isHome ? (m.away_score ?? 0) : (m.home_score ?? 0);
  if (scored > conceded) return "W";
  if (scored === conceded) return "D";
  return "L";
}

function ResultDot({ result }: { result: FormResult }) {
  const bg = result === "W" ? colors.green : result === "D" ? colors.yellow : colors.red;
  return (
    <View style={[dotS.dot, { backgroundColor: bg }]}>
      <Text style={dotS.txt}>{result}</Text>
    </View>
  );
}
const dotS = StyleSheet.create({
  dot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  txt: { color: colors.blanc, fontSize: 11, fontWeight: "900" },
});

function FormRow({ team, flag, name, matches }: { team: string; flag: string | null; name: string; matches: Match[] }) {
  return (
    <View style={styles.formRow}>
      <View style={styles.formTeamLabel}>
        <Text style={{ fontSize: 20 }}>{teamFlag(team, flag)}</Text>
        <Text style={styles.formName} numberOfLines={1}>{name}</Text>
      </View>
      {matches.length === 0 ? (
        <Text style={styles.emptyTxt}>No results yet</Text>
      ) : (
        <View style={styles.dotsWrap}>
          {matches.map((fm, i) => <ResultDot key={i} result={matchResult(fm, team)} />)}
        </View>
      )}
    </View>
  );
}

export default function MatchStats() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [crowd, setCrowd] = useState<any>(null);
  const [finishedMatches, setFinishedMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [m, st, fin] = await Promise.all([
        fetchMatch(Number(id)),
        supabase.rpc("match_stats", { p_match_id: Number(id) }).then((r) => r.data),
        supabase.from("matches").select("*").eq("status", "FINISHED").order("utc_kickoff", { ascending: false }).then(r => (r.data ?? []) as Match[]),
      ]);
      setMatch(m); setCrowd(st); setFinishedMatches(fin); setLoading(false);
    })();
  }, [id]);

  const h2h = useMemo(() => {
    if (!match) return [];
    return finishedMatches.filter(fm =>
      (fm.home_team === match.home_team && fm.away_team === match.away_team) ||
      (fm.home_team === match.away_team && fm.away_team === match.home_team)
    ).slice(0, 5);
  }, [match, finishedMatches]);

  const homeForm = useMemo(() => {
    if (!match) return [];
    return finishedMatches.filter(fm =>
      fm.home_team === match.home_team || fm.away_team === match.home_team
    ).slice(0, 5);
  }, [match, finishedMatches]);

  const awayForm = useMemo(() => {
    if (!match) return [];
    return finishedMatches.filter(fm =>
      fm.home_team === match.away_team || fm.away_team === match.away_team
    ).slice(0, 5);
  }, [match, finishedMatches]);

  if (loading) return <Screen><Header title="Match Stats" /><Loading /></Screen>;
  if (!match) return <Screen><Header title="Match Stats" /></Screen>;

  const model = matchProbabilities(match.home_code, match.away_code);
  const hw = Math.round(model.homeWin * 100), dr = Math.round(model.draw * 100), aw = Math.round(model.awayWin * 100);
  const fav = hw >= dr && hw >= aw ? "home" : aw >= dr ? "away" : "draw";
  const homeN = prettyTeam(match.home_team), awayN = prettyTeam(match.away_team);
  const cTotal = crowd?.total ?? 0;
  const stage = match.group_name ?? match.stage?.replace(/_/g, " ");

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

        {/* tournament context */}
        {stage ? (
          <View style={styles.contextPill}>
            <Text style={styles.contextTxt}>FIFA World Cup 2026{stage ? ` — ${stage}` : ""}</Text>
          </View>
        ) : null}

        {/* win probability */}
        <Text style={styles.sectionTitle}>Win probability</Text>
        <View style={styles.probRow}>
          <ProbBlock color={colors.green} flag={teamFlag(match.home_team, match.home_flag)} label={homeN} pct={hw} fav={fav === "home"} />
          <ProbBlock color={colors.yellow} dark label="Draw" pct={dr} fav={fav === "draw"} />
          <ProbBlock color={colors.purple} flag={teamFlag(match.away_team, match.away_flag)} label={awayN} pct={aw} fav={fav === "away"} />
        </View>
        <View style={styles.segBar}>
          <View style={{ flex: hw, backgroundColor: colors.green }} />
          <View style={{ flex: dr, backgroundColor: colors.yellow }} />
          <View style={{ flex: aw, backgroundColor: colors.purple }} />
        </View>

        {/* head to head */}
        <Text style={styles.sectionTitle}>Head to Head</Text>
        <View style={styles.card}>
          {h2h.length === 0 ? (
            <Text style={styles.emptyTxt}>No previous meetings at this tournament yet.</Text>
          ) : (
            h2h.map((hm, i) => {
              const homeFirst = hm.home_team === match.home_team;
              const hmScore = homeFirst ? (hm.home_score ?? 0) : (hm.away_score ?? 0);
              const awScore = homeFirst ? (hm.away_score ?? 0) : (hm.home_score ?? 0);
              const winTeam = hmScore > awScore ? match.home_team : awScore > hmScore ? match.away_team : null;
              const date = hm.utc_kickoff ? new Date(hm.utc_kickoff).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "TBD";
              const comp = hm.group_name ?? hm.stage?.replace(/_/g, " ") ?? "World Cup 2026";
              return (
                <View key={i} style={[styles.h2hRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.borderSoft, marginTop: spacing.sm, paddingTop: spacing.sm }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.h2hMeta}>{date} · {comp}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 4 }}>
                      <Text style={{ fontSize: 18 }}>{teamFlag(match.home_team, match.home_flag)}</Text>
                      <Text style={styles.h2hScore}>{hmScore} – {awScore}</Text>
                      <Text style={{ fontSize: 18 }}>{teamFlag(match.away_team, match.away_flag)}</Text>
                    </View>
                  </View>
                  <View style={[styles.winnerBadge, { backgroundColor: winTeam ? colors.green : colors.yellow }]}>
                    <Text style={styles.winnerTxt}>{winTeam ? prettyTeam(winTeam).slice(0, 14) : "Draw"}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* recent form */}
        <Text style={styles.sectionTitle}>Recent Form</Text>
        <View style={styles.card}>
          <FormRow team={match.home_team} flag={match.home_flag} name={homeN} matches={homeForm} />
          <View style={{ height: 1, backgroundColor: colors.borderSoft, marginVertical: spacing.sm }} />
          <FormRow team={match.away_team} flag={match.away_flag} name={awayN} matches={awayForm} />
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

function ProbBlock({ color, flag, label, pct, fav, dark }: { color: string; flag?: string; label: string; pct: number; fav?: boolean; dark?: boolean }) {
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
  contextPill: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, alignSelf: "center", ...shadow },
  contextTxt: { color: colors.textDim, fontSize: 12, fontWeight: "800", letterSpacing: 0.3 },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: "900", letterSpacing: -0.3, marginBottom: -spacing.sm },
  probRow: { flexDirection: "row", gap: spacing.sm },
  probBlock: { flex: 1, borderRadius: radius.lg, paddingVertical: spacing.lg, alignItems: "center", gap: 4, ...shadow },
  favBlock: { transform: [{ scale: 1.04 }] },
  favBadge: { position: "absolute", top: 6, right: 6, backgroundColor: "rgba(0,0,0,0.25)", borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1 },
  favTxt: { color: colors.blanc, fontSize: 9, fontWeight: "900" },
  probPct: { fontSize: 28, fontWeight: "900", letterSpacing: -1 },
  probLabel: { fontSize: 11, fontWeight: "800", paddingHorizontal: 4 },
  segBar: { flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden" },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, ...shadow },
  emptyTxt: { color: colors.textFaint, fontSize: 13, fontWeight: "600" },
  h2hRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  h2hMeta: { color: colors.textDim, fontSize: 11, fontWeight: "700" },
  h2hScore: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  winnerBadge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  winnerTxt: { color: colors.blanc, fontSize: 11, fontWeight: "900" },
  formRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  formTeamLabel: { flexDirection: "row", alignItems: "center", gap: 6, width: 110 },
  formName: { color: colors.ink, fontSize: 12, fontWeight: "800", flex: 1 },
  dotsWrap: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  communityCard: { backgroundColor: colors.bleuSoft },
  peopleDot: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  commTitle: { color: colors.ink, fontWeight: "900", fontSize: 15 },
  commSub: { color: colors.textDim, fontWeight: "600", fontSize: 12 },
  commPct: { color: colors.greenDark, fontWeight: "900", fontSize: 12 },
});
