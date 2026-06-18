import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, Loading, Pill } from "../../components/ui";
import { fetchMatch, fetchMyPredictions, savePrediction } from "../../lib/api";
import { notify, confirmAsync } from "../../lib/notify";
import { colors, radius, spacing } from "../../lib/theme";
import { Match, Prediction, isUpcoming } from "../../lib/types";
import { prettyTeam, teamFlag } from "../../lib/teams";

function Stepper({ value, set, color }: { value: number; set: (n: number) => void; color: string }) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={() => set(Math.max(0, value - 1))} style={styles.stepBtn}>
        <Text style={styles.stepSign}>−</Text>
      </Pressable>
      <Text style={[styles.stepVal, { color }]}>{value}</Text>
      <Pressable onPress={() => set(Math.min(20, value + 1))} style={styles.stepBtn}>
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const m = await fetchMatch(Number(id));
      setMatch(m);
      const preds = await fetchMyPredictions().catch(() => ({} as Record<number, Prediction>));
      const p = preds[Number(id)];
      if (p) {
        setPred(p);
        setHome(p.pred_home);
        setAway(p.pred_away);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <Loading />;
  if (!match) return null;

  const open = isUpcoming(match.status);

  async function save() {
    setSaving(true);
    try {
      await savePrediction(match!.id, home, away);
      notify("Prediction saved", `${match!.home_team} ${home} - ${away} ${match!.away_team}`);
      router.back();
    } catch (e: any) {
      notify("Could not save", e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: match.group_name ?? match.stage?.replace(/_/g, " ") ?? "Match",
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
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

        {match.venue ? <Text style={styles.venue}>📍 {match.venue}</Text> : null}

        {open ? (
          <View style={styles.predictBox}>
            <Text style={styles.predictTitle}>{pred ? "Update your prediction" : "Make your prediction"}</Text>
            <Text style={styles.scoringHint}>Exact score = 3 pts · Right result = 1 pt</Text>
            <View style={styles.steppers}>
              <View style={{ alignItems: "center", flex: 1, gap: 8 }}>
                <Text style={styles.stepFlag}>{teamFlag(match.home_team, match.home_flag)}</Text>
                <Stepper value={home} set={setHome} color={colors.bleu} />
              </View>
              <View style={{ alignItems: "center", flex: 1, gap: 8 }}>
                <Text style={styles.stepFlag}>{teamFlag(match.away_team, match.away_flag)}</Text>
                <Stepper value={away} set={setAway} color={colors.rouge} />
              </View>
            </View>
            <Button title={pred ? "Update Prediction" : "Lock In Prediction"} onPress={save} loading={saving} />
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
      </ScrollView>
    </View>
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
});
