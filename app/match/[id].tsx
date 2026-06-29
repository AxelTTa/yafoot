import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, Header, Icon, Loading, Pill, Screen } from "../../components/ui";
import { fetchMatch, fetchMyPredictions, savePrediction } from "../../lib/api";
import { matchProbabilities } from "../../lib/odds";
import { notify } from "../../lib/notify";
import { supabase } from "../../lib/supabase";
import { colors, radius, spacing } from "../../lib/theme";
import { Match, Prediction, isUpcoming } from "../../lib/types";
import { prettyTeam, teamFlag } from "../../lib/teams";
import { APP_STORE_SAFE } from "../../lib/mode";

type HistoricalMatch = {
  year: number;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  stage: string | null;
};

type H2HData = {
  h2h_all: HistoricalMatch[] | null;
  h2h_summary: { home_wins: number; away_wins: number; draws: number; total: number } | null;
};

function Stepper({ value, set, color, side }: { value: number; set: (n: number) => void; color: string; side: "home" | "away" }) {
  return (
    <View style={styles.stepper}>
      <Pressable accessibilityLabel={`Decrease ${side} prediction`} onPress={() => set(Math.max(0, value - 1))} style={styles.stepBtn}>
        <Text style={styles.stepSign}>−</Text>
      </Pressable>
      <Text style={[styles.stepVal, { color }]}>{value}</Text>
      <Pressable accessibilityLabel={`Increase ${side} prediction`} onPress={() => set(Math.min(20, value + 1))} style={styles.stepBtn}>
        <Text style={styles.stepSign}>+</Text>
      </Pressable>
    </View>
  );
}

export default function MatchDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [match, setMatch] = useState<Match | null>(null);
  const [pred, setPred] = useState<Prediction | null>(null);
  const [home, setHome] = useState(0);
  const [away, setAway] = useState(0);
  const [initial, setInitial] = useState<{ home: number; away: number } | null>(null);
  const [touched, setTouched] = useState(false);
  const [h2hData, setH2hData] = useState<H2HData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const matchId = Number(id);
      const [m, h2h] = await Promise.all([
        fetchMatch(matchId),
        supabase.rpc("get_match_h2h", { p_match_id: matchId }).then(r => r.data as H2HData | null, () => null),
      ]);
      setMatch(m);
      setH2hData(h2h);
      const preds = await fetchMyPredictions().catch(() => ({} as Record<number, Prediction>));
      const p = preds[matchId];
      if (p) {
        setPred(p);
        setHome(p.pred_home);
        setAway(p.pred_away);
        setInitial({ home: p.pred_home, away: p.pred_away });
      } else {
        setInitial(null);
      }
      setTouched(false);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <Loading />;
  if (!match) return null;

  const open = isUpcoming(match.status);
  const canSubmit = initial ? home !== initial.home || away !== initial.away : touched && (home !== 0 || away !== 0);
  const model = matchProbabilities(match.home_code, match.away_code);
  const hw = Math.round(model.homeWin * 100);
  const dr = Math.round(model.draw * 100);
  const aw = Math.round(model.awayWin * 100);
  const histMatches = h2hData?.h2h_all ?? [];
  const histSummary = h2hData?.h2h_summary ?? null;

  async function save() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await savePrediction(match!.id, home, away);
      const saved = { pred_home: home, pred_away: away } as Prediction;
      setPred((cur) => ({ ...(cur ?? saved), ...saved }));
      setInitial({ home, away });
      setTouched(false);
      notify("Prediction saved", `${match!.home_team} ${home} - ${away} ${match!.away_team}`);
    } catch (e: any) {
      notify("Could not save", e.message);
    } finally {
      setSaving(false);
    }
  }

  const updateHome = (n: number) => {
    if (n !== home) setTouched(true);
    setHome(n);
  };
  const updateAway = (n: number) => {
    if (n !== away) setTouched(true);
    setAway(n);
  };

  return (
    <Screen>
      <Header title={match.group_name ?? match.stage?.replace(/_/g, " ") ?? (APP_STORE_SAFE ? "Friend challenge" : "Match")} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 }}>
        <View style={styles.hero}>
          <View style={styles.heroTeam}>
            <Text style={styles.heroFlag}>{teamFlag(match.home_team, match.home_flag)}</Text>
            <Text style={styles.heroName}>{prettyTeam(match.home_team)}</Text>
          </View>
          <View style={{ alignItems: "center", gap: 4 }}>
            {match.status === "FINISHED" || match.status === "IN_PLAY" || match.status === "PAUSED" ? (
              <Text style={styles.bigScore}>
                {match.home_score ?? 0} - {match.away_score ?? 0}
              </Text>
            ) : (
              <Text style={styles.vs}>VS</Text>
            )}
            {match.status === "IN_PLAY" || match.status === "PAUSED" ? (
              <Pill label={match.minute ? `${match.minute}'` : "LIVE"} color={colors.live} bg={colors.liveBg} />
            ) : match.status === "FINISHED" ? (
              <Pill label="FULL TIME" color={colors.textDim} bg={colors.surfaceAlt} />
            ) : (
              <Text style={styles.kickoff}>
                {match.utc_kickoff
                  ? new Date(match.utc_kickoff).toLocaleString([], {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "TBD"}
              </Text>
            )}
          </View>
          <View style={styles.heroTeam}>
            <Text style={styles.heroFlag}>{teamFlag(match.away_team, match.away_flag)}</Text>
            <Text style={styles.heroName}>{prettyTeam(match.away_team)}</Text>
          </View>
        </View>

        {match.venue ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <Icon name="location-outline" size={14} color={colors.textDim} />
            <Text style={styles.venue}>{match.venue}</Text>
          </View>
        ) : null}

        {open ? (
          <View style={styles.predictBox}>
            <Text style={styles.predictTitle}>{pred ? "Update your prediction" : "Make your prediction"}</Text>
            <Text style={styles.scoringHint}>Exact score = 3 pts · Correct result = 1 pt · Wrong result = 0</Text>
            <View style={styles.steppers}>
              <View style={{ alignItems: "center", flex: 1, gap: 8 }}>
                <Text style={styles.stepFlag}>{teamFlag(match.home_team, match.home_flag)}</Text>
                <Stepper value={home} set={updateHome} color={colors.bleu} side="home" />
              </View>
              <View style={{ alignItems: "center", flex: 1, gap: 8 }}>
                <Text style={styles.stepFlag}>{teamFlag(match.away_team, match.away_flag)}</Text>
                <Stepper value={away} set={updateAway} color={colors.rouge} side="away" />
              </View>
            </View>
            {canSubmit ? (
              <Button title={pred ? "Update prediction" : "Submit prediction"} onPress={save} loading={saving} style={styles.submitCentered} />
            ) : (
              <Text style={styles.stateHint}>{pred ? "Prediction saved. Change the score to update it." : "No prediction yet. Set a non-zero score to submit."}</Text>
            )}
          </View>
        ) : (
          <View style={styles.predictBox}>
            <Text style={styles.predictTitle}>Predictions locked</Text>
            {pred ? (
              <View style={{ alignItems: "center", gap: 6 }}>
                <Text style={styles.lockedPick}>
                  You picked {pred.pred_home} - {pred.pred_away}
                </Text>
                {pred.scored ? (
                  <Pill
                    label={`+${pred.points_awarded} points`}
                    color={pred.points_awarded >= 3 ? colors.gold : pred.points_awarded > 0 ? colors.live : colors.textFaint}
                    bg={colors.surfaceAlt}
                  />
                ) : (
                  <Text style={styles.kickoff}>Awaiting final whistle…</Text>
                )}
              </View>
            ) : (
              <Text style={styles.kickoff}>You didn't predict this match.</Text>
            )}
          </View>
        )}

        {!APP_STORE_SAFE ? (
          <View style={styles.statsWrap}>
            <Text style={styles.sectionTitle}>Match stats</Text>
            <View style={styles.probCard}>
              <View style={styles.probItem}>
                <Text style={styles.probPct}>{hw}%</Text>
                <Text style={styles.probLabel}>{prettyTeam(match.home_team)}</Text>
              </View>
              <View style={styles.probItem}>
                <Text style={[styles.probPct, { color: colors.orange }]}>{dr}%</Text>
                <Text style={styles.probLabel}>Draw</Text>
              </View>
              <View style={styles.probItem}>
                <Text style={[styles.probPct, { color: colors.purple }]}>{aw}%</Text>
                <Text style={styles.probLabel}>{prettyTeam(match.away_team)}</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Head-to-head World Cup history</Text>
            <View style={styles.historyCard}>
              {histSummary && histSummary.total > 0 ? (
                <View style={styles.h2hSummary}>
                  <View style={styles.h2hBlock}>
                    <Text style={[styles.h2hNum, { color: colors.green }]}>{histSummary.home_wins}</Text>
                    <Text style={styles.h2hLabel}>{prettyTeam(match.home_team)}</Text>
                  </View>
                  <View style={styles.h2hBlock}>
                    <Text style={styles.h2hNum}>{histSummary.draws}</Text>
                    <Text style={styles.h2hLabel}>Draws</Text>
                  </View>
                  <View style={styles.h2hBlock}>
                    <Text style={[styles.h2hNum, { color: colors.purple }]}>{histSummary.away_wins}</Text>
                    <Text style={styles.h2hLabel}>{prettyTeam(match.away_team)}</Text>
                  </View>
                </View>
              ) : null}
              <Text style={styles.historyMeta}>World Cup history · {histSummary?.total ?? histMatches.length} meetings</Text>
              {histMatches.length ? (
                histMatches.slice(0, 6).map((hm, i) => {
                  const homePov = hm.home_team.toLowerCase() === match.home_team.toLowerCase();
                  const hmScore = homePov ? hm.home_score : hm.away_score;
                  const awScore = homePov ? hm.away_score : hm.home_score;
                  const dispHome = homePov ? hm.home_team : hm.away_team;
                  const dispAway = homePov ? hm.away_team : hm.home_team;
                  const stageLabel = hm.stage ? hm.stage.replace(/–\s*Group Stage/, "").trim() : "Group Stage";
                  return (
                    <View key={`${hm.year}-${i}`} style={[styles.historyRow, i > 0 && styles.historyBorder]}>
                      <Text style={styles.historyDate}>{hm.year} · {stageLabel}</Text>
                      <View style={styles.historyScoreRow}>
                        <Text style={styles.historyTeam} numberOfLines={1}>{dispHome}</Text>
                        <Text style={styles.historyScore}>{hmScore}–{awScore}</Text>
                        <Text style={styles.historyTeam} numberOfLines={1}>{dispAway}</Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.stateHint}>No World Cup history found for this matchup.</Text>
              )}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroTeam: { flex: 1, alignItems: "center", gap: 8 },
  heroFlag: { fontSize: 52 },
  heroName: { color: colors.text, fontWeight: "800", textAlign: "center", fontSize: 14 },
  bigScore: { color: colors.text, fontSize: 36, fontWeight: "900" },
  vs: { color: colors.textFaint, fontSize: 22, fontWeight: "900" },
  kickoff: { color: colors.textDim, fontSize: 12, fontWeight: "600", textAlign: "center" },
  venue: { color: colors.textDim, textAlign: "center", fontSize: 13 },
  predictBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.lg,
  },
  predictTitle: { color: colors.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
  scoringHint: { color: colors.textDim, fontSize: 12, textAlign: "center", marginTop: -8 },
  steppers: { flexDirection: "row", gap: spacing.lg },
  stepFlag: { fontSize: 34 },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  stepBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.bleuSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepSign: { color: colors.text, fontSize: 24, fontWeight: "800" },
  stepVal: { fontSize: 32, fontWeight: "900", minWidth: 36, textAlign: "center" },
  lockedPick: { color: colors.text, fontSize: 16, fontWeight: "700" },
  submitCentered: { alignSelf: "center", minWidth: 190 },
  stateHint: { color: colors.textDim, fontSize: 12, fontWeight: "700", textAlign: "center" },
  statsWrap: { gap: spacing.md },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  probCard: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  probItem: { flex: 1, alignItems: "center", padding: spacing.md, gap: 4 },
  probPct: { color: colors.greenDark, fontSize: 24, fontWeight: "900" },
  probLabel: { color: colors.textDim, fontSize: 11, fontWeight: "800", textAlign: "center" },
  historyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  h2hSummary: { flexDirection: "row", justifyContent: "space-around", gap: spacing.sm },
  h2hBlock: { flex: 1, alignItems: "center" },
  h2hNum: { color: colors.textDim, fontSize: 28, fontWeight: "900" },
  h2hLabel: { color: colors.textDim, fontSize: 11, fontWeight: "800", textAlign: "center" },
  historyMeta: { color: colors.textDim, fontSize: 12, fontWeight: "900", textAlign: "center" },
  historyRow: { gap: 6 },
  historyBorder: { borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: spacing.md },
  historyDate: { color: colors.textFaint, fontSize: 11, fontWeight: "800" },
  historyScoreRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  historyTeam: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: "800" },
  historyScore: { color: colors.ink, fontSize: 16, fontWeight: "900" },
});
