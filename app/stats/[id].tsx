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
import { APP_STORE_SAFE } from "../../lib/mode";

type FormResult = "W" | "D" | "L";

type FDMatch = {
  utcDate: string;
  competition: { name: string };
  homeTeam: { name: string };
  awayTeam: { name: string };
  score: { fullTime: { home: number | null; away: number | null }; winner: string | null };
};

type HistoricalMatch = {
  year: number;
  match_date: string | null;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  stage: string | null;
  competition: string;
};

type H2HSummary = {
  home_wins: number;
  away_wins: number;
  draws: number;
  total: number;
};

type H2HData = {
  fd_h2h: {
    aggregates: {
      numberOfMatches: number;
      homeTeam: { name: string; wins: number; draws: number; losses: number };
      awayTeam: { name: string; wins: number; draws: number; losses: number };
    };
    matches: FDMatch[];
  } | null;
  h2h_all: HistoricalMatch[] | null;
  h2h_summary: H2HSummary | null;
  home_form: any[];
  away_form: any[];
  local_h2h: any[];
  home_goals: { scored: number; conceded: number; played: number };
  away_goals: { scored: number; conceded: number; played: number };
};

function biggestWin(matches: FDMatch[], fdTeamName: string): { match: FDMatch; margin: number } | null {
  let best: { match: FDMatch; margin: number } | null = null;
  for (const m of matches) {
    const isHome = m.homeTeam.name === fdTeamName;
    const isAway = m.awayTeam.name === fdTeamName;
    if (!isHome && !isAway) continue;
    const ts = isHome ? (m.score.fullTime.home ?? 0) : (m.score.fullTime.away ?? 0);
    const os = isHome ? (m.score.fullTime.away ?? 0) : (m.score.fullTime.home ?? 0);
    if (ts > os) {
      const margin = ts - os;
      if (!best || margin > best.margin) best = { match: m, margin };
    }
  }
  return best;
}

function biggestWinLabel(bw: { match: FDMatch; margin: number }, fdTeamName: string): string {
  const hm = bw.match;
  const isHome = hm.homeTeam.name === fdTeamName;
  const ts = isHome ? (hm.score.fullTime.home ?? 0) : (hm.score.fullTime.away ?? 0);
  const os = isHome ? (hm.score.fullTime.away ?? 0) : (hm.score.fullTime.home ?? 0);
  const year = new Date(hm.utcDate).getFullYear();
  return `${ts}–${os} (${hm.competition.name} ${year})`;
}

function FormChip({ fm, team }: { fm: any; team: string }) {
  const isHome = fm.home_team === team;
  const s = isHome ? (fm.home_score ?? 0) : (fm.away_score ?? 0);
  const c = isHome ? (fm.away_score ?? 0) : (fm.home_score ?? 0);
  const res: FormResult = s > c ? "W" : s === c ? "D" : "L";
  const bg = res === "W" ? colors.green : res === "D" ? colors.yellow : colors.red;
  const tx = res === "D" ? colors.ink : colors.blanc;
  return (
    <View style={[fcs.chip, { backgroundColor: bg }]}>
      <Text style={[fcs.score, { color: tx }]}>{s}–{c}</Text>
      <Text style={[fcs.res, { color: tx }]}>{res}</Text>
    </View>
  );
}
const fcs = StyleSheet.create({
  chip: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, alignItems: "center", minWidth: 52 },
  score: { fontSize: 13, fontWeight: "900" },
  res: { fontSize: 9, fontWeight: "900", marginTop: 1 },
});

function ProbBlock({ color, flag, label, pct, fav, dark }: {
  color: string; flag?: string; label: string; pct: number; fav?: boolean; dark?: boolean;
}) {
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

function StatRow({ label, homeVal, awayVal, homeHighlight, awayHighlight }: {
  label: string; homeVal: number; awayVal: number; homeHighlight?: boolean; awayHighlight?: boolean;
}) {
  return (
    <View style={str.row}>
      <Text style={[str.val, homeHighlight && { color: colors.green, fontWeight: "900" }]}>{homeVal}</Text>
      <Text style={str.lbl}>{label}</Text>
      <Text style={[str.val, awayHighlight && { color: colors.purple, fontWeight: "900" }]}>{awayVal}</Text>
    </View>
  );
}
const str = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.xs },
  lbl: { color: colors.textDim, fontSize: 12, fontWeight: "700", textAlign: "center", flex: 1 },
  val: { color: colors.ink, fontSize: 16, fontWeight: "700", minWidth: 60, textAlign: "center" },
});

export default function MatchStats() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [h2hData, setH2hData] = useState<H2HData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [m, h2h] = await Promise.all([
        fetchMatch(Number(id)),
        supabase.rpc("get_match_h2h", { p_match_id: Number(id) }).then(r => r.data as H2HData | null),
      ]);
      setMatch(m);
      setH2hData(h2h);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <Screen><Header title="Match Stats" /><Loading /></Screen>;
  if (!match) return <Screen><Header title="Match Stats" /></Screen>;

  const model = matchProbabilities(match.home_code, match.away_code);
  const hw = Math.round(model.homeWin * 100);
  const dr = Math.round(model.draw * 100);
  const aw = Math.round(model.awayWin * 100);
  const fav = hw >= dr && hw >= aw ? "home" : aw >= dr ? "away" : "draw";
  const homeN = prettyTeam(match.home_team);
  const awayN = prettyTeam(match.away_team);
  const stage = match.group_name ?? match.stage?.replace(/_/g, " ");

  const fdH2H = h2hData?.fd_h2h ?? null;
  const fdMatches: FDMatch[] = fdH2H?.matches ?? [];
  const fdAgg = fdH2H?.aggregates ?? null;
  const histMatches: HistoricalMatch[] = h2hData?.h2h_all ?? [];
  const histSummary: H2HSummary | null = h2hData?.h2h_summary ?? null;
  const homeForm: any[] = h2hData?.home_form ?? [];
  const awayForm: any[] = h2hData?.away_form ?? [];
  const localH2H: any[] = h2hData?.local_h2h ?? [];
  const homeGoals = h2hData?.home_goals ?? { scored: 0, conceded: 0, played: 0 };
  const awayGoals = h2hData?.away_goals ?? { scored: 0, conceded: 0, played: 0 };

  const homeFdName = fdAgg?.homeTeam.name ?? null;
  const awayFdName = fdAgg?.awayTeam.name ?? null;
  const homeBW = homeFdName ? biggestWin(fdMatches, homeFdName) : null;
  const awayBW = awayFdName ? biggestWin(fdMatches, awayFdName) : null;

  // Use historical data when FD data unavailable
  const showHistorical = fdMatches.length === 0 && histMatches.length > 0;
  const showFirstEver = fdMatches.length === 0 && histMatches.length === 0;

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

        {stage ? (
          <View style={styles.contextPill}>
            <Text style={styles.contextTxt}>{APP_STORE_SAFE ? "Friend challenge" : "Tournament"} — {stage}</Text>
          </View>
        ) : null}

        {/* ── Win Probability ── */}
        <Text style={styles.sectionTitle}>Win Probability</Text>
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

        {/* ── H2H Record ── */}
        <Text style={styles.sectionTitle}>Head-to-Head History</Text>
        <View style={styles.card}>
          {fdMatches.length > 0 ? (
            <>
              {fdAgg && (
                <View style={styles.h2hSummary}>
                  <View style={styles.h2hSummaryBlock}>
                    <Text style={[styles.h2hBigNum, { color: colors.green }]}>{fdAgg.homeTeam.wins}</Text>
                    <Text style={styles.h2hSmLabel}>{homeN}</Text>
                  </View>
                  <View style={styles.h2hSummaryBlock}>
                    <Text style={[styles.h2hBigNum, { color: colors.textDim }]}>{fdAgg.homeTeam.draws}</Text>
                    <Text style={styles.h2hSmLabel}>Draws</Text>
                  </View>
                  <View style={styles.h2hSummaryBlock}>
                    <Text style={[styles.h2hBigNum, { color: colors.purple }]}>{fdAgg.awayTeam.wins}</Text>
                    <Text style={styles.h2hSmLabel}>{awayN}</Text>
                  </View>
                </View>
              )}
              <Text style={styles.h2hAllComp}>
                All competitions · {fdAgg?.numberOfMatches ?? fdMatches.length} meetings
              </Text>
              {(homeBW || awayBW) && (
                <View style={styles.biggestWrap}>
                  {homeBW && homeFdName && (
                    <Text style={styles.biggestTxt}>
                      {homeN} biggest win: {biggestWinLabel(homeBW, homeFdName)}
                    </Text>
                  )}
                  {awayBW && awayFdName && (
                    <Text style={styles.biggestTxt}>
                      {awayN} biggest win: {biggestWinLabel(awayBW, awayFdName)}
                    </Text>
                  )}
                </View>
              )}
              <View style={styles.divider} />
              {fdMatches.slice(0, 8).map((hm, i) => {
                const hs = hm.score.fullTime.home ?? 0;
                const as_ = hm.score.fullTime.away ?? 0;
                const winner = hm.score.winner;
                const winnName = winner === "HOME_TEAM" ? hm.homeTeam.name : winner === "AWAY_TEAM" ? hm.awayTeam.name : null;
                const date = new Date(hm.utcDate).toLocaleDateString([], { month: "short", day: "numeric", year: "2-digit" });
                return (
                  <View key={i} style={[styles.h2hRow, i > 0 && styles.h2hRowBorder]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.h2hMeta}>{date} · {hm.competition.name}</Text>
                      <View style={styles.h2hScoreRow}>
                        <Text style={styles.h2hTeam} numberOfLines={1}>{hm.homeTeam.name}</Text>
                        <Text style={styles.h2hScore}>{hs}–{as_}</Text>
                        <Text style={styles.h2hTeam} numberOfLines={1}>{hm.awayTeam.name}</Text>
                      </View>
                    </View>
                    <View style={[styles.winnerBadge, { backgroundColor: winnName ? colors.green : colors.yellow }]}>
                      <Text style={styles.winnerTxt}>{winnName ? winnName.slice(0, 12) : "Draw"}</Text>
                    </View>
                  </View>
                );
              })}
            </>
          ) : showHistorical ? (
            <>
              {/* Historical head-to-head summary */}
              {histSummary && histSummary.total > 0 && (
                <View style={styles.h2hSummary}>
                  <View style={styles.h2hSummaryBlock}>
                    <Text style={[styles.h2hBigNum, { color: colors.green }]}>{histSummary.home_wins}</Text>
                    <Text style={styles.h2hSmLabel}>{homeN}</Text>
                  </View>
                  <View style={styles.h2hSummaryBlock}>
                    <Text style={[styles.h2hBigNum, { color: colors.textDim }]}>{histSummary.draws}</Text>
                    <Text style={styles.h2hSmLabel}>Draws</Text>
                  </View>
                  <View style={styles.h2hSummaryBlock}>
                    <Text style={[styles.h2hBigNum, { color: colors.purple }]}>{histSummary.away_wins}</Text>
                    <Text style={styles.h2hSmLabel}>{awayN}</Text>
                  </View>
                </View>
              )}
              <Text style={styles.h2hAllComp}>
                Match history · {histSummary?.total ?? histMatches.length} meetings
              </Text>
              <View style={styles.divider} />
              {histMatches.map((hm, i) => {
                // Orient relative to current match's home/away
                const homePov = hm.home_team.toLowerCase() === match.home_team.toLowerCase();
                const hmScore = homePov ? hm.home_score : hm.away_score;
                const awScore = homePov ? hm.away_score : hm.home_score;
                const dispHome = homePov ? hm.home_team : hm.away_team;
                const dispAway = homePov ? hm.away_team : hm.home_team;
                const winTeam = hmScore > awScore ? homeN : awScore > hmScore ? awayN : null;
                const stageLabel = hm.stage ? hm.stage.replace(/–\s*Group Stage/, '').trim() : 'Group Stage';
                const homeFlag = teamFlag(match.home_team, match.home_flag);
                const awayFlag = teamFlag(match.away_team, match.away_flag);
                return (
                  <View key={i} style={[styles.h2hRow, i > 0 && styles.h2hRowBorder]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.h2hMeta}>{hm.year} · {stageLabel}</Text>
                      <View style={styles.h2hScoreRow}>
                        <Text style={{ fontSize: 16 }}>{homeFlag}</Text>
                        <Text style={styles.h2hTeam} numberOfLines={1}>{dispHome}</Text>
                        <Text style={styles.h2hScore}>{hmScore}–{awScore}</Text>
                        <Text style={styles.h2hTeam} numberOfLines={1}>{dispAway}</Text>
                        <Text style={{ fontSize: 16 }}>{awayFlag}</Text>
                      </View>
                    </View>
                    <View style={[styles.winnerBadge, { backgroundColor: winTeam ? colors.green : colors.yellow }]}>
                      <Text style={styles.winnerTxt}>{winTeam ? winTeam.slice(0, 12) : "Draw"}</Text>
                    </View>
                  </View>
                );
              })}
            </>
          ) : localH2H.length > 0 ? (
            <>
              <Text style={styles.h2hAllComp}>Previous meetings</Text>
              {localH2H.map((hm: any, i: number) => {
                const homeFirst = hm.home_team === match.home_team;
                const hmScore = homeFirst ? (hm.home_score ?? 0) : (hm.away_score ?? 0);
                const awScore = homeFirst ? (hm.away_score ?? 0) : (hm.home_score ?? 0);
                const winTeam = hmScore > awScore ? homeN : awScore > hmScore ? awayN : null;
                const date = hm.utc_kickoff ? new Date(hm.utc_kickoff).toLocaleDateString([], { month: "short", day: "numeric", year: "2-digit" }) : "TBD";
                const comp = hm.group_name ?? hm.stage?.replace(/_/g, " ") ?? "Previous match";
                return (
                  <View key={i} style={[styles.h2hRow, i > 0 && styles.h2hRowBorder]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.h2hMeta}>{date} · {comp}</Text>
                      <View style={styles.h2hScoreRow}>
                        <Text style={{ fontSize: 18 }}>{teamFlag(match.home_team, match.home_flag)}</Text>
                        <Text style={styles.h2hScore}>{hmScore}–{awScore}</Text>
                        <Text style={{ fontSize: 18 }}>{teamFlag(match.away_team, match.away_flag)}</Text>
                      </View>
                    </View>
                    <View style={[styles.winnerBadge, { backgroundColor: winTeam ? colors.green : colors.yellow }]}>
                      <Text style={styles.winnerTxt}>{winTeam ? winTeam.slice(0, 12) : "Draw"}</Text>
                    </View>
                  </View>
                );
              })}
            </>
          ) : showFirstEver ? (
            <View style={{ alignItems: "center", paddingVertical: spacing.md }}>
              <Text style={styles.h2hBigNum}>🏆</Text>
              <Text style={[styles.emptyTxt, { textAlign: "center", marginTop: spacing.sm }]}>
                First recorded meeting
              </Text>
            </View>
          ) : (
            <Text style={styles.emptyTxt}>No previous meetings found.</Text>
          )}
        </View>

        {/* ── Recent Form ── */}
        <Text style={styles.sectionTitle}>Recent Form</Text>
        <View style={styles.card}>
          <View style={styles.formRow}>
            <View style={styles.formTeamLabel}>
              <Text style={{ fontSize: 20 }}>{teamFlag(match.home_team, match.home_flag)}</Text>
              <Text style={styles.formName} numberOfLines={1}>{homeN}</Text>
            </View>
            {homeForm.length === 0 ? (
              <Text style={styles.emptyTxt}>No results yet</Text>
            ) : (
              <View style={styles.chipsWrap}>
                {homeForm.map((fm, i) => <FormChip key={i} fm={fm} team={match.home_team} />)}
              </View>
            )}
          </View>
          <View style={styles.divider} />
          <View style={styles.formRow}>
            <View style={styles.formTeamLabel}>
              <Text style={{ fontSize: 20 }}>{teamFlag(match.away_team, match.away_flag)}</Text>
              <Text style={styles.formName} numberOfLines={1}>{awayN}</Text>
            </View>
            {awayForm.length === 0 ? (
              <Text style={styles.emptyTxt}>No results yet</Text>
            ) : (
              <View style={styles.chipsWrap}>
                {awayForm.map((fm, i) => <FormChip key={i} fm={fm} team={match.away_team} />)}
              </View>
            )}
          </View>
        </View>

        {/* ── Match Stats ── */}
        {(homeGoals.played > 0 || awayGoals.played > 0) && (
          <>
            <Text style={styles.sectionTitle}>Match Stats</Text>
            <View style={styles.card}>
              <View style={str.row}>
                <Text style={[str.val, { color: colors.green, fontWeight: "900" }]}>{homeN}</Text>
                <Text style={[str.lbl, { color: colors.textFaint, fontSize: 11 }]}>MATCHES</Text>
                <Text style={[str.val, { color: colors.purple, fontWeight: "900" }]}>{awayN}</Text>
              </View>
              <View style={styles.divider} />
              <StatRow
                label="Goals scored"
                homeVal={homeGoals.scored}
                awayVal={awayGoals.scored}
                homeHighlight={homeGoals.scored >= awayGoals.scored}
                awayHighlight={awayGoals.scored >= homeGoals.scored}
              />
              <StatRow
                label="Goals conceded"
                homeVal={homeGoals.conceded}
                awayVal={awayGoals.conceded}
                homeHighlight={homeGoals.conceded <= awayGoals.conceded}
                awayHighlight={awayGoals.conceded <= homeGoals.conceded}
              />
              <StatRow
                label="Matches played"
                homeVal={homeGoals.played}
                awayVal={awayGoals.played}
              />
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
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
  divider: { height: 1, backgroundColor: colors.borderSoft, marginVertical: spacing.xs },
  // H2H
  h2hSummary: { flexDirection: "row", justifyContent: "space-around", paddingVertical: spacing.sm },
  h2hSummaryBlock: { alignItems: "center", gap: 2 },
  h2hBigNum: { fontSize: 36, fontWeight: "900", letterSpacing: -1 },
  h2hSmLabel: { color: colors.textDim, fontSize: 11, fontWeight: "800" },
  h2hAllComp: { color: colors.textFaint, fontSize: 11, fontWeight: "700", textAlign: "center" },
  biggestWrap: { gap: 4, paddingVertical: spacing.xs },
  biggestTxt: { color: colors.textDim, fontSize: 12, fontWeight: "700" },
  h2hRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  h2hRowBorder: { borderTopWidth: 1, borderTopColor: colors.borderSoft, marginTop: spacing.sm, paddingTop: spacing.sm },
  h2hMeta: { color: colors.textDim, fontSize: 11, fontWeight: "700" },
  h2hScoreRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 3 },
  h2hTeam: { color: colors.ink, fontSize: 12, fontWeight: "700", flex: 1 },
  h2hScore: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  winnerBadge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  winnerTxt: { color: colors.blanc, fontSize: 11, fontWeight: "900" },
  // Form
  formRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  formTeamLabel: { flexDirection: "row", alignItems: "center", gap: 6, width: 110 },
  formName: { color: colors.ink, fontSize: 12, fontWeight: "800", flex: 1 },
  chipsWrap: { flexDirection: "row", gap: 4, flexWrap: "wrap", flex: 1 },
});
